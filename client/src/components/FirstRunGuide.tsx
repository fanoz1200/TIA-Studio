import React from "react";
import {
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  FolderUp,
  Play,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppLanguage } from "@/contexts/LanguageContext";

export const FIRST_RUN_GUIDE_STORAGE_KEY = "tia-onboarding-v1-seen";

export function shouldShowFirstRunGuide() {
  try {
    return window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function markFirstRunGuideSeen() {
  try {
    window.localStorage.setItem(FIRST_RUN_GUIDE_STORAGE_KEY, "1");
  } catch {
    // عدم إتاحة التخزين لا يمنع المستخدم من استعمال البرنامج.
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartAnalysis: () => void;
};

const steps = [
  {
    icon: ClipboardList,
    copy: {
      ar: {
        title: "اختار طريقك",
        description: "لو عندك كذا واقعة ابدأ بسجل القضايا. لو واقعة واحدة جاهزة، امشي تحليل مباشر.",
      },
      en: {
        title: "Choose your route",
        description: "Use the Issue Log for multiple events. For one ready event, follow the direct analysis route.",
      },
    },
  },
  {
    icon: FolderUp,
    copy: {
      ar: {
        title: "ارفع الـ Baseline",
        description: "ارفع البرنامج المعتمد بصيغة XER أو XML أو JSON. الملف الأصلي مش بيتغيّر.",
      },
      en: {
        title: "Upload the baseline",
        description: "Upload the approved schedule as XER, XML, or JSON. The original file is not changed.",
      },
    },
  },
  {
    icon: CalendarClock,
    copy: {
      ar: {
        title: "ارفع Update قبل الحدث",
        description: "دي نسخة Pre-TIA اللي بنقيس عليها؛ راجع Data Date والتقويم قبل ما تكمل.",
      },
      en: {
        title: "Upload the pre-event update",
        description: "This is the Pre-TIA update used for measurement. Check the Data Date and calendar before continuing.",
      },
    },
  },
  {
    icon: ClipboardList,
    copy: {
      ar: {
        title: "سجّل الواقعة",
        description: "اكتب تاريخ وسبب ومدة الواقعة، وحدد النشاط أو العلاقة المنطقية المتأثرة.",
      },
      en: {
        title: "Record the event",
        description: "Record the event date, cause, and duration, then identify the affected activity or logic relationship.",
      },
    },
  },
  {
    icon: ScanSearch,
    copy: {
      ar: {
        title: "راجع وشغّل الحساب",
        description: "راجع التقسيم والـ Fragnet، وبعدها شغّل نتيجة CPM/TIA المحلية.",
      },
      en: {
        title: "Review and run the analysis",
        description: "Review the split and fragnet, then run the local CPM/TIA result.",
      },
    },
  },
  {
    icon: FileSpreadsheet,
    copy: {
      ar: {
        title: "نزّل التقرير",
        description: "من تقرير المطالبة نزّل Word أو PDF أو زر «تصدير التقرير النهائي Excel».",
      },
      en: {
        title: "Download the report",
        description: "From the claim report, download Word, PDF, or the Final Report Excel export.",
      },
    },
  },
];

export function FirstRunGuide({ open, onOpenChange, onStartAnalysis }: Props) {
  const { language, direction } = useAppLanguage();
  const copy = language === "ar"
    ? {
        eyebrow: "أول مرة هنا؟ نمشيها واحدة واحدة",
        title: "أهلاً بيك في TIA Studio",
        description: "البرنامج بيحسب TIA/CPM محلياً من بياناتك. امشي بالترتيب ده عشان تعرف كل خطوة بتعمل إيه قبل ما تطلع تقرير.",
        stepsLabel: "خطوات استخدام TIA Studio",
        caution: "مهم: راجع التقويم وData Date والعلاقات قبل اعتماد أي نتيجة. التقرير مش بديل عن مراجعة Primavera P6 على نسخة غير إنتاجية.",
        start: "ابدأ معايا",
        dismiss: "فهمت، افتح البرنامج",
      }
    : {
        eyebrow: "First time here? We will take it step by step",
        title: "Welcome to TIA Studio",
        description: "TIA Studio calculates local TIA/CPM results from your data. Follow this order to understand each step before producing a report.",
        stepsLabel: "TIA Studio workflow steps",
        caution: "Important: review calendars, the Data Date, and logic relationships before relying on any result. This report is not a substitute for Primavera P6 review in a non-production copy.",
        start: "Start the analysis",
        dismiss: "Got it, open the workspace",
      };

  function dismiss() {
    markFirstRunGuideSeen();
    onOpenChange(false);
  }

  function start() {
    markFirstRunGuideSeen();
    onOpenChange(false);
    onStartAnalysis();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (nextOpen) onOpenChange(true);
        else dismiss();
      }}
    >
      <DialogContent
        dir={direction}
        showCloseButton={false}
        className={`max-h-[calc(100dvh-1.5rem)] max-w-3xl gap-5 overflow-y-auto border-[#d7e1e8] bg-[#fbfcfd] p-5 shadow-2xl sm:p-7 ${direction === "rtl" ? "text-right" : "text-left"}`}
      >
        <DialogHeader className={`items-start gap-3 ${direction === "rtl" ? "text-right" : "text-left"}`}>
          <span className="rounded-full bg-[#eaf2f7] px-3 py-1 text-xs font-bold tracking-wide text-[#24506b]">
            {copy.eyebrow}
          </span>
          <DialogTitle className="text-2xl leading-tight text-[#16364a] sm:text-3xl">
            {copy.title}
          </DialogTitle>
          <DialogDescription className={`max-w-2xl text-sm leading-6 text-[#536775] sm:text-base ${direction === "rtl" ? "text-right" : "text-left"}`}>
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-2 sm:grid-cols-2" aria-label={copy.stepsLabel}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const stepCopy = step.copy[language];
            return (
              <li
                key={stepCopy.title}
                className={`flex items-start gap-3 rounded-xl border border-[#dce6ec] bg-white p-3.5 shadow-sm ${direction === "rtl" ? "text-right" : "text-left"}`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf2f7] text-sm font-extrabold text-[#1d5976]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[#17394d]">
                    <Icon size={17} aria-hidden="true" />
                    <h3 className="font-bold">{stepCopy.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-[#586b78]">{stepCopy.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="rounded-xl border border-[#f0d8a7] bg-[#fff8e9] px-4 py-3 text-sm leading-6 text-[#73531b]">
          {copy.caution}
        </p>

        <DialogFooter className={`gap-3 sm:flex-row ${direction === "rtl" ? "sm:justify-end" : "sm:justify-start"}`}>
          <Button type="button" className="run-button" onClick={start}>
            <Play size={16} fill="currentColor" />
            {copy.start}
          </Button>
          <Button type="button" variant="outline" className="outline-action" onClick={dismiss}>
            {copy.dismiss}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
