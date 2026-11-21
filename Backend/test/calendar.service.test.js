import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMERCIAL_CALENDAR_CONFIGURATION } from '../src/config/commercial-calendar.js';
import { createCalendarService } from '../src/services/calendar.service.js';
import { explanationService } from '../src/services/explanation.service.js';
import { recommendationService } from '../src/services/recommendation.service.js';

const calendar = createCalendarService();

test('conserva los rangos anunciados de Buen Fin de 2023 a 2026 con su fuente', () => {
  assert.deepEqual(
    COMMERCIAL_CALENDAR_CONFIGURATION.announcedEvents.map(event => [
      event.year,
      event.startDate,
      event.endDate,
      event.sourceUrl,
    ]),
    [
      [2023, '2023-11-17', '2023-11-20', 'https://www.gob.mx/se/prensa/anuncian-apertura-del-registro-para-participar-en-el-buen-fin-2023'],
      [2024, '2024-11-15', '2024-11-18', 'https://www.gob.mx/se/prensa/inicio-registro-para-participar-en-el-buen-fin-2024'],
      [2025, '2025-11-13', '2025-11-17', 'https://www.gob.mx/se/prensa/el-buen-fin-reforzara-la-identidad-mexicana-a-traves-de-la-marca-hecho-en-mexico?idiom=es'],
      [2026, '2026-11-13', '2026-11-17', 'https://www.elbuenfin.org/preguntas-frecuentes/'],
    ],
  );
});

test('calcula Black Friday y Cyber Monday según el Día de Acción de Gracias entre 2023 y 2027', () => {
  const expected = [
    [2023, '2023-11-24', '2023-11-27'],
    [2024, '2024-11-29', '2024-12-02'],
    [2025, '2025-11-28', '2025-12-01'],
    [2026, '2026-11-27', '2026-11-30'],
    [2027, '2027-11-26', '2027-11-29'],
  ];

  for (const [year, blackFriday, cyberMonday] of expected) {
    const blackFridayEvent = calendar.eventsForDate(blackFriday).find(event => event.id === `black-friday-${year}`);
    const cyberMondayEvent = calendar.eventsForDate(cyberMonday).find(event => event.id === `cyber-monday-${year}`);
    assert.equal(blackFridayEvent?.startDate, blackFriday);
    assert.equal(cyberMondayEvent?.startDate, cyberMonday);
  }
});

test('conserva las reglas de temporada y añade Año Nuevo como evento fijo', () => {
  for (const year of [2023, 2024, 2025, 2026, 2027]) {
    const newYearDate = `${year}-01-01`;
    const kingsDate = `${year}-01-06`;
    const deadDates = [`${year}-11-01`, `${year}-11-02`];
    const mothersDate = `${year}-05-10`;
    const christmasDate = `${year}-12-25`;

    assert.ok(calendar.eventsForDate(newYearDate).some(event => event.id === `ano-nuevo-${year}`));
    assert.ok(calendar.eventsForDate(kingsDate).some(event => event.id === `dia-de-reyes-${year}`));
    for (const date of deadDates) {
      assert.ok(calendar.eventsForDate(date).some(event => event.id === `dia-de-muertos-${year}`));
    }
    assert.ok(calendar.eventsForDate(mothersDate).some(event => event.id === `dia-de-madres-${year}`));
    const backToSchool = calendar.eventsForDate(`${year}-08-15`).find(event => (
      event.id === `regreso-a-clases-${year}`
    ));
    assert.equal(backToSchool?.startDate, `${year}-08-01`);
    assert.equal(backToSchool?.endDate, `${year}-09-08`);
    assert.ok(calendar.eventsForDate(christmasDate).some(event => (
      event.id === `navidad-${year}` && event.startDate === `${year}-12-05` && event.endDate === `${year + 1}-01-06`
    )));
  }
});

test('indica Buen Fin sin fecha configurada para 2027 y no inventa un rango', () => {
  const metadata = calendar.metadataForDate('2027-11-15');
  const events = calendar.eventsForDate('2027-11-15');

  assert.deepEqual(metadata.eventsWithoutDate, [{
    id: 'buen-fin-2027',
    label: 'Buen Fin',
    calendarYear: 2027,
    status: 'date-not-configured',
  }]);
  assert.equal(events.some(event => event.id === 'buen-fin-2027'), false);
  assert.equal(events.some(event => event.label === 'Buen Fin'), false);
});

test('la explicación comunica que falta la fecha de Buen Fin sin asociarla al pronóstico', () => {
  const forecast = {
    predictedDemand: 4,
    horizonWeeks: 1,
    unit: 'pieza',
    modelName: 'last-week',
    metrics: null,
    sourceOrigin: 'synthetic',
    syntheticData: true,
  };
  const inventory = { quantity: 8, unit: 'pieza' };
  const recommendation = recommendationService.recommend({ forecast, inventory });
  const explanation = explanationService.explainDetails({
    forecast,
    inventory,
    recommendation,
    events: [],
    calendarMetadata: calendar.metadataForDate('2027-11-15'),
  });

  assert.match(explanation.resumen, /Buen Fin/);
  assert.match(explanation.resumen, /no hay una fecha configurada|sin fecha/i);
  assert.equal(explanation.calendario.afecta_pronostico, false);
});
