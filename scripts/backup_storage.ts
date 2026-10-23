import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_NAME = "project-files";

async function listAllFiles(folder = ""): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    console.error(`Error listing folder "${folder}":`, error);
    return [];
  }

  let files: string[] = [];
  for (const item of data || []) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    if (item.id === null) {
      // It's a folder
      const subFiles = await listAllFiles(itemPath);
      files = files.concat(subFiles);
    } else {
      files.push(itemPath);
    }
  }
  return files;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storageBackupDir = path.join(process.cwd(), "backups", "storage_files", timestamp);
  fs.mkdirSync(storageBackupDir, { recursive: true });

  console.log(`Starting storage backup from bucket "${BUCKET_NAME}" to ${storageBackupDir}...`);

  const files = await listAllFiles();
  console.log(`Found ${files.length} file(s) in bucket "${BUCKET_NAME}".`);

  let downloadedCount = 0;
  for (const filePath of files) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
    if (error) {
      console.error(`Failed to download ${filePath}:`, error);
      continue;
    }

    const localFilePath = path.join(storageBackupDir, filePath);
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localFilePath, buffer);
    downloadedCount++;
    console.log(`- Downloaded: ${filePath} (${buffer.length} bytes)`);
  }

  console.log("\n=================== STORAGE BACKUP SUMMARY ===================");
  console.log(`Total files downloaded: ${downloadedCount} of ${files.length}`);
  console.log(`Destination directory: ${storageBackupDir}`);
}

main().catch((err) => {
  console.error("Storage backup failed:", err);
  process.exit(1);
});
