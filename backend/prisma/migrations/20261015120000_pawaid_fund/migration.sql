-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FinancialTransactionType" ADD VALUE 'MARKETPLACE_PROFIT';
ALTER TYPE "FinancialTransactionType" ADD VALUE 'RESCUE_FUND_ALLOCATION';

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "rescue_fund_id" UUID,
ALTER COLUMN "donor_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unit_cost" INTEGER;

-- Existing order lines take their product's current cost price
UPDATE "order_items" oi SET "unit_cost" = p."cost_price" FROM "products" p WHERE p."id" = oi."product_id";
ALTER TABLE "order_items" ALTER COLUMN "unit_cost" SET NOT NULL;

-- CreateIndex
CREATE INDEX "donations_rescue_fund_id_idx" ON "donations"("rescue_fund_id");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_rescue_fund_id_fkey" FOREIGN KEY ("rescue_fund_id") REFERENCES "rescue_funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The single PawAid Fund row (PAWAID_FUND_ID in services/fund.services.js)
INSERT INTO "rescue_funds" ("id", "total_available", "total_used", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- A donation comes from exactly one place: a user, or the PawAid Fund
ALTER TABLE "donations" ADD CONSTRAINT "donations_one_source_check"
    CHECK (("donor_id" IS NULL) <> ("rescue_fund_id" IS NULL));

-- The fund can never give out more than it has received
ALTER TABLE "rescue_funds" ADD CONSTRAINT "rescue_funds_not_overdrawn_check"
    CHECK ("total_used" >= 0 AND "total_used" <= "total_available");
