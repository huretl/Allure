import './fonts.css';
import './style.css';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FIREBASE_CONFIG } from './firebase-config.js';

/* ---------- Utilitaires ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d)};
const today=()=>ymd(new Date());
const monday=s=>{const d=parseD(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const diffDays=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const DOW=['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'];
const MON=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const fmtDay=s=>{const d=parseD(s);return DOW[(d.getDay()+6)%7]+' '+d.getDate()+' '+MON[d.getMonth()]};
const fmtLong=s=>{const d=parseD(s);return fmtDay(s)+' '+d.getFullYear()};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone=o=>JSON.parse(JSON.stringify(o));
const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return isFinite(n)&&n>0?n:0};
const fmtKm=k=>(Math.round(k*100)/100).toString().replace('.',',')+' km';
function parseDur(v){v=String(v||'').trim().toLowerCase().replace(/\s/g,'');if(!v)return 0;
  if(v.includes('h')){const[h,m]=v.split('h');return (parseInt(h)||0)*3600+(parseInt(m)||0)*60}
  const p=v.split(/[:']/).map(x=>parseInt(x||'0',10));if(p.some(isNaN))return 0;
  if(p.length===1)return p[0]*60; if(p.length===2)return p[0]*60+p[1]; return p[0]*3600+p[1]*60+p[2]}
function fmtDur(s){s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${pad(m)}:${pad(x)}`:`${m}:${pad(x)}`}
function fmtDurS(s){s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;if(x)return fmtDur(s);return h?`${h}h${pad(m)}`:`${m} min`}
const fmtPace=sp=>{sp=Math.round(sp);return Math.floor(sp/60)+"'"+pad(sp%60)+'/km'};
const pace=(km,s)=>km&&s?fmtPace(s/km):'';
const ICON={
  run:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="4.3" r="2.3" fill="currentColor" stroke="none"/><path d="M8 21l3-6 3 2v5M6 12l3-4h4l2 4 3 1M11 15l-2-3"/></svg>',
  gym:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  race:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'};
const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const KIND={run:'Course à pied',gym:'Muscu / renfo',race:'Course officielle'};
const RTYPES=['Footing','Fractionné','Sortie longue','Seuil / tempo','Côtes','Récupération'];
const PRESETS={
  'Renfo coureur':[['Squat',3,'12',''],['Fentes',3,'10/jambe',''],['Pont fessier',3,'15',''],['Gainage',3,'45 s',''],['Gainage latéral',3,'30 s',''],['Mollets',3,'20','']],
  'Haut du corps':[['Pompes',4,'12',''],['Tractions',4,'6',''],['Développé haltères',4,'10',''],['Rowing haltère',4,'10',''],['Dips',3,'10','']],
  'Bas du corps':[['Squat',4,'8',''],['Soulevé de terre roumain',4,'8',''],['Fentes bulgares',3,'10',''],['Leg curl',3,'12',''],['Mollets',4,'15','']],
  'Full body':[['Squat',3,'10',''],['Pompes',3,'12',''],['Rowing',3,'10',''],['Fentes',3,'10',''],['Gainage',3,'45 s','']]};
const RDIST=[['5 km',5],['10 km',10],['Semi',21.097],['Marathon',42.195],['Trail',0]];

/* ---------- Données ---------- */
const S={items:{},tab:'plan',week:monday(today()),form:null,tmpRpe:null,timer:null,user:null};
const LS='allure.v1', LSET='allure.settings';
const SET=Object.assign({remindEve:true,remind1h:true},(()=>{try{return JSON.parse(localStorage.getItem(LSET)||'{}')}catch(e){return{}}})());
const saveSet=()=>{try{localStorage.setItem(LSET,JSON.stringify(SET))}catch(e){}};
try{S.items=JSON.parse(localStorage.getItem(LS)||'{}').items||{}}catch(e){}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify({items:S.items}))}catch(e){}}
function setSync(st,txt){const el=$('#sync');el.className='sync '+(st==='ok'?'ok':st==='warn'?'warn':'');el.querySelector('span').textContent=txt}

/* Base distante (Firebase) : active seulement si la config est renseignée */
const FB={on:!!FIREBASE_CONFIG,db:null,auth:null,mod:null,unsub:null};
function persist(it){it.updatedAt=Date.now();S.items[it.id]=it;saveLocal();render();schedule();
  if(FB.db&&S.user){const {doc,setDoc}=FB.mod.fs;setDoc(doc(FB.db,'users',S.user.uid,'items',it.id),clone(it)).catch(onWriteErr)}}
function removeItem(id){delete S.items[id];saveLocal();render();schedule();
  if(FB.db&&S.user){const {doc,deleteDoc}=FB.mod.fs;deleteDoc(doc(FB.db,'users',S.user.uid,'items',id)).catch(onWriteErr)}}
function onWriteErr(e){console.warn(e);setSync('warn','Erreur de synchro')}

