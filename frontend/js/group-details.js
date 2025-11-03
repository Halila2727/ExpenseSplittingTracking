// Group details page functionality
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    loadGroupDetails();
});

let currentGroupId = null;
let currentGroupName = null;

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
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        window.location.href = 'login.html';
    }
}

async function loadGroupDetails() {
    // Get group_id from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    const groupName = urlParams.get('name');
    
    if (!groupId) {
        console.error('No group ID provided');
        window.location.href = 'groups.html';
        return;
    }
    
    currentGroupId = parseInt(groupId);
    currentGroupName = groupName || 'Group';
    
    // Update page title
    const titleElement = document.getElementById('group-name');
    if (titleElement) {
        titleElement.textContent = currentGroupName;
    }
    
    // Load balances and activity
    await loadBalances();
    await loadActivity();
}

async function loadBalances() {
    const token = localStorage.getItem('token');
    const balancesList = document.getElementById('balances-list');
    const noBalances = document.getElementById('no-balances');
    
    if (!token || !currentGroupId) {
        console.error('Missing authentication or group ID');
        displayBalancesError();
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/balances`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            console.error('Failed to load balances');
            displayBalancesError();
            return;
        }
        
        const data = await response.json();
        
        if (data.members && data.members.length > 0) {
            displayBalances(data.members);
        } else {
            // Show empty state
            if (balancesList) {
                balancesList.style.display = 'none';
            }
            if (noBalances) {
                noBalances.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Failed to load balances:', error);
        displayBalancesError();
    }
}

function displayBalances(members) {
    const balancesList = document.getElementById('balances-list');
    const noBalances = document.getElementById('no-balances');
    
    if (!balancesList) return;
    
    balancesList.innerHTML = '';
    balancesList.style.display = 'block';
    if (noBalances) {
        noBalances.style.display = 'none';
    }
    
    members.forEach(member => {
        const memberElement = createMemberBalanceElement(member);
        balancesList.appendChild(memberElement);
    });
    
    // Add hover tooltips for breakdowns
    addTooltipHandlers();
}

function createMemberBalanceElement(member) {
    const element = document.createElement('div');
    element.className = 'member-balance-item';
    
    // Build breakdown tooltip for "owes"
    let owesTooltip = '';
    if (member.owes_breakdown && member.owes_breakdown.length > 0) {
        owesTooltip = member.owes_breakdown.map(item => 
            `${item.to}: $${item.amount.toFixed(2)}`
        ).join('<br>');
    } else {
        owesTooltip = 'No outstanding debts';
    }
    
    // Build breakdown tooltip for "is owed"
    let isOwedTooltip = '';
    if (member.is_owed_breakdown && member.is_owed_breakdown.length > 0) {
        isOwedTooltip = member.is_owed_breakdown.map(item => 
            `${item.from}: $${item.amount.toFixed(2)}`
        ).join('<br>');
    } else {
        isOwedTooltip = 'No pending payments';
    }
    
    element.innerHTML = `
        <div class="member-balance-content">
            <div class="member-name">${member.member_name}</div>
            <div class="member-balance-divider"></div>
            <div class="member-balance-values">
                <div class="balance-value-section">
                    <span class="balance-label">owes</span>
                    <span class="balance-amount owes-amount" data-breakdown="${escapeHtml(owesTooltip)}">$${member.owes.toFixed(2)}</span>
                </div>
                <div class="balance-value-section">
                    <span class="balance-label">is owed</span>
                    <span class="balance-amount owed-amount" data-breakdown="${escapeHtml(isOwedTooltip)}">$${member.is_owed.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
    
    return element;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayBalancesError() {
    const balancesList = document.getElementById('balances-list');
    if (balancesList) {
        balancesList.innerHTML = `
            <div class="empty-state-small">
                <p>Error loading balances. Please try again.</p>
            </div>
        `;
    }
}

async function loadActivity() {
    const token = localStorage.getItem('token');
    const activityList = document.getElementById('activity-list');
    const noActivity = document.getElementById('no-activity');
    
    if (!token || !currentGroupId) {
        console.error('Missing authentication or group ID');
        displayActivityError();
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/groups/${currentGroupId}/activity`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            console.error('Failed to load activity');
            displayActivityError();
            return;
        }
        
        const data = await response.json();
        
        if (data.activities && data.activities.length > 0) {
            displayActivity(data.activities);
        } else {
            // Show empty state
            if (activityList) {
                activityList.style.display = 'none';
            }
            if (noActivity) {
                noActivity.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Failed to load activity:', error);
        displayActivityError();
    }
}

function displayActivity(activities) {
    const activityList = document.getElementById('activity-list');
    const noActivity = document.getElementById('no-activity');
    
    if (!activityList) return;
    
    activityList.innerHTML = '';
    activityList.style.display = 'block';
    if (noActivity) {
        noActivity.style.display = 'none';
    }
    
    activities.forEach(activity => {
        const activityElement = createActivityElement(activity);
        activityList.appendChild(activityElement);
    });
}

function createActivityElement(activity) {
    const element = document.createElement('div');
    element.className = 'activity-item';
    
    const date = new Date(activity.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
    
    let description, meta;
    if (activity.type === 'expense') {
        description = activity.description;
        meta = `Paid by ${activity.paid_by} • ${formattedDate}`;
    } else {
        description = `Payment from ${activity.paid_by} to ${activity.paid_to}`;
        meta = `${formattedDate}`;
    }
    
    element.innerHTML = `
        <div class="activity-icon ${activity.type}">${activity.type === 'expense' ? '💰' : '💵'}</div>
        <div class="activity-content">
            <div class="activity-description">${description}</div>
            <div class="activity-meta">${meta}</div>
        </div>
        <div class="activity-amount">$${activity.amount.toFixed(2)}</div>
    `;
    
    return element;
}

function displayActivityError() {
    const activityList = document.getElementById('activity-list');
    if (activityList) {
        activityList.innerHTML = `
            <div class="empty-state-small">
                <p>Error loading activity. Please try again.</p>
            </div>
        `;
    }
}

function goBack() {
    window.location.href = 'groups.html';
}

function addTooltipHandlers() {
    const amountElements = document.querySelectorAll('.balance-amount');
    
    amountElements.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const breakdown = e.target.getAttribute('data-breakdown');
            if (breakdown) {
                showTooltip(e.target, breakdown);
            }
        });
        
        element.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

let tooltip = null;

function showTooltip(target, content) {
    // Remove existing tooltip if any
    if (tooltip) {
        tooltip.remove();
    }
    
    // Create tooltip element
    tooltip = document.createElement('div');
    tooltip.className = 'balance-tooltip';
    tooltip.innerHTML = content;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip after it's rendered
    const rect = target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.zIndex = '10000';
    
    // Adjust if tooltip goes off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.left < 10) {
        tooltip.style.left = '10px';
        tooltip.style.transform = 'none';
    }
    if (tooltipRect.right > window.innerWidth - 10) {
        tooltip.style.left = 'auto';
        tooltip.style.right = '10px';
        tooltip.style.transform = 'none';
    }
}

function hideTooltip() {
    if (tooltip) {
        tooltip.remove();
        tooltip = null;
    }
}

// Make functions globally available
window.goBack = goBack;
