/**
 * Generated from the user-provided FIDIC workbook and Arabic reference manual.
 * Do not edit manually; run pnpm content:refresh after replacing the source files.
 */

export type FidicClaimReference = {
  clause: string;
  title: string;
  adjustment: string;
  plannerSummary: string;
  plannerAction: string;
  evidence: string;
  egyptianLawReference: string;
  practicalNotes: string;
  source: string;
};

export type ClaimTrainingScenario = {
  id: string;
  title: string;
  content: string;
  source: string;
};

export const fidicClaimReferences: FidicClaimReference[] = [
  {
    "clause": "1.9",
    "title": "Delayed Drawings or Instructions",
    "adjustment": "T + M",
    "plannerSummary": "تأخير الرسومات أو التعليمات من الاستشاري",
    "plannerAction": "تسجيل التأخير + ربطه بالأنشطة المتأثرة + TIA",
    "evidence": "Drawing Register / RFIs / Replies",
    "egyptianLawReference": "مدني 147، 215 – إخلال بالالتزام والتأخير في التنفيذ",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "2.1",
    "title": "Right of Access to the Site",
    "adjustment": "T + M",
    "plannerSummary": "تأخير أو تسليم جزئي للموقع",
    "plannerAction": "مقارنة تواريخ التسليم مع Baseline",
    "evidence": "Site Handover / Correspondence",
    "egyptianLawReference": "مدني 148، 165 – التزام صاحب العمل بتمكين المقاول",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "2.5",
    "title": "Employer's Claims",
    "adjustment": "M",
    "plannerSummary": "مطالبات المالك (مثل تكاليف إصلاح عيوب)",
    "plannerAction": "متابعة الإشعارات والتحديثات",
    "evidence": "Employer Notices / Determinations",
    "egyptianLawReference": "مدني 221، 222 – التعويض عن الضرر",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "3.5",
    "title": "Engineer Determinations",
    "adjustment": "T / C / M",
    "plannerSummary": "تحديدات المهندس للمطالبات",
    "plannerAction": "دعم التحليلات بالبرامج المحدثة",
    "evidence": "Correspondence / Records",
    "egyptianLawReference": "مدني 157، 158 – سلطة التقدير والفسخ/التعويض",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "4.7",
    "title": "Setting Out (Errors)",
    "adjustment": "T + M",
    "plannerSummary": "أخطاء نقاط مرجعية أو إحداثيات من المالك",
    "plannerAction": "إثبات Employer Error + Impact Analysis",
    "evidence": "Survey Reports / Instructions",
    "egyptianLawReference": "مدني 217 – مسؤولية التنفيذ الخاطئ",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "4.12",
    "title": "Unforeseeable Physical Conditions",
    "adjustment": "T + C",
    "plannerSummary": "ظروف تربة أو مياه غير متوقعة",
    "plannerAction": "Notice فوري + TIA + تحديث البرنامج",
    "evidence": "Photos / Logs / Geo Reports",
    "egyptianLawReference": "مدني 148 – نظرية الظروف الطارئة",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "4.24",
    "title": "Fossils",
    "adjustment": "T + C",
    "plannerSummary": "اكتشاف آثار أو بقايا تاريخية",
    "plannerAction": "وقف العمل + إعادة جدولة الأنشطة",
    "evidence": "Authority Notices / Photos",
    "egyptianLawReference": "مدني 970، 972 – ملكية الدولة للآثار والأشياء الأثرية",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "7.4",
    "title": "Testing",
    "adjustment": "T + M",
    "plannerSummary": "تأخير أو إعادة اختبارات بسبب طرف آخر",
    "plannerAction": "تضمين الاختبارات بالمسار الحرج",
    "evidence": "Test Records / Engineer Instructions",
    "egyptianLawReference": "مدني 215 – الالتزام بالجودة والمواصفات",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "8.4",
    "title": "Extension of Time",
    "adjustment": "T",
    "plannerSummary": "الإطار العام لمنح EOT",
    "plannerAction": "Delay Analysis + Critical Path Proof + Fragnets",
    "evidence": "Updated Programme",
    "egyptianLawReference": "مدني 165، 221 – أثر التأخير والتعويض",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "8.5",
    "title": "Delay Caused by Authorities",
    "adjustment": "T",
    "plannerSummary": "تأخير تصاريح رغم التزام المقاول",
    "plannerAction": "إدراج التراخيص كنشاط مستقل",
    "evidence": "Permit Logs / Authority Letters",
    "egyptianLawReference": "مدني 165، 148 – أسباب خارجة عن الإرادة",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "8.9",
    "title": "Consequences of Suspension",
    "adjustment": "T + C",
    "plannerSummary": "إيقاف العمل بأمر المهندس",
    "plannerAction": "إعادة جدولة + حساب Idle Resources",
    "evidence": "Suspension Notice / Records",
    "egyptianLawReference": "مدني 161، 162 – وقف التنفيذ لعدم الوفاء",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "10.2",
    "title": "Taking Over of Section or Part",
    "adjustment": "M",
    "plannerSummary": "تسليم جزئي للأعمال",
    "plannerAction": "ربط Sections بالـ Milestones",
    "evidence": "TOC Certificates",
    "egyptianLawReference": "مدني 654، 656 – الاستلام الابتدائي",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "10.3",
    "title": "Interference with Tests on Completion",
    "adjustment": "T + M",
    "plannerSummary": "تعطيل اختبارات التسليم",
    "plannerAction": "تعديل Sequence الاختبارات",
    "evidence": "Test Logs / Correspondence",
    "egyptianLawReference": "مدني 215، 217 – الإخلال بإجراءات التسليم",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "11.8",
    "title": "Contractor to Search",
    "adjustment": "T + M",
    "plannerSummary": "طلب البحث عن عيوب",
    "plannerAction": "إعادة جدولة الأنشطة المتأثرة",
    "evidence": "Search Instructions",
    "egyptianLawReference": "مدني 658 – التزام المقاول بإصلاح العيوب",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "12.4",
    "title": "Omissions (by Variations)",
    "adjustment": "C",
    "plannerSummary": "حذف أعمال من النطاق",
    "plannerAction": "إعادة توزيع التكاليف فقط",
    "evidence": "VO / Revised BOQ",
    "egyptianLawReference": "مدني 147، قانون التعاقدات العامة",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "13.2",
    "title": "Value Engineering",
    "adjustment": "M",
    "plannerSummary": "اقتراح توفير من المقاول",
    "plannerAction": "تحديث Cash Flow فقط",
    "evidence": "VE Proposal / Approval",
    "egyptianLawReference": "قانون التعاقدات الحكومية + مدني 147",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "13.7",
    "title": "Changes in Legislation",
    "adjustment": "T + C",
    "plannerSummary": "قوانين جديدة تؤثر على التنفيذ",
    "plannerAction": "Impact زمني + Cost Formula",
    "evidence": "Legal Notices / Programme",
    "egyptianLawReference": "مدني 148 – تغير الظروف القانونية",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "13.8",
    "title": "Adjustments for Changes in Cost",
    "adjustment": "C",
    "plannerSummary": "تغييرات في التكاليف (indices)",
    "plannerAction": "تطبيق الصيغ التعاقدية",
    "evidence": "Cost Indices / Calculations",
    "egyptianLawReference": "مدني 148، 147 – اختلال التوازن العقدي",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "14.8",
    "title": "Delayed Payment",
    "adjustment": "C",
    "plannerSummary": "تأخير مستحقات مالية",
    "plannerAction": "تحليل Cash Flow فقط",
    "evidence": "IPC / Payment Records",
    "egyptianLawReference": "مدني 226، 227 – فوائد التأخير والتعويض",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "16.1",
    "title": "Contractor’s Entitlement to Suspend",
    "adjustment": "T + M",
    "plannerSummary": "تعليق الأعمال بسبب عدم الدفع",
    "plannerAction": "إعادة جدولة + إثبات السبب",
    "evidence": "Suspension Notice",
    "egyptianLawReference": "مدني 161 – الدفع بعدم التنفيذ",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "16.4",
    "title": "Payment on Termination",
    "adjustment": "M",
    "plannerSummary": "مستحقات عند إنهاء العقد",
    "plannerAction": "حساب نهائي فقط",
    "evidence": "Final Accounts",
    "egyptianLawReference": "مدني 157، 221 – آثار الفسخ والتعويض",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "17.1",
    "title": "Indemnities (Employer)",
    "adjustment": "C",
    "plannerSummary": "تعويضات بسبب مخاطر المالك",
    "plannerAction": "Cost Substantiation",
    "evidence": "Insurance / Claims",
    "egyptianLawReference": "مدني 163، 221 – المسؤولية المدنية",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "17.4",
    "title": "Consequences of Employer’s Risks",
    "adjustment": "T + M",
    "plannerSummary": "نتائج تحقق مخاطر صاحب العمل",
    "plannerAction": "TIA + Cost Impact",
    "evidence": "Risk Event Records",
    "egyptianLawReference": "مدني 165، 174 – تحمل التبعة",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "18.1",
    "title": "Insurance (by Employer)",
    "adjustment": "C",
    "plannerSummary": "تأمين يقدمه المالك",
    "plannerAction": "Cost فقط",
    "evidence": "Insurance Docs",
    "egyptianLawReference": "مدني 747 وما بعدها – التأمين",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "19.4",
    "title": "Force Majeure",
    "adjustment": "T + C",
    "plannerSummary": "ظروف قهرية",
    "plannerAction": "Re-baseline + Records",
    "evidence": "Force Majeure Notices",
    "egyptianLawReference": "مدني 165 – القوة القاهرة",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "19.6",
    "title": "Optional Termination",
    "adjustment": "M",
    "plannerSummary": "إنهاء اختياري",
    "plannerAction": "Financial Close-out",
    "evidence": "Termination Docs",
    "egyptianLawReference": "مدني 157 – الفسخ الاتفاقي",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  },
  {
    "clause": "20.1",
    "title": "Contractor’s Claims",
    "adjustment": "T / M / C",
    "plannerSummary": "الإطار الإجرائي لكل المطالبات",
    "plannerAction": "Notices + Updated Programme + Full Details",
    "evidence": "Claim Files / Notices",
    "egyptianLawReference": "مدني 221، 222 – المطالبة بالتعويض",
    "practicalNotes": "",
    "source": "FIDIC 2017 Claims Reference.xlsx"
  }
] as const;

