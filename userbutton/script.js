const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userName");
const username = localStorage.getItem("user");

if (!username) {
  userNameDisplay.textContent = "Guest";
  logoutBtn.textContent = "Login";
  logoutBtn.addEventListener("click", () => {
    window.location.href = "../login/login.html";
  });
} else {
  userNameDisplay.textContent = username;
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
    location.reload();
  });
} 
