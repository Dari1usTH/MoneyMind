const path = require('path');
require('dotenv').config({
  path: path.join('D:', 'Proiecte', '.env')
});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const crypto = require('crypto');
const MARKET_API_BASE = 'https://api.twelvedata.com';
const MARKET_API_KEY = process.env.MARKET_API_KEY || '';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const isLocalhost =
      /^https?:\/\/localhost(?::\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);

    if (isLocalhost || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset attempts. Please try again later.' },
});

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
const passwordResetRequests = new Map(); 

async function verifyCaptchaToken(token) {
  if (!process.env.RECAPTCHA_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[reCAPTCHA] RECAPTCHA_SECRET missing in production!');
      return false;
    }
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET missing – skipping in dev.');
    return true;
  }

  if (!token) {
    console.warn('[reCAPTCHA] Missing token.');
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', process.env.RECAPTCHA_SECRET);
    params.append('response', token);

    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await googleRes.json();

    if (!data.success) {
      console.warn('[reCAPTCHA] Invalid verification response:', data);
    }

    return !!data.success;
  } catch (err) {
    console.error('[reCAPTCHA] Error while verifying token:', err);
    return false;
  }
}

async function authMiddleware(req, res, next) {
  try {
    const userId = req.cookies.session;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    const conn = await pool.getConnection();
    let rows;
    try {
      const [data] = await conn.execute(
        `SELECT id, first_name, last_name, username, email, birth_date, phone_number, created_at
         FROM users
         WHERE id = ? LIMIT 1`,
        [userId]
      );
      rows = data;
    } finally {
      conn.release();
    }

    if (!rows.length) {
      res.clearCookie('session');
      return res.status(401).json({
        success: false,
        message: 'Invalid session.',
      });
    }

    req.user = rows[0]; 
    next();
  } catch (err) {
    console.error('authMiddleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
}

app.get('/api/me', authMiddleware, async (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

app.get('/api/recaptcha-site-key', (req, res) => {
  return res.json({
    siteKey: process.env.RECAPTCHA_SITE_KEY || '',
  });
});

app.post('/api/register', authLimiter, async (req, res) => {
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
        [finalUsername || null, email, phone || null]
      );

      if (dupRows.length) {
        return res.json({
          success: false,
          message: 'An account already exists with these details. If you already have an account, please log in.',
        });
      }

    } finally {
      conn.release();
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (firstName.length > 50 || lastName.length > 50 || (username && username.length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Name/username too long.',
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const passwordHash = await bcrypt.hash(password, 10);

    const expiresAt = Date.now() + 10 * 60 * 1000; 

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
      attempts: 0,
    });

    try {
      await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: email,
        subject: 'MoneyMind - Email Verification Code',
        html: `
          <h2>MoneyMind - Email Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing: 6px;">${code}</h1>
          <p>This code will expire in 10 minutes.</p>
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
      message: 'A verification code has been sent to your email.',
      email,
      expiresAt,
    });

  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: 'Server error. Please try again later.' });
  }
});

app.post('/api/register-verify',authLimiter, async (req, res) => {
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

    if (pending.attempts >= 5) {
      pendingUsers.delete(email);
      return res.json({
        success: false,
        message: 'Too many invalid attempts. Please register again.',
      });
    }

    if (pending.code !== code) {
      pending.attempts += 1;
      pendingUsers.set(email, pending);
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

app.post('/api/register-resend',authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.json({
        success: false,
        message: "Email is required.",
      });
    }

    const pending = pendingUsers.get(email);

    if (!pending) {
      return res.json({
        success: false,
        message: "No pending registration found. Please register again.",
      });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    pending.code = newCode;
    pending.expiresAt = Date.now() + 10* 60 * 1000;
    pendingUsers.set(email, pending);

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: email,
      subject: "MoneyMind - Verification Code (Resent)",
      html: `
        <h2>MoneyMind Registration Verification</h2>
        <p>Your new verification code is:</p>
        <h1 style="letter-spacing: 6px;">${newCode}</h1>
        <p>The code expires in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: "A new verification code has been sent to your email.",
      expiresAt: pending.expiresAt,
    });

  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Could not resend code. Please try again later.",
    });
  }
});

