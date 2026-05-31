const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

/* ─── Multer — product image uploads ───────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    cb(null, uid + path.extname(file.originalname).toLowerCase());
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

/* ─── DASHBOARD ─────────────────────────────────────────── */
router.get('/dashboard', async (req, res) => {
  const [[orders], [products], [users], [revenue], recentOrders] = await Promise.all([
    db.query("SELECT COUNT(*) AS c FROM orders WHERE status != 'cancelled'").then(r => r.rows),
    db.query("SELECT COUNT(*) AS c FROM products WHERE is_active=true").then(r => r.rows),
    db.query("SELECT COUNT(*) AS c FROM users").then(r => r.rows),
    db.query("SELECT COALESCE(SUM(total),0) AS c FROM orders WHERE status='paid'").then(r => r.rows),
    db.query(`
      SELECT o.*, u.name AS user_name, u.email AS user_email
      FROM orders o LEFT JOIN users u ON o.user_id=u.id
      ORDER BY o.created_at DESC LIMIT 8
    `).then(r => r.rows),
  ]);

  res.json({
    stats: {
      orders:   parseInt(orders.c),
      products: parseInt(products.c),
      users:    parseInt(users.c),
      revenue:  parseFloat(revenue.c),
    },
    recentOrders,
  });
});

/* ─── PRODUCTS ──────────────────────────────────────────── */
router.get('/products', async (req, res) => {
  const r = await db.query(`
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON p.category_id=c.id
    ORDER BY p.created_at DESC
  `);
  res.json(r.rows);
});

router.post('/products', upload.single('image'), async (req, res) => {
  const { name, category_id, description, sizes, is_new, discount_percent } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const sizesArr = parseJSON(sizes, []);

  const minPrice = sizesArr.length > 0
    ? Math.min(...sizesArr.map(s => Number(s.price) || 0))
    : 0;

  const r = await db.query(
    `INSERT INTO products (name, category_id, price, description, image_url, sizes, is_new, discount_percent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, category_id, minPrice, description, image_url,
     JSON.stringify(sizesArr), is_new === 'true', Number(discount_percent) || 0]
  );
  res.status(201).json(r.rows[0]);
});

router.put('/products/:id', upload.single('image'), async (req, res) => {
  const ex = await db.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!ex.rows.length) return res.status(404).json({ error: 'Product not found' });
  const e = ex.rows[0];

  const { name, category_id, description, sizes, is_new, is_active, discount_percent } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : e.image_url;
  const sizesArr = sizes ? parseJSON(sizes, e.sizes) : e.sizes;

  const minPrice = sizesArr.length > 0
    ? Math.min(...sizesArr.map(s => Number(s.price) || 0))
    : e.price;

  const r = await db.query(
    `UPDATE products
     SET name=$1, category_id=$2, price=$3, description=$4,
         image_url=$5, sizes=$6, is_new=$7, is_active=$8,
         discount_percent=$9, updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [
      name        ?? e.name,
      category_id ?? e.category_id,
      minPrice,
      description !== undefined ? description : e.description,
      image_url,
      JSON.stringify(sizesArr),
      is_new    !== undefined ? is_new    === 'true' : e.is_new,
      is_active !== undefined ? is_active === 'true' : e.is_active,
      discount_percent !== undefined ? Number(discount_percent) : (e.discount_percent || 0),
      req.params.id,
    ]
  );
  res.json(r.rows[0]);
});

