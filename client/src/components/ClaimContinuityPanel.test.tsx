import React, { useCallback, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimContinuityPanel } from "./ClaimContinuityPanel";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Schedule } from "@/lib/cpm";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    claimContinuity: {
      list: { useQuery: () => ({ data: { chains: [{ id: 8, claimKey: "CLM-APR-2026", title: "مطالبة تحديث أبريل", unifiedNarrative: "سرد موحّد مرجعي", periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-04-30"), parentClaimId: 3 }], concurrency: [] }, isLoading: false, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateNarrative: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      addConcurrency: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

const schedule = {
  id: "S-CLM", name: "برنامج تسلسل تجريبي", startDate: "2026-01-01", dataDate: "2026-01-05", activities: [], relationships: [],
} as unknown as Schedule;

function ClaimStateHarness({ onChange }: { onChange: ReturnType<typeof vi.fn> }) {
  const [activeClaim, setActiveClaim] = useState({ key: "", narrative: "" });
  const handleActiveClaimChange = useCallback((key: string, narrative: string) => {
    onChange(key, narrative);
    setActiveClaim(previous => previous.key === key && previous.narrative === narrative ? previous : { key, narrative });
  }, [onChange]);

  return <>
    <output data-testid="active-claim">{activeClaim.key}|{activeClaim.narrative}</output>
    <ClaimContinuityPanel view="notices" schedule={schedule} events={[]} selectedWindow={null} isAuthenticated onActiveClaimChange={handleActiveClaimChange} />
  </>;
}

function renderClaimPanel(language: "ar" | "en", onChange = vi.fn()) {
  window.localStorage.setItem("tia-studio-interface-language", language);
  return render(<LanguageProvider><ClaimStateHarness onChange={onChange} /></LanguageProvider>);
}

describe("لوحة تسلسل المطالبات", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  });

  it("تحدّث مطالبة نشطة محفوظة مرة واحدة فقط ولا تدخل في حلقة تحديث عند إعادة تصيير الأب", async () => {
    const onChange = vi.fn();
    renderClaimPanel("ar", onChange);

    await waitFor(() => expect(screen.getByTestId("active-claim").textContent).toBe("CLM-APR-2026|سرد موحّد مرجعي"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "سلسلة المطالبات والتأخيرات المتزامنة · Continuous claims & concurrent delays" })).toBeTruthy();
    expect(screen.getByText("سلسلة المطالبات · سجل التزامن · CONTINUOUS CLAIMS · CONCURRENCY LOG")).toBeTruthy();
    expect(screen.getByText("سجل السلسلة · Chain record")).toBeTruthy();
    expect(screen.getByText("مطالبة جديدة · New claim")).toBeTruthy();
  });

  it("يعرض النصوص الثابتة بالإنجليزية وLTR من دون ترجمة عنوان المطالبة أو سردها المحفوظ", async () => {
    const { container } = renderClaimPanel("en");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Continuous claims & concurrent delays" })).toBeTruthy());
    expect(container.querySelector(".claim-continuity-panel")?.getAttribute("dir")).toBe("ltr");
    expect(container.textContent).toContain("Chain record");
    expect(container.textContent).toContain("CONTINUOUS CLAIMS · CONCURRENCY LOG");
    expect(container.textContent).toContain("مطالبة تحديث أبريل");
    expect(container.textContent).toContain("سرد موحّد مرجعي");
    expect(container.textContent).toContain("Claim title");
    expect(container.textContent).not.toContain("سجل السلسلة · Chain record");
  });
});
