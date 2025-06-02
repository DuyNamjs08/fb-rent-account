-- CreateTable
CREATE TABLE "facebook_bm" (
    "id" TEXT NOT NULL,
    "bm_name" TEXT NOT NULL,
    "list_ads_account" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "system_user_token" TEXT NOT NULL,
    "status" TEXT DEFAULT 'success',
    "status_id" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_bm_pkey" PRIMARY KEY ("id")
);
