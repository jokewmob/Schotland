# Schotland 2026 — PWA v8

GitHub Pages-ready, iPhone-first Progressive Web App voor de Schotlandreis van 13 t/m 21 september 2026.

## Wat is nieuw in v8

- iPhone/PWA metadata en Apple touch icon
- standalone app-modus via `manifest.webmanifest`
- vaste mobiele appnavigatie: Vandaag / Reis / Praktisch / Boven
- `Vandaag` springt automatisch naar de relevante reisdag
- huidige reisdag krijgt tijdens de trip een subtiele `VANDAAG` markering
- app-shell, reisgegevens en lokale afbeeldingen worden offline gecachet
- knop onder Praktisch om te controleren of de offline app-shell klaarstaat
- safe-area ondersteuning voor iPhone-notch en home-indicator

## Installeren op iPhone

1. Open de live site in **Safari**.
2. Tik op **Delen**.
3. Kies **Zet op beginscherm**.
4. Open daarna `Schotland` vanaf het beginscherm.

Bezoek de app voor vertrek minstens één keer online. De kern van de reiswebsite werkt daarna zonder verbinding. Interactieve Mapbox-kaarten, live tankstations en links naar Google Maps blijven internet nodig hebben.

## GitHub Pages

Upload de inhoud van deze map naar de root van de bestaande `Schotland` repository en commit. GitHub Pages deployt daarna automatisch opnieuw.

## Mapbox

De public `pk.` token blijft in `assets/js/config.js`. Gebruik nooit een `sk.` token in frontendcode.
