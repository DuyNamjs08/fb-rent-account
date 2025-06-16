-- CreateTable
CREATE TABLE "message_requests" (
    "id" TEXT NOT NULL,
    "supportRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
