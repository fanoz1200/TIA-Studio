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
    expect(result.summary.warnings.join(" ")).toContain("تم تجاهل علاقة XER");
    expect(result.summary.warnings.join(" ")).toContain("تم تجاهل إسناد مورد TASKRSRC");
  });
});
