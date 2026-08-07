-- CreateEnum
CREATE TYPE "PostMode" AS ENUM ('post', 'quote', 'repost');

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN "postMode" "PostMode" NOT NULL DEFAULT 'post';
