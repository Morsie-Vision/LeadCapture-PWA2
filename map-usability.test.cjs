const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
class El {
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.style={};this.value='';}
 append(...els){this.children.push(...els);} appendChild(el){this.append(el);return el;}
 replaceChildren(...els){this.children=els;} setAttribute(){} addEventListener(n,f){this.handlers[n]=f;}
 set innerHTML(v){this.children=[];this.html=v;} get innerHTML(){return this.html||'';}
}
const els={}; const get=id=>els[id] ||= new El('div');
const c=vm.createContext({document:{getElementById:get,createElement:t=>new El(t)},console,encodeURIComponent});
vm.runInContext('let allLeads=[],mapMarkers=[];const mapInstance={removeLayer(){},setView(){}};function updateCityFilterOptions(){}',c);
vm.runInContext(html.slice(html.indexOf('function hasCoords('),html.indexOf('function updateCityFilterOptions(')),c);
vm.runInContext(html.slice(html.indexOf('function displayMapMarkers('),html.indexOf('// Stößt das Nachverorten')),c);
const lead={id:'1',first_name:'Max',last_name:'Muster',company:'<img onerror=alert(1)>',email:'a@b.de',priority:2,visitor_type:'Presse',vat_id:'DE123',interests:['Test'],street:'Alt',city:'Erfurt',zip:'99084'};
const render=()=>{c.leads=[lead,{id:'2',company:'Ohne Adresse'}];vm.runInContext('allLeads=leads;displayMapMarkers(allLeads)',c);};
const form=()=>get('mapUnlocated').children[1].children[2];
const inputs=()=>form().children[0].children.map(l=>l.children[0]);
(async()=>{
 assert(!html.includes('id="visitorType"'));assert(!html.includes('fields.visitorType'));console.log('PASS capture field and all dependent references removed; script syntax');
 render();assert.equal(get('mapUnlocated').children.length,3);assert(get('mapWarn').innerHTML.includes('2 Lead(s)'));assert.equal(get('mapUnlocated').children[1].children[0].textContent,'<img onerror=alert(1)> · Max Muster');console.log('PASS list includes absent and incomplete addresses; contact text is not HTML');
 get('mapCityFilter').value='Erfurt';vm.runInContext('displayMapMarkers(allLeads)',c);assert.equal(get('mapUnlocated').children.length,2);get('mapCityFilter').value='';console.log('PASS city filter and list agree');
 render();inputs()[0].value='Neue Straße 1';form().handlers.input();render();assert.equal(inputs()[0].value,'Neue Straße 1');assert(get('mapUnlocated').children[1].open);console.log('PASS refresh preserves address draft');
 c.apiRequest=async()=>{throw new Error('Offline');};await form().handlers.submit({preventDefault(){}});assert(form().children[2].textContent.includes('Offline'));assert.equal(inputs()[0].value,'Neue Straße 1');assert.equal(form().children[1].disabled,false);console.log('PASS save failure retains draft and allows retry');
 let payload;c.apiRequest=async(url,options)=>{payload=JSON.parse(options.body).lead;assert.equal(url,'/leads/1');return {json:async()=>({success:true,data:{...lead,...payload.address},geocoding:true})};};await form().handlers.submit({preventDefault(){}});assert.equal(payload.address.street,'Neue Straße 1');for(const key of ['company','email','priority','interests'])assert.deepEqual(payload[key],lead[key]);assert.equal(payload.firstName,lead.first_name);assert.equal(payload.visitorType,lead.visitor_type);assert.equal(payload.vatId,lead.vat_id);assert.equal(vm.runInContext('mapAddressDrafts.size',c),0);console.log('PASS address save preserves other contact fields and updates local list');
 c.leads=[];vm.runInContext('displayMapMarkers(leads)',c);assert.equal(get('mapUnlocated').children.length,0);assert.equal(get('mapWarn').style.display,'none');console.log('PASS empty state clears list and warning');
})().catch(e=>{console.error(e);process.exitCode=1;});
