-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('USER_SUSPENDED', 'USER_REACTIVATED', 'VOLUNTEER_REVOKED', 'VOLUNTEER_RESTORED', 'POST_STATUS_CHANGED', 'POST_TAKEN_DOWN', 'REPORT_STATUS_CHANGED', 'AREA_CREATED', 'AREA_RENAMED', 'AREA_DELETED', 'CATEGORY_CREATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'ORDER_STATUS_CHANGED', 'FUND_DONATION');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('USER', 'VOLUNTEER', 'RESCUE_POST', 'POST_REPORT', 'RESCUE_AREA', 'PRODUCT_CATEGORY', 'PRODUCT', 'ORDER', 'DONATION');

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" "AdminAction" NOT NULL,
    "target_type" "AuditTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit entries are append only: nothing in the app may rewrite or remove one
CREATE FUNCTION admin_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_logs is append only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON "admin_audit_logs"
    FOR EACH ROW EXECUTE FUNCTION admin_audit_logs_append_only();
