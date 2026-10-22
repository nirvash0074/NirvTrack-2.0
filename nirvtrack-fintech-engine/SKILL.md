---
name: nirvtrack-fintech-engine
description: Expert fintech arithmetic, wealth diagnostics, and financial logic engine for NirvTrack. Use whenever implementing or auditing 50/30/20 envelope allocations, semi-monthly income planning (15th & 30th paycheck cashflow cushion), Month-End Surplus Sweeper logic, Safe-to-Spend pacing algorithms, Net Worth balance sheets, Debt Snowball/Avalanche amortization, Sinking Funds goals, or multi-currency and centavo-precision calculations.
---

# NirvTrack FinTech Engine

A comprehensive mathematical and algorithmic guide for NirvTrack's financial intelligence pipelines. This skill guarantees 100% arithmetic precision, zero double-counting, and strict conservation of balance equations across all budgeting, savings, debt, and cashflow modules.

---

## 1. The Core Balance Equations

Every financial metric in NirvTrack derives from immutable accounting identities:

### 1.1 Income Identity
$$\text{Total Planned Income} = \text{Income}_{\text{semi1}} + \text{Income}_{\text{semi2}} + \text{Income}_{\text{other}}$$

### 1.2 Net Cashflow & Monthly Remaining
$$\text{Remaining Unspent} = \text{Total Planned Income} - \text{Total Actual Expenses}$$
$$\text{Budget Variance} = \text{Total Allocated Budget} - \text{Total Actual Expenses}$$

### 1.3 The Swept Surplus Wealth Lock-in Identity (`[FEAT-49]`)
When a user sweeps remaining surplus at month's end:
$$\text{Available to Allocate} = \text{Planned Income} - \sum \text{Allocated Budgets} - \text{Swept Surplus}$$
Swept surplus acts as a dedicated capital lock-in, removing unallocated cash from the risk of casual overspending and directing it into savings reserves or debt reduction.

---

## 2. 50/30/20 Wealth Diagnostic & Envelope Allocation (`[FEAT-39]`, `[FEAT-42]`)

NirvTrack classifies budget categories into three core pillars:
1. **Needs (Essential Living)**: Groceries, rent/mortgage, utilities, healthcare, essential transportation, insurance.
2. **Wants (Lifestyle & Discretionary)**: Dining out, entertainment, shopping, hobby subscriptions, travel.
3. **Savings & Debt Elimination**: Emergency fund contributions, investments, retirement, debt principal repayments.

### Target Benchmark Ratios:
- $\text{Needs Target} = 0.50 \times \text{Total Income}$
- $\text{Wants Target} = 0.30 \times \text{Total Income}$
- $\text{Savings Target} = 0.20 \times \text{Total Income}$

### Algorithmic Envelope Balancing:
- In `proportional` mode: Envelopes scale up or down proportionally based on user historical spend weights.
- In `strict_503020` mode: Category limits are strictly clamped so $\sum \text{Needs} \le 50\%$ and $\sum \text{Wants} \le 30\%$, leaving the remaining $20\%$ for wealth building.

---

## 3. Semi-Monthly Cashflow Cushion Matcher (`[FEAT-CASHFLOW-CUSHION]`)

In salary cycles (especially the common 15th and 30th bi-monthly schedule), cash flow timing discrepancies create false liquidity or unexpected crunches:

### Period Partitioning:
- **Period 1 (Days 1–15)**: Fueled by 15th paycheck of prior cycle or 1st cycle advance.
  $$\text{Period 1 Outflows} = \sum_{\text{date} \le 15} \text{Actual Expenses} + \sum_{\text{date} \le 15} \text{Planned Due}$$
- **Period 2 (Days 16–End of Month)**: Fueled by 15th current paycheck.
  $$\text{Period 2 Outflows} = \sum_{\text{date} > 15} \text{Actual Expenses} + \sum_{\text{date} > 15} \text{Planned Due}$$

### Cushion Metric:
$$\text{Paycheck 1 Cushion} = \text{Income}_{\text{semi1}} - \text{Period 1 Outflows}$$
$$\text{Paycheck 2 Cushion} = \text{Income}_{\text{semi2}} - \text{Period 2 Outflows}$$
If either cushion turns negative, the application raises a proactive warning badge alerting the user that mid-month liquidity is endangered, even if the total monthly budget appears solvent!

---

## 4. Safe-to-Spend Daily Allowance & Pacing (`[FEAT-30]`, `[FEAT-50]`)

To prevent the common "Week 3 Budget Depletion" trap, NirvTrack computes a live daily velocity metric:

$$\text{Days Remaining} = \text{Total Days in Month} - \text{Current Day} + 1$$
$$\text{Safe-to-Spend Per Day} = \max\left(0, \frac{\text{Remaining Unspent Discretionary Cash}}{\text{Days Remaining}}\right)$$

### Pacing Indicator:
$$\text{Pacing \%} = \frac{\text{Current Elapsed Days}}{\text{Total Days in Month}} \times 100$$
$$\text{Budget Burn \%} = \frac{\text{Spent to Date}}{\text{Allocated Target}} \times 100$$
- If $\text{Budget Burn \%} > \text{Pacing \%} + 10\%$: Flag as **Overpacing** (Red/Amber Warning).
- If $\text{Budget Burn \%} \le \text{Pacing \%}$: Flag as **On Track** (Emerald Good).

---

## 5. Net Worth Balance Sheet & Debt Amortization

### 5.1 Balance Sheet Accounting
$$\text{Net Worth} = \sum \text{Liquid Assets} + \sum \text{Investments} + \sum \text{Physical Assets} - \sum \text{Liabilities}$$

### 5.2 Debt Payoff Acceleration Engine
- **Debt Snowball**: Sort debts ascending by current principal balance. Pay minimum on all, throw 100% of available debt envelope at the smallest balance until eliminated, then roll the total payment into the next. Maximizes psychological momentum.
- **Debt Avalanche**: Sort debts descending by Annual Percentage Rate (APR). Prioritizes mathematically optimal interest savings.

---

## 6. Centavo Precision & Regional Payment Math (`[FEAT-67]`)

When processing payments from PayMongo (GCash, Maya, QR Ph, Card):
- Gateways represent all monetary values in integer centavos (e.g. `₱750.00` is represented as `75000`).
- **Precision Rule**:
  $$\text{Display Amount} = \frac{\text{Centavos}}{100}$$
- Never round or truncate centavos before division.
- Always use `Number.toFixed(2)` or `formatCurrency()` with standard locale formatting (`Intl.NumberFormat`).

---

## 7. Arithmetic Regression Guard Protocol

Before committing any modifications to financial arithmetic functions:
1. Verify conservation of mass: Adding expense $+X$ must decrease remaining unspent by exactly $X$.
2. Verify zero-budget categories: An unbudgeted category must reflect 100% overspend variance without throwing division-by-zero (`NaN`).
3. Verify month switching: Historical periods must retain their exact snapshot budgets and not inherit current month changes.
