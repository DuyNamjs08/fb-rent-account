-- CreateTable
CREATE TABLE "ad_rewards" (
    "id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "ad_account_name" TEXT NOT NULL,
    "minimum_amount_spent" DOUBLE PRECISION NOT NULL,
    "qualifying_amount_spent" DOUBLE PRECISION NOT NULL,
    "rewards_earned" DOUBLE PRECISION NOT NULL,
    "featured_product" TEXT NOT NULL,
    "promotion" TEXT NOT NULL,
    "start_period" TIMESTAMP(3) NOT NULL,
    "end_period" TIMESTAMP(3) NOT NULL,
    "date_of_deposit" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_rewards_pkey" PRIMARY KEY ("id")
);
