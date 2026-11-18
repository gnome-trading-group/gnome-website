# Failing closed

When something is uncertain, the system stops trading. Risk is enforced
in layers, and each layer works on its own.

```
 ┌───────────────────────────────────────────────────────────┐
 │ strategy     can only express intent                      │
 ├───────────────────────────────────────────────────────────┤
 │ OMS          pre-trade limits · market-data health ·      │
 │              loss and reject latches · kill switches      │
 ├───────────────────────────────────────────────────────────┤
 │ gateway      kill switches (again) · per-session and      │
 │              per-account caps · venue rate budgets        │
 ├───────────────────────────────────────────────────────────┤
 │ break glass  cancel an account's orders at the venue,     │
 │              without going through any of the above       │
 └───────────────────────────────────────────────────────────┘
```

## Pre-trade

Before an order leaves the OMS it passes:

- order size and notional limits;
- position and open-order limits;
- price collars;
- committed capital;
- the venue's own rules (tick, lot, minimum size).

Limits can be scoped globally, or per venue, strategy or listing, and
combinations of those.

## Latches

Some breaches don't fix themselves. A loss limit or a run of venue
rejects cancels everything in scope and **stays halted** until a person
resumes it. Making the money back doesn't lift the halt.

## Bad data blocks trading

If a book's shard goes quiet, drops messages or stalls, that book is
marked bad. The OMS then refuses new orders and modifies on it until a
clean book arrives. Cancels still go through.

## Fail closed, everywhere

- A live session with missing risk policies refuses every order.
- Stale risk data blocks new orders.
- A policy that can't be built kills its own target.
- A gateway refuses orders until it has read the kill switches.
- A session that can't account for an order from before it started
  halts instead of guessing.
- If the ledger falls behind, the OMS halts, so nothing fills without
  being recorded.

Kill switches are enforced in both the OMS and the gateway. Turning
something off should never depend on one component working.
