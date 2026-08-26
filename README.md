# Mailtea + Node.js Example

This example shows how to use [Mailtea](https://mailtea.app) with plain Node.js
to send, schedule, reschedule, cancel, and batch transactional email from a
single script — no framework, no build step.

## Prerequisites

To get the most out of this guide, you'll need to:

- [Create an API key](https://studio.mailtea.app/api-keys)
- [Verify your domain](https://docs.mailtea.app/docs/documentation/domains)

## Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your API key:
   ```bash
   cp .env.example .env
   ```
3. Run it:
   ```bash
   npm start
   ```

Everything lives in [`index.mjs`](./index.mjs), in seven numbered steps.

## What this example covers

- Sending an HTML email with `emails.send`
- Sending `text` + `html` together, with `reply_to` and `tags`
- Scheduling a send with `scheduled_at`
- Retrieving an email and its status with `emails.get`
- Moving a scheduled send with `emails.reschedule`
- Calling it off with `emails.cancel`
- Sending three emails in one request with `emails.batch`
- Catching `MailteaError` and printing the status, code, and request id

## Tests

```bash
npm test
```

The tests run against a bundled mock Mailtea server, so they need no API key
and make no network calls.

## Learn more

- [Documentation](https://docs.mailtea.app)
- [API reference](https://docs.mailtea.app/docs/api-reference)
- [Node.js SDK](https://github.com/mailtea-app/mailtea-node) ·
  [Python SDK](https://github.com/mailtea-app/mailtea-python) ·
  [MCP server](https://github.com/mailtea-app/mailtea-mcp)
