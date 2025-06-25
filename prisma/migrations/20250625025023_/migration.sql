/*
  Warnings:

  - Added the required column `user_mail_pass` to the `configs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "configs" ADD COLUMN     "user_mail_pass" TEXT NOT NULL;
