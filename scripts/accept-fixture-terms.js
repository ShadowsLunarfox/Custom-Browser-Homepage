// Existing UI fixtures explicitly accept the real first-run dialog on localhost.
// This helper is never included in the extension package.
document.addEventListener('load', async event => {
  if (!(event.target instanceof HTMLIFrameElement)) return;
  const frame = event.target;
  const doc = frame.contentDocument;
  const checkbox = doc?.querySelector('#legal-consent-checkbox');
  if (!checkbox) return;
  for (let tries = 0; checkbox.disabled && tries < 200; tries++) await new Promise(resolve => setTimeout(resolve, 25));
  if (frame.contentDocument !== doc || checkbox.disabled) return;
  checkbox.click();
  doc.querySelector('#legal-consent-accept').click();
}, true);
