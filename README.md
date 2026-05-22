# 🏆 TrophyCraft – Awards E-commerce Website

Full-stack awards/trophy e-commerce with:
- **Frontend**: Vanilla HTML/CSS/JS → Deploy on **Vercel**
- **Backend**: Express.js + NeonDB (PostgreSQL) → Deploy on **Linux Server**
- **Auth**: Google OAuth (Google Identity Services)
- **Payments**: Razorpay
- **DB**: NeonDB (serverless Postgres)

---

## 📁 Project Structure

```
trophycraft/
├── backend/
│   ├── db/
│   │   ├── index.js       ← DB connection pool
│   │   ├── init.js        ← Run once to create tables
│   │   └── schema.sql     ← All SQL (tables + seed data)
│   ├── middleware/
│   │   └── auth.js        ← JWT verify + admin guard
│   ├── routes/
│   │   ├── auth.js        ← Google OAuth + /me
│   │   ├── products.js    ← Public product listing
│   │   ├── orders.js      ← Cart → Razorpay → verify
│   │   └── admin.js       ← Full CRUD (products, orders, coupons, banners, users)
│   ├── uploads/           ← Product images (auto-created)
│   ├── server.js          ← Express entry point
│   ├── package.json
│   └── .env.example       ← Copy to .env and fill in
│
└── frontend/
    ├── index.html         ← Customer store
    ├── admin.html         ← Admin panel
    └── vercel.json        ← Vercel routing
```

---

## 🚀 Quick Start (Local Development)

### Step 1 – Clone / open in VS Code

Open the `trophycraft` folder in VS Code.

---

### Step 2 – NeonDB Setup

1. Go to **https://neon.tech** → Sign up (free)
2. Create a new project → name it `trophycraft`
3. Copy the **Connection String** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

---

### Step 3 – Google OAuth Setup

1. Go to **https://console.cloud.google.com**
2. Create a new project (or use existing)
3. APIs & Services → Credentials → Create Credentials → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized JavaScript origins:
   - `http://localhost:3000` (or wherever you serve frontend)
   - `http://localhost:5000`
   - `https://yourdomain.vercel.app` (add after deploy)
6. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

---

### Step 4 – Razorpay Setup

1. Go to **https://dashboard.razorpay.com** → Sign up
2. Settings → API Keys → Generate Test Key
3. Copy **Key ID** and **Key Secret**

---

### Step 5 – Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env from template
cp .env.example .env
```

Edit `.env` and fill in all values:
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...    ← from NeonDB
JWT_SECRET=any-long-random-string
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
BACKEND_URL=http://localhost:5000
```

Initialize the database (creates all tables + seeds sample products):
```bash
node db/init.js
```

Start the backend:
```bash
npm run dev     # development (auto-restart)
# or
npm start       # production
```

Backend runs at: **http://localhost:5000**

---

### Step 6 – Frontend Setup

Open `frontend/index.html` in your browser OR use a simple static server:

```bash
# Option A: VS Code Live Server extension (recommended)
# Right-click index.html → Open with Live Server

# Option B: npx
npx serve frontend
```

**Important:** Edit the CONFIG block at the top of both HTML files:

In `frontend/index.html` (line ~290):
```javascript
const CONFIG = {
  API_URL:          'http://localhost:5000',   // ← your backend
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',   // ← from Google Console
};
```

Same edit in `frontend/admin.html` (line ~290).

---

### Step 7 – Make yourself an admin

After signing in with Google on the site, run this in NeonDB SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Then go to `http://localhost:3000/admin.html` and sign in.

---

## 🌐 Deployment

### Frontend → Vercel

1. Push `frontend/` folder to GitHub
2. Go to **https://vercel.com** → New Project → Import repo
3. Set **Root Directory** to `frontend`
4. Deploy → You get a URL like `https://trophycraft.vercel.app`
5. Add that URL to Google OAuth **Authorized JavaScript origins**
6. Update `CONFIG.API_URL` in both HTML files to your backend URL

### Backend → Linux Server

```bash
# On your server
git clone your-repo
cd trophycraft/backend
npm install --production

# Create .env with production values
# FRONTEND_URL = https://trophycraft.vercel.app
# BACKEND_URL  = https://api.yourdomain.com

# Run with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name trophycraft-api
pm2 save
pm2 startup

# Or with systemd — create /etc/systemd/system/trophycraft.service
```

**Nginx config (reverse proxy)**:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /path/to/trophycraft/backend/uploads/;
    }
}
```

---

## 🔑 API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (filter: `?cat=Metal Trophy&search=gold`) |
| GET | `/api/products/categories` | All categories |
| GET | `/api/products/:id` | Single product |
| POST | `/api/auth/google` | Google sign-in → returns JWT |
| GET | `/api/auth/me` | Current user from JWT |

### Authenticated (Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Create order + Razorpay order |
| POST | `/api/orders/:id/verify` | Verify Razorpay payment |
| POST | `/api/orders/validate-coupon` | Check coupon |
| GET | `/api/orders/my` | User's orders |

### Admin only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Stats + recent orders |
| GET/POST | `/api/admin/products` | List / add products |
| PUT/DELETE | `/api/admin/products/:id` | Edit / delete product |
| GET | `/api/admin/orders` | All orders |
| PUT | `/api/admin/orders/:id` | Update order status |
| GET/POST | `/api/admin/coupons` | List / create coupons |
| PUT/DELETE | `/api/admin/coupons/:id` | Toggle / delete coupon |
| GET | `/api/admin/banners` | Get banners |
| PUT | `/api/admin/banners/:id` | Edit banner/hero text |
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/:id/role` | Grant/revoke admin |

---

## ✅ Features Checklist

- [x] Google Sign-In / Sign-Out
- [x] Product listing with search & category filter
- [x] Product cards with hover size preview (max 3 sizes)
- [x] Per-size quantity selector on each card
- [x] Slide-in cart panel
- [x] Checkout modal with shipping address
- [x] Coupon code validation
- [x] Razorpay payment integration
- [x] Server-side payment signature verification
- [x] Order stored in NeonDB after payment
- [x] Admin: Dashboard with stats
- [x] Admin: Add / Edit / Delete products (with image upload)
- [x] Admin: Edit hero banner text
- [x] Admin: Create / toggle / delete coupons
- [x] Admin: View & manage orders + update status
- [x] Admin: User management (grant/revoke admin)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JS |
| Backend | Node.js + Express |
| Database | NeonDB (Serverless PostgreSQL) |
| Auth | Google Identity Services + JWT |
| Payments | Razorpay |
| Image Uploads | Multer (local disk) |
| Frontend Deploy | Vercel |
| Backend Deploy | Linux + PM2 + Nginx |
