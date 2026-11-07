const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let currentCurrency = "MAD";
const money = value => currentCurrency + " " + Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
let dashboardData = null, revenueChart = null, analyticsChart = null, roomChart = null;

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || "Something went wrong.");
  return data;
}
function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3000); }
function initials(name) { return name.split(/\s+/).map(part=>part[0]).slice(0,2).join("").toUpperCase(); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function statusClass(status) { return status==="Top Performer"?"top":status==="Needs Coaching"?"coach":"track"; }
function employeeRow(e, full=false) { return `<tr><td>${escapeHtml(e.name)}</td>${full?`<td>${escapeHtml(e.role)}</td>`:""}<td>${money(e.upgradeRevenue)}</td><td>${Number(e.conversionRate).toFixed(0)}%</td><td class="${e.targetChange>=0?"positive":"red-text"}">${e.targetChange>0?"+":""}${e.targetChange}%</td><td><span class="status ${statusClass(e.status)}">${escapeHtml(e.status)}</span></td></tr>`; }

function renderDashboard(data) {
  dashboardData=data;
  const m=data.metrics;
  $("#todayRevenue").textContent=money(m.todayRevenue); $("#targetAchievement").textContent=`${m.targetAchievement}%`;
  $("#conversionRate").textContent=`${m.conversionRate}%`; $("#revenuePerAgent").textContent=money(m.revenuePerAgent);
  $("#roomTotal").textContent=money(m.totalUpgradeRevenue); $("#analyticsTotal").textContent=money(m.totalUpgradeRevenue);
  $("#userName").textContent=data.user.name; $("#userRole").textContent=data.user.role; $("#settingsEmail").textContent=data.user.email;
  $("#topPerformers").innerHTML=data.employees.slice(0,3).map((e,i)=>`<div class="performer-row"><div class="rank">${i+1}</div><div class="person-avatar">${initials(e.name)}</div><div><div class="person-name">${escapeHtml(e.name)}</div><div class="person-sub">${e.conversionRate}% Conversion Rate</div></div><div class="person-revenue">${money(e.upgradeRevenue)}<small>${e.targetChange>0?"↑":"↓"} ${Math.abs(e.targetChange)}%</small></div></div>`).join("");
  const highest=data.employees[0], biggest=[...data.employees].sort((a,b)=>b.targetChange-a.targetChange)[0], coaching=[...data.employees].sort((a,b)=>a.conversionRate-b.conversionRate)[0];
  $("#snapshotCards").innerHTML=[{title:"Highest Revenue",e:highest,value:money(highest?.upgradeRevenue||0),label:"Upgrade Revenue"},{title:"Biggest Improvement",e:biggest,value:`${biggest?.targetChange>0?"+":""}${biggest?.targetChange||0}%`,label:"Target change"},{title:"Needs Coaching",e:coaching,value:`${coaching?.conversionRate||0}%`,label:"Conversion Rate"}].map(x=>`<div class="snapshot-card"><h3>${x.title}</h3><div class="person-avatar">${x.e?initials(x.e.name):"—"}</div><div class="person-name">${x.e?escapeHtml(x.e.name):"No data"}</div><strong class="${x.title==="Needs Coaching"?"red-text":""}">${x.value}</strong><p>${x.label}</p></div>`).join("");
  $("#employeeTable").innerHTML=data.employees.slice(0,4).map(e=>employeeRow(e)).join("");
  $("#fullEmployeeTable").innerHTML=data.employees.map(e=>employeeRow(e,true)).join("");
  $("#roomTable").innerHTML=data.roomRevenue.map(r=>`<tr><td>${escapeHtml(r.roomType)}</td><td>${money(r.revenue)}</td><td>${r.percentage}%</td></tr>`).join("");
  const positives=data.reviews.filter(r=>r.sentiment==="positive"), negatives=data.reviews.filter(r=>r.sentiment==="negative");
  const themeMarkup=items=>items.map(r=>`<div class="theme-line"><span>${escapeHtml(r.theme)}</span><b>${r.percentage}%</b></div>`).join("");
  $("#positiveThemes").innerHTML=themeMarkup(positives); $("#negativeThemes").innerHTML=themeMarkup(negatives);
  $("#positiveReviewList").innerHTML=positives.map(r=>`<div class="review-list-row"><b>${escapeHtml(r.theme)}</b><span>${r.percentage}% of positive themes</span></div>`).join("");
  $("#negativeReviewList").innerHTML=negatives.map(r=>`<div class="review-list-row"><b>${escapeHtml(r.theme)}</b><span>${r.percentage}% of negative themes</span></div>`).join("");
  renderCharts(data);
}
function renderCharts(data) {
  if(typeof Chart==="undefined"){toast("Charts need an internet connection to load Chart.js.");return;}
  const labels=data.dailyRevenue.map(d=>`${d.day} ${d.date}`), revenue=data.dailyRevenue.map(d=>d.revenue), target=data.dailyRevenue.map(d=>d.target);
  const options={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money(c.raw)}}},scales:{x:{grid:{display:false},ticks:{color:"#8390a4",font:{size:9}},border:{display:false}},y:{beginAtZero:true,grid:{color:"#edf1f7"},ticks:{color:"#8390a4",font:{size:9},callback:v=>`${v/1000}k`},border:{display:false}}}};
  const chartData={labels,datasets:[{type:"bar",label:"Upgrade Revenue",data:revenue,backgroundColor:"#4c82ec",borderRadius:4,maxBarThickness:23},{type:"line",label:"Target",data:target,borderColor:"#6b8fc8",borderDash:[4,4],borderWidth:2,pointRadius:2,tension:.25}]};
  if(revenueChart)revenueChart.destroy(); if(analyticsChart)analyticsChart.destroy(); if(roomChart)roomChart.destroy();
  revenueChart=new Chart($("#revenueChart"),{data:chartData,options});
  analyticsChart=new Chart($("#analyticsChart"),{data:chartData,options});
  roomChart = new Chart($("#roomChart"), {
    type: "doughnut",
    data: {
      labels: data.roomRevenue.map(r => r.roomType),
      datasets: [{ data: data.roomRevenue.map(r => r.percentage), backgroundColor: ["#2868cc", "#8352c9", "#31aaa9", "#efa354", "#a3aec2"], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${c.raw}%` } } }
    }
  });
  $("#roomLegend").innerHTML=data.roomRevenue.map((r,i)=>`<div class="legend-row"><span class="legend-dot" style="background:${["#2868cc","#8352c9","#31aaa9","#efa354","#a3aec2"][i%5]}"></span><span>${escapeHtml(r.roomType)}</span><b>${r.percentage}%</b></div>`).join("");
}
function showSection(name){$$(".page-section").forEach(s=>s.classList.toggle("hidden",s.id!==`section-${name}`));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.section===name));window.scrollTo({top:0,behavior:"smooth"});}
function updateDate(){const now=new Date();$("#todayDate").textContent=now.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});const h=now.getHours();$("#greeting").textContent=`${h<12?"Good Morning":h<18?"Good Afternoon":"Good Evening"}, ${$("#userName").textContent||"Sarah"}`;}
async function showApp(){const settings=await api("/api/settings").catch(()=>null);if(settings)currentCurrency=settings.hotel.currency||"MAD";const data=await api("/api/dashboard");$("#loginScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");renderDashboard(data);updateDate();}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginError").textContent="";const btn=e.submitter;if(btn)btn.disabled=true;try{await api("/api/login",{method:"POST",body:JSON.stringify({email:$("#email").value,password:$("#password").value})});await showApp();}catch(err){$("#loginError").textContent=err.message;}finally{if(btn)btn.disabled=false;}});
$("#logoutBtn").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});$("#appShell").classList.add("hidden");$("#loginScreen").classList.remove("hidden");$("#password").value="";}catch(e){toast(e.message);}});
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
$$("[data-section-link]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.sectionLink)));
$("#employeeForm").addEventListener("submit",async e=>{e.preventDefault();try{const name=$("#employeeName").value.trim();await api("/api/employees",{method:"POST",body:JSON.stringify({name})});$("#employeeName").value="";await showApp();showSection("employees");toast(`${name} added to the team.`);}catch(err){toast(err.message);}});
$("#exportBtn").addEventListener("click",()=>{if(!dashboardData)return;const rows=[["Name","Role",`Upgrade Revenue (${currentCurrency})`,"Conversion Rate (%)","Target Change (%)","Status"]];dashboardData.employees.forEach(e=>rows.push([e.name,e.role,e.upgradeRevenue,e.conversionRate,e.targetChange,e.status]));const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="hotel-employee-performance.csv";a.click();URL.revokeObjectURL(url);});
api("/api/me").then(()=>showApp()).catch(()=>{});


// Upselling workflow: entries are pending until a manager approves or rejects them.
function todayISO(){return new Date().toISOString().slice(0,10)}
async function loadUpselling(){
  const [data, dashboard] = await Promise.all([api('/api/upselling'), api('/api/dashboard')]);
  const summary=data.summary||{}; $('#upPending').textContent=summary.pending||0; $('#upApproved').textContent=summary.approved||0; $('#upRevenue').textContent=(Number(summary.approved_revenue||0)).toLocaleString('en-US',{maximumFractionDigits:2})+' MAD';
  const select=$('#upEmployee'); const selected=select.value; select.innerHTML=(dashboard.employees||[]).map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join(''); if(selected)select.value=selected;
  const role=String(dashboard.user.role||'').toLowerCase(); const canReview=role.includes('manager')||role.includes('admin');
  $('#upsellingRows').innerHTML=(data.transactions||[]).map(t=>`<tr><td>${escapeHtml(t.transaction_date)}</td><td>${escapeHtml(t.employee_name)}</td><td>${escapeHtml(t.upselling_type)}</td><td>${escapeHtml(t.reservation_reference||'—')} / ${escapeHtml(t.room_number||'—')}</td><td>${escapeHtml(t.currency)} ${Number(t.additional_revenue).toLocaleString('en-US',{maximumFractionDigits:2})}</td><td><span class="up-status ${escapeHtml(t.status)}">${escapeHtml(t.status)}</span>${t.rejection_reason?`<div class="muted">${escapeHtml(t.rejection_reason)}</div>`:''}</td><td>${canReview&&t.status==='pending'?`<div class="up-actions"><button class="up-approve" onclick="reviewUpselling(${t.id},'approve')">Approve</button><button class="up-reject" onclick="reviewUpselling(${t.id},'reject')">Reject</button></div>`:'—'}</td></tr>`).join('')||'<tr><td colspan="7">No transactions recorded yet.</td></tr>';
}
window.reviewUpselling=async(id,decision)=>{try{let body={};if(decision==='reject'){const reason=prompt('Reason for rejection:');if(!reason||!reason.trim())return;body.rejection_reason=reason.trim()}await api(`/api/upselling/${id}/${decision}`,{method:'POST',body:JSON.stringify(body)});await loadUpselling();toast(`Transaction ${decision}d.`)}catch(e){toast(e.message)}};
$('#upsellingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Keep a reference to the form before any await.
    const form = e.currentTarget;
    const msg = $('#upFormMsg');
    const submitBtn =
        e.submitter ||
        form.querySelector('button[type="submit"], button:not([type])');

    // Prevent duplicate submissions while saving.
    if (form.dataset.submitting === 'true') return;

    form.dataset.submitting = 'true';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    msg.textContent = 'Saving...';

    try {
        const payload = {
            employee_id: Number($('#upEmployee').value),
            transaction_date: $('#upDate').value,
            reservation_reference: $('#upReservation').value.trim(),
            room_number: $('#upRoom').value.trim(),
            upselling_type: $('#upType').value,
            original_room_type: $('#upOriginal').value.trim(),
            upgraded_room_type: $('#upgradedRoom').value.trim(),
            additional_revenue: Number($('#upRevenueInput').value),
            currency: $('#upCurrency').value,
            notes: $('#upNotes').value.trim()
        };

        await api('/api/upselling', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Reset the captured form reference, not e.currentTarget.
        form.reset();
        $('#upDate').value = todayISO();

        msg.textContent = 'Submitted for manager approval.';

        await loadUpselling();

        toast('Upselling submitted for approval.');

    } catch (err) {
        msg.textContent = err.message || 'Unable to submit the transaction.';
    } finally {
        form.dataset.submitting = 'false';

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for approval';
        }
    }
});
$('#upRefresh').addEventListener('click',()=>loadUpselling().catch(e=>toast(e.message)));
$('#upDate').value=todayISO();
const originalShowSection=showSection; showSection=function(name){originalShowSection(name);if(name==='upselling')loadUpselling().catch(e=>toast(e.message));if(name==='settings')loadSettings().catch(e=>toast(e.message));};

