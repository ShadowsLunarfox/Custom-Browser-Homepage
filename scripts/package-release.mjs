// Creates separate, allowlisted artifacts. Never publishes or changes native registration.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const draft=process.argv.includes('--draft');
const config=JSON.parse(await readFile(path.join(root,'release/store-config.json'),'utf8'));
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
const validId=value=>typeof value==='string'&&/^[a-p]{32}$/.test(value);
const validUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}};
for(const name of ['chromeExtensionId','edgeExtensionId'])if(config[name]&&!validId(config[name]))throw new Error(`Invalid ${name}`);
if(!draft&&(!validId(config.chromeExtensionId)||!validUrl(config.privacyPolicyUrl)||!validUrl(config.connectorDownloadUrl))) {
  throw new Error('Release configuration is incomplete: set the Chrome store ID, public HTTPS privacy-policy URL and connector download URL in release/store-config.json. Use --draft for local review artifacts.');
}
if(manifest.permissions.includes('nativeMessaging')||!manifest.optional_permissions?.includes('nativeMessaging')||manifest.permissions.includes('tabs'))throw new Error('Release requires optional nativeMessaging and scoped activeTab access.');
const output=path.join(root,'dist');await mkdir(output,{recursive:true});
const files=[];
async function add(relative) {
  const full=path.join(root,relative), entries=await readdir(full,{withFileTypes:true});
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    if(entry.isSymbolicLink())throw new Error(`Release refuses symlinks: ${relative}/${entry.name}`);
    if(entry.name.startsWith('.')||['node_modules','bin','tests','scripts'].includes(entry.name))continue;
    const name=`${relative}/${entry.name}`;
    if(entry.isDirectory())await add(name);else files.push({name,bytes:await readFile(path.join(root,name))});
  }
}
for(const name of ['manifest.json','background.js','home.html','newtab.html','unsupported.html','styles.css','PRIVACY.md','TERMS.md','connector.html','LICENSE'])files.push({name,bytes:await readFile(path.join(root,name))});
for(const dir of ['script','styles','data','resource','themes','legacy','docs/legal'])await add(dir);
if(config.connectorDownloadUrl&&validUrl(config.connectorDownloadUrl)) {
  const guide=files.find(file=>file.name==='connector.html');
  const safe=config.connectorDownloadUrl.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  guide.bytes=Buffer.from(guide.bytes.toString('utf8').replace('https://github.com/ShadowsLunarfox/Lunar-Start-Page/releases',safe));
}
// Only production modules enter the store package; the localhost test hook cannot
// connect under chrome-extension:// and no QA page or native installer is included.
if(files.some(f=>/\.(?:exe|dll|ps1|cmd|cs|mjs)$/i.test(f.name)||f.name.startsWith('native/')))throw new Error('Native/development file leaked into extension package');
const suppliedExecutable=process.argv.indexOf('--native-executable');
let executable;
if(suppliedExecutable>=0) {
  if(!process.argv[suppliedExecutable+1]||process.argv[suppliedExecutable+1].startsWith('--'))throw new Error('--native-executable requires a prebuilt connector file');
  executable=path.resolve(root,process.argv[suppliedExecutable+1]);
} else {
  const build=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'native/windows-media/Build.ps1')],{cwd:root,windowsHide:true,encoding:'utf8'});
  if(build.error||build.status!==0)throw new Error(build.error?.message||build.stdout+build.stderr);
  executable=build.stdout.trim().split(/\r?\n/).at(-1);
  if(!path.resolve(executable).startsWith(path.join(root,'native/windows-media/bin')+path.sep))throw new Error('Build returned an unexpected connector path');
}
const executableBytes=await readFile(executable);
if(executableBytes.subarray(0,2).toString()!=='MZ')throw new Error('The supplied connector is not a Windows executable');
const connector=[];
for(const name of ['Install.ps1','Install.cmd','Uninstall.ps1','Uninstall.cmd','README.md','Host.cs','Build.ps1'])connector.push({name,bytes:await readFile(path.join(root,'native/windows-media',name))});
connector.push({name:'LICENSE',bytes:await readFile(path.join(root,'LICENSE'))});
for(const file of files.filter(file=>file.name==='PRIVACY.md'||file.name==='TERMS.md'||file.name.startsWith('docs/legal/')))connector.push(file);
connector.push({name:'payload/LunarMediaHost.exe',bytes:executableBytes});
connector.push({name:'connector-config.json',bytes:Buffer.from(JSON.stringify({draft,extensionIds:[config.chromeExtensionId,config.edgeExtensionId].filter(validId)},null,2)+'\n')});
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;};
function zip(entries) {
  const blocks=[],directory=[];let offset=0;
  for(const {name,bytes} of entries) {
    const filename=Buffer.from(name.replaceAll('\\','/'),'utf8'),body=deflateRawSync(bytes),sum=crc(bytes);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(33,12);local.writeUInt32LE(sum,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    blocks.push(local,filename,body);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt16LE(33,14);central.writeUInt32LE(sum,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);directory.push(central,filename);
    offset+=local.length+filename.length+body.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...blocks,central,end]);
}
const suffix=`${manifest.version}${draft?'-draft':''}`;
const artifacts=[{name:`LunarStart-extension-${suffix}.zip`,entries:files},{name:`LunarStart-WindowsConnector-${suffix}.zip`,entries:connector}];
const sums=[];
for(const artifact of artifacts){const bytes=zip(artifact.entries);await writeFile(path.join(output,artifact.name),bytes);sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${artifact.name}`);console.log(`${artifact.name}: ${artifact.entries.length} files, ${bytes.length} bytes`);}
await writeFile(path.join(output,`SHA256SUMS-${suffix}.txt`),sums.join('\n')+'\n');
await writeFile(path.join(output,`release-report-${suffix}.json`),JSON.stringify({draft,config,extensionFiles:files.map(f=>f.name),connectorFiles:connector.map(f=>f.name)},null,2)+'\n');
if(draft)console.log('DRAFT: for local/reviewer testing. Official IDs and public policy/download URLs must be configured before a public release.');
