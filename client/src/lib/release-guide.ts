export const releaseInfo = {
  version: "1.0.12",
  publishedOn: "24 أغسطس 2026",
  channel: "سطح المكتب المحلي · Windows x64 وLinux x64",
  launcher: "Windows: استخدم ملف Setup للتثبيت أو ملف Portable للتشغيل المباشر. Linux: ملف TIA-Studio-1.0.7-Linux-x64.AppImage واحد.",
} as const;

// الاسم المستهلك في واجهة مركز الموارد. يبقى هذا الربط صريحاً كي لا ينفصل
// الدليل الحيّ عن بطاقة الإصدار عند تغيير بيانات الحزمة لاحقاً.
export const LOCAL_RELEASE = releaseInfo;

/** Public source reference only; the release version remains separate from the source branch. */
export const GITHUB_SOURCE_REFERENCE = {
  repositoryUrl: "https://github.com/fanoz1200/TIA-Studio",
  branch: "main",
  arabicTitle: "المصدر الحالي على GitHub",
  englishTitle: "Current source on GitHub",
  arabicDescription: "المستودع العام وفرع main هما مرجع المصدر المراجع. يثبت تقرير التسليم بصمة المزامنة قبل وصف المصدر بأنه الأحدث؛ لا تعني هذه البطاقة إصدار Windows أو GitHub Release جديداً.",
  englishDescription: "The public repository and main branch are the reviewed source reference. The delivery record verifies the sync SHA before the source is described as current; this card does not indicate a new Windows build or GitHub Release.",
} as const;

/** Stable Windows release links. Keep these separate from the GitHub source branch. */
export const WINDOWS_SETUP_DOWNLOAD_URL =
  "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Setup.exe";
export const WINDOWS_PORTABLE_DOWNLOAD_URL =
  "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-Portable.exe";
export const WINDOWS_SHA256_DOWNLOAD_URL =
  "https://github.com/fanoz1200/TIA-Studio/releases/download/v1.0.12/TIA-Studio-1.0.12-Windows-x64-SHA256SUMS.txt";

/**
 * A frozen, clean handoff snapshot. This must stay separate from the Windows
 * release: it contains source and docs only, never user schedules or evidence.
 */
export const FINAL_SOURCE_PACKAGE = {
  downloadUrl: "/manus-storage/TIA-Studio-source-20260827_2edd7a7b.zip",
  checksumUrl: "/manus-storage/TIA-Studio-source-20260827_58664bde.sha256",
  commit: "6766922dd05e63cf748488e30ff6ccd8573c9418",
  sha256: "3033435f21f6bc0b8f9c32b3a9db15d2d39ebb7c9b54740a8c73886a458b3131",
  fileCount: 444,
} as const;

export const methodologyGuide = [
  {
    title: "Time Impact Analysis — TIA",
    purpose: "يقيس أثر حدث محدد بإدراج Fragnet في نسخة تحليل مستقلة من البرنامج المعتمد، ثم مقارنة تاريخ الإكمال قبل الإدراج وبعده.",
    useWhen: "عند وجود برنامج أساس أو تحديث مناسب قبل الواقعة، مع حدث يمكن تعريف منطقيته ومدته ونقاط ربطه.",
  },
  {
    title: "Windows & Concurrency",
    purpose: "يقسم القراءة إلى نوافذ زمنية متتابعة ويُظهر تداخل أحداث مستقلة في الفترة نفسها بدلاً من دمج أسبابها بلا دليل.",
    useWhen: "عند وجود تحديثات دورية أو أكثر من حدث مؤثر أو احتمال تأخير متزامن.",
  },
  {
    title: "بوابة الجودة — GAO/AACE",
    purpose: "تفحص سلامة العلاقات والمنطق والتواريخ والمسار الحرج قبل قبول أي نتيجة حسابية أو تصدير تقرير.",
    useWhen: "إلزامياً بعد الاستيراد وقبل اعتماد نسخة Pre-TIA أو تشغيل التحليل.",
  },
] as const;

