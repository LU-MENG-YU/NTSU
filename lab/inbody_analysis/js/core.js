(function (root) {
  'use strict';
  const B = root.BB = {VERSION: '1.1.0', SCHEMA: 1};
  B.clean = v => String(v ?? '').trim().replace(/\s+/gu, ' ');
  B.nameKey = v => B.clean(v).toLocaleLowerCase('en');
  B.valid = v => typeof v === 'number' && Number.isFinite(v);
  B.number = v => {
    if (B.valid(v)) return v;
    const s = B.clean(v);
    if (!s || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s); return B.valid(n) ? n : null;
  };
  B.fmt = (n, signed = false) => {
    if (!B.valid(n)) return '—';
    const r = Number(n.toFixed(2));
    return (signed && r > 0 ? '+' : '') + (Object.is(r, -0) ? 0 : r).toFixed(2);
  };
  B.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  B.DAY = 86400000;
  B.iso = ms => new Date(ms).toISOString().slice(0,10);
  B.date = (value, end = false, allowMonth = false) => {
    let s = B.clean(value);
    if (value instanceof Date && !isNaN(value)) s = value.toISOString().slice(0,10);
    if (typeof value === 'number' && root.XLSX) {
      const p = root.XLSX.SSF.parse_date_code(value);
      if (!p || p.y < 1900) return null;
      s = `${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;
    }
    const m = /^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
    if (!m || (!m[3] && !allowMonth) || (m[4] && (+m[4]>23 || +m[5]>59 || +(m[6]||0)>59))) return null;
    const y=+m[1], mo=+m[2], d=m[3]?+m[3]:(end?new Date(Date.UTC(y,mo,0)).getUTCDate():1);
    const ms=Date.UTC(y,mo-1,d), dt=new Date(ms);
    if(y<1900||y>9999||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d) return null;
    return B.iso(ms);
  };
  B.range = (start,end) => {const s=B.date(start,false,true),e=B.date(end,true,true);if(!s||!e||s>e)throw Error('請填入有效起訖日期，開始不得晚於結束。');return {start:s,end:e};};
  B.coreMetrics = [
    {key:'weight',label:'體重',unit:'kg'}, {key:'pbf',label:'體脂率',unit:'%'},
    {key:'ffmi',label:'FFMI',unit:'kg/m²'}, {key:'smm',label:'骨骼肌',unit:'kg'}
  ];
  B.positions = players => [...new Set(['投手','內野','外野','捕手',...players.map(p=>p.position)])].filter(x=>players.some(p=>p.position===x));
  B.sortPlayers = players => [...players].sort((a,b)=>B.positions(players).indexOf(a.position)-B.positions(players).indexOf(b.position)||a.number.localeCompare(b.number,'zh-Hant',{numeric:true})||a.name.localeCompare(b.name,'zh-Hant'));
  B.levels = players => [...new Set(['一軍','二軍',...players.map(p=>p.level)])];
  B.methodName = m => ({avg:'Average 平均',max:'Maximum 最大',min:'Minimum 最小'}[m]);
  B.measurementTime = row => {
    const v=row.raw?.analysis_time;
    if(typeof v==='number'&&v>=0&&v<1){const n=Math.round(v*86400)%86400;return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':');}
    return B.clean(v)||B.clean(row.raw?.analysis_date).split(/[ T]/)[1]||'未提供時間';
  };
  B.prepareData = data => {data.rows.forEach((row,i)=>{if(!row.uid)row.uid='measurement-'+i;});return data;};
  B.withMeasurementStatus = (data,uid,disabled) => {
    if(!data.rows.some(r=>r.uid===uid))throw Error('找不到這筆測量，請重新開啟球員檔案。');
    return {...data,rows:data.rows.map(r=>r.uid===uid?{...r,disabled:!!disabled,disabledAt:disabled?new Date().toISOString():null}:r),metadata:{...data.metadata,editedAt:new Date().toISOString()}};
  };
  B.preserveMeasurementStatus = (next,previous) => {
    if(!previous)return next;
    const signature=r=>JSON.stringify(Object.keys(r.raw).sort().map(k=>[k,r.raw[k]]));
    const stopped=new Map(previous.rows.filter(r=>r.disabled).map(r=>[signature(r),r]));
    return {...next,rows:next.rows.map(r=>{const old=stopped.get(signature(r));return old?{...r,disabled:true,disabledAt:old.disabledAt}:r;})};
  };
  B.state = {data:null,engine:null,marks:new Map(),chartJobs:[],chartData:new Map(),route:'import',cacheOK:false};
})(typeof window !== 'undefined' ? window : globalThis);
