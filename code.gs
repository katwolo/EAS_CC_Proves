/*************************************************************************
 * EAS CC — Backend (Code.gs) · v4
 * Emmagatzematge per mòdul: cada mòdul té el seu Google Sheet amb pestanyes
 *   "Organització Mòdul" · A/B/C (registres en blocs de columnes) · Resum A/B/C
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
    indicadors: { name:'Indicadors', headerRow:1 }
  },
  cols: {
    usuaris:   { id:'id', nom:'nom', cognom:'cognom', correu:'correu corporatiu',
                 username:'username', password:'password', rol:'rol', classe:'classe', moduls:'mòdul', pendents:'pendents', noMat:'no matriculat', desdoblaments:'desdoblaments', resetRequest:'reset request' },
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
      case 'login':                 return { ok:true, user: loginUser_(payload) };
      case 'getCourses':            return { ok:true, courses: getCourses_(payload) };
      case 'getModules':            return { ok:true, modules: getModules_(payload) };
      case 'getClasses':            return { ok:true, classes: getClasses_(payload) };
      case 'getProjects':           return { ok:true, projects: getProjects_(payload) };
      case 'getActivityTypes':      return { ok:true, types: getActivityTypes_(payload) };
      case 'getActivityIndicators': var ai_=getActivityIndicators_(payload); return { ok:true, indicators: ai_.indicators, paraules: ai_.paraules };
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
      case 'resetPassword':         return { ok:true, done: resetPassword_(payload) };
      case 'changePassword':        return { ok:true, done: changePassword_(payload) };
      case 'requestPasswordReset':  return { ok:true, done: requestPasswordReset_(payload) };
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

/* obre el Sheet d'un mòdul pel Codi */
function moduleRow_(codi){
  var c=CONFIG.cols.moduls; var found=null;
  readMain_('moduls').rows.forEach(function(r){ if(normVal_(r[c.codi])===normVal_(codi)) found=r; });
  return found;
}
function openModule_(codi){
  var c=CONFIG.cols.moduls; var m=moduleRow_(codi);
  if(!m) throw new Error('Mòdul no trobat: '+codi);
  var id=String(m[c.sheetId]).trim();
  if(!id) throw new Error('El mòdul '+codi+' no té ID de Sheet. Executa createModuleSheets().');
  return SpreadsheetApp.openById(id);
}

/* ========================= LOGIN ========================= */
function loginUser_(p){
  var username=String(p.username||'').trim(), password=String(p.password||'');
  if(!username) throw new Error('Cal indicar l\'usuari.');
  var c=CONFIG.cols.usuaris;
  var rows=readMain_('usuaris').rows;
  for(var i=0;i<rows.length;i++){ var u=rows[i];
    if(String(u[c.username]).trim()===username && String(u[c.password])===password){
      return { id:String(u[c.id]), nom:String(u[c.nom]), cognom:String(u[c.cognom]), correu:String(u[c.correu]||''),
        username:String(u[c.username]), rol:String(u[c.rol]), classe:String(u[c.classe]||''), moduls:parseModuls_(u[c.moduls]),
        mustChangePassword: String(u[c.password])==='1234' };
    }
  }
  throw new Error('Usuari o contrasenya incorrectes.');
}
function parseModuls_(raw){ raw=String(raw||'').trim(); if(!raw||raw.toLowerCase()==='tots') return []; return raw.split(',').map(normVal_).filter(Boolean); }

/* ============== CURS / CLASSE / MÒDUL ============== */
function modulesIndex_(){ var c=CONFIG.cols.moduls,map={}; readMain_('moduls').rows.forEach(function(r){ map[normVal_(r[c.codi])]={codi:normVal_(r[c.codi]),nom:String(r[c.nom]),curs:normVal_(r[c.curs])}; }); return map; }
function visibleModules_(user){ var all=modulesIndex_(),arr=Object.keys(all).map(function(k){return all[k];});
  if(user&&user.rol==='professor'&&user.moduls&&user.moduls.length){ var s={}; user.moduls.forEach(function(c){s[c]=true;}); arr=arr.filter(function(m){return s[m.codi];}); }
  return arr; }
