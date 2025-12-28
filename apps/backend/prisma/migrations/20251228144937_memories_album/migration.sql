-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'AUDIO');

-- AlterTable
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "TripMemory" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "text" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMemoryDone" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripMemoryDone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripMemory_tripId_idx" ON "TripMemory"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripMemoryDone_tripId_userId_key" ON "TripMemoryDone"("tripId", "userId");

-- AddForeignKey
ALTER TABLE "TripMemory" ADD CONSTRAINT "TripMemory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMemory" ADD CONSTRAINT "TripMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMemoryDone" ADD CONSTRAINT "TripMemoryDone_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMemoryDone" ADD CONSTRAINT "TripMemoryDone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