export const engineGuide = [
  { name: "قارئ P6 XER / XML وXER Viewer", input: "ملف البرنامج والملاحظات وWBS ونسب الإنجاز والموارد والتكاليف ومعرف تقويم النشاط وسجل القيود", output: "نموذج جدول موحد وتدقيق قيود/تقاويم محلي قبل الرجوع إلى Primavera" },
  { name: "محرك CPM الحتمي والتقويم الإقليمي", input: "الأنشطة والعلاقات والتقويم والبلد والإجازات المراجَعة وCS_SNET/CS_FNET فقط", output: "ES/EF/LS/LF وTotal Float ومسار حرج محلي؛ ليس بديلاً عن F9 أو تقويم نشاط P6" },
  { name: "محرك Fragnet والتقسيم", input: "واقعة موثقة ونقاط ربط منطقية", output: "نسخة Post-TIA مستقلة أو نشاط Pre/Event/Post" },
  { name: "بوابة جودة الجدول", input: "نسخة البرنامج المستوردة", output: "قبول أو تحذير أو مانع مع سجل تحسين محلي" },
  { name: "تحقق نتائج TIA", input: "نتيجة قبل/بعد وإشارات الجودة", output: "قرار واضح بشأن قابلية استخدام النتيجة في التقرير" },
  { name: "التقرير والتبادل", input: "النتيجة المعتمدة والأدلة والسجل", output: "Word وPDF وExcel وXER تجريبي ضمن الحدود المعلنة" },
] as const;

export const workflowGuide = [
  "ابدأ من الموسوعة لتحديد نوع الواقعة والمنهج المناسب، أو ابدأ من سجل القضايا إذا كانت البيانات جاهزة.",
  "ارفع Baseline ثم Update السابق للحدث؛ احتفظ دائماً بملف P6 الأصلي خارج التطبيق ومن دون تعديل.",
  "اختر البلد والتقويم: مصر افتراضياً السبت–الخميس. حمّل اقتراح الإجازات يدوياً عند الحاجة وراجع مصدره وتاريخه، خصوصاً الإجازات الهجرية أو المرحّلة.",
  "افتح عارض XER لقراءة الأنشطة والعلاقات وWBS والتقويم وسجل القيود وفروق النسخ محلياً؛ هو للمراجعة وليس بديلاً عن Primavera.",
  "أكمل بوابة الجودة بعد Baseline وUpdate: راجع الأنشطة والعلاقات وData Date والتقويم وسجل القيود وحالة Actuals/Remaining Duration قبل إدخال Excel أو إنشاء Fragnet. تعدد تقاويم الأنشطة أو قيد غير مدعوم أو Update يحتاج إعادة جدولة يوقف الاعتماد المحلي.",
  "أدخل الواقعة من نموذج Excel المنسق أو سجل القضايا، وأرفق الأدلة وحدد المسؤولية الظاهرة وسبب التأخير كلٌّ على حدة. يمكنك البحث أو لصق عدة Activity IDs.",
  "أنشئ Fragnet لكل نقطة ربط مستقلة، وحدد الأنشطة المتأثرة وقسّم النشاط إلى Pre/Event/Post عند الحاجة.",
  "شغّل TIA أو نوافذ وتزامن، ثم راجع لوحة التحقق قبل حساب الأثر المالي أو تحرير مسودة الـNotice المحلية أو التقرير.",
  "مرّر مسار الاعتماد، ثم صدّر التقرير وExcel؛ لا تصدّر XER التجريبي إلا بعد نجاح التحقق العكسي واختباره في Primavera غير إنتاجي.",
] as const;

