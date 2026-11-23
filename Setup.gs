/* Setup.gs — fitxer addicional, separat del Code.gs oficial d'EAS CC.
 * Apps Script comparteix l'àmbit global entre tots els .gs del projecte,
 * així que aquestes funcions poden cridar les de Code.gs directament. */

/*************************************************************************
 * setupNewSheet() — prepara un Google Sheet NOU (o repara un d'existent)
 * amb totes les pestanyes i capçaleres que necessita l'aplicació.
 *
 * Com fer-la servir:
 *   1. Obre l'editor d'Apps Script vinculat al Sheet nou
 *      (o canvia getSS_() perquè apunti al nou Sheet amb openById).
 *   2. Selecciona "setupNewSheet" al desplegable i prem "Executa".
 *   3. Revisa el registre d'execució (Logger).
 *
 * És idempotent: no esborra res. Si una pestanya ja existeix, només hi
 * afegeix les columnes de capçalera que hi faltin (al final).
 *************************************************************************/
function setupNewSheet(){
  var ss=getSS_();
  var S=CONFIG.sheets, C=CONFIG.cols;
  var log=[];
  function vals_(o){ return Object.keys(o).map(function(k){ return o[k]; }); }

  // 1) Pestanyes principals (capçaleres segons CONFIG.cols)
  var mainTabs=[
    { name:S.usuaris.name,    headers:vals_(C.usuaris) },
    { name:S.moduls.name,     headers:vals_(C.moduls) },
    { name:S.actInd.name,     headers:vals_(C.actInd) },
    { name:S.indicadors.name, headers:vals_(C.indicadors) }
  ];
  mainTabs.forEach(function(t){ log.push(ensureHeaderTab_(ss, t.name, t.headers)); });

  // 2) Usuari administrador inicial (només si Usuaris no té cap fila de dades)
  var shU=ss.getSheetByName(S.usuaris.name);
  if(shU.getLastRow()<2){
    var hU=shU.getRange(1,1,1,shU.getLastColumn()).getValues()[0].map(function(h){return String(h).trim();});
    var row=hU.map(function(){ return ''; });
    function setU(col,val){ var i=hU.indexOf(col); if(i>-1) row[i]=val; }
    setU(C.usuaris.id,'1'); setU(C.usuaris.nom,'Admin'); setU(C.usuaris.cognom,'EAS CC');
    setU(C.usuaris.username,'admin'); setU(C.usuaris.password,'1234'); setU(C.usuaris.rol,'admin');
    setU(C.usuaris.moduls,'tots');
    shU.getRange(2,1,1,row.length).setNumberFormat('@').setValues([row]);
    log.push('Usuari inicial creat: admin / 1234 (es demanarà canviar-la en entrar).');
  }

  // 3) Pesos per defecte (iguals per a les 7 CC, a 1r i a 2n)
  if(!ss.getSheetByName('Pesos')){
    var shP=ss.insertSheet('Pesos');
    var eq=Math.round(10000/CAPS.length)/100; // 14.29 (%), readPesos_ divideix per 100 si >1
    var w=CAPS.map(function(){ return eq; });
    shP.getRange(1,1,6,CAPS.length).setValues([
      ['1r curs'].concat(CAPS.slice(1).map(function(){return '';})),
      CAPS, w,
      ['2n curs'].concat(CAPS.slice(1).map(function(){return '';})),
      CAPS, w
    ]);
    shP.getRange(1,1).setFontWeight('bold'); shP.getRange(4,1).setFontWeight('bold');
    shP.getRange(2,1,1,CAPS.length).setFontWeight('bold'); shP.getRange(5,1,1,CAPS.length).setFontWeight('bold');
    log.push('Pestanya "Pesos" creada amb pesos iguals ('+eq+'% per CC).');
  } else log.push('Pestanya "Pesos" ja existia (no tocada).');

  // 4) Pestanyes que l'app ja sap crear soles
  ensureAvisosSheet_();  log.push('Pestanya "'+S.avisos.name+'" OK.');
  readClassesConfig_();  log.push('Pestanya "Classes" OK.');
  readExemplesConfig_(); log.push('Pestanya "Exemples" OK.');

  // 5) Pestanyes de cada mòdul (si ja hi ha mòduls a la pestanya Mòduls)
  var nMods=readMain_('moduls').rows.length;
  if(nMods){ createModuleSheets(); log.push('Pestanyes de '+nMods+' mòdul(s) creades/reparades.'); }
  else log.push('Encara no hi ha mòduls: omple "'+S.moduls.name+'" i torna a executar setupNewSheet() (o createModuleSheets()).');

  // 6) Elimina la pestanya buida per defecte ("Full 1", "Sheet1", ...)
  ss.getSheets().forEach(function(sh){
    if(/^(Full|Hoja|Sheet|Feuille)\s?1$/i.test(sh.getName()) && sh.getLastRow()===0 && ss.getSheets().length>1){
      log.push('Eliminada pestanya buida "'+sh.getName()+'".'); ss.deleteSheet(sh);
    }
  });

  // 7) Buida la caché perquè l'app llegeixi el Sheet nou
  clearAppCache();
  log.push('Caché buidada.');

  Logger.log('setupNewSheet() acabat:\n- '+log.join('\n- '));
  return log;
}

/* crea la pestanya si cal i hi assegura les capçaleres (afegeix les que faltin) */
function ensureHeaderTab_(ss, name, headers){
  var sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return 'Pestanya "'+name+'" creada.';
  }
  var lastCol=Math.max(sh.getLastColumn(),1);
  var cur=sh.getRange(1,1,1,lastCol).getValues()[0].map(function(h){return String(h).trim();});
  var missing=headers.filter(function(h){ return cur.indexOf(h)<0; });
  if(!missing.length) return 'Pestanya "'+name+'" ja correcta.';
  var start=(cur.join('')==='')?1:lastCol+1;
  sh.getRange(1,start,1,missing.length).setValues([missing]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return 'Pestanya "'+name+'": afegides columnes '+missing.join(', ')+'.';
}

/* buida la caché de l'app (útil després de canviar de Sheet o editar-lo a mà) */
function clearAppCache(){
  Object.keys(CONFIG.sheets).forEach(function(k){ bustMain_(k); });
}
