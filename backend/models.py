"""SQLAlchemy models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(256), unique=True, index=True, nullable=True)
    telegram = Column(String(128), nullable=True)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String(6), nullable=True)
    verification_code_expires_at = Column(DateTime, nullable=True)
    subscription = Column(String(16), default="free", nullable=False)  # "free" / "pro"
    subscription_expires_at = Column(DateTime, nullable=True)


class FacebookAccount(Base):
    __tablename__ = "facebook_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    cookies = Column(Text, nullable=False)  # JSON string
    user_agent = Column(String(512), nullable=True)
    proxy_id = Column(Integer, ForeignKey("proxies.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_check = Column(DateTime, nullable=True)
    is_valid = Column(Boolean, default=None)  # None = not checked

    proxy = relationship("Proxy", backref="accounts")


class Proxy(Base):
    __tablename__ = "proxies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    ip = Column(String(64), nullable=False)
    port = Column(Integer, nullable=False)
    login = Column(String(128), nullable=True)
    password = Column(String(128), nullable=True)
    rotate_url = Column(String(512), nullable=True)
    rotate_delay = Column(Integer, default=0)  # seconds
    created_at = Column(DateTime, default=datetime.utcnow)


# ----- Action Template (universal: reaction + comment + reply + image + accounts + delay) -----

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    post_url = Column(String(512), nullable=True)
    reaction_type = Column(String(32), nullable=True)  # LIKE, LOVE, HAHA, WOW, SAD, ANGRY, or None/NONE
    comment_text = Column(Text, nullable=True)
    reply_text = Column(Text, nullable=True)
    image_path = Column(String(512), nullable=True)  # e.g. uploads/comments/xxx.jpg
    delay_min = Column(Float, default=10.0)
    delay_max = Column(Float, default=40.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    accounts = relationship("TemplateAccount", back_populates="template", cascade="all, delete-orphan")
    actions = relationship("TemplateAction", back_populates="template", cascade="all, delete-orphan", order_by="TemplateAction.action_order")


class TemplateAccount(Base):
    __tablename__ = "template_accounts"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("facebook_accounts.id", ondelete="CASCADE"), nullable=False)

    template = relationship("Template", back_populates="accounts")
    account = relationship("FacebookAccount", backref="template_accounts")


class TemplateAction(Base):
    __tablename__ = "template_actions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    action_order = Column(Integer, nullable=False, default=1)
    account_id = Column(Integer, ForeignKey("facebook_accounts.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(32), nullable=False)
    reaction_type = Column(String(32), nullable=True)
    text = Column(Text, nullable=True)
    image_path = Column(String(512), nullable=True)
    target_comment = Column(String(128), nullable=True)
    delay = Column(Float, default=20.0)

    template = relationship("Template", back_populates="actions")
    account = relationship("FacebookAccount", backref="template_actions")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    task_type = Column(String(64), default="template_scenario", nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    post_url = Column(String(512), nullable=True)  # kept for backward compatibility
    post_urls = Column(JSON, nullable=True)  # list of post URLs to process sequentially
    reaction_template_id = Column(Integer, nullable=True)
    comment_template_id = Column(Integer, nullable=True)
    reply_template_id = Column(Integer, nullable=True)
    account_ids = Column(JSON, default=list, nullable=False)
    delay_min = Column(Float, nullable=True)
    delay_max = Column(Float, nullable=True)
    max_comments = Column(Integer, default=10)
    rotate_proxy_mode = Column(String(32), default="before_account")  # before_account, before_each_action
    show_browser = Column(Boolean, default=True)
    status = Column(String(32), default="pending")  # pending, running, completed, stopped, error
    progress_current = Column(Integer, default=0)
    progress_total = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    template = relationship("Template", backref="tasks")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    account_name = Column(String(128), nullable=False)
    action = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    success = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", backref="log_entries")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(256), nullable=False)
    status = Column(String(32), default="open")  # open / closed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="support_tickets")
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="SupportMessage.created_at")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_type = Column(String(16), nullable=False)  # "user" or "admin"
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="messages")


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tx_hash = Column(String(128), unique=True, nullable=False)
    network = Column(String(8), default="trc20", nullable=False)  # trc20 / erc20 / bep20 / ton
    status = Column(String(16), default="pending")  # confirmed, failed
    amount_usdt = Column(Float, nullable=True)
    error = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
