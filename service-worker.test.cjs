const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(fetch) {
 const handlers={},entries=new Map(),deleted=[];
 const cache={match:async key=>entries.get(key),put:async(key,value)=>entries.set(key,value),addAll:async()=>{}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/sw.js','utf8'),{
  URL,fetch, caches:{open:async()=>cache,keys:async()=>['leadcapture-v7','other-app-cache'],delete:async key=>deleted.push(key)},
  self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/app/'},
   clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn}
 });
 function request(url,method='GET') {let response;handlers.fetch({request:{url,method},respondWith(p){response=p}});return response;}
 return {handlers,entries,deleted,request};
}
test('online navigation replaces stale shell on the first request; offline fallback still works',async()=>{
 let offline=false;
 const s=setup(async()=>{if(offline)throw new Error('offline');return new Response('new app')});
 s.entries.set('https://example.test/app/',new Response('old app'));
 assert.equal(await (await s.request('https://example.test/app/')).text(),'new app');
 offline=true;
 assert.equal(await (await s.request('https://example.test/app/?reload=1')).text(),'new app');
});
test('API, third-party, POST and non-shell pages bypass caches',()=>{
 const s=setup(()=>{throw new Error('must not fetch')});
 for(const [url,method] of [['https://example.test/api/leads','GET'],['https://api.test/leads','GET'],['https://example.test/app/','POST'],['https://example.test/admin','GET']]) {
  assert.equal(s.request(url,method),undefined);
 }
});
test('activation removes only old LeadCapture caches',async()=>{
 const s=setup(()=>{});let pending;s.handlers.activate({waitUntil(p){pending=p}});await pending;
 assert.deepEqual(s.deleted,['leadcapture-v7']);
});
