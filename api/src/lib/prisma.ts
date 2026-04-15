import { PrismaClient } from '@prisma/client';

// Singleton to prevent connection pool exhaustion during dev hot-reloads
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env['DATABASE_URL_POOLED'] ?? process.env['DATABASE_URL'],
      },
    },
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
