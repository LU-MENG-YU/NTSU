(function(B){
  'use strict';
  const A=B.Analysis,E=B.Extras={};
  E.monthLabel=month=>month.slice(0,4)+'/'+month.slice(5,7);
  E.monthTitle=months=>{
    const sorted=[...new Set(months)].sort();if(!sorted.length)return '尚未選擇月份';
    const contiguous=sorted.every((m,i)=>!i||A.periods(sorted[i-1],m,'month').length===2);
    return sorted.length===1?E.monthLabel(sorted[0]):E.monthLabel(sorted[0])+'～'+E.monthLabel(sorted.at(-1))+(contiguous?'':`（選取 ${sorted.length} 個月）`);
  };
  E.filterScatter=(result,x,y,hidden=new Set())=>{
    const points=result.points.filter(p=>!hidden.has(p.player.name));
    const center=(axis,key)=>axis.mode==='delta'?0:(axis.center==='median'?A.median:A.reduce)(points.map(p=>p[key]));
    return {...result,points,referencePoints:result.referencePoints?.filter(p=>!hidden.has(p.player.name)),centerX:center(x,'x'),centerY:center(y,'y')};
  };
  E.monthComparison=(engine,filter,method,x,y,base,current)=>{
    if(!/^\d{4}-\d{2}$/.test(base)||!/^\d{4}-\d{2}$/.test(current)||base>=current)throw Error('比較月必須早於當期月，且須為兩個不同月份。');
    const periods=[base,current].map(month=>({...B.range(month,month),key:month,label:month}));
    const ds=engine.aggregate({filter,method,periods,start:periods[0].start,end:periods[1].end});
    const axes=[x,y].map(a=>({...a,mode:'absolute'}));
    const result=engine.scatter(ds,...axes,current),reference=engine.scatter(ds,...axes,base);
    return {ds,visible:periods,active:periods[1],result:{...result,referencePoints:reference.points},base,current};
  };
  E.monthWeeks=month=>{
    if(!/^\d{4}-\d{2}$/.test(month))throw Error('月份格式錯誤。');
    const [year,monthNumber]=month.split('-').map(Number),monthStart=new Date(Date.UTC(year,monthNumber-1,1)),monthEnd=new Date(Date.UTC(year,monthNumber,0)),weeks=[];
    let sunday=new Date(+monthStart-monthStart.getUTCDay()*B.DAY),index=1;
    while(sunday<=monthEnd){
      const saturday=new Date(+sunday+6*B.DAY),start=B.iso(sunday),end=B.iso(saturday),weekLabel='W'+index++;
      const md=d=>(d.getUTCMonth()+1)+'/'+d.getUTCDate(),dateLabel=md(sunday)+'～'+md(saturday);
      weeks.push({key:start,month,index:String(index-1),weekLabel,dateLabel,label:weekLabel+'（'+dateLabel+'）',fullLabel:month+' '+weekLabel+'（'+dateLabel+'）',start,end});
      sunday=new Date(+sunday+7*B.DAY);
    }
    return weeks;
  };
  E.weekComparison=(engine,filter,x,y,baseMonth,baseWeek,currentMonth,currentWeek)=>{
    const pick=(month,week)=>E.monthWeeks(month).find(p=>p.index===String(week));
    const base=pick(baseMonth,baseWeek),current=pick(currentMonth,currentWeek);
    if(!base||!current)throw Error('請選擇有效的起始週與終點週。');
    if(base.end>=current.start)throw Error('起始週必須早於終點週，且兩者不得重疊。');
    const periods=[base,current].map(p=>({...p,label:p.fullLabel}));
    const ds=engine.aggregate({filter,method:'avg',periods,start:periods[0].start,end:periods[1].end});
    const axes=[x,y].map(a=>({...a,mode:'absolute'}));
    const result=engine.scatter(ds,...axes,current.key),reference=engine.scatter(ds,...axes,base.key);
    return {ds,visible:periods,active:periods[1],result:{...result,referencePoints:reference.points},base,current};
  };
  E.bounds=raw=>{
    const out={enabled:!!raw.enabled,color:/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:'#e6af32'};
    for(const key of ['xMin','xMax','yMin','yMax']){
      out[key]=B.clean(raw[key])===''?null:B.number(raw[key]);
      if(B.clean(raw[key])!==''&&out[key]===null)throw Error('標記框上下限須為有效數值，或留白表示不限制。');
    }
    for(const axis of ['x','y'])if(out[axis+'Min']!==null&&out[axis+'Max']!==null&&out[axis+'Min']>=out[axis+'Max'])throw Error(axis.toUpperCase()+' 軸下限須小於上限。');
    return out;
  };
  E.references=series=>{
    const values=series.map(r=>r.value).filter(B.valid);
    return {n:values.length,min:A.reduce(values,'min'),max:A.reduce(values,'max'),mean:A.reduce(values)};
  };
  E.trend=series=>{
    const valid=series.filter(r=>B.valid(r.value)&&B.date(r.start));if(valid.length<2)return null;
    const origin=Date.parse(valid[0].start+'T00:00:00Z'),xs=valid.map(r=>(Date.parse(r.start+'T00:00:00Z')-origin)/B.DAY),mx=A.reduce(xs),my=A.reduce(valid.map(r=>r.value));
    const denom=xs.reduce((sum,x)=>sum+(x-mx)**2,0);if(!denom)return null;
    const slope=xs.reduce((sum,x,i)=>sum+(x-mx)*(valid[i].value-my),0)/denom,intercept=my-slope*mx;
    return {n:valid.length,slope,intercept,origin,predict:date=>intercept+slope*(Date.parse(date+'T00:00:00Z')-origin)/B.DAY};
  };
  E.pointLabel=(row,unit,{values=true,deltas=true,compact=false}={})=>{
    if(!B.valid(row.value))return '';
    const d=new Date(row.start+'T00:00:00Z');
    const expected=unit==='week'?B.iso(Date.parse(A.periodKey(row.start,'week')+'T00:00:00Z')-7*B.DAY):unit==='year'?String(d.getUTCFullYear()-1):unit==='day'?B.iso(+d-B.DAY):B.iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).slice(0,7);
    const change='Δ'+B.fmt(row.delta,true)+(row.base&&row.base!==expected?(compact?'<br>較 '+B.esc(row.base):'（較 '+B.esc(row.base)+'）'):'');
    return [values?B.fmt(row.value):'',deltas?change:''].filter(Boolean).join('<br>');
  };
})(BB);
