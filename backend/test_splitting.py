from backend.splitting import compute_custom_splits, SplitError

def cents(d):
    return int(round(d * 100))

def dollars(c):
    return f"${c/100:.2f}"

def print_case(title, total_cents, members):
    print("="*60)
    print(title)
    print(f"Total: {dollars(total_cents)} ({total_cents} cents)")
    print("Members input:")
    for m in members:
        if m['type'] == 'amount':
            print(f" - user_id={m['user_id']}: amount = {dollars(int(m['value']))} ({int(m['value'])} cents)")
        elif m['type'] == 'percent':
            print(f" - user_id={m['user_id']}: percent = {float(m['value'])}%")
        else:
            print(f" - user_id={m['user_id']}: unspecified (none)")
    try:
        allocations = compute_custom_splits(total_cents, members)
    except SplitError as e:
        print("SplitError:", str(e))
        return
    except Exception as e:
        print("Unexpected error:", str(e))
        return

    print("\nAllocations:")
    for alloc in allocations:
        amt = alloc['amount_cents']
        pct = (amt / total_cents) * 100 if total_cents > 0 else 0
        print(f" - user_id={alloc['user_id']}: {dollars(amt)} ({amt} cents) -> {pct:.6f}%")

    total_alloc = sum(a['amount_cents'] for a in allocations)
    print(f"\nSum of allocations: {dollars(total_alloc)} ({total_alloc} cents)")
    if total_alloc == total_cents:
        print("Check: OK — allocations sum to total.")
    else:
        print("Check: MISMATCH — allocations do NOT sum to total!")
    print("="*60 + "\n")

def run_tests():
    # Test 1: Percent-only
    total = cents(100.00)
    members = [
        {'user_id': 1, 'type': 'percent', 'value': 50},
        {'user_id': 2, 'type': 'percent', 'value': 50},
    ]
    print_case("Test 1: Percent-only (50% / 50%)", total, members)

    # Test 2: Amount-only + none
    total = cents(60.00)
    members = [
        {'user_id': 1, 'type': 'amount', 'value': cents(20.00)},
        {'user_id': 2, 'type': 'none', 'value': None},
        {'user_id': 3, 'type': 'none', 'value': None},
    ]
    print_case("Test 2: Amount-only + unspecified (20$, rest split equally)", total, members)

    # Test 3: Mixed percent + amount + rounding
    total = cents(100.00)
    members = [
        {'user_id': 1, 'type': 'amount', 'value': cents(33.33)},
        {'user_id': 2, 'type': 'percent', 'value': 33.33},
        {'user_id': 3, 'type': 'none', 'value': None},
    ]
    print_case("Test 3: Mixed (explicit $33.33, 33.33%, rest unspecified)", total, members)

    # Test 4: Shares -> simulate shares on client: 1,2,3 -> convert to percents then percent type
    total = cents(120.00)
    shares = [1, 2, 3]  # user1:1, user2:2, user3:3
    total_shares = sum(shares)
    members = [
        {'user_id': 1, 'type': 'percent', 'value': (shares[0] / total_shares) * 100},
        {'user_id': 2, 'type': 'percent', 'value': (shares[1] / total_shares) * 100},
        {'user_id': 3, 'type': 'percent', 'value': (shares[2] / total_shares) * 100},
    ]
    print_case("Test 4: Shares simulated as percents (1:2:3)", total, members)

    # Test 5: Edge rounding case - percents that create fractional cents
    total = cents(1.00)  # $1.00 -> 100 cents
    members = [
        {'user_id': 1, 'type': 'percent', 'value': 33.33},
        {'user_id': 2, 'type': 'percent', 'value': 33.33},
        {'user_id': 3, 'type': 'percent', 'value': 33.34},
    ]
    print_case("Test 5: Rounding edge (33.33%, 33.33%, 33.34%) on $1.00", total, members)

    # Error tests
    print("Error tests:\n")

    # Error 1: explicit amounts exceed total
    total = cents(50.00)
    members = [{'user_id':1,'type':'amount','value':cents(60)}]
    print_case("Error Test 1: explicit amounts > total (should error)", total, members)

    # Error 2: percent sum > 100
    total = cents(100.00)
    members = [{'user_id':1,'type':'percent','value':60},{'user_id':2,'type':'percent','value':50}]
    print_case("Error Test 2: percents sum > 100 (should error)", total, members)

if __name__ == "__main__":
    run_verbose_tests()