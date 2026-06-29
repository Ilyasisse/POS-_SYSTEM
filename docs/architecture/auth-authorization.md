# Authentication and authorization

Supabase authenticates the session. `getCurrentUser` resolves it to an active Prisma user. `requirePermission` protects server-rendered pages and actions; `authorizeApi` and `authorizeApiAny` protect route handlers. `permissions.ts` is the only role-to-capability policy source.

Station and ownership checks are separate from the role matrix. This keeps the coarse RBAC policy reusable when table assignments, supplier ownership, and branches are added.

Supplier Google OAuth is synchronized as a `SUPPLIER` user only after the configured supplier email matches. Supplier API access then requires both the portal permission and the matching supplier record.

`requireRole` remains only as a compatibility helper and should not be used by new features.
