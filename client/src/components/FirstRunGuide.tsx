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
    title: "اختار طريقك",
    description: "لو عندك كذا واقعة ابدأ بسجل القضايا. لو واقعة واحدة جاهزة، امشي تحليل مباشر.",
  },
  {
    icon: FolderUp,
    title: "ارفع الـ Baseline",
    description: "ارفع البرنامج المعتمد بصيغة XER أو XML أو JSON. الملف الأصلي مش بيتغيّر.",
  },
  {
    icon: CalendarClock,
    title: "ارفع Update قبل الحدث",
    description: "دي نسخة Pre-TIA اللي بنقيس عليها؛ راجع Data Date والتقويم قبل ما تكمل.",
  },
  {
    icon: ClipboardList,
    title: "سجّل الواقعة",
    description: "اكتب تاريخ وسبب ومدة الواقعة، وحدد النشاط أو العلاقة المنطقية المتأثرة.",
  },
  {
    icon: ScanSearch,
    title: "راجع وشغّل الحساب",
    description: "راجع التقسيم والـ Fragnet، وبعدها شغّل نتيجة CPM/TIA المحلية.",
  },
  {
    icon: FileSpreadsheet,
    title: "نزّل التقرير",
    description: "من تقرير المطالبة نزّل Word أو PDF أو زر «تصدير التقرير النهائي Excel».",
  },
];

export function FirstRunGuide({ open, onOpenChange, onStartAnalysis }: Props) {
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
        dir="rtl"
        showCloseButton={false}
        className="max-h-[calc(100dvh-1.5rem)] max-w-3xl gap-5 overflow-y-auto border-[#d7e1e8] bg-[#fbfcfd] p-5 text-right shadow-2xl sm:p-7"
      >
        <DialogHeader className="items-start gap-3 text-right">
          <span className="rounded-full bg-[#eaf2f7] px-3 py-1 text-xs font-bold tracking-wide text-[#24506b]">
            أول مرة هنا؟ نمشيها واحدة واحدة
          </span>
          <DialogTitle className="text-2xl leading-tight text-[#16364a] sm:text-3xl">
            أهلاً بيك في TIA Studio
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-right text-sm leading-6 text-[#536775] sm:text-base">
            البرنامج بيحسب TIA/CPM محلياً من بياناتك. امشي بالترتيب ده عشان تعرف كل خطوة بتعمل إيه قبل ما تطلع تقرير.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-2 sm:grid-cols-2" aria-label="خطوات استخدام TIA Studio">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-xl border border-[#dce6ec] bg-white p-3.5 shadow-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf2f7] text-sm font-extrabold text-[#1d5976]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[#17394d]">
                    <Icon size={17} aria-hidden="true" />
                    <h3 className="font-bold">{step.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-[#586b78]">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="rounded-xl border border-[#f0d8a7] bg-[#fff8e9] px-4 py-3 text-sm leading-6 text-[#73531b]">
          مهم: راجع التقويم وData Date والعلاقات قبل اعتماد أي نتيجة. التقرير مش بديل عن مراجعة Primavera P6 على نسخة غير إنتاجية.
        </p>

        <DialogFooter className="gap-3 sm:flex-row sm:justify-start">
          <Button type="button" className="run-button" onClick={start}>
            <Play size={16} fill="currentColor" />
            ابدأ معايا
          </Button>
          <Button type="button" variant="outline" className="outline-action" onClick={dismiss}>
            فهمت، افتح البرنامج
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
