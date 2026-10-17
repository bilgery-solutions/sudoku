# Sudoku

Eine moderne, minimalistische **Sudoku-Webapp auf Deutsch**, optimiert für iPhone und GitHub Pages. Reines HTML, CSS und JavaScript – kein Framework, kein Server, keine externen Abhängigkeiten.

## Funktionen

- **Leicht, Mittel, Schwer** mit unterschiedlichen Vorgabenzahlen (ca. 43–45, 35–37 und 28–30)
- Immer wieder **neue, zufällig generierte Sudoku-Rätsel** statt eines festen Rätselvorrats
- Jedes Rätsel wird mit einem Sudoku-Solver auf **genau eine Lösung** geprüft
- Interaktives 9×9-Spielfeld mit Hervorhebung von Zeilen, Spalten, Boxen und gleichen Zahlen
- Zahlenfeld, Notizen, Hinweise, Löschen, Rückgängig, Fehlerkennzeichnung
- Timer, Pause und Abschlussdialog
- Automatischer Spielstand im lokalen Speicher des Geräts
- Responsives Layout, Service Worker für Offline-Nutzung nach dem ersten Laden
- Als Web-App zum iPhone-Home-Bildschirm hinzufügbar

**Hinweis zur Schwierigkeit:** Die drei Niveaus werden anhand der Anzahl der Vorgaben gesteuert. Eine gesonderte Einstufung nach menschlichen Lösungstechniken ist in dieser Version noch nicht implementiert.

## GitHub Pages aktivieren

1. Repository öffnen: https://github.com/bilgery-solutions/sudoku
2. **Settings → Pages** auswählen.
3. Bei **Build and deployment** die Quelle **Deploy from a branch** festlegen.
4. Branch **main** und Ordner **/(root)** wählen und speichern.
5. Nach der Veröffentlichung: https://bilgery-solutions.github.io/sudoku/

## Auf dem iPhone installieren

Die veröffentlichte Website in **Safari** öffnen, auf **Teilen** tippen und **Zum Home-Bildschirm** wählen. Das Spiel benötigt kein Benutzerkonto.

## Struktur

- `index.html`: Bedienoberfläche
- `style.css`: Mobile-First-Design
- `app.js`: Generator, Eindeutigkeitsprüfung und Spiellogik
- `icon.svg`, `apple-touch-icon.png`, `manifest.webmanifest`: Web-App-Icon und Metadaten
- `sw.js`: Cache für die Offline-Nutzung

Der Spielstand bleibt lokal im Browser gespeichert, nicht bei GitHub.
