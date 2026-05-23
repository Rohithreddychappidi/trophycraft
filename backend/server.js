require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

/* ─── Middleware ────────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ─── Routes ─────────────────────────────────────────────── */
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/admin',    require('./routes/admin'));

// Public contact form — no auth required
const db = require('./db');
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, enquiry_type, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ error: 'Name, email and message are required' });
    await db.query(
      `INSERT INTO contact_messages (name, email, phone, enquiry_type, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, phone || null, enquiry_type || 'General Enquiry', message]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Contact form error:', e);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Public shorthand: /api/banners → same as /api/products/banners-public

app.get('/api/banners', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM banners WHERE is_active = true ORDER BY position LIMIT 5'
    );
    res.json(r.rows);
  } catch (e) {
    res.json([]); // fail gracefully — frontend shows default hero text
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

/* ─── Global error handler ───────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

/* ─── Start ──────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🏆  TrophyCraft API running → http://localhost:${PORT}`);
});