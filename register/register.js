const registerBtn = document.getElementById("registerBtn");
const errorBox = document.getElementById("errorBox");

const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

function showMessage(type, message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";

  errorBox.classList.remove("error");
  errorBox.classList.remove("success");

  if (type === "error") {
    errorBox.classList.add("error");
  }

  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showError(message) {
  loader.style.display = "none";
  registerBtn.disabled = false;
  showMessage("error", message);
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  errorBox.classList.remove("error");
  errorBox.classList.remove("success");
}

registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  clearError();

  registerBtn.disabled = true;
  loader.style.display = "block";

  const firstName = document.getElementById("nume").value.trim();
  const lastName = document.getElementById("prenume").value.trim();
  const username = document.getElementById("username").value.trim().toLowerCase();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const dobInput = document.getElementById("dob").value.trim();
  const dob = dobInput === "" ? null : dobInput;
  const phone = document.getElementById("phone").value.trim();

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return showError("Please fill in all required fields!");
  }
  if (password !== confirmPassword) {
    return showError("Passwords do not match!");
  }
  if (
    username.includes("admin") ||
    firstName.toLowerCase().includes("admin") ||
    lastName.toLowerCase().includes("admin")
  ) {
    return showError("You cannot use 'admin' in your first name, last name, or username!");
  }

  try {
    const res = await fetch("http://localhost:3001/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, username, email, password, dob, phone }),
    });

    const result = await res.json();

    if (!result.success) {
      return showError(result.message || "An error occurred.");
    }

    loader.style.display = "none";
    localStorage.setItem("pendingEmail", email);
    window.location.replace(`../register/emailverify/verify.html?email=${encodeURIComponent(email)}`);

  } catch (error) {
    console.error(error);
    showError("Server error. Please try again later.");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "NumpadEnter") {
    e.preventDefault();
    registerBtn.click();
  }
});