export const systemLinks = [
  "الاستيراد وXER Viewer يزوّدان محرك CPM وبوابة الجودة بالبيانات نفسها، فلا توجد أرقام مخفية أو حسابات خارجية. تقويمات P6 المشفرة والاستثناءات لا تُفك بعد، لذلك يظهر تعددها كمانع مراجعة.",
  "اختيار البلد والإجازات يمر بمراجعة ظاهرة قبل دخوله إلى الحساب؛ لا يوجد تحديث خفي أو حكم تلقائي للإجازات الهجرية.",
  "بوابة الجودة تسبق Fragnet وTIA وتشارك نتيجتها مع بوابة التصدير حتى لا يتحول التحذير إلى تقرير معتمد صامتاً.",
  "الـ Fragnet ينشئ نسخة Post-TIA مستقلة؛ تظل نسخة Pre-TIA وملف P6 الأصلي مرجعين محفوظين.",
  "نتيجة CPM وTIA تربط الأثر الزمني بالأنشطة الفعلية، ومنها فقط يُحسب التعرض المالي ويُجهز Notice والتقرير.",
  "الموسوعة وقائمة التحقق والدليل الحيّ تشرح القرار، بينما المحرك الحتمي هو الذي يجري الحساب؛ لا يستخدم أي نموذج ذكاء اصطناعي لتحديد النتيجة.",
] as const;