async function initFirebase(){
  const [{initializeApp},fs,au]=await Promise.all([import('firebase/app'),import('firebase/firestore'),import('firebase/auth')]);
  FB.mod={fs,au};
  const app=initializeApp(FIREBASE_CONFIG);
  FB.db=fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentSingleTabManager()})});
  FB.auth=au.initializeAuth(app,{persistence:au.indexedDBLocalPersistence});
  au.onAuthStateChanged(FB.auth,u=>{S.user=u;if(FB.unsub){FB.unsub();FB.unsub=null}
    if(!u){showLogin();return}
    hideLogin();setSync('warn','Connexion…');
    const col=fs.collection(FB.db,'users',u.uid,'items');let first=true;
    FB.unsub=fs.onSnapshot(col,{includeMetadataChanges:true},snap=>{
      const cache=snap.metadata.fromCache;setSync(cache?'warn':'ok',cache?'Hors ligne':'Synchronisé');
      if(first&&!cache){first=false;
        const mk='allure.migrated.'+u.uid;let done=false;try{done=!!localStorage.getItem(mk)}catch(e){}
        if(!done){const remote=new Set(snap.docs.map(d=>d.id));Object.values(S.items).forEach(it=>{if(!remote.has(it.id))fs.setDoc(fs.doc(FB.db,'users',u.uid,'items',it.id),clone(it)).catch(onWriteErr)});
          try{localStorage.setItem(mk,'1')}catch(e){}return}}
      if(snap.empty&&cache)return;
      const m={};snap.docs.forEach(d=>m[d.id]=d.data());S.items=m;saveLocal();render();schedule();
    },err=>{console.warn(err);setSync('warn','Erreur de synchro')});
  });
}
const AUTHERR={'auth/invalid-email':'Adresse e-mail invalide.','auth/invalid-credential':'E-mail ou mot de passe incorrect.','auth/wrong-password':'E-mail ou mot de passe incorrect.','auth/user-not-found':'Aucun compte avec cet e-mail.','auth/email-already-in-use':'Un compte existe déjà avec cet e-mail.','auth/weak-password':'Mot de passe trop court (6 caractères minimum).','auth/network-request-failed':'Pas de connexion internet.','auth/too-many-requests':'Trop d’essais, réessaie dans quelques minutes.'};
function showLogin(){document.body.classList.add('out');$('#app').style.display='none';
  $('#login').innerHTML=`<div class="login"><div class="logo"><div class="mk">${ICON.run}</div><b>Allure</b></div>
  <div class="f"><label>E-mail</label><input id="l-mail" type="email" autocomplete="email" inputmode="email"></div>
  <div class="f"><label>Mot de passe</label><input id="l-pass" type="password" autocomplete="current-password"></div>
  <div class="err" id="l-err"></div>
  <button class="btn pri" data-act="login">Se connecter</button>
  <button class="btn sec" style="margin-top:8px" data-act="signup">Créer un compte</button>
  <button class="lnk" data-act="reset">Mot de passe oublié</button></div>`}
function hideLogin(){document.body.classList.remove('out');$('#app').style.display='';$('#login').innerHTML='';render()}
async function authDo(kind){const au=FB.mod.au,mail=$('#l-mail').value.trim(),pass=$('#l-pass').value,err=$('#l-err');err.textContent='';
  try{if(kind==='login')await au.signInWithEmailAndPassword(FB.auth,mail,pass);
    else if(kind==='signup')await au.createUserWithEmailAndPassword(FB.auth,mail,pass);
    else{await au.sendPasswordResetEmail(FB.auth,mail);err.style.color='var(--accink)';err.textContent='E-mail de réinitialisation envoyé.'}}
  catch(e){err.style.color='';err.textContent=AUTHERR[e.code]||'Erreur : '+(e.code||e.message)}}

/* ---------- Rappels (notifications locales) ---------- */
const NATIVE=Capacitor.isNativePlatform();
const hashId=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)%2000000000+1};
let schedT=null;
function schedule(){if(!NATIVE)return;clearTimeout(schedT);schedT=setTimeout(doSchedule,800)}
async function doSchedule(){
  try{
    const pend=await LocalNotifications.getPending();
    if(pend.notifications.length)await LocalNotifications.cancel({notifications:pend.notifications.map(n=>({id:n.id}))});
    if(!SET.remindEve&&!SET.remind1h)return;
    const now=Date.now(),lim=now+45*864e5,list=[];
    all().filter(i=>!i.done&&i.date>=today()).sort(sortIt).forEach(it=>{
      const d=parseD(it.date);
      if(SET.remindEve){const t=new Date(d);t.setDate(t.getDate()-1);t.setHours(20,0,0,0);
        if(+t>now&&+t<lim)list.push({id:hashId(it.id+'e'),title:(it.kind==='race'?'Course demain : ':'Demain : ')+it.title,body:sub(it)||KIND[it.kind],schedule:{at:t,allowWhileIdle:true},extra:{id:it.id}})}
      if(SET.remind1h&&it.time){const [h,m]=it.time.split(':').map(Number);const t=new Date(d);t.setHours(h,m,0,0);t.setTime(+t-3600e3);
        if(+t>now&&+t<lim)list.push({id:hashId(it.id+'h'),title:'Dans 1 h : '+it.title,body:sub(it)||KIND[it.kind],schedule:{at:t,allowWhileIdle:true},extra:{id:it.id}})}
    });
    if(!list.length)return;
    let p=await LocalNotifications.checkPermissions();
    if(p.display!=='granted')p=await LocalNotifications.requestPermissions();
    if(p.display!=='granted')return;
    await LocalNotifications.schedule({notifications:list.slice(0,60)});
  }catch(e){console.warn('rappels',e)}
}
function openSettings(){
  const sw=(k,t,d)=>`<div class="card sw" data-act="setsw" data-k="${k}"><div><b>${t}</b><small>${d}</small></div><span class="tg${SET[k]?' on':''}"></span></div>`;
  let h=`<div class="shh"><h2>Réglages</h2><button class="ib" data-act="close">×</button></div>
  <div class="micro" style="margin-bottom:8px">Rappels</div>
  ${sw('remindEve','La veille à 20 h','Pour chaque séance et course prévue')}
  ${sw('remind1h','1 h avant','Si une heure est renseignée')}
  ${NATIVE?'':'<div class="note">Les rappels fonctionnent dans l’appli Android.</div>'}
  <div class="micro" style="margin:18px 0 8px">Données</div>
  <div class="note">${FB.on?(S.user?'Connecté : '+esc(S.user.email)+'<br>Tes données sont synchronisées dans ton espace Firebase.':''):'Tes données sont enregistrées sur ce téléphone.'}</div>
  ${FB.on&&S.user?'<button class="btn sec" data-act="logout">Se déconnecter</button>':''}`;
  openSheet(h);
}

