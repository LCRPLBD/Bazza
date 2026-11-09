let cars=[],logged=false,filter='all',busy=false;
const $=id=>document.getElementById(id);
async function api(path,data){const r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const value=await r.json();if(!r.ok)throw Error(value.error||'Request failed');return value;}
function render(){
const wins=cars.filter(c=>c.won).length,pct=Math.round(wins/cars.length*100)||0;
$('total').textContent=cars.length;$('wins').textContent=wins;$('remaining').textContent=cars.length-wins;
$('percent').innerHTML=pct+'<small>%</small>';$('dialWins').textContent=wins;document.querySelector('.dial').style.setProperty('--progress',pct+'%');
$('driver').textContent=logged?'BAZZA':'SPECTATOR';$('accessHint').textContent=logged?'Win tracking unlocked':'Log in to record your wins';$('loginButton').textContent=logged?'Log out · Bazza':'↗ Driver login';
const search=$('search').value.toLowerCase(),category=$('category').value;
const visible=cars.filter(c=>c.name.toLowerCase().includes(search)&&(category==='all'||c.category===category)&&(filter==='all'||(filter==='won'?c.won:!c.won)));
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
row.append(main,badge,toggle);return row;
}));
}
async function refresh(){try{const s=await api('state');cars=s.cars;logged=s.logged;render();$('saveStatus').textContent=logged?'✓ Progress synced':'Viewing Bazza’s progress · Login to edit';}catch(e){$('saveStatus').textContent='Could not load progress. Refresh to retry.';}}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('search').oninput=render;$('category').onchange=render;
$('loginButton').onclick=async()=>{if(logged){try{await api('logout',{});await refresh();}catch(e){$('saveStatus').textContent=e.message;}}else{$('loginError').textContent='';$('login').showModal();}};
$('closeLogin').onclick=()=>$('login').close();
$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const f=new FormData(e.target);await api('login',{username:f.get('username'),password:f.get('password')});e.target.elements.password.value='';$('login').close();await refresh();}catch(e){$('loginError').textContent=e.message;}finally{button.disabled=false;}};
refresh();