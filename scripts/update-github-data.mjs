import { mkdir, readFile, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "SilvaOps-Orbit";
const token = process.env.GITHUB_TOKEN || "";
const outputPath = new URL("../data/github.json", import.meta.url);

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    return null;
  }
}

async function githubJson(path) {
  const url = path.startsWith("https://") ? new URL(path) : new URL(path, "https://api.github.com");
  if (url.origin !== "https://api.github.com") {
    throw new Error("Refused a non-GitHub API URL.");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "EchoOps-Portfolio-GitHub-Snapshot",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const suffix = remaining === null ? "" : `; ${remaining} requests remaining`;
    throw new Error(`GitHub API returned ${response.status}${suffix}.`);
  }
  return response.json();
}

function sanitizeRepository(repo) {
  return {
    id: Number(repo.id || 0),
    name: cleanText(repo.name, 120),
    full_name: cleanText(repo.full_name, 240),
    html_url: cleanUrl(repo.html_url),
    description: cleanText(repo.description || "Public repository", 500),
    homepage: cleanUrl(repo.homepage),
    language: cleanText(repo.language, 80),
    topics: Array.isArray(repo.topics) ? repo.topics.map((topic) => cleanText(topic, 60)).filter(Boolean).slice(0, 20) : [],
    stargazers_count: Math.max(0, Number(repo.stargazers_count || 0)),
    forks_count: Math.max(0, Number(repo.forks_count || 0)),
    open_issues_count: Math.max(0, Number(repo.open_issues_count || 0)),
    size: Math.max(0, Number(repo.size || 0)),
    updated_at: cleanText(repo.updated_at, 40),
    has_pages: Boolean(repo.has_pages),
    has_issues: Boolean(repo.has_issues),
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork)
  };
}

function sanitizeEvent(event) {
  return {
    id: cleanText(event.id, 80),
    type: cleanText(event.type, 80),
    created_at: cleanText(event.created_at, 40),
    repo: {
      name: cleanText(event.repo?.name, 240),
      url: cleanUrl(event.repo?.url)
    }
  };
}

function usefulSnapshot(data) {
  return Array.isArray(data?.repositories) && data.repositories.some((repo) => repo?.name && repo?.html_url);
}

async function buildSnapshot(existing) {
  const reposResponse = await githubJson(`/users/${encodeURIComponent(username)}/repos?sort=updated&direction=desc&per_page=100&type=owner`);
  const repositories = (Array.isArray(reposResponse) ? reposResponse : [])
    .filter((repo) => !repo?.fork)
    .map(sanitizeRepository)
    .filter((repo) => repo.name && repo.html_url);

  let events = Array.isArray(existing?.events) ? existing.events : [];
  try {
    const eventResponse = await githubJson(`/users/${encodeURIComponent(username)}/events/public?per_page=100`);
    events = (Array.isArray(eventResponse) ? eventResponse : []).map(sanitizeEvent).filter((event) => event.created_at);
  } catch (error) {
    console.warn(`Kept the previous public activity snapshot: ${error.message}`);
  }

  const languagesByRepo = {};
  for (const repo of repositories) {
    const previousLanguages = existing?.languagesByRepo?.[repo.full_name] || existing?.languagesByRepo?.[repo.name] || {};
    try {
      const languageResponse = await githubJson(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/languages`);
      const cleanedLanguages = Object.fromEntries(
        Object.entries(languageResponse || {})
          .map(([language, bytes]) => [cleanText(language, 80), Math.max(0, Number(bytes || 0))])
          .filter(([language, bytes]) => language && bytes > 0)
      );
      languagesByRepo[repo.full_name] = Object.keys(cleanedLanguages).length ? cleanedLanguages : previousLanguages;
    } catch (error) {
      languagesByRepo[repo.full_name] = previousLanguages;
      console.warn(`Kept previous language data for ${repo.name}: ${error.message}`);
    }
  }

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    generatedAt: now,
    lastGoodAt: now,
    source: "GitHub REST API via GitHub Actions",
    status: `${repositories.length} public non-fork repositories cached securely by GitHub Actions.`,
    stale: false,
    profile: {
      username,
      url: `https://github.com/${encodeURIComponent(username)}`
    },
    stats: [
      {
        label: "Repositories",
        value: String(repositories.length),
        note: "public non-fork"
      }
    ],
    repositories,
    events,
    languagesByRepo
  };
}

const existing = await readExistingData();

try {
  const snapshot = await buildSnapshot(existing);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated data/github.json for ${username} with ${snapshot.repositories.length} repositories.`);
} catch (error) {
  if (!usefulSnapshot(existing)) {
    throw error;
  }

  const fallback = {
    ...existing,
    source: existing.source || "last successful GitHub snapshot",
    status: `Last successful GitHub snapshot preserved because this refresh failed: ${cleanText(error.message, 160)}`,
    stale: true
  };
  await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.warn(fallback.status);
}
