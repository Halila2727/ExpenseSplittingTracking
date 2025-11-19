const themeScript = document.createElement("script");
themeScript.src = "theme-toggle.js";
themeScript.defer = true;
document.head.appendChild(themeScript);

document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("loginMessage");

    // Clear previous messages
    message.textContent = "";
    message.className = "login-message";

    try {
        // Show loading state
        message.className = "login-message loading";
        message.textContent = "Authenticating...";

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

            message.className = "login-message success";
            message.textContent = "Authentication successful. Redirecting to dashboard...";
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            message.className = "login-message error";
            message.textContent = data.error;
        }
    } catch (error) {
        console.error('Login error:', error);
        message.className = "login-message error";
        message.textContent = "Connection failed. Please check your network and try again.";
    }
});