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

describe("مركز التدريب والمكتبة المنهجية", () => {
  it("يعرض مسارات TIA والتزامن وPrimavera بالعربية مع حالة فيديو فارغة واضحة", () => {
    render(<KnowledgeCentrePanel view="learning" projectKey="schedule-learning" isAuthenticated />);

    expect(screen.getByRole("heading", { name: "مركز التدريب والمكتبة المنهجية" })).toBeTruthy();
    expect(screen.getAllByText("TIA من الصفر إلى التقرير").length).toBeGreaterThan(0);
    expect(screen.getAllByText("التأخيرات المتزامنة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("تطبيق Primavera P6").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "مسار TIA العملي — Workshop 8" })).toBeTruthy();
    expect(screen.getByText(/ملفات التمرين الأصلية خارج التطبيق/)).toBeTruthy();
    expect(screen.getByText(/لا توجد روابط بعد/)).toBeTruthy();
    expect(screen.getByText(/لم تُرفع موسوعة بعد/)).toBeTruthy();
  });
});
