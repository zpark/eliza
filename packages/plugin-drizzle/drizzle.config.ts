import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle/migrations',
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
    prefix: 'timestamp',
  },
  breakpoints: true,
});
