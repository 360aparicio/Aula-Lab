# Security Specification & Red Team Spec — Lab Studio V3.1 Pro

## Data Invariants
1. **Zero-Trust Identity Integrity:** Every user profile `/users/{userId}` and subcollection document (`/sm2Items/{itemId}`, `/mistakes/{mistakeId}`) MUST belong strictly to `request.auth.uid == userId` AND carry `request.auth.token.email_verified == true`.
2. **Immutable Ownership & Creation Timestamps:** `uid`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must match `request.time`.
3. **Strict Schema Enforcement & Bounded Sizes:** Every string field enforces `.size() <= MAX`. Unbounded arrays are prohibited (`roadmapDoneIds.size() <= 32`). Shadow fields are blocked via `hasOnly()`.
4. **Master Gate Relational Sync:** Every subcollection write verifies ownership against `userId` and checks `exists(/databases/$(database)/documents/users/$(userId))`.
5. **No Blanket Reads or Client-Delegated Queries:** All `get` and `list` operations on `/users/{userId}/...` explicitly check `resource.data.ownerId == request.auth.uid` (for subcollections) or `userId == request.auth.uid`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read:** Anonymous `get /users/userA` -> DENIED (`request.auth == null`).
2. **Unverified Email Write:** Authenticated with `email_verified: false` creating `/users/userA` -> DENIED (`email_verified == true` required).
3. **Cross-User Profile Hijack (IDOR):** Authenticated as `userB` attempting `get` or `update` on `/users/userA` -> DENIED (`uid != userId`).
4. **Spoofed OwnerId on Subcollection Create:** `userA` creating `/users/userA/sm2Items/card1` with `ownerId: "userB"` -> DENIED (`ownerId == request.auth.uid`).
5. **Shadow / Ghost Field Injection:** `userA` creating `/users/userA` with extra field `isAdmin: true` -> DENIED (`hasOnly` rejects unknown keys).
6. **Client Timestamp Tampering:** `userA` creating `/users/userA` with client-forged `createdAt: "2020-01-01T00:00:00Z"` -> DENIED (`createdAt == request.time`).
7. **Immutable UID Mutation on Update:** `userA` updating `/users/userA` changing `uid` -> DENIED (`incoming().uid == existing().uid`).
8. **Type Poisoning on Update:** `userA` updating `elo` on `/users/userA` with a 1MB string `"999..."` -> DENIED (`elo is number` in `isValidUserProfile`).
9. **Resource Poisoning via Oversized String:** `userA` creating `sm2Items` with 50KB `title` -> DENIED (`title.size() <= 160`).
10. **Oversized Document ID Poisoning:** `userA` creating `/users/userA/mistakes/${'a'.repeat(500)}` -> DENIED (`isValidId(mistakeId)` checks `<= 128` chars & regex).
11. **Unbounded Array Abuse:** `userA` setting `roadmapDoneIds` with 100 strings -> DENIED (`roadmapDoneIds.size() <= 32`).
12. **Blanket Collection List Scrape:** `userB` calling `list /users/userA/mistakes` -> DENIED (`resource.data.ownerId == request.auth.uid` fails).
