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

    // accept all port
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
  if (process.env.NODE_ENV === 'production' && !process.env.RECAPTCHA_SECRET) {
    console.warn('WARNING: RECAPTCHA_SECRET is not set in production!');
  }
  if (!token) return false;

  const params = new URLSearchParams();
  params.append('secret', process.env.RECAPTCHA_SECRET);
  params.append('response', token);

  const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await googleRes.json();
  return !!data.success;
}

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
      captchaToken,
    } = req.body || {};

    const captchaOk = await verifyCaptchaToken(captchaToken);
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification failed.',
      });
    }

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
    const { identifier, password, captchaToken } = req.body || {};

    if (!identifier || !password) {
      return res.json({ success: false, message: "Please fill in all fields!" });
    }

    const captchaOk = await verifyCaptchaToken(captchaToken);
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification failed.',
      });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
