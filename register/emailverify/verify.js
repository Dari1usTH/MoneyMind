const verifyBtn = document.getElementById("verifyBtn");
const errorBox = document.getElementById("errorBox");
const emailInfo = document.getElementById("emailInfo");

function showMessage(type, message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";

  errorBox.classList.remove("error");
  errorBox.classList.remove("success");

  if (type === "error") {
    errorBox.classList.add("error");
  } else if (type === "success") {
    errorBox.classList.add("success");
  }

  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showError(message) {
  showMessage("error", message);
}

function showSuccess(message) {
  showMessage("success", message);
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  errorBox.classList.remove("error");
  errorBox.classList.remove("success");
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

  try {
    const res = await fetch("http://localhost:3001/api/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Verification failed:", res.status, txt);
      showError("Server error. Please try again later.");
      return;
    }

    const result = await res.json();

    if (result.success) {
      showSuccess("Your account has been created. Redirecting to login...");
      localStorage.removeItem("pendingEmail");
      setTimeout(() => {
        window.location.href = "../login/login.html";
      }, 1000);
    } else {
      showError(result.message || "Invalid code. Please try again.");
    }
  } catch (err) {
    console.error(err);
    showError("Server error. Please try again later.");
  }
});

