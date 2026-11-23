/* Demo.gs — fitxer addicional, separat del Code.gs oficial d'EAS CC.
 * Necessita les funcions setupNewSheet() i clearAppCache() de code.gs. */

/*************************************************************************
 * DADES DE PROVA (DEMO)
 *
 *   seedDemoData()  — omple un Sheet NOU amb un catàleg d'indicadors i
 *                     activitats, 4 mòduls, professorat, alumnat de les
 *                     classes 1A-2C i registres amb notes aleatòries.
 *   seedDemoNotes() — només genera (o continua generant) els registres
 *                     de notes. Si seedDemoData() s'atura per temps,
 *                     executa aquesta per acabar la feina.
 *
 * Contrasenya de tots els usuaris demo: "demo"
 *   Professorat: prof01 ... prof06   ·   Alumnat: alu1a01, alu2b05, ...
 *
 * Per seguretat NO s'executa si a "Usuaris" ja hi ha alumnes.
 * Fes-la servir només en un Sheet de proves (no al de producció!).
 *************************************************************************/
var DEMO = {
  pwd: 'demo',
  alumnesPerClasse: 8,
  classes: ['1A','1B','1C','2A','2B','2C'],
  moduls: [
    { codi:'1136', nom:'Context de la intervenció social (demo)', curs:'1' },
    { codi:'1139', nom:'Dinamització grupal (demo)',              curs:'1' },
    { codi:'1709', nom:'Animació sociocultural (demo)',           curs:'2' },
    { codi:'1710', nom:'Projecte d\'intervenció (demo)',          curs:'2' }
  ],
  profs: [
    { nom:'Marta',  cognom:'Vidal Puig',     moduls:['1136','1709'] },
    { nom:'Jordi',  cognom:'Serra Font',     moduls:['1136','1139'] },
    { nom:'Laia',   cognom:'Roca Ferrer',    moduls:['1139','1710'] },
    { nom:'Pau',    cognom:'Soler Camps',    moduls:['1709','1710'] },
    { nom:'Núria',  cognom:'Bosch Martí',    moduls:['1136','1710'] },
    { nom:'Xavier', cognom:'Pons Riera',     moduls:['1139','1709'] }
  ],
  noms: ['Aina','Pol','Júlia','Marc','Clara','Arnau','Ona','Biel','Laia','Nil','Martina','Àlex','Paula','Oriol','Carla','Hugo',
         'Emma','Joan','Mariona','Eric','Berta','Adrià','Noa','Guillem','Irene','Dani','Sara','Roger','Abril','Iker','Lucía','Mohamed',
         'Fatima','Youssef','Sofia','David','Alba','Pere','Mireia','Sergi','Anna','Ferran','Queralt','Bruno','Elsa','Gerard','Lola','Àngel'],
  cognoms: ['Garcia','Martínez','López','Puig','Vila','Sala','Costa','Ribas','Font','Pujol','Camps','Mas','Torres','Navarro','Serra',
            'Riera','Ruiz','Molina','Ortega','Casals','Prat','Coll','Vidal','Roig','Soler','Ferrer','Gil','Jiménez','Moreno','Bosch'],
  indicadors: {
    c1:['Planifica les tasques i fixa terminis','Gestiona el temps de manera eficient','Ordena i prepara els materials necessaris'],
    c2:['Proposa idees i millores','Pren la iniciativa davant situacions noves','Busca recursos i informació pel seu compte'],
    c3:['Compleix els compromisos i terminis','Té cura del material i dels espais','Assumeix les conseqüències de les seves accions'],
    c4:['Treballa sense necessitat de supervisió constant','Pren decisions adequades al seu nivell','Avalua el seu propi treball'],
    c5:['Col·labora i comparteix la feina','Respecta els rols i acords del grup','Contribueix a l\'assoliment dels objectius comuns'],
    c6:['Es comunica de forma respectuosa i assertiva','Escolta activament els altres','Gestiona els conflictes de manera constructiva'],
    c7:['Identifica el problema i les seves causes','Planteja alternatives de solució','Aplica i valora la solució escollida']
  },
  activitats: [
    { nom:'Debat a l\'aula',            inds:['c6.1','c6.2','c3.1','c2.1'] },
    { nom:'Treball en grup',            inds:['c5.1','c5.2','c1.1','c6.3'] },
    { nom:'Exposició oral',             inds:['c2.2','c4.1','c3.2','c6.1'] },
    { nom:'Projecte d\'intervenció',    inds:['c1.2','c1.3','c4.2','c7.1','c5.3'] },
    { nom:'Cas pràctic',                inds:['c7.2','c7.3','c4.3','c3.3'] },
    { nom:'Sortida / pràctica externa', inds:['c3.1','c6.2','c2.3','c5.1'] }
  ],
  projectes: ['Coneixem l\'entorn','Dinamitzem el barri'],
  registresPerGrup: 3,      // activitats avaluades per mòdul i grup
  maxMs: 4.5*60*1000         // marge abans del límit de 6 min d'Apps Script
};

