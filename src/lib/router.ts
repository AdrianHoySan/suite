// Rutas por hash (#/hoy, #/compra…): funcionan en cualquier hosting estático sin configuración.
import { useSyncExternalStore } from 'react';

const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};
const current = () => window.location.hash.replace(/^#\/?/, '') || 'hoy';

export const useRoute = () => useSyncExternalStore(subscribe, current);
