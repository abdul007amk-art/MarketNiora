# MarketNiora — Production Hardening v1

## Purpose

This package hardens the existing MarketNiora architecture without changing
any locked hierarchy, Rotation v1.2 weights/caps, Theme hierarchy,
SS-1.0-R3 weights/formula, Shariah behavior, or separation invariants.

## Implemented hardening contracts

1. **Indian-market volume validation**
   - 2x 20D volume is an abnormal candidate, not automatic confirmation.
   - Block/bulk deals, circuit moves, and material-event days are explicitly
     non-confirming/event-adjusted.
   - Volume-up + price-down is classified as distribution risk.
   - The existing 2x -> 2–4 cooling -> 1.5x second expansion -> breakout/retest
     or EMA20 pullback sequence remains intact.

2. **Liquidity/free-float gates**
   - Valid volume confirmation requires sufficient liquidity and free float.
   - This is a gate, not a score-weight change.

3. **Residual risk**
   - Risk items already captured by Business Quality or Valuation are flagged
     as duplicate candidates rather than silently double-penalized.
   - Material uncaptured residual risk is surfaced separately.

4. **Formal decision state machine**
   - WATCH -> WAIT -> READY
   - READY -> WAIT on partial confirmation loss
   - READY -> INVALIDATED on hard invalidation
   - WAIT -> WATCH when setup deteriorates or opportunity cost becomes material
   - Every transition is designed to be logged with timestamp/evidence/version.

5. **Score correlation audit**
   - Pearson correlation is diagnostic only.
   - No locked Stock Score weight is changed.
   - High-overlap feature pairs are surfaced for a residualization review.

6. **ENE quantification**
   - Cyclical businesses can compare reported vs normalized earnings and P/E.
   - ENE does not create a new Stock Score block.

7. **Governance ledger**
   - Material decisions carry data-as-of time, knowledge-time evidence,
     engine versions, evidence hashes, entry trigger, invalidation and reason.
   - Future-knowledge evidence is rejected.

## Explicit non-changes

- Sector -> Sub-sector -> Stock Group -> Stock remains locked.
- Theme -> Sub-theme -> Industry -> Value Chain -> Company -> Stock remains locked.
- Rotation v1.2 formula remains unchanged.
- External-index breadth has zero role in Rotation.
- SS-1.0-R3 weights/formula remain unchanged.
- Feature Engine and Score Engine remain separate.
- Theme and Rotation remain independent of Stock Score.
- Shariah remains display-only and score/rotation-neutral.
- No numeric Stock Score is invented by the hardening layer.

## Remaining production gates

This package does **not** claim that MarketNiora is backtest-validated.

Before a production READY certificate:
- execute repository CI/runtime tests;
- build a point-in-time historical data harness;
- include corporate actions, delistings, new listings, circuits,
  block/bulk trades, slippage, STT/brokerage and execution delay;
- run walk-forward/out-of-sample tests;
- stratify by market regime;
- preserve the resulting decision/evidence snapshots.

## Test rule

All hardening functions are pure and deterministic and must be covered by
regression tests before being wired into production orchestration.
