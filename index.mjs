import { Mailtea, MailteaError } from "mailtea-sdk";

// Node 20.6+ can read a .env file on its own, so the example runs with a plain
// `node index.mjs` and no dotenv dependency. On older runtimes, export the
// variables yourself before running.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — the variables may already be in the environment.
  }
}

/** Fail loudly on missing configuration instead of sending to `undefined`. */
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

// A short per-run tag, so repeated runs stay distinguishable in the dashboard.
const runId = Math.random().toString(36).slice(2, 8);

async function main() {
  const from = required("MAILTEA_FROM");
  const to = required("MAILTEA_TO");

  const mailtea = new Mailtea(process.env.MAILTEA_API_KEY, {
    // Only needed for local dev or a self-hosted Mailtea. Omit in production.
    baseUrl: process.env.MAILTEA_API_BASE_URL
  });

  console.log(`Mailtea nodejs example, run ${runId}`);

  // 1. The simplest send: one recipient, one HTML body.
  const simple = await mailtea.emails.send({
    from,
    to,
    subject: `Mailtea nodejs example ${runId}: simple HTML`,
    html: "<p>Hello from the Mailtea Node.js example.</p>"
  });
  console.log(`1. sent simple HTML email     ${simple.id}`);

  // 2. A fuller send. `text` is the fallback body for clients that refuse HTML,
  //    `reply_to` redirects replies away from the From address, and `tags` are
  //    the labels you filter and report on later.
  const detailed = await mailtea.emails.send({
    from,
    to,
    subject: `Mailtea nodejs example ${runId}: text and HTML`,
    text: "Hello from the Mailtea Node.js example.",
    html: "<p>Hello from the <strong>Mailtea</strong> Node.js example.</p>",
    reply_to: "support@example.org",
    tags: [
      { name: "example", value: "nodejs" },
      { name: "step", value: "detailed" }
    ]
  });
  console.log(`2. sent text + HTML email     ${detailed.id}`);

  // 3. Scheduling is the same call plus `scheduled_at` (ISO 8601, UTC).
  const scheduled = await mailtea.emails.send({
    from,
    to,
    subject: `Mailtea nodejs example ${runId}: scheduled`,
    html: "<p>This one was queued for later.</p>",
    scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  console.log(`3. scheduled email            ${scheduled.id}`);

  // 4. Retrieve it. `status` is the friendly alias for the wire field
  //    `last_event`, and it is how you check delivery after the fact.
  const retrieved = await mailtea.emails.get(scheduled.id);
  console.log(`4. retrieved it               status=${retrieved.status}`);

  // 5. Reschedule. Only emails still in the `scheduled` state can move.
  const rescheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await mailtea.emails.reschedule(scheduled.id, rescheduledAt);
  console.log(`5. rescheduled to             ${rescheduledAt}`);

  // 6. Cancel it before it goes out. Once sent, there is nothing to cancel.
  await mailtea.emails.cancel(scheduled.id);
  console.log(`6. cancelled it               ${scheduled.id}`);

  // 7. A batch send is up to 100 independent emails in one request. Every item
  //    carries its own `from`, and batch items support neither attachments nor
  //    scheduling. The response ids come back in request order.
  const batch = await mailtea.emails.batch(
    [1, 2, 3].map((n) => ({
      from,
      to,
      subject: `Mailtea nodejs example ${runId}: batch ${n} of 3`,
      html: `<p>Batch message ${n}.</p>`
    }))
  );
  console.log(`7. sent a batch of 3          ${batch.data.map((email) => email.id).join(", ")}`);
}

try {
  await main();
} catch (error) {
  if (error instanceof MailteaError) {
    // `status` is 0 when the SDK gave up before making a request — a missing
    // API key, say. Otherwise it is the HTTP status the API returned.
    console.error(`Mailtea request failed (status ${error.status}): ${error.message}`);
    if (error.code) console.error(`  code:       ${error.code}`);
    // Quote the request id when you contact support about a failed send.
    if (error.requestId) console.error(`  request id: ${error.requestId}`);
    if (error.details) console.error(`  details:    ${JSON.stringify(error.details)}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
