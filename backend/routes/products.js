const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/products?cat=Metal+Trophy&search=gold
router.get('/', async (req, res) => {
  const { cat, search } = req.query;
  const params = [];
  let   where  = ['p.is_active = true'];

  if (cat && cat !== 'All') {
    params.push(cat);
    where.push(`c.name = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length})`);
  }

  const sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.is_new DESC, p.created_at DESC
  `;

  const result = await db.query(sql, params);
  res.json(result.rows);
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  const result = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(result.rows);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const result = await db.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.is_active = true`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
});

module.exports = router;
