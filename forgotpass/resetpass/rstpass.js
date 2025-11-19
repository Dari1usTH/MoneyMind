const API_BASE = "http://localhost:3001"; 
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
const email = urlParams.get("email");

const newPass = document.getElementById("newPassword");
const confirmPass = document.getElementById("confirmPassword");
const resetBtn = document.getElementById("resetBtn");
const messageBox = document.getElementById("message");
const backBtn = document.getElementById("backBtn");

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.remove("hidden", "success", "error");
  messageBox.classList.add(type);
}

if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    if (!token || !email) {
      showMessage("Invalid reset link.", "error");
      return;
    }

    const newPassword = newPass.value.trim();
    const confirmPassword = confirmPass.value.trim();

    if (!newPassword || !confirmPassword) {
      showMessage("Please fill in both password fields.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Passwords do not match!", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      showMessage(data.message || "Something went wrong.", data.success ? "success" : "error");

      if (data.success) {
        localStorage.setItem("passwordResetSuccess", "1");
        window.location.href = "../../login/login.html";
      }
    } catch (err) {
      console.error("Reset password error:", err);
      showMessage("Could not contact the server. Please try again.", "error");
    }
  });
}

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "../../login/login.html";
  });
}