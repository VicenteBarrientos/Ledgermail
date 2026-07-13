import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Vitest hoists vi.mock(...) calls above all imports in this file (same as
// packages/core/test/fixtures.test.ts), so a plain static import below is
// enough to get the mocked versions of these modules.

// --- Mocks -----------------------------------------------------------------
// Same pattern used by packages/core/test/fixtures.test.ts: mock the DB and
// the heavy dependencies (LLM pipeline, Gmail API) so these tests run fast,
// deterministically, and with zero external cost/network calls. They exist to
// catch regressions in the HTTP layer (status codes, request validation,
// response shaping, summary aggregation) — not to re-test parsing logic,
// which is already covered by packages/core/test/fixtures.test.ts.

const mockTransactionFindMany = vi.fn();
const mockTransactionCount = vi.fn();
const mockTransactionFindUnique = vi.fn();
const mockMailboxFindMany = vi.fn();
const mockEmailFindUnique = vi.fn();

vi.mock("@ledgermail/database", () => {
  return {
    EmailStatus: {
      PENDING: "PENDING",
      PARSED: "PARSED",
      NEEDS_REVIEW: "NEEDS_REVIEW",
      FAILED: "FAILED"
    },
    db: {
      transaction: {
        findMany: (...args: any[]) => mockTransactionFindMany(...args),
        count: (...args: any[]) => mockTransactionCount(...args),
        findUnique: (...args: any[]) => mockTransactionFindUnique(...args)
      },
      mailboxSource: {
        findMany: (...args: any[]) => mockMailboxFindMany(...args)
      },
      email: {
        findUnique: (...args: any[]) => mockEmailFindUnique(...args)
      }
    }
  };
});

const mockParseEmailPipeline = vi.fn();
vi.mock("@ledgermail/core", () => ({
  parseEmailPipeline: (...args: any[]) => mockParseEmailPipeline(...args)
}));

const mockSyncGmailMessages = vi.fn();
vi.mock("@ledgermail/gmail", () => ({
  syncGmailMessages: (...args: any[]) => mockSyncGmailMessages(...args),
  getAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/mock-auth-url"),
  getTokensFromCode: vi.fn().mockResolvedValue({ accessToken: "mock", refreshToken: "mock", expiresAt: null })
}));

import app from "../src/index";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payments", () => {
  it("returns a paginated list of transactions", async () => {
    mockTransactionFindMany.mockResolvedValue([
      { id: "txn-1", amount: 150000, bank: "Banco de Chile", email: { status: "PARSED" } }
    ]);
    mockTransactionCount.mockResolvedValue(1);

    const res = await request(app).get("/api/payments?page=1&limit=20");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("applies bank and amount filters to the where clause", async () => {
    mockTransactionFindMany.mockResolvedValue([]);
    mockTransactionCount.mockResolvedValue(0);

    await request(app).get("/api/payments?bank=Santander&minAmount=1000&maxAmount=5000");

    const whereArg = mockTransactionFindMany.mock.calls[0][0].where;
    expect(whereArg.bank).toBe("Santander");
    expect(whereArg.amount).toEqual({ gte: 1000, lte: 5000 });
  });

  it("returns 500 with the error message when the DB call fails", async () => {
    mockTransactionFindMany.mockRejectedValue(new Error("connection refused"));
    mockTransactionCount.mockResolvedValue(0);

    const res = await request(app).get("/api/payments");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("connection refused");
  });
});

describe("GET /api/payments/:id", () => {
  it("returns 404 when the transaction does not exist", async () => {
    mockTransactionFindUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/payments/does-not-exist");

    expect(res.status).toBe(404);
  });

  it("returns the transaction when found", async () => {
    mockTransactionFindUnique.mockResolvedValue({ id: "txn-1", amount: 150000 });

    const res = await request(app).get("/api/payments/txn-1");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("txn-1");
  });
});

describe("GET /api/mailboxes", () => {
  it("lists registered mailbox sources", async () => {
    mockMailboxFindMany.mockResolvedValue([{ id: "mbx-1", name: "Gmail Inbox" }]);

    const res = await request(app).get("/api/mailboxes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("POST /api/parse", () => {
  it("rejects requests missing required fields", async () => {
    const res = await request(app).post("/api/parse").send({ from: "a@b.cl" });

    expect(res.status).toBe(400);
    expect(mockParseEmailPipeline).not.toHaveBeenCalled();
  });

  it("forwards a well-formed request to the parsing pipeline with forceReparse=true", async () => {
    mockParseEmailPipeline.mockResolvedValue({ success: true, transactions: [{ id: "txn-1", amount: 150000 }] });

    const res = await request(app).post("/api/parse").send({
      from: "bancochile-informa@bancochile.cl",
      subject: "Transferencia recibida",
      bodyHtml: "<html></html>",
      mailboxSourceId: "mbx-1"
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockParseEmailPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ mailboxSourceId: "mbx-1", bodyHtml: "<html></html>" }),
      true
    );
  });
});

describe("POST /api/gmail/sync", () => {
  it("rejects requests missing mailboxSourceId", async () => {
    const res = await request(app).post("/api/gmail/sync").send({});
    expect(res.status).toBe(400);
  });

  it("aggregates per-message results into a summary (parsed / needs review / failed)", async () => {
    mockSyncGmailMessages.mockResolvedValue([
      { messageId: "1", subject: "Transferencia A", from: "a@bancochile.cl", bodyHtml: "<html/>", hasAttachments: false },
      { messageId: "2", subject: "Transferencia B", from: "b@bancochile.cl", bodyHtml: "<html/>", hasAttachments: false },
      { messageId: "3", subject: "Transferencia C", from: "c@bancochile.cl", bodyHtml: "<html/>", hasAttachments: false }
    ]);

    mockParseEmailPipeline
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, email: { status: "NEEDS_REVIEW" } })
      .mockResolvedValueOnce({ success: false, email: { status: "FAILED" }, error: "No bank provider detected" });

    const res = await request(app).post("/api/gmail/sync").send({ mailboxSourceId: "mbx-1" });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      synced: 3,
      parsedSuccessfully: 1,
      needsReview: 1,
      failed: 1
    });
  });
});

describe("POST /api/reparse", () => {
  it("returns 404 when the email record does not exist", async () => {
    mockEmailFindUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/reparse").send({ emailId: "missing" });


    expect(res.status).toBe(404);
  });
});