export const releaseChanges = [
  "إصدار 1.0.12: أضيف اختيار واضح للغة الواجهة (العربية / English) يُحفظ محلياً ويضبط اتجاه RTL/LTR، مع ترجمة التنقل والرأس المشتركين. تظل الشاشات المتخصصة العربية القديمة قيد ترجمة تدريجية ومختبرة؛ لا يدّعي الإصدار أن كل نص قديم أصبح إنجليزياً.",
  "إصدار 1.0.12: أضيف اختيار مستقل للغة كل مخرج في لوحة التقرير. ينتج Full Claim وPDF وFact Pack وExcel عناوين واتجاهاً عربيين أو إنجليزيين بحسب الاختيار، بينما تبقى أسماء الأنشطة والوقائع والأدلة كما أدخلها المستخدم ولا تُترجم تلقائياً أو تُرسل إلى خدمة خارجية.",
  "إصدار 1.0.11: أصلح مركز الموارد التعامل مع روابط GitHub الخارجية عند تشغيل نسخة Windows المحلية؛ تبقى الروابط الخارجية كما هي ولا تُضاف إليها وصلة الخادم المحلي. وعندما لا يعرض المتصفح تثبيت PWA، يظهر زر واضح لتحميل Windows Setup بدلاً من زر معطّل.",
  "إصدار 1.0.10: يسجل التطبيق Actuals وRemaining Duration وPercent Complete المستوردة من XER، لكنه لا يعيد جدولة Update أو يحاكي P6/F9. تظهر هذه الحالة الآن كمانع صريح في بوابة الجودة وتحذير في CPM؛ لذا لا يمثل الناتج تكافؤ Primavera.",
  "إصدار 1.0.9: يحفظ مستورد XER معرف تقويم كل نشاط وسجل القيود. يطبق محرك CPM محلياً فقط الحد الأدنى الموثق لبدء/نهاية النشاط (CS_SNET وCS_FNET) على تقويم الجدول المختار، ويوقف بوابة الجودة عند تعدد تقاويم الأنشطة أو أي قيد غير مدعوم.",
  "إصدار 1.0.9: لا يفك التطبيق أنماط ساعات تقاويم P6 أو استثناءاتها ولا يعيد جدولة Progress/Remaining Duration مثل P6. لذلك لا تمثل النتيجة تكافؤ Primavera ولا يغني التشغيل المحلي عن إعادة الاستيراد وF9 والمراجعة غير الإنتاجية.",
  "إصدار 1.0.8: أضيف Claim Console MVP بملف عقد لكل مشروع وسلسلة Risk → Issue → Claim Candidate قابلة للتتبع ومتابع Notice قابل للضبط من المستخدم. لا يختلق النظام بند عقد أو مهلة أو استحقاقاً قانونياً، ويعرض الفجوات التي يلزم استكمالها.",
  "إصدار 1.0.8: ترتبط المطالبة المختارة بمسار Notice وFact Pack وFull Claim V1 كتحويل مراجعة يدوي فقط. اجتازت النسخة 155 اختباراً وفحص TypeScript وبناء الإنتاج وفحص حزمة Windows المحمولة المعزول؛ كما روجعت الواجهة على سطح المكتب والهاتف.",
  "إصدار 1.0.7: أضيف تقويم عمل إقليمي؛ مصر هي الافتراض بستة أيام عمل من السبت إلى الخميس، مع اختيار دول عربية واقتراح إجازات يدوي يظهر مصدره وتاريخ مراجعته. الإجازات الهجرية والترحيلات تظل للمراجعة التعاقدية.",
  "إصدار 1.0.7: أصبحت بوابة الجودة خطوة إلزامية بعد Baseline وUpdate وقبل Excel أو Fragnet، مع مراجعة الأنشطة والعلاقات وData Date والتقويم.",
  "إصدار 1.0.7: يدعم سجل القضايا البحث والاختيار المتعدد ولصق Activity IDs. يحافظ كل Fragnet على نقطة ربط مستقلة حتى لا تختلط منطق الأحداث.",
  "إصدار 1.0.7: أضيف عارض XER محلي للقراءة وقالب Excel احترافي للوقائع، كما صار تنزيل مسودة Notice محلية متاحاً من دون تسجيل دخول. اجتازت النسخة 134 اختباراً في 44 ملفاً، وفحص TypeScript وبناء الإنتاج، كما اجتاز EXE فحص Wine/Xvfb واستجاب على 4317. يبقى اختبار Windows فعلي وSmartScreen خطوة لازمة.",
  "إصدار 1.0.6: عالجنا فشل نسخة Windows المحمولة الناتج عن محاولة EXE تشغيل نسخة ثانية منه من مجلد Temp. الخادم يبدأ الآن من داخل عملية التطبيق نفسها، وفُحص ملف EXE الجديد في Wine مع مستخدم مؤقت واستجاب محلياً على المنفذ 4317.",
  "إصدار 1.0.6: زر «تصدير التقرير النهائي Excel» صار واضحاً في التقرير ويستدعي مصنف التحليل الحقيقي متعدد الأوراق (الملخص والأنشطة والعلاقات والأحداث وفحص الجودة).",
  "إصدار 1.0.5 (Workshop NO8): استورد محرك XER/CPM المحلي ملفي Baseline وPost‑TIA المرفوعين محلياً، فقرأ 9→13 نشاطاً و9→15 علاقة و3 WBS وتقويماً واحداً في كل نسخة، وأظهر فرق مدة محلياً مقداره +17 يوم عمل (80→97). لا يثبت ذلك تكافؤ Primavera.",
  "تحديث محتوى 1.0.4 (Master Claim): دُمج الملف المرفوع محلياً في مركز المعرفة كسجل ثابت قابل لإعادة التوليد: 70 سجلاً منظماً، منها 55 حالة D و15 سجلاً داعماً، مع 8 أوراق دعم و99 رابطاً داخلياً. لا توجد سجلات منظمة لـ D-056 إلى D-088 في هذا المصدر.",
  "إصلاح انتقال زر «طبّق هذه الحالة الآن» ليبدأ رحلة التحليل فوراً مع رسالة واضحة، بدلاً من التجمّد الظاهري.",
  "إلزام مركز الموارد بعرض رابط الإصدار وتعليمات التشغيل وسجل التغييرات مع كل حزمة محفوظة.",
] as const;

export const ENGLISH_LOCAL_RELEASE = {
  version: releaseInfo.version,
  publishedOn: "24 August 2026",
  channel: "Local desktop · Windows x64 and Linux x64",
  launcher: "Windows: use Setup to install or Portable to run directly. Linux: use the single TIA-Studio-1.0.7-Linux-x64.AppImage file.",
} as const;

