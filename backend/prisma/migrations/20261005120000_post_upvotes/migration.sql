-- CreateTable
CREATE TABLE "post_upvotes" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_upvotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_upvotes_user_id_idx" ON "post_upvotes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_upvotes_post_id_user_id_key" ON "post_upvotes"("post_id", "user_id");

-- AddForeignKey
ALTER TABLE "post_upvotes" ADD CONSTRAINT "post_upvotes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "rescue_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_upvotes" ADD CONSTRAINT "post_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
