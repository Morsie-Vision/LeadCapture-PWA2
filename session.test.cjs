const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const functions = ['boundedFetch','refreshAccessToken','sitzungSichern','tokenLaeuftAbUm','performApiRequest','apiRequest','showApp','recoverSession','loadLeads'];
function setup(fetch) {
 const elements = new Map();
 const element = id => { if (!elements.has(id)) elements.set(id,{style:{},textContent:'',innerHTML:''}); return elements.get(id); };
 const context = {
  console, AbortController, Response, Date, Promise, atob, fetch,
  setTimeout:(fn,ms)=>setTimeout(fn, Math.min(ms, 40)), clearTimeout,
  ApiError: class extends Error { constructor(message,status=0,code=''){super(message);this.status=status;this.code=code;} },
  authGeneration:0, refreshPromise:null, recoveryPromise:null, lastRecovery:0, connectionFailures:0, passwordRequired:false,
  PUFFER_MS:300000, API_URL:'https://example.test/api', navigator:{onLine:true},
  token:'valid', rt:'refresh', getToken(){return context.token}, getRefreshToken(){return context.rt},
  setToken(t){context.token=t}, setRefreshToken(t){context.rt=t}, getUser:()=>({id:'u',tenant:{id:'t'}}),ownerKey:()=> 't:u',
  removeToken(){context.token=null;context.authGeneration++},showLogin(){context.loggedOut=true},
  reportConnectionError(e){context.errors.push(e);context.connectionFailures++},errors:[],
  connectionNotice(m){context.notice=m}, activeFeatures:new Set(),applyFeatureVisibility(){},openPasswordDialog(){},
  document:{visibilityState:'visible',getElementById:element,querySelector:()=>null},
  setFeatures(){},showView(){context.shellShown=true},refreshFeatures:async()=>{},
  hasFeature:()=>false,renderDashboard:async()=>{},wsAnzeigeAktualisieren:async()=>{},wsVerarbeiten:async()=>{},
  displayLeads(){},renderSearchResults(){},allLeads:[{id:'cached'}],
  ...Object.fromEntries(['loginContainer','appContainer','userInfo','userName','tenantName','userBadge'].map(k=>[k,element(k)]))
 };
 vm.createContext(context);
 for(const name of functions){
  const pattern = new RegExp('(?:async )?function '+name+'\\([^]*?^}', 'm');
  const source=html.match(pattern); assert(source,name); vm.runInContext(source[0],context);
 }
 return context;
}
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('deadline aborts hung request and stalled body',async()=>{
 for(const fetch of [()=>new Promise(()=>{}),async()=>({arrayBuffer:()=>new Promise(()=>{})})]) {
  const c=setup(fetch);await assert.rejects(c.boundedFetch('/test',{},5),e=>e.code==='TIMEOUT');
 }
});
test('concurrent refreshes share one request and rotate tokens',async()=>{
 let calls=0;const c=setup(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return json({success:true,data:{token:'new',refreshToken:'rotated'}})});
 assert.deepEqual(await Promise.all([c.refreshAccessToken(),c.refreshAccessToken()]),['new','new']);
 assert.equal(calls,1);assert.equal(c.rt,'rotated');assert.equal(c.refreshPromise,null);
});
test('refresh timeout preserves credentials and permits later recovery',async()=>{
 const c=setup(()=>new Promise(()=>{}));await assert.rejects(c.refreshAccessToken());
 assert.equal(c.token,'valid');assert.equal(c.rt,'refresh');assert.equal(c.refreshPromise,null);
 c.fetch=async()=>json({success:true,data:{token:'recovered'}});
 assert.equal(await c.refreshAccessToken(),'recovered');
});
test('temporary 503 refresh preserves session',async()=>{
 const c=setup(async()=>json({},503));await assert.rejects(c.refreshAccessToken());assert.equal(c.token,'valid');
});
test('GET retries once; POST is never automatically repeated on network failure',async()=>{
 for(const method of ['GET','POST']){let calls=0;const c=setup(async()=>{calls++;throw Error('offline')});
 await assert.rejects(c.apiRequest('/leads',{method}));assert.equal(calls,method==='GET'?2:1);assert.equal(c.token,'valid');}
});
test('GET recovers after 503 without logging out',async()=>{
 let calls=0;const c=setup(async()=>++calls===1?json({},503):json({success:true,data:[]}));
 assert.equal((await c.apiRequest('/leads')).status,200);assert.equal(calls,2);
});
test('401 refreshes and replays; invalid refresh returns to login',async()=>{
 for(const valid of [true,false]){let leads=0;const c=setup(async url=>url.endsWith('/auth/refresh')
 ?valid?json({success:true,data:{token:'new'}}):json({},401)
 :++leads===1?json({},401):json({success:true}));
 if(valid){assert.equal((await c.apiRequest('/leads')).status,200);assert.equal(c.token,'new');}
 else{await assert.rejects(c.apiRequest('/leads'));assert.equal(c.loggedOut,true);}}
});
test('old refresh cannot write credentials after account change',async()=>{
 let resolve;const c=setup(()=>new Promise(r=>resolve=r));const task=c.refreshAccessToken();
 c.authGeneration++;resolve(json({success:true,data:{token:'wrong-account'}}));
 await assert.rejects(task,e=>e.code==='SESSION_CHANGED');assert.equal(c.token,'valid');
});
test('failed lead refresh retains cached leads',async()=>{
 const c=setup(async()=>{throw Error('offline')});await c.loadLeads();assert.equal(c.allLeads[0].id,'cached');assert(c.errors.length);
});
test('authenticated shell appears before background loading finishes',async()=>{
 const c=setup();let called=0;c.recoverSession=()=>{called++;return new Promise(()=>{})};
 await c.showApp({fullName:'Test',tenant:{name:'Tenant'}},['leads']);
 assert.equal(c.appContainer.style.display,'block');assert.equal(c.shellShown,true);assert.equal(called,1);
});
test('resume events coalesce and refresh data without navigation',async()=>{
 const c=setup();let loads=0;c.loadLeads=async()=>{loads++;await new Promise(r=>setTimeout(r,5))};
 await Promise.all([c.recoverSession(true),c.recoverSession(true)]);
 assert.equal(loads,1);assert.equal(c.shellShown,undefined);assert.equal(c.recoveryPromise,null);
});
test('expired token is refreshed proactively on resume',async()=>{
 const c=setup(async()=>json({success:true,data:{token:'renewed'}}));
 c.token='header.'+Buffer.from(JSON.stringify({exp:1})).toString('base64url')+'.signature';
 c.loadLeads=async()=>{};await c.recoverSession(true);assert.equal(c.token,'renewed');
});
test('login shows immediate and delayed feedback and releases UI after timeout',async()=>{
 const c=setup();let submit;let rejectLogin;
 Object.assign(c,{
  loginForm:{addEventListener:(event,fn)=>submit=fn,setAttribute(){},removeAttribute(){}},
  loginBtn:{},loginError:{style:{}},loginEmail:{value:'user@example.test'},loginPassword:{value:'secret'},
  login:()=>new Promise((_,reject)=>rejectLogin=reject)
 });
 const start=html.indexOf("loginForm.addEventListener('submit'");
 const end=html.indexOf("registerForm.addEventListener('submit'",start);
 vm.runInContext(html.slice(start,end),c);
 const pending=submit({preventDefault(){}});
 assert.equal(c.loginBtn.disabled,true);
 assert.equal(c.document.getElementById('loginProgress').hidden,false);
 assert.equal(c.document.getElementById('loginProgressText').textContent,'Du wirst angemeldet …');
 await new Promise(r=>setTimeout(r,50));
 assert.equal(c.document.getElementById('loginProgressText').textContent,'Die Verbindung dauert etwas länger …');
 rejectLogin(new Error('timeout'));await pending;
 assert.equal(c.loginBtn.disabled,false);assert.equal(c.loginBtn.textContent,'Erneut versuchen');
 assert.equal(c.document.getElementById('loginProgress').hidden,true);
 assert.equal(c.loginError.textContent,'timeout');
});
