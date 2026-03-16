"""Pydantic schemas for API."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# Auth
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# User
class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    telegram: Optional[str] = None
    created_at: datetime
    is_email_verified: bool = False

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    telegram: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    code: str


# Proxy
class ProxyBase(BaseModel):
    name: str
    ip: str
    port: int
    login: Optional[str] = None
    password: Optional[str] = None
    rotate_url: Optional[str] = None
    rotate_delay: int = 0


class ProxyCreate(ProxyBase):
    pass


class ProxyResponse(ProxyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Facebook Account
class FacebookAccountBase(BaseModel):
    name: str
    cookies: str
    user_agent: Optional[str] = None
    proxy_id: Optional[int] = None


class FacebookAccountCreate(FacebookAccountBase):
    pass


class FacebookAccountUpdate(BaseModel):
    name: Optional[str] = None
    cookies: Optional[str] = None
    user_agent: Optional[str] = None
    proxy_id: Optional[int] = None


class FacebookAccountResponse(FacebookAccountBase):
    id: int
    created_at: datetime
    last_check: Optional[datetime] = None
    is_valid: Optional[bool] = None
    proxy_id: Optional[int] = None

    class Config:
        from_attributes = True


# ----- Action Template (universal) -----
class TemplateActionBase(BaseModel):
    account_id: Optional[int] = None
    action_type: str
    reaction_type: Optional[str] = None
    text: Optional[str] = None
    image_path: Optional[str] = None
    target_comment: Optional[str] = None
    delay: float = 20.0


class TemplateActionCreate(TemplateActionBase):
    action_order: Optional[int] = None


class TemplateActionResponse(TemplateActionBase):
    id: int
    action_order: int

    class Config:
        from_attributes = True


class TemplateBase(BaseModel):
    name: str
    post_url: Optional[str] = None
    reaction_type: Optional[str] = None  # LIKE, LOVE, HAHA, WOW, SAD, ANGRY, or null/NONE
    comment_text: Optional[str] = None
    reply_text: Optional[str] = None
    image_path: Optional[str] = None
    delay_min: float = 10.0
    delay_max: float = 40.0


class TemplateCreate(TemplateBase):
    account_ids: List[int] = Field(default_factory=list)
    actions: List[TemplateActionCreate] = Field(default_factory=list)


class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    account_ids: List[int] = Field(default_factory=list)
    actions: List[TemplateActionResponse] = Field(default_factory=list)
    action_count: int = 0

    class Config:
        from_attributes = True


# Tasks (template-based)
class TaskBase(BaseModel):
    template_id: int
    post_urls: List[str] = Field(default_factory=list)
    max_comments: int = 10
    rotate_proxy_mode: str = "before_account"
    show_browser: bool = True


class TaskCreate(TaskBase):
    pass


class TaskResponse(BaseModel):
    id: int
    template_id: Optional[int] = None
    post_urls: List[str] = Field(default_factory=list)
    max_comments: int
    rotate_proxy_mode: str
    show_browser: bool = True
    status: str
    progress_current: int
    progress_total: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    template_name: Optional[str] = None

    class Config:
        from_attributes = True


# Logs
class LogEntryResponse(BaseModel):
    id: int
    task_id: Optional[int]
    account_name: str
    action: str
    message: str
    success: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Account import/export
class AccountImportItem(BaseModel):
    name: str
    cookies: str
    user_agent: Optional[str] = None


class AccountBulkImportRequest(BaseModel):
    accounts: List[AccountImportItem]
    proxy_id: Optional[int] = None


class AccountImportCodeRequest(BaseModel):
    code: str
    proxy_id: Optional[int] = None


class AccountExportCodeResponse(BaseModel):
    code: str
    count: int


# Check account
class CheckAccountResponse(BaseModel):
    success: bool
    message: str
    is_authorized: Optional[bool] = None


class CheckAccountRequest(BaseModel):
    show_browser: bool = True


# Upload
class UploadResponse(BaseModel):
    path: str
