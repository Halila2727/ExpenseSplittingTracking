document.getElementById("signupForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const message = document.getElementById("signupMessage");

    // Clear previous messages
    message.textContent = "";

    // Client-side validation
    if (password !== confirmPassword) {
        message.style.color = "red";
        message.textContent = "Passwords do not match.";
        return;
    }

    if (password.length < 6) {
        message.style.color = "red";
        message.textContent = "Password must be at least 6 characters.";
        return;
    }

    try {
        // Show loading state
        message.style.color = "blue";
        message.textContent = "Creating account...";

        const response = await fetch('http://localhost:5000/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Store user data and token
            localStorage.setItem("user", JSON.stringify(data.user));
            localStorage.setItem("token", data.token);

            message.style.color = "lime";
            message.textContent = "Account created! Redirecting to dashboard...";

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            message.style.color = "red";
            message.textContent = `❌ ${data.error}`;
        }
    } catch (error) {
        console.error('Signup error:', error);
        message.style.color = "red";
        message.textContent = "❌ Network error. Please try again.";
    }
});
