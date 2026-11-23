/*************************************************************************
 * EAS CC — Backend (Code.gs) · v5
 * Arquitectura un sol Sheet: tots els mòduls estan dins el Sheet principal.
 *   Pestanyes per mòdul: "{codi} Org" · "{codi} A/B/C" · "{codi} Resum A/B/C" · "{codi} Act"
 *   Ex. per al mòdul 1139: "1139 Org", "1139 A", "1139 Resum A", "1139 Act"
 *
 * El full PRINCIPAL guarda: Usuaris, Mòduls, Activitats -> Indicadors, Indicadors.
 *
 * Regles: cap variable global amb SpreadsheetApp; password com a text;
 * tot a String() en llegir; router únic + ping.
 *************************************************************************/

/* ============================ CONFIG ============================ */
var CONFIG = {
  app: { name:'EAS CC', logo:'CC' },
  sheets: {
    usuaris:    { name:'Usuaris', headerRow:1 },
    moduls:     { name:'Mòduls', headerRow:1 },
    actInd:     { name:'Activitats -> Indicadors', headerRow:1 },
    indicadors: { name:'Indicadors', headerRow:1 },
    avisos:     { name:'Avisos', headerRow:1 }
  },
  cols: {
    usuaris:   { id:'id', nom:'nom', cognom:'cognom', correu:'correu corporatiu',
                 username:'username', password:'password', rol:'rol', classe:'classe', moduls:'mòdul', pendents:'pendents', noMat:'no matriculat', desdoblaments:'desdoblaments', resetRequest:'reset request', resets:'resets', pwdTemp:'pwd_temp', pwdTempTs:'pwd_temp_ts', avisosLlegits:'avisos_llegits' },
    moduls:    { codi:'Codi', nom:'Mòdul', curs:'Curs', sheetId:'ID' },
    actInd:    { activitat:'Activitat', capacitat:'Capacitats Clau', indicador:'Indicadors', codi:'Codi Indicador', color:'Codi color', paraules:'paraules clau' },
    indicadors:{ codi:'codi', capacitatId:'capacitatId', capacitat:'capacitat', requisit:'requisit', text:'indicador_SABER_FER', colorCap:'colorCapacitat', colorInd:'colorIndicador' }
  },
  // Geometria del Sheet de mòdul
  modAct: 'Activitats Mòdul',
  modTab: { ORG:'Organització Mòdul', titleRow:1, rProj:4, rAct:5, rCap:6, rInd:7, rosterRow:8, blockCol:4, numCol:1, nomCol:2, cogCol:3 },
  resTab: { rTitle:4, rCap:6, rHeader:8, rosterRow:9, notaCol:4, moduleCol:6, capsPerBlock:7, gap:2 },
  // colors de NOTA (fons de cel·la)
  notaFill: { '1':'E25563', '4':'E0A23C', '7':'4F8EF7', '10':'3FB27F', 'NA':'D9D9D9' }
};

var CAPS = ['c1','c2','c3','c4','c5','c6','c7'];
var CAP_COLORS = { c1:'B4A7D6', c2:'FFE599', c3:'A4C2F4', c4:'B6D7A8', c5:'A2C4C9', c6:'F9CB9C', c7:'EA9999' };
var CAP_SOFT   = { c1:'D9D2E9', c2:'FFF2CC', c3:'C9DAF8', c4:'D9EAD3', c5:'D0E0E3', c6:'FCE5CD', c7:'F4CCCC' };
// Versions suaus (pastel) dels colors de nota, per al format de Sheets
var NOTA_SOFT  = { '1':'F5C0C5', '4':'FCE8BC', '7':'C5D8F7', '10':'B3DDD1', 'NA':'EBEBEB' };
// Ordre i noms tal com apareixen al Resum de la plantilla
var RESUM_CAPS = ['c1','c3','c5','c4','c2','c6','c7'];
var RESUM_NOMS = { c1:'Organització', c3:'Responsabilitat', c5:'Treball equip', c4:'Autonomia', c2:'Iniciativa', c6:'Relacions personals', c7:'Resolució de problemes' };
var CAP_NOMS = { c1:'Organització del treball', c2:'Iniciativa', c3:'Responsabilitat en el treball', c4:'Autonomia', c5:'Treball en equip', c6:'Relacions interpersonals', c7:'Resolució de problemes' };

/* ========================= CACHÉ ========================= */
var CACHE_TTL = { indicadors:21600, actInd:3600, moduls:3600, usuaris:300 };
function getCached_(key, ttl, buildFn) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch(e) {} }
  var data = buildFn();
  try { cache.put(key, JSON.stringify(data), ttl); } catch(e) {}
  return data;
}
function bust_(key) { try { CacheService.getScriptCache().remove(key); } catch(e) {} }
function readMainCached_(k) {
  return getCached_('sh_'+k, CACHE_TTL[k]||300, function(){ return readMain_(k); });
}
function bustMain_(k) { bust_('sh_'+k); }


/* ====================== ENTRADA + ROUTER ====================== */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.app.name + ' — Registre d\'evidències')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result = handleRequest(String(data.action || ''), data.payload || {});
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err && err.message ? err.message : err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function handleRequest(action, payload) {
  payload = payload || {};
  try {
    switch (action) {
      case 'ping':                  return { ok:true, msg:'pong' };
      case 'loginAndInit':          var li_=loginAndInit_(payload); return { ok:true, user:li_.user, initialData:li_.initialData, avisos:li_.avisos||[] };
      case 'getInitialData':        return { ok:true, initialData: getInitialData_(payload) };
      case 'login':                 return { ok:true, user: loginUser_(payload) };
      case 'getCourses':            return { ok:true, courses: getCourses_(payload) };
      case 'getModules':            return { ok:true, modules: getModules_(payload) };
      case 'getClasses':            return { ok:true, classes: getClasses_(payload) };
      case 'getProjects':           return { ok:true, projects: getProjects_(payload) };
      case 'getActivityTypes':      return { ok:true, types: getActivityTypes_(payload) };
      case 'getActivityIndicators': var ai_=getActivityIndicators_(payload); return { ok:true, indicators: ai_.indicators };
      case 'getCapabilities':       return { ok:true, caps: getCapabilities_() };
      case 'saveActivity':          return { ok:true, result: saveActivity_(payload) };
      case 'getStudents':           return { ok:true, data: getStudents_(payload) };
      case 'saveRegistre':          return { ok:true, result: saveRegistre_(payload) };
      case 'getEvidencies':         return { ok:true, registres: getEvidencies_(payload) };
      case 'getBlockDetail':        return { ok:true, data: getBlockDetail_(payload) };
      case 'deleteRegistre':        return { ok:true, deleted: deleteRegistre_(payload) };
      case 'getModuleResum':        return { ok:true, data: getModuleResum_(payload) };
      case 'getAlumneGlobalResum':  return { ok:true, data: getAlumneGlobalResum_(payload) };
      case 'getClassGlobalResum':  return { ok:true, data: getClassGlobalResum_(payload) };
      case 'generateBuidatgeSheet': return { ok:true, url: generateBuidatgeSheet_(payload) };
      case 'getInici':              return { ok:true, data: getInici_(payload) };
      // gestió de projectes
      case 'listProjects':          return { ok:true, projects: listProjects_(payload) };
      case 'saveProject':           return { ok:true, result: saveProject_(payload) };
      case 'deleteProject':         return { ok:true, deleted: deleteProject_(payload) };
      case 'getAllProfs':           return { ok:true, profs: getAllProfs_() };
      case 'listModuleActivities':  return { ok:true, activities: listModuleActivities_(payload) };
      case 'deleteActivity':        return { ok:true, deleted: deleteActivity_(payload) };
      // admin: usuaris
      case 'getAdminUsers':         return { ok:true, data: getAdminUsers_() };
      case 'deleteUser':            return { ok:true, done: deleteUser_(payload) };
      case 'editUser':              return { ok:true, done: editUser_(payload) };
      case 'getClassesConfig':      return { ok:true, config: readClassesConfig_() };
      case 'saveClassesConfig':     return { ok:true, done: saveClassesConfig_(payload) };
      case 'getExemplesConfig':     var _ec=readExemplesConfig_(); return Object.assign({ok:true},_ec);
      case 'saveExemplesConfig':    return { ok:true, done: saveExemplesConfig_(payload) };
      case 'getAlumneHistorial':    return { ok:true, data: getAlumneHistorial_(payload) };
      case 'resetPassword':         return { ok:true, done: resetPassword_(payload) };
      case 'changePassword':        return { ok:true, done: changePassword_(payload) };
      case 'requestPasswordReset':  return { ok:true, done: requestPasswordReset_(payload) };
      case 'saveAvis':              return { ok:true, done: saveAvis_(payload) };
      case 'getAvisos':             return { ok:true, avisos: getAvisos_(payload) };
      case 'markAvisosLlegits':     return { ok:true, done: markAvisosLlegits_(payload) };
      // admin: desdoblaments
      case 'checkModulGrups':       return { ok:true, data: checkModulGrups_(payload) };
      case 'getDesdoblaments':      return { ok:true, data: getDesdoblaments_(payload) };
      case 'saveDesdoblaments':     return { ok:true, done: saveDesdoblaments_(payload) };
      // admin: catàleg d'activitats
      case 'getModulesAll':         return { ok:true, modules: getModulesAll_() };
      case 'listCatalogActivities': return { ok:true, activities: listCatalogActivities_() };
      case 'saveCatalogActivity':   return { ok:true, result: saveCatalogActivity_(payload) };
      case 'deleteCatalogActivity': return { ok:true, deleted: deleteCatalogActivity_(payload) };
      default: return { ok:false, error:'Acció desconeguda: ' + action };
    }
  } catch (err) { return { ok:false, error:String(err && err.message ? err.message : err) }; }
}

/* ======================= HELPERS ======================= */
function getSS_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function readRows_(ss, name, headerRow) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('No existeix el full "' + name + '".');
  var values = sh.getDataRange().getValues();
  if (values.length < headerRow) return { headers:[], rows:[] };
  var headers = values[headerRow-1].map(function(h){return String(h).trim();});
  var rows = [];
  for (var i=headerRow;i<values.length;i++){
    var o={},empty=true;
    for (var j=0;j<headers.length;j++){ var v=String(values[i][j]==null?'':values[i][j]); o[headers[j]]=v; if(v!=='')empty=false; }
    o.__row=i+1; if(!empty) rows.push(o);
  }
  return { headers:headers, rows:rows };
}
function readMain_(k){ var c=CONFIG.sheets[k]; return readRows_(getSS_(), c.name, c.headerRow); }
function normVal_(v){ return String(v==null?'':v).replace(/\.0$/,'').trim(); }
function colIndex_(h,n){ for(var i=0;i<h.length;i++){ if(String(h[i]).trim()===n) return i+1; } return -1; }
function capOf_(ind){ return String(ind).split('.')[0]; }
function letterOf_(classe){ classe=String(classe); return classe.charAt(classe.length-1).toUpperCase(); }
function modTabName_(codi, suffix){ return String(codi)+' '+suffix; }

/* obre el Sheet d'un mòdul pel Codi — arquitectura un sol Sheet */
function moduleRow_(codi){
  var c=CONFIG.cols.moduls; var found=null;
  readMainCached_('moduls').rows.forEach(function(r){ if(normVal_(r[c.codi])===normVal_(codi)) found=r; });
  return found;
}
function openModule_(codi){
  var m=moduleRow_(codi);
  if(!m) throw new Error('Mòdul no trobat: '+codi);
  return getSS_();
}

/* ========================= LOGIN ========================= */
function genTempPwd_(){ var chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; var r=''; for(var i=0;i<8;i++) r+=chars.charAt(Math.floor(Math.random()*chars.length)); return r; }
function loginUser_(p){
  var username=String(p.username||'').trim(), password=String(p.password||'');
  if(!username) throw new Error('Cal indicar l\'usuari.');
  var c=CONFIG.cols.usuaris;
  var rows=readMainCached_('usuaris').rows;
  var TWENTY_FOUR_H=24*60*60*1000;
  for(var i=0;i<rows.length;i++){ var u=rows[i];
    if(String(u[c.username]).trim()!==username) continue;
    // Contrasenya real
    if(String(u[c.password])===password){
      var al_=String(u[c.avisosLlegits]||'').trim(); var alArr_=al_?al_.split(',').map(function(x){return x.trim();}).filter(Boolean):[];
      return { id:String(u[c.id]), nom:String(u[c.nom]), cognom:String(u[c.cognom]), correu:String(u[c.correu]||''),
        username:String(u[c.username]), rol:String(u[c.rol]), classe:String(u[c.classe]||''), moduls:parseModuls_(u[c.moduls]),
        mustChangePassword: String(u[c.password])==='1234', avisos_llegits:alArr_ };
    }
    // Contrasenya temporal (caduca a les 24h)
    var tmpPwd=String(u[c.pwdTemp]||'').trim();
    var tmpTs=parseInt(String(u[c.pwdTempTs]||'0'))||0;
    if(tmpPwd && tmpPwd===password && tmpTs && (Date.now()-tmpTs)<TWENTY_FOUR_H){
      // Temp vàlida: restableix la real a 1234, esborra els camps temporals i força canvi
      bustMain_('usuaris');
      var data2=readMain_('usuaris'); var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
      var pwCol=colIndex_(data2.headers,c.password);
      var tmpCol=colIndex_(data2.headers,c.pwdTemp);
      var tsCol=colIndex_(data2.headers,c.pwdTempTs);
      data2.rows.forEach(function(u2){ if(String(u2[c.username]).trim()!==username) return;
        if(pwCol>0) sh.getRange(u2.__row,pwCol).setValue('1234');
        if(tmpCol>0) sh.getRange(u2.__row,tmpCol).setValue('');
        if(tsCol>0) sh.getRange(u2.__row,tsCol).setValue('');
      });
      var al2_=String(u[c.avisosLlegits]||'').trim(); var alArr2_=al2_?al2_.split(',').map(function(x){return x.trim();}).filter(Boolean):[];
      return { id:String(u[c.id]), nom:String(u[c.nom]), cognom:String(u[c.cognom]), correu:String(u[c.correu]||''),
        username:String(u[c.username]), rol:String(u[c.rol]), classe:String(u[c.classe]||''), moduls:parseModuls_(u[c.moduls]),
        mustChangePassword: true, avisos_llegits:alArr2_ };
    }
    // Usuari trobat però contrasenya incorrecta
    throw new Error('Usuari o contrasenya incorrectes.');
  }
  throw new Error('Usuari o contrasenya incorrectes.');
}
function parseModuls_(raw){ raw=String(raw||'').trim(); if(!raw||raw.toLowerCase()==='tots') return []; return raw.split(',').map(normVal_).filter(Boolean); }

/* ============== CURS / CLASSE / MÒDUL ============== */
function modulesIndex_(){ var c=CONFIG.cols.moduls,map={}; readMainCached_('moduls').rows.forEach(function(r){ map[normVal_(r[c.codi])]={codi:normVal_(r[c.codi]),nom:String(r[c.nom]),curs:normVal_(r[c.curs])}; }); return map; }
function visibleModules_(user){ var all=modulesIndex_(),arr=Object.keys(all).map(function(k){return all[k];});
  if(user&&user.rol==='professor'&&user.moduls&&user.moduls.length){ var s={}; user.moduls.forEach(function(c){s[c]=true;}); arr=arr.filter(function(m){return s[m.codi];}); }
  return arr; }
function getCourses_(p){ var seen={},out=[]; visibleModules_(p.user).forEach(function(m){ if(m.curs&&!seen[m.curs]){seen[m.curs]=true;out.push(m.curs);} }); return out.sort(); }
function getModules_(p){ var curs=normVal_(p.curs); return visibleModules_(p.user).filter(function(m){return m.curs===curs;}).map(function(m){return {codi:m.codi,nom:m.nom};}); }
function getClasses_(p){ var curs=normVal_(p.curs),c=CONFIG.cols.usuaris,seen={},out=[];
  readMainCached_('usuaris').rows.forEach(function(u){ if(String(u[c.rol])!=='alumne')return; var cl=String(u[c.classe]).trim(); if(cl&&cl.charAt(0)===curs&&!seen[cl]){seen[cl]=true;out.push(cl);} });
  return out.sort(); }

