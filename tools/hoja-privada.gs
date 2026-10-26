// Pega este código en la hoja de coches: Extensiones > Apps Script. Luego Implementar > Nueva implementación > Aplicación web
// (Ejecutar como: yo · Acceso: cualquier usuario). La web lo llama con ?clave=... desde el secreto SHEET_CSV_URL de GitHub,
// así la hoja puede quedarse privada.
const CLAVE = 'CAMBIA-ESTA-CLAVE';

function doGet(e) {
  if ((e.parameter.clave || '') !== CLAVE) return ContentService.createTextOutput('ERROR: clave incorrecta');
  const filas = SpreadsheetApp.getActive().getSheets()[0].getDataRange().getDisplayValues();
  const csv = filas.map(f => f.map(c => /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}
