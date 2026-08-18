import type { Fragnet, Schedule, TiaResult, WindowTiaResult } from "./cpm";

export type TiaResultQualityState = "accepted" | "conditional" | "rejected";
export type TiaResultCheckState = "pass" | "warning" | "rejected" | "info";

export type TiaResultQualityCheck = {
  id: string;
  title: string;
  state: TiaResultCheckState;
  detail: string;
};

export type TiaResultQuality = {
  state: TiaResultQualityState;
  impactDays: number | null;
  analystExpectedDays: number | null;
  deviationDays: number | null;
  toleranceDays: number | null;
  checks: TiaResultQualityCheck[];
  summary: string;
};

type TiaResultQualityInput = {
  schedule: Schedule;
  selectedEvent: Fragnet | null;
  analysis: TiaResult | WindowTiaResult | null;
  analystExpectedDays?: number | null;
};

function impactDays(analysis: TiaResult | WindowTiaResult | null) {
  if (!analysis) return null;
  return "totalImpactDays" in analysis ? analysis.totalImpactDays : analysis.impactDays;
}

function eventDuration(event: Fragnet) {
  const splitEvent = event.activities.find((activity) => activity.id.endsWith("--event"));
  return splitEvent?.duration ?? event.activities.reduce((total, activity) => total + activity.duration, 0);
}

/**
 * فحص حوكمة مستقل عن الحساب: لا يعيد حساب CPM ولا يفصل الاستحقاق التعاقدي،
 * لكنه يلتقط الموانع والاختلافات التي يجب على المحلل مراجعتها قبل التقرير.
 */
