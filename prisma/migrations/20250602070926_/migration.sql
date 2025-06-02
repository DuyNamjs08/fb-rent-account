/*
  Warnings:

  - Added the required column `bm_id` to the `facebook_bm` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "facebook_bm" ADD COLUMN     "bm_id" TEXT NOT NULL;
