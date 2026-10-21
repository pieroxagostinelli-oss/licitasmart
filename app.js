const SUPABASE_URL = "https://dajonjneqqtwiounwxkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_byVYQHLxHnia9zB8slChTg_gTd94IbH";
const PAGE_SIZE = 20;

let currentPage = 1;
let totalResults = 0;
let currentRows = [];
let favorites = new Set(JSON.parse(localStorage.getItem("licitasmart-favorites") || "[]"));

const list = document.getElementById("tendersList");
const resultCount = document.getElementById("resultCount");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const pageRange = document.getElementById("pageRange");

const companyProfile = {
  regions: ["Valparaíso", "Metropolitana"],
  minBudget: 20000000,
  maxBudget: 500000000,
  keywords: ["construcción","mejoramiento","reparación","obra","obras civiles","estructura metálica","mantención","infraestructura"]
};

function money(n){
  if(n===null||n===undefined||Number.isNaN(Number(n))) return "No informado";
  return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n));
}
function compactMoneyCLP(amount){
  const n=Number(amount||0);
  if(n>=1_000_000_000) return `$${(n/1_000_000_000).toLocaleString("es-CL",{maximumFractionDigits:2})} mil MM`;
  if(n>=1_000_000) return `$${(n/1_000_000).toLocaleString("es-CL",{maximumFractionDigits:1})} MM`;
  return money(n);
}
function normalizeText(v=""){return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function escapeHtml(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function jsString(v=""){return String(v).replaceAll("\\","\\\\").replaceAll("'","\\'")}
function daysUntil(dateString){if(!dateString)return null;const d=new Date(dateString);const diff=Math.ceil((d-new Date())/86400000);return Number.isFinite(diff)?diff:null}
function formatDate(dateString){if(!dateString)return"No informada";const d=new Date(dateString);if(Number.isNaN(d.getTime()))return"No informada";return new Intl.DateTimeFormat("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function isToday(dateString){if(!dateString)return false;const d=new Date(dateString),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()}

function inferCategory(t){
  const text=normalizeText(`${t.nombre||""} ${t.descripcion||""}`);
  if(text.includes("estructura metal")||text.includes("galpon")||text.includes("acero")) return "Estructuras metálicas";
  if(text.includes("mantencion")||text.includes("mantenimiento")||text.includes("conservacion")||text.includes("reparacion")) return "Mantención";
  if(text.includes("inspeccion tecnica")||text.includes("servicios profesionales")||text.includes("consultoria")) return "Servicios profesionales";
  if(text.includes("camino")||text.includes("drenaje")||text.includes("paviment")||text.includes("obra civil")) return "Obras civiles";
  return "Construcción";
}

function calculateCompatibility(t){
  let score=0; const reasons=[]; const warnings=[];
  const text=normalizeText(`${t.nombre||""} ${t.descripcion||""} ${t.organismo_nombre||""}`);
  if(companyProfile.regions.includes(t.region||"")){score+=25;reasons.push("Región seleccionada")}
  const budget=t.monto_estimado===null?null:Number(t.monto_estimado);
  if(budget===null){score+=10;reasons.push("Presupuesto no informado: revisar")}
  else if(budget>=companyProfile.minBudget&&budget<=companyProfile.maxBudget){score+=25;reasons.push("Presupuesto compatible")}
  else if(budget<companyProfile.minBudget){score+=8;warnings.push("Monto bajo el rango objetivo")}
  else{score+=5;warnings.push("Monto sobre el rango objetivo")}
  const matched=companyProfile.keywords.filter(k=>text.includes(normalizeText(k)));
  score+=Math.min(35,matched.length*7);
  reasons.push(...matched.slice(0,3).map(k=>`Coincide: ${k}`));
  const dd=daysUntil(t.fecha_cierre);
  if(dd===null)score+=5;
  else if(dd>=10){score+=15;reasons.push("Plazo adecuado")}
  else if(dd>=5){score+=9;warnings.push("Plazo ajustado")}
  else if(dd>=0){score+=3;warnings.push("Cierre muy próximo")}
  return {score:Math.max(0,Math.min(100,score)),reasons,warnings};
}

function mapTender(row){
  const c=calculateCompatibility(row);
  return {
    id:row.codigo, dbId:row.id, title:row.nombre,
    buyer:row.organismo_nombre||"Organismo no informado",
    region:row.region||"No informada", category:inferCategory(row),
    budget:row.monto_estimado===null?null:Number(row.monto_estimado),
    score:c.score, deadlineDays:daysUntil(row.fecha_cierre),
    deadline:formatDate(row.fecha_cierre), rawPublishDate:row.fecha_publicacion,
    publishDate:formatDate(row.fecha_publicacion), tenderType:row.tipo_licitacion||"No informado",
    status:row.estado||"No informado", description:row.descripcion||"Sin descripción disponible.",
    tags:c.reasons.length?c.reasons:["Revisar oportunidad"], warnings:c.warnings,
    sourceUrl:row.fuente_url||null
  };
}
function scoreClass(s){if(s>=85)return"";if(s>=70)return"medium";return"low"}

function buildFilterParams(){
  const p=new URLSearchParams();
  p.set("activa","eq.true");
  const q=document.getElementById("queryInput").value.trim();
  const region=document.getElementById("regionFilter").value;
  const min=document.getElementById("minBudget").value;
  const max=document.getElementById("maxBudget").value;
  const deadline=document.getElementById("deadlineFilter").value;
  if(q) p.set("or",`(nombre.ilike.*${q}*,descripcion.ilike.*${q}*,organismo_nombre.ilike.*${q}*)`);
  if(region) p.set("region",`eq.${region}`);
  if(min) p.set("monto_estimado",`gte.${min}`);
  if(max) p.append("monto_estimado",`lte.${max}`);
  if(deadline){
    const d=new Date();
    d.setDate(d.getDate()+Number(deadline));
    p.set("fecha_cierre",`lte.${d.toISOString()}`);
  }
  return p;
}

function getOrder(){
  const sort=document.getElementById("sortSelect").value;
  if(sort==="budget-desc")return"monto_estimado.desc.nullslast";
  if(sort==="budget-asc")return"monto_estimado.asc.nullslast";
  if(sort==="deadline")return"fecha_cierre.asc.nullslast";
  return"fecha_publicacion.desc.nullslast";
}

async function fetchPage(page=1){
  showLoading();
  const from=(page-1)*PAGE_SIZE, to=from+PAGE_SIZE-1;
  const params=buildFilterParams();
  params.set("select","id,codigo,nombre,descripcion,organismo_nombre,region,tipo_licitacion,estado,monto_estimado,fecha_publicacion,fecha_cierre,fuente_url");
  params.set("order",getOrder());

  const response=await fetch(`${SUPABASE_URL}/rest/v1/licitaciones?${params.toString()}`,{
    headers:{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Prefer:"count=exact",
      Range:`${from}-${to}`
    }
  });
  if(!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);

  const rows=await response.json();
  const cr=response.headers.get("content-range");
  totalResults=cr&&cr.includes("/")?Number(cr.split("/")[1])||0:rows.length;
  currentRows=rows.map(mapTender);
  currentPage=page;

  render(currentRows);
  updatePagination();
  updateGlobalStats();
}

async function updateGlobalStats(){
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/licitaciones?select=monto_estimado,fecha_publicacion,fecha_cierre,nombre,descripcion,organismo_nombre,region,codigo,tipo_licitacion,estado,fuente_url,id&activa=eq.true&limit=1000`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`}
    });
    if(!response.ok)return;
    const mapped=(await response.json()).map(mapTender);
    const totalAmount=mapped.reduce((s,t)=>s+(Number(t.budget)||0),0);
    const today=mapped.filter(t=>isToday(t.rawPublishDate)).length;
    const high=mapped.filter(t=>t.score>=90).length;
    const best=mapped.length?mapped.reduce((a,b)=>b.score>a.score?b:a):null;
    document.getElementById("statActive").textContent=totalResults.toLocaleString("es-CL");
    document.getElementById("statToday").textContent=today;
    document.getElementById("statHigh").textContent=high;
    document.getElementById("statAmount").textContent=compactMoneyCLP(totalAmount);
    document.getElementById("heroBestScore").textContent=best?`${best.score}%`:"--%";
    document.getElementById("heroBestLabel").textContent=best?`Mejor oportunidad: ${best.id}`:"Sin oportunidades";
  }catch(e){console.warn("Stats:",e)}
}

