from logging.config import fileConfig

from alembic import context
from sqlmodel import SQLModel

from app.db import engine
from app import models  # Register all four database models


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Alembic uses this metadata to detect schema changes.
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Generate migration SQL without connecting to the database."""
    context.configure(
        url=engine.url.render_as_string(hide_password=True),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect to MySQL and run migrations."""
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()