function getCourses_(p){ var seen={},out=[]; visibleModules_(p.user).forEach(function(m){ if(m.curs&&!seen[m.curs]){seen[m.curs]=true;out.push(m.curs);} }); return out.sort(); }
function getModules_(p){ var curs=normVal_(p.curs); return visibleModules_(p.user).filter(function(m){return m.curs===curs;}).map(function(m){return {codi:m.codi,nom:m.nom};}); }
function getClasses_(p){ var curs=normVal_(p.curs),c=CONFIG.cols.usuaris,seen={},out=[];
  readMain_('usuaris').rows.forEach(function(u){ if(String(u[c.rol])!=='alumne')return; var cl=String(u[c.classe]).trim(); if(cl&&cl.charAt(0)===curs&&!seen[cl]){seen[cl]=true;out.push(cl);} });
  return out.sort(); }

/* ============== PROJECTES (Organització Mòdul) ============== */
function readOrg_(ss){
  var sh=ss.getSheetByName(CONFIG.modTab.ORG);
  if(!sh) throw new Error('El mòdul no té la pestanya "'+CONFIG.modTab.ORG+'".');
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
  var all=groupProjects_(readOrg_(ss).rows);
  var user=p.user||{};
  if(user.rol==='professor'){ all=all.filter(function(pr){ return pr.profs.indexOf(user.username)>-1; }); }
  return all.map(function(pr){ return { num:pr.num, nom:pr.nom, activitats:pr.activitats }; });
}
function getActivityTypes_(p){
  // Catàleg global "Activitats -> Indicadors" + activitats pròpies del mòdul
  var out={}; var globalRes=readActivityBlocks_();
  Object.keys(globalRes.blocks).forEach(function(a){ out[a]={activitat:a, nIndicadors:globalRes.blocks[a].length, font:'catàleg', paraules:globalRes.paraules[a]||''}; });
  if(p && p.moduleCodi){ try{ var ss=openModule_(p.moduleCodi); var modRes=readModuleActivities_(ss); var mod=modRes.map;
    Object.keys(mod).forEach(function(a){ out[a]={activitat:a, nIndicadors:mod[a].length, font:'mòdul', paraules:modRes.paraules[a]||''}; }); }catch(e){} }
  return Object.keys(out).map(function(a){ return out[a]; }).sort(function(a,b){ return a.activitat.localeCompare(b.activitat); });
}

/* ============== ACTIVITATS -> INDICADORS (catàleg) ============== */
function readActivityBlocks_(){
  var c=CONFIG.cols.actInd, blocks={}, paraules={}, current=null;
  readMain_('actInd').rows.forEach(function(r){
    var act=String(r[c.activitat]).trim(); if(act){current=act; if(!blocks[current])blocks[current]=[];}
    if(!current)return;
    var codi=normVal_(r[c.codi]); if(codi) blocks[current].push(codi);
    if(!paraules[current]){ var p=normVal_(r[c.paraules]); if(p) paraules[current]=p; }
  });
  return { blocks:blocks, paraules:paraules };
}
function indicatorCatalog_(){
  var c=CONFIG.cols.indicadors,map={};
  readMain_('indicadors').rows.forEach(function(r){ var codi=String(r[c.codi]).trim(); if(!codi)return;
    map[codi]={codi:codi, capacitatId:String(r[c.capacitatId]), capacitat:String(r[c.capacitat]), requisit:String(r[c.requisit]),
      text:String(r[c.text]), colorInd:String(r[c.colorInd]), colorCap:String(r[c.colorCap])}; });
  return map;
}
/* activitats pròpies del mòdul (pestanya "Activitats Mòdul" dins el Sheet del mòdul) */
function readModuleActivities_(ss){
  var sh=ss.getSheetByName(CONFIG.modAct); if(!sh) return {map:{}, paraules:{}};
  var v=sh.getDataRange().getValues(); var map={}, paraules={};
  for(var i=1;i<v.length;i++){
    var a=String(v[i][0]||'').trim(); var code=normVal_(v[i][1]); if(!a)continue;
    if(!map[a])map[a]=[]; if(code && map[a].indexOf(code)<0) map[a].push(code);
    if(!paraules[a]){ var p=normVal_(String(v[i][2]||'').trim()); if(p) paraules[a]=p; }
  }
  return {map:map, paraules:paraules};
}
function getActivityIndicators_(p){
  var act=String(p.activitat||'').trim(); var codes=null; var paraules='';
  if(p.moduleCodi){ try{ var ss=openModule_(p.moduleCodi); var res=readModuleActivities_(ss); var mod=res.map;
    if(mod[act]){ codes=mod[act]; paraules=res.paraules[act]||''; } }catch(e){} }
  if(!codes){ var ab=readActivityBlocks_(); codes=(ab.blocks[act])||[]; paraules=paraules||(ab.paraules[act]||''); }
  var cat=indicatorCatalog_();
  return { indicators:codes.map(function(codi){ return cat[codi]||{codi:codi,capacitat:'?',requisit:'',text:'(no trobat)',colorInd:'#cccccc',colorCap:'#999999',capacitatId:capOf_(codi)}; }), paraules:paraules };
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
  var sh=ss.getSheetByName(CONFIG.modAct);
  if(!sh){ sh=ss.insertSheet(CONFIG.modAct); sh.getRange(1,1,1,3).setValues([['Activitat','Codi Indicador','paraules clau']]).setFontWeight('bold'); }
  var nom=String(p.nom||'').trim(); if(!nom) throw new Error('Cal un nom d\'activitat.');
  var codes=(p.indicators||[]).map(normVal_).filter(Boolean);
  if(!codes.length) throw new Error('Tria almenys un indicador.');
  var kw=String(p.paraules||'').trim();
  // si ja existeix amb aquest nom, reescriu
  var v=sh.getDataRange().getValues();
  for(var i=v.length-1;i>=1;i--){ if(String(v[i][0]||'').trim()===nom) sh.deleteRow(i+1); }
  var rows=codes.map(function(code){ return [nom, code, kw]; });
  sh.getRange(sh.getLastRow()+1,1,rows.length,3).setValues(rows);
  return { nom:nom, n:codes.length };
}

