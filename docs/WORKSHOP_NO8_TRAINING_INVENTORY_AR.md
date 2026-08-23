# جرد تدريب Workshop NO8 — قراءة فقط

> **حد الاستخدام:** يصف هذا التقرير الملفات التدريبية المرفوعة محلياً كما هي. لا يعدّلها، ولا يرسلها إلى خدمة خارجية، ولا يثبت بمفرده أن TIA Studio أو ملف XER المُصدَّر مطابق تماماً لـ Primavera P6.

## مصدر التدريب وبصمته

| المصدر | الاسم | الحجم بالبايت | SHA-256 |
|---|---|---:|---|
| Baseline XER | `Workshop-NO8TimeImpactAnalysisBaseline.xer` | 12287 | `d67b88bd459e5a99b64b3a2a2dd89251ac5c7156b076f3cd80326a37b3efc41a` |
| Post‑TIA XER | `Workshop-NO8TimeImpactAnalysisPostTIA.xer` | 14868 | `bc6774d92cb2c17082b31582107bfd07fa964c7ae614cbc5c4581aafe5a3a2a1` |
| Workshop Excel | `Workshop-NO8TimeImpactAnalysis.xlsx` | 25435 | `1974eafc38ba56ecf984a8ef33183dd93a7b3e10efce4162242954868223b993` |

## ملخص برنامجَي XER

| المقياس | Baseline | Post‑TIA |
|---|---:|---:|
| رمز/اسم المشروع | TIA1 - B1 | TIA1 |
| تاريخ البداية المخطط | 2021-05-20 00:00 | 2021-05-20 00:00 |
| تاريخ النهاية المخطط |  |  |
| تاريخ النهاية المجدول | 2021-08-07 16:00 | 2021-08-24 16:00 |
| الأنشطة | 9 | 13 |
| العلاقات | 9 | 15 |
| التقاويم | 1 | 1 |
| WBS | 3 | 3 |
| وضع المسار الحرج | CT_TotFloat | CT_TotFloat |

### جداول Baseline

| CURRTYPE | 18 |
| FINTMPL | 1 |
| OBS | 1 |
| PROJECT | 1 |
| CALENDAR | 1 |
| PROJWBS | 3 |
| TASK | 9 |
| TASKPRED | 9 |

### جداول Post‑TIA

| CURRTYPE | 18 |
| FINTMPL | 1 |
| OBS | 1 |
| PROJECT | 1 |
| CALENDAR | 1 |
| SCHEDOPTIONS | 1 |
| PROJWBS | 3 |
| TASK | 13 |
| TASKPRED | 15 |

## الفروق التي اكتشفها الجرد

| نوع الفرق | العدد |
|---|---:|
| أنشطة أضيفت بعد TIA | 4 |
| أنشطة أزيلت بعد TIA | 0 |
| أنشطة مشتركة تغيرت حقولها | 9 |
| علاقات أضيفت | 6 |
| علاقات أزيلت | 0 |

### الأنشطة المضافة بعد TIA

| النشاط | الاسم | المدة بالساعات | Early Start | Early Finish |
|---|---|---:|---|---|
| `A1035` | Delay Event 02 Unforseen Ground Conditions | 48 | 2021-08-05 00:00 | 2021-08-05 00:00 |
| `A1036` | Excavation Works Post Delay | 80 | 2021-08-05 00:00 | 2021-08-05 00:00 |
| `A1055` | Delay Event 03 Bad Weather | 48 | 2021-08-05 08:00 | 2021-08-10 16:00 |
| `A1056` | Backfilling Post Delay | 72 | 2021-08-11 08:00 | 2021-08-19 16:00 |

### تغييرات الأنشطة المشتركة

