import sqlite3
from datetime import datetime
from collections import defaultdict

DB_NAME = "test.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def create_user(username, email, password_hash):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (username, email, password_hash, now, now),
    )
    conn.commit()
    conn.close()

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email FROM users")
    users = cursor.fetchall()
    conn.close()
    return users

def create_group(name, description, created_by):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO groups (group_name, group_description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (name, description, created_by, now, now),
    )
    conn.commit()
    conn.close()

def get_group_expenses(group_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT description, amount, paid_by FROM expenses WHERE group_id = ?", (group_id,))
    expenses = cursor.fetchall()
    conn.close()
    return expenses

def add_expense(group_id, description, amount, paid_by):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute(
        "INSERT INTO expenses (group_id, description, amount, paid_by, created_at) VALUES (?, ?, ?, ?, ?)",
        (group_id, description, amount, paid_by, now),
    )

    # split equally among all group members for now
    cursor.execute("SELECT user_id FROM members WHERE group_id = ?", (group_id,))
    members = [m[0] for m in cursor.fetchall()]
    share = round(amount / len(members), 2)

    for m in members:
        if m != paid_by:
            cursor.execute(
                "INSERT INTO balances (group_id, lender, borrower, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (group_id, paid_by, m, share, now, now),
            )

    conn.commit()
    conn.close()

def record_payment(paid_by, paid_to, amount):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute(
        "INSERT INTO payments (paid_by, paid_to, amount, paid_at) VALUES (?, ?, ?, ?)",
        (paid_by, paid_to, amount, now),
    )

    # fetch the existing balance from lender → borrower
    cursor.execute(
        "SELECT amount FROM balances WHERE lender = ? AND borrower = ?",
        (paid_to, paid_by)
    )
    row = cursor.fetchone()
    if row:
        current_balance = row[0]
        new_balance = max(0, current_balance - amount)
        cursor.execute(
            "UPDATE balances SET amount = ?, updated_at = ? WHERE lender = ? AND borrower = ?",
            (new_balance, now, paid_to, paid_by)
        )
    
    conn.commit()
    conn.close()


def get_user_balances(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT lender, borrower, amount
        FROM balances
        WHERE lender = ? OR borrower = ?
    """, (user_id, user_id))
    balances = cursor.fetchall()
    conn.close()
    return balances

def get_net_balances():
    """
    Returns a dictionary mapping user_id -> net balance.
    Positive = user is owed money
    Negative = user owes money
    """
    conn = get_connection()
    cursor = conn.cursor()

    # fetch all balances
    cursor.execute("SELECT lender, borrower, amount FROM balances")
    balances = cursor.fetchall()

    net = defaultdict(float)
    for lender, borrower, amount in balances:
        net[lender] += amount    # lender is owed
        net[borrower] -= amount  # borrower owes

    conn.close()
    return dict(net)