from datetime import datetime
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import relationship
from database import Base

class Hotel(Base):
    __tablename__ = "hotels"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(180), nullable=False)
    contact_email = Column(String(180), nullable=False)
    city = Column(String(100), default="")
    currency = Column(String(3), default="MAD", nullable=False)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    users = relationship("HotelUser", back_populates="hotel")
    subscriptions = relationship("Subscription", back_populates="hotel")

class HotelUser(Base):
    __tablename__ = "hotel_users"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(40), default="Hotel Owner", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    hotel = relationship("Hotel", back_populates="users")

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False, index=True)
    plan_name = Column(String(80), default="3 Months", nullable=False)
    amount = Column(Float, default=0, nullable=False)
    currency = Column(String(10), default="MAD", nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    payment_reference = Column(String(180), default="")
    activated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    hotel = relationship("Hotel", back_populates="subscriptions")
