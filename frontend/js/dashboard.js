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

// Modal functionality
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        const dateInputs = modal.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            if (!input.value) {
                input.value = today;
            }
        });
        
        // Populate participants and groups (placeholder data for now)
        populateModalData(modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

function populateModalData(modalId) {
    // This would normally fetch data from the backend
    // For now, using placeholder data
    
    if (modalId === 'addExpenseModal') {
        // Populate participants
        const participantsContainer = document.querySelector('#addExpenseModal .participants-container');
        if (participantsContainer) {
            const participants = ['Alice', 'Bob', 'Charlie', 'Diana'];
            participants.forEach((name, index) => {
                const participantItem = document.createElement('div');
                participantItem.className = 'participant-item';
                participantItem.innerHTML = `
                    <input type="checkbox" id="participant-${index}" value="${name}">
                    <label for="participant-${index}">${name}</label>
                `;
                participantsContainer.appendChild(participantItem);
            });
        }
        
        // Add split method change handler
        const splitMethod = document.getElementById('expenseSplitMethod');
        if (splitMethod) {
            splitMethod.addEventListener('change', handleSplitMethodChange);
        }
    } else if (modalId === 'settleExpenseModal') {
        // Populate payer/payee options
        const members = ['Me', 'Alice', 'Bob', 'Charlie', 'Diana'];
        
        const payerSelect = document.getElementById('settlePayer');
        const payeeSelect = document.getElementById('settlePayee');
        
        if (payerSelect) {
            payerSelect.innerHTML = '<option value="">Select payer</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.toLowerCase();
                option.textContent = member;
                payerSelect.appendChild(option);
            });
        }
        
        if (payeeSelect) {
            payeeSelect.innerHTML = '<option value="">Select payee</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.toLowerCase();
                option.textContent = member;
                payeeSelect.appendChild(option);
            });
        }
    }
}

function handleSplitMethodChange() {
    const splitMethod = document.getElementById('expenseSplitMethod');
    const splitDetails = document.getElementById('splitDetails');
    const participants = document.querySelectorAll('#addExpenseModal .participant-item input[type="checkbox"]:checked');
    
    if (!splitMethod || !splitDetails) return;
    
    // Clear previous content
    splitDetails.innerHTML = '';
    splitDetails.style.display = 'none';
    
    if (splitMethod.value === 'equal') {
        // Equal split - no additional details needed
        return;
    }
    
    splitDetails.style.display = 'block';
    splitDetails.innerHTML = '<h4>Split Details</h4>';
    
    participants.forEach((checkbox, index) => {
        const label = checkbox.nextElementSibling.textContent;
        const splitItem = document.createElement('div');
        splitItem.className = 'split-item';
        
        if (splitMethod.value === 'shares') {
            splitItem.innerHTML = `
                <label>${label}</label>
                <input type="number" min="1" value="1" placeholder="Shares">
            `;
        } else if (splitMethod.value === 'percentage') {
            splitItem.innerHTML = `
                <label>${label}</label>
                <input type="number" min="0" max="100" step="0.01" placeholder="%" class="percentage-input">
            `;
        } else if (splitMethod.value === 'exact') {
            splitItem.innerHTML = `
                <label>${label}</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" class="exact-amount-input">
            `;
        }
        
        splitDetails.appendChild(splitItem);
    });
    
    // Add validation for percentage inputs
    if (splitMethod.value === 'percentage') {
        const percentageInputs = splitDetails.querySelectorAll('.percentage-input');
        percentageInputs.forEach(input => {
            input.addEventListener('input', validatePercentages);
        });
    }
}

function validatePercentages() {
    const percentageInputs = document.querySelectorAll('.percentage-input');
    const total = Array.from(percentageInputs).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    
    if (total > 100) {
        // Show warning or adjust values
        console.warn('Total percentage exceeds 100%');
    }
}

// Add expense functionality
function addExpense() {
    openModal('addExpenseModal');
}

function settleExpense() {
    openModal('settleExpenseModal');
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add expense form submission
    const addExpenseForm = document.getElementById('addExpenseForm');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddExpense();
        });
    }
    
    // Settle expense form submission
    const settleExpenseForm = document.getElementById('settleExpenseForm');
    if (settleExpenseForm) {
        settleExpenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSettleExpense();
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
});

function handleAddExpense() {
    const formData = new FormData(document.getElementById('addExpenseForm'));
    const expenseData = {
        amount: parseFloat(formData.get('expenseAmount') || document.getElementById('expenseAmount').value),
        currency: document.getElementById('expenseCurrency').value,
        description: document.getElementById('expenseDescription').value,
        payer: document.getElementById('expensePayer').value,
        date: document.getElementById('expenseDate').value,
        group: document.getElementById('expenseGroup').value,
        category: document.getElementById('expenseCategory').value,
        participants: Array.from(document.querySelectorAll('#addExpenseModal .participant-item input[type="checkbox"]:checked')).map(cb => cb.value),
        splitMethod: document.getElementById('expenseSplitMethod').value,
        note: document.getElementById('expenseNote').value
    };
    
    console.log('Adding expense:', expenseData);
    
    // TODO: Send to backend API
    // For now, just close the modal
    closeModal('addExpenseModal');
    
    // Show success message
    alert('Expense added successfully! (This is a placeholder)');
}

function handleSettleExpense() {
    const formData = new FormData(document.getElementById('settleExpenseForm'));
    const settleData = {
        amount: parseFloat(formData.get('settleAmount') || document.getElementById('settleAmount').value),
        currency: document.getElementById('settleCurrency').value,
        payer: document.getElementById('settlePayer').value,
        payee: document.getElementById('settlePayee').value,
        date: document.getElementById('settleDate').value,
        group: document.getElementById('settleGroup').value,
        note: document.getElementById('settleNote').value
    };
    
    console.log('Recording payment:', settleData);
    
    // TODO: Send to backend API
    // For now, just close the modal
    closeModal('settleExpenseModal');
    
    // Show success message
    alert('Payment recorded successfully! (This is a placeholder)');
}

// Make functions globally available
window.addExpense = addExpense;
window.settleExpense = settleExpense;
window.openModal = openModal;
window.closeModal = closeModal;