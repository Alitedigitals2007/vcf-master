from typing import List, Dict, Any
from .vcf_parser import VCFParser, VCFContact
from .duplicate_detector import DuplicateDetector
from .contact_renamer import ContactRenamer
from .vcf_generator import VCFGenerator, ReportGenerator
from .phone_normalizer import PhoneNormalizer


class VCFEngine:
    def __init__(self, format_type: str = "international", naming_prefix: str = "Contact"):
        self.parser = VCFParser(format_type)
        self.detector = DuplicateDetector()
        self.renamer = ContactRenamer(prefix=naming_prefix)
        self.format_type = format_type
        self.naming_prefix = naming_prefix

    def process_files(self, files_content: List[str], options: Dict[str, Any]) -> Dict[str, Any]:
        contacts = self.parser.parse_multiple_files(files_content)
        
        stats = self.detector.detect(contacts)
        stats['files_processed'] = len(files_content)

        if options.get('rename_contacts', False):
            if options.get('rename_duplicates_only', False):
                self.renamer.rename_duplicates_only(contacts)
            else:
                self.renamer.rename(contacts)

        unique_contacts = self.detector.get_unique_contacts(contacts, options.get('duplicate_strategy', 'first'))
        duplicate_contacts = self.detector.get_duplicate_contacts(contacts)

        all_vcf = VCFGenerator.generate(contacts)
        unique_vcf = VCFGenerator.generate(unique_contacts)
        duplicates_vcf = VCFGenerator.generate(duplicate_contacts)
        report = ReportGenerator.generate(stats, self.detector.duplicate_groups)

        return {
            'stats': stats,
            'contacts': [c.to_dict() for c in contacts],
            'unique_contacts': [c.to_dict() for c in unique_contacts],
            'duplicate_contacts': [c.to_dict() for c in duplicate_contacts],
            'all_vcf': all_vcf,
            'unique_vcf': unique_vcf,
            'duplicates_vcf': duplicates_vcf,
            'report': report
        }

    def preview_contacts(self, files_content: List[str]) -> List[Dict[str, Any]]:
        contacts = self.parser.parse_multiple_files(files_content)
        self.detector.detect(contacts)
        return [c.to_dict() for c in contacts]