(function () {
  const logoutBtn = document.getElementById("logoutBtn");
  const userNameDisplay = document.getElementById("userName");

  if (!logoutBtn || !userNameDisplay) {
    return;
  }

  const username = localStorage.getItem("user");
  const LOGIN_PATH = "/login/login.html";

  if (!username) {
    userNameDisplay.textContent = "Guest";
    logoutBtn.textContent = "Login";

    logoutBtn.onclick = () => {
      window.location.href = LOGIN_PATH;
    };
  } else {
    userNameDisplay.textContent = username;
    logoutBtn.textContent = "Logout";

    logoutBtn.onclick = async () => {
      try {
        await fetch("http://localhost:3001/api/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.error(e);
      }

      localStorage.removeItem("user");
      window.location.href = LOGIN_PATH;
    };
  }
})();
