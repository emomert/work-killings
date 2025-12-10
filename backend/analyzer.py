import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# Ensure .env is loaded before reading key
load_dotenv()

# Load from environment variable
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

client = None

def get_client():
    global client
    if client:
        return client
        
    if not DEEPSEEK_API_KEY:
        print("Error: DEEPSEEK_API_KEY is missing from environment variables.")
        return None
        
    try:
        client = OpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )
        return client
    except Exception as e:
        print(f"Error initializing Deepseek client: {e}")
        return None

SYSTEM_PROMPT = """
You extract structured data about **specific** work homicides from Turkish tweets.

Rules:
- If the tweet is a list/commemoration/statistic (e.g., many bullet names with no incident details, monthly totals, generic info), respond with: {"is_incident": false}
- Otherwise, respond with {"is_incident": true, ...fields below...}
- Keep Turkish text as-is; do not invent unsupported info.

When is_incident is true, return JSON with:
{
  "is_incident": true,
  "date": "DD.MM.YYYY or best-effort",
  "city": "City name or null",
  "district": "District or null",
  "location": "City + district or more specific place if present",
  "company": "Workplace/company if stated",
  "sector_raw": "short sector phrase from tweet",
  "cause": "A complete short sentence describing how the person died, e.g. 'Yüksekten düşerek hayatını kaybetti.' or 'İş makinesinin altında kalarak hayatını kaybetti.'",
  "details": "One-sentence summary from tweet including context",
  "victims": [
     {
       "name": "Full name if present, else null",
       "age": integer or null,
       "age_min": integer or null,
       "age_max": integer or null,
       "gender": "Erkek" | "Kadın" | "Bilinmiyor"
     }
  ]
}

If multiple victims are in one tweet, include them all in victims[].
If unsure, set fields to null (never guess wildly).
Output ONLY the JSON (no markdown fences).
"""

def analyze_tweet(tweet_text, tweet_date_str=None):
    """
    Analyzes a tweet text using Deepseek API to extract work homicide data.
    """
    if not DEEPSEEK_API_KEY:
        print("Error: DEEPSEEK_API_KEY not found.")
        return None

    user_content = f"Tweet Date: {tweet_date_str}\nTweet Text: {tweet_text}"

    current_client = get_client()
    if not current_client:
        return None

    try:
        response = current_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.1
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean up potential markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        if content.lower() == "null":
            return None
            
        return json.loads(content)

    except Exception as e:
        print(f"Error analyzing tweet: {e}")
        return None
