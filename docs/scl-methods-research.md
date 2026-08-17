# ملاحظات بحثية — طرق تحليل التأخير وفق SCL

## مصادر تمت مراجعتها

| المصدر | خلاصة قابلة للاستخدام داخل المنتج |
|---|---|
| [Society of Construction Law — Delay and Disruption Protocol](https://www.scl.org.uk/resources/delay-disruption-protocol) | الصفحة الرسمية تؤكد أن البروتوكول أُعد لإرشاد الأطراف عند التعامل مع تمديدات الزمن والتعويض عن التأخير والتعطيل، وأن شفافية المعلومات والمنهجية عنصر أساسي لمنع النزاعات وحلها. وتوفر الصفحة النسخة الثانية المنشورة في فبراير 2017، بما فيها نسخة عربية رسمية. |
| [HKA — Statistical review of delay analysis methods](https://www.hka.com/article/a-statistical-review-of-delay-analysis-techniques-used-over-the-last-decade/) | تورد ست طرق شائعة يعترف بها بروتوكول SCL للتحليل بعد الحدث: Impacted As-Planned، Time Impact Analysis، Time Slice Window Analysis، As-Planned versus As-Built Window Analysis، Retrospective Longest Path Analysis، وCollapsed As-Built Analysis. تذكر أن اختيار الطريقة يعتمد على المشروع والعقد وتوفر وموثوقية البيانات والوقت المتاح. |
| [Fenwick Elliott — SCL Protocol 2nd edition](https://www.fenwickelliott.com/knowledge-hub/annual-review/ar-2017/the-scl-delay-and-disruption-protocol-a-second-edition/) | تشرح أن التحليل المعاصر هو الأفضل، وأن النسخة الثانية لا تفضّل طريقة واحدة للتحليل بعد الحدث؛ بل تشدد على ملاءمة الطريقة لسجل المشروع والوقائع والتناسب. كما تعرض تعريفاً عملياً للتزامن الحقيقي يتطلب أن يكون حدثا صاحب العمل والمقاول سببين فعالين لتأخير الإكمال على المسار الحرج في الوقت نفسه. |
| [LexisNexis — Delay analysis methods](https://www.lexisnexis.com/en-gb/legal/guidance/delay-analysis-methods) | تؤكد أن Section 11 من SCL Protocol (2nd ed.) هو إطار تصنيف طرق التحليل، وتلفت إلى الطابع الفني المتخصص للطرق وعدم ملاءمة الشروح المبسطة وحدها للاستخدام الخبروي أو القانوني. |

## قرارات المنتج المقترحة

ستعتمد مكتبة TIA Studio تسمية SCL الوظيفية لست طرق تحليل، مع ربط كل بطاقة بـ: منظور التحليل (معاصر/بعد الحدث)، مدخلات البيانات، خطوات العمل، متى تصلح، ما لا تستطيع إثباته وحدها، وعلامة تحذير بعدم الخلط بين قياس الأثر الزمني والاستحقاق التعاقدي. سيظهر Time Impact Analysis كطريقة مدعومة حسابياً في النسخة الحالية؛ أما باقي الطرق فستظهر كمكتبة علمية وخطة عمل ونموذج مخرجات، مع تمييز واضح للوظائف التي تحتاج بيانات تاريخية كاملة كي تتحول إلى حساب مؤتمت لاحقاً.

> «Do not ‘wait and see’ regarding impact of delay events» — كما لخصت Fenwick Elliott مبدأ SCL الأساسي للتحليل المعاصر. ستظهر هذه القاعدة في قائمة فحص اختيار النافذة والطريقة.

## ملاحظات فنية لاستيراد Primavera P6 XER

توضح وثائق Oracle أن XER صيغة تبادل مملوكة لـ Primavera وأن ملف XER/XML يضم المشاريع والبيانات المرتبطة بها فقط، ومن ذلك الأنشطة وعلاقاتها وتقويمات المشروع عند تصديرها. كما تؤكد أن التقويمات عنصر أساسي في الاستيراد؛ وعند استبعادها، يُسند تقويم افتراضي إلى الأنشطة الجديدة. [Oracle — P6 XML/XER Import Objects](https://docs.oracle.com/cd/E80480_01/help/en/user/234146.htm) توضح أيضاً أن الاستيراد الكامل في P6 يتعامل مع نطاق أوسع كثيراً من الجدولة، مثل الموارد والتكاليف والرموز والـ WBS.

قرار التنفيذ في TIA Studio هو **مستورد XER جدولي محلي**: يقرأ الجداول اللازمة لتحليل التأخير فقط (`PROJECT` و`TASK` و`TASKPRED` و`CALENDAR` حيث تتوافر)، يعرض ملخصاً شفافاً لما تم التقاطه وما تم تجاهله، ولا يدعي التماثل الكامل مع معالج الاستيراد في P6. هذا يحد من المخاطر ويُبقي أثر كل تحويل واضحاً وقابلاً للمراجعة.
