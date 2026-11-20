# Suite

Mi suite personal, en una sola app web instalable (PWA) para el PC y el móvil:

- **Hoy**: hábitos diarios (creatina, leer…) con rachas, y resumen de lo que toca.
- **Estudio**: asignaturas → temas y prácticas → PDFs, resúmenes y notas. Estado de cada tema, prácticas con fecha de entrega y botón de finalizada, y buscador.
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

## Claude (MCP)

`mcp/suite-mcp.mjs` es un servidor MCP (Node 18+, sin dependencias) que deja a Claude trabajar con la Suite escribiendo directamente en Turso. La app lo recibe en la siguiente sincronización.

| Herramienta | Qué hace |
|---|---|
| `ver_estudio` | Asignaturas, temas con su estado, documentos y próximos exámenes |
| `leer_resumen` | Texto de un resumen guardado |
| `guardar_resumen` | Crea un resumen o nota en una asignatura y un tema o práctica, o cambia uno (reemplazar o añadir al final) |
| `subir_archivo` | Sube un archivo de este ordenador (PDF, Word, imagen…; máx. 50 MB) a un tema o una práctica |
| `crear_temas` | Crea varios temas de golpe (p. ej. el temario) |
| `crear_practica` / `estado_practica` | Crea una práctica (con fecha de entrega) y la marca como finalizada |
| `estado_tema` | Cambia el estado de un tema (pendiente, leído, resumido, repasado) |
| `ver_calendario` / `crear_evento` | Consulta y añade exámenes, entregas y eventos |
| `anadir_compra` | Añade productos a la lista de la compra |
| `ver_gym` | Rutinas, entrenamiento en curso y últimos entrenamientos |
| `guardar_rutina` / `borrar_rutina` | Crea o cambia una rutina (ejercicios, series, día, nombre) o la borra |
| `registrar_entrenamiento` / `borrar_entrenamiento` | Apunta un entrenamiento ya hecho en el historial o lo borra |
| `ver_dieta` | Comidas de un día (o el plan semanal), lo comido y los objetivos |
| `editar_dia_dieta` | Añade, quita o marca como comidos alimentos de un día, o lo devuelve al plan |
| `editar_plan_dieta` | Añade o quita alimentos del plan de un día de la semana |
| `objetivos_dieta` | Cambia los objetivos de calorías y macros |

Si la asignatura, el tema o la práctica que le pides no existen, los crea. En Estudio no borra nada; en gym y dieta puede borrar rutinas, entrenamientos y alimentos cuando se lo pides.

Para usarlo en Claude Desktop, en **Ajustes → Desarrollador → Editar configuración**, añade a `claude_desktop_config.json` (dentro de `mcpServers`, junto a los que ya tengas):

```json
"suite": {
  "command": "node",
  "args": ["C:\\Users\\adria\\Documents\\GitHub\\suite\\mcp\\suite-mcp.mjs"],
  "env": {
    "SUITE_TURSO_URL": "libsql://<base>.turso.io",
    "SUITE_TURSO_TOKEN": "<token>"
  }
}
```

Usa la misma URL y token que en **Ajustes** de la app. Reinicia Claude y pídele, por ejemplo: «resume este PDF y guárdalo en Historia, tema 2», «sube C:\…\trabajo.docx a Física» o «apúntame el examen de Química el 3 de diciembre a las 9».

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
mcp/suite-mcp.mjs Servidor MCP para Claude
scripts/icons.mjs Genera los iconos PNG
```
