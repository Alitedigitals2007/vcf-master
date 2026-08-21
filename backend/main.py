from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import List
from engine import VCFEngine

app = FastAPI(title="ALITE VCF Manager", description="VCF Contact Cleaner & Merger - Made by Alite | myalite.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    processing_sessions[session_id] = {
        'outputs': {
            'all': result['all_vcf'],
            'unique': result['unique_vcf'],
            'duplicates': result['duplicates_vcf'],
            'report': result['report']
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
    outputs = session['outputs']

    file_map = {
        'all': ('ALL_CONTACTS.vcf', outputs['all'], 'text/vcard'),
        'unique': ('UNIQUE_CONTACTS.vcf', outputs['unique'], 'text/vcard'),
        'duplicates': ('DUPLICATES.vcf', outputs['duplicates'], 'text/vcard'),
        'report': ('REPORT.txt', outputs['report'], 'text/plain')
    }

    if file_type not in file_map:
        raise HTTPException(status_code=400, detail="Invalid file type")

    filename, content, media_type = file_map[file_type]

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


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
        del processing_sessions[session_id]
    return {"message": "Cleaned up"}


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ALITE VCF Manager", "website": "myalite.vercel.app"}