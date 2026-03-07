"""FastAPI application for WEET Director dashboard API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import content, dashboard, leads, proposals, signals, system

app = FastAPI(title="WEET Director API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(proposals.router, prefix="/api/proposals", tags=["proposals"])
app.include_router(content.router, prefix="/api/content", tags=["content"])
app.include_router(signals.router, prefix="/api/signals", tags=["signals"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
