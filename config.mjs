// Datos del negocio. Cambia aquí teléfono, dirección u horario.
export default {
  // URL pública de la web, sin barra final. En GitHub Actions llega sola (SITE_URL); al pasar al dominio propio no hay que tocar nada.
  siteUrl: (process.env.SITE_URL || "https://mcesparreguera.com").replace(/\/$/, ""),
  nombre: "Multiservice Car",
  ciudad: "Esparreguera (Barcelona)",
  desde: 2008,
  telefono: "624002094",
  whatsapp: "34624002094",
  email: "mcesparreguera@gmail.com",
  instagram: "mcesparreguera",
  direccion: "Carrer Enclusa, 169",
  horario: "",   // TODO Edu: p. ej. "L–V 9:00–13:30 · 16:00–19:30 · S 10:00–13:30"
  cp: "08292",   // código postal de Esparreguera
  // Horario para Google (datos estructurados): [días, abre, cierra]. Ej.: [["Monday","Tuesday","Wednesday","Thursday","Friday"], "09:00", "13:30"]
  horarioSchema: [],
  // URLs de la web antigua que no salen de la columna ficha_antigua de la hoja → página nueva
  redirecciones: { "/volkwagen-polo-1-6-tdi-advance-95cv/": "/coches/volkswagen-polo-2020/" },
  // Carpeta de Google Drive con una subcarpeta por coche, llamada como su id (p. ej. "seat-leon-2018").
  // Compartida con "cualquier persona con el enlace". Pega aquí su enlace.
  carpetaFotos: process.env.CARPETA_FOTOS || "https://drive.google.com/drive/folders/1uJcFjea_nC6h3ZuW4SfQ2kZXqyriYto5",
  // Google Sheet de los coches. Si existe el secreto GOOGLE_SA_KEY se lee en privado con la API (solo hace falta sheetId);
  // si no, se descarga como CSV público (compartida con "cualquiera con el enlace"), o desde la variable SHEET_CSV_URL.
  sheetId: process.env.SHEET_ID || "1syQBOvG-LhIggrnBEGAU2aN57kHjP8nlysCKzv1wYEw",
  sheetCsvUrl: process.env.SHEET_CSV_URL ||
    "https://docs.google.com/spreadsheets/d/1syQBOvG-LhIggrnBEGAU2aN57kHjP8nlysCKzv1wYEw/export?format=csv",
};
