import { COMMERCIAL_CALENDAR_CONFIGURATION } from '../config/commercial-calendar.js';
import { DomainError } from '../errors/domain-error.js';

function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function normalizeCategory(category) {
  return typeof category === 'string' ? category.trim().toLocaleLowerCase('es-MX') : '';
}

function eventMatchesCategory(event, category) {
  if (category === undefined || category === null || category === '') return true;
  const requested = normalizeCategory(category);
  if (!requested) throw new DomainError('La categoría debe ser texto.', { code: 'INVALID_CATEGORY' });
  if (event.categories.length === 0) return true;
  return event.categories.some(value => normalizeCategory(value) === requested);
}

function eventsOnDate(date, configuration) {
  const year = Number(date.slice(0, 4));
  const events = configuration.fixedEvents.map(event => ({
    ...event,
    calendarYear: Number(event.startDate.slice(0, 4)),
    source: 'configured-date',
  }));

  for (const rule of configuration.annualRules) {
    for (const eventYear of [year - 1, year, year + 1]) {
      const [startDate, endDate] = rule.dateRange(eventYear);
      events.push({
        id: `${rule.id}-${eventYear}`,
        label: rule.label,
        startDate,
        endDate,
        calendarYear: eventYear,
        categories: [...rule.categories],
        source: 'annual-demo-rule',
      });
    }
  }

  return events
    .filter(event => event.startDate <= date && date <= event.endDate)
    .sort((first, second) => first.startDate.localeCompare(second.startDate));
}

export function createCalendarService(configuration = COMMERCIAL_CALENDAR_CONFIGURATION) {
  if (!configuration || typeof configuration.version !== 'string'
    || !Array.isArray(configuration.fixedEvents)
    || !Array.isArray(configuration.annualRules)) {
    throw new TypeError('La configuración del calendario comercial no es válida.');
  }

  function metadataForDate(date) {
    if (!isValidDate(date)) {
      throw new DomainError('La fecha debe tener el formato YYYY-MM-DD y ser válida.', {
        code: 'INVALID_DATE',
      });
    }
    const year = Number(date.slice(0, 4));
    return {
      year,
      version: `${configuration.version}-${year}`,
      source: 'configured-demo-calendar',
      metadataOnly: true,
      affectsForecast: false,
    };
  }

  return Object.freeze({
    metadataForDate,

    eventsForDate(date, category) {
      const metadata = metadataForDate(date);
      return eventsOnDate(date, configuration)
        .filter(event => eventMatchesCategory(event, category))
        .map(({ categories, ...event }) => ({
          ...event,
          date,
          calendarVersion: `${configuration.version}-${event.calendarYear}`,
          categories,
          metadataOnly: true,
          affectsForecast: false,
        }));
    },
  });
}

export const calendarService = createCalendarService();
