#!/usr/bin/env python3
"""
Database initialization script for Centsible
Creates the database schema and optionally populates with sample data
"""

import sqlite3
import os
from datetime import datetime

def init_database():
    """Initialize the database with schema"""
    
    # Connect to database (creates if doesn't exist)
    conn = sqlite3.connect('test.db')
    cursor = conn.cursor()
    
    # Enable foreign key constraints
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Read and execute schema
    with open('schema.sql', 'r') as f:
        schema_sql = f.read()
    
    cursor.executescript(schema_sql)
    
    print("✅ Database schema created successfully!")
    
    # Ask if user wants sample data
    add_sample = input("Would you like to add sample data? (y/n): ").lower().strip()
    
    if add_sample == 'y':
        add_sample_data(cursor)
    
    conn.commit()
    conn.close()
    print("✅ Database initialization complete!")

def add_sample_data(cursor):
    """Add sample data to the database"""
    
    now = datetime.now().isoformat()
    
    # Sample users (with hashed passwords)
    import bcrypt
    
    users = [
        ("zara123", "zara@example.com", bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'), now, now),
        ("ahnaf456", "ahnaf@example.com", bcrypt.hashpw("password456".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'), now, now),
        ("halil789", "halil@example.com", bcrypt.hashpw("password789".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'), now, now)
    ]
    
    cursor.executemany("""
    INSERT INTO users (username, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    """, users)
    
    # Sample groups
    groups = [
        ("Trip to NYC", "Expenses for NYC trip", 1, now, now, None),
        ("Weekend Dinner", "Dinner with friends", 2, now, now, None)
    ]
    
    cursor.executemany("""
    INSERT INTO groups (group_name, group_description, created_by, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, groups)
    
    # Sample members
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
    
    # Sample expenses
    expenses = [
        (1, "Taxi fare", 45.50, 1, "Taxi from airport", now, "transport", "USD", "equal", now),
        (1, "Lunch", 30.00, 2, "Lunch at restaurant", now, "food", "USD", "equal", now),
        (2, "Dinner", 60.00, 2, "Dinner with friends", now, "food", "USD", "equal", now)
    ]
    
    cursor.executemany("""
    INSERT INTO expenses (group_id, description, amount, paid_by, note, date, category, currency, split_method, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, expenses)
    
    # Sample balances
    balances = [
        (1, 1, 1, 2, 15.25, now, now),
        (2, 1, 1, 3, 10.00, now, now)
    ]
    
    cursor.executemany("""
    INSERT INTO balances (balance_id, group_id, lender, borrower, amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, balances)
    
    # Sample payments
    payments = [
        (1, 2, 1, 15.25, now),
        (2, 3, 1, 10.00, now)
    ]
    
    cursor.executemany("""
    INSERT INTO payments (payment_id, paid_by, paid_to, amount, paid_at)
    VALUES (?, ?, ?, ?, ?)
    """, payments)
    
    print("✅ Sample data added successfully!")
    print("\nSample user accounts:")
    print("Email: zara@example.com, Password: password123")
    print("Email: ahnaf@example.com, Password: password456")
    print("Email: halil@example.com, Password: password789")

if __name__ == "__main__":
    print("🚀 Initializing Centsible Database...")
    init_database()

