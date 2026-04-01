/**
 * Unit tests for src/lib/mailer.ts
 *
 * Strategy:
 *  - Mock global `fetch` — no real HTTP calls to SendGrid
 *  - Set / unset process.env.SENDGRID_API_KEY for each test
 *  - Assert that the correct payload reaches SendGrid
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFetch(status: number, body = "") {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  });
}

function capturedBody(fetchMock: ReturnType<typeof vi.fn>) {
  const callArgs = fetchMock.mock.calls[0];
  return JSON.parse(callArgs[1].body as string) as {
    from: { email: string; name: string };
    subject: string;
    personalizations: Array<{ to: Array<{ email: string }> }>;
    content: Array<{ type: string; value: string }>;
  };
}

function capturedHeaders(fetchMock: ReturnType<typeof vi.fn>) {
  const callArgs = fetchMock.mock.calls[0];
  return callArgs[1].headers as Record<string, string>;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("mailer — sendApprovalEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = "SG.test-key-approval";
    fetchMock = makeFetch(202);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("calls the correct SendGrid URL", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
  });

  it("uses POST method", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const options = fetchMock.mock.calls[0][1];
    expect((options as RequestInit).method).toBe("POST");
  });

  it("sends Authorization header with API key", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const headers = capturedHeaders(fetchMock);
    expect(headers["Authorization"]).toBe("Bearer SG.test-key-approval");
  });

  it("sends from aalamaynn@gmail.com as SmartHire", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const body = capturedBody(fetchMock);
    expect(body.from.email).toBe("aalamaynn@gmail.com");
    expect(body.from.name).toBe("SmartHire");
  });

  it("sets TO field to the provided email address", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const body = capturedBody(fetchMock);
    expect(body.personalizations[0].to[0].email).toBe("admin@college.edu");
  });

  it("subject contains 'Approved'", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const body = capturedBody(fetchMock);
    expect(body.subject.toLowerCase()).toContain("approved");
  });

  it("HTML content contains recipient name", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const body = capturedBody(fetchMock);
    expect(body.content[0].type).toBe("text/html");
    expect(body.content[0].value).toContain("Nilesh Kumar");
  });

  it("HTML content contains a login link", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("admin@college.edu", "Nilesh Kumar");

    const body = capturedBody(fetchMock);
    expect(body.content[0].value).toContain("/auth/refresh");
  });

  it("falls back to 'Admin' when name is an email address", async () => {
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await sendApprovalEmail("user@example.com", "user@example.com");

    const body = capturedBody(fetchMock);
    expect(body.content[0].value).toContain("Admin");
    expect(body.content[0].value).not.toContain("user@example.com");
  });

  it("throws if SENDGRID_API_KEY is not set", async () => {
    delete process.env.SENDGRID_API_KEY;
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await expect(sendApprovalEmail("admin@college.edu", "Test")).rejects.toThrow(
      "SENDGRID_API_KEY"
    );
  });

  it("throws if SendGrid returns a non-2xx status", async () => {
    fetchMock = makeFetch(400, '{"errors":[{"message":"Bad Request"}]}');
    vi.stubGlobal("fetch", fetchMock);
    const { sendApprovalEmail } = await import("../../src/lib/mailer");
    await expect(sendApprovalEmail("admin@college.edu", "Test")).rejects.toThrow(
      "SendGrid API error 400"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("mailer — sendRejectionEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = "SG.test-key-rejection";
    fetchMock = makeFetch(202);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends to the correct recipient", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "Incomplete profile");

    const body = capturedBody(fetchMock);
    expect(body.personalizations[0].to[0].email).toBe("applicant@college.edu");
  });

  it("subject says 'Not Approved'", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "Incomplete profile");

    const body = capturedBody(fetchMock);
    expect(body.subject.toLowerCase()).toMatch(/not approved|reject/);
  });

  it("HTML body contains the rejection reason", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "Duplicate account");

    const body = capturedBody(fetchMock);
    expect(body.content[0].value).toContain("Duplicate account");
  });

  it("HTML body contains recipient name", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "Incomplete profile");

    const body = capturedBody(fetchMock);
    expect(body.content[0].value).toContain("Ravi Sharma");
  });

  it("uses 'No specific reason provided.' when reason is empty", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "");

    const body = capturedBody(fetchMock);
    expect(body.content[0].value).toContain("No specific reason provided.");
  });

  it("sends from aalamaynn@gmail.com", async () => {
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await sendRejectionEmail("applicant@college.edu", "Ravi Sharma", "Test");

    const body = capturedBody(fetchMock);
    expect(body.from.email).toBe("aalamaynn@gmail.com");
  });

  it("throws if SendGrid returns 401", async () => {
    fetchMock = makeFetch(401, "Unauthorized");
    vi.stubGlobal("fetch", fetchMock);
    const { sendRejectionEmail } = await import("../../src/lib/mailer");
    await expect(
      sendRejectionEmail("applicant@college.edu", "Test", "reason")
    ).rejects.toThrow("SendGrid API error 401");
  });
});
