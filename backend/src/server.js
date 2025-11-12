require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username = '', email, password, dob = null, phone = null } = req.body || {};

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields!' });
    }
    if ([username, firstName, lastName].some(v => v?.toLowerCase().includes('admin'))) {
      return res.status(400).json({ success: false, message: "You cannot use 'admin' in your first name, last name, or username!" });
    }

    const conn = await pool.getConnection();
    try {
      const [dup] = await conn.execute(
        'SELECT id FROM users WHERE username = ? OR email = ? OR phone_number = ? LIMIT 1',
        [username || null, email, phone || null]
      );
      if (dup.length) {
        return res.json({ success: false, message: 'This account already exists. Please login instead.' });
      }

      const hash = await bcrypt.hash(password, 10);
      await conn.execute(
        'INSERT INTO users (first_name, last_name, username, email, password, birth_date, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [firstName, lastName, username || lastName, email, hash, dob || null, phone || null]
      );

      return res.json({ success: true, message: 'User successfully created!' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
