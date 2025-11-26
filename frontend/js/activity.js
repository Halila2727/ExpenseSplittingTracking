// Activity page functionality
let cachedActivities = [];

document.addEventListener('DOMContentLoaded', function() {
    
    // Check if user is authenticated
    checkAuthentication();
    
    // Add logout functionality
    addLogoutButton();

    // Wire export button
    setupExportButton();
    
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
        
        // Load activity data
        loadActivityData();
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        // On network error, allow user to stay but show warning
        console.warn('Could not verify authentication, proceeding with cached data');
        const userData = JSON.parse(user);
        displayUserInfo(userData);
        // Try to load activity data even if auth check failed
        loadActivityData();
    }
}

function displayUserInfo(user) {
    // Update any user-specific elements on the activity page
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

async function loadActivityData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('No authentication token available');
        displayActivityError();
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/activity', {
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
        
        const activityData = await response.json();
        displayActivityData(activityData);
        
    } catch (error) {
        console.error('Failed to load activity data:', error);
        displayActivityError();
    }
}

function displayActivityData(activityData) {
    const activityList = document.getElementById('activity-list');
    const emptyState = document.getElementById('empty-state');
    cachedActivities = Array.isArray(activityData.activities) ? activityData.activities : [];
    
    if (!activityList) {
        console.error('Activity list element not found');
        return;
    }
    
    
    if (activityData.activities.length === 0) {
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
    
    // Render activities
    activityData.activities.forEach((activity) => {
        const activityElement = createActivityElement(activity);
        activityList.appendChild(activityElement);
    });
}

function getCategoryImagePath(category) {
    // Map category values to image file names
    const categoryMap = {
        'food': 'foodCategory.png',
        'transport': 'transportationCategory.png',
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
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.setAttribute('data-type', activity.type);
    activityItem.setAttribute('tabindex', '0');
    
    // Header wrapper to keep current layout intact
    const header = document.createElement('div');
    header.className = 'activity-header';
    
    // Create icon - use category image for expenses with category, payment.png for payments, $ for expenses without category
    const icon = document.createElement('div');
    icon.className = `activity-icon ${activity.type}`;
    
    if (activity.type === 'expense' && activity.category && activity.category.trim() !== '') {
        // Create image element for expense category
        const img = document.createElement('img');
        img.src = getCategoryImagePath(activity.category);
        img.alt = activity.category || 'expense';
        img.style.width = '80%';
        img.style.height = '80%';
        img.style.objectFit = 'contain';
        // Make icon container square instead of circle for images
        icon.style.borderRadius = '4px';
        icon.appendChild(img);
    } else if (activity.type === 'payment') {
        // Use payment.png image for payments
        const img = document.createElement('img');
        img.src = 'images/payment.png';
        img.alt = 'payment';
        img.style.width = '80%';
        img.style.height = '80%';
        img.style.objectFit = 'contain';
        // Make icon container square instead of circle for images
        icon.style.borderRadius = '4px';
        icon.appendChild(img);
    } else {
        // Use $ sign for expenses without category
        icon.textContent = '$';
    }
    
    // Create content
    const content = document.createElement('div');
    content.className = 'activity-content';
    
    // Description
    const description = document.createElement('div');
    description.className = 'activity-description';
    
    if (activity.type === 'expense') {
        description.textContent = `${activity.paid_by} paid for ${activity.description} in "${activity.group_name}"`;
    } else {
        description.textContent = `${activity.paid_by} paid ${activity.paid_to}`;
    }
    
    // Meta information
    const meta = document.createElement('div');
    meta.className = 'activity-meta';
    
    if (activity.type === 'expense') {
        meta.innerHTML = `
            <span>in "${activity.group_name}"</span>
        `;
    } else {
        meta.innerHTML = `
            <span>in "${activity.group_name || 'General'}"</span>
        `;
    }
    
    content.appendChild(description);
    content.appendChild(meta);
    
    // Status and amount
    const rightSection = document.createElement('div');
    rightSection.className = 'activity-right';
    
    // Status
    const status = document.createElement('div');
    status.className = 'activity-status';
    
    if (activity.type === 'expense') {
        if (activity.is_my_expense) {
            status.textContent = 'you paid';
        } else if (activity.is_involved) {
            status.textContent = 'they paid';
        } else {
            status.textContent = 'not involved';
        }
    } else {
        if (activity.is_my_payment) {
            status.textContent = 'you paid';
        } else if (activity.is_paid_to_me) {
            status.textContent = 'you were paid';
        } else {
            status.textContent = 'not involved';
        }
    }
    
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
            amount.classList.add('positive'); // Not directly involved
        }
    }
    
    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'activity-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle activity details');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.innerHTML = `
        <span class="chevron"></span>
    `;
    
    rightSection.appendChild(status);
    rightSection.appendChild(amount);
    rightSection.appendChild(toggleButton);
    
    header.appendChild(icon);
    header.appendChild(content);
    header.appendChild(rightSection);
    
    const details = createActivityDetails(activity);
    
    activityItem.appendChild(header);
    activityItem.appendChild(details);
    
    // Event handlers
    toggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleActivityDetails(activityItem);
    });
    
    activityItem.addEventListener('click', (event) => {
        if (event.target.closest('.activity-details')) {
            return;
        }
        toggleActivityDetails(activityItem);
    });
    
    activityItem.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleActivityDetails(activityItem);
        }
    });
    
    return activityItem;
}

