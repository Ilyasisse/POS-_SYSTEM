# MacroDroid payment callback

The cashier creates one pending request for each payer. MacroDroid listens for an SMS from `A98` and forwards the provider, payer phone, amount, provider reference, sender, and original message to the POS. The POS matches exactly one pending request and rejects ambiguous or mismatched callbacks.

## Server configuration

Set these deployment environment variables:

```text
MACRODROID_PAYMENT_WEBHOOK_SECRET=<long random secret>
MACRODROID_PAYMENT_SMS_SENDER=A98
```

The callback URL is:

```text
https://<your-pos-domain>/api/webhooks/payments/macrodroid
```

## MacroDroid macro

1. Create a macro named `POS payment callback`.
2. Trigger: **SMS Received**. Select sender `A98` and any content. If Android does not trigger reliably, enable **Monitor Inbox**. MacroDroid exposes `{sms_number}` and `{sms_message}` for this trigger.
3. Add actions that extract the provider reference, payer phone, and decimal amount from `{sms_message}` into local variables. The exact regular expressions depend on the real A98 message format; test them against redacted sample messages before enabling the HTTP action.
4. Add an **HTTP Request** action:
   - Method: `POST`
   - URL: the callback URL above
   - Content type: `application/json`
   - Header: `Authorization` = `Bearer <MACRODROID_PAYMENT_WEBHOOK_SECRET>`
   - Save the HTTP return code so failures can display a local notification.
5. Use this JSON body, inserting MacroDroid local variables with its Magic Text picker:

```json
{
  "provider": "GOLIS",
  "payerPhone": "<extracted payer phone>",
  "amount": "<extracted amount>",
  "reference": "<extracted provider transaction reference>",
  "sender": "{sms_number}",
  "message": "{sms_message}"
}
```

If the cashier waiting screen shows an ambiguous match, include the displayed request ID as `paymentRequestId`. Normally phone + exact amount + provider is enough.

Do not use MacroDroid's phone-hosted HTTP server for this workflow. It is local-network only and the phone IP can change. The SMS Received trigger plus outbound HTTPS callback works when the phone can reach the deployed POS and does not require exposing the phone as a server.

MacroDroid references: [SMS Received trigger](https://www.macrodroidforum.com/wiki/index.php/Trigger%3A_SMS_Received), [HTTP Request action](https://www.macrodroidforum.com/wiki/index.php/Action%3A_HTTP_Request), [HTTP Server Request limitations](https://www.macrodroidforum.com/wiki/index.php/Trigger%3A_HTTP_Server_Request).

## Idempotency rules

- Each cashier batch has a client-generated unique key.
- Each payer row is unique within that batch.
- A provider reference can match only one payment request for a payment method.
- Repeated callbacks return success with `duplicate: true`; they do not create another payment.
- One SMS cannot match multiple pending rows. Ambiguous matches are rejected for manual review.
