const API_BASE = "http://localhost:3001"; 
const emailInput = document.getElementById("email");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const messageBox = document.getElementById("message");
const backBtn = document.getElementById("backBtn");

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.remove("hidden", "success", "error");
  messageBox.classList.add(type);
}

if (sendLinkBtn) {
  sendLinkBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
      showMessage("Please enter your email address.", "error");
      return;
    }

    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailRegex.test(email)) {
      showMessage("Please enter a valid email address.", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      showMessage(data.message || "Something went wrong.", data.success ? "success" : "error");
    } catch (err) {
      console.error("Forgot password error:", err);
      showMessage("Could not contact the server. Please try again.", "error");
    }
  });
}

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "../login/login.html";
  });
}
