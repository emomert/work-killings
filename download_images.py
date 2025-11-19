import os
import requests

images = {
    "1990851254570860697": "https://pbs.twimg.com/media/G6DsljlXkAABiGn?format=jpg&name=900x900",
    "1990857706748379527": "https://pbs.twimg.com/media/G6DyZS1XAAEKNnO?format=jpg&name=900x900",
    "1991085143977492602": "https://pbs.twimg.com/media/G6HBSMWXoAEQyoO?format=jpg&name=900x900",
    "1991117828842520815": "https://pbs.twimg.com/media/G6HfAnPXUAAPD-5?format=jpg&name=900x900"
}

if not os.path.exists("images"):
    os.makedirs("images")

for tweet_id, url in images.items():
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open(f"images/{tweet_id}.jpg", "wb") as f:
                f.write(response.content)
            print(f"Downloaded {tweet_id}.jpg")
        else:
            print(f"Failed to download {tweet_id}: {response.status_code}")
    except Exception as e:
        print(f"Error downloading {tweet_id}: {e}")
