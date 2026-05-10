"""add crop_image to defects

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("defects", sa.Column("crop_image", sa.LargeBinary(), nullable=True))


def downgrade():
    op.drop_column("defects", "crop_image")
