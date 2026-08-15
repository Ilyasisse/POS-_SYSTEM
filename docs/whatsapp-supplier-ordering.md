# WhatsApp supplier ordering setup

## Twilio credentials and sender

The production sender is `whatsapp:+15553269140` (`Mash Allah Cafe`). In the Twilio Console:

1. Open **Account > API keys & tokens > API keys**, create a Standard key named `cafe-pos-production`, and save its `SK...` SID and one-time secret as `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET`.
2. Copy the `AC...` Account SID from **Console Home > Account Info** into `TWILIO_ACCOUNT_SID`.
3. Copy the primary Auth Token from the same Account Info panel into `TWILIO_AUTH_TOKEN`. Twilio uses this token, not the API-key secret, to sign status callbacks.
4. Confirm **Messaging > Senders > WhatsApp Senders** shows the sender as Online.

Never commit these credentials or expose them through `NEXT_PUBLIC_*` variables.

## Vercel and templates

Deploy the application to a stable Vercel production domain with `TWILIO_WHATSAPP_ENABLED=false` first. Configure `APP_BASE_URL` with only that origin, such as `https://cafe-pos.example.com`, and redeploy before creating templates.

In **Messaging > Content Template Builder**, create English Utility templates and submit each for WhatsApp approval:

1. `employee_supplier_order_request` (`twilio/call-to-action`)
   - Body: `Hello {{1}}, please submit your required items from {{2}} before {{3}}. Use the secure button below to respond.`
   - URL button: `https://<APP_BASE_URL>/supplier-order/request/{{4}}`
   - Samples: employee name, supplier name, deadline, and a sample token.
2. `employee_supplier_order_reminder` (`twilio/call-to-action`)
   - Body: `Hello {{1}}, this is a reminder to submit your required items from {{2}} before {{3}}. Use the secure button below to respond.`
   - Use the same URL button and sample ordering.
3. `supplier_purchase_order` (`twilio/media`, document)
   - Media URL: `https://<APP_BASE_URL>/api/public/supplier-order-pdfs/{{1}}`
   - Media sample variable: `sample.pdf`
   - Body: `Purchase order #{{2}} is attached for delivery on {{3}}. The confirmed order total is {{4}}. Thank you.`
   - Samples: `sample.pdf`, order number, delivery date, and total.

The sample PDF URL is intentionally non-sensitive and public for template review. Real PDFs require a signed HMAC URL and are generated from the immutable purchase-order snapshot.

Copy the three approved `HX...` SIDs into:

- `TWILIO_EMPLOYEE_INVITATION_CONTENT_SID`
- `TWILIO_EMPLOYEE_REMINDER_CONTENT_SID`
- `TWILIO_SUPPLIER_ORDER_CONTENT_SID`

The existing `test_message` template is not suitable unless its **WhatsApp business initiated** status is approved and its variables match the application exactly.

## Status callback and scheduler

Every Twilio message includes `https://<APP_BASE_URL>/api/webhooks/whatsapp` as its status callback. The endpoint accepts Twilio's form-encoded POST, validates `X-Twilio-Signature`, and records accepted, delivered, read, failed, and undelivered states. Inbound chat remains out of scope.

The protected `/api/cron/supplier-order-schedules` route requires `Authorization: Bearer <CRON_SECRET>`. On Vercel Hobby, `.github/workflows/supplier-order-scheduler.yml` calls it every five minutes because Hobby rejects cron schedules that run more than once per day. Add these GitHub repository secrets under **Settings > Secrets and variables > Actions**:

- `APP_BASE_URL`: the stable Vercel production origin, for example `https://cafe-pos.example.com`, without a trailing slash.
- `CRON_SECRET`: exactly the same strong random value configured as `CRON_SECRET` in Vercel.

The GitHub workflow can also be started manually from **Actions > Supplier order scheduler > Run workflow**. GitHub scheduled jobs can be delayed during periods of high load, so this fallback provides roughly five-minute scheduling rather than exact minute-level execution.

The previous Vercel Pro configuration called `/api/cron/supplier-order-schedules` with `* * * * *` every minute. It processed due invitations, reminders, order finalization, and retryable WhatsApp deliveries. That configuration is preserved as comments in the GitHub workflow. If the project moves to Vercel Pro, restore that entry in `vercel.json` and disable the GitHub schedule so only one scheduler is routinely invoking the route.

Keep `TWILIO_WHATSAPP_ENABLED=false` until the production URL, sender, API credentials, Content SIDs, database migrations, and cron secret are all configured. While disabled, the cron exits before creating or advancing schedule runs. Set it to `true` and redeploy only when setup is complete.

## Operational behavior

- Invitations and reminders retry up to three times, five minutes apart.
- Employee responses remain editable until the supplier-send deadline.
- At the deadline, received quantities are combined; missing responses are omitted.
- A run with no selected quantities is skipped without contacting the supplier.
- Failed catalog validation or supplier delivery appears in schedule history and can be retried by an admin.
- Twilio delivery callbacks can arrive out of order; stale status changes are ignored.
- Employee and supplier numbers must use E.164 format, for example `+252612345678`.
