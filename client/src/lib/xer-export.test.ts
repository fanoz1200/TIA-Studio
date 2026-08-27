import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { runCPM, type Fragnet, type Schedule } from "./cpm";
import { assessPrimaveraCalendarMatch, buildPreservedEventPackageZip, exportExperimentalXer, exportPreservedPostXer, exportPreservedPreXer, validateExperimentalXerRoundTrip } from "./xer-export";
import { reviewP6CalendarData } from "./xer-format";
import { importXerBytes, importXerSchedule } from "./xer";

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
  "%F\tproj_id\tproj_short_name\tclndr_id\tplan_start_date\tlast_recalc_date",
  "%R\t100\tPRESERVE-DEMO\t10\t2026-04-01\t2026-04-02",
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

const preservedRawBytes = new TextEncoder().encode(preservedRawXer);
const preservedSchedule = importXerBytes(preservedRawBytes, "original-program.xer").schedule;
const textFromBytes = (bytes: Uint8Array) => new TextDecoder("iso-8859-1").decode(bytes);

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function hasByteSequence(bytes: Uint8Array, expected: Uint8Array) {
  return Array.from({ length: Math.max(0, bytes.length - expected.length + 1) }, (_, start) => expected.every((value, index) => bytes[start + index] === value)).some(Boolean);
}

const nonUtf8Marker = "Leave-me-exactly-as-is";
const nonUtf8SourceBytes = (() => {
  const markerStart = preservedRawXer.indexOf(nonUtf8Marker);
  return concatBytes(
    new TextEncoder().encode(preservedRawXer.slice(0, markerStart)),
    new Uint8Array([0xA3]),
    new TextEncoder().encode(preservedRawXer.slice(markerStart + nonUtf8Marker.length)),
  );
})();
const nonUtf8Schedule = importXerBytes(nonUtf8SourceBytes, "legacy-8bit-program.xer").schedule;

