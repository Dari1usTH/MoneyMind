const registerBtn = document.getElementById("registerBtn");
const errorBox = document.getElementById("errorBox");

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

registerBtn.addEventListener("click", () => {
  clearError();

  const firstName = document.getElementById("nume").value.trim();
  const lastName = document.getElementById("prenume").value.trim();
  const username = document.getElementById("username").value.trim().toLowerCase();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const dob = document.getElementById("dob").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    showError("Please fill in all required fields!");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match!");
    return;
  }

  if (
    username.includes("admin") ||
    firstName.toLowerCase().includes("admin") ||
    lastName.toLowerCase().includes("admin")
  ) {
    showError("You cannot use 'admin' in your first name, last name, or username!");
    return;
  }

  const userDisplayName = username || lastName;
  localStorage.setItem("user", userDisplayName);

  clearError();
  errorBox.style.display = "none";
  alert("Account successfully created!");
  window.location.href = "../index.html";
});



// to do

// email verification
// phone number verification
// verify already existing account