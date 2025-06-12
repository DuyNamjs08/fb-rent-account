-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "budget_id" TEXT;
