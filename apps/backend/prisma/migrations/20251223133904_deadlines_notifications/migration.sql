/*
  Warnings:

  - You are about to drop the column `body` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `payDeadline` on the `TripFinance` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEADLINE_CHANGED', 'DEADLINE_REMINDER_ORGANIZER');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "body",
ADD COLUMN     "message" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "tripId" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'DEADLINE_CHANGED',
ALTER COLUMN "title" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TripFinance" DROP COLUMN "payDeadline",
ADD COLUMN     "payDeadlineOrganizer" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payDeadlineUser" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
