/*
  Warnings:

  - You are about to drop the column `address` on the `volunteer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `volunteer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `profile_picture_url` on the `volunteer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profile_picture_url" TEXT;

-- AlterTable
ALTER TABLE "volunteer_profiles" DROP COLUMN "address",
DROP COLUMN "phone",
DROP COLUMN "profile_picture_url";
