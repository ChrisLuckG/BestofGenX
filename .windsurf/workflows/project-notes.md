---
description: Wichtige Projektnotizen und Warnungen für Cascade
---

# SPORTTOCK - Projekt-Dokumentation für Cascade

## KRITISCHE WARNUNGEN

### 1. ArticlesTab.tsx ist RIESIG (2700+ Zeilen)
- **Pfad:** `src/components/admin/ArticlesTab.tsx`
- **Problem:** Datei ist zu groß für sichere große Edits
- **Lösung:** NUR kleine, gezielte Edits machen. NIEMALS große Blöcke auf einmal ersetzen.
- **Enthält:** Artikel-Liste, Template-Builder, Artikel-Editor Modal, Bild-Upload, AI-Generierung, Kommentare-Modal, Views-Modal, Image-Manager

### 2. WelcomeReel.tsx ist der FEED (1160+ Zeilen)
- **Pfad:** `src/components/games/WelcomeReel.tsx`
- **Das ist der Frontend-Feed!** Nicht "FeedPage" oder ähnlich.
- **templateItems State:** Zeile ~111 - hier werden Template-Typen definiert
- **Rendering:** Ab Zeile ~1055 - hier wird das Grid gerendert
- **WICHTIG:** Wenn du im Admin etwas änderst, muss es auch hier im Frontend unterstützt werden!

## CONTAINER-SYSTEM (IN ARBEIT)

### Konzept
- Container = size 12 in templateItems
- Container ist nur ein TRÄGER mit Überschrift (kein Padding, keine Farben)
- Container enthält Blöcke: MAIN, 2H, FIXED, SLIDER, VERTICAL, SOCIAL

### Typ-Definition (ArticlesTab.tsx, Zeile ~94)
```typescript
{
  size: 1|2|3|4|5|6|7|8|9|10|12,  // 12 = Container
  articleId: string|null,
  containerName?: string,         // z.B. "NEWS", "HISTORY"
  containerBlocks?: {
    type: 'MAIN' | '2H' | 'FIXED' | 'SLIDER' | 'VERTICAL' | 'SOCIAL';
    articleId?: string | null;
    articleId2?: string | null;   // für 2H
    articles?: string[];          // für SLIDER, VERTICAL
    bannerImage?: string;         // für FIXED
    bannerLink?: string;
  }[]
}
```

### Funktionen (ArticlesTab.tsx, ab Zeile ~566)
- `updateContainerName(index, name)` - Container umbenennen
- `addBlockToContainer(index, blockType)` - Block hinzufügen
- `removeBlockFromContainer(index, blockIndex)` - Block entfernen
- `updateBlockInContainer(index, blockIndex, updates)` - Block aktualisieren

### Frontend (WelcomeReel.tsx)
- Typ muss size 12 und containerBlocks unterstützen (Zeile ~111)
- Rendering für size 12 muss im .map() hinzugefügt werden (ab Zeile ~1055)
- Container im Frontend: NUR Überschrift, dann Blöcke normal rendern

## SIZE-MAPPING (Template-Blöcke)

| Size | Name | Beschreibung |
|------|------|--------------|
| 1 | SM | Small Box |
| 2 | MED | Medium Box |
| 3 | MAIN | Featured/Main Article |
| 4 | FULL | Full Width Banner |
| 5 | HALF | Half Width |
| 6 | SLIDER | Horizontal Scroll |
| 7 | SOCIAL | Social Media Style |
| 8 | AD | Werbung |
| 9 | VERT | Vertical List |
| 10 | 2-HALF | Zwei Artikel nebeneinander |
| 11 | FIXED | Fixed Banner |
| 12 | CONTAINER | Container mit Blöcken |

## API-ENDPUNKTE

- `GET/POST /api/template` - Template speichern/laden
- `GET/POST /api/articles` - Artikel CRUD
- `GET /api/articles?status=published` - Nur veröffentlichte

## WICHTIGE DATEIEN

```
src/
├── components/
│   ├── admin/
│   │   └── ArticlesTab.tsx    # RIESIG - Admin Template Builder
│   └── games/
│       └── WelcomeReel.tsx    # Frontend Feed
├── app/
│   ├── admin/
│   │   └── page.tsx           # Admin Page mit Tabs
│   └── api/
│       ├── template/route.ts  # Template API
│       └── articles/route.ts  # Articles API
```

## WORKFLOW FÜR ÄNDERUNGEN

1. **IMMER ZUERST** die relevanten Dateien lesen
2. **KLEINE EDITS** - nie mehr als 50 Zeilen auf einmal
3. **ADMIN + FRONTEND** - Änderungen müssen in beiden gemacht werden
4. **TESTEN** - Nach jeder Änderung prüfen ob es kompiliert

## BEKANNTE PROBLEME

- ArticlesTab.tsx sollte weiter aufgeteilt werden (TemplateBuilder, ArticleEditor, etc.)

## ERLEDIGTE AUFGABEN

- Container-System implementiert (size 12)
- ContainerBlock.tsx als separate Komponente erstellt
- Frontend (WelcomeReel) unterstützt Container mit allen Block-Typen
