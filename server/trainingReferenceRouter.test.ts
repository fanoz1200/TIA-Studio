import { beforeEach, describe, expect, it, vi } from "vitest";

const listTrainingReferences = vi.hoisted(() => vi.fn());

vi.mock("./trainingReference", () => ({ listTrainingReferences }));

import { trainingReferenceRouter } from "./trainingReferenceRouter";

describe("trainingReferenceRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض metadata فقط ضمن حساب المستخدم ومفتاح مشروع التدريب", async () => {
    listTrainingReferences.mockResolvedValue([{ referenceKey: "WORKSHOP_NO8_P6_23_12", localCpmDurationDeltaDays: 17 }]);
    const caller = trainingReferenceRouter.createCaller({ user: { id: 41 } } as never);

    await expect(caller.list({ projectKey: "TIA_STUDIO_TRAINING" })).resolves.toEqual([
      { referenceKey: "WORKSHOP_NO8_P6_23_12", localCpmDurationDeltaDays: 17 },
    ]);
    expect(listTrainingReferences).toHaveBeenCalledWith(41, "TIA_STUDIO_TRAINING");
  });

  it("يرفض مفتاح المشروع الفارغ قبل أي وصول للبيانات", async () => {
    const caller = trainingReferenceRouter.createCaller({ user: { id: 41 } } as never);
    await expect(caller.list({ projectKey: "" })).rejects.toThrow();
    expect(listTrainingReferences).not.toHaveBeenCalled();
  });
});
