# Role permissions

## What it does

Provides one typed role-to-permission matrix for pages, server actions, APIs, navigation, kitchen stations, and assigned orders.

## Why it exists

Role arrays were previously repeated across the application and several catalog mutations had no action-level authorization. Central permissions make server enforcement consistent and testable.

## Roles and access

- Admin: all permissions.
- Manager: dashboard, catalog, inventory, staff, tables, orders, suppliers, and reports.
- Cashier: orders, tables, payments, and operational reports.
- Waiter: order creation and assigned-order access.
- Cook, Barista, Cabitaan: kitchen ticket access restricted by station. Cabitaan retains its existing inventory workflow.
- Supplier: supplier portal only; the portal is delivered in its own feature.
- Cleaner: assigned-table reset only; assignments are delivered with the cleaner workflow.
- Customer: customer ordering only.

## Routes and pages changed

Admin, Manager, Cashier, Waiter, Kitchen, Inventory, and Settings route segments now enforce named permissions. Admin navigation hides links the current role cannot use.

## Components changed

`AdminShell` receives the current user permissions and filters navigation. No new client state or dependency was added.

## Server actions and API routes

All existing server actions now authorize before mutation. Order, payment, pronunciation, barista, customer-order, supplier-delivery, waiter-shift, and kitchen socket APIs use the central permission matrix and return `401` for missing authentication or `403` for forbidden access.

## Database and migration

`SUPPLIER` and `CLEANER` are appended to `UserRole`. Existing values and users are unchanged. See `docs/database/role-permissions-migration.md`.

## Validation and permission rules

Authentication comes from the existing Supabase server client. The matching Prisma user must exist, be active, have the named permission, and satisfy station/ownership scope when applicable.

## Error handling

Pages and actions redirect to staff login with an error code. APIs return JSON `401` or `403`. Unexpected authentication failures flow to the existing application error boundary.

## Loading and empty states

No new data page is introduced. Existing segment loading and empty states remain unchanged.

## Security notes

Navigation filtering is convenience only; every mutation is checked on the server. Client-provided kitchen role, station, and user filters are replaced by authenticated values for scoped users. Supplier OAuth creates a `SUPPLIER` user only after matching the assigned supplier email; delivery submission verifies both permission and supplier ownership.

## Environment variables

No new environment variables.

## Testing checklist

See `docs/testing/role-permissions.md`.

## Future improvements

Supplier ownership, cleaner table assignments, audit records for role changes, and branch scope are added by their dedicated roadmap features.
