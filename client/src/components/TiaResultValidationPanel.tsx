import { AlertTriangle, CheckCircle2, CircleX, Info, ShieldCheck } from "lucide-react";
import React from "react";
import { Input } from "@/components/ui/input";
import { useAppLanguage } from "@/contexts/LanguageContext";
import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "@/lib/cpm";
import { evaluateTiaResultQuality } from "@/lib/tia-result-validation";

type Props = {
  schedule: Schedule;
  selectedEvent: Fragnet | null;
  activeResult: TiaResult | WindowTiaResult | null;
  analystExpectedDays: string;
  onAnalystExpectedDaysChange: (value: string) => void;
};

export function TiaResultValidationPanel({ schedule, selectedEvent, activeResult, analystExpectedDays, onAnalystExpectedDaysChange }: Props) {
  const { language, direction } = useAppLanguage();
  const txt = (ar: string, en: string) => language === "en" ? en : ar;
  const expected = analystExpectedDays.trim() === "" ? null : Number(analystExpectedDays);
  const quality = evaluateTiaResultQuality({ schedule, selectedEvent, analysis: activeResult, analystExpectedDays: Number.isFinite(expected) ? expected : null });
  const icon = (state: "pass" | "warning" | "rejected" | "info") => state === "pass" ? <CheckCircle2 size={17} /> : state === "rejected" ? <CircleX size={17} /> : state === "warning" ? <AlertTriangle size={17} /> : <Info size={17} />;
  const workflowClass = quality.state === "accepted" ? "pass" : quality.state === "rejected" ? "blocked" : "attention";
  const decision = quality.state === "accepted" ? txt("مقبولة آلياً", "Accepted automatically") : quality.state === "rejected" ? txt("مرفوضة آلياً", "Rejected automatically") : txt("قبول مشروط", "Conditional acceptance");

  return <section className="workflow-quality-gate result-validation-gate" dir={direction} aria-label={txt("لوحة تحقق نتيجة TIA", "TIA result validation")}>
    <header><div><p className="eyebrow">TIA RESULT VALIDATION</p><h3>{txt("لوحة تحقق النتيجة وقواعد القرار", "Result validation and decision rules")}</h3></div><span className={`result-validation-decision ${workflowClass}`}>{quality.state === "accepted" ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}{decision}</span></header>
    <p className="result-validation-summary" dir="auto">{quality.summary}</p>
    <div className="result-validation-input"><label htmlFor="analyst-expected-impact">{txt("تقدير المحلل (أيام عمل، اختياري)", "Analyst estimate (working days, optional)")}</label><Input id="analyst-expected-impact" type="number" min="0" step="1" dir="ltr" value={analystExpectedDays} onChange={(event) => onAnalystExpectedDaysChange(event.target.value)} placeholder={txt("مثال: 6", "Example: 6")} /><small>{txt("للمقارنة فقط؛ لا يغيّر CPM أو قيمة الأثر المحسوبة.", "For comparison only; it does not change CPM or the calculated impact.")}</small></div>
    {quality.analystExpectedDays !== null && <div className="result-validation-metrics"><span>{txt("المحرك", "Engine")} <b dir="ltr">{quality.impactDays ?? 0} d</b></span><span>{txt("تقدير المحلل", "Analyst estimate")} <b dir="ltr">{quality.analystExpectedDays} d</b></span><span>{txt("الانحراف", "Deviation")} <b dir="ltr">{quality.deviationDays ?? 0} d</b></span><span>{txt("السماحية", "Tolerance")} <b dir="ltr">±{quality.toleranceDays ?? 0} d</b></span></div>}
    <div className="workflow-check-grid">{quality.checks.map((check) => <article key={check.id} className={`workflow-check workflow-check-${check.state === "pass" ? "pass" : check.state === "rejected" ? "blocked" : check.state === "warning" ? "attention" : "info"}`}><b aria-hidden="true">{icon(check.state)}</b><div dir="auto"><h4>{check.title}</h4><p>{check.detail}</p></div></article>)}</div>
  </section>;
}
