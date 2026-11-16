import { useRef, useState, type FormEvent } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { exportJSON, importJSON } from '../lib/store';
import { connect, disconnect, sync, useSyncStatus } from '../lib/sync';
import { today } from '../lib/dates';

const ago = (iso?: string) => {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return min < 1 ? 'ahora mismo' : min < 60 ? `hace ${min} min` : new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
};

export default function Ajustes() {
  const status = useSyncStatus();
  const connected = status.state !== 'off';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await connect(String(fields.get('url')), String(fields.get('token')));
      form.reset();
    } catch (err) {
      setError('No se pudo conectar: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    a.download = `suite-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (f?: File) => {
    if (!f) return;
    try {
      const n = importJSON(await f.text());
      setNotice(n ? `Importados ${n} registros.` : 'La copia no tenía nada nuevo.');
    } catch (err) {
      setNotice('No se pudo importar: ' + (err as Error).message);
    }
    if (file.current) file.current.value = '';
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      </header>

      <section className="card mb-4 p-4">
        <h2 className="font-medium">Sincronización</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {!connected ? 'No conectado: los datos solo están en este navegador. Conecta la misma base de datos de Turso en el PC y en el móvil para tenerlos sincronizados.'
            : status.state === 'error' ? <span className="text-red-500">Error: {status.message}</span>
            : status.state === 'syncing' ? 'Sincronizando…'
            : `Conectado a ${status.url?.replace('https://', '')} · última sincronización ${ago(status.lastSync)}`}
        </p>

        {connected ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => sync()} disabled={status.state === 'syncing'}>
              <RefreshCw className={`size-4 ${status.state === 'syncing' ? 'animate-spin' : ''}`} /> Sincronizar ahora
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { if (confirm('¿Desconectar de Turso? Los datos se quedan en este navegador y en Turso; solo se deja de sincronizar.')) disconnect(); }}
            >
              Desconectar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600 dark:text-zinc-300">URL de la base de datos</span>
              <input className="input" name="url" required placeholder="libsql://mi-base-usuario.turso.io" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600 dark:text-zinc-300">Token</span>
              <input className="input" name="token" type="password" required autoComplete="off" />
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Conectando…' : 'Conectar'}</button>
          </form>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-medium">Copia de seguridad</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Exporta todos los datos a un archivo. Al importar se combina con lo que hay: no borra nada y gana el cambio más reciente.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ghost border border-zinc-300 dark:border-zinc-700" onClick={download}><Download className="size-4" /> Exportar</button>
          <button className="btn btn-ghost border border-zinc-300 dark:border-zinc-700" onClick={() => file.current?.click()}><Upload className="size-4" /> Importar</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => upload(e.target.files?.[0])} />
        </div>
        {notice && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{notice}</p>}
      </section>
    </>
  );
}
