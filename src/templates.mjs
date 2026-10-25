// Plantillas HTML de la web (diseño "Cercano"): portada y ficha de coche.
import cfg from "../config.mjs";
import { I } from "./icons.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
export const eur = n => n.toLocaleString("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }) + " €";
const kmf = n => n == null ? "Consultar" : n.toLocaleString("es-ES", { useGrouping: "always" }) + " km";
const phoneFmt = p => p.replace(/^34/, "").replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
const TEL = phoneFmt(cfg.telefono), WA_TXT = phoneFmt(cfg.whatsapp);
export const title = c => `${c.marca} ${c.modelo}`;
export function cuota(price, { tin, entradaPct, meses } = cfg.financiacion) {
  const capital = price * (1 - entradaPct / 100), r = tin / 12;
  return Math.round(capital * r / (1 - Math.pow(1 + r, -meses)));
}
const wa = text => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
const waCar = c => wa(`Hola, me interesa el ${title(c)} ${c.version} (${c.year}) de ${eur(c.precio)}. ¿Sigue disponible?`);
const tinTxt = (cfg.financiacion.tin * 100).toLocaleString("es-ES");
const years = new Date().getFullYear() - cfg.desde;

const SIL = {
  berlina: '<svg class="sil" viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M10 58c0-8 4-12 14-14l26-5 22-15c6-4 12-5 20-5h36c9 0 15 3 21 9l14 13 16 3c8 2 11 6 11 14v6H10Z"/><circle cx="50" cy="64" r="12"/><circle cx="154" cy="64" r="12"/></svg>',
  suv: '<svg class="sil" viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M10 60V44c0-5 3-8 9-9l24-4 18-15c4-3 8-4 14-4h70c7 0 11 2 15 7l12 16c10 1 18 5 18 14v11Z"/><circle cx="50" cy="64" r="13"/><circle cx="156" cy="64" r="13"/></svg>',
  van: '<svg class="sil" viewBox="0 0 200 80" fill="currentColor" aria-hidden="true"><path d="M8 62V30c0-10 6-18 16-18h116c8 0 13 3 17 9l15 18 14 3c4 1 6 4 6 8v12Z"/><circle cx="48" cy="64" r="12"/><circle cx="156" cy="64" r="12"/></svg>',
};
const silFor = c => ({ suv: "suv", furgoneta: "van", camper: "van" })[c.sil] || "berlina";
// Foto con srcset WebP y tamaño fijo (evita saltos de maquetación). im viene de build.mjs (c.img).
const SIZES = {
  card: "(max-width:640px) calc(100vw - 32px), (max-width:980px) 50vw, 400px",
  half: "(max-width:980px) calc(100vw - 32px), 620px",
  gal: "(max-width:980px) calc(100vw - 32px), 760px",
  thumb: "84px",
};
const imgTag = (im, alt, { sizes = SIZES.half, eager = false } = {}) => !im ? "" :
  `<img src="${esc(im.src)}"${im.srcset ? ` srcset="${esc(im.srcset)}" sizes="${sizes}"` : ""}${im.w ? ` width="${im.w}" height="${im.h}"` : ""} alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
const carAlt = c => `${title(c)} ${c.version}${c.year ? ` de ${c.year}` : ""} en venta en Esparreguera`;
const img0 = c => c.img?.[0] || (c.fotos[0] && { src: c.fotos[0] });
const pic = (c, eager, sizes = SIZES.card) => img0(c)
  ? imgTag(img0(c), carAlt(c), { eager, sizes })
  : `${SIL[silFor(c)]}<span class="soon">Foto próximamente</span>`;
const dgt = d => {
  const txt = { H: "HIST" }[d] || d || "¿?";
  const cls = ["C", "B", "ECO", "H"].includes(d) ? d : d === "0" ? "ECO" : "x";
  return `<span class="dgt ${cls}" title="Etiqueta DGT">${esc(txt)}</span>`;
};
// Grupo de tipo para los filtros de la portada
const tipo = c => /suv|todo/i.test(c.carroceria) ? "SUV" : /furgo|monovol|camper/i.test(c.carroceria) ? "Furgoneta" : "Berlina";

function card(c) {
  return `<article class="card" data-precio="${c.precio}" data-km="${c.km ?? ""}" data-year="${c.year ?? ""}" data-tipo="${tipo(c)}" data-marca="${esc(c.marca)}">
    <div class="ph">${pic(c)}<span class="pill">${c.year ?? ""}</span>${dgt(c.etiqueta)}${c.estado === "reservado" ? '<span class="soon" style="background:var(--acc);color:#fff;padding:4px 10px;border-radius:8px;z-index:1">Reservado</span>' : ""}</div>
    <div class="bd">
      <h3><a href="/coches/${c.id}/">${esc(title(c))}</a></h3><div class="v">${esc(c.version)}</div>
      <div class="facts"><span>${kmf(c.km)}</span><span>${esc(c.combustible)}</span><span>${esc(c.cambio)}</span></div>
      <div class="pr"><b>${eur(c.precio)}</b><span>o desde<br><strong>${cuota(c.precio)} €/mes</strong></span></div>
      <div class="act"><a class="btn o sm" href="/coches/${c.id}/">Ver coche</a><a class="btn a sm" href="${waCar(c)}" target="_blank" rel="noopener">Lo quiero ver</a></div>
    </div></article>`;
}

const abs = u => u && (u.startsWith("/") ? cfg.siteUrl + u : u);
// JSON-LD seguro dentro de <script> (un "</script>" en una descripción no rompe la página)
const ld = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const BIZ_ID = `${cfg.siteUrl}/#negocio`;
const address = { "@type": "PostalAddress", streetAddress: cfg.direccion || undefined, addressLocality: "Esparreguera", addressRegion: "Barcelona", postalCode: cfg.cp || undefined, addressCountry: "ES" };
const business = cars => ({
  "@type": "AutoDealer", "@id": BIZ_ID, name: `${cfg.nombre} Esparreguera`, alternateName: "MC Esparreguera",
  description: `Compraventa de coches de ocasión en Esparreguera desde ${cfg.desde}. Gestoría propia, grúa, rent a car y representante oficial de Aixam.`,
  url: `${cfg.siteUrl}/`, logo: `${cfg.siteUrl}/img/icon-512.png`, image: abs(cars.find(c => c.fotos[0])?.img?.[0]?.orig || cars.find(c => c.fotos[0])?.fotos[0]) || `${cfg.siteUrl}/img/logo.png`,
  telephone: `+34${cfg.telefono}`, email: cfg.email, foundingDate: String(cfg.desde), address,
  areaServed: [{ "@type": "City", name: "Esparreguera" }, { "@type": "AdministrativeArea", name: "Baix Llobregat" }, { "@type": "Country", name: "España" }],
  priceRange: cars.length ? `${eur(Math.min(...cars.map(c => c.precio)))} - ${eur(Math.max(...cars.map(c => c.precio)))}` : undefined,
  currenciesAccepted: "EUR", paymentAccepted: "Efectivo, transferencia, financiación",
  openingHoursSpecification: cfg.horarioSchema?.length ? cfg.horarioSchema.map(([days, opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes })) : undefined,
  contactPoint: { "@type": "ContactPoint", telephone: `+34${cfg.whatsapp.replace(/^34/, "")}`, contactType: "sales", availableLanguage: ["es", "ca"] },
  knowsAbout: ["Coches de segunda mano", "Coches sin carnet Aixam", "Gestoría de tráfico", "Grúa", "Alquiler de coches"],
  sameAs: [`https://www.instagram.com/${cfg.instagram}/`],
});

function layout({ pageTitle, description, path, body, jsonld, image, ogType = "website", extraHead = "" }) {
  const url = cfg.siteUrl + path;
  const ogImg = image && (image.orig || image.src);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#2f3c45">
<meta name="geo.region" content="ES-CT">
<meta name="geo.placename" content="Esparreguera">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(cfg.nombre)} Esparreguera">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
${ogImg ? `<meta property="og:image" content="${esc(abs(ogImg))}">${image.w ? `\n<meta property="og:image:width" content="${image.w}">\n<meta property="og:image:height" content="${image.h}">` : ""}\n<meta property="og:image:alt" content="${esc(image.alt || pageTitle)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(description)}">
${ogImg ? `<meta name="twitter:image" content="${esc(abs(ogImg))}">` : ""}
${extraHead}
<link rel="icon" href="/favicon.ico" sizes="32x32 48x48">
<link rel="icon" href="/img/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/nunito-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
${ld(jsonld)}
</head>
<body>
<div class="util g"><div class="in">
  <span><i class="dot"></i><b>Transferencia incluida</b>&nbsp;en todos los coches</span>
  <span class="hide-s">Entrega en toda España · Representante oficial Aixam</span>
  <span>Llámanos: <a href="tel:+34${cfg.telefono}"><b>${TEL}</b></a></span>
</div></div>
<header class="top g"><div class="in">
  <a class="brand" href="/"><img src="/img/logo-272.png" alt="${esc(cfg.nombre)}" width="136" height="50"><small class="since">Esparreguera<br>desde ${cfg.desde}</small></a>
  <nav class="main" aria-label="Principal"><a href="/#stock">Coches</a><a href="/#vender">Vender mi coche</a><a href="/#financiacion">Financiación</a><a href="/#servicios">Servicios</a><a href="/#contacto">Contacto</a></nav>
  <a class="btn w sm" href="${wa("Hola, vengo de la web")}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">${I.wa}<span>Escríbenos</span></a>
</div></header>
<main>
${body}
</main>
<footer class="g"><div class="in">
  <div><b>${esc(cfg.nombre)}</b><p>Compraventa de coches de ocasión en Esparreguera desde ${cfg.desde}. Gestoría propia, grúa, rent a car y representante oficial de Aixam.</p></div>
  <div><b>Coches</b><a href="/#stock">${I.car}Coches en venta</a><a href="/#vender">${I.tag}Vender mi coche</a><a href="/#financiacion">${I.euro}Financiación</a><a href="/#servicios">${I.wrench}Servicios</a></div>
  <div><b>Contacto</b><a href="${wa("Hola")}" target="_blank" rel="noopener">${I.wa}WhatsApp ${WA_TXT}</a><a href="tel:+34${cfg.telefono}">${I.phone}Teléfono ${TEL}</a><a href="mailto:${cfg.email}">${I.mail}${cfg.email}</a><a href="https://www.instagram.com/${cfg.instagram}/" target="_blank" rel="noopener">${I.ig}@${cfg.instagram}</a><a href="/#contacto">${I.pin}Esparreguera, Barcelona</a></div>
  <div class="bottom">© ${new Date().getFullYear()} ${esc(cfg.nombre)} Esparreguera</div>
</div></footer>
<div class="mbar"><a class="btn o sm" href="tel:+34${cfg.telefono}">${I.phone}${TEL}</a><a class="btn w sm" href="${wa("Hola, vengo de la web")}" target="_blank" rel="noopener">${I.wa}WhatsApp</a></div>
<script src="/app.js" defer></script>
</body>
</html>`;
}

export function homePage(cars) {
  const withPhoto = cars.filter(c => c.fotos[0]);
  const heroCar = cars.find(c => c.id === cfg.portada) || withPhoto.find(c => /camper/i.test(c.carroceria)) || withPhoto[0] || cars[0];
  const nuevo = cars.find(c => c.destacado && c.fotos[0] && c !== heroCar) || withPhoto.find(c => c !== heroCar);
  const star = cars.find(c => c.id === cfg.joya) || [...withPhoto].sort((a, b) => b.precio - a.precio)[0];
  const sellCar = withPhoto.find(c => c !== heroCar && c !== star && c !== nuevo) || heroCar;
  const brands = [...new Set(cars.map(c => c.marca))];
  const tipos = new Set(cars.map(tipo));

  const body = `
<section class="hero g" id="inicio"><div class="in">
  <div>
    <p class="eyebrow">Coches de ocasión en Esparreguera</p>
    <h1 style="margin-top:16px">Encuentra tu coche. <em>Los papeles<svg viewBox="0 0 200 20" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" aria-hidden="true"><path d="M4 14C50 6 120 4 196 10"/></svg></em> los hacemos nosotros.</h1>
    <p class="lead">Somos un negocio familiar al pie de Montserrat. Revisamos cada coche, te lo dejamos probar sin prisa y te lo entregamos con la transferencia hecha.</p>
    <form class="finder" id="finder">
      <div class="f"><label for="fb">Tipo de coche</label><select id="fb"><option value="">Todos</option><option value="Berlina">Turismo</option>${tipos.has("SUV") ? '<option value="SUV">SUV</option>' : ""}${tipos.has("Furgoneta") ? '<option value="Furgoneta">Furgoneta y camper</option>' : ""}</select></div>
      <div class="f"><label for="fp">Presupuesto</label><select id="fp"><option value="">Cualquiera</option><option value="0-8000">Hasta 8.000 €</option><option value="8000-10000">8.000 a 10.000 €</option><option value="10000-999999">Más de 10.000 €</option></select></div>
      <button class="btn a" type="submit">Ver coches</button>
    </form>
    <div class="mini"><span>${I.shield}Revisados en taller</span><span>${I.doc}Garantía 12 meses</span><span>${I.truck}Entrega en toda España</span></div>
  </div>
  <div class="visual">
    <div class="blob"></div>
    <div class="main">${imgTag(img0(heroCar), carAlt(heroCar), { eager: true, sizes: SIZES.half })}</div>
    <div class="year-badge"><span><b>+${years}</b>años<br>contigo</span></div>
    <div class="float f1"><span class="ic">${I.shield}</span><span><b>Revisado y garantizado</b><small>Antes de entregarlo</small></span></div>
    ${nuevo ? `<a class="float f2" href="/coches/${nuevo.id}/">${imgTag(img0(nuevo), "", { sizes: SIZES.thumb })}<span><small>Recién llegado</small><b>${esc(title(nuevo))}</b><span class="pr">${eur(nuevo.precio)}</span></span></a>` : ""}
  </div>
</div></section>

<div class="brands g"><div class="in"><span class="t">Marcas en stock:</span>
  ${brands.map(b => `<button type="button" data-brand="${esc(b)}" aria-pressed="false">${esc(b)}</button>`).join("")}
</div></div>

<section class="sec g"><div class="in">
  <h2 class="sr-only">Por qué comprar tu coche en ${esc(cfg.nombre)}</h2>
  <div class="perks">
    <div class="perk"><span class="ic">${I.wrench}</span><h3>Pasa por taller</h3><p>Revisamos mecánica, frenos y neumáticos antes de ponerlo a la venta.</p></div>
    <div class="perk"><span class="ic">${I.doc}</span><h3>Papeles incluidos</h3><p>Transferencia, informe de la DGT y cambio de nombre corren de nuestra cuenta.</p></div>
    <div class="perk"><span class="ic">${I.swap}</span><h3>Tu coche vale</h3><p>Te lo tasamos y lo descontamos del precio del que te lleves.</p></div>
    <div class="perk"><span class="ic">${I.truck}</span><h3>Te lo llevamos</h3><p>Con nuestra grúa, a cualquier punto de la península.</p></div>
  </div>
</div></section>

<section class="g" id="stock" style="padding-bottom:88px"><div class="in">
  <div class="sec-head"><div><p class="eyebrow">Stock actual</p><h2>Coches disponibles hoy</h2></div><p>Todos con transferencia incluida. Pulsa "Lo quiero ver" y te contestamos por WhatsApp.</p></div>
  <div class="tools">
    <div class="seg" role="group" aria-label="Presupuesto">
      <button type="button" data-budget="" aria-pressed="true">Todos</button>
      <button type="button" data-budget="0-8000" aria-pressed="false">Hasta 8.000 €</button>
      <button type="button" data-budget="8000-10000" aria-pressed="false">8 – 10.000 €</button>
      <button type="button" data-budget="10000-999999" aria-pressed="false">+10.000 €</button>
    </div>
    <div class="seg" role="group" aria-label="Tipo">
      <button type="button" data-tipo="" aria-pressed="true">Todo</button>
      <button type="button" data-tipo="Berlina" aria-pressed="false">Turismo</button>
      ${tipos.has("SUV") ? '<button type="button" data-tipo="SUV" aria-pressed="false">SUV</button>' : ""}
      ${tipos.has("Furgoneta") ? '<button type="button" data-tipo="Furgoneta" aria-pressed="false">Furgo y camper</button>' : ""}
    </div>
    <span class="count" id="count">${cars.length} coches</span>
    <select id="sort" aria-label="Ordenar"><option value="rel">Destacados</option><option value="pa">Precio: de menor a mayor</option><option value="pd">Precio: de mayor a menor</option><option value="km">Menos kilómetros</option><option value="yr">Más nuevos</option></select>
  </div>
  <div class="grid" id="grid">${cars.map(card).join("\n")}
    <div class="empty" id="empty" hidden>No tenemos ahora un coche así. <a href="${wa("Hola, busco un coche que no está en la web. Te cuento:")}" target="_blank" rel="noopener">Dinos qué buscas</a> y te avisamos cuando entre uno.</div>
  </div>
</div></section>

${star ? `<section class="g"><div class="in">
  <div class="spot">
    <div class="ph">${imgTag(img0(star), carAlt(star))}</div>
    <div class="bd">
      <p class="eyebrow">La joya del mes</p>
      <h2>${esc(title(star))}, de ${star.year}</h2>
      <p>${esc(star.descripcion || star.version)}</p>
      <div class="specs"><div><small>Kilómetros</small><b>${kmf(star.km)}</b></div><div><small>Motor</small><b>${esc(star.combustible)}${star.cv ? `, ${star.cv} cv` : ""}</b></div><div><small>Carrocería</small><b>${esc(star.carroceria)}</b></div><div><small>Cambio</small><b>${esc(star.cambio)}</b></div></div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="price">${eur(star.precio)}</span><a class="btn a" href="/coches/${star.id}/">Ver el coche</a></div>
    </div>
  </div>
</div></section>` : ""}

<section class="sec g" id="financiacion"><div class="in fin">
  <div class="txt"><p class="eyebrow">Financiación</p><h2>Llévatelo hoy y págalo poco a poco</h2>
    <p>Trabajamos con financieras de confianza. Tú eliges la entrada y el plazo, y nosotros nos ocupamos del papeleo.</p>
    <ul><li>Entrada y plazo a tu medida</li><li>Puedes entregar tu coche como entrada</li><li>Te ayudamos con toda la documentación</li></ul></div>
  <div class="calc">
    <div><label for="fc">Coche</label><select id="fc" style="margin-top:8px">${cars.map(c => `<option value="${c.precio}" data-name="${esc(title(c))}">${esc(title(c))} · ${eur(c.precio)}</option>`).join("")}</select></div>
    <div><label for="fe">Entrada <span id="fev"></span></label><input id="fe" type="range" min="0" max="50" step="5" value="${cfg.financiacion.entradaPct}"></div>
    <div><label for="fm">Plazo <span id="fmv"></span></label><input id="fm" type="range" min="24" max="96" step="12" value="${cfg.financiacion.meses}"></div>
    <div class="out"><div><small>Cuota mensual estimada</small><br><b id="fq"></b> <small>€/mes</small></div><a class="btn a" id="fwa" target="_blank" rel="noopener" href="${wa("Hola, quiero información sobre financiación")}">Solicitar</a></div>
    <p class="fine" id="ftin" data-tin="${cfg.financiacion.tin}">Cálculo orientativo con TIN ${tinTxt} %, sujeto a aprobación de la financiera.</p>
  </div>
</div></section>

<section class="steps g"><svg class="mtn" viewBox="0 0 1440 220" preserveAspectRatio="none" fill="currentColor" aria-hidden="true"><path d="M0 220V170l80-30 50 20 60-70 40 40 50-90 40 60 40-80 50 70 40-50 50 60 40-90 50 80 40-40 60 70 50-60 40 40 70-40 60 30 80-50 70 40 90-30 80 30 100-20 120 40v80Z"/></svg>
  <div class="in sec">
    <p class="eyebrow">Así de fácil</p>
    <h2>Comprar con nosotros, en tres pasos</h2>
    <ol>
      <li><b>Elige y escríbenos</b><span>Pulsa "Lo quiero ver" en el coche que te guste. Te contestamos por WhatsApp con fotos y vídeo.</span></li>
      <li><b>Ven a probarlo</b><span>Te lo tenemos preparado el día que nos digas, aquí en Esparreguera.</span></li>
      <li><b>Llévatelo con todo hecho</b><span>Firmamos, hacemos la transferencia y te vas conduciendo. O te lo llevamos a casa.</span></li>
    </ol>
  </div>
</section>

<section class="sec g" id="vender"><div class="in">
  <div class="sell">
    <div class="ph">${imgTag(img0(sellCar), "")}<div class="tag"><b>Tasación en 24 horas</b>Sin compromiso y sin moverte de casa.</div></div>
    <form id="tas">
      <p class="eyebrow">Vende o cambia tu coche</p>
      <h2>¿Cuánto vale tu coche?</h2>
      <p>Rellena esto y mándanos 4 fotos por WhatsApp. Te decimos una cifra al día siguiente.</p>
      <div class="fg">
        <div class="field full"><label for="tm">Marca y modelo</label><input id="tm" required placeholder="Ej. Seat Ibiza 1.0 TSI"></div>
        <div class="field"><label for="ty">Año</label><input id="ty" inputmode="numeric" required placeholder="2017"></div>
        <div class="field"><label for="tk">Kilómetros</label><input id="tk" inputmode="numeric" required placeholder="95.000"></div>
        <div class="field full"><label for="tt">Tu teléfono</label><input id="tt" inputmode="tel" required placeholder="6XX XXX XXX"></div>
      </div>
      <button class="btn g" type="submit">${I.wa}Enviar por WhatsApp</button>
    </form>
  </div>
</div></section>

<section class="g" id="servicios" style="padding-bottom:88px"><div class="in">
  <div class="sec-head"><div><p class="eyebrow">Más que un compraventa</p><h2>Todo lo de tu coche, en un sitio</h2></div></div>
  <div class="svcs">
    <div class="svc"><span class="ic">${I.doc}</span><h3>Gestoría</h3><p>Transferencias, informes DGT, duplicados, matriculaciones y bajas.</p></div>
    <div class="svc"><span class="ic">${I.key}</span><h3>Coches sin carnet</h3><p>Representantes oficiales de Aixam. Desde los 15 años con licencia AM.</p></div>
    <div class="svc"><span class="ic">${I.tow}</span><h3>Grúa y traslados</h3><p>Llevamos tu coche donde lo necesites, también fuera de Cataluña.</p></div>
    <div class="svc"><span class="ic">${I.cal}</span><h3>Rent a car</h3><p>Alquiler de vehículos por días o por semanas.</p></div>
  </div>
</div></section>

<section class="g" style="padding-bottom:88px"><div class="in faq">
  <div class="txt"><p class="eyebrow">Dudas</p><h2>Lo que más nos preguntáis</h2><p>¿No está tu pregunta? Escríbenos por WhatsApp y te respondemos enseguida.</p></div>
  <div>
    <details open><summary>¿Puedo comprar sin ir a Esparreguera?</summary><p>Sí. Te enviamos vídeo del coche por WhatsApp, firmamos a distancia y te lo llevamos a casa con nuestra grúa.</p></details>
    <details><summary>¿Los coches tienen garantía?</summary><p>Sí, todos tienen la garantía legal de 12 meses de un coche de ocasión vendido por un profesional, y salen revisados de taller.</p></details>
    <details><summary>¿Aceptáis mi coche como parte del pago?</summary><p>Sí. Lo tasamos sin compromiso y descontamos su valor del coche que te lleves.</p></details>
    <details><summary>¿Quién hace el cambio de nombre?</summary><p>Nuestra gestoría. Está incluido en el precio y te damos el permiso de circulación a tu nombre.</p></details>
  </div>
</div></section>

<section class="g" id="contacto"><div class="in contact">
  <div class="cbox">
    <p class="eyebrow">Ven a vernos</p><h2>Te esperamos en Esparreguera</h2>
    <dl>
      <dt>WhatsApp</dt><dd>${WA_TXT}</dd>
      <dt>Teléfono</dt><dd><a href="tel:+34${cfg.telefono}">${TEL}</a></dd>
      <dt>Email</dt><dd><a href="mailto:${cfg.email}">${cfg.email}</a></dd>
      <dt>Dirección</dt><dd>${esc(cfg.direccion ? `${cfg.direccion}, ${cfg.ciudad}` : cfg.ciudad)}</dd>
      <dt>Horario</dt><dd>${esc(cfg.horario || "Con cita previa")}</dd>
    </dl>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn a" href="${wa("Hola, quiero pedir cita para ver un coche")}" target="_blank" rel="noopener">Pedir cita</a><a class="btn o" href="https://www.google.com/maps/search/${encodeURIComponent(`${cfg.nombre} ${cfg.direccion} Esparreguera`)}" target="_blank" rel="noopener">${I.pin}Cómo llegar</a></div>
  </div>
  <div class="mapbox">
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#ffffff10"/></pattern></defs>
      <rect width="600" height="400" fill="url(#grid)"/>
      <path d="M0 250 70 205l30 18 38-55 26 32 34-74 28 50 30-66 34 58 28-40 36 50 30-72 34 64 30-34 42 56 36-46 30 30 50-30 44 22 60-38v222H0Z" fill="#3b4a54"/>
      <path d="M-20 280C120 250 200 290 300 262s200-50 330-20" fill="none" stroke="#6fb1f2" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14"/>
      <g transform="translate(300 250)"><circle r="34" fill="#6fb1f233"/><circle r="16" fill="#6fb1f2"/><circle r="6" fill="#fff"/></g>
      <text x="330" y="196" fill="#9cc6f0" font-family="Nunito Sans,sans-serif" font-size="14" font-weight="800" letter-spacing="2">MONTSERRAT</text>
    </svg>
    <div class="lbl"><b>Esparreguera</b><span>Baix Llobregat · A 40 minutos de Barcelona por la A-2</span></div>
  </div>
</div></section>`;

  const faq = [...body.matchAll(/<details[^>]*><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)];
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      business(cars),
      { "@type": "WebSite", "@id": `${cfg.siteUrl}/#web`, url: `${cfg.siteUrl}/`, name: `${cfg.nombre} Esparreguera`, inLanguage: "es-ES", publisher: { "@id": BIZ_ID } },
      { "@type": "ItemList", name: "Coches de segunda mano en venta", numberOfItems: cars.length,
        itemListElement: cars.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${cfg.siteUrl}/coches/${c.id}/`, name: `${title(c)} ${c.version}` })) },
      { "@type": "FAQPage", mainEntity: faq.map(([, q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
  return layout({
    pageTitle: "Coches de segunda mano en Esparreguera | Multiservice Car",
    description: `${cars.length} coches de ocasión revisados en Esparreguera (Barcelona), con transferencia incluida, garantía, financiación y entrega en toda España. Desde ${cfg.desde}.`,
    path: "/", body, jsonld, image: img0(heroCar) && { ...img0(heroCar), alt: carAlt(heroCar) },
  });
}

export function carPage(c, cars) {
  const sim = cars.filter(x => x !== c).sort((a, b) => Math.abs(a.precio - c.precio) - Math.abs(b.precio - c.precio)).slice(0, 4);
  const dgtTxt = { C: "C (verde)", B: "B (amarilla)", ECO: "ECO", "0": "0 emisiones", H: "Histórico" }[c.etiqueta] || "Consultar";
  const ims = c.img || c.fotos.map(src => ({ src }));
  const thumbs = c.fotos.length > 1 ? `<div class="thumbs">${ims.map((im, i) => `<button type="button" data-i="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1}">${imgTag(im, "", { sizes: SIZES.thumb })}</button>`).join("")}</div>` : "";
  const body = `
<div class="g"><div class="in">
  <p class="crumbs"><a href="/">Inicio</a> / <a href="/#stock">Coches</a> / <span>${esc(title(c))}</span></p>
  <div class="det">
    <div>
      <div class="gal" data-fotos='${esc(JSON.stringify(ims.map(im => ({ s: im.src, ss: im.srcset || "" }))))}'><div class="mainph" id="gmain">${pic(c, true, SIZES.gal)}<span class="pill">${c.year ?? ""}</span>${dgt(c.etiqueta)}${c.fotos.length > 1 ? `
        <button class="gnav prev" type="button" aria-label="Foto anterior">‹</button><button class="gnav next" type="button" aria-label="Foto siguiente">›</button>
        <span class="gcount"><b id="gi">1</b> / ${c.fotos.length}</span>` : ""}${c.fotos[0] ? '<button class="gzoom" type="button" aria-label="Ver en pantalla completa">⤢</button>' : ""}</div>${thumbs}
        <p class="note">${c.fotos[0] ? "Más fotos y vídeo por WhatsApp, te los mandamos al momento." : "Pídenos las fotos por WhatsApp y te las mandamos al momento."}</p></div>
      <div style="margin-top:28px"><p class="eyebrow">${esc(c.carroceria)} · ${c.year ?? ""}</p><h1 style="margin-top:10px">${esc(title(c))}</h1><p class="ver">${esc(c.version)}</p></div>
      <div class="specs6">
        <div><span class="ic">${I.cal}</span><span><small>Año</small><b>${c.year ?? "Consultar"}</b></span></div>
        <div><span class="ic">${I.road}</span><span><small>Kilómetros</small><b>${kmf(c.km)}</b></span></div>
        <div><span class="ic">${I.fuel}</span><span><small>Combustible</small><b>${esc(c.combustible)}</b></span></div>
        <div><span class="ic">${I.gear}</span><span><small>Cambio</small><b>${esc(c.cambio)}</b></span></div>
        <div><span class="ic">${I.bolt}</span><span><small>Potencia</small><b>${c.cv ? `${c.cv} cv` : "Consultar"}</b></span></div>
        <div><span class="ic">${I.leaf}</span><span><small>Etiqueta DGT</small><b>${dgtTxt}</b></span></div>
      </div>
      ${c.descripcion ? `<div style="margin-top:28px"><h2 style="font-size:1.5rem;margin-bottom:10px">Equipamiento y estado</h2><p style="white-space:pre-line;color:var(--muted);max-width:68ch">${esc(c.descripcion)}</p></div>` : ""}
      <div class="incl"><h2>Incluido en el precio</h2><ul><li>Transferencia y cambio de nombre</li><li>Informe de la DGT</li><li>Revisión en taller</li><li>12 meses de garantía legal</li></ul></div>
    </div>
    <aside class="buy">
      <span class="eyebrow">${c.estado === "reservado" ? "Reservado" : "Precio al contado"}</span>
      <span class="price">${eur(c.precio)}</span>
      <div class="cuota"><span>O financiado desde</span><b>${cuota(c.precio)} €/mes</b></div>
      <a class="btn w" href="${waCar(c)}" target="_blank" rel="noopener">${I.wa}Preguntar por WhatsApp</a>
      <a class="btn a" href="${wa(`Hola, quiero probar el ${title(c)} (${c.year}). ¿Qué día puedo pasar?`)}" target="_blank" rel="noopener">${I.cal}Reservar prueba</a>
      <a class="btn o" href="/#vender">${I.swap}Entregar mi coche a cambio</a>
      <p class="small">Cuota orientativa: ${cfg.financiacion.entradaPct} % de entrada a ${cfg.financiacion.meses} meses, TIN ${tinTxt} %.</p>
      <div class="seller"><span class="mk">MC</span><span><b>${esc(cfg.nombre)}</b><span>Esparreguera · vendiendo coches desde ${cfg.desde}</span></span></div>
    </aside>
  </div>
  <section class="similar" style="padding-block:40px 20px"><h2>También te pueden interesar</h2><div class="grid">${sim.map(card).join("")}</div></section>
</div></div>`;
  const url = `${cfg.siteUrl}/coches/${c.id}/`;
  const desc = `${title(c)} ${c.version}${c.year ? `, ${c.year}` : ""}, ${kmf(c.km)}, ${c.combustible}, ${c.cambio}. ${eur(c.precio)} o desde ${cuota(c.precio)} €/mes. Transferencia y garantía incluidas. En Esparreguera (Barcelona).`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Car", "@id": `${url}#coche`, url, name: `${title(c)} ${c.version}`.trim(), sku: c.id,
        description: c.descripcion || desc, brand: { "@type": "Brand", name: c.marca }, manufacturer: { "@type": "Organization", name: c.marca },
        model: c.modelo, vehicleConfiguration: c.version || undefined, vehicleModelDate: c.year ? String(c.year) : undefined, productionDate: c.year ? String(c.year) : undefined,
        itemCondition: "https://schema.org/UsedCondition", fuelType: c.combustible || undefined, vehicleTransmission: c.cambio || undefined, bodyType: c.carroceria || undefined,
        vehicleEngine: c.cv ? { "@type": "EngineSpecification", enginePower: { "@type": "QuantitativeValue", value: c.cv, unitText: "CV" }, fuelType: c.combustible || undefined } : undefined,
        mileageFromOdometer: c.km != null ? { "@type": "QuantitativeValue", value: c.km, unitCode: "KMT" } : undefined,
        image: ims.length ? ims.map(im => abs(im.orig || im.src)) : undefined,
        offers: { "@type": "Offer", url, price: c.precio, priceCurrency: "EUR", itemCondition: "https://schema.org/UsedCondition",
          availability: c.estado === "reservado" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
          seller: { "@type": "AutoDealer", "@id": BIZ_ID, name: `${cfg.nombre} Esparreguera`, telephone: `+34${cfg.telefono}`, address },
          areaServed: { "@type": "Country", name: "España" } } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${cfg.siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Coches", item: `${cfg.siteUrl}/#stock` },
        { "@type": "ListItem", position: 3, name: title(c), item: url } ] },
    ],
  };
  // Título: el más completo que quepa en ~60 caracteres antes de la marca.
  const tail = `${c.year ? ` ${c.year}` : ""} · ${eur(c.precio)}`;
  const pageTitle = [`${title(c)} ${c.version}${tail}`, `${title(c)}${tail} en Esparreguera`, `${title(c)}${tail}`].find(t => t.length <= 42) || `${title(c)}${tail}`;
  return layout({
    pageTitle: `${pageTitle} | ${cfg.nombre}`, description: desc,
    path: `/coches/${c.id}/`, body, jsonld, ogType: "product",
    extraHead: `<meta property="product:price:amount" content="${c.precio}">\n<meta property="product:price:currency" content="EUR">\n<meta property="product:condition" content="used">\n<meta property="product:availability" content="${c.estado === "reservado" ? "pending" : "in stock"}">`,
    image: img0(c) && { ...img0(c), alt: carAlt(c) },
  });
}

