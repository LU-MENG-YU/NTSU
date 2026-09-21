(function(B){
  'use strict';
  const A=B.Analysis;
  A.rangeSummary=(engine,{filter={},unit='month',startPeriod=null,endPeriod=null,startMonth=null,endMonth=null,keys=['weight','ffmi','pbf','smm']}={})=>{
    if(!startPeriod||!endPeriod){
      if(!/^\d{4}-\d{2}$/.test(startMonth||'')||!/^\d{4}-\d{2}$/.test(endMonth||''))throw Error('請選擇有效的起點與終點月份。');
      startPeriod={...B.range(startMonth,startMonth),key:startMonth,label:startMonth};
      endPeriod={...B.range(endMonth,endMonth),key:endMonth,label:endMonth};unit='month';
    }
    const first=B.range(startPeriod.start,startPeriod.end),last=B.range(endPeriod.start,endPeriod.end);
    if(first.start>last.end)throw Error('起點期間不得晚於終點期間。');
    const range={start:first.start,end:last.end};
    const metrics=[...new Set(keys)].map(key=>engine.data.registry.find(m=>m.key===key));
    if(!metrics.length||metrics.some(m=>!m))throw Error('請選擇至少一項可分析的指標。');
    const ds=engine.aggregate({filter,method:'avg',...range,periods:[
      {key:'range',...range},{key:'first',...first},{key:'last',...last}
    ]});
    const rows=B.sortPlayers(ds.players).map(player=>{
      const active=(engine.byName.get(player.name)||[]).filter(r=>!r.disabled&&r.date>=range.start&&r.date<=range.end);
      const cells=Object.create(null);
      for(const m of metrics){
        const valid=active.filter(r=>B.valid(r.values[m.key]));
        const value=period=>ds.values.get(period)?.get(player.name)?.[m.key]??null;
        const start=value('first'),end=value('last');
        cells[m.key]={mean:value('range'),count:valid.length,start,end,
          startCount:valid.filter(r=>r.date>=first.start&&r.date<=first.end).length,
          endCount:valid.filter(r=>r.date>=last.start&&r.date<=last.end).length,
          delta:A.delta(end,start).delta};
      }
      return {player,measurements:active.length,cells};
    });
    return {...range,unit,filter:{...filter},metrics,rows,startPeriod:{...startPeriod,...first},endPeriod:{...endPeriod,...last},startLabel:startPeriod.label||startPeriod.key||first.start,endLabel:endPeriod.label||endPeriod.key||last.end};
  };
})(BB);
