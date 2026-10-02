"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerKind, MaterialKind } from "@prisma/client";

import { openJob } from "@/app/(app)/orders/actions";
import {
  CUSTOMER_KIND_LABEL,
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABEL,
  JOB_TYPES,
  JOB_TYPE_LABEL,
  defaultPipeline,
} from "@/lib/job-options";
import { PIPELINE_LABEL } from "@/lib/pipeline";
import { MATERIAL_KINDS, MATERIAL_KIND_LABEL } from "@/lib/stock-input";
import { type StoneMaterial } from "@/lib/stone";
import { colourOptions, rangeOptions, sizeOptions } from "@/lib/stone-catalogue";
import type { JobType } from "@prisma/client";

export type ClientOption = {
  id: string;
  kind: CustomerKind;
  name: string;
  contactName: string | null;
  phone: string;
  suburb: string;
};

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-rose disabled:bg-sand disabled:text-muted";
const labelCls = "block text-xs font-semibold uppercase tracking-widest text-ink-2";

type Values = Record<string, string>;

/**
 * One page, four parts: client, site, job, stone. Not a wizard — on the phone
 * with a client you fill it in whatever order they tell you things.
 *
 * The client is whoever orders and pays. Pick one on file, or create their
 * profile here. A company hiring us for its own customer is the client; the
 * homeowner goes in "At the site" so installers know who to ring.
 */
