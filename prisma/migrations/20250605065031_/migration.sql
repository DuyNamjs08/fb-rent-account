-- CreateTable
CREATE TABLE "cookies" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "storage_state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cookies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cookies_email_key" ON "cookies"("email");
