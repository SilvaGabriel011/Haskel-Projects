-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('ENGINEERED', 'NATURAL', 'SINTERED');

-- CreateEnum
CREATE TYPE "SlabStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'CUT', 'SOLD');

-- CreateEnum
CREATE TYPE "OffcutStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('RECEIVED', 'RESERVED', 'RELEASED', 'CONSUMED', 'ADJUSTED', 'WASTED');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('WEBSITE', 'OFFCUTS_PAGE', 'PHONE', 'REFERRAL', 'REPEAT', 'WALK_IN');

-- CreateEnum
CREATE TYPE "Pipeline" AS ENUM ('SHORT', 'FULL');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('OFFCUT_PROJECT', 'VANITY_TOP', 'SMALL_BENCHTOP', 'REPAIR', 'CUTOUT', 'TOP_REMOVAL', 'FULL_BENCHTOP', 'SPLASHBACK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ENQUIRY', 'QUOTED', 'WON', 'CUTTING', 'TEMPLATED', 'FABRICATING', 'SCHEDULED', 'INSTALLED', 'COMPLETE', 'LOST');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('TEMPLATE', 'FABRICATE', 'INSTALL', 'REPAIR', 'DELIVERY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "supplier" TEXT NOT NULL,
    "thicknessMm" INTEGER NOT NULL DEFAULT 20,
    "finish" TEXT NOT NULL,
    "costPerSqmCents" INTEGER NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slab" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "status" "SlabStatus" NOT NULL DEFAULT 'IN_STOCK',
    "rack" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,

    CONSTRAINT "Slab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offcut" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "parentSlabId" TEXT,
    "materialId" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "thicknessMm" INTEGER NOT NULL DEFAULT 20,
    "finish" TEXT NOT NULL,
    "status" "OffcutStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rack" TEXT NOT NULL,
    "listedPublicly" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offcut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consumable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qtyOnHand" INTEGER NOT NULL,
    "reorderPoint" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,

    CONSTRAINT "Consumable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "kind" "MovementKind" NOT NULL,
    "slabId" TEXT,
    "offcutId" TEXT,
    "consumableId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "suburb" TEXT NOT NULL,
    "source" "CustomerSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pipeline" "Pipeline" NOT NULL,
    "jobType" "JobType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ENQUIRY',
    "address" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "notes" TEXT,
    "quoteCents" INTEGER NOT NULL DEFAULT 0,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wonAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lostReason" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "materialId" TEXT,
    "slabId" TEXT,
    "offcutId" TEXT,
    "sqm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labourHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" "EventKind" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignee" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ScheduleAssignee_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateIndex
CREATE INDEX "Material_kind_idx" ON "Material"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Slab_ref_key" ON "Slab"("ref");

-- CreateIndex
CREATE INDEX "Slab_status_idx" ON "Slab"("status");

-- CreateIndex
CREATE INDEX "Slab_materialId_idx" ON "Slab"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Offcut_ref_key" ON "Offcut"("ref");

-- CreateIndex
CREATE INDEX "Offcut_status_idx" ON "Offcut"("status");

-- CreateIndex
CREATE INDEX "Offcut_listedPublicly_idx" ON "Offcut"("listedPublicly");

-- CreateIndex
CREATE INDEX "Offcut_materialId_idx" ON "Offcut"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Consumable_name_key" ON "Consumable"("name");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_kind_idx" ON "StockMovement"("kind");

-- CreateIndex
CREATE INDEX "Customer_source_idx" ON "Customer"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Order_jobNumber_key" ON "Order"("jobNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_pipeline_idx" ON "Order"("pipeline");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEvent_googleEventId_key" ON "ScheduleEvent"("googleEventId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_startAt_idx" ON "ScheduleEvent"("startAt");

-- CreateIndex
CREATE INDEX "ScheduleEvent_kind_idx" ON "ScheduleEvent"("kind");

-- CreateIndex
CREATE INDEX "ScheduleAssignee_userId_idx" ON "ScheduleAssignee"("userId");

-- AddForeignKey
ALTER TABLE "Slab" ADD CONSTRAINT "Slab_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offcut" ADD CONSTRAINT "Offcut_parentSlabId_fkey" FOREIGN KEY ("parentSlabId") REFERENCES "Slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offcut" ADD CONSTRAINT "Offcut_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "Slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_offcutId_fkey" FOREIGN KEY ("offcutId") REFERENCES "Offcut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "Slab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_offcutId_fkey" FOREIGN KEY ("offcutId") REFERENCES "Offcut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignee" ADD CONSTRAINT "ScheduleAssignee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignee" ADD CONSTRAINT "ScheduleAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
