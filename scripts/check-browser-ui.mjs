// Isolated Chrome checks: never attaches to a user's browser profile or visible window.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = process.argv.includes('--preview');
const debugOnly = process.argv.includes('--debug-only');
const versionsOnly = process.argv.includes('--versions-only');
const playerOnly = process.argv.includes('--player-only');
const consentOnly = process.argv.includes('--consent-only');
const profile = await mkdtemp(path.join(tmpdir(), 'lunar-ui-qa-'));
const chromePath = process.env.LUNAR_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/preview-ui.cjs', String(port)], { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] });
let chrome;
let socket;
let send;
try {
  for (let attempt = 0; ; attempt++) {
    try { await fetch(`${origin}/__viewport-report`); break; }
    catch (error) { if (attempt >= 40) throw error; await delay(100); }
  }
  const query = preview ? `?debug-preview&${process.argv.find(arg => arg.startsWith('width=')) || 'width=640'}&${process.argv.find(arg => arg.startsWith('height=')) || 'height=520'}&${process.argv.find(arg => arg.startsWith('language=')) || 'language=en'}&${process.argv.find(arg => arg.startsWith('tab=')) || 'tab=overview'}&${process.argv.find(arg => arg.startsWith('theme=')) || 'theme=dark'}` : debugOnly ? '?debug-only' : '';
  const url = consentOnly ? `${origin}/scripts/consent-check.html${preview ? '?preview' : ''}` : playerOnly ? `${origin}/scripts/media-player-check.html${preview ? '?preview' : ''}` : versionsOnly ? `${origin}/scripts/version-check.html${preview ? '?preview' : ''}` : `${origin}/scripts/viewport-check.html${query}`;
  chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', '--window-size=1440,1000', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let debugPort;
  for (let attempt = 0; ; attempt++) {
    try { debugPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch (error) { if (attempt >= 80) throw error; await delay(100); }
  }
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find(target => target.type === 'page' && target.url === 'about:blank');
  if (!page) throw new Error('Isolated preview tab was not created');
  socket = new WebSocket(page.webSocketDebuggerUrl.replace('ws://localhost:', 'ws://127.0.0.1:'));
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = event => reject(new Error(event.message || event.error?.message || 'Test browser WebSocket connection failed')); });
  let nextId = 0;
  let pageLoadRetries = 0;
  const requests = new Map();
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') console.error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') requests.set(message.params.requestId, message.params.request.url);
    if (message.method === 'Network.loadingFailed' && ['Script', 'Stylesheet'].includes(message.params.type)) {
      const failedUrl = requests.get(message.params.requestId);
      console.error('Preview resource failed:', message.params.errorText, failedUrl);
      if (/\/scripts\/(?:viewport|version|media-player)-check\.js$/.test(failedUrl || '') && pageLoadRetries++ < 2) {
        setTimeout(() => send('Page.reload').catch(() => {}), 200);
      }
    }
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Test browser command timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Page.navigate', { url });
  const deadline = Date.now() + 60000;
  if (preview) {
    while (Date.now() < deadline) {
      const state = await send('Runtime.evaluate', { expression: "document.querySelector('iframe')?.style.opacity === '1'", returnByValue: true });
      if (state.result.value) break;
      await delay(100);
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const output = path.join(profile, 'debug-preview.png');
    await writeFile(output, Buffer.from(screenshot.data, 'base64'));
    console.log(output);
    const metrics = await send('Runtime.evaluate', { expression: `JSON.stringify((() => {
      const frame = document.querySelector('iframe'); if (!frame) return {error: document.body.textContent}; const d = frame.contentDocument; const w = frame.contentWindow;
      return {boxes: [...d.querySelectorAll('#debug-dialog, .debug-form, .debug-content, #debug-dialog > form > .dialog-head, #debug-dialog > form > .dialog-actions, .debug-nav, #debug-refresh-status')].map(el => ({class: el.className, box: el.getBoundingClientRect().toJSON(), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight})), stylesheets: [...d.styleSheets[0].cssRules].map(rule => ({href: rule.href, rules: rule.styleSheet?.cssRules.length}))};
    })())`, returnByValue: true });
    console.log(metrics.result.value);
  } else {
    let report;
    while (Date.now() < deadline) {
      report = await (await fetch(`${origin}/__viewport-report`)).json();
      if (report) break;
      await delay(200);
    }
    if (!report) throw new Error('Browser checks timed out');
    console.log(JSON.stringify(report, null, 2));
    if (report.passed !== report.total) process.exitCode = 1;
  }
} finally {
  if (send) await send('Browser.close').catch(() => {});
  socket?.close();
  chrome?.kill();
  server.kill();
}
