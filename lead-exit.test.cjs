const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function setup({editing=true, changed=false}={}) {
    const elements={}, calls=[];
    const get=id=>elements[id] ||= {style:{display:id==='detailEditMode'&&editing?'block':'none'},classList:{active:true,contains(){return this.active},remove(){this.active=false}},onclick:async()=>{calls.push('save');return true}};
    const c=vm.createContext({document:{getElementById:get},authGeneration:1,detailQuestionState:changed?{answers:{q:'new'},template:null,cleanFingerprint:'old'}:null,collectDetailAnswers(){},currentLeadDetail:{id:1},editTags:[],detailQuestionGeneration:0,currentLeadId:1,currentLeadAnswers:{},showView:id=>calls.push(id),saveDetailQuestionnaire:async()=>{calls.push('questions');return true}});
    vm.runInContext(html.slice(html.indexOf("const detailOverlay ="),html.indexOf('function openLeadDetail(')),c);
    c.askLeadExit=async()=>{calls.push('ask');return 'discard'};
    return {c,get,calls};
}
test('Home discard closes and clears editor before navigating, without a write',async()=>{const {c,get,calls}=setup();await c.requestCloseLeadDetail('main');assert.deepEqual(calls,['ask','main']);assert.equal(get('leadDetailOverlay').classList.active,false);assert.equal(get('detailEditMode').style.display,'none');assert.equal(c.currentLeadDetail,null)});
test('cross saves and closes without changing background view',async()=>{const {c,get,calls}=setup();c.askLeadExit=async()=> 'save';await c.requestCloseLeadDetail();assert.deepEqual(calls,['save']);assert.equal(get('leadDetailOverlay').classList.active,false)});
test('cancel or Escape retains editor and route',async()=>{const {c,get,calls}=setup();c.askLeadExit=async()=> 'cancel';await c.requestCloseLeadDetail('main');assert.deepEqual(calls,[]);assert.equal(get('leadDetailOverlay').classList.active,true)});
test('failed lead save retains editor and prevents Home navigation',async()=>{const {c,get,calls}=setup();c.askLeadExit=async()=> 'save';get('saveEditBtn').onclick=async()=>false;await c.requestCloseLeadDetail('main');assert.deepEqual(calls,[]);assert.equal(get('detailEditMode').style.display,'block');assert.equal(get('leadDetailOverlay').classList.active,true)});
test('Home waits for save and repeated clicks cannot submit twice',async()=>{const {c,get,calls}=setup();let finish;c.askLeadExit=async()=> 'save';get('saveEditBtn').onclick=()=>new Promise(r=>finish=r);const pending=c.requestCloseLeadDetail('main');await Promise.resolve();await c.requestCloseLeadDetail('main');assert.deepEqual(calls,[]);finish(true);await pending;assert.deepEqual(calls,['main'])});
test('changed questionnaire is included; failure prevents closing',async()=>{const {c,get,calls}=setup({editing:false,changed:true});c.askLeadExit=async()=> 'save';c.saveDetailQuestionnaire=async()=>false;await c.requestCloseLeadDetail('main');assert.equal(get('leadDetailOverlay').classList.active,true);assert.deepEqual(calls,[])});
test('plain details close without prompt',async()=>{const {c,get,calls}=setup({editing:false});await c.requestCloseLeadDetail('main');assert.deepEqual(calls,['main']);assert.equal(get('leadDetailOverlay').classList.active,false)});
test('session change during confirmation cannot save or navigate',async()=>{const {c,calls}=setup();c.askLeadExit=async()=>{c.authGeneration++;return 'save'};await c.requestCloseLeadDetail('main');assert.deepEqual(calls,[])});
