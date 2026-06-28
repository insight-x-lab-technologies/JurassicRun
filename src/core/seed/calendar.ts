// Matemática de calendário e semana ISO-8601, pura e portável.
// Só aritmética inteira: sem `Date`, sem float sensível.

export interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1–12
  readonly day: number; // 1–31
}

export interface IsoWeek {
  readonly weekYear: number;
  readonly week: number; // 1–53
}

// Dias acumulados até o início de cada mês (ano comum).
const CUMULATIVE_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function ordinalDay(date: CalendarDate): number {
  let day = CUMULATIVE_DAYS[date.month - 1]! + date.day;
  if (date.month > 2 && isLeapYear(date.year)) day += 1;
  return day;
}

// Algoritmo de Sakamoto: retorna 0=domingo..6=sábado; remapeado para ISO 1=seg..7=dom.
const SAKAMOTO = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

export function dayOfWeek(date: CalendarDate): number {
  let y = date.year;
  if (date.month < 3) y -= 1;
  const w =
    (y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) +
      SAKAMOTO[date.month - 1]! +
      date.day) %
    7;
  return w === 0 ? 7 : w;
}

// Dia da semana (0=dom..6=sáb) de 31/dez do ano, via fórmula de Gauss.
function decemberDoomsday(year: number): number {
  return (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400)) % 7;
}

export function weeksInYear(year: number): number {
  return decemberDoomsday(year) === 4 || decemberDoomsday(year - 1) === 3 ? 53 : 52;
}

export function isoWeekOf(date: CalendarDate): IsoWeek {
  const dow = dayOfWeek(date);
  const week = Math.floor((ordinalDay(date) - dow + 10) / 7);
  if (week < 1) {
    const weekYear = date.year - 1;
    return { weekYear, week: weeksInYear(weekYear) };
  }
  if (week > weeksInYear(date.year)) {
    return { weekYear: date.year + 1, week: 1 };
  }
  return { weekYear: date.year, week };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

export function formatCalendarDate(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

export function formatIsoWeek(week: IsoWeek): string {
  return `${pad(week.weekYear, 4)}-W${pad(week.week, 2)}`;
}
