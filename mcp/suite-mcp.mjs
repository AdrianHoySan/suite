#!/usr/bin/env node
// Servidor MCP de la Suite: deja que Claude consulte y amplíe el módulo de Estudio (asignaturas,
// temas, resúmenes y archivos), el calendario y la lista de la compra, escribiendo directamente
// en Turso. La app lo recibe en su siguiente sincronización.
//
// Sin dependencias: habla MCP por stdio (JSON-RPC, un mensaje por línea) y Turso por HTTP.
// Credenciales en variables de entorno: SUITE_TURSO_URL y SUITE_TURSO_TOKEN.
// Los registros tienen la misma forma que en la app (src/lib/store.ts) y los archivos se trocean
// igual que en src/lib/files.ts.

import { createInterface } from 'node:readline';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const URL_ = (process.env.SUITE_TURSO_URL || '').trim().replace(/^(libsql|turso|wss?):\/\//, 'https://').replace(/\/+$/, '');
const TOKEN = (process.env.SUITE_TURSO_TOKEN || '').trim();

const CHUNK = 256 * 1024;
const PER_UPLOAD = 4;
const MAX_FILE = 50 * 1024 * 1024;
const PALETTE = ['#6366f1', '#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899'];
const STATUSES = ['pendiente', 'leido', 'resumido', 'repasado'];
const EVENT_TYPES = ['examen', 'entrega', 'evento'];
const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text', '.zip': 'application/zip',
};

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
/** Hoy en hora local, como lo cuenta la app. */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** Fecha de cambio estrictamente posterior a `prev`, aunque el reloj vaya atrasado. */
const after = prev => { const t = new Date().toISOString(); return prev && t <= prev ? new Date(Date.parse(prev) + 1).toISOString() : t; };

// ---------- Turso ----------
const arg = v => v == null ? { type: 'null' }
  : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v })
  : { type: 'text', value: String(v) };

async function pipeline(stmts) {
  if (!URL_ || !TOKEN) throw new Error('Faltan SUITE_TURSO_URL y SUITE_TURSO_TOKEN en la configuración del servidor MCP');
  let res;
  try {
    res = await fetch(URL_ + '/v2/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [...stmts.map(([sql, args = []]) => ({ type: 'execute', stmt: { sql, args: args.map(arg) } })), { type: 'close' }],
      }),
    });
  } catch (e) {
    throw new Error('No se pudo conectar con Turso: ' + e.message);
  }
  if (res.status === 401 || res.status === 403) throw new Error('El token de Turso no es válido o ha caducado');
  if (!res.ok) throw new Error(`Turso respondió ${res.status}`);
  const body = await res.json();
  return body.results.slice(0, stmts.length).map(r => {
    if (r.type === 'error') throw new Error(r.error?.message || 'Error de Turso');
    const { cols, rows } = r.response.result;
    return rows.map(row => Object.fromEntries(row.map((cell, i) => [cols[i].name, cell.type === 'null' ? null : cell.value])));
  });
}

// Mismo esquema que crea la app al conectar (src/lib/sync.ts).
const SCHEMA = [
  [`CREATE TABLE IF NOT EXISTS suite (
     kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT, updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0, synced_at TEXT NOT NULL, PRIMARY KEY (kind, id))`],
  ['CREATE INDEX IF NOT EXISTS suite_synced ON suite (synced_at)'],
  ['CREATE TABLE IF NOT EXISTS suite_files (id TEXT NOT NULL, chunk INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, chunk))'],
];
let ready = null;
const ensureSchema = () => (ready ??= pipeline(SCHEMA).catch(e => { ready = null; throw e; }));

const UPSERT = `INSERT INTO suite (kind, id, data, updated_at, deleted, synced_at)
  VALUES (?, ?, ?, ?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
    deleted = 0, synced_at = excluded.synced_at
  WHERE excluded.updated_at > suite.updated_at`;

