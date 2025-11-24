const MM_CAPTCHA_KEY = "mm_captcha_verified";
const MM_CAPTCHA_TIME = "mm_captcha_time";
const MM_CAPTCHA_VERIFY_URL = "http://localhost:3001/api/verify-captcha";
let MM_RECAPTCHA_SITE_KEY = null;

async function loadSiteKey() {
    if (MM_RECAPTCHA_SITE_KEY) return;

    try {
        const res = await fetch("http://localhost:3001/api/recaptcha-site-key");
        const data = await res.json();
        MM_RECAPTCHA_SITE_KEY = data.siteKey;
    } catch (e) {
        console.error("Could not load reCAPTCHA site key:", e);
    }
}

function isVerified() {
    const ok = localStorage.getItem(MM_CAPTCHA_KEY) === "true";
    const last = Number(localStorage.getItem(MM_CAPTCHA_TIME) || 0);
    const now = Date.now();

    if (!ok) return false;
    if (now - last > 3600000) return false;

    return true;
}

function redirectToCaptcha() {
    const current = encodeURIComponent(window.location.href);
    window.location.href = `/captcha/captcha.html?redirect=${current}`;
}

async function ensureCaptcha() {
    await loadSiteKey();

    if (!isVerified()) {
        redirectToCaptcha();
    }
}

async function captchaSolved(token) {
    try {
        const res = await fetch(MM_CAPTCHA_VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem(MM_CAPTCHA_KEY, "true");
            localStorage.setItem(MM_CAPTCHA_TIME, Date.now().toString());

            const params = new URLSearchParams(window.location.search);
            const redirectURL = params.get("redirect") || "/";
            window.location.href = redirectURL;

        } else {
            document.getElementById("captchaError").innerText =
                "Verification failed. Contact support: support@moneymind.com";
        }
    } catch (e) {
        document.getElementById("captchaError").innerText =
            "Server error. Try again.";
    }
}

window.captchaSolved = captchaSolved;
let clickHistory = [];

function enableButtonSpamProtection() {
    const allButtons = document.querySelectorAll("button");

    allButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const now = Date.now();

            clickHistory.push(now);
            clickHistory = clickHistory.filter(t => now - t < 10000);

            if (clickHistory.length >= 5) {
                localStorage.removeItem(MM_CAPTCHA_KEY);
                redirectToCaptcha();
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", enableButtonSpamProtection);
