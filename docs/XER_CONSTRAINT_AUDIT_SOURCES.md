# مصادر تدقيق قيود وتقويمات XER

**حالة الوثيقة:** مرجع هندسي لتدقيق قارئ XER المحلي، وليست بديلاً عن إعادة الاستيراد والحساب داخل Primavera P6 غير الإنتاجي.

## حقول TASK التي ثبتت من مرجع Oracle

مرجع Oracle الرسمي لخريطة XER يحدد أن جدول `TASK` يحمل الحقول التالية: `clndr_id` للتقويم، و`cstr_type`/`cstr_date` للقيد الأساسي وتاريخه، و`cstr_type2`/`cstr_date2` للقيد الثانوي وتاريخه. لذلك يحتفظ TIA Studio بهذه البيانات كمادة تدقيق مستقلة عن منطق الشبكة، ولا يعامل غيابها كأنه «لا توجد قيود».

> لا تثبت خريطة الحقول وحدها تكافؤ محرك الحساب المحلي مع P6؛ فالأنماط المشفرة للتقويم، التقويمات المتعددة، حالة التحديث، والقيود الأخرى تحتاج مراجعة منفصلة داخل P6.

## حدود دعم الحساب المحلي

يدعم المحرك فقط القيود ذات الحد الأدنى التي يمكن التعبير عنها بشكل حتمي في تمرير CPM الأمامي بعد تحقق الرمز والتاريخ. أما القيود الصلبة، وقيود «في أو قبل»، والقيود الثانوية، وأي رمز غير معروف، فتظل مسجلة كتحذير/مانع مراجعة ولا يحاول المحرك تقليد أثرها تلقائياً.

## الروابط

1. [Oracle Primavera P6 EPPM XER Import/Export Data Map — TASK (Activities)](https://docs.oracle.com/cd/F74773_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97906.htm)
2. [Oracle Primavera P6 Professional Help — Start On or After constraint](https://docs.oracle.com/cd/F37128_01/client_help/en_US/start_on_or_after_constraint.htm)
3. [Oracle Primavera P6 Professional Help — Finish On or After constraint](https://docs.oracle.com/cd/F74771_01/client_help/en_US/finish_on_or_after_constraint.htm)
