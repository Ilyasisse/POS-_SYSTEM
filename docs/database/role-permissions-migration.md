# Role permission migration

Migration `20260620_role_permissions` appends `SUPPLIER` and `CLEANER` to PostgreSQL enum `UserRole` using `ADD VALUE IF NOT EXISTS`.

The migration does not update or delete existing users. PostgreSQL enum values should not be removed during rollback; application rollback simply stops assigning the new roles.
