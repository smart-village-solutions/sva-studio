#!/bin/bash

set -e

CERT_DIR="dev/redis-tls"
mkdir -p "$CERT_DIR"

echo "Generating self-signed TLS certificates for local Redis..."

# Generate CA private key
openssl genrsa -out "$CERT_DIR/ca-key.pem" 2048

# Generate CA certificate
openssl req -new -x509 -days 365 -key "$CERT_DIR/ca-key.pem" \
  -out "$CERT_DIR/ca.pem" \
  -subj "/C=DE/ST=NRW/L=Local/O=SVA-Dev/CN=redis-ca"

# Generate Redis server private key
openssl genrsa -out "$CERT_DIR/redis-key.pem" 2048

# Generate Redis server CSR
openssl req -new -key "$CERT_DIR/redis-key.pem" \
  -out "$CERT_DIR/redis.csr" \
  -subj "/C=DE/ST=NRW/L=Local/O=SVA-Dev/CN=localhost"

# Sign the server cert with CA
openssl x509 -req -days 365 -in "$CERT_DIR/redis.csr" \
  -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" \
  -CAcreateserial -out "$CERT_DIR/redis.pem"

# Cleanup CSR (not needed)
rm "$CERT_DIR/redis.csr"

echo "✅ Certificates generated in $CERT_DIR/"
ls -la "$CERT_DIR/"
