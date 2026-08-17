-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "aiReplyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiReplyWindowStart" TIMESTAMP(3);
