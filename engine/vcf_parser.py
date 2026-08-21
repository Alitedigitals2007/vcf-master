import vobject
from typing import List, Dict, Any
from .phone_normalizer import PhoneNormalizer


class VCFContact:
    def __init__(self, name: str = "", phones: List[str] = None, emails: List[str] = None, raw_data: str = ""):
        self.name = name
        self.phones = phones or []
        self.emails = emails or []
        self.raw_data = raw_data
        self.normalized_phones = []
        self.is_duplicate = False
        self.duplicate_group = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "phones": self.phones,
            "emails": self.emails,
            "normalized_phones": self.normalized_phones,
            "is_duplicate": self.is_duplicate,
            "duplicate_group": self.duplicate_group
        }


class VCFParser:
    def __init__(self, format_type: str = "international"):
        self.normalizer = PhoneNormalizer(format_type)

    def parse_file(self, content: str) -> List[VCFContact]:
        contacts = []
        try:
            for vcard in vobject.readComponents(content):
                contact = self._parse_vcard(vcard)
                if contact:
                    contacts.append(contact)
        except Exception as e:
            print(f"Error parsing VCF: {e}")
        return contacts

    def _parse_vcard(self, vcard) -> VCFContact:
        name = ""
        phones = []
        emails = []
        raw = vcard.serialize()

        if hasattr(vcard, 'fn'):
            name = str(vcard.fn.value)

        if hasattr(vcard, 'tel_list'):
            for tel in vcard.tel_list:
                phones.append(str(tel.value))

        if hasattr(vcard, 'email_list'):
            for email in vcard.email_list:
                emails.append(str(email.value))

        contact = VCFContact(name=name, phones=phones, emails=emails, raw_data=raw)
        contact.normalized_phones = [self.normalizer.normalize(p) for p in phones if p]
        return contact

    def parse_multiple_files(self, files_content: List[str]) -> List[VCFContact]:
        all_contacts = []
        for content in files_content:
            contacts = self.parse_file(content)
            all_contacts.extend(contacts)
        return all_contacts