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
        
        // Load balance data
        loadBalanceData();
        
        // Load groups data
        loadGroupsData();
        
    } catch (error) {
        console.error('Authentication check failed:', error);
        // On network error, allow user to stay but show warning
        const userData = JSON.parse(user);
        displayUserInfo(userData);
        // Try to load balance data even if auth check failed
        loadBalanceData();
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

async function loadBalanceData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('No authentication token available');
        displayBalanceError();
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/balance', {
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
        
        const balanceData = await response.json();
        displayBalanceData(balanceData);
        
    } catch (error) {
        console.error('Failed to load balance data:', error);
        // Show error message or fallback to placeholder data
        displayBalanceError();
    }
}

function displayBalanceData(balanceData) {
    // Update main balance
    const balanceAmount = document.querySelector('.balance-amount');
    
    if (balanceAmount) {
        const netBalance = balanceData.net_balance;
        
        // Format the balance text
        if (netBalance > 0) {
            balanceAmount.textContent = `+$${netBalance.toFixed(2)}`;
        } else if (netBalance < 0) {
            balanceAmount.textContent = `-$${Math.abs(netBalance).toFixed(2)}`;
        } else {
            balanceAmount.textContent = `$${netBalance.toFixed(2)}`;
        }
        
        // Update CSS class and inline styles to match breakdown card colors
        balanceAmount.className = 'balance-amount';
        balanceAmount.style.color = '';
        balanceAmount.style.fontWeight = '';
        
        if (netBalance < 0) {
            // Red color to match breakdown-card.owe
            balanceAmount.style.color = '#8b0000'; // --error-dark
            balanceAmount.style.fontWeight = '800';
        } else if (netBalance > 0) {
            // Green color to match breakdown-card.owed
            balanceAmount.style.color = '#2d5a2d'; // --success-dark
            balanceAmount.style.fontWeight = '800';
        } else {
            // Gray color for zero balance
            balanceAmount.style.color = '#555555'; // --gray
            balanceAmount.style.fontWeight = '700';
        }
    }
    
    // Update breakdown cards
    const oweAmount = document.querySelector('.breakdown-card.owe .amount');
    if (oweAmount) {
        oweAmount.textContent = `$${balanceData.owed_by_me.toFixed(2)}`;
    }
    
    const owedAmount = document.querySelector('.breakdown-card.owed .amount');
    if (owedAmount) {
        owedAmount.textContent = `$${balanceData.owed_to_me.toFixed(2)}`;
    }
}

function displayBalanceError() {
    // Show error state or keep placeholder data
    // The HTML already has placeholder values, so we don't need to change anything
}

async function loadGroupsData() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('No authentication token available');
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
        populateGroupDropdowns(groupsData.groups);
        
    } catch (error) {
        console.error('Failed to load groups data:', error);
        // Use placeholder data
        populateGroupDropdowns([]);
    }
}

function populateGroupDropdowns(groups) {
    // Populate expense group dropdown
    const expenseGroupSelect = document.getElementById('expenseGroup');
    if (expenseGroupSelect) {
        expenseGroupSelect.innerHTML = '<option value="">Select group</option>';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.group_id;
            option.textContent = group.group_name;
            expenseGroupSelect.appendChild(option);
        });
    }
    
    // Populate settle group dropdown
    const settleGroupSelect = document.getElementById('settleGroup');
    if (settleGroupSelect) {
        settleGroupSelect.innerHTML = '<option value="">Select group</option>';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.group_id;
            option.textContent = group.group_name;
            settleGroupSelect.appendChild(option);
        });
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
        
        // Reset disabled state for settle expense modal
        if (modalId === 'settleExpenseModal') {
            const payerSelect = document.getElementById('settlePayer');
            const payeeSelect = document.getElementById('settlePayee');
            if (payerSelect) {
                payerSelect.disabled = true;
                payerSelect.innerHTML = '<option value="">Select payer</option>';
            }
            if (payeeSelect) {
                payeeSelect.disabled = true;
                payeeSelect.innerHTML = '<option value="">Select payee</option>';
            }
        }
    }
}

