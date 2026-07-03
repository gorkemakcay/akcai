# Loop Orchestra — AI Agents Manifesto & Rules

## 1. WHAT (Proje Nedir?)
Loop Orchestra, otonom AI ajanları (Claude Code ve Codex) için geliştirilmiş, paylaşılan dosyalar (tasks.json) üzerinden haberleşen, worktree tabanlı bir görev orkestratörüdür. 
Amacımız asenkron çalışmayı güvenilir kılmak ve insan uyurken işlerin ilerlemesini sağlamaktır.

## 2. WHY (Neden Bu Şekilde Tasarlandı?)
- **Tier Yapısı:** Claude pahalı ama zekidir (Mimari / Tier 3), Codex ise ucuz ve boldur (Uygulama / Tier 2 ve 1). Görevler buna göre ayrıştırılır.
- **Worktree İzolasyonu:** Ajanlar aynı dosyayı aynı anda değiştirip çakışma yaratmasın diye her görev kendi izole `git worktree` ortamında çalışır.
- **Fail-Closed:** Ajanların hata yaptığında sessizce ilerlemesi yerine durup onay beklemesi (dead-letter) temel kuraldır. Ana branch'e (`main`) hiçbir otonom sistem doğrudan yazamaz.

## 3. HOW (Kurallar ve İşleyiş)
- **Doğrulama (Quality Gates):** Görevler sadece ajan "Bitti" dediği için bitmiş sayılmaz. `tasks.json` içindeki `quality_gates` komutları (örn: `npm test`) sıfır hata ile geçmelidir.
- **Bağımlılıklar:** Ajanlar, mevcut dosya içeriğini diskten okumalıdır. `files_touched` listesinde ortak dosya bulunan görevler asla paralel çalıştırılamaz.
- **Araç Kullanımı:** Görevlerin içeriğine müdahale eden tüm otonom değişiklikler bir commit üzerinden `develop` branch'ine birleştirilir. 

<important if="tier=1,2">
Codex (veya diğer uygulayıcı modeller), sadece `tasks.json` içindeki görevi eksiksiz tamamlamaya odaklanmalıdır. Yeni bir mimari karar ALMAMALIDIR.
</important>
