const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const timerBox = document.getElementById("timerBox");
const errorBox = document.getElementById("errorBox");
const loader = document.getElementById("loader");
const emailInfo = document.getElementById("emailInfo");
const otpInputs = document.querySelectorAll(".otp-input");

const email = localStorage.getItem("pendingLoginEmail");
const remember = localStorage.getItem("loginRemember") === "1";

let resendAttempts = Number(localStorage.getItem("resendAttempts") || "0");
let expirationTime = Number(localStorage.getItem("loginCodeExpiresAt") || "0");

let expirationIntervalId = null;
let resendIntervalId = null;
let isVerifying = false;

if (email) {
  emailInfo.textContent = `Code sent to: ${email}`;
} else {
  emailInfo.textContent = "No email found. Please go back and login again.";
  verifyBtn.disabled = true;
  resendBtn.disabled = true;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function updateExpirationText() {
  if (!expirationTime) {
    timerBox.textContent = "";
    return;
  }

  const remaining = expirationTime - Date.now();

  if (remaining <= 0) {
    timerBox.textContent = "Code expired. You can request a new one.";
    verifyBtn.disabled = true;
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  timerBox.textContent =
    `Code expires in: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startExpirationTimer() {
  if (!expirationTime || !email) return;
  if (expirationIntervalId) clearInterval(expirationIntervalId);

  updateExpirationText();
  expirationIntervalId = setInterval(updateExpirationText, 1000);
}

function getCooldownTime() {
  if (resendAttempts === 0) return 30;   
  if (resendAttempts === 1) return 120; 
  return 300;                          
}

function updateResendButton() {
  const availableAt = Number(localStorage.getItem("resendAvailableAt") || "0");
  if (!availableAt) {
    resendBtn.disabled = !email;
    resendBtn.textContent = "Resend code";
    return;
  }

  const diff = availableAt - Date.now();
  if (diff <= 0) {
    resendBtn.disabled = !email;
    resendBtn.textContent = "Resend code";
    if (resendIntervalId) {
      clearInterval(resendIntervalId);
      resendIntervalId = null;
    }
  } else {
    const seconds = Math.ceil(diff / 1000);
    resendBtn.disabled = true;
    resendBtn.textContent = `Resend again in ${seconds}s`;
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

if (expirationTime && email) {
  startExpirationTimer();
}
updateResendButton();
const existingAvailableAt = Number(localStorage.getItem("resendAvailableAt") || "0");
if (existingAvailableAt && existingAvailableAt > Date.now()) {
  resendIntervalId = setInterval(updateResendButton, 1000);
}

resendBtn.addEventListener("click", async () => {
  if (!email) return;

  errorBox.style.display = "none";

  const availableAt = Number(localStorage.getItem("resendAvailableAt") || "0");
  if (availableAt && availableAt > Date.now()) {
    return;
  }

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
    } else {
      expirationTime = Date.now() + 10 * 60 * 1000;
    }
    localStorage.setItem("loginCodeExpiresAt", String(expirationTime));
    startExpirationTimer();

    resendAttempts += 1;
    localStorage.setItem("resendAttempts", String(resendAttempts));
    startResendCooldown();
  } catch (e) {
    console.error(e);
    showError("Could not resend code.");
  }
});

async function submitCode(code, { auto = false } = {}) {
  if (code.length !== 6) {
    if (!auto) {
      showError("Enter a valid 6-digit code!");
    }
    return;
  }

  if (!email) return;
  if (isVerifying) return;

  isVerifying = true;
  errorBox.style.display = "none";
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
      otpInputs.forEach((i) => (i.value = ""));
      if (otpInputs.length) {
        otpInputs[0].focus();
      }
      showError(result.message);
      return;
    }

    const displayName = result.username || result.first_name;
    if (displayName) {
      localStorage.setItem("user", displayName);
    }

    localStorage.removeItem("pendingLoginEmail");
    localStorage.removeItem("loginRemember");
    localStorage.removeItem("resendAttempts");
    localStorage.removeItem("resendAvailableAt");
    localStorage.removeItem("loginCodeExpiresAt");

    window.location.href = "../../index.html";
  } catch (err) {
    console.error(err);
    showError("Server error.");
  } finally {
    loader.style.display = "none";
    verifyBtn.disabled = false;
    isVerifying = false;
  }
}

verifyBtn.addEventListener("click", () => {
  if (!email) return;

  let code = "";
  otpInputs.forEach((i) => (code += i.value));
  submitCode(code, { auto: false });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    verifyBtn.click();
  }
});

otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");

    if (input.value.length === 1 && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }

    let code = "";
    otpInputs.forEach((i) => (code += i.value));

    if (code.length === 6) {
      submitCode(code, { auto: true });
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });
});
