# مرجع خارجي موجز — Half-Step Delay Analysis

> هذا المرجع للتثقيف الفني فقط. لا يحدد استحقاقاً أو مسؤولية أو تمديد مدة لمشروع بعينه.

## النقطة المستخلصة

يصف مصدر Steelray تحليل **Half-Step** بأنه مقارنة بين تحديثين متتاليين، مع تطبيق التغييرات المرتبطة بالتقدم في بداية فترة التحديث للفصل بينها وبين تغييرات الخطة أو التعافي. كما تشرح SmartPM أن هذا الفصل يساعد على تمييز تأخيرات الأداء السابقة عن تدابير التعافي المدمجة في التحديث التالي.

تؤكد Ten Six أن التنفيذ اليدوي المتين لا يكتفي بوضع كل التقدم في دفعة واحدة: فترتيب تغييرات متعددة قد يحجب التأخيرات المتزامنة. لذلك تصف الاستخدام اليومي أو بوحدات تخطيط مناسبة لتطبيق تغييرات التقدم الواقعة في التاريخ نفسه ثم إعادة الحساب. وتبين ورقة Schumacher وWinter أن “Bifurcation / Two-Stepping” يستبعد من progress-only التغييرات غير المرتبطة بالتقدم، مثل إضافة/حذف أو دمج/تقسيم الأنشطة، العلاقات وlags، القيود، المدد، والتقاويم والعطلات. هذه قائمة تدقيق للمدخلات وليست حكماً بأن أي تغيير غير مقبول.

أوضح مصدر PlanCo حالة التحكم بأربع صور: Previous (خطة قديمة/تقدم قديم)، Half-Step (خطة قديمة/تقدم جديد)، Zero-Step (خطة جديدة/تقدم قديم)، وCurrent (خطة جديدة/تقدم جديد). وفق المصدر، يفصل `Previous → Half-Step` أثر التقدم، بينما يفصل الانتقال الباقي أثر revisions، ويستخدم Zero-Step كتدقيق مكمل لجهة revisions. ورقة Schumacher وWinter تسمي العملية أيضاً Bifurcation أو Two-Stepping، وتذكر أن الهدف فصل progress reporting عن revisions غير المرتبطة بالتقدم مثل تغييرات الأنشطة والمنطق والـlags والقيود والمدد والتقاويم.

## الحدود المهنية

هذه الطريقة تفسر حركة الجدول ولا تثبت وحدها السبب التعاقدي أو المسؤولية أو entitlement أو EOT. يلزم التحقق من صلاحية كل Update، وData Dates، وتاريخ التغييرات وأدلتها، ثم مراجعة المحلل المختص.

## المصادر

1. [Steelray — Half Step Delay Analysis for Primavera P6](https://steelray.com/DelayAnalyzer/DelayAnalyzerP6.php)، نتائج بحث تمت مراجعتها في 26 أغسطس 2026.
2. [PlanCo — Half-Step Analysis in Primavera P6](https://www.plancotool.com/blog-half-step-analysis)، صفحة تم استخراج نصها في 26 أغسطس 2026.
3. [Hannah E. Schumacher and Ronald M. Winter — Creating Half-Step Schedules Using P6](https://www.ronwinterconsulting.com/Creating_Half-Step_Schedules_Using_P6.pdf)، يونيو 2013، مستخرج في 26 أغسطس 2026.
4. [AACE Community — Why It’s Time to Add a Half-Step Analysis](https://communities.aacei.org/events/event-description?CalendarEventKey=e16c77e2-2f80-4738-ab22-019234a13817&Home=%2Fhome)، تصف MIP 3.4 كتحليل Half-Step لسؤال تغييرات التقدم بين التحديثات، نتائج بحث تمت مراجعتها في 26 أغسطس 2026.
5. [Ten Six — What Is a Half Step Delay Analysis and Why Should You Care?](https://tensix.com/what-is-a-half-step-delay-analysis-and-why-should-you-care/)، راجعت في 26 أغسطس 2026؛ تناقش فصل progress عن revisions وضرورة مراعاة التغييرات المتزامنة عند التطبيق اليومي.
