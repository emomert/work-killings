import asyncio
import json
import os
from datetime import datetime, timedelta
import re
import unicodedata

import scraper
import analyzer
import geocoder
import media_downloader

DATA_FILE = 'data.json'
FETCH_LIMIT = int(os.getenv("FETCH_LIMIT", "500"))
BATCH_LIMIT = int(os.getenv("AUTO_BATCH_LIMIT", os.getenv("FETCH_LIMIT", "250")))
MAX_BATCHES = int(os.getenv("AUTO_MAX_BATCHES", "40"))

# Search mode: use date ranges to bypass 3200 limit
SEARCH_MODE = os.getenv("SEARCH_MODE", "").lower() == "true"
SEARCH_SINCE = os.getenv("SEARCH_SINCE")  # YYYY-MM-DD
SEARCH_UNTIL = os.getenv("SEARCH_UNTIL")  # YYYY-MM-DD

SECTOR_CATEGORIES = [
    "İnşaat, Yol",
    "Taşımacılık",
    "Diğer İşkolları",
    "Tarım, Orman (İşçi)",
    "Tarım, Orman (Çiftçi)",
    "Ticaret, Büro",
    "Madencilik",
    "Belediye, Genel İşler",
    "Kimya",
    "Metal",
    "Konaklama",
]

# Simple keyword mapping to the canonical list above
SECTOR_KEYWORDS = [
    ("İnşaat, Yol", ["inşaat", "şantiye", "yol", "tünel", "köprü"]),
    ("Taşımacılık", ["kargo", "lojistik", "şoför", "nakliye", "otobüs", "kamyon", "taksi", "şöför", "havaalanı"]),
    ("Tarım, Orman (İşçi)", ["tarım", "fındık", "pamuk", "mevsimlik", "sera", "orman işçisi"]),
    ("Tarım, Orman (Çiftçi)", ["çiftçi", "biçerdöver", "traktör"]),
    ("Ticaret, Büro", ["ofis", "büro", "mağaza", "market", "kasiyer", "satış"]),
    ("Madencilik", ["maden", "ocak", "kömür", "lignit"]),
    ("Belediye, Genel İşler", ["belediye", "temizlik işçisi", "itfaiye", "zabıta"]),
    ("Kimya", ["kimya", "petrokimya", "gübre", "asits", "solvent", "boya"]),
    ("Metal", ["metal", "döküm", "kaynak", "çelik", "fabrika", "sanayi", "endüstriyel"]),
    ("Konaklama", ["otel", "pansiyon", "restoran", "lokanta", "aşçı", "garson"]),
]

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []
    return []

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def slugify(value: str) -> str:
    """Create URL-safe slugs for person ids."""
    if not value:
        return "isimsiz"
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "isimsiz"

def normalize_sector(raw_sector: str) -> str:
    if not raw_sector:
        return "Diğer İşkolları"
    text = raw_sector.lower()
    for target, keywords in SECTOR_KEYWORDS:
        if any(kw in text for kw in keywords):
            return target
    return "Diğer İşkolları"

def to_int(value):
    try:
        return int(value)
    except Exception:
        return None

def normalize_gender(value):
    if not value:
        return "Bilinmiyor"
    text = str(value).strip().lower()
    if text.startswith("k"):  # kadın
        return "Kadın"
    if text.startswith("e"):  # erkek
        return "Erkek"
    return "Bilinmiyor"

def build_signature(name, date_str, city):
    parts = [
        slugify(name).replace("-", ""),
        (date_str or "").strip(),
        (city or "").strip().lower(),
    ]
    return "|".join(parts)

def parse_age_fields(victim: dict):
    """Return (age_display, age_min, age_max) from victim data."""
    age = victim.get("age")
    age_min = victim.get("age_min")
    age_max = victim.get("age_max")

    # If age is a string like "35-40", try to parse
    if isinstance(age, str) and "-" in age:
        parts = age.split("-")
        try:
            age_min = int(parts[0].strip())
            age_max = int(parts[1].strip())
        except Exception:
            pass

    # If age_min/max missing but age integer provided
    if isinstance(age, (int, float)) and age is not None:
        age_min = age_min if isinstance(age_min, (int, float)) else int(age)
        age_max = age_max if isinstance(age_max, (int, float)) else int(age)

    # If only age_min or age_max provided, keep them; ensure numeric
    if isinstance(age_min, str) and age_min.isdigit():
        age_min = int(age_min)
    if isinstance(age_max, str) and age_max.isdigit():
        age_max = int(age_max)

    # Build display
    if age_min and age_max and age_min != age_max:
        age_display = f"{age_min}-{age_max}"
    elif age_min:
        age_display = str(age_min)
    else:
        age_display = None

    return age_display, age_min, age_max

