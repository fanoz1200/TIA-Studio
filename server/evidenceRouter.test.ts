import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const service = vi.hoisted(() => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://storage.example/${key}` })),
  listEvidenceForEvent: vi.fn(async () => [{ id: 41, title: "خطاب إشعار", fileName: "notice.pdf", evidenceType: "correspondence", sizeBytes: 12, storageUrl: "https://storage.example/evidence.pdf", description: "إشعار ضمن المدة", receivedAt: new Date("2026-03-12") }]),
  saveEvidenceDocument: vi.fn(async () => 41),
  deleteEvidenceDocument: vi.fn(async () => ({ success: true })),
  listClaimTemplates: vi.fn(async () => [{ id: 9, title: "قالب مطالبة قياسي" }]),
  saveClaimTemplate: vi.fn(async () => 9),
  deleteClaimTemplate: vi.fn(async () => ({ success: true })),
}));

vi.mock("./storage", () => ({ storagePut: service.storagePut }));
vi.mock("./evidence", () => ({
  listEvidenceForEvent: service.listEvidenceForEvent,
  saveEvidenceDocument: service.saveEvidenceDocument,
  deleteEvidenceDocument: service.deleteEvidenceDocument,
  listClaimTemplates: service.listClaimTemplates,
  saveClaimTemplate: service.saveClaimTemplate,
  deleteClaimTemplate: service.deleteClaimTemplate,
}));

import { claimTemplateRouter, evidenceRouter } from "./evidenceRouter";

function context(): TrpcContext {
  return {
    user: { id: 7, openId: "claim-user", name: "Claim User", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("evidenceRouter", () => {
  it("uploads a document, stores its reference, lists it, then removes it for the authenticated owner", async () => {
    const caller = evidenceRouter.createCaller(context());
    const upload = await caller.upload({ projectKey: "P6-100", eventKey: "D-04", title: "خطاب إشعار", description: "إشعار ضمن المدة", evidenceType: "correspondence", receivedAt: "2026-03-12", fileName: "notice.pdf", mimeType: "application/pdf", dataBase64: Buffer.from("evidence bytes").toString("base64") });

    expect(upload).toEqual({ id: 41, url: expect.stringContaining("tia-evidence/user-7/project-P6-100/event-D-04/notice.pdf") });
    expect(service.saveEvidenceDocument).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, projectKey: "P6-100", eventKey: "D-04", evidenceType: "correspondence", title: "خطاب إشعار", fileName: "notice.pdf", sizeBytes: 14 }));
    await expect(caller.list({ projectKey: "P6-100", eventKey: "D-04" })).resolves.toHaveLength(1);
    await expect(caller.remove({ id: 41 })).resolves.toEqual({ success: true });
    expect(service.listEvidenceForEvent).toHaveBeenCalledWith(7, "P6-100", "D-04");
    expect(service.deleteEvidenceDocument).toHaveBeenCalledWith(7, 41);
  });
});

describe("claimTemplateRouter", () => {
  it("saves, loads, and removes a claim template within the owner scope", async () => {
    const caller = claimTemplateRouter.createCaller(context());
    await expect(caller.create({ title: "قالب مطالبة قياسي", recipient: "المهندس", contractReference: "C-27", introduction: "تمهيد", entitlementPosition: "موقف", reliefRequested: "تمديد", closing: "ختام", isDefault: true })).resolves.toEqual({ id: 9 });
    await expect(caller.list()).resolves.toEqual([{ id: 9, title: "قالب مطالبة قياسي" }]);
    await expect(caller.remove({ id: 9 })).resolves.toEqual({ success: true });
    expect(service.saveClaimTemplate).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, title: "قالب مطالبة قياسي", isDefault: 1 }));
    expect(service.listClaimTemplates).toHaveBeenCalledWith(7);
    expect(service.deleteClaimTemplate).toHaveBeenCalledWith(7, 9);
  });
});
