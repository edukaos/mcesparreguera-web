// Genera la web estática en dist/ a partir de la Google Sheet (o de data/coches.csv si no hay enlace).
// Uso: node build.mjs   (Node 18+, sin dependencias)
import { mkdir, writeFile, readFile, copyFile, rm, readdir, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import cfg from "./config.mjs";
import { homePage, carPage } from "./src/templates.mjs";

const DIST = "dist";
// Ruta base cuando la web vive en una subcarpeta (p. ej. GitHub Pages sin dominio propio: /mcesparreguera-web).
const BASE = (process.env.BASE_PATH || "").replace(/\/$/, "");
const withBase = html => html.replace(/(href|src|data-src)="\/(?!\/)/g, `$1="${BASE}/`);

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
    if (res.status === 401 || res.status === 403) throw new Error("La hoja no es pública: en Google Sheets, Compartir > Cualquier persona con el enlace > Lector");
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

// Si la hoja no trae fotos, usa las de fotos/<id>/ del repositorio (importadas de la web antigua).
async function repoPhotos(cars) {
  for (const c of cars) {
    if (c.fotos.length) continue;
    try {
      const files = (await readdir(`fotos/${c.id}`)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
      if (files.length) {
        await cp(`fotos/${c.id}`, `${DIST}/fotos/${c.id}`, { recursive: true });
        c.fotos = files.map(f => `/fotos/${c.id}/${f}`);
      }
    } catch {}
  }
}

// ---------- Build ----------
const cars = await loadCars();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await localizePhotos(cars);
await repoPhotos(cars);
await writeFile(`${DIST}/index.html`, withBase(homePage(cars)));
for (const c of cars) {
  await mkdir(`${DIST}/coches/${c.id}`, { recursive: true });
  await writeFile(`${DIST}/coches/${c.id}/index.html`, withBase(carPage(c, cars)));
}
await copyFile("src/styles.css", `${DIST}/styles.css`);
await copyFile("src/app.js", `${DIST}/app.js`);
await cp("src/img", `${DIST}/img`, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
await writeFile(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["/", ...cars.map(c => `/coches/${c.id}/`)].map(p => `<url><loc>${cfg.siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`);
await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
console.log(`Web generada en ${DIST}/ con ${cars.length} coches`);
