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
  if (username.includes("admin") || firstName.toLowerCase().includes("admin") || lastName.toLowerCase().includes("admin")) {
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
      alert("Account successfully created!");
      window.location.href = "../login/login.html";
    } else {
      showError(result.message || "An error occurred while creating the account.");
    }
  } catch (error) {
    console.error(error);
    showError("Server error. Please try again later.");
  }
});
