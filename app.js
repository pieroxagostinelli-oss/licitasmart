const SUPABASE_URL = "https://dajonjneqqtwiounwxkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_byVYQHLxHnia9zB8slChTg_gTd94IbH";
const PAGE_SIZE = 20;

let currentPage = 1;
let totalResults = 0;
let currentRows = [];
let favorites = new Set(JSON.parse(localStorage.getItem("licitasmart-favorites") || "[]"));

const $ = (id) => document.getElementById(id);

const companyProfile = {
  regions: ["Valparaíso", "Metropolitana"],
  minBudget: 20000000,
  maxBudget: 500000000,
  keywords: ["construcción","mejoramiento","reparación","obra","obras civiles","estructura metálica","mantención","infraestructura"]
};

function money(n){
  if(n === null || n === undefined || Number.isNaN(Number(n))) return "No informado";
  return new Intl.NumberFormat("es-CL", {
    style:"currency", currency:"CLP", maximumFractionDigits:0
  }).format(Number(n));
}
function normalizeText(v=""){
  return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function escapeHtml(v=""){
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function jsString(v=""){ return String(v).replaceAll("\\","\\\\").replaceAll("'","\\'"); }
function formatDate(s){
  if(!s) return "No informada";
  const d = new Date(s);
  if(Number.isNaN(d.getTime())) return "No informada";
  return new Intl.DateTimeFormat("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function daysUntil(s){
  if(!s) return null;
  const d = new Date(s);
  const n = Math.ceil((d - new Date()) / 86400000);
  return Number.isFinite(n) ? n : null;
}

function inferCategory(t){
  const text = normalizeText(`${t.nombre||""} ${t.descripcion||""}`);
  if(text.includes("estructura metal") || text.includes("galpon") || text.includes("acero")) return "Estructuras metálicas";
  if(text.includes("mantencion") || text.includes("mantenimiento") || text.includes("conservacion") || text.includes("reparacion")) return "Mantención";
  if(text.includes("inspeccion tecnica") || text.includes("servicios profesionales") || text.includes("consultoria")) return "Servicios profesionales";
  if(text.includes("camino") || text.includes("drenaje") || text.includes("paviment") || text.includes("obra civil")) return "Obras civiles";
  return "Construcción";
}
function calculateCompatibility(t){
  let score = 0;
  const reasons = [];
  const warnings = [];
  const text = normalizeText(`${t.nombre||""} ${t.descripcion||""} ${t.organismo_nombre||""}`);
  if(companyProfile.regions.includes(t.region||"")) { score += 25; reasons.push("Región seleccionada"); }

  const budget = t.monto_estimado == null ? null : Number(t.monto_estimado);
  if(budget === null){ score += 10; reasons.push("Presupuesto no informado: revisar"); }
  else if(budget >= companyProfile.minBudget && budget <= companyProfile.maxBudget){ score += 25; reasons.push("Presupuesto compatible"); }
  else if(budget < companyProfile.minBudget){ score += 8; warnings.push("Monto bajo el rango objetivo"); }
  else { score += 5; warnings.push("Monto sobre el rango objetivo"); }

  const matched = companyProfile.keywords.filter(k => text.includes(normalizeText(k)));
  score += Math.min(35, matched.length * 7);
  reasons.push(...matched.slice(0,3).map(k => `Coincide: ${k}`));

  const dd = daysUntil(t.fecha_cierre);
  if(dd === null) score += 5;
  else if(dd >= 10){ score += 15; reasons.push("Plazo adecuado"); }
  else if(dd >= 5){ score += 9; warnings.push("Plazo ajustado"); }
  else if(dd >= 0){ score += 3; warnings.push("Cierre muy próximo"); }

  return {score:Math.max(0,Math.min(100,score)), reasons, warnings};
}
function mapTender(row){
  const c = calculateCompatibility(row);
  return {
    id:row.codigo,
    title:row.nombre || "Licitación sin nombre",
    buyer:row.organismo_nombre || "Organismo no informado",
    region:row.region || "No informada",
    category:inferCategory(row),
    budget:row.monto_estimado == null ? null : Number(row.monto_estimado),
    score:c.score,
    deadline:formatDate(row.fecha_cierre),
    deadlineDays:daysUntil(row.fecha_cierre),
    publishDate:formatDate(row.fecha_publicacion),
    tenderType:row.tipo_licitacion || "No informado",
    status:row.estado || "No informado",
    description:row.descripcion || "Sin descripción disponible.",
    tags:c.reasons.length ? c.reasons : ["Revisar oportunidad"],
    warnings:c.warnings,
    sourceUrl:row.fuente_url || null
  };
}
function scoreClass(s){ if(s>=85) return ""; if(s>=70) return "medium"; return "low"; }

function getServerParams(page){
  const p = new URLSearchParams();
  p.set("select","id,codigo,nombre,descripcion,organismo_nombre,region,tipo_licitacion,estado,monto_estimado,fecha_publicacion,fecha_cierre,fuente_url");
  p.set("activa","eq.true");

  const q = $("queryInput").value.trim();
  const region = $("regionFilter").value;
  const min = $("minBudget").value;
  const max = $("maxBudget").value;
  const deadline = $("deadlineFilter").value;

  if(q){
    // Escape chars with meaning in PostgREST filters.
    const clean = q.replace(/[(),]/g," ").trim();
    p.set("or", `(nombre.ilike.*${clean}*,descripcion.ilike.*${clean}*,organismo_nombre.ilike.*${clean}*)`);
  }
  if(region) p.set("region", `eq.${region}`);
  if(min) p.append("monto_estimado", `gte.${min}`);
  if(max) p.append("monto_estimado", `lte.${max}`);
  if(deadline){
    const d = new Date();
    d.setDate(d.getDate() + Number(deadline));
    p.set("fecha_cierre", `lte.${d.toISOString()}`);
  }

  const sort = $("sortSelect").value;
  if(sort === "budget-desc") p.set("order","monto_estimado.desc.nullslast");
  else if(sort === "budget-asc") p.set("order","monto_estimado.asc.nullslast");
  else if(sort === "deadline") p.set("order","fecha_cierre.asc.nullslast");
  else p.set("order","fecha_publicacion.desc.nullslast");

  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String((page - 1) * PAGE_SIZE));
  return p;
}

async function apiGet(pathAndQuery, extraHeaders={}){
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method:"GET",
    headers:{
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Accept":"application/json",
      ...extraHeaders
    }
  });
  const text = await response.text();
  if(!response.ok){
    throw new Error(`Supabase ${response.status}: ${text.slice(0,500)}`);
  }
  let data = [];
  if(text) data = JSON.parse(text);
  return {response, data};
}