app.post('/api/login',authLimiter, async (req, res) => {
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
          'SELECT id, email, username, first_name, password, phone_number FROM users WHERE email = ? OR username = ? OR phone_number = ? LIMIT 1',
          [identifier, identifier, identifier]
        )
      )[0];
    } finally {
      conn.release();
    }

    if (!rows.length) {
      return res.json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const user = rows[0];

    const passMatch = await bcrypt.compare(password, user.password);
    if (!passMatch) {
      return res.json({
        success: false,
        message: "Invalid credentials.",
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
      attempts: 0,
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
      expiresAt,
    });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

app.post('/api/login-verify',authLimiter, async (req, res) => {
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

    if (pending.attempts >= 5) {
      pendingLoginUsers.delete(email);
      return res.json({
        success: false,
        message: "Too many invalid attempts. Please login again.",
      });
    }

    if (pending.code !== code) {
      pending.attempts += 1;
      pendingLoginUsers.set(email, pending);
      return res.json({
        success: false,
        message: "Invalid code. Please try again.",
      });
    }

    pendingLoginUsers.delete(email);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax', 
      secure: process.env.NODE_ENV === 'production',
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

app.post('/api/login-resend',authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.json({
        success: false,
        message: "Email is required.",
      });
    }

    const pending = pendingLoginUsers.get(email);
    if (!pending) {
      return res.json({
        success: false,
        message: "No pending login found. Please try logging in again.",
      });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    pending.code = newCode;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    pendingLoginUsers.set(email, pending);

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: email,
      subject: "MoneyMind - Login Verification Code (Resent)",
      html: `
        <h2>MoneyMind Login Verification</h2>
        <p>Your new login verification code is:</p>
        <h1 style="letter-spacing:6px">${newCode}</h1>
        <p>The code expires in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: "A new verification code has been sent to your email.",
      expiresAt: pending.expiresAt,
    });

  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: "Could not resend code. Please try again later.",
    });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return res.json({ success: true });
});

app.post("/api/forgot-password",passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.json({
        success: false,
        message: "Email is required.",
      });
    }

    const conn = await pool.getConnection();
    let rows;
    try {
      const [data] = await conn.execute(
        "SELECT id, email FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      rows = data;
    } finally {
      conn.release();
    }
    if (!rows.length) {
      return res.json({
        success: true,
        message: "If this email is associated with an account, a reset link has been sent.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000; 

    passwordResetRequests.set(email, { token, expiresAt });
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5500";
    const resetLink = `${frontendBase}/forgotpass/resetpass/rstpass.html?token=${token}&email=${encodeURIComponent(
      email
    )}`;

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: email,
      subject: "MoneyMind - Reset Your Password",
      html: `
        <h2>Reset Your Password</h2>
        <p>Click the link below to choose a new password:</p>
        <a href="${resetLink}" style="font-size:16px;">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: "If this email is associated with an account, a reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

app.post("/api/reset-password",passwordResetLimiter, async (req, res) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body || {};

    if (!email || !token || !newPassword || !confirmPassword) {
      return res.json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.json({
        success: false,
        message: "Passwords do not match.",
      });
    }
    
    if (newPassword.length < 8) {
      return res.json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (newPassword.length < 8) {
      return res.json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const data = passwordResetRequests.get(email);

    if (!data) {
      return res.json({
        success: false,
        message: "Invalid or expired reset request.",
      });
    }

    if (data.token !== token) {
      return res.json({
        success: false,
        message: "Invalid reset token.",
      });
    }

    if (Date.now() > data.expiresAt) {
      passwordResetRequests.delete(email);
      return res.json({
        success: false,
        message: "Reset link has expired.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        "UPDATE users SET password = ? WHERE email = ? LIMIT 1",
        [passwordHash, email]
      );
    } finally {
      conn.release();
    }

    passwordResetRequests.delete(email);

    return res.json({
      success: true,
      message: "Your password has been reset successfully.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

app.post('/api/verify-captcha', async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Missing captcha token.',
      });
    }

    const ok = await verifyCaptchaToken(token);

    if (!ok) {
      return res.status(400).json({
        success: false,
        message: 'Captcha invalid.',
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Captcha verify error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying captcha.',
    });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const category = (req.query.category || 'forex').toLowerCase();
    const apiKey = process.env.NEWS_API_KEY; 

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'News API is not configured on the server.',
      });
    }

    let query = 'forex OR "currency markets" OR "interest rates" OR fed';
    if (category === 'crypto') {
      query = 'crypto OR bitcoin OR ethereum OR "digital assets"';
    } else if (category === 'stocks') {
      query = '"stock market" OR equities OR "earnings" OR "S&P 500"';
    }

    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('sortBy', 'publishedAt');

    const apiRes = await fetch(url.toString(), {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!apiRes.ok) {
      console.error('News API error status:', apiRes.status);
      return res.status(502).json({
        success: false,
        message: 'Upstream news service error.',
      });
    }

    const raw = await apiRes.json();
    const rawArticles = raw.articles || [];

    const articles = rawArticles.slice(0, 10).map((item, idx) => ({
      id: item.url || `mm-${Date.now()}-${idx}`,
      title: String(item.title || '').slice(0, 200),
      summary: item.description
        ? String(item.description).slice(0, 400)
        : null,
      source: item.source && item.source.name ? item.source.name : null,
      publishedAt: item.publishedAt || null,
      url: item.url || null,
    }));

    return res.json({ success: true, articles });
  } catch (err) {
    console.error('News endpoint error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while loading news.',
    });
  }
});

app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const conn = await pool.getConnection();
    let rows;
    try {
      const [data] = await conn.execute(
        `SELECT
           id,
           account_name,
           account_type,
           currency,
           balance,
           initial_balance,
           is_default,
           created_at,
           updated_at
         FROM accounts
         WHERE user_id = ?
         ORDER BY created_at ASC`,
        [userId]
      );
      rows = data;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      accounts: rows,
    });
  } catch (err) {
    console.error('GET /api/accounts error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load accounts.',
    });
  }
});

