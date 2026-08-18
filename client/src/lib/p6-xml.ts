/**
 * Primavera XML adapter. It reads the portable schedule elements required by
 * TIA Studio: Project, Activity, Relationship/Predecessor, WBS, progress,
 * and ResourceAssignment values. It does not infer P6 calendar exceptions.
 */
import { calendarDayCalendar, type Activity, type Relationship, type RelationshipType, type ResourceAssignment, type Schedule, type WbsNode } from "./cpm";

export type P6XmlImportSummary = {
  projectName: string;
  activitiesRead: number;
  relationshipsRead: number;
  wbsRead: number;
  resourcesRead: number;
  resourceAssignmentsRead: number;
  assignmentsWithCosts: number;
  activitiesWithProgress: number;
  warnings: string[];
};

export type P6XmlImportResult = { schedule: Schedule; summary: P6XmlImportSummary };

function childrenByLocalName(root: Element | Document, names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return Array.from(root.getElementsByTagName("*")).filter((element) => wanted.has(element.localName.toLowerCase()));
}

function textValue(root: Element, ...names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const match = Array.from(root.childNodes).filter((node): node is Element => node.nodeType === 1).find((child) => wanted.has(child.localName.toLowerCase()))
    ?? childrenByLocalName(root, names)[0];
  return match?.textContent?.trim() ?? "";
}

function isoDate(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function numberValue(value: string) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function hours(value: string) {
  const numeric = numberValue(value);
  if (numeric) return numeric;
  const match = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0) + Number(match[3] ?? 0) / 60;
}

function percent(value: string) {
  const raw = numberValue(value);
  if (!raw) return undefined;
  return Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
}

function relationshipType(value: string): RelationshipType {
  const normalized = value.replace(/^PR_/i, "").toUpperCase();
  return normalized === "SS" || normalized === "FF" || normalized === "SF" ? normalized : "FS";
}

function resourceType(value: string): ResourceAssignment["resourceType"] {
  const normalized = value.replace(/[\s_-]/g, "").toLowerCase();
  if (normalized.includes("nonlabor") || normalized.includes("nonlabour")) return "nonlabor";
  if (normalized.includes("labor") || normalized.includes("labour")) return "labor";
  if (normalized.includes("material")) return "material";
  return "unknown";
}

