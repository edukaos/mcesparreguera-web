// Genera la web estática en dist/ a partir de la Google Sheet (o de data/coches.csv si no hay enlace).
// Uso: node build.mjs   (Node 18+, sin dependencias)
import { mkdir, writeFile, readFile, copyFile, rm, readdir, cp, access } from "node:fs/promises";
import { createHash, createSign } from "node:crypto";
import cfg from "./config.mjs";
import { homePage, carPage, redirectPage, notFoundPage } from "./src/templates.mjs";

const DIST = "dist";
// Ruta base cuando la web vive en una subcarpeta (p. ej. GitHub Pages sin dominio propio: /mcesparreguera-web).
const BASE = (process.env.BASE_PATH || "").replace(/\/$/, "");
const withBase = html => html.replace(/(href|src|srcset|data-src)="\/(?!\/)/g, `$1="${BASE}/`).replace(/&quot;\/(?!\/)/g, `&quot;${BASE}/`)
  .replace(/(\d+w), \/(?!\/)/g, `$1, ${BASE}/`).replace(/url\(fonts\//g, `url(${BASE}/fonts/`);

// ---------- Datos ----------
function parseCsv(text) {
  return toObjects(csvRows(text));
}

function csvRows(text) {
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
  return rows;
}

// Filas (la primera es la cabecera) -> objetos { columna: valor }
function toObjects(rows) {
  const [head, ...body] = rows.map(r => r.map(c => String(c ?? ""))).filter(r => r.some(c => c.trim()));
  const keys = head.map(h => h.trim().toLowerCase());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = s => { const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")); return s && !isNaN(n) ? n : null; };

// Acepta enlaces de Google Drive ("compartir") de una foto o de una carpeta, o URLs directas a imágenes.
const DRIVE_FOLDER = "drive-carpeta:";
function photoUrl(u) {
  const f = u.match(/\/folders\/([\w-]{20,})/) || u.match(/folderview\?id=([\w-]{20,})/);
  if (f) return DRIVE_FOLDER + f[1];
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
    equipamiento: r.equipamiento || "",
    comentarios: r.comentarios || r.comentario || "",
    fichaAntigua: r.ficha_antigua || "",
  };
  car.sil = SIL_BY_BODY[car.carroceria.toLowerCase()] || "berlina";
  return car;
}

// Hoja privada: se lee con la API de Google Sheets usando la cuenta de servicio (secreto GOOGLE_SA_KEY, la clave JSON).
async function sheetRowsWithServiceAccount(keyJson) {
  const key = JSON.parse(keyJson);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: key.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url")}`;
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!tok.ok) throw new Error(`Google rechazó la clave de la cuenta de servicio (${tok.status}): ${await tok.text()}`);
  const { access_token } = await tok.json();
  // Sin nombre de pestaña, Google usa la primera pestaña de la hoja.
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values/A1:ZZ`, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (res.status === 403) throw new Error(`Sin permiso: comparte la hoja con ${key.client_email} (Lector) y activa la Google Sheets API`);
  if (!res.ok) throw new Error(`No se pudo leer la hoja (${res.status}): ${await res.text()}`);
  return (await res.json()).values || [];
}

async function loadCars() {
  let text, rows;
  if (process.env.GOOGLE_SA_KEY) {
    rows = await sheetRowsWithServiceAccount(process.env.GOOGLE_SA_KEY);
    console.log("Coches leídos de la Google Sheet (privada, cuenta de servicio)");
  } else if (/^https?:/.test(cfg.sheetCsvUrl)) {
    const res = await fetch(cfg.sheetCsvUrl);
    if (res.status === 401 || res.status === 403) throw new Error("La hoja no es pública: en Google Sheets, Compartir > Cualquier persona con el enlace > Lector");
    if (!res.ok) throw new Error(`No se pudo leer la hoja (${res.status})`);
    text = await res.text();
    if (/^ERROR/.test(text)) throw new Error(`El script de la hoja respondió: ${text.slice(0, 200)}`);
    if (/<html/i.test(text.slice(0, 500))) throw new Error("La hoja no es pública: compártela con \"cualquiera con el enlace\", o revisa el enlace del script (secreto SHEET_CSV_URL)");
    console.log("Coches leídos de la Google Sheet");
  } else {
    const file = cfg.sheetCsvUrl || "data/coches.csv";
    text = await readFile(file, "utf8");
    console.log(`Usando el archivo local ${file}`);
  }
  const all = (rows ? toObjects(rows) : parseCsv(text)).filter(r => r.marca && r.modelo).map(normalize);
  // Si la hoja no trae equipamiento o comentarios, usa los copiados de la web antigua (data/textos-antiguos.csv)
  const antiguos = await readFile("data/textos-antiguos.csv", "utf8").then(parseCsv, () => []);
  for (const c of all) {
    const t = antiguos.find(a => a.id === c.id);
    if (t) { c.equipamiento ||= t.equipamiento; c.comentarios ||= t.comentarios; }
  }
  const cars = all.filter(c => c.estado !== "vendido" && c.precio);
  cars.sort((a, b) => (b.destacado - a.destacado) || (a.estado === "reservado") - (b.estado === "reservado"));
  return { cars, vendidos: all.filter(c => c.estado === "vendido") };
}

// Lee una carpeta pública de Drive con su vista incrustada, que no necesita clave ni cuenta de Google.
// Devuelve sus fotos y subcarpetas ordenadas por nombre (01, 02, ... la primera foto es la portada).
async function driveFolder(id) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`);
  if (!res.ok) throw new Error(`${res.status}`);
  const entries = [...(await res.text()).matchAll(/<a href="https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([\w-]+)[^"]*"[^>]*>[\s\S]*?flip-entry-title">([^<]*)</g)]
    .map(([, kind, id, name]) => ({ folder: kind !== "file/d", id, name: name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  return {
    fotos: entries.filter(e => !e.folder && !/\.(mp4|mov|avi|pdf|docx?|txt)$/i.test(e.name))
      .map(e => `https://drive.google.com/thumbnail?id=${e.id}&sz=w1600`),
    carpetas: entries.filter(e => e.folder),
  };
}

// Fotos de Drive: la carpeta enlazada en la columna fotos, o si no, la subcarpeta de la carpeta madre
// (cfg.carpetaFotos) que se llame como el id del coche ("seat-leon-2018" o "SEAT León 2018").
async function expandDriveFolders(cars) {
  let madre = [];
  const madreId = (cfg.carpetaFotos || "").match(/([\w-]{20,})/)?.[1];
  if (madreId) {
    try {
      madre = (await driveFolder(madreId)).carpetas;
      if (!madre.length) throw new Error("sin subcarpetas o no pública");
      console.log(`Carpeta madre de Drive: ${madre.length} carpetas`);
    } catch (e) {
      console.warn(`Carpeta madre de Drive no leída: compártela con "cualquier persona con el enlace" (${e.message})`);
    }
  }
  for (const c of cars) {
    if (!c.fotos.length) {
      const sub = madre.find(f => slug(f.name) === c.id);
      if (sub) c.fotos = [DRIVE_FOLDER + sub.id];
    }
    const out = [];
    for (const u of c.fotos) {
      if (!u.startsWith(DRIVE_FOLDER)) { out.push(u); continue; }
      try {
        const { fotos } = await driveFolder(u.slice(DRIVE_FOLDER.length));
        if (!fotos.length) throw new Error("vacía o no pública");
        out.push(...fotos);
        console.log(`Carpeta de Drive (${c.id}): ${fotos.length} fotos`);
      } catch (e) {
        console.warn(`Carpeta de Drive no leída (${c.id}): compártela con "cualquier persona con el enlace" (${e.message})`);
      }
    }
    c.fotos = out;
  }
}

// Descarga las fotos a dist/fotos para no depender de Drive al navegar. Si falla, usa la URL original.
async function localizePhotos(cars) {
  await mkdir(`${DIST}/fotos`, { recursive: true });
  await mkdir(".cache/drive", { recursive: true });
  for (const c of cars) {
    c.fotos = await Promise.all(c.fotos.map(async (u, i) => {
      const hash = createHash("md5").update(u).digest("hex").slice(0, 6), name = `${c.id}-${i + 1}-${hash}`;
      // Las fotos de Drive se guardan en .cache/drive para no descargarlas otra vez cada hora.
      const cached = u.startsWith("https://drive.google.com/thumbnail") && `.cache/drive/${hash}`;
      try {
        if (cached) try { await copyFile(cached, `${DIST}/fotos/${name}.jpg`); return `/fotos/${name}.jpg`; } catch {}
        const res = await fetch(u, { redirect: "follow" });
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.startsWith("image/")) throw new Error(type);
        const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(`${DIST}/fotos/${name}.${ext}`, buf);
        if (cached) await writeFile(cached, buf);
        return `/fotos/${name}.${ext}`;
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

// Versiones WebP de cada foto (320–1600 px) para que el móvil no descargue la foto grande.
// Usa sharp si está instalado (npm install); si no, sirve la foto original. Caché en .cache/img entre builds.
const WIDTHS = [320, 640, 800, 1024, 1600];
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { console.warn("sharp no está instalado: fotos sin optimizar"); }

async function optimizePhotos(cars) {
  await mkdir(".cache/img", { recursive: true });
  for (const c of cars) {
    c.img = await Promise.all(c.fotos.map(async u => {
      if (!sharp || !u.startsWith("/")) return { src: u };
      try {
        const buf = await readFile(DIST + u);
        const meta = await sharp(buf).metadata();
        const [w, h] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
        const hash = createHash("md5").update(buf).digest("hex").slice(0, 10);
        const sizes = WIDTHS.filter(x => x < w).concat(Math.min(w, 1600));
        const files = await Promise.all(sizes.map(async x => {
          const out = u.replace(/\.\w+$/, `-${x}.webp`), cached = `.cache/img/${hash}-${x}.webp`;
          try { await access(cached); } catch {
            await writeFile(cached, await sharp(buf).rotate().resize({ width: x }).webp({ quality: 72 }).toBuffer());
          }
          await copyFile(cached, DIST + out);
          return `${out} ${x}w`;
        }));
        return { src: files.at(-1).split(" ")[0], srcset: files.join(", "), w, h, orig: u };
      } catch (e) {
        console.warn(`Foto sin optimizar (${c.id}): ${u}`);
        return { src: u };
      }
    }));
  }
}

const xmlEsc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));
const page = async (path, html) => {
  await mkdir(`${DIST}${path}`, { recursive: true });
  await writeFile(`${DIST}${path}index.html`, html);
};

// ---------- Build ----------
const { cars, vendidos } = await loadCars();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await expandDriveFolders(cars);
await localizePhotos(cars);
await repoPhotos(cars);
await optimizePhotos(cars);
// El CSS va dentro de cada página: es pequeño y así no bloquea el primer pintado.
const css = (await readFile("src/styles.css", "utf8")).replace(/\n\s*/g, "\n");
const finish = html => withBase(html.replace('<link rel="stylesheet" href="/styles.css">', `<style>${css}</style>`));
await page("/", finish(homePage(cars)));
for (const c of cars) await page(`/coches/${c.id}/`, finish(carPage(c, cars)));
await writeFile(`${DIST}/404.html`, finish(notFoundPage(cars)));

// Redirecciones: /coches/ y las fichas de la web antigua (columna ficha_antigua) apuntan a la nueva URL,
// y los coches vendidos llevan al stock. Así no se pierde lo que Google ya tenía indexado.
const redirects = new Map([["/coches/", "/#stock"], ...Object.entries(cfg.redirecciones || {})]);
for (const c of cars) {
  const old = c.fichaAntigua && new URL(c.fichaAntigua, "https://x").pathname.replace(/\/?$/, "/");
  if (old && old !== `/coches/${c.id}/`) redirects.set(old, `/coches/${c.id}/`);
}
for (const c of vendidos) {
  redirects.set(`/coches/${c.id}/`, "/#stock");
  const old = c.fichaAntigua && new URL(c.fichaAntigua, "https://x").pathname.replace(/\/?$/, "/");
  if (old) redirects.set(old, "/#stock");
}
for (const [from, to] of redirects) if (from !== "/") await page(from, redirectPage(to, BASE));

await copyFile("src/app.js", `${DIST}/app.js`);
await cp("src/img", `${DIST}/img`, { recursive: true });
await cp("src/fonts", `${DIST}/fonts`, { recursive: true });
await copyFile("src/favicon.ico", `${DIST}/favicon.ico`);
await writeFile(`${DIST}/site.webmanifest`, JSON.stringify({
  name: `${cfg.nombre} Esparreguera`, short_name: cfg.nombre, lang: "es", start_url: "./", scope: "./", display: "standalone",
  background_color: "#f3f5f7", theme_color: "#2f3c45",
  icons: [
    { src: "img/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "img/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "img/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 1));

const today = new Date().toISOString().slice(0, 10);
const urls = [{ path: "/", imgs: [] }, ...cars.map(c => ({ path: `/coches/${c.id}/`, imgs: c.img.map(i => i.orig || i.src) }))];
await writeFile(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `<url><loc>${cfg.siteUrl}${u.path}</loc><lastmod>${today}</lastmod>${u.imgs.map(i => `<image:image><image:loc>${xmlEsc(i.startsWith("/") ? cfg.siteUrl + i : i)}</image:loc></image:image>`).join("")}</url>`).join("\n")}
</urlset>
`);
await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
console.log(`Web generada en ${DIST}/ con ${cars.length} coches y ${redirects.size} redirecciones`);
