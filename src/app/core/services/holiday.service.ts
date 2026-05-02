import { Injectable } from '@angular/core';

/**
 * Colombia public holidays (festivos) by year.
 * Fixed holidays + "Ley de Puente" holidays (moved to next Monday when not already Monday).
 * Easter-dependent holidays computed per year.
 */

// ── Easter Sunday calculation (Anonymous Gregorian algorithm) ──────────────
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Return next Monday on-or-after the given date */
function nextMonday(d: Date): Date {
  const result = new Date(d);
  const dow = result.getDay(); // 0=Sun, 1=Mon
  if (dow !== 1) {
    const diff = dow === 0 ? 1 : (8 - dow);
    result.setDate(result.getDate() + diff);
  }
  return result;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Build the complete set of Colombian holiday date strings (YYYY-MM-DD) for a given year.
 */
function buildHolidaysForYear(year: number): Set<string> {
  const easter = getEaster(year);
  const set = new Set<string>();

  // ── Fixed holidays (never move) ──────────────────────────────────────────
  set.add(`${year}-01-01`); // Año Nuevo
  set.add(`${year}-05-01`); // Día del Trabajo
  set.add(`${year}-07-20`); // Grito de Independencia
  set.add(`${year}-08-07`); // Batalla de Boyacá
  set.add(`${year}-12-08`); // Inmaculada Concepción
  set.add(`${year}-12-25`); // Navidad

  // ── Easter-based fixed ───────────────────────────────────────────────────
  set.add(fmt(addDays(easter, -3))); // Jueves Santo
  set.add(fmt(addDays(easter, -2))); // Viernes Santo

  // ── Puente holidays (moved to next Monday) ───────────────────────────────
  const puenteDays: Date[] = [
    new Date(year, 0, 6),   // Reyes Magos (Jan 6)
    new Date(year, 2, 19),  // San José (Mar 19)
    addDays(easter, 39),    // Ascensión del Señor (Easter+39)
    addDays(easter, 60),    // Corpus Christi (Easter+60)
    addDays(easter, 68),    // Sagrado Corazón (Easter+68)
    new Date(year, 5, 29),  // San Pedro y San Pablo (Jun 29)
    new Date(year, 7, 15),  // Asunción de la Virgen (Aug 15)
    new Date(year, 9, 12),  // Día de la Raza (Oct 12)
    new Date(year, 10, 1),  // Todos los Santos (Nov 1)
    new Date(year, 10, 11), // Independencia de Cartagena (Nov 11)
  ];

  for (const d of puenteDays) {
    set.add(fmt(nextMonday(d)));
  }

  return set;
}

// Cache computed holiday sets to avoid recalculation
const holidayCache = new Map<number, Set<string>>();

function getHolidaysForYear(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, buildHolidaysForYear(year));
  }
  return holidayCache.get(year)!;
}

// ── Truface schedule per month ────────────────────────────────────────────

export interface TrufaceEntry {
  isRescheduled: boolean;
  /** The original Mon/Wed/Fri that was a holiday, as YYYY-MM-DD */
  originalDate?: string;
}

@Injectable({ providedIn: 'root' })
export class HolidayService {

  /** Check if a date is a Colombian public holiday */
  isHoliday(date: Date): boolean {
    const year = date.getFullYear();
    return getHolidaysForYear(year).has(this.toDateStr(date));
  }

  /**
   * Returns the next non-holiday, non-weekend date after `date`,
   * skipping any dates listed in `occupiedDates`.
   */
  getNextBusinessDay(date: Date, occupiedDates: Set<string> = new Set()): Date {
    let candidate = new Date(date);
    candidate.setDate(candidate.getDate() + 1);
    while (
      candidate.getDay() === 0 ||   // Sunday
      candidate.getDay() === 6 ||   // Saturday
      this.isHoliday(candidate) ||
      occupiedDates.has(this.toDateStr(candidate))
    ) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  /**
   * Compute the Truface schedule for a given month.
   * Returns a map from YYYY-MM-DD → TrufaceEntry.
   *
   * Algorithm (two-pass):
   *  1. Mark all non-holiday Mon/Wed/Fri as natural Truface days.
   *  2. For each holiday Mon/Wed/Fri (in order), displace to the next
   *     business day not already occupied by another Truface.
   */
  computeTrufaceSchedule(year: number, month: number): Map<string, TrufaceEntry> {
    const schedule = new Map<string, TrufaceEntry>();
    const occupied = new Set<string>(); // all Truface dates (natural + displaced)

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Pass 1 – natural (non-holiday) Mon/Wed/Fri
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay(); // 1=Mon, 3=Wed, 5=Fri
      if ([1, 3, 5].includes(dow) && !this.isHoliday(d)) {
        const ds = this.toDateStr(d);
        schedule.set(ds, { isRescheduled: false });
        occupied.add(ds);
      }
    }

    // Pass 2 – displace holiday Mon/Wed/Fri
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      if ([1, 3, 5].includes(dow) && this.isHoliday(d)) {
        const originalDs = this.toDateStr(d);
        // Find the immediate next business day (ignoring other Truface slots).
        // If that day already has a natural Truface, the holiday is absorbed
        // into it — no extra Truface is created (e.g. festivo viernes → lunes).
        const next = this.getNextBusinessDay(d);
        const nextDs = this.toDateStr(next);
        if (!occupied.has(nextDs)) {
          schedule.set(nextDs, { isRescheduled: true, originalDate: originalDs });
          occupied.add(nextDs);
        }
        // else: absorbed silently by the existing natural Truface on that day
      }
    }

    return schedule;
  }

  toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
