-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinResetExpires" TIMESTAMP(3),
ADD COLUMN     "pinResetHash" TEXT,
ADD COLUMN     "pinResetSentAt" TIMESTAMP(3),
ADD COLUMN     "pinResetTries" INTEGER NOT NULL DEFAULT 0;

