// Interacción de la web: filtros del stock y galería.
(() => {
  const $ = id => document.getElementById(id);
  const WA = document.querySelector(".mbar .btn.w, header .btn.w")?.href.match(/wa\.me\/(\d+)/)?.[1];
  const wa = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
  const eur = n => n.toLocaleString("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }) + " €";

  // Menú del móvil
  const head = document.querySelector("header.top"), mt = head?.querySelector(".menu-t");
  if (mt) {
    const set = open => { head.classList.toggle("open", open); mt.setAttribute("aria-expanded", open); mt.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú"); };
    mt.addEventListener("click", () => set(!head.classList.contains("open")));
    head.querySelectorAll("nav.main a").forEach(a => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", e => { if (!head.contains(e.target)) set(false); });
  }

  // Modo claro / oscuro: por defecto claro; el botón lo cambia y se recuerda
  const tt = document.querySelector(".theme-t");
  if (tt) tt.addEventListener("click", () => {
    const root = document.documentElement;
    const now = root.dataset.theme || "light";
    const next = now === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("tema", next); } catch (e) {}
  });

  // Slider de destacados en la portada: pasa solo cada 5 s, se para al tocarlo o pasar el ratón
  const hs = document.querySelector("[data-slider]");
  const track = hs?.querySelector(".hs-track");
  if (track && track.children.length > 1) {
    const slides = [...track.children], dots = [...hs.querySelectorAll(".hs-dots button")];
    const cur = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = i => track.scrollTo({ left: ((i + slides.length) % slides.length) * track.clientWidth });
    let timer, paused = false;
    const play = () => { clearInterval(timer); if (!paused && !matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => go(cur() + 1), 5000); };
    track.addEventListener("scroll", () => {
      const i = cur();
      dots.forEach((d, j) => d.setAttribute("aria-current", i === j));
      slides.forEach((s, j) => { s.toggleAttribute("aria-hidden", i !== j); s.tabIndex = i === j ? 0 : -1; });
    }, { passive: true });
    hs.querySelector(".prev").addEventListener("click", () => { go(cur() - 1); play(); });
    hs.querySelector(".next").addEventListener("click", () => { go(cur() + 1); play(); });
    dots.forEach(d => d.addEventListener("click", () => { go(+d.dataset.i); play(); }));
    track.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(cur() + (e.key === "ArrowRight" ? 1 : -1)); } });
    hs.addEventListener("mouseenter", () => { paused = true; play(); });
    hs.addEventListener("mouseleave", () => { paused = false; play(); });
    hs.addEventListener("focusin", () => { paused = true; play(); });
    hs.addEventListener("focusout", () => { paused = false; play(); });
    track.addEventListener("touchstart", () => { paused = true; play(); }, { passive: true });
    document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(timer) : play());
    play();
  }

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

  // Galería de la ficha: flechas, miniaturas, deslizar y pantalla completa
  const gal = document.querySelector(".gal[data-fotos]");
  if (gal) {
    const fotos = JSON.parse(gal.dataset.fotos);
    const main = $("gmain").querySelector("img");
    const thumbs = [...document.querySelectorAll(".thumbs button")];
    let i = 0;
    const lb = document.createElement("div");
    lb.className = "lightbox"; lb.hidden = true;
    lb.innerHTML = '<img alt=""><button class="lx" type="button" aria-label="Cerrar">✕</button><button class="gnav prev" type="button" aria-label="Foto anterior">‹</button><button class="gnav next" type="button" aria-label="Foto siguiente">›</button><span class="gcount"></span>';
    document.body.append(lb);
    // fotos: [{ s: foto grande, ss: srcset con las versiones reducidas }]
    const load = (img, f) => { img.srcset = f.ss; img.src = f.s; };
    const show = n => {
      i = (n + fotos.length) % fotos.length;
      if (main) load(main, fotos[i]);
      lb.querySelector("img").src = fotos[i].s;
      lb.querySelector(".gcount").textContent = `${i + 1} / ${fotos.length}`;
      if ($("gi")) $("gi").textContent = i + 1;
      thumbs.forEach((t, k) => t.setAttribute("aria-current", k === i));
      thumbs[i]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      [fotos[(i + 1) % fotos.length], fotos[(i - 1 + fotos.length) % fotos.length]].forEach(f => {
        const im = new Image(); if (main) im.sizes = main.sizes; load(im, f);
      });
    };
    const open = () => { if (!fotos.length) return; show(i); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector(".lx").focus(); };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; };
    thumbs.forEach(t => t.addEventListener("click", () => show(+t.dataset.i)));
    gal.addEventListener("click", e => {
      if (e.target.closest(".prev")) show(i - 1);
      else if (e.target.closest(".next")) show(i + 1);
      else if (e.target.closest(".gzoom") || e.target === main) open();
    });
    lb.addEventListener("click", e => {
      if (e.target.closest(".prev")) show(i - 1);
      else if (e.target.closest(".next")) show(i + 1);
      else if (e.target.closest(".lx") || e.target === lb) close();
    });
    document.addEventListener("keydown", e => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(i - 1);
      if (e.key === "ArrowRight") show(i + 1);
    });
    // Deslizar con el dedo
    let x0 = null;
    [$("gmain"), lb].forEach(el => {
      el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener("touchend", e => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
      });
    });
  }
})();
