# بطاقة تسليم سريعة لوكيل أو مطور جديد

ابدأ من **المصدر الموجود** ولا تنشئ تطبيقاً بديلاً. هذا المشروع هو تطبيق React/TypeScript مع خادم Express وElectron للتشغيل المحلي، ومحرك التحليل الحسابي يعمل في المتصفح.

## ثلاث قواعد لا تُكسر

1. لا تختلق حالات مطالبات أو نتائج تحليل أو فيديوهات. الحالات D-056 إلى D-088 تنتظر ملف Excel فعلياً.
2. لا تعدّل نسخة P6 الأصلية أو لقطة Pre-TIA المعتمدة. تستخدم نسخ تحليل منفصلة فقط.
3. لا تنشر تغييراً قبل `pnpm test` و`pnpm build` وتحديث `todo.md` والدليل الحيّ إذا تغيرت رحلة المستخدم أو المحرك.

## أوامر التحقق

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

## نقاط البداية التقنية

| الحاجة | الملف الأساسي |
|---|---|
| حساب CPM وTIA وFragnet | `client/src/lib/cpm.ts` |
| جودة الجدول ومنع التصدير | `client/src/lib/schedule-quality.ts` و`client/src/lib/workflow-validation.ts` |
| استيراد P6 | `client/src/lib/xer.ts` |
| تقرير Word/PDF وExcel | `client/src/lib/claim-export.ts` و`client/src/lib/analysis-excel.ts` |
| رحلة المستخدم | `client/src/pages/Home.tsx` و`client/src/components/GuidedAnalysisPanel.tsx` |
| المعرفة والدليل الحي | `client/src/components/KnowledgeCentrePanel.tsx` و`client/src/lib/release-guide.ts` |
| سطح المكتب | `desktop/main.cjs` و`package.json` |

اقرأ `docs/PROJECT_CONTINUITY_AND_HANDOFF_AR.md` قبل أي قرار بخصوص نقل المشروع أو نشره أو إعادة بناء حزمة سطح المكتب.
