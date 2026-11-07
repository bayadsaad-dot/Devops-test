from datetime import datetime
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(80), nullable=False, default="Front Office Manager")
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(80), nullable=False, default="Front Office Agent")
    upgrade_revenue = Column(Float, nullable=False, default=0)
    conversion_rate = Column(Float, nullable=False, default=0)
    target_change = Column(Float, nullable=False, default=0)
    status = Column(String(40), nullable=False, default="On Track")

class DailyRevenue(Base):
    __tablename__ = "daily_revenue"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    day_label = Column(String(20), nullable=False)
    date_label = Column(String(20), nullable=False)
    revenue = Column(Float, nullable=False)
    target = Column(Float, nullable=False)

class RoomRevenue(Base):
    __tablename__ = "room_revenue"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    room_type = Column(String(60), nullable=False)
    revenue = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)

class ReviewTheme(Base):
    __tablename__ = "review_themes"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    theme = Column(String(160), nullable=False)
    sentiment = Column(String(20), nullable=False)
    percentage = Column(Float, nullable=False)

class UpsellingTransaction(Base):
    __tablename__ = "upselling_transactions"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False)
    reservation_reference = Column(String(100), nullable=False, default="")
    room_number = Column(String(30), nullable=False, default="")
    upselling_type = Column(String(60), nullable=False)
    original_room_type = Column(String(80), nullable=False, default="")
    upgraded_room_type = Column(String(80), nullable=False, default="")
    additional_revenue = Column(Float, nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="MAD")
    status = Column(String(20), nullable=False, default="pending", index=True)
    notes = Column(Text, nullable=False, default="")
    rejection_reason = Column(Text, nullable=False, default="")
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
