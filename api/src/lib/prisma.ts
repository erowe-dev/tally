import { PrismaClient } from '@prisma/client';

// In Vercel serverless each function invocation is a fresh Node process, so
// the globalThis singleton only helps during dev hot-reloads. In production,
// DATABASE_URL should point to Supabase's PgBouncer (port 6543) with
// ?pgbouncer=true&connection_limit=1 to avoid exhausting the connection pool.
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
