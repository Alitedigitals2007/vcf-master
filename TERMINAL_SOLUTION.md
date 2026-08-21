# Terminal-Based VCF Processor

I've switched you to a terminal-based Python solution that processes VCF files directly without needing the web interface or Vercel deployment. This solves the Web Worker issues and allows processing of large files (no 4MB limit).

## Solution Created

**File:** `process_vcf.py` (in `vcf_manager` directory)

This script uses the same Python backend engine that powers the web application, but runs directly in your terminal.

## How to Use

### Basic Usage
```bash
python process_vcf.py file1.vcf file2.vcf
```

### With Options
```bash
python process_vcf.py *.vcf \
    --format international \
    --prefix "Contact" \
    --detect-duplicates \
    --remove-duplicates \
    --rename-contacts \
    --output-dir ./my_output
```

### Common Options
- `--format`: `international` (+234...) or `local` (0...) format
- `--prefix`: Naming prefix for contacts (default: "Contact")
- `--detect-duplicates`: Find duplicate phone numbers (default: true)
- `--remove-duplicates`: Keep only unique contacts
- `--rename-contacts`: Rename all contacts with sequential names
- `--rename-duplicates-only`: Only rename duplicate contacts
- `--duplicate-strategy`: How to choose which duplicate to keep (`first`, `last`, or `merge`)
- `--output-dir`: Where to save output files (default: `./output`)

### Output Files Generated
- `ALL_CONTACTS.vcf` - All original contacts
- `UNIQUE_CONTACTS.vcf` - Contacts with duplicates removed
- `DUPLICATES.vcf` - Only the duplicate contacts
- `REPORT.txt` - Detailed processing report

## Example

Process test files and remove duplicates:
```bash
python process_vcf.py test_contacts.vcf --detect-duplicates --remove-duplicates
```

Output:
```
Reading 1 VCF file(s):
  [OK] test_contacts.vcf (408 characters)

Processing files:
  [OK] Saved ALL_CONTACTS.vcf (468 characters)
  [OK] Saved UNIQUE_CONTACTS.vcf (305 characters)
  [OK] Saved DUPLICATES.vcf (277 characters)
  [OK] Saved REPORT.txt (507 characters)

Processing Complete!
  Files processed:     1
  Contacts found:      5
  Unique contacts:     3
  Duplicate entries:   3
  Unique duplicated numbers: 0

Most duplicated numbers:
  +2348012345678 -> 3 occurrences

Output files saved to: C:\Users\hp\Desktop\VCF\vcf_manager\output
```

## Benefits Over Web Version
- ✅ No Web Worker issues
- ✅ No file size limits (process GBs of VCF files if needed)
- ✅ No Vercel deployment delays
- ✅ Full terminal control and scripting capability
- ✅ Uses the same proven Python engine as the web version
- ✅ Instant processing - no network latency

## Requirements
The script uses the same dependencies as the backend:
- fastapi==0.109.0
- uvicorn==0.27.0
- vobject==0.9.6.1
- python-multipart==0.0.6

These should already be installed if you can run the backend.

## Files in This Solution
- `process_vcf.py` - Main terminal script (this file)
- `engine/` - VCF processing engine (same as backend)
- `test_contacts.vcf` - Sample test file
- `requirements.txt` - Python dependencies

Just run `python process_vcf.py your_files.vcf [options]` and get instant results!