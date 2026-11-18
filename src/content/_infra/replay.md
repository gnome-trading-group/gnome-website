# Same code, four places

A strategy goes through four stages, and the strategy runtime and OMS are
**identical** in all of them. Only the source of market data and the
source of fills change.

```
            market data            fills
          ┌──────────────┬───────────────────────┐
 research │ history (S3) │ simulator             │  Python, notebooks
 backtest │ history (S3) │ simulator             │  local or batch
 paper    │ live shards  │ simulator in gateway  │  real infrastructure
 live     │ live shards  │ the venue             │  real money
          └──────────────┴───────────────────────┘
```

## Backtests run production code

The backtester doesn't reimplement the strategy or the OMS. It runs the
production agents in a loop under a simulated clock, calling their duty
cycles one step at a time.

```
 history ──▶ ┌──────────── simulated clock ─────────────┐
             │ strategy agent ─▶ real OMS ─▶ simulator  │
             │       ▲                          │       │
             │       └──── exec reports ◀───────┘       │
             └──────────────────────────────────────────┘
```

The simulator models:

- **latency**, per connection, delivered in order the way TCP is;
- **queue position**, with pluggable models from optimistic to
  pessimistic;
- **fees**, using the fee schedule in force at the time of each fill;
- **venue mechanics** like self-trade prevention and paired markets.

Gaps in recorded data replay as bad books, so the OMS stops trading
through them, just like it would live.

## Reproducible by construction

A run pins its code commit and reads simulation parameters as they
stood at a fixed point in time. Rerun it next month and you get the
same fills.

## From Python

Researchers write strategies in Python or Java. Python strategies run
inside the same JVM through a bridge, so a notebook backtest exercises
the same OMS a live session does. Parameter sweeps fan out to batch
compute and come back as reports.