function render(items){
  resultCount.textContent=`${totalResults.toLocaleString("es-CL")} oportunidades encontradas`;
  if(!items.length){
    list.innerHTML='<div class="empty-state"><strong>No encontramos resultados.</strong><br><br>Prueba ajustando los filtros.</div>';
    return;
  }
  list.innerHTML=items.map(t=>`
    <article class="tender-card">
      <div class="tender-top">
        <div class="score-badge ${scoreClass(t.score)}"><strong>${t.score}%</strong><small>match</small></div>
        <div class="tender-title"><h4>${escapeHtml(t.title)}</h4><p>${escapeHtml(t.buyer)} · ${escapeHtml(t.id)}</p></div>
        <button class="favorite-btn ${favorites.has(t.id)?"active":""}" onclick="toggleFavorite('${jsString(t.id)}')">${favorites.has(t.id)?"★":"☆"}</button>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>Región</span><strong>${escapeHtml(t.region)}</strong></div>
        <div class="meta-box"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
        <div class="meta-box"><span>Rubro</span><strong>${escapeHtml(t.category)}</strong></div>
        <div class="meta-box"><span>Cierre</span><strong>${escapeHtml(t.deadline)}</strong></div>
      </div>
      <div class="match-row">${t.tags.slice(0,4).map(tag=>`<span class="match-chip">✓ ${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="card-actions">
        <button onclick="openDetail('${jsString(t.id)}')">Ver detalle</button>
        <button class="analyze" onclick="openDetail('${jsString(t.id)}')">Analizar</button>
      </div>
    </article>`).join("");
}

function updatePagination(){
  const totalPages=Math.max(1,Math.ceil(totalResults/PAGE_SIZE));
  const start=totalResults===0?0:(currentPage-1)*PAGE_SIZE+1;
  const end=Math.min(currentPage*PAGE_SIZE,totalResults);
  pageInfo.textContent=`Página ${currentPage} de ${totalPages}`;
  pageRange.textContent=`Mostrando ${start}–${end} de ${totalResults.toLocaleString("es-CL")}`;
  prevPageBtn.disabled=currentPage<=1;
  nextPageBtn.disabled=currentPage>=totalPages;
}
function showLoading(){
  list.innerHTML='<div class="empty-state"><strong>Cargando licitaciones...</strong><br><br>Consultando Supabase.</div>';
  resultCount.textContent="Buscando oportunidades...";
}

window.toggleFavorite=function(id){
  favorites.has(id)?favorites.delete(id):favorites.add(id);
  localStorage.setItem("licitasmart-favorites",JSON.stringify([...favorites]));
  render(currentRows);
};

window.openDetail=function(id){
  const t=currentRows.find(x=>x.id===id);
  if(!t)return;
  document.getElementById("modalContent").innerHTML=`
    <span class="eyebrow">DETALLE DE LICITACIÓN</span>
    <h2>${escapeHtml(t.title)}</h2>
    <p style="color:#6b778c">${escapeHtml(t.description)}</p>
    <div class="detail-grid">
      <div class="detail-item"><span>Código</span><strong>${escapeHtml(t.id)}</strong></div>
      <div class="detail-item"><span>Organismo</span><strong>${escapeHtml(t.buyer)}</strong></div>
      <div class="detail-item"><span>Región</span><strong>${escapeHtml(t.region)}</strong></div>
      <div class="detail-item"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
      <div class="detail-item"><span>Tipo</span><strong>${escapeHtml(t.tenderType)}</strong></div>
      <div class="detail-item"><span>Estado</span><strong>${escapeHtml(t.status)}</strong></div>
      <div class="detail-item"><span>Publicación</span><strong>${escapeHtml(t.publishDate)}</strong></div>
      <div class="detail-item"><span>Cierre</span><strong>${escapeHtml(t.deadline)}</strong></div>
    </div>
    <div class="compatibility-box">
      <strong>Compatibilidad estimada: ${t.score}%</strong>
      <ul>${t.tags.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>
    </div>
    ${t.sourceUrl?`<a href="${escapeHtml(t.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="secondary-btn" style="display:inline-block;text-decoration:none;margin-top:16px">Abrir en Mercado Público</a>`:""}`;
  document.getElementById("modalBackdrop").classList.remove("hidden");
};

async function runSearch(reset=true){
  try{
    if(reset)currentPage=1;
    await fetchPage(currentPage);
  }catch(e){
    console.error(e);
    list.innerHTML=`<div class="empty-state"><strong>Error al consultar Supabase.</strong><br><br>${escapeHtml(e.message)}</div>`;
  }
}

document.getElementById("modalClose").onclick=()=>document.getElementById("modalBackdrop").classList.add("hidden");
document.getElementById("modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")e.currentTarget.classList.add("hidden")});
document.getElementById("searchBtn").onclick=()=>runSearch(true);
document.getElementById("queryInput").addEventListener("keydown",e=>{if(e.key==="Enter")runSearch(true)});
document.getElementById("sortSelect").onchange=()=>runSearch(true);
document.querySelectorAll("#regionFilter,#categoryFilter,#scoreFilter,#deadlineFilter").forEach(el=>el.onchange=()=>runSearch(true));
document.getElementById("clearFilters").onclick=()=>{
  ["queryInput","minBudget","maxBudget"].forEach(id=>document.getElementById(id).value="");
  ["regionFilter","categoryFilter","scoreFilter","deadlineFilter"].forEach(id=>document.getElementById(id).selectedIndex=0);
  runSearch(true);
};
prevPageBtn.onclick=()=>{if(currentPage>1){currentPage--;fetchPage(currentPage)}};
nextPageBtn.onclick=()=>{const tp=Math.ceil(totalResults/PAGE_SIZE);if(currentPage<tp){currentPage++;fetchPage(currentPage)}};
document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  if(btn.dataset.section==="buscar")document.getElementById("buscar").scrollIntoView({behavior:"smooth"});
  if(window.innerWidth<1100)document.getElementById("sidebar").classList.remove("open");
}));

runSearch(true);
