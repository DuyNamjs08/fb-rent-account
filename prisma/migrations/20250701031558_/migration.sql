-- AlterTable
ALTER TABLE "point_usages" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'vnd';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "net_usd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usd" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "amount_usd" INTEGER NOT NULL DEFAULT 0;
