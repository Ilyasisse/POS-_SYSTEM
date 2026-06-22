DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'UserRole'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'UserRole'
      AND enum_value.enumlabel = 'CUSTOMER'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';
  END IF;
END $$;