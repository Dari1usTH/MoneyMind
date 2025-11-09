const dayInputs = document.querySelectorAll('.calendar input');
const budgetInput = document.getElementById('budget');
const remaining = document.getElementById('remaining');
let totalBudget = 500;

budgetInput.addEventListener('input', () => {
  totalBudget = parseFloat(budgetInput.value) || 0;
  updateRemaining();
});

dayInputs.forEach(input => {
  input.addEventListener('input', updateRemaining);
});

function updateRemaining() {
  let totalSpent = 0;
  dayInputs.forEach(i => totalSpent += parseFloat(i.value) || 0);
  const remainingAmount = totalBudget - totalSpent;

  remaining.textContent = `Remaining amount: ${remainingAmount} RON`;
  remaining.style.color = remainingAmount < 0 ? '#ff5757' : '#00ffc6';

  dayInputs.forEach(input => {
    const dayDiv = input.parentElement;
    const value = parseFloat(input.value) || 0;
    dayDiv.classList.remove('positive', 'negative');
    if (value > (totalBudget / 7)) {
      dayDiv.classList.add('negative');
    } else if (value > 0) {
      dayDiv.classList.add('positive');
    }
  });
}

document.getElementById('saveInvestment').addEventListener('click', () => {
  const name = document.getElementById('investmentName').value.trim();
  const details = document.getElementById('investmentDetails').value.trim();

  if (!name || !details) {
    alert('Please fill in the investment name and details.');
    return;
  }

  alert(`Investment "${name}" saved successfully!`);
});