function buildWbsNodes(elements: Element[]) {
  const nodes = elements.map((element, index) => ({
    id: textValue(element, "ObjectId", "Id", "WBSObjectId") || `WBS-${index + 1}`,
    code: textValue(element, "Code", "ShortName", "WBSCode"),
    name: textValue(element, "Name", "WBSName") || `WBS ${index + 1}`,
    parentId: textValue(element, "ParentObjectId", "ParentWBSObjectId") || undefined,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path = (node: typeof nodes[number], visited = new Set<string>()): string => {
    const label = node.code ? `${node.code} — ${node.name}` : node.name;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent || visited.has(node.id)) return label;
    return `${path(parent, new Set(Array.from(visited).concat(node.id)))} / ${label}`;
  };
  return nodes.map((node): WbsNode => ({ ...node, path: path(node) }));
}

export function importP6XmlSchedule(raw: string, fileName = "Primavera Schedule.xml"): P6XmlImportResult {
  const document = new DOMParser().parseFromString(raw, "application/xml");
  const parseError = childrenByLocalName(document, ["parsererror"])[0];
  if (parseError) throw new Error("ملف XML غير صالح أو غير مكتمل.");
  const project = childrenByLocalName(document, ["Project"])[0];
  if (!project) throw new Error("لم يعثر المستورد على عنصر Project داخل ملف Primavera XML.");

  const warnings: string[] = [];
  const activityElements = childrenByLocalName(project, ["Activity"]);
  if (!activityElements.length) throw new Error("لم يعثر المستورد على أنشطة Activity داخل مشروع P6 XML.");
  const wbsNodes = buildWbsNodes(childrenByLocalName(project, ["WBS"]).filter((element) => Boolean(textValue(element, "ObjectId", "Id", "WBSObjectId"))));
  const wbsById = new Map(wbsNodes.map((node) => [node.id, node.path]));
  const objectToActivity = new Map<string, string>();
  const activities: Activity[] = activityElements.map((element, index) => {
    const objectId = textValue(element, "ObjectId", "TaskObjectId");
    const id = textValue(element, "Id", "ActivityId", "TaskId") || objectId || `ACT-${index + 1}`;
    if (objectId) objectToActivity.set(objectId, id);
    const progress = percent(textValue(element, "PhysicalPercentComplete", "DurationPercentComplete", "PercentComplete"));
    const percentType = textValue(element, "PercentCompleteType").toLowerCase();
    const wbsId = textValue(element, "WBSObjectId", "WbsObjectId");
    const duration = hours(textValue(element, "PlannedDuration", "OriginalDuration", "RemainingDuration")) / 8;
    return {
      id,
      name: textValue(element, "Name", "ActivityName") || id,
      duration: Math.max(0, duration),
      wbsId: wbsId || undefined,
      wbs: wbsById.get(wbsId) || wbsId || undefined,
      percentComplete: progress,
      percentCompleteType: percentType.includes("physical") ? "physical" : percentType.includes("unit") ? "units" : progress === undefined ? undefined : "duration",
      remainingDuration: (() => { const value = hours(textValue(element, "RemainingDuration")); return value ? value / 8 : undefined; })(),
      actualStart: isoDate(textValue(element, "ActualStartDate", "ActualStart")) || undefined,
      actualFinish: isoDate(textValue(element, "ActualFinishDate", "ActualFinish")) || undefined,
    };
  });
  const activityIds = new Set(activities.map((activity) => activity.id));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const resourceElements = childrenByLocalName(project, ["Resource"]).filter((element) => Boolean(textValue(element, "ObjectId", "Id", "ResourceId")));
  const resourcesById = new Map(resourceElements.map((element) => [textValue(element, "ObjectId", "Id", "ResourceId"), element]));
  const resourceAssignments: ResourceAssignment[] = [];
  childrenByLocalName(project, ["ResourceAssignment"]).forEach((element, index) => {
    const rawActivityId = textValue(element, "ActivityObjectId", "TaskObjectId", "ActivityId", "TaskId");
    const activityId = objectToActivity.get(rawActivityId) || rawActivityId;
    if (!activityIds.has(activityId)) {
      warnings.push(`تم تجاهل إسناد مورد XML رقم ${index + 1} لأنه لا يشير إلى نشاط مقروء.`);
      return;
    }
    const resourceId = textValue(element, "ResourceObjectId", "ResourceId");
    const resource = resourcesById.get(resourceId);
    const activity = activityById.get(activityId);
    resourceAssignments.push({
      id: textValue(element, "ObjectId", "Id", "ResourceAssignmentObjectId") || `XML-RSRC-${index + 1}`,
      activityId,
      resourceId: resourceId || undefined,
      resourceName: textValue(resource ?? element, "Name", "ResourceName", "ShortName") || undefined,
      resourceType: resourceType(textValue(element, "ResourceType", "Type") || (resource ? textValue(resource, "ResourceType", "Type") : "")),
      costAccountId: textValue(element, "CostAccountObjectId", "CostAccountId", "AccountId") || undefined,
      wbsId: textValue(element, "WBSObjectId", "WbsObjectId") || activity?.wbsId,
      targetQuantity: numberValue(textValue(element, "BudgetedUnits", "TargetQuantity", "PlannedUnits")),
      remainingQuantity: numberValue(textValue(element, "RemainingUnits", "RemainingQuantity")),
      actualRegularQuantity: numberValue(textValue(element, "ActualRegularUnits", "ActualRegularQuantity")),
      actualOvertimeQuantity: numberValue(textValue(element, "ActualOvertimeUnits", "ActualOvertimeQuantity")),
      targetCost: numberValue(textValue(element, "BudgetedCost", "TargetCost", "PlannedCost")),
      remainingCost: numberValue(textValue(element, "RemainingCost")),
      actualRegularCost: numberValue(textValue(element, "ActualRegularCost")),
      actualOvertimeCost: numberValue(textValue(element, "ActualOvertimeCost")),
      costPerUnit: numberValue(textValue(element, "PricePerUnit", "CostPerUnit")),
      targetQuantityPerHour: numberValue(textValue(element, "BudgetedUnitsPerTime", "TargetQuantityPerHour", "PlannedUnitsPerTime")),
      remainingQuantityPerHour: numberValue(textValue(element, "RemainingUnitsPerTime", "RemainingQuantityPerHour")),
      activityRemainingDuration: activity?.remainingDuration ?? activity?.duration,
      source: "p6-xml",
    });
  });
  const relationships: Relationship[] = [];
  childrenByLocalName(project, ["Relationship", "Predecessor"]).forEach((element, index) => {
    const rawPredecessor = textValue(element, "PredecessorActivityObjectId", "PredecessorTaskObjectId", "PredecessorActivityId", "PredTaskId");
    const rawSuccessor = textValue(element, "SuccessorActivityObjectId", "TaskObjectId", "SuccessorActivityId", "TaskId");
    const predecessorId = objectToActivity.get(rawPredecessor) || rawPredecessor;
    const successorId = objectToActivity.get(rawSuccessor) || rawSuccessor;
    if (!activityIds.has(predecessorId) || !activityIds.has(successorId)) return;
    relationships.push({
      id: textValue(element, "ObjectId", "Id", "RelationshipId") || `XML-REL-${index + 1}`,
      predecessorId,
      successorId,
      type: relationshipType(textValue(element, "Type", "RelationshipType", "PredType")),
      lag: hours(textValue(element, "Lag", "LagDuration")) / 8,
    });
  });
  if (!wbsNodes.length) warnings.push("لم يعثر المستورد على عناصر WBS قابلة للقراءة؛ احتُفظ بالنشاط من دون مسار WBS.");
  if (!relationships.length) warnings.push("لم يعثر المستورد على علاقات قابلة للربط؛ راجع تصدير عنصر Relationships من P6 XML.");
  if (!resourceAssignments.length) warnings.push("لم يعثر المستورد على إسنادات ResourceAssignment قابلة للربط؛ صدّر الموارد من P6 XML لاحتساب الأثر المالي.");
  warnings.push("تُستخدم نسبة الإنجاز كما وردت في P6 للعرض والتقرير فقط؛ لا تُبدّل منطق CPM أو تحليل الاستحقاق.");
  const name = textValue(project, "Name", "ProjectName") || fileName.replace(/\.xml$/i, "") || "برنامج P6 XML مستورد";
  const startDate = isoDate(textValue(project, "PlannedStartDate", "StartDate")) || activities.map((activity) => activity.actualStart).filter(Boolean).sort()[0];
  if (!startDate) throw new Error("لم يعثر المستورد على تاريخ بدء للمشروع؛ صدّر تاريخ Planned Start ثم أعد المحاولة.");
  return {
    schedule: {
      id: `p6xml-${Date.now()}`,
      name,
      startDate,
      dataDate: isoDate(textValue(project, "DataDate", "LastRecalcDate")) || undefined,
      activities,
      relationships,
      calendar: { ...calendarDayCalendar, id: "p6-xml-review-calendar", name: "تقويم P6 XML — يحتاج مراجعة" },
      source: "p6-xml",
      importNotes: warnings,
      wbsNodes,
      resourceAssignments,
    },
    summary: { projectName: name, activitiesRead: activities.length, relationshipsRead: relationships.length, wbsRead: wbsNodes.length, resourcesRead: resourceElements.length, resourceAssignmentsRead: resourceAssignments.length, assignmentsWithCosts: resourceAssignments.filter((assignment) => Boolean(assignment.targetCost || assignment.remainingCost || assignment.actualRegularCost || assignment.actualOvertimeCost)).length, activitiesWithProgress: activities.filter((activity) => activity.percentComplete !== undefined).length, warnings },
  };
}
