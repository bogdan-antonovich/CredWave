#!/bin/sh
export DATABASE_URL=$(cat /run/secrets/DATABASE_URL_FILE)

echo "Waiting for Postgres..."

MAX_RETRIES=60
RETRY_INTERVAL=2
COUNT=0

until nc -z db 5432; do
  COUNT=$((COUNT + 1))

  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "Postgres not available after $MAX_RETRIES attempts"
    exit 1
  fi

  echo "Waiting for db... attempt $COUNT"
  sleep $RETRY_INTERVAL
done

echo "DB is up, running migrations..."

node_modules/.bin/node-pg-migrate up \
  --migrations-dir db/migrations \
  --migrations-table pgmigrations \
  --decamelize

echo "Migrations complete"
