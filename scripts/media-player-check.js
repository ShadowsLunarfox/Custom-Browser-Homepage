// Isolated localhost fixtures. These tests never connect to the native host or user media.
(async () => {
  const results = [];
  let frame, win, doc;
  const commands = [];
  let disconnects = 0;
  const firstId = 'a'.repeat(32), secondId = 'b'.repeat(32);
  let media = {
    available: true, sessionId: firstId, app: 'YouTube · Chrome', title: 'A quiet afternoon', artist: 'Lunar radio',
    artwork: '', artworkKey: 'fixture', playing: true, position: 24, duration: 180, rate: 1,
    canPlay: true, canPause: true, canSeek: true, canPrevious: true, canNext: true
  };
  let fail = false;
  let permissionGranted=false, permissionAnswer=false, permissionRequests=0;
  const removedListeners=[];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => { const until = Date.now() + 10000; while (Date.now() < until) { if (predicate()) return; await delay(25); } throw new Error('Player check timed out'); };
  const record = scenario => { results.push({scenario, passed:true}); const li = document.createElement('li'); li.textContent = `PASS: ${scenario}`; document.getElementById('results').append(li); };
  const get = id => doc.getElementById(`player-${id}`);
  const click = async id => { const count = commands.length; get(id).click(); await wait(() => commands.length > count); await delay(30); };
  const transport = () => {
    const listeners = [];
    let closed = false;
    return {
      onMessage: {addListener: fn => listeners.push(fn)}, onDisconnect: {addListener() {}},
      disconnect() { if (!closed) disconnects++; closed = true; },
      postMessage(request) {
        commands.push(request);
        if (request.command !== 'status' && request.sessionId !== media.sessionId) {
          setTimeout(() => { if (!closed) listeners.forEach(fn => fn({id:request.id,ok:false,error:'session_gone'})); }, 5);
          return;
        }
        if (request.command === 'pause') media.playing = false;
        if (request.command === 'play') media.playing = true;
        if (request.command === 'seekBy') media.position = Math.max(0, Math.min(media.duration, media.position + request.seconds));
        if (request.command === 'seekTo') media.position = request.seconds;
        const reply = fail ? {id:request.id,ok:false,error:'bridge_unavailable'} : {id:request.id,ok:true,snapshot:structuredClone(media)};
        setTimeout(() => { if (!closed) listeners.forEach(fn => fn(reply)); }, 5);
      }
    };
  };
  try {
    // A visible-widget preference from the pre-consent version must not enable media.
    localStorage.setItem('lunarWindowsMediaWidget:v1',JSON.stringify({visible:true,expanded:true}));
    frame = document.createElement('iframe'); frame.src = '../home.html'; document.body.append(frame);
    await wait(() => frame.contentDocument?.body?.classList.contains('app-ready'));
    win = frame.contentWindow; doc = frame.contentDocument;
    win.__lunarMediaTestTransport = transport;
    win.__lunarMediaTestPermissions = {
      contains: async()=>permissionGranted,
      request: async()=>{permissionRequests++;permissionGranted=permissionAnswer;return permissionGranted;},
      remove: async()=>{permissionGranted=false;removedListeners.forEach(fn=>fn({permissions:['nativeMessaging']}));return true;},
      onRemoved:{addListener:fn=>removedListeners.push(fn)}
    };
    await win.loadLanguage('zh-CN');
    win.applyTranslations();
    for(const language of ['zh-CN','en','ja','ko','th','ms']) {
      await win.loadLanguage(language);win.applyTranslations();
      for(const link of doc.querySelectorAll('[data-legal-document]')) {
        const online=new URL(link.href);
        assert(online.origin==='https://github.com'&&online.pathname.startsWith('/ShadowsLunarfox/Lunar-Start-Page/blob/main/')&&online.pathname.endsWith('.md'),'Legal link is not the published language-specific Markdown page');
        const bundledPath=online.pathname.split('/blob/main/')[1];
        const response=await fetch(new URL(bundledPath,win.location.href));assert(response.ok,'Bundled legal copy is missing');
        assert((await response.text()).startsWith('# '),'Legal link did not return a Markdown document');
      }
    }
    await win.loadLanguage('zh-CN');win.applyTranslations();
    record('Online privacy and terms URLs follow all six interface languages and bundled Markdown copies remain available');
    assert(doc.getElementById('windows-media-player').hidden && commands.length===0, 'Media access started before consent');
    doc.getElementById('toggle-media-player').click();
    assert(doc.getElementById('player-setup-dialog').open && commands.length===0, 'Disclosure did not precede native access');
    doc.getElementById('player-setup-dialog').close(); assert(permissionRequests===0,'Cancel requested a permission');
    doc.getElementById('toggle-media-player').click();get('enable').click();
    await wait(()=>get('consent-status').textContent.includes('未获得'));
    assert(commands.length===0&&doc.getElementById('windows-media-player').hidden, 'Denied permission started native access');
    get('background').checked=false;
    permissionAnswer=true;get('enable').click();
    await wait(()=>!doc.getElementById('windows-media-player').hidden&&!get('play').disabled);
    record('Default-off disclosure, cancellation, denied permission, and explicit opt-in before native access');
    assert(get('track-title').textContent === media.title && !get('play').disabled, 'Connected metadata or playback control missing');
    assert(get('play').getAttribute('aria-label') === '暂停', 'Chinese pause label missing');
    assert(!get('session'), 'Manual media source selector is still present');
    assert(commands.at(-1).sessionId === '', 'Status query pinned a media source');
    const panel = doc.getElementById('windows-media-player');
    const arrival = panel.getAnimations().find(animation => animation.animationName === 'arrive');
    assert(arrival?.effect.getTiming().duration === 400, 'Player does not share the page arrival animation');
    const keyframes = arrival.effect.getKeyframes();
    assert(keyframes[0].opacity === '0' && keyframes.at(-1).opacity === '1', 'Player arrival does not fade from hidden to visible');
    record('Windows metadata, Chinese labels, no source selector, and the shared 400ms page fade');

    await click('play'); assert(!media.playing && get('play').getAttribute('aria-label') === '播放', 'Pause did not update state');
    await click('play'); assert(media.playing, 'Play did not update state');
    await click('forward'); assert(media.position === 34, 'Forward did not seek 10 seconds');
    await click('rewind'); assert(media.position === 24, 'Rewind did not seek 10 seconds');
    get('progress').value = '900'; get('progress').dispatchEvent(new win.Event('input', {bubbles:true}));
    assert(get('current').textContent === '1:30', 'Seeking preview missing');
    get('progress').dispatchEvent(new win.Event('change', {bubbles:true}));
    await wait(() => media.position === 90 && !get('progress').disabled);
    record('Play, pause, forward/back 10 seconds, and progress-bar seeking');

    media.sessionId = secondId; media.title = 'Windows selected video'; media.artworkKey = 'second';
    await wait(() => get('track-title').textContent === media.title);
    assert(commands.filter(request => request.command === 'status').every(request => request.sessionId === ''), 'Polling retains the prior source');
    await delay(30); await click('next'); await click('previous');
    assert(commands.at(-1).sessionId === secondId, 'Action targeted the wrong media source');
    // Same application, different system selection. A click before the next poll
    // must refresh the current source instead of controlling the stale source.
    media.sessionId = firstId; media.title = 'Another Chrome video'; media.artworkKey = 'third';
    const wasPlaying = media.playing;
    await click('play');
    await wait(() => get('track-title').textContent === media.title);
    assert(media.playing === wasPlaying, 'A stale click changed another session');
    await click('play'); assert(media.playing !== wasPlaying && commands.at(-1).sessionId === firstId, 'Player did not recover the Windows current source');
    get('progress').value = '500'; get('progress').dispatchEvent(new win.Event('input', {bubbles:true}));
    media.sessionId = secondId; media.title = 'Windows changed during seeking'; media.artworkKey = 'fourth';
    await wait(() => get('track-title').textContent === media.title);
    const seekCount = commands.filter(request => request.command === 'seekTo').length;
    get('progress').dispatchEvent(new win.Event('change', {bubbles:true})); await delay(30);
    assert(commands.filter(request => request.command === 'seekTo').length === seekCount, 'A seek started on the old source changed the new source');
    media.canSeek = false; media.canNext = false; media.canPrevious = false;
    await win.lunarMediaPlayer.reconnect();
    assert(get('progress').disabled && get('forward').disabled && get('next').disabled && !get('play').disabled, 'Capability restrictions were not applied');
    assert(get('status').textContent.includes('不支持'), 'Unsupported seeking was not explained');
    record('Automatic Windows source changes, stale-click protection, and disabled unsupported controls');

    media.title = '<img src=x onerror=alert(1)>'; media.artist = 'A'.repeat(300);
    media.artwork = 'https://untrusted.invalid/cover.png';
    await win.lunarMediaPlayer.reconnect();
    assert(!get('track-title').children.length && get('track-title').textContent === media.title, 'Metadata was parsed as HTML');
    assert(get('artwork').src.endsWith('lunar-v2-128.png'), 'External artwork URL was accepted');
    record('Untrusted metadata stays text and external artwork URLs are rejected');

    media.title = 'A quiet afternoon'; media.artist = 'Lunar radio'; media.artwork = ''; media.canSeek = true;
    await win.lunarMediaPlayer.reconnect();
    if (panel.classList.contains('is-compact')) get('expand').click();
    for (const theme of ['light','dark']) {
      win.eval('state').settings.theme = theme; win.applyThemeSettings();
      const color = win.getComputedStyle(panel).color, background = win.getComputedStyle(panel).backgroundColor;
      assert(color !== background && background !== 'rgba(0, 0, 0, 0)', `${theme} text and panel colors clash`);
      const box = panel.getBoundingClientRect(); assert(box.left >= -1 && box.right <= win.innerWidth+1 && box.bottom <= win.innerHeight+1, 'Player exceeds viewport');
    }
    frame.style.width = '380px'; frame.style.height = '620px';
    win.dispatchEvent(new win.Event('resize')); await delay(100);
    const small = panel.getBoundingClientRect(); assert(small.left >= -1 && small.right <= 381 && small.bottom <= 621, 'Small player exceeds viewport');
    frame.style.width='100%'; frame.style.height='100%'; win.dispatchEvent(new win.Event('resize')); await delay(100);
    record('Light/dark colors and narrow-window player bounds');

    get('expand').click(); assert(panel.classList.contains('is-compact'), 'Compact mode failed');
    get('expand').click();
    const before = disconnects; get('hide').click(); assert(panel.hidden && disconnects > before, 'Hiding did not disconnect host');
    doc.getElementById('toggle-media-player').click(); await wait(() => !panel.hidden && !get('play').disabled);
    assert(JSON.parse(win.localStorage.getItem('lunarWindowsMediaWidget:v1')).visible === true, 'Player preference was not saved privately');
    assert(!Object.keys(win.localStorage).filter(k => k.startsWith('lunarShared:v1:')).some(k => k.includes('player')), 'Player settings leaked into shared sync');
    record('Compact mode, hide/reopen, connection cleanup, and private preferences');

    fail = true; await win.lunarMediaPlayer.reconnect();
    assert(get('play').disabled && !get('setup').hidden, 'Missing native host did not show help');
    get('setup').click(); assert(doc.getElementById('player-setup-dialog').open, 'Setup dialog did not open');
    assert(get('consent-status').textContent.includes('已授权')&&!get('consent-status').textContent.includes('已连接 Windows'), 'Permission was presented as a working connection');
    assert(!get('check').hidden, 'No connector check action was available after permission was granted');
    fail=false;get('check').click();await wait(()=>!get('play').disabled&&get('consent-status').textContent.includes('已连接'));
    media.available=false;await win.lunarMediaPlayer.reconnect();assert(get('consent-status').textContent.includes('暂无当前媒体会话'),'An idle connector was presented as absent');
    media.available=true;
    doc.getElementById('player-setup-dialog').close();
    fail=true;await win.lunarMediaPlayer.reconnect();fail=false;win.dispatchEvent(new win.Event('focus'));
    await wait(()=>!get('play').disabled);
    record('Permission versus real connection, manual detection, connected idle state, and refocus recovery after installation');

    get('manage').click(); get('disable').click(); await wait(()=>!permissionGranted&&doc.getElementById('windows-media-player').hidden);
    assert(!JSON.parse(win.localStorage.getItem('lunarWindowsMediaWidget:v1')).enabled,'Disable retained local media consent');
    const stoppedAt=commands.length; await delay(1100); assert(commands.length===stoppedAt,'Polling continued after permission revocation');
    doc.getElementById('player-setup-dialog').close();
    doc.getElementById('toggle-media-player').click();get('enable').click();await wait(()=>!get('play').disabled&&!doc.getElementById('windows-media-player').hidden);
    await win.__lunarMediaTestPermissions.remove({permissions:['nativeMessaging']});
    assert(doc.getElementById('windows-media-player').hidden&&get('track-title').textContent!=='A quiet afternoon','External permission removal retained media');
    record('Disable/re-enable, browser permission revocation, polling cleanup, and erased temporary media');
    doc.getElementById('toggle-media-player').click();get('enable').click();await wait(()=>!get('play').disabled&&!doc.getElementById('windows-media-player').hidden);

    if (location.search.includes('preview')) { frame.style.opacity = '1'; frame.style.pointerEvents = 'auto'; return; }
    win.lunarMediaPlayer.destroy();
    frame.src = '../legacy/home.html';
    await wait(() => frame.contentDocument?.documentElement?.dataset.interfaceVersion === 'legacy' && frame.contentDocument.body?.classList.contains('app-ready'));
    assert(!frame.contentDocument.getElementById('windows-media-player') && !frame.contentWindow.lunarMediaPlayer, 'Legacy loaded the new player');
    assert(!frame.contentWindow.performance.getEntriesByType('resource').some(r => /media-player|windows-media-broker/.test(r.name)), 'Legacy requested player resources');
    record('Legacy interface loads no player code, UI, or connector');
  } catch (error) { results.push({scenario:error.stack || error.message,passed:false}); }
  finally {
    if (!location.search.includes('preview')) {
      frame?.contentWindow?.lunarMediaPlayer?.destroy();
      await fetch('/__viewport-report', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,results})});
    }
  }
})();
