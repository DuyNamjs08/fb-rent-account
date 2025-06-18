-- AlterTable
ALTER TABLE "ads_accounts" ADD COLUMN     "active" BOOLEAN DEFAULT true,
ADD COLUMN     "is_visa_account" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "facebook_partner_bm" ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "is_sefl_used_visa" BOOLEAN DEFAULT false,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "update_package" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "facebook_visa" (
    "id" TEXT NOT NULL,
    "visa_name" TEXT NOT NULL,
    "visa_number" TEXT NOT NULL,
    "visa_expiration" TEXT NOT NULL,
    "visa_cvv" TEXT NOT NULL,
    "verify_code" TEXT NOT NULL,
    "bm_name" TEXT NOT NULL,
    "bm_origin" TEXT NOT NULL,
    "ads_account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_visa_pkey" PRIMARY KEY ("id")
);
