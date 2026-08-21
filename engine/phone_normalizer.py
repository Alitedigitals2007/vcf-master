import re
from typing import Optional


class PhoneNormalizer:
    def __init__(self, format_type: str = "international"):
        self.format_type = format_type

    def normalize(self, phone: str) -> str:
        if not phone:
            return ""
        cleaned = re.sub(r"[\s\-\(\)\.]", "", phone)
        cleaned = cleaned.replace("+", "")
        if cleaned.startswith("234"):
            cleaned = cleaned[3:]
        if cleaned.startswith("0"):
            cleaned = cleaned[1:]
        if self.format_type == "international":
            return f"+234{cleaned}"
        else:
            return f"0{cleaned}"

    def normalize_all(self, phone: str) -> dict:
        cleaned = re.sub(r"[\s\-\(\)\.]", "", phone)
        cleaned = cleaned.replace("+", "")
        base = cleaned
        if base.startswith("234"):
            base = base[3:]
        if base.startswith("0"):
            base = base[1:]
        return {
            "international": f"+234{base}",
            "local": f"0{base}",
            "raw": base
        }

    @staticmethod
    def is_nigerian(phone: str) -> bool:
        normalized = re.sub(r"[\s\-\(\)\.\+]", "", phone)
        return normalized.startswith(("234", "080", "081", "090", "070", "091", "071", "082", "083", "084", "085", "086", "087", "088", "089", "092", "093", "094", "095", "096", "097", "098", "099"))


def normalize_phone(phone: str, format_type: str = "international") -> str:
    normalizer = PhoneNormalizer(format_type)
    return normalizer.normalize(phone)