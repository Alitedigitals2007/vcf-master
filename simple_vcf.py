#!/usr/bin/env python3
"""
Simple Terminal-based VCF Processor
Process VCF files using command-line arguments
"""

import os
import sys
import glob
import argparse
from engine import VCFEngine

def main():
    parser = argparse.ArgumentParser(description='Process VCF files - Simple terminal version')
    parser.add_argument('files', nargs='+', help='VCF files to process (supports wildcards)')
    parser.add_argument('--format', choices=['international', 'local'], default='international',
                       help='Phone number format (default: international)')
    parser.add_argument('--prefix', default='Contact',
                       help='Naming prefix for contacts (default: Contact)')
    parser.add_argument('--detect-duplicates', action='store_true', default=True,
                       help='Detect duplicate contacts (default: True)')
    parser.add_argument('--remove-duplicates', action='store_true',
                       help='Remove duplicate contacts')
    parser.add_argument('--rename-contacts', action='store_true',
                       help='Rename contacts with sequential names')
    parser.add_argument('--rename-duplicates-only', action='store_true',
                       help='Only rename duplicate contacts')
    parser.add_argument('--duplicate-strategy', choices=['first', 'last', 'merge'], 
                       default='first', help='Strategy for handling duplicates (default: first)')
    parser.add_argument('--output-dir', default='output',
                       help='Directory to save output files (default: output)')
    
    args = parser.parse_args()
    
    # Expand wildcards and collect all files
    files = []
    for pattern in args.files:
        expanded = glob.glob(pattern)
        if expanded:
            files.extend(expanded)
        else:
            # Try as literal path
            if os.path.exists(pattern):
                files.append(pattern)
            else:
                print(f"Warning: No files found matching '{pattern}'")
    
    # Filter for .vcf files and remove duplicates
    vcf_files = list(set(f for f in files if f.lower().endswith('.vcf')))
    
    if not vcf_files:
        print("Error: No VCF files found.")
        sys.exit(1)
        
    print(f"Found {len(vcf_files)} VCF file(s):")
    for f in vcf_files:
        print(f"  • {os.path.basename(f)}")
    
    # Read file contents
    print("\nReading VCF files...")
    files_content = []
    for file_path in vcf_files:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                files_content.append(content)
                print(f"  OK {os.path.basename(file_path)} ({len(content):,} characters)")
        except Exception as e:
            print(f"  ERROR {os.path.basename(file_path)}: {e}")
            sys.exit(1)
    
    # Process files
    print("\nProcessing files...")
    engine = VCFEngine(format_type=args.format, naming_prefix=args.prefix)
    
    options = {
        'detect_duplicates': args.detect_duplicates,
        'remove_duplicates': args.remove_duplicates,
        'rename_contacts': args.rename_contacts,
        'rename_duplicates_only': args.rename_duplicates_only,
        'duplicate_strategy': args.duplicate_strategy
    }
    
    try:
        result = engine.process_files(files_content, options)
    except Exception as e:
        print(f"Error during processing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Save outputs
    outputs = {
        'ALL_CONTACTS.vcf': result['all_vcf'],
        'UNIQUE_CONTACTS.vcf': result['unique_vcf'],
        'DUPLICATES.vcf': result['duplicates_vcf'],
        'REPORT.txt': result['report']
    }
    
    print("\nSaving output files:")
    for filename, content in outputs.items():
        output_path = os.path.join(args.output_dir, filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  OK {filename} ({len(content):,} characters)")
    
    # Print statistics
    stats = result['stats']
    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE!")
    print(f"{'='*60}")
    print(f"Files processed:     {stats.get('files_processed', len(vcf_files)):,}")
    print(f"Contacts found:      {stats.get('total_contacts', 0):,}")
    print(f"Unique contacts:     {stats.get('unique_contacts', 0):,}")
    print(f"Duplicate entries:   {stats.get('duplicate_entries', 0):,}")
    print(f"Unique duplicated numbers: {stats.get('unique_duplicated_numbers', 0):,}")
    
    if 'most_duplicated' in stats and stats['most_duplicated']:
        print(f"\nMost duplicated numbers:")
        for item in stats['most_duplicated'][:5]:  # Show top 5
            print(f"  {item['phone']} -> {item['count']:,} occurrences")
    
    print(f"\nOutput files saved to: {os.path.abspath(args.output_dir)}")
    print("="*60)

if __name__ == '__main__':
    main()