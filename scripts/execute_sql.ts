import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

async function main() {
  const sqlFileArg = process.argv[2];
  if (!sqlFileArg) {
    console.error("Usage: npx tsx scripts/execute_sql.ts <path-to-sql-file>");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), sqlFileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(filePath, "utf8");

  const client = new Client({
    host: process.env.PGHOST || "aws-0-ap-northeast-2.pooler.supabase.com",
    port: parseInt(process.env.PGPORT || "6543", 10),
    user: process.env.PGUSER || "postgres.rooaitpvnvmjtytzaukk",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "postgres",
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Connecting to database to execute ${path.basename(filePath)}...`);
  await client.connect();
  console.log("Connected successfully. Running SQL statements...");

  try {
    const res = await client.query(sqlContent);
    console.log("SQL executed successfully!");
    if (Array.isArray(res)) {
      for (const r of res) {
        if (r.command === "SELECT" && r.rows && r.rows.length > 0) {
          console.table(r.rows);
        }
      }
    } else if (res && res.command === "SELECT" && res.rows && res.rows.length > 0) {
      console.table(res.rows);
    }
  } catch (err) {
    console.error("SQL Execution failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
