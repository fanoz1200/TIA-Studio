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
      <FinancialNoticeReviewPanel
        view="notices"
        schedule={schedule}
        events={[event]}
        selectedEvent={event}
        activeImpactDays={3}
        isAuthenticated={false}
      />
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
});
