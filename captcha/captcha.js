const MM_CAPTCHA_KEY = 'mm_captcha_verified';
const MM_CAPTCHA_VERIFY_URL = 'http://localhost:3001/api/verify-captcha';

const MM_RECAPTCHA_SITE_KEY = 'SITE_KEY_DE_LA_GOOGLE';

(function () {
  let afterCaptchaCallback = null;
  let widgetId = null;

  function isVerified() {
    return localStorage.getItem(MM_CAPTCHA_KEY) === 'true';
  }

  function showCaptchaErrorMessage() {
    const msg = 'Întâmpini probleme la introducere, contactează-ne.';
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
        <p>Te rugăm să confirmi că nu ești robot.</p>
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

    if (window.grecaptcha && document.getElementById('mm-captcha-widget')) {
      widgetId = grecaptcha.render('mm-captcha-widget', {
        sitekey: MM_RECAPTCHA_SITE_KEY,
        callback: mmOnCaptchaSuccess,
      });
    } else {
      setTimeout(renderWhenReady, 500);
    }
  }