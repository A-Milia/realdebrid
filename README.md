# RealDebrid Manager

Interfaz moderna y rápida para gestionar **tu** cuenta de [Real-Debrid](https://real-debrid.com): descargas, torrents, unrestrict y estado de hosts.

## Qué NO es esto

Real-Debrid **no tiene un catálogo global tipo Netflix**. Su API solo expone lo que hay en **tu** cuenta (descargas y torrents).

[Debrid Media Manager (DMM)](https://github.com/debridmediamanager/debrid-media-manager) construye una experiencia de “biblioteca de cine/series” encima de debrid + metadatos + hashlists/scrapers. Esa app es potente pero pesada (MySQL, muchas integraciones, licencia AGPL). Este proyecto es una alternativa **ligera**, centrada en velocidad y UX para administrar Real-Debrid directamente, inspirada en las mejores ideas de biblioteca de DMM (filtros, ordenación, duplicados, limpieza de fallidos).

## Funciones

- Login con API token o flujo OAuth de dispositivo
- Resumen de cuenta y premium
- Descargas: búsqueda, copiar, abrir, borrado masivo
- Torrents: magnet, selección de archivos, filtros por estado, ordenación, duplicados, limpiar fallidos, unrestrict
- Unrestrict de enlaces de hoster
- Estado de hosts

El token se guarda **solo en tu navegador** (`localStorage`). Las peticiones pasan por un proxy Next.js (`/api/rd/*`).

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Producción (Vercel)

Conecta el repo a Vercel. No hace falta base de datos ni variables de entorno obligatorias.

## Licencia

MIT
