const registerBtn = document.getElementById("registerBtn");
const errorBox = document.getElementById("errorBox");

function showMessage(type, message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";

  errorBox.classList.remove("error");
  errorBox.classList.remove("success");

  if (type === "error") {
    errorBox.classList.add("error");
  } else if (type === "success") {
    errorBox.classList.add("success");
  }

  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function showError(message) {
  showMessage("error", message);
}

function showSuccess(message) {
  showMessage("success", message);
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

  try {
    const res = await fetch("http://localhost:3001/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, username, email, password, dob, phone }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Register failed:", res.status, txt);
      showError("Server error. Please try again later.");
      return;
    }

    const result = await res.json();

    if (result.success) {
      showSuccess("A verification code has been sent to your email. Redirecting...");
      localStorage.setItem("pendingEmail", email);
      setTimeout(() => {
        window.location.href = "../register/emailverify/verify.html";
      }, 800);
    } else {
      showError(result.message || "An error occurred while creating the account.");
    }
  } catch (error) {
    console.error(error);
    showError("Server error. Please try again later.");
  }
});
