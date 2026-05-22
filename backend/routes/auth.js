const express = require('express');
const router  = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db  = require('../db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { credential }   — the JWT returned by Google Identity Services
 * Returns: { token, user }
 */
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'No credential provided' });

  // 1) Verify the Google ID token
  const ticket = await client.verifyIdToken({
    idToken:  credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { sub: google_id, email, name, picture: avatar } = ticket.getPayload();

  // 2) Upsert user into DB
  const result = await db.query(
    `INSERT INTO users (google_id, email, name, avatar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET email  = EXCLUDED.email,
           name   = EXCLUDED.name,
           avatar = EXCLUDED.avatar,
           updated_at = NOW()
     RETURNING id, email, name, avatar, role`,
    [google_id, email, name, avatar]
  );

  const user = result.rows[0];

  // 3) Sign our own JWT (7-day expiry)
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

/**
 * GET /api/auth/me  — returns current user info from JWT
 */
router.get('/me', (req, res) => {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
