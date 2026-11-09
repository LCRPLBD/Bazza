let cars=[],logged=false,filter='all',busy=false; const drafts=new Map();
const $=id=>document.getElementById(id);
async function api(path,data){const r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const value=await r.json();if(!r.ok)throw Error(value.error||'Request failed');return value;}
function render(){
const wins=cars.filter(c=>c.won).length,pct=Math.round(wins/cars.length*100)||0;
$('total').textContent=cars.length;$('wins').textContent=wins;$('remaining').textContent=cars.length-wins;
$('percent').innerHTML=pct+'<small>%</small>';$('dialWins').textContent=wins;document.querySelector('.dial').style.setProperty('--progress',pct+'%');
$('driver').textContent=logged?'BAZZA':'SPECTATOR';$('accessHint').textContent=logged?'Win tracking unlocked':'Log in to record your wins';$('loginButton').textContent=logged?'Log out · Bazza':'↗ Driver login';
const search=$('search').value.toLowerCase(),category=$('category').value;
const visible=cars.filter(c=>(c.name+' '+(c.notes||'')).toLowerCase().includes(search)&&(category==='all'||c.category===category)&&($('decisionFilter').value==='all'||($('decisionFilter').value==='unreviewed'?!c.decision:c.decision===$('decisionFilter').value))&&(filter==='all'||(filter==='won'?c.won:!c.won)));
$('count').textContent=visible.length+' / '+cars.length;$('empty').hidden=visible.length!==0;
$('cars').replaceChildren(...visible.map(c=>{
const row=document.createElement('div');row.className='car'+(c.won?' won':'');
const main=document.createElement('div');main.className='car-main';
const number=document.createElement('span');number.className='number';number.textContent=String(c.id).padStart(3,'0');
const name=document.createElement('span');name.className='car-name';name.textContent=c.name;
main.append(number,name);
const badge=document.createElement('span');badge.className='class-badge '+c.category;badge.textContent=c.category.toUpperCase();
const toggle=document.createElement('button');toggle.className='toggle';toggle.disabled=!logged||busy;toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(c.won));toggle.setAttribute('aria-label',c.name+' entry '+c.id+' — won');toggle.title=logged?'Toggle win':'Log in to edit';
toggle.innerHTML='<span>'+(c.won?'WON':'NOT WON')+'</span><span class="switch" aria-hidden="true"></span>';
toggle.onclick=async()=>{busy=true;render();$('saveStatus').textContent='Saving result…';try{await api('win',{id:c.id,won:!c.won});c.won=!c.won;$('saveStatus').textContent='✓ Result saved';}catch(e){$('saveStatus').textContent=e.message;}finally{busy=false;render();}};
const notesWrap=document.createElement('div');notesWrap.className='notes-wrap';
const notes=document.createElement('textarea');notes.maxLength=2000;notes.rows=2;notes.value=drafts.has(c.id)?drafts.get(c.id):c.notes||'';notes.disabled=!logged||busy;notes.placeholder=logged?'Handling, speed, race feedback…':'No notes yet';notes.setAttribute('aria-label','Notes for '+c.name+' entry '+c.id);
const save=document.createElement('button');save.className='save-note';save.textContent='Save note';save.disabled=!logged||busy||!drafts.has(c.id);
notes.oninput=()=>{drafts.set(c.id,notes.value);save.disabled=false;save.textContent='Save note •';};
save.onclick=async()=>{const value=notes.value;busy=true;render();$('saveStatus').textContent='Saving note…';try{await api('review',{id:c.id,notes:value});c.notes=value;drafts.delete(c.id);$('saveStatus').textContent='✓ Note saved';}catch(e){$('saveStatus').textContent=e.message;}finally{busy=false;render();}};
notesWrap.append(notes,save);
const decisions=document.createElement('div');decisions.className='decisions';decisions.setAttribute('role','group');decisions.setAttribute('aria-label','Balance decision for '+c.name+' entry '+c.id);
for(const value of ['nerf','buff','keep']){const b=document.createElement('button');b.className='decision '+value+(c.decision===value?' active':'');b.textContent=value[0].toUpperCase()+value.slice(1);b.setAttribute('aria-pressed',String(c.decision===value));b.disabled=!logged||busy;b.title='Click again to clear';b.onclick=async()=>{const next=c.decision===value?'':value;busy=true;render();try{await api('review',{id:c.id,decision:next});c.decision=next;$('saveStatus').textContent='✓ Decision saved';}catch(e){$('saveStatus').textContent=e.message;}finally{busy=false;render();}};decisions.append(b);}
row.append(main,badge,toggle,notesWrap,decisions);return row;
}));
}
async function refresh(){try{const s=await api('state');cars=s.cars;logged=s.logged;render();$('saveStatus').textContent=logged?'✓ Progress synced':'Viewing Bazza’s progress · Login to edit';}catch(e){$('saveStatus').textContent='Could not load progress. Refresh to retry.';}}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('decisionFilter').onchange=render; $('search').oninput=render;$('category').onchange=render;
$('loginButton').onclick=async()=>{if(logged){try{await api('logout',{});await refresh();}catch(e){$('saveStatus').textContent=e.message;}}else{$('loginError').textContent='';$('login').showModal();}};
$('closeLogin').onclick=()=>$('login').close();
$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const f=new FormData(e.target);await api('login',{username:f.get('username'),password:f.get('password')});e.target.elements.password.value='';$('login').close();await refresh();}catch(e){$('loginError').textContent=e.message;}finally{button.disabled=false;}};
refresh();
window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});
$('exportList').onclick=()=>{
const pick=$('decisionFilter').value;
const rows=cars.filter(c=>pick==='all'||(pick==='unreviewed'?!c.decision:c.decision===pick));
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[['Entry','Car','Class','Won','Decision','Notes'],...rows.map(c=>[c.id,c.name,c.category,c.won?'Yes':'No',c.decision||'Unreviewed',c.notes||''])].map(row=>row.map(v=>quote(/^[=+@\-\t\r]/.test(String(v))?"'"+v:v)).join(',')).join('\r\n');
const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='bazza-'+pick+'-list.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
