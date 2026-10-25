// Datos del negocio. Cambia aquí teléfono, dirección, horario o tipo de financiación.
export default {
  siteUrl: "https://mcesparreguera.com",
  nombre: "Multiservice Car",
  ciudad: "Esparreguera (Barcelona)",
  desde: 2008,
  telefono: "624002094",
  whatsapp: "34631288729",
  email: "mcesparreguera@gmail.com",
  instagram: "mcesparreguera",
  direccion: "", // TODO Edu: calle y número
  horario: "",   // TODO Edu: p. ej. "L–V 9:00–13:30 · 16:00–19:30 · S 10:00–13:30"
  financiacion: { tin: 0.0899, entradaPct: 10, meses: 72 }, // TODO Edu: tipo real de la financiera
  // Google Sheet de los coches (compartida con "cualquiera con el enlace"). También se puede pasar como variable SHEET_CSV_URL.
  sheetCsvUrl: process.env.SHEET_CSV_URL ||
    "https://docs.google.com/spreadsheets/d/1syQBOvG-LhIggrnBEGAU2aN57kHjP8nlysCKzv1wYEw/export?format=csv",
};
