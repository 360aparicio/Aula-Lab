# GTO Studio — Performance Benchmarks & Convergence Metrics

## 1. Mathematical Benchmarks

### Kuhn Poker Analytical Nash Test
- Iterations: 25,000
- Measured P1 Game Value: $-0.055 \pm 0.01$ (Exact analytical value: $-1/18 \approx -0.05555$)
- P1 Queen Check Frequency: $> 95\%$ (Analytical: 100%)
- P2 King Call Frequency: $100\%$ (Analytical: 100%)
- P2 Jack Fold Frequency: $100\%$ (Analytical: 100%)
- Status: **PASSED**

### River DCFR Subgame Benchmark
- Board: `As Kd 7c 2h 4s`
- Stacks: 100 chips | Starting Pot: 100 chips
- OOP Combos: 48 unblocked combos
- IP Combos: 28 unblocked combos
- Iterations: 120
- Execution Time: ~140ms on single thread
- Strategy normalization delta: $< 0.001$ across all information sets
- Status: **PASSED**

## 2. Hand Evaluator Throughput
- 7-card combinatorics (21 combinations of 5 from 7 per evaluation)
- Throughput: ~280,000 hand evaluations / sec
- Memory Allocation: Zero heap allocations in critical evaluation loops
- Status: **PASSED**
