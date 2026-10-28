// ExpenseTracker AI backend. Zero dependencies: run with `node server.js` (Node 18+).
// Stores all data in data.json next to this file, serves index.html, and exposes a REST API + /admin data viewer.
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=+process.env.PORT||3000,HOST=process.env.HOST||'127.0.0.1',DB=path.join(__dirname,'data.json'),MAX=5*1024*1024;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
let db={state:null,updatedAt:null};
try{db=JSON.parse(fs.readFileSync(DB,'utf8'))}catch(e){if(e.code!=='ENOENT')console.warn('data.json unreadable, starting empty:',e.message)}
let writing=Promise.resolve();
const persist=()=>writing=writing.then(()=>{const tmp=DB+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB)}).catch(e=>console.error('write failed',e));

function validateState(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return'State must be an object.';
 if(!Number.isFinite(s.opening))return'opening must be a number.';
 for(const k of ['tx','budgets','challenges','notifs'])if(!Array.isArray(s[k]))return`${k} must be an array.`;
 if(s.tx.length>20000)return'Too many transactions.';
 for(const [i,t] of s.tx.entries()){
  if(!t||!t.id||!['income','expense'].includes(t.type))return`tx[${i}]: invalid type/id.`;
  if(!Number.isFinite(t.amount)||t.amount<=0||t.amount>1e9)return`tx[${i}]: invalid amount.`;
  if(!DATE.test(t.date||''))return`tx[${i}]: invalid date.`;
  if(typeof t.desc!=='string'||!t.desc.trim()||t.desc.length>80)return`tx[${i}]: invalid description.`}
 for(const [i,b] of s.budgets.entries())if(!b||!b.id||!Number.isFinite(b.limit)||b.limit<=0)return`budgets[${i}]: invalid.`;
 for(const [i,c] of s.challenges.entries()){
  if(!c||!c.id||!c.name||!Number.isFinite(c.target)||c.target<=0||!DATE.test(c.start||'')||!DATE.test(c.unlock||''))return`challenges[${i}]: invalid.`;
  if(!['active','released','cancelled'].includes(c.status))return`challenges[${i}]: invalid status.`;
  if(!Array.isArray(c.contributions)||c.contributions.some(x=>!x||!Number.isFinite(x.amount)||x.amount<=0))return`challenges[${i}]: invalid contributions.`}
 return null}
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
function summary(s){
 if(!s)return null;let inc=0,exp=0;s.tx.forEach(t=>t.type==='income'?inc+=t.amount:exp+=t.amount);
 const res=r2(s.challenges.filter(c=>c.status==='active').reduce((a,c)=>a+c.contributions.reduce((q,x)=>q+x.amount,0),0));
 return{opening:s.opening,totalIncome:r2(inc),totalExpenses:r2(exp),reservedInPiggyBank:res,availableBalance:r2(s.opening+inc-exp-res),
  counts:{transactions:s.tx.length,budgets:s.budgets.length,challenges:s.challenges.length,notifications:s.notifs.length}}}

