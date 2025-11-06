const loginBtn = document.getElementById("loginBtn");
const loginPage = document.getElementById("loginPage");
const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userName");

loginBtn.addEventListener("click", () => {
  const username = document.getElementById("username").value || "investitorule";
  userNameDisplay.textContent = username;
  loginPage.classList.add("hidden");
  dashboard.classList.remove("hidden");
});

logoutBtn.addEventListener("click", () => {
  dashboard.classList.add("hidden");
  loginPage.classList.remove("hidden");
});

const ctx = document.getElementById("investmentChart");
new Chart(ctx, {
  type: "line",
  data: {
    labels: ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul"],
    datasets: [{
      label: "Evoluție",
      data: [1000, 1500, 1800, 2300, 2100, 2600, 3000],
      borderColor: "#00ffc6",
      tension: 0.3,
      fill: false,
    }],
  },
  options: {
    scales: {
      x: { ticks: { color: "#aaa" } },
      y: { ticks: { color: "#aaa" } }
    },
    plugins: {
      legend: { labels: { color: "white" } }
    }
  }
});
