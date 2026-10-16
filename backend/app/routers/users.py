from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import PasswordChange, UserCreate, UserOut
from app.security import hash_password, verify_password

router = APIRouter(prefix='/users', tags=['users'])


@router.get('', response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post('', response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    exists = db.scalar(select(User).where(User.username == data.username))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'Username sudah dipakai')

    user = User(username=data.username, password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete('/{user_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'User tidak ditemukan')

    db.delete(user)
    db.commit()


@router.put('/me/password', status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.old_password, current_user.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Password lama salah')

    current_user.password = hash_password(data.new_password)
    db.commit()
