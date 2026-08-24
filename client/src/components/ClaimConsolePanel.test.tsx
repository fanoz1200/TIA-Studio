import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClaimConsolePanel } from "./ClaimConsolePanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ claimConsole: { list: { invalidate: vi.fn() } } }),
    claimConsole: {
      list: { useQuery: () => ({ data: undefined }) },
      saveContractProfile: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createRisk: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createCandidate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createDeadline: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

const schedule = { id: "test-project", name: "مشروع اختبار", startDate: "2026-01-01", dataDate: "2026-01-15" } as never;

describe("Claim Console", () => {
  it("لا يعرض سجلاً أو بيانات افتراضية لغير المسجل، ويوضح شرط الحفظ المشترك", () => {
    render(<ClaimConsolePanel view="claimConsole" schedule={schedule} isAuthenticated={false} onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} />);

    expect(screen.getByText("ملف العقد وسجل المخاطر")).toBeTruthy();
    expect(screen.getByText(/سجّل الدخول لحفظ هذا السجل/)).toBeTruthy();
    expect(screen.queryByText("إضافة مخاطرة")).toBeNull();
  });

  it("لا يظهر خارج تبويبه المخصص", () => {
    const { container } = render(<ClaimConsolePanel view="guided" schedule={schedule} isAuthenticated={false} onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});
