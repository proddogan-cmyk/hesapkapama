# hesapkapama.com v2

## Kurulum (Windows)
```bash
npm install
npm run dev
```

Tarayıcı: http://localhost:3000

## Notlar
- Clerk anahtarları `.env.local` içinde (test). Güvenlik için canlıya çıkmadan önce rotate etmen önerilir.
- Fiş OCR: Kamera için localhost veya HTTPS gereklidir.
- Toplu fiş: 50 adede kadar seçebilirsin; tutar OCR ile bulunamazsa 0 olarak eklenir (manuel düzeltilebilir).
- Excel çıktı: Şablon dosyasına satır ekler; Excel açıldığında formüller yeniden hesaplar.
