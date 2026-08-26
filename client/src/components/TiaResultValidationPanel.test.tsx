import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Schedule } from "@/lib/cpm";
import { TiaResultValidationPanel } from "./TiaResultValidationPanel";

const schedule: Schedule = {
  id: "validation-schedule",
  name: "برنامج تجريبي",
  startDate: "2026-01-01",
  calendar: { id: "test-calendar", name: "Test calendar", workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
  activities: [],
  relationships: [],
};

function renderPanel(onAnalystExpectedDaysChange = vi.fn(), analystExpectedDays = "") {
  return render(
    <LanguageProvider>
      <TiaResultValidationPanel
        schedule={schedule}
        selectedEvent={null}
        activeResult={null}
        analystExpectedDays={analystExpectedDays}
        onAnalystExpectedDaysChange={onAnalystExpectedDaysChange}
      />
    </LanguageProvider>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("لوحة تحقق نتيجة TIA", () => {
  it("تعرض العناوين المهنية بالعربية · English مع بقاء قيمة التقدير رقماً يمر إلى المعالج", () => {
    const onAnalystExpectedDaysChange = vi.fn();
    renderPanel(onAnalystExpectedDaysChange);

    expect(screen.getByText("لوحة تحقق النتيجة وقواعد القرار · Result validation and decision rules")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("تقدير المحلل (أيام عمل، اختياري) · Analyst estimate (working days, optional)"), { target: { value: "7" } });
    expect(onAnalystExpectedDaysChange).toHaveBeenCalledWith("7");
  });

  it("يعرض English باتجاه LTR من دون إعادة تفسير نتيجة المحرك أو قيمة الإدخال", () => {
    window.localStorage.setItem("tia-studio-interface-language", "en");
    const onAnalystExpectedDaysChange = vi.fn();
    renderPanel(onAnalystExpectedDaysChange, "7");

    expect(screen.getByText("Result validation and decision rules")).toBeTruthy();
    expect(screen.getByLabelText("Analyst estimate (working days, optional)")).toBeTruthy();
    expect(screen.getByText("For comparison only; it does not change CPM or the calculated impact.")).toBeTruthy();
    expect(screen.getByLabelText("TIA result validation").getAttribute("dir")).toBe("ltr");

    expect((screen.getByLabelText("Analyst estimate (working days, optional)") as HTMLInputElement).value).toBe("7");
  });
});
