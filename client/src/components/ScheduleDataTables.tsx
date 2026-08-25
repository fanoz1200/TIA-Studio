import React, { useMemo, useState } from "react";
import { ArrowDownUp, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppLanguage } from "@/contexts/LanguageContext";
import type { Relationship, runCPM } from "@/lib/cpm";

type CalculatedActivity = ReturnType<typeof runCPM>["activities"][number];
type Direction = "asc" | "desc";
type ActivitySortKey = "id" | "name" | "wbs" | "duration" | "float" | "critical";
type RelationshipSortKey = "id" | "predecessor" | "successor" | "type";

const tableCopy = {
  ar: {
    activityTitle: "تفصيل الأنشطة", baselineActivityTitle: "أنشطة البرنامج والعائمة", impactedActivityTitle: "تفصيل العائمة والمسار بعد الإدراج", activityEyebrow: "بيانات الأنشطة القابلة للفلترة", relationshipTitle: "العلاقات المنطقية", relationshipEyebrow: "العلاقات المنطقية", noWbs: "بدون WBS",
    activitySearch: "ابحث في الأنشطة", activitySearchPlaceholder: "ابحث بالمعرف أو الاسم أو WBS", filterWbs: "فلترة الأنشطة حسب WBS", allWbs: "كل WBS",
    filterKind: "فلترة الأنشطة حسب النوع", allKinds: "كل الأنواع", base: "أساس", filterCriticality: "فلترة الأنشطة حسب الحرجية", allPaths: "كل المسارات", critical: "حرج", nonCritical: "غير حرج", clear: "مسح",
    activities: "نشاط", relationships: "علاقة", sortHint: "اضغط عنوان العمود للترتيب", activityTable: "جدول الأنشطة", relationshipTable: "جدول العلاقات المنطقية",
    id: "المعرف", activity: "النشاط", kind: "النوع", duration: "المدة", path: "المسار", relationshipSearch: "ابحث في العلاقات", relationshipSearchPlaceholder: "ابحث بالمعرف أو النشاط أو نوع العلاقة", filterRelationshipType: "فلترة العلاقات حسب النوع", allTypes: "كل الأنواع", predecessor: "السابق", successor: "اللاحق", unreadActivity: "نشاط غير مقروء",
    noActivities: "مفيش نشاط مطابق للفلاتر الحالية. جرّب تمسح الفلاتر.", noRelationships: "مفيش علاقة مطابقة للفلاتر الحالية.", sortBy: "رتّب حسب", dayAbbreviation: "يوم",
  },
  en: {
    activityTitle: "Activity details", baselineActivityTitle: "Baseline activities and float", impactedActivityTitle: "Float and path after insertion", activityEyebrow: "Filterable activity data", relationshipTitle: "Logic relationships", relationshipEyebrow: "Logic relationships", noWbs: "No WBS",
    activitySearch: "Search activities", activitySearchPlaceholder: "Search by ID, name, or WBS", filterWbs: "Filter activities by WBS", allWbs: "All WBS",
    filterKind: "Filter activities by type", allKinds: "All types", base: "Base", filterCriticality: "Filter activities by criticality", allPaths: "All paths", critical: "Critical", nonCritical: "Non-critical", clear: "Clear",
    activities: "activities", relationships: "relationships", sortHint: "Select a column heading to sort", activityTable: "Activity table", relationshipTable: "Logic relationships table",
    id: "ID", activity: "Activity", kind: "Type", duration: "Duration", path: "Path", relationshipSearch: "Search relationships", relationshipSearchPlaceholder: "Search by ID, activity, or relationship type", filterRelationshipType: "Filter relationships by type", allTypes: "All types", predecessor: "Predecessor", successor: "Successor", unreadActivity: "Unread activity",
    noActivities: "No activity matches the current filters. Try clearing the filters.", noRelationships: "No relationship matches the current filters.", sortBy: "Sort by", dayAbbreviation: "d",
  },
} as const;

