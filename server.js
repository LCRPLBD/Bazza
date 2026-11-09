import http from 'node:http';
import {readFileSync,mkdirSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const seed=JSON.parse(readFileSync(new URL('./cars.json',import.meta.url)));
const dir=process.env.DATA_DIR||'./data';mkdirSync(dir,{recursive:true});
const file=join(dir,'wins.json');
let wins=existsSync(file)?JSON.parse(readFileSync(file)):Object.fromEntries(seed.map(c=>[c.id,c.won]));
const reviewsFile=join(dir,'reviews.json');
let reviews=existsSync(reviewsFile)?JSON.parse(readFileSync(reviewsFile)): {};
const password=process.env.EDITOR_PASSWORD;
if(!password)throw Error('Set EDITOR_PASSWORD before starting.');
const salt=randomBytes(32),passwordHash=scryptSync(password,salt,64);
const sessions=new Map(),attempts=new Map();
const ttl=8*60*60*1000;
const html=readFileSync(new URL('./index.html',import.meta.url));
const css=readFileSync(new URL('./style.css',import.meta.url));
const js=readFileSync(new URL('./app.js',import.meta.url));
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>16000)throw Error('Request too large');}return JSON.parse(value||'{}');}
const server=http.createServer(async(req,res)=>{
res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
try{
const path=new URL(req.url,'http://localhost').pathname;
const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bazza_session='))?.slice(14);
const logged=!!token&&(sessions.get(token)||0)>Date.now();
if(req.method==='GET'&&path==='/health')return reply(res,200,{ok:true});
if(req.method==='GET'&&path==='/api/state')return reply(res,200,{logged,cars:seed.map(c=>({...c,won:!!wins[c.id],notes:reviews[c.id]?.notes||'',decision:reviews[c.id]?.decision||''}))});
if(req.method==='POST'){
const normalizeOrigin=value=>{
try{const u=new URL(value.trim());return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.origin:null;}catch{return null;}
};
const origin=typeof req.headers.origin==='string'?normalizeOrigin(req.headers.origin):null;
const site=req.headers['sec-fetch-site'];
// Browser-controlled Fetch Metadata survives reverse proxies without relying on
// their internal Host. Other websites cannot forge this header in browser JS.
const browserSameOrigin=site==='same-origin';
const allowed=[
process.env.APP_ORIGIN,
process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:null,
!process.env.APP_ORIGIN&&!process.env.RAILWAY_PUBLIC_DOMAIN
?((process.env.NODE_ENV==='production'?'https':'http')+'://'+req.headers.host):null
].filter(Boolean).map(normalizeOrigin).filter(Boolean);
if(!origin||(site&&site!=='same-origin')||(!browserSameOrigin&&!allowed.includes(origin)))
return reply(res,403,{error:'Invalid request origin. Open the site directly in your browser and try again.'});
if(path==='/api/login'){
// Global bounded attempt limit supplements the per-address limit, including proxy spoofing attempts.
const ip=req.socket.remoteAddress||'unknown';
const now=Date.now();const recent=(attempts.get(ip)||[]).filter(t=>now-t<600000);
if(recent.length>=10)return reply(res,429,{error:'Too many attempts. Try again in 10 minutes.'});
recent.push(now);attempts.set(ip,recent);
const b=await body(req);
const ok=typeof b.password==='string'&&b.password.length<=256&&timingSafeEqual(scryptSync(b.password,salt,64),passwordHash);
if(b.username!=='Bazza'||!ok)return reply(res,401,{error:'Incorrect username or password.'});
attempts.delete(ip);
const session=randomBytes(32).toString('hex');sessions.set(session,now+ttl);
res.setHeader('Set-Cookie','bazza_session='+session+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(process.env.NODE_ENV==='production'?'; Secure':''));
return reply(res,200,{ok:true});
}
if(path==='/api/logout'){sessions.delete(token);res.setHeader('Set-Cookie','bazza_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));return reply(res,200,{ok:true});}
if(path==='/api/review'){
if(!logged)return reply(res,401,{error:'Log in to update car reviews.'});
const b=await body(req);
if(!Number.isInteger(b.id)||!seed.some(c=>c.id===b.id)||Object.keys(b).some(k=>!['id','notes','decision'].includes(k))||(!Object.hasOwn(b,'notes')&&!Object.hasOwn(b,'decision'))||(Object.hasOwn(b,'notes')&&(typeof b.notes!=='string'||b.notes.length>2000))||(Object.hasOwn(b,'decision')&&!['','nerf','buff','keep'].includes(b.decision)))return reply(res,400,{error:'Invalid car review.'});
const next={...reviews,[b.id]:{...(reviews[b.id]||{}),...(Object.hasOwn(b,'notes')?{notes:b.notes}:{}),...(Object.hasOwn(b,'decision')?{decision:b.decision}:{})}};
writeFileSync(reviewsFile+'.tmp',JSON.stringify(next));renameSync(reviewsFile+'.tmp',reviewsFile);reviews=next;
return reply(res,200,{ok:true});
}
if(path==='/api/win'){
if(!logged)return reply(res,401,{error:'Log in to update wins.'});
const b=await body(req);
if(!Number.isInteger(b.id)||!seed.some(c=>c.id===b.id)||typeof b.won!=='boolean'||Object.keys(b).some(k=>!['id','won'].includes(k)))return reply(res,400,{error:'Only a race win can be updated.'});
const next={...wins,[b.id]:b.won};writeFileSync(file+'.tmp',JSON.stringify(next));renameSync(file+'.tmp',file);wins=next;
return reply(res,200,{ok:true});
}
}
if(req.method==='GET'){
const assets={'/':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css'],'/app.js':[js,'text/javascript']};
if(assets[path]){res.writeHead(200,{'Content-Type':assets[path][1]});return res.end(assets[path][0]);}
}
reply(res,404,{error:'Not found'});
}catch(e){reply(res,500,{error:'Unable to save. Please try again.'});}
});
setInterval(()=>{for(const [k,v]of sessions)if(v<Date.now())sessions.delete(k);for(const[k,v]of attempts)if(v.every(t=>Date.now()-t>600000))attempts.delete(k)},60000).unref();
server.listen(Number(process.env.PORT||3000),'0.0.0.0');