- `A1000` — Handing Over - Project Start: `status` (TK_NotStart ← TK_Complete)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-05-20 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-05-20 08:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-05-19 16:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-05-19 16:00 ← 2021-08-05 08:00)
- `A1010` — Mobilization Work: `status` (TK_NotStart ← TK_Complete)؛ `remainingDurationHours` (40 ← 0)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-05-20 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-05-24 16:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-05-20 08:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-05-24 16:00 ← 2021-08-05 08:00)
- `A1020` — Surveying Work: `status` (TK_NotStart ← TK_Complete)؛ `remainingDurationHours` (80 ← 0)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-05-25 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-06-03 16:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-05-25 08:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-06-03 16:00 ← 2021-08-05 08:00)
- `A1030` — Excavation Works Pre Delay: `name` (Excavation Works ← Excavation Works Pre Delay)؛ `status` (TK_NotStart ← TK_Complete)؛ `durationHours` (160 ← 80)؛ `remainingDurationHours` (160 ← 0)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-06-04 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-06-23 16:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-06-04 08:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-06-23 16:00 ← 2021-08-05 08:00)
- `A1040` — Drainage & Sewerage Work: `status` (TK_NotStart ← TK_Complete)؛ `remainingDurationHours` (200 ← 0)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-06-24 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-07-18 16:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-06-24 08:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-07-18 16:00 ← 2021-08-05 08:00)
- `A1050` — Backfilling Pre Delay: `name` (Backfilling ← Backfilling Pre Delay)؛ `status` (TK_NotStart ← TK_Complete)؛ `durationHours` (120 ← 48)؛ `remainingDurationHours` (120 ← 0)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-07-19 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-08-02 16:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-07-19 08:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-08-02 16:00 ← 2021-08-05 08:00)
- `A1060` — Inespection & Closeout: `earlyStart` (2021-08-03 08:00 ← 2021-08-20 08:00)؛ `earlyEnd` (2021-08-07 16:00 ← 2021-08-24 16:00)؛ `lateStart` (2021-08-03 08:00 ← 2021-08-20 08:00)؛ `lateEnd` (2021-08-07 16:00 ← 2021-08-24 16:00)
- `A1070` — Project Finish: `earlyStart` (2021-08-07 16:00 ← 2021-08-24 16:00)؛ `earlyEnd` (2021-08-07 16:00 ← 2021-08-24 16:00)؛ `lateStart` (2021-08-07 16:00 ← 2021-08-24 16:00)؛ `lateEnd` (2021-08-07 16:00 ← 2021-08-24 16:00)
- `A1005` — Delay Event 01 Delayed Handing Over: `status` (TK_NotStart ← TK_Complete)؛ `durationHours` (0 ← 40)؛ `totalFloatHours` (0 ← فارغ)؛ `earlyStart` (2021-05-20 08:00 ← 2021-08-05 00:00)؛ `earlyEnd` (2021-05-20 08:00 ← 2021-08-05 00:00)؛ `lateStart` (2021-05-19 16:00 ← 2021-08-05 08:00)؛ `lateEnd` (2021-05-19 16:00 ← 2021-08-05 08:00)

### علاقات مضافة بعد TIA

- `A1030` → `A1035` (PR_FS; lag=0 h)
- `A1035` → `A1036` (PR_FS; lag=0 h)
- `A1036` → `A1040` (PR_FS; lag=0 h)
- `A1050` → `A1055` (PR_FS; lag=0 h)
- `A1055` → `A1056` (PR_FS; lag=0 h)
- `A1056` → `A1060` (PR_FS; lag=0 h)

## ملف Excel

| الورقة | صفوف ذات محتوى | صيغ | رؤوس أول صف |
|---|---:|---:|---|
| Workshop TIA | 16 | 13 | WORKSHOP 8 Time Impact Analysis |
| TIA Delay Analysis Table | 22 | 27 | PROJECT PROGRAMME - DELAY ANALYSIS |

### خلاصة تدريبية مستخرجة من Excel (وليست حساب P6)

| العنصر | القيمة المصرح بها داخل النموذج |
|---|---|
| بداية Baseline | 20 May 2021 |
| نهاية Baseline | 07 Aug 2021 |
| مدة Baseline | 80 يوم |
| التقويم الوصفي | 7d * 8hrs |
| نهاية النموذج بعد الأحداث | 24/Aug/21 |
| الأثر التراكمي في النموذج | 17.00 يوم |
| فرق النموذج | -17.00 يوم |
| ECD في النموذج | 11.00 يوم |
| END في النموذج | 6.00 يوم |
| تزامن مسجل في النموذج | 0.00 يوم |

| الحدث | التصنيف في نموذج التحليل | الفترة | المدة | النشاط المتأثر |
|---|---|---|---:|---|
| Delayed Handing over | ECD | 20-May-21 → 25-May-21 | 5 | Handing Over - Project Start |
| Unforeseen Ground Conditions | ECD | 19-Jun-21 → 24-Jun-21 | 6 | Excavation Works |
| Bad Weather | END | 5-Aug-21 → 10-Aug-21 | 6 | Backfilling |

> **مهم:** يصرّح النموذج نفسه بأن Excel قد يحسب التواريخ على نحو مختلف إذا استُخدمت تقاويم P6 معينة. لذلك تُستخدم هذه القيم لتحديد سيناريو التدريب فقط، ولا تحل محل إعادة الجدولة داخل P6.

## القرار التالي

يستخدم هذا الجرد كمرجع اختبار للقراءة والفروق والبصمات. ستُقارن حسابات محرك CPM/TIA المحلي بالـBaseline وPost‑TIA بوصفها **حالة تدريب**، ثم تُرفع النتائج داخل TIA Studio مع عبارة «مرجع تدريب محلي». لا يُخزَّن ملفا XER الأصليان أو ملف Excel داخل قاعدة بيانات المنصة أو حزمة التوزيع؛ يبقيهما المستخدم كمصادر، ويستوردها صراحةً عند التدريب أو التحقق.

