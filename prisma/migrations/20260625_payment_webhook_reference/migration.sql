CREATE UNIQUE INDEX IF NOT EXISTS "Payment_method_reference_key"
ON "Payment"("method", "reference");
