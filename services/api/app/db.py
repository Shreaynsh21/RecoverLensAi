from collections.abc import Generator

from sqlalchemy import URL
from sqlmodel import Session, create_engine

from app.config import settings


# Construct the URL safely instead of parsing a raw string.
database_url = URL.create(
    drivername="mysql+pymysql",
    username=settings.mysql_user,
    password=settings.mysql_password,
    host=settings.mysql_host,
    port=settings.mysql_port,
    database=settings.mysql_database,
    query={"charset": "utf8mb4"},
)


# One shared engine for the application.
engine = create_engine(
    database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={"connect_timeout": 5},
)


# A separate database session for each request.
def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session