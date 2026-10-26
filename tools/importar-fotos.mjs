// Descarga las fotos de cada coche desde su ficha en la web antigua (columna ficha_antigua de data/coches.csv)
// y las guarda en fotos/<id>/01.jpg, 02.jpg… Uso: node tools/importar-fotos.mjs  (SOLO=<id> para un solo coche)
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";

const csv = await readFile("data/coches.csv", "utf8");
const [head, ...rows] = csv.trim().split(/\r?\n/).map(l => l.split(","));
const col = k => head.indexOf(k);
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };

for (const r of rows) {
  const id = r[col("id")], url = r[r.length - 1]?.replace(/\/?$/, "/"); // WordPress da 404 sin la barra final en algunas fichas
  if (!url?.startsWith("http") || (process.env.SOLO && id !== process.env.SOLO)) continue;
  // La galería (NextGEN) solo pinta unas pocas fotos por página: recorremos también
  // sus páginas de imagen (/nggallery/image/…) y de paginación (/nggallery/page/N)
  const found = [], visited = new Set(), queue = [url];
  while (queue.length && visited.size < 80) {
    const u = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);
    let html = "";
    try {
      const res = await fetch(u, { headers: UA });
      html = await res.text();
      if (process.env.SOLO) console.log(`${u}: ${res.status}, ${html.length} caracteres, ${(html.match(/wp-content[^"'\s)]+\.(?:jpe?g|png|webp)/gi) || []).slice(0, 5).join(" ")}`);
    } catch (e) { console.warn(`${u}: ${e.message}`); continue; }
    found.push(...[...html.matchAll(/https?:\/\/[^"'\s)]+?\/wp-content\/(?:uploads|smush-webp|gallery)\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi)].map(m => m[0]));
    // Los enlaces del navegador de imágenes van entre comillas simples y a veces son relativos
    for (const m of html.matchAll(/nggallery\/(image|page)\/([^"'\s\/<>]+)/gi)) {
      const next = `${url.replace(/\/$/, "")}/nggallery/${m[1]}/${m[2]}/`;
      if (!visited.has(next)) queue.push(next);
    }
  }
  // Quita logos/favicons y versiones reducidas (-400x250) para quedarnos con el original
  const base = u => u.split("?")[0].replace("/smush-webp/", "/uploads/").replace(/\/thumbs\/thumbs[-_]/, "/").replace(/\.(jpe?g|png)\.webp$/i, ".$1").replace(/-\d+x\d+(?=\.\w+$)/, "");
  const urls = [...new Set(found.map(base))].filter(u => !/logo|favicon|icon|cropped|patrocin|colabor/i.test(u));
  // Primero la portada (uploads), después la galería en orden
  urls.sort((a, b) => (a.includes("/gallery/") - b.includes("/gallery/")) || a.localeCompare(b, "es", { numeric: true }));
  await rm(`fotos/${id}`, { recursive: true, force: true });
  await mkdir(`fotos/${id}`, { recursive: true });
  let n = 0;
  const seen = new Set();
  for (const u of urls) {
    const res = await fetch(u, { headers: UA });
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) continue; // descarta miniaturas e iconos
    const h = createHash("md5").update(buf).digest("hex");
    if (seen.has(h)) continue;
    seen.add(h);
    n++;
    await writeFile(`fotos/${id}/${String(n).padStart(2, "0")}.jpg`, buf);
  }
  console.log(`${id}: ${n} fotos de ${urls.length} enlaces (${visited.size} páginas)`);
}
