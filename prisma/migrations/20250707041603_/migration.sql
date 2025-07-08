/*
  Warnings:

  - You are about to drop the column `short_code` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_short_code_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "short_code";
