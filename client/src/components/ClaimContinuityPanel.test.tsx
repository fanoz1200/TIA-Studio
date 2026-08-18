// @vitest-environment jsdom
import React, { useCallback, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClaimContinuityPanel } from "./ClaimContinuityPanel";
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

describe("لوحة تسلسل المطالبات", () => {
  it("تحدّث مطالبة نشطة محفوظة مرة واحدة فقط ولا تدخل في حلقة تحديث عند إعادة تصيير الأب", async () => {
    const onChange = vi.fn();
    render(<ClaimStateHarness onChange={onChange} />);

    await waitFor(() => expect(screen.getByTestId("active-claim").textContent).toBe("CLM-APR-2026|سرد موحّد مرجعي"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