/* ============== PROJECTES (Organització Mòdul) ============== */
function readOrg_(ss, codi){
  var tabName=modTabName_(codi, 'Org');
  var sh=ss.getSheetByName(tabName);
  if(!sh) throw new Error('El mòdul no té la pestanya "'+tabName+'".');
  var v=sh.getDataRange().getValues(); var out=[];
  for(var i=1;i<v.length;i++){
    var prof=String(v[i][0]||'').trim(), num=normVal_(v[i][1]), nom=String(v[i][2]||'').trim(), act=String(v[i][3]||'').trim();
    if(!num&&!nom&&!act) continue;
    out.push({ prof:prof, num:num, nom:nom, act:act, __row:i+1 });
  }
  return { sheet:sh, rows:out };
}
function groupProjects_(rows){
  var map={}, order=[];
  rows.forEach(function(r){
    if(!r.num) return;
    if(!map[r.num]){ map[r.num]={num:r.num, nom:r.nom, activitats:[], profs:[]}; order.push(r.num); }
    if(r.act && map[r.num].activitats.indexOf(r.act)<0) map[r.num].activitats.push(r.act);
    String(r.prof||'').split(',').map(function(s){return s.trim();}).filter(Boolean).forEach(function(p){ if(map[r.num].profs.indexOf(p)<0) map[r.num].profs.push(p); });
    if(r.nom) map[r.num].nom=r.nom;
  });
  return order.map(function(n){return map[n];});
}
function getProjects_(p){
  var ss=openModule_(p.moduleCodi);
  var all=groupProjects_(readOrg_(ss, p.moduleCodi).rows);
  var user=p.user||{};
  if(user.rol==='professor'){ all=all.filter(function(pr){ return pr.profs.indexOf(user.username)>-1; }); }
  return all.map(function(pr){ return { num:pr.num, nom:pr.nom, activitats:pr.activitats }; });
}
function getActivityTypes_(p){
  // Catàleg global "Activitats -> Indicadors" + activitats pròpies del mòdul
  var out={}; var globalRes=readActivityBlocks_();
  function kwStr_(ip){ return Object.values(ip||{}).filter(Boolean).join(' '); }
  Object.keys(globalRes.blocks).forEach(function(a){ out[a]={activitat:a, nIndicadors:globalRes.blocks[a].length, font:'catàleg', paraules:kwStr_(globalRes.indParaules[a])}; });
  if(p && p.moduleCodi){ try{ var ss=openModule_(p.moduleCodi); var modRes=readModuleActivities_(ss, p.moduleCodi); var mod=modRes.map;
    Object.keys(mod).forEach(function(a){ out[a]={activitat:a, nIndicadors:mod[a].length, font:'mòdul', paraules:kwStr_(modRes.indParaules[a])}; }); }catch(e){} }
  return Object.keys(out).map(function(a){ return out[a]; }).sort(function(a,b){ return a.activitat.localeCompare(b.activitat); });
}

/* ============== ACTIVITATS -> INDICADORS (catàleg) ============== */
function readActivityBlocks_(){
  var c=CONFIG.cols.actInd, blocks={}, indParaules={}, current=null;
  readMainCached_('actInd').rows.forEach(function(r){
    var act=String(r[c.activitat]).trim(); if(act){current=act; if(!blocks[current])blocks[current]=[];if(!indParaules[current])indParaules[current]={};}
    if(!current)return;
    var codi=normVal_(r[c.codi]); if(codi) blocks[current].push(codi);
    var p=normVal_(r[c.paraules]); if(p&&codi) indParaules[current][codi]=p;
  });
  return { blocks:blocks, indParaules:indParaules };
}
function indicatorCatalog_(){
  var c=CONFIG.cols.indicadors,map={};
  readMainCached_('indicadors').rows.forEach(function(r){ var codi=String(r[c.codi]).trim(); if(!codi)return;
    map[codi]={codi:codi, capacitatId:String(r[c.capacitatId]), capacitat:String(r[c.capacitat]), requisit:String(r[c.requisit]),
      text:String(r[c.text]), colorInd:String(r[c.colorInd]), colorCap:String(r[c.colorCap])}; });
  return map;
}
/* activitats pròpies del mòdul (pestanya "{codi} Act" dins el Sheet principal) */
function readModuleActivities_(ss, codi){
  var sh=ss.getSheetByName(modTabName_(codi, 'Act')); if(!sh) return {map:{}, indParaules:{}};
  var v=sh.getDataRange().getValues(); var map={}, indParaules={};
  for(var i=1;i<v.length;i++){
    var a=String(v[i][0]||'').trim(); var code=normVal_(v[i][1]); if(!a)continue;
    if(!map[a])map[a]=[]; if(!indParaules[a])indParaules[a]={};
    if(code && map[a].indexOf(code)<0) map[a].push(code);
    var p=normVal_(String(v[i][2]||'').trim()); if(p&&code) indParaules[a][code]=p;
  }
  return {map:map, indParaules:indParaules};
}
function getActivityIndicators_(p){
  var act=String(p.activitat||'').trim(); var codes=null; var indParaules={};
  var ab=readActivityBlocks_();
  if(ab.blocks[act]){
    codes=ab.blocks[act]; indParaules=ab.indParaules[act]||{};
  } else if(p.moduleCodi){ try{ var ss=openModule_(p.moduleCodi); var res=readModuleActivities_(ss, p.moduleCodi); var mod=res.map;
    if(mod[act]){ codes=mod[act]; indParaules=res.indParaules[act]||{}; } }catch(e){} }
  if(!codes) codes=[];
  var cat=indicatorCatalog_();
  return { indicators:codes.map(function(codi){ var ind=cat[codi]||{codi:codi,capacitat:'?',requisit:'',text:'(no trobat)',colorInd:'#cccccc',colorCap:'#999999',capacitatId:capOf_(codi)};
    ind.paraules=indParaules[codi]||''; return ind; }) };
}
/* 7 capacitats amb els seus indicadors (per a la pantalla "Nova activitat") */
function getCapabilities_(){
  var cat=indicatorCatalog_(), byCap={};
  Object.keys(cat).forEach(function(code){ var c=cat[code]; var id=c.capacitatId||capOf_(code);
    if(!byCap[id]) byCap[id]={capacitatId:id, capacitat:c.capacitat||CAP_NOMS[id]||id, color:c.colorCap||('#'+(CAP_COLORS[id]||'999999')), indicators:[]};
    byCap[id].indicators.push({codi:code, text:c.text, requisit:c.requisit, colorInd:c.colorInd}); });
  return CAPS.map(function(id){ return byCap[id]; }).filter(Boolean);
}
/* desa una activitat nova dins el mòdul (reutilitzable només en aquest mòdul) */
function saveActivity_(p){
  var ss=openModule_(p.moduleCodi);
  var actTab=modTabName_(p.moduleCodi, 'Act');
  var sh=ss.getSheetByName(actTab);
  if(!sh){ sh=ss.insertSheet(actTab); sh.getRange(1,1,1,3).setValues([['Activitat','Codi Indicador','paraules clau']]).setFontWeight('bold'); }
  var nom=String(p.nom||'').trim(); if(!nom) throw new Error('Cal un nom d\'activitat.');
  var codes=(p.indicators||[]).map(normVal_).filter(Boolean);
  if(!codes.length) throw new Error('Tria almenys un indicador.');
  var indKw=p.indParaules||{};
  // si ja existeix amb aquest nom, reescriu
  var v=sh.getDataRange().getValues();
  for(var i=v.length-1;i>=1;i--){ if(String(v[i][0]||'').trim()===nom) sh.deleteRow(i+1); }
  var rows=codes.map(function(code){ return [nom, code, String(indKw[code]||'').trim()]; });
  sh.getRange(sh.getLastRow()+1,1,rows.length,3).setValues(rows);
  return { nom:nom, n:codes.length };
}

/* ============== ALUMNES ============== */
function classStudents_(classe){
  var c=CONFIG.cols.usuaris;
  return readMainCached_('usuaris').rows
    .filter(function(u){return String(u[c.rol])==='alumne'&&String(u[c.classe]).trim()===classe;})
    .map(function(u){return {id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),classe:String(u[c.classe])};})
    .sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
}
function getStudents_(p){
  var classe=String(p.classe||'').trim(), moduleCodi=normVal_(p.moduleCodi);
  var grup=(p.grup!==undefined&&p.grup!==null)?Number(p.grup):null;
  var c=CONFIG.cols.usuaris, regular=[], pendents=[], noMatriculats=[], altreGrup=[];
  readMainCached_('usuaris').rows.forEach(function(u){
    if(String(u[c.rol])!=='alumne')return;
    var ucl=String(u[c.classe]).trim();
    var base={id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),classe:ucl};
    if(ucl===classe){
      var noMatList=String(u[c.noMat]||'').split(',').map(normVal_);
      if(moduleCodi && noMatList.indexOf(moduleCodi)>-1){ base.noMat=true; noMatriculats.push(base); }
      else if(grup && grup>0 && moduleCodi){
        var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
        if(desd[moduleCodi] && desd[moduleCodi]!==grup){ base.altreGrup=true; altreGrup.push(base); }
        else regular.push(base);
      } else { regular.push(base); }
    } else {
      var pend=String(u[c.pendents]||'').split(',').map(normVal_);
      if(moduleCodi && pend.indexOf(moduleCodi)>-1){ base.pendent=true; pendents.push(base); }
    }
  });
  var bySort=function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);};
  regular.sort(bySort); pendents.sort(bySort); noMatriculats.sort(bySort); altreGrup.sort(bySort);
  return { regular:regular, pendents:pendents, noMatriculats:noMatriculats, altreGrup:altreGrup };
}

/* ============== ROSTER al Sheet de mòdul ============== */
/* Manté estables les files: cerca per Nom+Cognom; si no hi és, afegeix al final. */
function ensureRoster_(sheet, students){
  var T=CONFIG.modTab;
  sheet.getRange(T.rInd, T.nomCol).setValue('Nom');
  sheet.getRange(T.rInd, T.cogCol).setValue('Cognoms');
  var last=sheet.getLastRow();
  var map={}, maxRow=T.rosterRow-1;
  if(last>=T.rosterRow){
    var vals=sheet.getRange(T.rosterRow,T.nomCol,last-T.rosterRow+1,2).getValues();
    for(var i=0;i<vals.length;i++){
      var nom=String(vals[i][0]||'').trim(), cog=String(vals[i][1]||'').trim();
      if(nom||cog){ map[(nom+'|'+cog).toLowerCase()]=T.rosterRow+i; maxRow=T.rosterRow+i; }
    }
  }
  var idRow={}, toAppend=[];
  students.forEach(function(s){
    var key=(s.nom+'|'+s.cognom).toLowerCase();
    if(map[key]){ idRow[s.id]=map[key]; }
    else { maxRow++; idRow[s.id]=maxRow; toAppend.push([maxRow-(T.rosterRow-1), s.nom, s.cognom]); map[key]=maxRow; }
  });
  if(toAppend.length){
    var startRow=maxRow-toAppend.length+1;
    sheet.getRange(startRow, T.numCol, toAppend.length, 3).setValues(toAppend);
  }
  return idRow;
}

/* ============== DESAR REGISTRE (bloc de columnes) ============== */
function saveRegistre_(p){
  var ss=openModule_(p.moduleCodi);
  var letter=letterOf_(p.classe);
  var sheet=ss.getSheetByName(modTabName_(p.moduleCodi, letter));
  if(!sheet) throw new Error('El mòdul no té la pestanya "'+modTabName_(p.moduleCodi, letter)+'".');
  var T=CONFIG.modTab;

  var inds=sortInds_(getActivityIndicators_({activitat:p.activitat, moduleCodi:p.moduleCodi}).indicators); // ordenats per capacitat
  var width=inds.length; if(!width) throw new Error('L\'activitat no té indicadors al catàleg.');

  // roster (regulars + pendents al final; els NO matriculats no s'inclouen)
  var st=getStudents_({classe:p.classe, moduleCodi:p.moduleCodi});
  var allStudents=(st.regular||[]).concat(st.pendents||[]);
  var idRow=ensureRoster_(sheet, allStudents);

  // model de blocs existents (amb notes per fila d'alumne)
  var blocks=readBlocks_(sheet, true);
  if(p.blockCol){ blocks=blocks.filter(function(b){ return b.startCol!=Number(p.blockCol); }); } // edició: treu el bloc antic

  // construeix el bloc nou
  var grades=p.grades||{};
  var newNotes={};
  allStudents.forEach(function(s){ var row=idRow[s.id]; if(!row) return; var arr=[];
    inds.forEach(function(ind){ var g=grades[ind.codi]||{}; var v=g[s.id]; arr.push((v===null||v===undefined||v==='')?'':String(v)); });
    if(arr.some(function(x){return x!=='';})) newNotes[row]=arr;
  });
  var newBlock={ projNum:String(p.projecteNum||''), projNom:String(p.projecteNom||''),
    activitat:String(p.activitat||''), data:String(p.data||''), grup:(p.grup!=null?Number(p.grup):null),
    inds:inds.map(function(ind){ var capId=ind.capacitatId||capOf_(ind.codi);
      return { codi:ind.codi, cap:ind.capacitat||CAP_NOMS[capId]||'', capId:capId, text:ind.text||'',
        colorInd:(ind.colorInd?ind.colorInd.replace('#',''):(CAP_SOFT[capId]||'FFFFFF')) }; }),
    notes:newNotes };
  blocks.push(newBlock);

  // ordena per nº de projecte (els sense projecte, al final), estable
  blocks.forEach(function(b,i){ b.__i=i; });
  blocks.sort(function(a,b){ var ka=a.projNum===''?9999:Number(a.projNum), kb=b.projNum===''?9999:Number(b.projNum);
    if(ka!==kb)return ka-kb; return a.__i-b.__i; });

  // reescriu tota la zona de blocs (sense inserir columnes -> sense errors de combinació)
  writeBlocks_(sheet, blocks);

  rebuildResum_(ss, p.moduleCodi, letter);
  return { width:width, missatge:'Registre desat al mòdul '+p.moduleCodi+' (pestanya '+modTabName_(p.moduleCodi, letter)+').' };
}
function safeBreakRow_(sheet,row){ var T=CONFIG.modTab; var lc=Math.max(T.blockCol, sheet.getLastColumn());
  try{ sheet.getRange(row, T.blockCol, 1, lc-T.blockCol+1).breakApart(); }catch(e){} }
/* desfà TOTES les combinacions de la zona de capçalera (títol + files de projecte/activitat) */
function clearHeaderMerges_(sheet){ var T=CONFIG.modTab; var lc=Math.max(T.blockCol, sheet.getLastColumn());
  try{ sheet.getRange(1, T.blockCol, T.rInd, lc-T.blockCol+1).breakApart(); }catch(e){} }
