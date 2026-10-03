-- Every user gets a wallet: wallets move from volunteer_profiles to users.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'WALLET' BEFORE 'OTHER';

-- Point existing volunteer wallets at the volunteer's user, keeping balances and history
ALTER TABLE "wallets" ADD COLUMN "user_id" UUID;

UPDATE "wallets" w
SET "user_id" = vp."user_id"
FROM "volunteer_profiles" vp
WHERE vp."id" = w."volunteer_id";

ALTER TABLE "wallets" DROP CONSTRAINT "wallets_volunteer_id_fkey";
DROP INDEX "wallets_volunteer_id_key";
ALTER TABLE "wallets" DROP COLUMN "volunteer_id";

-- Give every user who doesn't have one yet an empty wallet
INSERT INTO "wallets" ("id", "user_id", "balance", "updated_at")
SELECT gen_random_uuid(), u."id", 0, NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "wallets" w WHERE w."user_id" = u."id");

ALTER TABLE "wallets" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
