// Interacción de la web: filtros del stock, calculadora de cuota, tasación por WhatsApp y galería.
(() => {
  const $ = id => document.getElementById(id);
  const WA = document.querySelector(".mbar .btn.w, header .btn.w")?.href.match(/wa\.me\/(\d+)/)?.[1];
  const wa = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
  const eur = n => n.toLocaleString("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }) + " €";

  // Filtros del stock
  const grid = $("grid");
  if (grid && $("sort")) {
    const cards = [...grid.querySelectorAll(".card")];
    const st = { budget: "", tipo: "", marca: "", sort: "rel" };
    const press = (attr, val) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute("aria-pressed", b.dataset[attr] === val));
    const render = () => {
      const ok = cards.filter(c => {
        const d = c.dataset, p = +d.precio;
        if (st.marca && d.marca !== st.marca) return false;
        if (st.tipo && d.tipo !== st.tipo) return false;
        if (st.budget) { const [a, b] = st.budget.split("-").map(Number); if (p < a || p >= b) return false; }
        return true;
      });
      const by = {
        pa: (a, b) => a.dataset.precio - b.dataset.precio, pd: (a, b) => b.dataset.precio - a.dataset.precio,
        km: (a, b) => (+a.dataset.km || 9e9) - (+b.dataset.km || 9e9), yr: (a, b) => b.dataset.year - a.dataset.year,
      }[st.sort];
      (by ? ok.slice().sort(by) : ok).forEach(c => grid.insertBefore(c, $("empty")));
      cards.forEach(c => { c.hidden = !ok.includes(c); });
      $("empty").hidden = ok.length > 0;
      $("count").textContent = `${ok.length} ${ok.length === 1 ? "coche" : "coches"}`;
      press("budget", st.budget); press("tipo", st.tipo); press("brand", st.marca);
    };
    document.addEventListener("click", e => {
      const b = e.target.closest("[data-budget],[data-tipo],[data-brand]");
      if (!b) return;
      if ("budget" in b.dataset) st.budget = b.dataset.budget;
      if ("tipo" in b.dataset) st.tipo = b.dataset.tipo;
      if ("brand" in b.dataset) { st.marca = st.marca === b.dataset.brand ? "" : b.dataset.brand; $("stock").scrollIntoView({ behavior: "smooth" }); }
      render();
    });
    $("sort").addEventListener("change", e => { st.sort = e.target.value; render(); });
    $("finder")?.addEventListener("submit", e => {
      e.preventDefault(); st.tipo = $("fb").value; st.budget = $("fp").value; st.marca = ""; render();
      $("stock").scrollIntoView({ behavior: "smooth" });
    });
  }

  // Calculadora de cuota
  if ($("fc")) {
    const tin = +$("ftin").dataset.tin;
    const calc = () => {
      const price = +$("fc").value, name = $("fc").selectedOptions[0].dataset.name;
      const ent = +$("fe").value, m = +$("fm").value, r = tin / 12;
      const q = Math.round(price * (1 - ent / 100) * r / (1 - Math.pow(1 + r, -m)));
      $("fev").textContent = `${ent} % · ${eur(price * ent / 100)}`;
      $("fmv").textContent = `${m} meses`;
      $("fq").textContent = q;
      $("fwa").href = wa(`Hola, quiero financiar el ${name} (${eur(price)}) con ${ent} % de entrada a ${m} meses. Cuota orientativa ${q} €/mes.`);
    };
    ["fc", "fe", "fm"].forEach(id => $(id).addEventListener("input", calc));
    calc();
  }

  // Tasación: abre WhatsApp con los datos escritos
  $("tas")?.addEventListener("submit", e => {
    e.preventDefault();
    const msg = `Hola, quiero tasar mi coche: ${$("tm").value}, año ${$("ty").value}, ${$("tk").value} km. Mi teléfono: ${$("tt").value}. Ahora os mando fotos.`;
    window.open(wa(msg), "_blank", "noopener");
  });

  // Galería de la ficha
  document.querySelectorAll(".thumbs button").forEach(b => b.addEventListener("click", () => {
    const img = $("gmain").querySelector("img");
    if (img) img.src = b.dataset.src;
    document.querySelectorAll(".thumbs button").forEach(x => x.setAttribute("aria-current", x === b));
  }));
})();
