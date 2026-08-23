import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCPM } from "./cpm";
import { buildP6ReconciliationManifest } from "./p6-reconciliation-manifest";
import { importXerSchedule } from "./xer";

const uploadsDir = "/home/ubuntu/upload";
const baselinePath = resolve(uploadsDir, "Workshop-NO8TimeImpactAnalysisBaseline.xer");
const postTiaPath = resolve(uploadsDir, "Workshop-NO8TimeImpactAnalysisPostTIA.xer");
const hasPrivateWorkshopSources = existsSync(baselinePath) && existsSync(postTiaPath);
const describeWorkshop = hasPrivateWorkshopSources ? describe : describe.skip;

describeWorkshop("Workshop NO8 — private source regression", () => {
  it("يستورد Baseline وPost-TIA محلياً ويثبت الفروقات البنيوية ونتيجة CPM المراجَعة", () => {
    const baseline = importXerSchedule(readFileSync(baselinePath, "utf8"), "Workshop-NO8TimeImpactAnalysisBaseline.xer");
    const postTia = importXerSchedule(readFileSync(postTiaPath, "utf8"), "Workshop-NO8TimeImpactAnalysisPostTIA.xer");
    const baselineCpm = runCPM(baseline.schedule);
    const postTiaCpm = runCPM(postTia.schedule);

    expect(baseline.summary.activitiesRead).toBe(9);
    expect(baseline.summary.relationshipsRead).toBe(9);
    expect(baseline.summary.wbsRead).toBe(3);
    expect(postTia.summary.activitiesRead).toBe(13);
    expect(postTia.summary.relationshipsRead).toBe(15);
    expect(postTia.summary.wbsRead).toBe(3);
    expect(postTia.summary.activitiesRead - baseline.summary.activitiesRead).toBe(4);
    expect(postTia.summary.relationshipsRead - baseline.summary.relationshipsRead).toBe(6);
    expect(postTiaCpm.projectDuration - baselineCpm.projectDuration).toBe(17);

    const manifest = buildP6ReconciliationManifest({
      schedule: postTia.schedule,
      cpm: postTiaCpm,
      xerSummary: postTia.summary,
    });
    expect(manifest.schedule.source).toBe("xer");
    expect(manifest.counts).toMatchObject({ activities: 13, relationships: 15, wbsNodes: 3 });
    expect(manifest.reconciliationState).toBe("review-required");
    expect(manifest.reviewReasons.some(reason => reason.includes("تحذيرات استيراد"))).toBe(true);
    expect(manifest.scopeNotice).toContain("لا يثبت وحده تكافؤ Primavera P6");
  });
});