/* ---------- Calculs ---------- */
const all=()=>Object.values(S.items);
const sortIt=(a,b)=>(a.date+(a.time||'99')).localeCompare(b.date+(b.time||'99'));
const kmOf=it=>{if(it.kind==='run')return (it.result&&it.result.distKm)||it.run?.distKm||0;if(it.kind==='race')return (it.result&&it.result.distKm)||it.race?.distKm||0;return 0};
function sub(it){
  if(it.kind==='run'){const r=it.run||{};return [r.type!==it.title?r.type:'',r.distKm?fmtKm(r.distKm):'',r.durS?fmtDurS(r.durS):'',pace(r.distKm,r.durS),it.time].filter(Boolean).join(' · ')}
  if(it.kind==='gym'){const g=it.gym||{};const n=(g.ex||[]).length;const tot=(g.ex||[]).reduce((a,e)=>a+(e.sets||0),0),dn=(g.ex||[]).reduce((a,e)=>a+Math.min(e.done||0,e.sets||0),0);
    return [n+' exercice'+(n>1?'s':''),dn&&!it.done?dn+'/'+tot+' séries':'',g.durMin?g.durMin+' min':'',it.time].filter(Boolean).join(' · ')}
  const r=it.race||{};return [r.distKm?fmtKm(r.distKm):'Trail',r.place,it.done&&it.result?.timeS?fmtDur(it.result.timeS):(r.goalS?'obj. '+fmtDur(r.goalS):'')].filter(Boolean).join(' · ')}
function card(it){return `<div class="card it k-${it.kind}${it.done?' done':''}" data-act="open" data-id="${it.id}">
  <div class="ic">${ICON[it.kind]}</div><div class="tx"><div class="t">${esc(it.title)}</div><div class="s num">${esc(sub(it))}</div></div>
  <button class="chk${it.done?' on':''}" data-act="check" data-id="${it.id}" aria-label="Fait">${CHECK}</button></div>`}

/* ---------- Vues ---------- */
function render(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
  $('#ttl').textContent={plan:'Planning',races:'Courses',stats:'Bilan'}[S.tab];
  $('#main').innerHTML=S.tab==='plan'?vPlan():S.tab==='races'?vRaces():vStats();
}
function nextRace(){return all().filter(i=>i.kind==='race'&&!i.done&&i.date>=today()).sort(sortIt)[0]}
function heroRace(r){const d=diffDays(r.date,today());const g=r.race||{};
  return `<div class="card hero" data-act="open" data-id="${r.id}"><div class="cd num"><b>${d===0?'J':d}</b><span>${d===0?'Jour J':d===1?'jour':'jours'}</span></div>
  <div><div class="micro">Prochaine course</div><h3>${esc(r.title)}</h3><p class="num">${fmtDay(r.date)}${g.distKm?' · '+fmtKm(g.distKm):''}${g.goalS?' · obj. '+fmtDur(g.goalS)+(g.distKm?' ('+pace(g.distKm,g.goalS)+')':''):''}</p></div></div>`}
