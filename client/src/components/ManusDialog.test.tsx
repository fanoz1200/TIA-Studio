import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { APP_LANGUAGE_STORAGE_KEY, LanguageProvider } from "@/contexts/LanguageContext";
import { ManusDialog } from "./ManusDialog";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderDialog(language: "ar" | "en") {
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  const onLogin = vi.fn();

  render(
    <LanguageProvider>
      <ManusDialog open title="Source title stays unchanged" onLogin={onLogin} />
    </LanguageProvider>,
  );

  return onLogin;
}

describe("ManusDialog", () => {
  it("renders Arabic chrome in RTL and preserves the passed title", () => {
    const onLogin = renderDialog("ar");

    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("يرجى تسجيل الدخول باستخدام Manus للمتابعة")).not.toBeNull();
    expect(screen.getByRole("button", { name: "تسجيل الدخول باستخدام Manus" })).not.toBeNull();
    expect(screen.getByText("Source title stays unchanged")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول باستخدام Manus" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("renders English chrome in LTR and preserves the passed title", () => {
    const onLogin = renderDialog("en");

    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("Please login with Manus to continue")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Login with Manus" })).not.toBeNull();
    expect(screen.getByText("Source title stays unchanged")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Login with Manus" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
