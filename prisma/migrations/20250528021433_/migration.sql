/*
  Warnings:

  - A unique constraint covering the columns `[short_code]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_short_code_key" ON "transactions"("short_code");
