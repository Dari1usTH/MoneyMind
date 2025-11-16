const path = require('path');
require('dotenv').config({
  path: path.join('D:', 'Proiecte', '.env')
});
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

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

const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const pendingUsers = new Map();
const pendingLoginUsers = new Map();

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username = '',
      email,
      password,
      dob = null,
      phone = null,
    } = req.body || {};

    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Please fill in all required fields!' });
    }

    if ([username, firstName, lastName].some((v) => v?.toLowerCase().includes('admin'))) {
      return res.status(400).json({
        success: false,
        message: "You cannot use 'admin' in your first name, last name, or username!",
      });
    }
    
    const finalUsername = (username || firstName).trim();
    const conn = await pool.getConnection();
    try {
      const [dupRows] = await conn.execute(
        'SELECT id, username, email, phone_number FROM users WHERE username = ? OR email = ? OR phone_number = ? LIMIT 1',
        [username || null, email, phone || null]
      );

      if (dupRows.length) {
        const existing = dupRows[0];

        if (phone && existing.phone_number === phone) {
          return res.json({
            success: false,
            message:
              'This phone number is already associated with an account. Please try logging in.',
          });
        }

        if (email && existing.email === email) {
          return res.json({
            success: false,
            message:
              'This email address is already associated with an account. Please try logging in.',
          });
        }

        if (username && existing.username === username) {
          return res.json({
            success: false,
            message:
              'This username is already taken. Please choose another one or try logging in.',
          });
        }

        return res.json({
          success: false,
          message: 'This account already exists. Please try logging in.',
        });
      }
    } finally {
      conn.release();
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const passwordHash = await bcrypt.hash(password, 10);

    const expiresAt = Date.now() + 15 * 60 * 1000; 
    pendingUsers.set(email, {
      firstName,
      lastName,
      username: finalUsername,
      email,
      passwordHash,
      dob: dob || null,
      phone: phone || null,
      code,
      expiresAt,
    });

    try {
      await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: email,
        subject: 'MoneyMind - Email Verification Code',
        text: `Your verification code is: ${code}`,
        html: `
          <h2>MoneyMind - Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">
            ${code}
          </div>
          <p>This code will expire in 15 minutes.</p>
        `,
      });
    } catch (mailErr) {
      console.error('Error sending verification email:', mailErr);
      pendingUsers.delete(email);
      return res.status(500).json({
        success: false,
        message: 'Could not send verification email. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: 'A verification code has been sent to your email. Please check your inbox.',
      email,
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: 'Server error. Please try again later.' });
  }
});

app.post('/api/register-verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and verification code are required.' });
    }

    const pending = pendingUsers.get(email);
    if (!pending) {
      return res.json({
        success: false,
        message: 'No pending registration found for this email. Please register again.',
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingUsers.delete(email);
      return res.json({
        success: false,
        message: 'This verification code has expired. Please register again.',
      });
    }

    if (pending.code !== code) {
      return res.json({
        success: false,
        message: 'Invalid verification code. Please try again.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        'INSERT INTO users (first_name, last_name, username, email, password, birth_date, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          pending.firstName,
          pending.lastName,
          pending.username,
          pending.email,
          pending.passwordHash,
          pending.dob,
          pending.phone,
        ]
      );
    } finally {
      conn.release();
    }

    pendingUsers.delete(email);

    return res.json({
      success: true,
      message: 'Your account has been created successfully.',
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: 'Server error. Please try again later.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.json({ success: false, message: "Please fill in all fields!" });
    }

    const conn = await pool.getConnection();
    let rows;
    try {
      rows = (
        await conn.execute(
          'SELECT id, email, username, first_name, password FROM users WHERE email = ? OR username = ? LIMIT 1',
          [identifier, identifier]
        )
      )[0];
    } finally {
      conn.release();
    }

    if (!rows.length) {
      return res.json({
        success: false,
        message: "This user does not exist. Please register first!",
      });
    }

    const user = rows[0];

    const passMatch = await bcrypt.compare(password, user.password);
    if (!passMatch) {
      return res.json({
        success: false,
        message: "Incorrect password. Please try again.",
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    pendingLoginUsers.set(user.email, {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      code,
      expiresAt,
    });

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: user.email,
      subject: "MoneyMind - Login Verification Code",
      html: `
        <h2>MoneyMind Login Verification</h2>
        <p>Your login verification code is:</p>
        <h1 style="letter-spacing:6px">${code}</h1>
        <p>The code expires in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: "A login verification code has been sent to your email.",
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

app.post('/api/login-verify', async (req, res) => {
  try {
    const { email, code, remember } = req.body || {};

    if (!email || !code) {
      return res.json({
        success: false,
        message: "Email and code are required.",
      });
    }

    const pending = pendingLoginUsers.get(email);
    if (!pending) {
      return res.json({
        success: false,
        message: "No pending login found. Please try again.",
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingLoginUsers.delete(email);
      return res.json({
        success: false,
        message: "Verification code expired. Please login again.",
      });
    }

    if (pending.code !== code) {
      return res.json({
        success: false,
        message: "Invalid code. Please try again.",
      });
    }

    pendingLoginUsers.delete(email);

    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    };

    if (remember) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    res.cookie("session", pending.id, cookieOptions);

    return res.json({
      success: true,
      message: "Login successful!",
      username: pending.username,
      first_name: pending.first_name,
    });

  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Server error.",
    });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // true if https
  });

  return res.json({ success: true });
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