router.delete('/products/:id', async (req, res) => {
  await db.query('UPDATE products SET is_active=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

/* ─── CATEGORIES ────────────────────────────────────────── */
router.get('/categories', async (req, res) => {
  const r = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(r.rows);
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const r = await db.query(
    'INSERT INTO categories (name,slug) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *',
    [name, slug]
  );
  res.status(201).json(r.rows[0] || { error: 'Category already exists' });
});

/* ─── BANNERS ───────────────────────────────────────────── */
router.get('/banners', async (req, res) => {
  const r = await db.query('SELECT * FROM banners ORDER BY position');
  res.json(r.rows);
});

router.put('/banners/:id', upload.single('image'), async (req, res) => {
  const ex = await db.query('SELECT * FROM banners WHERE id=$1', [req.params.id]);
  if (!ex.rows.length) return res.status(404).json({ error: 'Banner not found' });
  const e = ex.rows[0];

  const { title, subtitle, btn_primary_text, btn_secondary_text, is_active } = req.body;
  const image_url = req.file
    ? `/uploads/${req.file.filename}`
    : e.image_url;

  const r = await db.query(
    `UPDATE banners
     SET title=$1, subtitle=$2, btn_primary_text=$3, btn_secondary_text=$4,
         is_active=$5, image_url=$6
     WHERE id=$7 RETURNING *`,
    [
      title              ?? e.title,
      subtitle           ?? e.subtitle,
      btn_primary_text   ?? e.btn_primary_text,
      btn_secondary_text ?? e.btn_secondary_text,
      is_active !== false,
      image_url,
      req.params.id,
    ]
  );
  res.json(r.rows[0]);
});
/* ─── COUPONS ───────────────────────────────────────────── */
router.get('/coupons', async (req, res) => {
  const r = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json(r.rows);
});

router.post('/coupons', async (req, res) => {
  const { code, discount_type, discount_value, min_order_value, max_uses, expires_at } = req.body;
  const r = await db.query(
    `INSERT INTO coupons
       (code, discount_type, discount_value, min_order_value, max_uses, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      code.toUpperCase(),
      discount_type,
      discount_value,
      min_order_value || 0,
      max_uses  || null,
      expires_at || null,
    ]
  );
  res.status(201).json(r.rows[0]);
});

router.put('/coupons/:id', async (req, res) => {
  const { is_active } = req.body;
  const r = await db.query(
    'UPDATE coupons SET is_active=$1 WHERE id=$2 RETURNING *',
    [is_active, req.params.id]
  );
  res.json(r.rows[0]);
});

router.delete('/coupons/:id', async (req, res) => {
  await db.query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

/* ─── ORDERS ────────────────────────────────────────────── */
router.get('/orders', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let filter = '';

  if (status) {
    params.push(status);
    filter = `WHERE o.status=$${params.length}`;
  }

  params.push(Number(limit), Number(offset));
  const r = await db.query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email
     FROM orders o LEFT JOIN users u ON o.user_id=u.id
     ${filter}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const tot = await db.query(
    status
      ? 'SELECT COUNT(*) AS c FROM orders WHERE status=$1'
      : 'SELECT COUNT(*) AS c FROM orders',
    status ? [status] : []
  );

  res.json({ orders: r.rows, total: parseInt(tot.rows[0].c) });
});

router.put('/orders/:id', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','paid','processing','shipped','delivered','cancelled'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const r = await db.query(
    'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [status, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
  res.json(r.rows[0]);
});

/* ─── USERS ─────────────────────────────────────────────── */
router.get('/users', async (req, res) => {
  const r = await db.query(
    'SELECT id, email, name, avatar, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(r.rows);
});

router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['customer','admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  const r = await db.query(
    'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, name, role',
    [role, req.params.id]
  );
  res.json(r.rows[0]);
});

/* ─── CONTACT MESSAGES ──────────────────────────────────── */

// GET all messages (with optional ?unread=true filter)
router.get('/messages', async (req, res) => {
  const { unread } = req.query;
  const filter = unread === 'true' ? 'WHERE is_read = false' : '';
  const r = await db.query(
    `SELECT * FROM contact_messages ${filter} ORDER BY created_at DESC`
  );
  const unreadCount = await db.query(
    'SELECT COUNT(*) AS c FROM contact_messages WHERE is_read = false'
  );
  res.json({ messages: r.rows, total: r.rows.length, unread: parseInt(unreadCount.rows[0].c) });
});

// Mark as read
router.put('/messages/:id/read', async (req, res) => {
  const r = await db.query(
    'UPDATE contact_messages SET is_read = true WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Message not found' });
  res.json(r.rows[0]);
});

// Mark as unread
router.put('/messages/:id/unread', async (req, res) => {
  const r = await db.query(
    'UPDATE contact_messages SET is_read = false WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Message not found' });
  res.json(r.rows[0]);
});

// Delete
router.delete('/messages/:id', async (req, res) => {
  await db.query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

/* ─── Utility ───────────────────────────────────────────── */
function parseJSON(str, fallback) {
  try { return typeof str === 'string' ? JSON.parse(str) : str; }
  catch { return fallback; }
}

module.exports = router;