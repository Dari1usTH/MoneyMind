const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userName");
const username = localStorage.getItem("user");

if (!username) {
  userNameDisplay.textContent = "";
  logoutBtn.textContent = "Login";
  logoutBtn.addEventListener("click", () => {
    window.location.href = "login/login.html";
  });
} else {
  userNameDisplay.textContent = "";
  logoutBtn.textContent = "Logout";

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("http://localhost:3001/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error(e);
    }

    localStorage.removeItem("user");
    localStorage.removeItem("adminLoggedIn");
    location.reload();
  });
}