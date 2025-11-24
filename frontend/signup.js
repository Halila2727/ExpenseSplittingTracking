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

// document.addEventListener('DOMContentLoaded', function () {
//     // Get the auth token from localStorage
//     const authToken = localStorage.getItem('token');

//     // If no token, prevent further actions
//     if (!authToken) {
//         alert("You are not logged in.");
//         return;
//     }

//     // Function to fetch groups
//     function fetchGroups() {
//         fetch('http://localhost:5000/api/groups', {
//             method: 'GET',
//             headers: {
//                 'Authorization': `Bearer ${authToken}`
//             }
//         })
//         .then(response => response.json())
//         .then(data => {
//             if (data.error) {
//                 alert('Error: ' + data.error);
//             } else {
//                 renderGroups(data.groups);
//             }
//         })
//         .catch(error => {
//             console.error('Error fetching groups:', error);
//             alert('Error fetching groups.');
//         });
//     }

//     // Function to render groups on the page
//     function renderGroups(groups) {
//         const groupsContainer = document.getElementById('groups-container');
//         groupsContainer.innerHTML = '';  // Clear any existing groups

//         if (groups.length === 0) {
//             groupsContainer.innerHTML = '<p>No groups found.</p>';
//             return;
//         }

//         groups.forEach(group => {
//             const groupCard = document.createElement('div');
//             groupCard.classList.add('group-card');

//             groupCard.innerHTML = `
//                 <h3>${group.group_name}</h3>
//                 <p><strong>Description:</strong> ${group.group_description}</p>
//                 <p><strong>Created by:</strong> User ID ${group.created_by}</p>
//                 <p class="member-count">Members: ${group.member_count}</p>
//             `;

//             groupsContainer.appendChild(groupCard);
//         });
//     }

//     // Call fetchGroups to load user groups when the page loads
//     fetchGroups();
// });
