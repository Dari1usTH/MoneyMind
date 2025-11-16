const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("errorBox");

const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

function showError(msg) {
  loader.style.display = "none";
  loginBtn.disabled = false;
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

loginBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  loginBtn.disabled = true;      
  loader.style.display = "block";

  const identifier = document.getElementById("username").value.trim();
  const password   = document.getElementById("password").value.trim();
  const remember   = document.getElementById("remember").checked;

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

    loader.style.display = "none";  

    localStorage.setItem("pendingLoginEmail", result.email);
    localStorage.setItem("loginRemember", remember ? "1" : "0");

    window.location.href = "./emailverify/verify.html";
  } catch (err) {
    console.error(err);
    showError("Server error. Try again later.");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loginBtn.click();
  }
});
