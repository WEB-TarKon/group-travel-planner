-- CreateTable
CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceUah" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodChoice" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodItem_tripId_idx" ON "FoodItem"("tripId");

-- CreateIndex
CREATE INDEX "FoodChoice_tripId_userId_idx" ON "FoodChoice"("tripId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodChoice_tripId_userId_itemId_key" ON "FoodChoice"("tripId", "userId", "itemId");

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodChoice" ADD CONSTRAINT "FoodChoice_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodChoice" ADD CONSTRAINT "FoodChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodChoice" ADD CONSTRAINT "FoodChoice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
