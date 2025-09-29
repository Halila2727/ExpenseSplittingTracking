import sqlite3
from datetime import datetime

conn = sqlite3.connect("test.db")

conn.execute("PRAGMA foreign_keys = ON;")
cursor = conn.cursor()

now = datetime.now().isoformat()

# --- Insert sample users ---
users = [
    ("zara123", "zara@example.com", "hashed_password1", now, now),
    ("ahnaf456", "ahnaf@example.com", "hashed_password2", now, now),
    ("halil789", "halil@example.com", "hashed_password3", now, now)
]

cursor.executemany("""
INSERT INTO users (username, email, password_hash, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
""", users)

# --- Insert sample groups ---
groups = [
    ("Trip to NYC", "Expenses for NYC trip", 1, now, now, None),
    ("Weekend Dinner", "Dinner with friends", 2, now, now, None)
]

cursor.executemany("""
INSERT INTO groups (group_name, group_description, created_by, created_at, updated_at, deleted_at)
VALUES (?, ?, ?, ?, ?, ?)
""", groups)

# --- Insert sample members ---
members = [
    (1, 1, now, None),
    (2, 1, now, None),
    (3, 1, now, None),
    (2, 2, now, None),
    (3, 2, now, None)
]

cursor.executemany("""
INSERT INTO members (user_id, group_id, joined_at, deleted_at)
VALUES (?, ?, ?, ?)
""", members)

# --- Insert sample expenses ---
expenses = [
    (1, "Taxi fare", 45.50, 1, now),
    (1, "Lunch", 30.00, 2, now),
    (2, "Dinner", 60.00, 2, now)
]

cursor.executemany("""
INSERT INTO expenses (group_id, description, amount, paid_by, created_at)
VALUES (?, ?, ?, ?, ?)
""", expenses)

# --- Insert sample balances ---
balances = [
    (1, 1, 1, 2, 15.25, now, now),
    (2, 1, 1, 3, 10.00, now, now)
]

cursor.executemany("""
INSERT INTO balances (balance_id, group_id, lender, borrower, amount, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
""", balances)

# --- Insert sample payments ---
payments = [
    (1, 2, 1, 15.25, now),
    (2, 3, 1, 10.00, now)
]

cursor.executemany("""
INSERT INTO payments (payment_id, paid_by, paid_to, amount, paid_at)
VALUES (?, ?, ?, ?, ?)
""", payments)

conn.commit()
conn.close()

print("Sample data inserted successfully!")
