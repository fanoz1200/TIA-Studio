// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fragnet, Schedule } from "@/lib/cpm";
import { LanguageProvider } from "@/contexts/LanguageContext";

const mocks = vi.hoisted(() => ({
  importXml: vi.fn(),
  exportDocx: vi.fn(),
  exportFactPack: vi.fn(),
  exportPdf: vi.fn(),
  exportExcel: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  query: { data: [], isLoading: false, refetch: vi.fn() },
  mutation: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/lib/p6-xml", () => ({ importP6XmlSchedule: mocks.importXml }));
vi.mock("@/lib/claim-export", () => ({ exportClaimDocx: mocks.exportDocx, exportFullClaimFactPack: mocks.exportFactPack, exportClaimPdf: mocks.exportPdf }));
vi.mock("@/lib/analysis-excel", () => ({ exportAnalysisExcel: mocks.exportExcel }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    evidence: {
      list: { useQuery: vi.fn(() => mocks.query) },
      upload: { useMutation: vi.fn(() => mocks.mutation) },
      remove: { useMutation: vi.fn(() => mocks.mutation) },
    },
    claimTemplate: { list: { useQuery: vi.fn(() => mocks.query) }, create: { useMutation: vi.fn(() => mocks.mutation) } },
    notice: { list: { useQuery: vi.fn(() => mocks.query) } },
    claimReview: { get: { useQuery: vi.fn(() => ({ ...mocks.query, data: undefined })) } },
  },
}));

import { P6EvidenceReportPanel } from "./P6EvidenceReportPanel";

const schedule: Schedule = {
  id: "p6-test", name: "برنامج اختبار P6", startDate: "2026-01-01", dataDate: "2026-01-02", source: "p6-xml",
  calendar: { id: "cal-test", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4], holidays: [], hoursPerDay: 8 },
  activities: [{ id: "A100", name: "أعمال الأساس", duration: 5, wbsId: "W1" }, { id: "B100", name: "أعمال لاحقة", duration: 4, wbsId: "W1" }], relationships: [{ id: "R1", predecessorId: "A100", successorId: "B100", type: "FS", lag: 0 }], wbsNodes: [{ id: "W1", code: "1", name: "أعمال اختبار", path: "1" }], resourceAssignments: [],
};

const event: Fragnet = {
  id: "EV-01", title: "تأخر اعتماد", description: "حدث اختبار موصول بالشبكة.", cause: "employer", occurrenceDate: "2026-01-03",
  activities: [{ id: "F100", name: "حدث Fragnet", duration: 3, kind: "fragnet" }],
  relationships: [{ id: "FR-1", predecessorId: "A100", successorId: "F100", type: "FS", lag: 0 }, { id: "FR-2", predecessorId: "F100", successorId: "B100", type: "FS", lag: 0 }],
};

const activeResult = {
  baseline: { completionDate: "2026-01-06", activities: [{ id: "A100", totalFloat: 0 }] },
  impacted: { completionDate: "2026-01-09", activities: [{ id: "F100", totalFloat: 0 }], criticalActivityIds: ["F100"] },
  totalImpactDays: 3,
} as never;

function renderPanel(view: "schedule" | "report", onScheduleImported = vi.fn(), language: "ar" | "en" = "ar") {
  window.localStorage.setItem("tia-studio-interface-language", language);
  return render(
    <LanguageProvider>
      <P6EvidenceReportPanel view={view} schedule={schedule} events={view === "report" ? [event] : []} selectedEvent={view === "report" ? event : null} activeResult={view === "report" ? activeResult : null} narrative="سرد اختبار" isAuthenticated={false} onScheduleImported={onScheduleImported} />
    </LanguageProvider>
  );
}