export function evaluateTiaResultQuality(input: TiaResultQualityInput): TiaResultQuality {
  const computedImpact = impactDays(input.analysis);
  const expected = Number.isFinite(input.analystExpectedDays) ? Number(input.analystExpectedDays) : null;
  const tolerance = expected === null ? null : Math.max(1, Math.ceil(Math.abs(expected) * 0.1));
  const deviation = computedImpact === null || expected === null ? null : Math.abs(computedImpact - expected);

  if (!input.analysis) {
    const checks: TiaResultQualityCheck[] = [{
      id: "analysis",
      title: "نتيجة TIA قابلة للمراجعة",
      state: "rejected",
      detail: "لا توجد مقارنة Pre‑TIA / Post‑TIA محسوبة. أنشئ حدث Fragnet ثم شغّل التحليل قبل التقرير أو التصدير.",
    }];
    return { state: "rejected", impactDays: null, analystExpectedDays: expected, deviationDays: null, toleranceDays: tolerance, checks, summary: "النتيجة مرفوضة آلياً لعدم وجود حساب TIA." };
  }

  const checks: TiaResultQualityCheck[] = [];
  const negativeFloat = [...(input.analysis.baseline.activities ?? []), ...(input.analysis.impacted.activities ?? [])]
    .filter((activity) => activity.totalFloat < -0.0001);

  checks.push({
    id: "network",
    title: "شبكة CPM قابلة للحساب",
    state: input.schedule.activities.length && input.schedule.relationships.length ? "pass" : "warning",
    detail: input.schedule.relationships.length
      ? `تم الحساب على ${input.schedule.activities.length} نشاطاً و${input.schedule.relationships.length} علاقة منطقية.`
      : "لا توجد علاقات منطقية في البرنامج؛ قد يظهر تاريخ إكمال لكن لا يجوز اعتبار المسار الحرج دليلاً كافياً دون مراجعة الربط.",
  });

  checks.push({
    id: "data-date",
    title: "تاريخ البيانات ومرجعية البرنامج",
    state: input.schedule.dataDate ? "pass" : "warning",
    detail: input.schedule.dataDate
      ? `تاريخ بيانات البرنامج المحدد هو ${input.schedule.dataDate}. يجب أن يراجع المحلل وقوع الحدث بالنسبة إليه وإلى حالة التقدم الفعلية.`
      : "لم يرد تاريخ بيانات للبرنامج. النتيجة حسابية، لكنها تحتاج اعتماد تاريخ القطع والبرنامج المعاصر قبل استخدامها تعاقدياً.",
  });

  checks.push({
    id: "float",
    title: "العائمة السالبة",
    state: negativeFloat.length ? "rejected" : "pass",
    detail: negativeFloat.length
      ? `رُصدت عائمة سالبة في ${negativeFloat.length} نشاطاً. عالج أسبابها أو وثّقها في برنامج معتمد قبل قبول نتيجة الأثر.`
      : "لا توجد عائمة سالبة في نسختي المقارنة بحسب حساب المحرك.",
  });

  if (!input.selectedEvent) {
    checks.push({ id: "event-link", title: "ربط الحدث بالشبكة", state: "rejected", detail: "لا يوجد حدث Fragnet مختار لربط نتيجة الأثر بمسار منطقي محدد." });
  } else {
    const fragmentIds = new Set(input.selectedEvent.activities.map((activity) => activity.id));
    const baseConnections = input.selectedEvent.relationships.filter((relationship) =>
      !fragmentIds.has(relationship.predecessorId) || !fragmentIds.has(relationship.successorId),
    ).length;
    const criticalEventActivities = input.selectedEvent.activities.filter((activity) =>
      (input.analysis?.impacted.criticalActivityIds ?? []).includes(activity.id),
    );
    const duration = eventDuration(input.selectedEvent);

    checks.push({
      id: "event-link",
      title: "اتصال الـ Fragnet وحرجية الحدث",
      state: baseConnections >= 2 && criticalEventActivities.length ? "pass" : "warning",
      detail: baseConnections < 2
        ? "لا تظهر للـ Fragnet نقطتا اتصال واضحتان بشبكة الأساس؛ راجع علاقات الدخول والخروج أو النشاط المستبدل."
        : criticalEventActivities.length
          ? `ظهر ${criticalEventActivities.length} نشاط من الحدث على المسار الحرج بعد الإدراج.`
          : "لا يظهر نشاط الحدث على المسار الحرج بعد الإدراج؛ قد يستهلك عائمة أو يكشف نمذجة/سببية تحتاج مراجعة.",
    });

    checks.push({
      id: "impact-range",
      title: "منطق قيمة الأثر الزمني",
      state: computedImpact !== null && computedImpact > duration + 1 ? "warning" : "pass",
      detail: computedImpact !== null && computedImpact > duration + 1
        ? `الأثر المحسوب ${computedImpact} يوم أكبر من مدة الحدث ${duration} يوم بأكثر من يوم. راجع تسلسل الروابط وتأثير المسار اللاحق قبل اعتماده.`
        : `الأثر المحسوب ${computedImpact ?? 0} يوم مقارنة بمدة الحدث المدخلة ${duration} يوم؛ الفرق لا يثبت الاستحقاق لكنه متسق حسابياً ضمن الفحص الآلي.`,
    });
  }

  checks.push({
    id: "outcome",
    title: "اتجاه نتيجة المقارنة",
    state: computedImpact !== null && computedImpact < -0.0001 ? "warning" : "pass",
    detail: computedImpact !== null && computedImpact < -0.0001
      ? "أنتجت المقارنة تاريخ إكمال أبكر. راجع الـ Leads والعلاقات المستبدلة؛ لا تُعامل هذه القيمة كتأخير قابل للمطالبة."
      : computedImpact === 0
        ? "لم يتغير تاريخ الإكمال؛ يسجل التقرير استهلاك عائمة أو عدم وصول الحدث إلى مسار الإكمال، وليس تمديداً تلقائياً للمدة."
        : `فرق تاريخ الإكمال المحتسب هو ${computedImpact ?? 0} يوم عمل بين النسختين المستقلتين.`,
  });

  checks.push({
    id: "analyst-comparison",
    title: "مقارنة تقدير المحلل",
    state: expected === null ? "info" : deviation !== null && tolerance !== null && deviation <= tolerance ? "pass" : "warning",
    detail: expected === null
      ? "أدخل تقدير المحلل الاختياري لإظهار الانحراف عن نتيجة المحرك؛ لا يغير هذا الحقل الحساب."
      : deviation !== null && tolerance !== null && deviation <= tolerance
        ? `فارق تقدير المحلل هو ${deviation} يوم، ضمن سماحية ${tolerance} يوم.`
        : `فارق تقدير المحلل هو ${deviation ?? 0} يوم ويتجاوز سماحية ${tolerance ?? 0} يوم. وثّق سبب الاختلاف قبل الاعتماد.`,
  });

  const hasRejected = checks.some((check) => check.state === "rejected");
  const hasWarning = checks.some((check) => check.state === "warning");
  const state: TiaResultQualityState = hasRejected ? "rejected" : hasWarning ? "conditional" : "accepted";
  const summary = state === "rejected"
    ? "النتيجة مرفوضة آلياً: توجد مانع/موانع في الشبكة أو العائمة أو ربط الحدث يجب معالجتها قبل التصدير."
    : state === "conditional"
      ? "النتيجة محسوبة لكنها مشروطة بمراجعة نقاط التحذير وتوثيق قرار المحلل قبل اعتمادها أو تقديمها."
      : "اجتازت النتيجة فحوص الحوكمة الآلية. تبقى مراجعة الوقائع والعقد والتزامن والاستحقاق مسؤولية الفريق المختص.";
  return { state, impactDays: computedImpact, analystExpectedDays: expected, deviationDays: deviation, toleranceDays: tolerance, checks, summary };
}
