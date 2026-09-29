-- Eleven stages, and a record of how long each one took.
--
-- The status enum is replaced rather than extended, so existing rows are mapped
-- across instead of dropped: Prisma's own generator would have removed the old
-- values and failed on any row still using one.
--
-- Where two old stages collapse onto one new stage (CUTTING and FABRICATING
-- both become FACTORY) that is deliberate — the new flow has one making stage.

CREATE TYPE "OrderStatus_new" AS ENUM (
  'INITIAL',
  'QUOTE_REQUEST',
  'QUOTED',
  'ORDER_ACTIVE',
  'PURCHASE_ORDER',
  'MEASURED',
  'DETAILS',
  'FACTORY',
  'READY_FOR_DISPATCH',
  'INSTALLATION',
  'INVOICE',
  'LOST'
);

-- The default must go before the column can be retyped.
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE "status"::text
      WHEN 'ENQUIRY'     THEN 'INITIAL'
      WHEN 'QUOTED'      THEN 'QUOTED'
      WHEN 'WON'         THEN 'ORDER_ACTIVE'
      WHEN 'CUTTING'     THEN 'FACTORY'
      WHEN 'TEMPLATED'   THEN 'MEASURED'
      WHEN 'FABRICATING' THEN 'FACTORY'
      WHEN 'SCHEDULED'   THEN 'READY_FOR_DISPATCH'
      WHEN 'INSTALLED'   THEN 'INSTALLATION'
      WHEN 'COMPLETE'    THEN 'INVOICE'
      WHEN 'LOST'        THEN 'LOST'
      ELSE 'INITIAL'
    END
  )::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'INITIAL';

-- One spell in one stage. The row with exitedAt NULL is where the job is now.
CREATE TABLE "OrderStage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "OrderStatus" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "movedById" TEXT,

    CONSTRAINT "OrderStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStage_orderId_enteredAt_idx" ON "OrderStage"("orderId", "enteredAt");
CREATE INDEX "OrderStage_stage_idx" ON "OrderStage"("stage");

ALTER TABLE "OrderStage" ADD CONSTRAINT "OrderStage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStage" ADD CONSTRAINT "OrderStage_movedById_fkey"
  FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Give every existing job an open spell at the stage it is already in, dated
-- from the best timestamp on the row. Without this the follow-up board has no
-- history to read and every existing card falls back to guessing from the
-- creation date.
INSERT INTO "OrderStage" ("id", "orderId", "stage", "enteredAt", "exitedAt", "movedById")
SELECT
  'seedstage_' || "id",
  "id",
  "status",
  COALESCE("wonAt", "createdAt"),
  CASE WHEN "status" IN ('INVOICE', 'LOST') THEN COALESCE("completedAt", "createdAt") ELSE NULL END,
  NULL
FROM "Order";
