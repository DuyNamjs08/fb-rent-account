/*
  Warnings:

  - A unique constraint covering the columns `[referral_code]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - The required column `referral_code` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MAIN', 'SUB');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_type" "AccountType" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "invited_by_id" TEXT,
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "referral_code" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "point_transfer" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_transfer_from_user_id_idx" ON "point_transfer"("from_user_id");

-- CreateIndex
CREATE INDEX "point_transfer_to_user_id_idx" ON "point_transfer"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transfer" ADD CONSTRAINT "point_transfer_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transfer" ADD CONSTRAINT "point_transfer_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
