// Copia el equipamiento y el comentario de cada coche desde su ficha en la web antigua (columna ficha_antigua de data/coches.csv)
// a data/textos-antiguos.csv. La web los usa cuando las columnas equipamiento/comentarios de la hoja están vacías.
// Uso: node tools/importar-textos.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const csv = await readFile("data/coches.csv", "utf8");
const [head, ...rows] = csv.trim().split(/\r?\n/).map(l => l.split(","));
const col = k => head.indexOf(k);
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" };

const decode = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;|&rsquo;/g, "’")
  .replace(/&hellip;|&#8230;/g, "…").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = html => decode(html.replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, ""))
  .split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
// Texto entre el encabezado que contiene `titulo` y el encabezado siguiente
function seccion(html, titulo) {
  const m = html.match(new RegExp(`<h[1-6][^>]*>(?:(?!</h[1-6]>)[\\s\\S])*?${titulo}(?:(?!</h[1-6]>)[\\s\\S])*</h[1-6]>([\\s\\S]*?)(?=<h[1-6]|<footer|<aside)`, "i"));
  if (m && process.env.CRUDO) mkdir("data/crudo", { recursive: true }).then(() => writeFile(`data/crudo/${titulo}-${Date.now()}.html`, m[1]));
  return m ? text(m[1]) : "";
}
const q = s => `"${s.replace(/"/g, '""')}"`;

const out = ["id,equipamiento,comentarios"];
for (const r of rows) {
  const id = r[col("id")], url = r[r.length - 1]?.replace(/\/?$/, "/");
  if (!url?.startsWith("http")) continue;
  try {
    const res = await fetch(url, { headers: UA });
    const html = await res.text();
    const equip = seccion(html, "Equipamiento"), com = seccion(html, "Comentario");
    console.log(`${id}: ${res.status} · equipamiento ${equip.length} caracteres · comentario ${com.length}`);
    if (!equip && !com) console.log(html.slice(html.search(/Equipamiento/i) - 300, html.search(/Equipamiento/i) + 1500));
    out.push([id, equip.replace(/\n/g, ", "), com].map(q).join(","));
  } catch (e) { console.warn(`${id}: ${e.message}`); }
}
await writeFile("data/textos-antiguos.csv", out.join("\n") + "\n");
