from typing import List, Dict, Any
from collections import defaultdict
from .vcf_parser import VCFContact


class DuplicateDetector:
    def __init__(self):
        self.phone_to_contacts = defaultdict(list)
        self.duplicate_groups = []

    def detect(self, contacts: List[VCFContact]) -> Dict[str, Any]:
        self.phone_to_contacts.clear()
        self.duplicate_groups.clear()

        for idx, contact in enumerate(contacts):
            for norm_phone in contact.normalized_phones:
                self.phone_to_contacts[norm_phone].append((idx, contact))

        stats = {
            "total_contacts": len(contacts),
            "unique_numbers": len(self.phone_to_contacts),
            "duplicate_entries": 0,
            "duplicate_numbers": 0,
            "most_duplicated": []
        }

        group_id = 0
        for phone, contact_list in self.phone_to_contacts.items():
            if len(contact_list) > 1:
                stats["duplicate_numbers"] += 1
                stats["duplicate_entries"] += len(contact_list)
                group_id += 1
                for idx, contact in contact_list:
                    contact.is_duplicate = True
                    contact.duplicate_group = group_id
                self.duplicate_groups.append({
                    "group_id": group_id,
                    "phone": phone,
                    "count": len(contact_list),
                    "contacts": [{"index": idx, "name": c.name, "phones": c.phones} for idx, c in contact_list]
                })

        stats["unique_contacts"] = stats["total_contacts"] - stats["duplicate_entries"] + stats["duplicate_numbers"]
        stats["most_duplicated"] = sorted(
            [{"phone": p, "count": len(c)} for p, c in self.phone_to_contacts.items() if len(c) > 1],
            key=lambda x: x["count"],
            reverse=True
        )[:10]

        return stats

    def get_unique_contacts(self, contacts: List[VCFContact], strategy: str = "first") -> List[VCFContact]:
        seen = set()
        unique = []
        for contact in contacts:
            key = tuple(sorted(contact.normalized_phones))
            if key not in seen:
                seen.add(key)
                unique.append(contact)
            else:
                if strategy == "last":
                    for i, u in enumerate(unique):
                        if tuple(sorted(u.normalized_phones)) == key:
                            unique[i] = contact
                            break
        return unique

    def get_duplicate_contacts(self, contacts: List[VCFContact]) -> List[VCFContact]:
        return [c for c in contacts if c.is_duplicate]