function remergeHeaders_(sheet){
  var T=CONFIG.modTab; safeBreakRow_(sheet, T.rProj); safeBreakRow_(sheet, T.rAct);
  readBlocks_(sheet).forEach(function(b){
    if(b.width>1){ try{ sheet.getRange(T.rProj,b.startCol,1,b.width).merge(); }catch(e){} try{ sheet.getRange(T.rAct,b.startCol,1,b.width).merge(); }catch(e){} }
    try{ sheet.getRange(T.rProj,b.startCol,1,b.width).setBackground('#FFF2CC'); }catch(e){}
    try{ sheet.getRange(T.rAct, b.startCol,1,b.width).setBackground('#EFEFEF'); }catch(e){}
    try{ sheet.getRange(T.rProj,b.startCol).setFontWeight('bold').setHorizontalAlignment('center'); }catch(e){}
    try{ sheet.getRange(T.rAct, b.startCol).setHorizontalAlignment('center'); }catch(e){}
  });
}
function headerLastCol_(sheet){
  var T=CONFIG.modTab, last=sheet.getLastColumn();
  for(var c=last;c>=T.blockCol;c--){
    for(var r=T.rProj;r<=T.rInd;r++){ if(String(sheet.getRange(r,c).getValue()).trim()!=='') return c; }
  }
  return T.blockCol-1;
}
function findBlockWidth_(sheet,startCol){
  var T=CONFIG.modTab, last=sheet.getLastColumn(), w=0;
  for(var c=startCol;c<=last;c++){
    if(c>startCol && String(sheet.getRange(T.rProj,c).getValue()).trim()!=='') break; // següent bloc
    if(String(sheet.getRange(T.rInd,c).getValue()).trim()==='' && c>startCol) break;
    w++;
  }
  return Math.max(1,w);
}
function clearBlock_(sheet,startCol,width){
  var T=CONFIG.modTab, last=Math.max(sheet.getLastRow(),T.rosterRow);
  var rng=sheet.getRange(T.rProj,startCol,last-T.rProj+1,width);
  rng.breakApart(); rng.clearContent(); rng.setBackground(null);
}
function writeMerged_(sheet,row,col,width,text,fill,bold){
  var rng=sheet.getRange(row,col,1,width);
  if(width>1){ try{ rng.breakApart(); }catch(e){} try{ rng.merge(); }catch(e){} }
  var cell=sheet.getRange(row,col); cell.setValue(text);
  if(fill){ try{ rng.setBackground('#'+fill); }catch(e){} }
  if(bold) cell.setFontWeight('bold');
  cell.setHorizontalAlignment('center');
}
function setCell_(sheet,row,col,text,fill,bold){
  var cell=sheet.getRange(row,col); cell.setValue(text);
  if(fill) cell.setBackground('#'+fill); if(bold) cell.setFontWeight('bold');
  cell.setWrap(true); cell.setVerticalAlignment('middle'); cell.setHorizontalAlignment('center');
}

/* ============== LLEGIR BLOCS d'una pestanya de classe ============== */
function readBlocks_(sheet, withNotes){
  var T=CONFIG.modTab, last=sheet.getLastColumn(); var blocks=[]; var c=T.blockCol;
  var lastRow=Math.max(sheet.getLastRow(), T.rosterRow);
  while(c<=last){
    var proj=String(sheet.getRange(T.rProj,c).getValue()).trim();
    var indHere=String(sheet.getRange(T.rInd,c).getValue()).trim();
    if(!proj && !indHere){ c++; continue; }
    // amplada = columnes amb indicador consecutives fins el següent "Projecte" o buit
    var w=0, cc=c;
    while(cc<=last){
      if(cc>c && String(sheet.getRange(T.rProj,cc).getValue()).trim()!=='') break;
      if(String(sheet.getRange(T.rInd,cc).getValue()).trim()==='') break;
      w++; cc++;
    }
    if(w===0){ c++; continue; }
    var act=String(sheet.getRange(T.rAct,c).getValue()).trim();
    var actParts=act.split('  ·  '); var actName=actParts[0]; var data=(actParts[1]||'').trim(); var grupRaw=(actParts[2]||'').trim(); var blkGrup=(/^G\d+$/.test(grupRaw))?parseInt(grupRaw.slice(1)):null;
    var projNum=(proj.match(/Projecte\s*([^\s·]+)/)||[])[1]||'';
    var projNom=(proj.split('·')[1]||'').trim();
    var inds=[], carryCap='';
    for(var k=0;k<w;k++){
      var capRaw=String(sheet.getRange(T.rCap,c+k).getValue()).trim();
      if(capRaw) carryCap=capRaw;   // capacitat combinada: arrossega el valor de l'ancoratge
      inds.push({ col:c+k, cap:carryCap, capId:capByName_(carryCap), text:String(sheet.getRange(T.rInd,c+k).getValue()).trim() });
    }
    var notes=null;
    if(withNotes){
      notes={};
      var vals=sheet.getRange(T.rosterRow, c, lastRow-T.rosterRow+1, w).getValues();
      for(var ri=0;ri<vals.length;ri++){ var arr=[],any=false;
        for(var ci=0;ci<w;ci++){ var v=String(vals[ri][ci]==null?'':vals[ri][ci]).trim(); arr.push(v); if(v!=='')any=true; }
        if(any) notes[T.rosterRow+ri]=arr;
      }
    }
    blocks.push({ startCol:c, width:w, projNum:projNum, projNom:projNom, activitat:actName, data:data, grup:blkGrup, inds:inds, notes:notes });
    c=c+w;
  }
  return blocks;
}
function capOrder_(capId){ var i=CAPS.indexOf(capId); return i<0?99:i; }
function indNum_(codi){ var p=String(codi).split('.'); return p.length>1?Number(p[1])||0:0; }
function sortInds_(inds){ return inds.slice().sort(function(a,b){
  var ca=capOrder_(a.capacitatId||capOf_(a.codi)), cb=capOrder_(b.capacitatId||capOf_(b.codi));
  if(ca!==cb) return ca-cb; return indNum_(a.codi)-indNum_(b.codi); }); }
function ensureCols_(sheet,n){ var c=sheet.getMaxColumns(); if(c<n){ try{ sheet.insertColumnsAfter(c, n-c); }catch(e){} } }
function ensureRows_(sheet,n){ var r=sheet.getMaxRows(); if(r<n){ try{ sheet.insertRowsAfter(r, n-r); }catch(e){} } }
/* combina cel·les realment, centra i aplica color */
function setMerge_(sheet,row,col,width,text,fill,bold){
  var rng=sheet.getRange(row,col,1,width);
  if(width>1){ try{rng.breakApart();}catch(e){} try{rng.merge();}catch(e){} }
  rng.setVerticalAlignment('middle');
  if(fill){ try{rng.setBackground('#'+fill);}catch(e){} }
  var cell=sheet.getRange(row,col); cell.setValue(text);
  if(bold) cell.setFontWeight('bold');
  cell.setHorizontalAlignment('center');
}
/* reescriu TOTA la zona de blocs (D4 cap avall) a partir d'un model, ordenats per projecte */
function writeBlocks_(sheet, blocks){
  var T=CONFIG.modTab; var lastRow=Math.max(sheet.getLastRow(), T.rosterRow);
  // desfés TOTES les combinacions de la pestanya (rang complet -> mai parcial -> mai dóna error, ni al flush)
  try{ sheet.getRange(1,1,sheet.getMaxRows(),sheet.getMaxColumns()).breakApart(); SpreadsheetApp.flush(); }catch(e){}
  var totalW=0; blocks.forEach(function(b){ totalW+=b.inds.length; });
  ensureCols_(sheet, T.blockCol+Math.max(totalW,1)+1);
  // neteja NOMÉS la zona de blocs (cols D+ i files 4+); el roster i les files 1-3 es conserven
  var lc=Math.max(T.blockCol, sheet.getLastColumn());
  var region=sheet.getRange(T.rProj, T.blockCol, lastRow-T.rProj+1, lc-T.blockCol+1);
  region.clearContent(); region.setBackground(null);
  try{ region.setBorder(false,false,false,false,false,false); }catch(e){}
  var tcell=sheet.getRange(T.titleRow, T.blockCol);
  if(String(tcell.getValue()).trim()===''){ tcell.setValue('LES CAPACITATS CLAU - PROGRÉS I AVALUACIÓ ANUAL').setFontWeight('bold'); }
  var col=T.blockCol;
  var SOLID=SpreadsheetApp.BorderStyle.SOLID, MEDIUM=SpreadsheetApp.BorderStyle.SOLID_MEDIUM;
  blocks.forEach(function(b){
    var w=b.inds.length; if(!w) return;
    setMerge_(sheet, T.rProj, col, w, 'Projecte '+b.projNum+(b.projNom?(' · '+b.projNom):''), 'FFF2CC', true);
    setMerge_(sheet, T.rAct,  col, w, b.activitat+(b.data?('  ·  '+b.data):'')+(b.grup!=null?('  ·  G'+b.grup):''), 'EFEFEF', false);
    var g=0;
    while(g<w){
      var capId=b.inds[g].capId||capByName_(b.inds[g].cap)||capOf_(b.inds[g].codi||'');
      var capName=b.inds[g].cap||CAP_NOMS[capId]||capId||'';
      var span=1; while(g+span<w && ((b.inds[g+span].capId||capByName_(b.inds[g+span].cap))===capId)) span++;
      setMerge_(sheet, T.rCap, col+g, span, capName, CAP_COLORS[capId]||'FFFFFF', true);
      g+=span;
    }
    b.inds.forEach(function(ind,i){ var capId=ind.capId||capByName_(ind.cap);
      setCell_(sheet, T.rInd, col+i, ind.text, ind.colorInd||CAP_SOFT[capId]||'FFFFFF', false); });
    if(b.notes){ Object.keys(b.notes).forEach(function(row){ var arr=b.notes[row];
      for(var i=0;i<w;i++){ var v=arr[i]; if(v===''||v===undefined||v===null) continue;
        var cell=sheet.getRange(Number(row), col+i);
        cell.setValue(v==='NA'?'NA':Number(v));
        cell.setBackground('#'+(NOTA_SOFT[String(v)]||'FFFFFF'));
        cell.setHorizontalAlignment('center'); cell.setVerticalAlignment('middle'); }
    }); }
    // bordes: fi interior + gruixut exterior per bloc
    var bkRng=sheet.getRange(T.rProj,col,lastRow-T.rProj+1,w);
    bkRng.setBorder(false,false,false,false,true,true,'#D0D0D0',SOLID);
    bkRng.setBorder(true,true,true,true,null,null,'#555555',MEDIUM);
    sheet.getRange(T.rInd,col,1,w).setBorder(null,null,true,null,null,null,'#555555',MEDIUM);
    col+=w;
  });
}
function readRosterRows_(sheet){
  var T=CONFIG.modTab, last=sheet.getLastRow(); var out=[];
  if(last<T.rosterRow) return out;
  var vals=sheet.getRange(T.rosterRow,T.nomCol,last-T.rosterRow+1,2).getValues();
  for(var i=0;i<vals.length;i++){ var nom=String(vals[i][0]||'').trim(), cog=String(vals[i][1]||'').trim(); if(nom||cog) out.push({row:T.rosterRow+i,nom:nom,cognom:cog}); }
  return out;
}

/* ============== RESUM (càlcul + escriptura) ============== */
function rebuildResum_(ss, codi, letter){
  var src=ss.getSheetByName(modTabName_(codi, letter)); if(!src) return;
  var resName=modTabName_(codi, 'Resum '+letter);
  var res=ss.getSheetByName(resName); if(!res){ res=ss.insertSheet(resName); }
  var R=CONFIG.resTab, M=CONFIG.modTab;
  var blocks=readBlocks_(src, true); var roster=readRosterRows_(src);
  var projects=groupProjects_(readOrg_(ss, codi).rows); // tots els projectes del mòdul

  // agregació per fila d'alumne
  var perProj={}, glob={};
  roster.forEach(function(rr){ perProj[rr.row]={}; glob[rr.row]={}; projects.forEach(function(pr){ perProj[rr.row][pr.num]={}; }); });
  blocks.forEach(function(b){ if(!b.notes) return;
    b.inds.forEach(function(ind,ci){ var cap=ind.capId||capByName_(ind.cap); if(!cap) return;
      roster.forEach(function(rr){ var arr=b.notes[rr.row]; if(!arr) return; var v=arr[ci];
        if(v===''||v==null||String(v).toUpperCase()==='NA') return; var n=Number(v); if(isNaN(n)) return;
        if(b.projNum!==''){ var pp=perProj[rr.row][b.projNum]; if(pp){ if(!pp[cap])pp[cap]={s:0,c:0}; pp[cap].s+=n; pp[cap].c++; } }
        if(!glob[rr.row][cap])glob[rr.row][cap]={s:0,c:0}; glob[rr.row][cap].s+=n; glob[rr.row][cap].c++;
      });
    });
  });

  // dimensiona i neteja TOT (segur): primer desfés combinacions, després amplia
  var firstProjCol=R.moduleCol+R.capsPerBlock+R.gap;       // O = 15
  var neededCols=projects.length ? (firstProjCol + projects.length*(R.capsPerBlock+R.gap) + 1) : (R.moduleCol+R.capsPerBlock+1);
  var neededRows=R.rosterRow+roster.length+3;
  try{ res.getRange(1,1,res.getMaxRows(),res.getMaxColumns()).breakApart(); SpreadsheetApp.flush(); }catch(e){}   // 1r: desfés combinacions (tota la pestanya)
  ensureCols_(res, neededCols); ensureRows_(res, neededRows);                              // 2n: amplia
  var full=res.getRange(1,1,res.getMaxRows(),res.getMaxColumns()); full.clearContent(); full.setBackground(null);

  // capçaleres
  setMerge_(res, R.rTitle, R.notaCol, 1, 'NOTA FINAL CC', 'B7B7B7', true);                       // D
  setMerge_(res, R.rTitle, R.moduleCol, R.capsPerBlock, 'RESUM FINAL MÒDUL', 'B7B7B7', true);     // F-L
  RESUM_CAPS.forEach(function(cap,i){ setCell_(res, R.rCap, R.moduleCol+i, RESUM_NOMS[cap], CAP_COLORS[cap], true); });
  var projCols={};
  projects.forEach(function(pr,pi){ var pc=firstProjCol+pi*(R.capsPerBlock+R.gap); projCols[pr.num]=pc;
    setMerge_(res, R.rTitle, pc, R.capsPerBlock, 'Resum Projecte '+pr.num, 'D9D9D9', true);
    RESUM_CAPS.forEach(function(cap,i){ setCell_(res, R.rCap, pc+i, RESUM_NOMS[cap], CAP_COLORS[cap], true); });
  });
  res.getRange(R.rHeader, M.nomCol).setValue('Nom').setFontWeight('bold');
  res.getRange(R.rHeader, M.cogCol).setValue('Cognoms').setFontWeight('bold');

  // files d'alumnes
  roster.forEach(function(rr,idx){
    var row=R.rosterRow+idx;
    res.getRange(row, M.numCol).setValue(idx+1);
    res.getRange(row, M.nomCol).setValue(rr.nom);
    res.getRange(row, M.cogCol).setValue(rr.cognom);
    var means=[];
    RESUM_CAPS.forEach(function(cap,i){ var d=glob[rr.row][cap]; if(d&&d.c){ var m=Math.round(d.s/d.c); paintScore_(res,row,R.moduleCol+i,m); means.push(m); } });
    if(means.length) paintScore_(res, row, R.notaCol, Math.round(means.reduce(function(a,b){return a+b;},0)/means.length));
    projects.forEach(function(pr){ RESUM_CAPS.forEach(function(cap,i){ var d=perProj[rr.row][pr.num][cap]; if(d&&d.c) paintScore_(res,row,projCols[pr.num]+i,Math.round(d.s/d.c)); }); });
  });
  // bordes del Resum — per bloc: extern gruixut, interior fi
  if(roster.length>0){
    var resLast=R.rosterRow+roster.length-1;
    var SOLID=SpreadsheetApp.BorderStyle.SOLID, MEDIUM=SpreadsheetApp.BorderStyle.SOLID_MEDIUM;
    var applyBlk=function(c,w){
      var bk=res.getRange(R.rTitle,c,resLast-R.rTitle+1,w);
      bk.setBorder(false,false,false,false,true,true,'#D0D0D0',SOLID);
      bk.setBorder(true,true,true,true,null,null,'#555555',MEDIUM);
      res.getRange(R.rHeader,c,1,w).setBorder(null,null,true,null,null,null,'#555555',MEDIUM);
    };
    applyBlk(R.notaCol, 1);
    applyBlk(R.moduleCol, R.capsPerBlock);
    projects.forEach(function(pr){ applyBlk(projCols[pr.num], R.capsPerBlock); });
  }
}
function paintScore_(sheet,row,col,n){
  var cell=sheet.getRange(row,col); cell.setValue(n);
  var key=(n<=2)?'1':(n<=5)?'4':(n<=8)?'7':'10';
  cell.setBackground('#'+NOTA_SOFT[key]);
  cell.setHorizontalAlignment('center'); cell.setVerticalAlignment('middle');
}
function capByName_(name){
  name=String(name||'').toLowerCase();
  for(var i=0;i<CAPS.length;i++){ if(CAP_NOMS[CAPS[i]].toLowerCase()===name) return CAPS[i]; }
  // tolerància: per inici de paraula
  if(name.indexOf('organ')===0)return 'c1'; if(name.indexOf('iniciativa')===0)return 'c2';
  if(name.indexOf('respons')===0)return 'c3'; if(name.indexOf('autonom')===0)return 'c4';
  if(name.indexOf('treball')===0)return 'c5'; if(name.indexOf('relac')===0)return 'c6';
  if(name.indexOf('resol')===0)return 'c7';
  return null;
}

