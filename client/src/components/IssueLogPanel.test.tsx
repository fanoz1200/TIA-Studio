// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssueLogPanel } from "./IssueLogPanel";
import type { Schedule } from "@/lib/cpm";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ issueLog: { list: { invalidate: vi.fn() } } }),
    issueLog: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      prepareFragnet: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      recordApplied: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      close: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      importBatch: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

const schedule = {
  id: "S-EXCEL", name: "برنامج اختبار", startDate: "2026-01-01", dataDate: "2026-01-03",
  activities: [{ id: "A-001", name: "نشاط اختبار", duration: 2 }],
  relationships: [{ id: "REL-001", predecessorId: "A-001", successorId: "A-001", type: "FS", lag: 0 }],
} as unknown as Schedule;

afterEach(cleanup);

describe("أدوات Excel في سجل القضايا", () => {
  it("يعرض القالب والتصدير والاستيراد للمستخدم المصادق مع شرح التحقق قبل الحفظ", () => {
    render(<IssueLogPanel view="issues" schedule={schedule} existingEvents={[]} isAuthenticated onApplyFragnet={vi.fn()} />);
    expect(screen.getByText("تبادل Excel مضبوط")).toBeTruthy();
    expect(screen.getByRole("button", { name: "قالب Excel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تصدير السجل" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "استيراد Excel" })).toBeTruthy();
    expect(screen.getByText(/معرفات الأنشطة والعلاقات قبل حفظ أي قضية/)).toBeTruthy();
  });

  it("يكشف شروط الحفظ ويعرض نقاط الربط القادمة من البرنامج المستورد", () => {
    render(<IssueLogPanel view="issues" schedule={schedule} existingEvents={[]} isAuthenticated onApplyFragnet={vi.fn()} />);
    expect(screen.getByText("قبل الحفظ: ما الذي ينقصني؟")).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: "حفظ القضية ومقترح Fragnet" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    const relationship = screen.getByRole("checkbox", { name: /REL-001.*FS/ });
    fireEvent.click(relationship);
    expect(screen.getByText("1 مختارة")).toBeTruthy();
    expect(screen.getByText("نقطة ربط واحدة على الأقل").className).toContain("complete");
  });
});
