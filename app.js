// ============================================================
// LICITASMART CHILE - FRONTEND V2
// Conexión real GitHub Pages -> Supabase REST API
// ============================================================

const SUPABASE_URL = "https://dajonjneqqtwiounwxkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_byVYQHLxHnia9zB8slChTg_gTd94IbH";

let tenders = [];
let favorites = new Set(JSON.parse(localStorage.getItem("licitasmart-favorites") || "[]"));

const list = document.getElementById("tendersList");
const resultCount = document.getElementById("resultCount");

// Perfil inicial de ejemplo.
// Más adelante este perfil vendrá desde la tabla empresas/perfiles_busqueda.
const companyProfile = {
  regions: ["Valparaíso", "Metropolitana"],
  minBudget: 20000000,
  maxBudget: 500000000,
  keywords: [
    "construcción",
    "mejoramiento",
    "reparación",
    "obra",
    "obras civiles",
    "estructura metálica",
    "mantención",
    "infraestructura"
  ]
};

function money(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "No informado";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(n));
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const end = new Date(dateString);
  const now = new Date();
  const diff = Math.ceil((end - now) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function formatDate(dateString) {
  if (!dateString) return "No informada";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "No informada";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}

function inferCategory(t) {
  const text = normalizeText(`${t.nombre || ""} ${t.descripcion || ""}`);

  if (
    text.includes("estructura metal") ||
    text.includes("galpon") ||
    text.includes("acero")
  ) return "Estructuras metálicas";

  if (
    text.includes("mantencion") ||
    text.includes("mantenimiento") ||
    text.includes("conservacion") ||
    text.includes("reparacion")
  ) return "Mantención";

  if (
    text.includes("inspeccion tecnica") ||
    text.includes("servicios profesionales") ||
    text.includes("consultoria")
  ) return "Servicios profesionales";

  if (
    text.includes("camino") ||
    text.includes("drenaje") ||
    text.includes("paviment") ||
    text.includes("obra civil") ||
    text.includes("obras civiles")
  ) return "Obras civiles";

  return "Construcción";
}

function calculateCompatibility(t) {
  let score = 0;
  const reasons = [];
  const warnings = [];

  const text = normalizeText(`${t.nombre || ""} ${t.descripcion || ""} ${t.organismo_nombre || ""}`);
  const region = t.region || "";
  const budget = t.monto_estimado === null ? null : Number(t.monto_estimado);
  const deadlineDays = daysUntil(t.fecha_cierre);

  // Región: 25 puntos
  if (companyProfile.regions.includes(region)) {
    score += 25;
    reasons.push("Región seleccionada");
  } else if (region) {
    warnings.push("Región fuera del perfil principal");
  }

  // Presupuesto: 25 puntos
  if (budget === null) {
    score += 10;
    reasons.push("Presupuesto no informado: revisar");
  } else if (budget >= companyProfile.minBudget && budget <= companyProfile.maxBudget) {
    score += 25;
    reasons.push("Presupuesto compatible");
  } else if (budget < companyProfile.minBudget) {
    score += 8;
    warnings.push("Monto bajo el rango objetivo");
  } else {
    score += 5;
    warnings.push("Monto sobre el rango objetivo");
  }

  // Palabras / rubro: hasta 35 puntos
  const matchedKeywords = companyProfile.keywords.filter(k => text.includes(normalizeText(k)));
  const keywordScore = Math.min(35, matchedKeywords.length * 7);
  score += keywordScore;

  if (matchedKeywords.length) {
    reasons.push(...matchedKeywords.slice(0, 3).map(k => `Coincide: ${k}`));
  } else {
    warnings.push("Pocas coincidencias con palabras del perfil");
  }

  // Plazo: 15 puntos
  if (deadlineDays === null) {
    score += 5;
    warnings.push("Fecha de cierre no informada");
  } else if (deadlineDays >= 10) {
    score += 15;
    reasons.push("Plazo adecuado");
  } else if (deadlineDays >= 5) {
    score += 9;
    warnings.push("Plazo de postulación ajustado");
  } else if (deadlineDays >= 0) {
    score += 3;
    warnings.push("Cierre muy próximo");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons, warnings };
}

function mapTender(row) {
  const compatibility = calculateCompatibility(row);

  return {
    id: row.codigo,
    dbId: row.id,
    title: row.nombre,
    buyer: row.organismo_nombre || "Organismo no informado",
    region: row.region || "No informada",
    category: inferCategory(row),
    budget: row.monto_estimado === null ? null : Number(row.monto_estimado),
    score: compatibility.score,
    deadlineDays: daysUntil(row.fecha_cierre),
    deadline: formatDate(row.fecha_cierre),
    publishDate: formatDate(row.fecha_publicacion),
    tenderType: row.tipo_licitacion || "No informado",
    status: row.estado || "No informado",
    description: row.descripcion || "Sin descripción disponible.",
    tags: compatibility.reasons.length ? compatibility.reasons : ["Revisar oportunidad"],
    warnings: compatibility.warnings,
    sourceUrl: row.fuente_url || null
  };
}

function scoreClass(score) {
  if (score >= 85) return "";
  if (score >= 70) return "medium";
  return "low";
}

function updateStats(items) {
  const active = document.getElementById("statActive");
  const high = document.getElementById("statHigh");

  if (active) active.textContent = items.length;
  if (high) high.textContent = items.filter(t => t.score >= 90).length;
}

function render(items) {
  resultCount.textContent = `${items.length} oportunidades encontradas`;
  updateStats(items);

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <strong>No encontramos resultados.</strong><br><br>
        Prueba ajustando los filtros de búsqueda.
      </div>`;
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
          <h4>${escapeHtml(t.title)}</h4>
          <p>${escapeHtml(t.buyer)} · ${escapeHtml(t.id)}</p>
        </div>

        <button
          class="favorite-btn ${favorites.has(t.id) ? "active" : ""}"
          onclick="toggleFavorite('${jsString(t.id)}')"
          title="Guardar"
        >
          ${favorites.has(t.id) ? "★" : "☆"}
        </button>
      </div>

      <div class="meta-grid">
        <div class="meta-box"><span>Región</span><strong>${escapeHtml(t.region)}</strong></div>
        <div class="meta-box"><span>Presupuesto</span><strong>${money(t.budget)}</strong></div>
        <div class="meta-box"><span>Rubro</span><strong>${escapeHtml(t.category)}</strong></div>
        <div class="meta-box"><span>Cierre</span><strong>${escapeHtml(t.deadline)}</strong></div>
      </div>

      <div class="match-row">
        ${t.tags.slice(0,4).map(tag => `<span class="match-chip">✓ ${escapeHtml(tag)}</span>`).join("")}
      </div>

      <div class="card-actions">
        <button onclick="openDetail('${jsString(t.id)}')">Ver detalle</button>
        <button class="analyze" onclick="openDetail('${jsString(t.id)}')">Analizar</button>
      </div>
    </article>
  `).join("");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsString(value = "") {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function showLoading() {
  list.innerHTML = `
    <div class="empty-state">
      <strong>Cargando licitaciones desde Supabase...</strong><br><br>
      Conectando con la base de datos.
    </div>`;
  resultCount.textContent = "Cargando oportunidades...";
}

function showConnectionError(error) {
  console.error("Error Supabase:", error);
  list.innerHTML = `
    <div class="empty-state">
      <strong>No se pudo conectar con Supabase.</strong><br><br>
      Revisa la configuración de la API, la política RLS de lectura pública y la consola del navegador.
    </div>`;
  resultCount.textContent = "Error de conexión";
}

async function loadTendersFromSupabase() {
  showLoading();

  const endpoint =
    `${SUPABASE_URL}/rest/v1/licitaciones` +
    `?select=id,codigo,nombre,descripcion,organismo_nombre,region,tipo_licitacion,estado,monto_estimado,fecha_publicacion,fecha_cierre,fuente_url` +
    `&activa=eq.true` +
    `&order=fecha_publicacion.desc.nullslast`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${response.status}: ${body}`);
    }

    const rows = await response.json();
    tenders = rows.map(mapTender);

    applyFilters();
  } catch (error) {
    showConnectionError(error);
  }
}

function applyFilters() {
  const q = normalizeText(document.getElementById("queryInput").value.trim());
  const region = document.getElementById("regionFilter").value;
  const category = document.getElementById("categoryFilter").value;
  const min = Number(document.getElementById("minBudget").value || 0);
  const maxInput = document.getElementById("maxBudget").value;
  const max = maxInput ? Number(maxInput) : Infinity;
  const score = Number(document.getElementById("scoreFilter").value || 0);

  const deadlineValue = document.getElementById("deadlineFilter").value;
  const deadline = deadlineValue ? Number(deadlineValue) : Infinity;

  let filtered = tenders.filter(t => {
    const text = normalizeText(
      `${t.title} ${t.description} ${t.buyer} ${t.category} ${t.region}`
    );

    const budgetPass =
      t.budget === null ||
      (t.budget >= min && t.budget <= max);

    const deadlinePass =
      t.deadlineDays === null ||
      t.deadlineDays <= deadline;

    return (!q || text.includes(q))
      && (!region || t.region === region)
      && (!category || t.category === category)
      && budgetPass
      && t.score >= score
      && deadlinePass;
  });

  const sort = document.getElementById("sortSelect").value;

  if (sort === "score") filtered.sort((a, b) => b.score - a.score);
  if (sort === "budget-desc") filtered.sort((a, b) => (b.budget ?? -1) - (a.budget ?? -1));
  if (sort === "budget-asc") filtered.sort((a, b) => (a.budget ?? Infinity) - (b.budget ?? Infinity));
  if (sort === "deadline") filtered.sort((a, b) => (a.deadlineDays ?? Infinity) - (b.deadlineDays ?? Infinity));

  render(filtered);
}

window.toggleFavorite = function(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);

  localStorage.setItem("licitasmart-favorites", JSON.stringify([...favorites]));
  applyFilters();
};

window.openDetail = function(id) {
  const t = tenders.find(x => x.id === id);
  if (!t) return;

  const warningHtml = t.warnings.length
    ? `
      <div style="margin-top:14px;background:#fff7e8;border:1px solid #f2dfb4;border-radius:14px;padding:16px">
        <strong>Aspectos a revisar</strong>
        <ul>${t.warnings.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>`
    : "";

  const sourceButton = t.sourceUrl
    ? `<a href="${escapeHtml(t.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="secondary-btn" style="display:inline-block;text-decoration:none;margin-top:16px">Abrir fuente</a>`
    : "";

  document.getElementById("modalContent").innerHTML = `
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
      <ul>${t.tags.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
    </div>

    ${warningHtml}
    ${sourceButton}
  `;

  document.getElementById("modalBackdrop").classList.remove("hidden");
};

// Eventos de interfaz
document.getElementById("modalClose").onclick = () =>
  document.getElementById("modalBackdrop").classList.add("hidden");

document.getElementById("modalBackdrop").addEventListener("click", e => {
  if (e.target.id === "modalBackdrop") {
    e.currentTarget.classList.add("hidden");
  }
});

document.getElementById("searchBtn").onclick = applyFilters;
document.getElementById("sortSelect").onchange = applyFilters;

document
  .querySelectorAll("#regionFilter,#categoryFilter,#scoreFilter,#deadlineFilter")
  .forEach(el => el.onchange = applyFilters);

document.getElementById("queryInput").addEventListener("keydown", e => {
  if (e.key === "Enter") applyFilters();
});

document.getElementById("clearFilters").onclick = () => {
  ["queryInput", "minBudget", "maxBudget"].forEach(id => {
    document.getElementById(id).value = "";
  });

  ["regionFilter", "categoryFilter", "scoreFilter", "deadlineFilter"].forEach(id => {
    document.getElementById(id).selectedIndex = 0;
  });

  applyFilters();
};

document.getElementById("menuBtn").onclick = () =>
  document.getElementById("sidebar").classList.toggle("open");

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.section;
    if (target === "buscar") {
      document.getElementById("buscar").scrollIntoView({ behavior: "smooth" });
    }

    if (window.innerWidth < 1100) {
      document.getElementById("sidebar").classList.remove("open");
    }
  });
});

// Arranque real de la aplicación
loadTendersFromSupabase();
