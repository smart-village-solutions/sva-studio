## Invarianten

- Ein `studio`-Artefakt darf weder den Plugin-Snapshot noch Browser-Routen,
  Server-Handler, Job-Handler oder IAM-Verträge von `ssf` materialisieren.
- Ein `ssf`-Artefakt darf nur SSF und die explizit erlaubte Medienfähigkeit
  materialisieren.
- Die Distribution ist Build- und nicht Container-Laufzeit-Zustand.
- Promotion verwendet einen Digest nur für die attestierte Distribution.

## Geplante Evidenz

- Unit-Tests für Katalog- und Modulfilter sowie Snapshot-Parität.
- Server-/Routing-Tests für fehlende SSF-Routen im Studio-Profil.
- Image-Verify mit Positiv-/Negativinventar und Runtime-Manifest.
- Exakte-HEAD-CI für beide Artefakte vor einer Promotion.