def is_sparse_chain_tweet(analysis_result: dict, tweet_text: str) -> bool:
    """Heuristic: skip image-only or name-only follow-up tweets with no incident detail."""
    if not analysis_result:
        return False
    victims = analysis_result.get("victims") or []
    has_one_named = len(victims) == 1 and (victims[0].get("name") or "").strip() != ""
    has_location = any(analysis_result.get(k) for k in ("city", "district", "location"))
    has_cause_or_details = any(analysis_result.get(k) for k in ("cause", "details"))
    text_len = len(tweet_text or "")
    if has_one_named and not has_location and not has_cause_or_details and text_len < 180:
        return True
    return False

def has_sufficient_data(analysis_result: dict) -> bool:
    """Check if analysis has enough data to be a valid incident record.
    
    Requires BOTH:
    - Location info (city OR district)
    - Incident info (cause OR meaningful details)
    """
    if not analysis_result:
        return False
    
    has_location = bool(analysis_result.get("city") or analysis_result.get("district"))
    cause = (analysis_result.get("cause") or "").strip()
    details = (analysis_result.get("details") or "").strip()
    
    # Details must be meaningful (not just restating the name)
    has_cause = len(cause) > 3
    has_details = len(details) > 30  # Require substantial details
    
    return has_location and (has_cause or has_details)

def process_tweets(tweets, all_data, signature_map):
    """Process a batch of tweets and add entries to all_data. Returns count of new entries."""
    total_new = 0
    updated_existing = False
    
    for tweet in tweets:
        tweet_id = str(tweet['id'])
        print(f"Analyzing tweet {tweet_id}...")
        
        # Analyze with Deepseek
        analysis_result = analyzer.analyze_tweet(tweet['text'], str(tweet['created_at']))
        
        if not analysis_result or not analysis_result.get("is_incident"):
            print(f"Tweet {tweet_id} not relevant.")
            continue

        if is_sparse_chain_tweet(analysis_result, tweet.get("text", "")):
            print(f"Tweet {tweet_id} looks like a sparse follow-up (likely image-only); skipping.")
            continue

        if not has_sufficient_data(analysis_result):
            print(f"Tweet {tweet_id} lacks location or incident details; skipping.")
            continue

        victims = analysis_result.get("victims") or []
        if not isinstance(victims, list) or len(victims) == 0:
            print(f"Tweet {tweet_id} has no victim list; skipping.")
            continue

        city = analysis_result.get('city')
        district = analysis_result.get('district')
        location = analysis_result.get('location')
        company = analysis_result.get('company')
        date_str = analysis_result.get('date')
        sector_raw = analysis_result.get('sector_raw')
        sector_norm = normalize_sector(sector_raw)
        cause = analysis_result.get('cause')
        details = analysis_result.get('details')

        coords = geocoder.get_coordinates(city, district)
        if not coords:
            coords = [39.0, 35.0]

        # Prepare media downloads (if any)
        image_path, image_url = media_downloader.download_first_image(
            tweet.get('media'), tweet_id
        )

        incident_id = f"incident-{tweet_id}"
        multi_victim = len(victims) > 1

        for idx, victim in enumerate(victims):
            if not isinstance(victim, dict):
                continue
            name = victim.get("name") or "İsimsiz İşçi"
            age_display, age_min, age_max = parse_age_fields(victim)
            gender = normalize_gender(victim.get("gender"))

            # Dedup by normalized name + date + city
            signature = build_signature(name, date_str, city)
            if signature in signature_map:
                existing = signature_map[signature]
                related = set(existing.get("related_tweet_ids") or [])
                related.add(tweet_id)
                existing["related_tweet_ids"] = sorted(list(related))
                updated_existing = True
                continue

            slug_base = slugify(name)
            date_suffix = re.sub(r"[^0-9]", "", date_str or "") or "nodate"
            city_slug = slugify(city) if city else "nocity"
            person_id = f"person-{slug_base}-{city_slug}-{date_suffix}"

            entry = {
                "id": person_id,
                "person_name": name,
                "age": age_display,
                "age_min": age_min,
                "age_max": age_max,
                "gender": gender,
                "coords": coords,
                "date": date_str,
                "location": location,
                "city": city,
                "district": district,
                "company": company,
                "cause": cause,
                "details": details,
                "sector": sector_norm,
                "sector_raw": sector_raw,
                "tweetId": tweet_id,
                "tweetUrl": tweet.get('url'),
                "addedAt": datetime.now().isoformat(),
                "image": image_path,
                "imageUrl": image_url,
                "related_tweet_ids": [tweet_id],
                "victim_group_id": incident_id,
                "incident_id": incident_id,
                "multi_victim": multi_victim,
            }

            all_data.append(entry)
            signature_map[signature] = entry
            total_new += 1

    return total_new, updated_existing


