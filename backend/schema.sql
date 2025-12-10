PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS groups (
    group_id INTEGER PRIMARY KEY NOT NULL,
    group_name TEXT NOT NULL,
    group_description TEXT,
    join_code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS members (
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    joined_at TEXT,
    deleted_at TEXT,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    expense_id INTEGER PRIMARY KEY NOT NULL,
    group_id INTEGER NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    paid_by INTEGER NOT NULL,
    note TEXT,
    date TEXT,
    category TEXT,
    currency TEXT,
    split_method TEXT,
    created_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (paid_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expense_splits (
    split_id INTEGER PRIMARY KEY NOT NULL,
    expense_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT,
    created_at TEXT,
    FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS balances (
    balance_id INTEGER PRIMARY KEY NOT NULL,
    group_id INTEGER NOT NULL,
    lender INTEGER NOT NULL,
    borrower INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (lender) REFERENCES users(id),
    FOREIGN KEY (borrower) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY NOT NULL,
    paid_by INTEGER NOT NULL,
    paid_to INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    paid_at TEXT,
    description TEXT,
    currency TEXT,
    group_id INTEGER NOT NULL,
    FOREIGN KEY (paid_by) REFERENCES users(id),
    FOREIGN KEY (paid_to) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

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
);