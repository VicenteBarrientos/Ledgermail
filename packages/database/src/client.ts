import { PrismaClient } from "./generated/client";
import { config } from "@ledgermail/shared";

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
