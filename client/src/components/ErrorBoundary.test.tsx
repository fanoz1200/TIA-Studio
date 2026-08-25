import { act, cleanup, render, screen } from "@testing-library/react";
import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ErrorBoundary, { ErrorBoundary as ErrorBoundaryClass } from "./ErrorBoundary";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";

function renderFailure(language: "ar" | "en") {
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  const boundaryRef = createRef<ErrorBoundaryClass>();
  const view = render(
    <LanguageProvider>
      <ErrorBoundary ref={boundaryRef}><div>safe content</div></ErrorBoundary>
    </LanguageProvider>,
  );

  act(() => {
    boundaryRef.current?.setState({
      hasError: true,
      error: new Error("source diagnostic stack"),
    });
  });

  return view;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Arabic chrome in RTL without changing the diagnostic text", () => {
    renderFailure("ar");

    expect(screen.getByRole("heading", { name: "حدث خطأ غير متوقع." })).not.toBeNull();
    expect(screen.getByRole("button", { name: "إعادة تحميل الصفحة" })).not.toBeNull();
    expect(screen.getByText(/source diagnostic stack/)).not.toBeNull();
    expect(screen.getByRole("heading").closest("[dir]")?.getAttribute("dir")).toBe("rtl");
  });

  it("renders English chrome in LTR without translating the diagnostic text", () => {
    renderFailure("en");

    expect(screen.getByRole("heading", { name: "An unexpected error occurred." })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Reload page" })).not.toBeNull();
    expect(screen.getByText(/source diagnostic stack/)).not.toBeNull();
    expect(screen.getByRole("heading").closest("[dir]")?.getAttribute("dir")).toBe("ltr");
  });
});
