## Kontext

Dieser Change baut auf dem MVP `add-media-management` auf. Der MVP liefert den zentralen Medienvertrag, MinIO-Storage, Upload-Status, Varianten, Bildbearbeitung, Usage-Impact und Löschschutz. Dieser Folge-Change ergänzt Funktionen, die hohe Betriebssicherheit und bessere redaktionelle Governance bringen, aber zusätzliche UI-, Datenmodell-, Scanner- und Limitierungslogik benötigen.

## Abgrenzung zum MVP

Im MVP bleiben Medien mit Basis-Metadaten nutzbar. Dieser Change macht die redaktionelle Qualität und den Betriebsschutz stärker konfigurierbar:

- Pflichtfelder werden nicht global hart codiert, sondern pro Instanz und Medientyp ausgewertet
- mehrsprachige Metadaten erweitern die Basis-Metadaten, ohne die Asset-Identität zu ändern
- Ordner, Tags und Kategorien dienen Organisation und Suche, nicht der Autorisierung
- Duplikaterkennung nutzt Inhalts-Hashes instanzlokal und offenbart keine instanzfremden Treffer
- Replace ersetzt das führende Original kontrolliert und lässt `MediaReference` stabil
- Malware-Scan ist ein Processing-Gate, das Assets nicht nutzbar freigibt, bevor der Scan erfolgreich ist
- Rate-/Größenlimits und Quota-Warnungen schützen Betrieb und Kosten, ersetzen aber keine IAM-Prüfung

## Technische Hinweise

Hash-, Malware- und Limitentscheidungen müssen auditierbar sein, dürfen aber keine Storage-Secrets, Scanner-Interna oder PII in UI, Logs oder Audit-Events ausgeben. Scanner-Anbindung und Limitkonfiguration werden über eigene Ports gekapselt, damit der Medienkern nicht an ein konkretes Scannerprodukt gekoppelt wird.
