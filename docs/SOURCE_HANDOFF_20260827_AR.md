# TIA Studio — تسليم المصدر واستكمال التطوير

> **الغرض:** هذه الوثيقة خريطة تشغيل واستمرار للكود المصدري، وليست نتيجة تحليل تأخير ولا بديل عن مراجعة Primavera P6 أو محلل زمني مؤهل.

## تشغيل نسخة المصدر

استخدم Node.js 22 أو إصداراً متوافقاً، ثم شغّل الأوامر التالية من جذر المشروع:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

وللتأكد قبل أي تعديل أو دمج:

```bash
pnpm test
pnpm check
pnpm build
git diff --check
```

لا تُرفع ملفات `.env` أو مفاتيح الدخول أو `node_modules` أو مخرجات `dist` إلى المستودع. يحتوي `pnpm-lock.yaml` على نسخة التبعيات المقفلة المطلوبة للتشغيل القابل للتكرار.

## خريطة البدء لأي وكيل برمجي أو مطور

| المجال | نقطة البداية | ملاحظة مهمة |
|---|---|---|
| غلاف التطبيق والتنقل | `client/src/pages/Home.tsx` | لا تغيّر محرك الحساب من الواجهة. شاشة البداية وإعادة فتحها تتصلان من هنا. |
| شاشة البداية والصوت | `client/src/components/AppLaunchSplash.tsx` | الصوت **اختياري** ولا يبدأ من تلقاء نفسه؛ لا تستبدل هذا السلوك بـautoplay. |
| هوية المنتج | `client/src/components/ProductIdentity.tsx` | بيانات المُعد مركزية هنا؛ لا تكررها نصوصاً في مكونات متفرقة. |
| Time Slice وHalf–Zero | `client/src/lib/update-to-update-analysis.ts` | Time Slice رصدي، وHalf–Zero مراجعة Update-to-Update؛ لا يتحول أي منهما لحكم مسؤولية أو EOT تلقائي. |
| TIA/CPM وXER | `client/src/lib/cpm.ts` و`client/src/lib/xer*.ts` | يحافظ مسار XER على البايتات محلياً في جلسة المتصفح؛ لا تُدخل XER الخام إلى الخادم أو DB أو Git. |
| مركز المعرفة | `client/src/components/KnowledgeCentrePanel.tsx` | يربط المنهجيات والحالات والـdecision flow؛ راجع المحتوى العلمي من الوثائق أدناه قبل توسعته. |
| تنزيل Windows | `client/src/lib/release-guide.ts` و`client/src/components/ProjectResourcesPanel.tsx` | روابط Setup/Portable مركزية ومباشرة، ولا تعني إنشاء Windows release جديد من المصدر الحالي. |

## أين دُمجت المراجع والملخصات العلمية؟

المكتبة داخل التطبيق ليست نسخاً كاملة من الكتب أو تقارير الجهات الأخرى. الذي دُمج هو **هيكل تعليمي ومنهجي مستقل**: تعريف الطرق، مراحل العمل، حالات استخدام، أسئلة قرار، سجلات أدلة، وتنبيهات الحدود. توجد المراجع والقرارات المنهجية في:

| المادة | موضعها في المصدر | ما الذي تستخدمه الواجهة؟ |
|---|---|---|
| منهجيات التأخير وSCL | `docs/TIA_STUDIO_METHODOLOGY_AR.md` و`docs/scl-methods-research.md` | مركز المعرفة، الإرشادات والـNarrative templates. |
| Window / Time Slice | `docs/WINDOW_ANALYSIS_METHOD_RESEARCH_AR.md` و`docs/WINDOW_ANALYSIS_USER_GUIDE_AR.md` و`docs/REVIEW_20260827_USER_INPUTS.md` | مسار النوافذ الرصدي، وحدود التفسير والمراجعة. |
| Half-Step / Zero-Step | `docs/HALF_ZERO_STEP_METHOD_AND_PLAN_AR.md` و`docs/QA_HALF_ZERO_STEP_AR.md` | Review-only بعد المقارنة بين التحديثات. |
| مصادر Qwen وZ.AI والمواد التي قدّمها المستخدم | `docs/QWEN_REVIEW_INTAKE_AR.md` و`docs/ZAI_REVIEW_AND_NEXT_DECISION_AR.md` و`docs/REVIEW_20260827_USER_INPUTS.md` | قرار/Backlog موثق، وليس نسخاً لملفاتهم أو ادعاء تحقق مستقل. |
| حماية XER والتحقق P6 | `docs/XER_PRESERVATION_AND_EVENT_PACKAGE_PLAN_AR.md` و`docs/RESEARCH_P6_CALENDAR_CLNDR_DATA_NOTES.md` | تحذيرات الاستيراد/التصدير وقائمة تحقق P6. |

بالتالي لا توجد داخل الحزمة نسخ من الكتب أو XER/Excel الخاصين بأي حالة أو أي مطالبات أو أدلة عميل. هذا مقصود لحماية الخصوصية والملكية الفكرية.

## أصل المقدمة الصوتية

الصوت الافتتاحي مورد ثابت خارجي مخصص للمشروع، وليس ملفاً داخل المستودع. المكوّن يستعمل الرابط الثابت الذي يظهر في `AppLaunchSplash.tsx`. لا تحذف هذا الرابط أو تستبدله بملف محلي ضمن `client/public` أو `client/src/assets`؛ احتفظ بأي أصل بديل في `/home/ubuntu/webdev-static-assets/` ثم ارفعه بالطريقة المعتمدة للمشروع. يجب أن يبقى تشغيل الصوت نتيجة ضغط المستخدم فقط.

## حدود لا يجوز تجاوزها من دون أدلة مستقلة

1. لا تدّعِ تطابق Primavera P6 أو تقويمه أو تواريخه أو Float أو المسار الحرج قبل **Reverse Import ثم Schedule/F9** على نسخة P6 غير إنتاجية ودليل قابل للمراجعة.
2. لا تدّعِ سبب التأخير أو المسؤولية أو EOT أو entitlement أو كلفة تلقائياً؛ الواجهة تنتج أدلة وحسابات ومسودات للمراجعة.
3. لا تحفظ XER/XML/XLSX أو أدلة/مطالبات العميل في GitHub أو `localStorage` أو الخادم أو قاعدة البيانات. يظل المصدر الخام في جلسة المتصفح فقط عند الحاجة.
4. لا تعدّل `server/_core`؛ هو جزء من البنية المجهزة للمشروع.

## التسليم والفرع المرجعي

المصدر المرجعي هو فرع [`main`](https://github.com/fanoz1200/TIA-Studio/tree/main) في مستودع GitHub الظاهر. قبل البدء على أي وكيل آخر، استنسخ هذا الفرع ثم نفّذ بوابة الاختبار أعلاه. حزمة ZIP التي تُسلّم مع هذه الدورة هي لقطة من نفس الالتزام بعد فحص المحتوى واستبعاد العناصر الحساسة؛ أما GitHub فيبقى المصدر الأنسب للتاريخ والفروع والمقارنة.
