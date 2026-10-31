# RealTrading Strategie

Browserbasierte Trading-Analyseoberfläche mit Binance-Marktdaten, Lightweight Charts und technischen Indikatoren.

## Lokal starten
- Node.js installieren
- `node server.js` ausführen
- Browser: `http://localhost:3000`

## Hosting
Die Weboberfläche ist als statische Website für Vercel vorbereitet. Projekt-Root ist dieses Verzeichnis; Build Command leer lassen; Output Directory `dist`.

Hinweis: `server.js` ist ein einfacher lokaler Dateiserver und wird für das statische Vercel-Frontend nicht benötigt. Externe Datenquellen wie Binance müssen im Browser erreichbar sein.

## Sicherheit / Trading-Hinweis
Signale und Analysen sind technische Hilfen, keine Finanzberatung und keine Garantie für Ergebnisse. Vor Echtgeld-Einsatz Backtests, Gebühren, Slippage und Datenqualität prüfen.
