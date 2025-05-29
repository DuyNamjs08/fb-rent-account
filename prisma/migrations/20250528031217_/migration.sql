-- CreateTable
CREATE TABLE "facebook_partner_bm" (
    "id" TEXT NOT NULL,
    "bm_id" TEXT NOT NULL,
    "ads_account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_partner_bm_pkey" PRIMARY KEY ("id")
);
