import { PrismaClient } from "@prisma/client";

// Neon's pooled endpoint (host contains "-pooler") runs PgBouncer in transaction mode, which
// Prisma needs told about. Add the flags here so the injected DATABASE_URL works as it is.
function runtimeUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (u.hostname.includes("neon.tech") && !u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "20");
    return u.toString();
  } catch {
    return raw;
  }
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ datasourceUrl: runtimeUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = db;
