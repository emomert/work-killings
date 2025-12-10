# Türkiye İş Cinayetleri Haritası

Türkiye'de yaşanan iş cinayetlerini görselleştiren interaktif bir web uygulaması.

## Amaç

Bu proje, Türkiye'de yetersiz iş güvenliği nedeniyle hayatını kaybeden işçilere dikkat çekmek amacıyla oluşturulmuştur. "İş kazası" olarak adlandırılan bu ölümler, çoğu zaman önlenebilir olduğundan dolayı "iş cinayeti" olarak nitelendirilmektedir.

## Özellikler

### Harita Görünümü
- Türkiye haritası üzerinde her bir iş cinayetinin konumu
- Kümeleme (clustering) ile yoğun bölgelerin görselleştirilmesi
- 18 yaş altı çocuk işçiler için mavi işaretleyiciler
- Detaylı bilgi popup'ları ve profil sayfaları

### Veri Tablosu
- Tüm kayıtların tablo formatında listelenmesi
- İsme göre arama
- CSV olarak dışa aktarma

### Analiz Sayfası
- Aylık iş cinayeti sayıları (sütun grafiği)
- Sektörel dağılım (pasta grafiği)
- Yaş gruplarına göre dağılım
- Yıllık karşılaştırma (çizgi grafiği)
- İl bazlı choropleth harita

### Filtreleme
- Yıl seçimi (2023, 2024, 2025)
- Yaş aralığı
- Cinsiyet
- Sektör
- Tarih aralığı

## Veri Kaynağı

Veriler [İSİG Meclisi](https://twitter.com/isaborosu) Twitter hesabından alınmaktadır.

**Önemli Notlar:**
- Bu veriler %100 doğruluğu garanti edilmemektedir
- Türkiye'de yaşanan her iş cinayeti ne yazık ki bu listede yer almamaktadır
- Veriler periyodik olarak güncellenmektedir

## Teknik Yapı

### Frontend
- HTML5, CSS3, JavaScript
- [Leaflet.js](https://leafletjs.com/) - Harita görselleştirme
- [Chart.js](https://www.chartjs.org/) - Grafikler
- MarkerCluster - Harita kümeleme

### Backend (Veri Toplama)
- Python
- Twitter API entegrasyonu
- DeepSeek API (veri analizi)
- OpenStreetMap Nominatim (geocoding)

## Kurulum

### Yerel Geliştirme

```bash
# Repository'yi klonla
git clone https://github.com/emomert/Turkey-Workplace-Homicide-Map.git

# Proje klasörüne gir
cd Turkey-Workplace-Homicide-Map

# Basit HTTP sunucusu başlat
python -m http.server 8000

# Tarayıcıda aç
# http://localhost:8000
```

### Backend Kurulumu (Veri güncelleme için)

```bash
# Backend klasörüne gir
cd backend

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyası oluştur ve API anahtarlarını ekle
# DEEPSEEK_API_KEY=...
# TWITTER_AUTH_TOKEN=...
# TWITTER_CT0=...

# Veri güncelleme scriptini çalıştır
python main.py
```

## Katkıda Bulunma

Ek veri kaynakları sağlamak veya projeye katkıda bulunmak isterseniz lütfen iletişime geçin. Her türlü katkı değerlidir.

## Lisans

Bu proje açık kaynaklıdır. Verilerin kullanımında kaynak gösterilmesi rica olunur.

---

*Her bir kayıp, bir ailenin acısıdır. Bu harita, onların unutulmaması için vardır.*
