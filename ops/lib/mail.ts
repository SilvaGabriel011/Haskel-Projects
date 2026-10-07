/**
 * Sending email, through Resend (resend.com).
 *
 * Set up with RESEND_API_KEY and MAIL_FROM, an address on a domain verified
 * in Resend, e.g. "Haskel Ops <noreply@haskelproject.com.au>". Without both,
 * nothing is sent and the caller is told so; nothing here throws.
 */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type MailResult = { ok: true } | { ok: false; reason: "not-configured" | "failed"; detail?: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export async function sendMail(
  msg: { to: string; subject: string; text: string },
  fetchFn: Fetch = fetch,
): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!key || !from) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, reason: "failed", detail: body?.message ?? `Resend said ${res.status}` };
  } catch (e) {
    return { ok: false, reason: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}
