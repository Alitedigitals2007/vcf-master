from typing import List
from .vcf_parser import VCFContact


class ContactRenamer:
    def __init__(self, prefix: str = "Contact", start_number: int = 1, padding: int = 4):
        self.prefix = prefix
        self.counter = start_number
        self.padding = padding

    def rename(self, contacts: List[VCFContact]) -> List[VCFContact]:
        for contact in contacts:
            contact.name = f"{self.prefix} {str(self.counter).zfill(self.padding)}"
            self.counter += 1
        return contacts

    def rename_duplicates_only(self, contacts: List[VCFContact]) -> List[VCFContact]:
        seen = set()
        for contact in contacts:
            key = tuple(sorted(contact.normalized_phones))
            if key in seen:
                contact.name = f"{self.prefix} {str(self.counter).zfill(self.padding)}"
                self.counter += 1
            else:
                seen.add(key)
        return contacts