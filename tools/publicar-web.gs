// Añade a la hoja de coches un menú "Web" con cuatro opciones:
// · "Publicar web ahora": publica la web al momento sin esperar a la hora.
// · "Dar formato a la hoja": colores, cabecera fija y desplegables en las columnas de pocas opciones. Se puede repetir sin miedo:
//   no cambia ni el orden de las columnas ni los datos.
// · "Añadir equipamiento y comentarios": crea esas dos columnas al final (si no existen) y rellena las celdas vacías
//   con los textos de la web antigua. Nunca escribe encima de lo que ya hayas puesto.
// · "Preparar mensaje de WhatsApp": prepara el texto con los coches nuevos (o los destacados, o todos) y sus enlaces,
//   listo para copiar y pegar en una lista de difusión de WhatsApp Business. Recuerda qué coches ya enviaste.
// Pega este código en un archivo nuevo del mismo Apps Script de la hoja (Extensiones > Apps Script > + > Secuencia de comandos).
// Necesita un token de GitHub de tipo "fine-grained", solo para este repositorio y con el permiso Actions: lectura y escritura,
// guardado en Configuración del proyecto > Propiedades del script con el nombre GITHUB_TOKEN (nunca dentro del código).
const REPO = 'edukaos/mcesparreguera-web';
const WORKFLOW = 'publicar.yml';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Web')
    .addItem('Publicar web ahora', 'publicarWeb')
    .addItem('Dar formato a la hoja', 'formatearHoja')
    .addItem('Añadir equipamiento y comentarios', 'rellenarTextos')
    .addSeparator()
    .addItem('Preparar mensaje de WhatsApp', 'mensajeWhatsApp')
    .addToUi();
}

function publicarWeb() {
  const ui = SpreadsheetApp.getUi();
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return ui.alert('Falta el token de GitHub: guárdalo en Configuración del proyecto > Propiedades del script como GITHUB_TOKEN.');
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 204) return ui.alert('Publicando la web. En 2 o 3 minutos estarán los cambios (recarga la web para verlos).');
  if (code === 401) return ui.alert('El token de GitHub no vale o ha caducado: crea uno nuevo y cámbialo en Propiedades del script.');
  ui.alert(`No se pudo publicar (error ${code}). Revisa que el token tenga el permiso Actions: lectura y escritura.\n\n${res.getContentText().slice(0, 300)}`);
}