app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      accountName,
      accountType = 'other',
      currency,
      initialBalance = 0,
      setAsDefault = false,
    } = req.body || {};

    if (!accountName || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Account name and currency are required.',
      });
    }

    const allowedCurrencies = ['USD', 'EUR', 'RON', 'GBP', 'CHF'];
    if (!allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported currency.',
      });
    }

    const allowedTypes = ['broker', 'bank', 'crypto', 'cash', 'other'];
    const safeAccountType = allowedTypes.includes(accountType) ? accountType : 'other';

    let balance = Number(initialBalance);
    if (Number.isNaN(balance) || balance < 0) {
      balance = 0;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (setAsDefault) {
        await conn.execute(
          'UPDATE accounts SET is_default = 0 WHERE user_id = ?',
          [userId]
        );
      }

      const [result] = await conn.execute(
        `INSERT INTO accounts (
           user_id,
           account_name,
           account_type,
           currency,
           balance,
           initial_balance,
           is_default
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          accountName,
          safeAccountType,
          currency,
          balance,     
          balance,       
          setAsDefault ? 1 : 0,
        ]
      );

      const [rows] = await conn.execute(
        `SELECT
           id,
           account_name,
           account_type,
           currency,
           balance,
           initial_balance,
           is_default,
           created_at,
           updated_at
         FROM accounts
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [result.insertId, userId]
      );

      await conn.commit();

      return res.status(201).json({
        success: true,
        account: rows[0],
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/accounts error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not create account.',
    });
  }
});

app.patch('/api/accounts/:id/default', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = Number(req.params.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account id.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1',
        [accountId, userId]
      );

      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Account not found.',
        });
      }

      await conn.execute(
        'UPDATE accounts SET is_default = 0 WHERE user_id = ?',
        [userId]
      );

      await conn.execute(
        'UPDATE accounts SET is_default = 1 WHERE id = ? AND user_id = ?',
        [accountId, userId]
      );

      const [updated] = await conn.execute(
        `SELECT id, account_name, account_type, currency, balance, is_default, created_at, updated_at
         FROM accounts
         WHERE user_id = ?
         ORDER BY created_at ASC`,
        [userId]
      );

      await conn.commit();

      return res.json({
        success: true,
        accounts: updated,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('PATCH /api/accounts/:id/default error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not set default account.',
    });
  }
});

function mapIntervalParam(tf) {
  switch (tf) {
    case '1m': return '1min';
    case '5m': return '5min';
    case '15m': return '15min';
    case '30m': return '30min';
    case '1h': return '1h';
    case '4h': return '4h';
    case '1D': return '1day';
    case '1W': return '1week';
    case '1M': return '1month';
    case '1Y': return '1month';
    default: return '1day';
  }
}

async function fetchLatestPriceFromApi(symbol) {
  if (!MARKET_API_KEY) {
    throw new Error('Market data API key missing.');
  }

  const url = new URL(`${MARKET_API_BASE}/price`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', MARKET_API_KEY);

  const apiRes = await fetch(url.toString());
  if (!apiRes.ok) {
    const text = await apiRes.text();
    console.error('fetchLatestPriceFromApi error status:', apiRes.status, text);
    throw new Error('Upstream price API error');
  }

  const raw = await apiRes.json();

  if (raw.status === 'error') {
    console.error('fetchLatestPriceFromApi upstream error:', raw);
    throw new Error(raw.message || 'Price API error');
  }

  const price = Number(raw.price);
  if (!Number.isFinite(price)) {
    console.error('fetchLatestPriceFromApi invalid price payload:', raw);
    throw new Error('Invalid price value');
  }

  return price;
}

app.get('/api/markets/ohlc', authMiddleware, async (req, res) => {
  try {
    const symbol = req.query.symbol;
    const timeframe = req.query.timeframe || '1D';

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Missing symbol.',
      });
    }

    if (!MARKET_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Market data API is not configured (MARKET_API_KEY missing).',
      });
    }

    const intervalParam = mapIntervalParam(timeframe);

    const pointsByTf = {
      '1m': 180,
      '5m': 200,
      '15m': 200,
      '30m': 200,
      '1h': 200,
      '4h': 200,
      '1D': 200,
      '1W': 200,
      '1M': 200,
      '1Y': 200,
    };
    const outputSize = pointsByTf[timeframe] || 200;

    const url = new URL(`${MARKET_API_BASE}/time_series`);
    url.searchParams.set('symbol', symbol);    
    url.searchParams.set('interval', intervalParam);
    url.searchParams.set('outputsize', String(outputSize));
    url.searchParams.set('apikey', MARKET_API_KEY);

    const apiRes = await fetch(url.toString());
    if (!apiRes.ok) {
      console.error('Market data upstream error:', apiRes.status);
      return res.status(502).json({
        success: false,
        message: 'Upstream market data error.',
      });
    }

    const raw = await apiRes.json();

    if (!raw || !raw.values) {
      console.error('Unexpected market data response:', raw);
      return res.status(502).json({
        success: false,
        message: 'Invalid market data response.',
      });
    }

    const candles = raw.values
      .slice()
      .reverse()
      .map((item) => ({
        time: item.datetime,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter((c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      );

    const lastPrice = candles.length ? candles[candles.length - 1].close : null;

    return res.json({
      success: true,
      symbol: raw.symbol || symbol,
      interval: raw.interval || intervalParam,
      candles,
      lastPrice,
      currency: raw.currency || null,
    });
  } catch (err) {
    console.error('GET /api/markets/ohlc error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while loading market data.',
    });
  }
});

