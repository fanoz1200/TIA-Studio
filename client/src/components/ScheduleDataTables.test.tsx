import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityDataTable, RelationshipDataTable } from "./ScheduleDataTables";

const activities = [
  { id: "A200", name: "الهيكل", wbs: "2.1", duration: 8, totalFloat: 0, earlyStart: 3, earlyFinish: 11, lateStart: 3, lateFinish: 11, freeFloat: 0, isCritical: true, kind: "base" as const },
  { id: "A100", name: "الحفر", wbs: "1.1", duration: 3, totalFloat: 4, earlyStart: 0, earlyFinish: 3, lateStart: 4, lateFinish: 7, freeFloat: 4, isCritical: false, kind: "base" as const },
  { id: "FR-01", name: "اعتماد تعديل", wbs: "CO-01", duration: 5, totalFloat: 0, earlyStart: 11, earlyFinish: 16, lateStart: 11, lateFinish: 16, freeFloat: 0, isCritical: true, kind: "fragnet" as const },
];

afterEach(cleanup);

describe("جدول الأنشطة القابل للفلترة والترتيب", () => {
  it("يبحث في الاسم ويعرض عداد النتائج ثم يعيد الضبط", () => {
    render(<ActivityDataTable activities={activities} />);
    fireEvent.change(screen.getByLabelText("ابحث في الأنشطة"), { target: { value: "تعديل" } });
    expect(screen.getByRole("status").textContent).toContain("1 من 3 نشاط");
    expect(screen.getByText("اعتماد تعديل")).toBeTruthy();
    expect(screen.queryByText("الهيكل")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "مسح" }));
    expect(screen.getByRole("status").textContent).toContain("3 نشاط");
  });

  it("يرتب المدة ويعلن اتجاه الفرز للقراء المساعدين", () => {
    render(<ActivityDataTable activities={activities} />);
    fireEvent.click(screen.getByRole("button", { name: "رتّب حسب المدة" }));

    const table = screen.getByRole("table", { name: "جدول الأنشطة" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByText("A100")).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: /المدة/ }).getAttribute("aria-sort")).toBe("ascending");
  });
});

describe("جدول العلاقات المنطقية القابل للفلترة والترتيب", () => {
  it("يبحث في النشاط ويرتب العلاقة حسب السابق", () => {
    render(
      <RelationshipDataTable
        activities={activities}
        relationships={[
          { id: "R-20", predecessorId: "A200", successorId: "FR-01", type: "FS" },
          { id: "R-10", predecessorId: "A100", successorId: "A200", type: "SS" },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("ابحث في العلاقات"), { target: { value: "الحفر" } });
    expect(screen.getByRole("status").textContent).toContain("1 من 2 علاقة");
    expect(screen.getByText("R-10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "مسح" }));
    fireEvent.click(screen.getByRole("button", { name: "رتّب حسب السابق" }));
    const table = screen.getByRole("table", { name: "جدول العلاقات المنطقية" });
    expect(within(within(table).getAllByRole("row")[1]).getByText("R-10")).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: /السابق/ }).getAttribute("aria-sort")).toBe("ascending");
  });
});
