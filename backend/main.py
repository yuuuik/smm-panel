"""SMM Panel Backend - FastAPI app."""
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import init_db, get_db
from .models import User
from .auth import (
    get_password_hash,
    get_user_by_username,
    get_user_by_email,
    create_access_token,
    authenticate_user,
    get_current_user,
)
from .schemas import LoginRequest, TokenResponse, UploadResponse, RegisterRequest, ProfileUpdateRequest, ChangePasswordRequest, VerifyEmailRequest
from .email_service import send_verification_code as _send_code
import random
from . import auth, accounts, proxies, templates, actions, logs, admin, support, payments

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
UPLOAD_COMMENTS = os.path.join(UPLOAD_DIR, "comments")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    os.makedirs(UPLOAD_COMMENTS, exist_ok=True)
    # Reset any tasks stuck in "running" state from a previous server session
    from .database import SessionLocal
    from .models import Task as _Task
    _db = SessionLocal()
    try:
        stuck = _db.query(_Task).filter(_Task.status == "running").all()
        for t in stuck:
            t.status = "pending"
            t.progress_current = 0
        if stuck:
            _db.commit()
    finally:
        _db.close()
    yield


app = FastAPI(
    title="SMM Automation Panel",
    description="Facebook SMM panel for single user",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://bemqel.xyz",
        "https://www.bemqel.xyz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(proxies.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(payments.router, prefix="/api")

if os.path.isdir(UPLOAD_DIR):
    app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.post("/api/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token)


@app.post("/api/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if "@" not in data.email or len(data.email) < 5:
        raise HTTPException(status_code=422, detail="Неверный формат email")
    if len(data.password) < 6:
        raise HTTPException(status_code=422, detail="Пароль должен содержать минимум 6 символов")
    existing = get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    username = data.email.split("@")[0]
    base_username = username
    counter = 1
    while get_user_by_username(db, username):
        username = f"{base_username}{counter}"
        counter += 1
    new_user = User(
        username=username,
        email=data.email,
        password_hash=get_password_hash(data.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    token = create_access_token(data={"sub": new_user.username})
    return TokenResponse(access_token=token)


@app.get("/api/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "telegram": current_user.telegram,
        "created_at": current_user.created_at,
        "is_email_verified": bool(current_user.is_email_verified),
        "is_admin": bool(current_user.is_admin),
        "subscription": current_user.subscription or "free",
        "subscription_expires_at": current_user.subscription_expires_at,
    }


@app.get("/api/me/subscription")
def get_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from .models import Task as _Task
    sub = current_user.subscription or "free"
    exp = current_user.subscription_expires_at
    if sub == "pro" and exp and exp <= datetime.utcnow():
        sub = "free"
    # Count ALL tasks ever created by the user (no time window)
    total_tasks = db.query(_Task).filter(
        _Task.user_id == current_user.id,
    ).count()
    FREE_LIMIT = 5
    return {
        "plan": sub,
        "tasks_today": total_tasks,
        "tasks_limit": None if sub == "pro" else FREE_LIMIT,
        "subscription_expires_at": exp,
        "limit_reset_at": None,
    }


@app.patch("/api/me")
def update_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.email is not None and data.email != current_user.email:
        if current_user.is_email_verified:
            raise HTTPException(status_code=403, detail="Email подтверждён и не может быть изменён")
        if "@" not in data.email or len(data.email) < 5:
            raise HTTPException(status_code=422, detail="Неверный формат email")
        existing = get_user_by_email(db, data.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Этот email уже занят")
        current_user.email = data.email
        current_user.is_email_verified = False
        current_user.verification_code = None
        current_user.verification_code_expires_at = None
    if data.telegram is not None:
        tg = data.telegram.strip().lstrip("@")
        current_user.telegram = tg if tg else None
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "telegram": current_user.telegram,
        "created_at": current_user.created_at,
        "is_email_verified": bool(current_user.is_email_verified),
    }


@app.post("/api/me/send-verification")
def send_verification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email уже подтверждён")
    if not current_user.email:
        raise HTTPException(status_code=400, detail="Сначала укажите email в профиле")
    from datetime import datetime, timedelta
    code = "{:06d}".format(random.randint(0, 999999))
    current_user.verification_code = code
    current_user.verification_code_expires_at = datetime.utcnow() + timedelta(minutes=15)
    db.commit()
    ok = _send_code(current_user.email, code)
    if not ok:
        raise HTTPException(status_code=500, detail="Не удалось отправить email. Проверьте настройки SMTP.")
    return {"ok": True, "message": f"Код отправлен на {current_user.email}"}


@app.post("/api/me/verify-email")
def verify_email_endpoint(
    data: VerifyEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_email_verified:
        return {"ok": True, "message": "Email уже подтверждён"}
    from datetime import datetime
    if not current_user.verification_code:
        raise HTTPException(status_code=400, detail="Сначала запросите код подтверждения")
    if current_user.verification_code_expires_at and datetime.utcnow() > current_user.verification_code_expires_at:
        raise HTTPException(status_code=400, detail="Срок действия кода истёк. Запросите новый.")
    if data.code.strip() != current_user.verification_code:
        raise HTTPException(status_code=400, detail="Неверный код")
    current_user.is_email_verified = True
    current_user.verification_code = None
    current_user.verification_code_expires_at = None
    db.commit()
    return {"ok": True, "message": "Email успешно подтверждён"}


@app.post("/api/me/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from .auth import verify_password
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=422, detail="Новый пароль должен содержать минимум 6 символов")
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"ok": True}


@app.post("/api/upload/image", response_model=UploadResponse)
async def upload_image(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """Upload image for comment attachment. Saved to uploads/comments/."""
    os.makedirs(UPLOAD_COMMENTS, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_COMMENTS, name)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    return UploadResponse(path=f"comments/{name}")


# Раздача фронтенда — должна быть ПОСЛЕДНЕЙ
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

@app.get("/logo.png")
async def serve_logo():
    return FileResponse(os.path.join(FRONTEND_DIST, "logo.png"), media_type="image/png")

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
