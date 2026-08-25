/**
 * TIA Studio — غرفة التحكم المعمارية
 * زرقة المخططات وطبقة الـ Fragnet البرتقالية تجعل القرار الحسابي أوضح من واجهة التطبيق.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  GitCompareArrows,
  HardDriveDownload,
  LibraryBig,
  LoaderCircle,
  Network,
  Play,
  Plus,
  Printer,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TextQuote,
  WalletCards,
  BellRing,
  ClipboardCheck,
  UsersRound,
  Upload,
  X,
  Zap,
  ClipboardList,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { type AppLanguage } from "@/lib/language";
import {
  buildActivitySplitFragnet,
  calendarDayCalendar,
  dateToRelativeDay,
  fiveDayCalendar,
  generateDelayAnalysisNarrative,
  runCPM,
  runTIA,
  runWindowTIA,
  type Activity,
  type AnalysisWindow,
  type DelayCause,
  type Fragnet,
  type Relationship,
  type RelationshipType,
  type Schedule,
  type TiaResult,
  type WindowTiaResult,
} from "@/lib/cpm";
import { importXerSchedule, type XerImportSummary } from "@/lib/xer";
import { importP6XmlSchedule } from "@/lib/p6-xml";
import {
  findRegionalCalendarCountry,
  loadPublicHolidays,
  regionalCalendarCountries,
  regionalCalendarForCountry,
} from "@/lib/regional-calendar";
import { sclMethods, sclSources } from "@/lib/scl-methods";
import { P6EvidenceReportPanel } from "@/components/P6EvidenceReportPanel";
import { ScheduleQualityPanel } from "@/components/ScheduleQualityPanel";
import { FinancialNoticeReviewPanel } from "@/components/FinancialNoticeReviewPanel";
import { ProjectMembersPanel } from "@/components/ProjectMembersPanel";
import { ProjectInvitationAcceptPanel } from "@/components/ProjectInvitationAcceptPanel";
import { ProjectResourcesPanel } from "@/components/ProjectResourcesPanel";
import { KnowledgeCentrePanel } from "@/components/KnowledgeCentrePanel";
import { ClaimContinuityPanel } from "@/components/ClaimContinuityPanel";
import { IssueLogPanel } from "@/components/IssueLogPanel";
import { ClaimConsolePanel } from "@/components/ClaimConsolePanel";
import {
  ActivityDataTable,
  RelationshipDataTable,
} from "@/components/ScheduleDataTables";
import {
  GuidedAnalysisPanel,
  type ScheduleSnapshot,
  type ScheduleStage,
} from "@/components/GuidedAnalysisPanel";
import {
  FirstRunGuide,
  shouldShowFirstRunGuide,
} from "@/components/FirstRunGuide";
import { UserGuidePanel } from "@/components/UserGuidePanel";
import { XerViewerPanel } from "@/components/XerViewerPanel";
import "./home-mobile-nav.css";
import "../components/regional-calendar.css";

const logoUrl = "/manus-storage/tia-studio-symbol_a5a70021.png";
const workspaceImageUrl =
  "/manus-storage/tia-studio-workspace-hero_f79d49ba.png";
const reportTextureUrl =
  "/manus-storage/tia-studio-report-texture_0415e3ef.png";

type ViewKey =
  | "guided"
  | "guide"
  | "overview"
  | "schedule"
  | "quality"
  | "event"
  | "windows"
  | "methods"
  | "analysis"
  | "report"
  | "financial"
  | "notices"
  | "review"
  | "members"
  | "compare"
  | "xerViewer"
  | "resources"
  | "learning"
  | "issues"
  | "claimConsole";
type CsvActivity = Activity;

type HomeStatusMessageKey =
  | "cpmUnavailable"
  | "tiaUnavailable"
  | "windowUnavailable"
  | "demoLoaded"
  | "invalidJsonShape"
  | "jsonImported"
  | "jsonReadFailure"
  | "xerImported"
  | "xerReadFailure"
  | "journeyImported"
  | "journeyReadFailure"
  | "csvDurationInvalid"
  | "activitiesCsvImported"
  | "csvReadFailure"
  | "activitiesFirst"
  | "csvNetworkImported"
  | "relationshipsCsvReadFailure"
  | "p6GateRequired"
  | "selectRelationship"
  | "selectActivity"
  | "invalidEvent"
  | "eventSplitCreated"
  | "eventCreated"
  | "eventCreateFailed"
  | "eventRemoved"
  | "issueFragnetFailed"
  | "invalidWindow"
  | "windowCreated"
  | "weekdayRequired"
  | "countryRequired"
  | "holidaysSynced"
  | "holidaysSyncFailure"
  | "holidayDateInvalid"
  | "scheduleExported"
  | "analysisExported"
  | "calculationUpdated"
  | "analysisJourneyStarted"
  | "p6XmlImported"
  | "tiaJourneyOpened";

/**
 * Translates only fixed UI status chrome. Values received from imported files,
 * the CPM/TIA engine, or users are supplied by callers unchanged.
 */
export function formatHomeStatus(
  language: "ar" | "en",
  key: HomeStatusMessageKey,
  values: Record<string, string | number> = {}
) {
  const value = (name: string) => String(values[name] ?? "");
  const messages: Record<HomeStatusMessageKey, string> =
    language === "en"
      ? {
          cpmUnavailable: "Unable to calculate CPM.",
          tiaUnavailable: "Unable to calculate TIA for this event.",
          windowUnavailable: "Unable to calculate the analysis window.",
          demoLoaded:
            "Expanded sample loaded: 5-day calendar, TIA event, and review window.",
          invalidJsonShape: "The JSON file does not match the required schedule format.",
          jsonImported: `Imported ${value("activities")} activities and ${value("relationships")} relationships.`,
          jsonReadFailure: "Unable to read the JSON file.",
          xerImported: `XER imported: ${value("activities")} activities and ${value("relationships")} relationships. Review the calendar before approval.`,
          xerReadFailure: "Unable to read the XER file.",
          journeyImported: `Read ${value("stage")}: ${value("scheduleName")}`,
          journeyReadFailure: "Unable to read the schedule file.",
          csvDurationInvalid:
            "The duration column is required and must contain non-negative numbers.",
          activitiesCsvImported: `Read ${value("activities")} activities. Import relationships to complete the network.`,
          csvReadFailure: "Unable to read the CSV file.",
          activitiesFirst: "Import the activities file first, then the relationships file.",
          csvNetworkImported: "CSV network imported and CPM calculated successfully.",
          relationshipsCsvReadFailure: "Unable to read the CSV relationships file.",
          p6GateRequired:
            "Complete the P6 review gate and confirm the calendar and Data Date review before creating Pre-TIA.",
          selectRelationship: "Select a logic relationship to split with the Fragnet.",
          selectActivity:
            "Select the affected activity to split it in the Post-TIA copy.",
          invalidEvent: "Enter an event title and a valid non-negative duration.",
          eventSplitCreated:
            "Pre/Event/Post split applied and its impact calculated on the Post-TIA copy.",
          eventCreated:
            "The Fragnet was inserted and its impact calculated on the independent TIA copy.",
          eventCreateFailed: "Unable to create the event.",
          eventRemoved: "The event was removed from the analysis register.",
          issueFragnetFailed:
            "Unable to insert the proposed Fragnet in the TIA copy.",
          invalidWindow: "Enter a window name and valid dates.",
          windowCreated:
            "Analysis window created. It will include events occurring within its dates.",
          weekdayRequired: "At least one working day must remain.",
          countryRequired: "Select the country before loading holidays.",
          holidaysSynced: `Loaded ${value("holidays")} published holidays for ${value("country")}. Review transfers and Hijri holidays before approval.`,
          holidaysSyncFailure:
            "Unable to update holidays now; you can add them manually.",
          holidayDateInvalid: "Enter the holiday date in YYYY-MM-DD format.",
          scheduleExported: "The schedule copy is ready to download.",
          analysisExported: "The analysis record and narrative are ready to download.",
          calculationUpdated:
            "The calculation was updated using the current calendar and data.",
          analysisJourneyStarted:
            "We will begin the numbered journey: choose the case type, import the schedules, then record the issue.",
          p6XmlImported:
            "P6 XML schedule loaded and an analysis window matching the imported scope was created.",
          tiaJourneyOpened:
            "The TIA journey will start from step one so you do not miss importing schedules or recording the issue.",
        }
      : {
          cpmUnavailable: "تعذر حساب CPM.",
          tiaUnavailable: "تعذر حساب TIA للحدث.",
          windowUnavailable: "تعذر حساب نافذة التحليل.",
          demoLoaded:
            "تم تحميل النموذج الموسع: تقويم 5 أيام، حدث TIA، ونافذة مراجعة.",
          invalidJsonShape: "ملف JSON لا يطابق نموذج البرنامج المطلوب.",
          jsonImported: `تم استيراد ${value("activities")} نشاط و${value("relationships")} علاقة.`,
          jsonReadFailure: "تعذر قراءة ملف JSON.",
          xerImported: `تم استيراد XER: ${value("activities")} نشاط و${value("relationships")} علاقة. راجع التقويم قبل الاعتماد.`,
          xerReadFailure: "تعذر قراءة ملف XER.",
          journeyImported: `تمت قراءة ${value("stage")}: ${value("scheduleName")}`,
          journeyReadFailure: "تعذر قراءة ملف البرنامج.",
          csvDurationInvalid:
            "عمود duration مطلوب ويجب أن يحتوي أرقاماً غير سالبة.",
          activitiesCsvImported: `تمت قراءة ${value("activities")} نشاط. حمّل العلاقات لإكمال الشبكة.`,
          csvReadFailure: "تعذر قراءة CSV.",
          activitiesFirst: "حمّل ملف الأنشطة أولاً، ثم ملف العلاقات.",
          csvNetworkImported: "تم استيراد شبكة CSV وحساب CPM بنجاح.",
          relationshipsCsvReadFailure: "تعذر قراءة العلاقات CSV.",
          p6GateRequired:
            "أكمل بوابة فحص P6 وأقر مراجعة التقويم وData Date قبل إنشاء Pre-TIA.",
          selectRelationship: "اختر علاقة منطقية ليتم فصلها بالـ Fragnet.",
          selectActivity: "اختر النشاط المتأثر لتقسيمه داخل نسخة Post-TIA.",
          invalidEvent: "أدخل عنوان الحدث ومدة صحيحة غير سالبة.",
          eventSplitCreated:
            "تم اعتماد تقسيم Pre/Event/Post وحساب أثره على نسخة Post-TIA.",
          eventCreated: "تم إدراج الـ Fragnet وحساب أثره على نسخة TIA المستقلة.",
          eventCreateFailed: "تعذر إنشاء الحدث.",
          eventRemoved: "تم حذف الحدث من سجل التحليل.",
          issueFragnetFailed: "تعذر إدراج Fragnet المقترح في نسخة TIA.",
          invalidWindow: "أدخل اسم نافذة وتواريخ صحيحة.",
          windowCreated:
            "تم إنشاء نافذة التحليل. ستلتقط الأحداث الواقعة داخل تاريخيها.",
          weekdayRequired: "يجب الإبقاء على يوم عمل واحد على الأقل.",
          countryRequired: "اختر البلد أولاً قبل تحميل الإجازات.",
          holidaysSynced: `تم تحميل ${value("holidays")} إجازة منشورة لـ ${value("country")}. راجع الترحيلات والأعياد الهجرية قبل الاعتماد.`,
          holidaysSyncFailure:
            "تعذر تحديث الإجازات الآن؛ يمكنك إدخالها يدوياً.",
          holidayDateInvalid: "أدخل العطلة بصيغة YYYY-MM-DD.",
          scheduleExported: "تم تجهيز نسخة البرنامج للتنزيل.",
          analysisExported: "تم تجهيز سجل التحليل والسرد للتنزيل.",
          calculationUpdated: "تم تحديث الحساب باستخدام التقويم والبيانات الحالية.",
          analysisJourneyStarted:
            "هنبدأ بالرحلة المرقمة: اختار نوع الحالة ثم ارفع النسخ وسجّل الواقعة.",
          p6XmlImported:
            "تم تحميل برنامج P6 XML وإنشاء نافذة تحليل مطابقة للنطاق المستورد.",
          tiaJourneyOpened:
            "هتبدأ رحلة TIA من أول خطوة عشان ما يفوتكش رفع النسخ أو تسجيل الواقعة.",
        };
  return messages[key];
}

/**
 * Translates only the application shell chrome. Imported schedule values,
 * user-entered values, IDs, dates, and CPM/TIA engine output stay unchanged.
 */
