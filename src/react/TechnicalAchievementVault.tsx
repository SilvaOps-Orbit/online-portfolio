import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";

const STORAGE_KEY = "echoops-technical-achievements-v1";
const achievements = {
  console: { title: "Local Operator", detail: "Discovered a sandboxed command parser with asynchronous data probes." },
  integrity: { title: "Integrity Analyst", detail: "Ran a real SHA-256 runtime audit through the Web Crypto API." },
  architecture: { title: "Systems Mapper", detail: "Decoded the portfolio's browser, snapshot, workflow, and API boundaries." }
} as const;

type AchievementId = keyof typeof achievements;
type Unlocks = Partial<Record<AchievementId, string>>;

function readUnlocks(): Unlocks {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as { unlocks?: Unlocks } | null;
    return value?.unlocks || {};
  } catch { return {}; }
}

function reportCode(unlocks: Unlocks): string {
  const payload = (Object.keys(achievements) as AchievementId[]).filter((id) => unlocks[id]).map((id) => `${id}:${unlocks[id]}`).join("|") || "undiscovered";
  let hash = 2166136261;
  for (const character of payload) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `ECHO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function TechnicalAchievementVault() {
  const [unlocks, setUnlocks] = useState<Unlocks>(readUnlocks);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const unlockedIds = useMemo(() => (Object.keys(achievements) as AchievementId[]).filter((id) => unlocks[id]), [unlocks]);
  const complete = unlockedIds.length === Object.keys(achievements).length;

  useEffect(() => {
    const refresh = () => setUnlocks(readUnlocks());
    const handleStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) refresh(); };
    const handleShortcut = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if (!typing && event.shiftKey && event.key.toLowerCase() === "a" && unlockedIds.length) { event.preventDefault(); setOpen(true); }
    };
    window.addEventListener("storage", handleStorage);
    document.addEventListener("echoops:achievement-unlocked", refresh);
    document.addEventListener("keydown", handleShortcut);
    return () => { window.removeEventListener("storage", handleStorage); document.removeEventListener("echoops:achievement-unlocked", refresh); document.removeEventListener("keydown", handleShortcut); };
  }, [unlockedIds.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!unlockedIds.length) return null;
  return (
    <>
      <button className={`tech-vault-button${complete ? " is-complete" : ""}`} type="button" onClick={() => setOpen(true)}>{complete ? "Systems Architect 3/3" : `Technical discoveries ${unlockedIds.length}/3`}</button>
      <dialog ref={dialogRef} className="tech-lab tech-lab-vault" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }}>
        <div className="tech-lab-frame">
          <header className="tech-lab-header"><div className="tech-lab-heading"><span className="tech-lab-kicker">{complete ? "Technical mastery achieved" : `Technical discoveries ${unlockedIds.length}/3`}</span><h2>{complete ? "Systems Architect field report" : "Encrypted achievement vault"}</h2><p>{complete ? "Three hidden systems were discovered, inspected, and persisted locally without an account or tracking identifier." : "Discoveries are stored only in this browser. Locked entries reveal the engineering discipline demonstrated by each reward."}</p></div><button className="tech-lab-close" type="button" aria-label="Close achievement vault" title="Close" onClick={() => setOpen(false)}>×</button></header>
          <div className="tech-lab-content"><div className="achievement-list">{(Object.entries(achievements) as Array<[AchievementId, typeof achievements[AchievementId]]>).map(([id, achievement], index) => { const unlocked = Boolean(unlocks[id]); return <article className={`achievement-item ${unlocked ? "is-unlocked" : "is-locked"}`} key={id}><span className="achievement-index">{String(index + 1).padStart(2, "0")}</span><strong>{unlocked ? achievement.title : "Undiscovered system"}</strong><p>{unlocked ? achievement.detail : "Signal unavailable. Continue inspecting the interface."}</p><time dateTime={unlocks[id]}>{unlocked ? new Date(unlocks[id] || "").toLocaleString("en-AU") : "Locked"}</time></article>; })}</div><div className="achievement-code"><span>Local field-report ID</span><code>{reportCode(unlocks)}</code></div></div>
        </div>
      </dialog>
    </>
  );
}

export function mountTechnicalAchievementVault(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Technical achievement vault"><TechnicalAchievementVault /></IslandBoundary></StrictMode>);
}
