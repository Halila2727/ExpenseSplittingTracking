#!/usr/bin/env python3
"""
Database initialization script for Centsible
Creates the database schema
"""

import sqlite3
import os

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
    
    print("Database schema created successfully!")
    
    conn.commit()
    conn.close()
    print("Database initialization complete!")

if __name__ == "__main__":
    print("Initializing Centsible Database...")
    init_database()