export function formatHomeChrome(language: AppLanguage) {
  return language === "en"
    ? {
        qualityNetwork: "The CPM network can be calculated and contains no logic loop.",
        qualityCalendar: "The project calendar and working days are defined.",
        qualityFragnet: "The issue register contains at least one Fragnet.",
        qualityAnalysis: "A calculated before/after comparison or analysis window is available.",
        workspaceSubtitle: "Delay Analysis Workspace",
        scheduleSource: "Schedule",
        mainNavigation: "Main navigation",
        workflowTitle: "Traceable calculation guide",
        workflowText: "Schedule + calendar ← Fragnet ← CPM ← window/concurrency ← technical narrative.",
        openSclGuide: "Open the SCL guide",
        accountEvidence: "Saved evidence is linked to your account after sign-in.",
        projects: "Projects",
        interfaceLanguage: "Interface language",
        howToUse: "How to use",
        downloadWindows: "Download Windows app",
        exportSchedule: "Export schedule",
        runAnalysis: "Run analysis",
        criticalPath: "Critical path",
        expectedCompletion: "Expected completion",
        networkError: "Unable to calculate the network",
      }
    : {
        qualityNetwork: "شبكة CPM قابلة للحساب ولا تحتوي حلقة منطقية.",
        qualityCalendar: "التقويم وأيام العمل محددة للمشروع.",
        qualityFragnet: "سجل الأحداث يحتوي Fragnet أو أكثر.",
        qualityAnalysis: "توجد مقارنة قبل/بعد أو نافذة محسوبة.",
        workspaceSubtitle: "مساحة عمل تحليل التأخيرات",
        scheduleSource: "برنامج العمل",
        mainNavigation: "التنقل الرئيسي",
        workflowTitle: "دليل حساب قابل للتتبع",
        workflowText: "برنامج + تقويم ← Fragnet ← CPM ← نافذة/تزامن ← سرد فني.",
        openSclGuide: "عرض دليل SCL",
        accountEvidence: "الأدلة المحفوظة ترتبط بحسابك عند تسجيل الدخول.",
        projects: "مشروعات",
        interfaceLanguage: "لغة الواجهة",
        howToUse: "شرح الاستخدام",
        downloadWindows: "تنزيل نسخة الكمبيوتر",
        exportSchedule: "تصدير البرنامج",
        runAnalysis: "تشغيل التحليل",
        criticalPath: "المسار الحرج",
        expectedCompletion: "الإكمال المتوقع",
        networkError: "تعذر تحليل الشبكة",
      };
}

/**
 * Translates fixed overview guidance only. Schedule names, calendar names,
 * event data, IDs, dates, import notes, and CPM/TIA results are rendered from
 * their original values outside this dictionary.
 */
export function formatHomeOverview(language: AppLanguage) {
  return language === "en"
    ? {
        decisionCentre: "Delay decision centre",
        noWindow: "No window",
        currentTechnicalImpact: "Current technical impact",
        workingDaysOnCompletion: "working days on completion",
        noCriticalImpact: "No calculated critical impact currently",
        decisionBasisPrefix: "The decision is based on",
        decisionBasisMiddle: "and calendar",
        decisionBasisSuffix:
          ". Explore the window, concurrency, and result narrative in one printable workflow.",
        criticalRoute: "Critical route",
        modelNewEvent: "Model a new event",
        reviewWindowAndConcurrency: "Review window and concurrency",
        liveAnalysisCanvas: "LIVE ANALYSIS CANVAS",
        events: "EVENTS",
        windows: "WINDOWS",
        forecastFinish: "FORECAST FINISH",
        baselineDate: "Baseline date",
        basedOnApprovedCalendar: "Based on the approved calendar",
        timeImpact: "Time impact",
        currentWindowResult: "Current window result",
        completionAfterAnalysis: "Completion after analysis",
        afterFragnetsInserted: "After Fragnets are inserted",
        concurrencyFindings: "Concurrency findings",
        causationReviewRequired: "Causation review required",
        delayRegister: "DELAY REGISTER",
        eventRegister: "Event register",
        newEvent: "New event",
        noEventsYet: "No events yet. Add a Fragnet to start.",
        qualityGate: "QUALITY GATE",
        analysisReadiness: "Analysis readiness",
        qualityFooter:
          "Enter event evidence, then review the result with a qualified professional.",
      }
    : {
        decisionCentre: "مركز قرار التأخير",
        noWindow: "لا نافذة",
        currentTechnicalImpact: "الأثر الفني الحالي",
        workingDaysOnCompletion: "أيام عمل على الإكمال",
        noCriticalImpact: "لا يوجد أثر حرج محسوب حالياً",
        decisionBasisPrefix: "القرار مبني على",
        decisionBasisMiddle: "وتقويم",
        decisionBasisSuffix:
          ". استكشف النافذة، التزامن، وسرد النتيجة في مسار واحد قابل للطباعة.",
        criticalRoute: "المسار الحرج",
        modelNewEvent: "نمذجة حدث جديد",
        reviewWindowAndConcurrency: "فحص النافذة والتزامن",
        liveAnalysisCanvas: "LIVE ANALYSIS CANVAS",
        events: "EVENTS",
        windows: "WINDOWS",
        forecastFinish: "FORECAST FINISH",
        baselineDate: "تاريخ الأساس",
        basedOnApprovedCalendar: "حسب التقويم المعتمد",
        timeImpact: "الأثر الزمني",
        currentWindowResult: "نتيجة النافذة الحالية",
        completionAfterAnalysis: "الإكمال بعد التحليل",
        afterFragnetsInserted: "بعد إدراج الـ Fragnets",
        concurrencyFindings: "مرشحات تزامن",
        causationReviewRequired: "تحتاج تدقيق السببية",
        delayRegister: "DELAY REGISTER",
        eventRegister: "سجل الأحداث",
        newEvent: "حدث جديد",
        noEventsYet: "لا توجد أحداث بعد. أضف Fragnet للبدء.",
        qualityGate: "QUALITY GATE",
        analysisReadiness: "جاهزية التحليل",
        qualityFooter: "أدخل دليل الحدث ثم راجع النتيجة مع المختص.",
      };
}

/**
 * Translates only the fixed import and calendar workspace chrome. Imported file
 * names, schedule/calendar names, XER summary values, holiday values, and CPM/TIA
 * results remain caller-owned source values and are never translated here.
 */
export function formatScheduleWorkspaceCopy(language: AppLanguage) {
  return language === "en"
    ? {
        scheduleCalendar: "SCHEDULE + CALENDAR",
        scheduleHeading: "Baseline schedule and calendar",
        scheduleDescription:
          "Import a JSON, CSV, or XER schedule. Before calculation, make the calendar and holidays applied to the dates clear and reviewable.",
        loadSample: "Load training sample",
        downloadJson: "Download JSON",
        xerImportTitle: "Import Primavera P6 XER",
        xerImportScope: "PROJECT, TASK, TASKPRED, and CALENDAR where available.",
        xerImportTip:
          "Import is local; review activities, relationships, and the calendar in the summary before running TIA.",
        xerInputTitle:
          "The XER file is read in the browser and is not sent to an external analysis service.",
        xerChoose: "Choose XER",
        xerReading: "Reading…",
        xerProgress: "Reading the XER network, calendar, and resources…",
        jsonImportTitle: "Import complete JSON",
        jsonImportFields: "name, startDate, activities, relationships.",
        choose: "Choose",
        activitiesCsvTitle: "1. Activities CSV",
        activityCsvFields: "id, name, duration, wbs, owner",
        upload: "Upload",
        relationshipsCsvTitle: "2. Relationships CSV",
        relationshipCsvFields: "predecessorId, successorId, type, lag",
        xerSummaryTitle: "XER import summary:",
        activities: "activities",
        relationships: "relationships",
        noCalendarRecord: "No calendar record",
        xerSummaryNote:
          "Review the working calendar and holidays, because the encoded P6 calendar pattern is not decoded automatically.",
        workingCalendar: "WORKING CALENDAR",
        calendarDays: "Calendar days",
        calendarEngineText:
          "The engine displays ES/EF in working days and converts the completion date with this calendar.",
        projectCountry: "Project country",
        selectProjectCountry: "Select project country",
        customProjectCalendar: "Custom project calendar",
        holidayYear: "Holiday year",
        updateHolidays: "Update holidays",
        fiveDays: "5 days",
        mondayFriday: "Monday–Friday",
        sevenDays: "7 days",
        exceptionalHoliday: "Exceptional holiday",
        add: "Add",
        noExceptionalHolidays: "No exceptional holidays entered.",
        source: "Source:",
        manualEntry: "Manual entry",
        lastUpdated: "Last updated",
        holidayReviewRequired:
          "Review movable holidays and any transfer decision before approving the calculation.",
      }
    : {
        scheduleCalendar: "SCHEDULE + CALENDAR",
        scheduleHeading: "البرنامج المرجعي والتقويم",
        scheduleDescription:
          "استورد جدولاً من JSON أو CSV أو XER. قبل الحساب، اجعل التقويم والعطل المطبقة على التاريخ واضحة وقابلة للمراجعة.",
        loadSample: "تحميل نموذج الاختبار",
        downloadJson: "تنزيل JSON",
        xerImportTitle: "استيراد Primavera P6 XER",
        xerImportScope: "PROJECT, TASK, TASKPRED وCALENDAR حيث تتوافر.",
        xerImportTip:
          "المستورد محلي؛ راجع النشاط والعلاقات والتقويم في الملخص قبل تشغيل TIA.",
        xerInputTitle:
          "تتم قراءة ملف XER داخل المتصفح ولا يتم إرساله لخدمة تحليل خارجية.",
        xerChoose: "اختيار XER",
        xerReading: "جارِ القراءة…",
        xerProgress: "جارِ قراءة شبكة XER والتقويم والموارد…",
        jsonImportTitle: "استيراد JSON كامل",
        jsonImportFields: "name, startDate, activities, relationships.",
        choose: "اختيار",
        activitiesCsvTitle: "1. CSV الأنشطة",
        activityCsvFields: "id, name, duration, wbs, owner",
        upload: "تحميل",
        relationshipsCsvTitle: "2. CSV العلاقات",
        relationshipCsvFields: "predecessorId, successorId, type, lag",
        xerSummaryTitle: "ملخص استيراد XER:",
        activities: "نشاط",
        relationships: "علاقة",
        noCalendarRecord: "بدون سجل تقويم",
        xerSummaryNote:
          "راجع جدول العمل والعطل، لأن نمط تقويم P6 المشفر لا يُفك تلقائياً.",
        workingCalendar: "WORKING CALENDAR",
        calendarDays: "أيام تقويمية",
        calendarEngineText:
          "المحرك يعرض ES/EF بأيام العمل ويحّول تاريخ الإكمال بهذا التقويم.",
        projectCountry: "بلد المشروع",
        selectProjectCountry: "اختَر بلد المشروع",
        customProjectCalendar: "تقويم مشروع مخصص",
        holidayYear: "سنة الإجازات",
        updateHolidays: "تحديث الإجازات",
        fiveDays: "5 أيام",
        mondayFriday: "الإثنين–الجمعة",
        sevenDays: "7 أيام",
        exceptionalHoliday: "عطلة استثنائية",
        add: "إضافة",
        noExceptionalHolidays: "لا توجد عطل استثنائية مدخلة.",
        source: "المصدر:",
        manualEntry: "إدخال يدوي",
        lastUpdated: "آخر تحديث",
        holidayReviewRequired:
          "راجع العيد المتغير وقرار الترحيل قبل اعتماد الحساب.",
      };
}

/**
 * Translates only fixed event and Fragnet workflow chrome. Event titles and
 * descriptions, activity IDs/names, relationship IDs, calendar names, and
 * CPM/TIA output remain source values rendered by the caller unchanged.
 */
export function formatEventWorkspaceCopy(language: AppLanguage) {
  return language === "en"
    ? {
        modelImpact: "MODEL THE IMPACT",
        heading: "Add a delay event as a Fragnet",
        description:
          "Choose to insert the event on an existing relationship, or split an affected activity into pre-event, event, and post-event within an independent TIA copy.",
        builder: "FRAGNET BUILDER",
        eventDetails: "Event details",
        eventTitle: "Event title",
        occurrenceDate: "Occurrence date",
        durationWorkingDays: "Event duration (working days)",
        evidenceAssumption: "Evidence / assumption description",
        causeClassification: "Cause classification",
        modellingMethod: "Event modelling method",
        insertBetweenRelationship: "Insert Fragnet between a relationship",
        splitAffectedActivity: "Split affected activity: Pre / Event / Post",
        affectedActivity: "Activity where the event occurred",
        selectAffectedActivity: "Select affected activity",
        replaceRelationship: "Relationship the Fragnet will replace",
        selectRelationship: "Select relationship",
        dayUnit: "days",
        proposedLogicPath: "Proposed logic path before approval",
        selectActivityPreview: "Select an affected activity to preview the split",
        selectRelationshipPreview: "Select a logic relationship",
        splitPostOnly: "The split is created only in Post-TIA and does not change the original XER.",
        eventUsesCalendar: (calendarName: string) =>
          `The event will use “${calendarName}” when converting the completion date.`,
        timeImpactOnly:
          "The tool measures time impact; it does not decide compensation or contractual entitlement on its own.",
        approveAndRun: "Approve model and run TIA",
        selectedCopy: "Selected copy",
        selectedCopyText:
          "Use an update suitable for the period before the event, with the known progress status.",
        logicNotName: "Logic, not the name",
        logicNotNameText:
          "A small network with realistic links is better than one isolated activity.",
        approveThenCalculate: "Approve, then calculate",
        approveThenCalculateText:
          "Review Pre/Event/Post or the relationship before building Post-TIA and reading the difference.",
        calendar: "Calendar:",
        calendarDays: "Calendar days",
      }
    : {
        modelImpact: "نمذجة الأثر",
        heading: "أضف حدث تأخير كـ Fragnet",
        description:
          "اختر إدراج الحدث على علاقة قائمة، أو قسّم نشاطاً متأثراً إلى ما قبل الحدث والحدث وما بعده داخل نسخة TIA مستقلة.",
        builder: "منشئ Fragnet",
        eventDetails: "بيانات الحدث",
        eventTitle: "عنوان الحدث",
        occurrenceDate: "تاريخ الحدوث",
        durationWorkingDays: "مدة الحدث (أيام عمل)",
        evidenceAssumption: "وصف الدليل/الافتراض",
        causeClassification: "تصنيف السبب",
        modellingMethod: "طريقة نمذجة الحدث",
        insertBetweenRelationship: "إدراج Fragnet بين علاقة",
        splitAffectedActivity: "تقسيم نشاط متأثر: Pre / Event / Post",
        affectedActivity: "النشاط الذي وقع الحدث داخله",
        selectAffectedActivity: "اختر النشاط المتأثر",
        replaceRelationship: "العلاقة التي سيحل محلها الـ Fragnet",
        selectRelationship: "اختر علاقة",
        dayUnit: "يوم",
        proposedLogicPath: "المسار المنطقي المقترح قبل الاعتماد",
        selectActivityPreview: "اختر نشاطاً متأثراً لمعاينة التقسيم",
        selectRelationshipPreview: "اختر علاقة منطقية",
        splitPostOnly: "يُنشأ التقسيم في Post‑TIA فقط ولا يعدّل XER الأصلي.",
        eventUsesCalendar: (calendarName: string) =>
          `الحدث سيستخدم تقويم «${calendarName}» عند تحويل تاريخ الإكمال.`,
        timeImpactOnly:
          "الأداة تقيس الأثر الزمني؛ لا تحكم وحدها على التعويض أو الاستحقاق التعاقدي.",
        approveAndRun: "اعتماد النموذج وتشغيل TIA",
        selectedCopy: "النسخة المختارة",
        selectedCopyText:
          "استخدم تحديثاً مناسباً قبل الحدث، مع حالة التقدم المعروفة.",
        logicNotName: "المنطق لا الاسم",
        logicNotNameText: "شبكة صغيرة وروابط واقعية أفضل من نشاط واحد معزول.",
        approveThenCalculate: "اعتمد ثم احسب",
        approveThenCalculateText:
          "راجع Pre/Event/Post أو العلاقة قبل بناء Post‑TIA وقراءة الفرق.",
        calendar: "تقويم:",
        calendarDays: "أيام تقويمية",
      };
}

