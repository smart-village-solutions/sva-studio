# Keycloak-Theme `MQGB-Keycloak`

## Ziel

Dieses Dokument beschreibt das Login-Theme `MQGB-Keycloak` im Repository und dessen technische Basis.

Das Theme soll die bisherige visuelle MQGB-Anmutung behalten, aber auf neueren Keycloak-Versionen stabil laufen.

## Technische Basis

Das Login-Theme erweitert nicht mehr das Legacy-Theme `base`, sondern:

- `parent=keycloak.v2`

Der Grund ist, dass neuere Keycloak-Versionen für die Login-Oberfläche auf der neueren `keycloak.v2`-Struktur basieren.
Ein vollständiges Legacy-Override mit altem Markup wie `login-pf-page`, `card-pf` oder Bootstrap-Grid-Klassen ist auf Dauer upgrade-fragil.

## Migrationsprinzip

Für `MQGB-Keycloak` gilt daher:

- Branding, Farben, Header-Ton, Hintergrund und Signup-Fläche bleiben MQGB-spezifisch
- die eigentliche Login-Struktur kommt aus dem Parent-Theme `keycloak.v2`
- das Theme überschreibt primär CSS und keine komplette Login-Seite mehr

Praktisch bedeutet das:

- `login/login.ftl` wird nicht mehr als vollständiger Custom-Fork gepflegt
- `login/theme.properties` hält nur noch die notwendigen Theme-Grundeinstellungen
- `login/resources/css/login.css` ist das führende Branding-Overlay

## Relevante Dateien

- `deploy/keycloak/themes/MQGB-Keycloak/login/theme.properties`
- `deploy/keycloak/themes/MQGB-Keycloak/login/resources/css/login.css`
- `deploy/keycloak/themes/MQGB-Keycloak/login/resources/img/`
- `deploy/keycloak/themes/MQGB-Keycloak/login/messages/messages_de.properties`

## Betriebsregel

Wenn das Theme auf eine neue Keycloak-Version migriert werden muss, zuerst prüfen:

1. ob `keycloak.v2` weiterhin die aktive Login-Basis ist
2. ob sich die DOM-Struktur oder Klassennamen im Parent-Theme geändert haben
3. ob das MQGB-CSS noch ausschließlich Branding übernimmt und keine Parent-Struktur nachbaut

## Deployment-Hinweis

Bei Theme-Updates:

1. Theme-Verzeichnis oder Theme-Archiv neu deployen
2. Keycloak neu starten oder Theme-Cache leeren
3. Login-Seite gegen einen Realm mit aktivem `MQGB-Keycloak` prüfen
