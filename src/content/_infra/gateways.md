# Order gateways

Trading sessions don't hold venue keys. Every order goes through an
**order gateway**: one process per venue, shared by every session that
trades there.

```
 session A ─┐    ┌─────────────────────── gateway ────────────────────────┐
 session B ─┼──▶ │ ingress   hello check · kill switches                  │
 session C ─┘    │           self-trade check · per-session caps          │
                 │    │                                                   │
                 │    ▼                                                   │
                 │ account lane   cancels first, then a fair              │
                 │                share per session · rate pacing         │
                 │                · signing                               │
                 │    │                                     ▲             │
                 └────┼─────────────────────────────────────┼─────────────┘
                      ▼                                     │
                     venue ─── events + catch-up ───────▶ reader
                                                            │
  numbered reports, replayable per session ◀────────────────┘
```

## What the gateway guarantees

- **Exactly one report per order.** Reports are numbered per session and
  kept in a replay ring, so a session that blinks can catch up without
  guessing.
- **Cancels jump the queue.** When a venue's budget is tight, getting
  out of a position matters more than getting in.
- **Fair sharing.** Sessions on the same account share its rate budget
  by weight. A noisy strategy can't starve a quiet one.
- **No self-trades.** The gateway checks across sessions before an
  order leaves.
- **Survives restarts.** An on-host ownership log records which orders
  belong to whom. Planned stops cancel everything; rolling upgrades
  hand the open orders to the next process.

Signing runs in native code where it matters.

## Paper trading is the same gateway

```
 live:   ingress ─▶ account lane ─▶ venue
 paper:  ingress ─▶ simulated lane ─▶ simulated books ◀── live shard data
```

A paper gateway is the same process with the venue swapped out. Orders
go through the **same admission, caps and rate limits**, and match
against simulated books fed from live market data. Reports use the same
protocol, so a session can't tell paper from live. A parity test checks
that the paper gateway agrees with the backtest simulator.
