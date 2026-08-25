import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { ProjectInvitationAcceptPanel } from "./ProjectInvitationAcceptPanel";

const mocks = vi.hoisted(() => ({
  acceptMutate: vi.fn(),
  onSuccess: undefined as undefined | ((result: { projectRole: string }) => void),
  startLogin: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock("@/const", () => ({ startLogin: mocks.startLogin }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    projectInvitation: {
      accept: {
        useMutation: (options: { onSuccess: (result: { projectRole: string }) => void }) => {
          mocks.onSuccess = options.onSuccess;
          return { mutate: mocks.acceptMutate, isPending: false };
        },
      },
    },
  },
}));

describe("شاشة قبول دعوة المشروع", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.acceptMutate.mockReset();
    mocks.startLogin.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.onSuccess = undefined;
  });

  it("تعرض توجيه الدخول العربي وتحافظ على سلوك تسجيل الدخول", () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, "ar");
    const { container } = render(<LanguageProvider><ProjectInvitationAcceptPanel token="invite-token" isAuthenticated={false} onAccepted={vi.fn()} /></LanguageProvider>);

    expect(container.querySelector("section")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("لديك رابط دعوة للمشروع")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(mocks.startLogin).toHaveBeenCalledTimes(1);
  });

  it("يعرض English وLTR ويقبل رمز الدعوة من دون ترجمة دور المشروع", () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, "en");
    const onAccepted = vi.fn();
    const { container } = render(<LanguageProvider><ProjectInvitationAcceptPanel token="invite-token" isAuthenticated onAccepted={onAccepted} /></LanguageProvider>);

    expect(container.querySelector("section")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("You have a project invitation link")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(mocks.acceptMutate).toHaveBeenCalledWith({ token: "invite-token" });

    mocks.onSuccess?.({ projectRole: "planner" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("You joined the project as planner.");
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });
});

