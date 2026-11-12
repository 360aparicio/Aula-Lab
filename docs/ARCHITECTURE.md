# GTO Studio Architecture

## 1. System Overview

GTO Studio is structured into three decoupled layers:

```
┌────────────────────────────────────────────────────────┐
│                   Capa A: Interface                    │
│   React 19 · Tailwind CSS v4 · 13x13 Range Matrix      │
│   Decision Tree Viewer · Strategy Heatmap · GTO Trainer│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Capa B: Engine                      │
│   Exact 7-Card Evaluator · 1326 Combos & Blockers      │
│   Betting Tree Builder · DCFR (α=1.5, β=0, γ=2.0)      │
│   CFR+ · Kuhn Benchmark · Async Time-Sliced Runner     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                Capa C: Persistence                     │
│   Offline Browser DB · Scenario Schemas · JSON Export  │
│   Trainer Elo History · In-Memory Showdown Matrix      │
└────────────────────────────────────────────────────────┘
```

## 2. Directory Layout

- `src/engine/`:
  - `cards.ts`: Rank, Suit, Card parsing, 4-color deck utilities.
  - `evaluator.ts`: 5 to 7 cards hand evaluator with exact tie-breaking.
  - `combos.ts`: 169 canonical categories and 1326 combos with blocker removal.
  - `range.ts`: 13×13 range matrix model, range parser/serializer, presets.
  - `gameTree.ts`: Betting tree builder with legal action validation.
  - `dcfr.ts`: Discounted Counterfactual Regret Minimization engine.
  - `kuhn.ts`: Golden analytical reference solver.
  - `solverRunner.ts`: Non-blocking time-sliced solver manager.
- `src/components/`:
  - `Header.tsx`: Top bar navigation.
  - `BoardSelector.tsx`: Interactive board card picker.
  - `RangeMatrix13x13.tsx`: 13×13 range grid with brushes and blocker highlighting.
  - `DecisionTreeViewer.tsx`: Tree hierarchy explorer.
  - `StrategyMatrixView.tsx`: Strategy heatmap per decision node.
  - `TrainerModule.tsx`: Interactive training practice against GTO strategy.
  - `ScenarioManager.tsx`: Prebuilt and custom scenarios.
  - `BenchmarkAndDocs.tsx`: Live in-browser math test runner.
- `tests/`:
  - `evaluator.test.ts`: Evaluator unit tests.
  - `range.test.ts`: Range expansion and blocker tests.
  - `gameTree.test.ts`: Tree transitions tests.
  - `kuhn.test.ts`: Kuhn analytical Nash tests.
  - `dcfr.test.ts`: DCFR convergence tests.
  - `run_all.ts`: Master test runner.
- `docs/`:
  - Technical and mathematical documentation.
