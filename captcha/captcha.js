const MM_CAPTCHA_KEY = 'mm_captcha_verified';
const MM_CAPTCHA_VERIFY_URL = 'http://localhost:3001/api/verify-captcha';
let MM_RECAPTCHA_SITE_KEY = null;

async function loadSiteKey() {
  if (MM_RECAPTCHA_SITE_KEY) return;

  try {
    const res = await fetch('http://localhost:3001/api/recaptcha-site-key');
    const data = await res.json();
    MM_RECAPTCHA_SITE_KEY = data.siteKey;
    if (!MM_RECAPTCHA_SITE_KEY) {
      console.error('Missing reCAPTCHA site key in response!');
    }
  } catch (e) {
    console.error('Could not load reCAPTCHA site key', e);
  }
}

(function () {
  let afterCaptchaCallback = null;
  let widgetId = null;

  function isVerified() {
    return localStorage.getItem(MM_CAPTCHA_KEY) === 'true';
  }

  function showCaptchaErrorMessage() {
    const msg = 'You are experiencing difficulties entering the captcha, please contact us.';
    alert(msg);
    const box = document.getElementById('errorBox');
    if (box) {
      box.textContent = msg;
      box.style.display = 'block';
    }
  }

  function createModal() {
    if (document.getElementById('mm-captcha-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'mm-captcha-modal';
    modal.className = 'mm-captcha-modal hidden';
    modal.innerHTML = `
      <div class="mm-captcha-overlay"></div>
      <div class="mm-captcha-card">
        <p>Please confirm that you are not a robot.</p>
        <div id="mm-captcha-widget"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showModal() {
    createModal();
    const modal = document.getElementById('mm-captcha-modal');
    modal.classList.remove('hidden');
    renderWhenReady();
  }

  function hideModal() {
    const modal = document.getElementById('mm-captcha-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderWhenReady() {
    if (widgetId !== null) return;

    if (!MM_RECAPTCHA_SITE_KEY) {
      setTimeout(renderWhenReady, 200);
      return;
    }

    if (window.grecaptcha && document.getElementById('mm-captcha-widget')) {
      widgetId = grecaptcha.render('mm-captcha-widget', {
        sitekey: MM_RECAPTCHA_SITE_KEY,
        callback: mmOnCaptchaSuccess,
      });
    } else {
      setTimeout(renderWhenReady, 500);
    }
  }

  window.mmOnCaptchaSuccess = async function (token) {
    try {
      const res = await fetch(MM_CAPTCHA_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(MM_CAPTCHA_KEY, 'true');
        hideModal();

        const cb = afterCaptchaCallback;
        afterCaptchaCallback = null;
        if (typeof cb === 'function') cb();
      } else {
        showCaptchaErrorMessage();
        if (widgetId !== null && window.grecaptcha) {
          grecaptcha.reset(widgetId);
        }
      }
    } catch (e) {
      console.error(e);
      showCaptchaErrorMessage();
      if (widgetId !== null && window.grecaptcha) {
        grecaptcha.reset(widgetId);
      }
    }
  };

  window.mmEnsureCaptchaBeforeAction = function (callback) {
    if (isVerified()) {
      callback();
    } else {
      afterCaptchaCallback = callback;
      showModal();
    }
  };

  function ensureRecaptchaScript() {
    if (document.querySelector('script[src*="https://www.google.com/recaptcha/api.js"]')) {
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?onload=mmRecaptchaLoaded&render=explicit';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  window.mmRecaptchaLoaded = function () {
    renderWhenReady();
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await loadSiteKey();

    if (!isVerified()) {
      showModal();
    }

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener(
        'click',
        function (e) {
          if (!isVerified()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            mmEnsureCaptchaBeforeAction(() => {
              loginBtn.click();
            });
          }
        },
        true
      );
    }

    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener(
        'click',
        function (e) {
          if (!isVerified()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            mmEnsureCaptchaBeforeAction(() => {
              registerBtn.click();
            });
          }
        },
        true
      );
    }

    ensureRecaptchaScript();
  });
})();