function populateModalData(modalId) {
    if (modalId === 'addExpenseModal') {
        // Initialize multi-select dropdown
        initializeMultiSelect();
        
        // Add group selection handler
        const groupSelect = document.getElementById('expenseGroup');
        if (groupSelect) {
            groupSelect.addEventListener('change', handleGroupSelection);
        }
        
        // Add split method change handler
        const splitMethod = document.getElementById('expenseSplitMethod');
        if (splitMethod) {
            splitMethod.addEventListener('change', handleSplitMethodChange);
        }
        
        // Set default date to today
        const dateInput = document.getElementById('expenseDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    } else if (modalId === 'settleExpenseModal') {
        // Add group selection handler (remove old listeners first)
        const groupSelect = document.getElementById('settleGroup');
        if (groupSelect) {
            // Clone to remove existing event listeners
            const newGroupSelect = groupSelect.cloneNode(true);
            groupSelect.parentNode.replaceChild(newGroupSelect, groupSelect);
            // Add the event listener to the new element
            const updatedGroupSelect = document.getElementById('settleGroup');
            updatedGroupSelect.addEventListener('change', handleSettleGroupSelection);
        }
        
        // Reset disabled state of payer/payee dropdowns
        const payerSelect = document.getElementById('settlePayer');
        const payeeSelect = document.getElementById('settlePayee');
        if (payerSelect) {
            payerSelect.disabled = true;
            payerSelect.innerHTML = '<option value="">Select payer</option>';
        }
        if (payeeSelect) {
            payeeSelect.disabled = true;
            payeeSelect.innerHTML = '<option value="">Select payee</option>';
        }
    }
}

// Multi-select dropdown functionality
function initializeMultiSelect() {
    const multiSelect = document.getElementById('expenseParticipants');
    if (!multiSelect) return;
    
    const trigger = multiSelect.querySelector('.multi-select-trigger');
    const options = multiSelect.querySelector('.multi-select-options');
    
    // Toggle dropdown
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        if (multiSelect.classList.contains('disabled')) return;
        
        multiSelect.classList.toggle('open');
        options.style.display = multiSelect.classList.contains('open') ? 'block' : 'none';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        multiSelect.classList.remove('open');
        options.style.display = 'none';
    });
    
    // Prevent dropdown from closing when clicking inside
    options.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

function updateMultiSelect(members, currentUserId) {
    const multiSelect = document.getElementById('expenseParticipants');
    if (!multiSelect) return;
    
    const options = multiSelect.querySelector('.multi-select-options');
    const placeholder = multiSelect.querySelector('.multi-select-placeholder');
    
    // Clear existing options
    options.innerHTML = '';
    
    // Add member options
    members.forEach(member => {
        const option = document.createElement('div');
        option.className = 'multi-select-option';
        
        const isCurrentUser = member.user_id === currentUserId;
        const checkboxId = `participant-${member.user_id}`;
        
        option.innerHTML = `
            <input type="checkbox" id="${checkboxId}" value="${member.user_id}" ${isCurrentUser ? 'checked' : ''}>
            <label for="${checkboxId}">${member.username}</label>
        `;
        
        options.appendChild(option);
        
        // Add change handler to update placeholder and trigger split method change
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function() {
            updateMultiSelectPlaceholder();
            // Trigger split method change to update split details
            handleSplitMethodChange();
        });
    });
    
    // Update placeholder
    updateMultiSelectPlaceholder();
}

function updateMultiSelectPlaceholder() {
    const multiSelect = document.getElementById('expenseParticipants');
    if (!multiSelect) return;
    
    const placeholder = multiSelect.querySelector('.multi-select-placeholder');
    const checkedBoxes = multiSelect.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkedBoxes.length === 0) {
        placeholder.textContent = 'Select participants';
    } else if (checkedBoxes.length === 1) {
        const label = multiSelect.querySelector(`label[for="${checkedBoxes[0].id}"]`);
        placeholder.textContent = label.textContent;
    } else {
        placeholder.textContent = `${checkedBoxes.length} participants selected`;
    }
}

