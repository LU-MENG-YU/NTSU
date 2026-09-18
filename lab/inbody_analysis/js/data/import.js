(function (B) {
  'use strict';
  const schemas = {
    body: {name:['name','姓名','球員姓名'],analysis_date:['analysis_date','測量日期','日期','測試日期'],weight:['weight','體重'],pbf:['pbf','體脂率','體脂肪率'],ffmi:['ffmi','FFMI'],smm:['smm','骨骼肌','骨骼肌重','骨骼肌量']},
    players:{number:['背號','number'],name:['姓名','中文姓名'],foreign:['外援','foreign'],english:['NAME','英文姓名','english_name'],level:['分級','level'],position:['位置','position'],role:['功能／角色','功能/角色','角色','功能','role'],note:['備註','note']},
    seasons:{name:['賽季名稱／種類','賽季名稱/種類','賽季名稱','賽季種類','賽季','種類','season'],start:['開始','開始日期','開始年月','start'],end:['結束','結束日期','結束年月','end']}
  };
  const required = {body:['name','analysis_date'],players:['number','name','foreign','level','position'],seasons:['name','start','end']};
  B.Import = {schemas,required};
  const I = B.Import;
  I.FileQueue=class {
    constructor(){this.files=[];this.revision=0;}
    add(files){for(const file of files){const i=this.files.findIndex(f=>f.name===file.name);if(i<0)this.files.push(file);else this.files[i]=file;}this.revision++;}
    remove(i){this.files.splice(i,1);this.revision++;}
    clear(){this.files=[];this.revision++;}
  };
  I.fingerprint = buffer => {let hash=2166136261;for(const byte of new Uint8Array(buffer)){hash^=byte;hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');};
  I.parseImpedance = raw => {
    let s=B.clean(raw).replace(/＾/g,'^');
    if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))s=s.slice(1,-1).trim();
    else if(s.startsWith("'"))s=s.slice(1).trim();
    const parts=s.split('^'),values=parts.map(v=>B.number(v.replace(/^[\u200b\ufeff]+|[\u200b\ufeff]+$/g,'')));
    const good=parts.length===3&&values.every(B.valid);
    const reason=!s?'空白值':parts.length!==3?`讀到 ${parts.length} 段，應有 3 段，以 ^ 分隔`:`第 ${values.map((v,i)=>v===null?i+1:null).filter(Boolean).join('、')} 段不是有效數字`;
    return {values:good?values:[null,null,null],valid:good,reason:good?'':reason};
  };
  I.mapping = (headers,type) => Object.fromEntries(Object.entries(schemas[type]||{}).map(([key,aliases])=>[key,headers.find(h=>aliases.includes(h))||'']));
  I.detect = headers => {
    const candidates=Object.keys(schemas).filter(type=>required[type].every(k=>I.mapping(headers,type)[k]));
    return candidates.length===1?candidates[0]:'unknown';
  };
  I.matrix = (matrix,file,sheet,parseErrors=[]) => {
    const first=matrix.findIndex(row=>row.some(v=>B.clean(v)!==''));
    if(first<0) return null;
    const heads=matrix[first].map(v=>B.clean(v));
    const width=Math.max(heads.length,...matrix.map(r=>r.length));
    while(heads.length<width)heads.push('');
    const active=heads.map((h,i)=>({h,i})).filter(({h,i})=>h||matrix.slice(first+1).some(r=>B.clean(r[i])));
    if(active.some(x=>!x.h))throw Error(`${file} / ${sheet}：有資料的欄位缺少欄名。`);
    if(new Set(active.map(x=>x.h)).size!==active.length)throw Error(`${file} / ${sheet}：欄位名稱重複，請先修正。`);
    const headers=active.map(x=>x.h);
    const rows=matrix.slice(first+1).map((r,i)=>({raw:Object.fromEntries(active.map(x=>[x.h,r[x.i]??''])),source:{file,sheet,row:first+i+2}})).filter(r=>Object.values(r.raw).some(v=>B.clean(v)));
    const type=I.detect(headers);
    return {file,sheet,headers,rows,type,map:I.mapping(headers,type),parseErrors};
  };
  I.load = async (files,encoding='auto') => {
    const sets=[];
    for(const f of files){
      const buffer=await f.arrayBuffer();
      const before=sets.length;
      if(/\.csv$/i.test(f.name)){
        let text;
        if(encoding==='auto'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{text=new TextDecoder('big5').decode(buffer);}}
        else text=new TextDecoder(encoding,{fatal:true}).decode(buffer);
        const p=Papa.parse(text.replace(/^\uFEFF/,''),{header:false,skipEmptyLines:'greedy'});
        const severe=p.errors.filter(e=>e.code!=='UndetectableDelimiter');
        if(severe.length)throw Error(`${f.name}：CSV 結構錯誤：${severe.map(e=>e.message).join('；')}`);
        const s=I.matrix(p.data,f.name,'CSV',p.errors);if(s)sets.push(s);
      }else if(/\.xlsx?$/i.test(f.name)){
        const wb=XLSX.read(buffer,{type:'array',cellDates:false});
        for(const name of wb.SheetNames){
          const s=I.matrix(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''}),f.name,name);
          if(s)sets.push(s);
        }
      }else throw Error(`${f.name}：只支援 CSV、XLSX、XLS。`);
      const fileInfo={size:buffer.byteLength,lastModified:f.lastModified||null,fingerprint:I.fingerprint(buffer),readAt:new Date().toISOString()};
      sets.slice(before).forEach(s=>{s.fileInfo=fileInfo;});
    }
    if(!sets.length)throw Error('選取的檔案沒有可讀取的資料工作表。');
    return sets;
  };
  I.normalize = (sets,options={}) => {
    const report={counts:{},issues:[],excluded:[],total:0,included:0,duplicates:0};
    const warn=(code,source,field,message,rawValue='')=>{report.counts[code]=(report.counts[code]||0)+1;if(report.issues.length<5000)report.issues.push({code,...source,field,message,rawValue});};
    const selected=sets.filter(s=>s.type!=='ignore');
    for(const s of selected){
      if(!schemas[s.type])throw Error(`${s.file} / ${s.sheet}：請手動指定資料類型或忽略。`);
      for(const k of required[s.type])if(!s.map[k]||!s.headers.includes(s.map[k]))throw Error(`${s.file} / ${s.sheet}：請指定必要欄位 ${k}。`);
      const mapped=Object.values(s.map).filter(Boolean);
      if(new Set(mapped).size!==mapped.length)throw Error(`${s.file} / ${s.sheet}：同一欄位不可映射到多個用途。`);
    }
    for(const t of ['body','players'])if(!selected.some(s=>s.type===t))throw Error(`缺少${t==='body'?'身體組成':'球員基本'}資料。每次請重新選取完整來源檔。`);
    const roster=[],cn=new Map(),en=new Map();
    for(const s of selected.filter(s=>s.type==='players'))for(const r of s.rows){
      const p={raw:r.raw,source:r.source};
      for(const k of Object.keys(schemas.players))p[k]=B.clean(r.raw[s.map[k]]);
      if(required.players.some(k=>!p[k]))throw Error(`${s.file} / ${s.sheet} 第 ${r.source.row} 列：球員必要資料空白。`);
      p.foreign=p.foreign.toUpperCase();
      if(!['T','F'].includes(p.foreign))throw Error(`球員 ${p.name}：外援須填 T 或 F。`);
      if(p.foreign==='T'&&!p.english)throw Error(`球員 ${p.name}：外援為 T 時必須提供 NAME。`);
      const key=B.nameKey(p.name);
      if(cn.has(key))throw Error(`球員基本資料有重複／同名「${p.name}」，姓名匹配有歧義，請先修正名單。`);
      cn.set(key,p);roster.push(p);
      if(p.english){const alias=B.nameKey(p.english);if(en.has(alias))throw Error(`英文姓名 ${p.english} 對應多名球員，請先修正。`);en.set(alias,p);}
    }
    if(!roster.length)throw Error('球員名單沒有有效球員。');
    const seasons=[];
    for(const s of selected.filter(s=>s.type==='seasons'))for(const r of s.rows){
      const name=B.clean(r.raw[s.map.name]);
      try{const range=B.range(r.raw[s.map.start],r.raw[s.map.end]);if(!name)throw Error('賽季名称空白');seasons.push({name,...range,raw:r.raw,source:r.source});}
      catch(e){throw Error(`${s.file} / ${s.sheet} 第 ${r.source.row} 列：賽季 ${e.message}`);}
    }
    seasons.sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
    if(!seasons.length)warn('missing-seasons',{},'賽季','未提供賽季資料，時間圖暫無賽季背景，可用自訂期間分析。');
    const registry=B.coreMetrics.map(m=>({...m,type:'number'})),keys=new Set(registry.map(m=>m.key));
    const addMetric=m=>{if(!keys.has(m.key)){keys.add(m.key);registry.push({type:'number',...m});}};
    const rows=[],seen=new Set();
    const metadata=/^(?:id|no|number|sex|gender|birthday|birth_date|phone|serial|device_id|背號|性別|編號)$/i;
    for(const s of selected.filter(s=>s.type==='body')){
      const reversed=new Map(Object.entries(s.map).filter(([,v])=>v).map(([k,v])=>[v,k]));
      const columns=[];
      for(const h of s.headers){
        if(['name','analysis_date'].includes(reversed.get(h)))continue;
        const values=s.rows.map(r=>r.raw[h]);
        const impedance=values.some(v=>String(v).includes('^'))||/impedance|阻抗/i.test(h);
        const key=reversed.get(h)||h;
        if(impedance){
          const childKeys=[1,2,3].map(i=>`${key}_${i}`);
          if(childKeys.some(k=>s.headers.includes(k)||(keys.has(k)&&registry.find(m=>m.key===k)?.parent!==key)))throw Error(`阻抗拆分欄位 ${key}_1/2/3 與既有欄位衝突。`);
          childKeys.forEach((k,i)=>addMetric({key:k,label:`${h} · 波段 ${i+1}`,unit:'Ω',parent:key,band:i+1}));
          columns.push({h,key,impedance:true,childKeys});
        }else if(reversed.has(h)||(!metadata.test(h)&&values.some(v=>B.number(v)!==null))){
          addMetric({key,label:h,unit:'原始單位'});columns.push({h,key});
        }
      }
      for(const core of B.coreMetrics)if(!columns.some(c=>c.key===core.key))warn('missing-column',{file:s.file,sheet:s.sheet},core.key,`${core.label} 欄位未提供，顯示缺失值。`);
      for(const r of s.rows){
        report.total++;
        const signature=JSON.stringify(Object.keys(r.raw).sort().map(k=>[k,r.raw[k]]));
        if(seen.has(signature)){report.duplicates++;report.excluded.push({...r,reason:'完全相同資料列（重複）',problemFields:{[s.map.name]:r.raw[s.map.name],[s.map.analysis_date]:r.raw[s.map.analysis_date],...(r.raw.analysis_time?{analysis_time:r.raw.analysis_time}:{})}});continue;}
        seen.add(signature);
        const rawName=B.clean(r.raw[s.map.name]),nk=B.nameKey(rawName);
        const player=cn.get(nk)||en.get(nk),date=B.date(r.raw[s.map.analysis_date]);
        const reasons=[];if(!rawName)reasons.push('姓名空白');else if(!player)reasons.push('姓名不在基本名單');if(!date)reasons.push('測量日期無效');
        const values=Object.create(null);
        for(const c of columns){
          const raw=r.raw[c.h];
          if(c.impedance){
            const parsed=I.parseImpedance(raw);
            c.childKeys.forEach((k,i)=>{values[k]=parsed.values[i];});
            if(!parsed.valid)warn(B.clean(raw)?'invalid-impedance':'missing',r.source,c.h,parsed.reason+'；此欄三波段視為缺失，其他指標仍可分析。',raw);
          }else{
            values[c.key]=B.number(raw);
            if(values[c.key]===null)warn(B.clean(raw)?'invalid-number':'missing',r.source,c.h,B.clean(raw)?'非有效數字，分析視為缺失，原始值保留。':'空白值，不參與統計。',raw);
          }
        }
        if(reasons.length){const problemFields={};if(!rawName||!player)problemFields[s.map.name]=r.raw[s.map.name];if(!date)problemFields[s.map.analysis_date]=r.raw[s.map.analysis_date];report.excluded.push({...r,reason:reasons.join('；'),problemFields});warn('excluded',r.source,'姓名／日期',reasons.join('；'),Object.values(problemFields).join(' / '));continue;}
        rows.push({uid:'measurement-'+rows.length,name:player.name,date,values,raw:r.raw,source:r.source,match:cn.has(nk)?'中文姓名':'英文 NAME'});
      }
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));report.included=rows.length;
    if(!rows.length)warn('no-valid-rows',{},'資料集',`沒有可分析資料。請修正姓名與日期；共 ${report.total} 列、排除 ${report.excluded.length} 列。`);
    return {schema:B.SCHEMA,players:roster,seasons,rows,registry,metadata:{version:B.VERSION,importedAt:new Date().toISOString(),demo:!!options.demo,sources:selected.map(s=>({file:s.file,sheet:s.sheet,type:s.type,rows:s.rows.length,...s.fileInfo})),report}};
  };
})(BB);
