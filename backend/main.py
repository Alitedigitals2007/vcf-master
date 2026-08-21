from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import tempfile
import os
import json
import uuid
from typing import List, Optional
from engine import VCFEngine

app = FastAPI(title="ALITE VCF Manager", description="VCF Contact Cleaner & Merger - Made by Alite | myalite.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

processing_sessions = {}


@app.post("/api/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    format_type: str = Form("international"),
    naming_prefix: str = Form("Contact"),
    detect_duplicates: bool = Form(True),
    remove_duplicates: bool = Form(False),
    rename_contacts: bool = Form(False),
    rename_duplicates_only: bool = Form(False),
    duplicate_strategy: str = Form("first")
):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(TEMP_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    files_content = []
    for file in files:
        if not file.filename.endswith('.vcf'):
            continue
        content = await file.read()
        files_content.append(content.decode('utf-8', errors='ignore'))

    if not files_content:
        raise HTTPException(status_code=400, detail="No valid VCF files uploaded")

    engine = VCFEngine(format_type=format_type, naming_prefix=naming_prefix)
    options = {
        'detect_duplicates': detect_duplicates,
        'remove_duplicates': remove_duplicates,
        'rename_contacts': rename_contacts,
        'rename_duplicates_only': rename_duplicates_only,
        'duplicate_strategy': duplicate_strategy
    }

    result = engine.process_files(files_content, options)

    all_vcf_path = os.path.join(session_dir, "ALL_CONTACTS.vcf")
    unique_vcf_path = os.path.join(session_dir, "UNIQUE_CONTACTS.vcf")
    duplicates_vcf_path = os.path.join(session_dir, "DUPLICATES.vcf")
    report_path = os.path.join(session_dir, "REPORT.txt")

    with open(all_vcf_path, 'w') as f:
        f.write(result['all_vcf'])
    with open(unique_vcf_path, 'w') as f:
        f.write(result['unique_vcf'])
    with open(duplicates_vcf_path, 'w') as f:
        f.write(result['duplicates_vcf'])
    with open(report_path, 'w') as f:
        f.write(result['report'])

    processing_sessions[session_id] = {
        'dir': session_dir,
        'files': {
            'all': all_vcf_path,
            'unique': unique_vcf_path,
            'duplicates': duplicates_vcf_path,
            'report': report_path
        },
        'stats': result['stats'],
        'contacts': result['contacts']
    }

    return {
        "session_id": session_id,
        "stats": result['stats'],
        "preview": result['contacts'][:50]
    }


@app.get("/api/download/{session_id}/{file_type}")
async def download_file(session_id: str, file_type: str):
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = processing_sessions[session_id]
    file_map = {
        'all': ('ALL_CONTACTS.vcf', session['files']['all']),
        'unique': ('UNIQUE_CONTACTS.vcf', session['files']['unique']),
        'duplicates': ('DUPLICATES.vcf', session['files']['duplicates']),
        'report': ('REPORT.txt', session['files']['report'])
    }

    if file_type not in file_map:
        raise HTTPException(status_code=400, detail="Invalid file type")

    filename, filepath = file_map[file_type]
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, filename=filename, media_type='text/vcard' if file_type != 'report' else 'text/plain')


@app.get("/api/preview/{session_id}")
async def get_preview(session_id: str, page: int = 1, limit: int = 50):
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    contacts = processing_sessions[session_id]['contacts']
    start = (page - 1) * limit
    end = start + limit

    return {
        "contacts": contacts[start:end],
        "total": len(contacts),
        "page": page,
        "limit": limit
    }


@app.delete("/api/session/{session_id}")
async def cleanup_session(session_id: str):
    if session_id in processing_sessions:
        session = processing_sessions[session_id]
        for filepath in session['files'].values():
            if os.path.exists(filepath):
                os.remove(filepath)
        if os.path.exists(session['dir']):
            os.rmdir(session['dir'])
        del processing_sessions[session_id]
    return {"message": "Cleaned up"}


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ALITE VCF Manager", "website": "myalite.vercel.app"}