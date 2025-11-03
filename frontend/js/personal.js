// Personal page functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // Check if user is authenticated
    checkAuthentication();
    
    // Add logout functionality
    addLogoutButton();
    
    // Set up form handlers
    setupFormHandlers();
});

async function checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
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
        
        // Load personal data
        loadPersonalData();
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        // On network error, allow user to stay but show warning
        console.warn('Could not verify authentication, proceeding with cached data');
        const userData = JSON.parse(user);
        displayUserInfo(userData);
        loadPersonalData();
    }
}

function displayUserInfo(user) {
    // Update profile information
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const userInitials = document.getElementById('user-initials');
    
    if (profileName) {
        profileName.textContent = user.name;
    }
    
    if (profileEmail) {
        profileEmail.textContent = user.email;
    }
    
    if (userInitials) {
        // Generate initials from name
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userInitials.textContent = initials;
    }
}

async function loadPersonalData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('No authentication token available');
        displayPersonalError();
        return;
    }
    
    try {
        // Load groups data
        const groupsResponse = await fetch('http://localhost:5000/api/groups', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json();
            updatePersonalStats(groupsData.groups);
        }
        
        // Load activity data
        const activityResponse = await fetch('http://localhost:5000/api/activity', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (activityResponse.ok) {
            const activityData = await activityResponse.json();
            displayPersonalActivity(activityData.activities);
        }
        
    } catch (error) {
        console.error('Failed to load personal data:', error);
        displayPersonalError();
    }
}

function updatePersonalStats(groups) {
    const totalGroups = document.getElementById('total-groups');
    const memberSince = document.getElementById('member-since');
    
    if (totalGroups) {
        totalGroups.textContent = groups.length;
    }
    
    if (memberSince) {
        // This would come from user registration date
        // For now, showing current year
        memberSince.textContent = new Date().getFullYear();
    }
}

function displayPersonalActivity(activities) {
    const activityList = document.getElementById('personal-activity-list');
    const emptyState = document.getElementById('empty-state');
    
    if (!activityList) {
        console.error('Personal activity list element not found');
        return;
    }
    
    if (activities.length === 0) {
        // Show empty state
        activityList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    // Hide empty state and show activity list
    emptyState.style.display = 'none';
    activityList.style.display = 'block';
    
    // Clear loading state
    activityList.innerHTML = '';
    
    // Show only first 5 activities for personal page
    const recentActivities = activities.slice(0, 5);
    
    // Render activities
    recentActivities.forEach(activity => {
        const activityElement = createPersonalActivityElement(activity);
        activityList.appendChild(activityElement);
    });
}

function createPersonalActivityElement(activity) {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item personal-activity-item';
    activityItem.setAttribute('data-type', activity.type);
    
    // Create icon
    const icon = document.createElement('div');
    icon.className = `activity-icon ${activity.type}`;
    icon.textContent = activity.type === 'expense' ? '$' : '$';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'activity-content';
    
    // Description
    const description = document.createElement('div');
    description.className = 'activity-description';
    
    if (activity.type === 'expense') {
        description.textContent = `${activity.paid_by} paid ${activity.description}`;
    } else {
        description.textContent = `${activity.paid_by} paid ${activity.paid_to}`;
    }
    
    // Meta information
    const meta = document.createElement('div');
    meta.className = 'activity-meta';
    
    if (activity.type === 'expense') {
        meta.innerHTML = `<span>in "${activity.group_name}"</span>`;
    } else {
        meta.innerHTML = `<span>in "${activity.group_name || 'General'}"</span>`;
    }
    
    content.appendChild(description);
    content.appendChild(meta);
    
    // Amount
    const amount = document.createElement('div');
    amount.className = 'activity-amount';
    amount.textContent = `$${activity.amount.toFixed(2)}`;
    
    // Add color based on whether it's user's activity
    if (activity.type === 'expense') {
        if (activity.is_my_expense) {
            amount.classList.add('negative'); // User paid, so it's money out (red)
        } else if (activity.is_involved) {
            amount.classList.add('negative'); // User owes money, so it's money out (red)
        } else {
            amount.classList.add('positive'); // Someone else paid, so it's money in (green)
        }
    } else {
        if (activity.is_my_payment) {
            amount.classList.add('negative'); // User paid, so it's money out (red)
        } else if (activity.is_paid_to_me) {
            amount.classList.add('positive'); // User received payment, so it's money in (green)
        } else {
            amount.classList.add('positive');
        }
    }
    
    activityItem.appendChild(icon);
    activityItem.appendChild(content);
    activityItem.appendChild(amount);
    
    return activityItem;
}

function displayPersonalError() {
    const activityList = document.getElementById('personal-activity-list');
    const emptyState = document.getElementById('empty-state');
    
    if (activityList) {
        activityList.innerHTML = `
            <div class="error-state">
                <p>Error loading personal data. Please try again later.</p>
                <button class="btn" onclick="loadPersonalData()">Retry</button>
            </div>
        `;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

function setupFormHandlers() {
    // Edit profile form
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleEditProfile();
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

async function handleEditProfile() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Please log in to edit profile');
        return;
    }
    
    const profileData = {
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim()
    };
    
    // Validate required fields
    if (!profileData.name || !profileData.email) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        // This would need a backend endpoint for updating profile
        // For now, just show success message
        alert('Profile updated successfully! (This feature needs backend implementation)');
        closeModal('editProfileModal');
        
        // Update local display
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        
        if (profileName) profileName.textContent = profileData.name;
        if (profileEmail) profileEmail.textContent = profileData.email;
        
    } catch (error) {
        console.error('Failed to update profile:', error);
        alert('Failed to update profile. Please try again.');
    }
}

function saveSettings() {
    const notifications = document.getElementById('notifications').value;
    const currency = document.getElementById('currency').value;
    const theme = document.getElementById('theme').value;
    
    // Save to localStorage for now
    localStorage.setItem('userSettings', JSON.stringify({
        notifications,
        currency,
        theme
    }));
    
    alert('Settings saved successfully!');
    closeModal('settingsModal');
}

// Modal functions
function openProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Populate form with current user data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('profileName').value = user.name || '';
        document.getElementById('profileEmail').value = user.email || '';
    }
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Load saved settings
        const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        document.getElementById('notifications').value = settings.notifications || 'all';
        document.getElementById('currency').value = settings.currency || 'USD';
        document.getElementById('theme').value = settings.theme || 'light';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
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
        
        // Add to header
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

// Make functions globally available
window.openProfileModal = openProfileModal;
window.openSettingsModal = openSettingsModal;
window.closeModal = closeModal;
