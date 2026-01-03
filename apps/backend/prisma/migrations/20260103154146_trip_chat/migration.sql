-- CreateTable
CREATE TABLE "TripChatMessage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TripChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripChatMention" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TripChatMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripChatReadState" (
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadMessageId" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "TripChatReadState_pkey" PRIMARY KEY ("tripId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripChatMention_messageId_userId_key" ON "TripChatMention"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "TripChatMessage" ADD CONSTRAINT "TripChatMessage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatMessage" ADD CONSTRAINT "TripChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatMessage" ADD CONSTRAINT "TripChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "TripChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatMention" ADD CONSTRAINT "TripChatMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TripChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatMention" ADD CONSTRAINT "TripChatMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatReadState" ADD CONSTRAINT "TripChatReadState_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "TripChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatReadState" ADD CONSTRAINT "TripChatReadState_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripChatReadState" ADD CONSTRAINT "TripChatReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
