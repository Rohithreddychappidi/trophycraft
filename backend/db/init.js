require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const db   = require('./index');

async function init() {
  console.log('Connecting to NeonDB…');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('✅  Database initialized successfully!');
  process.exit(0);
}

init().catch(err => {
  console.error('❌  Failed to initialize database:', err.message);
  process.exit(1);
});
