const API_URL = "http://localhost:5000/api";

async function getInvestments() {
  const res = await fetch(`${API_URL}/investments`);
  const data = await res.json();
  return data;
}

async function addInvestment(name, amount, category) {
  const res = await fetch(`${API_URL}/investments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, amount, category }),
  });
  const data = await res.json();
  return data;
}
