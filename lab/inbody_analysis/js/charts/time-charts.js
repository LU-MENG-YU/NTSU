(function(B){
  'use strict';
  const C=B.Charts,E=B.Extras;
  C.timeOptions=id=>({seasons:true,values:true,deltas:true,weekDates:true,high:false,low:false,mean:false,trend:false,...C.preferences.get(id)});
  C.timeTicks=(series,unit,options={})=>{
    if(unit==='week')return {tickmode:'array',tickvals:series.map(r=>r.start),ticktext:series.map((r,i)=>{
      const sameYear=r.start.slice(0,4)===r.end.slice(0,4),dates=(sameYear?r.start.slice(5):r.start).replace(/-/g,'/')+'～'+(sameYear?r.end.slice(5):r.end).replace(/-/g,'/');
      return (r.weekLabel||'W'+(i+1))+(options.weekDates===false?'':'<br>'+dates);
    }),tickangle:0};
    if(unit!=='month')return series.length<=24?{tickmode:'array',tickvals:series.map(r=>r.start),ticktext:series.map(r=>r.label||r.period),tickangle:series.length>6?-40:0}:{tickformat:unit==='day'?'%m/%d':'%Y',nticks:12};
    const start=series[0]?.start,end=series.at(-1)?.end;if(!start||!end)return {tickmode:'array',tickvals:[],ticktext:[]};
    const months=B.Analysis.periods(start,end,'month');
    // Calendar ticks are independent of observations: a missing month gets no invented point.
    return {tickmode:'array',tickvals:months.map((r,i)=>i===0&&r.start<start?start:r.start),ticktext:months.map(r=>E.monthLabel(r.key)),tickangle:months.length>12?-90:months.length>6?-60:0};
  };
  // A clipped first week can be only one day. Do not use that short gap
  // to set pixels per day for the entire chart; stagger only nearby ticks.
  C.weekTickSpace=ticks=>ticks.ticktext.reduce((sum,text)=>sum+Math.max(34,C.timeTextSize(text).w+12),0);
  C.weekTickText=(ticks,range,width)=>{
    if(!ticks.tickvals.length||!range?.length)return [...ticks.ticktext];
    const [start,end]=range.map(timeMillis),lanes=[],lineCount=Math.max(1,...ticks.ticktext.map(text=>text.split(/<br\s*\/?\s*>/i).length));
    return ticks.ticktext.map((text,i)=>{
      const x=(timeMillis(ticks.tickvals[i])-start)/(end-start||1)*width;
      if(x<0||x>width)return text;
      const half=C.timeTextSize(text).w/2,left=x-half,right=x+half;
      let lane=lanes.findIndex(last=>last+8<=left);if(lane<0)lane=lanes.length;
      lanes[lane]=right;return '<br>'.repeat(lane*lineCount)+text;
    });
  };
  C.timeTextSize=text=>{
    const lines=String(text).split(/<br\s*\/?\s*>/i).map(s=>s.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,'?'));
    if(typeof document!=='undefined'&&!C.timeTextContext)C.timeTextContext=document.createElement('canvas').getContext('2d');
    const ctx=C.timeTextContext;if(ctx)ctx.font='11px Microsoft JhengHei, Arial, sans-serif';
    return {w:Math.ceil(Math.max(...lines.map(s=>ctx?ctx.measureText(s).width:Array.from(s).reduce((n,c)=>n+(c.charCodeAt(0)>255?11:6.6),0)))+10),h:lines.length*15+6};
  };
  const timeMillis=value=>typeof value==='number'?value:Date.parse(/^\d{4}-\d{2}-\d{2}[T ]/.test(value)&&!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value.replace(' ','T')+'Z':value);
  C.timeGeometry=(layout,traces,width,height,full)=>{
    const margin=full?{l:full._size.l,r:full._size.r,t:full._size.t,b:full._size.b}:layout.margin;
    const w=Math.max(120,width-margin.l-margin.r),h=Math.max(120,height-margin.t-margin.b),ranges={};
    for(const [axis,key] of [['y','yaxis'],['y2','yaxis2']]){
      const values=traces.filter(t=>(t.yaxis||'y')===axis).flatMap(t=>t.y||[]).filter(B.valid);
      const lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,pad=Math.max((hi-lo)*.15,.1);
      ranges[axis]=full?.[key]?.range||layout[key]?.range||[lo-pad,hi+pad];
    }
    const dates=traces.flatMap(t=>t.x||[]).filter(Boolean).map(timeMillis),xr=(full?.xaxis?.range||layout.xaxis.range||[Math.min(...dates),Math.max(...dates)]).map(timeMillis);
    return {width:w,height:h,project:(x,y,axis='y')=>({x:(timeMillis(x)-xr[0])/(xr[1]-xr[0]||1)*w,y:h-(y-ranges[axis][0])/(ranges[axis][1]-ranges[axis][0]||1)*h})};
  };
  C.timeObstacles=(annotations,g)=>annotations.filter(a=>!a.name?.startsWith('axis-title-')&&a.text&&a.yref==='paper').map(a=>{
    const size=C.timeTextSize(a.text),x=a.xref==='paper'?a.x*g.width:g.project(a.x,0).x,y=(1-a.y)*g.height;
    const left=x-(a.xanchor==='left'?0:a.xanchor==='right'?size.w:size.w/2),top=y-(a.yanchor==='top'?0:a.yanchor==='bottom'?size.h:size.h/2);
    return {left:left-3,right:left+size.w+3,top:top-3,bottom:top+size.h+3};
  });
  C.timeLabelAnnotations=(labels,g,obstacles=[])=>{
    const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const anchors=labels.map(label=>({...label,p:g.project(label.row.start,label.row.value,label.axis),size:C.timeTextSize(label.text)})).filter(a=>a.p.x>=0&&a.p.x<=g.width&&a.p.y>=0&&a.p.y<=g.height).sort((a,b)=>b.size.h-a.size.h||a.p.x-b.p.x||a.index-b.index);
    const points=anchors.map(a=>({left:a.p.x-7,right:a.p.x+7,top:a.p.y-7,bottom:a.p.y+7})),placed=[...obstacles],out=[];
    for(const a of anchors){
      const {w,h}=a.size,preferred=a.index%2?1:-1,step=h+7;
      let best=null,bestScore=Infinity;
      for(let ring=0;ring<=Math.ceil(g.height/step);ring++)for(const sign of [preferred,-preferred])for(const dx of [0,-18,18,-36,36,-60,60,-90,90]){
        const cx=Math.max(w/2+3,Math.min(g.width-w/2-3,a.p.x+dx)),cy=Math.max(h/2+3,Math.min(g.height-h/2-3,a.p.y+sign*(h/2+13+ring*step)));
        const box={left:cx-w/2-3,right:cx+w/2+3,top:cy-h/2-2,bottom:cy+h/2+2};
        const hits=placed.reduce((n,b)=>n+Number(intersects(box,b)),0),covers=points.reduce((n,b)=>n+Number(intersects(box,b)),0);
        const score=hits*1e7+covers*1e5+Math.abs(cx-a.p.x)*3+Math.abs(cy-a.p.y)+(sign===preferred?0:8);
        if(score<bestScore){bestScore=score;best={cx,cy,box};}
      }
      // Long gap notes near an edge may need space beyond the nearby month columns.
      if(bestScore>=1e5)for(let cy=h/2+3;cy<=g.height-h/2-3;cy+=12)for(let cx=w/2+3;cx<=g.width-w/2-3;cx+=12){
        const box={left:cx-w/2-3,right:cx+w/2+3,top:cy-h/2-2,bottom:cy+h/2+2};
        if(placed.some(b=>intersects(box,b))||points.some(b=>intersects(box,b)))continue;
        const score=Math.abs(cx-a.p.x)*3+Math.abs(cy-a.p.y);
        if(score<bestScore){bestScore=score;best={cx,cy,box};}
      }
      if(bestScore>=1e5)out.needsMoreRoom=true;
      placed.push(best.box);
      out.push({name:(a.values?'value-':'delta-')+a.index+'-'+a.row.period,x:a.row.start,y:a.row.value,xref:'x',yref:a.axis,text:a.text,ax:best.cx-a.p.x,ay:best.cy-a.p.y,axref:'pixel',ayref:'pixel',xanchor:'center',yanchor:'middle',showarrow:true,arrowhead:0,arrowwidth:.7,arrowcolor:a.color,standoff:6,font:{size:11,color:a.color},bgcolor:'rgba(255,255,255,.94)',borderpad:2});
    }
    return out;
  };
  // Plot-space anchors prevent label placement from changing the axes' autorange.
  C.timePaperAnnotations=(annotations,g)=>annotations.map(a=>{const p=g.project(a.x,a.y,a.yref);return {...a,xref:'paper',yref:'paper',x:p.x/g.width,y:1-p.y/g.height};});
  C.timeMinimumWidth=(meta,height)=>Math.ceil(Math.max(meta.tickSpace,meta.labelArea/(Math.max(160,height-meta.margin.t-meta.margin.b)*.38))+meta.margin.l+meta.margin.r);
  C.syncTimeDensity=(el,meta)=>{
    if(!el?.parentElement)return;
    const figure=el.parentElement;figure.classList.add('timeline-figure');meta.contextKey=figure.clientWidth+'|'+el.clientHeight;meta.fittedWidths=meta.fittedWidths||{};
    meta.minWidth=Math.max(C.timeMinimumWidth(meta,el.clientHeight||510),meta.fittedWidths[meta.contextKey]||0);el.style.minWidth=meta.minWidth+'px';
    let note=figure.querySelector('.time-density-note');if(!note){note=document.createElement('p');note.className='time-density-note';figure.prepend(note);}note.textContent=meta.unit==='week'?'週次或標籤較多，可左右捲動；也可隱藏週次日期區間以縮短圖寬。':'月份或標籤較多，可左右捲動；放大圖表可查看更多月份。';
    note.hidden=meta.minWidth<=figure.clientWidth+1;
  };
  C.reflowTimeLabels=async el=>{
    const item=B.state.chartData.get(el.id),meta=item?.time;if(!meta||!el._fullLayout?._size||item.timeReflowing)return;
    item.timeReflowing=true;
    try{for(let attempt=0;attempt<7;attempt++){
      if(!el.isConnected||!el._fullLayout?._size)return;
      C.syncTimeDensity(el,meta);
      if(Math.abs(el._fullLayout.width-el.clientWidth)>1)await Plotly.Plots.resize(el);
      if(!el._fullLayout?._size)return;
      const g=C.timeGeometry(el.layout,el.data,el.clientWidth,el.clientHeight,el._fullLayout),annotations=C.timeLabelAnnotations(meta.labels,g,C.timeObstacles(meta.staticAnnotations,g));
      if(annotations.needsMoreRoom&&attempt<6){meta.fittedWidths[meta.contextKey]=Math.ceil(el.clientWidth*1.2);continue;}
      await Plotly.relayout(el,{annotations:[...meta.staticAnnotations,...C.timePaperAnnotations(annotations,g)],...(meta.weekTicks?{'xaxis.ticktext':C.weekTickText(meta.weekTicks,el._fullLayout.xaxis.range,g.width)}:{})});return;
    }}finally{item.timeReflowing=false;}
  };
  C.timeExportFigure=(el,item,width,height)=>{
    if(!item.time)return el;
    const layout={...el.layout,width,height,margin:{...el.layout.margin}};
    // Preserve the current zoom while arranging labels for the exported canvas.
    for(const key of ['xaxis','yaxis','yaxis2'])if(el._fullLayout[key])layout[key]={...layout[key],range:[...el._fullLayout[key].range],autorange:false};
    const g=C.timeGeometry(layout,el.data,width,height),meta=item.time;
    if(meta.weekTicks)layout.xaxis={...layout.xaxis,ticktext:C.weekTickText(meta.weekTicks,layout.xaxis.range,g.width)};
    layout.annotations=[...meta.staticAnnotations,...C.timePaperAnnotations(C.timeLabelAnnotations(meta.labels,g,C.timeObstacles(meta.staticAnnotations,g)),g)];
    return {data:el.data,layout};
  };
  C.decorateTime=(id,traces,layout,sets,start,end,unit)=>{
    const options=C.timeOptions(id),labels=[];layout.annotations=layout.annotations||[];
    sets.forEach((set,index)=>{
      const {series,metric,color='#15799c',axis='y'}=set,history=(set.history||series).filter(r=>r.start<=end),stats=E.references(history),trend=E.trend(series);
      if(options.values||options.deltas)for(const row of series)if(B.valid(row.value))labels.push({row,index,axis,color,values:options.values,text:E.pointLabel(row,unit,{...options,compact:true})});
      for(const [key,value,label] of [['high',stats.max,'歷史最高'],['low',stats.min,'歷史最低'],['mean',stats.mean,'歷史平均（期間點）']])if(options[key]&&B.valid(value))traces.push({type:'scatter',mode:'lines',x:[start,end],y:[value,value],yaxis:axis,line:{color,width:1.3,dash:'dash'},opacity:.75,name:metric.label+' '+label+' '+B.fmt(value),hovertemplate:metric.label+' '+label+'：'+B.fmt(value)+' '+metric.unit+'<extra></extra>'});
      if(options.trend&&trend&&start&&end)traces.push({type:'scatter',mode:'lines',x:[start,end],y:[trend.predict(start),trend.predict(end)],yaxis:axis,line:{color,width:2,dash:'dash'},name:metric.label+' 趨勢（顯示期）',hovertemplate:'趨勢估計：%{y:.2f} '+metric.unit+'<extra></extra>'});
      set.referenceStats=stats;set.trendFit=trend;
    });
    const el=typeof document==='undefined'?null:document.getElementById(id),width=Math.max(200,(el?.clientWidth||900)-layout.margin.l-layout.margin.r);
    let legendRows=1,lineWidth=0;
    for(const trace of traces){const itemWidth=Array.from(trace.name||'').reduce((n,c)=>n+(c.charCodeAt(0)>255?11:6),45);if(lineWidth&&lineWidth+itemWidth>width){legendRows++;lineWidth=0;}lineWidth+=itemWidth;}
    // Anchor the legend to the canvas bottom so it cannot cross the date title.
    layout.legend={...layout.legend,yref:'container',y:.015,yanchor:'bottom'};
    layout.margin.b=Math.max(layout.margin.b,90+legendRows*24+(unit==='week'&&options.xTicks!==false?(options.weekDates===false?15:30):0));
    const ticks=C.timeTicks(sets[0].series,unit,options),tickSpace=options.xTicks===false?0:unit==='week'?C.weekTickSpace(ticks):unit==='month'?(ticks.tickvals?.length||0)*(ticks.tickangle===-90?18:ticks.tickangle===-60?34:60):0;
    const margin={...layout.margin,t:Math.max(layout.margin.t,options.titlesFollowAxes===false?0:128),r:Math.max(layout.margin.r,72)};
    const labelArea=labels.reduce((sum,a)=>{const size=C.timeTextSize(a.text);return sum+(size.w+6)*(size.h+4);},0);
    const meta=layout._timeMeta={labels,tickSpace,labelArea,margin,unit,...(unit==='week'?{weekTicks:ticks}:{})};meta.minWidth=C.timeMinimumWidth(meta,el?.clientHeight||510);C.syncTimeDensity(el,meta);
    const g=C.timeGeometry(layout,traces,Math.max(el?.clientWidth||900,meta.minWidth),el?.clientHeight||510);
    if(meta.weekTicks)layout.xaxis.ticktext=C.weekTickText(ticks,layout.xaxis.range,g.width);
    layout.annotations.push(...C.timePaperAnnotations(C.timeLabelAnnotations(labels,g,C.timeObstacles(layout.annotations,g)),g));
    return sets;
  };
  C.dualTimeline=(id,sets,{title,summary,unit='month'}={})=>{
    const options=C.timeOptions(id),series=sets[0].series,start=series[0]?.start,end=series.at(-1)?.end,traces=[],layout=C.base(title,summary);
    layout.margin={l:80,r:85,t:95,b:95};
    layout.xaxis={...layout.xaxis,type:'date',title:{text:unit==='week'?'週次':unit==='day'?'日期':unit==='year'?'年度':'月份'},...C.timeTicks(series,unit,options)};
    if(start)layout.xaxis.range=[B.iso(Date.parse(start)-B.DAY*2),B.iso(Date.parse(end)+B.DAY*2)];
    const colors=['#15799c','#bb591a'];
    const configured=sets.map((set,i)=>({...set,color:colors[i],axis:i?'y2':'y'}));
    configured.forEach(({series,metric,color,axis},index)=>{
      layout[index?'yaxis2':'yaxis']={...layout.yaxis,title:{text:metric.label+' ('+metric.unit+')',font:{color}},tickfont:{color},...(index?{overlaying:'y',side:'right',showgrid:false}:{}),automargin:true};
      traces.push({type:'scatter',mode:'lines+markers',x:series.map(r=>r.start),y:series.map(r=>r.value),yaxis:axis,connectgaps:false,line:{color,width:2},marker:{color,size:7},name:(index?'右軸 ':'左軸 ')+metric.label,text:series.map(r=>B.esc(r.label||r.period)+'<br>'+B.fmt(r.value)+' '+metric.unit+'<br>Δ'+metric.label+' '+B.fmt(r.delta,true)+'<br>實際基準 '+B.esc(r.baseLabel||r.base||'—')),hovertemplate:'%{text}<extra></extra>'});
      const x=[],y=[];let previous=-1;series.forEach((r,i)=>{if(B.valid(r.value)){if(previous>=0&&i>previous+1){x.push(series[previous].start,r.start,null);y.push(series[previous].value,r.value,null);}previous=i;}});
      if(x.length)traces.push({type:'scatter',mode:'lines',x,y,yaxis:axis,line:{color,width:1.5,dash:'dot'},name:metric.label+' 跨缺失期間',hoverinfo:'skip'});
    });
    if(start){Object.assign(layout,C.seasons(start,end));layout._seasonAnnotations=layout.annotations;if(!options.seasons)layout.annotations=[];}
    C.decorateTime(id,traces,layout,configured,start,end,unit);
    if(!configured.some(s=>s.series.some(r=>B.valid(r.value))))layout.annotations.push({xref:'paper',yref:'paper',x:.5,y:.5,text:'此期間沒有有效指標資料',showarrow:false});
    const rows=series.map((r,i)=>{
      const out={期間:r.label||r.period,開始:r.start,結束:r.end,分析條件:summary};
      for(const [index,set] of configured.entries()){
        const row=set.series[i],prefix=index?'右軸':'左軸';
        Object.assign(out,{[prefix+'指標']:set.metric.key,[prefix+'單位']:set.metric.unit,[prefix+'值']:B.fmt(row.value),[prefix+'Δ']:B.fmt(row.delta,true),[prefix+'Δ%']:B.fmt(row.pct,true),[prefix+'實際基準']:row.baseLabel||row.base||'—',...(row.n===undefined?{}:{[prefix+'人數']:row.n})});
        for(const [option,key] of [['high','max'],['low','min'],['mean','mean']])if(options[option])out[prefix+({high:'歷史最高',low:'歷史最低',mean:'歷史期間點平均'}[option])]=B.fmt(set.referenceStats[key]);
        if(options.trend)out[prefix+'趨勢估計']=B.fmt(set.trendFit?.predict(row.start));
      }return out;
    });
    C.mount(id,traces,layout,rows,title);const item=B.state.chartData.get(id);if(item)item.redraw=()=>C.dualTimeline(id,sets,{title,summary,unit});
  };
})(BB);
