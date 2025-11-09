const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (username === "" || password === "") {
        alert("Please enter both username and password!");
        return;
    }

    localStorage.setItem("user", username);
    window.location.href = "../index.html";
});


// to do
// email code for verification
// authenticator code (2fa only) or phone number