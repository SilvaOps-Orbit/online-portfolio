(function () {
  "use strict";

  const storageKey = "echoops-technical-achievements-v1";
  const sourceFiles = ["index.html", "styles.css", "app.js", "portfolio.config.js", "tech-easter-eggs.js"];
  const snapshotFiles = ["steam.json", "spotify.json", "github.json", "market.json", "news.json"];
  const languageSequence = ["react.js", "typescript", "javascript"];
  const achievements = {
    console: {
      title: "Local Operator",
      detail: "Discovered a sandboxed command parser with asynchronous data probes."
    },
    integrity: {
      title: "Integrity Analyst",
      detail: "Ran a real SHA-256 runtime audit through the Web Crypto API."
    },
    architecture: {
      title: "Systems Mapper",
      detail: "Decoded the portfolio's browser, snapshot, workflow, and API boundaries."
    },
    snake: {
      title: "Packet Wrangler",
      detail: "Reached 50 points in the allowlisted Ops Console Snake protocol."
    }
  };

  let activeDialog = null;
  let state = readState();

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function readState() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      return stored && typeof stored === "object" && stored.unlocks && typeof stored.unlocks === "object"
        ? stored
        : { version: 1, unlocks: {} };
    } catch (error) {
      return { version: 1, unlocks: {} };
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      return;
    }
  }

  function unlockedIds() {
    return Object.keys(achievements).filter((id) => state.unlocks[id]);
  }

  function achievementCode() {
    const payload = unlockedIds().map((id) => `${id}:${state.unlocks[id]}`).join("|") || "undiscovered";
    let hash = 2166136261;
    for (const character of payload) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `ECHO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
  }

  function showToast(title, message) {
    document.querySelector(".tech-achievement-toast")?.remove();
    const toast = createElement("div", "tech-achievement-toast");
    toast.setAttribute("role", "status");
    toast.append(
      createElement("strong", "", title),
      createElement("span", "", message)
    );
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 4600);
  }

  function unlock(id) {
    if (!achievements[id] || state.unlocks[id]) return false;
    state.unlocks[id] = new Date().toISOString();
    saveState();
    document.dispatchEvent(new CustomEvent("echoops:achievement-unlocked", { detail: { id } }));
    const completed = unlockedIds().length === Object.keys(achievements).length;
    showToast(
      completed ? "Systems Architect unlocked" : achievements[id].title,
      completed ? `All ${Object.keys(achievements).length} technical discoveries are now recorded in the field report.` : achievements[id].detail
    );
    return true;
  }

  function closeActiveDialog() {
    if (activeDialog?.open) activeDialog.close();
  }

  function createLabDialog(kind, kicker, title, summary) {
    closeActiveDialog();
    const previousFocus = document.activeElement;
    const dialog = createElement("dialog", `tech-lab tech-lab-${kind}`);
    const frame = createElement("div", "tech-lab-frame");
    const header = createElement("header", "tech-lab-header");
    const heading = createElement("div", "tech-lab-heading");
    heading.append(
      createElement("span", "tech-lab-kicker", kicker),
      createElement("h2", "", title),
      createElement("p", "", summary)
    );
    const close = createElement("button", "tech-lab-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", `Close ${title}`);
    close.title = "Close";
    const content = createElement("div", "tech-lab-content");

    close.addEventListener("click", () => dialog.close());
    header.append(heading, close);
    frame.append(header, content);
    dialog.append(frame);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("tech-lab-open");
      dialog.remove();
      activeDialog = null;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    });

    document.body.append(dialog);
    document.body.classList.add("tech-lab-open");
    activeDialog = dialog;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return { dialog, content, close };
  }

  function appendTerminalLine(output, text, className = "") {
    const line = createElement("div", className, text);
    output.append(line);
    output.scrollTop = output.scrollHeight;
  }

  async function probeSnapshots(output) {
    appendTerminalLine(output, "probe :: checking same-origin snapshots...", "is-command");
    const results = await Promise.all(snapshotFiles.map(async (file) => {
      try {
        const response = await fetch(`data/${file}`, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        return `${file.padEnd(14, " ")} online  ${data.generatedAt || data.lastGoodAt || "timestamp unavailable"}`;
      } catch (error) {
        return `${file.padEnd(14, " ")} unavailable`;
      }
    }));
    results.forEach((line) => appendTerminalLine(output, line));
  }

  function createSnakeGame() {
    const columns = 24;
    const rows = 16;
    const cellSize = 30;
    const shell = createElement("section", "ops-snake-shell");
    shell.setAttribute("aria-label", "Ops Console Snake game");
    const header = createElement("div", "ops-snake-header");
    const scoreLabel = createElement("span", "ops-snake-score", "Score 0");
    const bestLabel = createElement("span", "ops-snake-best", `Best ${Number(state.snakeHighScore || 0)}`);
    const status = createElement("span", "ops-snake-status", "Running");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    header.append(scoreLabel, bestLabel, status);

    const canvas = document.createElement("canvas");
    canvas.className = "ops-snake-canvas";
    canvas.width = columns * cellSize;
    canvas.height = rows * cellSize;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "Snake game board. Use arrow or WASD keys. Space pauses and R restarts.");

    const controls = createElement("div", "ops-snake-controls");
    const actionControls = createElement("div", "ops-snake-actions");
    const pauseButton = createElement("button", "ops-snake-control", "Ⅱ");
    pauseButton.type = "button";
    pauseButton.title = "Pause or resume";
    pauseButton.setAttribute("aria-label", "Pause or resume Snake");
    const restartButton = createElement("button", "ops-snake-control", "↻");
    restartButton.type = "button";
    restartButton.title = "Restart";
    restartButton.setAttribute("aria-label", "Restart Snake");
    actionControls.append(pauseButton, restartButton);

    const directionControls = createElement("div", "ops-snake-directions");
    const directions = [
      { icon: "↑", label: "Move up", x: 0, y: -1, className: "is-up" },
      { icon: "←", label: "Move left", x: -1, y: 0, className: "is-left" },
      { icon: "↓", label: "Move down", x: 0, y: 1, className: "is-down" },
      { icon: "→", label: "Move right", x: 1, y: 0, className: "is-right" }
    ];
    const directionButtons = directions.map((direction) => {
      const button = createElement("button", `ops-snake-control ${direction.className}`, direction.icon);
      button.type = "button";
      button.title = direction.label;
      button.setAttribute("aria-label", direction.label);
      button.dataset.x = String(direction.x);
      button.dataset.y = String(direction.y);
      directionControls.append(button);
      return button;
    });
    controls.append(actionControls, directionControls);
    shell.append(header, canvas, controls);

    const context = canvas.getContext("2d");
    let snake = [];
    let food = { x: 17, y: 8 };
    let direction = { x: 1, y: 0 };
    let queuedDirection = { x: 1, y: 0 };
    let score = 0;
    let running = true;
    let gameOver = false;
    let destroyed = false;
    let timer = 0;

    function reset() {
      window.clearTimeout(timer);
      snake = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
      direction = { x: 1, y: 0 };
      queuedDirection = { x: 1, y: 0 };
      score = 0;
      running = true;
      gameOver = false;
      scoreLabel.textContent = "Score 0";
      status.textContent = "Running";
      pauseButton.textContent = "Ⅱ";
      placeFood();
      draw();
      schedule();
      canvas.focus();
    }

    function placeFood() {
      const openCells = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          if (!snake.some((part) => part.x === x && part.y === y)) openCells.push({ x, y });
        }
      }
      food = openCells[Math.floor(Math.random() * openCells.length)] || { x: 17, y: 8 };
    }

    function drawCell(x, y, colour, inset = 2) {
      context.fillStyle = colour;
      context.fillRect(x * cellSize + inset, y * cellSize + inset, cellSize - (inset * 2), cellSize - (inset * 2));
    }

    function draw() {
      if (!context) return;
      context.fillStyle = "#070b0e";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(86, 208, 190, 0.08)";
      context.lineWidth = 1;
      for (let x = 0; x <= columns; x += 1) {
        context.beginPath();
        context.moveTo(x * cellSize, 0);
        context.lineTo(x * cellSize, canvas.height);
        context.stroke();
      }
      for (let y = 0; y <= rows; y += 1) {
        context.beginPath();
        context.moveTo(0, y * cellSize);
        context.lineTo(canvas.width, y * cellSize);
        context.stroke();
      }
      drawCell(food.x, food.y, "#ff6168", 6);
      snake.forEach((part, index) => drawCell(part.x, part.y, index === 0 ? "#f7b955" : "#56d0be", index === 0 ? 2 : 4));
      if (gameOver) {
        context.fillStyle = "rgba(7, 11, 14, 0.76)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#f4f1e8";
        context.font = "900 34px Consolas, monospace";
        context.textAlign = "center";
        context.fillText("SIGNAL LOST", canvas.width / 2, (canvas.height / 2) - 8);
        context.fillStyle = "#f7b955";
        context.font = "700 19px Consolas, monospace";
        context.fillText(`SCORE ${score} · PRESS R`, canvas.width / 2, (canvas.height / 2) + 34);
      }
    }

    function schedule() {
      if (!running || destroyed || gameOver) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, Math.max(62, 132 - Math.floor(score / 10) * 4));
    }

    function tick() {
      if (!running || destroyed || gameOver) return;
      direction = queuedDirection;
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      const hitWall = head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows;
      const hitSelf = snake.some((part) => part.x === head.x && part.y === head.y);
      if (hitWall || hitSelf) {
        running = false;
        gameOver = true;
        status.textContent = "Signal lost";
        pauseButton.textContent = "▶";
        draw();
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreLabel.textContent = `Score ${score}`;
        if (score > Number(state.snakeHighScore || 0)) {
          state.snakeHighScore = score;
          bestLabel.textContent = `Best ${score}`;
          saveState();
        }
        if (score >= 50) unlock("snake");
        placeFood();
      } else {
        snake.pop();
      }
      draw();
      schedule();
    }

    function setDirection(x, y) {
      if (gameOver) return;
      if (x === -direction.x && y === -direction.y) return;
      queuedDirection = { x, y };
      if (!running) togglePause();
    }

    function togglePause() {
      if (gameOver) {
        reset();
        return;
      }
      running = !running;
      status.textContent = running ? "Running" : "Paused";
      pauseButton.textContent = running ? "Ⅱ" : "▶";
      if (running) schedule();
      else window.clearTimeout(timer);
    }

    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      const keyDirections = {
        arrowup: [0, -1], w: [0, -1],
        arrowleft: [-1, 0], a: [-1, 0],
        arrowdown: [0, 1], s: [0, 1],
        arrowright: [1, 0], d: [1, 0]
      };
      if (keyDirections[key]) {
        event.preventDefault();
        setDirection(...keyDirections[key]);
      } else if (key === " " || key === "p") {
        event.preventDefault();
        togglePause();
      } else if (key === "r") {
        event.preventDefault();
        reset();
      }
    }

    function onVisibilityChange() {
      if (document.hidden && running) togglePause();
    }

    canvas.addEventListener("keydown", onKeyDown);
    pauseButton.addEventListener("click", togglePause);
    restartButton.addEventListener("click", reset);
    directionButtons.forEach((button) => button.addEventListener("click", () => setDirection(Number(button.dataset.x), Number(button.dataset.y))));
    document.addEventListener("visibilitychange", onVisibilityChange);
    reset();

    return {
      element: shell,
      focus: () => canvas.focus(),
      destroy: () => {
        destroyed = true;
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        canvas.removeEventListener("keydown", onKeyDown);
      }
    };
  }

  function openOpsConsole() {
    const { dialog, content } = createLabDialog(
      "console",
      "Discovery 01 / Local Operator",
      "EchoOps sandbox console",
      "A DOM-safe command surface. Commands are matched against an allowlist; nothing is evaluated or passed to a system shell."
    );
    const output = createElement("div", "ops-console-output");
    output.setAttribute("role", "log");
    output.setAttribute("aria-live", "polite");
    const form = createElement("form", "ops-console-form");
    const prompt = createElement("span", "ops-console-prompt", "visitor@echoops:~$");
    const input = createElement("input", "ops-console-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Sandbox command");
    const history = [];
    let historyIndex = 0;
    const snakeHost = createElement("div", "ops-snake-host");
    snakeHost.hidden = true;
    let snakeGame = null;

    function closeSnake() {
      snakeGame?.destroy();
      snakeGame = null;
      snakeHost.replaceChildren();
      snakeHost.hidden = true;
      content.classList.remove("is-playing-snake");
    }

    function launchSnake() {
      closeSnake();
      snakeGame = createSnakeGame();
      snakeHost.hidden = false;
      snakeHost.append(snakeGame.element);
      content.classList.add("is-playing-snake");
      window.requestAnimationFrame(() => snakeGame?.focus());
    }

    appendTerminalLine(output, "EchoOps local sandbox v1.0");
    appendTerminalLine(output, "Type help to inspect the allowed command surface.");

    async function runCommand(rawValue) {
      const parts = rawValue.trim().toLowerCase().split(/\s+/);
      const command = parts[0];
      const argument = parts[1] || "";
      if (!command) return;
      appendTerminalLine(output, `${prompt.textContent} ${rawValue.trim()}`, "is-command");
      if (command === "help") {
        appendTerminalLine(output, "help · whoami · stack · security · probe · uptime · achievements · games · clear · exit");
      } else if (command === "whoami") {
        const profile = window.PORTFOLIO_CONFIG?.profile || {};
        appendTerminalLine(output, `${profile.name || "Alvis Leslie Gordon"} // ${profile.alias || "EchoOps"}`);
        appendTerminalLine(output, profile.role || "Creative developer with a security mindset.");
      } else if (command === "stack") {
        appendTerminalLine(output, "HTML · CSS · JavaScript · TypeScript · React · Node.js · GitHub Actions");
        appendTerminalLine(output, "Static-first delivery with lazy component islands and generated JSON snapshots.");
      } else if (command === "security") {
        const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "CSP unavailable";
        appendTerminalLine(output, `client secrets :: 0`);
        appendTerminalLine(output, `DOM output     :: textContent / explicit attributes`);
        appendTerminalLine(output, `CSP length     :: ${policy.length} characters`);
      } else if (command === "probe") {
        await probeSnapshots(output);
      } else if (command === "uptime") {
        appendTerminalLine(output, `runtime uptime :: ${(performance.now() / 1000).toFixed(2)} seconds`);
        appendTerminalLine(output, `DOM nodes      :: ${document.getElementsByTagName("*").length}`);
        appendTerminalLine(output, `viewport       :: ${window.innerWidth} × ${window.innerHeight}`);
      } else if (command === "achievements") {
        appendTerminalLine(output, `${unlockedIds().length}/${Object.keys(achievements).length} technical discoveries // ${achievementCode()}`);
      } else if (command === "games") {
        appendTerminalLine(output, "installed :: snake");
        appendTerminalLine(output, "launch    :: snake | play snake | game snake");
      } else if (command === "snake" || ((command === "play" || command === "game") && argument === "snake")) {
        appendTerminalLine(output, "snake protocol :: local canvas initialised", "is-command");
        launchSnake();
      } else if (command === "clear") {
        closeSnake();
        output.replaceChildren();
      } else if (command === "exit") {
        closeSnake();
        activeDialog?.close();
      } else {
        appendTerminalLine(output, `command denied: ${command}`, "is-error");
        appendTerminalLine(output, "The sandbox intentionally exposes no eval, shell, network target, or arbitrary file input.");
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      if (!value.trim()) return;
      history.push(value);
      historyIndex = history.length;
      input.value = "";
      void runCommand(value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" && history.length) {
        event.preventDefault();
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex] || "";
      } else if (event.key === "ArrowDown" && history.length) {
        event.preventDefault();
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = history[historyIndex] || "";
      }
    });

    form.append(prompt, input);
    dialog.addEventListener("close", closeSnake, { once: true });
    content.append(output, form, snakeHost);
    unlock("console");
    window.setTimeout(() => input.focus(), 80);
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function runIntegrityAudit(result, button) {
    button.disabled = true;
    button.textContent = "Hashing source files...";
    result.replaceChildren(createElement("p", "integrity-progress", "Fetching same-origin source bytes and building the audit buffer."));
    try {
      if (!window.crypto?.subtle) throw new Error("Web Crypto is unavailable in this browser context.");
      const encoder = new TextEncoder();
      const chunks = await Promise.all(sourceFiles.map(async (file) => {
        const response = await fetch(file, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`${file} returned ${response.status}`);
        return { file, bytes: new Uint8Array(await response.arrayBuffer()) };
      }));
      const separators = chunks.map(({ file }) => encoder.encode(`\n-- ${file} --\n`));
      const totalBytes = chunks.reduce((sum, chunk, index) => sum + chunk.bytes.length + separators[index].length, 0);
      const auditBuffer = new Uint8Array(totalBytes);
      let offset = 0;
      chunks.forEach((chunk, index) => {
        auditBuffer.set(separators[index], offset);
        offset += separators[index].length;
        auditBuffer.set(chunk.bytes, offset);
        offset += chunk.bytes.length;
      });
      const digest = toHex(await window.crypto.subtle.digest("SHA-256", auditBuffer));
      const grid = createElement("div", "integrity-result-grid");
      const values = [
        ["Algorithm", "SHA-256"],
        ["Files", String(chunks.length)],
        ["Bytes", new Intl.NumberFormat("en-AU").format(totalBytes)],
        ["Context", window.isSecureContext ? "Secure" : "Local development"]
      ];
      values.forEach(([label, value]) => {
        const item = createElement("div");
        item.append(createElement("span", "", label), createElement("strong", "", value));
        grid.append(item);
      });
      const hash = createElement("code", "integrity-hash", digest);
      const copy = createElement("button", "tech-lab-action is-secondary", "Copy fingerprint");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(digest);
          copy.textContent = "Copied";
        } catch (error) {
          copy.textContent = "Copy unavailable";
        }
      });
      result.replaceChildren(
        grid,
        createElement("p", "integrity-label", "Combined runtime fingerprint"),
        hash,
        copy,
        createElement("p", "integrity-caveat", "This verifies byte consistency for the files served in this session. It is an engineering diagnostic, not a publisher signature.")
      );
      unlock("integrity");
    } catch (error) {
      result.replaceChildren(createElement("p", "integrity-error", `Audit unavailable: ${error.message}`));
    } finally {
      button.disabled = false;
      button.textContent = "Run audit again";
    }
  }

  function openIntegrityLab() {
    const { content } = createLabDialog(
      "integrity",
      "Discovery 02 / Integrity Analyst",
      "Runtime integrity lab",
      "A real client-side audit that fetches the deployed source files and calculates one combined SHA-256 fingerprint with Web Crypto."
    );
    const action = createElement("button", "tech-lab-action", "Run source audit");
    action.type = "button";
    const result = createElement("div", "integrity-result");
    action.addEventListener("click", () => void runIntegrityAudit(result, action));
    content.append(action, result);
    window.setTimeout(() => action.click(), 180);
  }

  async function loadArchitectureStatuses(target) {
    const results = await Promise.all(snapshotFiles.map(async (file) => {
      try {
        const response = await fetch(`data/${file}`, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        return { file, state: data.stale ? "cached" : "ready", timestamp: data.lastGoodAt || data.generatedAt || "No timestamp" };
      } catch (error) {
        return { file, state: "offline", timestamp: "Unavailable" };
      }
    }));
    target.replaceChildren();
    results.forEach((item) => {
      const row = createElement("div", `architecture-status is-${item.state}`);
      row.append(
        createElement("span", "architecture-status-dot"),
        createElement("strong", "", item.file.replace(".json", "")),
        createElement("span", "", item.state),
        createElement("time", "", item.timestamp)
      );
      target.append(row);
    });
  }

  function openArchitectureBlueprint() {
    const { content } = createLabDialog(
      "architecture",
      "Discovery 03 / Systems Mapper",
      "Portfolio architecture blueprint",
      "A live map of where public data moves, where credentials stop, and how the static interface remains useful during upstream failures."
    );
    const flow = createElement("div", "architecture-flow");
    const nodes = [
      ["01", "Visitor browser", "Semantic DOM, CSS motion, local cache"],
      ["02", "Snapshot boundary", "Same-origin JSON and last-good values"],
      ["03", "Actions runtime", "Sanitizers, scheduled jobs, private secrets"],
      ["04", "External sources", "Steam, Spotify, GitHub, finance, news"]
    ];
    nodes.forEach(([number, title, detail], index) => {
      const node = createElement("article", "architecture-node");
      node.append(
        createElement("span", "architecture-node-number", number),
        createElement("strong", "", title),
        createElement("p", "", detail)
      );
      flow.append(node);
      if (index < nodes.length - 1) {
        const connector = createElement("div", "architecture-connector");
        connector.setAttribute("aria-hidden", "true");
        connector.append(createElement("span", "architecture-packet"));
        flow.append(connector);
      }
    });
    const boundaries = createElement("div", "architecture-boundaries");
    [
      ["Browser secrets", "0"],
      ["GitHub browser cadence", "1 hour"],
      ["Snapshot fallback", "Last good"],
      ["React loading", "On approach"]
    ].forEach(([label, value]) => {
      const item = createElement("div");
      item.append(createElement("span", "", label), createElement("strong", "", value));
      boundaries.append(item);
    });
    const statuses = createElement("div", "architecture-status-grid");
    statuses.append(createElement("p", "", "Inspecting current snapshot layer..."));
    content.append(flow, boundaries, createElement("h3", "architecture-status-title", "Current snapshot telemetry"), statuses);
    unlock("architecture");
    void loadArchitectureStatuses(statuses);
  }

  function openVault() {
    const count = unlockedIds().length;
    const total = Object.keys(achievements).length;
    const complete = count === total;
    const { content } = createLabDialog(
      "vault",
      complete ? "Technical mastery achieved" : `Technical discoveries ${count}/${total}`,
      complete ? "Systems Architect field report" : "Encrypted achievement vault",
      complete
        ? `${total} hidden systems were discovered, inspected, and persisted locally without an account or tracking identifier.`
        : "Discoveries are stored only in this browser. Locked entries reveal the engineering discipline demonstrated by each reward."
    );
    const list = createElement("div", "achievement-list");
    Object.entries(achievements).forEach(([id, achievement], index) => {
      const unlocked = Boolean(state.unlocks[id]);
      const item = createElement("article", `achievement-item ${unlocked ? "is-unlocked" : "is-locked"}`);
      item.append(
        createElement("span", "achievement-index", String(index + 1).padStart(2, "0")),
        createElement("strong", "", unlocked ? achievement.title : "Undiscovered system"),
        createElement("p", "", unlocked ? achievement.detail : "Signal unavailable. Continue inspecting the interface."),
        createElement("time", "", unlocked ? new Date(state.unlocks[id]).toLocaleString("en-AU") : "Locked")
      );
      list.append(item);
    });
    const code = createElement("div", "achievement-code");
    code.append(createElement("span", "", "Local field-report ID"), createElement("code", "", achievementCode()));
    content.append(list, code);
  }

  function renderVaultButton() {
    document.getElementById("tech-achievement-vault")?.remove();
    const count = unlockedIds().length;
    const total = Object.keys(achievements).length;
    if (!count) return;
    const footer = document.querySelector(".footer-actions");
    if (!footer) return;
    const button = createElement(
      "button",
      `tech-vault-button ${count === total ? "is-complete" : ""}`,
      count === total ? `Systems Architect ${total}/${total}` : `Technical discoveries ${count}/${total}`
    );
    button.id = "tech-achievement-vault";
    button.type = "button";
    button.addEventListener("click", openVault);
    footer.append(button);
  }

  function bindMultiTap(target, tapsNeeded, timeout, callback, bindKeyboard = true) {
    if (!target) return;
    let taps = 0;
    let timer = 0;
    const register = () => {
      taps += 1;
      window.clearTimeout(timer);
      target.classList.toggle("is-tech-primed", taps > 1);
      if (taps >= tapsNeeded) {
        taps = 0;
        target.classList.remove("is-tech-primed");
        callback();
        return;
      }
      timer = window.setTimeout(() => {
        taps = 0;
        target.classList.remove("is-tech-primed");
      }, timeout);
    };
    target.addEventListener("click", register);
    if (bindKeyboard) {
      target.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          register();
        }
      });
    }
  }

  function normalizeLanguageLabel(value) {
    return String(value || "").replace(/\s+\d+(?:\.\d+)?%$/, "").trim().toLowerCase();
  }

  function bindArchitectureSequence() {
    let progress = 0;
    let resetTimer = 0;

    const activate = (chip) => {
      const value = normalizeLanguageLabel(chip.textContent);
      if (!progress && value !== languageSequence[0]) return;
      window.clearTimeout(resetTimer);
      if (value === languageSequence[progress]) {
        progress += 1;
        chip.classList.add("is-sequence-correct");
        window.setTimeout(() => chip.classList.remove("is-sequence-correct"), 1000);
        if (progress === languageSequence.length) {
          progress = 0;
          window.setTimeout(openArchitectureBlueprint, 260);
          return;
        }
      } else {
        progress = value === languageSequence[0] ? 1 : 0;
        chip.classList.add("is-sequence-wrong");
        window.setTimeout(() => chip.classList.remove("is-sequence-wrong"), 1000);
      }
      resetTimer = window.setTimeout(() => {
        progress = 0;
      }, 5000);
    };

    document.addEventListener("click", (event) => {
      const chip = event.target.closest?.(".repo-language-stack .is-language");
      if (chip) activate(chip);
    });
    document.addEventListener("keydown", (event) => {
      const chip = event.target.closest?.(".repo-language-stack .is-language");
      if (chip && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        activate(chip);
      }
    });
  }

  function init() {
    const brand = document.getElementById("brand-name");
    if (brand) {
      bindMultiTap(brand, 5, 3600, openOpsConsole, false);
    }

    const footerNote = document.querySelector(".footer-note");
    if (footerNote) {
      footerNote.tabIndex = 0;
      footerNote.setAttribute("role", "button");
      footerNote.setAttribute("aria-label", "Secure portfolio integrity marker");
      footerNote.title = "Runtime integrity marker";
      bindMultiTap(footerNote, 4, 3600, openIntegrityLab);
    }

    bindArchitectureSequence();
  }

  init();
})();