export const claimTrainingScenarios: ClaimTrainingScenario[] = [
  {
    "id": "scenario-1",
    "title": "الحالة (1): نشاط حرج +10 يوم vs نشاط غير حرج +30 يوم — مين يؤخر المشروع؟",
    "content": "الآراء: الأول لأنه حرج | الثاني لأن تأخيره أكبر | الاتنين | يعتمد على الـ Float المتاح. ✅ الصح: يعتمد على الـ Float المتاح. الأول يؤخر 10 أيام مباشرة؛ الثاني النتيجة بتاعته محسوبة بالجدول ده: سيناريو الـ Total Float للنشاط غير الحرج | تأخيره 30 يوم | أثره على تاريخ الإنجاز | TF = 40 يوم | 30 < 40 | لا تأخير — والمتبقي 10 يوم float | TF = 30 يوم | 30 = 30 | لا تأخير — لكن الـ Float بقى صفر (بقى حرج!) | TF = 20 يوم | 30 > 20 | يأخر المشروع 10 أيام (30−20) ويتحول لمسار حرج | Critical Path | Critical Activity +10 days ➜ pushes Project Finish | | | | Float Analysis | Non-critical +30 days | Total Float = 40 days (absorbed) | 📝 احفظ: المسار الحرج مش ثابت — بيتغير مع كل Update. التحديث المستمر مش رفاهية.",
    "source": "تجميع حالات الواتساب والقرارات بناء عليها.html"
  },
  {
    "id": "scenario-2",
    "title": "الحالة (2): إيه اللي ملوش علاقة بتحديد المسار الحرج؟",
    "content": "✅ الصح: التكلفة. المدة أساس الحساب، الـ Logic ركيزة الشبكة، والتقدم الفعلي بيغيّر المسار في التحديثات. أما التكلفة: نشاط بمليون دولار ممكن يكون خارج الحرج تماماً.",
    "source": "تجميع حالات الواتساب والقرارات بناء عليها.html"
  },
  {
    "id": "scenario-3",
    "title": "الحالة (3): أنواع التأخير من حيث المسؤولية",
    "content": "النوع | المسؤول | مثال | النتيجة | ECD Excusable Compensable | صاحب العمل | تأخر رسومات / تعليمات، تغييرات | EOT + تكلفة + لا غرامات | END Excusable Non-Comp. | خارج عن الطرفين | قوة قاهرة، طقس استثنائي | EOT فقط | NND Non-Excusable | المقاول | تأخر معداته، إعادة تنفيذ | لا EOT لا تكلفة + غرامات |",
    "source": "تجميع حالات الواتساب والقرارات بناء عليها.html"
  },
  {
    "id": "scenario-4",
    "title": "الحالة (4): التأخير المتزامن Concurrent Delay",
    "content": "مثال رقمي: تأخير رسومات من المالك 20 يوم (على الحرج) يتداخل معه تأخير معدات للمقاول 10 يوم داخل نفس الفترة (على الحرج). ✅ الحكم (نهج SCL/الإنجليزي): المقاول بياخد EOT = 20 يوم (حق الوقت لا يسقط بالتزامن)، لكن لا تعويض مالي عن أيام التداخل — كل طرف يشيل تكلفة حدثه. التعريف الأدق: العبرة بـتزامن الأثر على تاريخ الإنجاز مش تزامن الوقوع بالحرف. 🖋️ نقطتي: التزامن الحقيقي نادر في التحكيم — غالباً بيطلع حدث رئيسي وثانوي بعد تحليل الـ Windows. متستسهلش الكلمة.",
    "source": "تجميع حالات الواتساب والقرارات بناء عليها.html"
  },
  {
    "id": "scenario-5",
    "title": "الحالة (5): لغز كونان — إيه الناقص؟",
    "content": "رسالة تأخير رسومات 30 يوم + فاتورة زيادة $200,000. ✅ الناقص: دليل إن التأخير هو سبب التكلفة (Causation). وجود حدث + فلوس متصرفة ≠ مطال",
    "source": "تجميع حالات الواتساب والقرارات بناء عليها.html"
  }
] as const;
