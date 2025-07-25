/*
  Warnings:

  - A unique constraint covering the columns `[account_id]` on the table `ads_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "facebook_partner_bm" ALTER COLUMN "end_date" DROP NOT NULL,
ALTER COLUMN "end_date" DROP DEFAULT,
ALTER COLUMN "end_date" SET DATA TYPE TEXT,
ALTER COLUMN "start_date" DROP NOT NULL,
ALTER COLUMN "start_date" DROP DEFAULT,
ALTER COLUMN "start_date" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "percentage" SET DEFAULT 0.05;

-- CreateIndex
CREATE UNIQUE INDEX "ads_accounts_account_id_key" ON "ads_accounts"("account_id");

-- AddForeignKey
ALTER TABLE "facebook_partner_bm" ADD CONSTRAINT "facebook_partner_bm_ads_account_id_fkey" FOREIGN KEY ("ads_account_id") REFERENCES "ads_accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_rewards" ADD CONSTRAINT "ad_rewards_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "ads_accounts"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;
