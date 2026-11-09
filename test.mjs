import {spawn} from 'node:child_process';import {mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import assert from'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'bazza-test-')),port=31981,url='http://localhost:'+port;let child;
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',EDITOR_PASSWORD:'test-only-password',DATA_DIR:dir,PORT:String(port)},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(url+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Server did not start');}
async function stop(){if(child){child.kill();await new Promise(r=>child.once('exit',r));child=null;}}
async function post(path,data,cookie,origin=url){return fetch(url+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...cookie?{Cookie:cookie}:{}},body:JSON.stringify(data)});}
try{await start();let state=await(await fetch(url+'/api/state')).json();assert.equal(state.cars.length,102);assert.equal(state.cars.filter(x=>x.won).length,3);assert.deepEqual(state.cars.filter(x=>x.won).map(x=>x.name),['Evo','c8','812']);assert.equal((await post('win',{id:1,won:true})).status,401);
assert.equal((await post('login',{username:'Bazza',password:'wrong'})).status,401);
const login=await post('login',{username:'Bazza',password:'test-only-password'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
assert.equal((await post('win',{id:1,won:true},cookie,'https://evil.example')).status,403);
assert.equal((await post('win',{id:1,won:true,name:'changed'},cookie)).status,400);
assert.equal((await post('win',{id:999,won:true},cookie)).status,400);
assert.equal((await post('win',{id:1,won:true},cookie)).status,200);
assert.equal((await(await fetch(url+'/api/state')).json()).cars[0].won,true);
await post('logout',{},cookie);assert.equal((await post('win',{id:1,won:false},cookie)).status,401);
await stop();await start();assert.equal((await(await fetch(url+'/api/state')).json()).cars[0].won,true);
console.log('PASS: data integrity, authentication, authorization, origin checks, persistence and logout.');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}