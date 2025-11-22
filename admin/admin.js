const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

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

async function handleAdminLogin(username, password, remember) {
  try {
    const res = await fetch("http://localhost:3001/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        username, 
        password,
        remember 
      }),
      credentials: "include",
    });

    const result = await res.json();

    if (result.success) {
      localStorage.setItem("user", result.username || "admin");
      localStorage.setItem("adminLoggedIn", "true");
      localStorage.setItem("loginRemember", remember ? "1" : "0");
      localStorage.setItem("userRole", "admin");
      
      localStorage.removeItem("pendingLoginEmail");
      localStorage.removeItem("resendAttempts");
      localStorage.removeItem("resendAvailableAt");
      localStorage.removeItem("loginCodeExpiresAt");
      
      window.location.href = "../index.html";
      return true;
    } else {
      showError(result.message || "Admin authentication failed");
      return false;
    }
  } catch (err) {
    console.error("Admin login error:", err);
    showError("Server error during admin authentication");
    return false;
  }
}

loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  loginBtn.disabled = true;
  loader.style.display = "block";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const remember = document.getElementById("remember").checked;

  if (!username || !password) {
    loader.style.display = "none";
    loginBtn.disabled = false;
    return showError("Please enter both username and password!");
  }

  const loginSuccess = await handleAdminLogin(username, password, remember);
  
  if (!loginSuccess) {
    loader.style.display = "none";
    loginBtn.disabled = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    loginBtn.click();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const isAdmin = localStorage.getItem("adminLoggedIn");
  if (isAdmin) {
    successBox.textContent = "You are already logged in as admin.";
    successBox.style.display = "block";
  }
});