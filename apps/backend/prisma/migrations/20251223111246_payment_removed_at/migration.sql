/*
  Warnings:

  - You are about to drop the column `proofUrl` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "proofUrl",
ADD COLUMN     "removedAt" TIMESTAMP(3);
