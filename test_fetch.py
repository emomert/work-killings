import asyncio
from scraper import fetch_tweets

async def test():
    tweets = await fetch_tweets(limit=50)
    print(f"Got {len(tweets)} tweets")
    if tweets:
        print(f"Newest tweet ID: {tweets[0]['id']}")
        print(f"Oldest tweet ID: {tweets[-1]['id']}")
    else:
        print("No tweets returned")

asyncio.run(test())

