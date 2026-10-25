// Descarga las fotos de cada coche desde su ficha en la web antigua (columna ficha_antigua de data/coches.csv)
// y las guarda en fotos/<id>/01.jpg, 02.jpg… Uso: node tools/importar-fotos.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const csv = await readFile("data/coches.csv", "utf8");
const [head, ...rows] = csv.trim().split(/\r?\n/).map(l => l.split(","));
const col = k => head.indexOf(k);
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };

for (const r of rows) {
  const id = r[col("id")], url = r[r.length - 1];
  if (!url?.startsWith("http")) continue;
  const html = await (await fetch(url, { headers: UA })).text();
  const found = [...html.matchAll(/https?:\/\/[^"'\s)]+?\/wp-content\/(?:uploads|smush-webp)\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi)].map(m => m[0]);
  // Quita logos/favicons y versiones reducidas (-400x250) para quedarnos con el original
  const base = u => u.replace("/smush-webp/", "/uploads/").replace(/\.(jpe?g|png)\.webp$/i, ".$1").replace(/-\d+x\d+(?=\.\w+$)/, "");
  const urls = [...new Set(found.map(base))].filter(u => !/logo|favicon|icon|cropped|patrocin|colabor/i.test(u));
  await mkdir(`fotos/${id}`, { recursive: true });
  let n = 0;
  for (const u of urls) {
    const res = await fetch(u, { headers: UA });
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) continue; // descarta miniaturas e iconos
    n++;
    await writeFile(`fotos/${id}/${String(n).padStart(2, "0")}.jpg`, buf);
  }
  console.log(`${id}: ${n} fotos de ${urls.length} enlaces`);
}
