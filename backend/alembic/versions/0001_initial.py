"""initial

Revision ID: 0001
Revises:
Create Date: 2025-05-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'defects',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('defect_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), server_default='medium'),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lng', sa.Float(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('photo_path', sa.String(), nullable=True),
        sa.Column('source_type', sa.String(), server_default='image'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('defects')