// Settle expense group selection handler
async function handleSettleGroupSelection() {
    const groupSelect = document.getElementById('settleGroup');
    const payerSelect = document.getElementById('settlePayer');
    const payeeSelect = document.getElementById('settlePayee');
    
    const groupId = groupSelect.value;
    
    if (!groupId) {
        // Disable dependent fields
        payerSelect.disabled = true;
        payeeSelect.disabled = true;
        
        // Clear options
        payerSelect.innerHTML = '<option value="">Select payer</option>';
        payeeSelect.innerHTML = '<option value="">Select payee</option>';
        
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/groups/${groupId}/members`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch group members');
        }
        
        const data = await response.json();
        const members = data.members;
        
        // Enable dependent fields
        payerSelect.disabled = false;
        payeeSelect.disabled = false;
        
        // Populate payer dropdown
        payerSelect.innerHTML = '<option value="">Select payer</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.username;
            payerSelect.appendChild(option);
        });
        
        // Populate payee dropdown
        payeeSelect.innerHTML = '<option value="">Select payee</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.username;
            payeeSelect.appendChild(option);
        });
        
        // Set default payer to current user
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const currentUserOption = Array.from(payerSelect.options).find(option => 
            option.value == currentUser.id
        );
        if (currentUserOption) {
            payerSelect.value = currentUserOption.value;
        }
        
    } catch (error) {
        console.error('Failed to load group members:', error);
        alert('Failed to load group members. Please try again.');
    }
}

// Group selection handler
async function handleGroupSelection() {
    const groupSelect = document.getElementById('expenseGroup');
    const payerSelect = document.getElementById('expensePayer');
    const categorySelect = document.getElementById('expenseCategory');
    const multiSelect = document.getElementById('expenseParticipants');
    const splitMethodSelect = document.getElementById('expenseSplitMethod');
    
    const groupId = groupSelect.value;
    
    if (!groupId) {
        // Disable dependent fields
        payerSelect.disabled = true;
        categorySelect.disabled = true;
        multiSelect.classList.add('disabled');
        splitMethodSelect.disabled = true;
        
        // Clear options
        payerSelect.innerHTML = '<option value="">Select payer</option><option value="me">Me</option>';
        multiSelect.querySelector('.multi-select-options').innerHTML = '';
        updateMultiSelectPlaceholder();
        
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/groups/${groupId}/members`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch group members');
        }
        
        const data = await response.json();
        const members = data.members;
        
        // Enable dependent fields
        payerSelect.disabled = false;
        categorySelect.disabled = false;
        multiSelect.classList.remove('disabled');
        splitMethodSelect.disabled = false;
        
        // Populate payer dropdown
        payerSelect.innerHTML = '<option value="">Select payer</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.username;
            payerSelect.appendChild(option);
        });
        
        // Set default payer to current user
        const currentUser = JSON.parse(localStorage.getItem('user'));
        console.log('Current user:', currentUser); // Debug log
        console.log('Available members:', members); // Debug log
        
        const currentUserOption = Array.from(payerSelect.options).find(option => 
            option.textContent === currentUser.username || option.value == currentUser.id
        );
        if (currentUserOption) {
            payerSelect.value = currentUserOption.value;
        }
        
        // Update multi-select with members
        updateMultiSelect(members, currentUser.id);
        
    } catch (error) {
        console.error('Failed to load group members:', error);
        alert('Failed to load group members. Please try again.');
    }
}

