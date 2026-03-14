#!/bin/sh
set -eu

log() {
  printf '%s %s\n' "$(date -Iseconds)" "$*"
}

copy_file() {
  src="$1"
  dest="$2"
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
}

copy_dashboard() {
  src="$1"
  dest_dir="$2"
  mkdir -p "$dest_dir"
  cp "$src" "$dest_dir/$(basename "$src")"
}

log "Schreibe Monitoring-Konfigurationen in die gemounteten Volumes"

copy_file /opt/monitoring-config-init/source/otel-collector.yml /config/otel/otel-collector.yml
copy_file /opt/monitoring-config-init/source/loki-config.yml /config/loki/config.yml
copy_file /opt/monitoring-config-init/source/prometheus.yml /config/prometheus/prometheus.yml
copy_file /opt/monitoring-config-init/source/alert-rules.yml /config/prometheus/alert-rules.yml
copy_file /opt/monitoring-config-init/source/alertmanager.yml /config/alertmanager/alertmanager.yml
copy_file /opt/monitoring-config-init/source/promtail-config.yml /config/promtail/config.yml
copy_file /opt/monitoring-config-init/source/grafana-datasources.yml /config/grafana/provisioning/datasources/datasources.yml
copy_file /opt/monitoring-config-init/source/grafana-dashboards.yml /config/grafana/provisioning/dashboards/dashboards.yml

copy_dashboard /opt/monitoring-config-init/source/grafana-dashboard-application-logs.json /config/grafana/dashboards
copy_dashboard /opt/monitoring-config-init/source/grafana-dashboard-development-overview.json /config/grafana/dashboards
copy_dashboard /opt/monitoring-config-init/source/grafana-dashboard-multi-tenancy-test.json /config/grafana/dashboards

mkdir -p /data/loki /data/prometheus /data/grafana /data/alertmanager

log "Setze Volume-Rechte für Loki, Prometheus, Alertmanager und Grafana"
chown -R 10001:0 /data/loki
chown -R 65534:65534 /data/prometheus /data/alertmanager
chown -R 472:472 /data/grafana

log "Monitoring-Konfiguration bereit"
exec tail -f /dev/null
