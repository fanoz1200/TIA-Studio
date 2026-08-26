import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserGuidePanel } from "./UserGuidePanel";

const LANGUAGE_KEY = "tia-studio-interface-language";

function renderGuide(view = "guide", onNavigate = vi.fn()) {
  return {
    onNavigate,
    ...render(
      <LanguageProvider>
        <UserGuidePanel view={view} onNavigate={onNavigate} />
      </LanguageProvider>,
    ),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("مرجع الاستخدام المصوّر", () => {
  it("لا يظهر خارج تبويب الدليل", () => {
    const { container } = renderGuide("guided");
    expect(container.textContent).toBe("");
  });

  it("يعرض المسار العربي ويربط خطوة رفع P6 بالشاشة الحقيقية", () => {
    const { onNavigate } = renderGuide();

    expect(screen.getByRole("heading", { name: "امشي معايا خطوة خطوة · Follow the route step by step" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "أنهي مستند أعمله من جوه البرنامج؟ · Which document should I prepare in the app?" })).toBeTruthy();
    expect(screen.getByText("دي خريطة استخدام البرنامج من أول ملف P6 لحد التقرير. كل زر تحت بيفتح الشاشة الحقيقية، ومكتوب قبله إيه اللي تجهزه وبعده إيه المفروض يطلع.")).toBeTruthy();
    const realScreenshot = screen.getByRole("img", { name: /ابدأ وعرّف الحالة/ });
    expect(realScreenshot.getAttribute("src")).toContain("step-1-start_");
    fireEvent.click(screen.getByRole("button", { name: /ارفع نسخ البرنامج/ }));
    fireEvent.click(screen.getByRole("button", { name: "افتح رفع P6 · Open P6 upload" }));
    expect(onNavigate).toHaveBeenCalledWith("schedule");
  });

  it("يعرض English وLTR مع حماية مسار P6 والصورة الأصلية", () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    const { onNavigate } = renderGuide();

    expect(screen.getByRole("heading", { name: "Follow the route step by step" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Which document should I prepare in the app?" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open route" })).toHaveLength(3);
    expect(screen.getByLabelText("Follow the route step by step").getAttribute("dir")).toBe("ltr");
    const realScreenshot = screen.getByRole("img", { name: /Start and define the case/ });
    expect(realScreenshot.getAttribute("src")).toContain("step-1-start_");
    fireEvent.click(screen.getByRole("button", { name: /Upload the programme versions/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open P6 upload" }));
    expect(onNavigate).toHaveBeenCalledWith("schedule");
  });
});
