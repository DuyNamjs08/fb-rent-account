/*
  Warnings:

  - You are about to drop the column `role_id` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "role_id",
ADD COLUMN     "list_ads_account" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "role" TEXT DEFAULT 'user',
ADD COLUMN     "username" TEXT;
