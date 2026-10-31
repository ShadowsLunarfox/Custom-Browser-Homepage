import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const languages=['en','zh-CN','ja','ko','th','ms','yue'];
let count=0;
assert(readFileSync(path.join(root,'PRIVACY.md'),'utf8').startsWith('# Lunar Start Page Privacy Policy'));
assert(readFileSync(path.join(root,'TERMS.md'),'utf8').startsWith('# Lunar Start Page Terms of Service'));
for(const kind of ['PRIVACY','TERMS'])assert(!existsSync(path.join(root,`docs/legal/${kind}.en.md`)),'Avoid duplicate English primary documents');
for(const kind of ['PRIVACY','TERMS'])for(const language of languages) {
  const relative=language==='en'?`${kind}.md`:`docs/legal/${kind}.${language}.md`;
  const name=path.join(root,relative),text=readFileSync(name,'utf8');
  assert(text.startsWith('# ')&&text.length>1800,`Incomplete document: ${relative}`);
  assert.equal((text.match(/^## \d+\./gm)||[]).length,kind==='PRIVACY'?8:9,`Missing translated sections: ${relative}`);
  assert(text.includes('2026-10-31')&&text.includes('ShadowsLunarfox'));
  assert(!text.includes('\ufffd')&&!/<\/?[a-z][^>]*>/i.test(text),`Legal document contains invalid text or HTML: ${relative}`);
  for(const[,target]of text.matchAll(/\]\(([^)]+)\)/g)) {
    if(/^https:\/\//.test(target))continue;
    assert(!/^https?:/.test(target),'Non-HTTPS reference');
    assert(existsSync(path.resolve(path.dirname(name),target.split('#')[0])),`Broken legal link in ${relative}: ${target}`);
  }
  count++;
}
assert(!existsSync(path.join(root,'privacy.html')));
assert(!readdirSync(path.join(root,'docs/legal')).some(file=>/\.html?$/i.test(file)));
for(const version of ['modern','legacy']) {
  const source=readFileSync(path.join(root,version==='legacy'?'legacy/script/06-i18n.js':'script/06-i18n.js'),'utf8');
  const start=source.indexOf('function syncLegalDocumentLinks()'),end=source.indexOf('function setTranslatedNodeText',start);
  const links=['privacy','terms'].map(type=>({dataset:{legalDocument:type},setAttribute(name,value){this[name]=value;}}));
  const context={currentLanguage:'en',document:{documentElement:{dataset:{interfaceVersion:version}},querySelectorAll:()=>links}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  for(const language of [...languages,'unavailable']) {
    context.currentLanguage=language;vm.runInContext('syncLegalDocumentLinks()',context);
    for(const link of links) {
      const expectedLanguage=languages.includes(language)?language:'en';
      const kind=link.dataset.legalDocument==='privacy'?'PRIVACY':'TERMS';
      const expected=expectedLanguage==='en'?`${kind}.md`:`docs/legal/${kind}.${expectedLanguage}.md`;
      assert.equal(link.href,`https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/${expected}`);
      assert.equal(link.rel,'noopener noreferrer');
      assert(existsSync(path.join(root,expected)));
    }
  }
}
for(const prefix of ['', 'legacy/'])for(const language of languages) {
  const locale=JSON.parse(readFileSync(path.join(root,`${prefix}data/language/${language}.json`),'utf8'));
  assert(locale.legal.privacy&&locale.legal.terms,`Missing legal labels: ${prefix}${language}`);
}
const storeConfig=JSON.parse(readFileSync(path.join(root,'release/store-config.json'),'utf8'));
assert.equal(storeConfig.privacyPolicyUrl,'https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/PRIVACY.md');
assert.equal(storeConfig.termsOfServiceUrl,'https://github.com/ShadowsLunarfox/Lunar-Start-Page/blob/main/TERMS.md');
console.log(`PASS: ${count} complete Markdown legal drafts, online language links in both interfaces, English fallback, published store URLs, and no HTML legal files.`);
