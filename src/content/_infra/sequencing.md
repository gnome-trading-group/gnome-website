# One counter

Each trading session has exactly one sequence: a single atomic counter.
Every message published to any ring in the session takes the next
number.

```java
public long next() {
    return sequence.incrementAndGet();   // one LOCK XADD, a few ns
}
```

## What shares the sequence

```
 market data ───┐
 intents ───────┤
 strategy fills ┤
 metrics ───────┤
 latency ───────┼──▶  1, 2, 3, 4, 5, 6, 7, 8, 9, ...
 orders ────────┤
 OMS reports ───┤
 gateway timing ┘
```

Market data, decisions, orders, fills and timings all land on one
timeline. That gives us a **total order** over everything the strategy
saw and did. There's no question of "did the fill arrive before or after
that tick?" The numbers say.

## Causes, not guesses

Every intent records the sequence number of the market event that
triggered it. Every order records the intent it came from. So for any
order you can walk backwards:

```
 order #9312  ◀── intent #9307  ◀── book update #9305
```

When a fill looks odd, we don't reconstruct what probably happened. We
look it up.

## Enforced at startup

Every ring registers with the sequence when it's created. When a session
starts, it checks that every ring on the sequence has a journal source.
If one doesn't, the session refuses to start. A new buffer can't
silently skip the journal.

See `journal.md` for where these numbers end up.
