# Schotland 2026 - responsive website

Deze versie gaat terug naar de klassieke website-layout van voor de PWA-versie, maar is expliciet geoptimaliseerd voor mobiel.

## Mobiele layout
Op schermen tot 760 px wordt elk dagblok volledig verticaal:
1. route
2. interactieve Mapbox-kaart
3. knop Open in Google Maps
4. vlucht/route/highlights
5. tankstations
6. huurauto/hotel

De infovakken staan dus nooit naast de kaart op een iPhone.

## GitHub Pages
Upload de volledige inhoud van deze map naar de root van de repository. De bestaande Mapbox public token staat in `assets/js/config.js`.

Dit is bewust geen PWA: geen manifest, service worker of app-shell.