export const englishMethodologyGuide = [
  {
    title: "Time Impact Analysis — TIA",
    purpose: "Measures the effect of a defined event by inserting a Fragnet into an independent analytical copy of the accepted schedule, then comparing the completion date before and after insertion.",
    useWhen: "When a suitable baseline or pre-event update exists and the event's logic, duration, and tie-in points can be defined.",
  },
  {
    title: "Windows & Concurrency",
    purpose: "Divides the review into successive time windows and shows independent events that overlap in the same period instead of combining their causes without evidence.",
    useWhen: "When periodic updates, more than one impacting event, or possible concurrent delay exist.",
  },
  {
    title: "Quality Gate — GAO/AACE",
    purpose: "Checks relationship integrity, logic, dates, and the critical path before accepting a calculated result or exporting a report.",
    useWhen: "Required after import and before accepting a Pre-TIA copy or running the analysis.",
  },
] as const;

export const englishEngineGuide = [
  { name: "P6 XER / XML reader and XER Viewer", input: "Schedule file, notes, WBS, progress percentages, resources, costs, activity-calendar identifier, and constraint register", output: "A normalized schedule model and local constraint/calendar checks before returning to Primavera" },
  { name: "Deterministic CPM engine and regional calendar", input: "Activities, relationships, calendar, country, reviewed holidays, and CS_SNET/CS_FNET only", output: "Local ES/EF/LS/LF, Total Float, and critical path; not a substitute for F9 or the P6 activity calendar" },
  { name: "Fragnet and splitting engine", input: "A documented event and logical tie-in points", output: "An independent Post-TIA copy or Pre/Event/Post activities" },
  { name: "Schedule quality gate", input: "The imported schedule copy", output: "Accept, warning, or blocker with a local improvement register" },
  { name: "TIA results validation", input: "The before/after result and quality signals", output: "A clear decision on whether the result is usable in the report" },
  { name: "Reporting and exchange", input: "The accepted result, evidence, and register", output: "Word, PDF, Excel, and trial XER within the stated boundaries" },
] as const;

export const englishWorkflowGuide = [
  "Start in the knowledge centre to identify the event type and suitable method, or start in the issue log when the data is ready.",
  "Upload the Baseline, then the pre-event Update. Always preserve the original P6 file outside the app and without modification.",
  "Choose the country and calendar: Egypt defaults to Saturday–Thursday. Load holiday suggestions manually when needed and review their source and date, especially Hijri or deferred holidays.",
  "Open the XER Viewer to read activities, relationships, WBS, calendars, the constraint register, and version differences locally. It is for review and not a substitute for Primavera.",
  "Complete the quality gate after Baseline and Update: review activities, relationships, Data Date, calendar, constraint register, and Actuals/Remaining Duration status before Excel input or Fragnet creation. Multiple activity calendars, an unsupported constraint, or an Update requiring rescheduling blocks local reliance.",
  "Enter the event from the structured Excel template or issue log, attach evidence, and record apparent responsibility separately from the delay cause. You may search or paste multiple Activity IDs.",
  "Create one Fragnet per independent tie-in point, identify affected activities, and split an activity into Pre/Event/Post where needed.",
  "Run TIA or Windows & Concurrency, then review the validation panel before calculating financial exposure or preparing a local Notice draft or report.",
  "Route the result through approval, then export the report and Excel. Do not export trial XER until reverse validation succeeds and it has been tested in a non-production Primavera copy.",
] as const;

export const englishSystemLinks = [
  "Import and the XER Viewer supply the same data to the CPM engine and quality gate, so there are no hidden numbers or external calculations. Encoded P6 calendars and exceptions are not decoded, therefore multiplicity appears as a review blocker.",
  "Country and holiday selection pass through visible review before entering a calculation. There is no hidden update or automatic decision on Hijri holidays.",
  "The quality gate precedes Fragnet and TIA and shares its result with the export gate, so a warning cannot silently become an accepted report.",
  "The Fragnet creates an independent Post-TIA copy; the Pre-TIA copy and original P6 file remain preserved references.",
  "The CPM and TIA result links time impact to actual activities. Only then can financial exposure be calculated and a Notice or report be prepared.",
  "The knowledge centre, checklist, and live guide explain the decision, while the deterministic engine performs the calculation; no AI model determines the result.",
] as const;

