# RealDebrid Manager

Interfaz moderna para gestionar **tu** cuenta de [Real-Debrid](https://real-debrid.com): buscar películas/series, añadir torrents a RD, ver carátulas, descargas, unrestrict y hosts.

## Importante

Real-Debrid **no tiene catálogo ni búsqueda nativa**. La búsqueda usa metadatos públicos ([Cinemeta](https://v3-cinemeta.strem.io)) + torrents vía [Torrentio](https://torrentio.strem.fun), y luego envía el magnet a **tu** cuenta RD (mismo patrón que [DMM](https://github.com/debridmediamanager/debrid-media-manager), sin MySQL/Trakt).

## Funciones

- **Buscar y añadir**: título → carátula/info → lista de torrents → Añadir a RD (selección de archivos)
- **Carátulas en biblioteca**: descarga/torrents se emparejan por nombre limpio con Cinemeta
- Login con API token o OAuth dispositivo
- Descargas, torrents, unrestrict, hosts

## Login vs TMDB

- **Login** pide el **token de Real-Debrid** (`real-debrid.com/apitoken`), no TMDB.
- **TMDB_API_KEY** solo va en Vercel (servidor) para mejorar carátulas. Nunca se pide en la UI.

## Variables de entorno


Copia `.env.example` → `.env.local`:

```bash
# Opcional. Sin esto ya hay posters vía Cinemeta.
TMDB_API_KEY=tu_clave_tmdb
```

En Vercel: Project → Settings → Environment Variables → `TMDB_API_KEY`.

Cómo obtener TMDB: https://www.themoviedb.org/settings/api (cuenta gratis → API Key).

## Desarrollo

```bash
npm install
npm run dev
```

## Licencia

MIT
