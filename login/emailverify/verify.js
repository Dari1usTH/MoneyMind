const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const timerBox = document.getElementById("timerBox");
const errorBox = document.getElementById("errorBox");
const loader = document.getElementById("loader");
const emailInfo = document.getElementById("emailInfo");

const email = localStorage.getItem("pendingLoginEmail");
const remember = localStorage.getItem("loginRemember") === "1";

let resendAttempts = Number(localStorage.getItem("resendAttempts") || "0");
let expirationTime = Number(localStorage.getItem("loginCodeExpiresAt") || "0");

let expirationIntervalId = null;
let resendIntervalId = null;

// --------- INIT EMAIL INFO ----------
if (email) {
  emailInfo.textContent = `Code sent to: ${email}`;
} else {
  emailInfo.textContent = "No email found. Please go back and login again.";
  verifyBtn.disabled = true;
  resendBtn.disabled = true;
}

// --------- HELPER EROARE ----------
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

// --------- EXPIRATION TIMER (SINCRON CU BACKEND) ----------
function updateExpirationText() {
  if (!expirationTime) {
    timerBox.textContent = "";
    return;
  }

  const remaining = expirationTime - Date.now();

  if (remaining <= 0) {
    timerBox.textContent = "Code expired. You can request a new one.";
    verifyBtn.disabled = true;
    // resend rămâne controlat de cooldown
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  timerBox.textContent =
    `Code expires in: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startExpirationTimer() {
  if (!expirationTime) return;
  if (expirationIntervalId) clearInterval(expirationIntervalId);

  updateExpirationText();
  expirationIntervalId = setInterval(updateExpirationText, 1000);
}

// --------- RESEND COOLDOWN ----------
function getCooldownTime() {
  if (resendAttempts === 0) return 30;    // după prima apăsare → 30s
  if (resendAttempts === 1) return 120;   // a doua → 2 min
  if (resendAttempts === 2) return 300;   // a treia → 5 min
  return 300;                             // după → 5 min
}

function updateResendButton() {
  const availableAt = Number(localStorage.getItem("resendAvailableAt") || "0");
  if (!availableAt) {
    resendBtn.disabled = false;
    resendBtn.textContent = "Resend code";
    return;
  }

  const diff = availableAt - Date.now();
  if (diff <= 0) {
    resendBtn.disabled = false;
    resendBtn.textContent = "Resend code";
    if (resendIntervalId) {
      clearInterval(resendIntervalId);
      resendIntervalId = null;
    }
  } else {
    const seconds = Math.ceil(diff / 1000);
    resendBtn.disabled = true;
    resendBtn.textContent = `Resend in ${seconds}s`;
  }
}

function startResendCooldown() {
  const cooldownSeconds = getCooldownTime();
  const availableAt = Date.now() + cooldownSeconds * 1000;

  localStorage.setItem("resendAvailableAt", String(availableAt));
  updateResendButton();

  if (resendIntervalId) clearInterval(resendIntervalId);
  resendIntervalId = setInterval(updateResendButton, 1000);
}

// init la încărcare pagină
if (expirationTime && email) {
  startExpirationTimer();
}
updateResendButton();
const existingAvailableAt = Number(localStorage.getItem("resendAvailableAt") || "0");
if (existingAvailableAt && existingAvailableAt > Date.now()) {
  resendIntervalId = setInterval(updateResendButton, 1000);
}

// --------- RESEND CLICK ----------
resendBtn.addEventListener("click", async () => {
  if (!email) return;

  errorBox.style.display = "none";

  resendAttempts++;
  localStorage.setItem("resendAttempts", String(resendAttempts));
  startResendCooldown();

  try {
    const res = await fetch("http://localhost:3001/api/login-resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!data.success) {
      showError(data.message || "Could not resend code.");
      return;
    }

    if (data.expiresAt) {
      expirationTime = Number(data.expiresAt);
      localStorage.setItem("loginCodeExpiresAt", String(expirationTime));
      startExpirationTimer();
    }
  } catch (e) {
    console.error(e);
    showError("Could not resend code.");
  }
});

// --------- VERIFY CLICK ----------
verifyBtn.addEventListener("click", async () => {
  errorBox.style.display = "none";

  const code = document.getElementById("code").value.trim();
  if (code.length !== 6) {
    return showError("Enter a valid 6-digit code!");
  }

  loader.style.display = "block";
  verifyBtn.disabled = true;

  try {
    const res = await fetch("http://localhost:3001/api/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, remember }),
      credentials: "include",
    });

    const result = await res.json();

    if (!result.success) {
      loader.style.display = "none";
      verifyBtn.disabled = false;
      return showError(result.message);
    }

    const displayName = result.username || result.first_name;
    localStorage.setItem("user", displayName);

    localStorage.removeItem("pendingLoginEmail");
    localStorage.removeItem("loginRemember");
    localStorage.removeItem("resendAttempts");
    localStorage.removeItem("resendAvailableAt");
    localStorage.removeItem("loginCodeExpiresAt");

    window.location.href = "../../index.html";

  } catch (err) {
    console.error(err);
    showError("Server error.");
    loader.style.display = "none";
    verifyBtn.disabled = false;
  }
});

// ENTER = submit
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    verifyBtn.click();
  }
});
