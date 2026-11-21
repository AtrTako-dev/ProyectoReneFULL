export const COMMERCIAL_CALENDAR_CONFIGURATION = Object.freeze({
  version: 'demo-commercial-calendar-v2',
  announcedEventDefinitions: Object.freeze([
    { id: 'buen-fin', label: 'Buen Fin' },
  ]),
  announcedEvents: Object.freeze([
    {
      id: 'buen-fin',
      year: 2023,
      label: 'Buen Fin',
      startDate: '2023-11-17',
      endDate: '2023-11-20',
      categories: ['Electrónica', 'Abarrotes', 'Limpieza', 'Higiene'],
      sourceUrl: 'https://www.gob.mx/se/prensa/anuncian-apertura-del-registro-para-participar-en-el-buen-fin-2023',
    },
    {
      id: 'buen-fin',
      year: 2024,
      label: 'Buen Fin',
      startDate: '2024-11-15',
      endDate: '2024-11-18',
      categories: ['Electrónica', 'Abarrotes', 'Limpieza', 'Higiene'],
      sourceUrl: 'https://www.gob.mx/se/prensa/inicio-registro-para-participar-en-el-buen-fin-2024',
    },
    {
      id: 'buen-fin',
      year: 2025,
      label: 'Buen Fin',
      startDate: '2025-11-13',
      endDate: '2025-11-17',
      categories: ['Electrónica', 'Abarrotes', 'Limpieza', 'Higiene'],
      sourceUrl: 'https://www.gob.mx/se/prensa/el-buen-fin-reforzara-la-identidad-mexicana-a-traves-de-la-marca-hecho-en-mexico?idiom=es',
    },
    {
      id: 'buen-fin',
      year: 2026,
      label: 'Buen Fin',
      startDate: '2026-11-13',
      endDate: '2026-11-17',
      categories: ['Electrónica', 'Abarrotes', 'Limpieza', 'Higiene'],
      sourceUrl: 'https://www.elbuenfin.org/preguntas-frecuentes/',
    },
  ]),
  annualRules: Object.freeze([
    {
      id: 'black-friday',
      label: 'Black Friday',
      categories: ['Electrónica'],
      dateRange: year => {
        const thanksgiving = new Date(Date.UTC(year, 10, 1));
        const firstThursdayOffset = (4 - thanksgiving.getUTCDay() + 7) % 7;
        const day = 1 + firstThursdayOffset + 21;
        const blackFriday = new Date(Date.UTC(year, 10, day + 1)).toISOString().slice(0, 10);
        return [blackFriday, blackFriday];
      },
    },
    {
      id: 'cyber-monday',
      label: 'Cyber Monday',
      categories: ['Electrónica'],
      dateRange: year => {
        const thanksgiving = new Date(Date.UTC(year, 10, 1));
        const firstThursdayOffset = (4 - thanksgiving.getUTCDay() + 7) % 7;
        const day = 1 + firstThursdayOffset + 25;
        const cyberMonday = new Date(Date.UTC(year, 10, day)).toISOString().slice(0, 10);
        return [cyberMonday, cyberMonday];
      },
    },
    {
      id: 'navidad',
      label: 'Navidad',
      categories: ['Electrónica', 'Panadería', 'Abarrotes', 'Lácteos'],
      dateRange: year => [`${year}-12-05`, `${year + 1}-01-06`],
    },
    {
      id: 'regreso-a-clases',
      label: 'Regreso a clases',
      categories: ['Papelería'],
      dateRange: year => [`${year}-08-01`, `${year}-09-08`],
    },
    {
      id: 'dia-de-madres',
      label: 'Día de Madres',
      categories: ['Panadería'],
      dateRange: year => [`${year}-05-04`, `${year}-05-12`],
    },
    {
      id: 'dia-de-muertos',
      label: 'Día de Muertos',
      categories: [],
      dateRange: year => [`${year}-11-01`, `${year}-11-02`],
    },
    {
      id: 'dia-de-reyes',
      label: 'Día de Reyes',
      categories: [],
      dateRange: year => [`${year}-01-06`, `${year}-01-06`],
    },
    {
      id: 'ano-nuevo',
      label: 'Año Nuevo',
      categories: [],
      dateRange: year => [`${year}-01-01`, `${year}-01-01`],
    },
  ]),
});
