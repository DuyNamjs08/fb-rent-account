/*
  Warnings:

  - A unique constraint covering the columns `[ad_account_id,start_period,end_period]` on the table `ad_rewards` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ad_rewards_ad_account_id_start_period_end_period_key" ON "ad_rewards"("ad_account_id", "start_period", "end_period");