/* ============== ALUMNES ============== */
function classStudents_(classe){
  var c=CONFIG.cols.usuaris;
  return readMain_('usuaris').rows
    .filter(function(u){return String(u[c.rol])==='alumne'&&String(u[c.classe]).trim()===classe;})
    .map(function(u){return {id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),classe:String(u[c.classe])};})
    .sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
}
function getStudents_(p){
  var classe=String(p.classe||'').trim(), moduleCodi=normVal_(p.moduleCodi);
  var grup=(p.grup!==undefined&&p.grup!==null)?Number(p.grup):null;
  var c=CONFIG.cols.usuaris, regular=[], pendents=[], noMatriculats=[], altreGrup=[];
  readMain_('usuaris').rows.forEach(function(u){
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
  var sheet=ss.getSheetByName(letter);
  if(!sheet) throw new Error('El mòdul no té la pestanya "'+letter+'".');
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
    activitat:String(p.activitat||''), data:String(p.data||''),
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

  rebuildResum_(ss, letter);
  return { width:width, missatge:'Registre desat al mòdul '+p.moduleCodi+' (pestanya '+letter+').' };
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
    var actName=act.split('  ·  ')[0]; var data=act.indexOf('·')>-1?(act.split('  ·  ')[1]||'').trim():'';
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
    blocks.push({ startCol:c, width:w, projNum:projNum, projNom:projNom, activitat:actName, data:data, inds:inds, notes:notes });
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
    setMerge_(sheet, T.rAct,  col, w, b.activitat+(b.data?('  ·  '+b.data):''), 'EFEFEF', false);
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
function rebuildResum_(ss, letter){
  var src=ss.getSheetByName(letter); if(!src) return;
  var res=ss.getSheetByName('Resum '+letter); if(!res){ res=ss.insertSheet('Resum '+letter); }
  var R=CONFIG.resTab, M=CONFIG.modTab;
  var blocks=readBlocks_(src, true); var roster=readRosterRows_(src);
  var projects=groupProjects_(readOrg_(ss).rows); // tots els projectes del mòdul

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
    var sh=ss.getSheetByName(letter); if(!sh) return;
    readBlocks_(sh).forEach(function(b){
      out.push({ moduleCodi:normVal_(p.moduleCodi), classeLetter:letter, startCol:b.startCol,
        projNum:b.projNum, projNom:b.projNom, activitat:b.activitat, data:b.data, nIndicadors:b.width });
    });
  });
  out.sort(function(a,b){return String(b.data).localeCompare(String(a.data));});
  return out;
}
function getBlockDetail_(p){
  var ss=openModule_(p.moduleCodi); var sh=ss.getSheetByName(p.classeLetter);
  var blocks=readBlocks_(sh, true); var blk=null; blocks.forEach(function(b){ if(b.startCol==Number(p.startCol)) blk=b; });
  if(!blk) throw new Error('Bloc no trobat.');
  var roster=readRosterRows_(sh);
  var c=CONFIG.cols.usuaris; var nameId={};
  readMain_('usuaris').rows.forEach(function(u){ if(String(u[c.rol])==='alumne') nameId[(String(u[c.nom])+'|'+String(u[c.cognom])).toLowerCase()]=String(u[c.id]); });
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
    projNum:blk.projNum, projNom:blk.projNom, activitat:blk.activitat, data:blk.data, grades:grades };
}
function deleteRegistre_(p){
  var ss=openModule_(p.moduleCodi); var sh=ss.getSheetByName(p.classeLetter);
  var blocks=readBlocks_(sh, true).filter(function(b){ return b.startCol!=Number(p.startCol); });
  writeBlocks_(sh, blocks);            // reescriu sense el bloc eliminat (sense esborrar columnes)
  rebuildResum_(ss, p.classeLetter);
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
  var src=ss.getSheetByName(letter); if(!src) return { students:[], classMean:{}, capNoms:RESUM_NOMS };
  var blocks=readBlocks_(src, true); var roster=readRosterRows_(src);
  var glob={}, classSum={}, classCnt={}; CAPS.forEach(function(c){classSum[c]=0;classCnt[c]=0;});
  roster.forEach(function(rr){ glob[rr.row]={}; });
  blocks.forEach(function(b){ if(!b.notes)return; b.inds.forEach(function(ind,ci){ var cap=ind.capId||capByName_(ind.cap); if(!cap)return;
    roster.forEach(function(rr){ var arr=b.notes[rr.row]; if(!arr)return; var v=arr[ci]; if(v===''||v==null||String(v).toUpperCase()==='NA')return; var n=Number(v); if(isNaN(n))return;
      if(!glob[rr.row][cap])glob[rr.row][cap]={s:0,c:0}; glob[rr.row][cap].s+=n; glob[rr.row][cap].c++; });
  });});
  // join amb Usuaris per obtenir id
  var cu=CONFIG.cols.usuaris; var idMap={};
  readMain_('usuaris').rows.forEach(function(u){
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
  readMain_('usuaris').rows.forEach(function(u){ if(String(u[c.id])===String(p.userId)) student=u; });
  if(!student) throw new Error('Alumne no trobat.');
  var nom=String(student[c.nom]).trim(), cognom=String(student[c.cognom]).trim(), classe=String(student[c.classe]).trim();
  var lletra=classe.slice(1); // 'A' de '1A' o '2A'
  var classe1r='1'+lletra, classe2n='2'+lletra;
  // Llegeix TOTS els mòduls (1r i 2n)
  var cm=CONFIG.cols.moduls; var allModuls=[];
  readMain_('moduls').rows.forEach(function(m){
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
  var students=readMain_('usuaris').rows
    .filter(function(u){return String(u[c.rol])==='alumne'&&String(u[c.classe]).trim()===classe;})
    .map(function(u){return {id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom])};})
    .sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
  if(!students.length) return {classe:classe,students:[],capNoms:RESUM_NOMS};
  var lletra=classe.slice(1); var classe1r='1'+lletra; var classe2n='2'+lletra;
  var cm=CONFIG.cols.moduls; var allModuls=[];
  readMain_('moduls').rows.forEach(function(m){
    var curs=normVal_(m[cm.curs]);
    if((curs==='1'||curs==='2')&&normVal_(m[cm.sheetId]))
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
  var src=ss.getSheetByName(letter); var nAl=(getStudents_({classe:p.classe,moduleCodi:p.moduleCodi}).regular||[]).length;
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
function listProjects_(p){ var ss=openModule_(p.moduleCodi); return groupProjects_(readOrg_(ss).rows); }
function getAllProfs_(){
  var c=CONFIG.cols.usuaris;
  return readMain_('usuaris').rows.filter(function(u){return String(u[c.rol])==='professor';})
    .map(function(u){return {username:String(u[c.username]), nom:String(u[c.nom])+' '+String(u[c.cognom])};});
}
function saveProject_(p){
  var ss=openModule_(p.moduleCodi); var org=readOrg_(ss); var sh=org.sheet;
  var num=normVal_(p.num);
  org.rows.filter(function(r){return r.num===num;}).map(function(r){return r.__row;}).sort(function(a,b){return b-a;}).forEach(function(rw){ sh.deleteRow(rw); });
  var profs=(p.professors||[]).join(', ');
  sh.appendRow([profs, num, String(p.nom||'')]);   // una fila per projecte (sense columna d'activitats)
  return { num:num };
}
function deleteProject_(p){
  var ss=openModule_(p.moduleCodi); var org=readOrg_(ss); var sh=org.sheet; var num=normVal_(p.num);
  org.rows.filter(function(r){return r.num===num;}).map(function(r){return r.__row;}).sort(function(a,b){return b-a;}).forEach(function(rw){ sh.deleteRow(rw); });
  return true;
}

/* ============== GESTIÓ D'ACTIVITATS PRÒPIES DEL MÒDUL ============== */
function listModuleActivities_(p){
  var ss=openModule_(p.moduleCodi);
  var res=readModuleActivities_(ss); var map=res.map;
  var cat=indicatorCatalog_();
  return Object.keys(map).map(function(nom){
    return { nom:nom, paraules:res.paraules[nom]||'', indicators:map[nom].map(function(codi){
      return cat[codi]||{codi:codi,text:'(no trobat)',colorInd:'#cccccc',capacitat:'?',capacitatId:capOf_(codi)};
    })};
  }).sort(function(a,b){ return a.nom.localeCompare(b.nom); });
}
function deleteActivity_(p){
  var ss=openModule_(p.moduleCodi);
  var sh=ss.getSheetByName(CONFIG.modAct); if(!sh) return true;
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
  return readMain_('moduls').rows.map(function(r){
    return {codi:normVal_(r[c.codi]),nom:String(r[c.nom]),curs:normVal_(r[c.curs])};
  }).filter(function(m){return m.codi;}).sort(function(a,b){return a.codi.localeCompare(b.codi);});
}

/* ============== GESTIÓ D'USUARIS (ADMIN) ============== */
function getAdminUsers_(){
  var c=CONFIG.cols.usuaris, admins=[], professors=[], alumnes=[];
  var modIdx=modulesIndex_();
  readMain_('usuaris').rows.forEach(function(u){
    var moduls=parseModuls_(u[c.moduls]).map(function(code){ return modIdx[code]||{codi:code,nom:code}; });
    var obj={id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),
      username:String(u[c.username]),rol:String(u[c.rol]),classe:String(u[c.classe]||''),
      moduls:moduls, resetRequest:String(u[c.resetRequest]||'')};
    var r=String(u[c.rol]);
    if(r==='admin') admins.push(obj);
    else if(r==='professor') professors.push(obj);
    else if(r==='alumne') alumnes.push(obj);
  });
  var bySort=function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);};
  admins.sort(bySort); professors.sort(bySort); alumnes.sort(bySort);
  return { admins:admins, professors:professors, alumnes:alumnes };
}
function resetPassword_(p){
  var c=CONFIG.cols.usuaris;
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
  // Escriu el timestamp a la columna M. El trigger checkPendingResets_
  // s'encarrega d'enviar el correu als admins quan detecta canvis.
  var c=CONFIG.cols.usuaris;
  var data=readMain_('usuaris'); var col=colIndex_(data.headers,c.resetRequest);
  if(col<0) throw new Error('No s\'ha trobat la columna reset request al full Usuaris.');
  var sh=getSS_().getSheetByName(CONFIG.sheets.usuaris.name); var found=false;
  var now=new Date();
  var dd=now.getDate(),mm=now.getMonth()+1,yy=now.getFullYear(),hh=now.getHours(),mi=now.getMinutes();
  var nowStr=(dd<10?'0':'')+dd+'/'+(mm<10?'0':'')+mm+'/'+yy+' '+(hh<10?'0':'')+hh+':'+(mi<10?'0':'')+mi;
  data.rows.forEach(function(u){
    if(String(u[c.username]).trim()===String(p.username||'').trim()){
      sh.getRange(u.__row,col).setValue(nowStr); found=true;
    }
  });
  if(!found) throw new Error('No s\'ha trobat cap usuari amb aquest nom d\'usuari.');
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

  MailApp.sendEmail({
    to:'nmarieges@ieb.cat,ibustos@ieb.cat',
    subject:'Sol·licituds pendents de restablir contrasenya EAS_CC',
    htmlBody:htmlBody
  });

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

/* ============== GESTIÓ DE DESDOBLAMENTS (ADMIN) ============== */
function checkModulGrups_(p){
  var c=CONFIG.cols.usuaris; var classe=String(p.classe||'').trim(); var moduleCodi=normVal_(p.moduleCodi);
  var hasGroups=false;
  readMain_('usuaris').rows.forEach(function(u){
    if(String(u[c.rol])!=='alumne'||String(u[c.classe]).trim()!==classe) return;
    var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
    if(desd[moduleCodi]) hasGroups=true;
  });
  return { hasGroups:hasGroups };
}
function getDesdoblaments_(p){
  var c=CONFIG.cols.usuaris; var classe=String(p.classe||'').trim(); var moduleCodi=normVal_(p.moduleCodi);
  var out=[];
  readMain_('usuaris').rows.forEach(function(u){
    if(String(u[c.rol])!=='alumne'||String(u[c.classe]).trim()!==classe) return;
    var desd=parseDesdoblaments_(String(u[c.desdoblaments]||''));
    out.push({id:String(u[c.id]),nom:String(u[c.nom]),cognom:String(u[c.cognom]),grup:desd[moduleCodi]||null});
  });
  out.sort(function(a,b){return (a.cognom+a.nom).localeCompare(b.cognom+b.nom);});
  return out;
}
function saveDesdoblaments_(p){
  var c=CONFIG.cols.usuaris; var moduleCodi=normVal_(p.moduleCodi);
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
    return { nom:nom, paraules:res.paraules[nom]||'', indicators:res.blocks[nom].map(function(codi){
      return cat[codi]||{codi:codi,text:'(no trobat)',colorInd:'#cccccc',capacitat:'?',capacitatId:capOf_(codi)};
    })};
  }).sort(function(a,b){ return a.nom.localeCompare(b.nom); });
}
function saveCatalogActivity_(p){
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
  var kw=String(p.paraules||'').trim();
  var rows=codes.map(function(codi){
    var ind=cat[codi]||{}; var capId=ind.capacitatId||capOf_(codi);
    return [nom, ind.capacitat||CAP_NOMS[capId]||capId, ind.text||'', codi, ind.colorInd||'', kw];
  });
  sh.getRange(sh.getLastRow()+1,1,rows.length,6).setValues(rows);
  return { nom:nom, n:codes.length };
}
function deleteCatalogActivity_(p){
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

/*************************************************************************
 * createModuleSheets() — crea el Google Sheet de cada mòdul sense ID,
 * amb les pestanyes i el roster, i escriu l'ID a la pestanya Mòduls.
 *************************************************************************/
/* crea/repara les pestanyes d'un Sheet de mòdul (idempotent) */
function ensureModuleTabs_(ss, curs){
  var T=CONFIG.modTab;
  var org=ss.getSheetByName(T.ORG); if(!org) org=ss.insertSheet(T.ORG);
  if(String(org.getRange(1,1).getValue()).trim()===''){
    org.getRange(1,1,1,3).setValues([['Usuaris/ Professorat implicat','Núm. Projecte','Nom projecte']]).setFontWeight('bold');
  }
  var act=ss.getSheetByName(CONFIG.modAct); if(!act){ act=ss.insertSheet(CONFIG.modAct); act.getRange(1,1,1,2).setValues([['Activitat','Codi Indicador']]).setFontWeight('bold'); }
  ['A','B','C'].forEach(function(letter){
    var cl=ss.getSheetByName(letter); if(!cl) cl=ss.insertSheet(letter);
    if(String(cl.getRange(T.titleRow,T.blockCol).getValue()).trim()===''){
      cl.getRange(T.titleRow,T.blockCol).setValue('LES CAPACITATS CLAU - PROGRÉS I AVALUACIÓ ANUAL').setFontWeight('bold');
    }
    ensureRoster_(cl, classStudents_(curs+letter));
    if(!ss.getSheetByName('Resum '+letter)) ss.insertSheet('Resum '+letter);
  });
}

function createModuleSheets() {
  var c=CONFIG.cols.moduls; var mData=readMain_('moduls'); var msh=getSS_().getSheetByName(CONFIG.sheets.moduls.name);
  var idCol=colIndex_(mData.headers, c.sheetId);
  mData.rows.forEach(function(m){
    var codi=normVal_(m[c.codi]), nom=String(m[c.nom]), curs=normVal_(m[c.curs]);
    var id=String(m[c.sheetId]).trim(); var ss;
    try{
      if(!id){ ss=SpreadsheetApp.create('Mòdul '+codi+' — '+nom); ss.getSheets()[0].setName(CONFIG.modTab.ORG); msh.getRange(m.__row,idCol).setValue(ss.getId()); }
      else { ss=SpreadsheetApp.openById(id); }
      ensureModuleTabs_(ss, curs);
      Logger.log('OK mòdul %s -> %s', codi, ss.getId());
    }catch(err){ Logger.log('ERROR mòdul %s: %s', codi, String(err)); }
  });
  Logger.log('createModuleSheets/reparació feta.');
}
