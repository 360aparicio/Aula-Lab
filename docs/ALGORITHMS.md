# GTO Studio — Mathematical Algorithms & Formulations

## 1. Discounted Counterfactual Regret Minimization (DCFR)

DCFR (Brown & Sandholm, 2019) minimizes counterfactual regret in extensive-form zero-sum games by discounting past iterations:

### Regret Discounting
At iteration $t$:
- If $R^{t-1}(I, a) > 0$:
  $$R^t_+(I, a) = R^{t-1}_+(I, a) \cdot \frac{t^\alpha}{t^\alpha + 1}$$
  With default $\alpha = 1.5$.
- If $R^{t-1}(I, a) \le 0$:
  $$R^t_-(I, a) = R^{t-1}_-(I, a) \cdot \frac{t^\beta}{t^\beta + 1}$$
  With default $\beta = 0.0$ (giving discount factor $\frac{1}{1 + 1} = 0.5$).

### Cumulative Strategy Discounting
The average strategy contribution is discounted by:
$$S^t(I, a) = S^{t-1}(I, a) \cdot \left(\frac{t}{t+1}\right)^\gamma + \pi_i(h) \cdot \sigma^t(I, a)$$
With default $\gamma = 2.0$.

### Regret Matching+ Strategy Derivation
At node $I$, the instantaneous strategy $\sigma^t(I, a)$ is:
$$\sigma^t(I, a) = \frac{\max(0, R^t(I, a))}{\sum_{b \in A(I)} \max(0, R^t(I, b))}$$
If the denominator is 0, a uniform distribution $\frac{1}{|A(I)|}$ is selected.

### Final Average Strategy
The output GTO strategy $\bar{\sigma}(I, a)$ is:
$$\bar{\sigma}(I, a) = \frac{S(I, a)}{\sum_{b \in A(I)} S(I, b)}$$

## 2. 7-Card Hand Evaluator

The evaluator partitions hands into 9 ordered categories:
1. High Card
2. One Pair
3. Two Pair
4. Three of a Kind
5. Straight
6. Flush
7. Full House
8. Four of a Kind
9. Straight Flush (Royal Flush = Straight Flush, Ace High)

A strictly monotonic integer score is calculated:
$$\text{Score} = \text{Category} \times 1,000,000 + \text{TieBreakerScore}$$
Tie breaker scores are calculated using positional base-14 representations of descending ranks.

## 3. Kuhn Poker Golden Benchmark

Kuhn poker is a 3-card zero-sum game (Cards J, Q, K).
Analytical Nash Equilibrium results:
- Player 1 Game Value: $V_1 = -1/18 \approx -0.05555...$
- Player 1 checks with Queen at probability $\approx 1.0$.
- Player 2 calls with King when facing a bet at probability $1.0$.
- Player 2 folds with Jack when facing a bet at probability $1.0$.
- Verified via `tests/kuhn.test.ts`.
