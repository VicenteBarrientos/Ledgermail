import fs from "fs";
import path from "path";
import { PrismaClient } from "./generated/client";
import { config } from "@ledgermail/shared";

/** Point Prisma at the native engine when esbuild bundles __dirname away from the .node file. */
function resolvePrismaEngineLibrary() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  const name = "libquery_engine-rhel-openssl-3.0.x.so.node";
  const candidates = [
    path.join(__dirname, name),
    path.join(__dirname, "generated", "client", name),
    path.join(process.cwd(), name),
    path.join(process.cwd(), "api", name),
    path.join(process.cwd(), "packages", "database", "src", "generated", "client", name),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
        return;
      }
    } catch {
      /* ignore */
    }
  }
}

resolvePrismaEngineLibrary();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: config.db.url,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export * from "./generated/client";
