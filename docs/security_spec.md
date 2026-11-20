# Security Specification & Red Team Spec — Allin Studio (Allin School & Admin)

## Data Invariants
1. **Zero-Trust Identity Integrity & Plan-Admin Authorization:** Every `/users/{userId}` document belongs strictly to `request.auth.uid == userId` (or is a pre-provisioned `isManualPlaceholder` doc created by an active verified Admin). Only the bootstrapped verified admin (`360aparicio@gmail.com`), `/admins/{uid}`, or active verified accounts explicitly granted the Admin option (`users/{uid}.role == 'admin' && planActive == true`) hold Tier-1 administrative privileges.
2. **Prevent Self-Assigned Roles & Plan Forgery (+ Verified Invite Claim):** Non-admin users on `create` MUST either register with `role == 'user'`, `planTier == 'free'`, `planActive == true` (no `planPermissions`), OR exactly match an Admin-created `pending` record at `/userInvites/{inviteId}` bound to `request.auth.token.email.lower()`. On `update`, non-admin owners CANNOT modify `role`, `planTier`, `planActive`, `planPermissions`, `uid`, `email`, or `createdAt`.
3. **Immutable Ownership & Server Timestamps:** `uid`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must match `request.time`.
4. **Strict Schema Enforcement & Bounded Sizes:** Every string field enforces `.size() <= MAX`. Unbounded arrays are prohibited (`roadmapDoneIds.size() <= 32`). Shadow fields are blocked via `hasOnly()`.
5. **No Blanket Reads or Client-Delegated Queries:** All `get` and `list` operations check either `isAdmin()`, `resource.data.ownerId == request.auth.uid`, `existing().uid == request.auth.uid`, `/userInvites` `existing().email == request.auth.token.email.lower()`, or non-PII `/planConfigs/{planTier}` (`isVerifiedUser()`).
6. **Admin-Only Plan Catalog Integrity (`/planConfigs/{planTier}`):** Verified users may read plan section visibility & benefits, but ONLY active `isAdmin()` accounts from the Admin Console may write `/planConfigs/{planTier}`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read:** Anonymous `get /users/userA` -> DENIED.
2. **Unverified Email Admin Spoof:** Authenticated with email `360aparicio@gmail.com` and `email_verified: false` -> DENIED.
3. **Self-Assigned Admin Role on Create:** Non-admin creating `/users/userA` with `role: "admin"` -> DENIED.
4. **Self-Assigned Elite Plan on Create:** Non-admin creating `/users/userA` with `planTier: "elite"` -> DENIED.
5. **Plan Reactivation Bypass:** Deactivated user updating `/users/userA` with `planActive: true` -> DENIED (Tier-2 owner update forbids modifying `planActive`).
6. **Plan Tier Upgrade Bypass:** Free user updating `/users/userA` with `planTier: "pro"` -> DENIED.
7. **Cross-User Profile Hijack (IDOR):** Non-admin `userB` reading or updating `/users/userA` -> DENIED.
8. **Spoofed OwnerId on Subcollection Create:** `userA` creating `/users/userA/sm2Items/card1` with `ownerId: "userB"` -> DENIED.
9. **Shadow / Ghost Field Injection:** Creating `/users/userA` with extra key `credits: 99999` -> DENIED.
10. **Client Timestamp Tampering:** Creating `/users/userA` with forged `createdAt` != `request.time` -> DENIED.
11. **Type Poisoning on Admin Update:** Updating `planActive` with `"yes"` instead of `bool` -> DENIED (`isValidUserProfile` rejects non-bool).
12. **Blanket Collection Scrape by Non-Admin:** Non-admin calling `list /users` -> DENIED (`existing().uid == request.auth.uid` fails on other users' docs).
13. **Immutable Admin Audit Logs:** Non-admins cannot read or write `/adminAuditLogs`; even admins cannot update or delete existing logs (`allow update, delete: if false`).
14. **Non-Admin Plan Catalog Tampering:** Non-admin attempting `write /planConfigs/free` -> DENIED.

## Market Study v1 Security Invariants (`market_study_v1`)
7. **Default-OFF Feature Flag Isolation (`/featureFlags/market_study_v1`):** Verified users may read flag state (`get`), but ONLY `isAdmin()` may create or toggle `enabled` / `cohortMaxPerLevel`.
8. **Append-Only Legal Consents (`/studyConsents/{consentId}`):** Must bind `consentId == request.auth.uid + '_v1_0'`, `accepted == true`, `isAdult == true`, `acceptedAt == request.time`. Once created, updates may ONLY set `status: 'revoked'` + `revokedAt: request.time` (withdrawal). `delete` is forbidden (`false`) for 5-year legal retention.
9. **Atomic Cohort Quota Cap (`100 FISH / 100 REG / 100 NIT` via `existsAfter`/`getAfter`):** Non-admin enrollment cannot increment `/studyCohorts/{level}.currentCount` unless `currentCount + 1 <= maxQuota` AND `/studyEnrollments/{uid}` is atomically created in the same batch/transaction with active consent verified via `exists(/databases/$(database)/documents/studyConsents/$(uid + '_v1_0'))`.
10. **Strict Level Precedence & No Privilege Escalation:** Participants can only modify `selfSelectedLevel`, `completedSurveys`, or set `status == 'withdrawn'` on their own `/studyEnrollments/{uid}` — NEVER `adminOverrideLevel` or subscription `planTier`/`planPermissions`.
11. **PII-Free Telemetry & Right to Erasure (`/studyEvents`, `/studyFeedback`):** Events and feedback belong strictly to `owner` (`uid == request.auth.uid`), reject updates (`allow update: if false`), and allow deletion by owner/admin upon withdrawal.

## Dirty Dozen Market Study Payloads (Must Return PERMISSION_DENIED)
15. **Non-Admin Flag Enable:** Student calling `update /featureFlags/market_study_v1 { enabled: true }` -> DENIED.
16. **Underage Consent Bypass:** User creating `/studyConsents/{uid}_v1_0` with `isAdult: false` -> DENIED.
17. **Consent Tampering / Deletion:** User deleting or changing `acceptedAt` on `/studyConsents/{uid}_v1_0` -> DENIED.
18. **Quota Overflow Injection:** User incrementing `/studyCohorts/fish.currentCount` from `100` to `101` -> DENIED (`incoming().currentCount <= existing().maxQuota`).
19. **Orphan Cohort Counter Attack:** User incrementing `/studyCohorts/reg.currentCount` without creating `/studyEnrollments/{uid}` in the same transaction -> DENIED (`existsAfter` fails).
20. **Enroll Without Consent:** User creating `/studyEnrollments/{uid}` without `/studyConsents/{uid}_v1_0` -> DENIED (`exists` check fails).
21. **Participant Admin-Override Spoofing:** Student updating own `/studyEnrollments/{uid}` with `adminOverrideLevel: "nit"` -> DENIED (`affectedKeys().hasOnly` blocks `adminOverrideLevel`).
22. **Cross-User Telemetry Scraping:** Non-admin `list /studyEvents` or `list /studyFeedback` -> DENIED (`existing().uid == request.auth.uid`).