/* ============== EVIDÈNCIES (llistat / detall / esborrar) ============== */
function getEvidencies_(p){
  var ss=openModule_(p.moduleCodi); var out=[];
  ['A','B','C'].forEach(function(letter){
    var sh=ss.getSheetByName(modTabName_(p.moduleCodi, letter)); if(!sh) return;
    readBlocks_(sh).forEach(function(b){
      out.push({ moduleCodi:normVal_(p.moduleCodi), classeLetter:letter, startCol:b.startCol,
        projNum:b.projNum, projNom:b.projNom, activitat:b.activitat, data:b.data, nIndicadors:b.width });
    });
  });
  out.sort(function(a,b){return String(b.data).localeCompare(String(a.data));});
  return out;
}
function getBlockDetail_(p){
  var ss=openModule_(p.moduleCodi); var sh=ss.getSheetByName(modTabName_(p.moduleCodi, p.classeLetter));
  var blocks=readBlocks_(sh, true); var blk=null; blocks.forEach(function(b){ if(b.startCol==Number(p.startCol)) blk=b; });
  if(!blk) throw new Error('Bloc no trobat.');
  var roster=readRosterRows_(sh);
  var c=CONFIG.cols.usuaris; var nameId={};
  readMainCached_('usuaris').rows.forEach(function(u){ if(String(u[c.rol])==='alumne') nameId[(String(u[c.nom])+'|'+String(u[c.cognom])).toLowerCase()]=String(u[c.id]); });
  // mateix ordre que en desar (per capacitat)
  var indCodes=sortInds_(getActivityIndicators_({activitat:blk.activitat, moduleCodi:p.moduleCodi}).indicators).map(function(x){return x.codi;});
  var grades={};
  blk.inds.forEach(function(ind,i){
    var code=indCodes[i]||('?'+i); grades[code]={};
    roster.forEach(function(rr){
      var sid=nameId[(rr.nom+'|'+rr.cognom).toLowerCase()]; if(!sid) return;
      var arr=blk.notes?blk.notes[rr.row]:null; var s=arr?String(arr[i]||'').trim():'';
      if(s==='') return; grades[code][sid]=(s.toUpperCase()==='NA')?'NA':Number(s);
    });
  });
  var mrow=moduleRow_(p.moduleCodi); var curs=mrow?normVal_(mrow[CONFIG.cols.moduls.curs]):'';
  var mnom=mrow?String(mrow[CONFIG.cols.moduls.nom]):String(p.moduleCodi);
  return { startCol:blk.startCol, classeLetter:p.classeLetter, classe:curs+String(p.classeLetter), curs:curs, moduleNom:mnom,
    projNum:blk.projNum, projNom:blk.projNom, activitat:blk.activitat, data:blk.data, grup:blk.grup!=null?blk.grup:null, grades:grades };
}
function deleteRegistre_(p){
  var ss=openModule_(p.moduleCodi); var sh=ss.getSheetByName(modTabName_(p.moduleCodi, p.classeLetter));
  var blocks=readBlocks_(sh, true).filter(function(b){ return b.startCol!=Number(p.startCol); });
  writeBlocks_(sh, blocks);            // reescriu sense el bloc eliminat (sense esborrar columnes)
  rebuildResum_(ss, p.moduleCodi, p.classeLetter);
  return true;
}

/* ============== PESOS CC ============== */
function readPesos_(){
  var sh=getSS_().getSheetByName('Pesos');
  if(!sh) return {p1r:null, p2n:null};
  var v=sh.getDataRange().getValues(); var found=[];
  for(var i=0;i<v.length-1;i++){
    if(String(v[i][0]||'').trim().toLowerCase()==='c1'){
      var wRow=v[i+1], pesos={};
      CAPS.forEach(function(cap,idx){ var val=Number(wRow[idx]); if(isNaN(val)) val=0; pesos[cap]=val>1?val/100:val; });
      found.push(pesos);
    }
  }
  return {p1r:found[0]||null, p2n:found[1]||null};
}
function weightedNota_(cells, pesos){
  var num=0, den=0;
  CAPS.forEach(function(cap){
    var v=cells[cap]; if(v==null||isNaN(v)) return;
    var w=pesos?(pesos[cap]||0):1/CAPS.length;
    num+=v*w; den+=w;
  });
  return den>0?Math.round(num/den*10)/10:null;
}

/* ============== RESUM (lectura per al web) ============== */
function getModuleResum_(p){
  var ss=openModule_(p.moduleCodi); var letter=letterOf_(p.classe);
  var src=ss.getSheetByName(modTabName_(p.moduleCodi, letter)); if(!src) return { students:[], classMean:{}, capNoms:RESUM_NOMS };
  var blocks=readBlocks_(src, true); var roster=readRosterRows_(src);
  var glob={}, classSum={}, classCnt={}; CAPS.forEach(function(c){classSum[c]=0;classCnt[c]=0;});
  roster.forEach(function(rr){ glob[rr.row]={}; });
  blocks.forEach(function(b){ if(!b.notes)return; b.inds.forEach(function(ind,ci){ var cap=ind.capId||capByName_(ind.cap); if(!cap)return;
    roster.forEach(function(rr){ var arr=b.notes[rr.row]; if(!arr)return; var v=arr[ci]; if(v===''||v==null||String(v).toUpperCase()==='NA')return; var n=Number(v); if(isNaN(n))return;
      if(!glob[rr.row][cap])glob[rr.row][cap]={s:0,c:0}; glob[rr.row][cap].s+=n; glob[rr.row][cap].c++; });
  });});
  // join amb Usuaris per obtenir id
  var cu=CONFIG.cols.usuaris; var idMap={};
  readMainCached_('usuaris').rows.forEach(function(u){
    if(String(u[cu.classe]).trim()===p.classe)
      idMap[(String(u[cu.nom])+'|'+String(u[cu.cognom])).toLowerCase()]=String(u[cu.id]);
  });
  var students=roster.map(function(rr){
    var cells={};
    CAPS.forEach(function(cap){ var d=glob[rr.row][cap]; if(d&&d.c){ var m=d.s/d.c; cells[cap]=Math.round(m); classSum[cap]+=m; classCnt[cap]++; } else cells[cap]=null; });
    var id=idMap[(rr.nom+'|'+rr.cognom).toLowerCase()]||'';
    return { id:id, nom:rr.nom, cognom:rr.cognom, cells:cells };
  });
  var classMean={}; CAPS.forEach(function(c){ classMean[c]=classCnt[c]?(classSum[c]/classCnt[c]):0; });
  return { students:students, classMean:classMean, capNoms:RESUM_NOMS };
}

function getAlumneGlobalResum_(p){
  var c=CONFIG.cols.usuaris;
  var student=null;
  readMainCached_('usuaris').rows.forEach(function(u){ if(String(u[c.id])===String(p.userId)) student=u; });
  if(!student) throw new Error('Alumne no trobat.');
  var nom=String(student[c.nom]).trim(), cognom=String(student[c.cognom]).trim(), classe=String(student[c.classe]).trim();
  var lletra=classe.slice(1); // 'A' de '1A' o '2A'
  var classe1r='1'+lletra, classe2n='2'+lletra;
  // Llegeix TOTS els mòduls (1r i 2n)
  var cm=CONFIG.cols.moduls; var allModuls=[];
  readMainCached_('moduls').rows.forEach(function(m){
    var curs=normVal_(m[cm.curs]);
    if((curs==='1'||curs==='2')&&normVal_(m[cm.sheetId]))
      allModuls.push({codi:normVal_(m[cm.codi]), nom:String(m[cm.nom]), curs:curs});
  });
  var pesos=readPesos_();
  var acc1r={}, acc2n={};
  CAPS.forEach(function(cap){ acc1r[cap]={s:0,c:0}; acc2n[cap]={s:0,c:0}; });
  var modulData=[];
  allModuls.forEach(function(modul){
    var cl=(modul.curs==='1')?classe1r:classe2n;
    try{
      var resum=getModuleResum_({moduleCodi:modul.codi, classe:cl});
      var found=null;
      resum.students.forEach(function(s){ if(s.nom.trim()===nom&&s.cognom.trim()===cognom) found=s; });
      if(!found) return;
      var acc=(modul.curs==='1')?acc1r:acc2n;
      var hasData=false;
      CAPS.forEach(function(cap){ var v=found.cells[cap]; if(v!=null){acc[cap].s+=v;acc[cap].c++;hasData=true;} });
      if(hasData) modulData.push({codi:modul.codi, nom:modul.nom, cells:found.cells, curs:modul.curs});
    }catch(e){}
  });
  var cells1r={}, cells2n={}, cellsCicle={};
  CAPS.forEach(function(cap){
    cells1r[cap]=acc1r[cap].c>0?Math.round(acc1r[cap].s/acc1r[cap].c):null;
    cells2n[cap]=acc2n[cap].c>0?Math.round(acc2n[cap].s/acc2n[cap].c):null;
    var vals=[cells1r[cap],cells2n[cap]].filter(function(v){return v!=null;});
    cellsCicle[cap]=vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length):null;
  });
  var nota1r=weightedNota_(cells1r, pesos.p1r);
  var nota2n=weightedNota_(cells2n, pesos.p2n);
  var notaCicle=(nota1r!=null&&nota2n!=null)?Math.round((nota1r+nota2n)*5)/10:(nota1r!=null?nota1r:nota2n);
  return {
    nom:nom, cognom:cognom, classe:classe,
    modules:modulData,
    global1r:{cells:cells1r, nota:nota1r},
    global2n:{cells:cells2n, nota:nota2n},
    globalCicle:{cells:cellsCicle, nota:notaCicle},
    pesos:{p1r:pesos.p1r, p2n:pesos.p2n},
    capNoms:RESUM_NOMS
  };
}

/* ============== RESUM GLOBAL DE CLASSE (PDF export) ============== */
function getClassGlobalResum_(p){
  var classe=String(p.classe||'').trim(); if(!classe) return {classe:'',students:[],capNoms:RESUM_NOMS};
  var c=CONFIG.cols.usuaris;
  var students=readMainCached_('usuaris').rows
    .filter(function(u){return String(u[c.rol])==='alumne'&&String(u[c.classe]).trim()===classe;})
    .map(function(u){return {id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom])};})
    .sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
  if(!students.length) return {classe:classe,students:[],capNoms:RESUM_NOMS};
  var lletra=classe.slice(1); var classe1r='1'+lletra; var classe2n='2'+lletra;
  var cm=CONFIG.cols.moduls; var allModuls=[];
  readMainCached_('moduls').rows.forEach(function(m){
    var curs=normVal_(m[cm.curs]);
    if((curs==='1'||curs==='2')&&normVal_(m[cm.codi]))
      allModuls.push({codi:normVal_(m[cm.codi]),nom:String(m[cm.nom]),curs:curs});
  });
  var nameToId={};
  students.forEach(function(s){nameToId[(s.nom+'|'+s.cognom).toLowerCase()]=s.id;});
  var acc1r={}, acc2n={};
  students.forEach(function(s){
    acc1r[s.id]={}; acc2n[s.id]={};
    CAPS.forEach(function(cap){acc1r[s.id][cap]={s:0,c:0}; acc2n[s.id][cap]={s:0,c:0};});
  });
  var pesos=readPesos_();
  allModuls.forEach(function(modul){
    var cl=(modul.curs==='1')?classe1r:classe2n;
    try{
      var resum=getModuleResum_({moduleCodi:modul.codi,classe:cl});
      resum.students.forEach(function(st){
        var sid=nameToId[(st.nom.trim()+'|'+st.cognom.trim()).toLowerCase()];
        if(!sid||!acc1r[sid]) return;
        var acc=(modul.curs==='1')?acc1r:acc2n;
        CAPS.forEach(function(cap){var v=st.cells[cap];if(v!=null){acc[sid][cap].s+=v;acc[sid][cap].c++;}});
      });
    }catch(e){}
  });
  var result=students.map(function(s){
    var cells1r={}, cells2n={}, cellsCicle={};
    CAPS.forEach(function(cap){
      cells1r[cap]=acc1r[s.id][cap].c>0?Math.round(acc1r[s.id][cap].s/acc1r[s.id][cap].c):null;
      cells2n[cap]=acc2n[s.id][cap].c>0?Math.round(acc2n[s.id][cap].s/acc2n[s.id][cap].c):null;
      var vals=[cells1r[cap],cells2n[cap]].filter(function(v){return v!=null;});
      cellsCicle[cap]=vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length):null;
    });
    var nota1r=weightedNota_(cells1r,pesos.p1r);
    var nota2n=weightedNota_(cells2n,pesos.p2n);
    var notaCicle=(nota1r!=null&&nota2n!=null)?Math.round((nota1r+nota2n)*5)/10:(nota1r!=null?nota1r:nota2n);
    return {nom:s.nom,cognom:s.cognom,cells:cellsCicle,nota:notaCicle};
  });
  return {classe:classe,students:result,capNoms:RESUM_NOMS};
}

/* ============== INICI ============== */
function getInici_(p){
  var ss=openModule_(p.moduleCodi); var letter=letterOf_(p.classe);
  var src=ss.getSheetByName(modTabName_(p.moduleCodi, letter)); var nAl=(getStudents_({classe:p.classe,moduleCodi:p.moduleCodi}).regular||[]).length;
  if(!src) return { nAlumnes:nAl, nEvidencies:0, nValoracions:0, nAlumnesAval:0, dist:{r:0,a:0,b:0,v:0,na:0}, classMean:{}, capNoms:RESUM_NOMS };
  var blocks=readBlocks_(src, true); var roster=readRosterRows_(src);
  var dist={r:0,a:0,b:0,v:0,na:0}, vals=0, avalSet={};
  blocks.forEach(function(b){ if(!b.notes)return; b.inds.forEach(function(ind,ci){ roster.forEach(function(rr){
    var arr=b.notes[rr.row]; if(!arr)return; var s=String(arr[ci]||'').trim(); if(s==='')return; vals++; avalSet[rr.row]=true;
    if(s.toUpperCase()==='NA'){dist.na++;return;} var n=Math.round(Number(s)); if(n<=2)dist.r++;else if(n<=5)dist.a++;else if(n<=8)dist.b++;else dist.v++;
  });});});
  var resum=getModuleResum_(p);
  return { nAlumnes:nAl, nEvidencies:blocks.length, nValoracions:vals, nAlumnesAval:Object.keys(avalSet).length, dist:dist, classMean:resum.classMean, capNoms:RESUM_NOMS };
}

