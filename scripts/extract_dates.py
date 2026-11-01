"""Extract a calendar date from a song title."""
import re
from datetime import date

SENTINEL_YEAR = 2000  # leap year, so Feb 29 is valid for year-less dates

_MONTHS = (
    "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|"
    "Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)

_YYYYMMDD = re.compile(
    r"(?<!\d)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)"
)
_ISO = re.compile(
    r"(?<!\d)((?:19|20)\d{2})[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01])(?!\d)"
)
_MONTH_NAME = re.compile(
    rf"\b({_MONTHS})\b\.?\s+(\d{{1,2}})(?!\d)(?:st|nd|rd|th)?\b", re.IGNORECASE
)

_MONTH_NUM = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def extract_date(title: str) -> date | None:
    for pattern in (_YYYYMMDD, _ISO):
        for m in pattern.finditer(title):
            y, mo, d = (int(g) for g in m.groups())
            try:
                return date(y, mo, d)
            except ValueError:
                continue
    for m in _MONTH_NAME.finditer(title):
        mo = _MONTH_NUM[m.group(1)[:3].lower()]
        try:
            return date(SENTINEL_YEAR, mo, int(m.group(2)))
        except ValueError:
            continue
    return None