app.patch('/api/accounts/:id/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = Number(req.params.id);
    let { balance } = req.body || {};

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account id.',
      });
    }

    balance = Number(balance);
    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid balance value.',
      });
    }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1',
        [accountId, userId]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: 'Account not found.',
        });
      }

      await conn.execute(
        'UPDATE accounts SET balance = ? WHERE id = ? AND user_id = ?',
        [balance, accountId, userId]
      );

      const [updatedRows] = await conn.execute(
        `SELECT
           id,
           account_name,
           account_type,
           currency,
           balance,
           initial_balance,
           is_default,
           created_at,
           updated_at
         FROM accounts
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [accountId, userId]
      );

      return res.json({
        success: true,
        account: updatedRows[0],
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('PATCH /api/accounts/:id/balance error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not update balance.',
    });
  }
});

app.get('/api/markets/search', authMiddleware, async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || '').trim();
    const typeFilter = (req.query.type || '').toLowerCase(); 

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        results: [],
      });
    }

    if (!MARKET_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Market data API is not configured (MARKET_API_KEY missing).',
      });
    }

    const url =
      `${MARKET_API_BASE}/symbol_search?symbol=` +
      encodeURIComponent(query) +
      `&apikey=${MARKET_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error('symbol_search upstream error:', response.status, text);
      return res.status(502).json({
        success: false,
        message: 'Upstream market search failed.',
      });
    }

    const raw = await response.json();
    const data = Array.isArray(raw.data) ? raw.data : [];

    const results = data
      .map((item) => {
        const rawSymbol = item.symbol || '';      
        const apiSymbol = rawSymbol;
        const compactSymbol = rawSymbol.replace(/[^A-Z0-9]/gi, ''); 

        const instrumentName = item.instrument_name || item.name || rawSymbol;

        let inferredType = (item.instrument_type || item.type || '').toLowerCase();
        let type = 'stocks';
        if (inferredType.includes('crypto')) type = 'crypto';
        else if (
          inferredType.includes('fx') ||
          inferredType.includes('forex') ||
          inferredType.includes('currency')
        ) {
          type = 'forex';
        } else if (rawSymbol.includes('/')) {
          type = 'forex';
        }

        const baseCurrency =
          item.currency ||
          (rawSymbol.includes('/') ? rawSymbol.split('/')[1] : null) ||
          'USD';

        return {
          symbol: compactSymbol || rawSymbol, 
          apiSymbol,                         
          name: instrumentName,
          type,                               
          currency: baseCurrency,
          exchange: item.exchange || null,
        };
      })
      .filter((inst) => {
        if (!typeFilter || typeFilter === 'all') return true;
        return inst.type === typeFilter;
      })
      .slice(0, 30);

    return res.json({
      success: true,
      results,
    });
  } catch (err) {
    console.error('GET /api/markets/search error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while searching markets.',
    });
  }
});

app.get('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const conn = await pool.getConnection();
    let rows;
    try {
      const [data] = await conn.execute(
        `SELECT
           id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           exchange,
           created_at
         FROM watchlists
         WHERE user_id = ?
         ORDER BY created_at ASC`,
        [userId]
      );
      rows = data;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      items: rows,
    });
  } catch (err) {
    console.error('GET /api/watchlist error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load watchlist.',
    });
  }
});

