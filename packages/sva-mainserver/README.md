# @sva/sva-mainserver

Serverseitige Integrationsschicht für den externen SVA-Mainserver. Das Paket kapselt pro Nutzer:

- instanzbezogene Endpunkt-Konfiguration
- API-Key-/Secret-Auflösung aus Keycloak
- OAuth2-Tokenabruf
- GraphQL-Transport und Diagnostikadapter

Client-Code importiert ausschließlich Typen aus `@sva/sva-mainserver`. Laufzeitlogik bleibt in `@sva/sva-mainserver/server`.
