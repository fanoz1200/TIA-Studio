// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeCentrePanel } from "./KnowledgeCentrePanel";

afterEach(() => cleanup());

vi.mock("@/lib/master-claim-excel", () => ({
  enrichHtmlCase: (item: Record<string, unknown>) => ({
    ...item,
    recommended_solution: "",
    mitigation: "",
    fragnet_id: "",
    wbs_code: "",
    fragnet_activities: "",
    fragnet_protocol: "",
    tia_baseline_rule: "",
    calendar_rule: "",
    float_rule: "",
    update_procedure: "",
    recovery_procedure: "",
    source: "html",
  }),
  loadMasterClaimExcelCases: () => Promise.resolve(Array.from({ length: 55 }, (_, index) => ({
    id: `D-${String(index + 1).padStart(3, "0")}`,
    case_id: `D-${String(index + 1).padStart(3, "0")}`,
    title_ar: index === 0 ? "حالة Excel تفصيلية" : `حالة تفصيلية ${index + 1}`,
    title_en: "Detailed Excel case",
    category: "التأخيرات",
    delay_type: "تأخير",
    methodology: "TIA",
    description: "وصف تفصيلي مأخوذ من ملف Excel المرجعي.",
    root_cause: "سبب جذري موثق.",
    schedule_impact: "أثر زمني موثق.",
    contractual_basis: "مساند تعاقدي وقانوني موثق.",
    burden_of_proof: "سجل مراسلات وتقارير وبرنامج زمني.",
    recommended_solution: "حل موثق داخل Excel.",
    mitigation: "إجراء وقاية موثق.",
    fragnet_id: "FR-01",
    wbs_code: "WBS-01",
    fragnet_activities: "A100, A110",
    fragnet_protocol: "FS",
    tia_baseline_rule: "Update قبل الحدث",
    calendar_rule: "تقويم المشروع",
    float_rule: "Float المشروع",
    update_procedure: "إجراء التحديث",
    recovery_procedure: "إجراء الاستدراك",
    source: "excel",
  }))),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    knowledgeCentre: {
      videoList: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      libraryList: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      libraryRead: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) },
      videoCreate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      videoRemove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      libraryUpload: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      libraryRemove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

describe("مكتبة المنهجيات والحالات العملية", () => {
  it("يعرض فهرس الحالات الحقيقي والبحث والحالة المرجعية المختارة للقراءة فقط", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    expect(screen.getByRole("heading", { name: "مكتبة المنهجيات والحالات العملية" })).toBeTruthy();
    expect(screen.getByText(/حالة مفهرسة/)).toBeTruthy();
    expect(screen.getByText(/ابحث في العناوين والوصف والأدلة والمساندات/)).toBeTruthy();
    expect(screen.getByText(/نتيجة من أصل/)).toBeTruthy();
    expect(screen.getAllByText(/المصدر المرجعي محمّل للقراءة فقط/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /وصف الحالة/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /طبّق هذه الحالة الآن/ })).toBeTruthy();
  });

  it("يعرض الفيديو التدريبي لمسار Workshop 8 من أصل التطبيق الدائم", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    const video = screen.getAllByLabelText("فيديو توضيحي لمسار تحليل الأثر الزمني TIA").at(-1) as HTMLVideoElement;
    const source = video.querySelector("source");
    expect(source?.getAttribute("src")).toBe("/manus-storage/tia-workshop8-guided-workflow_21ac3c32.mp4");
    expect(screen.getAllByRole("heading", { name: "رحلة TIA في ثماني ثوانٍ" }).at(-1)).toBeTruthy();
  });

  it("يقرأ الحالات التفصيلية من ملف Excel المرجعي ويعرض قوانينها وأدلتها وحلولها", async () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    expect((await screen.findAllByText("55 حالة Excel تفصيلية")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("حالة Excel تفصيلية").length).toBeGreaterThan(0);
    expect(screen.getAllByText("المساند التعاقدي والقوانين المذكورة في المصدر").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الأدلة والمستندات المقترحة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الحل المقترح").length).toBeGreaterThan(0);
    expect(screen.getAllByText("قواعد TIA وFragnet").length).toBeGreaterThan(0);
  });
});
