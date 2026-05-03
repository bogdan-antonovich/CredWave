#!/bin/sh
set -e
export DATABASE_URL=$(cat /run/secrets/DATABASE_URL_FILE)
exec node_modules/.bin/node-pg-migrate up \
  --migrations-dir db/migrations \
  --migrations-table pgmigrations \
  --decamelize
