"""Database configuration and session management."""
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'smm_panel.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _sync_schema()


def _sync_schema():
    """Apply lightweight schema updates for SQLite without a migrations framework."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "users" in table_names:
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            if "email" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(256)"))
            if "telegram" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN telegram VARCHAR(128)"))
            if "is_email_verified" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT 0"))
                # Auto-verify existing users who have no email (e.g. legacy admin)
                connection.execute(text("UPDATE users SET is_email_verified = 1 WHERE email IS NULL"))
            if "is_admin" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
                # Set admin for fxserzh@gmail.com
                connection.execute(text("UPDATE users SET is_admin = 1 WHERE email = 'fxserzh@gmail.com'"))
            if "verification_code" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN verification_code VARCHAR(6)"))
            if "verification_code_expires_at" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN verification_code_expires_at DATETIME"))
            if "subscription" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN subscription VARCHAR(16) DEFAULT 'free'"))
            if "subscription_expires_at" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME"))

        if "payment_requests" in table_names:
            pay_columns = {column["name"] for column in inspector.get_columns("payment_requests")}
            if "network" not in pay_columns:
                connection.execute(text("ALTER TABLE payment_requests ADD COLUMN network VARCHAR(8) DEFAULT 'trc20'"))

        if "templates" in table_names:
            template_columns = {column["name"] for column in inspector.get_columns("templates")}
            if "post_url" not in template_columns:
                connection.execute(text("ALTER TABLE templates ADD COLUMN post_url VARCHAR(512)"))

        if "tasks" in table_names:
            task_columns = {column["name"] for column in inspector.get_columns("tasks")}
            if "template_id" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN template_id INTEGER"))
            if "post_url" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN post_url VARCHAR(512)"))
            if "max_comments" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN max_comments INTEGER DEFAULT 10"))
            if "rotate_proxy_mode" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN rotate_proxy_mode VARCHAR(32) DEFAULT 'before_account'"))
            if "show_browser" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN show_browser BOOLEAN DEFAULT 1"))
            if "status" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN status VARCHAR(32) DEFAULT 'pending'"))
            if "progress_current" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN progress_current INTEGER DEFAULT 0"))
            if "progress_total" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN progress_total INTEGER DEFAULT 0"))
            if "created_at" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN created_at DATETIME"))
            if "started_at" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN started_at DATETIME"))
            if "finished_at" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN finished_at DATETIME"))
            if "error_message" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN error_message TEXT"))
            if "post_urls" not in task_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN post_urls JSON DEFAULT '[]'"))

        if "facebook_accounts" in table_names:
            acc_columns = {column["name"] for column in inspector.get_columns("facebook_accounts")}
            if "user_id" not in acc_columns:
                connection.execute(text("ALTER TABLE facebook_accounts ADD COLUMN user_id INTEGER REFERENCES users(id)"))

        if "proxies" in table_names:
            proxy_columns = {column["name"] for column in inspector.get_columns("proxies")}
            if "user_id" not in proxy_columns:
                connection.execute(text("ALTER TABLE proxies ADD COLUMN user_id INTEGER REFERENCES users(id)"))

        if "templates" in table_names:
            tmpl_columns = {column["name"] for column in inspector.get_columns("templates")}
            if "user_id" not in tmpl_columns:
                connection.execute(text("ALTER TABLE templates ADD COLUMN user_id INTEGER REFERENCES users(id)"))

        if "tasks" in table_names:
            t_columns = {column["name"] for column in inspector.get_columns("tasks")}
            if "user_id" not in t_columns:
                connection.execute(text("ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)"))

        # Migrate template_actions.account_id to nullable (allow NULL when account is deleted)
        if "template_actions" in table_names:
            ta_info = connection.execute(text("PRAGMA table_info(template_actions)")).fetchall()
            account_id_col = next((row for row in ta_info if row[1] == "account_id"), None)
            if account_id_col and account_id_col[3] == 1:  # notnull = 1 means NOT NULL
                connection.execute(text("PRAGMA foreign_keys = OFF"))
                connection.execute(text("""
                    CREATE TABLE template_actions_new (
                        id INTEGER PRIMARY KEY,
                        template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
                        action_order INTEGER NOT NULL DEFAULT 1,
                        account_id INTEGER REFERENCES facebook_accounts(id) ON DELETE SET NULL,
                        action_type VARCHAR(32) NOT NULL,
                        reaction_type VARCHAR(32),
                        text TEXT,
                        image_path VARCHAR(512),
                        target_comment VARCHAR(128),
                        delay FLOAT DEFAULT 20.0
                    )
                """))
                connection.execute(text("INSERT INTO template_actions_new SELECT * FROM template_actions"))
                connection.execute(text("DROP TABLE template_actions"))
                connection.execute(text("ALTER TABLE template_actions_new RENAME TO template_actions"))
                connection.execute(text("PRAGMA foreign_keys = ON"))
