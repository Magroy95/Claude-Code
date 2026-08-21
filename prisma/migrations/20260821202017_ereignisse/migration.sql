-- CreateTable
CREATE TABLE "Ereignis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "analysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ereignis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ereignis_name_createdAt_idx" ON "Ereignis"("name", "createdAt");
