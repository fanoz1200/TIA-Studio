# ملاحظات بحث عامة: بيانات تقويم Primavera P6 في XER

**الغرض:** توثيق حدود القراءة المحلية لحقل `CALENDAR.clndr_data` من دون استخدام أو نسخ محتوى ملفات العملاء.

Oracle يعرّف في خريطة XER لـP6 Version 23 حقل `clndr_data` باسم **Data**، ويذكر بجواره معرف التقويم والأب والساعة اليومية/الأسبوعية/الشهرية/السنوية. لا تنشر خريطة الحقول قواعد فك التمثيل المتداخل أو خوارزمية Schedule/F9 [1].

تُظهر المراجع التقنية العامة أن النص يتكون من بنية أقواس متداخلة تشمل غالباً `CalendarData` و`DaysOfWeek` و`Exceptions`. قيم اليوم 1 إلى 7 تمثل أيام الأسبوع من الأحد إلى السبت، والفترات الزمنية تظهر بالرمزين `s` و`f`، فيما تظهر تواريخ الاستثناء كأرقام مع الرمز `d`. هذه معرفة بنيوية مفيدة لفحص العرض فقط، وليست مواصفة Oracle رسمية ولا إثباتاً لطريقة وراثة أو حساب P6 [2][3].

لذلك سيقتصر التطبيق على محلّل محافظ يعرض ما إذا كانت البنية قابلة للقراءة، وعدد فترات كل يوم، وعدد تواريخ الاستثناء والفترات المتصلة بها. لا يدخل الناتج إلى محرك CPM المحلي ولا ينتج تقويماً بديلاً ولا يقرر تاريخاً أو Float. إذا لم تكتمل البنية أو ظهر تقويم أساس، تبقى النتيجة `Review` أو `Blocked` حتى Reverse Import وSchedule/F9 داخل Primavera.

## المراجع

1. Oracle, [CALENDAR — P6 EPPM XER Import/Export Data Map Guide (Project), Version 23](https://docs.oracle.com/cd/F74771_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97869.htm).
2. Steven Auld, [XER File Parser — How to interpret or import to Excel the clndr_data table?](https://planningplanet.com/forums/oracle-primavera-pm6/731205/xer-file-parser-how-interpret-or-import-excel-clndrdata-table), Planning Planet, 16 Dec 2018.
3. Sebin Thomas, [Convert Oracle Primavera Calendar data (clndr_data) from database table into readable format using SQL](https://stackoverflow.com/questions/78553297/convert-oracle-primavera-calendar-data-clndr-data-from-database-table-into-rea), Stack Overflow, 30 May 2024.
