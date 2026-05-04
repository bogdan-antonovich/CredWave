#!/bin/sh
export DATABASE_URL=$(cat /run/secrets/DATABASE_URL_FILE)

MAX_RETRIES=30
RETRY_INTERVAL=5
COUNT=0

until node_modules/.bin/node-pg-migrate up \
  --migrations-dir db/migrations \
  --migrations-table pgmigrations \
  --decamelize 2>&1; do

  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "Migration failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Attempt $COUNT failed, retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo "Migrations complete"