const baseSchedule: Schedule = {
  id: "baseline-building-envelope",
  name: "برج النخيل — تحديث البرنامج رقم 04",
  startDate: "2026-01-05",
  dataDate: "2026-01-17",
  calendar: {
    id: "palm-egypt-six-day",
    name: "تقويم المشروع — مصر (6 أيام)",
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    holidays: ["2026-01-26"],
    holidayLabels: { "2026-01-26": "إجازة تدريبية في النموذج" },
    hoursPerDay: 8,
    countryCode: "EG",
    holidaySource: "نموذج تدريبي — راجع الإجازات الفعلية",
    holidayReviewRequired: true,
  },
  source: "manual",
  activities: [
    {
      id: "A100",
      name: "التجهيزات والتعبئة",
      duration: 5,
      wbs: "1.1",
      owner: "المقاول",
      plannedStart: 0,
    },
    {
      id: "A200",
      name: "أعمال الأساسات",
      duration: 8,
      wbs: "1.2",
      owner: "المقاول",
    },
    {
      id: "A300",
      name: "الهيكل الخرساني",
      duration: 10,
      wbs: "1.3",
      owner: "المقاول",
    },
    {
      id: "A400",
      name: "واجهة المبنى",
      duration: 7,
      wbs: "1.4",
      owner: "المقاول",
    },
    {
      id: "B100",
      name: "توريد التجهيزات",
      duration: 5,
      wbs: "2.1",
      owner: "المقاول",
      plannedStart: 0,
    },
    {
      id: "B200",
      name: "تركيب التجهيزات",
      duration: 5,
      wbs: "2.2",
      owner: "المقاول",
    },
  ],
  relationships: [
    { id: "R1", predecessorId: "A100", successorId: "A200", type: "FS" },
    { id: "R2", predecessorId: "A200", successorId: "A300", type: "FS" },
    { id: "R3", predecessorId: "A300", successorId: "A400", type: "FS" },
    { id: "R4", predecessorId: "B100", successorId: "B200", type: "FS" },
  ],
};

const initialEvent: Fragnet = {
  id: "EV-001",
  title: "تأخر اعتماد الرسومات المعدلة",
  cause: "employer",
  occurrenceDate: "2026-01-20",
  description:
    "مدة مراجعة وإصدار رسومات هيكلية إضافية مطلوبة قبل بدء أعمال الواجهة.",
  activities: [
    {
      id: "FR-001",
      name: "مراجعة واعتماد الرسومات المعدلة",
      duration: 6,
      wbs: "CO-01",
      owner: "صاحب العمل",
      kind: "fragnet",
    },
  ],
  relationships: [
    { id: "FR-R1", predecessorId: "A300", successorId: "FR-001", type: "FS" },
    { id: "FR-R2", predecessorId: "FR-001", successorId: "A400", type: "FS" },
  ],
  replacedRelationshipIds: ["R3"],
};

function defaultWindow(schedule: Schedule): AnalysisWindow {
  /** Architectural Control Room: a new analysis window must follow the imported CPM network, never a demo-project date. */
  const completionDate = runCPM(schedule).completionDate;
  return {
    id: "WIN-001",
    name: "نافذة التحليل الأساسية",
    from: schedule.startDate,
    to: completionDate,
    scheduleId: schedule.id,
    status: "review",
    notes:
      "تغطي هذه النافذة البرنامج المستورد من تاريخ البدء إلى الإكمال المحسوب قبل إدراج أي Fragnet.",
  };
}

const navItems: { key: ViewKey; label: string; labelEn: string; icon: typeof Network }[] = [
  { key: "guided", label: "1. ابدأ التحليل", labelEn: "1. Start analysis", icon: Play },
  { key: "guide", label: "دليل بالصور", labelEn: "Visual guide", icon: CircleHelp },
  { key: "overview", label: "لوحة المتابعة", labelEn: "Dashboard", icon: BarChart3 },
  { key: "schedule", label: "2. ارفع برنامج P6", labelEn: "2. Import P6 schedule", icon: Network },
  { key: "quality", label: "2.1 فحص جودة الجدول", labelEn: "2.1 Schedule quality", icon: ShieldCheck },
  { key: "issues", label: "3. سجّل الواقعة", labelEn: "3. Record issue", icon: ClipboardList },
  { key: "claimConsole", label: "Claim Console", labelEn: "Claim Console", icon: Scale },
  { key: "event", label: "4. نمذجة الحدث (Fragnet)", labelEn: "4. Model event (Fragnet)", icon: Zap },
  { key: "analysis", label: "5. نتيجة التحليل", labelEn: "5. Analysis result", icon: ScanSearch },
  { key: "report", label: "6. تقرير المطالبة", labelEn: "6. Claim report", icon: TextQuote },
  { key: "windows", label: "نوافذ وتزامن", labelEn: "Windows & concurrency", icon: CalendarClock },
  { key: "financial", label: "الأثر المالي", labelEn: "Financial impact", icon: WalletCards },
  { key: "notices", label: "سجل Notices", labelEn: "Notice register", icon: BellRing },
  { key: "review", label: "الاعتماد الإلكتروني", labelEn: "Electronic review", icon: ClipboardCheck },
  { key: "members", label: "أعضاء المشروع", labelEn: "Project members", icon: UsersRound },
  { key: "compare", label: "مقارنة التحديثات", labelEn: "Compare updates", icon: GitCompareArrows },
  { key: "xerViewer", label: "معاينة XER قبل P6", labelEn: "Review XER before P6", icon: FileCode2 },
  { key: "resources", label: "الأدلة والملفات", labelEn: "Guides & files", icon: HardDriveDownload },
  { key: "learning", label: "التدريب والشرح", labelEn: "Training", icon: BookOpenCheck },
  { key: "methods", label: "الموسوعة العلمية (SCL)", labelEn: "Technical library (SCL)", icon: LibraryBig },
];

function navigationLabel(item: (typeof navItems)[number], language: "ar" | "en") {
  return language === "en" ? item.labelEn : item.label;
}

function getInitialView(): ViewKey {
  const requested = new URLSearchParams(window.location.search).get("screen");
  return navItems.some(item => item.key === requested)
    ? (requested as ViewKey)
    : "guided";
}

const causeLabel: Record<DelayCause, string> = {
  employer: "صاحب العمل",
  contractor: "المقاول",
  neutral: "محايد / قوة قاهرة",
  concurrent: "متزامن",
};
const weekdayLabels = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function tryRestore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseCsv(raw: string) {
  const rows: string[][] = [];
  let value = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw new Error("ملف CSV يحتاج صف عناوين وصف بيانات واحد على الأقل.");
  const headers = rows[0].map(header =>
    header.toLowerCase().replace(/\s+/g, "")
  );
  return rows
    .slice(1)
    .map(cells =>
      Object.fromEntries(
        headers.map((header, index) => [header, cells[index] ?? ""])
      )
    );
}

