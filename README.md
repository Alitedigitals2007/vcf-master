# ALITE VCF Manager

**VCF Contact Cleaner & Merger** — Merge • Clean • Detect • Rename • Export

A web-based VCF contact processing tool that handles multiple VCF files, detects duplicates across different phone number formats, normalizes Nigerian/international numbers, and exports clean contact lists.

## Features

- **Multi-file VCF Upload** — Drag & drop multiple `.vcf` files
- **Smart Duplicate Detection** — Recognizes same numbers across formats:
  - `08012345678`
  - `+2348012345678`
  - `+234 801 234 5678`
  - `0801-234-5678`
- **Phone Normalization** — Convert to `+234XXXXXXXXXX` (international) or `0XXXXXXXXXX` (local)
- **Customizable Renaming** — `Contact 0001`, `Alite 0001`, or custom prefix
- **Duplicate Handling** — Keep first/last occurrence
- **Export Options** — ALL_CONTACTS.vcf, UNIQUE_CONTACTS.vcf, DUPLICATES.vcf, REPORT.txt
- **Preview Table** — Paginated contact preview with status badges
- **Privacy-First** — Temporary processing, auto-cleanup, no permanent storage

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Vanilla HTML/CSS/JS (Inter font, responsive)
- **Engine**: vobject for VCF parsing
- **Deployment**: Vercel-ready

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload & process VCF files |
| GET | `/api/preview/{session_id}` | Paginated contact preview |
| GET | `/api/download/{session_id}/{type}` | Download: all, unique, duplicates, report |
| DELETE | `/api/session/{session_id}` | Cleanup temp files |
| GET | `/api/health` | Health check |

## Project Structure

```
vcf_manager/
├── engine/                 # Core processing engine
│   ├── phone_normalizer.py
│   ├── vcf_parser.py
│   ├── duplicate_detector.py
│   ├── contact_renamer.py
│   ├── vcf_generator.py
│   └── __init__.py
├── backend/
│   └── main.py             # FastAPI app
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── vercel.json
└── requirements.txt
```

## Made by Alite

🌐 **Website**: [myalite.vercel.app](https://myalite.vercel.app)

---

*VCF Contact Manager — Professional contact cleaning for everyone*