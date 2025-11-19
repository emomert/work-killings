# 🇹🇷 Türkiye İş Cinayetleri Haritası

Türkiye'de meydana gelen iş cinayetlerini haritada gösteren, otomatik güncellemeli web sitesi.

## 🎯 Özellikler

- **📍 İnteraktif Harita**: OpenStreetMap üzerinde her iş cinayeti için detaylı marker
- **🤖 Otomatik Güncelleme**: GitHub Actions ile her 6 saatte bir Twitter'dan veri çekimi
- **🧠 AI Analizi**: Gemini AI ile tweet'lerden yapılandırılmış veri çıkarma
- **🔔 Bildirimler**: Yeni kayıtlar için otomatik GitHub Issue oluşturma

## 📊 Nasıl Çalışır?

```
GitHub Actions (Her 6 saatte)
    ↓
Twitter API (@isigmeclisi hesabını kontrol)
    ↓
Gemini AI (Tweet'leri analiz et)
    ↓
Nominatim (Konum → Koordinat)
    ↓
data.json güncelle
    ↓
GitHub'a commit & push
    ↓
Frontend otomatik güncellenir
```

## 🚀 Kurulum

### 1. Repository'yi Clone Edin

```bash
git clone <your-repo-url>
cd work-killings
```

### 2. API Key'leri Yapılandırın

GitHub repository'nize aşağıdaki secrets'ları ekleyin:

**Settings → Secrets and variables → Actions → New repository secret**

- `TWITTER_API_KEY`: Twitter API Key
- `TWITTER_API_SECRET`: Twitter API Secret
- `TWITTER_BEARER_TOKEN`: Twitter Bearer Token
- `GEMINI_API_KEY`: Google Gemini API Key

### 3. GitHub Actions'ı Etkinleştirin

**Actions** sekmesinden workflow'u etkinleştirin.

### 4. Manuel Test (Opsiyonel)

Lokal olarak test etmek için:

```bash
# Virtual environment oluştur
python -m venv venv

# Aktif et (Windows)
venv\Scripts\activate

# Aktif et (Mac/Linux)
source venv/bin/activate

# Bağımlılıkları kur
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env
# .env dosyasını kendi API key'lerinizle düzenleyin

# Scraper'ı çalıştır
python scraper.py
```

## 📁 Dosya Yapısı

```
work-killings/
├── index.html           # Ana sayfa
├── style.css            # Tasarım
├── script.js            # Harita fonksiyonları
├── scraper.py           # Twitter scraper + AI analizi
├── data.json            # Tüm iş cinayeti verileri
├── last_tweet_id.txt    # Son işlenen tweet ID
├── requirements.txt     # Python bağımlılıkları
├── .env.example         # API key şablonu
├── .gitignore          
└── .github/
    └── workflows/
        └── update-map.yml  # GitHub Actions workflow
```

## 🔧 Manuel Veri Ekleme

`data.json` dosyasına manuel olarak veri eklemek için:

```json
{
  "id": "unique-id",
  "coords": [LAT, LNG],
  "date": "GG Ay YYYY",
  "location": "Şehir, İlçe",
  "city": "Şehir",
  "company": "Şirket Adı",
  "victims": ["İsim (Yaş)", "İsim (Yaş)"],
  "cause": "Ölüm nedeni",
  "details": "Detaylı açıklama",
  "sector": "Sektör"
}
```

## 🔐 Güvenlik

- API key'ler asla kod içinde saklanmaz
- GitHub Secrets kullanılır
- `.env` dosyası `.gitignore`'da

## 📝 Lisans

Bu proje iş cinayetlerinin unutulmaması ve farkındalık yaratılması amacıyla oluşturulmuştur.

## 🙏 Veri Kaynağı

- Twitter: [@isigmeclisi](https://twitter.com/isigmeclisi)

---

**Not**: Bu bir proje şablonudur. Üretim kullanımı için lütfen veri doğrulama ve ek güvenlik önlemleri ekleyin.
