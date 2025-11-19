const MM_CAPTCHA_KEY = "mm_captcha_verified";
const MM_CAPTCHA_VERIFY_URL = "http://localhost:3001/api/verify-captcha";
let MM_RECAPTCHA_SITE_KEY = null;

async function loadSiteKey() {
  if (MM_RECAPTCHA_SITE_KEY) return;

  try {
    const res = await fetch("http://localhost:3001/api/recaptcha-site-key");
    const data = await res.json();
    MM_RECAPTCHA_SITE_KEY = data.siteKey;
  } catch (e) {
    console.error("Error loading reCAPTCHA site key:", e);
  }
}

function isVerified() {
  return localStorage.getItem(MM_CAPTCHA_KEY) === "true";
}

function redirectToCaptcha() {
  const current = encodeURIComponent(window.location.href);
  window.location.href = `/captcha/captcha.html?redirect=${current}`;
}

async function ensureCaptcha() {
  await loadSiteKey();
  if (!isVerified()) redirectToCaptcha();
}

async function captchaSolved(token) {
  try {
    const res = await fetch(MM_CAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem(MM_CAPTCHA_KEY, "true");

      const params = new URLSearchParams(window.location.search);
      const redirectURL = params.get("redirect") || "/";

      window.location.href = redirectURL;
    } else {
      document.getElementById("captchaError").innerText =
        "Verification failed. If you experience issues, contact support: support@moneymind.com";
    }
  } catch (e) {
    document.getElementById("captchaError").innerText =
      "Server error. Please try again.";
  }
}

window.captchaSolved = captchaSolved;
