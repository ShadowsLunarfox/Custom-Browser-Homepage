import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = createHash('sha256').update(readFileSync(path.join(root, 'native/windows-media/Host.cs'))).digest('hex').slice(0,12);
const buildDirectory = path.join(root, 'native/windows-media/bin', version);
const executable = path.join(buildDirectory, 'LunarMediaHost.exe');
const child = spawn(executable, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let data = Buffer.alloc(0);
let id = 0;
const requests = new Map();
let fixture;
let fixtureError = '';
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); });
child.stdout.on('data', chunk => {
  data = Buffer.concat([data, chunk]);
  while (data.length >= 4) {
    const length = data.readUInt32LE(0);
    assert(length < 1000000, 'Native response exceeded Chrome’s message limit');
    if (data.length < length + 4) break;
    const result = JSON.parse(data.subarray(4, length + 4).toString('utf8'));
    data = data.subarray(length + 4);
    const request = requests.get(result.id);
    if (request) { requests.delete(result.id); clearTimeout(request.timer); request.resolve(result); }
  }
});
child.on('error', error => { for (const request of requests.values()) request.reject(error); });
child.on('exit', code => { if (requests.size) for (const request of requests.values()) request.reject(new Error(`Host exited ${code}: ${stderr}`)); });
const send = payload => new Promise((resolve, reject) => {
  const requestId = ++id;
  const body = Buffer.from(JSON.stringify({ ...payload, id: requestId }), 'utf8');
  const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  const timer = setTimeout(() => { requests.delete(requestId); reject(new Error(`Native request timed out: ${stderr}`)); }, 12000);
  requests.set(requestId, { resolve, reject, timer });
  child.stdin.write(Buffer.concat([header, body]));
});
try {
  const first = await send({ command: 'status' });
  assert(first.ok, `Windows media query failed: ${first.error}`);
  assert.equal(typeof first.snapshot.available, 'boolean');
  // Status must follow Windows even if an old client sends a previous selection.
  const second = await send({ command: 'status', sessionId: 'f'.repeat(32), artworkKey: first.snapshot.artworkKey || '' });
  assert(second.ok);
  if (first.snapshot.available && second.snapshot.available && first.snapshot.title === second.snapshot.title) {
    assert.equal(first.snapshot.sessionId, second.snapshot.sessionId, 'Session identities changed between polls');
    assert.equal(second.snapshot.artwork, null, 'Unchanged artwork must not be resent');
  }
  const invalid = await send({ command: 'execute', sessionId: first.snapshot.sessionId || '' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'unsupported_command');
  const stale = await send({command:'pause',sessionId:'f'.repeat(32)});
  assert.equal(stale.error,'session_gone','Stale control targets must be rejected before any playback action');
  console.log('PASS: native framing, Windows current-session access, stable IDs, artwork caching, rejected unknown commands, and stale target protection (no playback changed).');
  if (process.argv.includes('--fixture')) {
    fixture = spawn(path.join(buildDirectory, 'LunarMediaFixture.exe'), [], {windowsHide:true,stdio:['ignore','ignore','pipe']});
    fixture.stderr.on('data', chunk => { fixtureError += chunk.toString(); });
    fixture.on('error', error => { console.error(error.message); });
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let sessionId;
    for (let attempt=0;attempt<30;attempt++) {
      const result=await send({command:'status'});
      if (result.snapshot?.app==='LunarMediaFixture.exe') sessionId=result.snapshot.sessionId;
      if(sessionId)break;
      await delay(200);
    }
    assert(sessionId,`Windows did not select the silent fixture as its current media: ${fixtureError}; ${stderr.slice(0,2000)}`);
    const status=()=>send({command:'status',sessionId});
    const act=async(command,extra={})=>{const result=await send({command,sessionId,...extra});assert(result.ok,`${command} failed: ${result.error}; ${stderr.slice(-4000)}`);};
    const eventually=async predicate=>{for(let i=0;i<25;i++){const result=await status();if(result.snapshot?.app==='LunarMediaFixture.exe' && predicate(result.snapshot))return result.snapshot;await delay(100);}throw new Error('Fixture media state did not update');};
    const fixtureState = await eventually(s=>s.canSeek&&s.playing);
    assert.equal(fixtureState.title, 'Lunar isolated media verification', `Windows metadata was not read: ${stderr.slice(-2000)}`);
    assert.equal(fixtureState.artist, 'Silent test fixture');
    await act('pause'); await eventually(s=>!s.playing);
    await act('seekTo',{seconds:30}); await eventually(s=>Math.abs(s.position-30)<1);
    await act('seekBy',{seconds:10}); await eventually(s=>Math.abs(s.position-40)<1);
    await act('seekBy',{seconds:-10}); await eventually(s=>Math.abs(s.position-30)<1);
    await act('play'); await eventually(s=>s.playing);
    console.log('PASS: actual Windows pause, play, absolute seek, and forward/back 10 seconds targeted only the isolated muted fixture.');
    fixture.kill(); await new Promise(resolve=>fixture.once('exit',resolve));
    let changed = false;
    for(let i=0;i<30;i++) {
      const result=await send({command:'status',sessionId});
      if(result.snapshot?.sessionId !== sessionId && result.snapshot?.app !== 'LunarMediaFixture.exe') { changed=true; break; }
      await delay(100);
    }
    assert(changed,'Host retained the old source after Windows changed its current media');
    const closed = await send({command:'pause',sessionId}); assert.equal(closed.error,'session_gone');
    console.log('PASS: Windows current-session changes are followed automatically, and commands to the closed fixture are rejected.');
  }
} finally {
  if (fixture && fixture.exitCode === null && fixture.signalCode === null) { fixture.kill(); await new Promise(resolve=>fixture.once('exit',resolve)); }
  child.stdin.end();
  child.kill();
}