/* ============== GESTIÓ DE PROJECTES ============== */
function listProjects_(p){ var ss=openModule_(p.moduleCodi); return groupProjects_(readOrg_(ss, p.moduleCodi).rows); }
function getAllProfs_(){
  var c=CONFIG.cols.usuaris;
  return readMainCached_('usuaris').rows.filter(function(u){return String(u[c.rol])==='professor';})
    .map(function(u){return {username:String(u[c.username]), nom:String(u[c.nom])+' '+String(u[c.cognom])};});
}
function saveProject_(p){
  var ss=openModule_(p.moduleCodi); var org=readOrg_(ss, p.moduleCodi); var sh=org.sheet;
  var num=normVal_(p.num);
  org.rows.filter(function(r){return r.num===num;}).map(function(r){return r.__row;}).sort(function(a,b){return b-a;}).forEach(function(rw){ sh.deleteRow(rw); });
  var profs=(p.professors||[]).join(', ');
  sh.appendRow([profs, num, String(p.nom||'')]);   // una fila per projecte (sense columna d'activitats)
  return { num:num };
}
function deleteProject_(p){
  var ss=openModule_(p.moduleCodi); var org=readOrg_(ss, p.moduleCodi); var sh=org.sheet; var num=normVal_(p.num);
  org.rows.filter(function(r){return r.num===num;}).map(function(r){return r.__row;}).sort(function(a,b){return b-a;}).forEach(function(rw){ sh.deleteRow(rw); });
  return true;
}

/* ============== GESTIÓ D'ACTIVITATS PRÒPIES DEL MÒDUL ============== */
function listModuleActivities_(p){
  var ss=openModule_(p.moduleCodi);
  var res=readModuleActivities_(ss, p.moduleCodi); var map=res.map;
  var cat=indicatorCatalog_();
  return Object.keys(map).map(function(nom){
    return { nom:nom, indParaules:res.indParaules[nom]||{}, indicators:map[nom].map(function(codi){
      return cat[codi]||{codi:codi,text:'(no trobat)',colorInd:'#cccccc',capacitat:'?',capacitatId:capOf_(codi)};
    })};
  }).sort(function(a,b){ return a.nom.localeCompare(b.nom); });
}
function deleteActivity_(p){
  var ss=openModule_(p.moduleCodi);
  var sh=ss.getSheetByName(modTabName_(p.moduleCodi, 'Act')); if(!sh) return true;
  var nom=String(p.nom||'').trim();
  var v=sh.getDataRange().getValues();
  for(var i=v.length-1;i>=1;i--){ if(String(v[i][0]||'').trim()===nom) sh.deleteRow(i+1); }
  return true;
}

/* ============== HELPERS DESDOBLAMENTS ============== */
function parseDesdoblaments_(raw){
  var map={};
  String(raw||'').split(',').forEach(function(pair){
    var p=pair.trim().split(':');
    if(p.length===2&&p[0].trim()&&p[1].trim()) map[p[0].trim()]=Number(p[1].trim());
  });
  return map;
}
function serializeDesdoblaments_(map){
  return Object.keys(map).filter(function(k){return map[k]>0;}).map(function(k){return k+':'+map[k];}).join(',');
}

function getModulesAll_(){
  var c=CONFIG.cols.moduls;
  return readMainCached_('moduls').rows.map(function(r){
    return {codi:normVal_(r[c.codi]),nom:String(r[c.nom]),curs:normVal_(r[c.curs])};
  }).filter(function(m){return m.codi;}).sort(function(a,b){return a.codi.localeCompare(b.codi);});
}

/* ============== GESTIÓ D'USUARIS (ADMIN) ============== */
function getAdminUsers_(){
  var c=CONFIG.cols.usuaris, admins=[], professors=[], alumnes=[];
  var modIdx=modulesIndex_();
  readMainCached_('usuaris').rows.forEach(function(u){
    var moduls=parseModuls_(u[c.moduls]).map(function(code){ return modIdx[code]||{codi:code,nom:code}; });
    var obj={id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),
      username:String(u[c.username]),rol:String(u[c.rol]),classe:String(u[c.classe]||''),
      correu:String(u[c.correu]||''), modulsCodes:String(u[c.moduls]||''),
      moduls:moduls, resetRequest:String(u[c.resetRequest]||''), resets:parseInt(String(u[c.resets]||'0'))||0};
    var r=String(u[c.rol]);
    if(r==='admin') admins.push(obj);
    else if(r==='professor') professors.push(obj);
    else if(r==='alumne') alumnes.push(obj);
  });
  var bySort=function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);};
  admins.sort(bySort); professors.sort(bySort); alumnes.sort(bySort);
  return { admins:admins, professors:professors, alumnes:alumnes };
}
function deleteUser_(p){
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
  var hdrs=data.headers;
  var nom, cognom, found=false;
  data.rows.forEach(function(u){
    if(String(u[c.id])!==String(p.userId)) return;
    found=true;
    nom=String(u[c.nom]).trim();
    cognom=String(u[c.cognom]).trim();
    var idCol=colIndex_(hdrs,c.id);
    var blank=[];
    for(var ci=0;ci<hdrs.length;ci++) blank.push(ci+1===idCol?String(u[c.id]):'');
    sh.getRange(u.__row,1,1,hdrs.length).setValues([blank]);
  });
  if(!found) throw new Error('Usuari no trobat.');
  deleteFromModuleTabs_(nom,cognom);
  return true;
}
function deleteFromModuleTabs_(nom,cognom){
  var T=CONFIG.modTab, R=CONFIG.resTab;
  var ss=getSS_();
  var skip=[CONFIG.sheets.usuaris.name,CONFIG.sheets.moduls.name,CONFIG.sheets.actInd.name,CONFIG.sheets.indicadors.name];
  var key=(nom+'|'+cognom).toLowerCase();
  ss.getSheets().forEach(function(sheet){
    var name=sheet.getName();
    if(skip.indexOf(name)>-1) return;
    if(/\bOrg$/.test(name)||/\bAct$/.test(name)) return;
    var isResum=/Resum/.test(name);
    var startRow=isResum?R.rosterRow:T.rosterRow;
    var last=sheet.getLastRow();
    if(last<startRow) return;
    var vals=sheet.getRange(startRow,T.nomCol,last-startRow+1,2).getValues();
    var toDelete=[];
    for(var i=0;i<vals.length;i++){
      var n=String(vals[i][0]||'').trim(), cg=String(vals[i][1]||'').trim();
      if((n+'|'+cg).toLowerCase()===key) toDelete.push(startRow+i);
    }
    toDelete.sort(function(a,b){return b-a;});
    toDelete.forEach(function(row){sheet.deleteRow(row);});
  });
}
function editUser_(p){
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
  var hdrs=data.headers;
  var oldNom, oldCognom, found=false;
  data.rows.forEach(function(u){
    if(String(u[c.id])!==String(p.userId)) return;
    found=true;
    oldNom=String(u[c.nom]).trim();
    oldCognom=String(u[c.cognom]).trim();
    var fields=[
      {col:c.nom,      val:p.nom},
      {col:c.cognom,   val:p.cognom},
      {col:c.correu,   val:p.correu},
      {col:c.username, val:p.username},
      {col:c.classe,   val:p.classe},
      {col:c.moduls,   val:p.modulsCodes},
      {col:c.rol,      val:p.rol}
    ];
    fields.forEach(function(f){
      if(f.val===undefined||f.val===null) return;
      var ci=colIndex_(hdrs,f.col);
      if(ci>0) sh.getRange(u.__row,ci).setValue(String(f.val));
    });
  });
  if(!found) throw new Error('Usuari no trobat.');
  var newNom=(p.nom!==undefined&&p.nom!==null)?String(p.nom).trim():oldNom;
  var newCognom=(p.cognom!==undefined&&p.cognom!==null)?String(p.cognom).trim():oldCognom;
  if(newNom!==oldNom||newCognom!==oldCognom){
    updateNameInModuleTabs_(oldNom,oldCognom,newNom,newCognom);
  }
  return true;
}
function updateNameInModuleTabs_(oldNom,oldCognom,newNom,newCognom){
  var T=CONFIG.modTab, R=CONFIG.resTab;
  var ss=getSS_();
  var skip=[CONFIG.sheets.usuaris.name,CONFIG.sheets.moduls.name,CONFIG.sheets.actInd.name,CONFIG.sheets.indicadors.name];
  var oldKey=(oldNom+'|'+oldCognom).toLowerCase();
  ss.getSheets().forEach(function(sheet){
    var name=sheet.getName();
    if(skip.indexOf(name)>-1) return;
    if(/\bOrg$/.test(name)||/\bAct$/.test(name)) return;
    var isResum=/Resum/.test(name);
    var startRow=isResum?R.rosterRow:T.rosterRow;
    var last=sheet.getLastRow();
    if(last<startRow) return;
    var vals=sheet.getRange(startRow,T.nomCol,last-startRow+1,2).getValues();
    for(var i=0;i<vals.length;i++){
      var nom=String(vals[i][0]||'').trim(), cog=String(vals[i][1]||'').trim();
      if((nom+'|'+cog).toLowerCase()===oldKey){
        sheet.getRange(startRow+i,T.nomCol).setValue(newNom);
        sheet.getRange(startRow+i,T.cogCol).setValue(newCognom);
      }
    }
  });
}
function resetPassword_(p){
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris'); var pwCol=colIndex_(data.headers,c.password);
  if(pwCol<0) throw new Error('No s\'ha trobat la columna password.');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
  var rrCol=colIndex_(data.headers,c.resetRequest);
  var mailResult=null;
  data.rows.forEach(function(u){
    if(String(u[c.id])!==String(p.userId)) return;
    sh.getRange(u.__row,pwCol).setValue(String(p.password||''));
    if(rrCol>=0) sh.getRange(u.__row,rrCol).setValue('');
    // Envia correu a l'usuari notificant el restabliment
    var userEmail=String(u[c.correu]||'').trim();
    var userName=String(u[c.nom]||'').trim()+' '+String(u[c.cognom]||'').trim();
    if(userEmail){
      var htmlBody='<div style="font-family:sans-serif;font-size:14px;color:#222;line-height:1.6">'
        +'<p>Estimat/da '+String(u[c.nom]||'').trim()+',</p>'
        +'<p>Vas fer la petició de restablir la contrasenya del web EAS_CC.</p>'
        +'<p>La teva contrasenya torna a ser la inicial: <strong>1234</strong>. No obstant això, et demanarà que en tornis a posar una de nova.</p>'
        +'<p>Recorda que la contrasenya no hauria de ser una que utilitzis en altres plataformes. No la comparteixes amb ningú.</p>'
        +'<p>Salutacions,</p>'
        +'</div>';
      var mailError=null;
      try{
        MailApp.sendEmail({to:userEmail, subject:'Restablir contrasenya EAS_CC', htmlBody:htmlBody});
      }catch(e){
        mailError=String(e && e.message ? e.message : e);
        Logger.log('Error enviant correu restabliment a '+userEmail+': '+mailError);
      }
      mailResult={mailSent:!mailError, mailError:mailError, mailTo:userEmail};
    }
  });
  return mailResult||{mailSent:false, mailError:'Usuari no trobat o sense correu', mailTo:null};
}

function changePassword_(p){
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris'); var pwCol=colIndex_(data.headers,c.password);
  if(pwCol<0) throw new Error('No s\'ha trobat la columna password.');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name); var found=false;
  data.rows.forEach(function(u){
    if(String(u[c.id])!==String(p.userId)) return;
    if(String(u[c.password])!==String(p.oldPassword)) throw new Error('La contrasenya actual no és correcta.');
    sh.getRange(u.__row,pwCol).setValue(String(p.newPassword||'')); found=true;
  });
  if(!found) throw new Error('Usuari no trobat.');
  return true;
}
function requestPasswordReset_(p){
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris');
  var rrCol=colIndex_(data.headers,c.resetRequest);
  var tmpCol=colIndex_(data.headers,c.pwdTemp);
  var tsCol=colIndex_(data.headers,c.pwdTempTs);
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name); var found=false;
  var now=new Date();
  var dd=now.getDate(),mm=now.getMonth()+1,yy=now.getFullYear(),hh=now.getHours(),mi=now.getMinutes();
  var nowStr=(dd<10?'0':'')+dd+'/'+(mm<10?'0':'')+mm+'/'+yy+' '+(hh<10?'0':'')+hh+':'+(mi<10?'0':'')+mi;
  var tempPwd=genTempPwd_();
  var mailError=null;
  data.rows.forEach(function(u){
    if(String(u[c.username]).trim()!==String(p.username||'').trim()) return;
    found=true;
    // Desa contrasenya temporal i timestamp (NO toca la contrasenya real)
    if(tmpCol>0) sh.getRange(u.__row,tmpCol).setValue(tempPwd);
    if(tsCol>0) sh.getRange(u.__row,tsCol).setValue(String(Date.now()));
    // Desa el timestamp de sol·licitud (per seguiment admin)
    if(rrCol>=0) sh.getRange(u.__row,rrCol).setValue(nowStr);
    // Incrementa el comptador de restabliments
    var resetsCol=colIndex_(data.headers,c.resets);
    if(resetsCol>=0){
      var prev=parseInt(String(u[c.resets]||'0'))||0;
      sh.getRange(u.__row,resetsCol).setValue(prev+1);
    }
    // Envia correu amb la contrasenya temporal
    var correu=String(u[c.correu]||'').trim();
    var nom=String(u[c.nom]||'').trim();
    if(correu){
      var htmlBody='<div style="font-family:sans-serif;font-size:14px;color:#222;line-height:1.6">'
        +'<p>Hola '+nom+',</p>'
        +'<p>Has sol·licitat restablir la contrasenya de l\'EAS CC.</p>'
        +'<p>La teva contrasenya temporal és: <strong style="font-size:18px;letter-spacing:.1em">'+tempPwd+'</strong></p>'
        +'<p>Aquesta contrasenya caduca en <strong>24 hores</strong>. Quan entris, l\'aplicació et demanarà que triïs una contrasenya nova.</p>'
        +'<p>Si no has fet aquesta sol·licitud, ignora aquest correu: la teva contrasenya actual no ha canviat.</p>'
        +'<p>Salutacions,</p>'
        +'</div>';
      try{ MailApp.sendEmail({to:correu,subject:'Contrasenya temporal EAS CC',htmlBody:htmlBody,name:'Equip de suport EAS CC'}); }
      catch(e){ mailError=String(e&&e.message?e.message:e); }
    }
  });
  if(!found) throw new Error('No s\'ha trobat cap usuari amb aquest nom d\'usuari.');
  if(mailError) Logger.log('Error enviant correu reset a usuari: '+mailError);
  return true;
}

/* ============== TRIGGER: NOTIFICACIÓ SOL·LICITUDS PENDENTS ============== */

/**
 * Comprova si hi ha sol·licituds de restabliment pendents.
 * Envia un correu als admins NOMÉS si el conjunt de pendents
 * ha canviat des de l'últim enviament (evita correus repetitius).
 *
 * S'ha d'activar des del trigger temporal (installResetTrigger_).
 */
