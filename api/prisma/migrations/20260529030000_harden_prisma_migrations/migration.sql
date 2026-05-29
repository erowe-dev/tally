alter table public._prisma_migrations enable row level security;

revoke all on table public._prisma_migrations from anon;
revoke all on table public._prisma_migrations from authenticated;
