-- CreateTable
CREATE TABLE "RateLimitEreignis" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEreignis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitEreignis_key_createdAt_idx" ON "RateLimitEreignis"("key", "createdAt");
