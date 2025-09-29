document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("loginMessage");

    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (storedUser && email === storedUser.email && password === storedUser.password) {
        message.style.color = "lime";
        message.textContent = "✅ Login successful! Redirecting...";
        setTimeout(() => {
            window.location.href = "index.html"; // Redirect to homepage
        }, 1500);
    } else {
        message.style.color = "red";
        message.textContent = "❌ Invalid email or password.";
    }
});
