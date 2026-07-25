-- CreateEnum
CREATE TYPE "Verkaufsart" AS ENUM ('MAKLER', 'PRIVAT');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('EXPOSE', 'BESICHTIGUNG_FOTO', 'BESICHTIGUNG_DOKUMENT');

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "eigenkapital" INTEGER NOT NULL,
    "verkaufsart" "Verkaufsart" NOT NULL,
    "freitext" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HypothesisAnswer" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "hypothesisKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypothesisAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HypothesisAnswerAttachment" (
    "id" TEXT NOT NULL,
    "hypothesisAnswerId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    CONSTRAINT "HypothesisAnswerAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_analysisId_version_key" ON "AnalysisResult"("analysisId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisAnswer_analysisId_hypothesisKey_key" ON "HypothesisAnswer"("analysisId", "hypothesisKey");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisAnswerAttachment_hypothesisAnswerId_attachmentId_key" ON "HypothesisAnswerAttachment"("hypothesisAnswerId", "attachmentId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisAnswer" ADD CONSTRAINT "HypothesisAnswer_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisAnswerAttachment" ADD CONSTRAINT "HypothesisAnswerAttachment_hypothesisAnswerId_fkey" FOREIGN KEY ("hypothesisAnswerId") REFERENCES "HypothesisAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HypothesisAnswerAttachment" ADD CONSTRAINT "HypothesisAnswerAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
