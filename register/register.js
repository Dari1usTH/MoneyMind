const registerBtn = document.getElementById("registerBtn");
const errorBox = document.getElementById("errorBox");

const loader = document.createElement("div");
loader.classList.add("loader");
loader.style.display = "none";
document.querySelector(".login-box").appendChild(loader);

function showMessage(type, message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
  errorBox.classList.remove("error", "success");

  if (type === "error") {
    errorBox.classList.add("error");
  }
}

function showError(message) {
  loader.style.display = "none";
  registerBtn.disabled = false;
  showMessage("error", message);
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
  errorBox.classList.remove("error", "success");
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
  const dob = dobInput || null;
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
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        password,
        dob,
        phone,
      }),
    });

    const result = await res.json();

    if (!result.success) {
      return showError(result.message || "An error occurred.");
    }

    loader.style.display = "none";

    localStorage.setItem("pendingEmail", email);
    localStorage.setItem("registerCodeExpiresAt", Date.now() + 10 * 60 * 1000);
    localStorage.setItem("registerResendAvailableAt", Date.now() + 30 * 1000);

    window.location.replace(`../register/emailverify/verify.html`);

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

const dobInput = document.getElementById("dob");
const dobDisplay = document.getElementById("dobDisplay");

dobDisplay.addEventListener("click", () => {
  dobInput.focus();
  if (dobInput.showPicker) {
    dobInput.showPicker();
  }
});

dobInput.addEventListener("change", () => {
  if (dobInput.value) {
    const val = new Date(dobInput.value).toLocaleDateString("en-GB");
    dobDisplay.textContent = val;
    dobDisplay.parentElement.classList.add("filled");
  } else {
    dobDisplay.textContent = "Date of Birth (optional)";
    dobDisplay.parentElement.classList.remove("filled");
  }
});