export const englishReleaseChanges = [
  "Version 1.0.12: a clear interface-language choice (Arabic / English) was added, saved locally, and used to set RTL/LTR direction with the shared navigation and header. Specialist screens are translated and tested progressively; the release does not claim that every legacy text is English.",
  "Version 1.0.12: a separate output-language choice was added to the report panel. Full Claim, PDF, Fact Pack, and Excel use Arabic or English headings and direction as selected, while activity names, events, and evidence remain as entered by the user and are neither automatically translated nor sent to an external service.",
  "Version 1.0.11: the resources centre was corrected to preserve external GitHub links when running the local Windows build. When the browser does not offer PWA installation, a clear Windows Setup download appears instead of a disabled button.",
  "Version 1.0.10: the app records Actuals, Remaining Duration, and Percent Complete imported from XER, but it does not reschedule an Update or emulate P6/F9. The quality gate and CPM view show this as an explicit blocker; the result is not Primavera equivalence.",
  "Version 1.0.9: the XER importer preserves each activity calendar identifier and the constraint register. The local CPM engine applies only documented minimum start/finish constraints (CS_SNET and CS_FNET) to the selected schedule calendar, and blocks the quality gate for multiple activity calendars or an unsupported constraint.",
  "Version 1.0.9: the app does not decode P6 calendar-hour patterns or exceptions and does not reschedule Progress/Remaining Duration like P6. The result is therefore not Primavera equivalence and local use does not replace re-import, F9, and non-production review.",
  "Version 1.0.8: Claim Console MVP added one contract profile per project, a traceable Risk → Issue → Claim Candidate chain, and a user-configurable Notice tracker. The system does not invent a contract clause, deadline, or legal entitlement and shows gaps that still need completion.",
  "Version 1.0.8: the selected claim connects to the Notice path, Fact Pack, and Full Claim V1 as a manual-review handoff only. The build passed 155 tests, TypeScript, production build, and isolated Windows Portable package checks; desktop and mobile UI were also reviewed.",
  "Version 1.0.7: a regional work calendar was added. Egypt defaults to six working days from Saturday to Thursday, with Arab-country selection and manually loaded holiday suggestions that show their source and review date. Hijri holidays and deferrals remain for contractual review.",
  "Version 1.0.7: the quality gate became mandatory after Baseline and Update and before Excel or Fragnet, with activity, relationship, Data Date, and calendar review.",
  "Version 1.0.7: the issue log supports search, multiple selection, and pasted Activity IDs. Each Fragnet keeps an independent tie-in point so event logic is not mixed.",
  "Version 1.0.7: a local read-only XER Viewer and professional Excel event template were added, and a local Notice draft became available without login. The build passed 134 tests in 44 files, TypeScript, production build, and Wine/Xvfb EXE checks; real Windows and SmartScreen testing remain necessary.",
  "Version 1.0.6: the Windows Portable failure caused by an EXE attempting to run a second copy from Temp was corrected. The server now starts inside the app process, and the new EXE was checked in Wine with a temporary user and responded locally on port 4317.",
  "Version 1.0.6: the Excel final-report export button became explicit and invokes the real multi-sheet analysis workbook for summary, activities, relationships, events, and quality checks.",
  "Version 1.0.5 (Workshop NO8): the local XER/CPM engine imported the locally supplied Baseline and Post-TIA files, reading 9→13 activities, 9→15 relationships, 3 WBS, and one calendar in each copy, with a local duration delta of +17 working days (80→97). This does not demonstrate Primavera equivalence.",
  "Content update 1.0.4 (Master Claim): the locally supplied file was integrated into the knowledge centre as a fixed, reproducible record: 70 structured entries, including 55 D cases and 15 supporting records, with 8 supporting sheets and 99 internal links. This source contains no structured records for D-056 to D-088.",
  "The ‘Apply this case now’ action was corrected to start the analysis journey immediately with a clear message instead of apparent freezing.",
  "The resources centre was required to display the release link, operating instructions, and change log with every preserved package.",
] as const;
