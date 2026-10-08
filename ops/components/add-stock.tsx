"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createStock } from "@/app/(app)/stock/actions";
import { coloursOf, finishOptions, groupedOptions, supplierOptions, thicknessOptions } from "@/lib/stone";
import { PickOrType } from "@/components/pick-or-type";
import { catalogueKey, fromCatalogueKey, isCatalogueKey, onFileFor, rangesOf } from "@/lib/stone-catalogue";
import {
  MATERIAL_KINDS,
  MATERIAL_KIND_LABEL,
  STOCK_KINDS,
  STOCK_KIND_BLURB,
  STOCK_KIND_LABEL,
  type StockKind,
} from "@/lib/stock-input";
import type { MaterialKind } from "@prisma/client";

export type MaterialOption = {
  id: string;
  name: string;
  kind: MaterialKind;
  supplier: string;
  finish: string;
  thicknessMm: number;
};

export type SlabOption = {
  id: string;
  ref: string;
  materialId: string;
  materialName: string;
};

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-rose";
const label = "block text-xs font-semibold uppercase tracking-widest text-ink-2";

/** Today, as the date input wants it. */
function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Values = Record<string, string | boolean>;

const NEW_MATERIAL = "__new__";
const NEW_SUPPLIER = "__new__";

/**
 * Defaults seeded into state the moment a kind is picked.
 *
 * Deliberately state, not a fallback in the input's `value`. A field that
 * displays "20" while the form holds nothing looks filled in and then refuses
 * to advance, which is exactly the bug this shape prevents.
 */
const KIND_DEFAULTS: Record<StockKind, Values> = {
  SLAB: { arrivedAt: today() },
  OFFCUT: { thicknessMm: "20" },
  CONSUMABLE: {},
};

/**
 * The steps, which depend on what is being added.
 *
 * A consumable has no material and no dimensions, so it skips the material
 * step entirely rather than showing one that does not apply.
 */
function stepsFor(kind: StockKind | null): string[] {
  // Before a kind is picked, show the longer shape rather than a bare
  // "step 1 of 1", which would read as though choosing were the whole job.
  if (!kind) return ["What are you adding?", "Material", "The piece", "Check it over"];
  if (kind === "CONSUMABLE") return ["What are you adding?", "The item", "Check it over"];
  return ["What are you adding?", "Material", kind === "SLAB" ? "The slab" : "The offcut", "Check it over"];
}