function handleSplitMethodChange() {
    const splitMethod = document.getElementById('expenseSplitMethod');
    const splitDetails = document.getElementById('splitDetails');
    const multiSelect = document.getElementById('expenseParticipants');
    
    if (!splitMethod || !splitDetails || !multiSelect) return;
    
    // Get selected participants
    const checkedBoxes = multiSelect.querySelectorAll('input[type="checkbox"]:checked');
    const participants = Array.from(checkedBoxes).map(checkbox => ({
        id: checkbox.value,
        name: checkbox.nextElementSibling.textContent
    }));
    
    // Clear previous content
    splitDetails.innerHTML = '';
    splitDetails.style.display = 'none';
    
    if (splitMethod.value === 'equal') {
        // Equal split - no additional details needed
        return;
    }
    
    if (participants.length === 0) {
        return;
    }
    
    splitDetails.style.display = 'block';
    splitDetails.innerHTML = '<h4>Split Details</h4>';
    
    participants.forEach((participant, index) => {
        const splitItem = document.createElement('div');
        splitItem.className = 'split-item';
        
        if (splitMethod.value === 'percentage') {
            splitItem.innerHTML = `
                <label>${participant.name}</label>
                <input type="number" min="0" max="100" step="0.01" placeholder="%" 
                       class="percentage-input" data-participant-id="${participant.id}">
            `;
        } else if (splitMethod.value === 'exact') {
            splitItem.innerHTML = `
                <label>${participant.name}</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" 
                       class="exact-amount-input" data-participant-id="${participant.id}">
            `;
        }
        
        splitDetails.appendChild(splitItem);
    });
    
    // Add validation
    if (splitMethod.value === 'percentage') {
        const percentageInputs = splitDetails.querySelectorAll('.percentage-input');
        percentageInputs.forEach(input => {
            input.addEventListener('input', validatePercentages);
        });
    } else if (splitMethod.value === 'exact') {
        const exactInputs = splitDetails.querySelectorAll('.exact-amount-input');
        exactInputs.forEach(input => {
            input.addEventListener('input', validateExactAmounts);
        });
    }
}

function validatePercentages() {
    const percentageInputs = document.querySelectorAll('.percentage-input');
    const total = Array.from(percentageInputs).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    
    // Remove existing validation message
    const existingValidation = document.querySelector('.split-validation');
    if (existingValidation) {
        existingValidation.remove();
    }
    
    const validationDiv = document.createElement('div');
    validationDiv.className = 'split-validation';
    
    if (total > 100) {
        validationDiv.textContent = `Total percentage exceeds 100% (${total.toFixed(2)}%)`;
        validationDiv.classList.remove('valid');
    } else if (total < 100) {
        validationDiv.textContent = `Total percentage is ${total.toFixed(2)}% (need 100%)`;
        validationDiv.classList.remove('valid');
    } else {
        validationDiv.textContent = 'Total percentage is 100% ✓';
        validationDiv.classList.add('valid');
    }
    
    const splitDetails = document.getElementById('splitDetails');
    splitDetails.appendChild(validationDiv);
}

