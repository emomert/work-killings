import os
from twikit import Client
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Cookie-based auth (Preferred to bypass Cloudflare)
AUTH_TOKEN = os.getenv('TWITTER_AUTH_TOKEN')
CT0 = os.getenv('TWITTER_CT0')

# Search parameters
SEARCH_SINCE = os.getenv('SEARCH_SINCE')  # Format: YYYY-MM-DD
SEARCH_UNTIL = os.getenv('SEARCH_UNTIL')  # Format: YYYY-MM-DD

async def get_client():
    """Get authenticated Twikit client"""
    client = Client(
        'en-US', 
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    
    if os.path.exists('cookies.json'):
        client.load_cookies('cookies.json')
        return client

    if AUTH_TOKEN and CT0:
        print("Using provided auth_token and ct0 cookies...")
        client.set_cookies({
            'auth_token': AUTH_TOKEN,
            'ct0': CT0
        })
        return client
    
    raise ValueError("No authentication credentials found")


async def fetch_tweets_by_search(target_username='isigmeclisi', since=None, until=None, limit=500, max_retries=3):
    """
    Fetch tweets using Twitter Search API with date ranges.
    This bypasses the 3200 timeline limit!
    
    Args:
        target_username: Twitter handle to fetch from
        since: Start date (YYYY-MM-DD format)
        until: End date (YYYY-MM-DD format)  
        limit: Maximum tweets to fetch
        max_retries: Number of retries on rate limit
    
    Returns:
        List of tweet dictionaries
    """
    import asyncio as aio
    
    client = await get_client()
    
    # Build search query
    since_date = since or SEARCH_SINCE
    until_date = until or SEARCH_UNTIL
    
    query = f"from:{target_username}"
    if since_date:
        query += f" since:{since_date}"
    if until_date:
        query += f" until:{until_date}"
    
    print(f"Search query: {query}")
    print(f"Fetching up to {limit} tweets...")
    
    all_tweets = []
    
    # Retry logic for rate limits
    for attempt in range(max_retries):
        try:
            # Initial search
            results = await client.search_tweet(query, product='Latest')
            
            if results:
                all_tweets.extend(results)
                print(f"Fetched {len(all_tweets)}/{limit} tweets...")
                
                # Pagination
                while len(all_tweets) < limit:
                    try:
                        # Small delay between pagination requests
                        await aio.sleep(0.5)
                        more = await results.next()
                        if not more:
                            print("No more tweets available.")
                            break
                        all_tweets.extend(more)
                        results = more
                        print(f"Fetched {len(all_tweets)}/{limit} tweets...")
                    except Exception as e:
                        if "404" in str(e) or "NotFound" in str(e):
                            print(f"Rate limited during pagination, waiting 30s...")
                            await aio.sleep(30)
                            continue
                        print(f"Pagination ended: {e}")
                        break
            else:
                print("No tweets found for this query.")
            
            # Success - break retry loop
            break
                
        except Exception as e:
            if "404" in str(e) or "NotFound" in str(e):
                wait_time = 30 * (attempt + 1)  # 30s, 60s, 90s
                print(f"Rate limited (attempt {attempt+1}/{max_retries}), waiting {wait_time}s...")
                await aio.sleep(wait_time)
                if attempt == max_retries - 1:
                    print("Max retries reached.")
            else:
                print(f"Search error: {e}")
                import traceback
                traceback.print_exc()
                break
    
    # Trim to limit
    all_tweets = all_tweets[:limit]
    print(f"Total tweets fetched: {len(all_tweets)}")
    
    # Convert to dict format
    tweet_data = []
    for tweet in all_tweets:
        tweet_info = {
            'id': tweet.id,
            'text': tweet.text,
            'created_at': tweet.created_at,
            'media': tweet.media if hasattr(tweet, 'media') else [],
            'url': f"https://x.com/{target_username}/status/{tweet.id}"
        }
        tweet_data.append(tweet_info)
    
    return tweet_data


async def fetch_tweets_by_month(target_username='isigmeclisi', year=2024, month=1, limit=500):
    """Convenience function to fetch tweets for a specific month"""
    since = f"{year}-{month:02d}-01"
    
    # Calculate next month
    if month == 12:
        until = f"{year+1}-01-01"
    else:
        until = f"{year}-{month+1:02d}-01"
    
    return await fetch_tweets_by_search(target_username, since, until, limit)


# Legacy function for compatibility
async def fetch_tweets(target_username='isigmeclisi', limit=20, start_before=None):
    """
    Legacy timeline-based fetch (limited to ~3200 recent tweets).
    Use fetch_tweets_by_search for historical tweets.
    """
    client = await get_client()
    
    try:
        user = await client.get_user_by_screen_name(target_username)
    except Exception as e:
        print(f"Error getting user: {e}")
        raise

    print(f"Fetching tweets from {target_username} timeline...")
    
    tweets = await user.get_tweets('Tweets', count=limit)
    
    all_tweets = []
    if tweets:
        all_tweets.extend(tweets)
        
        while len(all_tweets) < limit:
            print(f"Fetched {len(all_tweets)}/{limit} tweets...")
            try:
                more_tweets = await tweets.next()
                if not more_tweets:
                    print("No more tweets available.")
                    break
                all_tweets.extend(more_tweets)
                tweets = more_tweets
            except Exception as e:
                print(f"Error: {e}")
                break
    
    all_tweets = all_tweets[:limit]
    print(f"Total tweets fetched: {len(all_tweets)}")

    tweet_data = []
    for tweet in all_tweets:
        tweet_info = {
            'id': tweet.id,
            'text': tweet.text,
            'created_at': tweet.created_at,
            'media': tweet.media if hasattr(tweet, 'media') else [],
            'url': f"https://x.com/{target_username}/status/{tweet.id}"
        }
        tweet_data.append(tweet_info)
            
    return tweet_data


if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Test search-based fetch
        tweets = await fetch_tweets_by_search(
            since="2024-01-01",
            until="2024-01-15",
            limit=50
        )
        print(f"\nFetched {len(tweets)} tweets from Jan 1-15, 2024")
        if tweets:
            print(f"First: {tweets[0]['id']} - {tweets[0]['created_at']}")
            print(f"Last: {tweets[-1]['id']} - {tweets[-1]['created_at']}")
    
    asyncio.run(main())
