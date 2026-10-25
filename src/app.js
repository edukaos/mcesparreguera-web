// Interacción de la web: filtros del stock, calculadora de cuota, tasación por WhatsApp y galería.
(() => {
  const $ = id => document.getElementById(id);
  const WA = document.querySelector(".fab")?.href.match(/wa\.me\/(\d+)/)?.[1];
  const eur = n => n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";

  // Filtros
  const grid = $("grid");
  if (grid) {
    const cards = [...grid.querySelectorAll(".car")];
    const chips = new Set();
    const render = () => {
      const q = $("q").value.trim().toLowerCase(), pmax = +$("pmax").value || Infinity;
      const fuel = $("fuel").value, body = $("body").value, sort = $("sort").value;
      const ok = cards.filter(c => {
        const d = c.dataset;
        return (!q || d.marca.includes(q)) && +d.precio <= pmax && (!fuel || d.fuel === fuel) && (!body || d.body === body) &&
          (!chips.has("auto") || d.gear === "Automático") && (!chips.has("eco") || d.dgt === "ECO" || d.dgt === "0") &&
          (!chips.has("k10") || +d.precio < 10000);
      });
      const by = {
        pa: (a, b) => a.dataset.precio - b.dataset.precio, pd: (a, b) => b.dataset.precio - a.dataset.precio,
        km: (a, b) => (+a.dataset.km || 9e9) - (+b.dataset.km || 9e9), yr: (a, b) => b.dataset.year - a.dataset.year,
      }[sort];
      const order = by ? ok.slice().sort(by) : cards.filter(c => ok.includes(c));
      cards.forEach(c => { c.hidden = !ok.includes(c); });
      order.forEach(c => grid.insertBefore(c, $("empty")));
      $("empty").hidden = ok.length > 0;
      $("count").textContent = `${ok.length} de ${cards.length} coches`;
    };
    ["q", "pmax", "fuel", "body", "sort"].forEach(id => $(id).addEventListener("input", render));
    $("search").addEventListener("submit", e => { e.preventDefault(); render(); $("stock").scrollIntoView({ behavior: "smooth" }); });
    document.querySelectorAll("[data-chip]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.chip; chips.has(k) ? chips.delete(k) : chips.add(k);
      b.setAttribute("aria-pressed", chips.has(k)); render();
    }));
  }

  // Financiación
  const fcar = $("f-car");
  if (fcar) {
    const tin = parseFloat(document.querySelector("#financiacion .fine").textContent.match(/TIN ([\d,]+)/)[1].replace(",", ".")) / 100;
    const calc = () => {
      const price = +fcar.value, name = fcar.selectedOptions[0].dataset.name;
      const ent = +$("f-entrada").value, m = +$("f-meses").value, r = tin / 12;
      const q = Math.round(price * (1 - ent / 100) * r / (1 - Math.pow(1 + r, -m)));
      $("f-entrada-v").textContent = `${ent} % (${eur(price * ent / 100)})`;
      $("f-meses-v").textContent = `${m} meses`;
      $("f-cuota").textContent = q;
      $("f-wa").href = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola, quiero financiar el ${name} (${eur(price)}) con ${ent}% de entrada a ${m} meses. Cuota orientativa ${q} €/mes.`)}`;
    };
    ["f-car", "f-entrada", "f-meses"].forEach(id => $(id).addEventListener("input", calc));
    calc();
  }

  // Tasación: abre WhatsApp con los datos escritos
  $("tasacion")?.addEventListener("submit", e => {
    e.preventDefault();
    const msg = `Hola, quiero tasar mi coche: ${$("t-marca").value}, año ${$("t-year").value}, ${$("t-km").value} km. Mi teléfono: ${$("t-tel").value}. Te envío fotos.`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });

  // Galería de la ficha
  document.querySelectorAll(".thumbs button").forEach(b => b.addEventListener("click", () => {
    $("g-main").src = b.dataset.src;
    document.querySelectorAll(".thumbs button").forEach(x => x.setAttribute("aria-current", x === b));
  }));
})();