app.post('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      symbol,
      apiSymbol,
      name,
      type,
      currency = null,
      exchange = null,
    } = req.body || {};

    if (!symbol || !apiSymbol || !name) {
      return res.status(400).json({
        success: false,
        message: 'symbol, apiSymbol and name are required.',
      });
    }

    const allowedTypes = ['crypto', 'forex', 'stocks'];
    const safeType = allowedTypes.includes(type) ? type : 'stocks';

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `INSERT INTO watchlists (
           user_id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           exchange
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           api_symbol = VALUES(api_symbol),
           name = VALUES(name),
           instrument_type = VALUES(instrument_type),
           currency = VALUES(currency),
           exchange = VALUES(exchange)`,
        [userId, symbol, apiSymbol, name, safeType, currency, exchange]
      );

      const [rows] = await conn.execute(
        `SELECT
           id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           exchange,
           created_at
         FROM watchlists
         WHERE user_id = ? AND symbol = ?
         LIMIT 1`,
        [userId, symbol]
      );

      return res.status(201).json({
        success: true,
        item: rows[0],
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/watchlist error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not update watchlist.',
    });
  }
});

app.delete('/api/watchlist/:symbol', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const symbol = req.params.symbol;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Missing symbol.',
      });
    }

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        'DELETE FROM watchlists WHERE user_id = ? AND symbol = ?',
        [userId, symbol]
      );

      return res.json({
        success: true,
        removed: result.affectedRows > 0,
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('DELETE /api/watchlist/:symbol error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not remove from watchlist.',
    });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;

    const conn = await pool.getConnection();
    try {
      let rows;
      if (accountId) {
        const [data] = await conn.execute(
          `SELECT
             id,
             user_id,
             account_id,
             symbol,
             api_symbol,
             name,
             instrument_type,
             currency,
             side,
             quantity,
             entry_price,
             stop_loss,
             take_profit,
             status,
             opened_at,
             closed_at,
             close_price,
             profit_loss
           FROM orders
           WHERE user_id = ? AND account_id = ? AND status = 'open'
           ORDER BY opened_at DESC`,
          [userId, accountId]
        );
        rows = data;
      } else {
        const [data] = await conn.execute(
          `SELECT
             id,
             user_id,
             account_id,
             symbol,
             api_symbol,
             name,
             instrument_type,
             currency,
             side,
             quantity,
             entry_price,
             stop_loss,
             take_profit,
             status,
             opened_at,
             closed_at,
             close_price,
             profit_loss
           FROM orders
           WHERE user_id = ? AND status = 'open'
           ORDER BY opened_at DESC`,
          [userId]
        );
        rows = data;
      }

      return res.json({
        success: true,
        orders: rows,
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('GET /api/orders error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load orders.',
    });
  }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      accountId,
      symbol,
      apiSymbol,
      name,
      type,
      currency = null,
      side,
      quantity,
      entryPrice,
      stopLoss = null,
      takeProfit = null,
    } = req.body || {};

    if (!accountId || !symbol || !apiSymbol || !name || !side || !quantity || !entryPrice) {
      return res.status(400).json({
        success: false,
        message: 'accountId, symbol, apiSymbol, name, side, quantity, entryPrice are required.',
      });
    }

    const allowedSides = ['buy', 'sell'];
    const finalSide = allowedSides.includes(side) ? side : null;
    if (!finalSide) {
      return res.status(400).json({
        success: false,
        message: 'Invalid side. Must be "buy" or "sell".',
      });
    }

    const allowedTypes = ['crypto', 'forex', 'stocks'];
    const safeType = allowedTypes.includes(type) ? type : 'stocks';

    const qty = Number(quantity);
    const price = Number(entryPrice);

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity or entry price.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [accRows] = await conn.execute(
        `SELECT id, balance, currency
         FROM accounts
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [accountId, userId]
      );

      if (!accRows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Account not found.',
        });
      }

      const [result] = await conn.execute(
        `INSERT INTO orders (
           user_id,
           account_id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           side,
           quantity,
           entry_price,
           stop_loss,
           take_profit,
           status,
           opened_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW())`,
        [
          userId,
          accountId,
          symbol,
          apiSymbol,
          name,
          safeType,
          currency,
          finalSide,
          qty,
          price,
          stopLoss,
          takeProfit,
        ]
      );

      const [rows] = await conn.execute(
        `SELECT
           id,
           user_id,
           account_id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           side,
           quantity,
           entry_price,
           stop_loss,
           take_profit,
           status,
           opened_at,
           closed_at,
           close_price,
           profit_loss
         FROM orders
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [result.insertId, userId]
      );

      await conn.commit();

      return res.status(201).json({
        success: true,
        order: rows[0],
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/orders error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not create order.',
    });
  }
});

