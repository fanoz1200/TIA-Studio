# حزمة إنتاج فيديوهات التدريب عبر MAGI-2 Preview

**الغرض.** هذه الحزمة لا تشغّل النموذج من داخل تطبيق تحليل التأخير ولا ترسل إليه ملفات المستخدم. إنها تحدد مدخلات إنتاج مسبق لفيديوهين قصيرين، ليُنفّذا لاحقاً في بيئة GPU معزولة ومطابقة للمتطلبات الرسمية. تنشر الملفات النهائية فقط كأصول ثابتة بعد المراجعة البشرية.

> **قاعدة خصوصية ملزمة:** لا يُمرَّر أي ملف P6 أو XER أو XML أو Excel أو اسم مشروع أو بيانات تعاقدية إلى مسار توليد الفيديو. تستخدم اللقطات المرجعية واجهة تدريبية خالية من بيانات حقيقية، ويظل تحسين المطالبة الخارجي معطلاً.

## مواصفات موحّدة

| الخاصية | القرار المعتمد |
| --- | --- |
| النموذج المقصود | MAGI-2 Preview في وضع Image-to-Video مع الصوت المتزامن. |
| عدد المقاطع | مقطع واحد مستقل لكل موضوع؛ الحد الرسمي للمقطع هو 10 ثوانٍ. |
| الدقة | 1080p بنسبة 16:9؛ لا يغيّر النموذج النص العربي الظاهر في لقطة الواجهة المرجعية. |
| الصوت | عربي فصيح مبسّط بنبرة مهنية هادئة؛ لا موسيقى ولا مؤثرات تخفي الكلام. |
| تحسين المطالبة | معطّل تماماً؛ لا يوضع مفتاح API ولا نقطة نهاية خارجية. |
| بيانات الإدخال | وصف نصي متحكم به ولقطة واجهة خالية من بيانات مشروع. |
| المخرج المسموح | MP4 بعد قبول بصري وصوتي يدوي؛ ثم يرفع كأصل ثابت مستقل عن قاعدة البيانات. |

## الفيديو الأول — رفع P6

يشرح هذا المقطع أول بوابتين إلزاميتين في رحلة Workshop 8: ملف **Baseline** ثم **Update** الأقرب قبل الواقعة. تُستخدم لقطة من واجهة رحلة TIA في خطوة الرفع، بعد إخفاء أسماء الملفات أو استبدالها بأسماء تدريبية غير حقيقية مثل `Baseline_Training.xer` و`Update_PreEvent_Training.xer`.

| العنصر | مواصفة الإنتاج |
| --- | --- |
| العنوان الظاهر في بطاقة التطبيق | رفع برنامج P6: Baseline ثم Update |
| النص المنطوق المطلوب، حرفياً | ابدأ بملف Baseline، ثم أضف Update السابق للواقعة. راجع الأنشطة والعلاقات والتقويم قبل الاعتماد، فالملف الأصلي يبقى محفوظاً دون تعديل. |
| الحركة | تكبير هادئ جداً نحو بوابة رفع Baseline، ثم انتقال بصري بسيط إلى بطاقة Update ثم إلى عدادات التحقق. لا نقرات غير موجودة ولا تغيير للنص. |
| وصف MAGI-2 المقترح | `Use the supplied clean TIA application screenshot as the only visual reference. Preserve every visible UI element, Arabic label, number, and layout exactly. Create a calm 10-second 16:9 tutorial motion: a subtle camera push toward the Baseline upload gate, then a gentle focus shift to the pre-event Update gate and the validation counters. No new UI, no cursor, no added text, no edits to existing text, no project data, no logos added. Generate synchronized clear Modern Standard Arabic narration, spoken exactly as specified in the production packet, with no music.` |
| مرفوض إذا | تغيّر نص الواجهة أو أسماء الحقول، أو اختفى Baseline/Update، أو صار النطق العربي غير مفهوم، أو ظهر اسم مشروع حقيقي. |

## الفيديو الثاني — إدخال Excel

يشرح هذا المقطع تجهيز سجل الواقعة قبل إنشاء الـ Fragnet، من خلال نموذج Excel المنظم وخيارات الأنشطة ونقاط الربط الفعلية. تستخدم لقطة تدريبية من مرحلة Excel فقط، ولا يظهر فيها أي سجل تعاقدي فعلي.

