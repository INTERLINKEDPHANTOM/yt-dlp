from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp
import asyncio
import os
import json
import uuid
from typing import Optional

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create downloads directory
DOWNLOADS_DIR = "downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def send_progress(self, client_id: str, data: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)

manager = ConnectionManager()

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

class VideoInfoRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: str
    client_id: str

@app.post("/api/info")
async def get_video_info(request: VideoInfoRequest):
    try:
        ydl_opts = {'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            formats = []
            for f in info.get('formats', []):
                # Simple filter for demonstration, can be expanded
                if f.get('ext') in ['mp4', 'm4a', 'webm']: 
                    formats.append({
                        'format_id': f['format_id'],
                        'resolution': f.get('resolution', 'Audio Only' if f.get('vcodec') == 'none' else 'N/A'),
                        'note': f.get('format_note', ''),
                        'ext': f.get('ext'),
                        'filesize': f.get('filesize', 0),
                    })
            
            return {
                "title": info.get('title'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration'),
                "formats": formats
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(client_id)

def download_video_task(url: str, format_id: str, client_id: str):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def progress_hook(d):
        if d['status'] == 'downloading':
            try:
                percent = d.get('_percent_str', '0%').replace('%', '')
                try:
                    percent_float = float(percent)
                except:
                    percent_float = 0.0
                
                msg = {
                    "status": "downloading",
                    "percent": percent_float,
                    "speed": d.get('_speed_str', 'N/A'),
                    "eta": d.get('_eta_str', 'N/A'),
                    "filename": d.get('filename', '')
                }
                # Run the async send function in the loop
                loop.run_until_complete(manager.send_progress(client_id, msg))
            except Exception as e:
                print(f"Error in hook: {e}")
        elif d['status'] == 'finished':
             msg = {
                "status": "finished",
                "filename": d.get('filename', '')
             }
             loop.run_until_complete(manager.send_progress(client_id, msg))

    ydl_opts = {
        'format': format_id,
        'outtmpl': f'{DOWNLOADS_DIR}/%(title)s.%(ext)s',
        'progress_hooks': [progress_hook],
        'quiet': True,
        'nocolor': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        loop.run_until_complete(manager.send_progress(client_id, {"status": "error", "error": str(e)}))
    finally:
        loop.close()

@app.post("/api/download")
async def start_download(request: DownloadRequest, background_tasks: BackgroundTasks):
    # Retrieve the active websocket to ensure client is connected
    if request.client_id not in manager.active_connections:
        raise HTTPException(status_code=400, detail="Client not connected to WebSocket")
    
    background_tasks.add_task(download_video_task, request.url, request.format_id, request.client_id)
    return {"status": "started"}