function checkPendingResets_(){
  var c=CONFIG.cols.usuaris;
  var data=readMain_('usuaris');
  var pending=data.rows.filter(function(u){
    return String(u[c.resetRequest]||'').trim()!=='';
  });

  var props=PropertiesService.getScriptProperties();

  if(pending.length===0){
    // No hi ha pendents: neteja l'estat guardat
    props.deleteProperty('lastResetSnapshot');
    return;
  }

  // Crea una "empremta" del conjunt actual: id+timestamp de cada pendent
  var snapshot=pending.map(function(u){
    return String(u[c.id])+'|'+String(u[c.resetRequest]);
  }).sort().join(';');

  var lastSnapshot=props.getProperty('lastResetSnapshot')||'';
  if(snapshot===lastSnapshot) return; // Res de nou, no s'envia correu

  // Hi ha canvis: construeix i envia el correu
  var tableRows=pending.map(function(u){
    return '<tr>'
      +'<td style="padding:6px 12px;border:1px solid #ddd">'+String(u[c.nom]||'')+'</td>'
      +'<td style="padding:6px 12px;border:1px solid #ddd">'+String(u[c.cognom]||'')+'</td>'
      +'<td style="padding:6px 12px;border:1px solid #ddd">'+String(u[c.correu]||'')+'</td>'
      +'<td style="padding:6px 12px;border:1px solid #ddd">'+String(u[c.resetRequest]||'')+'</td>'
      +'</tr>';
  }).join('');

  var htmlBody='<div style="font-family:sans-serif;font-size:14px;color:#222;line-height:1.6">'
    +'<p>Estimats Nau i Iván,</p>'
    +'<p>Hi ha sol·licituds pendents de restabliment de contrasenya a l\'EAS_CC. Us passo el llistat actualitzat perquè pugueu gestionar-ho amb el perfil d\'admin.</p>'
    +'<table style="border-collapse:collapse;margin:12px 0">'
    +'<thead><tr style="background:#f0f4f8;font-weight:600">'
    +'<th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Nom</th>'
    +'<th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Cognoms</th>'
    +'<th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Mail</th>'
    +'<th style="padding:6px 12px;border:1px solid #ddd;text-align:left">Data de sol·licitud</th>'
    +'</tr></thead>'
    +'<tbody>'+tableRows+'</tbody></table>'
    +'<p>Gràcies per la feina que feu, sou els millors.</p>'
    +'<p>Salutacions,</p></div>';

  // DESACTIVAT: notificació als admins (pot reactivar-se en el futur si cal)
  // MailApp.sendEmail({
  //   to:'nmarieges@ieb.cat,ibustos@ieb.cat',
  //   subject:'Sol·licituds pendents de restablir contrasenya EAS_CC',
  //   htmlBody:htmlBody
  // });

  // Guarda l'empremta per evitar repetir el correu si no canvia res
  props.setProperty('lastResetSnapshot', snapshot);
  Logger.log('Correu de pendents enviat. Sol·licituds: '+pending.length);
}

/**
 * Executa aquesta funció UNA SOLA VEGADA des de l'editor de GAS
 * per instal·lar el trigger horari. GAS demanarà autorització de Gmail.
 *
 * Per desinstal·lar: executa removeResetTrigger_()
 */
function installResetTrigger(){
  // Elimina triggers existents d'aquesta funció per evitar duplicats
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='checkPendingResets_') ScriptApp.deleteTrigger(t);
  });
  // Trigger cada hora
  ScriptApp.newTrigger('checkPendingResets_')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Trigger instal·lat: checkPendingResets_ cada hora.');
}

function removeResetTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='checkPendingResets_') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Trigger eliminat.');
}

/* ============== MISSATGES MASSIUS (AVISOS) ============== */
function ensureAvisosSheet_(){
  var ss=getSS_(); var name=CONFIG.sheets.avisos.name;
  var sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,8).setValues([['id','text','rols','data','autor','enviat_email','classes','destinataris']]);
    sh.getRange(1,1,1,8).setFontWeight('bold');
  } else {
    // Afegeix les noves columnes si no existeixen
    var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(h){return String(h).trim();});
    if(headers.indexOf('classes')<0){ sh.getRange(1,sh.getLastColumn()+1).setValue('classes').setFontWeight('bold'); }
    if(headers.indexOf('destinataris')<0){ sh.getRange(1,sh.getLastColumn()+1).setValue('destinataris').setFontWeight('bold'); }
  }
  return sh;
}
function saveAvis_(p){
  var text=String(p.text||'').trim(); if(!text) throw new Error('El text del missatge no pot estar buit.');
  var mode=String(p.mode||'rol'); // 'rol', 'classe', 'individual'
  var rols=(p.rols||[]).filter(Boolean);
  var classes=(p.classes||[]).filter(Boolean);
  var destinataris=(p.destinataris||[]).filter(Boolean);
  if(mode==='rol'&&!rols.length) throw new Error('Cal seleccionar almenys un rol destinatari.');
  if(mode==='classe'&&!classes.length) throw new Error('Cal seleccionar almenys una classe.');
  if(mode==='individual'&&!destinataris.length) throw new Error('Cal seleccionar almenys un destinatari.');
  var autor=String(p.autor||'admin');
  var sh=ensureAvisosSheet_();
  var now=new Date();
  var id='avis_'+now.getTime();
  var dateStr=Utilities.formatDate(now,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm');
  sh.appendRow([id,text,rols.join(','),dateStr,autor,'',classes.join(','),destinataris.join(',')]);
  return { id:id };
}
function getAvisos_(p){
  var allMode=!!p.all;
  var userRol=String((p.user&&p.user.rol)||p.rol||'').trim();
  var userClass=String((p.user&&p.user.classe)||'').trim();
  var username=String((p.user&&p.user.username)||'').trim();
  var sh; try{ sh=getSS_().getSheetByName(CONFIG.sheets.avisos.name); }catch(e){ return []; }
  if(!sh) return [];
  var v=sh.getDataRange().getValues();
  if(v.length<2) return [];
  var headers=v[0].map(function(h){return String(h).trim();});
  var iId=headers.indexOf('id'), iText=headers.indexOf('text'), iRols=headers.indexOf('rols'),
      iData=headers.indexOf('data'), iAutor=headers.indexOf('autor'),
      iClasses=headers.indexOf('classes'), iDest=headers.indexOf('destinataris');
  var out=[];
  for(var i=1;i<v.length;i++){
    var rowId=String(v[i][iId]||''); if(!rowId) continue;
    var rols=String(v[i][iRols]||'').split(',').map(function(r){return r.trim();}).filter(Boolean);
    var classesArr=iClasses>=0?String(v[i][iClasses]||'').split(',').map(function(x){return x.trim();}).filter(Boolean):[];
    var destArr=iDest>=0?String(v[i][iDest]||'').split(',').map(function(x){return x.trim();}).filter(Boolean):[];
    if(!allMode){
      var show=false;
      if(destArr.length){
        show=username&&destArr.indexOf(username)>=0;
      } else if(classesArr.length){
        show=userClass&&classesArr.indexOf(userClass)>=0;
      } else {
        show=!userRol||!rols.length||rols.indexOf(userRol)>=0;
      }
      if(!show) continue;
    }
    out.push({ id:rowId, text:String(v[i][iText]||''), rols:rols, classes:classesArr, destinataris:destArr, data:String(v[i][iData]||''), autor:String(v[i][iAutor]||'') });
  }
  return out.reverse();
}

function markAvisosLlegits_(p){
  var username=String((p.user&&p.user.username)||p.username||'').trim();
  if(!username) throw new Error('Usuari no identificat.');
  var newIds=(p.ids||[]).map(function(x){return String(x).trim();}).filter(Boolean);
  if(!newIds.length) return true;
  var c=CONFIG.cols.usuaris;
  bustMain_('usuaris');
  var data=readMain_('usuaris');
  var alCol=colIndex_(data.headers,c.avisosLlegits);
  if(alCol<1) return true; // columna no existeix encara, no fa res
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
  data.rows.forEach(function(u){
    if(String(u[c.username]).trim()!==username) return;
    var current=String(u[c.avisosLlegits]||'').trim();
    var arr=current?current.split(',').map(function(x){return x.trim();}).filter(Boolean):[];
    newIds.forEach(function(id){ if(arr.indexOf(id)<0) arr.push(id); });
    sh.getRange(u.__row,alCol).setValue(arr.join(','));
  });
  bustMain_('usuaris');
  return true;
}

/* ============== GESTIÓ DE DESDOBLAMENTS (ADMIN) ============== */
function checkModulGrups_(p){
  var c=CONFIG.cols.usuaris; var classe=String(p.classe||'').trim(); var moduleCodi=normVal_(p.moduleCodi);
  var hasGroups=false;
  readMainCached_('usuaris').rows.forEach(function(u){
    if(String(u[c.rol])!=='alumne'||String(u[c.classe]).trim()!==classe) return;
    var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
    if(desd[moduleCodi]) hasGroups=true;
  });
  return { hasGroups:hasGroups };
}
function getDesdoblaments_(p){
  var c=CONFIG.cols.usuaris; var classe=String(p.classe||'').trim(); var moduleCodi=normVal_(p.moduleCodi);
  var out=[];
  readMainCached_('usuaris').rows.forEach(function(u){
    if(String(u[c.rol])!=='alumne'||String(u[c.classe]).trim()!==classe) return;
    var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
    out.push({id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),grup:desd[moduleCodi]||null});
  });
  out.sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
  return out;
}
function saveDesdoblaments_(p){
  var c=CONFIG.cols.usuaris; var moduleCodi=normVal_(p.moduleCodi);
  bustMain_('usuaris');
  var data=readMain_('usuaris'); var desdCol=colIndex_(data.headers,c.desdoblaments);
  if(desdCol<0) throw new Error('No s\'ha trobat la columna desdoblaments al full Usuaris. Afegeix-la primer.');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name);
  var assignMap={}; (p.assignments||[]).forEach(function(a){ assignMap[String(a.studentId)]=a.grup; });
  data.rows.forEach(function(u){
    var uid=String(u[c.id]); if(!(uid in assignMap)) return;
    var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
    var g=assignMap[uid];
    if(g&&Number(g)>0) desd[moduleCodi]=Number(g); else delete desd[moduleCodi];
    sh.getRange(u.__row,desdCol).setValue(serializeDesdoblaments_(desd));
  });
  return true;
}

/* ============== GESTIÓ DEL CATÀLEG D'ACTIVITATS (ADMIN) ============== */
function listCatalogActivities_(){
  var cat=indicatorCatalog_(); var res=readActivityBlocks_();
  return Object.keys(res.blocks).map(function(nom){
    return { nom:nom, indParaules:res.indParaules[nom]||{}, indicators:res.blocks[nom].map(function(codi){
      return cat[codi]||{codi:codi,text:'(no trobat)',colorInd:'#cccccc',capacitat:'?',capacitatId:capOf_(codi)};
    })};
  }).sort(function(a,b){ return a.nom.localeCompare(b.nom); });
}
function saveCatalogActivity_(p){
  bustMain_('actInd');
  var c=CONFIG.cols.actInd; var sh=getSS_().getSheetByName(CONFIG.sheets.actInd.name);
  if(!sh) throw new Error('No s\'ha trobat el full "'+CONFIG.sheets.actInd.name+'".');
  var nom=String(p.nom||'').trim(); if(!nom) throw new Error('Cal un nom d\'activitat.');
  var codes=(p.indicators||[]).map(normVal_).filter(Boolean);
  if(!codes.length) throw new Error('Tria almenys un indicador.');
  var cat=indicatorCatalog_();
  // esborra oldNom si és diferent
  if(p.oldNom && String(p.oldNom).trim()!==nom) _deleteCatalogRows_(sh, String(p.oldNom).trim(), c.activitat);
  // esborra i reescriu nom actual
  _deleteCatalogRows_(sh, nom, c.activitat);
  var indKw=p.indParaules||{};
  var rows=codes.map(function(codi){
    var ind=cat[codi]||{}; var capId=ind.capacitatId||capOf_(codi);
    return [nom, ind.capacitat||CAP_NOMS[capId]||capId, ind.text||'', codi, ind.colorInd||'', String(indKw[codi]||'').trim()];
  });
  sh.getRange(sh.getLastRow()+1,1,rows.length,6).setValues(rows);
  return { nom:nom, n:codes.length };
}
function deleteCatalogActivity_(p){
  bustMain_('actInd');
  var c=CONFIG.cols.actInd; var sh=getSS_().getSheetByName(CONFIG.sheets.actInd.name);
  if(!sh) return true;
  _deleteCatalogRows_(sh, String(p.nom||'').trim(), c.activitat);
  return true;
}
function _deleteCatalogRows_(sh, nom, actCol){
  var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(h){return String(h).trim();});
  var ci=colIndex_(headers,actCol);
  if(ci<0) return;
  var v=sh.getDataRange().getValues();
  for(var i=v.length-1;i>=1;i--){ if(String(v[i][ci-1]||'').trim()===nom) sh.deleteRow(i+1); }
}

/* ============== GESTIÓ CLASSES (HISTORIAL ALUMNAT) ============== */
function readClassesConfig_(){
  var FIXED=['1A','1B','1C','2A','2B','2C'];
  var ss=getSS_();
  var sh=ss.getSheetByName('Classes');
  if(!sh){
    sh=ss.insertSheet('Classes');
    sh.getRange(1,1,1,2).setValues([['classe','historial']]).setFontWeight('bold');
    FIXED.forEach(function(c,i){ sh.getRange(2+i,1,1,2).setValues([[c,'no']]); });
  }
  var v=sh.getDataRange().getValues();
  var hdrs=v[0].map(function(h){return String(h).trim();});
  var cc=hdrs.indexOf('classe'), hc=hdrs.indexOf('historial');
  var map={};
  FIXED.forEach(function(c){ map[c]=false; });
  for(var i=1;i<v.length;i++){
    var cl=String(v[i][cc>=0?cc:0]||'').trim();
    if(cl) map[cl]=(String(v[i][hc>=0?hc:1]||'').trim().toLowerCase()==='si');
  }
  return map;
}
function saveClassesConfig_(p){
  var FIXED=['1A','1B','1C','2A','2B','2C'];
  var ss=getSS_();
  var sh=ss.getSheetByName('Classes');
  if(!sh){
    sh=ss.insertSheet('Classes');
    sh.getRange(1,1,1,2).setValues([['classe','historial']]).setFontWeight('bold');
  }
  var v=sh.getDataRange().getValues();
  var hdrs=v[0].map(function(h){return String(h).trim();});
  var cc=hdrs.indexOf('classe')+1, hc=hdrs.indexOf('historial')+1;
  if(cc<=0){ sh.getRange(1,1).setValue('classe'); cc=1; }
  if(hc<=0){ sh.getRange(1,2).setValue('historial'); hc=2; }
  var rowMap={};
  for(var i=1;i<v.length;i++){
    var cl=String(v[i][cc-1]||'').trim(); if(cl) rowMap[cl]=i+1;
  }
  var cfg=p.config||{};
  FIXED.forEach(function(c){
    var val=(cfg[c]===true)?'si':'no';
    if(rowMap[c]){ sh.getRange(rowMap[c],hc).setValue(val); }
    else{ var lr=sh.getLastRow(); sh.getRange(lr+1,cc).setValue(c); sh.getRange(lr+1,hc).setValue(val); rowMap[c]=lr+1; }
  });
  return true;
}