// Página de redirección para URLs antiguas (GitHub Pages no tiene redirecciones 301; Google trata
// un meta refresh inmediato con canonical como redirección permanente).
export function redirectPage(to, base = "") {
  const url = cfg.siteUrl + to;
  to = base + to;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(cfg.nombre)}</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)})</script>
</head><body><p><a href="${to}">Ir a ${esc(cfg.nombre)}</a></p></body></html>`;
}

export function notFoundPage(cars) {
  const body = `
<section class="sec g"><div class="in" style="text-align:center;max-width:640px">
  <p class="eyebrow">Error 404</p>
  <h1 style="margin:14px 0">Este coche ya no está aquí</h1>
  <p class="lead" style="margin:0 auto 24px">Puede que ya se haya vendido o que el enlace esté mal. Mira lo que tenemos hoy en stock o escríbenos y te ayudamos.</p>
  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn a" href="/#stock">Ver los ${cars.length} coches en venta</a><a class="btn o" href="${wa("Hola, buscaba un coche en vuestra web y no lo encuentro")}" target="_blank" rel="noopener">${I.wa}Preguntar por WhatsApp</a></div>
</div></section>`;
  return layout({ pageTitle: `Página no encontrada | ${cfg.nombre}`, description: "La página que buscas no existe.", path: "/404.html", body, jsonld: { "@context": "https://schema.org", ...business(cars) } })
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,follow">').replace(/<link rel="canonical"[^>]*>\n/, "");
}
