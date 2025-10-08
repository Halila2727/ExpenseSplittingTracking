import sqlite3
from collections import defaultdict
from crud import (
    create_user,
    create_group,
    add_expense,
    get_all_users,
    get_group_expenses,
    get_user_balances,
    record_payment,
    get_net_balances
)

print("=== TESTING CRUD OPERATIONS ===")

print("\nCreating users...")
create_user("Zara", "zara@example.com", "pass123")
create_user("Ahnaf", "ahnaf@example.com", "pass456")
create_user("Halil", "halil@example.com", "pass789")

users = get_all_users()
print("Users in database:")
for u in users:
    print(u)

print("\nCreating group...")
conn = sqlite3.connect("test.db")
cursor = conn.cursor()
cursor.execute("SELECT id FROM users WHERE username = 'Zara'")
zara_id = cursor.fetchone()[0]

create_group("Dinner Out", "Friday dinner with friends", zara_id)
cursor.execute("SELECT group_id FROM groups WHERE group_name = 'Dinner Out'")
group_id = cursor.fetchone()[0]
conn.close()

print(f"Group created: {group_id}")

conn = sqlite3.connect("test.db")
cursor = conn.cursor()
cursor.execute("SELECT id FROM users WHERE username = 'Ahnaf'")
ahnaf_id = cursor.fetchone()[0]
cursor.execute("SELECT id FROM users WHERE username = 'Halil'")
halil_id = cursor.fetchone()[0]

members = [(zara_id, group_id), (ahnaf_id, group_id), (halil_id, group_id)]
for m in members:
    cursor.execute(
        "INSERT OR IGNORE INTO members (user_id, group_id, joined_at) VALUES (?, ?, datetime('now'))", m
    )
conn.commit()
conn.close()
print("Added Zara, Ahnaf, and Halil to group.")

print("\nAdding expenses...")
add_expense(group_id, "Pizza", 60.00, zara_id)
add_expense(group_id, "Movie tickets", 45.00, ahnaf_id)

print("\nGroup expenses:")
expenses = get_group_expenses(group_id)
for e in expenses:
    print(e)

def get_username(user_id, cursor):
    cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    result = cursor.fetchone()
    return result[0] if result else f"User {user_id}"

def get_group_name(group_id, cursor):
    cursor.execute("SELECT group_name FROM groups WHERE group_id = ?", (group_id,))
    result = cursor.fetchone()
    return result[0] if result else f"Group {group_id}"

def print_balance_report(title, cursor):
    cursor.execute("SELECT group_id, lender, borrower, amount FROM balances WHERE amount > 0")
    balances = cursor.fetchall()

    print(f"\n=== {title} ===\n")
    for group_id, lender, borrower, amount in balances:
        group_name = get_group_name(group_id, cursor)
        lender_name = get_username(lender, cursor)
        borrower_name = get_username(borrower, cursor)
        print(f"💸 In '{group_name}', {borrower_name} owes {lender_name} ${amount:.2f}")

    # --- Net balances commented out ---
    # net_balances = defaultdict(float)
    # for group_id, lender, borrower, amount in balances:
    #     net_balances[lender] += amount
    #     net_balances[borrower] -= amount
    #
    # print(f"\n=== NET BALANCES ({title}) ===\n")
    # for user_id, balance in net_balances.items():
    #     name = get_username(user_id, cursor)
    #     if balance > 0:
    #         print(f"{name} is owed ${balance:.2f}")
    #     elif balance < 0:
    #         print(f"{name} owes ${-balance:.2f}")
    #     else:
    #         print(f"{name} is settled up")

conn = sqlite3.connect("test.db")
cursor = conn.cursor()

print_balance_report("BALANCES BEFORE PAYMENT", cursor)

record_payment(ahnaf_id, zara_id, 20.00)
print("\nRecording payment: Ahnaf paid Zara $20")

print_balance_report("BALANCES AFTER PAYMENT", cursor)

conn.close()
