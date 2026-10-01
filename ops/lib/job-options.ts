/**
 * The lists behind the New job dropdowns.
 *
 * Kept apart from lib/new-job.ts, which writes to the database: these are
 * imported by the form in the browser, and must not pull Prisma in with them.
 */
import type { CustomerKind, CustomerSource, JobType, Pipeline } from "@prisma/client";

export const JOB_TYPES: readonly JobType[] = [
  "OFFCUT_PROJECT",
  "VANITY_TOP",
  "SMALL_BENCHTOP",
  "REPAIR",
  "CUTOUT",
  "TOP_REMOVAL",
  "FULL_BENCHTOP",
  "SPLASHBACK",
] as const;

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  OFFCUT_PROJECT: "Offcut project",
  VANITY_TOP: "Vanity top",
  SMALL_BENCHTOP: "Small benchtop",
  REPAIR: "Repair",
  CUTOUT: "Cut-out",
  TOP_REMOVAL: "Top removal",
  FULL_BENCHTOP: "Full benchtop",
  SPLASHBACK: "Splashback",
};

/** Benchtop installs run the long board; everything else starts on the short one. */
export function defaultPipeline(jobType: JobType): Pipeline {
  return jobType === "FULL_BENCHTOP" || jobType === "SPLASHBACK" ? "FULL" : "SHORT";
}

export const CUSTOMER_SOURCES: readonly CustomerSource[] = [
  "PHONE",
  "REFERRAL",
  "REPEAT",
  "WALK_IN",
  "WEBSITE",
  "OFFCUTS_PAGE",
] as const;

export const CUSTOMER_SOURCE_LABEL: Record<CustomerSource, string> = {
  PHONE: "Phoned in",
  REFERRAL: "Referral",
  REPEAT: "Repeat client",
  WALK_IN: "Walk-in",
  WEBSITE: "Website",
  OFFCUTS_PAGE: "Offcuts page",
};

export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  PERSON: "A person",
  COMPANY: "A company",
};
