import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { IslandBoundary } from "./IslandBoundary";

const STORAGE_KEY = "echoops-technical-achievements-v1";
const achievements = {
  console: {
    title: "Local Operator",
    detail: "Discovered a sandboxed command parser with asynchronous data probes.",
    hints: [
      "The name in the header behaves more like a secured hatch than a label.",
      "Operators rarely knock once. Keep a quick, steady rhythm on the EchoOps brand.",
      "Tap the EchoOps brand name five times before the signal resets."
    ]
  },
  integrity: {
    title: "Integrity Analyst",
    detail: "Ran a real SHA-256 runtime audit through the Web Crypto API.",
    hints: [
      "Ownership is declared at the very bottom, but the nearby line guards more than copyright.",
      "The footer's security sentence is an active marker. Repeated inspection wakes it up.",
      "Tap the footer note four times to open the runtime integrity lab."
    ]
  },
  architecture: {
    title: "Systems Mapper",
    detail: "Decoded the portfolio's browser, snapshot, workflow, and API boundaries.",
    hints: [
      "One public repository speaks several languages. Its labels remember how the site evolved.",
      "Start with the newest interface layer, cross the typed bridge, then return to the original browser tongue.",
      "In the GitHub repository card, select React.js, TypeScript, then JavaScript."
    ]
  },
  snake: {
    title: "Packet Wrangler",
    detail: "Reached 50 points in the allowlisted Ops Console Snake protocol.",
    hints: [
      "A game is installed somewhere no ordinary navigation link can reach.",
      "First become a Local Operator, then ask the console which games are available.",
      "Open the Ops Console, run `snake`, and reach 50 points."
    ]
  }
} as const;

const sideSignals = {
  alias: {
    label: "Hero side-channel",
    hints: [
      "An alias can be more than something you read. Sometimes it answers when called.",
      "The gold aka line listens for a short triple beat, and the page also listens for its name.",
      "Click the EchoOps alias three times, or type `echoops` while you are not inside a form."
    ]
  },
  mission: {
    label: "Roadmap side-channel",
    hints: [
      "Some attributes explain themselves with one hand and test your judgement with the other.",
      "In the end-goal panel, the uncommon mouse button tests a four-part sequence.",
      "Right-click Leadership, Judgement, Teamwork, then Humility."
    ]
  }
} as const;

type AchievementId = keyof typeof achievements;
type SideSignalId = keyof typeof sideSignals;
type HintId = AchievementId | SideSignalId;
type Unlocks = Partial<Record<AchievementId, string>>;
type HintLevels = Partial<Record<HintId, number>>;

interface HintControlProps {
  id: HintId;
  hints: readonly string[];
  levels: HintLevels;
  onAdvance: (id: HintId, total: number) => void;
}

function HintControl({ id, hints, levels, onAdvance }: HintControlProps) {
  const level = Math.min(hints.length, levels[id] || 0);
  const complete = level >= hints.length;
  return (
    <div className={`achievement-hint${level ? " is-revealed" : ""}`} data-level={level}>
      <p className="achievement-hint-copy" aria-live="polite">
        {level ? hints[level - 1] : "Signal encrypted. Decrypt one clue at a time."}
      </p>
      <button className="achievement-hint-button" type="button" disabled={complete} onClick={() => onAdvance(id, hints.length)}>
        {complete ? "Signal fully decrypted" : `Decrypt hint ${level + 1}/${hints.length}`}
      </button>
    </div>
  );
}

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
  const [hintLevels, setHintLevels] = useState<HintLevels>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const unlockedIds = useMemo(() => (Object.keys(achievements) as AchievementId[]).filter((id) => unlocks[id]), [unlocks]);
  const total = Object.keys(achievements).length;
  const complete = unlockedIds.length === total;

  useEffect(() => {
    const refresh = () => setUnlocks(readUnlocks());
    const handleStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) refresh(); };
    const handleShortcut = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if (!typing && event.shiftKey && event.key.toLowerCase() === "a") { event.preventDefault(); setOpen(true); }
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

  function advanceHint(id: HintId, hintTotal: number) {
    setHintLevels((current) => ({ ...current, [id]: Math.min(hintTotal, (current[id] || 0) + 1) }));
  }

  const scannerLabel = complete
    ? `Systems Architect ${total}/${total}`
    : unlockedIds.length
      ? `Technical discoveries ${unlockedIds.length}/${total} · hints`
      : "Hidden signal scanner · 6 clues";

  return (
    <>
      <button className={`tech-vault-button${complete ? " is-complete" : " is-scanner"}`} type="button" onClick={() => setOpen(true)}><span aria-hidden="true" />{scannerLabel}</button>
      <dialog ref={dialogRef} className="tech-lab tech-lab-vault" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }}>
        <div className="tech-lab-frame">
          <header className="tech-lab-header"><div className="tech-lab-heading"><span className="tech-lab-kicker">{complete ? "Technical mastery achieved" : unlockedIds.length ? `Technical discoveries ${unlockedIds.length}/${total}` : "Six encrypted signals detected"}</span><h2>{complete ? "Systems Architect field report" : "Hidden signal scanner"}</h2><p>{complete ? `${total} hidden systems were discovered, inspected, and persisted locally without an account or tracking identifier.` : "Every hidden system has three progressive clues. Stop when you have enough signal, or keep decrypting for a near-direct route."}</p></div><button className="tech-lab-close" type="button" aria-label="Close signal scanner" title="Close" onClick={() => setOpen(false)}>×</button></header>
          <div className="tech-lab-content">
            <div className="achievement-list">{(Object.entries(achievements) as Array<[AchievementId, typeof achievements[AchievementId]]>).map(([id, achievement], index) => {
              const unlocked = Boolean(unlocks[id]);
              return (
                <article className={`achievement-item ${unlocked ? "is-unlocked" : "is-locked"}`} key={id}>
                  <span className="achievement-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{unlocked ? achievement.title : "Undiscovered system"}</strong>
                  <p>{unlocked ? achievement.detail : "A tracked technical achievement is hiding somewhere in the interface."}</p>
                  {!unlocked && <HintControl id={id} hints={achievement.hints} levels={hintLevels} onAdvance={advanceHint} />}
                  <time dateTime={unlocks[id]}>{unlocked ? new Date(unlocks[id] || "").toLocaleString("en-AU") : "Achievement locked"}</time>
                </article>
              );
            })}</div>
            <section className="side-signal-section" aria-labelledby="side-signal-title">
              <div className="side-signal-heading"><span className="tech-lab-kicker">Side-channel scan</span><h3 id="side-signal-title">Two extra interactions outside the achievement count</h3><p>These trigger visual rewards but do not change the four-part technical field report.</p></div>
              <div className="side-signal-list">{(Object.entries(sideSignals) as Array<[SideSignalId, typeof sideSignals[SideSignalId]]>).map(([id, signal], index) => (
                <article className="side-signal-item" key={id}>
                  <span className="achievement-index">S{index + 1}</span>
                  <strong>{signal.label}</strong>
                  <HintControl id={id} hints={signal.hints} levels={hintLevels} onAdvance={advanceHint} />
                </article>
              ))}</div>
            </section>
            <div className="achievement-code"><span>Local field-report ID</span><code>{reportCode(unlocks)}</code></div>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function mountTechnicalAchievementVault(target: HTMLElement) {
  createRoot(target).render(<StrictMode><IslandBoundary label="Technical achievement vault"><TechnicalAchievementVault /></IslandBoundary></StrictMode>);
}
