from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models import KaryawanKhusus, User
from app.schemas import KaryawanKhususCreate, KaryawanKhususOut, KaryawanKhususUpdate

router = APIRouter(prefix='/karyawan-khusus', tags=['karyawan-khusus'])


@router.get('', response_model=list[KaryawanKhususOut])
def list_karyawan_khusus(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(select(KaryawanKhusus).order_by(KaryawanKhusus.id)).all()


@router.post('', response_model=KaryawanKhususOut, status_code=status.HTTP_201_CREATED)
def create_karyawan_khusus(
    data: KaryawanKhususCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    exists = db.scalar(select(KaryawanKhusus).where(KaryawanKhusus.nama == data.nama))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Nama sudah ada')
    item = KaryawanKhusus(nama=data.nama)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put('/{item_id}', response_model=KaryawanKhususOut)
def update_karyawan_khusus(
    item_id: int,
    data: KaryawanKhususUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.get(KaryawanKhusus, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Data tidak ditemukan')
    dup = db.scalar(
        select(KaryawanKhusus).where(
            KaryawanKhusus.nama == data.nama, KaryawanKhusus.id != item_id
        )
    )
    if dup is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Nama sudah dipakai')
    item.nama = data.nama
    db.commit()
    db.refresh(item)
    return item


@router.delete('/{item_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_karyawan_khusus(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.get(KaryawanKhusus, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Data tidak ditemukan')
    db.delete(item)
    db.commit()