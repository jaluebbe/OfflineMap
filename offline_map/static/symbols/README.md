# Taktische Zeichen – Symbol-Bibliothek

Diese SVGs und `symbols_manifest.json` wurden aus dem Originalrepository
[jonas-koeritz/Taktische-Zeichen](https://github.com/jonas-koeritz/Taktische-Zeichen)
erzeugt (Stand: GitHub-Download vom `master`-Branch).

## Erzeugung

Das Originalrepo liefert die Zeichen als Jinja2-Templates (`.j2`) unter
`symbols/`, die erst mit dem `default.json`-Theme aus `themes/` zu fertigen
SVG-Dateien gerendert werden müssen (im Original per `make svg` mit
[j2cli](https://github.com/kolypto/j2cli)). Für diese Bibliothek wurden alle
994 Templates mit Jinja2 direkt gerendert (gleiche Vorlagen, gleiches Theme,
gleiches Ergebnis wie `make svg`).

Zwei Anpassungen gegenüber dem Originalrepo:
- Dateinamen mit Umlauten sind transliteriert (ä→ae, ö→oe, ü→ue, ß→ss), um
  Encoding-Probleme beim Hosting zu vermeiden.
- `symbols_manifest.json` listet alle Symbole gruppiert nach Kategorie
  (Ordnername) mit menschenlesbarem Namen und Pfad, zur Verwendung in einer
  Auswahl-UI.

## Lizenz

Laut Originalrepo:
- Templates/Code: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Fertige Zeichen (SVG/PNG): [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/)
  (gemeinfrei)
- Verwendete Schriftart "RobotoSlab-Bold": Apache 2.0

Bei Verwendung/Weitergabe entsprechend auf das Originalrepo verweisen.
