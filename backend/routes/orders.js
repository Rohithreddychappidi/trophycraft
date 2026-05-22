const express  = require('express');
const router   = express.Router();
const Razorpay = require('razorpay');
const crypto   = require('crypto');
const db       = require('../db');
const { authenticate } = require('../middleware/auth');

// Razorpay initialised lazily so missing keys don't crash the whole server on start
let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    }
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

/* ─── Helpers ─────────────────────────────────────────── */
function generateOrderNumber() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `TC-${ts}-${rnd}`;
}

/* ─── Validate coupon & return discount amount ─────────── */
async function applyCoupon(code, subtotal) {
  if (!code) return { discount: 0, valid: false };
  const result = await db.query(
    `SELECT * FROM coupons
     WHERE code = $1 AND is_active = true
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses   IS NULL OR used_count < max_uses)`,
    [code.toUpperCase()]
  );
  if (!result.rows.length) return { discount: 0, valid: false, error: 'Invalid or expired coupon' };
  const c = result.rows[0];
  if (subtotal < c.min_order_value)
    return { discount: 0, valid: false, error: `Min. order ₹${c.min_order_value} required for this coupon` };

  const discount = c.discount_type === 'percent'
    ? Math.min(subtotal * c.discount_value / 100, subtotal)
    : Math.min(Number(c.discount_value), subtotal);

  return { discount: Math.round(discount * 100) / 100, valid: true, coupon: c };
}

/* ─── POST /api/orders/validate-coupon ─────────────────── */
router.post('/validate-coupon', authenticate, async (req, res) => {
  const { code, subtotal } = req.body;
  const result = await applyCoupon(code, Number(subtotal));
  if (!result.valid) return res.status(400).json({ error: result.error || 'Invalid coupon' });
  res.json({
    valid:          true,
    code:           result.coupon.code,
    discount_type:  result.coupon.discount_type,
    discount_value: result.coupon.discount_value,
    discount_amount: result.discount,
  });
});

/* ─── POST /api/orders — create order + Razorpay order ─── */
router.post('/', authenticate, async (req, res) => {
  const { items, coupon_code, shipping_address } = req.body;

  if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });
  if (!shipping_address?.name || !shipping_address?.phone || !shipping_address?.address)
    return res.status(400).json({ error: 'Shipping address is required' });

  // Re-calculate prices server-side (never trust client-sent prices)
  let subtotal = 0;
  const enrichedItems = [];
  for (const item of items) {
    const p = await db.query(
      'SELECT id, name, price FROM products WHERE id=$1 AND is_active=true',
      [item.product_id]
    );
    if (!p.rows.length) return res.status(400).json({ error: `Product ID ${item.product_id} not found` });
    const product = p.rows[0];
    const lineTotal = Number(product.price) * Number(item.quantity);
    subtotal += lineTotal;
    enrichedItems.push({
      product_id:  product.id,
      product_name: product.name,
      size_key:    item.size_key,
      size_label:  item.size_label,
      price:       product.price,
      quantity:    item.quantity,
      line_total:  lineTotal,
    });
  }

  // Apply coupon
  const { discount, valid: couponValid, error: couponError } = await applyCoupon(coupon_code, subtotal);
  if (coupon_code && !couponValid)
    return res.status(400).json({ error: couponError });

  const total = Math.max(0, subtotal - discount);

  // Create Razorpay order
  const rzpOrder = await getRazorpay().orders.create({
    amount:   Math.round(total * 100), // paise
    currency: 'INR',
    receipt:  generateOrderNumber(),
  });

  // Persist to DB
  const orderNum = generateOrderNumber();
  const result = await db.query(
    `INSERT INTO orders
       (order_number, user_id, items, subtotal, discount, total, coupon_code, razorpay_order_id, shipping_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      orderNum,
      req.user.id,
      JSON.stringify(enrichedItems),
      subtotal,
      discount,
      total,
      coupon_code ? coupon_code.toUpperCase() : null,
      rzpOrder.id,
      JSON.stringify(shipping_address),
    ]
  );

  res.json({
    order: result.rows[0],
    razorpay: {
      key_id:    process.env.RAZORPAY_KEY_ID,
      order_id:  rzpOrder.id,
      amount:    rzpOrder.amount,
      currency:  rzpOrder.currency,
      name:      'TrophyCraft',
      description: `Order ${orderNum}`,
    },
  });
});

/* ─── POST /api/orders/:id/verify — confirm Razorpay payment */
router.post('/:id/verify', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify HMAC signature
  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expected !== razorpay_signature)
    return res.status(400).json({ error: 'Payment verification failed — invalid signature' });

  // Mark order as paid
  const result = await db.query(
    `UPDATE orders
     SET status = 'paid', razorpay_payment_id = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [razorpay_payment_id, req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });

  // Increment coupon usage
  const order = result.rows[0];
  if (order.coupon_code) {
    await db.query(
      'UPDATE coupons SET used_count = used_count + 1 WHERE code = $1',
      [order.coupon_code]
    );
  }

  res.json({ success: true, order });
});

/* ─── GET /api/orders/my — user's own orders ───────────── */
router.get('/my', authenticate, async (req, res) => {
  const result = await db.query(
    'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;