/* ============== EXEMPLES PRÀCTICS CONFIG ============== */
function readExemplesConfig_(){
  var FIXED=['lleure','mp1139','mp1136','mp0179','mp1709','mg-esports','ianimacio'];
  var ss=getSS_();
  var sh=ss.getSheetByName('Exemples');
  if(!sh){
    sh=ss.insertSheet('Exemples');
    sh.getRange(1,1,1,9).setValues([['mòdul','actiu','pla','num','títol','subtítol','hashtags','url','ppt']]).setFontWeight('bold');
    FIXED.forEach(function(id){ sh.appendRow([id,'si','','','','','','','']); });
    return {newFormat:true, mods:{}, acts:[]};
  }
  var v=sh.getDataRange().getValues();
  if(v.length<1) return {newFormat:true, mods:{}, acts:[]};
  function norm(s){ return String(s||'').trim().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
  var hdrs=v[0].map(norm);
  var isNew=(hdrs.indexOf('modul')>=0);
  if(!isNew){
    // Old format: id|actiu|url|A1-A9
    var ic=hdrs.indexOf('id'), ac=hdrs.indexOf('actiu'), uc=hdrs.indexOf('url');
    var map={}, urls={}, pptUrls={};
    FIXED.forEach(function(id){ map[id]=true; });
    for(var i=1;i<v.length;i++){
      var mid=String(v[i][ic>=0?ic:0]||'').trim();
      if(mid){
        map[mid]=(String(v[i][ac>=0?ac:1]||'').trim().toLowerCase()!=='no');
        if(uc>=0){ var u=String(v[i][uc]||'').trim(); if(u) urls[mid]=u; }
        var actMap={};
        for(var j=1;j<=9;j++){
          var col=hdrs.indexOf('a'+j);
          if(col>=0){ var pu=String(v[i][col]||'').trim(); if(pu) actMap['a'+j]=pu; }
        }
        if(Object.keys(actMap).length) pptUrls[mid]=actMap;
      }
    }
    return {newFormat:false, config:map, urls:urls, pptUrls:pptUrls};
  }
  // New format: mòdul|actiu|pla|num|títol|subtítol|hashtags|url|ppt
  var ci={
    mod:hdrs.indexOf('modul'), actiu:hdrs.indexOf('actiu'),
    pla:hdrs.indexOf('pla'), num:hdrs.indexOf('num'),
    titol:hdrs.indexOf('titol'), sub:hdrs.indexOf('subtitol'),
    tags:hdrs.indexOf('hashtags'), url:hdrs.indexOf('url'), ppt:hdrs.indexOf('ppt')
  };
  var mods={}, acts=[];
  FIXED.forEach(function(id){ mods[id]=true; });
  for(var i=1;i<v.length;i++){
    var row=v[i];
    var mid2=String(row[ci.mod>=0?ci.mod:0]||'').trim();
    if(!mid2) continue;
    var actiu2=(String(row[ci.actiu>=0?ci.actiu:1]||'').trim().toLowerCase()!=='no');
    var pla=ci.pla>=0?String(row[ci.pla]||'').trim().toUpperCase():'';
    var num=ci.num>=0?parseInt(String(row[ci.num]||'').trim())||0:0;
    if(!pla){ mods[mid2]=actiu2; }
    else{ acts.push({mod:mid2,actiu:actiu2,pla:pla,num:num,
      titol:ci.titol>=0?String(row[ci.titol]||'').trim():'',
      sub:ci.sub>=0?String(row[ci.sub]||'').trim():'',
      tags:ci.tags>=0?String(row[ci.tags]||'').trim():'',
      url:ci.url>=0?String(row[ci.url]||'').trim():'',
      ppt:ci.ppt>=0?String(row[ci.ppt]||'').trim():''}); }
  }
  return {newFormat:true, mods:mods, acts:acts};
}
function saveExemplesConfig_(p){
  var FIXED=['lleure','mp1139','mp1136','mp0179','mp1709','mg-esports','ianimacio'];
  var ss=getSS_();
  var sh=ss.getSheetByName('Exemples');
  if(!sh){ sh=ss.insertSheet('Exemples'); }
  if(p.acts!==undefined){
    // New format save
    sh.clearContents();
    var hdrs=['mòdul','actiu','pla','num','títol','subtítol','hashtags','url','ppt'];
    var rows=[hdrs];
    var mods=p.mods||{}, acts=p.acts||[];
    var allMods=FIXED.slice();
    Object.keys(mods).forEach(function(id){ if(allMods.indexOf(id)<0) allMods.push(id); });
    allMods.forEach(function(mid){
      rows.push([mid,(mods[mid]===false)?'no':'si','','','','','','','']);
      acts.filter(function(a){return a.mod===mid;})
          .sort(function(a,b){ return a.pla<b.pla?-1:a.pla>b.pla?1:a.num-b.num; })
          .forEach(function(a){ rows.push([a.mod,a.actiu?'si':'no',a.pla||'',a.num||'',a.titol||'',a.sub||'',a.tags||'',a.url||'',a.ppt||'']); });
    });
    sh.getRange(1,1,rows.length,9).setValues(rows);
    sh.getRange(1,1,1,9).setFontWeight('bold');
  } else {
    // Old format save (backward compat)
    var v=sh.getDataRange().getValues();
    var h2=v[0].map(function(h){return String(h).trim();});
    var ic2=h2.indexOf('id')+1, ac2=h2.indexOf('actiu')+1;
    if(ic2<=0){ sh.getRange(1,1).setValue('id'); ic2=1; }
    if(ac2<=0){ sh.getRange(1,2).setValue('actiu'); ac2=2; }
    var rm={};
    for(var i=1;i<v.length;i++){ var m=String(v[i][ic2-1]||'').trim(); if(m) rm[m]=i+1; }
    var cfg=p.config||{};
    FIXED.forEach(function(id){
      var val=(cfg[id]===false)?'no':'si';
      if(rm[id]){ sh.getRange(rm[id],ac2).setValue(val); }
      else{ var lr=sh.getLastRow(); sh.getRange(lr+1,ic2).setValue(id); sh.getRange(lr+1,ac2).setValue(val); rm[id]=lr+1; }
    });
  }
  return true;
}

/* ============== HISTORIAL DE L'ALUMNE ============== */
function getAlumneHistorial_(p){
  var c=CONFIG.cols.usuaris; var student=null;
  readMainCached_('usuaris').rows.forEach(function(u){ if(String(u[c.id])===String(p.userId)) student=u; });
  if(!student) throw new Error('Alumne no trobat.');
  var nom=String(student[c.nom]).trim(), cognom=String(student[c.cognom]).trim(), classe=String(student[c.classe]).trim();
  var lletra=classe.charAt(classe.length-1).toUpperCase();
  var cm=CONFIG.cols.moduls; var modIdx={};
  readMainCached_('moduls').rows.forEach(function(m){ var codi=normVal_(m[cm.codi]); if(codi) modIdx[codi]={codi:codi,nom:String(m[cm.nom])}; });
  var ss=getSS_(); var registres=[];
  var key=(nom+'|'+cognom).toLowerCase();
  Object.keys(modIdx).forEach(function(codi){
    var sh=ss.getSheetByName(modTabName_(codi, lletra)); if(!sh) return;
    var T=CONFIG.modTab; var last=sh.getLastRow(); if(last<T.rosterRow) return;
    var roster=sh.getRange(T.rosterRow,T.nomCol,last-T.rosterRow+1,2).getValues();
    var studentRow=-1;
    for(var ri=0;ri<roster.length;ri++){
      if((String(roster[ri][0]||'').trim()+'|'+String(roster[ri][1]||'').trim()).toLowerCase()===key){ studentRow=T.rosterRow+ri; break; }
    }
    if(studentRow<0) return;
    readBlocks_(sh, true).forEach(function(b){
      var arr=b.notes?b.notes[studentRow]:null;
      if(!arr||!arr.some(function(v){return v!==''&&v!=null;})) return;
      // get sorted indicator codes to map position → codi
      var indInfos=[];
      try{
        var sortedInds=sortInds_(getActivityIndicators_({activitat:b.activitat,moduleCodi:codi}).indicators);
        indInfos=sortedInds.map(function(ind){ return {codi:ind.codi,text:ind.text,cap:ind.capacitatId||capOf_(ind.codi),paraules:ind.paraules||''}; });
      }catch(e){
        indInfos=b.inds.map(function(ind){ return {codi:ind.text||'?',text:ind.text||'',cap:ind.capId||'',paraules:''}; });
      }
      var ccAcc={};
      indInfos.forEach(function(ind,i){
        if(i>=arr.length) return;
        var v=arr[i]; if(v===''||v==null||String(v).toUpperCase()==='NA') return;
        var n=Number(v); if(isNaN(n)) return;
        if(!ccAcc[ind.cap]) ccAcc[ind.cap]={s:0,c:0};
        ccAcc[ind.cap].s+=n; ccAcc[ind.cap].c++;
      });
      var ccMeans={}; CAPS.forEach(function(cap){ var d=ccAcc[cap]; ccMeans[cap]=d?Math.round(d.s/d.c):null; });
      var inds=indInfos.map(function(ind,i){
        var v=i<arr.length?arr[i]:null; var grade=null;
        if(v!==''&&v!=null){ if(String(v).toUpperCase()==='NA') grade='NA'; else{ var n=Number(v); if(!isNaN(n)) grade=n; } }
        return {codi:ind.codi,text:ind.text,cap:ind.cap,grade:grade,paraules:ind.paraules||''};
      }).filter(function(x){return x.grade!==null;});
      var seen={}, hashtags=[];
      indInfos.forEach(function(ind){
        String(ind.paraules||'').trim().split(/[\s,]+/).forEach(function(w){
          var t=w.replace(/^#+/,'').trim(); if(!t) return;
          var key=t.toLowerCase(); if(!seen[key]){ seen[key]=true; hashtags.push('#'+t); }
        });
      });
      registres.push({moduleCodi:codi,moduleNom:modIdx[codi].nom,activitat:b.activitat,data:b.data,projNum:b.projNum,ccMeans:ccMeans,inds:inds,hashtags:hashtags.slice(0,3)});
    });
  });
  registres.sort(function(a,b){return String(b.data).localeCompare(String(a.data));});
  return {registres:registres};
}

/*************************************************************************
 * createModuleSheets() — crea el Google Sheet de cada mòdul sense ID,
 * amb les pestanyes i el roster, i escriu l'ID a la pestanya Mòduls.
 *************************************************************************/
/* crea/repara les pestanyes d'un mòdul dins el Sheet principal (idempotent) */
function ensureModuleTabs_(ss, codi, curs){
  var T=CONFIG.modTab;
  var orgName=modTabName_(codi, 'Org');
  var org=ss.getSheetByName(orgName); if(!org) org=ss.insertSheet(orgName);
  if(String(org.getRange(1,1).getValue()).trim()===''){
    org.getRange(1,1,1,3).setValues([['Usuaris/ Professorat implicat','Núm. Projecte','Nom projecte']]).setFontWeight('bold');
  }
  var actName=modTabName_(codi, 'Act');
  var act=ss.getSheetByName(actName); if(!act){ act=ss.insertSheet(actName); act.getRange(1,1,1,2).setValues([['Activitat','Codi Indicador']]).setFontWeight('bold'); }
  ['A','B','C'].forEach(function(letter){
    var clName=modTabName_(codi, letter);
    var cl=ss.getSheetByName(clName); if(!cl) cl=ss.insertSheet(clName);
    if(String(cl.getRange(T.titleRow,T.blockCol).getValue()).trim()===''){
      cl.getRange(T.titleRow,T.blockCol).setValue('LES CAPACITATS CLAU - PROGRÉS I AVALUACIÓ ANUAL').setFontWeight('bold');
    }
    ensureRoster_(cl, classStudents_(curs+letter));
    var resumName=modTabName_(codi, 'Resum '+letter);
    if(!ss.getSheetByName(resumName)) ss.insertSheet(resumName);
  });
}

/* ========================= BATCH ========================= */
function getAllClasses_(p) {
  var courses=getCourses_(p); var seen={}, out=[];
  courses.forEach(function(curs){ getClasses_({curs:curs}).forEach(function(c){ if(!seen[c]){seen[c]=true;out.push(c);} }); });
  return out.sort();
}
function getInitialData_(p) {
  var courses=getCourses_(p); var modsByCurs={}, allMods=[], seen={};
  courses.forEach(function(curs){
    var mods=getModules_({user:p.user, curs:curs}); modsByCurs[curs]=mods;
    mods.forEach(function(m){ if(!seen[m.codi]){seen[m.codi]=true;allMods.push(m);} });
  });
  return { courses:courses, modsByCurs:modsByCurs, allModules:allMods, allClasses:getAllClasses_(p), capabilities:getCapabilities_() };
}
function loginAndInit_(p) {
  var user=loginUser_(p);
  if(user.rol==='alumne'){
    try{ var cc=readClassesConfig_(); user.historialEnabled=!!(cc[user.classe]); }catch(e){ user.historialEnabled=false; }
  }
  var avisos=[]; try{ avisos=getAvisos_({user:user}); }catch(e){}
  return { user:user, initialData:getInitialData_({user:user}), avisos:avisos };
}

function createModuleSheets() {
  var c=CONFIG.cols.moduls; var mData=readMain_('moduls'); var ss=getSS_();
  mData.rows.forEach(function(m){
    var codi=normVal_(m[c.codi]), curs=normVal_(m[c.curs]);
    if(!codi) return;
    try{
      ensureModuleTabs_(ss, codi, curs);
      Logger.log('OK mòdul %s', codi);
    }catch(err){ Logger.log('ERROR mòdul %s: %s', codi, String(err)); }
  });
  Logger.log('createModuleSheets/reparació feta.');
}

/* ============== BUIDATGE (SEGUIMENT CC) ============== */
function columnToLetter_(col){
  var s=''; while(col>0){col--;s=String.fromCharCode(65+(col%26))+s;col=Math.floor(col/26);} return s;
}
function buildObservacions_(s,RCAPS,RNAMES){
  var obs=[], cells=s.cells;
  var insuf=RCAPS.filter(function(c){return cells[c]!=null&&cells[c]<=2;}).map(function(c){return RNAMES[c]+' ('+cells[c]+'/10)';});
  if(insuf.length) obs.push('Insuficient a: '+insuf.join(', '));
  var aval=RCAPS.filter(function(c){return cells[c]!=null;}).length;
  if(aval<=4) obs.push('Poques evidències ('+aval+'/7 avaluades)');
  if(aval>0&&s.nota!=null){
    var mean=RCAPS.reduce(function(a,c){return cells[c]!=null?a+cells[c]:a;},0)/aval;
    if(Math.abs(s.nota-mean)>1) obs.push('Desviació nota informe ('+s.nota.toFixed(1)+' vs mitjana CC '+mean.toFixed(2)+')');
  }
  if(s.nota!=null&&s.nota<5&&Math.round(s.nota)>=5) obs.push("L'arrodoniment puja a 5 una nota de "+s.nota.toFixed(1)+': decidir la nota final');
  if(s.nota==null) obs.push('Sense nota global');
  return obs.length?obs.join('. '):'-';
}
function buildDetallTab_(sh,students,classe,RCAPS,RNAMES,dateStr){
  var n=students.length, FR=5, LR=FR+n-1, AR=LR+1, COLS=17;
  sh.setFrozenRows(4); sh.setFrozenColumns(1);
  sh.getRange(1,1,1,COLS).merge().setValue('DETALL INDIVIDUAL PER CAPACITATS CLAU I SEGUIMENT — CLASSE '+classe)
    .setBackground('#1E293B').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(15).setHorizontalAlignment('center');
  sh.getRange(2,1,1,COLS).merge().setValue("Desglossament de les 7 Capacitats Clau, mitjana, nota de l'informe i alertes de revisió")
    .setBackground('#1E293B').setFontColor('#E2E8F0').setFontSize(10);
  var capHdrs=RCAPS.map(function(cap){return RNAMES[cap];});
  var allHdrs=['Alumnat'].concat(capHdrs,['Avaluades\n(/7)','Mitjana\nCC','Nota\nInforme','Desviació','Nota Final\n(Sencera)','Nivell Assoliment',"D'acord\namb la nota?",'Capacitats pendents','Observacions']);
  sh.getRange(4,1,1,COLS).setValues([allHdrs]).setBackground('#334155').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  for(var i=0;i<n;i++){
    var s=students[i]; var row=FR+i;
    sh.getRange(row,1).setValue((s.cognom+', '+s.nom).trim()).setHorizontalAlignment('left');
    RCAPS.forEach(function(cap,ci){
      var v=s.cells[cap]; sh.getRange(row,2+ci).setValue(v!=null?v:'').setHorizontalAlignment('center');
    });
    sh.getRange(row,9).setFormula('=COUNT(B'+row+':H'+row+')').setNumberFormat('0"/7"').setHorizontalAlignment('center');
    sh.getRange(row,10).setFormula('=IF(I'+row+'=0,"",AVERAGE(B'+row+':H'+row+'))').setNumberFormat('0.00').setHorizontalAlignment('center');
    sh.getRange(row,11).setValue(s.nota!=null?Number(s.nota.toFixed(1)):'').setNumberFormat('0.0').setHorizontalAlignment('center');
    sh.getRange(row,12).setFormula('=IF(OR(J'+row+'="",K'+row+'=""),"",K'+row+'-J'+row+')').setNumberFormat('+0.00;-0.00;0.00').setHorizontalAlignment('center');
    sh.getRange(row,13).setFormula('=IF(K'+row+'="","",ROUND(K'+row+',0))').setHorizontalAlignment('center');
    sh.getRange(row,14).setFormula('=IF(K'+row+'="","",IF(K'+row+'>=9,"Excel·lent",IF(K'+row+'>=6,"Notable",IF(K'+row+'>=5,"Aprovat","Insuficient"))))').setHorizontalAlignment('center');
    sh.getRange(row,15).setFormula('=IF(K'+row+'="","Revisar",IF(OR(COUNTIF(B'+row+':H'+row+',"<=2")>0,I'+row+'<=4,ABS(IF(OR(J'+row+'="",K'+row+'=""),0,K'+row+'-J'+row+'))>1,AND(K'+row+'<5,ROUND(K'+row+',0)>=5)),"Revisar","Sí"))').setHorizontalAlignment('center');
    var pend=RCAPS.filter(function(cap){return s.cells[cap]==null;}).map(function(cap){return RNAMES[cap];});
    sh.getRange(row,16).setValue(pend.length?pend.join(', '):'Cap').setHorizontalAlignment('left').setWrap(true);
    sh.getRange(row,17).setValue(buildObservacions_(s,RCAPS,RNAMES)).setHorizontalAlignment('left').setWrap(true);
    sh.getRange(row,1,1,COLS).setBackground(i%2===0?'#FFFFFF':'#F8FAFC').setFontSize(10);
  }
  sh.getRange(AR,1).setValue('MITJANA DEL GRUP').setFontWeight('bold').setBackground('#E2E8F0');
  for(var c=2;c<=13;c++){var cl=columnToLetter_(c); sh.getRange(AR,c).setFormula('=IF(COUNT('+cl+FR+':'+cl+LR+')=0,"",AVERAGE('+cl+FR+':'+cl+LR+'))').setBackground('#E2E8F0').setFontWeight('bold').setHorizontalAlignment('center');}
  sh.getRange(AR,14,1,4).setBackground('#E2E8F0'); sh.getRange(AR,1,1,COLS).setFontSize(10);
  sh.setColumnWidth(1,160); for(var cc=2;cc<=8;cc++) sh.setColumnWidth(cc,80);
  sh.setColumnWidth(9,70);sh.setColumnWidth(10,75);sh.setColumnWidth(11,75);sh.setColumnWidth(12,80);sh.setColumnWidth(13,75);sh.setColumnWidth(14,105);sh.setColumnWidth(15,85);sh.setColumnWidth(16,190);sh.setColumnWidth(17,240);
  var rules=[], capR=sh.getRange(FR,2,n,7);
  [[1,2,'#FEE2E2','#991B1B'],[3,5,'#FEF3C7','#92400E'],[6,8,'#DBEAFE','#1E40AF'],[9,10,'#DCFCE7','#166534']].forEach(function(x){rules.push(sh.newConditionalFormatRule().whenNumberBetween(x[0],x[1]).setBackground(x[2]).setFontColor(x[3]).setRanges([capR]).build());});
  var nR=sh.getRange(FR,14,n);
  [['Excel·lent','#DCFCE7','#166534'],['Notable','#DBEAFE','#1E40AF'],['Aprovat','#FEF3C7','#92400E'],['Insuficient','#FEE2E2','#991B1B']].forEach(function(x){rules.push(sh.newConditionalFormatRule().whenTextEqualTo(x[0]).setBackground(x[1]).setFontColor(x[2]).setRanges([nR]).build());});
  var oR=sh.getRange(FR,15,n);
  rules.push(sh.newConditionalFormatRule().whenTextEqualTo('Sí').setBackground('#DCFCE7').setFontColor('#166534').setRanges([oR]).build());
  rules.push(sh.newConditionalFormatRule().whenTextEqualTo('Revisar').setBackground('#FEF3C7').setFontColor('#92400E').setRanges([oR]).build());
  sh.setConditionalFormatRules(rules);
}
function buildResumTab_(sh,students,classe,RCAPS,RNAMES,dateStr,detallName){
  var n=students.length, dq="'"+detallName+"'", FR=5, LR=FR+n-1;
  var kR=dq+'!K'+FR+':K'+LR, oRef=dq+'!O'+FR+':O'+LR;
  var capCols={c1:'B',c3:'C',c5:'D',c4:'E',c2:'F',c6:'G',c7:'H'};
  sh.getRange(1,1,1,12).merge().setValue('INFORME DE SEGUIMENT DE CAPACITATS CLAU — CLASSE '+classe)
    .setBackground('#1E293B').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(15).setHorizontalAlignment('center');
  sh.getRange(2,1,1,12).merge().setValue("Data de l'informe: "+dateStr+" | Font: EAS CC | Anàlisi global del grup i per capacitat")
    .setBackground('#1E293B').setFontColor('#E2E8F0').setFontSize(10);
  sh.getRange(4,1,1,12).merge().setValue('Indicadors generals del grup').setBackground('#E2E8F0').setFontColor('#1E293B').setFontWeight('bold').setFontSize(11);
  sh.getRange(5,1,1,12).setValues([['Alumnat avaluat','','Mitjana global cicle','','Mediana global cicle','','Nota mín.','Nota màx.','% Aprovats (≥ 5,0)','','Casos per revisar','']])
    .setBackground('#F8FAFC').setFontColor('#64748B').setFontSize(9).setHorizontalAlignment('center');
  sh.getRange('A5:B5').merge(); sh.getRange('C5:D5').merge(); sh.getRange('E5:F5').merge(); sh.getRange('I5:J5').merge(); sh.getRange('K5:L5').merge();
  sh.getRange('A6:B6').merge().setFormula('=COUNT('+kR+')').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('C6:D6').merge().setFormula('=IFERROR(AVERAGE('+kR+'),"")').setNumberFormat('0.00').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('E6:F6').merge().setFormula('=IFERROR(MEDIAN('+kR+'),"")').setNumberFormat('0.00').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('G6').setFormula('=IFERROR(MIN('+kR+'),"")').setNumberFormat('0.0').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('H6').setFormula('=IFERROR(MAX('+kR+'),"")').setNumberFormat('0.0').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('I6:J6').merge().setFormula('=IFERROR(COUNTIF('+kR+',">=5")/COUNT('+kR+'),0)').setNumberFormat('0.0%').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange('K6:L6').merge().setFormula('=COUNTIF('+oRef+',"Revisar")').setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sh.getRange(8,1,1,12).merge().setValue('Anàlisi per capacitat clau').setBackground('#E2E8F0').setFontColor('#1E293B').setFontWeight('bold').setFontSize(11);
  sh.getRange(9,1,1,12).setValues([['Capacitat Clau','Avaluats','Pendents','% Cobertura','Mitjana Grup','Mediana','Mínima','Màxima','Excel·lent\n(9-10)','Notable\n(6-8)','Aprovat\n(3-5)','Insuficient\n(1-2)']])
    .setBackground('#334155').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  RCAPS.forEach(function(cap,ci){
    var row=10+ci, col=capCols[cap], cR=dq+'!'+col+FR+':'+col+LR;
    sh.getRange(row,1).setValue(RNAMES[cap]).setFontWeight('bold');
    sh.getRange(row,2).setFormula('=COUNT('+cR+')').setHorizontalAlignment('center');
    sh.getRange(row,3).setFormula('=COUNTBLANK('+cR+')').setHorizontalAlignment('center');
    sh.getRange(row,4).setFormula('=IFERROR(B'+row+'/(B'+row+'+C'+row+'),0)').setNumberFormat('0.0%').setHorizontalAlignment('center');
    sh.getRange(row,5).setFormula('=IF(B'+row+'=0,"—",IFERROR(AVERAGE('+cR+'),"—"))').setNumberFormat('0.00').setHorizontalAlignment('center');
    sh.getRange(row,6).setFormula('=IF(B'+row+'=0,"—",IFERROR(MEDIAN('+cR+'),"—"))').setNumberFormat('0.00').setHorizontalAlignment('center');
    sh.getRange(row,7).setFormula('=IF(B'+row+'=0,"—",IFERROR(MIN('+cR+'),"—"))').setHorizontalAlignment('center');
    sh.getRange(row,8).setFormula('=IF(B'+row+'=0,"—",IFERROR(MAX('+cR+'),"—"))').setHorizontalAlignment('center');
    sh.getRange(row,9).setFormula('=COUNTIFS('+cR+',">=9")').setBackground('#DCFCE7').setFontColor('#166534').setHorizontalAlignment('center');
    sh.getRange(row,10).setFormula('=COUNTIFS('+cR+',">=6",'+cR+',"<9")').setBackground('#DBEAFE').setFontColor('#1E40AF').setHorizontalAlignment('center');
    sh.getRange(row,11).setFormula('=COUNTIFS('+cR+',">=3",'+cR+',"<6")').setBackground('#FEF3C7').setFontColor('#92400E').setHorizontalAlignment('center');
    sh.getRange(row,12).setFormula('=COUNTIFS('+cR+',">=1",'+cR+',"<3")').setBackground('#FEE2E2').setFontColor('#991B1B').setHorizontalAlignment('center');
    sh.getRange(row,1,1,8).setBackground(ci%2===0?'#FFFFFF':'#F8FAFC').setFontSize(10);
    sh.getRange(row,9,1,4).setFontSize(10);
  });
  sh.getRange(17,1,1,12).setBackground('#E2E8F0').setFontWeight('bold');
  sh.getRange(17,1).setValue('MITJANA / TOTAL CAPACITATS');
  sh.getRange(17,2).setFormula('=IFERROR(AVERAGE(B10:B16),"")').setHorizontalAlignment('center');
  sh.getRange(17,3).setFormula('=IFERROR(AVERAGE(C10:C16),"")').setHorizontalAlignment('center');
  sh.getRange(17,4).setFormula('=IFERROR(AVERAGE(D10:D16),"")').setNumberFormat('0.0%').setHorizontalAlignment('center');
  sh.getRange(17,5).setFormula('=IFERROR(AVERAGEIF(E10:E16,"<>—"),"")').setNumberFormat('0.00').setHorizontalAlignment('center');
  sh.getRange(17,6).setFormula('=IFERROR(AVERAGEIF(F10:F16,"<>—"),"")').setNumberFormat('0.00').setHorizontalAlignment('center');
  sh.getRange(17,7).setFormula('=IFERROR(MINIFS(G10:G16,G10:G16,"<>—"),"")').setHorizontalAlignment('center');
  sh.getRange(17,8).setFormula('=IFERROR(MAXIFS(H10:H16,H10:H16,"<>—"),"")').setHorizontalAlignment('center');
  for(var c=9;c<=12;c++) sh.getRange(17,c).setFormula('=SUM('+columnToLetter_(c)+'10:'+columnToLetter_(c)+'16)').setHorizontalAlignment('center');
  var low=RCAPS.filter(function(cap){var av=students.filter(function(s){return s.cells[cap]!=null;}).length; return av/n<0.5;})
    .map(function(cap){var av=students.filter(function(s){return s.cells[cap]!=null;}).length; return RNAMES[cap]+' ('+av+'/'+n+' alumnes)';});
  if(low.length) sh.getRange(18,1,1,12).merge().setValue('⚠ Cobertura baixa: '+low.join(', ')+'. Les seves estadístiques són poc representatives.').setFontColor('#92400E').setBackground('#FEF3C7').setWrap(true).setFontSize(10);
  var b3=low.length?19:18, b3h=b3+1, totRow=b3h+5;
  sh.getRange(b3,1,1,12).merge().setValue('Distribució nota global de cicle').setBackground('#E2E8F0').setFontColor('#1E293B').setFontWeight('bold').setFontSize(11);
  sh.getRange(b3h,1,1,4).setValues([['Franja de qualificació','Rang','Núm. alumnes','% del grup']]).setBackground('#334155').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  [['Excel·lent','9,0 – 10,0','=COUNTIF('+kR+',">=9")','#DCFCE7','#166534'],
   ['Notable','6,0 – 8,9','=COUNTIFS('+kR+',">=6",'+kR+',"<9")','#DBEAFE','#1E40AF'],
   ['Aprovat','5,0 – 5,9','=COUNTIFS('+kR+',">=5",'+kR+',"<6")','#FEF3C7','#92400E'],
   ['Insuficient','< 5,0','=COUNTIF('+kR+',"<5")','#FEE2E2','#991B1B']].forEach(function(b,bi){
    var row=b3h+1+bi;
    sh.getRange(row,1).setValue(b[0]).setBackground(b[3]).setFontColor(b[4]).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(row,2).setValue(b[1]).setBackground(bi%2===0?'#FFFFFF':'#F8FAFC').setHorizontalAlignment('center');
    sh.getRange(row,3).setFormula(b[2]).setBackground(bi%2===0?'#FFFFFF':'#F8FAFC').setHorizontalAlignment('center');
    sh.getRange(row,4).setFormula('=IFERROR(C'+row+'/A6,0)').setNumberFormat('0.0%').setBackground(bi%2===0?'#FFFFFF':'#F8FAFC').setHorizontalAlignment('center');
  });
  sh.getRange(totRow,1).setValue('TOTAL GRUP AVALUAT').setFontWeight('bold').setBackground('#E2E8F0').setHorizontalAlignment('center');
  sh.getRange(totRow,2).setValue('0,0 – 10,0').setBackground('#E2E8F0').setHorizontalAlignment('center');
  sh.getRange(totRow,3).setFormula('=SUM(C'+(b3h+1)+':C'+(b3h+4)+')').setFontWeight('bold').setBackground('#E2E8F0').setHorizontalAlignment('center');
  sh.getRange(totRow,4).setFormula('=SUM(D'+(b3h+1)+':D'+(b3h+4)+')').setNumberFormat('0.0%').setFontWeight('bold').setBackground('#E2E8F0').setHorizontalAlignment('center');
  sh.setColumnWidth(1,180); sh.setColumnWidth(2,90); sh.setColumnWidth(3,90); sh.setColumnWidth(4,100);
  sh.setColumnWidth(5,100); sh.setColumnWidth(6,90); sh.setColumnWidth(7,80); sh.setColumnWidth(8,80);
  for(var cc=9;cc<=12;cc++) sh.setColumnWidth(cc,90);
}
function generateBuidatgeSheet_(p){
  var classe=String(p.classe||'').trim(); if(!classe) throw new Error('Cal especificar una classe.');
  var data=getClassGlobalResum_({classe:classe});
  if(!data.students||!data.students.length) throw new Error('Cap alumne amb dades per exportar.');
  var RCAPS=['c1','c3','c5','c4','c2','c6','c7'];
  var RNAMES={c1:'Organització',c3:'Responsabilitat',c5:'Treball en equip',c4:'Autonomia',c2:'Iniciativa',c6:'Relacions personals',c7:'Resolució de problemes'};
  var today=new Date();
  var dateStr=today.getDate()+'/'+(today.getMonth()+1)+'/'+today.getFullYear();
  var dateISO=Utilities.formatDate(today,Session.getScriptTimeZone(),'yyyy-MM-dd');
  var ss=SpreadsheetApp.create('Seguiment CC - Classe '+classe+' - '+dateISO);
  var detallName='Detall Alumnat (7 CC)', resumName='Resum Grup ('+classe+')';
  var detallSh=ss.getActiveSheet(); detallSh.setName(detallName);
  var resumSh=ss.insertSheet(resumName,0);
  buildDetallTab_(detallSh,data.students,classe,RCAPS,RNAMES,dateStr);
  buildResumTab_(resumSh,data.students,classe,RCAPS,RNAMES,dateStr,detallName);
  DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.EDIT);
  return ss.getUrl();
}

