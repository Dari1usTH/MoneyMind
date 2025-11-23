const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userName");
const username = localStorage.getItem("user");
const isSupportPage = window.location.pathname.includes("/support/");
const isTicketsPage = window.location.pathname.includes("/tickets/");

if (!username) {
  if (!isSupportPage) {
    userNameDisplay.textContent = "Guest";
  }
  if (!isTicketsPage) {
    userNameDisplay.textContent = "Guest";
  }
  logoutBtn.textContent = "Login";
  logoutBtn.addEventListener("click", () => {
    window.location.href = "../login/login.html";
  });
} else {
  if (!isSupportPage) {
    userNameDisplay.textContent = username;
  }
  if (!isTicketsPage) {
    userNameDisplay.textContent = username;
  }
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
    localStorage.removeItem("mm_selected_account_id");
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("userRole");
    localStorage.removeItem("loginRemember");
    
    location.reload();
  });
}