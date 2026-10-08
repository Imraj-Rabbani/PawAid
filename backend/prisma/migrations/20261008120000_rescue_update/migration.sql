-- AlterTable
ALTER TABLE "rescue_posts" ADD COLUMN     "rescue_note" TEXT,
ADD COLUMN     "rescue_photo_url" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3);
