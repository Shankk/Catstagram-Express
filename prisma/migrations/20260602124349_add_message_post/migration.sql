-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "postId" INTEGER,
ALTER COLUMN "text" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
