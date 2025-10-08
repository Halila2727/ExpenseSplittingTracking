document.getElementById("signupForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const message = document.getElementById("signupMessage");

    // Clear previous messages
    message.textContent = "";
    message.className = "login-message";

    // Client-side validation
    if (password !== confirmPassword) {
        message.className = "login-message error";
        message.textContent = "Passwords do not match.";
        return;
    }

    if (password.length < 6) {
        message.className = "login-message error";
        message.textContent = "Password must be at least 6 characters.";
        return;
    }

    try {
        // Show loading state
        message.className = "login-message loading";
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

            message.className = "login-message success";
            message.textContent = "Account created successfully. Redirecting to dashboard...";

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            message.className = "login-message error";
            message.textContent = data.error;
        }
    } catch (error) {
        console.error('Signup error:', error);
        message.className = "login-message error";
        message.textContent = "Connection failed. Please check your network and try again.";
    }
});
