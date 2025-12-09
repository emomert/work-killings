from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import time

# Initialize geocoder with a user agent
geolocator = Nominatim(user_agent="isig_tweet_analyzer_v1")

def get_coordinates(city, district=None, location_detail=None):
    """
    Returns (lat, lon) for a given location.
    Tries specific to general:
    1. City + District + Location Detail (if provided) - skipped usually as too specific
    2. City + District
    3. City
    """
    search_queries = []
    
    if city and district:
        search_queries.append(f"{district}, {city}, Turkey")
    
    if city:
        search_queries.append(f"{city}, Turkey")
        
    for query in search_queries:
        try:
            location = geolocator.geocode(query, timeout=10)
            if location:
                return [location.latitude, location.longitude]
            time.sleep(1) # Respect API rate limits
        except GeocoderTimedOut:
            print(f"Geocoding timed out for {query}")
            continue
        except Exception as e:
            print(f"Geocoding error for {query}: {e}")
            continue
            
    return None
