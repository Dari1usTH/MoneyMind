const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userName");
const username = localStorage.getItem("user");

if (!username) {
  userNameDisplay.textContent = "Guest";
  logoutBtn.textContent = "Login";
  logoutBtn.addEventListener("click", () => {
    window.location.href = "login/login.html"
  });
} else {
  userNameDisplay.textContent = username;

  logoutBtn.textContent = "Logout";
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    location.reload();
  });
}