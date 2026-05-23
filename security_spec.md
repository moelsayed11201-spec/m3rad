# Security Specification - ERP Installment System

## Data Invariants
1. **User Identity**: Every record (except global settings) must belong to a specific `userId` matching `request.auth.uid`.
2. **Admin Privilege**: Only users with `role: 'admin'` can add/update/delete products, product categories, and settings.
3. **Role Integrity**: A user cannot promote themselves to 'admin'. Only an existing admin or a secure logic can set the 'admin' role.
4. **ID Integrity**: All document IDs must be valid strings (alphanumeric, underscores, hyphens) and within size limits.
5. **Timestamp Integrity**: `createdAt` and `updatedAt` (if used) must match server time. (Note: The app currently uses client-side strings for dates, I should encourage using server timestamps if possible, but for now I'll stick to the app's structure while adding size/type guards).

## The "Dirty Dozen" Payloads
1. **Privilege Escalation**: User 'X' tries to update their own document in `/users/X` with `{ "role": "admin" }`.
2. **Resource Hijacking**: User 'A' tries to create a customer document with `userId: 'B'`.
3. **Orphaned Writes**: User 'A' tries to create a contract for a `customerId` that doesn't exist.
4. **Cross-Tenant Access**: User 'A' tries to read a customer document belonging to User 'B'.
5. **ID Poisoning**: An attacker tries to create a document with a 2KB junk string as the ID.
6. **State Skip**: User tries to mark a contract as 'مكتمل' (Completed) without through a payment record.
7. **Size Bomb**: A user sends a 1MB string for a 'name' field.
8. **Draft Tampering**: User updates an immutable field like `contractNumber` after it was created.
9. **Admin Settings Bypass**: A non-admin user tries to update the global `settings` collection.
10. **Ghost Field Injection**: User adds a secret field `__debug_admin: true` to their user profile.
11. **Negative Amount**: User creates a receipt with `amount: -1000`.
12. **Future/Past Spoofing**: User sends a date string that is years in the future (Note: Rules can check strings but it's limited, primarily we'll ensure they are strings).

## The Test Runner (Plan)
We will use `firestore.rules.test.ts` to verify these. (Note: I don't have a test runner environment set up here with emulator, but I will simulate the logic in the rules).

---

# Delta Report - Rules Hardening
- Added `affectedKeys().hasOnly()` gates to all update operations.
- Restricted `role` updates in `/users/{userId}` to admins only.
- Added `isValidId()` check to all path variables.
- Enforced `userId == request.auth.uid` on all per-user collections.
- Added boundary checks for `amount` and `quantity`.
