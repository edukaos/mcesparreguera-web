// Genera la web estática en dist/ a partir de la Google Sheet (o de data/coches.csv si no hay enlace).
// Uso: node build.mjs   (Node 18+, sin dependencias)
import { mkdir, writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import cfg from "./config.mjs";

const DIST = "dist";

// ---------- Datos ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()));
  const keys = head.map(h => h.trim().toLowerCase());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = s => { const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")); return s && !isNaN(n) ? n : null; };

// Acepta enlaces de Google Drive ("compartir") o URLs directas a imágenes.
function photoUrl(u) {
  const m = u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : u;
}

const SIL_BY_BODY = { berlina: "berlina", suv: "suv", "todo terreno": "suv", furgoneta: "furgoneta", monovolumen: "furgoneta", coupe: "coupe", "coupé": "coupe", camper: "camper" };

function normalize(r) {
  const marca = r.marca, modelo = r.modelo;
  const year = num(r["año"] ?? r.ano ?? r.anio);
  const car = {
    id: slug(r.id || `${marca} ${modelo} ${year ?? ""}`),
    estado: (r.estado || "disponible").toLowerCase(),
    destacado: /^(s[ií]|x|1|true)$/i.test(r.destacado || ""),
    marca, modelo, version: r.version || r["versión"] || "",
    year, km: num(r.km),
    combustible: r.combustible, cambio: r.cambio, cv: num(r.cv),
    carroceria: r.carroceria || r["carrocería"] || "",
    etiqueta: (r.etiqueta || "").toUpperCase(),
    precio: num(r.precio),
    fotos: (r.fotos || "").split(/[\s|]+/).filter(Boolean).map(photoUrl),
    descripcion: r.descripcion || r["descripción"] || "",
  };
  car.sil = SIL_BY_BODY[car.carroceria.toLowerCase()] || "berlina";
  return car;
}

async function loadCars() {
  let text;
  if (/^https?:/.test(cfg.sheetCsvUrl)) {
    const res = await fetch(cfg.sheetCsvUrl);
    if (!res.ok) throw new Error(`No se pudo leer la hoja (${res.status})`);
    text = await res.text();
    if (/<html/i.test(text.slice(0, 500))) throw new Error("La hoja no es pública: compártela con \"cualquiera con el enlace\"");
    console.log("Coches leídos de la Google Sheet");
  } else {
    const file = cfg.sheetCsvUrl || "data/coches.csv";
    text = await readFile(file, "utf8");
    console.log(`Usando el archivo local ${file}`);
  }
  const cars = parseCsv(text).filter(r => r.marca && r.modelo).map(normalize)
    .filter(c => c.estado !== "vendido" && c.precio);
  cars.sort((a, b) => (b.destacado - a.destacado) || (a.estado === "reservado") - (b.estado === "reservado"));
  return cars;
}

// Descarga las fotos a dist/fotos para no depender de Drive al navegar. Si falla, usa la URL original.
async function localizePhotos(cars) {
  await mkdir(`${DIST}/fotos`, { recursive: true });
  for (const c of cars) {
    c.fotos = await Promise.all(c.fotos.map(async (u, i) => {
      try {
        const res = await fetch(u, { redirect: "follow" });
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.startsWith("image/")) throw new Error(type);
        const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
        const name = `${c.id}-${i + 1}-${createHash("md5").update(u).digest("hex").slice(0, 6)}.${ext}`;
        await writeFile(`${DIST}/fotos/${name}`, Buffer.from(await res.arrayBuffer()));
        return `/fotos/${name}`;
      } catch (e) {
        console.warn(`Foto no descargada (${c.id}): ${u}`);
        return u;
      }
    }));
  }
}

// ---------- Utilidades de plantilla ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const eur = n => n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
const kmf = n => n == null ? "km a consultar" : n.toLocaleString("es-ES") + " km";
const phoneFmt = p => p.replace(/^34/, "").replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
const title = c => `${c.marca} ${c.modelo}`;
function cuota(price, { tin, entradaPct, meses } = cfg.financiacion) {
  const capital = price * (1 - entradaPct / 100), r = tin / 12;
  return Math.round(capital * r / (1 - Math.pow(1 + r, -meses)));
}
const wa = text => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
const waCar = c => wa(`Hola, me interesa el ${title(c)} ${c.version} (${c.year}) de ${eur(c.precio)}. ¿Sigue disponible?`);

const SIL = {
  berlina: '<svg viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M10 58c0-8 4-12 14-14l26-5 22-15c6-4 12-5 20-5h36c9 0 15 3 21 9l14 13 16 3c8 2 11 6 11 14v6H10Z" opacity=".85"/><path d="M78 26h26v14H62Zm32 0h28c5 0 8 2 11 5l9 9h-48Z" fill="var(--paper)" opacity=".8"/><circle cx="50" cy="64" r="12"/><circle cx="154" cy="64" r="12"/><circle cx="50" cy="64" r="5" fill="var(--paper)"/><circle cx="154" cy="64" r="5" fill="var(--paper)"/></svg>',
  suv: '<svg viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M10 60V44c0-5 3-8 9-9l24-4 18-15c4-3 8-4 14-4h70c7 0 11 2 15 7l12 16c10 1 18 5 18 14v11Z" opacity=".85"/><path d="M68 20h30v16H52Zm36 0h34c4 0 6 1 8 4l8 12h-50Z" fill="var(--paper)" opacity=".8"/><circle cx="50" cy="64" r="13"/><circle cx="156" cy="64" r="13"/><circle cx="50" cy="64" r="5" fill="var(--paper)"/><circle cx="156" cy="64" r="5" fill="var(--paper)"/></svg>',
  furgoneta: '<svg viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M8 62V30c0-10 6-18 16-18h116c8 0 13 3 17 9l15 18 14 3c4 1 6 4 6 8v12Z" opacity=".85"/><path d="M140 20h12l16 20h-28Z" fill="var(--paper)" opacity=".8"/><circle cx="48" cy="64" r="12"/><circle cx="156" cy="64" r="12"/><circle cx="48" cy="64" r="5" fill="var(--paper)"/><circle cx="156" cy="64" r="5" fill="var(--paper)"/></svg>',
  coupe: '<svg viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M8 60c0-7 4-11 12-12l34-8 26-14c6-3 12-4 18-4h28c8 0 14 3 20 8l14 12 18 3c8 2 12 6 12 13v4H8Z" opacity=".85"/><path d="M86 28h20v12H66Zm26 0h22c5 0 8 2 11 5l7 7h-40Z" fill="var(--paper)" opacity=".8"/><circle cx="50" cy="64" r="12"/><circle cx="156" cy="64" r="12"/><circle cx="50" cy="64" r="5" fill="var(--paper)"/><circle cx="156" cy="64" r="5" fill="var(--paper)"/></svg>',
  camper: '<svg viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M14 62V26c0-10 8-16 18-16h120c14 0 22 8 28 20l6 14c2 5 2 10 2 18Z" opacity=".85"/><path d="M30 20h30v16H30Zm40 0h30v16H70Zm40 0h30v16h-30Zm42 0h6c6 0 11 6 14 16h-20Z" fill="var(--paper)" opacity=".8"/><circle cx="50" cy="64" r="12"/><circle cx="154" cy="64" r="12"/><circle cx="50" cy="64" r="5" fill="var(--paper)"/><circle cx="154" cy="64" r="5" fill="var(--paper)"/></svg>',
};

function dgt(e) {
  const map = { C: ["c", "C", "Etiqueta C DGT"], B: ["b", "B", "Etiqueta B DGT"], ECO: ["eco", "ECO", "Etiqueta ECO DGT"], "0": ["eco", "0", "Etiqueta 0 DGT"], H: ["h", "HIST", "Vehículo histórico"] };
  const [cls, txt, t] = map[e] || ["na", "¿?", "Etiqueta a consultar"];
  return `<span class="dgt ${cls}" title="${t}">${txt}</span>`;
}

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z"/></svg>';

function layout({ pageTitle, description, path, body, jsonld, image }) {
  const url = cfg.siteUrl + path;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${esc(image.startsWith("/") ? cfg.siteUrl + image : image)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="logo" href="/"><span class="mk">MC</span><span><b>${esc(cfg.nombre)}</b><small>Esparreguera · desde ${cfg.desde}</small></span></a>
    <nav class="menu" aria-label="Principal">
      <a href="/#stock">Coches</a><a href="/#tasacion">Vende tu coche</a><a href="/#financiacion">Financiación</a><a href="/#servicios">Gestoría</a><a href="/#contacto">Contacto</a>
    </nav>
    <a class="btn btn-wa" href="${wa("Hola, vengo de la web")}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
  </div>
</header>
${body}
${contactSection()}
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(cfg.nombre)} Esparreguera · Compraventa de coches de ocasión · Representante oficial Aixam</div></footer>
<a class="btn btn-wa fab" href="${wa("Hola, vengo de la web")}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${WA_ICON}¿Hablamos?</a>
<script src="/app.js" defer></script>
</body>
</html>`;
}

function contactSection() {
  return `<section class="contact" id="contacto">
  <div class="wrap">
    <div>
      <p class="eyebrow" style="color:var(--signal)">Ven a verlos</p>
      <h2>Prueba el coche antes de decidir</h2>
      <p style="color:var(--band-muted);max-width:48ch">Pide cita por WhatsApp y te tenemos el coche preparado para la prueba.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <a class="btn btn-wa" href="${wa("Hola, quiero pedir cita para ver un coche")}" target="_blank" rel="noopener">Pedir cita por WhatsApp</a>
      </div>
    </div>
    <dl>
      <dt>Teléfono</dt><dd><a class="mono" href="tel:+34${cfg.telefono}">${phoneFmt(cfg.telefono)}</a></dd>
      <dt>WhatsApp</dt><dd><a class="mono" href="${wa("Hola")}" target="_blank" rel="noopener">${phoneFmt(cfg.whatsapp)}</a></dd>
      <dt>Email</dt><dd><a href="mailto:${cfg.email}">${cfg.email}</a></dd>
      <dt>Dirección</dt><dd>${esc(cfg.direccion ? `${cfg.direccion}, ${cfg.ciudad}` : cfg.ciudad)}</dd>
      ${cfg.horario ? `<dt>Horario</dt><dd>${esc(cfg.horario)}</dd>` : ""}
      <dt>Instagram</dt><dd><a href="https://www.instagram.com/${cfg.instagram}/" target="_blank" rel="noopener">@${cfg.instagram}</a></dd>
    </dl>
  </div>
</section>`;
}

function card(c) {
  const img = c.fotos[0]
    ? `<img src="${esc(c.fotos[0])}" alt="${esc(`${title(c)} ${c.version} ${c.year}`)}" loading="lazy">`
    : SIL[c.sil];
  return `<article class="car" data-marca="${esc(`${c.marca} ${c.modelo} ${c.version}`.toLowerCase())}" data-precio="${c.precio}" data-km="${c.km ?? ""}" data-year="${c.year ?? ""}" data-fuel="${esc(c.combustible)}" data-body="${esc(c.carroceria)}" data-gear="${esc(c.cambio)}" data-dgt="${esc(c.etiqueta)}">
    <div class="pic">${img}${dgt(c.etiqueta)}<span class="plate"><i>E</i><span>${c.year ?? ""}</span></span>${c.estado === "reservado" ? '<span class="tag-res">Reservado</span>' : ""}</div>
    <div class="body">
      <div><h3><a href="/coches/${c.id}/">${esc(title(c))}</a></h3><div class="ver">${esc(c.version)}</div></div>
      <div class="specs"><span>${kmf(c.km)}</span><span>${esc(c.combustible)}</span><span>${esc(c.cambio)}</span>${c.cv ? `<span>${c.cv} cv</span>` : ""}</div>
      <div class="price-row"><div class="price mono">${eur(c.precio)}</div><div class="cuota">desde<br><b>${cuota(c.precio)} €</b>/mes</div></div>
      <div class="actions"><a class="btn btn-line" href="/coches/${c.id}/">Ver ficha</a><a class="btn btn-wa" href="${waCar(c)}" target="_blank" rel="noopener">Me interesa</a></div>
    </div></article>`;
}

const options = (vals) => [...new Set(vals.filter(Boolean))].sort().map(v => `<option>${esc(v)}</option>`).join("");

function homePage(cars) {
  const n = cars.length;
  const body = `<div class="hero" id="inicio">
  <div class="wrap">
    <div>
      <p class="eyebrow" style="color:var(--band-muted)">Coches de ocasión en ${esc(cfg.ciudad)}</p>
      <h1>Tu próximo coche, <em>revisado</em> y con los papeles hechos.</h1>
      <p class="lead">Más de ${new Date().getFullYear() - cfg.desde} años vendiendo coches de segunda mano en el Baix Llobregat. Gestoría propia, financiación y entrega en toda España.</p>
      <div class="ctas">
        <a class="btn btn-signal" href="#stock">Ver los ${n} coches en stock</a>
        <a class="btn btn-ghost" href="#tasacion">Tasar mi coche</a>
      </div>
    </div>
    <div class="facts" aria-label="Datos del concesionario">
      <div><strong>${cfg.desde}</strong><span>Abiertos desde</span></div>
      <div><strong>${n}</strong><span>Coches disponibles hoy</span></div>
      <div><strong>100%</strong><span>Transferencia incluida</span></div>
      <div><strong>España</strong><span>Entrega en toda la península</span></div>
    </div>
  </div>
  <div class="wrap">
    <form class="search" id="search" role="search">
      <div class="panel">
        <div class="field"><label for="q">Marca o modelo</label><input id="q" type="search" placeholder="Ej. León, Clio, Mercedes…"></div>
        <div class="field"><label for="pmax">Precio máx.</label><select id="pmax"><option value="">Cualquiera</option><option value="8000">8.000 €</option><option value="10000">10.000 €</option><option value="12000">12.000 €</option><option value="16000">16.000 €</option></select></div>
        <div class="field"><label for="fuel">Combustible</label><select id="fuel"><option value="">Todos</option>${options(cars.map(c => c.combustible))}</select></div>
        <div class="field"><label for="body">Carrocería</label><select id="body"><option value="">Todas</option>${options(cars.map(c => c.carroceria))}</select></div>
        <div class="field"><label for="sort">Ordenar</label><select id="sort"><option value="rel">Destacados</option><option value="pa">Precio ↑</option><option value="pd">Precio ↓</option><option value="km">Menos km</option><option value="yr">Más nuevo</option></select></div>
        <button class="btn btn-signal" type="submit">Buscar</button>
      </div>
    </form>
  </div>
</div>
<div class="hero-spacer" aria-hidden="true"></div>

<section id="stock">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow">Stock actual</p><h2>Coches de ocasión</h2></div>
      <div class="toolbar">
        <div class="chips" role="group" aria-label="Filtros rápidos">
          <button class="chip" type="button" data-chip="auto" aria-pressed="false">Automático</button>
          <button class="chip" type="button" data-chip="eco" aria-pressed="false">Etiqueta ECO</button>
          <button class="chip" type="button" data-chip="k10" aria-pressed="false">Menos de 10.000 €</button>
        </div>
        <span class="count mono" id="count">${n} coches</span>
      </div>
    </div>
    <div class="grid" id="grid">${cars.map(card).join("\n")}
      <div class="empty" id="empty" hidden>No hay coches con esos filtros.<br><a href="${wa("Hola, busco un coche que no está en la web. Te cuento:")}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a> y te avisamos cuando entre uno.</div>
    </div>
  </div>
</section>

<div class="trust">
  <div class="wrap">
    <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg><p style="margin:0"><b>Revisión mecánica</b><span>Cada coche pasa por taller antes de la venta.</span></p></div>
    <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><p style="margin:0"><b>Papeles incluidos</b><span>Transferencia e informe DGT con nuestra gestoría.</span></p></div>
    <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h13M12 7l5 5-5 5"/><path d="M20 4v16"/></svg><p style="margin:0"><b>Aceptamos tu coche</b><span>Como parte del pago, con tasación sin compromiso.</span></p></div>
    <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="13" height="9" rx="1"/><path d="M15 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg><p style="margin:0"><b>Entrega en toda España</b><span>Traslado con grúa propia hasta tu puerta.</span></p></div>
  </div>
</div>

<section>
  <div class="wrap two">
    <form class="box dark" id="tasacion">
      <p class="eyebrow" style="color:var(--signal)">Vende o cambia tu coche</p>
      <h3>Tasamos tu coche en 24 horas</h3>
      <p>Cuéntanos qué coche tienes y te enviamos una oferta por WhatsApp. Si te interesa uno de los nuestros, lo descontamos del precio.</p>
      <div class="form-grid">
        <div class="field"><label for="t-marca">Marca y modelo</label><input id="t-marca" required placeholder="Ej. Seat Ibiza 1.0 TSI"></div>
        <div class="field"><label for="t-year">Año</label><input id="t-year" inputmode="numeric" required placeholder="2017"></div>
        <div class="field"><label for="t-km">Kilómetros</label><input id="t-km" inputmode="numeric" required placeholder="95000"></div>
        <div class="field"><label for="t-tel">Tu teléfono</label><input id="t-tel" inputmode="tel" required placeholder="6XX XXX XXX"></div>
      </div>
      <button class="btn btn-signal" type="submit">Enviar por WhatsApp</button>
    </form>

    <div class="box" id="financiacion">
      <p class="eyebrow">Financiación</p>
      <h3>Calcula tu cuota</h3>
      <p>Elige un coche y el plazo. Te confirmamos la cuota final en el día.</p>
      <div class="form-grid">
        <div class="field full"><label for="f-car">Coche</label><select id="f-car">${cars.map(c => `<option value="${c.precio}" data-name="${esc(title(c))}">${esc(title(c))} · ${eur(c.precio)}</option>`).join("")}</select></div>
        <div class="field"><label for="f-entrada">Entrada: <span id="f-entrada-v" class="mono"></span></label><input id="f-entrada" type="range" min="0" max="50" step="5" value="${cfg.financiacion.entradaPct}"></div>
        <div class="field"><label for="f-meses">Plazo: <span id="f-meses-v" class="mono"></span></label><input id="f-meses" type="range" min="24" max="96" step="12" value="${cfg.financiacion.meses}"></div>
      </div>
      <div class="calc-out"><strong class="mono" id="f-cuota"></strong><span>€/mes</span></div>
      <p class="fine">Ejemplo orientativo con TIN ${(cfg.financiacion.tin * 100).toLocaleString("es-ES")} %. Sujeto a aprobación de la financiera.</p>
      <a class="btn btn-wa" id="f-wa" target="_blank" rel="noopener" href="${wa("Hola, quiero información sobre financiación")}">Pedir esta financiación</a>
    </div>
  </div>
</section>

<section id="servicios" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Más que un compraventa</p><h2>Servicios</h2></div></div>
    <div class="services">
      <div class="svc"><h3>Gestoría y tráfico</h3><p>Transferencias, informes DGT, duplicados, matriculaciones y bajas.</p></div>
      <div class="svc"><h3>Coches sin carnet</h3><p>Representantes oficiales de Aixam. Desde los 15 años con licencia AM.</p></div>
      <div class="svc"><h3>Grúa y traslados</h3><p>Llevamos tu coche a donde lo necesites, también entregas fuera de Cataluña.</p></div>
      <div class="svc"><h3>Rent a car</h3><p>Alquiler de vehículos por días o semanas.</p></div>
      <div class="svc"><h3>Compra de coches</h3><p>Pagamos al momento y nos encargamos de todo el papeleo.</p></div>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Dudas habituales</p><h2>Preguntas frecuentes</h2></div></div>
    <details><summary>¿Puedo comprar un coche sin ir a Esparreguera?</summary><p>Sí. Te enviamos vídeo y fotos del coche por WhatsApp, firmamos los papeles a distancia y lo entregamos en tu domicilio.</p></details>
    <details><summary>¿Los coches tienen garantía?</summary><p>Todos los coches se venden revisados y con la garantía legal de 12 meses para vehículos de ocasión vendidos por profesional.</p></details>
    <details><summary>¿Aceptáis mi coche como parte del pago?</summary><p>Sí. Lo tasamos sin compromiso y descontamos su valor del coche que te lleves.</p></details>
    <details><summary>¿Quién hace el cambio de nombre?</summary><p>Nuestra gestoría. La transferencia está incluida en el precio y te entregamos el permiso de circulación a tu nombre.</p></details>
  </div>
</section>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "AutoDealer", name: `${cfg.nombre} Esparreguera`,
    url: cfg.siteUrl, telephone: `+34${cfg.telefono}`, email: cfg.email, foundingDate: String(cfg.desde),
    address: { "@type": "PostalAddress", streetAddress: cfg.direccion || undefined, addressLocality: "Esparreguera", addressRegion: "Barcelona", addressCountry: "ES" },
    sameAs: [`https://www.instagram.com/${cfg.instagram}/`],
  };
  return layout({
    pageTitle: "Coches de segunda mano en Esparreguera | Multiservice Car",
    description: `${n} coches de ocasión revisados, con transferencia incluida, financiación y entrega en toda España. Gestoría propia desde ${cfg.desde}.`,
    path: "/", body, jsonld, image: cars.find(c => c.fotos[0])?.fotos[0],
  });
}

