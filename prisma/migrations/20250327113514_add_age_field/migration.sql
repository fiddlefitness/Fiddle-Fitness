/*
  Warnings:

  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Pool" DROP CONSTRAINT "Pool_eventId_fkey";

-- DropForeignKey
ALTER TABLE "PoolAttendee" DROP CONSTRAINT "PoolAttendee_poolId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "age" TEXT,
ADD COLUMN     "contextData" JSONB,
ADD COLUMN     "conversationState" TEXT DEFAULT 'idle',
ADD COLUMN     "lastInteraction" TIMESTAMP(3),
ALTER COLUMN "email" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolAttendee" ADD CONSTRAINT "PoolAttendee_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
