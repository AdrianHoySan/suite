// Contenido de los archivos de Estudio (PDFs, imágenes…). Los registros `doc` van por la
// sincronización normal; el contenido va aparte porque pesa mucho más:
// - en cada dispositivo, en IndexedDB (funciona sin conexión);
// - en Turso, en la tabla suite_files, troceado en base64.
// Se sube en segundo plano y en otro dispositivo se baja la primera vez que se abre.
import { useSyncExternalStore } from 'react';
import { getStatus, isConnected, onStatus, pipeline } from './sync';
import type { Doc } from './store';

const CHUNK = 256 * 1024;   // bytes por trozo
const PER_UPLOAD = 4;       // trozos por petición al subir (~1,4 MB en base64)
const PER_DOWNLOAD = 16;    // trozos por petición al bajar (~5,5 MB)
const PENDING_KEY = 'suite:files';

// ---------- IndexedDB ----------
let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= new Promise((resolve, reject) => {
  const req = indexedDB.open('suite-files', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('blobs');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
}));

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction('blobs', mode).objectStore('blobs'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbGet = (id: string) => idb<Blob | undefined>('readonly', s => s.get(id));
const idbPut = (id: string, blob: Blob) => idb('readwrite', s => s.put(blob, id));
const idbDel = (id: string) => idb('readwrite', s => s.delete(id));
const idbKeys = () => idb('readonly', s => s.getAllKeys()) as Promise<string[]>;

// ---------- base64 ----------
function toB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------- cambios pendientes de llevar a Turso ----------
type Op = 'up' | 'del';
let pending: Record<string, Op> = (() => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}'); } catch { return {}; }
})();
const listeners = new Set<() => void>();

function setPending(id: string, op: Op | null) {
  if (op) pending = { ...pending, [id]: op };
  else { const { [id]: _, ...rest } = pending; pending = rest; }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* sin espacio */ }
  listeners.forEach(fn => fn());
}

/** Número de archivos que aún no se han subido a Turso. */
export const usePendingUploads = () => useSyncExternalStore(
  fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  () => pending,
);

let running = false;
let again = false;

export async function syncFiles(): Promise<void> {
  if (!isConnected()) return;
  if (running) { again = true; return; }
  running = true;
  try {
    for (const [id, op] of Object.entries(pending)) {
      if (op === 'del') {
        await pipeline([['DELETE FROM suite_files WHERE id = ?', [id]]]);
      } else {
        const blob = await idbGet(id);
        if (blob) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
          for (let i = 0; i < n; i += PER_UPLOAD) {
            const stmts: [string, (string | number)[]][] = [];
            for (let k = i; k < Math.min(n, i + PER_UPLOAD); k++) {
              stmts.push(['INSERT OR REPLACE INTO suite_files (id, chunk, data) VALUES (?, ?, ?)', [id, k, toB64(bytes.subarray(k * CHUNK, (k + 1) * CHUNK))]]);
            }
            await pipeline(stmts);
          }
        }
      }
      if (pending[id] === op) setPending(id, null); // si cambió mientras tanto, sigue pendiente
    }
  } catch (e) {
    console.warn('Archivos', e);
  } finally {
    running = false;
    if (again) { again = false; syncFiles(); }
  }
}

// ---------- API ----------

export async function putFile(file: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await idbPut(id, file);
  setPending(id, 'up');
  navigator.storage?.persist?.().catch(() => {}); // que el navegador no lo borre por falta de espacio
  syncFiles();
  return id;
}

export async function deleteFile(id: string) {
  await idbDel(id).catch(() => {});
  setPending(id, 'del');
  syncFiles();
}

/** Contenido de un archivo: de este dispositivo o, si no está, bajado de Turso. null = no disponible. */
export async function getFile(doc: Doc): Promise<Blob | null> {
  if (!doc.fileId) return null;
  const local = await idbGet(doc.fileId);
  if (local) return local;
  if (!isConnected()) return null;

  const expected = Math.max(1, Math.ceil((doc.size ?? 0) / CHUNK));
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (let i = 0; i < expected; i += PER_DOWNLOAD) {
    const [rows] = await pipeline([[
      'SELECT data FROM suite_files WHERE id = ? AND chunk >= ? AND chunk < ? ORDER BY chunk',
      [doc.fileId, i, i + PER_DOWNLOAD],
    ]]);
    parts.push(...rows.map(r => fromB64(r.data ?? '')));
  }
  if (parts.length !== expected) throw new Error('El archivo aún no ha terminado de subirse desde el otro dispositivo. Prueba en un rato.');
  const blob = new Blob(parts, { type: doc.mime || 'application/octet-stream' });
  await idbPut(doc.fileId, blob);
  return blob;
}

/** Borra de este dispositivo los archivos cuyo documento ya no existe (p. ej. borrado en otro). */
export async function cleanupFiles(docs: Doc[]) {
  const used = new Set(docs.map(d => d.fileId));
  for (const key of await idbKeys()) if (!used.has(key) && pending[key] !== 'up') await idbDel(key);
}

onStatus(() => { if (getStatus().state === 'idle') syncFiles(); });
window.addEventListener('online', () => syncFiles());
syncFiles();