describe("واجهة استيراد P6 وتصدير التقرير", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  });

  it("تعرض تلميح القراءة وحالة المعالجة وتعطل زر الاستيراد حتى تكتمل القراءة", async () => {
    let completeRead: ((value: string) => void) | undefined;
    const pendingText = new Promise<string>((resolve) => { completeRead = resolve; });
    const importedSchedule = { ...schedule, id: "imported-p6" };
    mocks.importXml.mockReturnValue({ schedule: importedSchedule, summary: { projectName: "نسخة P6", activitiesRead: 1, relationshipsRead: 0, wbsRead: 0, activitiesWithProgress: 0 } });
    const onScheduleImported = vi.fn();
    const { container } = renderPanel("schedule", onScheduleImported);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["pending"], "schedule.xml", { type: "application/xml" });
    Object.defineProperty(file, "text", { value: () => pendingText });

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const importButton = screen.getByRole("button", { name: /جارِ قراءة الملف/ }) as HTMLButtonElement;
    expect(importButton.getAttribute("title")).toBe("تُقرأ البيانات محلياً في المتصفح؛ لا يُرفع ملف P6 إلى خدمة تحليل خارجية.");
    expect(importButton.disabled).toBe(true);

    completeRead?.("<Project />");
    await waitFor(() => expect(onScheduleImported).toHaveBeenCalledWith(importedSchedule, expect.objectContaining({ projectName: "نسخة P6" })));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("يصدر Excel وFact Pack ويعرض حالة تجهيز Full Claim ويعطل PDF حتى يكتمل التصدير", async () => {
    let completeExport: (() => void) | undefined;
    mocks.exportDocx.mockImplementation(() => new Promise<void>((resolve) => { completeExport = resolve; }));
    renderPanel("report");

    expect(screen.getByText("قالب المطالبة وتصدير التقرير · Claim template and report export")).toBeTruthy();
    expect(screen.getByText("مخرجات المطالبة")).toBeTruthy();
    expect(screen.getByText("لغة المخرجات")).toBeTruthy();
    expect((screen.getByRole("button", { name: "ملف مطابقة P6 (JSON)" }) as HTMLButtonElement).disabled).toBe(true);
    const excelButton = screen.getByRole("button", { name: "تصدير التقرير النهائي Excel" }) as HTMLButtonElement;
    expect(excelButton.disabled).toBe(false);
    fireEvent.click(excelButton);
    expect(mocks.exportExcel).toHaveBeenCalledWith(expect.objectContaining({ schedule, analysis: activeResult, events: [event], narrative: "سرد اختبار", language: "ar" }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("تم إنشاء التقرير النهائي Excel متعدد الأوراق.");
    fireEvent.click(screen.getByRole("button", { name: "تنزيل Fact Pack (JSON)" }));
    expect(mocks.exportFactPack).toHaveBeenCalledWith(expect.objectContaining({ impactDays: 3, events: [expect.objectContaining({ id: "EV-01", title: "تأخر اعتماد" })], methodology: expect.any(String) }));
    fireEvent.click(screen.getByRole("button", { name: "تصدير Full Claim (Word)" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText(/ملف المطابقة ليس بديلاً عن Primavera/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /جارِ تجهيز Full Claim/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "تصدير PDF" }) as HTMLButtonElement).disabled).toBe(true);

    completeExport?.();
    await waitFor(() => expect(mocks.exportDocx).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("يمرر لغة English المختارة إلى مُصدّر التقرير بدلاً من لغة الواجهة", () => {
    renderPanel("report");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "English — LTR" }));
    fireEvent.click(screen.getByRole("button", { name: "تصدير التقرير النهائي Excel" }));
    expect(mocks.exportExcel).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
  });

  it("يعرض مسار التقرير بالإنجليزية واتجاه LTR عندما تختار لغة الواجهة English", () => {
    const { container } = renderPanel("report", vi.fn(), "en");
    expect(container.querySelector(".claim-export-panel")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("CLAIM OUTPUT")).toBeTruthy();
    expect(screen.getByText("Claim template and report export")).toBeTruthy();
    expect(screen.getByText("Output language")).toBeTruthy();
    expect(screen.getByText("Pre-export checklist")).toBeTruthy();
    expect(screen.getByText("Export Excel final report")).toBeTruthy();
    expect(screen.getByText("Evidence register")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export Excel final report" }));
    expect(mocks.exportExcel).toHaveBeenCalledWith(expect.objectContaining({ events: [expect.objectContaining({ id: "EV-01", title: "تأخر اعتماد" })] }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Multi-sheet Excel final report created.");
    expect(schedule.name).toBe("برنامج اختبار P6");
    expect(event.title).toBe("تأخر اعتماد");
  });
});