/** Registros vivos de los tipos pedidos: { subject: [...], topic: [...], … } */
async function load(...kinds) {
  await ensureSchema();
  const [rows] = await pipeline([[
    `SELECT kind, data FROM suite WHERE deleted = 0 AND data IS NOT NULL AND kind IN (${kinds.map(() => '?').join(', ')})`, kinds,
  ]]);
  const out = Object.fromEntries(kinds.map(k => [k, []]));
  for (const r of rows) out[r.kind].push(JSON.parse(r.data));
  return out;
}

/** Prepara el guardado de un registro (nuevo o actualizado); se envían todos juntos con commit(). */
function put(stmts, kind, { _new, ...rec }) {
  const at = after(rec.updatedAt);
  const full = { ...rec, id: rec.id ?? randomUUID(), createdAt: rec.createdAt ?? at, updatedAt: at };
  stmts.push([UPSERT, [kind, full.id, JSON.stringify(full), at]]);
  return full;
}
const commit = stmts => (stmts.length ? pipeline(stmts) : Promise.resolve());

// ---------- búsquedas por nombre ----------
function findSubject(subjects, ref, { create = false, stmts } = {}) {
  const n = norm(ref);
  if (!n) throw new Error('falta la asignatura');
  const found = subjects.find(s => s.id === ref) ?? subjects.find(s => norm(s.name) === n);
  if (found) return found;
  if (!create) {
    throw new Error(`no existe la asignatura «${ref}». Hay: ${subjects.map(s => s.name).join(', ') || 'ninguna'}`);
  }
  const rec = put(stmts, 'subject', { name: String(ref).trim(), color: PALETTE[subjects.length % PALETTE.length] });
  subjects.push(rec);
  rec._new = true;
  return rec;
}

function findTopic(topics, subject, ref, { create = false, stmts } = {}) {
  if (ref == null || ref === '' || norm(ref) === 'general') return null;
  const mine = topics.filter(t => t.subjectId === subject.id);
  const found = mine.find(t => t.id === ref) ?? mine.find(t => norm(t.name) === norm(ref));
  if (found) return found;
  if (!create) throw new Error(`no existe el tema «${ref}» en ${subject.name}. Hay: ${mine.map(t => t.name).join(', ') || 'ninguno'}`);
  const rec = put(stmts, 'topic', { subjectId: subject.id, name: String(ref).trim(), status: 'pendiente' });
  topics.push(rec);
  rec._new = true;
  return rec;
}

function findPractice(practices, subject, ref, { create = false, stmts, dueDate } = {}) {
  const mine = practices.filter(p => p.subjectId === subject.id);
  const found = mine.find(p => p.id === ref) ?? mine.find(p => norm(p.name) === norm(ref));
  if (found) return found;
  if (!create) throw new Error(`no existe la práctica «${ref}» en ${subject.name}. Hay: ${mine.map(p => p.name).join(', ') || 'ninguna'}`);
  const rec = put(stmts, 'practice', { subjectId: subject.id, name: String(ref).trim(), dueDate: dueDate ?? null, done: false, doneAt: null });
  practices.push(rec);
  rec._new = true;
  return rec;
}

/** Destino de un documento: una práctica o un tema (que se crean si no existen), o "General". */
function target(data, subject, { tema, practica }, stmts) {
  if (practica && tema) throw new Error('indica tema o práctica, no los dos');
  if (practica) {
    const p = findPractice(data.practice, subject, practica, { create: true, stmts });
    return { topicId: null, practiceId: p.id, donde: `práctica ${p.name}${p._new ? ' (nueva)' : ''}` };
  }
  const t = findTopic(data.topic, subject, tema, { create: true, stmts });
  return { topicId: t?.id ?? null, practiceId: null, donde: t ? `tema ${t.name}${t._new ? ' (nuevo)' : ''}` : 'General', topic: t };
}

