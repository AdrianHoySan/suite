// Sincronización con una base de datos de Turso por su API HTTP (sin librerías), igual que en
// Bitácora. Todo va en una tabla `suite` con un registro JSON por fila; gana el cambio más reciente.
import { useSyncExternalStore } from 'react';
import * as Store from './store';

type Arg = string | number | null;
type Stmt = [sql: string, args?: Arg[]];
type Row = Record<string, string | null>;
export interface Status { state: 'off' | 'idle' | 'syncing' | 'error'; message: string; lastSync?: string; url?: string }

const CREDS_KEY = 'suite:turso';
const META_KEY = 'suite:sync';
const CHUNK = 200;

function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function write(key: string, value: unknown) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin espacio */ }
}

let creds = read<{ url: string; token: string }>(CREDS_KEY);
let meta = read<{ cursor?: string; lastSync?: string }>(META_KEY) ?? {};
let status: Status = { state: creds ? 'idle' : 'off', message: '', lastSync: meta.lastSync, url: creds?.url };
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setStatus(state: Status['state'], message = '') {
  status = { state, message, lastSync: meta.lastSync, url: creds?.url };
  listeners.forEach(fn => fn());
}

// libsql://base-org.turso.io → https://base-org.turso.io
const normalizeUrl = (u: string) => u.trim().replace(/^(libsql|turso|wss?):\/\//, 'https://').replace(/\/+$/, '');

const arg = (v: Arg) => v == null ? { type: 'null' }
  : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v })
  : { type: 'text', value: v };

export async function pipeline(stmts: Stmt[]): Promise<Row[][]> {
  if (!creds) throw new Error('No conectado');
  let res: Response;
  try {
    res = await fetch(creds.url + '/v2/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [...stmts.map(([sql, args = []]) => ({ type: 'execute', stmt: { sql, args: args.map(arg) } })), { type: 'close' }],
      }),
    });
  } catch {
    throw new Error(navigator.onLine === false ? 'Sin conexión' : 'No se pudo conectar con Turso (revisa la URL)');
  }
  if (res.status === 401 || res.status === 403) throw new Error('El token no es válido o ha caducado');
  if (!res.ok) throw new Error(`Turso respondió ${res.status}`);
  const body = await res.json();
  return body.results.slice(0, stmts.length).map((r: any) => {
    if (r.type === 'error') throw new Error(r.error?.message || 'Error de Turso');
    const { cols, rows } = r.response.result;
    return rows.map((row: any[]) => Object.fromEntries(row.map((cell, i) => [cols[i].name, cell.type === 'null' ? null : cell.value])));
  });
}

const SCHEMA: Stmt[] = [
  [`CREATE TABLE IF NOT EXISTS suite (
     kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT, updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0, synced_at TEXT NOT NULL, PRIMARY KEY (kind, id))`],
  ['CREATE INDEX IF NOT EXISTS suite_synced ON suite (synced_at)'],
  // Contenido de los archivos de Estudio, troceado y en base64 (ver files.ts).
  ['CREATE TABLE IF NOT EXISTS suite_files (id TEXT NOT NULL, chunk INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, chunk))'],
];

// synced_at lo pone el servidor: sirve de cursor para bajar solo lo nuevo sin depender
// del reloj de cada dispositivo.
const UPSERT = `INSERT INTO suite (kind, id, data, updated_at, deleted, synced_at)
  VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
    deleted = excluded.deleted, synced_at = excluded.synced_at
  WHERE excluded.updated_at > suite.updated_at`;

async function run() {
  setStatus('syncing');
  const items = Store.pending();
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await pipeline(chunk.map(({ kind, id, at, rec }) =>
      [UPSERT, [kind, id, rec ? JSON.stringify(rec) : null, at, rec ? 0 : 1]]));
    Store.markSynced(chunk);
  }

  const [rows] = await pipeline([[
    'SELECT kind, id, data, updated_at, deleted, synced_at FROM suite WHERE synced_at > ? ORDER BY synced_at',
    [meta.cursor ?? ''],
  ]]);
  Store.applyRemote(rows.map(r => ({
    kind: r.kind!, id: r.id!, updatedAt: r.updated_at!, deleted: r.deleted === '1',
    data: r.data ? JSON.parse(r.data) : null,
  })));
  if (rows.length) meta.cursor = rows.at(-1)!.synced_at!;
  meta.lastSync = new Date().toISOString();
  write(META_KEY, meta);
  setStatus('idle');
}

export function sync(): Promise<void> {
  if (!creds) return Promise.resolve();
  if (running) { again = true; return running; }
  running = run()
    .catch(e => { console.warn('Sincronización', e); setStatus('error', e.message); })
    .finally(() => {
      running = null;
      if (again) { again = false; sync(); }
    });
  return running;
}

export async function connect(url: string, token: string) {
  const prev = creds;
  creds = { url: normalizeUrl(url), token: token.trim() };
  try {
    await pipeline(SCHEMA);
  } catch (e) {
    creds = prev;
    throw e;
  }
  write(CREDS_KEY, creds);
  meta = {};
  write(META_KEY, meta);
  Store.markAllDirty(); // lo que ya hay en este navegador se sube y se combina con lo de Turso
  await sync();
  if (status.state === 'error') throw new Error(status.message);
}

export function disconnect() {
  creds = null;
  meta = {};
  write(CREDS_KEY, null);
  write(META_KEY, null);
  setStatus('off');
}

export const isConnected = () => creds != null;
export const getStatus = () => status;
export function onStatus(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useSyncStatus(): Status {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => status);
}

// Tras cada cambio local, subir al cabo de un momento (agrupa cambios seguidos).
Store.onChange(({ silent }) => {
  if (silent || !creds) return;
  clearTimeout(timer);
  timer = setTimeout(sync, 1500);
});
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 2 * 60 * 1000);
sync();