function showLoading(){
  $("resultCount").textContent = "Buscando oportunidades...";
  $("tendersList").innerHTML = `
    <div class="empty-state">
      <strong>Cargando licitaciones...</strong><br><br>
      Consultando la base de datos.
    </div>`;
}
function showError(error){
  console.error(error);
  $("resultCount").textContent = "No se pudieron cargar las licitaciones";
  $("tendersList").innerHTML = `
    <div class="empty-state">
      <strong>Error de conexión con Supabase.</strong><br><br>
      ${escapeHtml(error.message || String(error))}
    </div>`;
  $("pageInfo").textContent = "Página 1";
  $("pageRange").textContent = "Sin resultados";
  $("prevPage").disabled = true;
  $("nextPage").disabled = true;
}

async function fetchPage(page=1){
  showLoading();
  const params = getServerParams(page);

  const {response, data:rows} = await apiGet(
    `licitaciones?${params.toString()}`,
    {"Prefer":"count=exact"}
  );

  const contentRange = response.headers.get("content-range");
  let count = null;
  if(contentRange && contentRange.includes("/")){
    const last = contentRange.split("/")[1];
    if(last !== "*") count = Number(last);
  }

  // Fallback count request if browser does not expose content-range.
  if(count === null || Number.isNaN(count)){
    const countParams = getServerParams(1);
    countParams.delete("limit");
    countParams.delete("offset");
    countParams.set("select","id");
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/licitaciones?${countParams.toString()}&limit=1`, {
      headers:{
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Prefer":"count=exact",
        "Accept":"application/json"
      }
    });
    const cr = countRes.headers.get("content-range");
    count = cr && cr.includes("/") ? Number(cr.split("/")[1]) : rows.length;
  }

  totalResults = Number.isFinite(count) ? count : rows.length;
  currentPage = page;
  currentRows = rows.map(mapTender);

  // Client-only filters for inferred rubro and compatibility.
  const cat = $("categoryFilter").value;
  const minScore = Number($("scoreFilter").value || 0);
  let visible = currentRows;
  if(cat) visible = visible.filter(t => t.category === cat);
  if(minScore) visible = visible.filter(t => t.score >= minScore);

  render(visible);
  updatePagination();
  updateBasicStats(visible);
}

function updateBasicStats(visibleRows){
  $("statActive").textContent = totalResults.toLocaleString("es-CL");
  $("statToday").textContent = "—";
  $("statHigh").textContent = visibleRows.filter(t=>t.score>=90).length;
  const sum = visibleRows.reduce((s,t)=>s+(Number(t.budget)||0),0);
  $("statAmount").textContent = sum ? money(sum) : "$0";
  const best = visibleRows.length ? visibleRows.reduce((a,b)=>b.score>a.score?b:a) : null;
  $("heroBestScore").textContent = best ? `${best.score}%` : "--%";
  $("heroBestLabel").textContent = best ? `Mejor oportunidad: ${best.id}` : "Sin oportunidades en esta página";
}

function render(items){
  $("resultCount").textContent = `${totalResults.toLocaleString("es-CL")} oportunidades encontradas`;
  if(!items.length){
    $("tendersList").innerHTML = `
      <div class="empty-state">
        <strong>No hay resultados visibles en esta página.</strong><br><br>
        Ajusta los filtros o avanza a otra página.
      </div>`;
    return;
  }

  $("tendersList").innerHTML = items.map(t=>`
    <article class="tender-card">
      <div class="tender-top">
        <div class="score-badge ${scoreClass(t.score)}">
          <strong>${t.score}%</strong><small>match</small>
        </div>
        <div class="tender-title">
          <h4>${escapeHtml(t.title)}</h4>
          <p>${escapeHtml(t.buyer)} · ${escapeHtml(t.id)}</p>
        </div>
        <button class="favorite-btn ${favorites.has(t.id)?"active":""}"
          onclick="toggleFavorite('${jsString(t.id)}')">${favorites.has(t.id)?"★":"☆"}</button>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>Región</span><strong>${escapeHtml(t.region)}</strong></div>
        <div class="meta-box"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
        <div class="meta-box"><span>Rubro</span><strong>${escapeHtml(t.category)}</strong></div>
        <div class="meta-box"><span>Cierre</span><strong>${escapeHtml(t.deadline)}</strong></div>
      </div>
      <div class="match-row">
        ${t.tags.slice(0,4).map(x=>`<span class="match-chip">✓ ${escapeHtml(x)}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button onclick="openDetail('${jsString(t.id)}')">Ver detalle</button>
        <button class="analyze" onclick="openDetail('${jsString(t.id)}')">Analizar</button>
      </div>
    </article>
  `).join("");
}

function updatePagination(){
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const start = totalResults ? (currentPage-1)*PAGE_SIZE+1 : 0;
  const end = Math.min(currentPage*PAGE_SIZE,totalResults);
  $("pageInfo").textContent = `Página ${currentPage} de ${totalPages}`;
  $("pageRange").textContent = `Mostrando ${start}–${end} de ${totalResults.toLocaleString("es-CL")}`;
  $("prevPage").disabled = currentPage <= 1;
  $("nextPage").disabled = currentPage >= totalPages;
}

window.toggleFavorite = function(id){
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem("licitasmart-favorites",JSON.stringify([...favorites]));
  render(currentRows);
};

window.openDetail = function(id){
  const t = currentRows.find(x=>x.id===id);
  if(!t) return;
  $("modalContent").innerHTML = `
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
    ${t.sourceUrl ? `<a href="${escapeHtml(t.sourceUrl)}" target="_blank" rel="noopener noreferrer"
      class="secondary-btn" style="display:inline-block;text-decoration:none;margin-top:16px">
      Abrir en Mercado Público</a>` : ""}
  `;
  $("modalBackdrop").classList.remove("hidden");
};

async function runSearch(reset=true){
  try{
    if(reset) currentPage = 1;
    await fetchPage(currentPage);
  }catch(err){
    showError(err);
  }
}

function init(){
  $("modalClose").onclick = ()=>$("modalBackdrop").classList.add("hidden");
  $("modalBackdrop").addEventListener("click",e=>{
    if(e.target.id==="modalBackdrop") e.currentTarget.classList.add("hidden");
  });
  $("searchBtn").onclick = ()=>runSearch(true);
  $("queryInput").addEventListener("keydown",e=>{ if(e.key==="Enter") runSearch(true); });
  $("sortSelect").onchange = ()=>runSearch(true);
  ["regionFilter","categoryFilter","scoreFilter","deadlineFilter"].forEach(id=>{
    $(id).onchange = ()=>runSearch(true);
  });
  $("clearFilters").onclick = ()=>{
    ["queryInput","minBudget","maxBudget"].forEach(id=>$(id).value="");
    ["regionFilter","categoryFilter","scoreFilter","deadlineFilter"].forEach(id=>$(id).selectedIndex=0);
    runSearch(true);
  };
  $("prevPage").onclick = ()=>{
    if(currentPage>1){ currentPage--; fetchPage(currentPage).catch(showError); }
  };
  $("nextPage").onclick = ()=>{
    const totalPages=Math.max(1,Math.ceil(totalResults/PAGE_SIZE));
    if(currentPage<totalPages){ currentPage++; fetchPage(currentPage).catch(showError); }
  };
  $("menuBtn").onclick = ()=>$("sidebar").classList.toggle("open");
  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      if(btn.dataset.section==="buscar") $("buscar").scrollIntoView({behavior:"smooth"});
      if(window.innerWidth<1100) $("sidebar").classList.remove("open");
    });
  });
  runSearch(true);
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
}else{
  init();
}

