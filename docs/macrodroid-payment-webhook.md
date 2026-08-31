# MacroDroid 898 payment inbox

The payment phone forwards every SMS from `898` to the POS. Incoming SAHAL receipts become selectable in the cashier, outgoing transfers remain history-only, and anything that cannot be parsed goes to **Needs Review**.

## Secret and deployment

Deploy the database migration and website before enabling either macro. The website resolves the credential in this order:

1. A nonempty `MACRODROID_PAYMENT_WEBHOOK_SECRET`.
2. Otherwise, the existing nonempty `PAYMENT_WEBHOOK_SECRET`.

You may keep using `PAYMENT_WEBHOOK_SECRET`. In MacroDroid, replace `<current PAYMENT_WEBHOOK_SECRET>` with the actual secret value stored in the website environment. The complete header value begins with `Bearer`, followed by one space and that secret, for example `Bearer abc123`. Never type the angle brackets, environment-variable name, or secret into source control or screenshots.

The existing signed MYCASH/GOLIS webhook still uses `PAYMENT_WEBHOOK_SECRET`. Adding the dedicated MacroDroid variable later does not change that webhook.

## Payment SMS macro

Menu wording can vary slightly by MacroDroid version.

1. Open **MacroDroid**, tap **Add Macro**, and enter `Mashallah Cafe - 898 Payments`.
2. Under **Triggers**, tap **+** → **Call/SMS** → **SMS Received**.
3. Choose **Select Number**, enter `898`, select **Any Content**, and confirm.
4. Open **Local Variables** for this macro and add:
   - `attempt`: **Integer**, initial value `0`
   - `http_code`: **Integer**, initial value `0`
   - `delivery_ok`: **Boolean**, initial value `false`
   - `http_response`: **String**, leave empty
5. Under **Actions**, tap **+** → **Conditions/Loops** → **Repeat Actions** → **Fixed Number**, enter `5`, and confirm.
6. Inside the repeat block, tap **+** → **Variables** → **Set Variable**, select `attempt`, choose **Increment**, and enter `1`.
7. Still inside the repeat block, tap **+** → **Connectivity** → **HTTP Request** and enter:
   - Method: `POST`
   - URL: `https://mashallahcafe.com/api/webhooks/payments/macrodroid`
   - Content type: `text/plain; charset=utf-8`
   - Body: tap **… / Magic Text** → **SMS** → **SMS Message**. It should display `{sms_message}`.
8. In that HTTP action, add these headers:
   - Name `Authorization`; value `Bearer <current PAYMENT_WEBHOOK_SECRET>` using the real current secret.
   - Name `X-SMS-Sender`; value from **Magic Text** → **SMS** → **SMS Number**. It should display `{sms_number}`.
9. In the response/output section, save the HTTP status/return code into `http_code` and response body into `http_response`. Enable **Block next action until complete**.
10. After the HTTP action, still inside the repeat block, add **Conditions/Loops** → **If Clause**. Configure both conditions with **AND**:
    - `http_code >= 200`
    - `http_code < 300`
11. Inside that success clause, set `delivery_ok` to `true`, then add **Conditions/Loops** → **Break From Loop**.
12. After the success clause, add another **If Clause** for `delivery_ok = false` **AND** `attempt < 5`. Inside it, add **Device Actions** → **Wait Before Next Action** → `1 minute`.
13. After the repeat block, add an **If Clause** for `delivery_ok = false`. Inside it, add **Notification** → **Display Notification**:
    - Title: `Payment delivery failed`
    - Text: `Check the internet and MacroDroid log.`
    - Make it persistent/ongoing if that option is shown.
14. Save and enable the macro. If receipt detection is unreliable, edit **SMS Received** and enable **Monitor Inbox**.

Five attempts means one immediate request and four retries, each one minute apart. Duplicate successful deliveries are safe because the website deduplicates by Tix and normalized message fingerprint.

## Heartbeat macro

1. Tap **Add Macro** and name it `Mashallah Cafe - Payment Phone Status`.
2. Under **Triggers**, tap **+** → **Date/Time** → **Regular Interval**, choose `1 minute`, and confirm.
3. Under **Actions**, tap **+** → **Connectivity** → **HTTP Request** and enter:
   - Method: `POST`
   - URL: `https://mashallahcafe.com/api/webhooks/payments/macrodroid/heartbeat`
   - Content type: `text/plain; charset=utf-8`
   - Body: `heartbeat`
   - Header `Authorization`: `Bearer <current PAYMENT_WEBHOOK_SECRET>` using the same real secret
   - Header `X-SMS-Sender`: `898`
   - Enable **Block next action until complete**
4. Save and enable the macro.
5. In Android settings for MacroDroid, allow SMS and notifications, enable background data, and set battery use to **Unrestricted**. Also exclude MacroDroid from data saver or sleeping-app lists.

Staff see a persistent POS warning if no heartbeat arrives for 150 seconds.

## End-to-end test

1. Send a heartbeat and confirm the POS offline warning disappears within 30 seconds.
2. Use MacroDroid's **Test Action** on the payment HTTP action with one real or supplied SAHAL message from sender `898`.
3. Open the table in Cashier → **Take payment** → select **GOLIS / SAHAL**, enter the payer, and start the check.
4. Confirm incoming receipts appear under **Available**, sent-money notices under **Outgoing**, and malformed notices under **Needs Review**.
5. Select a payer row and assign an incoming receipt. A smaller receipt leaves the row partially matched; a larger receipt is blocked.
6. Confirm the receipt moves to **Assigned** and shows the table, payer, and assigning cashier.
7. As a manager/admin, enter a reason and test reversal. Confirm the receipt returns to **Available** and the table balance reopens.

Do not deploy or share the real secret while testing. A `401` means the secret is absent/different or the sender is not `898`.
