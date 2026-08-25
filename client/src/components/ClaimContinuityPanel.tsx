import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, GitBranch, GitCompareArrows, LogIn, PlusCircle, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import type { AnalysisWindow, Fragnet, Schedule } from "@/lib/cpm";
import "./claim-continuity.css";

type View = "guided" | "overview" | "schedule" | "quality" | "event" | "analysis" | "report" | "windows" | "methods" | "financial" | "notices" | "review" | "members" | "compare" | "resources" | "learning" | "issues";
type Responsibility = "employer" | "contractor" | "neutral" | "mixed" | "undetermined";
type Treatment = "unresolved" | "separate" | "absorbed" | "apportioned";

const keyPart = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);

function interfaceCopy(language: "ar" | "en") {
  if (language === "en") {
    return {
      heading: "Continuous claims & concurrent delays",
      continuityEyebrow: "CONTINUOUS CLAIMS · CONCURRENCY LOG",
      description: "Each new claim inherits the preceding claim reference and analysis period, then links its notices, report, and review path. The concurrency log is a technical review record, not an entitlement decision.",
      login: "Sign in to save the claim chain and concurrency log privately and securely.",
      signIn: "Sign in",
      chainLog: "Chain record",
      claims: (count: number) => `${count} claim${count === 1 ? "" : "s"}`,
      loading: "Loading record…",
      noStart: "No start date",
      open: "Open",
      extension: "Extension of a previous claim",
      chainStart: "Start of the chain",
      noClaims: "No saved claim yet. Create the first claim after confirming the programme version and data cut-off point.",
      newClaim: "New claim",
      linksLast: "Links to the latest claim",
      claimTitle: "Claim title",
      claimTitlePlaceholder: "Example: April 2026 update claim",
      claimKey: "Claim key",
      periodStart: "Period start",
      periodEnd: "Period end",
      position: "Preliminary technical position (optional)",
      positionPlaceholder: "Request scope or analysis limits without making a legal entitlement finding…",
      create: "Create consecutive claim",
      created: "Consecutive claim created and linked automatically to the preceding record.",
      narrativeSaved: "The unified claim narrative has been updated.",
      concurrencySaved: "The concurrency record has been saved for technical and contractual review.",
      activeClaim: "Active claim:",
      activeDescription: "Every Notice draft, review, and export now links to this claim. Select another chain record when working on a different period.",
      narrative: "Unified narrative & Notice of Claim template",
      beforeExport: "Updated before export",
      updateNarrative: "Update narrative and send it for review",
      concurrentDelays: "CONCURRENT DELAYS",
      concurrencyTitle: "Record concurrency within this claim",
      window: "Reference TIA window:",
      noWindow: "No analysis window selected",
      primaryEvent: "Primary event",
      concurrentEvent: "Concurrent event",
      selectEvent: "Select event",
      overlapStart: "Overlap start",
      overlapEnd: "Overlap end",
      apparentResponsibility: "Apparent responsibility",
      treatment: "Analysis treatment",
      notes: "Technical basis and concurrency limits",
      notesPlaceholder: "Describe the concurrency data source, path or window, and result limitations…",
      notice: "Apparent responsibility or recorded treatment is not an automatic legal admission; planning and contracts teams must review it.",
      saveConcurrency: "Save concurrency record",
      noConcurrency: "No concurrency record exists for this claim yet.",
      responsibilityLabels: { undetermined: "Undetermined", employer: "Employer", contractor: "Contractor", neutral: "Neutral", mixed: "Mixed" } satisfies Record<Responsibility, string>,
      treatmentLabels: { unresolved: "Under assessment", separate: "Separate impact", absorbed: "Absorbed in path", apportioned: "Apportioned impact" } satisfies Record<Treatment, string>,
    };
  }

  return {
    heading: "سلسلة المطالبات والتأخيرات المتزامنة",
    continuityEyebrow: "سلسلة المطالبات · سجل التزامن",
    description: "كل مطالبة جديدة ترث مرجع المطالبة السابقة وفترة التحليل، ثم تربط Notices والتقرير ومسار المراجعة بها. سجل التزامن وثيقة فنية للمراجعة وليس قرار استحقاق.",
    login: "سجّل الدخول لحفظ سلسلة المطالبات وسجل التزامن بصورة خاصة وآمنة.",
    signIn: "تسجيل الدخول",
    chainLog: "سجل السلسلة",
    claims: (count: number) => `${count} مطالبة`,
    loading: "جار تحميل السجل…",
    noStart: "دون بداية",
    open: "مفتوحة",
    extension: "امتداد لمطالبة سابقة",
    chainStart: "بداية السلسلة",
    noClaims: "لا توجد مطالبة محفوظة. أنشئ أول مطالبة بعد تثبيت نسخة البرنامج ونقطة قطع البيانات.",
    newClaim: "مطالبة جديدة",
    linksLast: "يربطها النظام بآخر مطالبة",
    claimTitle: "عنوان المطالبة",
    claimTitlePlaceholder: "مثال: مطالبة تحديث أبريل 2026",
    claimKey: "مفتاح المطالبة",
    periodStart: "بداية الفترة",
    periodEnd: "نهاية الفترة",
    position: "موقف فني مبدئي (اختياري)",
    positionPlaceholder: "نطاق الطلب أو حدود التحليل دون تقرير استحقاق قانوني…",
    create: "إنشاء مطالبة متتابعة",
    created: "تم إنشاء مطالبة متتابعة وربطها تلقائياً بالسجل السابق.",
    narrativeSaved: "تم تحديث السرد الموحد للمطالبة.",
    concurrencySaved: "تم حفظ سجل التزامن للمراجعة الفنية والتعاقدية.",
    activeClaim: "المطالبة النشطة:",
    activeDescription: "ترتبط الآن كل مسودة Notice ومراجعة وتصدير بهذه المطالبة. غيّرها من سجل السلسلة عند العمل على فترة أخرى.",
    narrative: "السرد الموحد ونموذج Notice of Claim",
    beforeExport: "يُحدّث قبل التصدير",
    updateNarrative: "تحديث السرد وإحالته للمراجعة",
    concurrentDelays: "التأخيرات المتزامنة",
    concurrencyTitle: "توثيق التزامن ضمن هذه المطالبة",
    window: "نافذة TIA المرجعية:",
    noWindow: "لم تُحدد نافذة تحليل",
    primaryEvent: "الحدث الأول",
    concurrentEvent: "الحدث المتزامن",
    selectEvent: "اختر الحدث",
    overlapStart: "بداية التداخل",
    overlapEnd: "نهاية التداخل",
    apparentResponsibility: "المسؤولية الظاهرة",
    treatment: "معالجة التحليل",
    notes: "سبب فني وحدود التزامن",
    notesPlaceholder: "اشرح مصدر بيانات التزامن، المسار أو النافذة، وحدود النتيجة…",
    notice: "لا تعني المسؤولية الظاهرة أو المعالجة المسجلة إقراراً قانونياً تلقائياً؛ يراجعها فريق التخطيط والعقود.",
    saveConcurrency: "حفظ سجل التزامن",
    noConcurrency: "لا يوجد سجل تزامن لهذه المطالبة بعد.",
    responsibilityLabels: { undetermined: "غير محددة", employer: "صاحب العمل", contractor: "المقاول", neutral: "محايدة", mixed: "مختلطة" } satisfies Record<Responsibility, string>,
    treatmentLabels: { unresolved: "قيد التقييم", separate: "فصل الأثر", absorbed: "امتصاص ضمن المسار", apportioned: "توزيع للأثر" } satisfies Record<Treatment, string>,
  };
}

