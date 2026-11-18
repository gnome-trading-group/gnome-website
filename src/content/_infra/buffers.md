# Rings and agents

Inside a trading process there are no locks, no queues of objects and no
callbacks. There are **agents** and **rings**.

## Agents

An agent is a duty cycle: `doWork()` returns how much it did, and an idle
strategy decides what to do with the rest of the loop.

```
 while (running) {
     int work = agent.doWork();      // poll rings, do a bounded batch
     idle.idle(work);                // spin, back off, or sleep
 }
```

| Agent kind | Thread                           | When idle       |
|------------|----------------------------------|-----------------|
| hot path   | pinned to an isolated core       | busy-spin       |
| hot path   | sharing a core                   | spin → yield → park |
| background | anywhere                         | sleep           |

Feed, strategy, OMS and order entry are hot path. Journal writing,
ledger, heartbeats and risk syncing are background.

## Rings

Each ring has one producer and a fixed number of fixed-size slots. A slot
holds a sequence number, a publish timestamp, a schema id and up to 1 KB
of binary payload. Every schema we use has a test proving it fits.

```
            producer
               │ claim → encode in place → publish
               ▼
  ┌────┬────┬────┬────┬────┬────┬────┬────┐
  │ 41 │ 42 │ 43 │ 44 │ 45 │    │    │    │   one ring
  └────┴────┴────┴────┴────┴────┴────┴────┘
          ▲              ▲
     slow reader     fast reader
```

There are two kinds of reader:

- **Gating readers** hold the producer back. If one falls a full ring
  behind, the producer waits. The strategy, OMS, journal and order
  entry read this way, because losing their messages isn't an option.
- **Lapping readers** never slow anyone down. If they fall behind they
  get lapped, and they count what they missed. Nice-to-have consumers
  read this way.

A gating reader that stops moving would stall its producer, so every
agent reports a cycle counter. A heartbeat watches those counters and
raises an alert if one stops advancing.

## Nothing allocates

The hot path is zero-allocation:

- messages are encoded into pre-allocated slots with flyweights;
- buffers are off-heap and pre-sized;
- even the clock is allocation-free.

Allocation tests fail the build if a hot-path agent creates garbage.
Anything that has to allocate (compression, HTTP, uploads) runs on a
side thread or in a separate process.
