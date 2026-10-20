
const tenders = [
  {
    id:"1234-56-LP26",
    title:"Mejoramiento de infraestructura Escuela Municipal",
    buyer:"Municipalidad de Villa Alemana",
    region:"Valparaíso",
    category:"Construcción",
    budget:186500000,
    score:96,
    deadlineDays:12,
    deadline:"01/11/2026",
    tags:["Construcción","Presupuesto compatible","Región seleccionada","Plazo adecuado"],
    description:"Mejoramiento integral de infraestructura, techumbres, terminaciones y obras complementarias."
  },
  {
    id:"8123-44-LE26",
    title:"Conservación y reparación de sede comunitaria",
    buyer:"Municipalidad de Quilpué",
    region:"Valparaíso",
    category:"Obras civiles",
    budget:78500000,
    score:92,
    deadlineDays:8,
    deadline:"28/10/2026",
    tags:["Obras civiles","Valparaíso","Experiencia compatible"],
    description:"Conservación de recinto comunitario, reparación de cubierta, pavimentos y terminaciones."
  },
  {
    id:"4556-91-LP26",
    title:"Construcción de bodega y estructura metálica municipal",
    buyer:"Municipalidad de Maipú",
    region:"Metropolitana",
    category:"Estructuras metálicas",
    budget:235000000,
    score:89,
    deadlineDays:18,
    deadline:"07/11/2026",
    tags:["Estructura metálica","Monto compatible","RM"],
    description:"Construcción de recinto de almacenamiento con estructura metálica, fundaciones y obras exteriores."
  },
  {
    id:"1199-18-LE26",
    title:"Mantención de edificios públicos y oficinas",
    buyer:"Servicio de Salud Metropolitano",
    region:"Metropolitana",
    category:"Mantención",
    budget:64000000,
    score:84,
    deadlineDays:6,
    deadline:"26/10/2026",
    tags:["Mantención","RM","Cierre próximo"],
    description:"Servicio de mantención preventiva y correctiva de infraestructura en recintos institucionales."
  },
  {
    id:"7731-32-LQ26",
    title:"Mejoramiento de caminos interiores y obras de drenaje",
    buyer:"Dirección Regional de Vialidad",
    region:"O'Higgins",
    category:"Obras civiles",
    budget:410000000,
    score:78,
    deadlineDays:24,
    deadline:"13/11/2026",
    tags:["Obras civiles","Presupuesto alto","Movimiento de tierra"],
    description:"Mejoramiento de caminos, perfilado, drenajes, compactación y obras complementarias."
  },
  {
    id:"9033-10-LE26",
    title:"Servicios profesionales para inspección técnica de obras",
    buyer:"SERVIU Región del Maule",
    region:"Maule",
    category:"Servicios profesionales",
    budget:42000000,
    score:62,
    deadlineDays:14,
    deadline:"03/11/2026",
    tags:["Inspección técnica","Servicios profesionales"],
    description:"Contratación de apoyo profesional para inspección técnica y control documental de obras."
  }
];

let favorites = new Set(JSON.parse(localStorage.getItem("licitasmart-favorites") || "[]"));

const list = document.getElementById("tendersList");
const resultCount = document.getElementById("resultCount");

function money(n){
  return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
}

function scoreClass(score){
  if(score >= 85) return "";
  if(score >= 70) return "medium";
  return "low";
}

function render(items){
  resultCount.textContent = `${items.length} oportunidades encontradas`;
  if(!items.length){
    list.innerHTML = `<div class="empty-state"><strong>No encontramos resultados.</strong><br><br>Prueba ajustando los filtros de búsqueda.</div>`;
    return;
  }

  list.innerHTML = items.map(t => `
    <article class="tender-card">
      <div class="tender-top">
        <div class="score-badge ${scoreClass(t.score)}">
          <strong>${t.score}%</strong>
          <small>match</small>
        </div>
        <div class="tender-title">
          <h4>${t.title}</h4>
          <p>${t.buyer} · ${t.id}</p>
        </div>
        <button class="favorite-btn ${favorites.has(t.id) ? "active":""}" onclick="toggleFavorite('${t.id}')" title="Guardar">
          ${favorites.has(t.id) ? "★":"☆"}
        </button>
      </div>

      <div class="meta-grid">
        <div class="meta-box"><span>Región</span><strong>${t.region}</strong></div>
        <div class="meta-box"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
        <div class="meta-box"><span>Rubro</span><strong>${t.category}</strong></div>
        <div class="meta-box"><span>Cierre</span><strong>${t.deadline}</strong></div>
      </div>

      <div class="match-row">
        ${t.tags.map(tag=>`<span class="match-chip">✓ ${tag}</span>`).join("")}
      </div>

      <div class="card-actions">
        <button onclick="openDetail('${t.id}')">Ver detalle</button>
        <button class="analyze" onclick="openDetail('${t.id}')">Analizar</button>
      </div>
    </article>
  `).join("");
}

