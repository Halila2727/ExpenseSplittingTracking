from flask import Flask, jsonify, request, send_from_directory, url_for
from flask_cors import CORS
import os
import sqlite3
import bcrypt
from datetime import datetime, timedelta
import jwt
import random
import string
import json
import mimetypes
from uuid import uuid4
from collections import defaultdict
import re
import tempfile
from werkzeug.utils import secure_filename
from PIL import Image

try:
    import easyocr
    import numpy as np
    # Initialize easyOCR reader once at module level (first use downloads models)
    try:
        ocr_reader = easyocr.Reader(['en'])
    except Exception:
        ocr_reader = None
except ImportError:
    easyocr = None
    ocr_reader = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

from crud import get_net_balances, get_user_balances
from splitting import compute_custom_splits, SplitError

# instance of Flask
app = Flask(__name__)

# This is for frontend communication
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_ROOT = os.path.join(BASE_DIR, 'uploads')
ALLOWED_ATTACHMENT_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic', 'heif', 'pdf'
}
RECEIPT_KEYWORDS = [
    'total amount',
    'grand total',
    'balance due',
    'amount due',
    'net total',
    'final amount',
    'payable amount',
    'total'
]
# Words to exclude - these are intermediate totals, not final totals
EXCLUDE_KEYWORDS = [
    'subtotal',
    'sub-total',
    'sub total'
]
os.makedirs(UPLOAD_ROOT, exist_ok=True)

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


@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    """Serve uploaded attachments."""
    return send_from_directory(UPLOAD_ROOT, filename, as_attachment=False)

# Database helper functions
def get_db_connection():
    conn = sqlite3.connect('test.db')
    conn.row_factory = sqlite3.Row
    return conn