function seedDemoData(){
  setupNewSheet();
  var ss=getSS_(), S=CONFIG.sheets, C=CONFIG.cols;
  var cu=C.usuaris;

  if(readMain_('usuaris').rows.some(function(u){ return String(u[cu.rol])==='alumne'; }))
    throw new Error('Ja hi ha alumnes a "Usuaris". seedDemoData() només s\'executa en un Sheet buit de proves.');

  // 1) Catàleg d'indicadors
  if(!readMain_('indicadors').rows.length){
    var ci=C.indicadors, rowsI=[];
    CAPS.forEach(function(cap){
      DEMO.indicadors[cap].forEach(function(txt,i){
        var o={}; o[ci.codi]=cap+'.'+(i+1); o[ci.capacitatId]=cap; o[ci.capacitat]=CAP_NOMS[cap]; o[ci.requisit]=(i===0?'Sí':'');
        o[ci.text]=txt; o[ci.colorCap]='#'+CAP_COLORS[cap]; o[ci.colorInd]='#'+CAP_SOFT[cap];
        rowsI.push(o);
      });
    });
    writeObjRows_(ss.getSheetByName(S.indicadors.name), rowsI);
  }

  // 2) Catàleg d'activitats
  if(!readMain_('actInd').rows.length){
    var ca=C.actInd, catI=DEMO.indicadors, rowsA=[];
    DEMO.activitats.forEach(function(a){
      a.inds.forEach(function(code,i){
        var cap=capOf_(code), o={};
        o[ca.activitat]=(i===0?a.nom:''); o[ca.capacitat]=CAP_NOMS[cap]; o[ca.indicador]=catI[cap][Number(code.split('.')[1])-1];
        o[ca.codi]=code; o[ca.color]='#'+CAP_SOFT[cap]; o[ca.paraules]='';
        rowsA.push(o);
      });
    });
    writeObjRows_(ss.getSheetByName(S.actInd.name), rowsA);
  }

  // 3) Mòduls
  if(!readMain_('moduls').rows.length){
    var cm=C.moduls;
    writeObjRows_(ss.getSheetByName(S.moduls.name), DEMO.moduls.map(function(m){
      var o={}; o[cm.codi]=m.codi; o[cm.nom]=m.nom; o[cm.curs]=m.curs; o[cm.sheetId]=''; return o; }));
  }

  // 4) Usuaris: professorat + alumnat
  var users=[];
  DEMO.profs.forEach(function(p,i){
    var o={}; o[cu.id]='P'+pad2_(i+1); o[cu.nom]=p.nom; o[cu.cognom]=p.cognom;
    o[cu.username]='prof'+pad2_(i+1); o[cu.correu]='prof'+pad2_(i+1)+'@demo.local';
    o[cu.password]=DEMO.pwd; o[cu.rol]='professor'; o[cu.moduls]=p.moduls.join(',');
    users.push(o);
  });
  var usedNames={}, n=0;
  DEMO.classes.forEach(function(cl){
    for(var k=1;k<=DEMO.alumnesPerClasse;k++){
      var nom, cog, key;
      do{ nom=pick_(DEMO.noms); cog=pick_(DEMO.cognoms)+' '+pick_(DEMO.cognoms); key=nom+'|'+cog; } while(usedNames[key]);
      usedNames[key]=true; n++;
      var user='alu'+cl.toLowerCase()+pad2_(k), o={};
      o[cu.id]='A'+('00'+n).slice(-3); o[cu.nom]=nom; o[cu.cognom]=cog; o[cu.classe]=cl;
      o[cu.username]=user; o[cu.correu]=user+'@demo.local'; o[cu.password]=DEMO.pwd; o[cu.rol]='alumne';
      // casos especials per veure totes les situacions
      if(cl==='2A' && k<=2) o[cu.pendents]='1136';   // alumnes de 2n amb un mòdul de 1r pendent
      if(cl==='1B' && k===1) o[cu.noMat]='1139';     // alumne no matriculat d'un mòdul
      users.push(o);
    }
  });
  writeObjRows_(ss.getSheetByName(S.usuaris.name), users);
  clearAppCache();

  // 5) Pestanyes de mòdul (amb roster) i projectes a "{codi} Org"
  createModuleSheets();
  DEMO.moduls.forEach(function(m){
    var org=ss.getSheetByName(modTabName_(m.codi,'Org'));
    if(org.getLastRow()>1) return;
    var profs=DEMO.profs.map(function(p,i){ return p.moduls.indexOf(m.codi)>-1?'prof'+pad2_(i+1):null; }).filter(Boolean).join(',');
    org.getRange(2,1,DEMO.projectes.length,3).setValues(DEMO.projectes.map(function(nom,i){ return [profs, String(i+1), nom]; }));
  });

  Logger.log('Catàleg, mòduls, %s usuaris i pestanyes creats. Generant notes...', users.length);
  seedDemoNotes();
}