export function AddStock({
  materials,
  slabs,
}: {
  materials: MaterialOption[];
  slabs: SlabOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const kind = (values.kind as StockKind | undefined) ?? null;
  const steps = stepsFor(kind);
  const last = steps.length - 1;
  const choice = String(values.materialChoice ?? "");
  // A colour from the catalogue is a new material with most of it filled in.
  const catalogued = isCatalogueKey(choice) ? fromCatalogueKey(choice) : null;
  const usingNewMaterial = choice === NEW_MATERIAL || catalogued !== null;
  const stoneType = String(values.stoneType ?? "") as MaterialKind | "";
  const colours = coloursOf(materials, stoneType);
  // A catalogue colour's own sizes and finishes first, then everything else
  // the trade sells; anything else can be typed in.
  const thicknessGroups = groupedOptions(
    catalogued ? [...catalogued.thicknesses] : [],
    thicknessOptions(materials.map((m) => m.thicknessMm)),
  );
  const thicknessChoices = { madeIn: thicknessGroups.madeIn.map(String), others: thicknessGroups.others.map(String) };
  const finishChoices = groupedOptions(
    catalogued ? [...catalogued.finishes] : [],
    finishOptions(materials.map((m) => m.finish)),
  );
  const suppliers = supplierOptions(materials.map((m) => m.supplier));
  const newSupplier = values.supplierChoice === NEW_SUPPLIER || suppliers.length === 0;
  // An offcut comes off a slab of its own colour; a colour new today has none.
  const parentSlabs = slabs.filter((x) => x.materialId === values.materialId);

  const set = (k: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setError(null);
  };

  function reset() {
    setStep(0);
    setValues({});
    setError(null);
    setSaving(false);
    setDone(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  // Escape closes, and the panel takes focus when it opens so a keyboard user
  // is not left behind on the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /** What this step needs before Next means anything. Kept in the browser as a
   *  courtesy; lib/stock-input.ts is what actually decides on the server. */
  function blocker(): string | null {
    const v = (k: string) => String(values[k] ?? "").trim();

    if (step === 0) return kind ? null : "Pick one to carry on.";

    if (kind === "CONSUMABLE" && step === 1) {
      if (!v("name")) return "Give it a name.";
      if (!v("unit")) return "Say what it is counted in.";
      if (!v("qtyOnHand")) return "How many do you have?";
      if (!v("reorderPoint")) return "Set a reorder level.";
      if (!v("unitCost")) return "Give the unit cost.";
      return null;
    }

    if (step === 1) {
      if (usingNewMaterial) {
        for (const [k, msg] of [
          ["materialName", "Give the material a name."],
          ["materialKind", "Pick what kind it is."],
          ["materialSupplier", "Say who supplies it."],
          ["materialFinish", "Give the finish."],
          ["materialThicknessMm", "Give the thickness."],
          ["materialCostPerSqm", "Give the cost per m²."],
        ] as const) {
          if (!v(k)) return msg;
        }
        return null;
      }
      if (!v("stoneType")) return "Pick the type of stone.";
      return v("materialId") ? null : "Pick the colour, or add a new one.";
    }

    if (step === 2) {
      if (!v("widthMm") || !v("lengthMm")) return "Both measurements, in millimetres.";
      if (!v("rack")) return "Where is it going?";
      if (kind === "SLAB") {
        if (!v("cost")) return "What did it cost?";
        if (!v("arrivedAt")) return "When did it arrive?";
      } else {
        if (!v("thicknessMm")) return "Give the thickness.";
        if (!v("finish")) return "Give the finish.";
      }
      return null;
    }

    return null;
  }

  function next() {
    const problem = blocker();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, last));
  }

  async function save() {
    setSaving(true);
    setError(null);

    // materialChoice is the picker's own state; the server wants materialId, or
    // nothing at all when a new material is being created alongside the piece.
    const { materialChoice: _picker, stoneType: _type, supplierChoice: _supplier, ...rest } = values;
    const payload: Values = { ...rest };
    if (usingNewMaterial) delete payload.materialId;

    const res = await createStock(payload);
    if (!res.ok) {
      setError(res.reason);
      setSaving(false);
      // Send them back to the step that can fix it.
      setStep(kind === "CONSUMABLE" ? 1 : 2);
      return;
    }

    setDone(res.ref);
    setSaving(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-rose px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep"
      >
        Add stock
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-stock-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border border-line bg-cream p-6 outline-none sm:rounded-[22px] sm:p-8"
      >
        {done ? (
          <div role="status">
            <h2 className="dsp text-2xl" id="add-stock-title">
              {/* The ref is an identifier someone writes on the stone, so it
                  keeps its case while the heading around it lowercases. */}
              <span className="normal-case">{done}</span> is on the rack
            </h2>
            <p className="mt-3 text-sm text-ink-2">
              It is in stock now, and the movement log shows you put it there.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-rose px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep"
              >
                Add another
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-line bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-2 transition hover:border-rose hover:text-rose"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  Step {step + 1} of {steps.length}
                </div>
                <h2 id="add-stock-title" className="dsp mt-1 text-2xl">
                  {steps[step]}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full border border-line bg-white px-3 py-1 text-sm text-ink-2 transition hover:border-rose hover:text-rose"
              >
                ✕
              </button>
            </div>

            {/* Progress. Decorative — the "Step n of m" above is what a screen
                reader announces. */}
            <div className="mt-5 flex gap-1.5" aria-hidden="true">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${i <= step ? "bg-rose" : "bg-line"}`}
                />
              ))}
            </div>

            <div className="mt-7 grid gap-5">
              {step === 0 ? (
                <div className="grid gap-3">
                  {STOCK_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setValues({ kind: k, ...KIND_DEFAULTS[k] });
                        setError(null);
                        setStep(1);
                      }}
                      className={`rounded-[18px] border p-5 text-left transition ${
                        kind === k
                          ? "border-rose bg-blush"
                          : "border-line bg-white hover:border-rose"
                      }`}
                    >
                      <div className="font-semibold">{STOCK_KIND_LABEL[k]}</div>
                      <div className="mt-1 text-xs text-ink-2">{STOCK_KIND_BLURB[k]}</div>
                    </button>
                  ))}
                </div>
              ) : null}

              {kind === "CONSUMABLE" && step === 1 ? (
                <>
                  <Field id="name" label="What is it?" placeholder="Silicone adhesive">
                    <input
                      id="name"
                      className={field}
                      value={String(values.name ?? "")}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Silicone adhesive"
                    />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field id="unit" label="Counted in">
                      <input
                        id="unit"
                        className={field}
                        value={String(values.unit ?? "")}
                        onChange={(e) => set("unit", e.target.value)}
                        placeholder="tube"
                      />
                    </Field>
                    <Field id="qtyOnHand" label="How many">
                      <input
                        id="qtyOnHand"
                        inputMode="numeric"
                        className={field}
                        value={String(values.qtyOnHand ?? "")}
                        onChange={(e) => set("qtyOnHand", e.target.value)}
                        placeholder="24"
                      />
                    </Field>
                    <Field id="reorderPoint" label="Reorder at">
                      <input
                        id="reorderPoint"
                        inputMode="numeric"
                        className={field}
                        value={String(values.reorderPoint ?? "")}
                        onChange={(e) => set("reorderPoint", e.target.value)}
                        placeholder="6"
                      />
                    </Field>
                  </div>
                  <Field id="unitCost" label="Cost each" hint="Excluding GST.">
                    <input
                      id="unitCost"
                      inputMode="decimal"
                      className={field}
                      value={String(values.unitCost ?? "")}
                      onChange={(e) => set("unitCost", e.target.value)}
                      placeholder="12.50"
                    />
                  </Field>
                </>
              ) : null}

              {kind !== "CONSUMABLE" && step === 1 ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="stoneType" label="Type of stone">
                      <select
                        id="stoneType"
                        className={field}
                        value={stoneType}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            stoneType: e.target.value,
                            // A colour belongs to one type; changing type clears it.
                            materialChoice: "",
                            materialId: "",
                            materialKind: e.target.value,
                            parentSlabId: "",
                          }))
                        }
                      >
                        <option value="">Pick one…</option>
                        {MATERIAL_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {MATERIAL_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="materialChoice" label="Colour">
                      <select
                        id="materialChoice"
                        className={field}
                        disabled={!stoneType}
                        value={String(values.materialChoice ?? "")}
                        onChange={(e) => {
                          const choice = e.target.value;
                          const m = materials.find((x) => x.id === choice);
                          const pick = isCatalogueKey(choice) ? fromCatalogueKey(choice) : null;
                          const t = pick
                            ? String(pick.thicknesses.includes(20) ? 20 : pick.thicknesses[0])
                            : "";
                          setValues((prev) => ({
                            ...prev,
                            materialChoice: choice,
                            materialId: m ? choice : "",
                            // A catalogue colour fills in the new material: name,
                            // supplier, and what it is made in. Only the cost is left.
                            // "Not on the list" starts empty.
                            ...(pick
                              ? {
                                  materialName: pick.fullName,
                                  materialKind: pick.range.kind,
                                  materialFinish: pick.finishes[0],
                                  materialThicknessMm: t,
                                  supplierChoice: suppliers.includes(pick.range.supplier)
                                    ? pick.range.supplier
                                    : NEW_SUPPLIER,
                                  materialSupplier: pick.range.supplier,
                                }
                              : choice === NEW_MATERIAL
                                ? {
                                    materialName: "",
                                    materialFinish: "",
                                    materialThicknessMm: "",
                                    supplierChoice: "",
                                    materialSupplier: "",
                                  }
                                : {}),
                            // The slab it came off is the same stone, so a new colour clears it.
                            parentSlabId: "",
                            // An offcut starts from its material's own thickness and finish.
                            ...(m && prev.kind === "OFFCUT"
                              ? { thicknessMm: String(m.thicknessMm), finish: m.finish }
                              : pick && prev.kind === "OFFCUT"
                                ? { thicknessMm: t, finish: pick.finishes[0] }
                                : {}),
                          }));
                          setError(null);
                        }}
                      >
                        <option value="">{stoneType ? "Pick one…" : "Pick the type first"}</option>
                        {colours.length > 0 ? (
                          <optgroup label="On file">
                            {colours.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.finish}, {m.thicknessMm} mm
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {/* The rest of each range, so the first slab of a colour is a pick too. */}
                        {rangesOf(stoneType).map((range) => (
                          <optgroup key={range.id} label={range.label}>
                            {range.colours
                              .filter((colour) => !onFileFor({ range, colour }, materials))
                              .map((colour) => (
                                <option key={colour.name} value={catalogueKey(range, colour)}>
                                  {colour.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                        <option value={NEW_MATERIAL}>＋ A colour not on the list</option>
                      </select>
                    </Field>
                  </div>

                  {usingNewMaterial ? (
                    <div className="grid gap-5 rounded-[18px] border border-line bg-white p-5">
                      <Field id="materialName" label="Colour name">
                        <input
                          id="materialName"
                          className={field}
                          value={String(values.materialName ?? "")}
                          onChange={(e) => set("materialName", e.target.value)}
                          placeholder="Calacatta Gold"
                        />
                      </Field>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id={suppliers.length > 0 ? "supplierChoice" : "materialSupplier"} label="Supplier">
                          {suppliers.length > 0 ? (
                            <select
                              id="supplierChoice"
                              className={field}
                              value={String(values.supplierChoice ?? "")}
                              onChange={(e) => {
                                const choice = e.target.value;
                                setValues((prev) => ({
                                  ...prev,
                                  supplierChoice: choice,
                                  materialSupplier: choice === NEW_SUPPLIER ? "" : choice,
                                }));
                                setError(null);
                              }}
                            >
                              <option value="">Pick one…</option>
                              {suppliers.map((x) => (
                                <option key={x} value={x}>
                                  {x}
                                </option>
                              ))}
                              <option value={NEW_SUPPLIER}>＋ A new supplier</option>
                            </select>
                          ) : null}
                          {newSupplier ? (
                            <input
                              id="materialSupplier"
                              aria-label="New supplier's name"
                              className={`${field} ${suppliers.length > 0 ? "mt-2" : ""}`}
                              value={String(values.materialSupplier ?? "")}
                              onChange={(e) => set("materialSupplier", e.target.value)}
                              placeholder="Coastline Stone Co"
                            />
                          ) : null}
                        </Field>
                        <Field id="materialFinish" label="Finish">
                          <PickOrType
                            id="materialFinish"
                            label="Finish"
                            className={field}
                            value={String(values.materialFinish ?? "")}
                            onChange={(x) => set("materialFinish", x)}
                            {...finishChoices}
                            placeholder="e.g. Flamed"
                          />
                        </Field>
                        <Field id="materialThicknessMm" label="Thickness">
                          <PickOrType
                            id="materialThicknessMm"
                            label="Thickness"
                            className={field}
                            value={String(values.materialThicknessMm ?? "")}
                            onChange={(x) => set("materialThicknessMm", x)}
                            {...thicknessChoices}
                            format={(x) => `${x} mm`}
                            numeric
                            placeholder="e.g. 15"
                          />
                        </Field>
                      </div>
                      <Field id="materialCostPerSqm" label="Cost per m²" hint="What you pay, not what you charge.">
                        <input
                          id="materialCostPerSqm"
                          inputMode="decimal"
                          className={field}
                          value={String(values.materialCostPerSqm ?? "")}
                          onChange={(e) => set("materialCostPerSqm", e.target.value)}
                          placeholder="480"
                        />
                      </Field>
                    </div>
                  ) : null}
                </>
              ) : null}

              {kind !== "CONSUMABLE" && step === 2 ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="widthMm" label="Width (mm)">
                      <input
                        id="widthMm"
                        inputMode="numeric"
                        className={field}
                        value={String(values.widthMm ?? "")}
                        onChange={(e) => set("widthMm", e.target.value)}
                        placeholder="1400"
                      />
                    </Field>
                    <Field id="lengthMm" label="Length (mm)">
                      <input
                        id="lengthMm"
                        inputMode="numeric"
                        className={field}
                        value={String(values.lengthMm ?? "")}
                        onChange={(e) => set("lengthMm", e.target.value)}
                        placeholder="3200"
                      />
                    </Field>
                  </div>

                  <Field id="rack" label="Rack or bay">
                    <input
                      id="rack"
                      className={field}
                      value={String(values.rack ?? "")}
                      onChange={(e) => set("rack", e.target.value)}
                      placeholder="A3"
                    />
                  </Field>

                  {kind === "SLAB" ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field id="cost" label="What it cost" hint="The whole slab, excluding GST.">
                        <input
                          id="cost"
                          inputMode="decimal"
                          className={field}
                          value={String(values.cost ?? "")}
                          onChange={(e) => set("cost", e.target.value)}
                          placeholder="2150"
                        />
                      </Field>
                      <Field id="arrivedAt" label="Arrived">
                        <input
                          id="arrivedAt"
                          type="date"
                          className={field}
                          value={String(values.arrivedAt ?? "")}
                          onChange={(e) => set("arrivedAt", e.target.value)}
                        />
                      </Field>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="thicknessMm" label="Thickness">
                          <PickOrType
                            id="thicknessMm"
                            label="Thickness"
                            className={field}
                            value={String(values.thicknessMm ?? "")}
                            onChange={(x) => set("thicknessMm", x)}
                            {...thicknessChoices}
                            format={(x) => `${x} mm`}
                            numeric
                            placeholder="e.g. 15"
                          />
                        </Field>
                        <Field id="finish" label="Finish">
                          <PickOrType
                            id="finish"
                            label="Finish"
                            className={field}
                            value={String(values.finish ?? "")}
                            onChange={(x) => set("finish", x)}
                            {...finishChoices}
                            placeholder="e.g. Flamed"
                          />
                        </Field>
                      </div>

                      {parentSlabs.length > 0 ? (
                        <Field id="parentSlabId" label="Cut from" hint="Optional — links it to the slab it came off.">
                          <select
                            id="parentSlabId"
                            className={field}
                            value={String(values.parentSlabId ?? "")}
                            onChange={(e) => set("parentSlabId", e.target.value)}
                          >
                            <option value="">Not from a slab on file</option>
                            {parentSlabs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.ref} — {s.materialName}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}

                      <Field id="notes" label="Notes" hint="Optional.">
                        <input
                          id="notes"
                          className={field}
                          value={String(values.notes ?? "")}
                          onChange={(e) => set("notes", e.target.value)}
                          placeholder="Small chip on one corner"
                        />
                      </Field>

                      <label className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={values.listedPublicly === true}
                          onChange={(e) => set("listedPublicly", e.target.checked)}
                        />
                        <span>
                          Show it on the website
                          <span className="block text-xs text-ink-2">
                            Puts it on the public offcuts page for customers to ask about.
                          </span>
                        </span>
                      </label>
                    </>
                  )}
                </>
              ) : null}

              {step === last && step > 0 ? (
                <dl className="divide-y divide-line rounded-[18px] border border-line bg-white text-sm">
                  {summarise(values, materials, slabs, kind).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-5 py-3">
                      <dt className="text-ink-2">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-xl border border-rose bg-blush px-4 py-3 text-sm">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => (step === 0 ? close() : setStep((s) => s - 1))}
                className="rounded-full border border-line bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-2 transition hover:border-rose hover:text-rose"
              >
                {step === 0 ? "Cancel" : "Back"}
              </button>

              {step === last && step > 0 ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-full bg-rose px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Put it on the rack"}
                </button>
              ) : step > 0 ? (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-full bg-rose px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep"
                >
                  Next
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** What the last step reads back, so a typo is caught before it is saved. */
function summarise(
  v: Values,
  materials: MaterialOption[],
  slabs: SlabOption[],
  kind: StockKind | null,
): Array<[string, string]> {
  const s = (k: string) => String(v[k] ?? "").trim();
  const rows: Array<[string, string]> = [];

  if (kind === "CONSUMABLE") {
    rows.push(["Item", s("name")]);
    rows.push(["On hand", `${s("qtyOnHand")} ${s("unit")}`]);
    rows.push(["Reorder at", s("reorderPoint")]);
    rows.push(["Cost each", `$${s("unitCost")}`]);
    return rows;
  }

  const material =
    materials.find((m) => m.id === s("materialId"))?.name ?? s("materialName") ?? "";
  rows.push(["Material", material || "—"]);
  if (!s("materialId")) rows.push(["New material", `$${s("materialCostPerSqm")} per m²`]);

  const w = Number(s("widthMm"));
  const l = Number(s("lengthMm"));
  rows.push(["Size", `${s("widthMm")} × ${s("lengthMm")} mm`]);
  if (w > 0 && l > 0) rows.push(["Area", `${((w / 1000) * (l / 1000)).toFixed(2)} m²`]);
  rows.push(["Rack", s("rack")]);

  if (kind === "SLAB") {
    rows.push(["Cost", `$${s("cost")}`]);
    rows.push(["Arrived", s("arrivedAt")]);
  } else {
    rows.push(["Thickness", `${s("thicknessMm")} mm`]);
    rows.push(["Finish", s("finish")]);
    const parent = slabs.find((x) => x.id === s("parentSlabId"));
    if (parent) rows.push(["Cut from", parent.ref]);
    rows.push(["On the website", v.listedPublicly === true ? "Yes" : "No"]);
  }

  return rows;
}

function Field({
  id,
  label: text,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={label} htmlFor={id}>
        {text}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
