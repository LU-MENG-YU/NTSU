(function (B) {
  'use strict';
  const A=B.Analysis={};
  A.reduce=(values,method='avg')=>{
    if(!['avg','max','min'].includes(method))throw Error('未知期間代表方式');
    let sum=0,count=0,max=-Infinity,min=Infinity;
    for(const v of values)if(B.valid(v)){sum+=v;count++;max=Math.max(max,v);min=Math.min(min,v);}
    return count?(method==='max'?max:method==='min'?min:sum/count):null;
  };
  A.median=values=>{const v=values.filter(B.valid).sort((a,b)=>a-b),n=v.length;return n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):null;};
  A.delta=(current,previous)=>!B.valid(current)||!B.valid(previous)?{delta:null,pct:null}:{delta:current-previous,pct:previous===0?null:(current-previous)/previous*100};
  A.measurementSummary=(rows,key)=>{const active=rows.filter(r=>!r.disabled&&B.valid(r.values[key]));return {total:rows.length,enabled:rows.filter(r=>!r.disabled).length,valid:active.length,min:A.reduce(active.map(r=>r.values[key]),'min'),max:A.reduce(active.map(r=>r.values[key]),'max')};};
  A.changes=series=>{
    let previous=null;
    return series.map(r=>{const out={...r,...A.delta(r.value,previous?.value),base:B.valid(r.value)?previous?.period||null:null,baseLabel:B.valid(r.value)?previous?.label||previous?.period||null:null,previous:B.valid(r.value)?previous?.value??null:null};if(B.valid(r.value))previous=r;return out;});
  };
  A.periodKey=(date,unit)=>unit==='week'?B.iso(Date.parse(date+'T00:00:00Z')-new Date(date+'T00:00:00Z').getUTCDay()*B.DAY):date.slice(0,unit==='day'?10:unit==='year'?4:7);
  A.periods=(start,end,unit='month')=>{
    const range=B.range(start,end);const p=[];let date=range.start;
    if(unit==='week'){
      let sunday=A.periodKey(range.start,'week');
      while(sunday<=range.end){
        const saturday=B.iso(Date.parse(sunday+'T00:00:00Z')+6*B.DAY),start=sunday<range.start?range.start:sunday,end=saturday>range.end?range.end:saturday;
        const weekLabel='W'+(p.length+1),dateLabel=start.replace(/-/g,'/')+'～'+end.replace(/-/g,'/');
        p.push({key:sunday,label:weekLabel+'（'+dateLabel+'）',weekLabel,dateLabel,start,end});
        sunday=B.iso(Date.parse(sunday+'T00:00:00Z')+7*B.DAY);
      }
      return p;
    }
    if(unit==='month')date=date.slice(0,7)+'-01';if(unit==='year')date=date.slice(0,4)+'-01-01';
    while(date<=range.end){
      const d=new Date(date+'T00:00:00Z'),period=A.periodKey(date,unit);
      const next=unit==='day'?new Date(+d+B.DAY):unit==='month'?new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)):new Date(Date.UTC(d.getUTCFullYear()+1,0,1));
      p.push({key:period,label:period,start:date,end:B.iso(+next-B.DAY)});date=B.iso(+next);
    }
    return p;
  };
  A.windowPeriods=(historyStart,start,end,unit='month')=>{
    if(unit!=='week')return A.periods(historyStart,end,unit).map(p=>({...p,start:p.end>=start&&p.start<start?start:p.start,end:p.end>end?end:p.end}));
    const visible=A.periods(start,end,'week'),previousEnd=B.iso(Date.parse(visible[0].key+'T00:00:00Z')-B.DAY);
    const history=historyStart<=previousEnd?A.periods(historyStart,previousEnd,'week').map(p=>({...p,label:p.dateLabel,weekLabel:undefined})):[];
    return [...history,...visible];
  };
  A.periodDetails=p=>p.weekLabel?{weekLabel:p.weekLabel,dateLabel:p.dateLabel}:{};
  A.customPeriods=(start,end,history=[])=>{
    // Arbitrary ranges have no implied predecessor. Use only explicitly supplied intervals.
    const current=B.range(start,end),earlier=history.map(p=>B.range(p.start,p.end));
    if(earlier.some(p=>p.end>=current.start))throw Error('較早比較區間必須在當期開始之前結束。');
    earlier.sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
    return [...earlier,current].map(p=>({...p,key:`${p.start}～${p.end}`,label:`${p.start}～${p.end}`})).filter((p,i,all)=>all.findIndex(x=>x.key===p.key)===i);
  };
  class Engine {
    constructor(data){
      this.data=data;this.byName=new Map(data.players.map(p=>[p.name,[]]));this.byYear=new Map();this.cache=new Map();
      for(const row of data.rows){this.byName.get(row.name)?.push(row);const y=row.date.slice(0,4);if(!this.byYear.has(y))this.byYear.set(y,[]);this.byYear.get(y).push(row);}
      this.min=data.rows[0]?.date;this.max=data.rows.at(-1)?.date;this.years=[...this.byYear.keys()].sort();
    }
    players(filter={}){return this.data.players.filter(p=>{const byLevel=filter.positionsByLevel;if(byLevel&&typeof byLevel==='object'){if(!Object.prototype.hasOwnProperty.call(byLevel,p.level))return false;if(!B.filterMatch(byLevel[p.level],p.position))return false;}else if(!B.filterMatch(filter.level,p.level)||!B.filterMatch(filter.position,p.position))return false;return !filter.name||p.name===filter.name;});}
    aggregate({filter={},unit='month',method='avg',start=this.min,end=this.max,periods=null}={}){
      if(unit==='week')method='avg';
      const cacheKey=JSON.stringify({filter,unit,method,start,end,periods});if(this.cache.has(cacheKey))return this.cache.get(cacheKey);
      const players=this.players(filter),names=new Set(players.map(p=>p.name));
      const defs=periods||A.periods(start,end,unit),byPeriod=new Map(defs.map(p=>[p.key,new Map()]));
      const direct=!periods;
      const candidates=filter.name?this.byName.get(filter.name)||[]:this.data.rows;
      for(const row of candidates){
        if(row.disabled||!names.has(row.name)||row.date<start||row.date>end)continue;
        const targets=direct?[A.periodKey(row.date,unit)]:defs.filter(p=>row.date>=p.start&&row.date<=p.end).map(p=>p.key);
        for(const key of targets){
          const group=byPeriod.get(key);if(!group)continue;if(!group.has(row.name))group.set(row.name,new Map());const cells=group.get(row.name);
          for(const [metric,value] of Object.entries(row.values))if(B.valid(value)){
            let a=cells.get(metric);if(!a){a={sum:0,n:0,max:-Infinity,min:Infinity};cells.set(metric,a);}a.sum+=value;a.n++;a.max=Math.max(a.max,value);a.min=Math.min(a.min,value);
          }
        }
      }
      const values=new Map();
      for(const [period,people] of byPeriod){const converted=new Map();for(const [name,cells] of people){const v=Object.create(null);for(const [metric,a]of cells)v[metric]=method==='max'?a.max:method==='min'?a.min:a.sum/a.n;converted.set(name,v);}values.set(period,converted);}
      const result={players,periods:defs,values,method};if(this.cache.size>=16)this.cache.delete(this.cache.keys().next().value);this.cache.set(cacheKey,result);return result;
    }
    personal(dataset,name,metric){return A.changes(dataset.periods.map(p=>({period:p.key,label:p.label,...A.periodDetails(p),start:p.start,end:p.end,value:dataset.values.get(p.key)?.get(name)?.[metric]??null})));}
    team(dataset,metric){return A.changes(dataset.periods.map(p=>{const vals=[...dataset.values.get(p.key).values()].map(v=>v[metric]).filter(B.valid);return{period:p.key,label:p.label,...A.periodDetails(p),start:p.start,end:p.end,value:A.reduce(vals),n:vals.length};}));}
    scatter(dataset,x,y,currentKey){
      const points=[],omitted=[];
      for(const player of dataset.players){
        const xs=this.personal(dataset,player.name,x.key),ys=this.personal(dataset,player.name,y.key);
        const idx=xs.findIndex(p=>p.period===currentKey);if(idx<0)continue;
        const val=(r,mode)=>mode==='delta'?r.delta:r.value;
        const make=i=>({player,period:xs[i].period,label:xs[i].label,x:val(xs[i],x.mode),y:val(ys[i],y.mode),xDetail:xs[i],yDetail:ys[i]});
        const cur=make(idx);if(!B.valid(cur.x)||!B.valid(cur.y)){omitted.push(player.name);continue;}
        for(let j=idx-1;j>=0;j--){const prev=make(j);if(B.valid(prev.x)&&B.valid(prev.y)){cur.prior=prev;break;}}
        points.push(cur);
      }
      // Center lines use the cohort actually present on this two-axis plot.
      const center=(axis)=>axis.mode==='delta'?0:(axis.center==='median'?A.median:A.reduce)(points.map(p=>p[axis===x?'x':'y']));
      return {points,omitted,centerX:center(x),centerY:center(y)};
    }
  }
  B.Engine=Engine;
})(BB);
