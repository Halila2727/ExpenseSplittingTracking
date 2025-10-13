from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sqlite3
import bcrypt
from datetime import datetime
import jwt
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

if __name__ == '__main__':
    # Run the application
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
