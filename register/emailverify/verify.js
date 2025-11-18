const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const timerBox = document.getElementById("timerBox");
const errorBox = document.getElementById("errorBox");
const loader = document.getElementById("loader");
const emailInfo = document.getElementById("emailInfo");
const otpInputs = document.querySelectorAll(".otp-input");

let email = localStorage.getItem("pendingEmail");
let expirationTime = Number(localStorage.getItem("registerCodeExpiresAt") || "0");
let resendAttempts = Number(localStorage.getItem("registerResendAttempts") || "0");

let expirationIntervalId = null;
let resendIntervalId = null;

if (!email) {
  emailInfo.textContent = "No email found. Please go back and register again.";
  verifyBtn.disabled = true;
  resendBtn.disabled = true;
} else {
  emailInfo.textContent = `Code sent to: ${email}`;
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
  errorBox.classList.add("error");
}

function updateExpirationText() {
  const remain = expirationTime - Date.now();

  if (remain <= 0) {
    timerBox.textContent = "Code expired.";
    verifyBtn.disabled = true;
    return;
  }
  
  const m = Math.floor(remain / 60000);
  const s = Math.floor((remain % 60000) / 1000);

  timerBox.textContent = `Code expires in: ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startExpirationTimer() {
  if (expirationIntervalId) clearInterval(expirationIntervalId);
  updateExpirationText();
  expirationIntervalId = setInterval(updateExpirationText, 1000);
}

if (expirationTime) startExpirationTimer();

function getCooldownTime() {
  if (resendAttempts === 0) return 30;
  if (resendAttempts === 1) return 120;
  if (resendAttempts === 2) return 300;
  return 300;
}

function updateResendButton() {
  const availableAt = Number(localStorage.getItem("registerResendAvailableAt") || "0");
  const diff = availableAt - Date.now();

  if (diff <= 0) {
    resendBtn.disabled = false;
    resendBtn.textContent = "Resend code";
    return;
  }

  resendBtn.disabled = true;
  resendBtn.textContent = `Resend again in ${Math.ceil(diff / 1000)}s`;
}

function startResendCooldown() {
  const cooldown = getCooldownTime();
  const available = Date.now() + cooldown * 1000;

  localStorage.setItem("registerResendAvailableAt", available);

  updateResendButton();
  if (resendIntervalId) clearInterval(resendIntervalId);
  resendIntervalId = setInterval(updateResendButton, 1000);
}

const existingCooldown = Number(localStorage.getItem("registerResendAvailableAt") || "0");
if (existingCooldown > Date.now()) {
  resendIntervalId = setInterval(updateResendButton, 1000);
} else {
  resendBtn.disabled = false;
}

resendBtn.addEventListener("click", async () => {
  errorBox.style.display = "none";

  resendAttempts++;
  localStorage.setItem("registerResendAttempts", resendAttempts);

  startResendCooldown();

  const res = await fetch("http://localhost:3001/api/register-resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();

  if (!data.success) {
    showError(data.message);
    return;
  }

  expirationTime = data.expiresAt;
  localStorage.setItem("registerCodeExpiresAt", expirationTime);
  startExpirationTimer();
});

verifyBtn.addEventListener("click", async () => {
  errorBox.style.display = "none";

  let code = "";
  otpInputs.forEach(i => code += i.value);

  if (code.length !== 6) {
    return showError("Enter a valid 6-digit code!");
  }

  loader.style.display = "block";
  verifyBtn.disabled = true;

  const res = await fetch("http://localhost:3001/api/register-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code })
  });

  const result = await res.json();

  loader.style.display = "none";

  if (!result.success) {
    verifyBtn.disabled = false;
    showError(result.message);
    return;
  }

  localStorage.removeItem("pendingEmail");
  localStorage.removeItem("registerCodeExpiresAt");
  localStorage.removeItem("registerResendAvailableAt");
  localStorage.removeItem("registerResendAttempts");

  window.location.href = "../../login/login.html";
});

otpInputs.forEach((input, idx) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");

    if (input.value && idx < otpInputs.length - 1)
      otpInputs[idx + 1].focus();

    let code = "";
    otpInputs.forEach(i => code += i.value);

    if (code.length === 6) {
      verifyBtn.click();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && idx > 0) {
      otpInputs[idx - 1].focus();
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    verifyBtn.click();
  }
});
