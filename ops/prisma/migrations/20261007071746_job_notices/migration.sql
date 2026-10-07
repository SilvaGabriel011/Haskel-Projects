-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "calendarEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reminderDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "summaryEmailedAt" TIMESTAMP(3),
ADD COLUMN     "targetCompletionAt" TIMESTAMP(3);
