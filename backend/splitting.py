from typing import List, Dict


class SplitError(Exception):
    pass

def compute_custom_splits(total_cents: int, members: List[Dict]) -> List[Dict]:
    if not isinstance(total_cents, int) or total_cents < 0:
        raise SplitError("total_cents must be a non-negative integer")

    # Categorize members
    amount_members = [m for m in members if m.get('type') == 'amount']
    percent_members = [m for m in members if m.get('type') == 'percent']
    none_members = [m for m in members if m.get('type') == 'none']

    sum_amounts = sum(int(m.get('value') or 0) for m in amount_members)
    if sum_amounts > total_cents:
        raise SplitError("Sum of explicit amounts exceeds total")

    percent_sum = sum(float(m.get('value') or 0) for m in percent_members)
    if percent_sum > 100.000001:  # small epsilon
        raise SplitError("Sum of percentages exceeds 100%")

    # Allocate percent-based members (round to cents)
    percent_allocs = []
    for m in percent_members:
        pct = float(m.get('value') or 0)
        cents = int(round(total_cents * (pct / 100.0)))
        percent_allocs.append({'user_id': m['user_id'], 'amount_cents': cents, 'pct': pct})

    sum_percent_cents = sum(p['amount_cents'] for p in percent_allocs)
    remaining_after_amount_and_percent = total_cents - sum_amounts - sum_percent_cents

    # If rounding pushed us negative, make small adjustments to percent allocations
    if remaining_after_amount_and_percent < 0:
        deficit = -remaining_after_amount_and_percent
        # Reduce cents from percent_allocs, starting from largest allocated amount
        percent_allocs.sort(key=lambda p: p['amount_cents'], reverse=True)
        for p in percent_allocs:
            if deficit <= 0:
                break
            take = min(deficit, p['amount_cents'])
            p['amount_cents'] -= take
            deficit -= take
        if deficit > 0:
            raise SplitError("Unable to reconcile rounding overshoot from percent allocations")
        # recompute remaining
        sum_percent_cents = sum(p['amount_cents'] for p in percent_allocs)
        remaining_after_amount_and_percent = total_cents - sum_amounts - sum_percent_cents

    result = []

    # Add explicit amount members
    for m in amount_members:
        result.append({'user_id': m['user_id'], 'amount_cents': int(m['value'])})

    # Add percent members (from adjusted percent_allocs)
    for p in percent_allocs:
        result.append({'user_id': p['user_id'], 'amount_cents': int(p['amount_cents'])})

    # Split remaining among 'none' members
    if none_members:
        if remaining_after_amount_and_percent < 0:
            raise SplitError("Negative remainder when allocating to unspecified members")
        base = remaining_after_amount_and_percent // len(none_members)
        extra = remaining_after_amount_and_percent - base * len(none_members)
        for m in none_members:
            add = base + (1 if extra > 0 else 0)
            if extra > 0:
                extra -= 1
            result.append({'user_id': m['user_id'], 'amount_cents': add})
    else:
        # No unspecified members: if any remainder remains (due to rounding),
        # distribute leftover cents predictably (to the largest current shares)
        extra = remaining_after_amount_and_percent
        if extra < 0:
            raise SplitError("Final remainder is negative")
        if extra > 0:
            if not result:
                # No members at all — can't allocate
                raise SplitError("No members to assign remainder to")
            # Distribute 1 cent at a time to entries sorted by amount descending
            result.sort(key=lambda r: r['amount_cents'], reverse=True)
            idx = 0
            while extra > 0:
                result[idx]['amount_cents'] += 1
                extra -= 1
                idx = (idx + 1) % len(result)

    # Final sanity check: sum must equal total_cents
    if sum(r['amount_cents'] for r in result) != total_cents:
        raise SplitError("Final allocations do not sum to total")

    # Preserve the original ordering of members input
    id_order = [m['user_id'] for m in members]
    result.sort(key=lambda r: id_order.index(r['user_id']))

    return result