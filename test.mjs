import {spawn} from 'node:child_process';import {mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import assert from'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'bazza-test-')),port=31981,url='http://localhost:'+port;let child;
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',EDITOR_PASSWORD:'test-only-password',DATA_DIR:dir,PORT:String(port)},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Server did not start');}
async function stop(){if(child){child.kill();await new Promise(r=>child.once('exit',r));child=null;}}
async function post(path,data,cookie,origin=url){return fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...cookie?{Cookie:cookie}:{}},body:JSON.stringify(data)});}
try{await start();let state=await(await fetch(url+'/api/state')).json();assert.equal(state.cars.length,102);assert.equal(state.cars.filter(x=>x.won).length,3);assert.deepEqual(state.cars.filter(x=>x.won).map(x=>x.name),['Evo','c8','812']);assert.equal((await post('win',{id:1,won:true})).status,401);
assert.equal((await post('login',{username:'Bazza',password:'wrong'})).status,401);
const proxyRequest=(origin,site)=>fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':site},body:JSON.stringify({username:'Bazza',password:'test-only-password'})});
assert.equal((await proxyRequest('https://bazza.example','same-origin')).status,200);
assert.equal((await proxyRequest('https://evil.example','cross-site')).status,403);
assert.equal((await proxyRequest(url,'same-site')).status,403);
assert.equal((await proxyRequest('null','same-origin')).status,403);
const login=await post('login',{username:'Bazza',password:'test-only-password'},undefined,url+'/');assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
assert.equal((await post('win',{id:1,won:true},cookie,'https://evil.example')).status,403);
assert.equal((await post('win',{id:1,won:true,name:'changed'},cookie)).status,400);
assert.equal((await post('win',{id:999,won:true},cookie)).status,400);
assert.equal((await post('win',{id:1,won:true},cookie)).status,200);
assert.equal((await(await fetch(url+'/api/state')).json()).cars[0].won,true);
assert.equal((await post('review',{id:1,notes:'test'})).status,401);
assert.equal((await post('review',{id:1,decision:'delete'},cookie)).status,400);
assert.equal((await post('review',{id:1,notes:'x'.repeat(2001)},cookie)).status,400);
assert.equal((await post('review',{id:1,notes:'Needs more grip',decision:'buff'},cookie)).status,200);
assert.equal((await post('review',{id:1,decision:'keep'},cookie)).status,200);
let reviewed=(await(await fetch(url+'/api/state')).json()).cars[0];assert.equal(reviewed.notes,'Needs more grip');assert.equal(reviewed.decision,'keep');

const before=(await(await fetch(url+'/api/state')).json()).cars;
assert.equal((await post('cars/add',{name:'Test',category:'S1'})).status,401);
assert.equal((await post('cars/delete',{id:1})).status,401);
assert.equal((await post('cars/add',{name:' ',category:'S1'},cookie)).status,400);
assert.equal((await post('cars/add',{name:'Test',category:'bad'},cookie)).status,400);
assert.equal((await post('cars/add',{name:'Test',category:'S1'},cookie,'https://evil.example')).status,403);
const added=await post('cars/add',{name:' r8 ',category:'S2'},cookie);assert.equal(added.status,201);
const car=(await added.json()).car;assert.equal(car.id,103);assert.equal(car.name,'r8');assert.equal(car.won,false);
assert.deepEqual((await(await fetch(url+'/api/state')).json()).cars.slice(0,102),before);
assert.equal((await post('win',{id:car.id,won:true},cookie)).status,200);
assert.equal((await post('review',{id:car.id,notes:'Added car note',decision:'nerf'},cookie)).status,200);
assert.equal((await post('cars/delete',{id:car.id},cookie)).status,200);
assert.equal((await post('cars/delete',{id:car.id},cookie)).status,404);
assert.equal((await post('win',{id:car.id,won:false},cookie)).status,400);
const second=(await(await post('cars/add',{name:'Second',category:'drift'},cookie)).json()).car;
assert.equal(second.id,104);
assert.deepEqual((await(await fetch(url+'/api/state')).json()).cars.slice(0,102),before);
await post('logout',{},cookie);assert.equal((await post('win',{id:1,won:false},cookie)).status,401);
await stop();await start();assert.equal((await(await fetch(url+'/api/state')).json()).cars[0].won,true);
let restored=(await(await fetch(url+'/api/state')).json()).cars[0];assert.equal(restored.notes,'Needs more grip');assert.equal(restored.decision,'keep');

const final=(await(await fetch(url+'/api/state')).json()).cars;
assert.equal(final.length,103);assert.equal(final.some(c=>c.id===103),false);assert.equal(final.at(-1).id,104);
assert.deepEqual(final.slice(0,102),before);
console.log('PASS: add/delete authorization, validation, stable IDs, existing records preserved, restart persistence; review authorization, validation, partial updates, persistence; data integrity, authentication, authorization, origin checks, persistence and logout.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}

