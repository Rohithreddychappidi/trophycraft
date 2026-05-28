-- TrophyCraft Database Schema
-- Run: node db/init.js  OR  copy-paste into Neon SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(100) UNIQUE,
  email VARCHAR(200) UNIQUE NOT NULL,
  name VARCHAR(200),
  avatar VARCHAR(500),
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

-- Seed categories
INSERT INTO categories (name, slug) VALUES
  ('Metal Trophy',  'metal-trophy'),
  ('Acrylic Award', 'acrylic-award'),
  ('Wood Trophy',   'wood-trophy'),
  ('Fiber Trophy',  'fiber-trophy'),
  ('Gift',          'gift')
ON CONFLICT DO NOTHING;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  is_new BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sizes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Banners / Hero content
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) DEFAULT 'Premium Awards & Trophies',
  subtitle TEXT DEFAULT 'Celebrate achievement with handcrafted metal, acrylic, wood, and fiber trophies',
  btn_primary_text VARCHAR(100) DEFAULT 'Browse Collection',
  btn_secondary_text VARCHAR(100) DEFAULT 'Get a Quote',
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO banners (title, subtitle) VALUES
  ('Premium Awards & Trophies',
   'Celebrate achievement with handcrafted metal, acrylic, wood, and fiber trophies — customized for every occasion.')
ON CONFLICT DO NOTHING;

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE,
  user_id INTEGER REFERENCES users(id),
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  coupon_code VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled')),
  razorpay_order_id VARCHAR(200),
  razorpay_payment_id VARCHAR(200),
  shipping_address JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed sample products (optional, remove if you want to add via admin)
INSERT INTO products (name, category_id, price, description, is_new, sizes) VALUES
  ('Gold Champion Trophy',  1, 1299, 'Premium gold plated metal trophy, perfect for sports events and corporate recognition.', true,
   '[{"key":"A","label":"6 inch"},{"key":"B","label":"9 inch"},{"key":"C","label":"12 inch"}]'),
  ('Crystal Acrylic Shield', 2, 899, 'Crystal clear acrylic award with an elegant geometric design and optional laser engraving.', false,
   '[{"key":"A","label":"Small"},{"key":"B","label":"Medium"},{"key":"C","label":"Large"}]'),
  ('Walnut Wood Plaque',     3, 749, 'Natural walnut wood plaque with precision laser engraving, ideal for certificates and mementos.', true,
   '[{"key":"A","label":"8x6 in"},{"key":"B","label":"10x8 in"},{"key":"C","label":"12x10 in"}]'),
  ('Fiber Star Award',       4, 599, 'Durable high-gloss fiber star award in multiple sizes, great for academic events.', false,
   '[{"key":"A","label":"7 inch"},{"key":"B","label":"10 inch"},{"key":"C","label":"14 inch"}]'),
  ('Premium Gift Box Set',   5, 1899, 'Luxurious gift box set for corporate gifting and VIP recognition.', true,
   '[{"key":"A","label":"Small"},{"key":"B","label":"Medium"},{"key":"C","label":"Large"}]'),
  ('Silver Sports Cup',      1, 999, 'Classic silver finish sports cup, a timeless award for competition winners.', false,
   '[{"key":"A","label":"6 inch"},{"key":"B","label":"9 inch"},{"key":"C","label":"12 inch"}]'),
  ('Blue Acrylic Tower',     2, 1199, 'Striking blue-tinted acrylic tower award, a modern choice for tech and corporate awards.', true,
   '[{"key":"A","label":"Small"},{"key":"B","label":"Medium"},{"key":"C","label":"Large"}]'),
  ('Rosewood Shield',        3, 849, 'Rosewood veneer shield plaque with brass plate engraving, elegance personified.', false,
   '[{"key":"A","label":"8x6 in"},{"key":"B","label":"10x8 in"},{"key":"C","label":"12x10 in"}]')
ON CONFLICT DO NOTHING;
-- Contact Messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  email        VARCHAR(200) NOT NULL,
  phone        VARCHAR(50),
  enquiry_type VARCHAR(100) DEFAULT 'General Enquiry',
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  created_at   TIMESTAMP DEFAULT NOW()
);
UPDATE products
SET sizes = '[{"key":"A","label":"6 inch","price":999},{"key":"B","label":"9 inch","price":1299},{"key":"C","label":"12 inch","price":1599}]'
WHERE id = 1;

INSERT INTO categories (name, slug) VALUES
  ('Cricket',  'cricket'),
  ('Football', 'football'),
  ('Others',   'others')
ON CONFLICT DO NOTHING;

ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);