export function ClaimContinuityPanel({ view, schedule, events, selectedWindow, isAuthenticated, onActiveClaimChange }: { view: View; schedule: Schedule; events: Fragnet[]; selectedWindow: AnalysisWindow | null; isAuthenticated: boolean; onActiveClaimChange: (claimKey: string, narrative: string) => void }) {
  const { language, direction } = useAppLanguage();
  const copy = interfaceCopy(language);
  const dateLocale = language === "en" ? "en-GB" : "ar-EG";
  const formatDate = (value: Date | string) => new Date(value).toLocaleDateString(dateLocale, { timeZone: "UTC" });
  const projectInput = useMemo(() => ({ projectKey: schedule.id }), [schedule.id]);
  const continuity = trpc.claimContinuity.list.useQuery(projectInput, { enabled: isAuthenticated && (view === "notices" || view === "review") });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [claimKey, setClaimKey] = useState("");
  const [from, setFrom] = useState(schedule.dataDate || schedule.startDate);
  const [to, setTo] = useState("");
  const [position, setPosition] = useState("");
  const [primaryEvent, setPrimaryEvent] = useState("");
  const [concurrentEvent, setConcurrentEvent] = useState("");
  const [overlapStart, setOverlapStart] = useState(schedule.dataDate || schedule.startDate);
  const [overlapEnd, setOverlapEnd] = useState("");
  const [responsibility, setResponsibility] = useState<Responsibility>("undetermined");
  const [treatment, setTreatment] = useState<Treatment>("unresolved");
  const [notes, setNotes] = useState("");
  const create = trpc.claimContinuity.create.useMutation({ onSuccess: (record) => { continuity.refetch(); setActiveId(record.id); toast.success(copy.created); } });
  const saveNarrative = trpc.claimContinuity.updateNarrative.useMutation({ onSuccess: () => { continuity.refetch(); toast.success(copy.narrativeSaved); } });
  const addConcurrency = trpc.claimContinuity.addConcurrency.useMutation({ onSuccess: () => { continuity.refetch(); setNotes(""); toast.success(copy.concurrencySaved); } });
  const chains = continuity.data?.chains ?? [];
  const active = chains.find(item => item.id === activeId) ?? chains[0] ?? null;
  const activeConcurrency = (continuity.data?.concurrency ?? []).filter(item => item.claimChainId === active?.id);

  useEffect(() => { if (active) onActiveClaimChange(active.claimKey, active.unifiedNarrative); else onActiveClaimChange(`${schedule.id}:delay-claim`, ""); }, [active?.id, active?.claimKey, active?.unifiedNarrative, onActiveClaimChange, schedule.id]);
  useEffect(() => { setFrom(schedule.dataDate || schedule.startDate); }, [schedule.dataDate, schedule.startDate]);

  if (view !== "notices" && view !== "review") return null;

  return <section className="claim-continuity-panel" dir={direction}>
    <div className="claim-continuity-heading"><div><p className="eyebrow">{copy.continuityEyebrow}</p><h2>{copy.heading}</h2><p>{copy.description}</p></div><GitBranch size={24} /></div>
    {!isAuthenticated ? <div className="claim-continuity-login"><LogIn size={18} /><span>{copy.login}</span><Button className="run-button" onClick={startLogin}>{copy.signIn}</Button></div> : <>
      <div className="claim-continuity-grid"><div className="claim-chain-list"><div className="claim-chain-list__title"><b>{copy.chainLog}</b><span>{copy.claims(chains.length)}</span></div>{continuity.isLoading ? <p>{copy.loading}</p> : chains.length ? chains.map(item => <button type="button" key={item.id} className={active?.id === item.id ? "claim-chain-card active" : "claim-chain-card"} onClick={() => setActiveId(item.id)}><span dir="ltr">#{item.claimKey}</span><b>{item.title}</b><small>{item.periodStart ? formatDate(item.periodStart) : copy.noStart} — {item.periodEnd ? formatDate(item.periodEnd) : copy.open}</small>{item.parentClaimId ? <em>{copy.extension}</em> : <em>{copy.chainStart}</em>}</button>) : <p className="claim-empty">{copy.noClaims}</p>}</div>
        <div className="claim-create-form"><div className="claim-chain-list__title"><b>{copy.newClaim}</b><span>{copy.linksLast}</span></div><div><Label>{copy.claimTitle}</Label><Input value={title} onChange={event => { setTitle(event.target.value); if (!claimKey) setClaimKey(`CLM-${keyPart(event.target.value).toUpperCase()}`); }} placeholder={copy.claimTitlePlaceholder} /></div><div><Label>{copy.claimKey}</Label><Input dir="ltr" value={claimKey} onChange={event => setClaimKey(keyPart(event.target.value).toUpperCase())} placeholder="CLM-APR-2026" /></div><div className="claim-two"><div><Label>{copy.periodStart}</Label><Input type="date" dir="ltr" value={from} onChange={event => setFrom(event.target.value)} /></div><div><Label>{copy.periodEnd}</Label><Input type="date" dir="ltr" value={to} onChange={event => setTo(event.target.value)} /></div></div><div><Label>{copy.position}</Label><Textarea rows={2} value={position} onChange={event => setPosition(event.target.value)} placeholder={copy.positionPlaceholder} /></div><Button className="run-button" disabled={create.isPending || !title.trim() || !claimKey} onClick={() => create.mutate({ projectKey: schedule.id, claimKey, title: title.trim(), periodStart: from || null, periodEnd: to || null, analystPosition: position || undefined })}><PlusCircle size={16} />{copy.create}</Button></div></div>
      {active ? <><div className="claim-active-summary"><ShieldCheck size={18} /><div><b>{copy.activeClaim} <span dir="ltr">{active.claimKey}</span> — {active.title}</b><span>{copy.activeDescription}</span></div></div><div className="claim-narrative-card"><div className="claim-chain-list__title"><b>{copy.narrative}</b><span>{copy.beforeExport}</span></div><Textarea className="claim-narrative-text" rows={14} value={active.unifiedNarrative} readOnly /><Button variant="outline" disabled={saveNarrative.isPending} onClick={() => saveNarrative.mutate({ id: active.id, analystPosition: position || undefined, status: "under_review" })}><Save size={16} />{copy.updateNarrative}</Button></div><div className="concurrency-card"><div className="claim-continuity-heading compact"><div><p className="eyebrow">{copy.concurrentDelays}</p><h3>{copy.concurrencyTitle}</h3></div><GitCompareArrows size={21} /></div><p className="analysis-window-reference">{copy.window} <b>{selectedWindow ? `${selectedWindow.id} — ${selectedWindow.name}` : copy.noWindow}</b></p><div className="concurrency-form"><div><Label>{copy.primaryEvent}</Label><Select value={primaryEvent || "none"} onValueChange={value => setPrimaryEvent(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder={copy.selectEvent} /></SelectTrigger><SelectContent><SelectItem value="none">{copy.selectEvent}</SelectItem>{events.map(event => <SelectItem key={event.id} value={event.id}>{event.id} — {event.title}</SelectItem>)}</SelectContent></Select></div><div><Label>{copy.concurrentEvent}</Label><Select value={concurrentEvent || "none"} onValueChange={value => setConcurrentEvent(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder={copy.selectEvent} /></SelectTrigger><SelectContent><SelectItem value="none">{copy.selectEvent}</SelectItem>{events.map(event => <SelectItem key={event.id} value={event.id}>{event.id} — {event.title}</SelectItem>)}</SelectContent></Select></div><div><Label>{copy.overlapStart}</Label><Input type="date" dir="ltr" value={overlapStart} onChange={event => setOverlapStart(event.target.value)} /></div><div><Label>{copy.overlapEnd}</Label><Input type="date" dir="ltr" value={overlapEnd} onChange={event => setOverlapEnd(event.target.value)} /></div><div><Label>{copy.apparentResponsibility}</Label><Select value={responsibility} onValueChange={value => setResponsibility(value as Responsibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(copy.responsibilityLabels) as Responsibility[]).map(value => <SelectItem key={value} value={value}>{copy.responsibilityLabels[value]}</SelectItem>)}</SelectContent></Select></div><div><Label>{copy.treatment}</Label><Select value={treatment} onValueChange={value => setTreatment(value as Treatment)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(copy.treatmentLabels) as Treatment[]).map(value => <SelectItem key={value} value={value}>{copy.treatmentLabels[value]}</SelectItem>)}</SelectContent></Select></div><div className="concurrency-wide"><Label>{copy.notes}</Label><Textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} placeholder={copy.notesPlaceholder} /></div></div><div className="workflow-footer"><p><AlertTriangle size={15} /> {copy.notice}</p><Button className="run-button" disabled={addConcurrency.isPending || !selectedWindow || !primaryEvent || !concurrentEvent || !overlapStart || !overlapEnd || notes.trim().length < 5} onClick={() => selectedWindow && addConcurrency.mutate({ projectKey: schedule.id, claimChainId: active.id, analysisWindowKey: selectedWindow.id, primaryEventKey: primaryEvent, concurrentEventKey: concurrentEvent, overlapStart, overlapEnd, responsibility, treatment, notes: notes.trim() })}>{copy.saveConcurrency}</Button></div>{activeConcurrency.length ? <div className="concurrency-records">{activeConcurrency.map(record => <div key={record.id}><b dir="ltr">{record.primaryEventKey} × {record.concurrentEventKey}</b><span>{copy.window} <span dir="ltr">{record.analysisWindowKey}</span> · {formatDate(record.overlapStart)} — {formatDate(record.overlapEnd)}</span><small>{copy.responsibilityLabels[record.responsibility as Responsibility] ?? record.responsibility} · {copy.treatmentLabels[record.treatment as Treatment] ?? record.treatment} · {record.notes}</small></div>)}</div> : <p className="claim-empty">{copy.noConcurrency}</p>}</div></> : null}</>}
  </section>;
}
