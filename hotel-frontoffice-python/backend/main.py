from contextlib import asynccontextmanager
from pathlib import Path
from datetime import date, datetime
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from saas_models import Hotel, HotelUser, Subscription
from saas_admin import router as saas_admin_router
from auth import clear_session, current_session, hash_password, set_session, verify_password
from database import Base, SessionLocal, engine, get_db
from models import DailyRevenue, Employee, ReviewTheme, RoomRevenue, User, UpsellingTransaction
from schemas import EmployeeCreate, LoginRequest

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def migrate_existing_database():
    """Add nullable tenant columns to an existing SQLite database and safely backfill demo data."""
    inspector = inspect(engine)
    additions = {
        "users": "hotel_id INTEGER REFERENCES hotels(id)",
        "employees": "hotel_id INTEGER REFERENCES hotels(id)",
        "daily_revenue": "hotel_id INTEGER REFERENCES hotels(id)",
        "room_revenue": "hotel_id INTEGER REFERENCES hotels(id)",
        "review_themes": "hotel_id INTEGER REFERENCES hotels(id)",
    }
    with engine.begin() as conn:
        hotel_columns = {c["name"] for c in inspect(engine).get_columns("hotels")}
        if "currency" not in hotel_columns:
            conn.execute(text("ALTER TABLE hotels ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'MAD'"))
        for table, definition in additions.items():
            if table in inspector.get_table_names():
                existing = {c["name"] for c in inspect(engine).get_columns(table)}
                if "hotel_id" not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {definition}"))
        # Keep legacy demo data together in a dedicated workspace; never attach it to a customer hotel.
        row = conn.execute(text("SELECT id FROM hotels WHERE name = :name"), {"name": "Legacy Demo Workspace"}).first()
        if row:
            legacy_id = row[0]
        else:
            conn.execute(text("INSERT INTO hotels (name, contact_email, city, status, created_at) VALUES (:name, :email, :city, 'active', :created)"),
                         {"name": "Legacy Demo Workspace", "email": "manager@hotel.test", "city": "Demo", "created": datetime.utcnow()})
            legacy_id = conn.execute(text("SELECT id FROM hotels WHERE name = :name"), {"name": "Legacy Demo Workspace"}).scalar_one()
        for table in ("users", "employees", "daily_revenue", "room_revenue", "review_themes", "upselling_transactions"):
            conn.execute(text(f"UPDATE {table} SET hotel_id = :hid WHERE hotel_id IS NULL"), {"hid": legacy_id})


def seed_database():
    db = SessionLocal()
    try:
        legacy = db.query(Hotel).filter_by(name="Legacy Demo Workspace").first()
        if not legacy:
            return
        if db.query(User).count() == 0:
            db.add(User(name="Sarah Ahmed", email="manager@hotel.test", password_hash=hash_password("ChangeMe123!"), role="Front Office Manager", hotel_id=legacy.id))
        db.flush()
        for user in db.query(User).filter(User.hotel_id.is_(None)).all():
            user.hotel_id = legacy.id
        if db.query(Employee).count() == 0:
            db.add_all([
                Employee(hotel_id=legacy.id, name="Ahmed Mostafa", upgrade_revenue=8500, conversion_rate=28, target_change=12, status="Top Performer"),
                Employee(hotel_id=legacy.id, name="Sara El Sayed", upgrade_revenue=6900, conversion_rate=22, target_change=5, status="On Track"),
                Employee(hotel_id=legacy.id, name="Omar Khaled", upgrade_revenue=4200, conversion_rate=18, target_change=-3, status="Needs Coaching"),
                Employee(hotel_id=legacy.id, name="Rana Mohamed", upgrade_revenue=3800, conversion_rate=14, target_change=-6, status="Needs Coaching"),
            ])
        for table_model in (Employee, DailyRevenue, RoomRevenue, ReviewTheme, UpsellingTransaction):
            for obj in db.query(table_model).filter(table_model.hotel_id.is_(None)).all():
                obj.hotel_id = legacy.id
        if db.query(DailyRevenue).filter_by(hotel_id=legacy.id).count() == 0:
            db.add_all([DailyRevenue(hotel_id=legacy.id, day_label=d, date_label=dt, revenue=rev, target=target) for d,dt,rev,target in [
                ("Mon","Apr 14",17500,20000),("Tue","Apr 15",20500,24000),("Wed","Apr 16",19500,22000),("Thu","Apr 17",20000,24000),("Fri","Apr 18",25000,27000),("Sat","Apr 19",29000,30000),("Sun","Apr 20",32500,32000)]])
        if db.query(RoomRevenue).filter_by(hotel_id=legacy.id).count() == 0:
            db.add_all([RoomRevenue(hotel_id=legacy.id, room_type=t, revenue=r, percentage=p) for t,r,p in [("Deluxe",12350,38),("Executive",7800,24),("Suite",5850,18),("Family",3900,12),("Others",2600,8)]])
        if db.query(ReviewTheme).filter_by(hotel_id=legacy.id).count() == 0:
            db.add_all([ReviewTheme(hotel_id=legacy.id, theme=t, sentiment=s, percentage=p) for t,s,p in [
                ("Friendly reception","positive",42),("Fast check-in","positive",28),("Helpful staff","positive",18),("Clean rooms","positive",12),
                ("Check-in waiting time","negative",32),("Room not ready","negative",24),("Staff not explaining room facilities","negative",18),("Noise","negative",12)]])
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_existing_database()
    seed_database()
    yield

