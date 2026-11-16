import { save, type CalEvent, type Subject } from './store';
import { parse, today } from './dates';

export const TYPES = {
  examen: { label: 'Examen', color: '#ef4444' },
  entrega: { label: 'Entrega', color: '#f59e0b' },
  evento: { label: 'Evento', color: '#6366f1' },
} as const;
export type EventType = keyof typeof TYPES;

const PALETTE = ['#6366f1', '#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899'];

/** Id de la asignatura con ese nombre; si no existe, la crea. Nombre vacío = sin asignatura. */
export function subjectByName(subjects: Subject[], name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  const found = subjects.find(s => s.name.toLowerCase() === n.toLowerCase());
  return found ? found.id : save('subject', { name: n, color: PALETTE[subjects.length % PALETTE.length] }).id;
}

// Math.round absorbe la hora de más o de menos de los cambios de horario.
export const daysUntil = (date: string, from = today()) => Math.round((parse(date).getTime() - parse(from).getTime()) / 864e5);

export function countdown(date: string) {
  const n = daysUntil(date);
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : n > 0 ? `En ${n} días` : `Hace ${-n} días`;
}

/** Por fecha y, dentro del día, los de todo el día primero y luego por hora. */
export const byDate = (a: CalEvent, b: CalEvent) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');
