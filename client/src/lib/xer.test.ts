import { describe, expect, it } from "vitest";
import { importXerSchedule } from "./xer";

const xerWithResourceAssignment = `%T\tPROJECT
%F\tproj_short_name\tplan_start_date
%R\tبرج تجريبي\t2026-03-01
%E
%T\tTASK
%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\twbs_id\tearly_start_date
%R\tT-100\tA100\tأعمال الأساسات\t80\t40\tW-01\t2026-03-01
%E
%T\tRSRC
%F\trsrc_id\trsrc_name\trsrc_type
%R\tR-EXC\tحفار\tNonLabor
%E
%T\tTASKRSRC
%F\ttaskrsrc_id\ttask_id\trsrc_id\trsrc_type\ttarget_cost\tremain_cost\tact_reg_cost\tact_ot_cost\ttarget_qty\tremain_qty\tcost_per_qty\tremain_qty_per_hr\tacct_id\twbs_id
%R\tTR-01\tT-100\tR-EXC\tNonLabor\t5000\t2500\t1000\t200\t100\t50\t50\t1\tAC-01\tW-01
%E`;

describe("XER resource and cost import", () => {
  it("reads TASKRSRC values and links the resource assignment to the task and cost account", () => {
    const { schedule, summary } = importXerSchedule(xerWithResourceAssignment, "resources.xer");
    expect(summary).toMatchObject({ resourcesRead: 1, resourceAssignmentsRead: 1, resourceAssignmentsSkipped: 0, relationshipsSkipped: 0, assignmentsWithCosts: 1 });
    expect(schedule.resourceAssignments).toEqual([expect.objectContaining({ id: "TR-01", activityId: "T-100", resourceId: "R-EXC", resourceName: "حفار", resourceType: "nonlabor", targetCost: 5000, remainingCost: 2500, costPerUnit: 50, remainingQuantityPerHour: 1, costAccountId: "AC-01", wbsId: "W-01", source: "xer" })]);
  });

  it("records skipped relationship and resource rows as review evidence without changing the XER source", () => {
    const raw = `${xerWithResourceAssignment}
%T\tTASKPRED
%F\ttask_pred_id\tpred_task_id\ttask_id\tpred_type
%R\tREL-ORPHAN\tMISSING\tT-100\tPR_FS
%E
%T\tTASKRSRC
%F\ttaskrsrc_id\ttask_id\trsrc_id
%R\tTR-ORPHAN\tMISSING\tR-EXC
%E`;
    const result = importXerSchedule(raw, "orphan-links.xer");

    expect(result.summary).toMatchObject({ relationshipsRead: 0, relationshipsSkipped: 1, resourceAssignmentsRead: 1, resourceAssignmentsSkipped: 1 });
    expect(result.schedule.xerSource).toMatchObject({ rawText: raw, originalFileName: "orphan-links.xer", tableNames: expect.arrayContaining(["PROJECT", "TASK", "TASKPRED", "TASKRSRC"]), taskCalendarIds: [] });
    expect(result.summary.warnings.join(" ")).toContain("تم تجاهل علاقة XER");
    expect(result.summary.warnings.join(" ")).toContain("تم تجاهل إسناد مورد TASKRSRC");
  });
});

const xerWithTaskCalendarsAndConstraints = `%T\tPROJECT
%F\tproj_short_name\tplan_start_date
%R\tقيود وتجارب\t2026-03-01
%E
%T\tTASK
%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tclndr_id\tcstr_type\tcstr_date
%R\tT-100\tA100\tقيد بداية\t16\tCAL-01\tCS_SNET\t2026-03-10
%R\tT-200\tA200\tقيد نهاية\t16\tCAL-02\tCS_FNET\t2026-03-20
%R\tT-300\tA300\tقيد غير مدعوم\t8\tCAL-02\tCS_MFO\t2026-03-24
%E
%T\tTASKPRED
%F\ttask_pred_id\tpred_task_id\ttask_id\tpred_type
%R\tR-100\tT-100\tT-200\tPR_FS
%E`;

describe("XER task calendars and constraints", () => {
  it("retains per-task calendar identifiers and distinguishes supported lower-bound constraints from review-only constraints", () => {
    const { schedule, summary } = importXerSchedule(xerWithTaskCalendarsAndConstraints, "constraints.xer");

    expect(summary).toMatchObject({ taskCalendarIds: ["CAL-01", "CAL-02"], taskCalendarCount: 2, activitiesWithoutCalendarId: 0, constraintsRead: 3, supportedConstraintsRead: 2, unsupportedConstraintsRead: 1 });
    expect(schedule.activities.find((activity) => activity.id === "T-100")).toMatchObject({ calendarId: "CAL-01", constraint: { type: "start-on-or-after", date: "2026-03-10", sourceCode: "CS_SNET" } });
    expect(schedule.activities.find((activity) => activity.id === "T-200")).toMatchObject({ calendarId: "CAL-02", constraint: { type: "finish-on-or-after", date: "2026-03-20", sourceCode: "CS_FNET" } });
    expect(schedule.activities.find((activity) => activity.id === "T-300")?.constraintAudit).toEqual([expect.objectContaining({ code: "CS_MFO", status: "review-required" })]);
    expect(summary.warnings.join(" ")).toContain("معرفات تقويم مختلفة");
    expect(summary.warnings.join(" ")).toContain("لا يحسبها المحرك المحلي");
  });
});
