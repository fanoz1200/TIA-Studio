import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectMembersPanel } from "./ProjectMembersPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    projectMember: {
      list: { useQuery: () => ({ data: [{ id: 1, memberUserId: 9, projectRole: "planner", name: "م. كريم", email: "planner@example.com", accessExpiresAt: new Date("2026-08-01T00:00:00.000Z"), isAccessExpired: true, isOwner: false }], isLoading: false, refetch: vi.fn() }) },
      addByEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateRole: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      remove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    projectInvitation: {
      list: { useQuery: () => ({ data: [{ id: 3, email: "reviewer@example.com", projectRole: "contracts", accessDurationDays: 14, status: "pending", expiresAt: new Date("2026-08-30T00:00:00.000Z") }], isLoading: false, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      cancel: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

describe("لوحة أعضاء المشروع", () => {
  it("تعرض مدة الوصول في الدعوة وحالة العضوية المنتهية وحدود النسخة المحلية", () => {
    render(<ProjectMembersPanel projectKey="P-TIA" isAuthenticated />);

    expect(screen.getByText("مدة الوصول بعد القبول")).toBeTruthy();
    expect(screen.getByText(/الوصول 14 يوماً بعد القبول/)).toBeTruthy();
    expect(screen.getByText(/انتهى الوصول في/)).toBeTruthy();
    expect(screen.getByText(/لا تتحكم في نسخة سطح المكتب المحلية/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /تمديد وصول م. كريم/ })).toBeTruthy();
  });
});
