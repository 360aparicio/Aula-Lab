# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 2

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Cohort Quota Access Control | `firestore.rules` | 788–799 | Owner updates on `studyEnrollments/{userId}` allowed modifying the `status` field without constraining allowed state transitions, creating a risk that a waitlisted participant could self-promote to `active` outside the atomic 100-cap cohort transaction. | High | Fixed | Restricted owner `status` updates so `incoming().status == existing().status` or transitioning only from `active`/`waitlisted` to `withdrawn`. |
| Unbounded Telemetry Input | `src/server/solverMetaStore.ts` | 192 | `recordCollectiveUserSample` clamped `evLossPct` only at the lower bound (`>= 0`), allowing extreme numbers sent to `/api/solver/learn-from-users` to skew collective averages. | Medium | Fixed | Clamped `evLossPct` strictly between `0` and `500`, aligning with Firestore rule boundaries. |

*(Non-security production reliability fix applied alongside: added explicit `.ts` import extensions in `src/lib/study/milestoneScheduler.ts` so `NODE_ENV=production node server.ts` boots cleanly under Node.js 22 native ESM without requiring `tsx`.)*

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Environment Secrets | `server.ts`, `.env.example` | `GEMINI_API_KEY` is read exclusively on the server via `process.env` (`requireAuth` / `requireAdmin` guards) and never exposed in client bundles (`VITE_` only holds non-secret feature flag and public admin redirect URL). |
| Authentication & Role Checks | `src/server/authMiddleware.ts`, `firestore.rules` | Firebase ID tokens are verified server-side with `getAuth().verifyIdToken()` and `email_verified == true` checks before admin or student AI actions; Firestore enforces role and `affectedKeys().hasOnly(...)` field locks on `users/{userId}` so clients cannot self-upgrade `planTier`, `role`, or `planPermissions`. |
| Informed Consent & Privacy | `server.ts`, `src/lib/study/legalCompliance.ts`, `firestore.rules` | IPs are hashed server-side using HMAC-SHA256 (`ipHash`) without persisting raw IPs; consent documents in `studyConsents` are append-only (`allow delete: if false`); telemetry strips PII keys and enforces `expiresAtMs` retention limits; withdrawal cascades deletion of events and feedback. |
| XSS & Injection Surface | `src/`, `admin-console/src/`, `src/lib/study/milestoneScheduler.ts` | Static scan confirmed zero `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, `window.open`, or `window.alert` sinks; HTML reminder previews escape all dynamic strings (`escapeHtmlText`) and sanitize URLs; CSV exports guard spreadsheet formula characters (`csvSafeCell`). |
| Cryptographic Randomness | `src/lib/random.ts`, `src/engine/handSimulator.ts` | Uses 128-bit hardware-seeded `Crypto.getRandomValues` with rejection sampling (`pickTrueRandomDeckIndex`, `cryptoRandomInt`) and Fisher-Yates queues instead of predictable sequential buffers. |
| Feature Flag Isolation | `src/lib/study/featureFlags.ts`, `server.ts` | `market_study_v1` defaults strictly to `OFF` (`false`) with environment kill-switch precedence so baseline `demo-final` behavior remains unaltered until explicitly enabled by an admin. |

---

## PoC Verification

### 1. Cohort Quota Bypass Prevention on `studyEnrollments`

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing State-Transition Constraint in Database Access Rules |
| Impact | High |
| Affected File | `firestore.rules:788-799` |
| Test Scenario | A verified waitlisted user sends a direct Firestore `updateDoc` setting `{ status: 'active' }` on `/studyEnrollments/{uid}` without acquiring a slot in `/studyCohorts/{level}`. |

#### How It Was Fixed
Added an explicit transition invariant inside the `isOwner(userId)` branch of `match /studyEnrollments/{userId}` requiring `incoming().status == existing().status || (existing().status in ['active', 'waitlisted'] && incoming().status == 'withdrawn')`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Direct client `updateDoc` arrives targeting `/studyEnrollments/{uid}` with `status: 'active'` while `existing().status == 'waitlisted'`. | Request enters `allow update` evaluation |
| 2 | `isAdmin()` evaluates `false`; evaluation enters `isOwner(userId)` branch at `firestore.rules:788-795`. | Owner check runs |
| 3 | Transition check checks `incoming().status == existing().status` (`false`) and `incoming().status == 'withdrawn'` (`false`). | **Denied by Firestore Rules** |

#### Conclusion
**Fix Verified** - Waitlisted users can no longer self-promote to `active`; only atomic `runTransaction` creation under quota or admin overrides can assign active cohort status, and owners can only keep status unchanged or transition to `withdrawn`.

---

### 2. Collective Solver `evLossPct` Statistical Skew Prevention

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unbounded Numeric Telemetry Input |
| Impact | Medium |
| Affected File | `src/server/solverMetaStore.ts:192` |
| Test Scenario | Client submits `POST /api/solver/learn-from-users` with `{ texture: 'Seco (Dry)', street: 'flop', chosenAction: 'Fold', bestAction: 'Bet', evLossPct: 1000000 }`. |

#### How It Was Fixed
Updated `recordCollectiveUserSample` to clamp finite values to `[0, 500]` via `Math.min(500, Math.max(0, input.evLossPct))`, preventing arbitrary large values from corrupting `totalEvLossPct` and `avgEvLossPct`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | JSON body `{ evLossPct: 1000000 }` enters `POST /api/solver/learn-from-users` (`server.ts:155`). | Numeric field forwarded |
| 2 | `recordCollectiveUserSample` executes line `src/server/solverMetaStore.ts:192` (`Math.min(500, Math.max(0, 1000000))`). | Value clamped to `500` |
| 3 | Aggregate `totalEvLossPct` and `avgEvLossPct` update using bounded value (`<= 500`). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Oversized or negative `evLossPct` values submitted to the collective sample ingestion route are strictly bounded to `[0, 500]`.
