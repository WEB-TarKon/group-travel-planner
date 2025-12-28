-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "note" TEXT,
ADD COLUMN     "proofMime" TEXT,
ADD COLUMN     "proofName" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "rejectReason" TEXT;
