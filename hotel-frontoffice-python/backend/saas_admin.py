import os, hmac
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session
from auth import hash_password
from database import get_db
from models import User
from saas_models import Hotel, HotelUser, Subscription

router = APIRouter()
COOKIE = "platform_admin_session"
SECRET = os.environ.get("HOTEL_SECRET_KEY", "dev-only-change-this-secret-before-deployment")
serializer = URLSafeTimedSerializer(SECRET, salt="platform-admin-session")

def admin_required(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Platform admin sign-in required.")
    try:
        payload = serializer.loads(token, max_age=8*60*60)
    except (BadSignature, SignatureExpired):
        raise HTTPException(401, "Admin session expired.")
    expected = os.environ.get("PLATFORM_ADMIN_EMAIL", "admin@local.test").strip().lower()
    if payload.get("email") != expected:
        raise HTTPException(401, "Invalid admin session.")
    return expected

LOGIN = r'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Platform Admin Login</title><style>
body{font:15px Arial;background:#f3f6fb;color:#17243b;margin:0;display:grid;place-items:center;min-height:100vh}.card{background:white;padding:30px;border-radius:15px;width:min(380px,88vw);box-shadow:0 15px 50px #17243b12}label{display:block;margin:16px 0 7px;font-weight:bold}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dbe2ee;border-radius:7px}button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:7px;background:#3478e5;color:white;font-weight:bold}#err{color:#c33}</style></head><body><div class="card"><h1>Platform Admin</h1><p>Manage hotel accounts and fixed-term subscriptions.</p><form id="f"><label>Email</label><input id="e" type="email" required><label>Password</label><input id="p" type="password" required><button>Sign in</button><p id="err"></p></form></div><script>f.onsubmit=async x=>{x.preventDefault();let r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e.value,password:p.value})});let d=await r.json();if(r.ok)location.href='/admin';else err.textContent=d.detail||'Login failed'};</script></body></html>'''

DASH = r'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Platform Admin</title><style>
*{box-sizing:border-box}body{font:13px Arial;background:#f4f6fa;color:#1b2942;margin:0}.wrap{max-width:1200px;margin:auto;padding:24px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:360px 1fr;gap:15px;margin-top:18px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.card{background:white;border:1px solid #e4eaf3;border-radius:12px;padding:18px;min-width:0}.stat{font-size:27px;font-weight:bold;margin-top:8px}label{display:block;font-weight:bold;margin:12px 0 6px}input,select{width:100%;padding:10px;border:1px solid #d8e0ed;border-radius:7px}button{border:0;border-radius:7px;background:#3478e5;color:white;padding:10px 13px;font-weight:bold;cursor:pointer}.secondary{background:#eaf1ff;color:#2c62b8}.danger{background:#d95362}.muted{color:#8491a5}.msg{margin-top:10px;line-height:1.5;color:#27785a}.row{display:grid;grid-template-columns:1fr 1fr;gap:9px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 7px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:12px}th{color:#75829a;background:#fafbfd}.scroll{overflow:auto}.badge{display:inline-block;border-radius:20px;padding:5px 7px;font-weight:bold}.active{background:#dff7eb;color:#1d9369}.expired,.cancelled,.suspended{background:#ffe5e8;color:#c03d4c}.pending{background:#fff1d7;color:#a46a00}.actions{display:flex;gap:5px;flex-wrap:wrap}.actions button{font-size:11px;padding:7px}.small{font-size:11px}@media(max-width:850px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr}.wrap{padding:12px}}</style></head><body><div class="wrap">
<div class="top"><div><h1>Platform Admin</h1><p class="muted">Create hotels, owner accounts, and fixed-term subscriptions.</p></div><button class="secondary" id="logout">Sign out</button></div>
<div class="stats"><div class="card"><div class="muted">Total hotels</div><div class="stat" id="total">—</div></div><div class="card"><div class="muted">Active subscriptions</div><div class="stat" id="active">—</div></div><div class="card"><div class="muted">Inactive / expired</div><div class="stat" id="inactive">—</div></div></div>
<div class="grid"><section class="card"><h2>Add a hotel</h2><form id="create">
<label>Hotel name</label><input name="name" required minlength="2" placeholder="Atlas Hotel">
<div class="row"><div><label>Contact email</label><input name="contact_email" type="email" required></div><div><label>City</label><input name="city" placeholder="Casablanca"></div></div>
<hr style="border:0;border-top:1px solid #edf0f5;margin:18px 0"><label>Owner name</label><input name="owner_name" required>
<label>Owner login email</label><input name="owner_email" type="email" required>
<label>Temporary password (12+ characters)</label><input name="owner_password" type="password" required minlength="12">
<label>Subscription duration</label><select name="plan_name"><option>1 Month</option><option selected>3 Months</option><option>6 Months</option><option>12 Months</option></select>
<div class="row"><div><label>Amount</label><input name="amount" type="number" min="0" step=".01" value="0" required></div><div><label>Currency</label><select name="currency"><option>MAD</option><option>EUR</option><option>USD</option><option>AED</option></select></div></div>
<div class="row"><div><label>Start date</label><input name="start_date" id="start" type="date" required></div><div><label>End date</label><input name="end_date" id="end" type="date" required></div></div>
<label>Payment reference / note</label><input name="payment_reference" placeholder="Receipt number (optional)">
<button style="margin-top:16px">Create hotel & activate</button><div class="msg" id="createMsg"></div></form></section>
<section class="card"><div class="top"><h2>Hotels & subscriptions</h2><button class="secondary" id="refresh">Refresh</button></div><p class="muted small">Activate only after you confirm payment. Expired subscriptions are marked inactive.</p><div class="scroll"><table><thead><tr><th>Hotel / Owner</th><th>Plan / Amount</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div><div class="msg" id="listMsg"></div></section></div></div>
<script>
const $=s=>document.querySelector(s);let hotels=[];
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function api(url,opt={}){let r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401)location.href='/admin/login';throw Error(d.detail||'Request failed')}return d}
function plusMonths(s,n){let d=new Date(s+'T12:00:00'),day=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()<day)d.setDate(0);return d.toISOString().slice(0,10)}
function dates(){let d=new Date().toISOString().slice(0,10);$('#start').value=d;$('#end').value=plusMonths(d,3)}
$('#create [name=plan_name]').onchange=()=>{let n=({'1 Month':1,'3 Months':3,'6 Months':6,'12 Months':12})[$('#create [name=plan_name]').value];if(n)$('#end').value=plusMonths($('#start').value||new Date().toISOString().slice(0,10),n)};
$('#start').onchange=()=>$('#create [name=plan_name]').dispatchEvent(new Event('change'));
async function load(){try{let d=await api('/api/admin/hotels');hotels=d.hotels;$('#total').textContent=d.stats.total;$('#active').textContent=d.stats.active;$('#inactive').textContent=d.stats.inactive;$('#rows').innerHTML=hotels.map(h=>`<tr><td><b>${esc(h.name)}</b><div class="muted">${esc(h.city)} · ${esc(h.contact_email)}</div><div class="small">${esc(h.owner_name)}<br>${esc(h.owner_email)}</div></td><td>${esc(h.plan_name)}<br>${esc(h.amount)} ${esc(h.currency)}<div class="muted small">${esc(h.payment_reference||'No reference')}</div></td><td>${esc(h.start_date)}<br>${esc(h.end_date)}</td><td><span class="badge ${esc(h.effective_status)}">${esc(h.effective_status)}</span><div class="small muted">${esc(h.hotel_status)}</div></td><td><div class="actions"><button class="secondary" onclick="editSub(${h.subscription_id})">Edit</button><button class="${h.hotel_status==='suspended'?'secondary':'danger'}" onclick="toggleHotel(${h.id})">${h.hotel_status==='suspended'?'Unsuspend':'Suspend'}</button></div></td></tr>`).join('')||'<tr><td colspan="5">No hotels created yet.</td></tr>'}catch(e){$('#listMsg').textContent=e.message}}
window.toggleHotel=async id=>{try{await api('/api/admin/hotels/'+id+'/toggle',{method:'POST'});load()}catch(e){$('#listMsg').textContent=e.message}};
window.editSub=async id=>{let h=hotels.find(x=>x.subscription_id===id);if(!h)return;let plan=prompt('Plan name:',h.plan_name||'3 Months');if(plan===null)return;let amount=prompt('Amount:',h.amount||0);if(amount===null)return;let end=prompt('End date (YYYY-MM-DD):',h.end_date);if(!end)return;let status=prompt('Status: active, pending, or cancelled',h.subscription_status||'active');if(!['active','pending','cancelled'].includes(status))return alert('Invalid status');try{await api('/api/admin/subscriptions/'+id,{method:'PUT',body:JSON.stringify({plan_name:plan,amount:Number(amount),currency:h.currency||'MAD',start_date:h.start_date,end_date:end,status,payment_reference:h.payment_reference||''})});await load()}catch(e){alert(e.message)}};
$('#create').onsubmit=async e=>{e.preventDefault();let f=e.currentTarget,b=Object.fromEntries(new FormData(f));b.amount=Number(b.amount);$('#createMsg').textContent='Saving…';try{let d=await api('/api/admin/hotels',{method:'POST',body:JSON.stringify(b)});$('#createMsg').textContent='Created. Owner login: '+d.owner_email+'. Share the temporary password securely.';f.reset();dates();load()}catch(err){$('#createMsg').textContent=err.message}};
$('#refresh').onclick=load;$('#logout').onclick=async()=>{try{await api('/api/admin/logout',{method:'POST'})}finally{location.href='/admin/login'}};dates();load();
</script></body></html>'''

@router.get("/admin/login", include_in_schema=False)
def admin_login_page():
    return HTMLResponse(LOGIN)

@router.get("/admin", include_in_schema=False)
def admin_page(request: Request):
    token=request.cookies.get(COOKIE)
    if token:
        try:
            serializer.loads(token,max_age=8*60*60)
            return HTMLResponse(DASH)
        except Exception:
            pass
    return RedirectResponse("/admin/login",status_code=303)

@router.post("/api/admin/login")
def admin_login(payload: dict, response: Response):
    email=str(payload.get("email","")).strip().lower()
    password=str(payload.get("password",""))
    expected_email=os.environ.get("PLATFORM_ADMIN_EMAIL","admin@local.test").strip().lower()
    expected_password=os.environ.get("PLATFORM_ADMIN_PASSWORD","ChangeThisAdmin123!")
    if email != expected_email or not hmac.compare_digest(password,expected_password):
        raise HTTPException(401,"Invalid admin email or password.")
    response.set_cookie(COOKIE,serializer.dumps({"email":email}),httponly=True,samesite="lax",secure=os.environ.get("COOKIE_SECURE","0")=="1",max_age=8*60*60,path="/")
    return {"ok":True}

@router.post("/api/admin/logout")
def admin_logout(response: Response):
    response.delete_cookie(COOKIE,path="/")
    return {"ok":True}

@router.get("/api/admin/hotels")
def list_hotels(admin=Depends(admin_required), db:Session=Depends(get_db)):
    today=date.today(); hotels=db.query(Hotel).order_by(Hotel.created_at.desc()).all(); items=[]; active_count=0
    for h in hotels:
        sub=db.query(Subscription).filter_by(hotel_id=h.id).order_by(Subscription.created_at.desc()).first()
        owner=db.query(HotelUser).filter_by(hotel_id=h.id,role="Hotel Owner").first()
        status="inactive"
        if sub:
            if h.status!="active": status="suspended"
            elif sub.status=="active" and sub.start_date<=today<=sub.end_date: status="active"
            elif sub.status=="cancelled": status="cancelled"
            elif sub.end_date<today: status="expired"
            else: status=sub.status
        if status=="active": active_count+=1
        items.append({"id":h.id,"name":h.name,"contact_email":h.contact_email,"city":h.city,"hotel_status":h.status,
        "owner_name":owner.name if owner else "","owner_email":owner.email if owner else "",
        "subscription_id":sub.id if sub else None,"plan_name":sub.plan_name if sub else "—","amount":sub.amount if sub else 0,
        "currency":sub.currency if sub else "MAD","start_date":sub.start_date.isoformat() if sub else "—",
        "end_date":sub.end_date.isoformat() if sub else "—","subscription_status":sub.status if sub else "pending",
        "payment_reference":sub.payment_reference if sub else "","effective_status":status})
    return {"hotels":items,"stats":{"total":len(hotels),"active":active_count,"inactive":len(hotels)-active_count}}

@router.post("/api/admin/hotels",status_code=201)
def create_hotel(payload:dict,admin=Depends(admin_required),db:Session=Depends(get_db)):
    from datetime import date as Date
    from pydantic import BaseModel,Field,ValidationError
    from fastapi import Body
    from sqlalchemy.exc import IntegrityError
    from datetime import datetime
    # Validate required inputs explicitly and normalize emails.
    required=["name","contact_email","owner_name","owner_email","owner_password","start_date","end_date"]
    if any(not str(payload.get(k,"")).strip() for k in required): raise HTTPException(422,"Please complete all required fields.")
    try:
        start=Date.fromisoformat(payload["start_date"]); end=Date.fromisoformat(payload["end_date"])
        amount=float(payload.get("amount",0))
    except Exception: raise HTTPException(422,"Invalid date or amount.")
    if len(payload["owner_password"])<12: raise HTTPException(422,"Owner password must contain at least 12 characters.")
    if end<start or end<Date.today(): raise HTTPException(400,"End date must be today or later and not before start date.")
    owner_email=payload["owner_email"].strip().lower()
    if db.query(HotelUser).filter_by(email=owner_email).first() or db.query(User).filter(User.email==owner_email).first():
        raise HTTPException(409,"Owner email is already in use.")
    hotel=Hotel(name=payload["name"].strip(),contact_email=payload["contact_email"].strip().lower(),city=str(payload.get("city","")).strip(),status="active")
    db.add(hotel); db.flush()
    owner_hash=hash_password(payload["owner_password"])
    owner=HotelUser(hotel_id=hotel.id,name=payload["owner_name"].strip(),email=owner_email,password_hash=owner_hash,role="Hotel Owner")
    # Compatibility identity for legacy foreign keys while the app transitions to tenant-aware users.
    legacy_identity=User(name=payload["owner_name"].strip(),email=owner_email,password_hash=owner_hash,role="Hotel Owner",hotel_id=hotel.id)
    sub=Subscription(hotel_id=hotel.id,plan_name=str(payload.get("plan_name","3 Months")),amount=amount,currency=str(payload.get("currency","MAD")).upper(),start_date=start,end_date=end,status="active",payment_reference=str(payload.get("payment_reference","")).strip(),activated_at=datetime.utcnow())
    db.add_all([owner,legacy_identity,sub])
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(409,"Could not create hotel; check that owner email is unique.")
    return {"id":hotel.id,"name":hotel.name,"owner_email":owner.email,"subscription_id":sub.id,"status":"active"}

@router.put("/api/admin/subscriptions/{sid}")
def update_subscription(sid:int,payload:dict,admin=Depends(admin_required),db:Session=Depends(get_db)):
    sub=db.query(Subscription).filter_by(id=sid).first()
    if not sub: raise HTTPException(404,"Subscription not found.")
    try:
        start=date.fromisoformat(payload["start_date"]); end=date.fromisoformat(payload["end_date"]); amount=float(payload["amount"])
    except Exception: raise HTTPException(422,"Invalid subscription data.")
    status=payload.get("status")
    if status not in ["active","pending","cancelled"]: raise HTTPException(422,"Invalid subscription status.")
    if end<start or (status=="active" and end<date.today()): raise HTTPException(400,"Invalid dates for active subscription.")
    sub.plan_name=str(payload.get("plan_name",sub.plan_name)); sub.amount=amount; sub.currency=str(payload.get("currency",sub.currency)).upper()
    sub.start_date=start; sub.end_date=end; sub.status=status; sub.payment_reference=str(payload.get("payment_reference","")).strip()
    sub.activated_at=datetime.utcnow() if status=="active" else None; db.commit()
    return {"ok":True}

@router.post("/api/admin/hotels/{hid}/toggle")
def toggle_hotel(hid:int,admin=Depends(admin_required),db:Session=Depends(get_db)):
    hotel=db.query(Hotel).filter_by(id=hid).first()
    if not hotel: raise HTTPException(404,"Hotel not found.")
    hotel.status="suspended" if hotel.status=="active" else "active"; db.commit()
    return {"id":hotel.id,"status":hotel.status}
