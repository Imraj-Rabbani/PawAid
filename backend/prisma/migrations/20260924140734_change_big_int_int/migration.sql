/*
  Warnings:

  - You are about to alter the column `total_available` on the `rescue_funds` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `total_used` on the `rescue_funds` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `amount` on the `wallet_transactions` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "rescue_funds" ALTER COLUMN "total_available" SET DATA TYPE INTEGER,
ALTER COLUMN "total_used" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "wallet_transactions" ALTER COLUMN "amount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DATA TYPE INTEGER;