app = FastAPI(title="Hotel Front Office Analytics API", version="1.1.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.include_router(saas_admin_router)


def get_actor(request: Request, db: Session = Depends(get_db)):
    session = current_session(request)
    actor_type = session.get("actor_type", "legacy")
    if actor_type == "hotel_user":
        actor = db.query(HotelUser).filter_by(id=session["user_id"], hotel_id=session.get("hotel_id"), is_active=True).first()
        if not actor:
            raise HTTPException(401, "Hotel user account is inactive or no longer exists.")
        hotel = db.query(Hotel).filter_by(id=actor.hotel_id).first()
        if not hotel or hotel.status != "active":
            raise HTTPException(403, "This hotel account is suspended.")
        today = date.today()
        subscription = db.query(Subscription).filter_by(hotel_id=actor.hotel_id).order_by(Subscription.created_at.desc()).first()
        if not subscription or subscription.status != "active" or not (subscription.start_date <= today <= subscription.end_date):
            raise HTTPException(403, "The hotel subscription is not active. Please contact the platform administrator.")
        return {"type": actor_type, "user": actor, "hotel_id": actor.hotel_id, "name": actor.name, "email": actor.email, "role": actor.role}
    actor = db.query(User).filter_by(id=session["user_id"]).first()
    if not actor:
        raise HTTPException(401, "User account was not found.")
    # Old signed cookies may not contain a hotel id; resolve from the user's database record.
    if not actor.hotel_id:
        raise HTTPException(403, "This legacy account has no assigned workspace. Restart the app to run the migration.")
    return {"type": "legacy", "user": actor, "hotel_id": actor.hotel_id, "name": actor.name, "email": actor.email, "role": actor.role}


def manager_required(actor=Depends(get_actor)):
    role = actor["role"].lower()
    if not any(x in role for x in ("manager", "admin", "owner")):
        raise HTTPException(403, "Manager or hotel owner permission is required.")
    return actor


def actor_public(actor):
    return {"id": actor["user"].id, "name": actor["name"], "email": actor["email"], "role": actor["role"], "hotel_id": actor["hotel_id"]}

@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")

@app.post("/api/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    # Prefer tenant identity first: owner accounts also have a compatibility User row,
    # but must never bypass hotel suspension or subscription expiry checks.
    hotel_user = db.query(HotelUser).filter(HotelUser.email == email).first()
    if hotel_user and verify_password(payload.password, hotel_user.password_hash):
        if not hotel_user.is_active:
            raise HTTPException(403, "This user account is inactive.")
        hotel = db.query(Hotel).filter_by(id=hotel_user.hotel_id).first()
        subscription = db.query(Subscription).filter_by(hotel_id=hotel_user.hotel_id).order_by(Subscription.created_at.desc()).first()
        today = date.today()
        if not hotel or hotel.status != "active":
            raise HTTPException(403, "This hotel account is suspended.")
        if not subscription or subscription.status != "active" or not (subscription.start_date <= today <= subscription.end_date):
            raise HTTPException(403, "The hotel subscription is not active. Please contact the platform administrator.")
        set_session(response, hotel_user.id, actor_type="hotel_user", hotel_id=hotel_user.hotel_id)
        return {"user": {"id": hotel_user.id, "name": hotel_user.name, "email": hotel_user.email, "role": hotel_user.role, "hotel_id": hotel_user.hotel_id}}
    legacy = db.query(User).filter(User.email == email).first()
    if legacy and verify_password(payload.password, legacy.password_hash):
        if not legacy.hotel_id:
            raise HTTPException(403, "Legacy account workspace is not configured. Restart the application.")
        set_session(response, legacy.id, actor_type="legacy", hotel_id=legacy.hotel_id)
        return {"user": {"id": legacy.id, "name": legacy.name, "email": legacy.email, "role": legacy.role, "hotel_id": legacy.hotel_id}}
    raise HTTPException(status_code=401, detail="Invalid email or password.")

@app.post("/api/logout")
def logout(response: Response, actor=Depends(get_actor)):
    clear_session(response)
    return {"ok": True}

@app.get("/api/me")
def me(actor=Depends(get_actor)):
    return {"user": actor_public(actor)}

@app.get("/api/dashboard")
def dashboard(actor=Depends(get_actor), db: Session = Depends(get_db)):
    hid = actor["hotel_id"]
    employees = db.query(Employee).filter_by(hotel_id=hid).order_by(Employee.upgrade_revenue.desc()).all()
    daily = db.query(DailyRevenue).filter_by(hotel_id=hid).order_by(DailyRevenue.id).all()
    rooms = db.query(RoomRevenue).filter_by(hotel_id=hid).order_by(RoomRevenue.id).all()
    reviews = db.query(ReviewTheme).filter_by(hotel_id=hid).order_by(ReviewTheme.id).all()
    approved = db.query(UpsellingTransaction).filter_by(hotel_id=hid, status="approved").all()
    avg_conversion = sum(e.conversion_rate for e in employees) / len(employees) if employees else 0
    revenue_total = sum(t.additional_revenue for t in approved)
    revenue_per_agent = round(revenue_total / len(employees)) if employees else 0
    return {"user": actor_public(actor), "metrics": {"todayRevenue": revenue_total, "targetAchievement": 0, "conversionRate": round(avg_conversion, 1), "revenuePerAgent": revenue_per_agent,
        "totalUpgradeRevenue": revenue_total, "overallGuestScore": 0, "roomsSold": 0, "totalGuests": 0, "averageRoomRate": 0, "reviewCount": len(reviews)},
        "employees": [{"id":e.id,"name":e.name,"role":e.role,"upgradeRevenue":e.upgrade_revenue,"conversionRate":e.conversion_rate,"targetChange":e.target_change,"status":e.status} for e in employees],
        "dailyRevenue":[{"day":d.day_label,"date":d.date_label,"revenue":d.revenue,"target":d.target} for d in daily],
        "roomRevenue":[{"roomType":r.room_type,"revenue":r.revenue,"percentage":r.percentage} for r in rooms],
        "reviews":[{"theme":r.theme,"sentiment":r.sentiment,"percentage":r.percentage} for r in reviews]}

@app.post("/api/employees", status_code=201)
def add_employee(payload: EmployeeCreate, actor=Depends(manager_required), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter an employee name with at least 2 characters.")
    employee = Employee(hotel_id=actor["hotel_id"], name=name, role="Front Office Agent", status="On Track")
    db.add(employee); db.commit(); db.refresh(employee)
    return {"id": employee.id, "name": employee.name}

CURRENCIES = {"MAD", "AED", "USD", "EUR", "GBP", "CAD", "EGP", "SAR", "QAR", "KWD", "BHD", "OMR", "INR"}

class HotelSettingsUpdate(BaseModel):
    currency: str = Field(min_length=3, max_length=3)

class HotelUserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=12, max_length=200)
    role: str = Field(default="Front Office Agent", max_length=40)

@app.get("/api/settings")
def get_settings(actor=Depends(get_actor), db: Session = Depends(get_db)):
    hotel = db.query(Hotel).filter_by(id=actor["hotel_id"]).first()
    if not hotel:
        raise HTTPException(404, "Hotel not found.")
    return {"hotel": {"id": hotel.id, "name": hotel.name, "city": hotel.city, "currency": hotel.currency or "MAD"},
            "user": actor_public(actor), "currencies": sorted(CURRENCIES)}

@app.put("/api/settings")
def update_settings(payload: HotelSettingsUpdate, actor=Depends(manager_required), db: Session = Depends(get_db)):
    currency = payload.currency.strip().upper()
    if currency not in CURRENCIES:
        raise HTTPException(422, "Unsupported currency.")
    hotel = db.query(Hotel).filter_by(id=actor["hotel_id"]).first()
    if not hotel:
        raise HTTPException(404, "Hotel not found.")
    hotel.currency = currency
    db.commit()
    return {"ok": True, "currency": currency}

@app.get("/api/users")
def list_hotel_users(actor=Depends(manager_required), db: Session = Depends(get_db)):
    users = db.query(User).filter_by(hotel_id=actor["hotel_id"]).order_by(User.created_at.desc()).all()
    return {"users": [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "active": True} for u in users]}

@app.post("/api/users", status_code=201)
def create_hotel_user(payload: HotelUserCreate, actor=Depends(manager_required), db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    role = payload.role.strip()
    allowed_roles = {"Front Office Agent", "Front Office Manager"}
    if role not in allowed_roles:
        raise HTTPException(422, "Role must be Front Office Agent or Front Office Manager.")
    if db.query(User).filter(User.email == email).first() or db.query(HotelUser).filter(HotelUser.email == email).first():
        raise HTTPException(409, "This email is already in use.")
    # User is the app's current identity model. Hotel scoping is enforced on every request.
    password_hash = hash_password(payload.password)
    user = User(name=payload.name.strip(), email=email, password_hash=password_hash,
                role=role, hotel_id=actor["hotel_id"])
    tenant_user = HotelUser(hotel_id=actor["hotel_id"], name=payload.name.strip(), email=email,
                            password_hash=password_hash, role=role, is_active=True)
    db.add_all([user, tenant_user])
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

@app.get("/api/health")
def health():
    return {"status":"ok"}

class UpsellingCreate(BaseModel):
    employee_id: int
    transaction_date: date
    reservation_reference: str = Field(default="", max_length=100)
    room_number: str = Field(default="", max_length=30)
    upselling_type: str = Field(min_length=2, max_length=60)
    original_room_type: str = Field(default="", max_length=80)
    upgraded_room_type: str = Field(default="", max_length=80)
    additional_revenue: float = Field(gt=0, le=10000000)
    currency: str = Field(default="MAD", min_length=3, max_length=10)
    notes: str = Field(default="", max_length=1000)

class UpsellingDecision(BaseModel):
    rejection_reason: str = Field(default="", max_length=1000)

def _upselling_dict(t, employee_name=""):
    return {"id":t.id,"employee_id":t.employee_id,"employee_name":employee_name,"transaction_date":t.transaction_date.isoformat(),
        "reservation_reference":t.reservation_reference,"room_number":t.room_number,"upselling_type":t.upselling_type,"original_room_type":t.original_room_type,
        "upgraded_room_type":t.upgraded_room_type,"additional_revenue":t.additional_revenue,"currency":t.currency,"status":t.status,"notes":t.notes,
        "rejection_reason":t.rejection_reason,"created_at":t.created_at.isoformat(),"approved_at":t.approved_at.isoformat() if t.approved_at else None}

@app.get("/api/upselling")
def list_upselling(actor=Depends(get_actor), db: Session = Depends(get_db)):
    hid=actor["hotel_id"]
    rows=db.query(UpsellingTransaction, Employee).join(Employee, Employee.id==UpsellingTransaction.employee_id).filter(UpsellingTransaction.hotel_id==hid, Employee.hotel_id==hid).order_by(UpsellingTransaction.created_at.desc()).all()
    result=[_upselling_dict(t,e.name) for t,e in rows]
    return {"transactions":result,"summary":{"pending":sum(x["status"]=="pending" for x in result),"approved":sum(x["status"]=="approved" for x in result),
        "rejected":sum(x["status"]=="rejected" for x in result),"approved_revenue":round(sum(x["additional_revenue"] for x in result if x["status"]=="approved"),2)}}

@app.post("/api/upselling", status_code=201)
def create_upselling(payload: UpsellingCreate, actor=Depends(get_actor), db: Session = Depends(get_db)):
    employee=db.query(Employee).filter_by(id=payload.employee_id,hotel_id=actor["hotel_id"]).first()
    if not employee: raise HTTPException(status_code=404,detail="Employee not found in your hotel.")
    if "employee" in actor["role"].lower() or "agent" in actor["role"].lower():
        raise HTTPException(status_code=403,detail="Employee accounts cannot create transactions for another employee in this version.")
    tx=UpsellingTransaction(hotel_id=actor["hotel_id"],employee_id=employee.id,created_by_user_id=actor["user"].id if actor["type"]=="legacy" else None,
        transaction_date=payload.transaction_date,reservation_reference=payload.reservation_reference.strip(),room_number=payload.room_number.strip(),upselling_type=payload.upselling_type.strip(),
        original_room_type=payload.original_room_type.strip(),upgraded_room_type=payload.upgraded_room_type.strip(),additional_revenue=payload.additional_revenue,
        currency=payload.currency.upper(),notes=payload.notes.strip(),status="pending")
    # created_by_user_id is a legacy-user FK; for hotel-user transactions use the hotel's legacy manager only if one exists.
    if tx.created_by_user_id is None:
        legacy_user=db.query(User).filter_by(hotel_id=actor["hotel_id"]).first()
        if not legacy_user:
            raise HTTPException(status_code=501,detail="This hotel account needs the tenant-user transaction migration before creating transactions.")
        tx.created_by_user_id=legacy_user.id
    db.add(tx); db.commit(); db.refresh(tx)
    return _upselling_dict(tx,employee.name)

@app.post("/api/upselling/{transaction_id}/approve")
def approve_upselling(transaction_id:int, actor=Depends(manager_required), db:Session=Depends(get_db)):
    tx=db.query(UpsellingTransaction).filter_by(id=transaction_id,hotel_id=actor["hotel_id"]).first()
    if not tx: raise HTTPException(status_code=404,detail="Upselling transaction not found in your hotel.")
    if tx.status!="pending": raise HTTPException(status_code=409,detail="Only pending transactions can be approved.")
    tx.status="approved"; tx.approved_at=datetime.utcnow(); tx.rejection_reason=""
    if actor["type"]=="legacy": tx.approved_by_user_id=actor["user"].id
    db.commit(); return {"ok":True,"status":tx.status}

@app.post("/api/upselling/{transaction_id}/reject")
def reject_upselling(transaction_id:int,payload:UpsellingDecision,actor=Depends(manager_required),db:Session=Depends(get_db)):
    tx=db.query(UpsellingTransaction).filter_by(id=transaction_id,hotel_id=actor["hotel_id"]).first()
    if not tx: raise HTTPException(status_code=404,detail="Upselling transaction not found in your hotel.")
    if tx.status!="pending": raise HTTPException(status_code=409,detail="Only pending transactions can be rejected.")
    if not payload.rejection_reason.strip(): raise HTTPException(status_code=422,detail="Enter a reason for rejection.")
    tx.status="rejected"; tx.rejection_reason=payload.rejection_reason.strip(); tx.approved_at=datetime.utcnow()
    if actor["type"]=="legacy": tx.approved_by_user_id=actor["user"].id
    db.commit(); return {"ok":True,"status":tx.status}
