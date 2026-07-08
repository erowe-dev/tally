CREATE TABLE "award_search_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originAirport" TEXT NOT NULL,
    "destinationAirport" TEXT NOT NULL,
    "cabin" TEXT NOT NULL,
    "passengers" INTEGER NOT NULL,
    "dateWindow" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "sourcesAttempted" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_search_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_search_candidates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT,
    "originAirport" TEXT NOT NULL,
    "destinationAirport" TEXT NOT NULL,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "cabin" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "points" INTEGER,
    "taxesUsd" DOUBLE PRECISION,
    "seatCount" INTEGER,
    "bookingUrl" TEXT,
    "raw" JSONB NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "award_search_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_live_verifications" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT,
    "source" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "originAirport" TEXT NOT NULL,
    "destinationAirport" TEXT NOT NULL,
    "departureDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "cabin" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "points" INTEGER,
    "taxesUsd" DOUBLE PRECISION,
    "seatCount" INTEGER,
    "bookingUrl" TEXT,
    "raw" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_live_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "award_search_runs_userId_createdAt_idx" ON "award_search_runs"("userId", "createdAt");
CREATE INDEX "award_search_runs_originAirport_destinationAirport_cabin_idx" ON "award_search_runs"("originAirport", "destinationAirport", "cabin");
CREATE INDEX "award_search_candidates_runId_idx" ON "award_search_candidates"("runId");
CREATE INDEX "award_search_candidates_source_sourceKey_idx" ON "award_search_candidates"("source", "sourceKey");
CREATE INDEX "award_search_candidates_originAirport_destinationAirport_departureDate_idx" ON "award_search_candidates"("originAirport", "destinationAirport", "departureDate");
CREATE INDEX "award_live_verifications_runId_idx" ON "award_live_verifications"("runId");
CREATE INDEX "award_live_verifications_candidateId_idx" ON "award_live_verifications"("candidateId");
CREATE INDEX "award_live_verifications_verificationStatus_expiresAt_idx" ON "award_live_verifications"("verificationStatus", "expiresAt");
CREATE INDEX "award_live_verifications_originAirport_destinationAirport_departureDate_idx" ON "award_live_verifications"("originAirport", "destinationAirport", "departureDate");

ALTER TABLE "award_search_runs" ADD CONSTRAINT "award_search_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "award_search_candidates" ADD CONSTRAINT "award_search_candidates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "award_search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "award_live_verifications" ADD CONSTRAINT "award_live_verifications_runId_fkey" FOREIGN KEY ("runId") REFERENCES "award_search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "award_live_verifications" ADD CONSTRAINT "award_live_verifications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "award_search_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
