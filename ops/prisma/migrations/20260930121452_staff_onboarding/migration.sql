-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Everyone already on the staff list has been using the app; the walkthrough
-- is for people added from now on.
UPDATE "User" SET "onboardedAt" = NOW() WHERE "onboardedAt" IS NULL;
