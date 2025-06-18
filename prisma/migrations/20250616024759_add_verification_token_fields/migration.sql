-- AlterTable
ALTER TABLE "users" ADD COLUMN     "token_expires_at" TIMESTAMP(3),
ADD COLUMN     "verification_token" TEXT;
