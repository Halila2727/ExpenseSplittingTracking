document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("loginMessage");

    // Clear previous messages
    message.textContent = "";

    try {
        // Show loading state
        message.style.color = "blue";
        message.textContent = "Logging in...";

        const response = await fetch('http://localhost:5000/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            message.textContent = "Login successful! Redirecting to dashboard...";
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            message.style.color = "red";
            message.textContent = `❌ ${data.error}`;
        }
    } catch (error) {
        console.error('Login error:', error);
        message.style.color = "red";
        message.textContent = "Network error. Please try again.";
    }
});
