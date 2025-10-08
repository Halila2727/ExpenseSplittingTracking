// Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    checkAuthentication();
    
    // Add logout functionality
    addLogoutButton();
});

async function checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // Verify token with backend
        const response = await fetch('http://localhost:5000/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: token })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.valid) {
            // Token is invalid, clear storage and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
        
        // Update user info if needed
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // Display user info
        displayUserInfo(data.user);
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        // On network error, allow user to stay but show warning
        console.warn('Could not verify authentication, proceeding with cached data');
        const userData = JSON.parse(user);
        displayUserInfo(userData);
    }
}

function displayUserInfo(user) {
    // Update any user-specific elements on the dashboard
    const userElements = document.querySelectorAll('.user-name');
    userElements.forEach(element => {
        element.textContent = user.name;
    });
    
    // Update email if needed
    const userEmailElements = document.querySelectorAll('.user-email');
    userEmailElements.forEach(element => {
        element.textContent = user.email;
    });
}

function addLogoutButton() {
    // Find the header container to add logout button
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        // Create logout button
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Logout';
        logoutButton.className = 'btn btn-outline';
        logoutButton.style.marginLeft = 'auto';
        logoutButton.onclick = logout;
        
        // Add to header (you may need to adjust this based on your header structure)
        headerContainer.appendChild(logoutButton);
    }
}

function logout() {
    // Clear stored authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// Add some basic dashboard functionality
function addExpense() {
    // Placeholder for add expense functionality
    alert('Add expense functionality coming soon!');
}

function settleExpense() {
    // Placeholder for settle expense functionality
    alert('Settle expense functionality coming soon!');
}

// Make functions globally available
window.addExpense = addExpense;
window.settleExpense = settleExpense;