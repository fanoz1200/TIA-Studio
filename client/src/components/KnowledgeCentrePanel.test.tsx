// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render as renderUi, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { KnowledgeCentrePanel } from "./KnowledgeCentrePanel";

afterEach(() => cleanup());
beforeEach(() => window.localStorage.setItem("tia-studio-interface-language", "ar"));

function render(ui: React.ReactElement) {
  return renderUi(<LanguageProvider>{ui}</LanguageProvider>);
}

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

function openLibrarySection(name: RegExp) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("مكتبة المنهجيات والحالات العملية", () => {
  it("يعرض فهرس الحالات الحقيقي والبحث والحالة المرجعية المختارة للقراءة فقط", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/بدور على حالة شبه مشكلتي/);

    expect(screen.getByRole("heading", { name: "مكتبة المنهجيات والحالات العملية" })).toBeTruthy();
    expect(screen.getByText(/سجل مفهرس/)).toBeTruthy();
    expect(screen.getByText(/ابحث في العناوين والوصف والأدلة والمساندات/)).toBeTruthy();
    expect(screen.getByText(/نتيجة من أصل/)).toBeTruthy();
    expect(screen.getAllByText(/المصدر المرجعي محمّل للقراءة فقط/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /وصف الحالة/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /طبّق هذه الحالة الآن/ })).toBeTruthy();
  });

  it("ينقل الحالة المختارة إلى رحلة التحليل مرة واحدة مع منع الضغط المتكرر أثناء الانتقال", () => {
    const onBeginGuidedAnalysis = vi.fn();
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated onBeginGuidedAnalysis={onBeginGuidedAnalysis} />);

    openLibrarySection(/بدور على حالة شبه مشكلتي/);

    fireEvent.click(screen.getByRole("button", { name: /طبّق هذه الحالة الآن/ }));
    expect(onBeginGuidedAnalysis).toHaveBeenCalledWith(expect.objectContaining({ caseId: "D-001", method: "tia", journeyPath: "direct" }));
    expect(screen.getByRole("button", { name: /جاري فتح رحلة التحليل/ })).toBeTruthy();
  });

  it("يحوّل شجرة القرار إلى مسار تحليل عملي حسب إجابة المستخدم", () => {
    const onBeginGuidedAnalysis = vi.fn();
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated onBeginGuidedAnalysis={onBeginGuidedAnalysis} />);

    fireEvent.click(screen.getByRole("button", { name: "واقعة واحدة بتاريخ معروف" }));
    fireEvent.click(screen.getByRole("button", { name: "أيوه، معايا" }));
    expect(screen.getByText("المناسب كبداية: TIA")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /افتح الخطوات المناسبة/ }));
    expect(onBeginGuidedAnalysis).toHaveBeenCalledWith(expect.objectContaining({ method: "tia", journeyPath: "direct", caseId: "decision-tree-route" }));
  });

  it("يرشح تحليل النوافذ للحالات المتتابعة ويفتح سجل الوقائع", () => {
    const onBeginGuidedAnalysis = vi.fn();
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated onBeginGuidedAnalysis={onBeginGuidedAnalysis} />);

    fireEvent.click(screen.getByRole("button", { name: "تأخيرات متتابعة أو متزامنة" }));
    expect(screen.getByText("المناسب كبداية: تحليل النوافذ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /افتح الخطوات المناسبة/ }));
    expect(onBeginGuidedAnalysis).toHaveBeenCalledWith(expect.objectContaining({ method: "windows", journeyPath: "issue" }));
  });

  it("يعرض الفيديو التدريبي لمسار Workshop 8 من أصل التطبيق الدائم", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    const video = screen.getAllByLabelText("فيديو توضيحي لمسار تحليل الأثر الزمني TIA").at(-1) as HTMLVideoElement;
    const source = video.querySelector("source");
    expect(source?.getAttribute("src")).toBe("/manus-storage/tia-workshop8-guided-workflow_21ac3c32.mp4");
    expect(screen.getAllByRole("heading", { name: "رحلة TIA في ثماني ثوانٍ" }).at(-1)).toBeTruthy();
  });

  it("يقرأ السجلات التفصيلية من ملف Excel الجديد ويعرض قوانينها وأدلتها وحلولها", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/بدور على حالة شبه مشكلتي/);

    expect(screen.getAllByText("70 سجل Excel تفصيلي").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/55 حالة من سلسلة D/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("المساند التعاقدي والقوانين المذكورة في المصدر").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الأدلة والمستندات المقترحة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الحل المقترح").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WBS و Fragnet وقواعد TIA").length).toBeGreaterThan(0);
  });

  it("يفصل حالات D عن السجلات الداعمة ويتيح عرض سجلات DIS/CON/VAR/RES الفعلية", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/بدور على حالة شبه مشكلتي/);

    expect(screen.getAllByText("70 سجلاً فعلياً من ملفك").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15 سجلاً مرتبطاً فعلياً/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("نوع السجل"));
    fireEvent.click(screen.getByRole("option", { name: "سجلات داعمة DIS/CON/VAR/RES: 15" }));
    expect(screen.getByLabelText("نوع السجل").textContent).toContain("سجلات داعمة DIS/CON/VAR/RES: 15");
    expect(screen.getAllByText("DIS-001").length).toBeGreaterThan(0);
  });

  it("يعرض أوراق الدعم الثمانية والروابط الداخلية المنسوخة من ملف Excel", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    expect(screen.getAllByRole("heading", { name: "إجراءات القرار، التدقيق، الاعتراضات، القوالب والحسابات" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("tab").length).toBe(11);
    expect(screen.getAllByText("الروابط الداخلية الواردة في المصدر").length).toBeGreaterThan(0);
  });

  it("يعرض دليلي التدريب النصيين لرفع P6 وإدخال Excel إلى حين توفر الفيديوهين المستقلين", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    expect(screen.getAllByRole("heading", { name: "دليل سريع حتى يتاح الفيديوان المستقلان" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Baseline ثم Update قبل الحدث" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "وثّق الواقعة قبل إنشاء Fragnet" }).length).toBeGreaterThan(0);
  });

  it("يعرض روابط التنزيل الدائمة لحزمة البرومبتات ومشروعي التدريب المصطنعين", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    expect(screen.getAllByRole("heading", { name: "حزمة آمنة للتجربة وإنتاج الفيديو خارج المنصة" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /تنزيل حزمة البرومبتات/ }).at(-1)?.getAttribute("href")).toBe("/manus-storage/google-video-prompts-ar_8d21a82e.md");
    expect(screen.getAllByRole("link", { name: "Baseline JSON" }).some(link => link.getAttribute("href") === "/manus-storage/05-training-tia-baseline_65e0778b.json")).toBe(true);
    expect(screen.getAllByRole("link", { name: "بطاقتا الحدث JSON" }).at(-1)?.getAttribute("href")).toBe("/manus-storage/08-training-concurrency-events_8b000149.json");
  });

  it("يعرض مرجع FIDIC المستخرج مستقلاً عن حالات D مع سجلاته وإجراءاته العملية", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    expect(screen.getAllByRole("heading", { name: "مرجع بنود FIDIC 2017 للمخطط والمطالبة" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/27 بنداً موثقاً من ملفك/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /FIDIC 1.9/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("شرح البند للمخطط").length).toBeGreaterThan(0);
    expect(screen.getAllByText("السجلات والأدلة").length).toBeGreaterThan(0);
  });

  it("يعرض السيناريوهات الخمسة المستخرجة كتمارين تدريب مستقلة", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    openLibrarySection(/عايز المراجع والقوالب/);

    expect(screen.getAllByRole("heading", { name: "خمسة سيناريوهات لتدريب عين المخطط" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("سيناريو 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الحالة \(1\): نشاط حرج/).length).toBeGreaterThan(0);
  });

  it("يعرض واجهة الموسوعة بالإنجليزية واتجاه LTR مع حفظ معرفات الحالات وروابط التدريب الأصلية", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    const library = screen.getByLabelText("Methodology and case library");
    expect(library.getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("heading", { name: "Methodology and practical case library" })).toBeTruthy();
    expect(screen.getByText("I am looking for a similar case")).toBeTruthy();

    openLibrarySection(/similar case/);
    expect(screen.getAllByText("D-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/55 D-series cases/).length).toBeGreaterThan(0);

    openLibrarySection(/references and templates/);
    expect(screen.getAllByRole("link", { name: /Download the prompt package/ }).at(-1)?.getAttribute("href")).toBe("/manus-storage/google-video-prompts-ar_8d21a82e.md");
    expect(screen.getAllByText(/الحالة \(1\): نشاط حرج/).length).toBeGreaterThan(0);
  });
});