def ensure_expense_attachment_table():
    """Ensure the attachment table exists for older databases."""
    conn = get_db_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS expense_attachments (
            attachment_id INTEGER PRIMARY KEY NOT NULL,
            expense_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            original_filename TEXT,
            mime_type TEXT,
            is_receipt INTEGER DEFAULT 0,
            ocr_total NUMERIC,
            created_at TEXT,
            FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE
        )
        """
    )
    conn.commit()
    conn.close()


ensure_expense_attachment_table()


def allowed_attachment(filename):
    return (
        bool(filename)
        and '.' in filename
        and filename.rsplit('.', 1)[1].lower() in ALLOWED_ATTACHMENT_EXTENSIONS
    )


def extract_amount_from_line(line):
    """Extract decimal amount from a string."""
    if not line:
        return None
    matches = re.findall(r'(-?\d[\d,]*(?:\.\d{1,2})?)', line.replace(',', ''))
    for match in matches:
        try:
            value = float(match)
            if value >= 0:
                return round(value, 2)
        except ValueError:
            continue
    return None


def find_total_amount_in_text(text):
    """Search multiline text for keywords and return the amount next to them."""
    if not text:
        return None
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for idx, raw_line in enumerate(lines):
        line = raw_line.lower()
        # Skip lines that contain excluded keywords (like subtotal)
        if any(exclude_word in line for exclude_word in EXCLUDE_KEYWORDS):
            continue
        for keyword in RECEIPT_KEYWORDS:
            if keyword in line:
                amount = extract_amount_from_line(raw_line)
                if amount is not None:
                    return amount
                if idx + 1 < len(lines):
                    next_amount = extract_amount_from_line(lines[idx + 1])
                    if next_amount is not None:
                        return next_amount
    return None


def run_receipt_ocr(file_path):
    """Run OCR against a receipt file and try to detect the total amount."""
    if ocr_reader is None:
        return None, 'OCR is unavailable (easyocr not installed)'
    text_chunks = []
    try:
        if file_path.lower().endswith('.pdf'):
            if convert_from_path is None:
                return None, 'PDF OCR requires pdf2image; please install it.'
            images = convert_from_path(file_path, fmt='png', first_page=1, last_page=1)
            for image in images:
                # Convert PIL Image to numpy array for easyOCR
                img_array = np.array(image)
                # easyOCR returns [(bbox, text, confidence), ...], extract text (index 1)
                results = ocr_reader.readtext(img_array)
                text = '\n'.join([result[1] for result in results])
                text_chunks.append(text)
        else:
            with Image.open(file_path) as img:
                # Convert PIL Image to numpy array for easyOCR
                img_array = np.array(img)
                # easyOCR returns [(bbox, text, confidence), ...], extract text (index 1)
                results = ocr_reader.readtext(img_array)
                text = '\n'.join([result[1] for result in results])
                text_chunks.append(text)
    except Exception as exc:
        return None, f'OCR failed: {exc}'

    combined_text = '\n'.join(text_chunks)
    amount = find_total_amount_in_text(combined_text)
    if amount is None:
        return None, 'Could not find a recognizable total on the receipt.'
    return amount, None


def save_attachment_file(expense_id, file_storage):
    """Persist attachment to disk and return metadata dict."""
    original_name = secure_filename(file_storage.filename or '')
    extension = os.path.splitext(original_name)[1]
    unique_name = f"{uuid4().hex}{extension}"
    expense_dir = os.path.join(UPLOAD_ROOT, 'expenses', str(expense_id))
    os.makedirs(expense_dir, exist_ok=True)
    destination = os.path.join(expense_dir, unique_name)
    file_storage.save(destination)
    relative_path = os.path.relpath(destination, UPLOAD_ROOT)
    mime_type = file_storage.mimetype or mimetypes.guess_type(original_name)[0] or 'application/octet-stream'
    return {
        'relative_path': relative_path.replace('\\', '/'),
        'mime_type': mime_type,
        'original_name': original_name or unique_name,
        'absolute_path': destination
    }


def parse_json_field(raw_value, default_value):
    """Parse JSON arrays/objects coming from multipart forms."""
    if raw_value in (None, '', 'null', 'undefined'):
        return default_value
    try:
        return json.loads(raw_value)
    except (json.JSONDecodeError, TypeError):
        return default_value


def extract_expense_payload():
    """Normalize payload from JSON or multipart forms."""
    content_type = request.content_type or ''
    is_multipart = 'multipart/form-data' in content_type
    attachment_file = request.files.get('attachment') if is_multipart else None
    if is_multipart:
        form = request.form
        payload = {
            'amount': form.get('amount'),
            'description': form.get('description'),
            'group_id': form.get('group_id'),
            'paid_by': form.get('paid_by'),
            'split_method': form.get('split_method'),
            'participants': parse_json_field(form.get('participants'), []),
            'split_details': parse_json_field(form.get('split_details'), {}),
            'split_config': parse_json_field(form.get('split_config'), []),
            'note': form.get('note', ''),
            'date': form.get('date'),
            'category': form.get('category'),
            'currency': form.get('currency'),
            'is_receipt_attachment': form.get('is_receipt_attachment', 'false').lower() == 'true',
            'attachment_ocr_total': form.get('ocr_total')
        }
    else:
        payload = request.get_json() or {}
        payload.setdefault('participants', [])
        payload.setdefault('split_details', {})
        payload.setdefault('split_config', [])
        payload.setdefault('note', '')
        payload.setdefault('currency', 'USD')
        payload['is_receipt_attachment'] = bool(payload.get('is_receipt_attachment'))
        payload['attachment_ocr_total'] = payload.get('attachment_ocr_total')
    # Normalize OCR total
    raw_total = payload.get('attachment_ocr_total')
    if raw_total in (None, '', 'null', 'undefined'):
        payload['attachment_ocr_total'] = None
    else:
        try:
            payload['attachment_ocr_total'] = float(raw_total)
        except (TypeError, ValueError):
            payload['attachment_ocr_total'] = None

    return payload, attachment_file


def map_attachment_row(row):
    """Convert DB attachment row to API-friendly payload."""
    return {
        'attachment_id': row['attachment_id'],
        'file_name': row['original_filename'],
        'mime_type': row['mime_type'],
        'is_receipt': bool(row['is_receipt']),
        'ocr_total': float(row['ocr_total']) if row['ocr_total'] is not None else None,
        'url': url_for('serve_upload', filename=row['file_path'], _external=True)
    }

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

@app.route('/api/users/profile', methods=['PUT'])
def update_profile():
    """
    Update user profile (name and email)
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
        
        # At least one field must be provided
        if not data or (not data.get('name') and not data.get('email')):
            return jsonify({'error': 'At least one field (name or email) must be provided'}), 400
        
        conn = get_db_connection()
        
        # Get current user data
        current_user = conn.execute(
            'SELECT username, email FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        
        if not current_user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Prepare update values - use current values if not provided
        name = data.get('name', '').strip() if data.get('name') else current_user['username']
        email = data.get('email', '').strip().lower() if data.get('email') else current_user['email']
        
        # Validate name if provided
        if data.get('name'):
            if not name:
                conn.close()
                return jsonify({'error': 'Name cannot be empty'}), 400
            if name == current_user['username']:
                conn.close()
                return jsonify({'error': 'Name must be different from current name'}), 400
        
        # Validate email if provided
        if data.get('email'):
            if '@' not in email:
                conn.close()
                return jsonify({'error': 'Invalid email format'}), 400
            if email == current_user['email']:
                conn.close()
                return jsonify({'error': 'Email must be different from current email'}), 400
            
            # Check if email is already in use
            existing_user = conn.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?', (email, user_id)
            ).fetchone()
            
            if existing_user:
                conn.close()
                return jsonify({'error': 'Email already in use'}), 409
        
        # Update user profile
        now = datetime.now().isoformat()
        conn.execute(
            'UPDATE users SET username = ?, email = ?, updated_at = ? WHERE id = ?',
            (name, email, now, user_id)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': user_id,
                'name': name,
                'email': email
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/users/password', methods=['PUT'])
def update_password():
    """
    Update user password
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
        if not data or 'new_password' not in data:
            return jsonify({'error': 'New password is required'}), 400
        
        new_password = data['new_password']
        
        # Validate password length
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        conn = get_db_connection()
        
        # Get current user
        user = conn.execute(
            'SELECT password_hash FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        
        # Check if new password is the same as current password
        if verify_password(new_password, user['password_hash']):
            conn.close()
            return jsonify({'error': 'New password must be different from current password'}), 400
        
        # Hash new password
        new_password_hash = hash_password(new_password)
        
        # Update password
        now = datetime.now().isoformat()
        conn.execute(
            'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            (new_password_hash, now, user_id)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Password updated successfully'
        }), 200
        
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

@app.route('/api/unpaid-expenses', methods=['GET'])
def get_unpaid_expenses():
    """
    Get unpaid expenses that are 2+ days old for the authenticated user
    Returns expenses grouped by lender with aggregated totals and individual expense details
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
        
        # Calculate date 2 days ago
        two_days_ago = datetime.now() - timedelta(days=2)
        two_days_ago_str = two_days_ago.isoformat()
        
        # Get expense_splits where user owes money, then verify there's still an outstanding balance
        # This ensures we only show expenses that are actually still unpaid
        query = """
            SELECT DISTINCT
                e.paid_by as lender,
                u.username as lender_name,
                e.expense_id,
                e.description,
                es.amount as split_amount,
                e.group_id,
                g.group_name,
                e.created_at
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.expense_id
            JOIN users u ON e.paid_by = u.id
            JOIN groups g ON e.group_id = g.group_id
            LEFT JOIN balances b ON b.group_id = e.group_id 
                AND b.lender = e.paid_by 
                AND b.borrower = ?
                AND b.amount > 0
            WHERE es.user_id = ?
                AND es.status = 'owes'
                AND e.created_at < ?
                AND b.balance_id IS NOT NULL
            ORDER BY e.paid_by, e.created_at DESC
        """
        
        rows = conn.execute(query, (user_id, user_id, two_days_ago_str)).fetchall()
        conn.close()
        
        # Group by lender
        lender_data = defaultdict(lambda: {
            'lender_id': None,
            'lender_name': '',
            'total_amount': 0.0,
            'expenses': []
        })
        
        for row in rows:
            lender_id = row['lender']
            lender_name = row['lender_name']
            expense_id = row['expense_id']
            description = row['description']
            split_amount = float(row['split_amount'])
            group_id = row['group_id']
            group_name = row['group_name']
            created_at = row['created_at']
            
            if lender_data[lender_id]['lender_id'] is None:
                lender_data[lender_id]['lender_id'] = lender_id
                lender_data[lender_id]['lender_name'] = lender_name
            
            lender_data[lender_id]['total_amount'] += split_amount
            
            lender_data[lender_id]['expenses'].append({
                'expense_id': expense_id,
                'description': description,
                'amount': round(split_amount, 2),
                'group_name': group_name,
                'group_id': group_id,
                'created_at': created_at
            })
        
        # Convert to list and round totals
        unpaid_expenses = []
        for lender_id, data in lender_data.items():
            unpaid_expenses.append({
                'lender_id': data['lender_id'],
                'lender_name': data['lender_name'],
                'total_amount': round(data['total_amount'], 2),
                'expenses': data['expenses']
            })
        
        return jsonify({
            'unpaid_expenses': unpaid_expenses
        }), 200
        
    except Exception as e:
        print(f"Error in get_unpaid_expenses: {str(e)}")
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
        # Use LEFT JOIN with balances to check if user owes money from each expense
        placeholders = ','.join(['?' for _ in group_ids])
        expenses_query = f"""
            SELECT e.expense_id, e.group_id, e.description, e.amount, e.paid_by, e.created_at, e.date, e.category,
                   e.note, e.split_method,
                   u.username as paid_by_name, g.group_name,
                   CASE WHEN b.balance_id IS NOT NULL THEN 1 ELSE 0 END as user_owes
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            JOIN groups g ON e.group_id = g.group_id
            LEFT JOIN balances b ON e.group_id = b.group_id 
                AND e.paid_by = b.lender 
                AND b.borrower = ?
                AND b.amount > 0
            WHERE e.group_id IN ({placeholders})
            ORDER BY e.created_at DESC
        """
        
        expenses = conn.execute(expenses_query, [user_id] + group_ids).fetchall()
        
        # Get recent payments involving the user from their groups
        payments_query = f"""
            SELECT p.payment_id, p.paid_by, p.paid_to, p.amount, p.paid_at, p.group_id,
                   u1.username as paid_by_name, u2.username as paid_to_name, g.group_name
            FROM payments p
            JOIN users u1 ON p.paid_by = u1.id
            JOIN users u2 ON p.paid_to = u2.id
            JOIN groups g ON p.group_id = g.group_id
            WHERE (p.paid_by = ? OR p.paid_to = ?) AND p.group_id IN ({placeholders})
            ORDER BY p.paid_at DESC
        """
        
        payments = conn.execute(payments_query, [user_id, user_id] + group_ids).fetchall()
        
        expense_splits_map = defaultdict(list)
        expense_attachments_map = defaultdict(list)
        if expenses:
            expense_ids = [expense['expense_id'] for expense in expenses]
            placeholders_expenses = ','.join(['?' for _ in expense_ids])
            splits_query = f"""
                SELECT es.expense_id, es.user_id, es.amount, es.status, u.username
                FROM expense_splits es
                JOIN users u ON es.user_id = u.id
                WHERE es.expense_id IN ({placeholders_expenses})
                ORDER BY es.expense_id, u.username
            """
            payer_lookup = {expense['expense_id']: expense['paid_by'] for expense in expenses}
            split_rows = conn.execute(splits_query, expense_ids).fetchall()
            for split in split_rows:
                status = split['status'] or ('payer' if split['user_id'] == payer_lookup.get(split['expense_id']) else 'owes')
                expense_splits_map[split['expense_id']].append({
                    'user_id': split['user_id'],
                    'name': split['username'],
                    'amount': float(split['amount']),
                    'status': status
                })
            
            attachments_query = f"""
                SELECT attachment_id, expense_id, file_path, original_filename, mime_type, is_receipt, ocr_total
                FROM expense_attachments
                WHERE expense_id IN ({placeholders_expenses})
                ORDER BY created_at DESC
            """
            attachment_rows = conn.execute(attachments_query, expense_ids).fetchall()
            for attachment in attachment_rows:
                expense_attachments_map[attachment['expense_id']].append(map_attachment_row(attachment))
        
        conn.close()
        
        # Format activities
        activities = []
        
        # Add expenses
        for expense in expenses:
            is_paid_by_me = expense['paid_by'] == user_id
            is_involved = is_paid_by_me or expense['user_owes'] == 1
            
            activities.append({
                'id': f"expense_{expense['expense_id']}",
                'type': 'expense',
                'description': expense['description'],
                'amount': float(expense['amount']),
                'paid_by': expense['paid_by_name'],
                'paid_by_id': expense['paid_by'],
                'group_name': expense['group_name'],
                'group_id': expense['group_id'],
                'date': expense['date'] or expense['created_at'],
                'category': expense['category'] or '',
                'is_my_expense': is_paid_by_me,
                'is_involved': is_involved,
                'memo': expense['note'] or '',
                'split_method': expense['split_method'] or '',
                'splits': expense_splits_map.get(expense['expense_id'], []),
                'attachments': expense_attachments_map.get(expense['expense_id'], [])
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
                'group_name': payment['group_name'],
                'group_id': payment['group_id'],
                'is_my_payment': payment['paid_by'] == user_id,
                'is_paid_to_me': payment['paid_to'] == user_id,
                'memo': '',
                'splits': [],
                'attachments': []
            })
        
        # Sort all activities by date (most recent first)
        activities.sort(key=lambda x: x['date'], reverse=True)
        
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
        
        data, attachment_file = extract_expense_payload()
        
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
        
        if not isinstance(participants, list) or len(participants) == 0:
            return jsonify({'error': 'At least one participant is required'}), 400
        
        try:
            participants = [int(participant_id) for participant_id in participants]
        except (TypeError, ValueError):
            return jsonify({'error': 'Participants must be numeric user IDs'}), 400
        
        # Optional fields
        note = (data.get('note') or '').strip()
        date = data.get('date', '')
        category = data.get('category', '')
        currency = data.get('currency') or 'USD'
        is_receipt_attachment = bool(data.get('is_receipt_attachment'))
        ocr_total_from_client = data.get('attachment_ocr_total')
        
        # Validate amount
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Validate split method
        if split_method not in ['equal', 'percentage', 'exact', 'custom']:
            return jsonify({'error': 'Invalid split method'}), 400
        
        # For custom splits, we need split_config instead of split_details
        split_config = data.get('split_config', [])  # List of {user_id, type, value}
        
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
        
        # Handle custom split method
        if split_method == 'custom':
            if not split_config or not isinstance(split_config, list):
                conn.close()
                return jsonify({'error': 'split_config is required for custom split method'}), 400
            
            # Convert amount to cents for compute_custom_splits
            total_cents = int(round(amount * 100))
            
            # Validate split_config format and convert to expected format
            members = []
            for config in split_config:
                if 'user_id' not in config or 'type' not in config:
                    conn.close()
                    return jsonify({'error': 'Each split_config entry must have user_id and type'}), 400
                
                if config['type'] not in ['amount', 'percent', 'none']:
                    conn.close()
                    return jsonify({'error': f"Invalid split type: {config['type']}. Must be 'amount', 'percent', or 'none'"}), 400
                
                # Convert amount values to cents, keep percentages as-is
                value = config.get('value')
                if config['type'] == 'amount' and value is not None:
                    value = int(round(float(value) * 100))  # Convert dollars to cents
                elif config['type'] == 'percent' and value is not None:
                    value = float(value)  # Keep as percentage
                elif config['type'] == 'none':
                    value = None
                
                members.append({
                    'user_id': int(config['user_id']),
                    'type': config['type'],
                    'value': value
                })
            
            # Compute custom splits
            try:
                split_results = compute_custom_splits(total_cents, members)
            except SplitError as e:
                conn.close()
                return jsonify({'error': f'Custom split error: {str(e)}'}), 400
            
            # Convert results back to dollars for storage
            split_details = {str(r['user_id']): r['amount_cents'] / 100.0 for r in split_results}
            
        else:
            # For non-custom methods, validate split details as before
            # Validate split details match participants
            if len(split_details) != len(participants):
                conn.close()
                return jsonify({'error': 'Split details must match number of participants'}), 400
            
            # Validate split details sum equals amount (with small tolerance for rounding)
            total_split = sum(float(amt) for amt in split_details.values())
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
        
        # Persist split breakdown for future activity detail views
        split_rows = []
        for participant_id in participants:
            participant_id = int(participant_id)
            split_key = str(participant_id)
            raw_amount = split_details.get(split_key, 0)
            share_amount = float(raw_amount) if raw_amount is not None else 0.0
            status = 'payer' if participant_id == paid_by else 'owes'
            split_rows.append((expense_id, participant_id, share_amount, status, now))
            
            # Update balances when the participant owes the payer
            if participant_id != paid_by:
                consolidate_balances(conn, group_id, paid_by, participant_id, share_amount)
        
        # Ensure payer is captured even if not part of participants list
        if paid_by not in participants:
            split_rows.append((expense_id, paid_by, 0.0, 'payer', now))
        
        if split_rows:
            conn.executemany(
                'INSERT INTO expense_splits (expense_id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)',
                split_rows
            )

        attachment_response = None
        if attachment_file and attachment_file.filename:
            if not allowed_attachment(attachment_file.filename):
                conn.close()
                return jsonify({'error': 'Unsupported attachment type. Please upload an image or PDF file.'}), 400

            metadata = save_attachment_file(expense_id, attachment_file)
            ocr_detected = ocr_total_from_client
            ocr_error = None

            if is_receipt_attachment and ocr_detected is None:
                ocr_detected, ocr_error = run_receipt_ocr(metadata['absolute_path'])

            attachment_cursor = conn.execute(
                'INSERT INTO expense_attachments (expense_id, file_path, original_filename, mime_type, is_receipt, ocr_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (
                    expense_id,
                    metadata['relative_path'],
                    metadata['original_name'],
                    metadata['mime_type'],
                    1 if is_receipt_attachment else 0,
                    ocr_detected,
                    now
                )
            )

            attachment_response = {
                'attachment_id': attachment_cursor.lastrowid,
                'file_name': metadata['original_name'],
                'mime_type': metadata['mime_type'],
                'is_receipt': is_receipt_attachment,
                'ocr_total': ocr_detected,
                'url': url_for('serve_upload', filename=metadata['relative_path'], _external=True)
            }
            if ocr_error:
                attachment_response['ocr_error'] = ocr_error
        
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
            'note': note,
            'attachment': attachment_response
        }), 201
        
    except ValueError as e:
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400
    except Exception as e:
        print(f"Error in add_expense: {str(e)}")  # Add logging for debugging
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@app.route('/api/expenses/receipt-total', methods=['POST'])
def analyze_receipt_total():
    """
    Run OCR against an uploaded receipt and return the detected total.
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401

        token = auth_header.split(' ')[1]

        try:
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        file = request.files.get('receipt')
        is_receipt_flag = request.form.get('is_receipt', 'true').lower() == 'true'

        if not file or not file.filename:
            return jsonify({'error': 'Receipt file is required'}), 400

        if not allowed_attachment(file.filename):
            return jsonify({'error': 'Unsupported file type. Upload an image or PDF.'}), 400

        temp_suffix = os.path.splitext(secure_filename(file.filename))[1] or '.tmp'
        temp_dir = os.path.join(UPLOAD_ROOT, 'tmp')
        os.makedirs(temp_dir, exist_ok=True)

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix, dir=temp_dir) as tmp:
                file.save(tmp.name)
                temp_path = tmp.name

            detected_total, error = run_receipt_ocr(temp_path) if is_receipt_flag else (None, 'Not marked as receipt')
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

        if error or detected_total is None:
            return jsonify({'error': error or 'Unable to detect a total'}), 422

        return jsonify({'detected_total': detected_total}), 200
    except Exception as e:
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
            SELECT e.expense_id, e.description, e.amount, e.paid_by, e.created_at, e.date, e.category,
                   e.note, e.split_method,
                   u.username as paid_by_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            WHERE e.group_id = ?
            ORDER BY e.created_at DESC
        """
        
        expenses = conn.execute(expenses_query, (group_id,)).fetchall()
        
        # Get recent payments for this group
        payments_query = """
            SELECT p.payment_id, p.paid_by, p.paid_to, p.amount, p.paid_at,
                   u1.username as paid_by_name, u2.username as paid_to_name
            FROM payments p
            JOIN users u1 ON p.paid_by = u1.id
            JOIN users u2 ON p.paid_to = u2.id
            WHERE p.group_id = ?
            ORDER BY p.paid_at DESC
        """
        
        payments = conn.execute(payments_query, (group_id,)).fetchall()
        
        expense_splits_map = defaultdict(list)
        expense_attachments_map = defaultdict(list)
        if expenses:
            expense_ids = [expense['expense_id'] for expense in expenses]
            placeholders_expenses = ','.join(['?' for _ in expense_ids])
            splits_query = f"""
                SELECT es.expense_id, es.user_id, es.amount, es.status, u.username
                FROM expense_splits es
                JOIN users u ON es.user_id = u.id
                WHERE es.expense_id IN ({placeholders_expenses})
                ORDER BY es.expense_id, u.username
            """
            payer_lookup = {expense['expense_id']: expense['paid_by'] for expense in expenses}
            split_rows = conn.execute(splits_query, expense_ids).fetchall()
            for split in split_rows:
                status = split['status'] or ('payer' if split['user_id'] == payer_lookup.get(split['expense_id']) else 'owes')
                expense_splits_map[split['expense_id']].append({
                    'user_id': split['user_id'],
                    'name': split['username'],
                    'amount': float(split['amount']),
                    'status': status
                })
            
            attachments_query = f"""
                SELECT attachment_id, expense_id, file_path, original_filename, mime_type, is_receipt, ocr_total
                FROM expense_attachments
                WHERE expense_id IN ({placeholders_expenses})
                ORDER BY created_at DESC
            """
            attachment_rows = conn.execute(attachments_query, expense_ids).fetchall()
            for attachment in attachment_rows:
                expense_attachments_map[attachment['expense_id']].append(map_attachment_row(attachment))
        
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
                'date': expense['date'] or expense['created_at'],
                'category': expense['category'] or '',
                'is_my_expense': expense['paid_by'] == user_id,
                'memo': expense['note'] or '',
                'split_method': expense['split_method'] or '',
                'splits': expense_splits_map.get(expense['expense_id'], []),
                'attachments': expense_attachments_map.get(expense['expense_id'], [])
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
                'is_my_payment': payment['paid_by'] == user_id,
                'is_paid_to_me': payment['paid_to'] == user_id,
                'memo': '',
                'splits': [],
                'attachments': []
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
