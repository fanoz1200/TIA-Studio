// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";

const { setLocation } = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/missing-route", setLocation],
}));

import NotFound from "./NotFound";

function renderNotFound(language: "ar" | "en") {
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  return render(
    <LanguageProvider>
      <NotFound />
    </LanguageProvider>,
  );
}

describe("NotFound", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocation.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Arabic chrome in RTL and keeps the home route behavior", () => {
    renderNotFound("ar");

    expect(screen.getByRole("heading", { name: "الصفحة غير موجودة" })).not.toBeNull();
    const button = screen.getByRole("button", { name: "العودة للرئيسية" });
    expect(screen.getByText(/قد يكون تم نقلها أو حذفها/)).not.toBeNull();
    expect(screen.getByRole("heading", { name: "404" }).closest("[dir]")?.getAttribute("dir")).toBe("rtl");

    fireEvent.click(button);
    expect(setLocation).toHaveBeenCalledWith("/");
  });

  it("renders English chrome in LTR and keeps the home route behavior", () => {
    renderNotFound("en");

    expect(screen.getByRole("heading", { name: "Page Not Found" })).not.toBeNull();
    const button = screen.getByRole("button", { name: "Go Home" });
    expect(screen.getByText(/It may have been moved or deleted/)).not.toBeNull();
    expect(screen.getByRole("heading", { name: "404" }).closest("[dir]")?.getAttribute("dir")).toBe("ltr");

    fireEvent.click(button);
    expect(setLocation).toHaveBeenCalledWith("/");
  });
});
