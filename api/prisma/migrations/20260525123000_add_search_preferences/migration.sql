-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "homeAirports" JSONB NOT NULL DEFAULT '[]',
    "preferredCabin" TEXT,
    "maxStops" INTEGER,
    "preferredPrograms" JSONB NOT NULL DEFAULT '[]',
    "hotelChains" JSONB NOT NULL DEFAULT '[]',
    "defaultTravelers" INTEGER,
    "dateFlexibility" TEXT,
    "pointValuationCpp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "originAirport" TEXT,
    "destinationAirport" TEXT,
    "destinationText" TEXT NOT NULL,
    "dateWindow" JSONB NOT NULL,
    "cabin" TEXT,
    "passengers" INTEGER NOT NULL DEFAULT 1,
    "hotelIntent" JSONB,
    "notes" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "normalizedRequest" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "saved_searches_userId_searchType_idx" ON "saved_searches"("userId", "searchType");

-- CreateIndex
CREATE UNIQUE INDEX "provider_cache_cacheKey_key" ON "provider_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "provider_cache_provider_searchType_idx" ON "provider_cache"("provider", "searchType");

-- CreateIndex
CREATE INDEX "provider_cache_expiresAt_idx" ON "provider_cache"("expiresAt");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
