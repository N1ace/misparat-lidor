import postgres from "postgres";

const globalForSql = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForSql.__sql) {
    globalForSql.__sql = postgres(url, {
      prepare: false, // required for PgBouncer transaction pooler
      max: 10,
    });
  }
  return globalForSql.__sql;
}

export type Sql = ReturnType<typeof getSql>;