app.post('/api/orders/:id/close', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order id.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orderRows] = await conn.execute(
        `SELECT
           id,
           user_id,
           account_id,
           symbol,
           api_symbol,
           side,
           quantity,
           entry_price,
           status
         FROM orders
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [orderId, userId]
      );

      if (!orderRows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Order not found.',
        });
      }

      const order = orderRows[0];

      if (order.status !== 'open') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'Order is already closed.',
        });
      }

      const [accRows] = await conn.execute(
        `SELECT id, balance, currency
         FROM accounts
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [order.account_id, userId]
      );

      if (!accRows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Account not found for this order.',
        });
      }

      const account = accRows[0];

      const apiSymbol = order.api_symbol || order.symbol;
      let closePrice;
      try {
        closePrice = await fetchLatestPriceFromApi(apiSymbol);
      } catch (priceErr) {
        console.error('close order price error:', priceErr);
        await conn.rollback();
        return res.status(502).json({
          success: false,
          message: 'Could not fetch latest price to close the order.',
        });
      }

      const qty = Number(order.quantity);
      const entryPrice = Number(order.entry_price);
      let pnl;

      if (order.side === 'buy') {
        pnl = (closePrice - entryPrice) * qty;
      } else {
        pnl = (entryPrice - closePrice) * qty;
      }

      const newBalance = Number(account.balance) + pnl;

      await conn.execute(
        `UPDATE orders
         SET status = 'closed',
             closed_at = NOW(),
             close_price = ?,
             profit_loss = ?
         WHERE id = ? AND user_id = ?`,
        [closePrice, pnl, orderId, userId]
      );

      await conn.execute(
        `UPDATE accounts
         SET balance = ?
         WHERE id = ? AND user_id = ?`,
        [newBalance, account.id, userId]
      );

      const [updatedOrderRows] = await conn.execute(
        `SELECT
           id,
           user_id,
           account_id,
           symbol,
           api_symbol,
           name,
           instrument_type,
           currency,
           side,
           quantity,
           entry_price,
           stop_loss,
           take_profit,
           status,
           opened_at,
           closed_at,
           close_price,
           profit_loss
         FROM orders
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [orderId, userId]
      );

      const [updatedAccRows] = await conn.execute(
        `SELECT
           id,
           account_name,
           account_type,
           currency,
           balance,
           initial_balance,
           is_default,
           created_at,
           updated_at
         FROM accounts
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [account.id, userId]
      );

      await conn.commit();

      return res.json({
        success: true,
        order: updatedOrderRows[0],
        account: updatedAccRows[0],
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/orders/:id/close error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not close order.',
    });
  }
});

app.post('/api/admin-auth', authLimiter, async (req, res) => {
  try {
    const { username, password, remember } = req.body || {};

    if (!username || !password) {
      return res.json({ success: false, message: "Username and password are required!" });
    }

    console.log('Admin login attempt:', username, 'Password:', password); 

    const conn = await pool.getConnection();
    let adminUser;
    try {
      const [rows] = await conn.execute(
        'SELECT id, username, email, first_name, password FROM users WHERE username = ? LIMIT 1',
        [username]
      );
      adminUser = rows[0];
    } finally {
      conn.release();
    }

    console.log('Admin user found:', adminUser); 

    if (!adminUser) {
      return res.json({
        success: false,
        message: "Invalid admin credentials.",
      });
    }

    if (password !== adminUser.password) {
      console.log('Password mismatch. Expected:', adminUser.password, 'Got:', password); 
      return res.json({
        success: false,
        message: "Invalid admin credentials.",
      });
    }

    console.log('Admin login SUCCESS!'); 
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };

    if (remember) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; 
    }

    res.cookie("session", adminUser.id, cookieOptions);

    return res.json({
      success: true,
      message: "Admin authentication successful!",
      username: adminUser.username,
      first_name: adminUser.first_name,
      email: adminUser.email
    });

  } catch (err) {
    console.error('Admin auth error:', err);
    return res.json({
      success: false,
      message: "Server error during admin authentication.",
    });
  }
});

app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const statusFilter = req.query.status || 'all';
    const typeFilter = req.query.type || 'all';

    const conn = await pool.getConnection();
    let rows;
    try {
      let query = `
        SELECT t.*, 
               COUNT(tm.id) as message_count,
               MAX(tm.created_at) as last_message_date
        FROM tickets t
        LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id
        WHERE t.user_id = ?
      `;
      
      const params = [userId];
      
      if (statusFilter !== 'all') {
        query += ' AND t.status = ?';
        params.push(statusFilter);
      }
      
      if (typeFilter !== 'all') {
        query += ' AND t.type = ?';
        params.push(typeFilter);
      }
      
      query += ' GROUP BY t.id ORDER BY t.updated_at DESC';
      
      const [data] = await conn.execute(query, params);
      rows = data;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      tickets: rows,
    });
  } catch (err) {
    console.error('GET /api/tickets error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load tickets.',
    });
  }
});

