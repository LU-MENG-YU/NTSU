(function(B){
  'use strict';
  const A=B.Analysis;
  A.rangeSummary=(engine,{filter={},startMonth,endMonth,keys=['weight','ffmi','pbf','smm']}={})=>{
    if(!/^\d{4}-\d{2}$/.test(startMonth)||!/^\d{4}-\d{2}$/.test(endMonth))throw Error('請選擇有效的起點與終點月份。');
    const range=B.range(startMonth,endMonth),first=B.range(startMonth,startMonth),last=B.range(endMonth,endMonth);
    const metrics=[...new Set(keys)].map(key=>engine.data.registry.find(m=>m.key===key));
    if(!metrics.length||metrics.some(m=>!m))throw Error('請選擇至少一項可分析的指標。');
    // Reuse the shared raw-measurement aggregation. Exact endpoints intentionally
    // do not use personal()/changes(), which search earlier valid periods.
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
          startCount:valid.filter(r=>r.date<=first.end).length,
          endCount:valid.filter(r=>r.date>=last.start).length,
          delta:A.delta(end,start).delta};
      }
      return {player,measurements:active.length,cells};
    });
    return {...range,startMonth,endMonth,filter:{...filter},metrics,rows};
  };
})(BB);
