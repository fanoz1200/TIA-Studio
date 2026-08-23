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
import type { Relationship, runCPM } from "@/lib/cpm";

type CalculatedActivity = ReturnType<typeof runCPM>["activities"][number];
type Direction = "asc" | "desc";
type ActivitySortKey = "id" | "name" | "wbs" | "duration" | "float" | "critical";
type RelationshipSortKey = "id" | "predecessor" | "successor" | "type";

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

function resultLabel(visible: number, total: number, noun: string) {
  return visible === total ? `${total} ${noun}` : `${visible} من ${total} ${noun}`;
}

export function ActivityDataTable({
  activities,
  title = "تفصيل الأنشطة",
}: {
  activities: CalculatedActivity[];
  title?: string;
}) {
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
        new Set(activities.map(activity => activity.wbs?.trim() || "بدون WBS"))
      ).sort((a, b) => a.localeCompare(b, "ar", { numeric: true })),
    [activities]
  );

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    const filtered = activities.filter(activity => {
      const activityWbs = activity.wbs?.trim() || "بدون WBS";
      const matchesQuery = !query ||
        `${activity.id} ${activity.name} ${activityWbs} ${activity.owner ?? ""}`
          .toLocaleLowerCase("ar")
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
        if (sort.key === "wbs") return activity.wbs?.trim() || "بدون WBS";
        return activity[sort.key];
      },
      sort.direction
    );
  }, [activities, criticality, kind, search, sort, wbs]);

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
      aria-label={`رتّب حسب ${label}`}
    >
      {label}
      <ArrowDownUp size={14} aria-hidden="true" />
    </button>
  );

  return (
    <section className="panel result-table-panel" aria-labelledby="activity-data-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">FILTERABLE ACTIVITY DATA</p>
          <h2 id="activity-data-title">{title}</h2>
        </div>
        <span className="legend-note">
          <i className="legend-fragnet" />
          Fragnet
        </span>
      </div>
      <div className="grid gap-3 rounded-xl border border-[#dbe5eb] bg-[#f7fafb] p-3 md:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(9rem,1fr))_auto]">
        <div className="relative">
          <Label htmlFor="activity-table-search" className="sr-only">ابحث في الأنشطة</Label>
          <Search className="pointer-events-none absolute right-3 top-3 text-[#61808f]" size={17} aria-hidden="true" />
          <Input
            id="activity-table-search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث بالمعرف أو الاسم أو WBS"
            className="bg-white pr-10"
          />
        </div>
        <Select value={wbs} onValueChange={setWbs}>
          <SelectTrigger aria-label="فلترة الأنشطة حسب WBS" className="bg-white">
            <SelectValue placeholder="كل WBS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل WBS</SelectItem>
            {wbsOptions.map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={value => setKind(value as typeof kind)}>
          <SelectTrigger aria-label="فلترة الأنشطة حسب النوع" className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="base">أساس</SelectItem>
            <SelectItem value="fragnet">Fragnet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={criticality} onValueChange={value => setCriticality(value as typeof criticality)}>
          <SelectTrigger aria-label="فلترة الأنشطة حسب الحرجية" className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المسارات</SelectItem>
            <SelectItem value="critical">حرج</SelectItem>
            <SelectItem value="non-critical">غير حرج</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" className="outline-action whitespace-nowrap" onClick={reset}>
          <RotateCcw size={15} />
          مسح
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#58707d]">
        <span role="status" aria-live="polite">{resultLabel(rows.length, activities.length, "نشاط")}</span>
        <span>اضغط عنوان العمود للترتيب</span>
      </div>
      <div className="activity-table-wrap mt-3">
        <table className="activity-table" aria-label="جدول الأنشطة">
          <thead>
            <tr>
              <th aria-sort={sortState("id")}>{sortButton("id", "المعرف")}</th>
              <th aria-sort={sortState("name")}>{sortButton("name", "النشاط")}</th>
              <th aria-sort={sortState("wbs")}>{sortButton("wbs", "WBS")}</th>
              <th>النوع</th>
              <th aria-sort={sortState("duration")}>{sortButton("duration", "المدة")}</th>
              <th>ES / EF</th>
              <th aria-sort={sortState("float")}>{sortButton("float", "TF")}</th>
              <th aria-sort={sortState("critical")}>{sortButton("critical", "المسار")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(activity => (
              <tr key={activity.id} className={activity.kind === "fragnet" ? "fragnet-row" : activity.isCritical ? "critical-row" : ""}>
                <td dir="ltr"><b>{activity.id}</b></td>
                <td>{activity.name}</td>
                <td dir="ltr">{activity.wbs || "—"}</td>
                <td>{activity.kind === "fragnet" ? <Badge className="badge-fragnet">Fragnet</Badge> : <Badge className="badge-muted">أساس</Badge>}</td>
                <td dir="ltr">{activity.duration} d</td>
                <td dir="ltr">{activity.earlyStart} / {activity.earlyFinish}</td>
                <td dir="ltr">{activity.totalFloat}</td>
                <td>{activity.isCritical ? <Badge className="badge-delay">حرج</Badge> : <Badge className="badge-muted">غير حرج</Badge>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="py-8 text-center text-[#667b87]">مفيش نشاط مطابق للفلاتر الحالية. جرّب تمسح الفلاتر.</td></tr>}
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
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<{ key: RelationshipSortKey; direction: Direction }>({ key: "id", direction: "asc" });
  const activityNames = useMemo(() => new Map(activities.map(activity => [activity.id, activity.name])), [activities]);
  const relationshipTypes = useMemo(() => Array.from(new Set(relationships.map(item => item.type))).sort(), [relationships]);
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    const filtered = relationships.filter(item => {
      const text = `${item.id} ${item.predecessorId} ${activityNames.get(item.predecessorId) ?? ""} ${item.successorId} ${activityNames.get(item.successorId) ?? ""} ${item.type}`.toLocaleLowerCase("ar");
      return (!query || text.includes(query)) && (type === "all" || item.type === type);
    });
    return order(filtered, item => {
      if (sort.key === "predecessor") return item.predecessorId;
      if (sort.key === "successor") return item.successorId;
      return item[sort.key];
    }, sort.direction);
  }, [activityNames, relationships, search, sort, type]);
  const updateSort = (key: RelationshipSortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const reset = () => { setSearch(""); setType("all"); setSort({ key: "id", direction: "asc" }); };
  const sortState = (key: RelationshipSortKey) => sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const header = (key: RelationshipSortKey, label: string) => <button type="button" className="inline-flex items-center gap-1 font-bold hover:text-[#0f607c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f607c]" onClick={() => updateSort(key)} aria-label={`رتّب حسب ${label}`}>{label}<ArrowDownUp size={14} aria-hidden="true" /></button>;

  return (
    <section className="panel result-table-panel" aria-labelledby="relationship-data-title">
      <div className="panel-heading"><div><p className="eyebrow">LOGIC RELATIONSHIPS</p><h2 id="relationship-data-title">العلاقات المنطقية</h2></div></div>
      <div className="grid gap-3 rounded-xl border border-[#dbe5eb] bg-[#f7fafb] p-3 md:grid-cols-[minmax(16rem,1fr)_14rem_auto]">
        <div className="relative"><Label htmlFor="relationship-table-search" className="sr-only">ابحث في العلاقات</Label><Search className="pointer-events-none absolute right-3 top-3 text-[#61808f]" size={17} aria-hidden="true" /><Input id="relationship-table-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالمعرف أو النشاط أو نوع العلاقة" className="bg-white pr-10" /></div>
        <Select value={type} onValueChange={setType}><SelectTrigger aria-label="فلترة العلاقات حسب النوع" className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الأنواع</SelectItem>{relationshipTypes.map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Button type="button" variant="outline" className="outline-action whitespace-nowrap" onClick={reset}><RotateCcw size={15} />مسح</Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#58707d]"><span role="status" aria-live="polite">{resultLabel(rows.length, relationships.length, "علاقة")}</span><span>اضغط عنوان العمود للترتيب</span></div>
      <div className="activity-table-wrap mt-3"><table className="activity-table" aria-label="جدول العلاقات المنطقية"><thead><tr><th aria-sort={sortState("id")}>{header("id", "المعرف")}</th><th aria-sort={sortState("predecessor")}>{header("predecessor", "السابق")}</th><th aria-sort={sortState("successor")}>{header("successor", "اللاحق")}</th><th aria-sort={sortState("type")}>{header("type", "النوع")}</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td dir="ltr"><b>{item.id}</b></td><td><b dir="ltr">{item.predecessorId}</b><small className="block text-[#667b87]">{activityNames.get(item.predecessorId) ?? "نشاط غير مقروء"}</small></td><td><b dir="ltr">{item.successorId}</b><small className="block text-[#667b87]">{activityNames.get(item.successorId) ?? "نشاط غير مقروء"}</small></td><td dir="ltr"><Badge className="badge-muted">{item.type}</Badge></td></tr>)}{!rows.length && <tr><td colSpan={4} className="py-8 text-center text-[#667b87]">مفيش علاقة مطابقة للفلاتر الحالية.</td></tr>}</tbody></table></div>
    </section>
  );
}
