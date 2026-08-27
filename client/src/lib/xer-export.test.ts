import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { runCPM, type Fragnet, type Schedule } from "./cpm";
import { assessPrimaveraCalendarMatch, buildPreservedEventPackageZip, exportExperimentalXer, exportPreservedPostXer, exportPreservedPreXer, validateExperimentalXerRoundTrip } from "./xer-export";
import { importXerSchedule } from "./xer";

const schedule: Schedule = {
  id: "xer-export-test",
  name: "مشروع اختبار XER",
  startDate: "2026-04-01",
  dataDate: "2026-04-02",
  calendar: { id: "test-cal", name: "تقويم اختبار", workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [], hoursPerDay: 8 },
  wbsNodes: [{ id: "W-01", code: "1.1", name: "الأعمال", path: "الأعمال" }],
  activities: [
    { id: "A100", name: "بداية", duration: 2, wbsId: "W-01", percentComplete: 25, percentCompleteType: "physical" },
    { id: "A200", name: "تنفيذ", duration: 3, wbsId: "W-01" },
  ],
  relationships: [{ id: "R-1", predecessorId: "A100", successorId: "A200", type: "FS", lag: 1 }],
};

describe("experimental XER export", () => {
  it("writes the declared interchange tables and round-trips activity and relationship counts", () => {
    const result = exportExperimentalXer(schedule, "post-tia");
    const imported = importXerSchedule(result.content, result.fileName);
    expect(result.fileName).toContain("POST-TIA.xer");
    expect(result.content).toContain("%T\tPROJECT");
    expect(result.content).toContain("%T\tTASKPRED");
    expect(imported.summary).toMatchObject({ activitiesRead: 2, relationshipsRead: 1, wbsRead: 1 });
    expect(imported.schedule.activities.map((activity) => activity.name)).toEqual(expect.arrayContaining(["A100 — بداية", "A200 — تنفيذ"]));
    expect(imported.schedule.relationships[0]).toMatchObject({ type: "FS", lag: 1 });
    expect(runCPM(imported.schedule).projectDuration).toBe(runCPM(schedule).projectDuration);
  });

  it("states the missing P6 scopes rather than silently claiming full fidelity", () => {
    const result = exportExperimentalXer(schedule);
    expect(result.warnings.join(" ")).toContain("الموارد");
    expect(result.warnings.join(" ")).toContain("لا يستبدل ملف P6 المصدر");
  });

  it("returns reverse-import evidence and keeps the export in review until Primavera is checked separately", () => {
    const result = exportExperimentalXer(schedule);
    const check = validateExperimentalXerRoundTrip(result);
    expect(check).toMatchObject({ state: "review", activityCount: 2, relationshipCount: 1 });
    expect(check.messages.join(" ")).toContain("نجح فحص البنية والأعداد");
    expect(check.messages.join(" ")).toContain("Primavera");
  });
});

const preservedRawXer = [
  "%T\tPROJECT",
  "%F\tproj_id\tproj_short_name\tclndr_id\tplan_start_date",
  "%R\t100\tPRESERVE-DEMO\t10\t2026-04-01",
  "%E",
  "%T\tCALENDAR",
  "%F\tclndr_id\tclndr_name\tclndr_data\tday_hr_cnt",
  "%R\t10\tP6 Calendar\t(0||0()())\t8",
  "%E",
  "%T\tPROJWBS",
  "%F\twbs_id\tproj_id\twbs_short_name\twbs_name\tparent_wbs_id",
  "%R\t1000\t100\t1.0\tMain WBS\t",
  "%E",
  "%T\tTASK",
  "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code",
  "%R\t1\t100\t1000\t10\tA100\tStart\t16\t16\tTT_Task\tDT_FixedDUR2\tTK_NotStart",
  "%R\t2\t100\t1000\t10\tA200\tFinish\t24\t24\tTT_Task\tDT_FixedDUR2\tTK_NotStart",
  "%E",
  "%T\tTASKPRED",
  "%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt",
  "%R\t50\t2\t1\t100\t100\tPR_FS\t0",
  "%E",
  "%T\tRSRC",
  "%F\trsrc_id\trsrc_name",
  "%R\t500\tCrew A",
  "%E",
  "%T\tTASKRSRC",
  "%F\ttaskrsrc_id\ttask_id\trsrc_id\ttarget_cost",
  "%R\t700\t1\t500\t123.45",
  "%E",
  "%T\tUDFVALUE",
  "%F\tudf_type_id\tfk_id\tudf_value",
  "%R\t900\t1\tLeave-me-exactly-as-is",
  "%E",
].join("\r\n");

