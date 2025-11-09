const calendar = document.getElementById("calendar");
const depositsEl = document.getElementById("deposits");
const withdrawalsEl = document.getElementById("withdrawals");
const balanceEl = document.getElementById("balance");

const currentMonth = "January";
const currentYear = 2024;
document.getElementById("monthTitle").textContent = `${currentMonth} ${currentYear}`;

// Generate a basic monthly calendar
const daysInMonth = 31;
for (let i = 1; i <= daysInMonth; i++) {
  const dayDiv = document.createElement("div");
  dayDiv.classList.add("day");
  dayDiv.innerHTML = `<strong>${i}</strong><br><input type="number" placeholder="RON">`;
  calendar.appendChild(dayDiv);
}

const inputs = document.querySelectorAll(".day input");

inputs.forEach(input => {
  input.addEventListener("input", updateTotals);
});

function updateTotals() {
  let deposits = 0;
  let withdrawals = 0;

  inputs.forEach(input => {
    const value = parseFloat(input.value) || 0;
    const parent = input.parentElement;
    parent.classList.remove("positive", "negative");

    if (value > 0) {
      deposits += value;
      parent.classList.add("positive");
    } else if (value < 0) {
      withdrawals += Math.abs(value);
      parent.classList.add("negative");
    }
  });

  depositsEl.textContent = deposits.toFixed(2);
  withdrawalsEl.textContent = withdrawals.toFixed(2);
  balanceEl.textContent = (deposits - withdrawals).toFixed(2);
}
