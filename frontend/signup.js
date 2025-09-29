document.getElementById("signupForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const message = document.getElementById("signupMessage");

    if (password !== confirmPassword) {
        message.style.color = "red";
        message.textContent = "❌ Passwords do not match.";
        return;
    }

    // Save user to localStorage (demo only!)
    const user = { name, email, password };
    localStorage.setItem("user", JSON.stringify(user));

    message.style.color = "lime";
    message.textContent = "✅ Account created! Redirecting to login...";

    setTimeout(() => {
        window.location.href = "login.html";
    }, 1500);
});