async def main_search_mode():
    """Search-based fetching: uses date ranges to bypass 3200 limit."""
    print("Starting ISIG Tweet Analyzer Pipeline (SEARCH MODE)...")
    print(f"Date range: {SEARCH_SINCE} to {SEARCH_UNTIL}")
    
    all_data = load_data()
    signature_map = {build_signature(item.get('person_name'), item.get('date'), item.get('city')): item for item in all_data}
    print(f"Loaded {len(all_data)} existing person records.")
    
    total_new = 0
    updated_existing = False
    
    try:
        tweets = await scraper.fetch_tweets_by_search(
            since=SEARCH_SINCE,
            until=SEARCH_UNTIL,
            limit=FETCH_LIMIT
        )
    except Exception as e:
        print(f"Failed to fetch tweets: {e}")
        import traceback
        traceback.print_exc()
        return
    
    if not tweets:
        print("No tweets found for this date range.")
        return
    
    print(f"Processing {len(tweets)} tweets...")
    new_count, updated = process_tweets(tweets, all_data, signature_map)
    total_new += new_count
    updated_existing = updated_existing or updated
    
    save_data(all_data)
    print(f"\nCompleted. Added {total_new} new person entries.")
    if updated_existing:
        print("Updated related_tweet_ids for some existing entries.")
    print(f"Total records now: {len(all_data)}")


async def main_timeline_mode():
    """Legacy timeline-based fetching (limited to ~3200 recent tweets)."""
    print("Starting ISIG Tweet Analyzer Pipeline (TIMELINE MODE)...")
    
    all_data = load_data()
    signature_map = {build_signature(item.get('person_name'), item.get('date'), item.get('city')): item for item in all_data}
    print(f"Loaded {len(all_data)} existing person records.")

    start_before_env = os.getenv("START_BEFORE_TWEET_ID")
    start_before = int(start_before_env) if start_before_env and start_before_env.isdigit() else None

    total_new = 0
    updated_existing = False
    batches_run = 0

    while batches_run < MAX_BATCHES:
        batches_run += 1
        print(f"\n=== Batch {batches_run} (limit {BATCH_LIMIT}) start_before={start_before} ===")
        try:
            tweets = await scraper.fetch_tweets(limit=BATCH_LIMIT, start_before=start_before)
        except Exception as e:
            print(f"Failed to fetch tweets: {e}")
            break

        if not tweets:
            print("No tweets returned; stopping.")
            break

        print(f"Processing {len(tweets)} tweets in this batch...")
        batch_min_id = None

        for tweet in tweets:
            tweet_id = str(tweet['id'])
            batch_min_id = tweet_id if batch_min_id is None else min(batch_min_id, tweet_id, key=lambda x: int(x))

        new_count, updated = process_tweets(tweets, all_data, signature_map)
        total_new += new_count
        updated_existing = updated_existing or updated

        # Prepare next batch start_before using the smallest tweet id we saw
        if batch_min_id:
            start_before = int(batch_min_id)

        # If we got fewer than the batch limit, likely no more pages
        if len(tweets) < BATCH_LIMIT:
            print(f"Batch returned only {len(tweets)} tweets (<{BATCH_LIMIT}); stopping pagination.")
            break

    save_data(all_data)
    print(f"\nCompleted. Added {total_new} new person entries.")
    if updated_existing:
        print("Updated related_tweet_ids for some existing entries.")
    print(f"Total records now: {len(all_data)}")


async def main():
    if SEARCH_MODE or (SEARCH_SINCE and SEARCH_UNTIL):
        await main_search_mode()
    else:
        await main_timeline_mode()

if __name__ == "__main__":
    asyncio.run(main())
