# Suite

Mi suite personal, en una sola app web instalable (PWA) para el PC y el móvil:

- **Hoy**: hábitos diarios (creatina, leer…) con rachas, y resumen de lo que toca.
- **Estudio**: asignaturas → temas → PDFs y resúmenes. Estado de cada tema y buscador.
- **Calendario**: exámenes, entregas y eventos ligados a una asignatura, con cuenta atrás.
- **Gym**: rutinas, entrenamiento en curso (se puede cambiar de rutina a mitad), historial y progreso.
- **Dieta**: plan semanal de comidas, lo comido cada día y objetivos de calorías y macros.
- **Compra**: lista de la compra.

## Usar

```bash
npm install
npm run dev
```

Se abre en <http://localhost:5190>. Cada vez que se sube algo a `main`, GitHub Actions la compila y la publica en GitHub Pages.

Para instalarla en el móvil: ábrela en el navegador y elige «Añadir a pantalla de inicio».

## Datos y sincronización

Todo se guarda en el navegador (localStorage, y los archivos de Estudio en IndexedDB), así que funciona sin conexión.

Para tenerlo igual en el PC y en el móvil, conecta en **Ajustes** la misma base de datos de [Turso](https://turso.tech) en los dos (URL y token). Se usan dos tablas, `suite` (un registro JSON por fila; gana el cambio más reciente) y `suite_files` (el contenido de los archivos, troceado), así que puede compartir base con Bitácora.

**Ajustes → Exportar** descarga una copia de los datos (sin los archivos de Estudio).

## Estructura

```
src/
  lib/
    store.ts      Almacén local, tipos de datos y copia de seguridad
    sync.ts       Sincronización con Turso por HTTP
    files.ts      Archivos de Estudio: IndexedDB + subida troceada a Turso
    seed.ts       Datos de partida (hábitos, rutinas, dieta)
    gym.ts, diet.ts, calendar.ts, study.ts, dates.ts, router.ts
  pages/          Una carpeta o archivo por módulo
public/           Manifest, iconos y service worker
scripts/icons.mjs Genera los iconos PNG
```
