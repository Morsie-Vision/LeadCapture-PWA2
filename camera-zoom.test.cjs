const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function setup(capabilities){
 const elements={zoomSlider:{},zoomWrap:{style:{}},zoomValue:{}},values=[];
 const track={getCapabilities:()=>capabilities,applyConstraints:async c=>values.push(c.advanced[0].zoom)};
 const c=vm.createContext({cameraTrack:()=>track,document:{getElementById:id=>elements[id]},console});
 vm.runInContext(html.slice(html.indexOf('let zoomCaps = null;'),html.indexOf("document.getElementById('zoomSlider').addEventListener")),c);
 return {c,track,elements,values};
}
test('camera opens at 1x instead of 2x',async()=>{const {c,values,elements}=setup({zoom:{min:1,max:8,step:.1}});await c.setupZoom();assert.deepEqual(values,[1]);assert.equal(elements.zoomValue.textContent,'1.0×');});
test('reopening resets manual zoom to normal',async()=>{const {c,values}=setup({zoom:{min:1,max:8}});await c.setupZoom();await c.applyZoom(3);await c.setupZoom();assert.deepEqual(values,[1,3,1]);});
test('wide-angle range starts at normal 1x',async()=>{const {c,values}=setup({zoom:{min:.5,max:4}});await c.setupZoom();assert.deepEqual(values,[1]);});
test('camera minimum above 1 is respected',async()=>{const {c,values}=setup({zoom:{min:2,max:8}});await c.setupZoom();assert.deepEqual(values,[2]);});
test('camera without zoom clears old capabilities and hides control',async()=>{const {c,track,values,elements}=setup({zoom:{min:1,max:4}});await c.setupZoom();track.getCapabilities=()=>({});await c.setupZoom();await c.applyZoom(2);assert.equal(elements.zoomWrap.style.display,'none');assert.deepEqual(values,[1]);});
test('capability failure hides control; initial HTML shows 1x',async()=>{const {c,track,elements}=setup({});track.getCapabilities=()=>{throw Error('unsupported')};await c.setupZoom();assert.equal(elements.zoomWrap.style.display,'none');assert(html.includes('step="0.1" value="1"'));assert(html.includes('id="zoomValue">1.0×'));});
