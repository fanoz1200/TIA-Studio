// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Schedule } from "@/lib/cpm";

const mocks = vi.hoisted(() => ({
  importXml: vi.fn(),
  exportDocx: vi.fn(),
  exportPdf: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  query: { data: [], isLoading: false, refetch: vi.fn() },
  mutation: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/lib/p6-xml", () => ({ importP6XmlSchedule: mocks.importXml }));
vi.mock("@/lib/claim-export", () => ({ exportClaimDocx: mocks.exportDocx, exportClaimPdf: mocks.exportPdf }));
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
  id: "p6-test", name: "برنامج اختبار P6", startDate: "2026-01-01", source: "p6-xml",
  activities: [{ id: "A100", name: "أعمال الأساس", duration: 5 }], relationships: [], wbsNodes: [], resourceAssignments: [],
};

const activeResult = {
  baseline: { completionDate: "2026-01-06" },
  impacted: { completionDate: "2026-01-09" },
  totalImpactDays: 3,
} as never;

function renderPanel(view: "schedule" | "report", onScheduleImported = vi.fn()) {
  return render(<P6EvidenceReportPanel view={view} schedule={schedule} events={[]} selectedEvent={null} activeResult={view === "report" ? activeResult : null} narrative="سرد اختبار" isAuthenticated={false} onScheduleImported={onScheduleImported} />);
}

describe("واجهة استيراد P6 وتصدير التقرير", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("يعرض حالة تجهيز Word ويعطل PDF حتى يكتمل التصدير", async () => {
    let completeExport: (() => void) | undefined;
    mocks.exportDocx.mockImplementation(() => new Promise<void>((resolve) => { completeExport = resolve; }));
    renderPanel("report");

    fireEvent.click(screen.getByRole("button", { name: "تصدير Word" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText("شغّل TIA أولاً، ثم راجع الأثر الزمني والمالي وحالة الاعتماد؛ يحفظ التصدير لقطة من هذه البيانات في لحظة الإنشاء.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /جارِ تجهيز Word/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "تصدير PDF" }) as HTMLButtonElement).disabled).toBe(true);

    completeExport?.();
    await waitFor(() => expect(mocks.exportDocx).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});
