# النسخ اليدوي المجاني والاستعادة — TIA Studio

## الهدف والحدود

هذا المسار يحفظ **مصدر TIA Studio المتعقب في Git**، ونسخة Windows المتاحة محلياً إن وُجدت، وملفات تحقق SHA-256. لا يشغّل أي مزامنة دورية ولا ينشئ حساب تخزين أو يرسل ملفاً إلى جهة خارجية.

> لا تحتوي الحزمة ملفات `.env` أو أسراراً أو جلسات دخول أو قاعدة بيانات أو ملفات التخزين السحابي أو XER/XML/XLSX أو الأدلة والمراسلات أو مخرجات مطالبة خاصة بالعميل.

لذلك فالحزمة **حزمة استعادة كود وتشغيل محلي**، وليست بديلاً عن تصدير بيانات مشروع يملكه المستخدم من بيئته المصرح بها.

## إنشاء الحزمة

بعد نجاح الاختبارات وحفظ نسخة من المشروع، نفذ من جذر المشروع:

```bash
pnpm continuity:package --output /مسار/خارج/المشروع/TIA-Studio-Backups
```

ينشئ الأمر مجلداً وملف ZIP باسمه، مثل:

```text
TIA-Studio-Manual-Backup-<commit>/
TIA-Studio-Manual-Backup-<commit>.zip
TIA-Studio-Manual-Backup-<commit>.zip.sha256
```

إذا لم تكن هناك ملفات Windows في مجلد `release/`، يظل أرشيف المصدر صالحاً. ولإنشاء نسخة مصدر فقط بشكل صريح استخدم:

```bash
pnpm continuity:package --source-only --output /مسار/خارج/المشروع/TIA-Studio-Backups
```

## التحقق قبل الحفظ

على macOS أو Linux، بعد فك ZIP:

```bash
sha256sum -c SHA256SUMS.txt
```

على Windows PowerShell، قارن قيمة كل ملف بما هو مكتوب في `SHA256SUMS.txt`:

```powershell
Get-FileHash .\TIA-Studio-source-<commit>.tar.gz -Algorithm SHA256
Get-FileHash .\windows\TIA-Studio-...-Portable.exe -Algorithm SHA256
```

وتحقق من ملف ZIP نفسه قبل فكه عند الحاجة:

```powershell
Get-FileHash .\TIA-Studio-Manual-Backup-<commit>.zip -Algorithm SHA256
```

## الاستعادة على جهاز جديد

| الهدف | الخطوة |
|---|---|
| تشغيل ملف Windows المرفق | افحص SHA-256 أولاً، ثم جرب `Portable.exe` قبل `Setup.exe`. قد يكون ملف Windows أقدم من commit المصدر؛ انظر `backup-manifest.json` ولا تفترض التطابق. |
| استعادة المصدر | فك `TIA-Studio-source-<commit>.tar.gz` في مجلد جديد، وثبّت Node.js 22 وpnpm، ثم نفذ `pnpm install --frozen-lockfile` و`pnpm test` و`pnpm check` و`pnpm build`. |
| إعادة بناء Windows بنفس المصدر | بعد نجاح البوابة، نفّذ `pnpm desktop:pack:windows` واتبع الاختبار الفعلي في `docs/TIA_STUDIO_DESKTOP_RELEASE_AR.md`. لا يكفي وجود EXE أو نجاح البناء وحده. |
| استعادة البيانات | لا تستعاد من هذه الحزمة. يلزم تصدير منفصل ومصرح به للبيانات وملفات العميل من المالك أو مسؤول النظام. |

## حفظ آمن ومجاني

احفظ ملف ZIP وبصمة SHA-256 في **مكانين يسيطر عليهما المالك**، مثلاً على قرص USB مشفر وعلى قرص داخلي ثانٍ. GitHub الخاص يحفظ مصدر الكود المتعقب، لكنه لا يغني عن حزمة محلية مستقلة ولا يجب أن يستقبل أدلة العميل أو الأسرار.

## ما لا تدعيه هذه الحزمة

- لا تثبت تكافؤ Primavera P6/F9 أو سلامة برنامج العميل أو صحة تحليل التأخير.
- لا تثبت entitlement أو EOT أو أي موقف قانوني أو تعاقدي.
- لا تضمن أن ملف Windows المرفق بُني من نفس commit المصدر، ما لم تثبت ذلك بإعادة البناء والتحقق الفعلي.
- لا تعيد إنشاء بيئة OAuth أو الأسرار أو قاعدة البيانات أو التخزين السحابي تلقائياً.
