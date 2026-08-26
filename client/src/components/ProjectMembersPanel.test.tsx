import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProjectMembersPanel, projectMemberActionMessages } from "./ProjectMembersPanel";

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
    render(<LanguageProvider><ProjectMembersPanel projectKey="P-TIA" isAuthenticated /></LanguageProvider>);

    expect(screen.getByText("أعضاء المشروع · PROJECT MEMBERS")).toBeTruthy();
    expect(screen.getByText("مدة الوصول بعد القبول · Access duration after acceptance")).toBeTruthy();
    expect(screen.getByText(/الوصول · Access 14 يوماً · days بعد القبول · after acceptance/)).toBeTruthy();
    expect(screen.getByText(/انتهى الوصول في · Access expired on/)).toBeTruthy();
    expect(screen.getByText(/لا تتحكم في نسخة سطح المكتب المحلية/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /تمديد وصول · Extend access م. كريم/ })).toBeTruthy();
  });

  it("تظهر الواجهة بالإنجليزية واتجاه LTR مع بقاء اسم العضو العربي كما هو", () => {
    localStorage.setItem("tia-studio-interface-language", "en");
    const { container } = render(<LanguageProvider><ProjectMembersPanel projectKey="P-TIA" isAuthenticated /></LanguageProvider>);

    expect(container.querySelector("section")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("PROJECT MEMBERS")).toBeTruthy();
    expect(screen.getByText("Project members & review route")).toBeTruthy();
    expect(screen.getByText("Member email")).toBeTruthy();
    expect(screen.getByText("Invitations")).toBeTruthy();
    expect(container.textContent).toContain("م. كريم");
    expect(container.textContent).toContain("planner@example.com");
  });

  it("تُخرج رسائل إجراءات العضوية الثابتة بالإنجليزية دون تضمين بيانات العضو", () => {
    const messages = projectMemberActionMessages("en");

    expect(messages.memberAdded).toContain("selected access duration");
    expect(messages.invitationCopied).toBe("Invitation link copied.");
    expect(JSON.stringify(messages)).not.toContain("م. كريم");
    expect(JSON.stringify(messages)).not.toContain("planner@example.com");
  });
});
