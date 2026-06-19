# Supplier delivery setup

1. Create a private Supabase Storage bucket named `supplier-receipts` (or set `SUPABASE_SUPPLIER_RECEIPTS_BUCKET`). Do not make receipt files public.
2. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. Never expose it through a `NEXT_PUBLIC_` variable.
3. Set `OPENAI_API_KEY` and set `OPENAI_RECEIPT_MODEL` to an image-input model that supports structured outputs through the Responses API.
4. Add `/auth/supplier-callback` to the allowed Supabase Google OAuth redirect URLs. The supplier login preserves only validated internal supplier return paths.
5. Apply the database migration with `npx prisma migrate deploy`, then restart the application.
6. Add suppliers at `/admin/suppliers`, assign each supplier's Google email, and print its generated QR code.

Supplier uploads never update inventory. Only an ADMIN or MANAGER approval from the delivery detail page performs the stock transaction.
