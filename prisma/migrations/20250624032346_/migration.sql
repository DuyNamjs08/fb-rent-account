-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "country" TEXT DEFAULT 'vi',
ALTER COLUMN "start_date" DROP NOT NULL,
ALTER COLUMN "end_date" DROP NOT NULL;
