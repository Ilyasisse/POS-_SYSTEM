# Role permission testing

- Run the permission unit tests.
- Sign in as Admin, Manager, Cashier, Waiter, and each kitchen station.
- Verify allowed navigation and direct route access.
- Call protected APIs without a session and expect `401`.
- Call them with the wrong role and expect `403`.
- Confirm a kitchen user cannot request or update another station.
- Confirm a waiter cannot access another waiter's order through scoped helpers.
- Confirm inactive users are denied.
- Apply the migration to a non-production database and verify existing roles are unchanged.
