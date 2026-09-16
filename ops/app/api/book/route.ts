import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { rateLimit, validateBooking } from "@/lib/booking";

/**
 * The only unauthenticated write in the whole back office.
 *
 * It creates a BookingRequest and nothing else — no Customer, no Order, no
 * calendar entry. A stranger can ask for a time; only an admin accepting it
 * turns that into anything real.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, reason: "That is a few requests in a row. Give it an hour, or just ring us." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  let form: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    form = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "That request did not make sense." }, { status: 400 });
  }

  const checked = validateBooking(form);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, reason: checked.reason }, { status: 400 });
  }

  await db.bookingRequest.create({ data: checked.value });

  // Deliberately says "we will confirm" — nothing is booked yet.
  return NextResponse.json({
    ok: true,
    message: "Thanks — we have your request and will ring to confirm a time.",
  });
}
