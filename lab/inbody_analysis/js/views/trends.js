(function(B){
  'use strict';
  const U=B.UI,V=B.Views=B.Views||{},A=B.Analysis,states=new Map();
  V.Trends={};
  V.Trends.render=(id,context)=>{
    const root=document.getElementById(id);if(!root)return;
    const e=B.state.engine,metric=key=>B.state.data.registry.find(m=>m.key===key),people=e.players(context.filter),scope=JSON.stringify([context.start,context.end,context.unit,context.name,context.filter]);
    let s=states.get(id);if(!s||s.data!==B.state.data){s={data:B.state.data,left:'weight',right:'ffmi',name:context.name||people[0]?.name||'',unit:context.unit||'month',start:context.start,end:context.end};states.set(id,s);}
    if(s.scope!==scope){s.scope=scope;s.start=context.start;s.end=context.end;s.unit=context.unit||'month';if(context.name)s.name=context.name;else if(!people.some(p=>p.name===s.name))s.name=people[0]?.name||'';}
    const filter={...context.filter,...(context.team?{}:{name:s.name})},historyStart=e.min<s.start?e.min:s.start,method=s.unit==='week'?'avg':context.method;
    const defs=A.windowPeriods(historyStart,s.start,s.end,s.unit);
    const ds=e.aggregate({filter,method,unit:s.unit,start:historyStart,end:s.end,periods:defs});
    const historyDS=s.unit==='week'?ds:e.aggregate({filter,method,start:e.min,end:s.end,unit:s.unit});
    const getSeries=(dataset,key)=>context.team?e.team(dataset,key):e.personal(dataset,s.name,key);
    const sets=[s.left,s.right].map(key=>({metric:metric(key),series:getSeries(ds,key).filter(r=>r.end>=s.start&&r.start<=s.end),history:getSeries(historyDS,key)}));
    const title=(context.team?'團隊':s.name||'球員')+'－'+metric(s.left).label+' × '+metric(s.right).label+' 雙軸折線';
    const summary=U.periodSummary(s.start,s.end,method)+' · '+(context.filter?.level||'不分級')+' · '+(context.filter?.position||'全部位置')+(context.team?' · 球員等權':'')+(s.unit==='week'?' · 週日～週六，首尾週依選取日期截斷':'');
    root.innerHTML=`<div class="dual-heading"><h2>雙指標折線比較</h2><p>左、右軸分別使用各指標的原始單位。</p></div><div class="toolbar dual-controls">${context.pickPlayer?U.select(id+'-person','選擇球員',B.sortPlayers(people).map(p=>({value:p.name,label:p.name+' · '+p.position})),s.name):''}${U.metricSelect(id+'-left','左 Y 軸',s.left)}${U.metricSelect(id+'-right','右 Y 軸',s.right)}${U.select(id+'-unit','時間單位',[{value:'day',label:'日'},{value:'week',label:'週（日～六）'},{value:'month',label:'月'},{value:'year',label:'年'}],s.unit)}<label>開始日期<input id="${id}-start" type="date" value="${s.start}"></label><label>結束日期<input id="${id}-end" type="date" value="${s.end}"></label><button id="${id}-apply" class="primary">更新折線圖</button></div>`;
    const table=U.table(['期間',metric(s.left).label+' ('+metric(s.left).unit+')','Δ'+metric(s.left).label,'Δ'+metric(s.left).label+'%','左軸實際基準',metric(s.right).label+' ('+metric(s.right).unit+')','Δ'+metric(s.right).label,'Δ'+metric(s.right).label+'%','右軸實際基準'],sets[0].series.map((a,i)=>{const b=sets[1].series[i];return [B.esc(a.label||a.period),B.fmt(a.value),U.change(a.delta),U.change(a.pct,true),B.esc(a.baseLabel||a.base||'—'),B.fmt(b.value),U.change(b.delta),U.change(b.pct,true),B.esc(b.baseLabel||b.base||'—')];}));
    root.insertAdjacentHTML('beforeend',U.metricBlock(id+'-plot',title,summary,table,{unit:s.unit,dual:true}));
    B.Charts.dualTimeline(id+'-plot',sets,{title,summary,unit:s.unit});
    U.wireMetric(id+'-left');U.wireMetric(id+'-right');
    U.bind(id+'-apply','click',()=>{try{
      const left=U.readMetric(id+'-left'),right=U.readMetric(id+'-right'),range=B.range(U.val(id+'-start'),U.val(id+'-end'));
      if(left===right)throw Error('請選擇兩個不同指標。');
      Object.assign(s,{left,right,start:range.start,end:range.end,unit:U.val(id+'-unit'),name:context.pickPlayer?U.val(id+'-person'):s.name});
      U.closeViewer();const plot=document.getElementById(id+'-plot');if(plot)Plotly.purge(plot);V.Trends.render(id,context);U.flushCharts(root);
    }catch(err){U.toast(err.message);}});
  };
})(BB);