function downloadText(
  name: string,
  content: string,
  type = "application/json"
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateLabel(date: string) {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

function MetricCard({
  label,
  value,
  helper,
  tone = "blue",
  featured = false,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "blue" | "orange" | "green" | "graphite";
  featured?: boolean;
}) {
  return (
    <div
      className={`metric-card metric-card--${tone} ${featured ? "metric-card--featured" : ""}`}
    >
      <p>{label}</p>
      <strong dir="ltr">{value}</strong>
      <span>{helper}</span>
    </div>
  );
}

function StatusBadge({
  result,
}: {
  result: TiaResult | WindowTiaResult | null;
}) {
  if (!result) return <Badge className="badge-muted">غير محسوب</Badge>;
  const days =
    "totalImpactDays" in result ? result.totalImpactDays : result.impactDays;
  if (days > 0)
    return <Badge className="badge-delay">أثر حرج على الإكمال</Badge>;
  if (days === 0)
    return <Badge className="badge-float">عائمة / دون تمديد</Badge>;
  return <Badge className="badge-muted">تاريخ إكمال أبكر</Badge>;
}

function Timeline({ cpm }: { cpm: ReturnType<typeof runCPM> }) {
  const max = Math.max(cpm.projectDuration, 1);
  const weeks = Array.from(
    { length: Math.ceil(max / 5) + 1 },
    (_, index) => index * 5
  );
  return (
    <div className="timeline-wrap" dir="ltr">
      <div className="timeline-axis">
        <span>Activity</span>
        <div className="axis-days">
          {weeks.map(week => (
            <i key={week} style={{ left: `${(week / max) * 100}%` }}>
              D{week}
            </i>
          ))}
        </div>
      </div>
      <div className="timeline-body">
        {cpm.activities.map(activity => (
          <div className="timeline-row" key={activity.id}>
            <div className="timeline-label">
              <b>{activity.id}</b>
              <span>{activity.name}</span>
            </div>
            <div className="timeline-track">
              {weeks.map(week => (
                <i
                  className="week-grid"
                  key={week}
                  style={{ left: `${(week / max) * 100}%` }}
                />
              ))}
              <span
                className={`gantt-bar ${activity.kind === "fragnet" ? "gantt-bar--fragnet" : activity.isCritical ? "gantt-bar--critical" : ""}`}
                style={{
                  left: `${(activity.earlyStart / max) * 100}%`,
                  width: `${Math.max((activity.duration / max) * 100, 1.4)}%`,
                }}
              >
                <em>{activity.duration}d</em>
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="timeline-legend">
        <span>
          <i className="legend-critical" />
          مسار حرج
        </span>
        <span>
          <i className="legend-fragnet" />
          Fragnet
        </span>
        <span>
          <i className="legend-base" />
          غير حرج
        </span>
      </div>
      <p className="timeline-caption">
        تظهر ES/EF والعائمة بأيام عمل. يحول تاريخ الإكمال حسب التقويم المحدد.
      </p>
    </div>
  );
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, direction } = useAppLanguage();

  const [view, setView] = useState<ViewKey>(getInitialView);
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(() =>
    new URLSearchParams(window.location.search).get("skipIntro") !== "1" &&
    shouldShowFirstRunGuide()
  );
  const [invitationToken] = useState(() =>
    new URLSearchParams(window.location.search).get("invite")
  );
  const [schedule, setSchedule] = useState<Schedule>(() =>
    tryRestore("tia-v2-schedule", baseSchedule)
  );
  const [events, setEvents] = useState<Fragnet[]>(() =>
    tryRestore("tia-v2-events", [initialEvent])
  );
  const [windows, setWindows] = useState<AnalysisWindow[]>(() =>
    tryRestore("tia-v2-windows", [defaultWindow(baseSchedule)])
  );
  const [selectedEventId, setSelectedEventId] = useState(() =>
    tryRestore("tia-v2-event", initialEvent.id)
  );
  const [selectedWindowId, setSelectedWindowId] = useState(() =>
    tryRestore("tia-v2-window", "WIN-001")
  );
  const [csvActivities, setCsvActivities] = useState<CsvActivity[] | null>(
    null
  );
  const [xerSummary, setXerSummary] = useState<XerImportSummary | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] =
    useState<ScheduleSnapshot | null>(null);
  const [updateSnapshots, setUpdateSnapshots] = useState<ScheduleSnapshot[]>(
    []
  );
  const [guidedMethod, setGuidedMethod] = useState<
    "TIA" | "Windows" | "Disruption" | "Quantity"
  >("TIA");
  const [journeyPath, setJourneyPath] = useState<"issue" | "direct" | null>(
    null
  );
  const [journeyStep, setJourneyStep] = useState(1);
  const [p6GateApproved, setP6GateApproved] = useState(false);
  const [qualityGateApproved, setQualityGateApproved] = useState(false);
  const [isXerImporting, setIsXerImporting] = useState(false);
  const [holidayInput, setHolidayInput] = useState("");
  const [holidayYear, setHolidayYear] = useState(() =>
    Number((schedule.dataDate ?? schedule.startDate).slice(0, 4))
  );
  const [isHolidaySyncing, setIsHolidaySyncing] = useState(false);
  const [eventTitle, setEventTitle] = useState("تأخر اعتماد مستند فني");
  const [eventDescription, setEventDescription] = useState(
    "يوثق هذا الـ Fragnet مدة الحدث ومنطقه بين نشاطين من البرنامج المعتمد."
  );
  const [eventDate, setEventDate] = useState(
    schedule.dataDate ?? schedule.startDate
  );
  const [eventDuration, setEventDuration] = useState("5");
  const [eventCause, setEventCause] = useState<DelayCause>("employer");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(
    schedule.relationships[0]?.id ?? ""
  );
  const [selectedActivityId, setSelectedActivityId] = useState(
    schedule.activities[0]?.id ?? ""
  );
  const [eventModel, setEventModel] = useState<
    "relationship" | "activity-split"
  >("relationship");
  const [newWindowName, setNewWindowName] = useState("نافذة مراجعة جديدة");
  const [newWindowFrom, setNewWindowFrom] = useState(schedule.startDate);
  const [newWindowTo, setNewWindowTo] = useState("2026-03-31");
  const [narrativeContext, setNarrativeContext] = useState({
    analyst: "",
    contractReference: "",
    evidenceSummary: "",
    claimPosition: "",
  });
  const [narrative, setNarrative] = useState("");
  const [activeClaim, setActiveClaim] = useState({
    key: `${schedule.id}:delay-claim`,
    narrative: "",
  });
  const activityFileRef = useRef<HTMLInputElement>(null);
  const relationshipFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const xerFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("tia-v2-schedule", JSON.stringify(schedule));
      window.localStorage.setItem("tia-v2-events", JSON.stringify(events));
      window.localStorage.setItem("tia-v2-windows", JSON.stringify(windows));
      window.localStorage.setItem(
        "tia-v2-event",
        JSON.stringify(selectedEventId)
      );
      window.localStorage.setItem(
        "tia-v2-window",
        JSON.stringify(selectedWindowId)
      );
    } catch {
      /* استمرار الجلسة لا يتوقف على التخزين */
    }
  }, [schedule, events, windows, selectedEventId, selectedWindowId]);

  const baselineState = useMemo(() => {
    try {
      return { value: runCPM(schedule), error: "" };
    } catch (error) {
      return {
        value: null,
        error:
          error instanceof Error
            ? error.message
            : formatHomeStatus(language, "cpmUnavailable"),
      };
    }
  }, [schedule, language]);
  const baseline = baselineState.value;
  const selectedEvent =
    events.find(event => event.id === selectedEventId) ?? null;
  const selectedWindow =
    windows.find(item => item.id === selectedWindowId) ?? windows[0] ?? null;
  const singleResultState = useMemo(() => {
    try {
      return {
        value: selectedEvent ? runTIA(schedule, selectedEvent) : null,
        error: "",
      };
    } catch (error) {
      return {
        value: null,
        error:
          error instanceof Error
            ? error.message
            : formatHomeStatus(language, "tiaUnavailable"),
      };
    }
  }, [schedule, selectedEvent, language]);
  const windowState = useMemo(() => {
    try {
      return {
        value:
          selectedWindow && selectedWindow.scheduleId === schedule.id
            ? runWindowTIA(schedule, selectedWindow, events)
            : null,
        error: "",
      };
    } catch (error) {
      return {
        value: null,
        error:
          error instanceof Error
            ? error.message
            : formatHomeStatus(language, "windowUnavailable"),
      };
    }
  }, [schedule, selectedWindow, events, language]);
  const analysis = singleResultState.value;
  const windowResult = windowState.value;
  const activeResult = windowResult ?? analysis;
  const activeImpact = activeResult
    ? "totalImpactDays" in activeResult
      ? activeResult.totalImpactDays
      : activeResult.impactDays
    : 0;
  const displayedCpm = activeResult?.impacted ?? baseline;
  const selectedRelationship = schedule.relationships.find(
    item => item.id === selectedRelationshipId
  );
  const selectedActivity = schedule.activities.find(
    item => item.id === selectedActivityId
  );
  const handleActiveClaimChange = useCallback(
    (key: string, unifiedNarrative: string) => {
      setActiveClaim(previous =>
        previous.key === key && previous.narrative === unifiedNarrative
          ? previous
          : { key, narrative: unifiedNarrative }
      );
    },
    []
  );

  useEffect(() => {
    setNarrative(
      generateDelayAnalysisNarrative({
        schedule,
        result: windowResult ?? analysis,
        event: selectedEvent,
        context: narrativeContext,
      })
    );
  }, [schedule, selectedEventId, selectedWindowId, analysis, windowResult]);

  function resetForImported(imported: Schedule) {
    setSchedule(imported);
    setEvents([]);
    const nextWindow = defaultWindow(imported);
    setWindows([nextWindow]);
    setSelectedWindowId(nextWindow.id);
    setSelectedEventId("");
    setSelectedRelationshipId(imported.relationships[0]?.id ?? "");
    setSelectedActivityId(imported.activities[0]?.id ?? "");
    setEventModel("relationship");
    setEventDate(imported.dataDate ?? imported.startDate);
    setNewWindowFrom(imported.startDate);
    setHolidayYear(Number((imported.dataDate ?? imported.startDate).slice(0, 4)));
    setP6GateApproved(false);
    setQualityGateApproved(false);
  }
  function loadDemo() {
    resetForImported(baseSchedule);
    setEvents([initialEvent]);
    setSelectedEventId(initialEvent.id);
    setXerSummary(null);
    toast.success(formatHomeStatus(language, "demoLoaded"));
  }
  async function importJson(file: File) {
    try {
      const imported = JSON.parse(await file.text()) as Schedule;
      if (
        !imported.id ||
        !imported.name ||
        !imported.startDate ||
        !Array.isArray(imported.activities) ||
        !Array.isArray(imported.relationships)
      )
        throw new Error(formatHomeStatus(language, "invalidJsonShape"));
      imported.source = "json";
      runCPM(imported);
      resetForImported(imported);
      setXerSummary(null);
      toast.success(
        formatHomeStatus(language, "jsonImported", {
          activities: imported.activities.length,
          relationships: imported.relationships.length,
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "jsonReadFailure")
      );
    }
  }
  async function importXer(file: File) {
    setIsXerImporting(true);
    try {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );
      const result = importXerSchedule(await file.text(), file.name);
      runCPM(result.schedule);
      resetForImported(result.schedule);
      setXerSummary(result.summary);
      toast.success(
        formatHomeStatus(language, "xerImported", {
          activities: result.summary.activitiesRead,
          relationships: result.summary.relationshipsRead,
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "xerReadFailure")
      );
    } finally {
      setIsXerImporting(false);
    }
  }
  async function importJourneySchedule(stage: ScheduleStage, file: File) {
    setIsXerImporting(true);
    try {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      );
      const raw = await file.text();
      const lower = file.name.toLowerCase();
      let imported: Schedule;
      let summary: XerImportSummary | undefined;
      if (lower.endsWith(".xer")) {
        const result = importXerSchedule(raw, file.name);
        imported = result.schedule;
        summary = result.summary;
      } else if (lower.endsWith(".xml")) {
        const result = importP6XmlSchedule(raw, file.name);
        imported = result.schedule;
        summary = {
          ...result.summary,
          calendarName: undefined,
          tablesFound: [],
        };
      } else {
        imported = JSON.parse(raw) as Schedule;
        if (
          !imported.id ||
          !imported.name ||
          !Array.isArray(imported.activities) ||
          !Array.isArray(imported.relationships)
        )
          throw new Error(formatHomeStatus(language, "invalidJsonShape"));
      }
      runCPM(imported);
      const snapshot: ScheduleSnapshot = {
        id: `${stage}-${Date.now()}`,
        stage,
        fileName: file.name,
        schedule: imported,
        summary,
      };
      if (stage === "baseline") {
        setBaselineSnapshot(snapshot);
        setUpdateSnapshots([]);
        resetForImported(imported);
        setXerSummary(summary ?? null);
      } else if (stage === "pre-event-update") {
        resetForImported(imported);
        setUpdateSnapshots(previous => [
          ...previous.filter(item => item.stage !== "pre-event-update"),
          snapshot,
        ]);
        setXerSummary(summary ?? null);
      } else {
        setUpdateSnapshots(previous => [...previous, snapshot]);
      }
      toast.success(
        formatHomeStatus(language, "journeyImported", {
          stage:
            stage === "baseline"
              ? "Baseline"
              : stage === "pre-event-update"
                ? language === "en"
                  ? "Pre-event update"
                  : "Update قبل الحدث"
                : language === "en"
                  ? "Later update"
                  : "تحديث لاحق",
          scheduleName: imported.name,
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "journeyReadFailure")
      );
    } finally {
      setIsXerImporting(false);
    }
  }
  function applyWorkshopExcel(
    rows: Array<{
      title: string;
      occurrenceDate: string;
      proposedDurationDays: number;
      delayCause: "employer" | "contractor" | "neutral";
      affectedActivityIds: string[];
      replacedRelationshipId: string;
      description: string;
    }>
  ) {
    const first = rows[0];
    if (!first) return;
    setEventTitle(first.title);
    setEventDate(first.occurrenceDate);
    setEventDuration(String(first.proposedDurationDays));
    setEventCause(first.delayCause);
    setSelectedActivityId(first.affectedActivityIds[0] ?? "");
    setSelectedRelationshipId(first.replacedRelationshipId);
    setEventDescription(first.description);
    setEventModel("activity-split");
  }
  function prepareWorkshopSplit(input: {
    activityId: string;
    title: string;
    description: string;
    occurrenceDate: string;
    duration: number;
    cause: DelayCause;
  }) {
    setSelectedActivityId(input.activityId);
    setEventTitle(input.title);
    setEventDescription(input.description);
    setEventDate(input.occurrenceDate);
    setEventDuration(String(input.duration));
    setEventCause(input.cause);
    setEventModel("activity-split");
  }
  async function importActivitiesCsv(file: File) {
    try {
      const records = parseCsv(await file.text());
      const imported = records.map((record, index) => ({
        id:
          record.id ||
          record.activityid ||
          record.activity_id ||
          `ACT-${index + 1}`,
        name:
          record.name ||
          record.activityname ||
          record.activity_name ||
          `Activity ${index + 1}`,
        duration: Number(
          record.duration || record.durationdays || record.duration_days
        ),
        wbs: record.wbs || undefined,
        owner: record.owner || undefined,
        plannedStart:
          record.plannedstart || record.planned_start
            ? Number(record.plannedstart || record.planned_start)
            : undefined,
      }));
      if (
        imported.some(
          activity =>
            !Number.isFinite(activity.duration) || activity.duration < 0
        )
      )
        throw new Error(formatHomeStatus(language, "csvDurationInvalid"));
      setCsvActivities(imported);
      toast.success(
        formatHomeStatus(language, "activitiesCsvImported", {
          activities: imported.length,
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "csvReadFailure")
      );
    }
  }
  async function importRelationshipsCsv(file: File) {
    try {
      if (!csvActivities)
        throw new Error(formatHomeStatus(language, "activitiesFirst"));
      const records = parseCsv(await file.text());
      const relationships: Relationship[] = records.map((record, index) => ({
        id:
          record.id ||
          record.relationshipid ||
          record.relationship_id ||
          `REL-${index + 1}`,
        predecessorId:
          record.predecessorid ||
          record.predecessor_id ||
          record.predecessor ||
          record.pred,
        successorId:
          record.successorid ||
          record.successor_id ||
          record.successor ||
          record.succ,
        type: (record.type || "FS").toUpperCase() as RelationshipType,
        lag: record.lag ? Number(record.lag) : 0,
      }));
      const imported: Schedule = {
        id: `csv-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, "") || "برنامج CSV مستورد",
        startDate: schedule.startDate,
        dataDate: schedule.dataDate,
        activities: csvActivities,
        relationships,
        calendar: schedule.calendar,
        source: "csv",
      };
      runCPM(imported);
      resetForImported(imported);
      setXerSummary(null);
      toast.success(formatHomeStatus(language, "csvNetworkImported"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "relationshipsCsvReadFailure")
      );
    }
  }
  function createEvent() {
    if (
      (schedule.source === "xer" || schedule.source === "p6-xml") &&
      !p6GateApproved
    ) {
      setJourneyStep(2);
      setView("guided");
      toast.error(formatHomeStatus(language, "p6GateRequired"));
      return;
    }
    if (eventModel === "relationship" && !selectedRelationship) {
      toast.error(formatHomeStatus(language, "selectRelationship"));
      return;
    }
    if (eventModel === "activity-split" && !selectedActivityId) {
      toast.error(formatHomeStatus(language, "selectActivity"));
      return;
    }
    const duration = Number(eventDuration);
    if (!eventTitle.trim() || !Number.isFinite(duration) || duration < 0) {
      toast.error(formatHomeStatus(language, "invalidEvent"));
      return;
    }
    try {
      dateToRelativeDay(schedule.startDate, eventDate);
      const sequence = events.length + 1;
      const fragnetId = `EV-${String(sequence).padStart(3, "0")}`;
      const activityId = `FR-${String(sequence).padStart(3, "0")}`;
      const next: Fragnet =
        eventModel === "activity-split"
          ? buildActivitySplitFragnet(schedule, {
              id: fragnetId,
              title: eventTitle.trim(),
              description: eventDescription.trim(),
              cause: eventCause,
              occurrenceDate: eventDate,
              eventDuration: duration,
              targetActivityId: selectedActivityId,
            })
          : {
              id: fragnetId,
              title: eventTitle.trim(),
              description: eventDescription.trim(),
              cause: eventCause,
              occurrenceDate: eventDate,
              activities: [
                {
                  id: activityId,
                  name: eventTitle.trim(),
                  duration,
                  wbs: `TIA-${sequence}`,
                  owner: causeLabel[eventCause],
                  kind: "fragnet",
                },
              ],
              replacedRelationshipIds: [selectedRelationship!.id],
              relationships: [
                {
                  id: `${activityId}-IN`,
                  predecessorId: selectedRelationship!.predecessorId,
                  successorId: activityId,
                  type: selectedRelationship!.type,
                  lag: selectedRelationship!.lag ?? 0,
                },
                {
                  id: `${activityId}-OUT`,
                  predecessorId: activityId,
                  successorId: selectedRelationship!.successorId,
                  type: "FS",
                },
              ],
            };
      runTIA(schedule, next);
      setEvents(previous => [...previous, next]);
      setSelectedEventId(next.id);
      setJourneyStep(5);
      setView("analysis");
      toast.success(
        eventModel === "activity-split"
          ? formatHomeStatus(language, "eventSplitCreated")
          : formatHomeStatus(language, "eventCreated")
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "eventCreateFailed")
      );
    }
  }
  function removeEvent(id: string) {
    setEvents(previous => previous.filter(event => event.id !== id));
    setSelectedEventId(events.find(event => event.id !== id)?.id ?? "");
    toast.success(formatHomeStatus(language, "eventRemoved"));
  }
  function applyIssueFragnet(event: Fragnet) {
    try {
      runTIA(schedule, event);
      setEvents(previous => [...previous, event]);
      setSelectedEventId(event.id);
      setView("analysis");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "issueFragnetFailed")
      );
    }
  }
  function addWindow() {
    if (!newWindowName.trim() || newWindowFrom > newWindowTo) {
      toast.error(formatHomeStatus(language, "invalidWindow"));
      return;
    }
    const item: AnalysisWindow = {
      id: `WIN-${String(windows.length + 1).padStart(3, "0")}`,
      name: newWindowName.trim(),
      from: newWindowFrom,
      to: newWindowTo,
      scheduleId: schedule.id,
      status: "draft",
      notes: "نافذة أضيفت محلياً للمراجعة.",
    };
    setWindows(previous => [...previous, item]);
    setSelectedWindowId(item.id);
    setView("windows");
    toast.success(formatHomeStatus(language, "windowCreated"));
  }
  function toggleWeekday(day: number) {
    const current = schedule.calendar ?? calendarDayCalendar;
    const next = current.workingWeekdays.includes(day)
      ? current.workingWeekdays.filter(value => value !== day)
      : [...current.workingWeekdays, day].sort((a, b) => a - b);
    if (!next.length) {
      toast.error(formatHomeStatus(language, "weekdayRequired"));
      return;
    }
    setSchedule(previous => ({
      ...previous,
      calendar: {
        ...(previous.calendar ?? calendarDayCalendar),
        workingWeekdays: next,
      },
    }));
  }
  function setCalendarPreset(kind: "calendar" | "five") {
    const source = kind === "calendar" ? calendarDayCalendar : fiveDayCalendar;
    setSchedule(previous => ({
      ...previous,
      calendar: {
        ...source,
        id: previous.calendar?.id ?? source.id,
        name:
          kind === "calendar"
            ? "أيام تقويمية (7/7)"
            : "أسبوع عمل 5 أيام (الإثنين–الجمعة)",
        holidays: previous.calendar?.holidays ?? [],
        holidayLabels: previous.calendar?.holidayLabels,
        countryCode: previous.calendar?.countryCode,
        holidaySource: previous.calendar?.holidaySource,
        holidaysLastCheckedAt: previous.calendar?.holidaysLastCheckedAt,
        holidayReviewRequired: previous.calendar?.holidayReviewRequired,
      },
    }));
  }
  function applyRegionalCalendar(countryCode: string) {
    const country = findRegionalCalendarCountry(countryCode);
    if (!country) return;
    setSchedule(previous => ({
      ...previous,
      calendar: regionalCalendarForCountry(country, previous.calendar),
    }));
    void syncRegionalHolidays(countryCode);
  }
  async function syncRegionalHolidays(countryCode?: string) {
    const country = findRegionalCalendarCountry(
      countryCode ?? schedule.calendar?.countryCode
    );
    if (!country) {
      toast.error(formatHomeStatus(language, "countryRequired"));
      return;
    }
    setIsHolidaySyncing(true);
    try {
      const loaded = await loadPublicHolidays(
        country.holidayCountryCode,
        holidayYear
      );
      const labels = Object.fromEntries(
        loaded.map(holiday => [holiday.date, holiday.label])
      );
      setSchedule(previous => {
        const calendar = previous.calendar ?? regionalCalendarForCountry(country);
        return {
          ...previous,
          calendar: {
            ...calendar,
            countryCode: country.code,
            holidays: Array.from(
              new Set([...calendar.holidays, ...loaded.map(item => item.date)])
            ).sort(),
            holidayLabels: { ...calendar.holidayLabels, ...labels },
            holidaySource: `Nager.Date — ${holidayYear}`,
            holidaysLastCheckedAt: new Date().toISOString(),
            holidayReviewRequired: true,
          },
        };
      });
      toast.success(
        formatHomeStatus(language, "holidaysSynced", {
          holidays: loaded.length,
          country: country.label.split(" — ")[0],
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : formatHomeStatus(language, "holidaysSyncFailure")
      );
    } finally {
      setIsHolidaySyncing(false);
    }
  }
  function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayInput)) {
      toast.error(formatHomeStatus(language, "holidayDateInvalid"));
      return;
    }
    setSchedule(previous => {
      const calendar = previous.calendar ?? calendarDayCalendar;
      return {
        ...previous,
        calendar: {
          ...calendar,
          holidays: Array.from(
            new Set([...calendar.holidays, holidayInput])
          ).sort(),
          holidayLabels: {
            ...calendar.holidayLabels,
            [holidayInput]: "إجازة أضافها المستخدم",
          },
          holidayReviewRequired: true,
        },
      };
    });
    setHolidayInput("");
  }
  function removeHoliday(day: string) {
    setSchedule(previous => {
      const calendar = previous.calendar ?? calendarDayCalendar;
      return {
        ...previous,
        calendar: {
          ...calendar,
          holidays: calendar.holidays.filter(item => item !== day),
          holidayLabels: Object.fromEntries(
            Object.entries(calendar.holidayLabels ?? {}).filter(
              ([date]) => date !== day
            )
          ),
          holidayReviewRequired: true,
        },
      };
    });
  }
  function exportSchedule() {
    downloadText("tia-studio-schedule.json", JSON.stringify(schedule, null, 2));
    toast.success(formatHomeStatus(language, "scheduleExported"));
  }
  function exportAnalysis() {
    if (!activeResult) return;
    downloadText(
      "tia-studio-analysis.json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          methodology: "TIA Studio — CPM/TIA",
          schedule,
          events,
          selectedWindow,
          result: activeResult,
          narrative,
        },
        null,
        2
      )
    );
    toast.success(formatHomeStatus(language, "analysisExported"));
  }

  const chrome = formatHomeChrome(language);
  const overview = formatHomeOverview(language);
  const scheduleWorkspace = formatScheduleWorkspaceCopy(language);
  const eventWorkspace = formatEventWorkspaceCopy(language);
  const qualityItems = [
    {
      ok: Boolean(baseline),
      text: chrome.qualityNetwork,
    },
    {
      ok: Boolean(schedule.calendar?.workingWeekdays.length),
      text: chrome.qualityCalendar,
    },
    { ok: Boolean(events.length), text: chrome.qualityFragnet },
    { ok: Boolean(activeResult), text: chrome.qualityAnalysis },
  ];

  return (
    <div className="app-shell" dir={direction}>
      <FirstRunGuide
        open={showFirstRunGuide}
        onOpenChange={setShowFirstRunGuide}
        onStartAnalysis={() => {
          setJourneyPath(null);
          setJourneyStep(1);
          setView("guided");
          window.requestAnimationFrame(() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          );
        }}
      />
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-mark" src={logoUrl} alt="TIA Studio" />
          <div>
            <b>TIA Studio</b>
            <span>{chrome.workspaceSubtitle}</span>
          </div>
        </div>
        <div className="project-chip">
          <span className="project-dot" />
          <div>
            <small>{chrome.scheduleSource} / {schedule.source ?? "manual"}</small>
            <b>{schedule.name}</b>
          </div>
        </div>
        <nav className="main-nav" aria-label={chrome.mainNavigation}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={view === item.key ? "nav-item active" : "nav-item"}
              >
                <Icon size={18} />
                <span>{navigationLabel(item, language)}</span>
                {item.key === "analysis" && activeImpact ? (
                  <em>+{activeImpact}</em>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="method-card">
          <BookOpenCheck size={18} />
          <strong>{chrome.workflowTitle}</strong>
          <p>{chrome.workflowText}</p>
          <button onClick={() => setView("methods")}>
            {chrome.openSclGuide} <ChevronLeft size={15} />
          </button>
        </div>
        <div className="local-note">
          <ShieldCheck size={16} />
          <span>{chrome.accountEvidence}</span>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumbs">
            <span>{chrome.projects}</span>
            <ChevronLeft size={14} />
            <b>{schedule.name}</b>
            <ChevronLeft size={14} />
            <strong>{(() => { const item = navItems.find(candidate => candidate.key === view); return item ? navigationLabel(item, language) : ""; })()}</strong>
          </div>
          <div className="top-actions">
            <label className="sr-only" htmlFor="interface-language">{chrome.interfaceLanguage}</label>
            <select
              id="interface-language"
              className="outline-action h-9 rounded-md border border-input bg-background px-2 text-sm font-medium"
              value={language}
              onChange={event => setLanguage(event.target.value as "ar" | "en")}
              aria-label={chrome.interfaceLanguage}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
            <Button
              variant="outline"
              className="outline-action"
              onClick={() => {
                setView("guide");
                window.requestAnimationFrame(() =>
                  window.scrollTo({ top: 0, behavior: "smooth" })
                );
              }}
            >
              <CircleHelp size={16} />
              {chrome.howToUse}
            </Button>
            <Button
              variant="outline"
              className="outline-action"
              onClick={() => {
                setView("resources");
                window.requestAnimationFrame(() =>
                  window.scrollTo({ top: 0, behavior: "smooth" })
                );
              }}
            >
              <HardDriveDownload size={16} />
              {chrome.downloadWindows}
            </Button>
            <Button
              variant="outline"
              className="outline-action"
              onClick={exportSchedule}
            >
              <Download size={16} />
              {chrome.exportSchedule}
            </Button>
            <Button
              className="run-button"
              onClick={() => {
                if (activeResult) {
                  setView("analysis");
                  toast.success(formatHomeStatus(language, "calculationUpdated"));
                } else {
                  setJourneyPath(null);
                  setJourneyStep(1);
                  setView("guided");
                  toast.message(formatHomeStatus(language, "analysisJourneyStarted"));
                  window.requestAnimationFrame(() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  );
                }
              }}
            >
              <Play size={16} fill="currentColor" />
              {chrome.runAnalysis}
            </Button>
          </div>
        </header>
        <ProjectInvitationAcceptPanel
          token={invitationToken}
          isAuthenticated={isAuthenticated}
          onAccepted={() => setView("members")}
        />
        <section className="critical-ribbon">
          <div className="ribbon-label">
            <Route size={17} />
            <span>{chrome.criticalPath}</span>
          </div>
          <div className="path-nodes" dir="ltr">
            {displayedCpm?.criticalActivityIds
              .slice(0, 6)
              .map((id, index, ids) => (
                <span key={id}>
                  {id}
                  {index < ids.length - 1 && <i />}
                </span>
              ))}
          </div>
          <div className="ribbon-date">
            <small>{chrome.expectedCompletion}</small>
            <b dir="ltr">{displayedCpm?.completionDate ?? "—"}</b>
          </div>
          <StatusBadge result={activeResult} />
        </section>
        <ClaimContinuityPanel
          view={view === "guide" || view === "xerViewer" || view === "claimConsole" ? "guided" : view}
          schedule={schedule}
          events={events}
          selectedWindow={selectedWindow}
          isAuthenticated={isAuthenticated}
          onActiveClaimChange={handleActiveClaimChange}
        />
        <IssueLogPanel
          view={view === "guide" || view === "xerViewer" || view === "claimConsole" ? "guided" : view}
          schedule={schedule}
          existingEvents={events}
          isAuthenticated={isAuthenticated}
          onApplyFragnet={applyIssueFragnet}
        />
        <ClaimConsolePanel
          view={view}
          schedule={schedule}
          isAuthenticated={isAuthenticated}
          onNavigate={next => setView(next)}
          onActiveClaimChange={handleActiveClaimChange}
        />
        <P6EvidenceReportPanel
          view={view === "guide" || view === "xerViewer" || view === "claimConsole" ? "guided" : view}
          schedule={schedule}
          events={events}
          selectedEvent={selectedEvent}
          activeResult={activeResult}
          narrative={activeClaim.narrative || narrative}
          claimKey={activeClaim.key}
          isAuthenticated={isAuthenticated}
          onScheduleImported={imported => {
            runCPM(imported);
            resetForImported(imported);
            setXerSummary(null);
            toast.success(formatHomeStatus(language, "p6XmlImported"));
          }}
        />
        <FinancialNoticeReviewPanel
          view={view === "guide" || view === "xerViewer" || view === "claimConsole" ? "guided" : view}
          schedule={schedule}
          events={events}
          selectedEvent={selectedEvent}
          activeImpactDays={activeImpact}
          isAuthenticated={isAuthenticated}
          claimKey={activeClaim.key}
          unifiedNarrative={activeClaim.narrative}
        />
        <ProjectResourcesPanel view={view} />
        <ScheduleQualityPanel
          view={view}
          schedule={schedule}
          xerSummary={xerSummary}
          onNavigate={next => setView(next)}
        />
        {view === "xerViewer" && <XerViewerPanel
          schedule={schedule}
          xerSummary={xerSummary}
          baselineSnapshot={baselineSnapshot}
          updateSnapshots={updateSnapshots}
          onNavigate={next => setView(next)}
        />}
        <KnowledgeCentrePanel
          view={view}
          projectKey={schedule.id}
          isAuthenticated={isAuthenticated}
          onBeginGuidedAnalysis={route => {
            const methods = {
              tia: "TIA",
              windows: "Windows",
              disruption: "Disruption",
              quantity: "Quantity",
            } as const;
            setGuidedMethod(methods[route.method]);
            setJourneyPath(route.journeyPath);
            setJourneyStep(2);
            setView("guided");
            window.requestAnimationFrame(() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            );
          }}
        />
        <UserGuidePanel
          view={view}
          onNavigate={next => {
            setView(next);
            window.requestAnimationFrame(() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            );
          }}
        />
        {view === "guided" && (
          <GuidedAnalysisPanel
            schedule={schedule}
            xerSummary={xerSummary}
            journeyStep={journeyStep}
            journeyPath={journeyPath}
            p6GateApproved={p6GateApproved}
            qualityGateApproved={qualityGateApproved}
            isXerImporting={isXerImporting}
            baselineSnapshot={baselineSnapshot}
            updateSnapshots={updateSnapshots}
            initialMethod={guidedMethod}
            onJourneyPathChange={setJourneyPath}
            onJourneyStepChange={setJourneyStep}
            onP6GateApprovedChange={setP6GateApproved}
            onQualityGateApprovedChange={setQualityGateApproved}
            onScheduleUpload={importJourneySchedule}
            onApplyIssueExcel={applyWorkshopExcel}
            onPrepareSplit={prepareWorkshopSplit}
            onNavigate={next => setView(next)}
          />
        )}
        {baselineState.error || singleResultState.error || windowState.error ? (
          <div className="analysis-error">
            <AlertTriangle size={18} />
            <div>
              <b>{chrome.networkError}</b>
              <span>
                {baselineState.error ||
                  singleResultState.error ||
                  windowState.error}
              </span>
            </div>
          </div>
        ) : null}

        {view === "overview" && (
          <div className="view-stack overview-view">
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">
                  <ActivityIcon size={15} />
                  {overview.decisionCentre} · {selectedWindow?.name ?? overview.noWindow}
                </p>
                <span className="finding-label">{overview.currentTechnicalImpact}</span>
                <h1>
                  {activeImpact ? (
                    <>
                      <b dir="ltr">+{activeImpact}</b> {overview.workingDaysOnCompletion}
                    </>
                  ) : (
                    overview.noCriticalImpact
                  )}
                </h1>
                <p>
                  {overview.decisionBasisPrefix} <b>{schedule.name}</b> {overview.decisionBasisMiddle} «
                  {baseline?.calendar.name ?? "—"}»{overview.decisionBasisSuffix}
                </p>
                <div className="signature-path" dir="ltr">
                  {displayedCpm?.criticalActivityIds
                    .slice(0, 4)
                    .map((id, index, ids) => (
                      <span key={id}>
                        {id}
                        {index < ids.length - 1 && <i />}
                      </span>
                    ))}
                  <strong>{selectedEvent?.activities[0]?.id ?? "FR"}</strong>
                  <em>{overview.criticalRoute}</em>
                </div>
                <div className="hero-actions">
                  <Button
                    className="run-button"
                    onClick={() => setView("event")}
                  >
                    <Plus size={17} />
                    {overview.modelNewEvent}
                  </Button>
                  <Button
                    variant="ghost"
                    className="ghost-link"
                    onClick={() => setView("windows")}
                  >
                    {overview.reviewWindowAndConcurrency} <ChevronLeft size={16} />
                  </Button>
                </div>
              </div>
              <div
                className="hero-art"
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(246,242,234,.98) 0%, rgba(246,242,234,.76) 43%, rgba(246,242,234,.08) 70%), url(${workspaceImageUrl})`,
                }}
              >
                <div className="hero-art-tag">
                  <span>{overview.liveAnalysisCanvas}</span>
                  <b>
                    {events.length} {overview.events} · {windows.length} {overview.windows}
                  </b>
                </div>
                <div className="canvas-date">
                  <small>{overview.forecastFinish}</small>
                  <b dir="ltr">{displayedCpm?.completionDate ?? "—"}</b>
                </div>
              </div>
            </section>
            <section className="metrics-grid">
              <MetricCard
                label={overview.baselineDate}
                value={baseline?.completionDate ?? "—"}
                helper={overview.basedOnApprovedCalendar}
                tone="graphite"
              />
              <MetricCard
                label={overview.timeImpact}
                value={`${activeImpact > 0 ? "+" : ""}${activeImpact} يوم`}
                helper={overview.currentWindowResult}
                tone={activeImpact > 0 ? "orange" : "green"}
                featured
              />
              <MetricCard
                label={overview.completionAfterAnalysis}
                value={displayedCpm?.completionDate ?? "—"}
                helper={overview.afterFragnetsInserted}
                tone="blue"
                featured
              />
              <MetricCard
                label={overview.concurrencyFindings}
                value={`${windowResult?.concurrentFindings.length ?? 0}`}
                helper={overview.causationReviewRequired}
                tone="graphite"
              />
            </section>
            <section className="overview-columns">
              <div className="panel event-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{overview.delayRegister}</p>
                    <h2>{overview.eventRegister}</h2>
                  </div>
                  <Button
                    variant="outline"
                    className="tiny-button"
                    onClick={() => setView("event")}
                  >
                    <Plus size={15} />
                    {overview.newEvent}
                  </Button>
                </div>
                <div className="event-list">
                  {events.length ? (
                    events.map(event => (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setView("analysis");
                        }}
                        className={
                          event.id === selectedEventId
                            ? "event-row selected"
                            : "event-row"
                        }
                      >
                        <span className="event-number">{event.id}</span>
                        <div>
                          <b>{event.title}</b>
                          <small>
                            {dateLabel(event.occurrenceDate)} ·{" "}
                            {causeLabel[event.cause]}
                          </small>
                        </div>
                        <strong className="impact-number">
                          {event.activities[0]?.duration} d
                        </strong>
                      </button>
                    ))
                  ) : (
                    <div className="empty-inline">
                      <Zap size={19} />
                      <span>{overview.noEventsYet}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="panel quality-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{overview.qualityGate}</p>
                    <h2>{overview.analysisReadiness}</h2>
                  </div>
                  <span className="quality-score">
                    {qualityItems.filter(item => item.ok).length}/4
                  </span>
                </div>
                <div className="quality-list">
                  {qualityItems.map(item => (
                    <div key={item.text}>
                      <span
                        className={item.ok ? "quality-icon ok" : "quality-icon"}
                      >
                        {item.ok ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <AlertTriangle size={17} />
                        )}
                      </span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
                {schedule.importNotes?.length ? (
                  <div className="warning-strip">
                    <AlertTriangle size={16} />
                    {schedule.importNotes[0]}
                  </div>
                ) : (
                  <div className="quality-footer">
                    <ShieldCheck size={16} />
                    {overview.qualityFooter}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {view === "schedule" && (
          <div className="view-stack schedule-view">
            <section className="page-heading">
              <div>
                <p className="eyebrow">{scheduleWorkspace.scheduleCalendar}</p>
                <h1>{scheduleWorkspace.scheduleHeading}</h1>
                <p>{scheduleWorkspace.scheduleDescription}</p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="outline"
                  className="outline-action"
                  onClick={loadDemo}
                >
                  <Sparkles size={16} />
                  {scheduleWorkspace.loadSample}
                </Button>
                <Button className="run-button" onClick={exportSchedule}>
                  <Download size={16} />
                  {scheduleWorkspace.downloadJson}
                </Button>
              </div>
            </section>
            <section className="import-deck import-deck--four">
              <div className="import-card primary-import">
                <FileCode2 size={21} />
                <div>
                  <b>{scheduleWorkspace.xerImportTitle}</b>
                  <p>{scheduleWorkspace.xerImportScope}</p>
                  <p className="import-tip">
                    <CircleHelp size={13} />
                    {scheduleWorkspace.xerImportTip}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="tiny-button"
                  disabled={isXerImporting}
                  title={scheduleWorkspace.xerInputTitle}
                  onClick={() => xerFileRef.current?.click()}
                >
                  {isXerImporting ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <Upload size={15} />
                  )}
                  {isXerImporting
                    ? scheduleWorkspace.xerReading
                    : scheduleWorkspace.xerChoose}
                </Button>
                <input
                  ref={xerFileRef}
                  type="file"
                  accept=".xer,text/plain"
                  hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) importXer(file);
                    event.currentTarget.value = "";
                  }}
                />
                {isXerImporting ? (
                  <div className="operation-progress" role="status">
                    <span />
                    {scheduleWorkspace.xerProgress}
                  </div>
                ) : null}
              </div>
              <div className="import-card">
                <FileText size={21} />
                <div>
                  <b>{scheduleWorkspace.jsonImportTitle}</b>
                  <p>{scheduleWorkspace.jsonImportFields}</p>
                </div>
                <Button
                  variant="outline"
                  className="tiny-button"
                  onClick={() => jsonFileRef.current?.click()}
                >
                  <Upload size={15} />
                  {scheduleWorkspace.choose}
                </Button>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) importJson(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="import-card">
                <FileSpreadsheet size={21} />
                <div>
                  <b>{scheduleWorkspace.activitiesCsvTitle}</b>
                  <p>{scheduleWorkspace.activityCsvFields}</p>
                </div>
                <Button
                  variant="outline"
                  className="tiny-button"
                  onClick={() => activityFileRef.current?.click()}
                >
                  <Upload size={15} />
                  {scheduleWorkspace.upload}
                </Button>
                <input
                  ref={activityFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) importActivitiesCsv(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="import-card">
                <GitBranch size={21} />
                <div>
                  <b>{scheduleWorkspace.relationshipsCsvTitle}</b>
                  <p>{scheduleWorkspace.relationshipCsvFields}</p>
                </div>
                <Button
                  variant="outline"
                  className="tiny-button"
                  onClick={() => relationshipFileRef.current?.click()}
                >
                  <Upload size={15} />
                  {scheduleWorkspace.upload}
                </Button>
                <input
                  ref={relationshipFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) importRelationshipsCsv(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </section>
            {xerSummary && (
              <section className="import-result">
                <FileCode2 size={18} />
                <div>
                  <b>
                    {scheduleWorkspace.xerSummaryTitle} {xerSummary.projectName}
                  </b>
                  <span>
                    {xerSummary.activitiesRead} {scheduleWorkspace.activities} ·{" "}
                    {xerSummary.relationshipsRead} {scheduleWorkspace.relationships} ·{" "}
                    {xerSummary.calendarName ?? scheduleWorkspace.noCalendarRecord}
                  </span>
                </div>
                <small>
                  {scheduleWorkspace.xerSummaryNote}
                </small>
              </section>
            )}
            <section className="calendar-workspace">
              <div className="panel calendar-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{scheduleWorkspace.workingCalendar}</p>
                    <h2>{schedule.calendar?.name ?? scheduleWorkspace.calendarDays}</h2>
                    <span>{scheduleWorkspace.calendarEngineText}</span>
                  </div>
                  <CalendarDays size={21} />
                </div>
                <div className="calendar-presets">
                  <div className="calendar-regional-controls">
                    <div>
                      <Label htmlFor="calendar-country">
                        {scheduleWorkspace.projectCountry}
                      </Label>
                      <Select
                        value={schedule.calendar?.countryCode ?? "custom"}
                        onValueChange={value => {
                          if (value !== "custom") applyRegionalCalendar(value);
                        }}
                      >
                        <SelectTrigger id="calendar-country" className="mt-1">
                          <SelectValue
                            placeholder={scheduleWorkspace.selectProjectCountry}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">
                            {scheduleWorkspace.customProjectCalendar}
                          </SelectItem>
                          {regionalCalendarCountries.map(country => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="holiday-year">
                        {scheduleWorkspace.holidayYear}
                      </Label>
                      <Input
                        id="holiday-year"
                        type="number"
                        min="2020"
                        max="2100"
                        value={holidayYear}
                        onChange={event => setHolidayYear(Number(event.target.value))}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="tiny-button regional-sync-button"
                      disabled={isHolidaySyncing || !schedule.calendar?.countryCode}
                      onClick={() => void syncRegionalHolidays()}
                    >
                      {isHolidaySyncing ? (
                        <LoaderCircle className="animate-spin" size={15} />
                      ) : (
                        <Download size={15} />
                      )}
                      {scheduleWorkspace.updateHolidays}
                    </Button>
                  </div>
                  <button
                    onClick={() => setCalendarPreset("five")}
                    className={
                      (schedule.calendar?.workingWeekdays.length ?? 7) === 5
                        ? "calendar-preset selected"
                        : "calendar-preset"
                    }
                  >
                    {scheduleWorkspace.fiveDays}
                    <br />
                    <small>{scheduleWorkspace.mondayFriday}</small>
                  </button>
                  <button
                    onClick={() => setCalendarPreset("calendar")}
                    className={
                      (schedule.calendar?.workingWeekdays.length ?? 7) === 7
                        ? "calendar-preset selected"
                        : "calendar-preset"
                    }
                  >
                    {scheduleWorkspace.sevenDays}
                    <br />
                    <small>{scheduleWorkspace.calendarDays}</small>
                  </button>
                </div>
                <div className="weekday-grid">
                  {weekdayLabels.map((label, day) => (
                    <button
                      key={label}
                      onClick={() => toggleWeekday(day)}
                      className={
                        (
                          schedule.calendar ?? calendarDayCalendar
                        ).workingWeekdays.includes(day)
                          ? "weekday active"
                          : "weekday"
                      }
                    >
                      {label.slice(0, 1)}
                    </button>
                  ))}
                </div>
                <div className="holiday-entry">
                  <div>
                    <Label htmlFor="holiday">
                      {scheduleWorkspace.exceptionalHoliday}
                    </Label>
                    <Input
                      id="holiday"
                      type="date"
                      value={holidayInput}
                      onChange={event => setHolidayInput(event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="tiny-button"
                    onClick={addHoliday}
                  >
                    <Plus size={15} />
                    {scheduleWorkspace.add}
                  </Button>
                </div>
                <div className="holiday-list">
                  {(schedule.calendar?.holidays ?? []).length ? (
                    schedule.calendar?.holidays.map(day => (
                      <button key={day} onClick={() => removeHoliday(day)}>
                        <span>
                          <b dir="ltr">{day}</b>
                          {schedule.calendar?.holidayLabels?.[day] ? (
                            <small>{schedule.calendar.holidayLabels[day]}</small>
                          ) : null}
                        </span>
                        <X size={13} />
                      </button>
                    ))
                  ) : (
                    <span>{scheduleWorkspace.noExceptionalHolidays}</span>
                  )}
                </div>
                <div className="calendar-review-note" role="note">
                  <ShieldCheck size={15} />
                  <span>
                    {scheduleWorkspace.source}{" "}
                    {schedule.calendar?.holidaySource ?? scheduleWorkspace.manualEntry}
                    {schedule.calendar?.holidaysLastCheckedAt
                      ? ` · ${scheduleWorkspace.lastUpdated} ${new Date(schedule.calendar.holidaysLastCheckedAt).toLocaleDateString("ar-EG")}`
                      : ""}
                    {schedule.calendar?.holidayReviewRequired
                      ? ` · ${scheduleWorkspace.holidayReviewRequired}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="panel schedule-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CPM NETWORK</p>
                    <h2>{schedule.name}</h2>
                    <span>
                      تاريخ البدء <b dir="ltr">{schedule.startDate}</b> · تاريخ
                      البيانات{" "}
                      <b dir="ltr">{schedule.dataDate ?? "غير محدد"}</b>
                    </span>
                  </div>
                  <div className="table-summary">
                    <span>{schedule.activities.length} نشاط</span>
                    <span>{schedule.relationships.length} علاقة</span>
                    <span>{baseline?.projectDuration ?? "—"} يوم عمل</span>
                  </div>
                </div>
                {baseline && <Timeline cpm={baseline} />}
              </div>
            </section>
            {baseline && (
              <section className="view-stack">
                <ActivityDataTable
                  activities={baseline.activities}
                  titleKey="baselineActivityTitle"
                />
                <RelationshipDataTable
                  activities={baseline.activities}
                  relationships={schedule.relationships}
                />
              </section>
            )}
          </div>
        )}

        {view === "event" && (
          <div className="view-stack event-view">
            <section className="page-heading">
              <div>
                <p className="eyebrow">{eventWorkspace.modelImpact}</p>
                <h1>{eventWorkspace.heading}</h1>
                <p>{eventWorkspace.description}</p>
              </div>
            </section>
            <section className="event-workspace">
              <form
                className="panel event-form"
                onSubmit={event => {
                  event.preventDefault();
                  createEvent();
                }}
              >
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{eventWorkspace.builder}</p>
                    <h2>{eventWorkspace.eventDetails}</h2>
                  </div>
                  <span className="form-step">01 / 02</span>
                </div>
                <div className="form-grid">
                  <div className="form-wide">
                    <Label htmlFor="event-title">{eventWorkspace.eventTitle}</Label>
                    <Input
                      id="event-title"
                      value={eventTitle}
                      onChange={event => setEventTitle(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-date">{eventWorkspace.occurrenceDate}</Label>
                    <Input
                      id="event-date"
                      type="date"
                      value={eventDate}
                      onChange={event => setEventDate(event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-duration">{eventWorkspace.durationWorkingDays}</Label>
                    <Input
                      id="event-duration"
                      type="number"
                      min="0"
                      step="1"
                      value={eventDuration}
                      onChange={event => setEventDuration(event.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="form-wide">
                    <Label htmlFor="event-desc">{eventWorkspace.evidenceAssumption}</Label>
                    <Textarea
                      id="event-desc"
                      value={eventDescription}
                      onChange={event =>
                        setEventDescription(event.target.value)
                      }
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{eventWorkspace.causeClassification}</Label>
                    <Select
                      value={eventCause}
                      onValueChange={value =>
                        setEventCause(value as DelayCause)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(causeLabel).map(([value, label]) => (
                          <SelectItem value={value} key={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{eventWorkspace.modellingMethod}</Label>
                    <Select
                      value={eventModel}
                      onValueChange={value =>
                        setEventModel(
                          value as "relationship" | "activity-split"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relationship">
                          {eventWorkspace.insertBetweenRelationship}
                        </SelectItem>
                        <SelectItem value="activity-split">
                          {eventWorkspace.splitAffectedActivity}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {eventModel === "activity-split" ? (
                    <div className="form-wide">
                      <Label>{eventWorkspace.affectedActivity}</Label>
                      <Select
                        value={selectedActivityId}
                        onValueChange={setSelectedActivityId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={eventWorkspace.selectAffectedActivity} />
                        </SelectTrigger>
                        <SelectContent>
                          {schedule.activities.map(activity => (
                            <SelectItem value={activity.id} key={activity.id}>
                              <span dir="ltr">{activity.id}</span> ·{" "}
                              {activity.name} · {activity.duration} {eventWorkspace.dayUnit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="form-wide">
                      <Label>{eventWorkspace.replaceRelationship}</Label>
                      <Select
                        value={selectedRelationshipId}
                        onValueChange={setSelectedRelationshipId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={eventWorkspace.selectRelationship} />
                        </SelectTrigger>
                        <SelectContent>
                          {schedule.relationships.map(relationship => (
                            <SelectItem
                              value={relationship.id}
                              key={relationship.id}
                            >
                              <span dir="ltr">
                                {relationship.predecessorId} →{" "}
                                {relationship.successorId}
                              </span>{" "}
                              · {relationship.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="logic-preview">
                  <GitBranch size={18} />
                  <div>
                    <small>{eventWorkspace.proposedLogicPath}</small>
                    {eventModel === "activity-split" ? (
                      selectedActivity ? (
                        <b dir="ltr">
                          {selectedActivity.id}--pre → FR-
                          {String(events.length + 1).padStart(3, "0")}--event →{" "}
                          {selectedActivity.id}--post
                        </b>
                      ) : (
                        <b>{eventWorkspace.selectActivityPreview}</b>
                      )
                    ) : selectedRelationship ? (
                      <b dir="ltr">
                        {selectedRelationship.predecessorId} → FR-
                        {String(events.length + 1).padStart(3, "0")} →{" "}
                        {selectedRelationship.successorId}
                      </b>
                    ) : (
                      <b>{eventWorkspace.selectRelationshipPreview}</b>
                    )}
                  </div>
                  <span>
                    {eventModel === "activity-split"
                      ? eventWorkspace.splitPostOnly
                      : eventWorkspace.eventUsesCalendar(
                          schedule.calendar?.name ?? eventWorkspace.calendarDays
                        )}
                  </span>
                </div>
                <div className="form-actions">
                  <p>
                    <Clock3 size={16} />
                    {eventWorkspace.timeImpactOnly}
                  </p>
                  <Button type="submit" className="run-button">
                    <Play size={16} fill="currentColor" />
                    {eventWorkspace.approveAndRun}
                  </Button>
                </div>
              </form>
              <aside className="event-guide">
                <div>
                  <span className="guide-number">1</span>
                  <h3>{eventWorkspace.selectedCopy}</h3>
                  <p>{eventWorkspace.selectedCopyText}</p>
                </div>
                <div>
                  <span className="guide-number">2</span>
                  <h3>{eventWorkspace.logicNotName}</h3>
                  <p>{eventWorkspace.logicNotNameText}</p>
                </div>
                <div>
                  <span className="guide-number">3</span>
                  <h3>{eventWorkspace.approveThenCalculate}</h3>
                  <p>{eventWorkspace.approveThenCalculateText}</p>
                </div>
                <div className="guide-foot">
                  <CalendarDays size={18} />
                  <span>
                    {eventWorkspace.calendar}{" "}
                    <b>{schedule.calendar?.name ?? eventWorkspace.calendarDays}</b>
                  </span>
                </div>
              </aside>
            </section>
          </div>
        )}

        {view === "windows" && (
          <div className="view-stack windows-view">
            <section className="page-heading">
              <div>
                <p className="eyebrow">WINDOW + CONCURRENCY REVIEW</p>
                <h1>نوافذ التحليل وفحص التزامن</h1>
                <p>
                  تجمع النافذة الأحداث التي تقع داخل فترة محددة، وتعيد حساب
                  الشبكة بالتتابع. علامة التزامن هنا فحص فني أولي وليست تخصيصاً
                  تعاقدياً للزمن.
                </p>
              </div>
            </section>
            <section className="window-builder panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">NEW ANALYSIS WINDOW</p>
                  <h2>إنشاء نافذة مراجعة</h2>
                </div>
                <CalendarClock size={21} />
              </div>
              <div className="window-form">
                <div>
                  <Label>اسم النافذة</Label>
                  <Input
                    value={newWindowName}
                    onChange={event => setNewWindowName(event.target.value)}
                  />
                </div>
                <div>
                  <Label>من</Label>
                  <Input
                    type="date"
                    value={newWindowFrom}
                    onChange={event => setNewWindowFrom(event.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>إلى</Label>
                  <Input
                    type="date"
                    value={newWindowTo}
                    onChange={event => setNewWindowTo(event.target.value)}
                    dir="ltr"
                  />
                </div>
                <Button className="run-button" onClick={addWindow}>
                  <Plus size={16} />
                  إنشاء
                </Button>
              </div>
            </section>
            <section className="window-columns">
              <div className="panel windows-list">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">WINDOW REGISTER</p>
                    <h2>النوافذ المسجلة</h2>
                  </div>
                  <span className="quality-score">{windows.length}</span>
                </div>
                {windows.map(item => {
                  const current = item.id === selectedWindowId;
                  const computed = current ? windowResult : null;
                  return (
                    <button
                      key={item.id}
                      className={current ? "window-row selected" : "window-row"}
                      onClick={() => setSelectedWindowId(item.id)}
                    >
                      <div>
                        <b>{item.name}</b>
                        <small dir="ltr">
                          {item.from} → {item.to}
                        </small>
                      </div>
                      <div>
                        <span>
                          {item.status === "final"
                            ? "نهائي"
                            : item.status === "review"
                              ? "مراجعة"
                              : "مسودة"}
                        </span>
                        <strong>
                          {computed ? `+${computed.totalImpactDays} d` : "احسب"}
                        </strong>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="panel window-result">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CURRENT WINDOW RESULT</p>
                    <h2>{selectedWindow?.name ?? "اختر نافذة"}</h2>
                  </div>
                  <StatusBadge result={windowResult} />
                </div>
                {windowResult ? (
                  <>
                    <div className="window-kpis">
                      <div>
                        <small>الأحداث المدرجة</small>
                        <b>{windowResult.events.length}</b>
                      </div>
                      <div>
                        <small>الأثر الإجمالي</small>
                        <b dir="ltr">+{windowResult.totalImpactDays} d</b>
                      </div>
                      <div>
                        <small>مرشحات تزامن</small>
                        <b>{windowResult.concurrentFindings.length}</b>
                      </div>
                    </div>
                    <div className="window-event-table">
                      {windowResult.eventResults.length ? (
                        windowResult.eventResults.map(item => (
                          <div key={item.eventId}>
                            <span dir="ltr">{item.eventId}</span>
                            <b>{item.eventTitle}</b>
                            <em dir="ltr">+{item.incrementalImpactDays}d</em>
                          </div>
                        ))
                      ) : (
                        <p>لا توجد أحداث داخل الفترة المختارة.</p>
                      )}
                    </div>
                    {windowResult.concurrentFindings.length ? (
                      <div className="concurrency-list">
                        {windowResult.concurrentFindings.map(item => (
                          <div key={item.eventIds.join("-")}>
                            <AlertTriangle size={16} />
                            <p>
                              <b>
                                مرشح تزامن:{" "}
                                <span dir="ltr">
                                  {item.eventIds.join(" / ")}
                                </span>
                              </b>
                              <span dir="ltr">
                                {item.overlapStart} → {item.overlapEnd}
                              </span>
                              <small>{item.explanation}</small>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="quality-footer">
                        <ShieldCheck size={16} />
                        لم يرصد المحرك تداخلاً زمنياً بين أحداث النافذة الحالية.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-inline">
                    <CalendarClock size={19} />
                    <span>اختر نافذة مرتبطة بالبرنامج الحالي.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {view === "analysis" && (
          <div className="view-stack analysis-view">
            <section className="page-heading">
              <div>
                <p className="eyebrow">BEFORE / AFTER COMPARISON</p>
                <h1>نتيجة التحليل القابلة للتتبع</h1>
                <p>
                  يمكن قراءة أثر حدث منفرد أو أثر نافذة مجمعة. الإحداثيات
                  والحسابات أدناه تعود إلى نسخة البرنامج والتقويم المحددين.
                </p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="outline"
                  className="outline-action"
                  onClick={() => selectedEvent && removeEvent(selectedEvent.id)}
                  disabled={!selectedEvent}
                >
                  <X size={16} />
                  حذف الحدث
                </Button>
                <Button
                  className="run-button"
                  onClick={exportAnalysis}
                  disabled={!activeResult}
                >
                  <Download size={16} />
                  تنزيل السجل
                </Button>
              </div>
            </section>
            {activeResult && displayedCpm ? (
              <>
                <section
                  className="impact-banner"
                  style={{
                    backgroundImage: `linear-gradient(100deg, rgba(11,79,108,.97), rgba(11,79,108,.88) 47%, rgba(11,79,108,.46)), url(${reportTextureUrl})`,
                  }}
                >
                  <div>
                    <p>الأثر المحسوب على الإكمال</p>
                    <strong dir="ltr">
                      {activeImpact > 0 ? "+" : ""}
                      {activeImpact}
                      <small> يوم عمل</small>
                    </strong>
                    <span>
                      تاريخ الإكمال يحسب وفق «
                      {activeResult.impacted.calendar.name}»، وتبقى العائمة
                      بوحدة أيام العمل.
                    </span>
                  </div>
                  <div className="impact-dates">
                    <div>
                      <small>قبل الإدراج</small>
                      <b dir="ltr">{activeResult.baseline.completionDate}</b>
                    </div>
                    <i>
                      <ChevronLeft size={20} />
                    </i>
                    <div className="after-date">
                      <small>بعد الإدراج</small>
                      <b dir="ltr">{activeResult.impacted.completionDate}</b>
                    </div>
                  </div>
                </section>
                <section className="metrics-grid analysis-metrics">
                  <MetricCard
                    label="النافذة / الحدث"
                    value={
                      windowResult
                        ? (selectedWindow?.id ?? "—")
                        : (selectedEvent?.id ?? "—")
                    }
                    helper={
                      windowResult
                        ? (selectedWindow?.name ?? "")
                        : (selectedEvent?.title ?? "")
                    }
                    tone="graphite"
                  />
                  <MetricCard
                    label="الأثر"
                    value={`${activeImpact > 0 ? "+" : ""}${activeImpact} يوم`}
                    helper="فرق الإكمال بوحدة أيام عمل"
                    tone="orange"
                  />
                  <MetricCard
                    label="الإكمال بعد التحليل"
                    value={activeResult.impacted.completionDate}
                    helper={activeResult.impacted.calendar.name}
                    tone="blue"
                  />
                  <MetricCard
                    label="المسار الحرج"
                    value={`${displayedCpm.criticalActivityIds.length} نشاط`}
                    helper="بعد الإدراج"
                    tone="graphite"
                  />
                </section>
                <section className="analysis-grid">
                  <div className="panel timeline-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">IMPACTED CPM</p>
                        <h2>الشبكة بعد الإدراج</h2>
                      </div>
                      <StatusBadge result={activeResult} />
                    </div>
                    <Timeline cpm={displayedCpm} />
                  </div>
                  <div className="panel evidence-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">EVIDENCE TRACE</p>
                        <h2>سجل الحساب</h2>
                      </div>
                    </div>
                    <ol>
                      {("notes" in activeResult ? activeResult.notes : []).map(
                        note => (
                          <li key={note}>
                            <span>
                              <CheckCircle2 size={16} />
                            </span>
                            {note}
                          </li>
                        )
                      )}
                    </ol>
                    <div className="mini-divider" />
                    <div className="evidence-meta">
                      <div>
                        <small>الطريقة</small>
                        <b>{windowResult ? "Windowed TIA" : "TIA"}</b>
                      </div>
                      <div>
                        <small>قاعدة المقارنة</small>
                        <b>{schedule.name}</b>
                      </div>
                      <div>
                        <small>التقويم</small>
                        <b>{activeResult.impacted.calendar.name}</b>
                      </div>
                    </div>
                  </div>
                </section>
                <ActivityDataTable
                  activities={displayedCpm.activities}
                  titleKey="impactedActivityTitle"
                />
              </>
            ) : (
              <section className="empty-state">
                <Zap size={28} />
                <h2>لا توجد نتيجة محسوبة بعد</h2>
                <p>
                  أضف حدث تأخير أو أنشئ نافذة مرتبطة بالبرنامج لتشغيل التحليل.
                </p>
                <Button className="run-button" onClick={() => setView("event")}>
                  إنشاء حدث تأخير
                </Button>
              </section>
            )}
          </div>
        )}

        {view === "report" && (
          <div className="view-stack report-view">
            <section className="page-heading no-print">
              <div>
                <p className="eyebrow">NARRATIVE + EXPORTABLE RECORD</p>
                <h1>Delay Analysis Narrative وتقرير فني</h1>
                <p>
                  السرد يتولد من نتائج الحساب والبيانات المدخلة، ثم يبقى قابلاً
                  للتحرير قبل الطباعة أو التنزيل.
                </p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="outline"
                  className="outline-action"
                  onClick={exportAnalysis}
                  disabled={!activeResult}
                >
                  <Download size={16} />
                  تنزيل السجل
                </Button>
                <Button className="run-button" onClick={() => window.print()}>
                  <Printer size={16} />
                  طباعة التقرير
                </Button>
              </div>
            </section>
            <section className="narrative-context no-print">
              <div>
                <div>
                  <Label>اسم المحلل</Label>
                  <Input
                    value={narrativeContext.analyst}
                    onChange={event =>
                      setNarrativeContext(previous => ({
                        ...previous,
                        analyst: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>مرجع العقد/البند</Label>
                  <Input
                    value={narrativeContext.contractReference}
                    onChange={event =>
                      setNarrativeContext(previous => ({
                        ...previous,
                        contractReference: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>ملخص الأدلة</Label>
                  <Input
                    value={narrativeContext.evidenceSummary}
                    onChange={event =>
                      setNarrativeContext(previous => ({
                        ...previous,
                        evidenceSummary: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>الموقف المدخل</Label>
                  <Input
                    value={narrativeContext.claimPosition}
                    onChange={event =>
                      setNarrativeContext(previous => ({
                        ...previous,
                        claimPosition: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="outline-action"
                onClick={() =>
                  setNarrative(
                    generateDelayAnalysisNarrative({
                      schedule,
                      result: windowResult ?? analysis,
                      event: selectedEvent,
                      context: narrativeContext,
                    })
                  )
                }
              >
                <Sparkles size={16} />
                تحديث السرد من الحساب
              </Button>
            </section>
            <article className="print-report">
              <div className="report-topline">
                <div className="report-brand">
                  <img src={logoUrl} alt="" />
                  <div>
                    <b>TIA Studio</b>
                    <span>Delay Analysis Technical Record</span>
                  </div>
                </div>
                <div>
                  <small>تاريخ الإصدار</small>
                  <b dir="ltr">{new Date().toISOString().slice(0, 10)}</b>
                </div>
              </div>
              <div className="report-title">
                <div>
                  <p>تحليل أثر زمني / Delay Analysis</p>
                  <h2>
                    {selectedWindow?.name ??
                      selectedEvent?.title ??
                      "لا توجد نافذة محددة"}
                  </h2>
                  <span>
                    البرنامج: {schedule.name} · التقويم:{" "}
                    {schedule.calendar?.name ?? "أيام تقويمية"}
                  </span>
                </div>
                <StatusBadge result={activeResult} />
              </div>
              <div className="report-facts">
                <div>
                  <small>تاريخ بيانات البرنامج</small>
                  <b dir="ltr">{schedule.dataDate ?? "غير محدد"}</b>
                </div>
                <div>
                  <small>تاريخ الإكمال قبل</small>
                  <b dir="ltr">
                    {activeResult?.baseline.completionDate ??
                      baseline?.completionDate ??
                      "—"}
                  </b>
                </div>
                <div>
                  <small>فرق الإكمال</small>
                  <b dir="ltr">
                    {activeResult
                      ? `${activeImpact > 0 ? "+" : ""}${activeImpact} يوم عمل`
                      : "—"}
                  </b>
                </div>
                <div>
                  <small>تاريخ الإكمال بعد</small>
                  <b dir="ltr">
                    {activeResult?.impacted.completionDate ?? "—"}
                  </b>
                </div>
              </div>
              <section className="report-section narrative-print">
                <h3>السرد التحليلي — مسودة قابلة للتحرير</h3>
                <Textarea
                  value={narrative}
                  onChange={event => setNarrative(event.target.value)}
                  rows={20}
                />
              </section>
              <section className="report-section">
                <h3>منهجية وحدود الاستخدام</h3>
                <p>
                  يقيس هذا التقرير الأثر الزمني الناتج عن برنامج وعلاقات وتقويم
                  وFragnet مدخلة. يثبت الحساب فرق تاريخ الإكمال في النموذج؛ لكنه
                  لا يحسم الاستحقاق التعاقدي أو التعويض أو التزامن القانوني.
                  ينبغي مراجعة العقد والمراسلات وسجلات التقدم والمستندات
                  المعاصرة بواسطة مختص قبل استخدامه في مطالبة أو نزاع.
                </p>
              </section>
              <section className="report-disclaimer">
                <AlertTriangle size={17} />
                <p>
                  <b>تنبيه مهني:</b> علامة التزامن في TIA Studio مرشح فني أولي
                  يتطلب فحص السبب الفعال والمسار الحرج في الفترة المعنية؛ لا
                  تمثل توزيعاً نهائياً للتأخير بين الأطراف.
                </p>
              </section>
            </article>
          </div>
        )}

        {view === "methods" && (
          <div className="view-stack methods-view">
            <section className="page-heading">
              <div>
                <p className="eyebrow">SCIENTIFIC METHOD LIBRARY</p>
                <h1>دليل طرق تحليل التأخير وفق SCL</h1>
                <p>
                  مرجع تطبيقي للتخطيط الأولي للطريقة. اختيار المنهج النهائي يتبع
                  العقد والوقائع وتوفر وموثوقية بيانات المشروع.
                </p>
              </div>
            </section>
            <section className="methods-intro">
              <BookOpenCheck size={22} />
              <p>
                تعرض المكتبة ست طرق شائعة التصنيف في سياق Section 11 من بروتوكول
                SCL. طريقة <b>TIA</b> فقط تعمل كمحرك حسابي داخل هذا الإصدار؛ أما
                البقية فقوالب منهجية منظمة تتطلب بيانات تاريخية ومراجعة مختصة.
              </p>
            </section>
            <section className="method-grid">
              {sclMethods.map((method, index) => (
                <article
                  key={method.id}
                  className={`method-card-large ${method.support === "محرك حسابي" ? "is-engine" : ""}`}
                >
                  <div className="method-card-top">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Badge
                      className={
                        method.support === "محرك حسابي"
                          ? "badge-delay"
                          : "badge-muted"
                      }
                    >
                      {method.support}
                    </Badge>
                  </div>
                  <h2>{method.shortName}</h2>
                  <p className="method-english">{method.englishName}</p>
                  <div className="method-meta">
                    <span>{method.perspective}</span>
                    <span>{method.bestUse}</span>
                  </div>
                  <p>{method.purpose}</p>
                  <div className="method-columns">
                    <div>
                      <b>المدخلات</b>
                      <ul>
                        {method.inputs.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <b>الخطوات</b>
                      <ol>
                        {method.process.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <div className="method-caution">
                    <AlertTriangle size={15} />
                    <p>
                      <b>حدود ومخاطر:</b> {method.cautions}
                    </p>
                  </div>
                  {method.id === "tia" && (
                    <Button
                      className="run-button"
                      onClick={() => {
                        setGuidedMethod("TIA");
                        setJourneyPath("direct");
                        setJourneyStep(1);
                        setView("guided");
                        toast.message(formatHomeStatus(language, "tiaJourneyOpened"));
                      }}
                    >
                      <Zap size={15} />
                      افتح محرك TIA
                    </Button>
                  )}
                </article>
              ))}
            </section>
            <section className="sources-panel">
              <h2>مصادر مرجعية</h2>
              {sclSources.map(source => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.label}
                  <ChevronLeft size={15} />
                </a>
              ))}
              <p>
                هذه الشاشة تعليمية ولا تغني عن الرجوع للنص الرسمي للبروتوكول
                والعقد الخاص بالمشروع.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