function vPlan(){
  const w=S.week,end=addDays(w,6),t=today();
  const d0=parseD(w),d6=parseD(end);
  const lbl=d0.getMonth()===d6.getMonth()?`${d0.getDate()} – ${d6.getDate()} ${MON[d6.getMonth()]}`:`${d0.getDate()} ${MON[d0.getMonth()]} – ${d6.getDate()} ${MON[d6.getMonth()]}`;
  const wk=all().filter(i=>i.date>=w&&i.date<=end);
  const kmP=wk.reduce((a,i)=>a+(i.kind==='run'?i.run?.distKm||0:i.kind==='race'?i.race?.distKm||0:0),0);
  const kmD=wk.filter(i=>i.done).reduce((a,i)=>a+kmOf(i),0);
  const nD=wk.filter(i=>i.done).length;
  const nGym=wk.filter(i=>i.kind==='gym'),nGymD=nGym.filter(i=>i.done).length;
  const nr=nextRace();
  let h=nr?heroRace(nr):'';
  h+=`<div class="weeknav"><button class="ib" data-act="wk" data-d="-1">‹</button><div class="lbl num">${lbl}</div>${w!==monday(t)?'<button class="pill" data-act="wk" data-d="0">Aujourd’hui</button>':''}<button class="ib" data-act="wk" data-d="1">›</button></div>`;
  h+=`<div class="stats">
    <div class="card stat"><div class="micro">Km</div><b class="num">${fmtKm(kmD).replace(' km','')}<small> / ${fmtKm(kmP).replace(' km','')}</small></b><div class="bar"><i style="width:${kmP?Math.min(100,kmD/kmP*100):0}%"></i></div></div>
    <div class="card stat"><div class="micro">Séances</div><b class="num">${nD}<small> / ${wk.length}</small></b><div class="bar"><i style="width:${wk.length?nD/wk.length*100:0}%"></i></div></div>
    <div class="card stat"><div class="micro">Muscu</div><b class="num">${nGymD}<small> / ${nGym.length}</small></b><div class="bar"><i style="width:${nGym.length?nGymD/nGym.length*100:0}%;background:var(--info)"></i></div></div></div>`;
  for(let k=0;k<7;k++){const d=addDays(w,k);const its=wk.filter(i=>i.date===d).sort(sortIt);
    h+=`<div class="day"><div class="dayh"><div class="d${d===t?' today':''}">${fmtDay(d)}</div><button class="add-s" data-act="add" data-date="${d}">+ Ajouter</button></div>
    ${its.length?its.map(card).join(''):'<div class="empty-day">Repos</div>'}</div>`}
  return h;
}
function vRaces(){
  const t=today();const rs=all().filter(i=>i.kind==='race');
  const up=rs.filter(r=>!r.done&&r.date>=t).sort(sortIt);
  const past=rs.filter(r=>r.done||r.date<t).sort((a,b)=>sortIt(b,a));
  let h=up.length?heroRace(up[0]):'';
  h+=`<button class="btn sec" data-act="add" data-kind="race">+ Ajouter une course officielle</button>`;
  h+=`<h2 class="sec micro">À venir · ${up.length}</h2>`;
  h+=up.length?up.map(r=>{const d=diffDays(r.date,t);const st=r.race?.status;
    return card(r).replace('<div class="s num">',`<div class="s num">${fmtDay(r.date)} · J-${d}${st?' · '+esc(st):''}<br>`)}).join(''):'<div class="card empty">Aucune course programmée.</div>';
  if(past.length){h+=`<h2 class="sec micro">Passées · ${past.length}</h2>`+past.map(card).join('')}
  return h;
}
function vStats(){
  const t=today(),mon=monday(t);
  const weeks=[];for(let k=9;k>=0;k--)weeks.push(addDays(mon,-7*k));
  const data=weeks.map(w=>{const e=addDays(w,6);const its=all().filter(i=>i.date>=w&&i.date<=e);
    return{w,done:its.filter(i=>i.done).reduce((a,i)=>a+kmOf(i),0),plan:its.reduce((a,i)=>a+(i.kind==='run'?i.run?.distKm||0:i.kind==='race'?i.race?.distKm||0:0),0)}});
  const mx=Math.max(10,...data.map(d=>Math.max(d.done,d.plan)));
  const W=320,H=150,bw=22,gap=(W-10*bw)/10;
  let bars='';data.forEach((d,i)=>{const x=gap/2+i*(bw+gap);const hp=d.plan/mx*110,hd=d.done/mx*110;const dd=parseD(d.w);
    bars+=`<rect x="${x}" y="${120-hp}" width="${bw}" height="${hp}" rx="4" fill="var(--s3)"/>`;
    bars+=`<rect x="${x}" y="${120-hd}" width="${bw}" height="${hd}" rx="4" fill="var(--acc)"/>`;
    if(d.done)bars+=`<text x="${x+bw/2}" y="${114-hd}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink2)">${Math.round(d.done)}</text>`;
    bars+=`<text x="${x+bw/2}" y="140" text-anchor="middle" font-size="9" fill="var(--ink3)">${dd.getDate()}/${dd.getMonth()+1}</text>`});
  const m0=t.slice(0,8)+'01',y0=t.slice(0,5)+'01-01';
  const doneM=all().filter(i=>i.done&&i.date>=m0&&i.date<=t),doneY=all().filter(i=>i.done&&i.date>=y0&&i.date<=t);
  const kmM=doneM.reduce((a,i)=>a+kmOf(i),0),kmY=doneY.reduce((a,i)=>a+kmOf(i),0);
  const runs=doneM.filter(i=>i.kind==='run'),gyms=doneM.filter(i=>i.kind==='gym'),races=doneY.filter(i=>i.kind==='race');
  const late=all().filter(i=>!i.done&&i.date<t&&i.date>=addDays(t,-28)).length;
  const byType={};runs.forEach(r=>{const k=r.run?.type||'Course';byType[k]=(byType[k]||0)+1});
  return `<div class="stats">
    <div class="card stat"><div class="micro">Km · mois</div><b class="num">${fmtKm(kmM).replace(' km','')}</b></div>
    <div class="card stat"><div class="micro">Km · ${t.slice(0,4)}</div><b class="num">${fmtKm(kmY).replace(' km','')}</b></div>
    <div class="card stat"><div class="micro">Courses · ${t.slice(0,4)}</div><b class="num">${races.length}</b></div></div>
  <div class="card chart"><div class="micro" style="margin-bottom:8px">Km par semaine · 10 semaines</div>
    <svg viewBox="0 0 ${W} ${H}">${bars}<line x1="0" x2="${W}" y1="120.5" y2="120.5" stroke="var(--line)"/></svg>
    <div class="legend"><span><i style="background:var(--acc)"></i>Fait</span><span><i style="background:var(--s3)"></i>Prévu</span></div></div>
  <h2 class="sec micro">Ce mois-ci</h2>
  <div class="card mix">
    <div class="r k-run"><i class="dot"></i><span>Sorties course à pied</span><b class="num">${runs.length}</b></div>
    ${Object.entries(byType).map(([k,v])=>`<div class="r" style="padding-left:20px"><span>${esc(k)}</span><b class="num">${v}</b></div>`).join('')}
    <div class="r k-gym"><i class="dot"></i><span>Séances muscu / renfo</span><b class="num">${gyms.length}</b></div>
    <div class="r"><i class="dot" style="--k:var(--sur)"></i><span>Séances manquées (4 sem.)</span><b class="num">${late}</b></div>
  </div>`;
}

