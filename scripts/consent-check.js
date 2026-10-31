// Localhost only, fresh headless profile. Never reads installed extension data.
(async () => {
  const KEY = 'lunarLegalConsent:v1';
  const results = [];
  const frames = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => {
    const until = Date.now() + 10000;
    while (Date.now() < until) { if (predicate()) return; await delay(25); }
    throw new Error('First-run check timed out');
  };
  const record = scenario => {
    results.push({ scenario, passed: true });
    const item = document.createElement('li'); item.textContent = `PASS: ${scenario}`; document.querySelector('ol').append(item);
  };
  const open = async (version = 'modern', gate = true) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:390px;height:700px;border:0';
    frame.src = version === 'modern' ? '../home.html' : '../legacy/home.html';
    frames.push(frame); document.body.append(frame);
    await wait(() => gate ? frame.contentDocument?.querySelector('#legal-consent-checkbox:not(:disabled)') : frame.contentDocument?.body?.classList.contains('app-ready'));
    return { frame, win: frame.contentWindow, doc: frame.contentDocument };
  };
  const accept = context => { context.doc.querySelector('#legal-consent-checkbox').click(); context.doc.querySelector('#legal-consent-accept').click(); };
  const clear = () => { frames.splice(0).forEach(frame => frame.remove()); localStorage.clear(); };
  if (new URLSearchParams(location.search).has('preview')) {
    clear();
    const {frame,doc} = await open();
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;opacity:1';
    doc.body.dataset.theme = 'light';
    return;
  }
  try {
    clear();
    let context = await open();
    let {win,doc} = context;
    const dialog = doc.querySelector('dialog#legal-consent-dialog');
    assert(dialog.matches(':modal'), 'Agreement must be a modal dialog');
    assert(!doc.querySelector('#legal-consent-checkbox').checked && doc.querySelector('#legal-consent-accept').disabled, 'Agreement was preselected');
    assert(!win.performance.getEntriesByType('resource').some(entry => /\/08-app\.js/.test(entry.name)), 'Homepage initialized before agreement');
    assert(!win.lunarMediaPlayer && !localStorage.getItem(KEY), 'First run enabled media or persisted agreement');
    doc.querySelector('form#legal-consent-form').dispatchEvent(new win.Event('submit', {cancelable:true}));
    const cancel = new win.Event('cancel', {cancelable:true}); dialog.dispatchEvent(cancel);
    assert(cancel.defaultPrevented && dialog.open && !localStorage.getItem(KEY), 'Escape or unchecked submit bypassed agreement');
    dialog.close(); await wait(() => dialog.open);
    record('First launch blocks homepage initialization; unchecked submit, Escape and dialog close cannot bypass it');

    for(const language of ['en','zh-CN','yue','ja','ko','th','ms']) {
      const locale = await (await fetch(`../data/language/${language}.json`)).json();
      const select = doc.querySelector('#legal-consent-language'); select.value = language; select.dispatchEvent(new win.Event('change'));
      await wait(() => !doc.querySelector('#legal-consent-checkbox').disabled);
      assert(doc.querySelector('#legal-consent-title').textContent === locale.legal.consent.title, `Missing ${language} agreement translation`);
      for(const link of dialog.querySelectorAll('[data-legal-document]')) {
        const kind = link.dataset.legalDocument === 'privacy' ? 'PRIVACY' : 'TERMS';
        const path = language === 'en' ? `${kind}.md` : `docs/legal/${kind}.${language}.md`;
        assert(link.href === `https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/${path}`, 'Wrong online legal language');
      }
      assert(!doc.querySelector('#legal-consent-checkbox').checked, 'Language change retained agreement');
    }
    record('All seven dialog languages link to the corresponding online Markdown documents');

    for(const theme of ['light','dark']) {
      doc.body.dataset.theme = theme;
      const style = win.getComputedStyle(dialog);
      assert(style.color !== style.backgroundColor, 'Agreement text disappeared into the theme');
      assert(dialog.getBoundingClientRect().width <= 390 && dialog.scrollWidth <= dialog.clientWidth + 1, 'Mobile agreement overflows horizontally');
    }
    record('Light and dark themes keep the mobile agreement readable without horizontal overflow');

    accept(context);
    await wait(() => doc.body.classList.contains('app-ready'));
    const agreement = JSON.parse(localStorage.getItem(KEY));
    assert(agreement.termsVersion && agreement.privacyVersion && Date.parse(agreement.acceptedAt), 'Agreement revision or timestamp was not recorded');
    assert(!doc.querySelector('#legal-consent-dialog'), 'Accepted agreement stayed open');
    record('Explicit agreement records revisions and timestamp locally, then starts the homepage');

    context.frame.remove();
    context = await open('modern', false);
    assert(!context.doc.querySelector('#legal-consent-dialog'), 'Returning user saw the dialog again');
    context.frame.remove();
    context = await open('legacy', false);
    assert(!context.doc.querySelector('#legal-consent-dialog'), 'Legacy mode did not share the agreement');
    record('Returning visits and switching to legacy mode reuse the same agreement');

    clear();
    localStorage.setItem(KEY, JSON.stringify({...agreement,termsVersion:'outdated'}));
    context = await open('legacy');
    assert(context.doc.querySelector('#legal-consent-dialog').open, 'Outdated agreement bypassed the gate');
    const peer = await open();
    accept(context);
    await wait(() => context.doc.body.classList.contains('app-ready') && peer.doc.body.classList.contains('app-ready'));
    record('An outdated revision prompts again; accepting in one interface unlocks waiting tabs in both');

    clear();
    localStorage.setItem(KEY, '{malformed');
    context = await open();
    const originalSet = context.win.Storage.prototype.setItem;
    context.win.Storage.prototype.setItem = function(key,value) { if(key === KEY) throw new Error('Fixture: storage full'); return originalSet.call(this,key,value); };
    accept(context);
    assert(!context.doc.querySelector('#legal-consent-error').hidden && context.doc.querySelector('#legal-consent-dialog').open, 'Failed persistence bypassed agreement');
    assert(!context.doc.body.classList.contains('app-ready'), 'Homepage started after persistence failed');
    context.win.Storage.prototype.setItem = originalSet;
    context.doc.querySelector('#legal-consent-accept').click();
    await wait(() => context.doc.body.classList.contains('app-ready'));
    record('Malformed records prompt again; storage failure keeps the gate open and can be retried');

    clear(); context = await open();
    context.doc.querySelector('#legal-consent-decline').click();
    await wait(() => context.frame.contentWindow.location.href === 'about:blank');
    assert(!localStorage.getItem(KEY), 'Declining recorded acceptance');
    record('Declining leaves the homepage without recording acceptance');
  } catch(error) { results.push({ scenario:error.stack || error.message, passed:false }); }
  finally { clear(); }
  await fetch('/__viewport-report', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passed:results.filter(result=>result.passed).length,total:results.length,results})});
})();
