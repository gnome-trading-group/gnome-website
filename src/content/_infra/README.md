# The workshop

You found the part of the site we didn't link to. These notes describe how
our trading system is put together. They stay at the architecture level:
no venues, no parameters, no alpha.

```
                   ┌──────────────────────────────────┐
   venues ═══ws═══▶│ SHARDS    collect · build books  │ ──▶ minute files
                   └──────────────────────────────────┘
                                    │ multicast
                                    ▼
                   ┌──────────────────────────────────┐
                   │ SESSION   strategy · OMS ·       │ ──▶ journal
                   │           risk · journal         │
                   └──────────────────────────────────┘
                                    │ orders / reports
                                    ▼
                   ┌──────────────────────────────────┐
   venues ◀══api═══│ GATEWAYS  sign · pace · track    │
                   └──────────────────────────────────┘
```

## Read in any order

    dataflow.md     one tick, end to end
    buffers.md      rings, agents, and why nothing allocates
    sequencing.md   one counter to order everything
    journal.md      every message, on disk, in order
    shards.md       market data collection that rebalances itself
    gateways.md     where orders leave the building
    risk.md         failing closed, at every layer
    replay.md       research, backtest, paper, live: same code

Open one with `vim <file>`. `:q` to get back out.
