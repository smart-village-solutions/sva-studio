FROM alpine:3.20

WORKDIR /opt/monitoring-config-init

COPY deploy/portainer/monitoring /opt/monitoring-config-init/source
COPY deploy/portainer/monitoring-config-init/setup-monitoring-config.sh /usr/local/bin/setup-monitoring-config.sh

RUN chmod +x /usr/local/bin/setup-monitoring-config.sh

ENTRYPOINT ["/usr/local/bin/setup-monitoring-config.sh"]