const ADMIN=`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>ExpenseTracker AI · Stored data</title>
<style>body{font:14px system-ui,sans-serif;background:#0b1026;color:#e9ecff;margin:0;padding:24px}h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:16px}a{color:#22d3ee}.sub{color:#8d95c4}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0}.c{background:#141a3d;border:1px solid #ffffff18;border-radius:14px;padding:14px}.c b{display:block;font-size:20px;margin-top:4px}
table{width:100%;border-collapse:collapse;background:#141a3d;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:8px 10px;border-top:1px solid #ffffff12;font-size:13px}th{color:#8d95c4;font-weight:600;border:0}.w{overflow-x:auto}.e{color:#8d95c4;padding:12px}</style>
<h1>Stored data</h1><div class=sub>Live view of data.json on the server · refreshes every 3 s · <a href="/">Open the app</a> · <a href="/api/state">Raw JSON</a></div><div class=cards id=cards></div><div id=out></div>
<script>
const $=s=>document.querySelector(s),money=n=>'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2});
function tbl(title,cols,rows){const h=document.createElement('h2');h.textContent=title+' ('+rows.length+')';const w=document.createElement('div');w.className='w';
 if(!rows.length){w.innerHTML='<div class=e>Nothing stored yet.</div>'}else{const t=document.createElement('table'),hr=t.createTHead().insertRow();cols.forEach(c=>{const th=document.createElement('th');th.textContent=c[0];hr.append(th)});
  const b=t.createTBody();rows.forEach(r=>{const tr=b.insertRow();cols.forEach(c=>{tr.insertCell().textContent=c[1](r)})});w.append(t)}return[h,w]}
async function go(){try{const [s,j]=await Promise.all([fetch('/api/summary').then(r=>r.json()),fetch('/api/state').then(r=>r.json())]);const st=j.state;
 if(!st){$('#cards').innerHTML='';$('#out').innerHTML='<div class=e>No data stored yet. Open the app once; it will sync here.</div>';return}
 const m=s.summary,cards=[['Available balance',money(m.availableBalance)],['Total income',money(m.totalIncome)],['Total expenses',money(m.totalExpenses)],['Reserved in Piggy Bank',money(m.reservedInPiggyBank)],['Opening balance',money(m.opening)],['Last saved',j.updatedAt?new Date(j.updatedAt).toLocaleString():'—']];
 $('#cards').replaceChildren(...cards.map(([a,b])=>{const d=document.createElement('div');d.className='c';d.textContent=a;const x=document.createElement('b');x.textContent=b;d.append(x);return d}));
 const out=$('#out');out.replaceChildren(
  ...tbl('Transactions',[['Date',r=>r.date],['Type',r=>r.type],['Category',r=>r.cat],['Description',r=>r.desc],['Method',r=>r.method],['Amount',r=>money(r.amount)]],st.tx.slice().sort((a,b)=>b.date.localeCompare(a.date))),
  ...tbl('Budgets',[['Applies to',r=>r.cat==='ALL'?'Total':r.cat],['Period',r=>r.period==='custom'?r.from+' → '+r.to:'Monthly'],['Limit',r=>money(r.limit)]],st.budgets),
  ...tbl('Piggy Bank challenges',[['Name',r=>r.name],['Status',r=>r.status],['Start',r=>r.start],['Unlock',r=>r.unlock],['Target',r=>money(r.target)],['Saved',r=>money(r.contributions.reduce((a,x)=>a+x.amount,0))],['Contributions',r=>r.contributions.length]],st.challenges),
  ...tbl('Notifications',[['Time',r=>new Date(r.ts).toLocaleString()],['Type',r=>r.type],['Message',r=>r.msg],['Read',r=>r.read?'yes':'no']],st.notifs.slice().reverse()))}catch(e){$('#out').textContent='Cannot reach the server: '+e.message}}
go();setInterval(go,3000)</script>`;

function send(res,code,body,type='application/json',extra={}){res.writeHead(code,{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...extra});res.end(type==='application/json'?JSON.stringify(body):body)}
function readBody(req){return new Promise((ok,no)=>{let n=0;const ch=[];req.on('data',c=>{n+=c.length;if(n>MAX){no(Object.assign(new Error('Payload too large'),{code:413}));req.destroy()}else ch.push(c)});req.on('end',()=>ok(Buffer.concat(ch).toString()));req.on('error',no)})}

http.createServer(async(req,res)=>{
 const origin=req.headers.origin,cors=origin&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{};
 const u=new URL(req.url,'http://x'),p=u.pathname,j=(c,b)=>send(res,c,b,'application/json',cors);
 try{
  if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
  if(req.method==='GET'&&(p==='/'||p==='/index.html'))return send(res,200,fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),'text/html');
  if(req.method==='GET'&&p==='/admin')return send(res,200,ADMIN,'text/html');
  if(req.method==='GET'&&p==='/api/health')return j(200,{ok:true,hasData:!!db.state});
  if(p==='/api/state'){
   if(req.method==='GET')return j(200,db);
   if(req.method==='PUT'){let body;try{body=JSON.parse(await readBody(req))}catch(e){return j(e.code===413?413:400,{error:e.code===413?'Payload too large':'Body must be valid JSON.'})}
    const err=validateState(body);if(err)return j(400,{error:err});db={state:body,updatedAt:new Date().toISOString()};persist();return j(200,{ok:true,updatedAt:db.updatedAt})}
   if(req.method==='DELETE'){db={state:null,updatedAt:null};persist();return j(200,{ok:true})}}
  if(req.method==='GET'&&p==='/api/summary')return j(200,{summary:summary(db.state),updatedAt:db.updatedAt});
  const m=p.match(/^\/api\/(transactions|budgets|challenges|notifications)$/);
  if(req.method==='GET'&&m){const s=db.state;if(!s)return j(200,[]);const k={transactions:'tx',budgets:'budgets',challenges:'challenges',notifications:'notifs'}[m[1]];let l=s[k];
   if(k==='tx'){const ty=u.searchParams.get('type'),q=(u.searchParams.get('q')||'').toLowerCase();l=l.filter(t=>(!ty||t.type===ty)&&(!q||t.desc.toLowerCase().includes(q)))}return j(200,l)}
  j(404,{error:'Not found'})
 }catch(e){console.error(e);j(500,{error:'Server error'})}
}).listen(PORT,HOST,()=>console.log(`ExpenseTracker AI running\n  App:   http://localhost:${PORT}\n  Admin: http://localhost:${PORT}/admin  (all stored data)\n  Data:  ${DB}`));
