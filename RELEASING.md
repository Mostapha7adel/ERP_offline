# رفع إصدار جديد (Release) للتحديث التلقائي

التحديث التلقائي يعتمد على GitHub Releases في repo `Mostapha7adel/ERP_offline`.
عند بناء نسخة جديدة، ارفع ملفين كملف (asset) للـ release:

## الخطوات

### 1) ارفع الكود (code) لأول

```bash
git add -A
git commit -m "feat: <وصف التغييرات>"
git push origin master
```

### 2) أنشئ Release جديد على GitHub

1. افتح https://github.com/Mostapha7adel/ERP_offline/releases/new
2. "Choose a tag" → اكتب `v1.1.0` (أو الرقم الجديد) وأنشئ tag
3. العنوان: `v1.1.0` — الوصف: ملخص الميزات الجديدة
4. ارفع **الملفين** دول كـ assets:
   - `LedgerFlow_1.0.2_x64-setup.exe` (من `src-tauri\target\release\bundle\nsis\`)
   - `LedgerFlow_1.0.2_x64-setup.exe.sig` (نفس المجلد)
5. فعّل **"Set as the latest release"** وانشر

### 3) ارفع ملف `latest.json`

ملف `latest.json` هو اللي الـ app بيقريه ليعرف إن في نسخة جديدة. اتولّد تلقائياً في:
`src-tauri\target\release\bundle\nsis\latest.json`

ارفعه كأصل (asset) في نفس الـ release. لو مش موجود، يُبنى بجانب الـ `.sig`.

> ملاحظة: اسم ملف الـ installer **مش** مهم في الـ release — المهم `latest.json` لأنه يحتوي المسارات الصحيحة للملفات.

## متطلبات البناء مع التوقيع

أي build لازم يعمل بتوقيع (signing) عشان يطلع ملف `.sig` و `latest.json`:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content "$env:USERPROFILE\.tauri\ledgerflow.key" -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "LedgerFlow2026"
npm run tauri:build
```

> ⚠️ **احتفظ بمفتاح التوقيع** (`~\.tauri\ledgerflow.key` + كلمة السر) في مكان آمن.
> من غيره لا يمكن توقيع نسخ جديدة ولا تفعيل التحديث التلقائي.

## ملخص تلقائي

| الخطوة | الملفات المرفوعة على الـ release |
|--------|---------------------------------|
| Installer | `LedgerFlow_1.0.2_x64-setup.exe` |
| التوقيع | `LedgerFlow_1.0.2_x64-setup.exe.sig` |
| الفهرس | `latest.json` |