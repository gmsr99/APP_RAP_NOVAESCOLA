"""RAP Nova Escola — Entry point da API."""
import uvicorn
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import close_pool

from api.routers import (
    auth, studio, sessions, notifications, projects, records,
    team, financial, equipment, production, stats, geo, wiki,
    chat, ai, shortcuts, tasks, admin
)

app = FastAPI(
    title="RAP Nova Escola API",
    description="API para gerir as operações da aplicação RAP Nova Escola.",
    version="1.0.0"
)

origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8080", "http://127.0.0.1:8080",
    "https://app-rap-novaescola.vercel.app", "https://bpm.rapnovaescola.pt"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"(https://app-rap-novaescola(-[a-z0-9]+)*\.vercel\.app|https://([a-z0-9-]+\.)?rapnovaescola\.pt|http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+)",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

for r in [auth.router, studio.router, records.router, sessions.router,
          notifications.router, projects.router, team.router, financial.router,
          equipment.router, production.router, stats.router, geo.router,
          wiki.router, chat.router, ai.router, shortcuts.router, tasks.router,
          admin.router]:
    app.include_router(r)


@app.on_event("startup")
async def start_scheduler():
    if not ai._scheduler.running:
        ai._scheduler.start()


@app.on_event("shutdown")
async def shutdown_event():
    close_pool()
    try:
        if ai._scheduler.running:
            ai._scheduler.shutdown(wait=False)
    except Exception:
        pass


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
