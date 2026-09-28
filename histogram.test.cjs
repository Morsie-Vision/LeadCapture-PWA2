const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.HISTOGRAM_HTML || __dirname + '/index.html', 'utf8');
function setup() {
 const elements = new Map();
 function element(id) {
  if (!elements.has(id)) elements.set(id, {style:{},textContent:'',innerHTML:'',children:[],clientHeight:220,
   appendChild(child){this.children.push(child)},addEventListener(type,fn){this[type]=fn},scrollIntoView(){}});
  return elements.get(id);
 }
 const leads = Array.from({length:280}, (_,i)=>({id:String(i),created_at:'2026-08-24T10:00:00Z',created_by:i%2?'b':'a'}));
 const ids = leads.slice(0,118).map(l=>l.id);
 const buckets = {'2026-08-25':ids};
 const data = [{date:'2026-08-25',count:118}];
 const context = {console, Intl, Date, Set, allLeads:leads, selectedUserIds:null, statsUsers:[],leadsHistogramFilter:null,
  histogramLeadIdsByDate:buckets, getUser:()=>({timeZone:'Europe/Berlin'}),
  document:{getElementById:element,createElement:()=>element(Symbol())},
  leadsCount:element('leadsCount'),leadsList:element('leadsList'),histogram:element('histogram'),histogramEmpty:element('histogramEmpty'),
  histogramYear:{value:'alle'},histogramView:{value:'day'},
  makeHighlighter:()=>x=>x,sortLeads:x=>x,leadCardHtml:l=>`<article>${l.id}</article>`,
  renderUserFilter(){},syncYearOptions(){},userFilterParam:()=>'',renderSearchResults(){},
  apiRequest:async path=>({json:async()=> path==='/leads'?{success:true,data:leads}:{success:true,data,leadIdsByDate:buckets}})
 };
 vm.createContext(context);
 for (const name of ['statisticsDateKey','leadPassesUserFilter','applyLeadsHistogramFilter','showLeadsForBar','displayLeads','renderHistogram','loadHistogram','loadLeads']) {
  const source=html.match(new RegExp('(?:async )?function '+name+'\\([^]*?^}', 'm'));
  assert(source,name);vm.runInContext(source[0],context);
 }
 return {c:context,element,leads};
}
test('real bar click selects 118 of 280 using server IDs, including after refresh and late lead response',async()=>{
 const {c,element}=setup();await c.loadHistogram();c.histogram.children[0].click();
 assert.equal(c.leadsCount.textContent,'118 / 280');
 assert.match((element('leadsFilterLabel').textContent || element('leadsFilterLabel').innerHTML),/25\.08\.2026: 118 Leads/);
 assert.equal(c.histogram.children[0].children[2].textContent,'25.08.2026');
 await c.loadHistogram(); assert.equal(c.leadsCount.textContent,'118 / 280');
 await c.loadLeads(); assert.equal(c.leadsCount.textContent,'118 / 280');
 assert.equal((c.leadsList.innerHTML.match(/<article>/g)||[]).length,118);
});
test('month and year clicks include all corresponding buckets only',()=>{
 const {c}=setup();c.histogramLeadIdsByDate={'2026-08-25':['0','1'],'2026-08-26':['2'],'2026-09-01':['3'],'2027-01-01':['4']};
 c.showLeadsForBar({date:'2026-08'},'month');assert.equal(c.leadsCount.textContent,'3 / 280');
 c.showLeadsForBar({date:'2026'},'year');assert.equal(c.leadsCount.textContent,'4 / 280');
});
test('user filtering and explicitly empty server buckets survive redraw',()=>{
 const {c}=setup();c.selectedUserIds=new Set(['a']);c.showLeadsForBar({date:'2026-08-25'},'day');
 assert.equal(c.leadsCount.textContent,'59 / 280');
 c.histogramLeadIdsByDate={};c.displayLeads(c.allLeads);assert.equal(c.leadsCount.textContent,'0 / 280');
});
test('legacy backend fallback uses Berlin calendar day',()=>{
 const {c}=setup();c.histogramLeadIdsByDate=null;c.allLeads=[{id:'a',created_at:'2026-08-24T22:30:00Z'}];
 c.showLeadsForBar({date:'2026-08-25'},'day');assert.equal(c.leadsCount.textContent,'1 / 1');
});
