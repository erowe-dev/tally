-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripType" TEXT NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "cabin" TEXT,
    "passengers" INTEGER,
    "nights" INTEGER,
    "hotelCat" TEXT,
    "programName" TEXT NOT NULL,
    "ptsRequired" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trips_userId_idx" ON "trips"("userId");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
