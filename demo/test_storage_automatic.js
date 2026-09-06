const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let data = {};
let listener;
const event = { addListener() {} };
const ctx = { console, URL, Date, setTimeout, crypto: require('node:crypto').webcrypto,
 chrome: { runtime: { id:'test', getURL:p=>'chrome-extension://test/'+p,onInstalled:event,onMessage:{addListener:f=>listener=f}},
 storage:{local:{get:async()=>structuredClone(data),set:async p=>{await new Promise(r=>setTimeout(r,2));Object.assign(data,structuredClone(p));}},onChanged:event},
 contextMenus:{onClicked:event},commands:{onCommand:event}, tabs:{get:async()=>({url:'https://example.com/form'})} } };
vm.createContext(ctx);
ctx.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),ctx));
ctx.importScripts('shared.js','matcher.js');
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/background.js'),'utf8'),ctx);
const ui={id:'test',url:'chrome-extension://test/src/options.html'};
const page={id:'test',url:'https://example.com/form',origin:'https://example.com',frameId:0,tab:{id:1,url:'https://example.com/form'}};
async function send(msg,sender=ui){return new Promise((resolve,reject)=>{const result=listener(msg,sender,resolve);if(result!==true)reject(new Error('worker must handle '+msg.type));});}
(async()=>{
 const a=await send({type:'fm.mutate',op:'identity',key:'firstName',value:'Alex'});
 assert.equal(a.ok,true,'worker supports authorized identity patch');
 await Promise.all([send({type:'fm.mutate',op:'identity',key:'email',value:'you@example.com'}),send({type:'fm.mutate',op:'identity',key:'lastName',value:'Rivera'})]);
 assert.equal(data.identity.email,'you@example.com');assert.equal(data.identity.lastName,'Rivera');
 assert.ok((await send({type:'fm.mutate',op:'identity',key:'email',value:'poison'},page)).error,'content cannot write identity');
 await send({type:'fm.mutate',op:'settings',patch:{consented:true}});
 const state=await send({type:'fm.state'},page);assert.ok(state.state,'authorized page receives state');
 const learn={type:'fm.mutate',op:'learn',epoch:state.state.epoch,scope:'/form|id:entry',edits:[{info:{tag:'input',type:'email',name:'email',label:'Email'},value:'local@example.com'}]};
 assert.equal((await send(learn,page)).ok,true);
 assert.equal(data.identity.email,'you@example.com','page does not change global identity');
 assert.ok(data.sites['https://example.com'].forms[learn.scope].fields.length);
 const cross={...page,url:'https://other.com/form',origin:'https://other.com',frameId:2};
 assert.ok((await send(learn,cross)).error,'cross-origin denied');
 await send({type:'fm.mutate',op:'forget',origin:'https://example.com'});
 assert.ok((await send(learn,page)).error,'old epoch rejected');
 assert.equal(data.sites['https://example.com'],undefined);
 const backup=ctx.FM.createBackup(data);
 assert.equal(backup.format,'open-autofill');
 assert.throws(()=>ctx.FM.parseBackup({identity:{email:'bad'}}),'partial backup rejected');
 assert.throws(()=>ctx.FM.parseBackup({...backup,version:99}),'future backup rejected');
 assert.throws(()=>ctx.FM.parseBackup({...backup,state:{...backup.state,identity:{email:42}}}),'wrong nested types rejected');
 assert.ok((await send({type:'fm.mutate',op:'restore',backup})).error,'confirmation required');
 await send({type:'fm.mutate',op:'identity',key:'firstName',value:'Changed'});
 assert.equal((await send({type:'fm.mutate',op:'restore',backup,confirmed:true})).ok,true);
 assert.equal(data.identity.firstName,'Alex');
 assert.equal((await send({type:'fm.mutate',op:'undo',confirmed:true})).ok,true);
 assert.equal(data.identity.firstName,'Changed');
 console.log('storage automatic: authorized serialized identity, scoped learning, epochs, validated backup restore/undo passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
