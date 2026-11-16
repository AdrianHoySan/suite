// Almacén local de toda la suite. localStorage es la copia de trabajo: la app funciona sin
// conexión y sync.ts sube los cambios pendientes y baja los de otros dispositivos.
// Cada registro pertenece a un "kind" (habit, shopItem…) y gana siempre el cambio más reciente.
import { useSyncExternalStore } from 'react';
import { SEED_DIET, SEED_GOALS, SEED_HABITS, SEED_ROUTINES } from './seed';

export interface Rec { id: string; createdAt: string; updatedAt: string }
export interface Habit extends Rec { name: string; emoji: string }
/** Un registro por hábito y día; el id es `${habitId}:${date}` para que dos dispositivos no dupliquen. */
export interface HabitLog extends Rec { habitId: string; date: string; done: boolean }
export interface ShopItem extends Rec { name: string; done: boolean }


// ---------- gimnasio ----------
export interface SetTpl { weight: number; reps: number }
export interface WorkoutSet extends SetTpl { done: boolean }
interface ExerciseBase {
  /** Identifica el ejercicio en todas las rutinas y entrenamientos: su historial es uno solo. */
  exId: string; name: string; group: string;
  /** Unidad de las repeticiones si no son repeticiones (p. ej. 'seg' en una plancha). */
  unit?: string; optional?: boolean;
}
export interface RoutineExercise extends ExerciseBase { sets: SetTpl[] }
export interface WorkoutExercise extends ExerciseBase { sets: WorkoutSet[] }
/** weekday: 0 = lunes … 6 = domingo; null = sin día fijo. */
export interface Routine extends Rec { name: string; weekday: number | null; exercises: RoutineExercise[] }
/** Un entrenamiento está en curso mientras finishedAt sea null. */
export interface Workout extends Rec {
  routineId: string | null; name: string; date: string; startedAt: string; finishedAt: string | null;
  lastSetAt?: string; exercises: WorkoutExercise[];
}

// ---------- dieta ----------
export interface Food { name: string; calories: number; protein: number; carbs: number; fats: number; done?: boolean }
export type Meals = Record<string, Food[]>;
export interface DietGoal extends Rec { calories: number; protein: number; carbs: number; fats: number }
/** Plantilla de un día de la semana (id `plan-0` … `plan-6`). */
export interface DietPlan extends Rec { weekday: number; note?: string; meals: Meals }
/** Lo comido un día concreto (id = fecha). Solo existe si ese día se ha tocado; si no, se ve el plan. */
export interface DietDay extends Rec { date: string; meals: Meals }

// ---------- calendario ----------
/** Asignatura: la comparten el calendario y, más adelante, el módulo de estudio. */
export interface Subject extends Rec { name: string; color: string }
export interface CalEvent extends Rec {
  title: string; type: 'examen' | 'entrega' | 'evento'; date: string;
  /** 'HH:MM'; sin hora = todo el día. */
  time?: string; subjectId?: string | null; notes?: string;
}

// ---------- estudio ----------
export type TopicStatus = 'pendiente' | 'leido' | 'resumido' | 'repasado';
export interface Topic extends Rec { subjectId: string; name: string; status: TopicStatus }
/**
 * Archivo subido (kind 'file': el contenido va aparte, en files.ts) o resumen escrito en la app
 * (kind 'note': el texto va en el propio registro). topicId null = sin tema ("General").
 */
export interface Doc extends Rec {
  subjectId: string; topicId: string | null; name: string; kind: 'file' | 'note';
  fileId?: string; fileName?: string; size?: number; mime?: string; text?: string;
}

interface Kinds {
  habit: Habit; habitLog: HabitLog; shopItem: ShopItem;
  routine: Routine; workout: Workout;
  dietGoal: DietGoal; dietPlan: DietPlan; dietDay: DietDay;
  subject: Subject; event: CalEvent;
  topic: Topic; doc: Doc;
}
export type Kind = keyof Kinds;
type Fields<K extends Kind> = Omit<Kinds[K], keyof Rec>;
// Indexado por string a propósito: si otro dispositivo con una versión más nueva sube un kind
// que este aún no conoce, se guarda igualmente en vez de perderse.
type Data = Record<string, Rec[]>;

export interface PendingItem { kind: string; id: string; at: string; rec: Rec | null }
export interface RemoteRow { kind: string; id: string; updatedAt: string; deleted: boolean; data: Rec | null }
interface ChangeInfo { silent?: boolean }

const DATA_KEY = 'suite:v1';
const DIRTY_KEY = 'suite:dirty';
const SEED_KEY = 'suite:seed';
const SEED_VERSION = 2;
const EMPTY: Rec[] = [];

function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('No se pudo guardar', e); }
}

// Los datos de partida se añaden una sola vez por versión: los de un módulo nuevo llegan también
// a quien ya usaba la app, y lo que el usuario haya borrado después no reaparece.
function load(): Data {
  const saved = read<Data>(DATA_KEY);
  const version = read<number>(SEED_KEY) ?? (saved ? 1 : 0);
  if (saved && version >= SEED_VERSION) return saved;
  const d: Data = saved ?? {};
  const add = (kind: Kind, recs: Rec[]) => {
    const have = new Set((d[kind] ?? []).map(x => x.id));
    d[kind] = [...(d[kind] ?? []), ...recs.filter(r => !have.has(r.id))];
  };
  if (version < 1) add('habit', SEED_HABITS);
  if (version < 2) {
    add('routine', SEED_ROUTINES);
    add('dietGoal', SEED_GOALS);
    add('dietPlan', SEED_DIET);
  }
  write(DATA_KEY, d);
  write(SEED_KEY, SEED_VERSION);
  return d;
}

