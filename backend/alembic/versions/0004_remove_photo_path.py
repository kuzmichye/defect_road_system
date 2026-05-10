"""remove photo_path from defects

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("defects", "photo_path")


def downgrade():
    op.add_column("defects", sa.Column("photo_path", sa.String(), nullable=True))