| العنصر | مواصفة الإنتاج |
| --- | --- |
| العنوان الظاهر في بطاقة التطبيق | إدخال Excel: وثّق الواقعة قبل Fragnet |
| النص المنطوق المطلوب، حرفياً | ارفع نموذج Excel، ثم وثّق رقم الواقعة وتاريخها ومدتها. اختر الأنشطة ونقاط الربط من البرنامج نفسه، وراجع تقسيم Pre وEvent وPost قبل الحساب. |
| الحركة | حركة خفيفة من صفوف نموذج Excel إلى قوائم الأنشطة، ثم إلى معاينة التقسيم Pre / Event / Post. لا تتغير القيم أو الكتابة العربية في المرجع. |
| وصف MAGI-2 المقترح | `Use the supplied clean TIA Excel-step screenshot as the only visual reference. Preserve every visible UI element, Arabic label, value, and layout exactly. Create a calm 10-second 16:9 tutorial motion that lightly guides attention from the Excel issue rows to the activity and logic-point selectors, then to the Pre / Event / Post split preview. No new UI, no cursor, no added text, no edits to existing text, no user or project data, no music. Generate synchronized clear Modern Standard Arabic narration, spoken exactly as specified in the production packet.` |
| مرفوض إذا | حُرّفت الخلايا أو عناوين Pre/Event/Post، أو اختلق النموذج بيانات، أو لم يمكن تمييز الكلام العربي بوضوح. |

## بوابة القبول قبل النشر

يُقبل كل مقطع فقط إذا اجتاز فحصاً من مرحلتين. أولاً، يقارن مراجع بشري اللقطة مع الصورة المرجعية للتأكد من ثبات الحقول العربية وعدم ظهور أي بيانات واقعية. ثانياً، يُستمع إلى النص كاملاً من دون موسيقى ويُطابق مع النص المطلوب حرفياً في حدود نطق طبيعي واضح. عند عدم تحقق أي شرط، يُرفض المقطع ولا يُنشر ولا يُضاف إلى التطبيق.

## مسار التشغيل الآمن عند توفر البنية

1. تُبنى حاوية معزولة من Dockerfile الرسمي عند مراجعة ثابتة، وتُراجع التبعيات قبل التشغيل. لا تُشغّل الحاوية على خادم تطبيق TIA أو مع بياناته.
2. تُنزّل الأوزان إلى تخزين مخصص ومشفّر خارج مستودع التطبيق. لا يُنقل إلى قاعدة البيانات أي جزء من الأوزان أو المدخلات أو المخرجات.
3. يُشغّل MAGI-2 على العتاد المؤهل، مع إلغاء تعيين `API_KEY` الخاص بتحسين المطالبة. لا يوضع مفتاح OpenAI أو Google أو أي مزود خارجي.
4. تُنشأ كل عينة من لقطة تدريبية نظيفة ومن الوصف المحكوم أعلاه. تُحفظ النتيجة وبيانات مصدرها (رقم إصدار المستودع، seed، التاريخ) في سجل إنتاج منفصل غير متصل بمشاريع المستخدم.
5. بعد قبولها، تُرفع ملفات MP4 فقط إلى التخزين الثابت للتطبيق وتُربط ببطاقات المكتبة. لا توجد ميزة توليد حي داخل واجهة المستخدم.

## تنبيه تشغيلي حاسم

وقت إعداد هذه الحزمة، لا تتوافر في بيئة المشروع وحدات GPU أو CUDA أو مساحة كافية للأوزان. لذلك تم تجهيز المحتوى ومعيار القبول، لكن لم يُنتج فيديو MAGI-2 فعلي. لا تُستبدل هذه الحقيقة بفيديو اصطناعي من مزود آخر ولا يُكتب على أي أصل أنه من MAGI-2 قبل تشغيل موثق على عتاد مؤهل.

## سجل تحقق واجهة التدريب

تم في 19 أغسطس 2026 فتح واجهة التطبيق محلياً والتحقق من أن معالج Workshop 8 يعرض مساراً من سبع خطوات: الموسوعة، المنهج، Baseline، Updates، Excel، التقسيم، ثم الحساب. وظهر المسار المباشر وتحديد منهج TIA باستخدام مشروع الاختبار `XER-SMOKE` فقط. لذلك يمكن استخراج صور مرجعية نظيفة منه بعد الوصول إلى خطوات الرفع وExcel، بشرط عدم استخدام أي ملف برنامج أو واقعة حقيقية في التصوير.

حُفظت لقطة مرجعية نظيفة لبوابة **رفع Baseline** في `/home/ubuntu/webdev-static-assets/magi2-training-references/p6-baseline-upload-reference.webp`. هذه اللقطة لا تحتوي ملفاً مرفوعاً ولا بيانات واقعية، وهي أصل تحضيري داخلي فقط وليست فيديو تدريبياً منشوراً.

## مراجع

[1]: https://github.com/SandAI-org/MAGI-2-preview "Sand AI — MAGI-2 Preview repository"
[2]: https://huggingface.co/sand-ai/MAGI-2-preview "Sand AI — MAGI-2 Preview model card"
[3]: https://raw.githubusercontent.com/SandAI-org/MAGI-2-preview/main/Dockerfile "MAGI-2 Preview official Dockerfile"
[4]: https://raw.githubusercontent.com/SandAI-org/MAGI-2-preview/main/inference/prompt_enhancement/enhancer.py "MAGI-2 Preview prompt enhancement implementation"
