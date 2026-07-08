import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = (process.env.PRESERVE_DATA_BASE_URL || "").replace(/\/+$/, "");
const files = (process.env.PRESERVE_DATA_FILES || "steam.json").split(",").map((file) => file.trim()).filter(Boolean);

async function preserve(file) {
  if (!baseUrl) {
    return;
  }

  const response = await fetch(`${baseUrl}/data/${file}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return;
  }

  const text = await response.text();
  JSON.parse(text);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../data/${file}`, import.meta.url), `${text.trim()}\n`, "utf8");
  console.log(`Preserved deployed data/${file}`);
}

await Promise.all(files.map((file) => preserve(file).catch(() => undefined)));
