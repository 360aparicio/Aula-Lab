# GTO Studio — No-Limit Texas Hold'em GTO Solver & Trainer

**GTO Studio** is a professional Game Theory Optimal (GTO) poker solver, interactive decision tree explorer, 13×13 range matrix editor, and practice trainer.

## Key Features

- **Discounted CFR (DCFR) & CFR+ Engine**:
  - Exact parameters: $\alpha = 1.5, \beta = 0.0, \gamma = 2.0$.
  - Regret matching+ with reach-weighted strategy accumulation.
  - Zero-sum payoff validation and convergence verification.
- **Exact 7-Card Hand Evaluator**:
  - Evaluates all standard poker categories with monotonic scoring for tie-breaking and split pots.
- **13×13 Interactive Range Matrix**:
  - Pocket pairs, suited hands, offsuit hands.
  - Multi-brush weight painter (100%, 75%, 50%, 25%, 0%).
  - Real-time dead card blocker calculation and impossible combo elimination.
  - Standard notation parser and serializer (e.g., `AA-TT,AKs-ATs,AKo:0.5`).
- **Interactive Decision Tree**:
  - Check, Bet (% of pot), Call, Fold, Raise, All-In.
  - Action frequency breakdown per node.
- **13×13 Strategy Heatmap**:
  - Displays multi-action distribution bars (Fold in red, Check/Call in blue, Bet/Raise in green) across all hands for any selected tree node.
- **GTO Trainer Arena**:
  - Hole cards dealt from Hero's range with board blocker removal.
  - Real-time feedback with GTO strategy comparison, EV loss, and Elo rating adjustment.
- **Offline Persistence**:
  - Save, load, export, and import scenario files in JSON format.
- **Automated Test Suite**:
  - 332 unit tests verifying evaluator, range metrics, blockers, decision tree transitions, Kuhn Poker analytical Nash convergence, and DCFR normalization.

## Quick Start

```bash
# Run automated test suite (332 tests)
npm test

# Run development server
npm run dev

# Run TypeScript linter
npm run lint

# Compile for production
npm run build
```
