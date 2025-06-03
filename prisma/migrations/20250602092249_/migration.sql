/*
  Warnings:

  - A unique constraint covering the columns `[bm_id]` on the table `facebook_partner_bm` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "facebook_partner_bm_bm_id_key" ON "facebook_partner_bm"("bm_id");