app.post('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, type, description } = req.body || {};

    if (!title || !type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title, type and description are required.',
      });
    }

    const allowedTypes = ['technical', 'platform_bug', 'account_issue', 'feature_request', 'other'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type.',
      });
    }

    const priority = type === 'platform_bug' ? 'high' : 'medium';

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [ticketResult] = await conn.execute(
        'INSERT INTO tickets (user_id, title, type, description, priority) VALUES (?, ?, ?, ?, ?)',
        [userId, title, type, description, priority]
      );
      
      const ticketId = ticketResult.insertId;

      await conn.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
        [ticketId, userId, description, false]
      );
      const [ticketRows] = await conn.execute(
        `SELECT t.*, 
                u.first_name, 
                u.last_name 
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [ticketId]
      );

      await conn.commit();

      return res.status(201).json({
        success: true,
        ticket: ticketRows[0],
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/tickets error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not create ticket.',
    });
  }
});

app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    const conn = await pool.getConnection();
    let ticket, messages;
    try {
      const [ticketRows] = await conn.execute(
        `SELECT t.*, 
                u.first_name, 
                u.last_name 
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ? AND t.user_id = ?`,
        [ticketId, userId]
      );

      if (!ticketRows.length) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      ticket = ticketRows[0];

      const [messageRows] = await conn.execute(
        `SELECT tm.*, 
                u.first_name, 
                u.last_name 
         FROM ticket_messages tm
         LEFT JOIN users u ON tm.user_id = u.id
         WHERE tm.ticket_id = ?
         ORDER BY tm.created_at ASC`,
        [ticketId]
      );

      messages = messageRows;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      ticket: ticket,
      messages: messages,
    });
  } catch (err) {
    console.error('GET /api/tickets/:id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load ticket details.',
    });
  }
});

app.post('/api/tickets/:id/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = Number(req.params.id);
    const { message } = req.body || {};

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [ticketRows] = await conn.execute(
        'SELECT id, status FROM tickets WHERE id = ? AND user_id = ?',
        [ticketId, userId]
      );

      if (!ticketRows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      const ticket = ticketRows[0];
      
      if (ticket.status === 'closed') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot add message to closed ticket.',
        });
      }

      await conn.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
        [ticketId, userId, message.trim(), false]
      );

      await conn.execute(
        'UPDATE tickets SET updated_at = NOW() WHERE id = ?',
        [ticketId]
      );

      await conn.commit();

      return res.json({
        success: true,
        message: 'Message added successfully.',
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/tickets/:id/messages error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not add message.',
    });
  }
});

async function adminMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.username.toLowerCase().includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required.',
      });
    }
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
}

app.get('/api/admin/tickets', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const statusFilter = req.query.status || 'all';
    const typeFilter = req.query.type || 'all';
    const priorityFilter = req.query.priority || 'all';

    const conn = await pool.getConnection();
    let rows;
    try {
      let query = `
        SELECT t.*, 
               u.first_name, 
               u.last_name,
               u.username,
               u.email,
               COUNT(tm.id) as message_count,
               SUM(CASE WHEN tm.is_admin = 0 AND tm.created_at > t.updated_at THEN 1 ELSE 0 END) as unread_count
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (statusFilter !== 'all') {
        query += ' AND t.status = ?';
        params.push(statusFilter);
      }
      
      if (typeFilter !== 'all') {
        query += ' AND t.type = ?';
        params.push(typeFilter);
      }
      
      if (priorityFilter !== 'all') {
        query += ' AND t.priority = ?';
        params.push(priorityFilter);
      }
      
      query += ` GROUP BY t.id 
                ORDER BY 
                  CASE WHEN t.priority = 'urgent' THEN 0 
                       WHEN t.priority = 'high' THEN 1
                       WHEN t.priority = 'medium' THEN 2
                       ELSE 3 END,
                  t.updated_at DESC`;
      
      const [data] = await conn.execute(query, params);
      rows = data;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      tickets: rows,
    });
  } catch (err) {
    console.error('GET /api/admin/tickets error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load tickets.',
    });
  }
});

