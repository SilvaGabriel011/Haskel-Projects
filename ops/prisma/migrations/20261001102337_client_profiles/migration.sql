-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('PERSON', 'COMPANY');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "kind" "CustomerKind" NOT NULL DEFAULT 'PERSON';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "siteContactName" TEXT,
ADD COLUMN     "siteContactPhone" TEXT;