function createActivityDetails(activity) {
    const details = document.createElement('div');
    details.className = 'activity-details';
    details.setAttribute('aria-hidden', 'true');
    
    const paidByRow = document.createElement('div');
    paidByRow.className = 'activity-detail-row';
    paidByRow.innerHTML = `
        <span class="label">Paid by</span>
        <span class = "payer-name">${activity.paid_by || 'Unknown'}</span>
    `;
    
    const totalRow = document.createElement('div');
    totalRow.className = 'activity-detail-row';
    totalRow.innerHTML = `
        <span class="label">Total</span>
        <span class = "total-transaction-bal">${formatCurrency(activity.amount)}</span>
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
    
    const memoBox = document.createElement('div');
    memoBox.className = 'activity-memo-box';
    const memoText = (activity.memo && activity.memo.trim()) || null;
    memoBox.textContent = memoText || 'No memo provided.';
    
    splitSection.appendChild(splitHeader);
    splitSection.appendChild(splitList);
    
    details.appendChild(paidByRow);
    details.appendChild(totalRow);
    details.appendChild(splitSection);
    if (activity.type === 'expense') {
        details.appendChild(createAttachmentSection(activity.attachments));
    }
    details.appendChild(memoBox);
    
    return details;
}

function toggleActivityDetails(activityItem) {
    const isExpanded = activityItem.classList.toggle('expanded');
    const details = activityItem.querySelector('.activity-details');
    const toggleButton = activityItem.querySelector('.activity-toggle');
    
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

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
        return 'Just now';
    } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
        return 'Yesterday';
    } else if (diffInHours < 168) { // 7 days
        return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function displayActivityError() {
    console.warn('Using error state due to API error');
    const activityList = document.getElementById('activity-list');
    const emptyState = document.getElementById('empty-state');
    
    if (activityList) {
        activityList.innerHTML = `
            <div class="loading-state">
                <p>Error loading activity. Please try again later.</p>
            </div>
        `;
    }
}

function createAttachmentSection(attachments) {
    const section = document.createElement('div');
    section.className = 'activity-attachments';
    
    const title = document.createElement('div');
    title.className = 'activity-attachments-title';
    title.textContent = 'Attachments';
    section.appendChild(title);
    
    if (!attachments || !attachments.length) {
        const empty = document.createElement('div');
        empty.className = 'activity-attachment-empty';
        empty.textContent = 'No attachments provided.';
        section.appendChild(empty);
        return section;
    }
    
    const list = document.createElement('div');
    list.className = 'activity-attachment-list';
    attachments.forEach(attachment => {
        list.appendChild(createAttachmentItem(attachment));
    });
    section.appendChild(list);
    return section;
}

function createAttachmentItem(attachment) {
    const link = document.createElement('a');
    link.className = 'activity-attachment-item';
    link.href = attachment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    const preview = document.createElement('div');
    preview.className = 'activity-attachment-preview';
    if (attachment.mime_type && attachment.mime_type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = attachment.url;
        img.alt = attachment.file_name || 'Attachment preview';
        preview.appendChild(img);
    } else {
        preview.textContent = attachment.mime_type === 'application/pdf' ? '📄' : '📎';
    }
    
    const meta = document.createElement('div');
    meta.className = 'activity-attachment-meta';
    
    const nameEl = document.createElement('span');
    nameEl.className = 'attachment-name';
    nameEl.textContent = attachment.file_name || 'Attachment';
    
    const typeEl = document.createElement('span');
    typeEl.textContent = attachment.is_receipt ? 'Receipt' : 'Image';
    
    meta.appendChild(nameEl);
    meta.appendChild(typeEl);
    
    if (attachment.is_receipt && typeof attachment.ocr_total === 'number') {
        const ocrEl = document.createElement('span');
        ocrEl.className = 'attachment-ocr';
        ocrEl.textContent = `Detected: $${attachment.ocr_total.toFixed(2)}`;
        meta.appendChild(ocrEl);
    }
    
    link.appendChild(preview);
    link.appendChild(meta);
    return link;
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

function setupExportButton() {
    const exportButton = document.getElementById('export-activity-btn');
    if (!exportButton) {
        return;
    }
    
    exportButton.addEventListener('click', async () => {
        if (!cachedActivities.length) {
            alert('There are no activities to export yet.');
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
            await exportActivitiesToPDF();
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Failed to export the activity report. Please try again.');
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = 'Export to PDF';
        }
    });
}

async function exportActivitiesToPDF() {
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
    doc.text('Recent Activity Report', margin, y);
    y += 24;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 20;
    
    cachedActivities.forEach((activity, index) => {
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
            `Group: ${activity.group_name || 'General'}`,
            `Date: ${formatPDFDate(activity.date)}`
        ];
        
        if (activity.type === 'expense') {
            if (activity.is_my_expense) {
                detailLines.push('Status: You paid');
            } else if (activity.is_involved) {
                detailLines.push('Status: You are involved');
            } else {
                detailLines.push('Status: Not involved');
            }
        } else if (activity.type === 'payment') {
            if (activity.is_my_payment) {
                detailLines.push('Status: You paid');
            } else if (activity.is_paid_to_me) {
                detailLines.push('Status: You were paid');
            } else {
                detailLines.push('Status: Not involved');
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
    
    doc.save(`centsible-activity-${Date.now()}.pdf`);
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