function seedDemoNotes(){
  var t0=Date.now(), ss=getSS_(), cu=CONFIG.cols.usuaris;
  clearAppCache();
  var ability={}; // nivell de cada alumne (0..3) perquè les notes siguin coherents
  readMain_('usuaris').rows.forEach(function(u){
    if(String(u[cu.rol])==='alumne') ability[String(u[cu.id])]=0.6+Math.random()*2.4;
  });
  var modules=readMain_('moduls').rows.map(function(r){ return { codi:normVal_(r[CONFIG.cols.moduls.codi]), curs:normVal_(r[CONFIG.cols.moduls.curs]) }; });
  var acts=Object.keys(readActivityBlocks_().blocks);
  if(!acts.length) throw new Error('No hi ha activitats al catàleg.');
  var year=new Date().getMonth()>=8?new Date().getFullYear():new Date().getFullYear()-1; // inici del curs (setembre)
  var done=0, skipped=0;

  for(var mi=0;mi<modules.length;mi++){
    var m=modules[mi]; if(!m.codi) continue;
    var projs=groupProjects_(readOrg_(ss, m.codi).rows);
    for(var li=0;li<3;li++){
      var letter=['A','B','C'][li], classe=m.curs+letter;
      var sh=ss.getSheetByName(modTabName_(m.codi, letter));
      if(!sh){ continue; }
      if(readBlocks_(sh).length){ skipped++; continue; }   // ja té registres: no el toquem
      var st=getStudents_({classe:classe, moduleCodi:m.codi});
      var students=(st.regular||[]).concat(st.pendents||[]);
      if(!students.length) continue;
      if(Date.now()-t0>DEMO.maxMs){
        Logger.log('Aturat per temps (%s registres fets). Torna a executar seedDemoNotes() per continuar.', done);
        return;
      }
      var chosen=shuffle_(acts.slice()).slice(0, DEMO.registresPerGrup);
      chosen.forEach(function(act, ai){
        var inds=getActivityIndicators_({activitat:act, moduleCodi:m.codi}).indicators;
        var grades={};
        inds.forEach(function(ind){
          grades[ind.codi]={};
          students.forEach(function(s){ grades[ind.codi][s.id]=randomNota_(ability[s.id]||1.5); });
        });
        var pr=projs.length?projs[ai%projs.length]:null;
        var d=new Date(year, 8+ai*2+Math.floor(Math.random()*2), 1+Math.floor(Math.random()*27));
        saveRegistre_({ classe:classe, moduleCodi:m.codi, activitat:act,
          projecteNum:pr?pr.num:'', projecteNom:pr?pr.nom:'',
          data:Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          grades:grades, createdBy:'demo', grup:null });
        done++;
      });
      Logger.log('OK %s grup %s (%s alumnes)', m.codi, letter, students.length);
    }
  }
  Logger.log('seedDemoNotes() acabat: %s registres nous, %s grups ja tenien dades.', done, skipped);
}

/* nota aleatòria segons el nivell de l'alumne: 1 / 4 / 7 / 10 o NA (5%) */
function randomNota_(level){
  if(Math.random()<0.05) return 'NA';
  var x=level+(Math.random()+Math.random()+Math.random()-1.5)*1.2; // soroll ~normal
  var i=Math.max(0, Math.min(3, Math.round(x)));
  return [1,4,7,10][i];
}
/* escriu objectes {capçalera:valor} a partir de la primera fila buida, respectant l'ordre de columnes */
function writeObjRows_(sh, objs){
  if(!objs.length) return;
  var h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(x){return String(x).trim();});
  var rows=objs.map(function(o){ return h.map(function(k){ return o[k]!=null?String(o[k]):''; }); });
  sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setNumberFormat('@').setValues(rows);
}
function pad2_(n){ return ('0'+n).slice(-2); }
function pick_(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle_(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
