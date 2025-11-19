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
        
    } catch (error) {
        console.error('Failed to load personal data:', error);
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

function setupFormHandlers() {
    // Edit profile form
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleEditProfile();
        });
        
        // Clear errors on input
        const profileNameInput = document.getElementById('profileName');
        const profileEmailInput = document.getElementById('profileEmail');
        
        if (profileNameInput) {
            profileNameInput.addEventListener('input', () => clearError('profileName'));
        }
        if (profileEmailInput) {
            profileEmailInput.addEventListener('input', () => clearError('profileEmail'));
        }
    }
    
    // Edit password form
    const editPasswordForm = document.getElementById('editPasswordForm');
    if (editPasswordForm) {
        editPasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleEditPassword();
        });
        
        // Clear errors on input
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', () => clearError('newPassword'));
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => clearError('confirmPassword'));
        }
    }
    
    // Populate form fields with current user data
    populateFormFields();
}

// Store current user data for validation
let currentUserData = null;

function populateFormFields() {
    // Populate profile form with current user data
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    currentUserData = {
        name: user.name || '',
        email: user.email || ''
    };
    
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    
    if (profileNameInput) {
        profileNameInput.value = currentUserData.name;
    }
    if (profileEmailInput) {
        profileEmailInput.value = currentUserData.email;
    }
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + '-error');
    
    if (field) {
        field.classList.add('error');
    }
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + '-error');
    
    if (field) {
        field.classList.remove('error');
    }
    
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

function clearAllErrors() {
    clearError('profileName');
    clearError('profileEmail');
    clearError('newPassword');
    clearError('confirmPassword');
}

async function handleEditProfile() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        showError('profileName', 'Please log in to edit profile');
        return;
    }
    
    // Clear previous errors
    clearError('profileName');
    clearError('profileEmail');
    
    const nameInput = document.getElementById('profileName').value.trim();
    const emailInput = document.getElementById('profileEmail').value.trim().toLowerCase();
    
    // Build update data - only include fields that have values
    const profileData = {};
    let hasChanges = false;
    
    if (nameInput) {
        // Check if name is different
        if (nameInput === currentUserData.name) {
            showError('profileName', 'Name must be different from current name');
            return;
        }
        profileData.name = nameInput;
        hasChanges = true;
    }
    
    if (emailInput) {
        // Validate email format
        if (!emailInput.includes('@')) {
            showError('profileEmail', 'Invalid email format');
            return;
        }
        
        // Check if email is different
        if (emailInput === currentUserData.email) {
            showError('profileEmail', 'Email must be different from current email');
            return;
        }
        profileData.email = emailInput;
        hasChanges = true;
    }
    
    // At least one field must be provided
    if (!hasChanges) {
        showError('profileName', 'Please provide at least one field to update');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Handle specific error messages
            if (response.status === 409) {
                showError('profileEmail', data.error || 'Email already in use');
            } else {
                const errorField = profileData.email ? 'profileEmail' : 'profileName';
                showError(errorField, data.error || 'Failed to update profile');
            }
            return;
        }
        
        // Update local display with new values (use updated values from response or keep current)
        const updatedUser = data.user || {};
        const newName = updatedUser.name || (profileData.name ? profileData.name : currentUserData.name);
        const newEmail = updatedUser.email || (profileData.email ? profileData.email : currentUserData.email);
        
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const userInitials = document.getElementById('user-initials');
        
        if (profileName) profileName.textContent = newName;
        if (profileEmail) profileEmail.textContent = newEmail;
        
        // Update initials
        if (userInitials) {
            const initials = newName.split(' ').map(n => n[0]).join('').toUpperCase();
            userInitials.textContent = initials;
        }
        
        // Update localStorage and current user data
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.name = newName;
        user.email = newEmail;
        localStorage.setItem('user', JSON.stringify(user));
        currentUserData = { name: newName, email: newEmail };
        
        // Clear form fields that were updated
        if (profileData.name) {
            document.getElementById('profileName').value = '';
        }
        if (profileData.email) {
            document.getElementById('profileEmail').value = '';
        }
        
        // Clear form errors on success
        clearAllErrors();
        
    } catch (error) {
        console.error('Failed to update profile:', error);
        showError('profileEmail', 'Network error. Please try again.');
    }
}

async function handleEditPassword() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        showError('newPassword', 'Please log in to change password');
        return;
    }
    
    // Clear previous errors
    clearError('newPassword');
    clearError('confirmPassword');
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    let hasErrors = false;
    
    // Validate required fields
    if (!newPassword) {
        showError('newPassword', 'Password is required');
        hasErrors = true;
    }
    
    if (!confirmPassword) {
        showError('confirmPassword', 'Please confirm your password');
        hasErrors = true;
    }
    
    // Validate password length
    if (newPassword && newPassword.length < 6) {
        showError('newPassword', 'Password must be at least 6 characters long');
        hasErrors = true;
    }
    
    // Validate password match
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/users/password', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ new_password: newPassword })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Handle specific error messages
            if (response.status === 400 && data.error.includes('different')) {
                showError('newPassword', data.error || 'New password must be different from current password');
            } else {
                showError('newPassword', data.error || 'Failed to update password');
            }
            return;
        }
        
        // Clear password fields on success
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        // Clear form errors on success
        clearAllErrors();
        
    } catch (error) {
        console.error('Failed to update password:', error);
        showError('newPassword', 'Network error. Please try again.');
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



