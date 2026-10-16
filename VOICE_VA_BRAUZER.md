# Zumrad — ovozli buyruq va brauzer boshqaruvi

## Ishlashi
1. Ilovani oching (Chrome / Android Chrome) va 🎙 tugmasini bosing.
2. "Zumrad, telegramdagi xabarlarni o'qi" — faqat "Zumrad" deganingizdan keyingi gap bajariladi.
3. Buyruqlar: `och <sayt>`, `qidir <so'z>`, `orqaga`, `pastga/tepaga`, `yangila`, `<telegram|whatsapp|instagram> xabarlarni o'qi`, `to'xta`.

## Kengaytmani o'rnatish
`chrome://extensions` → Developer mode → Load unpacked → `extension/` papkasi.
Messenjerlarga (web.telegram.org, web.whatsapp.com, instagram.com) oldindan o'zingiz kirgan bo'lishingiz kerak. Xabarlar faqat so'ralganda, so'ralgan bitta messenjerdan o'qiladi.

## Domen va deploy
Cloudflare → Workers → loyiha → Settings → Domains & Routes → Add Custom Domain. Domen Cloudflare'da bo'lishi kerak.

## Cheklovlar (halol)
- Telefonni to'liq boshqarish veb-ilovada mumkin emas: Android uchun alohida Kotlin ilova (AccessibilityService) kerak; iOS bunga ruxsat bermaydi. Bu versiyada yo'q.
- Messenjer o'qish sahifa DOM'iga tayanadi; sayt dizayni o'zgarsa `extension/content.js` ichidagi `SEL` ni yangilash kerak.
- Ovozni matnga aylantirish brauzer/OS ichki xizmati orqali; bu ilovaga qo'shilgan model emas.
