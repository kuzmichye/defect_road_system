"""remove description and updated_at from defects

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("defects", "description")
    op.drop_column("defects", "updated_at")


def downgrade():
    op.add_column("defects", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("defects", sa.Column("description", sa.Text(), nullable=True))
