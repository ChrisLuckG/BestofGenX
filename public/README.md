# Public Assets

Dieser Ordner enthält alle öffentlich zugänglichen Dateien wie Bilder, Icons, etc.

## Struktur

```
public/
├── images/
│   ├── hero/           # Hero-Section Bilder
│   ├── categories/     # Kategorie-Bilder (Music, Sport, Movie, etc.)
│   └── logo.png        # Hauptlogo
├── favicon.ico         # Favicon
└── README.md
```

## Verwendung in Next.js

Bilder können direkt referenziert werden:

```jsx
// Logo im Header
<img src="/images/logo.png" alt="BestOfGenX" />

// Hero-Bild
<img src="/images/hero/main.jpg" alt="Hero" />

// Kategorie-Bild
<img src="/images/categories/music.jpg" alt="Music" />
```

## Empfohlene Bildgrößen

- **Logo**: 200x200px (PNG mit Transparenz)
- **Hero**: 1920x1080px (JPG/PNG)
- **Kategorien**: 800x800px (JPG/PNG)
- **Favicon**: 32x32px (ICO)

## Dateiformate

- **PNG**: Für Logos und Grafiken mit Transparenz
- **JPG**: Für Fotos und Hero-Bilder
- **SVG**: Für Icons und Vektorgrafiken
- **WEBP**: Für optimierte Bilder (optional)
