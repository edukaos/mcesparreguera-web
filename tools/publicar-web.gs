// Añade a la hoja de coches un menú "Web" > "Publicar web ahora", que publica la web al momento sin esperar a la hora.
// Pega este código en un archivo nuevo del mismo Apps Script de la hoja (Extensiones > Apps Script > + > Secuencia de comandos).
// Necesita un token de GitHub de tipo "fine-grained", solo para este repositorio y con el permiso Actions: lectura y escritura,
// guardado en Configuración del proyecto > Propiedades del script con el nombre GITHUB_TOKEN (nunca dentro del código).
const REPO = 'edukaos/mcesparreguera-web';
const WORKFLOW = 'publicar.yml';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Web')
    .addItem('Publicar web ahora', 'publicarWeb')
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
