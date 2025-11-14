const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("errorBox");

function showError(msg){
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";

  const identifier = document.getElementById("user").value.trim();
  const password = document.getElementById("pass").value.trim();
  const remember = document.getElementById("remember").checked;

  if (!identifier || !password) {
    return showError("Please fill in all fields!");
  }

  try {
    const res = await fetch("http://localhost:3001/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const result = await res.json();

    if (!result.success) {
      return showError(result.message);
    }

    localStorage.setItem("pendingLoginEmail", result.email);
    localStorage.setItem("loginRemember", remember ? "1" : "0");
    
    window.location.href = "./emailverify/verify.html";

  } catch (err) {
    showError("Server error. Try again later.");
  }
});
