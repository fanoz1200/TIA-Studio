import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { importP6XmlSchedule } from "./p6-xml";

// The production adapter runs in browsers. xmldom supplies the same DOMParser
// contract for this deterministic Node-based unit test.
globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <ObjectId>100</ObjectId><Name>Metro Extension — Revision 07</Name><PlannedStartDate>2026-01-05T08:00:00</PlannedStartDate><DataDate>2026-02-01T08:00:00</DataDate>
    <WBS><ObjectId>10</ObjectId><Code>1.0</Code><Name>Civil Works</Name></WBS>
    <WBS><ObjectId>11</ObjectId><Code>1.1</Code><Name>Station A</Name><ParentObjectId>10</ParentObjectId></WBS>
    <Activity><ObjectId>1001</ObjectId><Id>A100</Id><Name>Excavation</Name><WBSObjectId>11</WBSObjectId><PlannedDuration>40</PlannedDuration><PhysicalPercentComplete>0.25</PhysicalPercentComplete><PercentCompleteType>Physical</PercentCompleteType><ActualStartDate>2026-01-05T08:00:00</ActualStartDate></Activity>
    <Activity><ObjectId>1002</ObjectId><Id>A110</Id><Name>Concrete Works</Name><WBSObjectId>11</WBSObjectId><PlannedDuration>80</PlannedDuration><DurationPercentComplete>50</DurationPercentComplete><PercentCompleteType>Duration</PercentCompleteType><RemainingDuration>40</RemainingDuration></Activity>
    <Relationship><ObjectId>300</ObjectId><PredecessorActivityObjectId>1001</PredecessorActivityObjectId><SuccessorActivityObjectId>1002</SuccessorActivityObjectId><Type>PR_FS</Type><Lag>8</Lag></Relationship>
  </Project>
</APIBusinessObjects>`;

describe("importP6XmlSchedule", () => {
  it("maps WBS hierarchy, progress, durations and relationships", () => {
    const { schedule, summary } = importP6XmlSchedule(sample, "metro.xml");

    expect(summary).toMatchObject({ projectName: "Metro Extension — Revision 07", activitiesRead: 2, relationshipsRead: 1, wbsRead: 2, activitiesWithProgress: 2 });
    expect(schedule.startDate).toBe("2026-01-05");
    expect(schedule.dataDate).toBe("2026-02-01");
    expect(schedule.wbsNodes?.find((node) => node.id === "11")?.path).toBe("1.0 — Civil Works / 1.1 — Station A");
    expect(schedule.activities[0]).toMatchObject({ id: "A100", duration: 5, percentComplete: 25, percentCompleteType: "physical", wbsId: "11" });
    expect(schedule.activities[1]).toMatchObject({ id: "A110", duration: 10, percentComplete: 50, remainingDuration: 5, percentCompleteType: "duration" });
    expect(schedule.relationships[0]).toMatchObject({ predecessorId: "A100", successorId: "A110", type: "FS", lag: 1 });
  });

  it("reports a useful error when activities are missing", () => {
    expect(() => importP6XmlSchedule("<Project><Name>Empty</Name><PlannedStartDate>2026-01-01</PlannedStartDate></Project>")).toThrow("أنشطة Activity");
  });
});
