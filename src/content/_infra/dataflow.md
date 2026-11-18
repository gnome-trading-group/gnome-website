# One tick, end to end

Follow a single book update from a venue to an order and back.

```
 venue
   │  1. websocket frame (TLS on our own native sockets)
   ▼
 SHARD ─────────────────────────────────────────────────────────┐
   │  2. decode  →  apply to full-depth book  →  check for gaps │
   │  3. write fixed-size binary record to a ring               │
   │  4a. append to this minute's file  ──────────▶ S3          │
   │  4b. multicast to every session that leased it             │
 ──┼────────────────────────────────────────────────────────────┘
   ▼
 SESSION ───────────────────────────────────────────────────────┐
   │  5. feed agent stamps it with the session sequence         │
   │  6. strategy reads it, decides what it wants (an intent)   │
   │  7. OMS diffs intent vs. live orders, runs risk checks     │
   │  8. order goes out over the gateway link                   │
 ──┼────────────────────────────────────────────────────────────┘
   ▼
 GATEWAY
   │  9. admission, fair queueing, signing, rate pacing
   ▼
 venue  ── ack / fill ──▶ gateway ──▶ OMS ──▶ strategy
```

## Things worth noticing

- **Strategies never send orders.** They publish an *intent*: the
  quotes they want resting, and anything they want to take now. The OMS
  works out the orders that get the venue to that state.
- **Fills before ticks.** The strategy drains execution reports before
  it looks at market data, so it never quotes off a position it no
  longer has.
- **Positions update first.** The OMS applies a fill to positions
  before it forwards the report to the strategy.
- **Every hop is a ring or a socket.** Inside a process, components
  share nothing but sequenced ring buffers. Between processes it's
  multicast or a dedicated link. Nothing calls anything else directly.
- **Every message is journaled** on one sequence, so the whole chain
  above can be read back in the exact order it happened.
  See `journal.md`.

## Prices are integers

Prices and sizes are fixed-point `long`s end to end. No floats touch an
order, a position or a fill. The ledger and the UI share the same
integer math, so they never disagree by a rounding error.
