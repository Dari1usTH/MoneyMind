const verifyBtn = document.getElementById("verifyBtn");
const errorBox = document.getElementById("errorBox");
const emailInfo = document.getElementById("emailInfo");
const loader = document.getElementById("loader");

history.pushState(null, "", location.href);
window.onpopstate = () => history.pushState(null, "", location.href);

function showMessage(type, message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";

  errorBox.classList.remove("success");
  errorBox.classList.add("error");

  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showError(message) {
  loader.style.display = "none";
  verifyBtn.disabled = false;
  showMessage("error", message);
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  errorBox.classList.remove("error");
}

let email = localStorage.getItem("pendingEmail") || "";

if (email) {
  emailInfo.textContent = `We sent a code to: ${email}`;
} else {
  emailInfo.textContent = "No email found. Please go back and register again.";
}

verifyBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  if (!email) {
    showError("No pending registration found. Please register again.");
    return;
  }

  const code = document.getElementById("verificationCode").value.trim();

  if (!code || code.length !== 6) {
    showError("Please enter the 6-digit verification code.");
    return;
  }

  loader.style.display = "block";
  verifyBtn.disabled = true;

  try {
    const res = await fetch("http://localhost:3001/api/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const result = await res.json();

    if (result.success) {
      localStorage.removeItem("pendingEmail");
      window.location.replace("../../login/login.html");
    } else {
      showError(result.message || "Invalid code. Please try again.");
    }
  } catch (err) {
    console.error(err);
    showError("Server error. Please try again later.");
  }
});