function applyFilters(){
  const q = document.getElementById("queryInput").value.toLowerCase().trim();
  const region = document.getElementById("regionFilter").value;
  const category = document.getElementById("categoryFilter").value;
  const min = Number(document.getElementById("minBudget").value || 0);
  const max = Number(document.getElementById("maxBudget").value || Infinity);
  const score = Number(document.getElementById("scoreFilter").value || 0);
  const deadline = Number(document.getElementById("deadlineFilter").value || Infinity);

  let filtered = tenders.filter(t => {
    const text = `${t.title} ${t.description} ${t.buyer} ${t.category} ${t.region}`.toLowerCase();
    return (!q || text.includes(q))
      && (!region || t.region === region)
      && (!category || t.category === category)
      && t.budget >= min
      && t.budget <= max
      && t.score >= score
      && t.deadlineDays <= deadline;
  });

  const sort = document.getElementById("sortSelect").value;
  if(sort === "score") filtered.sort((a,b)=>b.score-a.score);
  if(sort === "budget-desc") filtered.sort((a,b)=>b.budget-a.budget);
  if(sort === "budget-asc") filtered.sort((a,b)=>a.budget-b.budget);
  if(sort === "deadline") filtered.sort((a,b)=>a.deadlineDays-b.deadlineDays);

  render(filtered);
}

window.toggleFavorite = function(id){
  if(favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  localStorage.setItem("licitasmart-favorites", JSON.stringify([...favorites]));
  applyFilters();
}

window.openDetail = function(id){
  const t = tenders.find(x => x.id === id);
  document.getElementById("modalContent").innerHTML = `
    <span class="eyebrow">DETALLE DE LICITACIÓN</span>
    <h2>${t.title}</h2>
    <p style="color:#6b778c">${t.description}</p>

    <div class="detail-grid">
      <div class="detail-item"><span>Código</span><strong>${t.id}</strong></div>
      <div class="detail-item"><span>Organismo</span><strong>${t.buyer}</strong></div>
      <div class="detail-item"><span>Región</span><strong>${t.region}</strong></div>
      <div class="detail-item"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
      <div class="detail-item"><span>Rubro</span><strong>${t.category}</strong></div>
      <div class="detail-item"><span>Fecha de cierre</span><strong>${t.deadline}</strong></div>
    </div>

    <div class="compatibility-box">
      <strong>Compatibilidad estimada: ${t.score}%</strong>
      <ul>${t.tags.map(x=>`<li>${x}</li>`).join("")}</ul>
    </div>
  `;
  document.getElementById("modalBackdrop").classList.remove("hidden");
}

document.getElementById("modalClose").onclick = () => document.getElementById("modalBackdrop").classList.add("hidden");
document.getElementById("modalBackdrop").addEventListener("click", e => {
  if(e.target.id === "modalBackdrop") e.currentTarget.classList.add("hidden");
});

document.getElementById("searchBtn").onclick = applyFilters;
document.getElementById("sortSelect").onchange = applyFilters;
document.querySelectorAll("#regionFilter,#categoryFilter,#scoreFilter,#deadlineFilter").forEach(el=>el.onchange=applyFilters);
document.getElementById("queryInput").addEventListener("keydown", e => { if(e.key === "Enter") applyFilters(); });

document.getElementById("clearFilters").onclick = () => {
  ["queryInput","minBudget","maxBudget"].forEach(id=>document.getElementById(id).value="");
  ["regionFilter","categoryFilter","scoreFilter","deadlineFilter"].forEach(id=>document.getElementById(id).selectedIndex=0);
  applyFilters();
};

document.getElementById("menuBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");

document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.section;
    if(target === "buscar") document.getElementById("buscar").scrollIntoView({behavior:"smooth"});
    if(window.innerWidth < 1100) document.getElementById("sidebar").classList.remove("open");
  });
});

render(tenders);