type ActivityTableTitleKey = "baselineActivityTitle" | "impactedActivityTitle";

function order<T>(
  rows: T[],
  getValue: (row: T) => string | number | boolean,
  direction: Direction
) {
  return [...rows].sort((left, right) => {
    const a = getValue(left);
    const b = getValue(right);
    const compared =
      typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), "ar", { numeric: true });
    return direction === "asc" ? compared : -compared;
  });
}

function resultLabel(visible: number, total: number, noun: string, language: "ar" | "en") {
  return language === "en"
    ? (visible === total ? `${total} ${noun}` : `${visible} of ${total} ${noun}`)
    : (visible === total ? `${total} ${noun}` : `${visible} من ${total} ${noun}`);
}

export function ActivityDataTable({
  activities,
  title,
  titleKey,
}: {
  activities: CalculatedActivity[];
  title?: string;
  titleKey?: ActivityTableTitleKey;
}) {
  const { language, direction } = useAppLanguage();
  const t = tableCopy[language];
  // `title` is deliberately left untouched: callers may pass a user-created or source title.
  // The optional key is reserved for the two known, application-owned Home titles.
  const activityTitle = titleKey ? t[titleKey] : title ?? t.activityTitle;
  const [search, setSearch] = useState("");
  const [wbs, setWbs] = useState("all");
  const [kind, setKind] = useState<"all" | "base" | "fragnet">("all");
  const [criticality, setCriticality] = useState<
    "all" | "critical" | "non-critical"
  >("all");
  const [sort, setSort] = useState<{ key: ActivitySortKey; direction: Direction }>(
    { key: "id", direction: "asc" }
  );

  const wbsOptions = useMemo(
    () =>
      Array.from(
        new Set(activities.map(activity => activity.wbs?.trim() || t.noWbs))
      ).sort((a, b) => a.localeCompare(b, "ar", { numeric: true })),
    [activities, t.noWbs]
  );

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(language);
    const filtered = activities.filter(activity => {
      const activityWbs = activity.wbs?.trim() || t.noWbs;
      const matchesQuery = !query ||
        `${activity.id} ${activity.name} ${activityWbs} ${activity.owner ?? ""}`
          .toLocaleLowerCase(language)
          .includes(query);
      const matchesWbs = wbs === "all" || activityWbs === wbs;
      const matchesKind = kind === "all" ||
        (kind === "fragnet" ? activity.kind === "fragnet" : activity.kind !== "fragnet");
      const matchesCriticality = criticality === "all" ||
        (criticality === "critical" ? activity.isCritical : !activity.isCritical);
      return matchesQuery && matchesWbs && matchesKind && matchesCriticality;
    });

    return order(
      filtered,
      activity => {
        if (sort.key === "duration") return activity.duration;
        if (sort.key === "float") return activity.totalFloat;
        if (sort.key === "critical") return activity.isCritical;
        if (sort.key === "wbs") return activity.wbs?.trim() || t.noWbs;
        return activity[sort.key];
      },
      sort.direction
    );
  }, [activities, criticality, kind, language, search, sort, t.noWbs, wbs]);

  function updateSort(key: ActivitySortKey) {
    setSort(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function reset() {
    setSearch("");
    setWbs("all");
    setKind("all");
    setCriticality("all");
    setSort({ key: "id", direction: "asc" });
  }

  const sortState = (key: ActivitySortKey) =>
    sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const sortButton = (key: ActivitySortKey, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-bold hover:text-[#0f607c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f607c]"
      onClick={() => updateSort(key)}
      aria-label={`${t.sortBy} ${label}`}
    >
      {label}
      <ArrowDownUp size={14} aria-hidden="true" />
    </button>
  );

  return (
    <section className="panel result-table-panel" aria-labelledby="activity-data-title" dir={direction}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t.activityEyebrow}</p>
          <h2 id="activity-data-title">{activityTitle}</h2>
        </div>
        <span className="legend-note">
          <i className="legend-fragnet" />
          Fragnet
        </span>
      </div>
      <div className="grid gap-3 rounded-xl border border-[#dbe5eb] bg-[#f7fafb] p-3 md:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(9rem,1fr))_auto]">
        <div className="relative">
          <Label htmlFor="activity-table-search" className="sr-only">{t.activitySearch}</Label>
          <Search className={`pointer-events-none absolute top-3 text-[#61808f] ${direction === "rtl" ? "right-3" : "left-3"}`} size={17} aria-hidden="true" />
          <Input
            id="activity-table-search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t.activitySearchPlaceholder}
            className={direction === "rtl" ? "bg-white pr-10" : "bg-white pl-10"}
          />
        </div>
        <Select value={wbs} onValueChange={setWbs}>
          <SelectTrigger aria-label={t.filterWbs} className="bg-white">
            <SelectValue placeholder={t.allWbs} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allWbs}</SelectItem>
            {wbsOptions.map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={value => setKind(value as typeof kind)}>
          <SelectTrigger aria-label={t.filterKind} className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allKinds}</SelectItem>
            <SelectItem value="base">{t.base}</SelectItem>
            <SelectItem value="fragnet">Fragnet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={criticality} onValueChange={value => setCriticality(value as typeof criticality)}>
          <SelectTrigger aria-label={t.filterCriticality} className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allPaths}</SelectItem>
            <SelectItem value="critical">{t.critical}</SelectItem>
            <SelectItem value="non-critical">{t.nonCritical}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" className="outline-action whitespace-nowrap" onClick={reset}>
          <RotateCcw size={15} />
          {t.clear}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#58707d]">
        <span role="status" aria-live="polite">{resultLabel(rows.length, activities.length, t.activities, language)}</span>
        <span>{t.sortHint}</span>
      </div>
      <div className="activity-table-wrap mt-3">
        <table className="activity-table" aria-label={t.activityTable}>
          <thead>
            <tr>
              <th aria-sort={sortState("id")}>{sortButton("id", t.id)}</th>
              <th aria-sort={sortState("name")}>{sortButton("name", t.activity)}</th>
              <th aria-sort={sortState("wbs")}>{sortButton("wbs", "WBS")}</th>
              <th>{t.kind}</th>
              <th aria-sort={sortState("duration")}>{sortButton("duration", t.duration)}</th>
              <th>ES / EF</th>
              <th aria-sort={sortState("float")}>{sortButton("float", "TF")}</th>
              <th aria-sort={sortState("critical")}>{sortButton("critical", t.path)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(activity => (
              <tr key={activity.id} className={activity.kind === "fragnet" ? "fragnet-row" : activity.isCritical ? "critical-row" : ""}>
                <td dir="ltr"><b>{activity.id}</b></td>
                <td>{activity.name}</td>
                <td dir="ltr">{activity.wbs || "—"}</td>
                <td>{activity.kind === "fragnet" ? <Badge className="badge-fragnet">Fragnet</Badge> : <Badge className="badge-muted">{t.base}</Badge>}</td>
                <td dir="ltr">{activity.duration} {t.dayAbbreviation}</td>
                <td dir="ltr">{activity.earlyStart} / {activity.earlyFinish}</td>
                <td dir="ltr">{activity.totalFloat}</td>
                <td>{activity.isCritical ? <Badge className="badge-delay">{t.critical}</Badge> : <Badge className="badge-muted">{t.nonCritical}</Badge>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-[#667b87]">{t.noActivities}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RelationshipDataTable({
  relationships,
  activities,
}: {
  relationships: Relationship[];
  activities: CalculatedActivity[];
}) {
  const { language, direction } = useAppLanguage();
  const t = tableCopy[language];
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<{ key: RelationshipSortKey; direction: Direction }>({ key: "id", direction: "asc" });
  const activityNames = useMemo(() => new Map(activities.map(activity => [activity.id, activity.name])), [activities]);
  const relationshipTypes = useMemo(() => Array.from(new Set(relationships.map(item => item.type))).sort(), [relationships]);
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(language);
    const filtered = relationships.filter(item => {
      const text = `${item.id} ${item.predecessorId} ${activityNames.get(item.predecessorId) ?? ""} ${item.successorId} ${activityNames.get(item.successorId) ?? ""} ${item.type}`.toLocaleLowerCase(language);
      return (!query || text.includes(query)) && (type === "all" || item.type === type);
    });
    return order(filtered, item => {
      if (sort.key === "predecessor") return item.predecessorId;
      if (sort.key === "successor") return item.successorId;
      return item[sort.key];
    }, sort.direction);
  }, [activityNames, language, relationships, search, sort, type]);
  const updateSort = (key: RelationshipSortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const reset = () => { setSearch(""); setType("all"); setSort({ key: "id", direction: "asc" }); };
  const sortState = (key: RelationshipSortKey) => sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const header = (key: RelationshipSortKey, label: string) => <button type="button" className="inline-flex items-center gap-1 font-bold hover:text-[#0f607c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f607c]" onClick={() => updateSort(key)} aria-label={`${t.sortBy} ${label}`}>{label}<ArrowDownUp size={14} aria-hidden="true" /></button>;

  return (
    <section className="panel result-table-panel" aria-labelledby="relationship-data-title" dir={direction}>
      <div className="panel-heading"><div><p className="eyebrow">{t.relationshipEyebrow}</p><h2 id="relationship-data-title">{t.relationshipTitle}</h2></div></div>
      <div className="grid gap-3 rounded-xl border border-[#dbe5eb] bg-[#f7fafb] p-3 md:grid-cols-[minmax(16rem,1fr)_14rem_auto]">
        <div className="relative"><Label htmlFor="relationship-table-search" className="sr-only">{t.relationshipSearch}</Label><Search className={`pointer-events-none absolute top-3 text-[#61808f] ${direction === "rtl" ? "right-3" : "left-3"}`} size={17} aria-hidden="true" /><Input id="relationship-table-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t.relationshipSearchPlaceholder} className={direction === "rtl" ? "bg-white pr-10" : "bg-white pl-10"} /></div>
        <Select value={type} onValueChange={setType}><SelectTrigger aria-label={t.filterRelationshipType} className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.allTypes}</SelectItem>{relationshipTypes.map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Button type="button" variant="outline" className="outline-action whitespace-nowrap" onClick={reset}><RotateCcw size={15} />{t.clear}</Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#58707d]"><span role="status" aria-live="polite">{resultLabel(rows.length, relationships.length, t.relationships, language)}</span><span>{t.sortHint}</span></div>
      <div className="activity-table-wrap mt-3"><table className="activity-table" aria-label={t.relationshipTable}><thead><tr><th aria-sort={sortState("id")}>{header("id", t.id)}</th><th aria-sort={sortState("predecessor")}>{header("predecessor", t.predecessor)}</th><th aria-sort={sortState("successor")}>{header("successor", t.successor)}</th><th aria-sort={sortState("type")}>{header("type", t.kind)}</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td dir="ltr"><b>{item.id}</b></td><td><b dir="ltr">{item.predecessorId}</b><small className="block text-[#667b87]">{activityNames.get(item.predecessorId) ?? t.unreadActivity}</small></td><td><b dir="ltr">{item.successorId}</b><small className="block text-[#667b87]">{activityNames.get(item.successorId) ?? t.unreadActivity}</small></td><td dir="ltr"><Badge className="badge-muted">{item.type}</Badge></td></tr>)}{!rows.length && <tr><td colSpan={4} className="py-8 text-center text-[#667b87]">{t.noRelationships}</td></tr>}</tbody></table></div>
    </section>
  );
}
