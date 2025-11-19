#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
İş Cinayetleri Harita Otomasyonu
Twitter'dan @isigmeclisi hesabını takip eder, yeni tweet'leri Gemini AI ile analiz eder,
ve haritaya otomatik olarak ekler.
"""

import os
import json
import time
import re
from datetime import datetime
from pathlib import Path
import tweepy
import google.generativeai as genai
import requests

# API Credentials
TWITTER_API_KEY = os.getenv('TWITTER_API_KEY')
TWITTER_API_SECRET = os.getenv('TWITTER_API_SECRET')
TWITTER_BEARER_TOKEN = os.getenv('TWITTER_BEARER_TOKEN')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Twitter hesap bilgileri
TARGET_USERNAME = 'isigmeclisi'

# Dosya yolları
BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / 'data.json'
LAST_TWEET_FILE = BASE_DIR / 'last_tweet_id.txt'
LOG_FILE = BASE_DIR / 'scraper.log'

def log(message):
    """Log mesajlarını hem konsola hem dosyaya yaz"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_message + '\n')

def get_last_tweet_id():
    """Son işlenen tweet ID'sini oku"""
    if LAST_TWEET_FILE.exists():
        with open(LAST_TWEET_FILE, 'r') as f:
            return f.read().strip()
    return None

def save_last_tweet_id(tweet_id):
    """Son işlenen tweet ID'sini kaydet"""
    with open(LAST_TWEET_FILE, 'w') as f:
        f.write(str(tweet_id))

def get_twitter_client():
    """Twitter API client oluştur"""
    client = tweepy.Client(
        bearer_token=TWITTER_BEARER_TOKEN,
        consumer_key=TWITTER_API_KEY,
        consumer_secret=TWITTER_API_SECRET,
        wait_on_rate_limit=True
    )
    return client

def fetch_recent_tweets(client, username, since_id=None):
    """Belirtilen kullanıcının son tweet'lerini çek"""
    try:
        # Kullanıcı ID'sini al
        user = client.get_user(username=username)
        if not user.data:
            log(f"❌ Kullanıcı bulunamadı: {username}")
            return []
        
        user_id = user.data.id
        log(f"✓ Kullanıcı bulundu: @{username} (ID: {user_id})")
        
        # Tweet'leri çek
        params = {
            'max_results': 10,  # Son 10 tweet
            'tweet_fields': ['created_at', 'text'],
            'exclude': ['retweets', 'replies']
        }
        
        if since_id:
            params['since_id'] = since_id
        
        tweets = client.get_users_tweets(user_id, **params)
        
        if not tweets.data:
            log(f"ℹ️ Yeni tweet bulunamadı")
            return []
        
        log(f"✓ {len(tweets.data)} yeni tweet bulundu")
        return tweets.data
        
    except Exception as e:
        log(f"❌ Twitter API hatası: {str(e)}")
        return []

def analyze_tweet_with_gemini(tweet_text):
    """Gemini AI ile tweet'i analiz et ve yapılandırılmış veri çıkar"""
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
Aşağıdaki tweet bir iş cinayeti (iş kazası) raporu mu? Eğer öyleyse, lütfen aşağıdaki bilgileri JSON formatında çıkar.
Eğer bu bir iş cinayeti raporu değilse, "isWorkAccident": false döndür.

Tweet:
{tweet_text}

Lütfen şu formatta JSON döndür (Türkçe karakterleri koru):
{{
    "isWorkAccident": true/false,
    "date": "GG Ay YYYY formatında tarih (eğer varsa)",
    "location": "Şehir, İlçe",
    "city": "Sadece şehir adı",
    "district": "Sadece ilçe adı (varsa)",
    "company": "Şirket/İşyeri adı (varsa)",
    "victims": ["İsim (Yaş)" listesi],
    "cause": "Ölüm nedeni kısa özet",
    "details": "Detaylı açıklama",
    "sector": "Sektör (inşaat, maden, fabrika, vb.)"
}}

