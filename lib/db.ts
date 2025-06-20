// lib/db.ts
const { Pool } = require("pg"); // ✅ CommonJS-style import (works with TS)


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Neon, Railway, etc.
  },
});

export default pool;
