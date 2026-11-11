from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KaryawanKhusus(Base):
    __tablename__ = 'karyawan_khusus'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nama: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Responses(Base):
    """Log status dari n8n; tabel sudah dibuat manual, create_all tidak menyentuhnya."""

    __tablename__ = 'responses'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jenis: Mapped[str] = mapped_column(String(100), nullable=False)
    # PostgreSQL tetap JSONB; SQLite (test/dev) memakai JSON generik.
    response: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)


class RevoUser(Base):
    """Daftar karyawan mesin Revo (id, user_id, name, role)."""

    __tablename__ = 'revo_users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default='')


class RevoAttend(Base):
    """Data absensi mesin Fingerspot Revo dengan id auto-increment."""

    __tablename__ = 'revo_attend'
    __table_args__ = (
        UniqueConstraint('user_id', 'timestamp', name='uq_revo_attend_user_time'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey('revo_users.user_id', ondelete='CASCADE'), nullable=False)
    timestamp: Mapped[str] = mapped_column(String(19), nullable=False)
