/*
  Warnings:

  - Added the required column `updated_at` to the `user_vouchers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_vouchers" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'vi',
    "admin_mail" TEXT NOT NULL,
    "user_mail" TEXT NOT NULL,
    "email_app_pass" TEXT NOT NULL,
    "email_app" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);
