import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

export default async () => {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();

  execSync(
    `node_modules/.bin/node-pg-migrate up \
      --migrations-dir db/migrations \
      --migrations-table pgmigrations \
      --decamelize`,
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } },
  );

  global.__PG_CONTAINER__ = container;
  global.__DATABASE_URL__ = url;
};