Sadece JSON döndür, başka açıklama ekleme. Eğer bilgi yoksa null kullan.
"""
        
        response = model.generate_content(prompt)
        
        # JSON çıkar (markdown code block'tan temizle)
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        return data
        
    except Exception as e:
        log(f"❌ Gemini AI hatası: {str(e)}")
        return None

def geocode_location(city, district=None):
    """Nominatim API ile şehir/ilçe adını koordinata çevir"""
    try:
        # Türkiye'de arama yap
        query = f"{district}, {city}, Türkiye" if district else f"{city}, Türkiye"
        
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': query,
            'format': 'json',
            'limit': 1,
            'countrycodes': 'tr'
        }
        headers = {
            'User-Agent': 'WorkAccidentsMap/1.0'
        }
        
        response = requests.get(url, params=params, headers=headers)
        data = response.json()
        
        if data:
            lat = float(data[0]['lat'])
            lon = float(data[0]['lon'])
            log(f"✓ Geocoding: {query} → [{lat}, {lon}]")
            return [lat, lon]
        else:
            # İlçe ile bulunamadıysa sadece şehir ile dene
            if district:
                log(f"⚠️ İlçe ile bulunamadı, sadece şehir deneniyor: {city}")
                return geocode_location(city, None)
            
            log(f"❌ Konum bulunamadı: {query}")
            return None
            
    except Exception as e:
        log(f"❌ Geocoding hatası: {str(e)}")
        return None

def load_data():
    """Mevcut veriyi yükle"""
    if DATA_FILE.exists():
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_data(data):
    """Veriyi kaydet"""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def process_tweets():
    """Ana işlem fonksiyonu"""
    log("=" * 60)
    log("🤖 İş Cinayetleri Scraper Başlatıldı")
    log("=" * 60)
    
    # Twitter client oluştur
    client = get_twitter_client()
    
    # Son işlenen tweet ID'yi al
    last_tweet_id = get_last_tweet_id()
    log(f"ℹ️ Son işlenen tweet ID: {last_tweet_id if last_tweet_id else 'Yok (ilk çalıştırma)'}")
    
    # Yeni tweet'leri çek
    tweets = fetch_recent_tweets(client, TARGET_USERNAME, since_id=last_tweet_id)
    
    if not tweets:
        log("ℹ️ İşlenecek yeni tweet yok")
        return
    
    # Mevcut veriyi yükle
    data = load_data()
    new_entries = []
    
    # Her tweet'i işle
    for tweet in reversed(tweets):  # Eskiden yeniye
        log(f"\n--- Tweet ID: {tweet.id} ---")
        log(f"Tarih: {tweet.created_at}")
        log(f"Metin: {tweet.text[:100]}...")
        
        # Gemini ile analiz et
        analysis = analyze_tweet_with_gemini(tweet.text)
        
        if not analysis or not analysis.get('isWorkAccident'):
            log("ℹ️ İş cinayeti raporu değil, atlanıyor")
            continue
        
        log("✓ İş cinayeti tespit edildi!")
        log(f"  Konum: {analysis.get('location')}")
        log(f"  Kurbanlar: {', '.join(analysis.get('victims', []))}")
        
        # Geocoding yap
        coords = geocode_location(analysis.get('city'), analysis.get('district'))
        
        if not coords:
            log("⚠️ Koordinat bulunamadı, varsayılan konum kullanılıyor")
            # Türkiye merkezi
            coords = [39.0, 35.0]
        
        # Yeni entry oluştur
        entry = {
            'id': f"tweet-{tweet.id}",
            'tweetId': str(tweet.id),
            'coords': coords,
            'date': analysis.get('date'),
            'location': analysis.get('location'),
            'city': analysis.get('city'),
            'district': analysis.get('district'),
            'company': analysis.get('company'),
            'victims': analysis.get('victims', []),
            'cause': analysis.get('cause'),
            'details': analysis.get('details'),
            'sector': analysis.get('sector'),
            'tweetText': tweet.text,
            'addedAt': datetime.now().isoformat()
        }
        
        data.append(entry)
        new_entries.append(entry)
        log(f"✅ Yeni kayıt eklendi: {entry['location']}")
        
        # Son tweet ID'yi güncelle
        save_last_tweet_id(tweet.id)
        
        # Rate limiting (Nominatim için)
        time.sleep(1)
    
    # Veriyi kaydet
    if new_entries:
        save_data(data)
        log(f"\n✅ Toplam {len(new_entries)} yeni kayıt eklendi ve kaydedildi")
        
        # GitHub Issue için bilgi dosyası oluştur
        with open(BASE_DIR / 'new_entries.json', 'w', encoding='utf-8') as f:
            json.dump(new_entries, f, ensure_ascii=False, indent=2)
    else:
        log("\nℹ️ Yeni kayıt eklenmedi")
    
    log("=" * 60)
    log("✓ Scraper tamamlandı")
    log("=" * 60)

if __name__ == '__main__':
    process_tweets()