/* ---------- Feuilles ---------- */
function openSheet(html){const s=$('#sheet');s.innerHTML='<div class="grab"></div>'+html;s.scrollTop=0;s.classList.add('on');$('#scrim').classList.add('on')}
function closeSheet(){$('#sheet').classList.remove('on');$('#scrim').classList.remove('on');S.form=null}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}

function openForm(it,kind,date){
  const isNew=!it;
  it=it?clone(it):{id:uid(),kind,date:date||today(),time:'',notes:'',done:false};
  if(!it.run)it.run={type:'Footing'};if(!it.gym)it.gym={focus:'',ex:[]};if(!it.race)it.race={status:'Inscrit'};
  S.form={it,isNew};renderForm();
}
function renderForm(){
  const {it,isNew}=S.form;const k=it.kind;
  let h=`<div class="shh"><h2>${isNew?'Nouvelle séance':'Modifier'}</h2><button class="ib" data-act="close">×</button></div>`;
  if(isNew)h+=`<div class="seg">${Object.keys(KIND).map(x=>`<button class="k-${x}${x===k?' on':''}" data-act="fkind" data-kind="${x}">${KIND[x]}</button>`).join('')}</div>`;
  h+=`<form id="f" onsubmit="return false">`;
  if(k==='race')h+=`<div class="f"><label>Nom de la course</label><input id="f-name" value="${esc(it.title||'')}" placeholder="Ex. 10 km de Lille"></div>`;
  h+=`<div class="row"><div class="f"><label>Date</label><input type="date" id="f-date" value="${it.date}"></div><div class="f"><label>Heure</label><input type="time" id="f-time" value="${it.time||''}"></div></div>`;
  if(k==='run'){const r=it.run;
    h+=`<div class="f"><label>Type de sortie</label><div class="chips" id="rtypes">${RTYPES.map(x=>`<button class="chip${x===r.type?' on':''}" data-act="rtype" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="row"><div class="f"><label>Distance (km)</label><input id="f-dist" inputmode="decimal" value="${r.distKm?String(r.distKm).replace('.',','):''}" placeholder="10"></div>
    <div class="f"><label>Durée (min ou h:mm)</label><input id="f-dur" inputmode="numeric" value="${r.durS?fmtDur(r.durS):''}" placeholder="50"></div></div>
    <div class="out num" id="f-pace"></div>
    <div class="f"><label>Contenu de la séance</label><input id="f-struct" value="${esc(r.struct||'')}" placeholder="Ex. 15' échauffement + 10×400 m r=1' + 10' retour au calme"></div>`}
  if(k==='gym'){const g=it.gym;
    h+=`<div class="f"><label>Séance</label><input id="f-focus" value="${esc(g.focus||'')}" placeholder="Ex. Haut du corps"></div>
    <div class="f"><label>Modèles</label><div class="chips">${Object.keys(PRESETS).map(x=>`<button class="chip" data-act="preset" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="f"><label>Exercices</label><div class="exhead"><span>Exercice</span><span>Séries</span><span>Répét.</span><span>Charge</span><span></span></div><div id="exs">${(g.ex||[]).map(exRow).join('')}</div>
    <button class="btn sec" style="height:42px" data-act="exadd">+ Exercice</button></div>
    <div class="f"><label>Durée estimée (min)</label><input id="f-gdur" inputmode="numeric" value="${g.durMin||''}" placeholder="45"></div>`}
  if(k==='race'){const r=it.race;
    h+=`<div class="f"><label>Lieu</label><input id="f-place" value="${esc(r.place||'')}" placeholder="Ville"></div>
    <div class="f"><label>Distance</label><div class="chips" style="margin-bottom:6px">${RDIST.map(([l,v])=>`<button class="chip${(v&&Math.abs((r.distKm||0)-v)<.01)||(!v&&r.trail)?' on':''}" data-act="rdist" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="row"><input id="f-dist" inputmode="decimal" value="${r.distKm?String(r.distKm).replace('.',','):''}" placeholder="Distance (km)"><input id="f-elev" inputmode="numeric" value="${r.elev||''}" placeholder="D+ (m)"></div></div>
    <div class="row"><div class="f"><label>Objectif (h:mm:ss)</label><input id="f-goal" inputmode="numeric" value="${r.goalS?fmtDur(r.goalS):''}" placeholder="45:00"></div>
    <div class="f"><label>Statut</label><select id="f-status">${['Inscrit','À s’inscrire','Intéressé'].map(x=>`<option${x===r.status?' selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="out num" id="f-pace"></div>
    <div class="row"><div class="f"><label>Dossard</label><input id="f-bib" value="${esc(r.bib||'')}"></div><div class="f"><label>Retrait dossard</label><input id="f-pick" value="${esc(r.pick||'')}" placeholder="Ex. sam. 14h"></div></div>
    <div class="f"><label>Lien (inscription, infos)</label><input id="f-url" type="url" value="${esc(r.url||'')}" placeholder="https://"></div>`}
  h+=`<div class="f"><label>Notes</label><textarea id="f-notes" placeholder="${k==='race'?'Parcours, ravitos, accès…':'Ressenti, consignes…'}">${esc(it.notes||'')}</textarea></div>
  <div class="err" id="f-err"></div></form><button class="btn pri" data-act="save">Enregistrer</button>`;
  openSheet(h);updPace();
}
const exRow=e=>`<div class="exrow"><input class="ex-n" value="${esc(e.name||'')}" placeholder="Exercice"><input class="ex-s" inputmode="numeric" value="${e.sets||''}" placeholder="3"><input class="ex-r" value="${esc(e.reps||'')}" placeholder="10"><input class="ex-l" value="${esc(e.load||'')}" placeholder="kg"><button class="x" data-act="exdel">×</button></div>`;
function updPace(){const o=$('#f-pace');if(!o||!S.form)return;const d=num($('#f-dist')?.value);
  const s=S.form.it.kind==='race'?parseDur($('#f-goal')?.value):parseDur($('#f-dur')?.value);
  o.textContent=d&&s?(S.form.it.kind==='race'?'Allure objectif ':'Allure ')+fmtPace(s/d)+' · '+(d/(s/3600)).toFixed(1).replace('.',',')+' km/h':''}
function readForm(){const it=S.form.it,k=it.kind,v=id=>($('#'+id)?.value??'').trim();
  it.date=v('f-date')||it.date;it.time=v('f-time');it.notes=v('f-notes');
  if(k==='run'){it.run.distKm=num(v('f-dist'));it.run.durS=parseDur(v('f-dur'));it.run.struct=v('f-struct')}
  if(k==='gym'){it.gym.focus=v('f-focus');it.gym.durMin=parseInt(v('f-gdur'))||0;
    const old=it.gym.ex||[];it.gym.ex=[...document.querySelectorAll('#exs .exrow')].map((r,i)=>({name:r.querySelector('.ex-n').value.trim(),sets:parseInt(r.querySelector('.ex-s').value)||0,reps:r.querySelector('.ex-r').value.trim(),load:r.querySelector('.ex-l').value.trim(),done:old[i]?.done||0})).filter(e=>e.name)}
  if(k==='race'){it.title=v('f-name');Object.assign(it.race,{place:v('f-place'),distKm:num(v('f-dist')),elev:parseInt(v('f-elev'))||0,goalS:parseDur(v('f-goal')),status:v('f-status'),bib:v('f-bib'),pick:v('f-pick'),url:v('f-url')})}
}
function saveForm(){readForm();const it=S.form.it;
  if(!it.date){$('#f-err').textContent='Choisis une date.';return}
  if(it.kind==='race'&&!it.title){$('#f-err').textContent='Donne un nom à la course.';return}
  if(it.kind==='run')it.title=it.run.type||'Course à pied';
  if(it.kind==='gym')it.title=it.gym.focus||'Muscu / renfo';
  const out=clone(it);if(out.kind!=='run')delete out.run;if(out.kind!=='gym')delete out.gym;if(out.kind!=='race')delete out.race;
  const wasNew=S.form.isNew;persist(out);
  if(wasNew&&out.date){S.week=monday(out.date)}
  openDetail(out.id);toast(wasNew?'Séance ajoutée':'Modifications enregistrées');render();
}

function openDetail(id){const it=S.items[id];if(!it){closeSheet();return}S.form=null;S.tmpRpe=it.result?.rpe||null;
  let h=`<div class="shh"><div><div class="micro" style="color:var(--k)" >${KIND[it.kind]}</div><h2>${esc(it.title)}</h2></div><button class="ib" data-act="close">×</button></div>`;
  const when=fmtLong(it.date)+(it.time?' · '+it.time:'');
  if(it.kind==='race'){const r=it.race||{};const d=diffDays(it.date,today());
    h+=`<div class="racehead"><div class="cd" style="min-width:84px;height:84px;border-radius:14px;background:var(--attbg);color:var(--att);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="big num">${it.done?'✓':d<0?'—':d===0?'J':d}</span><span style="font-size:12px;font-weight:600">${it.done?'terminée':d<0?'passée':d===0?'Jour J':d===1?'jour':'jours'}</span></div>
      <div><div class="num" style="font-weight:600">${when}</div><div style="color:var(--ink3);font-size:14px">${[r.place,r.status].filter(Boolean).map(esc).join(' · ')}</div></div></div>
    <div class="kv num"><div><span class="micro">Distance</span><b>${r.distKm?fmtKm(r.distKm):'—'}</b></div><div><span class="micro">Objectif</span><b>${r.goalS?fmtDur(r.goalS):'—'}</b></div><div><span class="micro">Allure</span><b>${pace(r.distKm,r.goalS).replace('/km','')||'—'}</b></div></div>`;
    if(r.elev||r.bib||r.pick)h+=`<div class="kv num">${r.elev?`<div><span class="micro">D+</span><b>${r.elev} m</b></div>`:''}${r.bib?`<div><span class="micro">Dossard</span><b>${esc(r.bib)}</b></div>`:''}${r.pick?`<div><span class="micro">Retrait</span><b style="font-size:14px">${esc(r.pick)}</b></div>`:''}</div>`;
    if(r.url)h+=`<div class="note"><a class="link" href="${esc(/^https?:\/\//.test(r.url)?r.url:'https://'+r.url)}" ${NATIVE?'':'target="_blank" rel="noopener"'}>${esc(r.url)}</a></div>`;
  } else {
    h+=`<div class="num" style="color:var(--ink2);margin:-6px 0 14px;font-weight:500">${when}</div>`;
  }
  if(it.kind==='run'){const r=it.run||{};
    h+=`<div class="kv num"><div><span class="micro">Distance</span><b>${r.distKm?fmtKm(r.distKm):'—'}</b></div><div><span class="micro">Durée</span><b>${r.durS?fmtDurS(r.durS):'—'}</b></div><div><span class="micro">Allure</span><b>${pace(r.distKm,r.durS).replace('/km','')||'—'}</b></div></div>`;
    if(r.struct)h+=`<div class="note">${esc(r.struct)}</div>`}
  if(it.kind==='gym'){const g=it.gym||{};
    h+=`<div class="micro" style="margin-bottom:8px">Repos</div><div class="rest">${[60,90,120,180].map(s=>`<button class="chip" data-act="rest" data-s="${s}">${fmtDur(s)}</button>`).join('')}</div>`;
    h+=(g.ex||[]).map((e,i)=>`<div class="card ex"><div class="h"><b>${esc(e.name)}</b><span class="num">${e.sets||'?'} × ${esc(e.reps||'?')}${e.load?' · '+esc(e.load)+(/^\d+([.,]\d+)?$/.test(e.load)?' kg':''):''}</span></div>
      <div class="sets">${Array.from({length:e.sets||0},(_,n)=>`<button class="set num${n<(e.done||0)?' on':''}" data-act="set" data-id="${it.id}" data-ex="${i}" data-n="${n+1}">${n+1}</button>`).join('')}</div></div>`).join('')||'<div class="note">Aucun exercice. Modifie la séance pour en ajouter.</div>'}
  if(it.notes)h+=`<div class="note">${esc(it.notes)}</div>`;
  h+=`<div class="card toggle" data-act="check" data-id="${it.id}"><b>${it.done?'Séance faite':'Marquer comme faite'}</b><span class="chk${it.done?' on':''}">${CHECK}</span></div>`;
  if(it.done&&it.kind!=='gym'){const rs=it.result||{};
    h+=`<div class="micro" style="margin-bottom:8px">Résultat</div>
    <div class="row"><div class="f"><label>Distance réelle (km)</label><input id="r-dist" inputmode="decimal" value="${rs.distKm?String(rs.distKm).replace('.',','):''}" placeholder="${(it.run?.distKm||it.race?.distKm||'')}"></div>
    <div class="f"><label>${it.kind==='race'?'Chrono officiel':'Temps'}</label><input id="r-time" inputmode="numeric" value="${rs.timeS?fmtDur(rs.timeS):''}" placeholder="h:mm:ss"></div></div>
    ${it.kind==='race'?`<div class="f"><label>Classement</label><input id="r-rank" value="${esc(rs.rank||'')}" placeholder="Ex. 312 / 2400"></div>`:''}
    <div class="f"><label>Ressenti (1 facile → 10 à fond)</label><div class="rpe">${Array.from({length:10},(_,n)=>`<button class="num${S.tmpRpe===n+1?' on':''}" data-act="rpe" data-v="${n+1}">${n+1}</button>`).join('')}</div></div>
    <button class="btn sec" data-act="saveres" data-id="${it.id}">Enregistrer le résultat</button>`;
    if(rs.timeS&&(rs.distKm||kmOf(it)))h+=`<div class="out num" style="margin-top:8px">Allure réelle ${pace(rs.distKm||kmOf(it),rs.timeS)}${it.kind==='race'&&it.race?.goalS?(rs.timeS<=it.race.goalS?' · objectif atteint 🎯':' · '+fmtDur(rs.timeS-it.race.goalS)+' au-dessus de l’objectif'):''}</div>`}
  h+=`<div class="btns" style="margin-top:16px"><button class="btn sec" data-act="edit" data-id="${it.id}">Modifier</button><button class="btn sec" data-act="dup" data-id="${it.id}">Dupliquer</button></div>`;
  if(it.kind!=='race')h+=`<div class="row" style="margin-top:8px;align-items:center"><select id="rep-n">${Array.from({length:12},(_,n)=>`<option value="${n+1}">${n+1} semaine${n?'s':''}</option>`).join('')}</select><button class="btn sec" data-act="repeat" data-id="${it.id}">Répéter chaque semaine</button></div>`;
  h+=`<button class="btn dan" style="margin-top:8px" data-act="del">Supprimer</button><div class="confirm btns" id="cf"><button class="btn sec" data-act="delno">Annuler</button><button class="btn dan" data-act="delyes" data-id="${it.id}">Confirmer</button></div>`;
  openSheet(h);$('#sheet').className='sheet on k-'+it.kind;
}
function copyOf(it,date){const c=clone(it);c.id=uid();c.date=date;c.done=false;delete c.result;if(c.gym)c.gym.ex=(c.gym.ex||[]).map(e=>({...e,done:0}));return c}

/* ---------- Minuteur de repos ---------- */
function startTimer(s){stopTimer();S.timer={end:Date.now()+s*1000};S.timer.iv=setInterval(tick,250);tick()}
function stopTimer(){if(S.timer)clearInterval(S.timer.iv);S.timer=null;$('#timerBox').innerHTML=''}
function tick(){if(!S.timer)return;const left=Math.ceil((S.timer.end-Date.now())/1000);
  if(left<=0){$('#timerBox').innerHTML=`<div class="timer end">C’est reparti !<button data-act="tstop">OK</button></div>`;clearInterval(S.timer.iv);try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(e){}return}
  $('#timerBox').innerHTML=`<div class="timer num">${fmtDur(left)}<button data-act="tadd">+30 s</button><button data-act="tstop">Stop</button></div>`}

/* ---------- Actions ---------- */
const ACT={
  tab:el=>{S.tab=el.dataset.tab;render();window.scrollTo(0,0)},
  wk:el=>{const d=+el.dataset.d;S.week=d?addDays(S.week,7*d):monday(today());render()},
  add:el=>openForm(null,el.dataset.kind||(S.tab==='races'?'race':'run'),el.dataset.date||(S.tab==='plan'&&S.week!==monday(today())?S.week:today())),
  open:(el,id)=>openDetail(id),
  check:(el,id,e)=>{e.stopPropagation();const it=clone(S.items[id]);it.done=!it.done;persist(it);if($('#sheet').classList.contains('on')&&!S.form)openDetail(id);else if(it.done)toast('Bien joué 💪')},
  close:()=>closeSheet(),
  fkind:el=>{readForm();S.form.it.kind=el.dataset.kind;renderForm()},
  rtype:el=>{S.form.it.run.type=el.dataset.v;document.querySelectorAll('#rtypes .chip').forEach(c=>c.classList.toggle('on',c===el))},
  rdist:el=>{const v=+el.dataset.v;el.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===el));S.form.it.race.trail=!v;if(v)$('#f-dist').value=String(v).replace('.',',');else $('#f-dist').focus();updPace()},
  preset:el=>{const p=PRESETS[el.dataset.v];if(!$('#f-focus').value)$('#f-focus').value=el.dataset.v;$('#exs').innerHTML=p.map(([name,sets,reps,load])=>exRow({name,sets,reps,load})).join('')},
  exadd:()=>{$('#exs').insertAdjacentHTML('beforeend',exRow({}));const r=$('#exs').lastElementChild;r.querySelector('input').focus()},
  exdel:el=>el.closest('.exrow').remove(),
  save:()=>saveForm(),
  edit:(el,id)=>openForm(S.items[id]),
  set:el=>{const it=clone(S.items[el.dataset.id]);const e=it.gym.ex[+el.dataset.ex];const n=+el.dataset.n;e.done=(e.done||0)>=n?n-1:n;
    const allDone=it.gym.ex.every(x=>(x.done||0)>=(x.sets||0));if(allDone&&!it.done){it.done=true;toast('Séance terminée 💪')}
    persist(it);openDetail(it.id)},
  rest:el=>startTimer(+el.dataset.s),
  tadd:()=>{if(S.timer){S.timer.end+=30000;tick()}},
  tstop:()=>stopTimer(),
  rpe:el=>{S.tmpRpe=+el.dataset.v;el.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===el))},
  saveres:(el,id)=>{const it=clone(S.items[id]);it.result={distKm:num($('#r-dist').value),timeS:parseDur($('#r-time').value),rpe:S.tmpRpe||null};
    if($('#r-rank'))it.result.rank=$('#r-rank').value.trim();persist(it);openDetail(id);toast('Résultat enregistré')},
  dup:(el,id)=>{const c=copyOf(S.items[id],S.items[id].date);persist(c);openForm(S.items[c.id]);S.form.isNew=false;renderForm();toast('Copie créée : choisis sa date')},
  repeat:(el,id)=>{const n=+$('#rep-n').value;const it=S.items[id];for(let k=1;k<=n;k++)persist(copyOf(it,addDays(it.date,7*k)));toast(n+' séance'+(n>1?'s':'')+' ajoutée'+(n>1?'s':''))},
  del:()=>$('#cf').classList.add('on'),
  delno:()=>$('#cf').classList.remove('on'),
  delyes:(el,id)=>{removeItem(id);closeSheet();toast('Supprimé')},
  settings:()=>openSettings(),
  setsw:el=>{const k=el.dataset.k;SET[k]=!SET[k];saveSet();el.querySelector('.tg').classList.toggle('on',SET[k]);if(NATIVE){clearTimeout(schedT);doSchedule()}},
  login:()=>authDo('login'),signup:()=>authDo('signup'),reset:()=>authDo('reset'),
  logout:()=>{closeSheet();FB.mod.au.signOut(FB.auth);S.items={};saveLocal()},
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act;if(ACT[a]){e.preventDefault();ACT[a](el,el.dataset.id,e)}});
document.addEventListener('input',e=>{if(e.target.closest('#f'))updPace()});
render();

/* ---------- Démarrage ---------- */
function applyBars(){if(!NATIVE)return;const dark=!matchMedia('(prefers-color-scheme: light)').matches;
  SystemBars.setStyle({style:dark?SystemBarsStyle.Dark:SystemBarsStyle.Light}).catch(()=>{})}
if(NATIVE){
  applyBars();matchMedia('(prefers-color-scheme: light)').addEventListener('change',applyBars);
  App.addListener('backButton',()=>{
    if(S.timer){stopTimer();return}
    if($('#sheet').classList.contains('on')){closeSheet();return}
    if(S.tab!=='plan'){S.tab='plan';render();return}
    App.exitApp()});
  App.addListener('resume',()=>render());
  LocalNotifications.addListener('localNotificationActionPerformed',a=>{const id=a.notification?.extra?.id;if(id&&S.items[id]){S.tab='plan';S.week=monday(S.items[id].date);render();openDetail(id)}});
}
document.body.classList.remove('boot');
if(FB.on){setSync('warn','Connexion…');initFirebase().catch(e=>{console.warn(e);setSync('','Sur le téléphone')})}
else setSync('','Sur le téléphone');
schedule();
