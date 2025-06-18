/*
  Warnings:

  - The `end_date` column on the `facebook_partner_bm` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `start_date` column on the `facebook_partner_bm` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "facebook_partner_bm" DROP COLUMN "end_date",
ADD COLUMN     "end_date" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "start_date",
ADD COLUMN     "start_date" TEXT[] DEFAULT ARRAY[]::TEXT[];
