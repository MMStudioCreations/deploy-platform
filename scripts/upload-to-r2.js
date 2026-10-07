// Uploads a local folder to the bymamstudio-templates R2 bucket.
//   node upload-to-r2.js                                   templates/raw -> bucket root (original use)
//   node upload-to-r2.js --dir ../templates/processed --prefix gallery/processed/
//   node upload-to-r2.js --file ../templates/gallery.html --key gallery/index.html
// Files already in the bucket with the same size are skipped, so re-runs only send what changed.
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative, extname, resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const BUCKET = "bymamstudio-templates";
const CONCURRENCY = 10;
const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const TEMPLATES_DIR = arg("--dir") ? resolve(arg("--dir")) : join(fileURLToPath(import.meta.url), "../../templates/raw");
const PREFIX = arg("--prefix") || "";
const keyFor = (filePath) => PREFIX + relative(TEMPLATES_DIR, filePath).replace(/\\/g, "/");

const CONTENT_TYPES = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".json": "application/json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
  ".eot":  "application/vnd.ms-fontobject",
  ".xml":  "application/xml",
  ".txt":  "text/plain",
  ".map":  "application/json",
  ".pdf":  "application/pdf",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".mp3":  "audio/mpeg",
};

function contentType(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function uploadFile(client, filePath, key, index, total) {
  const body = await readFile(filePath);
  process.stdout.write(`Uploading ${index}/${total}: ${key}\n`);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType(filePath),
  }));
}

async function runQueue(tasks, concurrency) {
  const queue = [...tasks];
  let errors = 0;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      try {
        await task();
      } catch (err) {
        errors++;
        console.error(`  ERROR: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return errors;
}

async function main() {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env;

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    console.error("Missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_ENDPOINT in .env");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  if (arg("--file")) {
    await uploadFile(client, resolve(arg("--file")), arg("--key"), 1, 1);
    console.log("Done.");
    return;
  }

  console.log(`Scanning ${TEMPLATES_DIR} ...`);
  const all = await collectFiles(TEMPLATES_DIR);

  // Skip files already uploaded with the same size
  const existing = new Map();
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }));
    for (const o of page.Contents || []) existing.set(o.Key, o.Size);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const files = [];
  for (const f of all) {
    if (existing.get(keyFor(f)) !== (await stat(f)).size) files.push(f);
  }
  console.log(`${all.length} files, ${all.length - files.length} already uploaded.`);
  const total = files.length;
  console.log(`Found ${total} files. Uploading with concurrency=${CONCURRENCY}\n`);

  let index = 0;
  const tasks = files.map((filePath) => async () => {
    const key = keyFor(filePath);
    await uploadFile(client, filePath, key, ++index, total);
  });

  const errors = await runQueue(tasks, CONCURRENCY);

  console.log(`\nDone. ${total - errors}/${total} uploaded successfully.${errors > 0 ? ` ${errors} errors.` : ""}`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
