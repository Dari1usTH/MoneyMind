const verifyBtn = document.getElementById("verifyBtn");
const errorBox = document.getElementById("errorBox");
const loader = document.getElementById("loader");
const emailInfo = document.getElementById("emailInfo");

const email = localStorage.getItem("pendingLoginEmail");
const remember = localStorage.getItem("loginRemember") === "1";

emailInfo.textContent = email ? `Code sent to: ${email}` : "No email found.";

function showError(msg){
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

verifyBtn.addEventListener("click", async () => {
  errorBox.style.display = "none";

  const code = document.getElementById("code").value.trim();
  if (code.length !== 6) return showError("Enter a valid 6-digit code!");

  loader.style.display = "block";
  verifyBtn.disabled = true;

  try {
    const res = await fetch("http://localhost:3001/api/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, remember }),
      credentials: "include",
    });

    const result = await res.json();

    if (!result.success) {
      loader.style.display = "none";
      verifyBtn.disabled = false;
      return showError(result.message);
    }

    localStorage.removeItem("pendingLoginEmail");
    localStorage.removeItem("loginRemember");

    window.location.href = "../../index.html";

  } catch (err){
    showError("Server error.");
  }
});
