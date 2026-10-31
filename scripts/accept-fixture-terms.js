// Existing UI fixtures explicitly accept the real first-run dialog on localhost.
// This helper is never included in the extension package.
async function acceptFixtureTerms(frame) {
  const doc = frame.contentDocument;
  const nested = doc?.querySelector('#lunar-start-frame');
  if (nested) {
    nested.addEventListener('load', () => void acceptFixtureTerms(nested));
    await acceptFixtureTerms(nested); return;
  }
  const checkbox = doc?.querySelector('#legal-consent-checkbox');
  if (!checkbox) return;
  for (let tries = 0; checkbox.disabled && tries < 200; tries++) await new Promise(resolve => setTimeout(resolve, 25));
  if (frame.contentDocument !== doc || checkbox.disabled) return;
  checkbox.click();
  doc.querySelector('#legal-consent-accept').click();
}
document.addEventListener('load', event => {
  if (event.target instanceof HTMLIFrameElement) void acceptFixtureTerms(event.target);
}, true);