async function loadSettings(){
  const d=await api('/api/settings');
  currentCurrency=d.hotel.currency||'MAD';
  $('#settingsHotelName').textContent=d.hotel.name;
  $('#settingsCity').textContent=d.hotel.city||'—';
  $('#settingsEmail').textContent=d.user.email;
  $('#hotelCurrency').innerHTML=d.currencies.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  $('#hotelCurrency').value=currentCurrency;
  const canManage=['hotel owner','front office manager','admin'].some(r=>String(d.user.role).toLowerCase().includes(r));
  $('#currencyForm').querySelector('button').disabled=!canManage;
  $('#staffForm').querySelectorAll('input,select,button').forEach(el=>el.disabled=!canManage);
  try {
    const users=await api('/api/users');
    $('#staffRows').innerHTML=users.users.map(u=>`<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role)}</td></tr>`).join('')||'<tr><td colspan="3">No staff users yet.</td></tr>';
  } catch(e) { $('#staffRows').innerHTML=`<tr><td colspan="3">${escapeHtml(e.message)}</td></tr>`; }
}
$('#currencyForm').addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/settings',{method:'PUT',body:JSON.stringify({currency:$('#hotelCurrency').value})});currentCurrency=d.currency;$('#currencyMsg').textContent='Currency saved. Dashboard amounts will use '+currentCurrency+'.';if(dashboardData)renderDashboard(dashboardData);}catch(err){$('#currencyMsg').textContent=err.message;}});
$('#staffForm').addEventListener('submit',async e=>{e.preventDefault();$('#staffMsg').textContent='Creating user…';try{const payload={name:$('#staffName').value.trim(),email:$('#staffEmail').value.trim(),password:$('#staffPassword').value,role:$('#staffRole').value};await api('/api/users',{method:'POST',body:JSON.stringify(payload)});$('#staffForm').reset();$('#staffMsg').textContent='User created successfully. Give the temporary password to the employee securely.';await loadSettings();}catch(err){$('#staffMsg').textContent=err.message;}});

