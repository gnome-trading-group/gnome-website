# The journal

Every message in a trading session is written to disk in sequence order:
every tick the strategy saw, every intent, order, fill and timing.

```
  rings (all on one sequence)
    │ │ │ │ │ │ │ │
    ▼ ▼ ▼ ▼ ▼ ▼ ▼ ▼
  ┌──────────────────────┐
  │ journal agent        │  gating reader on every ring
  │  reorder buffer      │  producers number independently, so
  │  → strict seq order  │  arrivals can be slightly out of order
  └──────────┬───────────┘
             ▼
   segment-00041.bin      memory-mapped, rolled by size or time
             │ seal
             ▼
   segment-00041.done
             │ separate process: compress + upload + delete
             ▼
   object storage  /<session>/segment-00041.zst
```

## Format

A segment is a small header followed by records:

```
 ┌─────────┬──────────┬────────┬──────────┬────────┬───────────┐
 │ seq u64 │ ts  u64  │ source │ template │ length │ payload … │
 └─────────┴──────────┴────────┴──────────┴────────┴───────────┘
```

- **seq** is the session sequence (see `sequencing.md`).
- **source** says which ring the record came from. Source ids are never
  reused.
- **payload** is the raw binary message, exactly as it crossed the ring.

## Design choices

- **Off the hot path.** Journaling is a background agent. Compression and
  uploads happen in a different process entirely, so the trading JVM
  never touches a socket or a compressor for it.
- **No fsync.** If the trading process dies, the page cache still has
  the data. Waiting on disk would cost latency to guard against a host
  failure, and a host failure ends the session anyway.
- **Schemas evolve.** The reader migrates older message versions forward,
  so a journal from months ago still decodes after the schemas change.
- **Readable without Java.** Our Python tooling decodes journals
  directly, so research can query a live session's history.

## Why bother

Because "what happened?" has an exact answer. Every number on a
dashboard, every fill in the ledger and every latency percentile traces
back to records in a journal.
