const emailInput = document.getElementById("email");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const messageBox = document.getElementById("message");
const backBtn = document.getElementById("backBtn");

function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.classList.remove("hidden", "success", "error");
  messageBox.classList.add(type);
}

sendLinkBtn.addEventListener("click", () => {
  const email = emailInput.value.trim();

  if (email === "") {
    showMessage("Please enter your email address.", "error");
    return;
  }

  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!simpleEmailRegex.test(email)) {
    showMessage("Please enter a valid email address.", "error");
    return;
  }

  showMessage(
    "If this email is associated with an account, a password reset link has been sent.",
    "success"
  );
});

backBtn.addEventListener("click", () => {
  window.location.href = "../login/login.html";
});
