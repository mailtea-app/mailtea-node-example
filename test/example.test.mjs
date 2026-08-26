/**
 * Runs the real example against the bundled mock API and checks what it put on
 * the wire. Spawning `index.mjs` rather than importing pieces of it means the
 * test covers the same code path a reader would run.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { startMockMailtea } from "./mock-mailtea.mjs";

const execFileAsync = promisify(execFile);
const EXAMPLE = fileURLToPath(new URL("../index.mjs", import.meta.url));
const FROM = "Example <hello@example.test>";
const TO = "reader@example.test";

/**
 * Run the example with only the environment the test supplies. The working
 * directory is an empty temp dir so a developer's real `.env` cannot leak in
 * and point a test run at the live API.
 */
function runExample(env) {
  return execFileAsync(process.execPath, [EXAMPLE], {
    cwd: mkdtempSync(join(tmpdir(), "mailtea-example-")),
    env: { PATH: process.env.PATH, ...env }
  });
}

test("the example sends, schedules, reschedules, cancels, and batches", async (t) => {
  const server = await startMockMailtea();
  t.after(() => server.close());

  const { stdout } = await runExample({
    MAILTEA_API_KEY: "mt_pat_test",
    MAILTEA_API_BASE_URL: server.url,
    MAILTEA_FROM: FROM,
    MAILTEA_TO: TO
  });

  const sends = server.requests.filter((r) => r.method === "POST" && r.path === "/v1/emails");
  assert.equal(sends.length, 3, "three single sends");

  // Every request must carry the key, or the example only appears to work.
  for (const request of server.requests) {
    assert.match(request.authorization ?? "", /^Bearer mt_pat_test$/);
  }

  const [simple, detailed, scheduled] = sends;
  assert.equal(simple.body.from, FROM);
  assert.equal(simple.body.to, TO);
  assert.match(simple.body.subject, /^Mailtea nodejs example \w+: simple HTML$/);
  assert.match(simple.body.html, /Hello from the Mailtea Node\.js example/);

  assert.equal(typeof detailed.body.text, "string");
  assert.equal(typeof detailed.body.html, "string");
  assert.equal(detailed.body.reply_to, "support@example.org");
  assert.deepEqual(detailed.body.tags, [
    { name: "example", value: "nodejs" },
    { name: "step", value: "detailed" }
  ]);

  assert.match(scheduled.body.scheduled_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);

  const emailId = "txemail_00000000000000000000000000000000";
  const lifecycle = server.requests.filter((r) => r.path.startsWith(`/v1/emails/${emailId}`));
  assert.deepEqual(
    lifecycle.map((r) => `${r.method} ${r.path}`),
    [
      `GET /v1/emails/${emailId}`,
      `PATCH /v1/emails/${emailId}`,
      `POST /v1/emails/${emailId}/cancel`
    ],
    "retrieve, then reschedule, then cancel"
  );
  assert.match(lifecycle[1].body.scheduled_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  assert.ok(
    new Date(lifecycle[1].body.scheduled_at) > new Date(scheduled.body.scheduled_at),
    "reschedule moves the send later"
  );

  const batch = server.requests.find((r) => r.path === "/v1/emails/batch");
  assert.ok(batch, "the batch request was made");
  assert.equal(batch.body.length, 3);
  // Batch items get no `from` from an envelope — each one must carry its own.
  for (const item of batch.body) {
    assert.equal(item.from, FROM);
    assert.equal(item.to, TO);
  }

  // The ids the API returned have to reach the operator, not just the SDK.
  assert.match(stdout, new RegExp(`1\\. sent simple HTML email\\s+${emailId}`));
  assert.match(stdout, /7\. sent a batch of 3\s+txemail_\S+, txemail_\S+, txemail_\S+/);
});

test("a missing API key fails with a readable message, not a stack trace", async () => {
  const failure = await runExample({
    MAILTEA_FROM: FROM,
    MAILTEA_TO: TO
  }).catch((error) => error);

  assert.equal(failure.code, 1, "exits non-zero");
  assert.match(failure.stderr, /status 0/);
  assert.match(failure.stderr, /missing_api_key/);
  assert.doesNotMatch(failure.stderr, /at .*index\.mjs/, "no raw stack trace");
});
