-- AlterTable
ALTER TABLE "users" ADD COLUMN     "area_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "rescue_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
