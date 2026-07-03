# akcai (Loop Orchestra)

`akcai` (Loop Orchestra), yapay zeka ajanlarının (Claude Code, Codex vb.) kendi başlarına, izole edilmiş Git Worktree ortamlarında ve geçici Docker veritabanlarında otonom olarak çalışmasını sağlayan bir orkestratördür.

Bu sistem, projelerdeki işleri paralel olarak "işçilere" böler, kotalarını yönetir ve yalnızca testleri başarıyla geçen kodları ana projeye (`develop` branch'ine) birleştirir.

## Özellikler

- **Worktree Manager:** Her bir görev (task) için ayrı, kilitlenmeyen bir Git Worktree yuvası.
- **Docker İzolasyonu:** Görev bazlı anında ayağa kalkan ve iş bitince kendini yok eden yerel veritabanı konteynerleri.
- **Quota Guard:** Token kullanım kotalarını dinamik olarak takip eder, kota bittiğinde uyku moduna geçer.
- **Subagent Prompts:** Architect, Implementer ve Test Writer rolleri için özelleştirilmiş AI şablonları.
- **Güvenli Secret Yönetimi:** Ajanlar API anahtarlarına erişemez, kimlik bilgileri Dispatcher katmanında tutulur.

## Hızlı Başlangıç

Bu mimariyi kendi projenize entegre etmek için:

```bash
# Hedef projenizde otonom ajan mimarisini başlatır
./init.sh ../hedef-projeniz
```

Hedef projede `.loop-orchestra` dizini oluştuktan sonra:
1. `.env.example` dosyasını `.env` olarak kopyalayıp API anahtarlarınızı girin.
2. `npm install` ile bağımlılıkları (dotenv vb.) yükleyin.
3. `npm start` ile orkestratörü başlatın.