// Opciones de los desplegables, con los valores que entiende la web (build.mjs). Si escribes otro valor, la hoja avisa pero lo deja.
const OPCIONES = {
  estado: ['disponible', 'reservado', 'vendido'],
  destacado: ['sí', 'no'],
  combustible: ['Gasolina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'GLP'],
  cambio: ['Manual', 'Automático'],
  carroceria: ['Berlina', 'SUV', 'Todo terreno', 'Monovolumen', 'Furgoneta', 'Coupé', 'Camper'],
  etiqueta: ['0', 'ECO', 'C', 'B', 'H'],
};
// Sin separador de miles a propósito: según el idioma de la hoja saldría "11,500" y la web lo leería como 11,5.
const FORMATOS = { precio: '0" €"', km: '0" km"', 'año': '0', cv: '0' };
const ANCHOS = { id: 170, marca: 100, modelo: 110, version: 200, fotos: 160, descripcion: 320, equipamiento: 320, comentarios: 320, ficha_antigua: 160 };

function formatearHoja() {
  const hoja = SpreadsheetApp.getActive().getSheets()[0];
  const ncol = hoja.getLastColumn(), filas = Math.max(hoja.getMaxRows() - 1, 1);
  const cabecera = hoja.getRange(1, 1, 1, ncol).getValues()[0].map(c => String(c).trim().toLowerCase().replace('carrocería', 'carroceria'));
  const col = nombre => cabecera.indexOf(nombre) + 1;
  const todo = hoja.getRange(1, 1, filas + 1, ncol);

  todo.setFontFamily('Roboto').setFontSize(10).setVerticalAlignment('middle');
  hoja.getBandings().forEach(b => b.remove());
  todo.applyRowBanding(SpreadsheetApp.BandingTheme.GREEN, true, false)
    .setHeaderRowColor('#173a2c').setFirstRowColor('#ffffff').setSecondRowColor('#f2f6f4');
  hoja.getRange(1, 1, 1, ncol).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  hoja.setRowHeight(1, 34);
  hoja.setFrozenRows(1);
  if (col('modelo')) hoja.setFrozenColumns(col('modelo'));

  cabecera.forEach((nombre, i) => {
    const rango = hoja.getRange(2, i + 1, filas, 1);
    if (OPCIONES[nombre]) {
      rango.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(OPCIONES[nombre], true).setAllowInvalid(true).build())
        .setHorizontalAlignment('center');
      hoja.setColumnWidth(i + 1, 120);
    }
    if (FORMATOS[nombre]) rango.setNumberFormat(FORMATOS[nombre]).setHorizontalAlignment('right');
    if (ANCHOS[nombre]) hoja.setColumnWidth(i + 1, ANCHOS[nombre]);
    // Textos largos recortados para que las filas no se hagan altas (el texto completo se ve al pinchar la celda)
    if (['descripcion', 'equipamiento', 'comentarios', 'fotos', 'ficha_antigua'].includes(nombre)) rango.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  });

  // Fila entera en gris si está vendido y en amarillo si está reservado
  const e = col('estado');
  if (e) {
    const letra = hoja.getRange(1, e).getA1Notation().replace(/\d+/g, '');
    const datos = hoja.getRange(2, 1, filas, ncol);
    const regla = (valor, fondo, texto) => SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${letra}2="${valor}"`).setBackground(fondo).setFontColor(texto).setRanges([datos]).build();
    hoja.setConditionalFormatRules([regla('vendido', '#e4e4e4', '#888888'), regla('reservado', '#fff3d6', '#1d2622')]);
  }
  SpreadsheetApp.getUi().alert('Hoja con formato. Los datos no se han tocado.');
}

// Textos de la web antigua, ya repasados (el mismo archivo que usa la web cuando la celda está vacía)
const TEXTOS_URL = `https://raw.githubusercontent.com/${REPO}/main/data/textos-antiguos.csv`;

function rellenarTextos() {
  const ui = SpreadsheetApp.getUi();
  const hoja = SpreadsheetApp.getActive().getSheets()[0];
  let ncol = hoja.getLastColumn();
  const cabecera = hoja.getRange(1, 1, 1, ncol).getValues()[0].map(c => String(c).trim().toLowerCase());
  for (const nombre of ['equipamiento', 'comentarios']) {
    if (cabecera.includes(nombre)) continue;
    ncol++;
    hoja.getRange(1, ncol).setValue(nombre);
    cabecera.push(nombre);
  }
  const res = UrlFetchApp.fetch(TEXTOS_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return ui.alert(`No se pudieron leer los textos (error ${res.getResponseCode()}). Las columnas ya están creadas.`);
  const [cab, ...filas] = Utilities.parseCsv(res.getContentText('UTF-8'));
  const textos = {};
  filas.forEach(f => { textos[f[cab.indexOf('id')]] = { equipamiento: f[cab.indexOf('equipamiento')], comentarios: f[cab.indexOf('comentarios')] }; });

  const nfilas = hoja.getLastRow() - 1;
  if (nfilas < 1) return;
  const datos = hoja.getRange(2, 1, nfilas, ncol).getValues();
  const iId = cabecera.indexOf('id');
  let rellenas = 0;
  for (const nombre of ['equipamiento', 'comentarios']) {
    const i = cabecera.indexOf(nombre);
    const columna = datos.map(fila => {
      const actual = fila[i], t = textos[String(fila[iId]).trim()];
      if (String(actual).trim() || !t || !t[nombre]) return [actual];
      rellenas++;
      return [t[nombre]];
    });
    hoja.getRange(2, i + 1, nfilas, 1).setValues(columna).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    hoja.setColumnWidth(i + 1, 320);
  }
  ui.alert(`Listo: ${rellenas} celdas rellenadas con los textos de la web antigua. Puedes cambiarlas cuando quieras.`);
}

// ---------- Mensaje de difusión para WhatsApp ----------
const WEB = 'https://mcesparreguera.com';
const NEGOCIO = 'Multiservice Car Esparreguera';
const DIRECCION = 'Carrer Enclusa, 169, Esparreguera';
const TELEFONO = '624 002 094';

// El mismo id que usa la web en la dirección de cada ficha (build.mjs): "SEAT León 2018" → "seat-leon-2018"
const slugWeb = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numero = v => {
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return s && !isNaN(Number(s)) ? Number(s) : null;
};
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cochesDeLaHoja() {
  const [cab, ...filas] = SpreadsheetApp.getActive().getSheets()[0].getDataRange().getValues();
  const k = cab.map(c => String(c).trim().toLowerCase());
  return filas.map(f => {
    const v = nombre => { const i = k.indexOf(nombre); return i < 0 ? '' : f[i]; };
    const marca = String(v('marca')).trim(), modelo = String(v('modelo')).trim(), year = numero(v('año') || v('ano'));
    return {
      id: slugWeb(String(v('id')).trim() || `${marca} ${modelo} ${year || ''}`),
      estado: String(v('estado') || 'disponible').trim().toLowerCase(),
      destacado: /^(s[ií]|x|1|true)$/i.test(String(v('destacado')).trim()),
      marca, modelo, version: String(v('version') || v('versión')).trim(), year,
      km: numero(v('km')), combustible: String(v('combustible')).trim(), cambio: String(v('cambio')).trim(), precio: numero(v('precio')),
    };
  }).filter(c => c.marca && c.modelo && c.precio && c.estado === 'disponible');
}

function textoDifusion(titulo, coches) {
  const bloques = coches.map(c => [
    `*${c.marca} ${c.modelo}${c.version ? ' ' + c.version : ''}*${c.year ? ' · ' + c.year : ''}`,
    [c.km != null ? miles(c.km) + ' km' : '', c.combustible, c.cambio].filter(Boolean).join(' · '),
    `💶 *${miles(c.precio)} €*`,
    `👉 ${WEB}/coches/${c.id}/`,
  ].filter(Boolean).join('\n'));
  return [`🚗 *${titulo}*`, ...bloques,
    `📍 ${DIRECCION}\n💬 Pregúntanos por aquí o llama al ${TELEFONO}\nTodos nuestros coches: ${WEB}`].join('\n\n');
}

function mensajeWhatsApp() {
  const coches = cochesDeLaHoja();
  if (!coches.length) return SpreadsheetApp.getUi().alert('No hay coches disponibles con precio en la hoja.');
  const enviados = JSON.parse(PropertiesService.getDocumentProperties().getProperty('WHATSAPP_ENVIADOS') || '[]');
  const nuevos = coches.filter(c => !enviados.includes(c.id));
  const destacados = coches.filter(c => c.destacado);
  const opciones = {
    nuevos: { nombre: `Coches nuevos (${nuevos.length})`, ids: nuevos.map(c => c.id), texto: nuevos.length ? textoDifusion(`Novedades en ${NEGOCIO}`, nuevos) : '' },
    destacados: { nombre: `Destacados (${destacados.length})`, ids: destacados.map(c => c.id), texto: destacados.length ? textoDifusion(`Coches destacados en ${NEGOCIO}`, destacados) : '' },
    todos: { nombre: `Todos los disponibles (${coches.length})`, ids: coches.map(c => c.id), texto: textoDifusion(`Coches disponibles en ${NEGOCIO}`, coches) },
  };
  const inicial = nuevos.length ? 'nuevos' : destacados.length ? 'destacados' : 'todos';
  const datos = JSON.stringify({ opciones, inicial }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><base target="_top"><style>
    body{font:14px/1.45 Roboto,Arial,sans-serif;color:#1d2622;margin:0;padding:4px 2px}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
    .tabs button{border:1px solid #c9d6cf;background:#fff;border-radius:16px;padding:5px 12px;cursor:pointer;font:inherit}
    .tabs button.on{background:#173a2c;border-color:#173a2c;color:#fff}
    textarea{width:100%;box-sizing:border-box;height:300px;font:13px/1.4 Roboto,Arial,sans-serif;padding:10px;border:1px solid #c9d6cf;border-radius:8px;resize:vertical}
    .bar{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
    .bar button{border:0;border-radius:8px;padding:9px 14px;cursor:pointer;font:inherit;font-weight:600}
    .ok{background:#25d366;color:#fff}.sec{background:#e8efeb;color:#173a2c}
    small{color:#5b6b63;display:block;margin-top:8px}#msg{color:#1a7f45;font-weight:600}
  </style></head><body>
    <div class="tabs" id="tabs"></div>
    <textarea id="txt"></textarea>
    <div class="bar">
      <button class="ok" onclick="copiar()">Copiar texto</button>
      <button class="sec" id="marcar" onclick="marcar()">Ya lo he enviado</button>
      <span id="msg"></span>
    </div>
    <small>Pégalo en tu lista de difusión de WhatsApp Business. Solo lo reciben los clientes que tienen tu número guardado.
    Si acabas de añadir un coche, publica antes la web (Web &gt; Publicar web ahora) para que su enlace funcione.
    "Ya lo he enviado" hace que esos coches no vuelvan a salir como nuevos.</small>
    <script>
      const D = ${datos}; let actual = D.inicial;
      const tabs = document.getElementById('tabs'), txt = document.getElementById('txt'), msg = document.getElementById('msg');
      function pinta() {
        tabs.innerHTML = '';
        Object.entries(D.opciones).forEach(([k, o]) => {
          const b = document.createElement('button'); b.textContent = o.nombre; b.className = k === actual ? 'on' : '';
          b.onclick = () => { actual = k; msg.textContent = ''; pinta(); }; tabs.appendChild(b);
        });
        txt.value = D.opciones[actual].texto || 'No hay coches en este grupo. Elige otra opción arriba.';
      }
      function copiar() {
        txt.select(); let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        if (!ok && navigator.clipboard) navigator.clipboard.writeText(txt.value).then(() => msg.textContent = 'Copiado');
        msg.textContent = ok ? 'Copiado' : 'Selecciona el texto y cópialo (Ctrl+C)';
      }
      function marcar() {
        msg.textContent = 'Guardando...';
        google.script.run.withSuccessHandler(n => msg.textContent = n + ' coches marcados como enviados')
          .marcarEnviados(D.opciones[actual].ids);
      }
      pinta();
    </script></body></html>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(500), 'Mensaje para WhatsApp');
}

// Guarda qué coches ya se enviaron (en la propia hoja), para que la próxima vez solo salgan los nuevos.
function marcarEnviados(ids) {
  const props = PropertiesService.getDocumentProperties();
  const enviados = new Set(JSON.parse(props.getProperty('WHATSAPP_ENVIADOS') || '[]'));
  ids.forEach(id => enviados.add(id));
  const vivos = new Set(cochesDeLaHoja().map(c => c.id));
  // Los vendidos o borrados se olvidan, así la lista no crece para siempre.
  props.setProperty('WHATSAPP_ENVIADOS', JSON.stringify([...enviados].filter(id => vivos.has(id))));
  return ids.length;
}
