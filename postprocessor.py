import argparse
import json
import os
from copy import deepcopy

from dotenv import load_dotenv

import analyzer


load_dotenv()

REQUIRED_KEYS = [
    "id",
    "tweetId",
    "coords",
    "date",
    "location",
    "city",
    "district",
    "company",
    "victims",
    "age_min",
    "age_max",
    "gender",
    "cause",
    "details",
    "sector",
    "tweetText",
    "image",
    "imageUrl",
    "addedAt",
]

# Focus the model on touching only the semantic fields we want cleaned up
SYSTEM_PROMPT = """
You are a data cleanup assistant. You receive one tweet record (JSON) that was already
extracted by another model. Use tweetText to fix or fill missing structured fields.

Rules:
- Always return a JSON object, never markdown.
- Preserve id, tweetId, coords, image, imageUrl, addedAt exactly as provided.
- Keep victims as an array of strings (include ages in parentheses if present).
- age_min/age_max must be integers or null.
- gender must be one of: "Erkek", "Kadın", "Bilinmiyor".
- If a field is unknown, set it to null instead of guessing wildly.
- Do not invent victims or dates that are unsupported by the tweet text.
- Use DD.MM.YYYY for date when available.
- Sector and cause should be short Turkish phrases (e.g., "İnşaat", "Tarım", "Servis kazası").
"""


def _needs_review(entry: dict) -> bool:
    """Heuristic to decide if an entry should be sent to the model."""
    if not entry:
        return False

    missing_core = any(not entry.get(key) for key in ("city", "district", "cause", "sector"))
    missing_victims = not entry.get("victims")
    garbled_text = "�" in (entry.get("tweetText") or "") or "�" in (entry.get("details") or "")
    return missing_core or missing_victims or garbled_text


def _clean_model_response(text: str) -> str:
    """Strip code fences and whitespace."""
    content = text.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


def auto_edit_entry(entry: dict):
    """
    Uses Deepseek to automatically tidy a single entry.
    Returns the updated entry, or None if the model fails.
    """
    if not analyzer.DEEPSEEK_API_KEY:
        print("Warning: DEEPSEEK_API_KEY not set; skipping auto-edit.")
        return None

    client = analyzer.get_client()
    if not client:
        return None

    payload = {
        "current_entry": entry,
        "tweetText": entry.get("tweetText"),
    }

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            temperature=0.1,
        )
    except Exception as exc:
        print(f"Deepseek cleanup failed for {entry.get('id')}: {exc}")
        return None

    content = _clean_model_response(response.choices[0].message.content)

    try:
        model_entry = json.loads(content)
    except json.JSONDecodeError:
        print(f"Model returned non-JSON for {entry.get('id')}: {content[:120]}")
        return None

    # Merge while protecting immutable fields
    updated = deepcopy(entry)
    for key in REQUIRED_KEYS:
        if key in {"id", "tweetId", "coords", "image", "imageUrl", "addedAt"}:
            continue
        if key in model_entry:
            updated[key] = model_entry[key]

    return updated


def process_dataset(
    input_path: str = "data.json",
    output_path=None,
    force_all: bool = False,
    limit=None,
):
    """
    Runs auto-edit on records in data.json, writing back to the same file by default.
    Use force_all to rewrite every record; otherwise only entries that need cleanup
    are sent to the model.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"{input_path} not found.")

    with open(input_path, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    updated = []
    edited = 0
    for idx, entry in enumerate(data):
        if limit is not None and edited >= limit:
            updated.append(entry)
            continue

        if force_all or _needs_review(entry):
            cleaned = auto_edit_entry(entry)
            if cleaned:
                updated.append(cleaned)
                edited += 1
                continue

        updated.append(entry)

    dest = output_path or input_path
    with open(dest, "w", encoding="utf-8") as handle:
        json.dump(updated, handle, ensure_ascii=False, indent=2)

    print(f"Reviewed {edited} entries. Saved to {dest}.")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auto-edit data.json entries using Deepseek.")
    parser.add_argument("--input", default="data.json", help="Path to source JSON file.")
    parser.add_argument("--output", default=None, help="Path to write updated JSON (defaults to input).")
    parser.add_argument(
        "--force-all",
        action="store_true",
        help="Send every record to the model instead of heuristically selecting.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of records to send to the model (useful for budget).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    process_dataset(
        input_path=args.input,
        output_path=args.output,
        force_all=args.force_all,
        limit=args.limit,
    )
