/**
 * "Forgot PIN?": a one-time code emailed to the shared login's inbox, then a
 * new PIN. Runs against the database with Resend stood in for, so the test
 * can read the code out of the "email" the way the person would.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "../lib/db";
import type { Fetch } from "../lib/mail";
import { checkPin } from "../lib/pin";
import { CODE_TRIES, completePinReset, requestPinReset } from "../lib/pin-reset";

const INFO = "info@haskelproject.com.au";
let tom: { id: string; pinHash: string | null };
let mia: { id: string };
const ENV = ["RESEND_API_KEY", "MAIL_FROM"] as const;
const saved = ENV.map((k) => process.env[k]);

/** A pretend Resend: keeps every email so the test can read the code. */
function outbox() {
  const sent: Array<{ to: string[]; subject: string; text: string; from: string }> = [];
  const fetchFn: Fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer re_test");
    sent.push(JSON.parse(String(init.body)));
    return Response.json({ id: "email-1" });
  };
  const code = () => /Code: (\d{6})/.exec(sent.at(-1)?.text ?? "")?.[1] ?? "";
  return { fetchFn, sent, code };
}

const clearReset = (id: string) =>
  db.user.update({ where: { id }, data: { pinResetHash: null, pinResetExpires: null, pinResetTries: 0, pinResetSentAt: null } });

before(async () => {
  tom = await db.user.findFirstOrThrow({ where: { email: INFO, name: "Tom Nguyen" }, select: { id: true, pinHash: true } });
  mia = await db.user.findFirstOrThrow({ where: { email: INFO, name: "Mia Torres" }, select: { id: true } });
});

beforeEach(async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM = "Haskel Ops <noreply@haskelproject.com.au>";
  await clearReset(tom.id);
  await clearReset(mia.id);
});

after(async () => {
  await db.user.update({ where: { id: tom.id }, data: { pinHash: tom.pinHash, pinFailures: 0, pinLockedUntil: null } });
  await clearReset(tom.id);
  await clearReset(mia.id);
  ENV.forEach((k, i) => (saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i])));
  await db.$disconnect();
});

describe("forgot PIN", () => {
  it("emails a 6-digit code to the shared login, and the code sets a new PIN", async () => {
    const mail = outbox();
    const req = await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn });
    assert.deepEqual(req, { ok: true, sentTo: INFO });
    assert.deepEqual(mail.sent[0].to, [INFO]);
    assert.match(mail.sent[0].subject, /Tom Nguyen/);
    assert.match(mail.code(), /^\d{6}$/);

    // Locked out from wrong PINs before: the reset lifts it.
    await db.user.update({ where: { id: tom.id }, data: { pinLockedUntil: new Date(Date.now() + 600_000) } });
    const done = await completePinReset(INFO, tom.id, mail.code(), "9137");
    assert.deepEqual(done, { ok: true, personId: tom.id, name: "Tom Nguyen" });

    const after = await db.user.findUniqueOrThrow({ where: { id: tom.id } });
    assert.deepEqual(checkPin({ name: "Tom", pinHash: after.pinHash, pinLockedUntil: after.pinLockedUntil }, "9137"), { ok: true });
    assert.equal(after.pinResetHash, null, "the code is spent");
  });

  it("works once only", async () => {
    const mail = outbox();
    await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn });
    assert.ok((await completePinReset(INFO, tom.id, mail.code(), "1111")).ok);
    const again = await completePinReset(INFO, tom.id, mail.code(), "2222");
    assert.ok(!again.ok && /expired or been used up/.test(again.reason));
  });

  it("counts wrong codes, and the fifth wrong one spends it", async () => {
    const mail = outbox();
    await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn });
    const wrong = mail.code() === "000000" ? "111111" : "000000";
    const first = await completePinReset(INFO, tom.id, wrong, "1234");
    assert.ok(!first.ok && /4 more tries/.test(first.reason));
    for (let i = 1; i < CODE_TRIES; i++) await completePinReset(INFO, tom.id, wrong, "1234");
    const right = await completePinReset(INFO, tom.id, mail.code(), "1234");
    assert.ok(!right.ok && /used up/.test(right.reason), "even the right code is refused after five wrong");
  });

  it("refuses a code after 10 minutes", async () => {
    const mail = outbox();
    const sentAt = new Date();
    await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn, now: sentAt });
    const late = await completePinReset(INFO, tom.id, mail.code(), "1234", new Date(sentAt.getTime() + 11 * 60_000));
    assert.ok(!late.ok && /expired/.test(late.reason));
  });

  it("will not send another code within a minute", async () => {
    const mail = outbox();
    const t = new Date();
    assert.ok((await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn, now: t })).ok);
    const soon = await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn, now: new Date(t.getTime() + 20_000) });
    assert.ok(!soon.ok && /less than a minute/.test(soon.reason));
    assert.equal(mail.sent.length, 1);
    assert.ok((await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn, now: new Date(t.getTime() + 61_000) })).ok);
  });

  it("a code for one person does not reset another's PIN", async () => {
    const mail = outbox();
    await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn });
    const other = await completePinReset(INFO, mia.id, mail.code(), "1234");
    assert.ok(!other.ok);
  });

  it("only works for someone on the login that is signed in", async () => {
    const mail = outbox();
    const res = await requestPinReset("admin@haskelproject.com.au", tom.id, { fetchFn: mail.fetchFn });
    assert.ok(!res.ok);
    assert.equal(mail.sent.length, 0);
  });

  it("says plainly when email is not set up, and sends nothing", async () => {
    delete process.env.RESEND_API_KEY;
    const mail = outbox();
    const res = await requestPinReset(INFO, tom.id, { fetchFn: mail.fetchFn });
    assert.ok(!res.ok && /Email is not set up/.test(res.reason));
    assert.equal(mail.sent.length, 0);
    const row = await db.user.findUniqueOrThrow({ where: { id: tom.id } });
    assert.equal(row.pinResetHash, null, "no code stored when none was sent");
  });

  it("refuses a new PIN that is not 4 digits", async () => {
    const res = await completePinReset(INFO, tom.id, "123456", "12");
    assert.ok(!res.ok && /4 digits/.test(res.reason));
  });
});