const preservedSchedule = importXerSchedule(preservedRawXer, "original-program.xer").schedule;
const relationshipFragnet: Fragnet = {
  id: "EV-001",
  title: "Late instruction",
  description: "Relationship-only event for preserved export tests.",
  cause: "employer",
  occurrenceDate: "2026-04-02",
  activities: [{ id: "FN-001", name: "Instruction delay", duration: 2, wbsId: "1000", calendarId: "10", kind: "fragnet" }],
  relationships: [
    { id: "FREL-1", predecessorId: "1", successorId: "FN-001", type: "FS" },
    { id: "FREL-2", predecessorId: "FN-001", successorId: "2", type: "FS" },
  ],
  replacedRelationshipIds: ["50"],
  model: "relationship-fragnet",
};

describe("preserved XER event export", () => {
  it("returns Pre as the exact user-selected original source", () => {
    const pre = exportPreservedPreXer(preservedSchedule, relationshipFragnet);
    expect(pre).toMatchObject({ state: "ready", fileName: "PRESERVE-DEMO--EV-001--PRE-TIA.xer", content: preservedRawXer });
    expect(pre.content).toBe(preservedRawXer);
  });

  it("keeps raw calendar, resource, and custom blocks while only replacing declared TASKPRED rows and adding new rows", () => {
    const post = exportPreservedPostXer(preservedSchedule, relationshipFragnet);
    expect(post.state).toBe("ready");
    expect(post.content).toContain("%R\t10\tP6 Calendar\t(0||0()())\t8");
    expect(post.content).toContain("%R\t500\tCrew A");
    expect(post.content).toContain("%R\t700\t1\t500\t123.45");
    expect(post.content).toContain("%R\t900\t1\tLeave-me-exactly-as-is");
    expect(post.content).not.toContain("%R\t50\t2\t1\t100\t100\tPR_FS\t0");
    expect(post.content).toContain("%R\t3\t100\t1000\t10\tFN-001\tInstruction delay\t16\t16\tTT_Task\tDT_FixedDUR2\tTK_NotStart");
    expect(post.content).toContain("%R\t51\t3\t1\t100\t100\tPR_FS\t0");
    expect(post.content).toContain("%R\t52\t2\t3\t100\t100\tPR_FS\t0");
    expect(post).toMatchObject({ addedTaskIds: ["3"], addedRelationshipIds: ["51", "52"], calendarAssignmentId: "10", localRoundTrip: { state: "review", activityCount: 3, relationshipCount: 2 } });
  });

  it("blocks activity splitting because it would require rewriting original TASK rows", () => {
    const split = exportPreservedPostXer(preservedSchedule, { ...relationshipFragnet, id: "EV-SPLIT", model: "activity-split", replacedActivityIds: ["A100"] });
    expect(split.state).toBe("blocked");
    expect(split.messages.join(" ")).toContain("Activity Split");
  });

  it("reports a calendar reference review rather than claiming P6 parity", () => {
    const assessment = assessPrimaveraCalendarMatch(preservedSchedule);
    expect(assessment).toMatchObject({ state: "review", sourceCalendarCount: 1, projectCalendarId: "10", taskCalendarIds: ["10"] });
    expect(assessment.messages.join(" ")).toContain("Schedule/F9");
  });

  it("creates a local ZIP with Pre, Post, and a manifest for every selected event", async () => {
    const output = await buildPreservedEventPackageZip(preservedSchedule, [relationshipFragnet]);
    const zip = await JSZip.loadAsync(await output.blob.arrayBuffer());
    const root = "PRESERVE-DEMO--EVENT-PACKAGE/events/EV-001";
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      `${root}/PRESERVE-DEMO--EV-001--PRE-TIA.xer`,
      `${root}/PRESERVE-DEMO--EV-001--POST-TIA.xer`,
      `${root}/manifest.json`,
      "PRESERVE-DEMO--EVENT-PACKAGE/package-manifest.json",
    ]));
    const manifest = await zip.file(`${root}/manifest.json`)?.async("string");
    expect(manifest).toContain("sourceSha256");
    expect(manifest).toContain("FN-001");
  });
});
