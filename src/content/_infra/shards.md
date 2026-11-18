# Shards

Market data is collected by **shards**: one process per host, each
owning a set of streams (one stream per book). A shard does three jobs at
once.

```
 ┌────────────────────────────── shard ──────────────────────────────┐
 │                                                                   │
 │ connections ──▶ decode ──▶ book ──▶ ring ──┬──▶ minute files      │
 │ (many books                                │                      │
 │  per socket)                               └──▶ multicast to      │
 │                                                 leased sessions   │
 │                                                                   │
 │ raw frames ──▶ background thread ──▶ raw archive                  │
 └───────────────────────────────────────────────────────────────────┘
```

1. **Collect.** It builds full-depth books for every stream it owns and
   writes compressed binary minute files straight to storage. Each
   minute has exactly one writer: the first write wins and later
   attempts are no-ops.
2. **Publish.** It multicasts the streams that live sessions have
   leased. Flow control follows the *fastest* receiver, so one slow
   session can't hold back the rest.
3. **Report.** It sends a status beat every second. Sessions treat
   silence as a reason to stop trading that book.

## A fleet that places itself

Nobody assigns streams to shards by hand. A reconciler runs every
minute:

```
 collection rules ─┐
                   ├──▶ targets ──▶ placement ──▶ start / stop / merge
 session leases ───┘                    │           / relieve shards
                                        ▼
                         moves are make-before-break,
                         cut over on a minute boundary
```

- **Research** traffic runs on cheap, interruptible capacity.
- **Live** traffic runs on dedicated hosts, placed next to the venue.
- Sessions poll their lease. When a stream moves, they follow it.

## Books you can trust

A book is in one of a few states: subscribing, live, suspect, stale, or
quarantined.

- **Gap detection** uses whatever the venue gives us: sequence numbers,
  hash chains, or a cross-check against the venue's own best price. A
  REST probe double-checks top-of-book on top of that.
- **Recovery.** A bad book is flagged to sessions immediately, then only
  that book is resynced. Books that keep failing are quarantined, with
  backoff.

## Lossless rolls

Venues drop long-lived connections on a schedule. We don't wait for it
to happen:

```
  old conn  ═════════════════════╗
                                 ║  hand over at the exact
  new conn        ═══════════════╩══════════════════════▶
                  │ replay log │  venue sequence position
```

Before the venue closes a connection, a replacement opens and catches
up. Each book knows exactly where it is in the venue's sequence. On
handover, the new connection publishes only what the old one never did,
or waits until it catches up. Nothing is dropped and nothing is sent
twice.
