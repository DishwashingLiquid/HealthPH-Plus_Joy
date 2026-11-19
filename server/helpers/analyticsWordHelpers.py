from collections import Counter
from functools import lru_cache
from html import unescape
from pathlib import Path
import re
import unicodedata


STOPWORD_DIRECTORY = (
    Path(__file__).resolve().parents[1] / "assets" / "data"
)

STOPWORD_FILES = (
    "english_stop_words.txt",
    "tagalog_stop_words.txt",
    "cebuano_stop_words.txt",
    "hiligaynon_stop_words.txt",
    "ilocano_stop_words.txt",
)

# preserve unicode letters, contractions and words such as COVID-19
WORD_PATTERN = re.compile(
    r"[^\W\d_][^\W_]*(?:['-][^\W_]+)*",
    re.UNICODE,
)


def tokenize_text(value):
    if not isinstance(value, str):
        return []

    text = unicodedata.normalize("NFKC", unescape(value))
    text = text.replace("’", "'").casefold()

    # Remove HTML tags, links, email add and account handles
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"(?:https?://|www\.)\S+", " ", text)
    text = re.sub(r"\b[\w.+-]+@[\w.-]+\.\w+\b", " ", text)
    text = re.sub(r"(?<!\w)@\w+", " ", text)

    return [
        word
        for word in WORD_PATTERN.findall(text)
        if len(word) >= 2
    ]

@lru_cache(maxsize=1)
def get_stopwords():
    words = set()

    for filename in STOPWORD_FILES:
        path = STOPWORD_DIRECTORY / filename

        for line in path.read_text(encoding="utf-8-sig").splitlines():
            words.update(tokenize_text(line))

    return frozenset(words)

def summarize_word_frequencies(texts, limit=30):
    if limit < 1:
        raise ValueError("The word limit must be at least 1.")

    stopwords = get_stopwords()
    counts = Counter()

    for text in texts:
        counts.update(
            word
            for word in tokenize_text(text)
            if word not in stopwords
        )

    # alphabetical ordering makes equal-frequency result consisten
    ranked_words = sorted(
        counts.items(),
        key=lambda item: (-item[1], item[0]),
    )

    return {
        "words": [
            {
                "word": word,
                "frequency": frequency,
            }
            for word, frequency in ranked_words[:limit]
        ],
        "total_word_occurrences": sum(counts.values()),
        "unique_word_count": len(counts),
    }