let data: Data = load();
/** Cambios sin subir: "kind/id" → fecha del cambio. Si el registro ya no existe, es un borrado. */
let dirty: Record<string, string> = read(DIRTY_KEY) ?? {};
const listeners = new Set<(info: ChangeInfo) => void>();

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
/** Fecha de cambio estrictamente posterior a `prev`, aunque el reloj vaya atrasado. */
const after = (prev?: string) => {
  const t = now();
  return prev && t <= prev ? new Date(Date.parse(prev) + 1).toISOString() : t;
};

function commit(info: ChangeInfo = {}) {
  write(DATA_KEY, data);
  write(DIRTY_KEY, dirty);
  listeners.forEach(fn => fn(info));
}

export function onChange(fn: (info: ChangeInfo) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Crea un registro (sin id, o con un id que no existe) o actualiza los campos indicados. */
export function save<K extends Kind>(kind: K, rec: Partial<Fields<K>> & { id?: string }): Kinds[K] {
  const list = data[kind] ?? [];
  const i = rec.id ? list.findIndex(x => x.id === rec.id) : -1;
  const prev = list[i];
  const id = rec.id ?? uid();
  const at = after(prev?.updatedAt ?? dirty[`${kind}/${id}`]);
  const next = { ...(prev ?? { createdAt: at }), ...rec, id, updatedAt: at } as Kinds[K];
  data = { ...data, [kind]: i >= 0 ? list.with(i, next) : [...list, next] };
  dirty[`${kind}/${id}`] = at;
  commit();
  return next;
}

export function remove(kind: Kind, ...ids: string[]) {
  const list = data[kind] ?? [];
  const gone = list.filter(x => ids.includes(x.id));
  if (!gone.length) return;
  data = { ...data, [kind]: list.filter(x => !ids.includes(x.id)) };
  for (const x of gone) dirty[`${kind}/${x.id}`] = after(x.updatedAt);
  commit();
}

export function useAll<K extends Kind>(kind: K): Kinds[K][] {
  return useSyncExternalStore(onChange, () => (data[kind] ?? EMPTY) as Kinds[K][]);
}

// ---------- para sync.ts ----------

export function pending(): PendingItem[] {
  return Object.entries(dirty).map(([key, at]) => {
    const cut = key.indexOf('/');
    const kind = key.slice(0, cut), id = key.slice(cut + 1);
    return { kind, id, at, rec: data[kind]?.find(x => x.id === id) ?? null };
  });
}

export function markSynced(items: PendingItem[]) {
  // Si el registro volvió a cambiar mientras se subía, sigue pendiente.
  for (const { kind, id, at } of items) if (dirty[`${kind}/${id}`] === at) delete dirty[`${kind}/${id}`];
  write(DIRTY_KEY, dirty);
}

export function markAllDirty() {
  for (const [kind, list] of Object.entries(data)) for (const x of list) dirty[`${kind}/${x.id}`] ??= x.updatedAt;
  write(DIRTY_KEY, dirty);
}

export function applyRemote(rows: RemoteRow[]) {
  let changed = false;
  const next = { ...data };
  for (const { kind, id, updatedAt, deleted, data: rec } of rows) {
    const list = next[kind] ?? [];
    const i = list.findIndex(x => x.id === id);
    const local = dirty[`${kind}/${id}`] ?? list[i]?.updatedAt;
    if (local && local >= updatedAt) continue;
    delete dirty[`${kind}/${id}`];
    if (deleted || !rec) next[kind] = list.filter(x => x.id !== id);
    else next[kind] = i >= 0 ? list.with(i, rec) : [...list, rec];
    changed = true;
  }
  if (!changed) return;
  data = next;
  commit({ silent: true });
}

// ---------- copia de seguridad ----------

export const exportJSON = () => JSON.stringify({ app: 'suite', version: 1, exportedAt: now(), data }, null, 2);

/** Combina una copia con lo que hay: no borra nada y, registro a registro, gana el más reciente. */
export function importJSON(text: string): number {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'suite' || typeof parsed.data !== 'object') throw new Error('El archivo no es una copia de Suite');
  let count = 0;
  const next = { ...data };
  for (const [kind, list] of Object.entries(parsed.data as Data)) {
    if (!Array.isArray(list)) continue;
    for (const rec of list) {
      if (!rec?.id || !rec.updatedAt) continue;
      const cur = next[kind] ?? [];
      const i = cur.findIndex(x => x.id === rec.id);
      if (i >= 0 && cur[i].updatedAt >= rec.updatedAt) continue;
      next[kind] = i >= 0 ? cur.with(i, rec) : [...cur, rec];
      dirty[`${kind}/${rec.id}`] = rec.updatedAt;
      count++;
    }
  }
  data = next;
  commit();
  return count;
}

// Otra pestaña del mismo navegador ha guardado: recargar sin volver a programar una subida.
window.addEventListener('storage', e => {
  if (e.key !== DATA_KEY) return;
  data = read<Data>(DATA_KEY) ?? data;
  dirty = read(DIRTY_KEY) ?? {};
  listeners.forEach(fn => fn({ silent: true }));
});
