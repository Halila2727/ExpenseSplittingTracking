// Group details page functionality
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    loadGroupDetails();
    setupGroupExportButton();
});

let currentGroupId = null;
let currentGroupName = null;
let currentGroupActivities = [];

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
    currentGroupActivities = Array.isArray(activities) ? activities : [];
    
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

function getCategoryImagePath(category) {
    // Map category values to image file names
    const categoryMap = {
        'food': 'foodCategory.png',
        'transport': 'transportationCategory.png',
        'transportation': 'transportationCategory.png',
        'entertainment': 'entertainmentCategory.png',
        'utilities': 'utilitiesCategory.png',
        'shopping': 'shoppingCategory.png',
        'travel': 'travelCategory.png',
        'other': 'customCategory.png'
    };
    
    // Default to customCategory if category is empty or not found
    const imageName = categoryMap[category] || 'customCategory.png';
    return `images/${imageName}`;
}

function createActivityElement(activity) {
    const element = document.createElement('div');
    element.className = 'activity-item';
    element.setAttribute('data-type', activity.type);
    element.setAttribute('tabindex', '0');
    
    const header = document.createElement('div');
    header.className = 'activity-header';
    
    const date = activity.date ? new Date(activity.date) : null;
    const formattedDate = date ? date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    }) : '';
    
    let description, meta;
    if (activity.type === 'expense') {
        description = activity.description;
        meta = `Paid by ${activity.paid_by || 'Unknown'}${formattedDate ? ` • ${formattedDate}` : ''}`;
    } else {
        description = `Payment from ${activity.paid_by || 'Unknown'} to ${activity.paid_to || 'Unknown'}`;
        meta = formattedDate;
    }
    
    // Create icon element
    const icon = document.createElement('div');
    icon.className = `activity-icon ${activity.type}`;
    
    if (activity.type === 'expense' && activity.category && activity.category.trim() !== '') {
        // Create image element for expense category
        const img = document.createElement('img');
        const imagePath = getCategoryImagePath(activity.category);
        img.src = imagePath;
        img.alt = activity.category || 'expense';
        img.onerror = function() {
            // Fallback to $ if image fails to load
            icon.innerHTML = '';
            icon.textContent = '$';
        };
        icon.appendChild(img);
    } else if (activity.type === 'payment') {
        // Use payment.png image for payments
        const img = document.createElement('img');
        img.src = 'images/payment.png';
        img.alt = 'payment';
        img.onerror = function() {
            // Fallback to emoji if image fails to load
            icon.innerHTML = '';
            icon.textContent = '💵';
        };
        icon.appendChild(img);
    } else {
        // Use $ sign for expenses without category
        icon.textContent = '$';
    }
    
    // Create content
    const content = document.createElement('div');
    content.className = 'activity-content';
    content.innerHTML = `
        <div class="activity-description">${description}</div>
        <div class="activity-meta">${meta}</div>
    `;
    
    // Create right section
    const rightSection = document.createElement('div');
    rightSection.className = 'activity-right';
    
    const amount = document.createElement('div');
    amount.className = 'activity-amount';
    amount.textContent = `$${activity.amount.toFixed(2)}`;
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'activity-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle activity details');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.innerHTML = `
        <span class="chevron"></span>
    `;
    
    rightSection.appendChild(amount);
    rightSection.appendChild(toggleButton);
    
    header.appendChild(icon);
    header.appendChild(content);
    header.appendChild(rightSection);
    
    const details = createGroupActivityDetails(activity);
    
    element.appendChild(header);
    element.appendChild(details);
    
    toggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleGroupActivityDetails(element);
    });
    
    element.addEventListener('click', (event) => {
        if (event.target.closest('.activity-details')) {
            return;
        }
        toggleGroupActivityDetails(element);
    });
    
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleGroupActivityDetails(element);
        }
    });
    
    return element;
}

function createGroupActivityDetails(activity) {
    const details = document.createElement('div');
    details.className = 'activity-details';
    details.setAttribute('aria-hidden', 'true');
    
    const paidByRow = document.createElement('div');
    paidByRow.className = 'activity-detail-row';
    paidByRow.innerHTML = `
        <span class="label">Paid by</span>
        <span>${activity.paid_by || 'Unknown'}</span>
    `;
    
    const groupRow = document.createElement('div');
    groupRow.className = 'activity-detail-row';
    groupRow.innerHTML = `
        <span class="label">Group</span>
        <span>${activity.group_name || currentGroupName || 'Group'}</span>
    `;
    
    const splitSection = document.createElement('div');
    splitSection.className = 'activity-split-section';
    
    const splitHeader = document.createElement('div');
    splitHeader.className = 'activity-detail-label';
    splitHeader.textContent = 'Split details';
    
    const splitList = document.createElement('div');
    splitList.className = 'activity-split-list';
    
    const splits = Array.isArray(activity.splits) ? activity.splits : [];
    if (splits.length === 0) {
        const emptySplit = document.createElement('div');
        emptySplit.className = 'activity-split-empty';
        emptySplit.textContent = 'Split details unavailable.';
        splitList.appendChild(emptySplit);
    } else {
        splits.forEach((split) => {
            const splitItem = document.createElement('div');
            splitItem.className = 'activity-split-item';
            const participantName = split.name || split.member_name || split.participant || 'Participant';
            const amountValue = typeof split.amount === 'number' ? split.amount : parseFloat(split.amount);
            const formattedAmount = Number.isFinite(amountValue) ? formatCurrency(amountValue) : '—';
            const statusText = split.status || split.role || '';
            
            splitItem.innerHTML = `
                <span class="participant">${participantName}</span>
                <span class="amount">${formattedAmount}</span>
                <span class="status">${statusText}</span>
            `;
            splitList.appendChild(splitItem);
        });
    }
    
    const attachmentPlaceholder = document.createElement('div');
    attachmentPlaceholder.className = 'activity-attachment-placeholder';
    attachmentPlaceholder.textContent = 'Attachment feature coming soon.';
    
    const memoBox = document.createElement('div');
    memoBox.className = 'activity-memo-box';
    const memoText = (activity.memo && activity.memo.trim()) || null;
    memoBox.textContent = memoText || 'No memo provided.';
    
    splitSection.appendChild(splitHeader);
    splitSection.appendChild(splitList);
    
    details.appendChild(paidByRow);
    details.appendChild(groupRow);
    details.appendChild(splitSection);
    details.appendChild(attachmentPlaceholder);
    details.appendChild(memoBox);
    
    return details;
}

