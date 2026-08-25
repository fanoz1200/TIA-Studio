import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ClaimConsolePanel, claimConsoleToastText } from "./ClaimConsolePanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ claimConsole: { list: { invalidate: vi.fn() } } }),
    claimConsole: {
      list: { useQuery: () => ({ data: undefined }) },
      saveContractProfile: { useMutation: (options: { onSuccess?: () => void }) => ({ mutate: () => options.onSuccess?.(), isPending: false }) },
      createRisk: { useMutation: (options: { onSuccess?: () => void }) => ({ mutate: () => options.onSuccess?.(), isPending: false }) },
      createCandidate: { useMutation: (options: { onSuccess?: () => void }) => ({ mutate: () => options.onSuccess?.(), isPending: false }) },
      createDeadline: { useMutation: (options: { onSuccess?: () => void }) => ({ mutate: () => options.onSuccess?.(), isPending: false }) },
    },
  },
}));

const sourceScheduleName = "مشروع اختبار";
const schedule = { id: "test-project", name: sourceScheduleName, startDate: "2026-01-01", dataDate: "2026-01-15" } as never;

describe("Claim Console", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("لا يعرض سجلاً أو بيانات افتراضية لغير المسجل، ويوضح شرط الحفظ المشترك", () => {
    window.localStorage.removeItem("tia-studio-interface-language");
    render(<LanguageProvider><ClaimConsolePanel view="claimConsole" schedule={schedule} isAuthenticated={false} onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} /></LanguageProvider>);

    expect(screen.getByText("ملف العقد وسجل المخاطر")).toBeTruthy();
    expect(screen.getByText(/سجّل الدخول لحفظ هذا السجل/)).toBeTruthy();
    expect(screen.queryByText("إضافة مخاطرة")).toBeNull();
  });

  it("يعرض Claim Console غير المسجل بالإنجليزية واتجاه LTR عند اختيار English", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    const { container } = render(<LanguageProvider><ClaimConsolePanel view="claimConsole" schedule={schedule} isAuthenticated={false} onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} /></LanguageProvider>);

    expect(screen.getByText("Contract profile and risk register")).toBeTruthy();
    expect(screen.getByText(/Sign in to save this register/)).toBeTruthy();
    expect(container.querySelector("section")?.getAttribute("dir")).toBe("ltr");
  });

  it("لا يظهر خارج تبويبه المخصص", () => {
    window.localStorage.removeItem("tia-studio-interface-language");
    const { container } = render(<LanguageProvider><ClaimConsolePanel view="guided" schedule={schedule} isAuthenticated={false} onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} /></LanguageProvider>);
    expect(container.innerHTML).toBe("");
  });

  it("يعرض رسالة حفظ ثابتة بالإنجليزية مع بقاء اسم المشروع المصدرى دون ترجمة", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    render(<LanguageProvider><ClaimConsolePanel view="claimConsole" schedule={schedule} isAuthenticated onNavigate={vi.fn()} onActiveClaimChange={vi.fn()} /></LanguageProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Save contract profile" }));

    expect(toast.success).toHaveBeenCalledWith("Contract profile saved as reviewable reference data.");
    expect(sourceScheduleName).toBe("مشروع اختبار");
    expect(claimConsoleToastText("ar").handoffMissing).toContain("مرشح المطالبة");
  });
});
