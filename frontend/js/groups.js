// Groups page functionality
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
        
        // Load groups data
        loadGroupsData();
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        // On network error, allow user to stay but show warning
        console.warn('Could not verify authentication, proceeding with cached data');
        const userData = JSON.parse(user);
        // Try to load groups data even if auth check failed
        loadGroupsData();
    }
}

async function loadGroupsData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('No authentication token available');
        displayGroupsError();
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/groups', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const groupsData = await response.json();
        displayGroups(groupsData.groups);
        
    } catch (error) {
        console.error('Failed to load groups data:', error);
        displayGroupsError();
    }
}

function displayGroups(groups) {
    const groupsList = document.getElementById('groups-list');
    const emptyState = document.getElementById('empty-state');
    
    if (!groupsList) {
        console.error('Groups list element not found');
        return;
    }
    
    if (groups.length === 0) {
        // Show empty state
        groupsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    // Hide empty state and show groups list
    emptyState.style.display = 'none';
    groupsList.style.display = 'block';
    
    // Clear loading state
    groupsList.innerHTML = '';
    
    // Render groups
    groups.forEach(group => {
        const groupElement = createGroupElement(group);
        groupsList.appendChild(groupElement);
    });
}

function createGroupElement(group) {
    const groupCard = document.createElement('div');
    groupCard.className = 'group-card';
    groupCard.setAttribute('data-group-id', group.group_id);
    
    groupCard.innerHTML = `
        <div class="group-header">
            <h3>${group.group_name}</h3>
            <div class="group-code">
                <span class="code-label">Code:</span>
                <span class="code-value">${group.join_code}</span>
            </div>
        </div>
        <p class="group-description">${group.group_description || 'No description'}</p>
        <div class="group-meta">
            <span class="member-count">${group.member_count} member${group.member_count !== 1 ? 's' : ''}</span>
            <div class="group-actions">
                <button class="btn btn-outline" onclick="viewGroupDetails(${group.group_id})">View Details</button>
                <button class="btn btn-outline" onclick="shareGroupCode('${group.join_code}', '${group.group_name}', event)">Share Code</button>
            </div>
        </div>
    `;
    
    return groupCard;
}

function displayGroupsError() {
    const groupsList = document.getElementById('groups-list');
    const emptyState = document.getElementById('empty-state');
    
    if (groupsList) {
        groupsList.innerHTML = `
            <div class="error-state">
                <p>Error loading groups. Please try again later.</p>
                <button class="btn" onclick="loadGroupsData()">Retry</button>
            </div>
        `;
    }
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

function setupFormHandlers() {
    // Create group form
    const createGroupForm = document.getElementById('createGroupForm');
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleCreateGroup();
        });
    }
    
    // Join group form
    const joinGroupForm = document.getElementById('joinGroupForm');
    if (joinGroupForm) {
        joinGroupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleJoinGroup();
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

async function handleCreateGroup() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Please log in to create groups');
        return;
    }
    
    const groupData = {
        group_name: document.getElementById('groupName').value.trim(),
        group_description: document.getElementById('groupDescription').value.trim()
    };
    
    // Validate required fields
    if (!groupData.group_name) {
        alert('Please enter a group name');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/groups', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(groupData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal('createGroupModal');
            // Reload groups data
            loadGroupsData();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Failed to create group:', error);
        alert('Failed to create group. Please try again.');
    }
}

async function handleJoinGroup() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Please log in to join groups');
        return;
    }
    
    const joinCode = document.getElementById('joinCode').value.trim().toUpperCase();
    
    // Validate join code
    if (!joinCode || joinCode.length !== 4) {
        alert('Please enter a valid 4-character join code');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/groups/join', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ join_code: joinCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal('joinGroupModal');
            alert(`Successfully joined "${data.group_name}"!`);
            // Reload groups data
            loadGroupsData();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Failed to join group:', error);
        alert('Failed to join group. Please try again.');
    }
}

// Modal functions
function openCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Clear form
        document.getElementById('createGroupForm').reset();
    }
}

function openJoinGroupModal() {
    const modal = document.getElementById('joinGroupModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Clear form
        document.getElementById('joinGroupForm').reset();
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

// Utility functions
function copyJoinCode(joinCode) {
    navigator.clipboard.writeText(joinCode).then(() => {
        // Show temporary feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✓';
        button.style.color = 'green';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.color = '';
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy join code:', err);
        alert('Failed to copy join code. Please copy manually: ' + joinCode);
    });
}

function shareGroupCode(joinCode, groupName, event) {
    const shareText = `Join my group "${groupName}" on Centsible! Use code: ${joinCode}`;
    const button = event ? event.target : null;
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareText).then(() => {
            // Show success checkmark
            showCopySuccess(button);
        }).catch(err => {
            console.error('Failed to copy share text:', err);
            alert(shareText);
        });
    };
    
    if (navigator.share) {
        navigator.share({
            title: 'Join my group on Centsible',
            text: shareText
        }).then(() => {
            showCopySuccess(button);
        }).catch(() => {
            copyToClipboard();
        });
    } else {
        copyToClipboard();
    }
}

function showCopySuccess(button) {
    if (!button) return;
    
    const originalText = button.textContent;
    button.textContent = '✓ Copied';
    button.style.background = '#00aa00';
    button.style.color = '#fff';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
        button.style.color = '';
    }, 500);
}

function viewGroupDetails(groupId) {
    // Get the group name from the DOM
    const groupCard = document.querySelector(`[data-group-id="${groupId}"]`);
    let groupName = 'Group Details';
    
    if (groupCard) {
        const nameElement = groupCard.querySelector('.group-header h3');
        if (nameElement) {
            groupName = nameElement.textContent;
        }
    }
    
    // Navigate to group details page with the group ID and name
    window.location.href = `group-details.html?id=${groupId}&name=${encodeURIComponent(groupName)}`;
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
window.openCreateGroupModal = openCreateGroupModal;
window.openJoinGroupModal = openJoinGroupModal;
window.closeModal = closeModal;
window.copyJoinCode = copyJoinCode;
window.shareGroupCode = shareGroupCode;
window.viewGroupDetails = viewGroupDetails;
