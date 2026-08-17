/** TIA Studio — مكتبة SCL التعليمية، وليست بديلاً عن رأي خبير أو بروتوكول العقد. */
export type SclMethod = {
  id: string;
  shortName: string;
  englishName: string;
  perspective: "معاصر" | "بعد الحدث" | "مقارن";
  purpose: string;
  inputs: string[];
  process: string[];
  bestUse: string;
  cautions: string;
  support: "محرك حسابي" | "قالب منهجي";
};

export const sclMethods: SclMethod[] = [
  { id: "tia", shortName: "تحليل الأثر الزمني", englishName: "Time Impact Analysis (TIA)", perspective: "معاصر", purpose: "قياس الأثر المتوقع لحدث معلوم أو افتراضي على الإكمال، بإدخاله كـ Fragnet في تحديث مناسب قبل الحدث.", inputs: ["تحديث برنامج مقبول قبل الحدث", "منطق Fragnet واقعي", "تقويم وحالة تقدم موثقان"], process: ["اختر التحديث السابق للحدث", "أدخل الـ Fragnet وروابطه", "أعد حساب CPM وقارن الإكمال"], bestUse: "عند التعامل مع حدث جارٍ أو قريب من وقوعه والحاجة لاتخاذ موقف مبكر.", cautions: "النتيجة تتأثر بملاءمة التحديث وجودة منطق الـ Fragnet؛ لا تحسم التعويض أو الاستحقاق وحدها.", support: "محرك حسابي" },
  { id: "iap", shortName: "المتأثر وفق المخطط", englishName: "Impacted As-Planned", perspective: "بعد الحدث", purpose: "إدخال أحداث التأخير في برنامج مخطط دون تمثيل تفصيلي لحالة التنفيذ الواقعية.", inputs: ["برنامج أساس موثوق", "أحداث ومدد وروابط مفترضة"], process: ["ثبّت برنامج الأساس", "أدخل الأحداث كأنشطة مؤثرة", "قارن تاريخ الإكمال"], bestUse: "عندما يكون برنامج الأساس هو السجل الأكثر اكتمالاً ولا تتوافر تحديثات موثوقة كفاية.", cautions: "قد يهمل تغيّر المسار الحرج وحالة التقدم الفعلية؛ لا يناسب الوقائع المعقدة دون تحفّظ واضح.", support: "قالب منهجي" },
  { id: "tswa", shortName: "تحليل الشرائح الزمنية", englishName: "Time Slice Window Analysis", perspective: "بعد الحدث", purpose: "فحص تغير المسار الحرج وأثر الأحداث ضمن فترات متتابعة من تحديثات البرنامج.", inputs: ["تحديثات دورية موثوقة", "تواريخ بيانات ثابتة", "سجل أحداث معاصر"], process: ["قسّم المشروع إلى نوافذ", "حلل المسار الحرج في كل تحديث", "اربط الحدث بالنافذة والنتيجة"], bestUse: "المشروعات الطويلة ذات تحديثات شهرية أو دورية سليمة.", cautions: "يعتمد بشدة على سلامة كل تحديث؛ اختيار النافذة أو استبعاد تغيرات الواقع قد يغير النتيجة.", support: "قالب منهجي" },
  { id: "apab", shortName: "المخطط مقابل المنفذ بالنوافذ", englishName: "As-Planned vs As-Built Window Analysis", perspective: "مقارن", purpose: "مقارنة تقدم مخطط ومنفذ ضمن نوافذ لقياس الانحراف ومواضع التأخير.", inputs: ["برنامج أساس", "تواريخ تنفيذ فعلية كافية", "تقسيم زمني مبرر"], process: ["حدد النوافذ", "قارن الأداء المخطط والمنفذ", "فسر الانحراف مع الأدلة"], bestUse: "عند اكتمال معظم أو كل المشروع مع توافر سجلات فعلية جيدة.", cautions: "لا يثبت السببية تلقائياً؛ يجب ربط فرق الأداء بأحداث وأدلة، لا بمجرد مقارنة تواريخ.", support: "قالب منهجي" },
  { id: "rlp", shortName: "أطول مسار رجعي", englishName: "Retrospective Longest Path Analysis", perspective: "بعد الحدث", purpose: "تحديد أطول مسار فعلي أو مسار مسبب للإكمال بعد اكتمال الوقائع.", inputs: ["برنامج محدث أو منفذ", "تواريخ فعلية وروابط منطقية", "سجلات تقدم"], process: ["أعد بناء المسار الأطول", "حدد الأنشطة التي دفعت الإكمال", "اربط الأحداث بفترات التأثير"], bestUse: "عند النزاع بعد الحدث وتوفر سجل زمني تفصيلي.", cautions: "اختيار طريقة إعادة البناء وافتراضات المنطق اللاحق يحتاجان شفافية وخبرة.", support: "قالب منهجي" },
  { id: "cab", shortName: "المنفذ المختزل", englishName: "Collapsed As-Built Analysis", perspective: "بعد الحدث", purpose: "إزالة أو تقليص أحداث محددة من برنامج منفذ لاختبار كيف كان الإكمال سيتغير افتراضياً.", inputs: ["As-Built موثوق", "نموذج واضح للأحداث المراد حذفها", "توثيق للمنطق والقيود"], process: ["ثبت نموذج المنفذ", "أزل الأثر محل الاختبار", "أعد الحساب وقارن الإكمال"], bestUse: "تحليل سببي رجعي عند اكتمال المشروع وتفصيل البيانات كافٍ.", cautions: "حساس جداً لافتراضات الحذف وإعادة بناء المنطق؛ يحتاج كشفاً كاملاً لكل الافتراضات.", support: "قالب منهجي" },
];

export const sclSources = [
  { label: "Society of Construction Law — Delay and Disruption Protocol, 2nd ed. (2017)", href: "https://www.scl.org.uk/resources/delay-disruption-protocol" },
  { label: "HKA — Statistical review of delay analysis techniques", href: "https://www.hka.com/article/a-statistical-review-of-delay-analysis-techniques-used-over-the-last-decade/" },
  { label: "Fenwick Elliott — SCL Protocol, second edition", href: "https://www.fenwickelliott.com/knowledge-hub/annual-review/ar-2017/the-scl-delay-and-disruption-protocol-a-second-edition/" },
];
