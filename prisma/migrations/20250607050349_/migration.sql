/*
  Warnings:

  - You are about to drop the column `bot_id` on the `point_usages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "facebook_partner_bm" ADD COLUMN     "bot_id" TEXT;

-- AlterTable
ALTER TABLE "point_usages" DROP COLUMN "bot_id";
