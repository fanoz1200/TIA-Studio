import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fragnet, Schedule } from "@/lib/cpm";

const mocks = vi.hoisted(() => ({
  startLogin: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  refetch: vi.fn(),
  query: { data: [], isLoading: false, refetch: vi.fn() },
  mutation: { isPending: false, mutate: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/const", () => ({ startLogin: mocks.startLogin }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    evidence: { list: { useQuery: () => mocks.query } },
    resourceAssignment: { list: { useQuery: () => mocks.query }, replaceFromImport: { useMutation: () => mocks.mutation } },
    notice: { list: { useQuery: () => mocks.query }, create: { useMutation: () => mocks.mutation }, createAutomaticDraft: { useMutation: () => mocks.mutation } },
    claimReview: { get: { useQuery: () => mocks.query }, getOrCreate: { useMutation: () => mocks.mutation }, decide: { useMutation: () => mocks.mutation }, assignParticipant: { useMutation: () => mocks.mutation } },
    projectMember: { list: { useQuery: () => mocks.query } },
  },
}));

import { FinancialNoticeReviewPanel } from "./FinancialNoticeReviewPanel";
import { LanguageProvider } from "@/contexts/LanguageContext";

const schedule: Schedule = {
  id: "notice-test",
  name: "برنامج اختبار Notice",
  startDate: "2026-01-01",
  dataDate: "2026-01-02",
  source: "manual",
  calendar: { id: "cal", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4, 5], holidays: [], hoursPerDay: 8 },
  activities: [{ id: "A100", name: "تصميم", duration: 4 }],
  relationships: [],
  resourceAssignments: [],
};

const event: Fragnet = {
  id: "EV-LOCAL",
  title: "تأخر اعتماد رسم",
  description: "واقعة تدريبية",
  cause: "employer",
  occurrenceDate: "2026-02-10",
  activities: [{ id: "FR-1", name: "تأخير اعتماد", duration: 3, kind: "fragnet" }],
  relationships: [],
};

describe("تنزيل مسودة Notice محلية", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("tia-studio-interface-language");
  });

  it("يجهز وينزل مسودة للمستخدم غير المسجل بدون بدء تسجيل الدخول", () => {
    let generatedBlob: { parts: unknown[]; type: string } | undefined;
    class LocalBlob {
      parts: unknown[];
      type: string;
      constructor(parts: unknown[], options: { type?: string } = {}) {
        this.parts = parts;
        this.type = options.type ?? "";
      }
    }
    vi.stubGlobal("Blob", LocalBlob);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(blob => {
        generatedBlob = blob as { parts: unknown[]; type: string };
        return "blob:notice-local";
      }),
      revokeObjectURL: vi.fn(),
    });
    let download = "";
    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
      href = this.href;
    });

    render(
      <LanguageProvider>
      <FinancialNoticeReviewPanel
        view="notices"
        schedule={schedule}
        events={[event]}
        selectedEvent={event}
        activeImpactDays={3}
        isAuthenticated={false}
      />
      </LanguageProvider>
    );

    expect(screen.getByText(/تقدر تجهز وتنزل مسودة محلية من غير حساب/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تجهيز مسودة قابلة للتحرير" }));
    const downloadButton = screen.getByRole("button", { name: "تنزيل مسودة Notice محلية" });
    expect((downloadButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(downloadButton);

    expect(mocks.startLogin).not.toHaveBeenCalled();
    expect(href).toBe("blob:notice-local");
    expect(download).toBe("TIA-Notice-N-001.txt");
    expect(generatedBlob?.type).toBe("text/plain;charset=utf-8");
    expect(String(generatedBlob?.parts.join(""))).toContain("تأخر اعتماد رسم");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("تم تنزيل مسودة Notice محلية. راجعها وعدّلها قبل أي إرسال.");
  });

  it("ينزّل مسودة English محلية منفصلة ولا يبدأ إرسال بريد", () => {
    let generatedBlob: { parts: unknown[] } | undefined;
    class LocalBlob {
      parts: unknown[];
      constructor(parts: unknown[]) { this.parts = parts; }
    }
    vi.stubGlobal("Blob", LocalBlob);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(blob => { generatedBlob = blob as { parts: unknown[] }; return "blob:notice-en"; }), revokeObjectURL: vi.fn() });
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { download = this.download; });

    render(<LanguageProvider><FinancialNoticeReviewPanel view="notices" schedule={schedule} events={[event]} selectedEvent={event} activeImpactDays={3} isAuthenticated={false} /></LanguageProvider>);
    fireEvent.click(screen.getByRole("button", { name: "تجهيز مسودة قابلة للتحرير" }));
    fireEvent.click(screen.getByRole("combobox", { name: "لغة مسودة التنزيل" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    fireEvent.click(screen.getByRole("button", { name: "تنزيل مسودة Notice محلية" }));

    expect(mocks.startLogin).not.toHaveBeenCalled();
    expect(download).toBe("TIA-Notice-N-001.txt");
    expect(String(generatedBlob?.parts.join(""))).toContain("TIA Studio — Editable Notice Draft");
    expect(String(generatedBlob?.parts.join(""))).toContain("This is a local draft.");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("The local Notice draft was downloaded. Review and edit it before any sending.");
  });

  it("يعرض سجل الإشعارات بالإنجليزية واتجاه LTR من دون بدء تسجيل الدخول", () => {
    localStorage.setItem("tia-studio-interface-language", "en");

    const { container } = render(
      <LanguageProvider>
        <FinancialNoticeReviewPanel
          view="notices"
          schedule={schedule}
          events={[event]}
          selectedEvent={event}
          activeImpactDays={3}
          isAuthenticated={false}
        />
      </LanguageProvider>
    );

    expect(screen.getByRole("heading", { name: "Contractual Notice register" })).toBeTruthy();
    expect(screen.getByText("Reference delay event")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prepare editable draft" })).toBeTruthy();
    expect(container.querySelector("section")?.getAttribute("dir")).toBe("ltr");
    expect(mocks.startLogin).not.toHaveBeenCalled();
  });
});
