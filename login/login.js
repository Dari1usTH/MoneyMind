const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

document.addEventListener("DOMContentLoaded", () => {
  const accountCreated = localStorage.getItem("accountCreated");
  if (accountCreated) {
    successBox.textContent = "Your account has been created successfully. You can now log in.";
    successBox.style.display = "block";
    localStorage.removeItem("accountCreated");
  }
});

function showError(msg) {
  loader.style.display = "none";
  loginBtn.disabled = false;
  successBox.style.display = "none";
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  successBox.style.display = "none";
}

loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  loginBtn.disabled = true;      
  loader.style.display = "block";

  const identifier = document.getElementById("username").value.trim();
  const password   = document.getElementById("password").value.trim();
  const remember   = document.getElementById("remember").checked;

  if (!identifier || !password) {
    return showError("Please fill in all fields!");
  }

  try {
    const res = await fetch("http://localhost:3001/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const result = await res.json();

    if (!result.success) {
      return showError(result.message);
    }

    loader.style.display = "none";  

    localStorage.setItem("pendingLoginEmail", result.email);
    localStorage.setItem("loginRemember", remember ? "1" : "0");
    if (result.expiresAt) {
      localStorage.setItem("loginCodeExpiresAt", String(result.expiresAt));
    } else {
      localStorage.setItem(
        "loginCodeExpiresAt",
        String(Date.now() + 10 * 60 * 1000)
      );
    }
    localStorage.removeItem("resendAttempts");
    localStorage.removeItem("resendAvailableAt");

    window.location.href = "./emailverify/verify.html";
  } catch (err) {
    console.error(err);
    showError("Server error. Try again later.");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    loginBtn.click();
  }
});