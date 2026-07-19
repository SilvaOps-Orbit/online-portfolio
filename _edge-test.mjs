import { spawn } from 'child_process';
import http from 'http';
const WebSocket = globalThis.WebSocket;

const PORT = 8123;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { const list = JSON.parse(body); resolve(list.find(t => t.type === 'page')?.webSocketDebuggerUrl); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=9222', '--user-data-dir=_edge_profile',
    `http://127.0.0.1:${PORT}/index.html`,
  ], { stdio: 'ignore' });

  await wait(2500);
  let wsUrl;
  for (let i = 0; i < 10; i++) {
    try { wsUrl = await getWsUrl(); if (wsUrl) break; } catch {}
    await wait(500);
  }
  if (!wsUrl) { console.error('No WS url'); edge.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('CONSOLE ERROR: ' + msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push('EXCEPTION: ' + (d.exception?.description || d.text));
    }
  });

  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  await wait(3000); // let React mount + effects run

  // Find and click the Playstyle tab button
  const clickResult = await send('Runtime.evaluate', {
    expression: `(function(){
      const tabs = Array.from(document.querySelectorAll('.insight-tabs button'));
      const tab = tabs.find(b => /playstyle/i.test(b.textContent));
      if (!tab) return { found: false, tabs: tabs.map(t=>t.textContent) };
      tab.click();
      return { found: true };
    })()`,
    returnByValue: true,
  });
  console.log('CLICK Playstyle tab:', JSON.stringify(clickResult.result?.result?.value));

  await wait(1500);

  const inspect = await send('Runtime.evaluate', {
    expression: `(function(){
      const deck = document.querySelector('.steam-insight-deck');
      const panel = document.querySelector('.insight-panel');
      const fallback = document.querySelector('.react-api-status-fallback.is-error');
      const playstyle = document.querySelector('.steam-playstyle-profile');
      const habit = document.querySelector('.playstyle-habit-card');
      return {
        hasDeck: !!deck,
        hasPanel: !!panel,
        fallbackText: fallback ? fallback.textContent : null,
        hasPlaystyle: !!playstyle,
        hasHabitButton: !!habit,
        habitCount: document.querySelectorAll('.playstyle-habit-grid > *').length
      };
    })()`,
    returnByValue: true,
  });
  console.log('INSPECT:', JSON.stringify(inspect.result?.result?.value, null, 2));

  // Click the deep-dive habit button if present
  const dd = await send('Runtime.evaluate', {
    expression: `(function(){
      const btn = document.querySelector('.playstyle-habit-card');
      if (!btn) return { clicked:false };
      btn.click();
      return { clicked:true, text: btn.textContent };
    })()`,
    returnByValue: true,
  });
  await wait(800);
  const ddInspect = await send('Runtime.evaluate', {
    expression: `(function(){
      const reveal = document.querySelector('.deep-dive-reveal');
      const games = reveal ? reveal.querySelectorAll('.game-item').length : -1;
      return { revealExists: !!reveal, gameItems: games };
    })()`,
    returnByValue: true,
  });
  console.log('DEEP-DIVE click:', JSON.stringify(dd.result?.result?.value), '->', JSON.stringify(ddInspect.result?.result?.value));

  console.log('\\n=== PAGE ERRORS (' + errors.length + ') ===');
  errors.forEach(e => console.log(e));

  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
