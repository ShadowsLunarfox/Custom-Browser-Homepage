import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const suffix=`${manifest.version}-draft`;
async function entries(name) {
  const bytes=await readFile(new URL(`dist/${name}`,root)),files=new Map();let offset=0;
  while(bytes.readUInt32LE(offset)===0x04034b50) {
    const size=bytes.readUInt32LE(offset+18),raw=bytes.readUInt32LE(offset+22),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
    const file=bytes.subarray(offset+30,offset+30+length).toString('utf8');
    assert(!file.includes('..')&&!file.startsWith('/')&&!files.has(file));
    const start=offset+30+length+extra,body=inflateRawSync(bytes.subarray(start,start+size));assert.equal(body.length,raw);
    files.set(file,body);offset=start+size;
  }
  assert.equal(bytes.readUInt32LE(offset),0x02014b50,'ZIP central directory missing');
  return {bytes,files};
}
const extName=`LunarStart-extension-${suffix}.zip`,nativeName=`LunarStart-WindowsConnector-${suffix}.zip`;
const ext=await entries(extName),native=await entries(nativeName);
assert(![...ext.files.keys()].some(name=>/^(native|scripts|release|\.git)\//.test(name)||/\.(exe|dll|ps1|cmd|cs|mjs)$/.test(name)));
for(const name of ['manifest.json','home.html','PRIVACY.md','TERMS.md','connector.html','script/windows-media-broker.js','legacy/home.html','resource/icons/lunar-v2-32.png'])assert(ext.files.has(name),`Missing extension artifact: ${name}`);
assert(!ext.files.has('privacy.html'),'Legal documents must remain Markdown');
for(const kind of ['PRIVACY','TERMS'])for(const locale of ['zh-CN','ja','ko','th','ms','yue']) {
  const name=`docs/legal/${kind}.${locale}.md`;
  assert(ext.files.has(name)&&native.files.has(name),`Missing translated legal document: ${name}`);
}
const packed=JSON.parse(ext.files.get('manifest.json'));
assert(!packed.permissions.includes('nativeMessaging')&&!packed.permissions.includes('tabs'));
assert(packed.permissions.includes('activeTab')&&packed.optional_permissions.includes('nativeMessaging'));
for(const name of ['payload/LunarMediaHost.exe','Install.ps1','Uninstall.ps1','connector-config.json','LICENSE','Host.cs'])assert(native.files.has(name),`Missing connector artifact: ${name}`);
assert.equal(native.files.get('payload/LunarMediaHost.exe').subarray(0,2).toString(),'MZ');
assert.deepEqual(JSON.parse(native.files.get('connector-config.json')).extensionIds,[],'Draft must not embed the local development extension ID');
assert(!native.files.get('Install.ps1').toString().includes('Secure Preferences'),'Installer must not inspect browser profiles');
const sums=await readFile(new URL(`dist/SHA256SUMS-${suffix}.txt`,root),'utf8');
for(const [name,artifact] of [[extName,ext],[nativeName,native]])assert(sums.includes(`${createHash('sha256').update(artifact.bytes).digest('hex')}  ${name}`));
console.log(`PASS: separate ZIP contents, scoped permissions, native payload, no development ID in draft, and SHA-256 checksums (${ext.files.size} extension files; ${native.files.size} connector files).`);