function validateExactAmounts() {
    const exactInputs = document.querySelectorAll('.exact-amount-input');
    const total = Array.from(exactInputs).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    const expenseAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    // Remove existing validation message
    const existingValidation = document.querySelector('.split-validation');
    if (existingValidation) {
        existingValidation.remove();
    }
    
    const validationDiv = document.createElement('div');
    validationDiv.className = 'split-validation';
    
    if (total > expenseAmount) {
        validationDiv.textContent = `Total amount exceeds expense amount ($${total.toFixed(2)} > $${expenseAmount.toFixed(2)})`;
        validationDiv.classList.remove('valid');
    } else if (total < expenseAmount) {
        validationDiv.textContent = `Total amount is $${total.toFixed(2)} (need $${expenseAmount.toFixed(2)})`;
        validationDiv.classList.remove('valid');
    } else {
        validationDiv.textContent = 'Total amount matches expense amount ✓';
        validationDiv.classList.add('valid');
    }
    
    const splitDetails = document.getElementById('splitDetails');
    splitDetails.appendChild(validationDiv);
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

async function handleAddExpense() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Please log in to add expenses');
        return;
    }
    
    // Collect form data
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value.trim();
    const groupId = parseInt(document.getElementById('expenseGroup').value);
    const paidBy = parseInt(document.getElementById('expensePayer').value);
    const splitMethod = document.getElementById('expenseSplitMethod').value;
    const note = document.getElementById('expenseNote').value.trim();
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const currency = document.getElementById('expenseCurrency').value;
    
    // Validate required fields
    if (!amount || !description || !groupId || !paidBy || !splitMethod) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Get selected participants
    const multiSelect = document.getElementById('expenseParticipants');
    const checkedBoxes = multiSelect.querySelectorAll('input[type="checkbox"]:checked');
    const participants = Array.from(checkedBoxes).map(checkbox => parseInt(checkbox.value));
    
    if (participants.length === 0) {
        alert('Please select at least one participant');
        return;
    }
    
    // Calculate split details
    const splitDetails = {};
    
    if (splitMethod === 'equal') {
        const shareAmount = amount / participants.length;
        participants.forEach(participantId => {
            splitDetails[participantId] = shareAmount;
        });
    } else if (splitMethod === 'percentage') {
        const percentageInputs = document.querySelectorAll('.percentage-input');
        const totalPercentage = Array.from(percentageInputs).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
        
        if (Math.abs(totalPercentage - 100) > 0.01) {
            alert('Total percentage must equal 100%');
            return;
        }
        
        percentageInputs.forEach(input => {
            const participantId = parseInt(input.dataset.participantId);
            const percentage = parseFloat(input.value) || 0;
            splitDetails[participantId] = (amount * percentage) / 100;
        });
    } else if (splitMethod === 'exact') {
        const exactInputs = document.querySelectorAll('.exact-amount-input');
        const totalAmount = Array.from(exactInputs).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
        
        if (Math.abs(totalAmount - amount) > 0.01) {
            alert('Total exact amounts must equal the expense amount');
            return;
        }
        
        exactInputs.forEach(input => {
            const participantId = parseInt(input.dataset.participantId);
            const exactAmount = parseFloat(input.value) || 0;
            splitDetails[participantId] = exactAmount;
        });
    }
    
    const expenseData = {
        amount: amount,
        description: description,
        group_id: groupId,
        paid_by: paidBy,
        split_method: splitMethod,
        participants: participants,
        split_details: splitDetails,
        note: note,
        date: date,
        category: category,
        currency: currency
    };
    
    try {
        const response = await fetch('http://localhost:5000/api/expenses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(expenseData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal('addExpenseModal');
            alert('Expense added successfully!');
            // Reload balance data to reflect the new expense
            loadBalanceData();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Failed to add expense:', error);
        alert('Failed to add expense. Please try again.');
    }
}

async function handleSettleExpense() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Please log in to record payments');
        return;
    }
    
    // Collect form data
    const amount = parseFloat(document.getElementById('settleAmount').value);
    const currency = document.getElementById('settleCurrency').value;
    const description = document.getElementById('settleDescription').value.trim();
    const groupId = parseInt(document.getElementById('settleGroup').value);
    const paidBy = parseInt(document.getElementById('settlePayer').value);
    const paidTo = parseInt(document.getElementById('settlePayee').value);
    
    // Validate required fields
    if (!amount || !description || !groupId || !paidBy || !paidTo) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Validate amount
    if (amount <= 0) {
        alert('Amount must be greater than 0');
        return;
    }
    
    // Validate paid_by and paid_to are different
    if (paidBy === paidTo) {
        alert('Cannot pay yourself');
        return;
    }
    
    const settleData = {
        amount: amount,
        currency: currency,
        description: description,
        group_id: groupId,
        paid_by: paidBy,
        paid_to: paidTo
    };
    
    try {
        const response = await fetch('http://localhost:5000/api/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settleData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal('settleExpenseModal');
            alert('Payment recorded successfully!');
            // Reload balance data to reflect the payment
            loadBalanceData();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Failed to record payment:', error);
        alert('Failed to record payment. Please try again.');
    }
}

// Make functions globally available
window.addExpense = addExpense;
window.settleExpense = settleExpense;
window.openModal = openModal;
window.closeModal = closeModal;