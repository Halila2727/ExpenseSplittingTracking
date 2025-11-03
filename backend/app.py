from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sqlite3
import bcrypt
from datetime import datetime
import jwt
import random
import string
from crud import get_net_balances, get_user_balances

# instance of Flask
app = Flask(__name__)

# This is for frontend communication
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

@app.route('/ping', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify the API is running
    """
    return jsonify({
        'status': 'healthy',
        'message': 'Centsible API is running',
        'version': '1.0.0'
    }), 200

@app.route('/', methods=['GET'])
def home():
    """
    Root endpoint with basic API information
    """
    return jsonify({
        'message': 'Welcome to Centsible API',
        'description': 'A cost-sharing application for groups',
        'endpoints': {
            'health_check': '/ping',
            'auth': {
                'signup': '/auth/signup',
                'login': '/auth/login'
            },
            'docs': '/docs (coming soon)'
        }
    }), 200

# Database helper functions
def get_db_connection():
    conn = sqlite3.connect('test.db')
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_token(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow().timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def generate_join_code():
    """Generate a unique 4-digit alphanumeric join code"""
    while True:
        # Generate 4-character code with uppercase letters and numbers
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        # Check if code already exists
        conn = get_db_connection()
        existing = conn.execute(
            'SELECT 1 FROM groups WHERE join_code = ?', (code,)
        ).fetchone()
        conn.close()
        
        if not existing:
            return code

def consolidate_balances(conn, group_id, lender_id, borrower_id, amount):
    """
    Consolidate balances between two users in a group.
    If a balance already exists, update it. If it would result in 0 or negative,
    handle the reversal appropriately.
    """
    # Check if there's an existing balance in either direction
    existing_lender_to_borrower = conn.execute(
        'SELECT balance_id, amount FROM balances WHERE group_id = ? AND lender = ? AND borrower = ?',
        (group_id, lender_id, borrower_id)
    ).fetchone()
    
    existing_borrower_to_lender = conn.execute(
        'SELECT balance_id, amount FROM balances WHERE group_id = ? AND lender = ? AND borrower = ?',
        (group_id, borrower_id, lender_id)
    ).fetchone()
    
    now = datetime.now().isoformat()
    
    if existing_lender_to_borrower:
        # Update existing balance in the same direction
        new_amount = existing_lender_to_borrower['amount'] + amount
        if new_amount <= 0:
            # Delete the balance if it becomes zero or negative
            conn.execute(
                'DELETE FROM balances WHERE balance_id = ?',
                (existing_lender_to_borrower['balance_id'],)
            )
        else:
            # Update the balance
            conn.execute(
                'UPDATE balances SET amount = ?, updated_at = ? WHERE balance_id = ?',
                (new_amount, now, existing_lender_to_borrower['balance_id'])
            )
    elif existing_borrower_to_lender:
        # There's a balance in the opposite direction
        existing_amount = existing_borrower_to_lender['amount']
        if amount >= existing_amount:
            # New amount is greater than or equal to existing, reverse the direction
            new_amount = amount - existing_amount
            conn.execute(
                'DELETE FROM balances WHERE balance_id = ?',
                (existing_borrower_to_lender['balance_id'],)
            )
            if new_amount > 0:
                conn.execute(
                    'INSERT INTO balances (group_id, lender, borrower, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    (group_id, lender_id, borrower_id, new_amount, now, now)
                )
        else:
            # New amount is less than existing, reduce the existing balance
            new_amount = existing_amount - amount
            conn.execute(
                'UPDATE balances SET amount = ?, updated_at = ? WHERE balance_id = ?',
                (new_amount, now, existing_borrower_to_lender['balance_id'])
            )
    else:
        # No existing balance, create new one
        conn.execute(
            'INSERT INTO balances (group_id, lender, borrower, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (group_id, lender_id, borrower_id, amount, now, now)
        )

# Authentication routes
@app.route('/auth/signup', methods=['POST'])
def signup():
    """
    User registration endpoint
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or not all(k in data for k in ('name', 'email', 'password')):
            return jsonify({'error': 'Missing required fields'}), 400
        
        name = data['name'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # Basic validation
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        if '@' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check if user already exists
        conn = get_db_connection()
        existing_user = conn.execute(
            'SELECT id FROM users WHERE email = ?', (email,)
        ).fetchone()
        
        if existing_user:
            conn.close()
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        password_hash = hash_password(password)
        now = datetime.now().isoformat()
        
        cursor = conn.execute(
            'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            (name, email, password_hash, now, now)
        )
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Generate token
        token = generate_token(user_id)
        
        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user_id,
                'name': name,
                'email': email
            },
            'token': token
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """
    User login endpoint
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or not all(k in data for k in ('email', 'password')):
            return jsonify({'error': 'Email and password are required'}), 400
        
        email = data['email'].strip().lower()
        password = data['password']
        
        # Find user
        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, email, password_hash FROM users WHERE email = ?', (email,)
        ).fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Generate token
        token = generate_token(user['id'])
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'name': user['username'],
                'email': user['email']
            },
            'token': token
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/auth/verify', methods=['POST'])
def verify_token():
    """
    Verify JWT token
    """
    try:
        data = request.get_json()
        token = data.get('token')
        
        if not token:
            return jsonify({'error': 'Token required'}), 400
        
        # Decode token
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['user_id']
        
        # Get user info
        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, email FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'valid': True,
            'user': {
                'id': user['id'],
                'name': user['username'],
                'email': user['email']
            }
        }), 200
        
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/balance', methods=['GET'])
def get_balance():
    """
    Get user balance information
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        # Get user's net balance
        net_balances = get_net_balances()
        user_balance = net_balances.get(user_id, 0.0)
        
        # Get detailed balances for this user
        user_balances = get_user_balances(user_id)
        
        # Calculate amounts owed and owed to user
        owed_by_me = 0.0  # Amount I owe to others
        owed_to_me = 0.0  # Amount others owe me
        
        for lender, borrower, amount in user_balances:
            if borrower == user_id:
                owed_by_me += amount  # I owe this amount
            elif lender == user_id:
                owed_to_me += amount  # Others owe me this amount
        
        return jsonify({
            'net_balance': round(user_balance, 2),
            'owed_by_me': round(owed_by_me, 2),
            'owed_to_me': round(owed_to_me, 2),
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/activity', methods=['GET'])
def get_recent_activity():
    """
    Get recent activity for the user (expenses and payments from their groups)
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        # Get user's groups
        conn = get_db_connection()
        user_groups = conn.execute(
            'SELECT group_id FROM members WHERE user_id = ? AND deleted_at IS NULL', (user_id,)
        ).fetchall()
        
        if not user_groups:
            conn.close()
            return jsonify({'activities': []}), 200
        
        group_ids = [group['group_id'] for group in user_groups]
        
        # Get recent expenses from user's groups
        placeholders = ','.join(['?' for _ in group_ids])
        expenses_query = f"""
            SELECT e.expense_id, e.group_id, e.description, e.amount, e.paid_by, e.created_at,
                   u.username as paid_by_name, g.group_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            JOIN groups g ON e.group_id = g.group_id
            WHERE e.group_id IN ({placeholders})
            ORDER BY e.created_at DESC
            LIMIT 20
        """
        
        expenses = conn.execute(expenses_query, group_ids).fetchall()
        
        # Get recent payments involving the user
        payments_query = """
            SELECT p.payment_id, p.paid_by, p.paid_to, p.amount, p.paid_at,
                   u1.username as paid_by_name, u2.username as paid_to_name
            FROM payments p
            JOIN users u1 ON p.paid_by = u1.id
            JOIN users u2 ON p.paid_to = u2.id
            WHERE p.paid_by = ? OR p.paid_to = ?
            ORDER BY p.paid_at DESC
            LIMIT 20
        """
        
        payments = conn.execute(payments_query, (user_id, user_id)).fetchall()
        
        conn.close()
        
        # Format activities
        activities = []
        
        # Add expenses
        for expense in expenses:
            activities.append({
                'id': f"expense_{expense['expense_id']}",
                'type': 'expense',
                'description': expense['description'],
                'amount': float(expense['amount']),
                'paid_by': expense['paid_by_name'],
                'paid_by_id': expense['paid_by'],
                'group_name': expense['group_name'],
                'group_id': expense['group_id'],
                'date': expense['created_at'],
                'is_my_expense': expense['paid_by'] == user_id
            })
        
        # Add payments
        for payment in payments:
            activities.append({
                'id': f"payment_{payment['payment_id']}",
                'type': 'payment',
                'description': f"Payment from {payment['paid_by_name']} to {payment['paid_to_name']}",
                'amount': float(payment['amount']),
                'paid_by': payment['paid_by_name'],
                'paid_by_id': payment['paid_by'],
                'paid_to': payment['paid_to_name'],
                'paid_to_id': payment['paid_to'],
                'date': payment['paid_at'],
                'is_my_payment': payment['paid_by'] == user_id or payment['paid_to'] == user_id
            })
        
        # Sort all activities by date (most recent first)
        activities.sort(key=lambda x: x['date'], reverse=True)
        
        # Limit to 20 most recent activities
        activities = activities[:20]
        
        return jsonify({
            'activities': activities,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    """
    Add a new expense to a group
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['amount', 'description', 'group_id', 'paid_by', 'split_method', 'participants', 'split_details']
        if not data or not all(k in data for k in required_fields):
            return jsonify({'error': 'Missing required fields: amount, description, group_id, paid_by, split_method, participants, split_details'}), 400
        
        amount = float(data['amount'])
        description = data['description'].strip()
        group_id = int(data['group_id'])
        paid_by = int(data['paid_by'])
        split_method = data['split_method']
        participants = data['participants']
        split_details = data['split_details']
        
        # Optional fields
        note = data.get('note', '').strip()
        date = data.get('date', '')
        category = data.get('category', '')
        currency = data.get('currency', 'USD')
        
        # Validate amount
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Validate split method
        if split_method not in ['equal', 'percentage', 'exact']:
            return jsonify({'error': 'Invalid split method'}), 400
        
        # Check if user is member of the group
        conn = get_db_connection()
        membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (user_id, group_id)
        ).fetchone()
        
        if not membership:
            conn.close()
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Check if paid_by is a member of the group
        payer_membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (paid_by, group_id)
        ).fetchone()
        
        if not payer_membership:
            conn.close()
            return jsonify({'error': 'The person who paid is not a member of this group'}), 400
        
        # Validate participants are all group members
        for participant_id in participants:
            participant_membership = conn.execute(
                'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
                (participant_id, group_id)
            ).fetchone()
            
            if not participant_membership:
                conn.close()
                return jsonify({'error': f'Participant {participant_id} is not a member of this group'}), 400
        
        # Validate split details match participants
        if len(split_details) != len(participants):
            conn.close()
            return jsonify({'error': 'Split details must match number of participants'}), 400
        
        # Validate split details sum equals amount (with small tolerance for rounding)
        total_split = sum(float(amount) for amount in split_details.values())
        if abs(total_split - amount) > 0.01:
            conn.close()
            return jsonify({'error': 'Split details must sum to the total amount'}), 400
        
        # Add expense
        now = datetime.now().isoformat()
        cursor = conn.execute(
            'INSERT INTO expenses (group_id, description, amount, paid_by, note, date, category, currency, split_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (group_id, description, amount, paid_by, note, date, category, currency, split_method, now)
        )
        
        expense_id = cursor.lastrowid
        
        # Create balances based on split details using consolidation
        for participant_id in participants:
            participant_id = int(participant_id)
            if participant_id != paid_by:  # Don't create balance for the person who paid
                share_amount = float(split_details[str(participant_id)])
                consolidate_balances(conn, group_id, paid_by, participant_id, share_amount)
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Expense added successfully',
            'expense_id': expense_id,
            'amount': amount,
            'description': description,
            'group_id': group_id,
            'paid_by': paid_by,
            'split_method': split_method,
            'note': note
        }), 201
        
    except ValueError as e:
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        print(f"Error in add_expense: {str(e)}")  # Add logging for debugging
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/api/payments', methods=['POST'])
def record_payment():
    """
    Record a payment between users
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['amount', 'paid_by', 'paid_to', 'group_id', 'description']
        if not data or not all(k in data for k in required_fields):
            return jsonify({'error': 'Missing required fields: amount, paid_by, paid_to, group_id, description'}), 400
        
        amount = float(data['amount'])
        paid_by = int(data['paid_by'])
        paid_to = int(data['paid_to'])
        group_id = int(data['group_id'])
        description = data['description'].strip()
        currency = data.get('currency', 'USD')
        
        # Validate amount
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Validate description is not empty
        if not description:
            return jsonify({'error': 'Description is required'}), 400
        
        # Can't pay yourself
        if paid_by == paid_to:
            return jsonify({'error': 'Cannot pay yourself'}), 400
        
        conn = get_db_connection()
        
        # Check if both users are members of the group
        payer_membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (paid_by, group_id)
        ).fetchone()
        
        recipient_membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (paid_to, group_id)
        ).fetchone()
        
        if not payer_membership or not recipient_membership:
            conn.close()
            return jsonify({'error': 'Both users must be members of the group'}), 403
        
        # Check if debt exists from paid_by to paid_to in this group
        # In the balances table, lender is the person who is owed money, borrower is the person who owes
        # So we need to check: paid_to (lender) is owed money by paid_by (borrower)
        balance_check = conn.execute(
            'SELECT amount FROM balances WHERE group_id = ? AND lender = ? AND borrower = ?',
            (group_id, paid_to, paid_by)
        ).fetchone()
        
        if not balance_check or balance_check['amount'] <= 0:
            conn.close()
            return jsonify({'error': 'No debt exists from the specified payer to the specified recipient in this group'}), 400
        
        existing_debt = float(balance_check['amount'])
        
        # Validate payment amount doesn't exceed debt
        if amount > existing_debt:
            conn.close()
            return jsonify({'error': f'Payment amount (${amount:.2f}) exceeds existing debt (${existing_debt:.2f})'}), 400
        
        # Record payment
        now = datetime.now().isoformat()
        cursor = conn.execute(
            'INSERT INTO payments (paid_by, paid_to, amount, paid_at, description, currency, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (paid_by, paid_to, amount, now, description, currency, group_id)
        )
        
        payment_id = cursor.lastrowid
        
        # Use consolidation function to handle balance updates
        # Payment reduces debt from payer to recipient (paid_to is lender, paid_by is borrower)
        consolidate_balances(conn, group_id, paid_to, paid_by, -amount)
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Payment recorded successfully',
            'payment_id': payment_id,
            'amount': amount,
            'paid_by': paid_by,
            'paid_to': paid_to,
            'group_id': group_id,
            'description': description,
            'currency': currency
        }), 201
        
    except ValueError as e:
        return jsonify({'error': 'Invalid amount or user_id format'}), 400
    except Exception as e:
        print(f"Error in record_payment: {str(e)}")  # Add logging for debugging
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/api/groups', methods=['GET'])
def get_user_groups():
    """
    Get all groups that the user is a member of
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        conn = get_db_connection()
        
        # Get user's groups with member count
        # First, get the groups the user is a member of
        # Then count the members in each of those groups
        groups_query = """
            SELECT g.group_id, g.group_name, g.group_description, g.join_code, g.created_by,
                   (SELECT COUNT(*) 
                    FROM members m2 
                    WHERE m2.group_id = g.group_id AND m2.deleted_at IS NULL) as member_count
            FROM groups g
            INNER JOIN members m ON g.group_id = m.group_id
            WHERE m.user_id = ? AND m.deleted_at IS NULL AND g.deleted_at IS NULL
            GROUP BY g.group_id, g.group_name, g.group_description, g.join_code, g.created_by
            ORDER BY g.group_name
        """
        
        groups = conn.execute(groups_query, (user_id,)).fetchall()
        
        conn.close()
        
        groups_list = []
        for group in groups:
            groups_list.append({
                'group_id': group['group_id'],
                'group_name': group['group_name'],
                'group_description': group['group_description'],
                'join_code': group['join_code'],
                'created_by': group['created_by'],
                'member_count': group['member_count']
            })
        
        return jsonify({
            'groups': groups_list,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/groups/<int:group_id>/members', methods=['GET'])
def get_group_members(group_id):
    """
    Get all members of a specific group
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        conn = get_db_connection()
        
        # Check if user is member of the group
        membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (user_id, group_id)
        ).fetchone()
        
        if not membership:
            conn.close()
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Get group members with user details
        members_query = """
            SELECT u.id, u.username, u.email
            FROM users u
            INNER JOIN members m ON u.id = m.user_id
            WHERE m.group_id = ? AND m.deleted_at IS NULL
            ORDER BY u.username
        """
        
        members = conn.execute(members_query, (group_id,)).fetchall()
        
        conn.close()
        
        members_list = []
        for member in members:
            members_list.append({
                'user_id': member['id'],
                'username': member['username'],
                'email': member['email']
            })
        
        return jsonify({
            'members': members_list,
            'group_id': group_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/groups', methods=['POST'])
def create_group():
    """
    Create a new group
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data or not data.get('group_name'):
            return jsonify({'error': 'Group name is required'}), 400
        
        group_name = data['group_name'].strip()
        group_description = data.get('group_description', '').strip()
        
        if not group_name:
            return jsonify({'error': 'Group name cannot be empty'}), 400
        
        conn = get_db_connection()
        
        # Generate unique join code
        join_code = generate_join_code()
        
        # Create group
        now = datetime.now().isoformat()
        cursor = conn.execute(
            'INSERT INTO groups (group_name, group_description, join_code, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (group_name, group_description, join_code, user_id, now, now)
        )
        
        group_id = cursor.lastrowid
        
        # Add creator as member
        conn.execute(
            'INSERT INTO members (user_id, group_id, joined_at) VALUES (?, ?, ?)',
            (user_id, group_id, now)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Group created successfully',
            'group_id': group_id,
            'group_name': group_name,
            'group_description': group_description,
            'join_code': join_code,
            'created_by': user_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/groups/join', methods=['POST'])
def join_group():
    """
    Join a group using a join code
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data or not data.get('join_code'):
            return jsonify({'error': 'Join code is required'}), 400
        
        join_code = data['join_code'].strip().upper()
        
        if len(join_code) != 4:
            return jsonify({'error': 'Join code must be 4 characters'}), 400
        
        conn = get_db_connection()
        
        # Find group by join code
        group = conn.execute(
            'SELECT group_id, group_name, group_description FROM groups WHERE join_code = ? AND deleted_at IS NULL', 
            (join_code,)
        ).fetchone()
        
        if not group:
            conn.close()
            return jsonify({'error': 'Invalid join code'}), 404
        
        group_id = group['group_id']
        
        # Check if user is already a member
        existing_member = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (user_id, group_id)
        ).fetchone()
        
        if existing_member:
            conn.close()
            return jsonify({'error': 'You are already a member of this group'}), 409
        
        # Add user to group
        now = datetime.now().isoformat()
        conn.execute(
            'INSERT INTO members (user_id, group_id, joined_at) VALUES (?, ?, ?)',
            (user_id, group_id, now)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Successfully joined group',
            'group_id': group_id,
            'group_name': group['group_name'],
            'group_description': group['group_description']
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/groups/<int:group_id>/balances', methods=['GET'])
def get_group_balances(group_id):
    """
    Get balance information for all members in a specific group
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        conn = get_db_connection()
        
        # Verify user is a member of the group
        membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (user_id, group_id)
        ).fetchone()
        
        if not membership:
            conn.close()
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Get all members of the group
        members_query = """
            SELECT m.user_id, u.username
            FROM members m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ? AND m.deleted_at IS NULL
            ORDER BY u.username
        """
        
        members = conn.execute(members_query, (group_id,)).fetchall()
        
        # Get all balances within this group
        balances_query = """
            SELECT b.lender, b.borrower, b.amount,
                   u1.username as lender_name, u2.username as borrower_name
            FROM balances b
            JOIN users u1 ON b.lender = u1.id
            JOIN users u2 ON b.borrower = u2.id
            WHERE b.group_id = ? AND b.amount > 0
            ORDER BY b.lender, b.borrower
        """
        
        balances = conn.execute(balances_query, (group_id,)).fetchall()
        
        conn.close()
        
        # Calculate totals for each member
        member_totals = {}
        balance_details = {}  # For detailed breakdown on hover
        
        for member in members:
            member_id = member['user_id']
            member_totals[member_id] = {
                'member_id': member_id,
                'member_name': member['username'],
                'owes': 0.0,
                'is_owed': 0.0,
                'owes_breakdown': [],  # List of {to: name, amount: X}
                'is_owed_breakdown': []  # List of {from: name, amount: X}
            }
        
        # Process balances
        balances_list = []
        for balance in balances:
            lender_id = balance['lender']
            borrower_id = balance['borrower']
            amount = float(balance['amount'])
            lender_name = balance['lender_name']
            borrower_name = balance['borrower_name']
            
            # Track in raw format for backward compatibility
            balances_list.append({
                'lender_id': lender_id,
                'lender_name': lender_name,
                'borrower_id': borrower_id,
                'borrower_name': borrower_name,
                'amount': amount
            })
            
            # Update borrower totals (they owe money)
            if borrower_id in member_totals:
                member_totals[borrower_id]['owes'] += amount
                member_totals[borrower_id]['owes_breakdown'].append({
                    'to': lender_name,
                    'amount': amount
                })
            
            # Update lender totals (they are owed money)
            if lender_id in member_totals:
                member_totals[lender_id]['is_owed'] += amount
                member_totals[lender_id]['is_owed_breakdown'].append({
                    'from': borrower_name,
                    'amount': amount
                })
        
        # Convert to list
        member_list = [member_totals[mid] for mid in member_totals]
        
        return jsonify({
            'group_id': group_id,
            'balances': balances_list,
            'members': member_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/groups/<int:group_id>/activity', methods=['GET'])
def get_group_activity(group_id):
    """
    Get recent activity for a specific group
    """
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        conn = get_db_connection()
        
        # Verify user is a member of the group
        membership = conn.execute(
            'SELECT 1 FROM members WHERE user_id = ? AND group_id = ? AND deleted_at IS NULL', 
            (user_id, group_id)
        ).fetchone()
        
        if not membership:
            conn.close()
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Get recent expenses for this group
        expenses_query = """
            SELECT e.expense_id, e.description, e.amount, e.paid_by, e.created_at,
                   u.username as paid_by_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            WHERE e.group_id = ?
            ORDER BY e.created_at DESC
            LIMIT 20
        """
        
        expenses = conn.execute(expenses_query, (group_id,)).fetchall()
        
        conn.close()
        
        # Format activities
        activities = []
        
        # Add expenses
        for expense in expenses:
            activities.append({
                'id': f"expense_{expense['expense_id']}",
                'type': 'expense',
                'description': expense['description'],
                'amount': float(expense['amount']),
                'paid_by': expense['paid_by_name'],
                'paid_by_id': expense['paid_by'],
                'date': expense['created_at'],
                'is_my_expense': expense['paid_by'] == user_id
            })
        
        # Sort by date (most recent first)
        activities.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'group_id': group_id,
            'activities': activities
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Run the application
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=debug_mode
    )
