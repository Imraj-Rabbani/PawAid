-- Expenses are documented by the volunteer, so most aren't paid from the PawAid Fund
ALTER TABLE "rescue_expenses" ALTER COLUMN "rescue_fund_id" DROP NOT NULL,
ADD COLUMN     "order_id" UUID,
ADD COLUMN     "receipt_url" TEXT;

-- DropIndex
DROP INDEX "rescue_expenses_rescue_post_id_idx";

-- CreateIndex
CREATE INDEX "rescue_expenses_rescue_post_id_created_at_idx" ON "rescue_expenses"("rescue_post_id", "created_at");

-- CreateIndex
CREATE INDEX "rescue_expenses_order_id_idx" ON "rescue_expenses"("order_id");

-- AddForeignKey
ALTER TABLE "rescue_expenses" ADD CONSTRAINT "rescue_expenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
