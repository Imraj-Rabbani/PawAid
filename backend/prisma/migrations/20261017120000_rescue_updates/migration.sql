-- CreateTable
CREATE TABLE "rescue_updates" (
    "id" UUID NOT NULL,
    "rescue_post_id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rescue_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rescue_update_images" (
    "id" UUID NOT NULL,
    "rescue_update_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,

    CONSTRAINT "rescue_update_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rescue_updates_rescue_post_id_created_at_idx" ON "rescue_updates"("rescue_post_id", "created_at");

-- CreateIndex
CREATE INDEX "rescue_updates_volunteer_id_idx" ON "rescue_updates"("volunteer_id");

-- CreateIndex
CREATE INDEX "rescue_update_images_rescue_update_id_idx" ON "rescue_update_images"("rescue_update_id");

-- AddForeignKey
ALTER TABLE "rescue_updates" ADD CONSTRAINT "rescue_updates_rescue_post_id_fkey" FOREIGN KEY ("rescue_post_id") REFERENCES "rescue_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rescue_updates" ADD CONSTRAINT "rescue_updates_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rescue_update_images" ADD CONSTRAINT "rescue_update_images_rescue_update_id_fkey" FOREIGN KEY ("rescue_update_id") REFERENCES "rescue_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