app.get('/api/admin/tickets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    const conn = await pool.getConnection();
    let ticket, messages;
    try {
      const [ticketRows] = await conn.execute(
        `SELECT t.*, 
                u.first_name, 
                u.last_name,
                u.username,
                u.email
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [ticketId]
      );

      if (!ticketRows.length) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      ticket = ticketRows[0];

      const [messageRows] = await conn.execute(
        `SELECT tm.*, 
                u.first_name, 
                u.last_name 
         FROM ticket_messages tm
         LEFT JOIN users u ON tm.user_id = u.id
         WHERE tm.ticket_id = ?
         ORDER BY tm.created_at ASC`,
        [ticketId]
      );

      messages = messageRows;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      ticket: ticket,
      messages: messages,
    });
  } catch (err) {
    console.error('GET /api/admin/tickets/:id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load ticket details.',
    });
  }
});

app.put('/api/admin/tickets/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    const allowedStatuses = ['open', 'in_progress', 'closed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.',
      });
    }

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, ticketId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      return res.json({
        success: true,
        message: 'Ticket status updated successfully.',
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('PUT /api/admin/tickets/:id/status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not update ticket status.',
    });
  }
});

app.put('/api/admin/tickets/:id/priority', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { priority } = req.body || {};

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority.',
      });
    }

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        'UPDATE tickets SET priority = ?, updated_at = NOW() WHERE id = ?',
        [priority, ticketId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      return res.json({
        success: true,
        message: 'Ticket priority updated successfully.',
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('PUT /api/admin/tickets/:id/priority error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not update ticket priority.',
    });
  }
});

app.post('/api/admin/tickets/:id/messages', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const adminId = req.user.id;
    const ticketId = Number(req.params.id);
    const { message } = req.body || {};

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.',
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [ticketRows] = await conn.execute(
        'SELECT id, status FROM tickets WHERE id = ?',
        [ticketId]
      );

      if (!ticketRows.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: 'Ticket not found.',
        });
      }

      const ticket = ticketRows[0];

      await conn.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
        [ticketId, adminId, message.trim(), true]
      );

      const newStatus = ticket.status === 'open' ? 'in_progress' : ticket.status;
      await conn.execute(
        'UPDATE tickets SET updated_at = NOW(), status = ? WHERE id = ?',
        [newStatus, ticketId]
      );

      await conn.commit();

      return res.json({
        success: true,
        message: 'Response added successfully.',
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('POST /api/admin/tickets/:id/messages error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not add response.',
    });
  }
});

app.delete('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = Number(req.params.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account id.',
      });
    }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id FROM accounts WHERE id = ? AND user_id = ? LIMIT 1',
        [accountId, userId]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: 'Account not found.',
        });
      }

      await conn.execute(
        'DELETE FROM accounts WHERE id = ? AND user_id = ?',
        [accountId, userId]
      );

      return res.json({
        success: true,
        message: 'Account deleted successfully.',
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('DELETE /api/accounts/:id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Could not delete account.',
    });
  }
});

app.get('/api/admin/tickets/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const conn = await pool.getConnection();
        let stats;
        try {
            const [ticketCounts] = await conn.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                    SUM(CASE WHEN priority = 'urgent' AND status != 'closed' THEN 1 ELSE 0 END) as urgent
                FROM tickets
            `);

            const [responseStats] = await conn.execute(`
                SELECT 
                    COUNT(DISTINCT t.id) as total_tickets,
                    COUNT(DISTINCT CASE WHEN tm.id IS NOT NULL AND tm.is_admin = 1 THEN t.id END) as responded_tickets
                FROM tickets t
                LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id AND tm.is_admin = 1
            `);

            stats = {
                total: ticketCounts[0].total,
                open: ticketCounts[0].open,
                in_progress: ticketCounts[0].in_progress,
                closed: ticketCounts[0].closed,
                urgent: ticketCounts[0].urgent,
                response_rate: ticketCounts[0].total > 0 ? 
                    Math.round((responseStats[0].responded_tickets / ticketCounts[0].total) * 100) : 0
            };
        } finally {
            conn.release();
        }

        return res.json({
            success: true,
            stats
        });
    } catch (err) {
        console.error('GET /api/admin/tickets/stats error:', err);
        return res.status(500).json({
            success: false,
            message: 'Could not load ticket statistics.',
        });
    }
});

app.post('/api/admin/tickets/:id/read', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const ticketId = Number(req.params.id);
        
        return res.json({
            success: true,
            message: 'Ticket marked as read.'
        });
    } catch (err) {
        console.error('POST /api/admin/tickets/:id/read error:', err);
        return res.status(500).json({
            success: false,
            message: 'Could not mark ticket as read.',
        });
    }
});

app.post('/api/admin/tickets', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id;
        const { title, type, priority, description } = req.body || {};

        if (!title || !type || !description) {
            return res.status(400).json({
                success: false,
                message: 'Title, type and description are required.',
            });
        }

        const allowedTypes = ['technical', 'platform_bug', 'account_issue', 'feature_request', 'other'];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ticket type.',
            });
        }

        const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!allowedPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid priority.',
            });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [ticketResult] = await conn.execute(
                'INSERT INTO tickets (user_id, title, type, description, priority) VALUES (?, ?, ?, ?, ?)',
                [adminId, title, type, description, priority]
            );
            
            const ticketId = ticketResult.insertId;

            await conn.execute(
                'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
                [ticketId, adminId, description, true]
            );
            const [ticketRows] = await conn.execute(
                `SELECT t.*, 
                        u.first_name, 
                        u.last_name 
                 FROM tickets t
                 LEFT JOIN users u ON t.user_id = u.id
                 WHERE t.id = ?`,
                [ticketId]
            );

            await conn.commit();

            return res.status(201).json({
                success: true,
                ticket: ticketRows[0],
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('POST /api/admin/tickets error:', err);
        return res.status(500).json({
            success: false,
            message: 'Could not create ticket.',
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));