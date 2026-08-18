import type { DelayCause, Fragnet, Relationship } from "./cpm";

export type IssueFragnetProposal = {
  id: string;
  title: string;
  occurrenceDate: string;
  durationDays: number;
  relationshipId: string;
  affectedActivityIds: string[];
  cause: "employer" | "contractor" | "neutral";
  responsibility: "employer" | "contractor" | "engineer" | "third_party" | "undetermined";
  description: string;
};

const responsibilityLabel: Record<IssueFragnetProposal["responsibility"], string> = { employer: "صاحب العمل", contractor: "المقاول", engineer: "المهندس", third_party: "طرف ثالث", undetermined: "غير محددة" };

export function issueProposalToFragnet(proposal: IssueFragnetProposal, relationship: Relationship): Fragnet {
  if (proposal.relationshipId !== relationship.id) throw new Error("العلاقة المرجعية للمقترح لا تطابق علاقة البرنامج الحالية.");
  const activityId = `FR-${proposal.id}`;
  return {
    id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    cause: proposal.cause as DelayCause,
    occurrenceDate: proposal.occurrenceDate,
    replacedRelationshipIds: [relationship.id],
    activities: [{ id: activityId, name: proposal.title, duration: proposal.durationDays, wbs: "ISSUE-LOG", owner: responsibilityLabel[proposal.responsibility], kind: "fragnet" }],
    relationships: [
      { id: `${activityId}-IN`, predecessorId: relationship.predecessorId, successorId: activityId, type: relationship.type, lag: relationship.lag ?? 0 },
      { id: `${activityId}-OUT`, predecessorId: activityId, successorId: relationship.successorId, type: "FS" },
    ],
  };
}