function toggleGroupActivityDetails(element) {
    const isExpanded = element.classList.toggle('expanded');
    const details = element.querySelector('.activity-details');
    const toggleButton = element.querySelector('.activity-toggle');
    
    if (details) {
        details.setAttribute('aria-hidden', String(!isExpanded));
    }
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', String(isExpanded));
    }
}

function formatCurrency(value) {
    if (typeof value !== 'number') {
        const parsed = parseFloat(value);
        if (Number.isNaN(parsed)) {
            return '$—';
        }
        return `$${parsed.toFixed(2)}`;
    }
    return `$${value.toFixed(2)}`;
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

function setupGroupExportButton() {
    const exportButton = document.getElementById('export-group-activity-btn');
    if (!exportButton) {
        return;
    }
    
    exportButton.addEventListener('click', async () => {
        if (!currentGroupActivities.length) {
            alert('No group activity to export yet.');
            return;
        }
        
        const jsPdfReady = await ensureJsPdfLoaded();
        if (!jsPdfReady) {
            alert('PDF export library failed to load. Please try again.');
            return;
        }
        
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';
        
        try {
            await exportGroupActivitiesToPDF();
        } catch (error) {
            console.error('Failed to export group activity PDF:', error);
            alert('Failed to export the report. Please try again.');
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = 'Export to PDF';
        }
    });
}

async function exportGroupActivitiesToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;
    
    const addWrappedText = (text, x, lineHeight = 14, fontSize = 11) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach(line => {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(line, x, y);
            y += lineHeight;
        });
    };
    
    doc.setFontSize(18);
    doc.text('Group Activity Report', margin, y);
    y += 24;
    doc.setFontSize(12);
    doc.text(`Group: ${currentGroupName || 'Group'}`, margin, y);
    y += 16;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 20;
    
    currentGroupActivities.forEach((activity, index) => {
        if (y > pageHeight - margin - 80) {
            doc.addPage();
            y = margin;
        }
        
        doc.setFontSize(14);
        doc.text(`${index + 1}. ${activity.description || 'Activity'}`, margin, y);
        y += 18;
        
        doc.setFontSize(11);
        const detailLines = [
            `Type: ${activity.type}`,
            `Amount: ${formatCurrency(activity.amount)}`,
            `Paid by: ${activity.paid_by || 'N/A'}`,
            `Date: ${formatPDFDate(activity.date)}`
        ];
        
        if (activity.type === 'payment' && activity.paid_to) {
            detailLines.push(`Paid to: ${activity.paid_to}`);
        }
        
        if (activity.type === 'expense') {
            detailLines.push(activity.is_my_expense ? 'Status: You paid' : 'Status: Expense in group');
        } else if (activity.type === 'payment') {
            if (activity.is_my_payment) {
                detailLines.push('Status: You paid');
            } else if (activity.is_paid_to_me) {
                detailLines.push('Status: You were paid');
            } else {
                detailLines.push('Status: Payment in group');
            }
        }
        
        detailLines.forEach(line => {
            addWrappedText(line, margin);
        });
        
        if (activity.splits && activity.splits.length) {
            addWrappedText('Split details:', margin, 14, 12);
            activity.splits.forEach(split => {
                const descriptor = split.status ? ` (${split.status})` : '';
                addWrappedText(
                    `- ${split.name || 'Participant'}: ${formatCurrency(split.amount)}${descriptor}`,
                    margin + 14
                );
            });
        } else {
            addWrappedText('Split details: Not available', margin);
        }
        
        const memoText = activity.memo && activity.memo.trim()
            ? `Memo: ${activity.memo.trim()}`
            : 'Memo: None';
        addWrappedText(memoText, margin);
        
        y += 12;
    });
    
    doc.save(`group-${currentGroupName || 'activity'}-${Date.now()}.pdf`);
}

function formatPDFDate(value) {
    if (!value) {
        return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
}

let jspdfLoaderPromise = null;

function ensureJsPdfLoaded() {
    if (window.jspdf && window.jspdf.jsPDF) {
        return Promise.resolve(true);
    }
    
    if (jspdfLoaderPromise) {
        return jspdfLoaderPromise;
    }
    
    jspdfLoaderPromise = new Promise((resolve) => {
        const existingScript = document.querySelector('script[data-lib="jspdf"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(Boolean(window.jspdf && window.jspdf.jsPDF)));
            existingScript.addEventListener('error', () => resolve(false));
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.async = true;
        script.defer = true;
        script.dataset.lib = 'jspdf';
        
        script.onload = () => {
            resolve(Boolean(window.jspdf && window.jspdf.jsPDF));
        };
        
        script.onerror = () => {
            console.error('Failed to load jsPDF script');
            resolve(false);
        };
        
        document.head.appendChild(script);
    });
    
    return jspdfLoaderPromise;
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
