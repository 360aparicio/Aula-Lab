# Security Specification & Red Team Spec — Lab Studio V3.4 Pro

## Data Invariants
1. **Zero-Trust Identity Integrity & Plan-Admin Authorization:** Every `/users/{userId}` document belongs strictly to `request.auth.uid == userId` (or is a pre-provisioned `isManualPlaceholder` doc created by an active verified Admin). Only the bootstrapped verified admin (`360aparicio@gmail.com`), `/admins/{uid}`, or active verified accounts explicitly granted the Admin option (`users/{uid}.role == 'admin' && planActive == true`) hold Tier-1 administrative privileges.
2. **Prevent Self-Assigned Roles & Plan Forgery (+ Verified Invite Claim):** Non-admin users on `create` MUST either register with `role == 'user'`, `planTier == 'free'`, `planActive == true` (no `planPermissions`), OR exactly match an Admin-created `pending` record at `/userInvites/{inviteId}` bound to `request.auth.token.email.lower()`. On `update`, non-admin owners CANNOT modify `role`, `planTier`, `planActive`, `planPermissions`, `uid`, `email`, or `createdAt`.
3. **Immutable Ownership & Server Timestamps:** `uid`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must match `request.time`.
4. **Strict Schema Enforcement & Bounded Sizes:** Every string field enforces `.size() <= MAX`. Unbounded arrays are prohibited (`roadmapDoneIds.size() <= 32`). Shadow fields are blocked via `hasOnly()`.
5. **No Blanket Reads or Client-Delegated Queries:** All `get` and `list` operations check either `isAdmin()`, `resource.data.ownerId == request.auth.uid`, `existing().uid == request.auth.uid`, or `/userInvites` `existing().email == request.auth.token.email.lower()`.

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
