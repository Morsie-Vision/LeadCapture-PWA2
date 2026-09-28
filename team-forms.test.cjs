const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
function setup(api) {
 const els=new Map();
 const get=id=>{if(!els.has(id))els.set(id,{value:'',hidden:true,type:'password',textContent:'',disabled:false,focus(){},scrollIntoView(){},setAttribute(){},removeAttribute(){},reportValidity(){return true},reset(){for(const [k,e]of els)if(/Email|Name$|Password|Repeat/.test(k))e.value=''}});return els.get(id)};
 const calls=[];const c={document:{getElementById:get},teamAccountTarget:null,teamAccountSaving:false,authGeneration:0,teamUsers:[{id:'u1',email:'test@example.com'}],encodeURIComponent,loadTeamUsers:async()=>{},apiRequest:async(...args)=>{calls.push(args);return api?api(...args):{json:async()=>({success:true})}}};
 vm.createContext(c);
 for(const name of ['closeTeamAccountForm','openTeamAccountForm','resetUserPassword','submitTeamAccountForm'])vm.runInContext(html.match(new RegExp('(?:async )?function '+name+'\\([^]*?^}', 'm'))[0],c);
 const fill=(p='abcdef',repeat=p)=>{get('teamAccountEmail').value=' test@example.com ';get('teamAccountName').value=' Test ';get('teamAccountPassword').value=p;get('teamAccountRepeat').value=repeat};
 return {c,get,calls,fill,submit:()=>c.submitTeamAccountForm({preventDefault(){}})};
}
test('create user submits trimmed fields with six-character password and clears secret',async()=>{const s=setup();s.c.openTeamAccountForm();s.fill();await s.submit();assert.equal(s.calls[0][0],'/team');assert.deepEqual(JSON.parse(s.calls[0][1].body),{email:'test@example.com',password:'abcdef',fullName:'Test',role:'member'});assert.equal(s.get('teamAccountPassword').value,'');assert.equal(s.get('teamAccountNotice').hidden,false)});
test('five-character and mismatched passwords never send requests',async()=>{for(const values of [['abcde','abcde'],['abcdef','different']]){const s=setup();s.fill(...values);await s.submit();assert.equal(s.calls.length,0);assert.match(s.get('teamAccountError').textContent,/6 Zeichen/)}});
test('reset selected user uses password endpoint and hides name field',async()=>{const s=setup();s.c.resetUserPassword('u1');assert(s.get('teamAccountEmail').readOnly);assert(s.get('teamAccountNameRow').hidden);s.fill();await s.submit();assert.equal(s.calls[0][0],'/team/u1/password');assert.deepEqual(JSON.parse(s.calls[0][1].body),{password:'abcdef'})});
test('API error stays inline and allows retry without losing inputs',async()=>{const s=setup(async()=>({json:async()=>({success:false,error:'E-Mail bereits vorhanden'})}));s.c.openTeamAccountForm();s.fill();await s.submit();assert.equal(s.get('teamAccountError').textContent,'E-Mail bereits vorhanden');assert.equal(s.get('teamAccountPassword').value,'abcdef');assert.equal(s.c.teamAccountSaving,false);assert.equal(s.get('teamAccountFields').disabled,false)});
test('double submit sends only one request',async()=>{let done;const s=setup(()=>new Promise(r=>done=r));s.fill();const first=s.submit();await s.submit();assert.equal(s.calls.length,1);done({json:async()=>({success:true})});await first});
test('cancel clears password and closes inline form',()=>{const s=setup();s.c.openTeamAccountForm();s.fill();s.c.closeTeamAccountForm();assert(s.get('teamAccountPanel').hidden);assert.equal(s.get('teamAccountPassword').value,'')});