/** Prácticas pendientes con fecha, como entregas del calendario (igual que en la app). */
const practiceEvents = practices => practices.filter(p => !p.done && p.dueDate)
  .map(p => ({ id: p.id, type: 'practica', title: p.name, date: p.dueDate, subjectId: p.subjectId }));

const fileSize = n => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
const byDate = (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '');

// ---------- herramientas ----------
const asignaturaProp = { type: 'string', description: 'Nombre (o id) de la asignatura. Da igual mayúsculas y tildes.' };
const temaProp = { type: 'string', description: 'Nombre (o id) del tema dentro de la asignatura. Vacío o "General" = sin tema.' };
const practicaProp = { type: 'string', description: 'En vez de tema: nombre (o id) de la práctica a la que pertenece (enunciado, material, entrega…).' };
const isDateOrNull = v => v == null || v === '' || isDate(v);

const TOOLS = [
  {
    name: 'ver_estudio',
    description: 'Lista las asignaturas con sus temas (y su estado: pendiente, leido, resumido, repasado), sus prácticas (fecha de entrega, si están finalizadas y su material), sus documentos ' +
      '(resúmenes y archivos, con su id) y sus próximos exámenes y entregas. Úsala antes de guardar algo para usar los nombres exactos.',
    inputSchema: { type: 'object', properties: { asignatura: { ...asignaturaProp, description: 'Opcional: solo esta asignatura.' } } },
    async run({ asignatura }) {
      const { subject, topic, doc, event, practice } = await load('subject', 'topic', 'doc', 'event', 'practice');
      const list = asignatura ? [findSubject(subject, asignatura)] : [...subject].sort((a, b) => a.name.localeCompare(b.name));
      const now = today();
      const docInfo = d => ({ id: d.id, nombre: d.name, tipo: d.kind === 'note' ? 'resumen' : 'archivo', ...(d.kind === 'file' ? { tamaño: fileSize(d.size ?? 0) } : { caracteres: (d.text ?? '').length }) });
      return list.map(s => {
        const ts = topic.filter(t => t.subjectId === s.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const ps = practice.filter(p => p.subjectId === s.id)
          .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
        const ds = doc.filter(d => d.subjectId === s.id);
        const inPractice = d => d.practiceId && ps.some(p => p.id === d.practiceId);
        return {
          id: s.id,
          asignatura: s.name,
          temas: ts.map(t => ({ id: t.id, nombre: t.name, estado: t.status, documentos: ds.filter(d => d.topicId === t.id && !inPractice(d)).map(docInfo) })),
          practicas: ps.map(p => ({
            id: p.id, nombre: p.name, entrega: p.dueDate ?? null, finalizada: !!p.done, ...(p.doneAt ? { finalizada_el: p.doneAt } : {}),
            material: ds.filter(d => d.practiceId === p.id).map(docInfo),
          })),
          general: ds.filter(d => !inPractice(d) && (!d.topicId || !ts.some(t => t.id === d.topicId))).map(docInfo),
          proximos: [...event, ...practiceEvents(ps)].filter(e => e.subjectId === s.id && e.date >= now).sort(byDate)
            .map(e => ({ tipo: e.type, titulo: e.title, fecha: e.date, ...(e.time ? { hora: e.time } : {}) })),
        };
      });
    },
  },
  {
    name: 'leer_resumen',
    description: 'Devuelve el texto de un resumen guardado (por su id, de ver_estudio). Los archivos (PDF, Word…) no se pueden leer desde aquí: pide al usuario que los adjunte en el chat.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    async run({ id }) {
      const { doc } = await load('doc');
      const d = doc.find(x => x.id === id);
      if (!d) throw new Error('no existe ese documento');
      if (d.kind !== 'note') throw new Error(`«${d.name}» es un archivo (${d.fileName ?? d.mime}); su contenido no se puede leer desde aquí`);
      return { id: d.id, nombre: d.name, texto: d.text ?? '' };
    },
  },
  {
    name: 'guardar_resumen',
    description: 'Guarda un resumen o una nota (texto) en Estudio, dentro de una asignatura y un tema o una práctica. Si no se da id, crea uno nuevo; ' +
      'si la asignatura, el tema o la práctica no existen, se crean. Con id, cambia ese resumen: modo "reemplazar" (por defecto) o "añadir" al final. ' +
      'El texto se muestra tal cual (texto plano): usa títulos en líneas propias, guiones para listas y líneas en blanco entre bloques; nada de tablas ni HTML.',
    inputSchema: {
      type: 'object',
      properties: {
        asignatura: asignaturaProp,
        tema: temaProp,
        practica: practicaProp,
        titulo: { type: 'string', description: 'Título del resumen (p. ej. «Resumen del tema 3»).' },
        texto: { type: 'string' },
        id: { type: 'string', description: 'Opcional: id de un resumen existente para cambiarlo.' },
        modo: { type: 'string', enum: ['reemplazar', 'añadir'], default: 'reemplazar' },
        marcar_resumido: { type: 'boolean', default: false, description: 'Poner el tema en estado «resumido» (si estaba por detrás).' },
      },
      required: ['texto'],
    },
    async run({ asignatura, tema, practica, titulo, texto, id, modo = 'reemplazar', marcar_resumido = false }) {
      const text = String(texto ?? '').replace(/\r\n/g, '\n').trim();
      if (!text) throw new Error('el texto está vacío');
      if (text.length > 200_000) throw new Error('el texto es demasiado largo (máx. 200 000 caracteres)');
      const data = await load('subject', 'topic', 'doc', 'practice');
      const stmts = [];

      if (id) {
        const d = data.doc.find(x => x.id === id);
        if (!d) throw new Error('no existe ese resumen');
        if (d.kind !== 'note') throw new Error('ese documento es un archivo, no un resumen');
        const next = modo === 'añadir' ? `${(d.text ?? '').trimEnd()}\n\n${text}` : text;
        const rec = put(stmts, 'doc', { ...d, text: next, ...(titulo ? { name: String(titulo).trim() } : {}) });
        await commit(stmts);
        return { actualizado: rec.id, nombre: rec.name, caracteres: next.length, nota: 'La app lo recibirá en la próxima sincronización.' };
      }

      const subject = findSubject(data.subject, asignatura, { create: true, stmts });
      const where = target(data, subject, { tema, practica }, stmts);
      const topic = where.topic;
      const rec = put(stmts, 'doc', {
        subjectId: subject.id, topicId: where.topicId, practiceId: where.practiceId, kind: 'note',
        name: String(titulo ?? '').trim() || (topic ? `Resumen de ${topic.name}` : where.practiceId ? 'Notas' : 'Resumen'), text,
      });
      if (marcar_resumido && topic && STATUSES.indexOf(topic.status) < STATUSES.indexOf('resumido')) {
        put(stmts, 'topic', { ...topic, status: 'resumido' });
      }
      await commit(stmts);
      return {
        creado: rec.id, nombre: rec.name, asignatura: subject.name + (subject._new ? ' (nueva)' : ''), en: where.donde,
        nota: 'La app lo recibirá en la próxima sincronización.',
      };
    },
  },
  {
    name: 'subir_archivo',
    description: 'Sube un archivo de este ordenador (PDF, Word, PowerPoint, imagen…; máx. 50 MB) a Estudio, dentro de una asignatura y un tema o una práctica. ' +
      'Úsala para guardar trabajos, apuntes o el material de una práctica que ya existen en disco. Si la asignatura, el tema o la práctica no existen, se crean.',
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string', description: 'Ruta absoluta del archivo en este ordenador.' },
        asignatura: asignaturaProp,
        tema: temaProp,
        practica: practicaProp,
        nombre: { type: 'string', description: 'Opcional: nombre a mostrar (por defecto, el del archivo sin extensión).' },
      },
      required: ['ruta', 'asignatura'],
    },
    async run({ ruta, asignatura, tema, practica, nombre }) {
      const path = resolve(String(ruta ?? ''));
      let info;
      try { info = await stat(path); } catch { throw new Error(`no se encuentra el archivo ${path}`); }
      if (!info.isFile()) throw new Error(`${path} no es un archivo`);
      if (info.size > MAX_FILE) throw new Error(`el archivo pesa ${fileSize(info.size)}; el máximo es ${fileSize(MAX_FILE)}`);

      const data = await load('subject', 'topic', 'practice');
      const stmts = [];
      const subject = findSubject(data.subject, asignatura, { create: true, stmts });
      const where = target(data, subject, { tema, practica }, stmts);

      // Primero el contenido y después el registro: así ningún dispositivo ve el documento a medio subir.
      const bytes = await readFile(path);
      const fileId = randomUUID();
      const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
      for (let i = 0; i < n; i += PER_UPLOAD) {
        const chunkStmts = [];
        for (let k = i; k < Math.min(n, i + PER_UPLOAD); k++) {
          chunkStmts.push(['INSERT OR REPLACE INTO suite_files (id, chunk, data) VALUES (?, ?, ?)', [fileId, k, bytes.subarray(k * CHUNK, (k + 1) * CHUNK).toString('base64')]]);
        }
        await pipeline(chunkStmts);
      }
      const fileName = basename(path);
      const rec = put(stmts, 'doc', {
        subjectId: subject.id, topicId: where.topicId, practiceId: where.practiceId, kind: 'file', fileId, fileName,
        name: String(nombre ?? '').trim() || fileName.replace(/\.[^.]+$/, ''), size: bytes.length,
        mime: MIME[extname(fileName).toLowerCase()] ?? 'application/octet-stream',
      });
      await commit(stmts);
      return {
        subido: rec.id, nombre: rec.name, tamaño: fileSize(bytes.length),
        asignatura: subject.name + (subject._new ? ' (nueva)' : ''), en: where.donde,
        nota: 'La app lo recibirá en la próxima sincronización; el contenido se baja al abrirlo.',
      };
    },
  },
  {
    name: 'crear_temas',
    description: 'Crea varios temas en una asignatura (p. ej. el temario completo), en el orden dado. Los que ya existan se dejan como están. Crea la asignatura si no existe.',
    inputSchema: {
      type: 'object',
      properties: { asignatura: asignaturaProp, temas: { type: 'array', items: { type: 'string' }, minItems: 1 } },
      required: ['asignatura', 'temas'],
    },
    async run({ asignatura, temas }) {
      if (!Array.isArray(temas) || !temas.length) throw new Error('temas debe ser una lista no vacía');
      const data = await load('subject', 'topic');
      const stmts = [];
      const subject = findSubject(data.subject, asignatura, { create: true, stmts });
      const creados = [], existentes = [], vistos = new Set();
      for (const name of temas.map(t => String(t).trim()).filter(Boolean)) {
        const t = findTopic(data.topic, subject, name, { create: true, stmts });
        if (vistos.has(t.id)) continue; // repetido en la misma lista
        vistos.add(t.id);
        (t._new ? creados : existentes).push(t.name);
      }
      await commit(stmts);
      return { asignatura: subject.name + (subject._new ? ' (nueva)' : ''), creados, ya_existian: existentes };
    },
  },
  {
    name: 'estado_tema',
    description: 'Cambia el estado de un tema: pendiente, leido, resumido o repasado.',
    inputSchema: {
      type: 'object',
      properties: { asignatura: asignaturaProp, tema: temaProp, estado: { type: 'string', enum: STATUSES } },
      required: ['asignatura', 'tema', 'estado'],
    },
    async run({ asignatura, tema, estado }) {
      if (!STATUSES.includes(estado)) throw new Error(`estado debe ser ${STATUSES.join(', ')}`);
      const data = await load('subject', 'topic');
      const subject = findSubject(data.subject, asignatura);
      const topic = findTopic(data.topic, subject, tema);
      if (!topic) throw new Error('falta el tema');
      const stmts = [];
      put(stmts, 'topic', { ...topic, status: estado });
      await commit(stmts);
      return { asignatura: subject.name, tema: topic.name, antes: topic.status, ahora: estado };
    },
  },
  {
    name: 'crear_practica',
    description: 'Crea una práctica en una asignatura, con fecha de entrega opcional (sale en el calendario como entrega). ' +
      'Si ya existe una con ese nombre y se da fecha, le cambia la fecha. Su material se sube después con subir_archivo o guardar_resumen indicando practica.',
    inputSchema: {
      type: 'object',
      properties: { asignatura: asignaturaProp, nombre: { type: 'string' }, entrega: { type: 'string', description: 'Opcional, AAAA-MM-DD' } },
      required: ['asignatura', 'nombre'],
    },
    async run({ asignatura, nombre, entrega }) {
      const name = String(nombre ?? '').trim();
      if (!name) throw new Error('falta el nombre');
      if (!isDateOrNull(entrega)) throw new Error('entrega debe ser AAAA-MM-DD');
      const data = await load('subject', 'practice');
      const stmts = [];
      const subject = findSubject(data.subject, asignatura, { create: true, stmts });
      const p = findPractice(data.practice, subject, name, { create: true, stmts, dueDate: entrega || null });
      if (!p._new && entrega && entrega !== p.dueDate) put(stmts, 'practice', { ...p, dueDate: entrega });
      await commit(stmts);
      return { id: p.id, practica: p.name, asignatura: subject.name + (subject._new ? ' (nueva)' : ''), entrega: entrega || p.dueDate || null, ya_existia: !p._new };
    },
  },
  {
    name: 'estado_practica',
    description: 'Marca una práctica como finalizada (o la vuelve a dejar pendiente con finalizada=false).',
    inputSchema: {
      type: 'object',
      properties: { asignatura: asignaturaProp, practica: { type: 'string' }, finalizada: { type: 'boolean', default: true } },
      required: ['asignatura', 'practica'],
    },
    async run({ asignatura, practica, finalizada = true }) {
      const data = await load('subject', 'practice');
      const subject = findSubject(data.subject, asignatura);
      const p = findPractice(data.practice, subject, practica);
      const stmts = [];
      put(stmts, 'practice', { ...p, done: !!finalizada, doneAt: finalizada ? (p.doneAt ?? today()) : null });
      await commit(stmts);
      return { asignatura: subject.name, practica: p.name, finalizada: !!finalizada };
    },
  },
  {
    name: 'ver_calendario',
    description: 'Lista exámenes, entregas, eventos y prácticas pendientes del calendario entre dos fechas (por defecto, de hoy a 60 días).',
    inputSchema: {
      type: 'object',
      properties: { desde: { type: 'string', description: 'AAAA-MM-DD' }, hasta: { type: 'string', description: 'AAAA-MM-DD' } },
    },
    async run({ desde, hasta }) {
      const from = desde ?? today();
      const to = hasta ?? new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
      if (!isDate(from) || !isDate(to)) throw new Error('las fechas van como AAAA-MM-DD');
      const { event, subject, practice } = await load('event', 'subject', 'practice');
      return [...event, ...practiceEvents(practice)].filter(e => e.date >= from && e.date <= to).sort(byDate).map(e => ({
        id: e.id, tipo: e.type, titulo: e.title, fecha: e.date, ...(e.time ? { hora: e.time } : {}),
        ...(e.subjectId ? { asignatura: subject.find(s => s.id === e.subjectId)?.name } : {}), ...(e.notes ? { notas: e.notes } : {}),
      }));
    },
  },
  {
    name: 'crear_evento',
    description: 'Añade un examen, una entrega o un evento al calendario. Si se da asignatura y no existe, se crea.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        tipo: { type: 'string', enum: EVENT_TYPES },
        fecha: { type: 'string', description: 'AAAA-MM-DD' },
        hora: { type: 'string', description: 'Opcional, HH:MM' },
        asignatura: { ...asignaturaProp, description: 'Opcional.' },
        notas: { type: 'string', description: 'Opcional: temas que entran, aula, material…' },
      },
      required: ['titulo', 'tipo', 'fecha'],
    },
    async run({ titulo, tipo, fecha, hora, asignatura, notas }) {
      const title = String(titulo ?? '').trim();
      if (!title) throw new Error('falta el título');
      if (!EVENT_TYPES.includes(tipo)) throw new Error(`tipo debe ser ${EVENT_TYPES.join(', ')}`);
      if (!isDate(fecha)) throw new Error('fecha debe ser AAAA-MM-DD');
      if (hora != null && hora !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('hora debe ser HH:MM');
      const data = await load('subject', 'event');
      const stmts = [];
      const subject = asignatura ? findSubject(data.subject, asignatura, { create: true, stmts }) : null;
      const dup = data.event.find(e => e.date === fecha && norm(e.title) === norm(title));
      if (dup) throw new Error(`ya hay un evento «${dup.title}» ese día`);
      const rec = put(stmts, 'event', {
        title, type: tipo, date: fecha, ...(hora ? { time: hora } : {}),
        subjectId: subject?.id ?? null, ...(notas?.trim() ? { notes: notas.trim() } : {}),
      });
      await commit(stmts);
      return { creado: rec.id, titulo: title, fecha, asignatura: subject ? subject.name + (subject._new ? ' (nueva)' : '') : null };
    },
  },
  {
    name: 'anadir_compra',
    description: 'Añade productos a la lista de la compra. Si ya estaban (aunque tachados), se vuelven a poner como pendientes.',
    inputSchema: {
      type: 'object',
      properties: { productos: { type: 'array', items: { type: 'string' }, minItems: 1 } },
      required: ['productos'],
    },
    async run({ productos }) {
      if (!Array.isArray(productos) || !productos.length) throw new Error('productos debe ser una lista no vacía');
      const { shopItem } = await load('shopItem');
      const stmts = [], añadidos = [], reactivados = [], ya_estaban = [];
      for (const name of productos.map(p => String(p).trim()).filter(Boolean)) {
        const same = shopItem.find(i => norm(i.name) === norm(name));
        if (same && !same.done) { ya_estaban.push(same.name); continue; }
        if (same) { put(stmts, 'shopItem', { ...same, done: false }); same.done = false; reactivados.push(same.name); continue; }
        shopItem.push(put(stmts, 'shopItem', { name, done: false }));
        añadidos.push(name);
      }
      await commit(stmts);
      return { añadidos, reactivados, ya_estaban };
    },
  },
];

// ---------- protocolo MCP por stdio ----------
const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notificaciones: nada que responder
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'suite', version: '1.0.0' },
        instructions: 'La Suite es la app personal del usuario para estudiar (asignaturas → temas y prácticas → resúmenes, notas y archivos), ' +
          'con calendario de exámenes y lista de la compra. Puedes guardar resúmenes que escribas, subir trabajos o apuntes ' +
          'que estén en su ordenador, crear temas y prácticas (con su material y fecha de entrega), cambiar su estado y añadir exámenes o entregas. ' +
          'Antes de guardar, mira con ver_estudio qué asignaturas y temas hay para usar sus nombres y no crear duplicados. ' +
          'Lo que escribes llega a la app en su siguiente sincronización.',
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === params?.name);
      if (!tool) return fail(id, -32602, `Herramienta desconocida: ${params?.name}`);
      try {
        const out = await tool.run(params.arguments || {});
        return reply(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return reply(id, { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true });
      }
    }
    default:
      return fail(id, -32601, `Método no soportado: ${method}`);
  }
}

createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return fail(null, -32700, 'JSON no válido'); }
  handle(msg).catch(e => msg.id !== undefined && fail(msg.id, -32603, e.message));
});