export function NewJobForm({
  clients,
  materials,
  suburbs,
}: {
  clients: ClientOption[];
  materials: StoneMaterial[];
  suburbs: string[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({
    clientMode: clients.length ? "existing" : "new",
    clientKind: "PERSON",
    source: "PHONE",
    jobType: "",
    pipeline: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Values) => {
    setV((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const existing = v.clientMode === "existing";
  const picked = clients.find((c) => c.id === v.customerId);
  const isCompany = existing ? picked?.kind === "COMPANY" : v.clientKind === "COMPANY";

  const stoneType = (v.stoneType ?? "") as MaterialKind | "";
  // Each list follows the one before: type → range → colour → what that
  // colour is made in. Changing one clears everything after it.
  const ranges = rangeOptions(stoneType, materials);
  const colours = colourOptions(stoneType, v.stoneRange ?? "", materials);
  const sizes = sizeOptions(v.materialId ?? "", materials);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Sent as what the form shows, not what was last clicked: toggling
    // "A company" while creating, then picking a person on file, leaves
    // clientKind saying COMPANY.
    const clientKind = isCompany ? "COMPANY" : "PERSON";
    try {
      const res = await openJob({ ...v, clientKind });
      if (!res.ok) {
        setError(res.reason);
        setSaving(false);
        return;
      }
      router.push(`/orders/${res.orderId}`);
    } catch {
      // A dropped connection or a server fault: say so, and let them try
      // again, rather than leave the button stuck on "Opening…".
      setError("That did not go through. Check the connection and try again. Nothing was saved.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-9 grid max-w-3xl gap-6">
      {/* ---------------------------------------------------------- client */}
      <Section n={1} title="The client" hint="Whoever orders and pays.">
        {clients.length ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Client">
            {(["existing", "new"] as const).map((m) => (
              <Choice key={m} on={v.clientMode === m} onClick={() => set({ clientMode: m })}>
                {m === "existing" ? "A client on file" : "Create a client profile"}
              </Choice>
            ))}
          </div>
        ) : null}

        {existing ? (
          <Field id="customerId" label="Client">
            <select
              id="customerId"
              className={field}
              value={v.customerId ?? ""}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                // Their suburb is a fair first guess for where the work is,
                // and follows a change of client. One typed by hand stays.
                const guessed = !v.suburb || v.suburb === picked?.suburb;
                set({ customerId: e.target.value, ...(c && guessed ? { suburb: c.suburb } : {}) });
              }}
            >
              <option value="">Pick one…</option>
              {(["COMPANY", "PERSON"] as const).map((k) => {
                const group = clients.filter((c) => c.kind === k);
                return group.length ? (
                  <optgroup key={k} label={k === "COMPANY" ? "Companies" : "People"}>
                    {group.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.contactName ? ` (${c.contactName})` : ""} — {c.phone}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </Field>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of client">
              {(["PERSON", "COMPANY"] as const).map((k) => (
                <Choice key={k} on={v.clientKind === k} onClick={() => set({ clientKind: k })}>
                  {CUSTOMER_KIND_LABEL[k]}
                </Choice>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="clientName" label={isCompany ? "Company name" : "Name"}>
                <input
                  id="clientName"
                  className={field}
                  value={v.clientName ?? ""}
                  onChange={(e) => set({ clientName: e.target.value })}
                  placeholder={isCompany ? "Hills Kitchens" : "Jo Smith"}
                />
              </Field>
              {isCompany ? (
                <Field id="contactName" label="Who you deal with" hint="Optional.">
                  <input
                    id="contactName"
                    className={field}
                    value={v.contactName ?? ""}
                    onChange={(e) => set({ contactName: e.target.value })}
                    placeholder="Sam, the site manager"
                  />
                </Field>
              ) : null}
              <Field id="phone" label="Phone">
                <input
                  id="phone"
                  type="tel"
                  className={field}
                  value={v.phone ?? ""}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="0412 345 678"
                />
              </Field>
              <Field id="email" label="Email" hint="Optional.">
                <input
                  id="email"
                  type="email"
                  className={field}
                  value={v.email ?? ""}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <Field id="source" label="How they found us">
                <select id="source" className={field} value={v.source} onChange={(e) => set({ source: e.target.value })}>
                  {CUSTOMER_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {CUSTOMER_SOURCE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* ---------------------------------------------------------- site */}
      <Section n={2} title="The site">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field id="address" label="Address">
            <input
              id="address"
              className={field}
              value={v.address ?? ""}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="12 Example Street"
            />
          </Field>
          <Field id="suburb" label="Suburb">
            {/* Suggestions, not a closed list: the list is Adelaide metro, and
                a job in a town it does not know still has to be entered. */}
            <input
              id="suburb"
              list="suburb-options"
              autoComplete="off"
              className={field}
              value={v.suburb ?? ""}
              onChange={(e) => set({ suburb: e.target.value })}
              placeholder="Start typing…"
            />
            <datalist id="suburb-options">
              {suburbs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>

        {isCompany ? (
          <div className="grid gap-5 rounded-[18px] border border-line bg-white p-5 sm:grid-cols-2">
            <p className="text-sm text-ink-2 sm:col-span-2">
              <b className="text-ink">Who is the job for?</b> The homeowner the company is working for, so
              installers know who to ring about access. The company stays the client.
            </p>
            <Field id="siteContactName" label="Homeowner" hint="Optional.">
              <input
                id="siteContactName"
                className={field}
                value={v.siteContactName ?? ""}
                onChange={(e) => set({ siteContactName: e.target.value })}
              />
            </Field>
            <Field id="siteContactPhone" label="Their phone" hint="Optional.">
              <input
                id="siteContactPhone"
                type="tel"
                className={field}
                value={v.siteContactPhone ?? ""}
                onChange={(e) => set({ siteContactPhone: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------- job */}
      <Section n={3} title="The job">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="jobType" label="Kind of job">
            <select
              id="jobType"
              className={field}
              value={v.jobType}
              onChange={(e) =>
                set({
                  jobType: e.target.value,
                  pipeline: e.target.value ? defaultPipeline(e.target.value as JobType) : "",
                })
              }
            >
              <option value="">Pick one…</option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="pipeline" label="Board">
            <select
              id="pipeline"
              className={field}
              disabled={!v.jobType}
              value={v.pipeline}
              onChange={(e) => set({ pipeline: e.target.value })}
            >
              {!v.jobType ? <option value="">Follows the kind of job</option> : null}
              {(["SHORT", "FULL"] as const).map((p) => (
                <option key={p} value={p}>
                  {PIPELINE_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="notes" label="Notes" hint="Optional.">
          <textarea
            id="notes"
            rows={3}
            className={field}
            value={v.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Undermount sink, 40 mm mitred edge"
          />
        </Field>
      </Section>

      {/* ---------------------------------------------------------- stone */}
      <Section n={4} title="The stone" hint="Optional. Leave it until the quote if it is not chosen yet.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="stoneType" label="Type of stone">
            <select
              id="stoneType"
              className={field}
              value={stoneType}
              onChange={(e) =>
                set({ stoneType: e.target.value, stoneRange: "", materialId: "", thicknessMm: "", finish: "" })
              }
            >
              <option value="">Not chosen yet</option>
              {MATERIAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MATERIAL_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="stoneRange" label="Brand or stone">
            <select
              id="stoneRange"
              className={field}
              disabled={!stoneType}
              value={v.stoneRange ?? ""}
              onChange={(e) => set({ stoneRange: e.target.value, materialId: "", thicknessMm: "", finish: "" })}
            >
              <option value="">{stoneType ? "Pick one…" : "Pick the type first"}</option>
              {ranges.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="materialId" label="Colour">
            <select
              id="materialId"
              className={field}
              disabled={!v.stoneRange}
              value={v.materialId ?? ""}
              onChange={(e) => {
                // Start from what the colour is made in; either can be changed.
                const next = sizeOptions(e.target.value, materials);
                set({ materialId: e.target.value, thicknessMm: next.thicknessMm, finish: next.finish });
              }}
            >
              <option value="">{v.stoneRange ? "Pick one…" : "Pick the brand first"}</option>
              {colours.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="thicknessMm" label="Thickness">
            <select
              id="thicknessMm"
              className={field}
              disabled={!v.materialId}
              value={v.thicknessMm ?? ""}
              onChange={(e) => set({ thicknessMm: e.target.value })}
            >
              <option value="">{v.materialId ? "Pick one…" : "Pick the colour first"}</option>
              {sizes.thicknesses.map((t) => (
                <option key={t} value={t}>
                  {t} mm
                </option>
              ))}
            </select>
          </Field>
          <Field id="finish" label="Finish">
            <select
              id="finish"
              className={field}
              disabled={!v.materialId}
              value={v.finish ?? ""}
              onChange={(e) => set({ finish: e.target.value })}
            >
              <option value="">{v.materialId ? "Pick one…" : "Pick the colour first"}</option>
              {sizes.finishes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sqm" label="Area (m²)" hint="Optional, a rough figure is fine.">
            <input
              id="sqm"
              inputMode="decimal"
              className={field}
              disabled={!v.materialId}
              value={v.sqm ?? ""}
              onChange={(e) => set({ sqm: e.target.value })}
              placeholder="2.4"
            />
          </Field>
        </div>
        {stoneType === "ENGINEERED" ? (
          <p className="text-sm text-ink-2">
            Engineered stone over 1% crystalline silica has been banned in Australia since July 2024. Only
            silica-free ranges are listed.
          </p>
        ) : null}
        <p className="text-sm text-ink-2">
          Thicknesses and finishes are what each colour is made in. A colour not listed is added through Add stock.
        </p>
      </Section>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose bg-blush px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-rose px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
        >
          {saving ? "Opening…" : "Open the job"}
        </button>
      </div>
    </form>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-5 rounded-[22px] border border-line bg-cream p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">
          {n}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {hint ? <p className="text-sm text-ink-2">{hint}</p> : null}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        on ? "border-rose bg-rose text-white" : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // content-start: beside a field with a hint, one without would stretch to match.
    <div className="grid content-start gap-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}
