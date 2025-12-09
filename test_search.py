import asyncio
import os
from twikit import Client
from dotenv import load_dotenv

load_dotenv()

AUTH_TOKEN = os.getenv('TWITTER_AUTH_TOKEN')
CT0 = os.getenv('TWITTER_CT0')

async def test_search():
    client = Client('en-US')
    
    if AUTH_TOKEN and CT0:
        print("Setting cookies...")
        client.set_cookies({
            'auth_token': AUTH_TOKEN,
            'ct0': CT0
        })
    
    # Search for tweets from isigmeclisi in a specific date range
    # This should bypass the timeline 3200 limit!
    query = "from:isigmeclisi since:2024-01-01 until:2024-02-01"
    print(f"Searching: {query}")
    
    try:
        results = await client.search_tweet(query, product='Latest')
        print(f"Got {len(results)} results")
        
        if results:
            for i, tweet in enumerate(results[:3]):
                print(f"\n--- Tweet {i+1} ---")
                print(f"ID: {tweet.id}")
                print(f"Date: {tweet.created_at}")
                print(f"Text: {tweet.text[:100]}...")
                
        # Try to get more
        if results:
            print("\n\nTrying to get more tweets...")
            more = await results.next()
            if more:
                print(f"Got {len(more)} more tweets!")
            else:
                print("No more tweets")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test_search())

