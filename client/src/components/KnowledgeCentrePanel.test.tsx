// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeCentrePanel } from "./KnowledgeCentrePanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    knowledgeCentre: {
      videoList: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      libraryList: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      libraryRead: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) },
      videoCreate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      videoRemove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      libraryUpload: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      libraryRemove: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

describe("مكتبة المنهجيات والحالات العملية", () => {
  it("يعرض فهرس الحالات الحقيقي والبحث والحالة المرجعية المختارة للقراءة فقط", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    expect(screen.getByRole("heading", { name: "مكتبة المنهجيات والحالات العملية" })).toBeTruthy();
    expect(screen.getByText(/حالة مفهرسة/)).toBeTruthy();
    expect(screen.getByText(/ابحث في العناوين والوصف والأدلة والمساندات/)).toBeTruthy();
    expect(screen.getByText(/نتيجة من أصل/)).toBeTruthy();
    expect(screen.getAllByText(/المصدر المرجعي محمّل للقراءة فقط/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /وصف الحالة/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /طبّق هذه الحالة الآن/ })).toBeTruthy();
  });
});
