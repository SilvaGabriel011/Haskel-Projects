import type { Metadata } from "next";

import { BookingForm } from "@/components/booking-form";

export const metadata: Metadata = {
  title: "Book a free measure & quote",
  description:
    "Ask for a time that suits you. We will ring to confirm. Small stone jobs and offcut benchtops across Adelaide.",
  robots: { index: true, follow: true },
};

/** The one page here a customer is meant to see. */
export default function BookPage() {
  return (
    <main className="min-h-dvh">
      <header className="border-b border-line bg-ink px-6 py-10 text-white sm:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose font-bold">H</div>
            <div>
              <div className="font-semibold leading-tight">Haskel Projects</div>
              <div className="text-xs uppercase tracking-[0.16em] text-white/50">
                Stonemasonry · Adelaide
              </div>
            </div>
          </div>

          <h1 className="dsp mt-8 text-4xl sm:text-5xl">
            book a free <span className="it text-blush">measure</span>
          </h1>
          <p className="mt-4 max-w-xl text-white/70">
            Tell us what the job is and when suits you. We will ring to confirm before anything is
            locked in — nothing is booked until we have spoken.
          </p>
        </div>
      </header>

      <div className="px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <BookingForm />

          <p className="mt-10 border-t border-line pt-6 text-sm text-ink-2">
            In a hurry?{" "}
            <a href="tel:0451083862" className="font-semibold text-rose underline-offset-4 hover:underline">
              0451 083 862
            </a>{" "}
            — Mon to Sat, same day reply.
          </p>
        </div>
      </div>
    </main>
  );
}
