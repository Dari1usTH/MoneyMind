const API_BASE = "http://localhost:3001";
const emailInput   = document.getElementById("email");
const sendLinkBtn  = document.getElementById("sendLinkBtn");
const messageBox   = document.getElementById("message");
const backBtn      = document.getElementById("backBtn");
const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

function showMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.remove("hidden", "success", "error");
  messageBox.classList.add(type);
}

function setLoading(isLoading) {
  if (!sendLinkBtn) return;
  if (isLoading) {
    sendLinkBtn.disabled = true;
    loader.style.display = "block";
  } else {
    sendLinkBtn.disabled = false;
    loader.style.display = "none";
  }
}

if (sendLinkBtn) {
  sendLinkBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (messageBox) {
      messageBox.classList.add("hidden");
    }

    setLoading(true);

    const email = emailInput.value.trim();

    if (!email) {
      setLoading(false);
      showMessage("Please enter your email address.", "error");
      return;
    }

    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailRegex.test(email)) {
      setLoading(false);
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
      setLoading(false);
      showMessage(
        data.message || "Something went wrong.",
        data.success ? "success" : "error"
      );
    } catch (err) {
      console.error("Forgot password error:", err);
      setLoading(false);
      showMessage("Could not contact the server. Please try again.", "error");
    }
  });
}

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "../login/login.html";
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    if (sendLinkBtn && !sendLinkBtn.disabled) {
      sendLinkBtn.click();
    }
  }
});
