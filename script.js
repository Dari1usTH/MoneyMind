const ctx = document.getElementById("investmentChart");
new Chart(ctx, {
  type: "line",
  data: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    datasets: [{
      label: "Investment Growth",
      data: [1000, 1500, 1800, 2300, 2100, 2600, 3000],
      borderColor: "#00ffc6",
      tension: 0.3,
      fill: false,
    }],
  },
  options: {
    scales: {
      x: { ticks: { color: "#aaa" } },
      y: { ticks: { color: "#aaa" } },
    },
    plugins: {
      legend: { labels: { color: "white" } },
    },
  },
});

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