# Schotland 2026

Statische reiswebsite voor onze Schotland-trip van 13 t/m 21 september 2026.

## Structuur

```text
.
├── index.html
├── .nojekyll
├── .gitignore
├── README.md
└── assets
    ├── css
    │   └── styles.css
    ├── images
    │   ├── hero-highlands.webp
    │   └── highland-landscape.webp
    └── js
        ├── config.js
        └── app.js
```

## Publiceren met GitHub Pages

1. Maak een nieuwe GitHub repository, bijvoorbeeld `schotland-trip`.
2. Upload **de inhoud van deze map** naar de root van de repository.
3. Ga in GitHub naar **Settings → Pages**.
4. Kies bij **Build and deployment**: `Deploy from a branch`.
5. Selecteer branch `main` en map `/(root)`.
6. Sla op.

De site wordt dan bereikbaar via een URL zoals:

`https://<gebruikersnaam>.github.io/schotland-trip/`

## Mapbox

De site gebruikt een **public Mapbox token (`pk.`)** in `assets/js/config.js`.

Wanneer de GitHub Pages URL definitief is, beperk de token in Mapbox bij voorkeur tot je eigen website-URL. Gebruik nooit een `sk.` secret token in deze repository.

## Lokaal testen

Open de site bij voorkeur via een simpele lokale webserver, bijvoorbeeld:

```bash
python3 -m http.server 8000
```

Open daarna `http://localhost:8000`.
