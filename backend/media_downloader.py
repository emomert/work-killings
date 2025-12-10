import os
from pathlib import Path
from urllib.parse import urlparse

import requests


IMAGES_DIR = Path("images")
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _pick_media_url(media_item):
    """
    Twikit media objects vary. Try common attributes/dict keys and return the first URL.
    """
    if not media_item:
        return None

    candidate_keys = [
        "media_url_https",
        "media_url",
        "url",
        "full_url",
        "fullUrl",
        "display_url",
        "expanded_url",
    ]

    if isinstance(media_item, dict):
        for key in candidate_keys:
            if media_item.get(key):
                return media_item[key]
        return None

    for key in candidate_keys:
        value = getattr(media_item, key, None)
        if value:
            return value

    return None


def extract_media_urls(media_list):
    urls = []
    for item in media_list or []:
        url = _pick_media_url(item)
        if url and url not in urls:
            urls.append(url)
    return urls


def _ensure_images_dir():
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _extension_from_url(url: str) -> str:
    ext = Path(urlparse(url).path).suffix.lower()
    if ext in SUPPORTED_EXTENSIONS:
        return ext
    return ".jpg"


def download_media(url: str, tweet_id: str, index: int = 0):
    """
    Downloads a single media URL to images/ and returns the relative path.
    """
    _ensure_images_dir()
    ext = _extension_from_url(url)
    filename = f"{tweet_id}-{index + 1}{ext}"
    dest_path = IMAGES_DIR / filename

    try:
        with requests.get(url, timeout=20, stream=True) as response:
            response.raise_for_status()
            with open(dest_path, "wb") as handle:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        handle.write(chunk)
    except Exception as exc:
        print(f"Failed to download media {url}: {exc}")
        return None

    # Return as a posix-style relative path for JSON/site usage
    return dest_path.as_posix()


def download_first_image(media_list, tweet_id: str):
    """
    Grabs the first media URL and downloads it. Returns (local_path, remote_url)
    """
    urls = extract_media_urls(media_list)
    if not urls:
        return None, None

    remote_url = urls[0]
    local_path = download_media(remote_url, tweet_id, index=0)
    return local_path, remote_url
