const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
function setup() {
    const calls = [], handlers = {}, ids = {};
    const el = id => ids[id] ||= {style:{},classList:{add(){},remove(){},contains(){return false}},addEventListener(n,f){handlers[id]=f}};
    const views = ['scan','search','questionnaire','stats','calendar','team','map'];
    const c = vm.createContext({window:{scrollY:120,scrollTo:(x,y)=>calls.push(['scroll',y])},requestAnimationFrame:fn=>fn(),document:{getElementById:id=>id.startsWith('view-')&&!views.includes(id.slice(5))?null:el(id),querySelectorAll:s=>s==='.back'?[el('back')]:[],querySelector:()=>({click:()=>calls.push(['teamTabReset'])})},hasFeature:()=>true,renderDashboard:()=>calls.push(['dashboard']),initMap:()=>calls.push(['map']),loadMapData:()=>calls.push(['mapData']),loadHistogram:()=>calls.push(['histogram']),loadCalendar:()=>calls.push(['calendar']),loadTemplates:async()=>calls.push(['templates']),loadActiveTemplate(){},updateScanTemplateSelect(){},mapInstance:{invalidateSize:()=>calls.push(['mapSize'])}});
    vm.runInContext(html.slice(html.indexOf("let currentViewId = 'main';"),html.indexOf('// 8. APP ANZEIGEN / LOGOUT')),c);
    return {c,calls,handlers,state:()=>vm.runInContext('({currentViewId,history:viewHistory.map(x=>x.id)})',c)};
}
test('Team → Search → arrow returns to Team, then main',()=>{const {c,handlers,state}=setup();c.showView('team');c.showView('search');handlers.back();assert.equal(state().currentViewId,'team');handlers.back();assert.equal(state().currentViewId,'main');});
test('multi-level traversal returns in reverse order without new history',()=>{const {c,state}=setup();for(const id of ['stats','search','calendar'])c.showView(id);for(const id of ['search','stats','main']){c.goBackView();assert.equal(state().currentViewId,id);}assert.equal(state().history.length,0);});
test('back preserves rendered filters and Team tab; restores scroll',()=>{const {c,calls}=setup();c.showView('team');c.window.scrollY=420;c.showView('search');calls.length=0;c.goBackView();assert.deepEqual(calls,[['scroll',420]]);});
test('back to capture does not reload templates or clear answers',async()=>{const {c,calls}=setup();c.showView('scan');await Promise.resolve();c.showView('calendar');calls.length=0;c.goBackView();assert(!calls.some(x=>x[0]==='templates'));});
test('Home clears history; new route does not return to old branch',()=>{const {c,handlers,state}=setup();c.showView('team');c.showView('search');handlers.homeBtn();assert.equal(state().history.length,0);c.showView('stats');c.goBackView();assert.equal(state().currentViewId,'main');});
test('same-view refresh never adds duplicate history',()=>{const {c,state}=setup();c.showView('stats');c.showView('stats');assert.equal(state().history.length,1);c.goBackView();assert.equal(state().currentViewId,'main');});
test('empty history falls back to main and session reset clears prior paths',()=>{const {c,state}=setup();c.goBackView();assert.equal(state().currentViewId,'main');c.showView('team');c.showView('search');c.resetViewHistory();assert.equal(state().history.length,0);c.goBackView();assert.equal(state().currentViewId,'main');assert(html.includes('function resetSessionView() {\n    resetViewHistory();'));});
test('returning to map recalculates size without reloading data',()=>{const {c,calls}=setup();c.showView('map');c.showView('search');calls.length=0;c.goBackView();assert(calls.some(x=>x[0]==='mapSize'));assert(!calls.some(x=>x[0]==='mapData'));});
test('invalid view cannot corrupt navigation; arrows no longer target main',()=>{const {c,state}=setup();c.showView('search');c.showView('unknown');assert.equal(state().currentViewId,'search');assert.equal(state().history.length,1);assert(!html.includes('class="back" data-view="main"'));});
