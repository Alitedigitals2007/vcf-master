import vobject
from typing import List
from .vcf_parser import VCFContact


class VCFGenerator:
    @staticmethod
    def generate(contacts: List[VCFContact]) -> str:
        vcards = []
        for contact in contacts:
            vcard = vobject.vCard()
            vcard.add('fn').value = contact.name
            for phone in contact.phones:
                tel = vcard.add('tel')
                tel.value = phone
                tel.type_param = 'CELL'
            for email in contact.emails:
                email_prop = vcard.add('email')
                email_prop.value = email
                email_prop.type_param = 'INTERNET'
            vcards.append(vcard.serialize())
        return "\n".join(vcards)

    @staticmethod
    def save(contacts: List[VCFContact], filepath: str) -> None:
        content = VCFGenerator.generate(contacts)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)


class ReportGenerator:
    @staticmethod
    def generate(stats: dict, duplicate_groups: list = None) -> str:
        lines = [
            "VCF CONTACT REPORT",
            "=" * 50,
            f"Made by Alite | myalite.vercel.app",
            "",
            f"Files processed:       {stats.get('files_processed', 'N/A')}",
            f"Contacts found:        {stats.get('total_contacts', 0):,}",
            f"Unique contacts:       {stats.get('unique_contacts', 0):,}",
            f"Duplicate entries:     {stats.get('duplicate_entries', 0):,}",
            f"Unique duplicated numbers: {stats.get('duplicate_numbers', 0):,}",
            "",
            "Most duplicated numbers:",
            "-" * 30
        ]
        for item in stats.get('most_duplicated', []):
            lines.append(f"  {item['phone']} -> {item['count']} occurrences")

        if duplicate_groups:
            lines.extend(["", "Duplicate Groups:", "-" * 30])
            for group in duplicate_groups:
                lines.append(f"  Group {group['group_id']}: {group['phone']} ({group['count']} contacts)")
                for c in group['contacts']:
                    lines.append(f"    - {c['name']} ({', '.join(c['phones'])})")

        return "\n".join(lines)

    @staticmethod
    def save(stats: dict, filepath: str, duplicate_groups: list = None) -> None:
        content = ReportGenerator.generate(stats, duplicate_groups)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)