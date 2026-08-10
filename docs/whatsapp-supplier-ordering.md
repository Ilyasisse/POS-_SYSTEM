# WhatsApp supplier ordering setup

## Meta configuration

1. Connect the Meta app to the cafe WhatsApp Business Account and use a permanent system-user token with `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management`.
2. Configure the webhook callback as `https://<APP_BASE_URL>/api/webhooks/whatsapp`, using the same private value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe to message status events.
3. Create and approve these utility templates (names may be overridden by environment variables):
   - `employee_supplier_order_request`: body variables for employee name, supplier name, and deadline; URL button 0 must target `https://<APP_BASE_URL>/supplier-order/request/{{1}}`.
   - `employee_supplier_order_reminder`: the same three body variables and dynamic URL button.
   - `supplier_purchase_order`: document header plus body variables for purchase-order number, expected-delivery date, and order total.
4. Enter every employee and supplier number in E.164 format, for example `+252612345678`.

All variables listed in `.env.example` are server-only except the existing `NEXT_PUBLIC_*` Supabase settings. Restart the app after changing them.

## Scheduler

The protected `/api/cron/supplier-order-schedules` route must run every minute with `Authorization: Bearer <CRON_SECRET>`. The included Vercel cron configuration uses minute-level scheduling; verify the deployment plan supports that frequency before enabling production schedules.

## Operational behavior

- Invitations and reminders retry up to three times, five minutes apart.
- Employee responses remain editable until the supplier-send deadline.
- At the deadline, received quantities are combined; missing responses are omitted.
- A run with no selected quantities is skipped without contacting the supplier.
- Failed catalog validation or supplier delivery appears in schedule history and can be retried by an admin.
- Meta delivery, read, and failure events update the delivery record through the signed webhook.
