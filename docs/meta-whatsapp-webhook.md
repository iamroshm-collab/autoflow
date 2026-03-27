# Meta WhatsApp Webhook

Canonical Meta webhook endpoint:

- `GET /api/webhook`
- `POST /api/webhook`

Backward-compatible alias kept active:

- `GET /api/webhooks/meta/whatsapp`
- `POST /api/webhooks/meta/whatsapp`

April 2026 BSUID handling:

- The webhook prefers Meta `user_id` when present and stores it as `AppUser.whatsappId`.
- If no `AppUser.whatsappId` match exists, it falls back to a phone-based lookup using `from` or `contacts[].wa_id` when those values still look like phone numbers.
- On a successful fallback match, the record is migrated by updating `whatsappId` to the new BSUID while keeping `phoneNumber` for template sends.
- If nothing matches, the webhook creates a pending `guest` AppUser with the BSUID in `whatsappId`.

Important OTP note:

- Authentication OTP templates still require a physical phone number at send time. Keep using `phoneNumber` or legacy `mobile` for outbound OTP templates even if inbound replies now arrive with BSUID-only identifiers.

Local smoke test:

1. Start the Next.js dev server.
2. Run `npm run webhook:smoke`.
3. The script posts one payload that should migrate a seeded user from phone lookup to BSUID, then a second payload that should create a `guest` user.

Required env for Meta verification and sends:

- `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_OTP_TEMPLATE_NAME`