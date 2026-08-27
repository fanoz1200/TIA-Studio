import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppLaunchSplash } from "./AppLaunchSplash";

function renderSplash(overrides: Partial<React.ComponentProps<typeof AppLaunchSplash>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onEnterWorkspace: vi.fn(),
    onOpenGuide: vi.fn(),
    ...overrides,
  };
  render(<LanguageProvider><AppLaunchSplash {...props} /></LanguageProvider>);
  return props;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("شاشة بداية TIA Studio", () => {
  it("تعرض الهوية وطرق البدء ولا تنشئ صوتاً تلقائياً", () => {
    const audioContext = vi.fn();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: audioContext });
    renderSplash();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "TIA Studio" })).toBeTruthy();
    expect(screen.getByText("Prepared & Executed by Eng. Ahmed Mohamed Omar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Email eng.Ahmadomr@gmail.com" }).getAttribute("href")).toBe("mailto:eng.Ahmadomr@gmail.com");
    expect(screen.getByRole("link", { name: "WhatsApp 01116770951" }).getAttribute("href")).toBe("https://wa.me/201116770951");
    expect(screen.getByRole("button", { name: "شغّل المقدمة الصوتية" })).toBeTruthy();
    expect(audioContext).not.toHaveBeenCalled();
  });

  it("يفتح مساحة العمل أو دليل البداية من أزرار صريحة", () => {
    const props = renderSplash();
    fireEvent.click(screen.getByRole("button", { name: /افتح مساحة العمل/ }));
    expect(props.onEnterWorkspace).toHaveBeenCalledTimes(1);

    cleanup();
    const guideProps = renderSplash();
    fireEvent.click(screen.getByRole("button", { name: /شاهد بداية الاستخدام/ }));
    expect(guideProps.onOpenGuide).toHaveBeenCalledTimes(1);
  });

  it("ينشئ ويشغّل ملف المقدمة الاختياري فقط بعد ضغط المستخدم", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const AudioMock = vi.fn().mockImplementation(() => ({ preload: "", onended: null, onerror: null, pause, play, currentTime: 0 }));
    vi.stubGlobal("Audio", AudioMock);
    renderSplash();

    expect(AudioMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "شغّل المقدمة الصوتية" }));

    expect(AudioMock).toHaveBeenCalledWith("/manus-storage/tia-studio-opening-intro_221bda02.mp3");
    expect(play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "أوقف المقدمة الصوتية" })).toBeTruthy());
  });

  it("يعرض الإنجليزية واتجاه LTR مع نفس بيانات الهوية", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    renderSplash();

    expect(screen.getAllByText("A traceable workspace for CPM, time impact, windows, and schedule review—built to keep your source files under your control.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open workspace" })).toBeTruthy();
    expect(screen.getByText("Prepared & Executed by Eng. Ahmed Mohamed Omar")).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("ltr");
  });
});
