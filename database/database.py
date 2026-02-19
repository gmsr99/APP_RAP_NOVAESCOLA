import os
from contextlib import contextmanager
from typing import Generator
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()


def _build_database_url() -> str:
    """Build a SQLAlchemy URL from DATABASE_URL or DB_* vars."""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    host = os.getenv("DB_HOST", "localhost")
    name = os.getenv("DB_NAME", "rap_nova_escola")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    port = os.getenv("DB_PORT", "5432")
    sslmode = os.getenv("DB_SSLMODE", "require")

    safe_user = quote_plus(user)
    safe_password = quote_plus(password)
    return (
        f"postgresql+psycopg2://{safe_user}:{safe_password}@{host}:{port}/{name}"
        f"?sslmode={sslmode}"
    )


DATABASE_URL = _build_database_url()

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: opens a DB session and closes it at the end of the request."""
    with Session(engine) as session:
        yield session


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Transactional helper for service layer use."""
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
