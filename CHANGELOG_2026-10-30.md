# RealTrading Strategie – Sicherheitsupdate 2026-10-30

## Änderungen
- Keine künstlich generierten Kurskerzen mehr, wenn Binance Spot/Futures nicht erreichbar sind.
- Sichtbarer Datenfehler statt irreführender Demo-Preise und -Signale.
- RSI-Divergenzen werden erst nach Bestätigung durch zwei folgende Kerzen als Signal markiert (Pivot-Ursprung bleibt separat als pivotIndex erhalten).
- dist-Dateien mit den Änderungen synchronisiert.

## Noch offen
- Backtesting: realistischer Einstieg, Gebühren/Slippage, Positionsmanagement, Out-of-sample-Tests.
- Vollständige Integrationstests mit Live-Binance-Daten.
- Live-Deployment: benötigt autorisierten Zugriff auf bestehendes Surge-Konto bzw. neues Hosting.

## Lokal starten
node server.js
Browser: http://localhost:3000