describe("P6 CalendarData structural review", () => {
  it("recognizes common P6 layer prefixes without interpreting a working calendar", () => {
    const review = reviewP6CalendarData("(0||CalendarData(0||DaysOfWeek(0||1(0||s 08:00 0||f 16:00))(0||7(0||s 09:00 0||f 13:00)))(0||Exceptions(0||d 46000)))");
    expect(review).toEqual({
      state: "readable",
      hasDaysOfWeek: true,
      weekdayEntries: 2,
      weekdayPeriodStartMarkers: 2,
      weekdayPeriodFinishMarkers: 2,
      hasExceptions: true,
      exceptionDateMarkers: 1,
    });
  });

  it("recognizes P6 pipe-delimited calendar atoms while retaining the double-pipe prefix", () => {
    const review = reviewP6CalendarData("(0||CalendarData(0||DaysOfWeek(0||1(0||s|08:00|0||f|16:00)))(0||Exceptions(0||d|46000)))");
    expect(review).toEqual({
      state: "readable",
      hasDaysOfWeek: true,
      weekdayEntries: 1,
      weekdayPeriodStartMarkers: 1,
      weekdayPeriodFinishMarkers: 1,
      hasExceptions: true,
      exceptionDateMarkers: 1,
    });
  });

  it("counts a named weekday section when its only safe evidence is a period pair", () => {
    const review = reviewP6CalendarData("(CalendarData(DaysOfWeek(Monday(s|08:00|f|16:00)))(Exceptions()))");
    expect(review.weekdayEntries).toBe(1);
    expect(review.weekdayPeriodStartMarkers).toBe(1);
    expect(review.weekdayPeriodFinishMarkers).toBe(1);
  });

  it("keeps malformed and absent CalendarData separate from a readable structural review", () => {
    expect(reviewP6CalendarData("(0||CalendarData(0||DaysOfWeek").state).toBe("malformed");
    expect(reviewP6CalendarData("(0||NotCalendarData())").state).toBe("not-found");
  });
});

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
  it("returns Pre as the exact user-selected original source bytes", () => {
    const pre = exportPreservedPreXer(preservedSchedule, relationshipFragnet);
    expect(pre).toMatchObject({ state: "ready", fileName: "PRESERVE-DEMO--EV-001--PRE-TIA.xer" });
    expect(pre.bytes).toEqual(preservedRawBytes);
  });

  it("keeps raw calendar, resource, and custom blocks while only replacing declared TASKPRED rows and adding new rows", () => {
    const post = exportPreservedPostXer(preservedSchedule, relationshipFragnet);
    expect(post.state).toBe("ready");
    const content = textFromBytes(post.bytes!);
    expect(content).toContain("%R\t10\tP6 Calendar\t(0||0()())\t8");
    expect(content).toContain("%R\t500\tCrew A");
    expect(content).toContain("%R\t700\t1\t500\t123.45");
    expect(content).toContain("%R\t900\t1\tLeave-me-exactly-as-is");
    expect(content).not.toContain("%R\t50\t2\t1\t100\t100\tPR_FS\t0");
    expect(content).toContain("%R\t3\t100\t1000\t10\tFN-001\tInstruction delay\t16\t16\tTT_Task\tDT_FixedDUR2\tTK_NotStart");
    expect(content).toContain("%R\t51\t3\t1\t100\t100\tPR_FS\t0");
    expect(content).toContain("%R\t52\t2\t3\t100\t100\tPR_FS\t0");
    expect(post).toMatchObject({ addedTaskIds: ["3"], addedRelationshipIds: ["51", "52"], calendarAssignmentId: "10", localRoundTrip: { state: "review", activityCount: 3, relationshipCount: 2 } });
  });

  it("blocks activity splitting because it would require rewriting original TASK rows", () => {
    const split = exportPreservedPostXer(preservedSchedule, { ...relationshipFragnet, id: "EV-SPLIT", model: "activity-split", replacedActivityIds: ["A100"] });
    expect(split.state).toBe("blocked");
    expect(split.messages.join(" ")).toContain("Activity Split");
  });

  it("returns a non-UTF-8 Pre byte-for-byte and leaves its untouched source bytes unchanged in ASCII-only Post", () => {
    const pre = exportPreservedPreXer(nonUtf8Schedule, relationshipFragnet);
    const post = exportPreservedPostXer(nonUtf8Schedule, relationshipFragnet);
    const rawUdfBlock = concatBytes(new TextEncoder().encode("%T\tUDFVALUE\r\n%F\tudf_type_id\tfk_id\tudf_value\r\n%R\t900\t1\t"), new Uint8Array([0xA3]), new TextEncoder().encode("\r\n%E"));
    expect(nonUtf8Schedule.xerSource).toMatchObject({ sourceEncoding: "single-byte-8bit", preByteExact: true });
    expect(pre.bytes).toEqual(nonUtf8SourceBytes);
    expect(post.state).toBe("ready");
    expect(hasByteSequence(post.bytes!, rawUdfBlock)).toBe(true);
  });

  it("blocks a non-UTF-8 Post when an injected XER cell is not ASCII instead of silently changing its encoding", () => {
    const post = exportPreservedPostXer(nonUtf8Schedule, {
      ...relationshipFragnet,
      activities: [{ ...relationshipFragnet.activities[0], name: "تعطيل" }],
    });
    expect(post.state).toBe("blocked");
    expect(post.messages.join(" ")).toContain("ASCII");
  });

  it("reports a calendar reference review rather than claiming P6 parity", () => {
    const assessment = assessPrimaveraCalendarMatch(preservedSchedule);
    expect(assessment).toMatchObject({ state: "review", sourceCalendarCount: 1, projectCalendarId: "10", taskCalendarIds: ["10"], encodedCalendarData: { state: "present", calendarsWithEncodedData: 1, projectCalendarHasEncodedData: true, calendarRowsWithPlainDateMarkers: 0, plainDateMarkerCount: 0 }, hoursPerDay: { state: "match", source: 8, local: 8 }, dataDate: { state: "match", source: "2026-04-02", local: "2026-04-02" }, inheritance: { state: "not-referenced" } });
    expect(assessment.messages.join(" ")).toContain("Schedule/F9");
  });

  it("reports plain date markers in encoded calendar data as review evidence only", () => {
    const sourceWithDateMarker = importXerBytes(new TextEncoder().encode(preservedRawXer.replace("(0||0()())", "(0||EXCEPTION-2026-05-01||0()())")), "calendar-marker.xer").schedule;
    const assessment = assessPrimaveraCalendarMatch(sourceWithDateMarker);
    expect(assessment.encodedCalendarData).toMatchObject({ state: "present", calendarsWithEncodedData: 1, projectCalendarHasEncodedData: true, calendarRowsWithPlainDateMarkers: 1, plainDateMarkerCount: 1 });
    expect(assessment.messages.join(" ")).toContain("قد ترتبط باستثناءات");
    expect(assessment.messages.join(" ")).toContain("لا يفسرها");
  });

  it("blocks local calendar reliance when the source day hours or Data Date diverge", () => {
    expect(assessPrimaveraCalendarMatch({ ...preservedSchedule, calendar: { ...preservedSchedule.calendar!, hoursPerDay: 10 } })).toMatchObject({ state: "blocked", hoursPerDay: { state: "mismatch", source: 8, local: 10 } });
    expect(assessPrimaveraCalendarMatch({ ...preservedSchedule, dataDate: "2026-04-03" })).toMatchObject({ state: "blocked", dataDate: { state: "mismatch", source: "2026-04-02", local: "2026-04-03" } });
  });

  it("creates a local ZIP with an exact Pre entry, its byte hash, Post, and a manifest for every selected event", async () => {
    const output = await buildPreservedEventPackageZip(preservedSchedule, [relationshipFragnet]);
    const zip = await JSZip.loadAsync(await output.blob.arrayBuffer());
    const root = "PRESERVE-DEMO--EVENT-PACKAGE/events/EV-001";
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      `${root}/PRESERVE-DEMO--EV-001--PRE-TIA.xer`,
      `${root}/PRESERVE-DEMO--EV-001--POST-TIA.xer`,
      `${root}/P6-REIMPORT-SCHEDULE-F9-CHECKLIST.md`,
      `${root}/P6-LOCAL-RECONCILIATION.json`,
      `${root}/manifest.json`,
      "PRESERVE-DEMO--EVENT-PACKAGE/package-manifest.json",
    ]));
    const manifest = await zip.file(`${root}/manifest.json`)?.async("string");
    const checklist = await zip.file(`${root}/P6-REIMPORT-SCHEDULE-F9-CHECKLIST.md`)?.async("string");
    const reconciliation = await zip.file(`${root}/P6-LOCAL-RECONCILIATION.json`)?.async("string");
    const preBytes = new Uint8Array(await zip.file(`${root}/PRESERVE-DEMO--EV-001--PRE-TIA.xer`)!.async("arraybuffer"));
    const expectedHash = createHash("sha256").update(preservedRawBytes).digest("hex");
    expect(preBytes).toEqual(preservedRawBytes);
    expect(manifest).toContain("sourceSha256");
    expect(manifest).toContain(expectedHash);
    expect(manifest).toContain("FN-001");
    expect(checklist).toContain("Schedule/F9");
    expect(checklist).toContain("قرار فني فقط");
    expect(reconciliation).toContain("local-cpm-reconciliation");
  });
});