function carPage(c) {
  const main = c.fotos[0] ? `<img id="g-main" src="${esc(c.fotos[0])}" alt="${esc(`${title(c)} ${c.year}`)}">` : SIL[c.sil];
  const thumbs = c.fotos.length > 1 ? `<div class="thumbs">${c.fotos.map((f, i) => `<button type="button" data-src="${esc(f)}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : "";
  const row = (k, v) => v == null || v === "" ? "" : `<tr><td>${k}</td><td>${esc(v)}</td></tr>`;
  const body = `<div class="wrap">
  <p class="crumbs"><a href="/">Inicio</a> / <a href="/#stock">Coches</a> / ${esc(title(c))}</p>
  <div class="detail">
    <div class="gallery">
      <div class="main">${main}${dgt(c.etiqueta)}${c.estado === "reservado" ? '<span class="tag-res">Reservado</span>' : ""}</div>
      ${thumbs}
      ${c.descripcion ? `<h2 style="font-size:1.4rem;margin-top:18px">Equipamiento y estado</h2><p class="desc">${esc(c.descripcion)}</p>` : ""}
    </div>
    <aside class="side">
      <div class="box">
        <p class="eyebrow">${esc(c.carroceria)} · ${c.year ?? ""}</p>
        <h1>${esc(title(c))}</h1>
        <div class="ver" style="color:var(--muted)">${esc(c.version)}</div>
        <div class="price-row" style="border-top:0;padding-top:0"><div class="price mono" style="font-size:2.2rem">${eur(c.precio)}</div><div class="cuota">o desde <b>${cuota(c.precio)} €</b>/mes</div></div>
        <table>
          ${row("Año", c.year)}${row("Kilómetros", kmf(c.km))}${row("Combustible", c.combustible)}${row("Cambio", c.cambio)}${row("Potencia", c.cv ? `${c.cv} cv` : "")}${row("Etiqueta DGT", c.etiqueta || "Consultar")}${row("Transferencia", "Incluida")}
        </table>
        <a class="btn btn-wa" href="${waCar(c)}" target="_blank" rel="noopener">${WA_ICON}Preguntar por WhatsApp</a>
        <a class="btn btn-line" href="${wa(`Hola, quiero probar el ${title(c)} (${c.year}). ¿Qué día puedo pasar?`)}" target="_blank" rel="noopener">Reservar prueba</a>
        <a class="btn btn-line" href="/#tasacion">Entregar mi coche como parte del pago</a>
      </div>
    </aside>
  </div>
</div>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "Car", name: `${title(c)} ${c.version}`, brand: { "@type": "Brand", name: c.marca },
    model: c.modelo, vehicleModelDate: String(c.year ?? ""), fuelType: c.combustible, vehicleTransmission: c.cambio, bodyType: c.carroceria,
    mileageFromOdometer: c.km != null ? { "@type": "QuantitativeValue", value: c.km, unitCode: "KMT" } : undefined,
    image: c.fotos.map(f => f.startsWith("/") ? cfg.siteUrl + f : f),
    offers: { "@type": "Offer", price: c.precio, priceCurrency: "EUR", itemCondition: "https://schema.org/UsedCondition",
      availability: c.estado === "reservado" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock" },
  };
  return layout({
    pageTitle: `${title(c)} ${c.version} ${c.year ?? ""} de segunda mano · ${eur(c.precio)} | Multiservice Car`,
    description: `${title(c)} ${c.version}, ${c.year}, ${kmf(c.km)}, ${c.combustible}, ${c.cambio}. ${eur(c.precio)} o desde ${cuota(c.precio)} €/mes. Transferencia incluida.`,
    path: `/coches/${c.id}/`, body, jsonld, image: c.fotos[0],
  });
}

// ---------- Build ----------
const cars = await loadCars();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await localizePhotos(cars);
await writeFile(`${DIST}/index.html`, homePage(cars));
for (const c of cars) {
  await mkdir(`${DIST}/coches/${c.id}`, { recursive: true });
  await writeFile(`${DIST}/coches/${c.id}/index.html`, carPage(c));
}
await copyFile("src/styles.css", `${DIST}/styles.css`);
await copyFile("src/app.js", `${DIST}/app.js`);
const today = new Date().toISOString().slice(0, 10);
await writeFile(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["/", ...cars.map(c => `/coches/${c.id}/`)].map(p => `<url><loc>${cfg.siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`);
await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
console.log(`Web generada en ${DIST}/ con ${cars.length} coches`);
