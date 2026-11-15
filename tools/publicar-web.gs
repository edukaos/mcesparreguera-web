// Añade a la hoja de coches un menú "Web" con dos opciones:
// · "Publicar web ahora": publica la web al momento sin esperar a la hora.
// · "Dar formato a la hoja": colores, cabecera fija y desplegables en las columnas de pocas opciones. Se puede repetir sin miedo:
//   no cambia ni el orden de las columnas ni los datos.
// Pega este código en un archivo nuevo del mismo Apps Script de la hoja (Extensiones > Apps Script > + > Secuencia de comandos).
// Necesita un token de GitHub de tipo "fine-grained", solo para este repositorio y con el permiso Actions: lectura y escritura,
// guardado en Configuración del proyecto > Propiedades del script con el nombre GITHUB_TOKEN (nunca dentro del código).
const REPO = 'edukaos/mcesparreguera-web';
const WORKFLOW = 'publicar.yml';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Web')
    .addItem('Publicar web ahora', 'publicarWeb')
    .addItem('Dar formato a la hoja', 'formatearHoja')
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
const ANCHOS = { id: 170, marca: 100, modelo: 110, version: 200, fotos: 160, descripcion: 320, ficha_antigua: 160 };

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
    if (['descripcion', 'fotos', 'ficha_antigua'].includes(nombre)) rango.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
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
