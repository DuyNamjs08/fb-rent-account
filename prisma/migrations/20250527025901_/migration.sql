-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "role_id" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "short_code" TEXT NOT NULL,
    "percentage" INTEGER DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "amountVND" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bank" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transactionID" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_usages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_used" INTEGER NOT NULL,
    "service_type" TEXT NOT NULL DEFAULT 'ads_account',
    "target_account" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL DEFAULT '',
    "refresh_token" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_status" INTEGER NOT NULL DEFAULT 1,
    "amount_spent" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "business" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "created_time" TEXT,
    "disable_reason" INTEGER,
    "name" TEXT NOT NULL,
    "spend_cap" TEXT,
    "timezone_name" TEXT NOT NULL,
    "timezone_offset_hours_utc" DOUBLE PRECISION,
    "owner" TEXT,
    "is_personal" INTEGER,
    "is_prepay_account" BOOLEAN,
    "tax_id" TEXT,
    "tax_id_status" INTEGER,
    "account_controls" JSONB,
    "users" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ad_account_promotable_objects" JSONB,
    "age" DOUBLE PRECISION NOT NULL,
    "agency_client_declaration" JSONB,
    "attribution_spec" JSONB,
    "brand_safety_content_filter_levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "business_city" TEXT,
    "business_country_code" TEXT,
    "business_name" TEXT,
    "business_state" TEXT,
    "business_street" TEXT,
    "business_street2" TEXT,
    "business_zip" TEXT,
    "can_create_brand_lift_study" BOOLEAN,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_audience_info" JSONB,
    "default_dsa_beneficiary" TEXT,
    "default_dsa_payor" TEXT,
    "direct_deals_tos_accepted" BOOLEAN,
    "end_advertiser" TEXT,
    "end_advertiser_name" TEXT,
    "existing_customers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expired_funding_source_details" JSONB,
    "extended_credit_invoice_group" JSONB,
    "failed_delivery_checks" JSONB,
    "fb_entity" INTEGER,
    "funding_source" TEXT,
    "funding_source_details" JSONB,
    "has_migrated_permissions" BOOLEAN,
    "has_page_authorized_adaccount" BOOLEAN,
    "io_number" TEXT,
    "is_attribution_spec_system_default" BOOLEAN,
    "is_direct_deals_enabled" BOOLEAN,
    "is_in_3ds_authorization_enabled_market" BOOLEAN,
    "is_notifications_enabled" BOOLEAN,
    "line_numbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "media_agency" TEXT,
    "min_campaign_group_spend_cap" TEXT,
    "min_daily_budget" INTEGER,
    "offsite_pixels_tos_accepted" BOOLEAN,
    "partner" TEXT,
    "rf_spec" JSONB,
    "show_checkout_experience" BOOLEAN,
    "tax_id_type" TEXT,
    "tos_accepted" JSONB,
    "user_tasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "user_tos_accepted" JSONB,
    "vertical_name" TEXT,

    CONSTRAINT "ads_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_short_code_key" ON "users"("short_code");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_user_id_key" ON "tokens"("user_id");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_usages" ADD CONSTRAINT "point_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
