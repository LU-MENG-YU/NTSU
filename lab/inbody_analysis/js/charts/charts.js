(function(B){
  'use strict';
  const C=B.Charts={},U=()=>B.UI;
  C.preferences=new Map();
  C.axisOptions=id=>({xTitle:true,yTitle:true,y2Title:true,xTicks:false,yTicks:false,y2Ticks:false,...C.preferences.get(id)});
  C.axisTitleAnnotations=(layout,meta)=>{
    if(!meta?.enabled)return [];
    const common={xref:'paper',yref:'paper',showarrow:false,font:{size:13,color:'#243e53'},bgcolor:'rgba(255,255,255,.94)',borderpad:3};
    const fraction=(value,range)=>B.valid(value)&&range?.length===2&&range[1]!==range[0]?Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0]))):.5;
    const multiline=text=>text.replace(/ \(/,'<br>(').replace(/ · /g,'<br>');
    if(meta.kind==='scatter'){
      const x=fraction(meta.centerX,layout.xaxis.range),y=fraction(meta.centerY,layout.yaxis.range);
      return [
        {...common,name:'axis-title-x',text:multiline(meta.x),x:0,y,xshift:-48,xanchor:'right',yanchor:'middle',align:'right'},
        {...common,name:'axis-title-y',text:multiline(meta.y),x,y:0,yshift:-52,xanchor:x<.15?'left':x>.85?'right':'center',yanchor:'top'}
      ].filter(a=>a.name==='axis-title-x'?meta.xTitle!==false:meta.yTitle!==false);
    }
    return [
      {...common,name:'axis-title-x',text:meta.x,x:1,y:0,xshift:12,xanchor:'left',yanchor:'top',yshift:-20},
      {...common,name:'axis-title-y',text:multiline(meta.y),x:0,y:1,yshift:12,xanchor:'left',yanchor:'bottom',align:'left',font:{...common.font,...meta.yFont}},
      ...(meta.y2?[{...common,name:'axis-title-y2',text:multiline(meta.y2),x:1,y:1,yshift:12,xanchor:'right',yanchor:'bottom',align:'right',font:{...common.font,...meta.y2Font}}]:[])
    ].filter(a=>meta[a.name==='axis-title-x'?'xTitle':a.name==='axis-title-y'?'yTitle':'y2Title']!==false);
  };
  C.placeAxisTitles=(id,layout,guide={})=>{
    if(layout._axisTitleMeta)return layout._axisTitleMeta;
    const options=C.axisOptions(id),meta={enabled:options.titlesFollowAxes!==false,xTitle:options.xTitle,yTitle:options.yTitle,y2Title:options.y2Title,kind:guide.kind||'time',x:layout.xaxis?.title?.text||'',y:layout.yaxis?.title?.text||'',y2:layout.yaxis2?.title?.text||'',yFont:layout.yaxis?.title?.font,y2Font:layout.yaxis2?.title?.font,...guide};
    for(const [axis,key] of [['xaxis','x'],['yaxis','y'],['yaxis2','y2']])if(layout[axis]){
      layout[axis].showticklabels=options[key+'Ticks'];
      if(options[key+'Title']===false&&layout[axis].title)layout[axis].title={...layout[axis].title,text:''};
    }
    layout._axisTitleMeta=meta;if(!meta.enabled)return meta;
    for(const key of ['xaxis','yaxis','yaxis2'])if(layout[key]?.title)layout[key].title={...layout[key].title,text:''};
    if(meta.kind==='scatter'){
      const label=meta.x.replace(/&[^;]+;/g,'?').split(/ \(| · /)[0],width=Array.from(label).reduce((n,c)=>n+(c.charCodeAt(0)>255?13:7),0);
      layout.margin.l=Math.max(layout.margin.l,Math.min(240,width+64));layout.margin.b=Math.max(layout.margin.b,126);
      layout.legend={...layout.legend,yref:'container',y:.015,yanchor:'bottom'};
    }else{layout.margin.t=Math.max(layout.margin.t,128);layout.margin.r=Math.max(layout.margin.r,72);}
    layout.annotations=[...(layout.annotations||[]),...C.axisTitleAnnotations(layout,meta)];return meta;
  };
  const palette=['#247fac','#178c89','#8b72af','#bd8e3e','#5d89b7','#aa7d91'];
  C.download=(content,filename,type)=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  C.csv=(rows,filename)=>{
    const safe=rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'&&/^[=+\-@\t\r]/.test(v)&&!/^[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)?"'"+v:v])));
    C.download('\uFEFF'+Papa.unparse(safe),filename,'text/csv;charset=utf-8');
  };
  C.exportSize=chart=>chart.scatter?{width:1200,height:600}:chart.time?{width:1200,height:650}:{width:1200,height:650};
  C.export=async(id,format)=>{
    const chart=B.state.chartData.get(id);if(!chart)throw Error('圖表尚未完成，請稍後再試。');
    const name=chart.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
    if(format==='csv'){C.csv(chart.rows,name+'.csv');return;}
    const el=document.getElementById(id);await chart.ready;
    const {width,height}=C.exportSize(chart);
    const figure=chart.scatter&&C.scatterExportFigure?C.scatterExportFigure(el,chart,width,height):chart.time&&C.timeExportFigure?C.timeExportFigure(el,chart,width,height):{data:el.data,layout:{...el.layout,width,height,autosize:false,margin:{...el.layout.margin}}};
    const url=await Plotly.toImage(figure,{format,width,height,scale:1});
    if(format==='svg'){
      const comma=url.indexOf(','),header=url.slice(0,comma),payload=url.slice(comma+1);
      const svg=header.includes(';base64')?decodeURIComponent(Array.from(atob(payload),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')):decodeURIComponent(payload);
      // Save from a fresh button gesture using the same file path as CSV exports.
      let dialog=document.getElementById('svg-export');
      if(!dialog){dialog=document.createElement('dialog');dialog.id='svg-export';document.body.append(dialog);}
      dialog.innerHTML='<button class="close" aria-label="關閉 SVG 匯出">×</button><h2>SVG 已準備完成</h2><p class="muted small" style="margin:14px 0">'+B.esc(name+'.svg')+'</p><button type="button" class="primary menu-link" data-save-svg>下載 SVG</button>';
      dialog.querySelector('[data-save-svg]').onclick=()=>C.download(svg,name+'.svg','image/svg+xml;charset=utf-8');
      dialog.querySelector('button').onclick=()=>dialog.close();
      dialog.showModal();return;
    }
    const a=document.createElement('a');a.href=url;a.download=name+'.'+format;document.body.append(a);a.click();a.remove();
  };
  C.base=(title,subtitle)=>({title:{text:B.esc(title)+'<br><sup>'+B.esc(subtitle)+'</sup>',font:{size:15},x:.06,xanchor:'left'},font:{family:'Microsoft JhengHei, Arial, sans-serif',size:12,color:'#243e53'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{l:66,r:28,t:86,b:75},hoverlabel:{font:{size:13}},legend:{orientation:'h',x:0,y:-.19,font:{size:11}},showlegend:true,dragmode:'zoom',hovermode:'closest',xaxis:{showgrid:false,gridcolor:'#edf1f5',zeroline:false,automargin:true},yaxis:{showgrid:false,gridcolor:'#e7edf3',zeroline:false,automargin:true,tickformat:'.2f'}});
  C.rawAnnotationIndex=(el,node)=>{const raw=node?.getAttribute?.('data-index');if(raw!==null&&raw!==undefined&&/^\d+$/.test(raw))return Number(raw);return [...el.querySelectorAll('g.annotation')].indexOf(node);};
  C.annotationIndex=(el,node,item)=>{
    const names=new Set(item?.scatter?.points?.map(p=>p.player.name)||[]),raw=C.rawAnnotationIndex(el,node);
    if(raw>=0&&(!names.size||names.has(el.layout.annotations?.[raw]?.name)))return raw;
    const text=node?.querySelector?.('.annotation-text')?.textContent?.trim();if(text&&names.has(text)){const index=(el.layout.annotations||[]).findIndex(a=>a?.name===text);if(index>=0)return index;}
    return -1;
  };
  C.refreshScatterLabelHandles=(el,item)=>{
    if(!el||!item?.scatter)return;
    [...el.querySelectorAll('g.annotation')].forEach(group=>{const raw=C.rawAnnotationIndex(el,group),rawAnn=raw>=0?el.layout.annotations?.[raw]:null,index=C.annotationIndex(el,group,item),ann=index>=0?el.layout.annotations?.[index]:null,text=group.querySelector('.annotation-text-g'),labelActive=!!ann?.name&&item.scatter.points.some(p=>p.player.name===ann.name),legendActive=!!rawAnn?.name&&rawAnn.name.startsWith('legend-item-');group.classList.toggle('bb-draggable-label',labelActive);group.classList.toggle('bb-draggable-legend',legendActive);if(text){text.style.cursor=labelActive?'grab':legendActive?'move':'';text.style.touchAction=(labelActive||legendActive)?'none':'';}});
  };
  C.enableScatterLabelDrag=(el,item)=>{
    if(!el||!item?.scatter||el._bbScatterLabelDragBound)return;el._bbScatterLabelDragBound=true;
    el.addEventListener('pointerdown',event=>{
      const textGroup=event.target?.closest?.('.annotation-text-g');if(!textGroup||!el.contains(textGroup))return;const group=textGroup.closest('g.annotation');if(!group)return;
      const rawIndex=C.rawAnnotationIndex(el,group),rawAnn=rawIndex>=0?el.layout.annotations?.[rawIndex]:null;
      if(rawAnn?.name?.startsWith('legend-item-')){
        event.preventDefault();event.stopPropagation();textGroup.style.cursor='grabbing';item.scatter._labelDragging=true;
        const key=rawAnn.name.slice('legend-item-'.length),startClientX=event.clientX,startClientY=event.clientY,startX=Number(rawAnn.x)||0,startY=Number(rawAnn.y)||0,size=el._fullLayout?._size||{},w=Math.max(1,Number(size.w)||el.clientWidth),h=Math.max(1,Number(size.h)||el.clientHeight),snapPx=8;let latestX=startX,latestY=startY,frame=0,moved=false;
        const draw=()=>{frame=0;if(!el.isConnected)return;Plotly.relayout(el,{[`annotations[${rawIndex}].x`]:latestX,[`annotations[${rawIndex}].y`]:latestY}).catch(()=>{});};
        const move=ev=>{let nx=Math.max(-.35,Math.min(1.08,startX+(ev.clientX-startClientX)/w)),ny=Math.max(-.42,Math.min(1.08,startY-(ev.clientY-startClientY)/h));const others=(el.layout.annotations||[]).filter((a,i)=>i!==rawIndex&&a?.name?.startsWith('legend-item-'));let bestX=snapPx+1,bestY=snapPx+1;for(const ann of others){const ax=Number(ann.x),ay=Number(ann.y);if(B.valid(ax)){const d=Math.abs(nx-ax)*w;if(d<=snapPx&&d<bestX){bestX=d;nx=ax;}}if(B.valid(ay)){const d=Math.abs(ny-ay)*h;if(d<=snapPx&&d<bestY){bestY=d;ny=ay;}}}latestX=nx;latestY=ny;moved=moved||Math.hypot(ev.clientX-startClientX,ev.clientY-startClientY)>2;if(!frame)frame=requestAnimationFrame(draw);ev.preventDefault();ev.stopPropagation();};
        const up=ev=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);if(frame){cancelAnimationFrame(frame);frame=0;}if(!el.isConnected)return;Plotly.relayout(el,{[`annotations[${rawIndex}].x`]:latestX,[`annotations[${rawIndex}].y`]:latestY}).then(()=>{const current=el.layout.annotations?.[rawIndex],stored=item.scatter.arrows?.find(a=>a.name===rawAnn.name);if(stored){stored.x=latestX;stored.y=latestY;}item.scatter.onLegendItemMove?.(key,{x:latestX,y:latestY,xanchor:current?.xanchor||rawAnn.xanchor||'left'});C.refreshScatterLabelHandles(el,item);}).catch(()=>{});item.scatter._labelDragging=false;if(moved)item.scatter.suppressClickUntil=performance.now()+300;textGroup.style.cursor='move';ev.preventDefault();ev.stopPropagation();};
        window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,{capture:true,passive:false,once:true});window.addEventListener('pointercancel',up,{capture:true,passive:false,once:true});return;
      }
      const index=C.annotationIndex(el,group,item),ann=index>=0?el.layout.annotations?.[index]:null,name=ann?.name;if(index<0||!name||!item.scatter.points.some(p=>p.player.name===name))return;
      event.preventDefault();event.stopPropagation();textGroup.style.cursor='grabbing';item.scatter._labelDragging=true;
      const startX=event.clientX,startY=event.clientY,startAx=Number(ann.ax)||0,startAy=Number(ann.ay)||0;let latestAx=startAx,latestAy=startAy,frame=0,moved=false;
      const draw=()=>{frame=0;if(!el.isConnected)return;Plotly.relayout(el,{[`annotations[${index}].ax`]:latestAx,[`annotations[${index}].ay`]:latestAy}).catch(()=>{});};
      const move=ev=>{latestAx=startAx+(ev.clientX-startX);latestAy=startAy+(ev.clientY-startY);moved=moved||Math.hypot(ev.clientX-startX,ev.clientY-startY)>2;if(!frame)frame=requestAnimationFrame(draw);ev.preventDefault();ev.stopPropagation();};
      const up=ev=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);if(frame){cancelAnimationFrame(frame);frame=0;}if(!el.isConnected)return;
        Plotly.relayout(el,{[`annotations[${index}].ax`]:latestAx,[`annotations[${index}].ay`]:latestAy}).then(()=>{const current=el.layout.annotations?.[index],size=el._fullLayout?._size||{},w=Number(size.w)||Math.max(1,el.clientWidth-(el.layout.margin?.l||0)-(el.layout.margin?.r||0)),h=Number(size.h)||Math.max(1,el.clientHeight-(el.layout.margin?.t||0)-(el.layout.margin?.b||0));if(current)item.scatter.onLabelMove?.(name,{ax:Number(current.ax),ay:Number(current.ay),nx:Number(current.ax)/w,ny:Number(current.ay)/h});C.refreshScatterLabelHandles(el,item);}).catch(()=>{});
        item.scatter._labelDragging=false;if(moved)item.scatter.suppressClickUntil=performance.now()+300;textGroup.style.cursor='grab';ev.preventDefault();ev.stopPropagation();};
      window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,{capture:true,passive:false,once:true});window.addEventListener('pointercancel',up,{capture:true,passive:false,once:true});
    },true);
    el.addEventListener('dblclick',event=>{const textGroup=event.target?.closest?.('.annotation-text-g');if(!textGroup||!el.contains(textGroup))return;const group=textGroup.closest('g.annotation'),index=C.rawAnnotationIndex(el,group),ann=index>=0?el.layout.annotations?.[index]:null;if(ann?.name?.startsWith('legend-item-')){event.preventDefault();event.stopPropagation();item.scatter.onLegendItemEdit?.(ann.name.slice('legend-item-'.length));}},true);
  };
  C.mount=(id,traces,layout,rows,title,click)=>{
    const axisTitleMeta=C.placeAxisTitles(id,layout);delete layout._axisTitleMeta;
    const seasonAnnotations=layout._seasonAnnotations||[];
    const time=layout._timeMeta;delete layout._timeMeta;
    if(time)time.staticAnnotations=(layout.annotations||[]).filter(a=>!/^value-|^delta-/.test(a.name||''));
    const item={title,rows,ready:null,axisTitleMeta,seasonAnnotations,time,staticAnnotations:(layout.annotations||[]).filter(a=>!seasonAnnotations.includes(a))};delete layout._seasonAnnotations;B.state.chartData.set(id,item);
    B.state.chartJobs.push(async()=>{
      const el=document.getElementById(id);if(!el)return;
      try{
        const config={responsive:true,displaylogo:false,scrollZoom:false,modeBarButtonsToRemove:['toImage','select2d','lasso2d'],toImageButtonOptions:{format:'png'}};
        if(item.scatter)Object.assign(config,{editable:true,edits:{annotationPosition:false,annotationTail:false,annotationText:false,axisTitleText:false,colorbarPosition:false,colorbarTitleText:false,legendPosition:true,legendText:false,shapePosition:false,titleText:false}});
        item.ready=Plotly.newPlot(el,traces,layout,config);await item.ready;
        if(click)el.on('plotly_click',click);
        if(item.scatter){
          C.enableScatterLabelDrag(el,item);C.refreshScatterLabelHandles(el,item);
          el.on('plotly_clickannotation',event=>{if(item.scatter._labelDragging||(item.scatter.suppressClickUntil||0)>performance.now())return;const name=event.annotation?.name;if(item.scatter.points.some(p=>p.player.name===name))item.scatter.onClick?.(name);});
          el.on('plotly_legenddoubleclick',event=>{const trace=el.data?.[event.curveNumber],group=trace?.legendgroup||'';if(group.startsWith('marker-')){item.scatter.onLegendEdit?.(group.slice(7));return false;}});
        }
        if(item.time)await C.reflowTimeLabels(el);
        if(item.scatter||item.time)el.on('plotly_relayout',event=>{
          if(item.scatter){
            for(const key of Object.keys(event)){const m=/^annotations\[(\d+)\]\.(?:ax|ay)$/.exec(key);if(!m)continue;const ann=el.layout.annotations?.[Number(m[1])],name=ann?.name;if(name&&item.scatter.points.some(p=>p.player.name===name)&&B.valid(Number(ann.ax))&&B.valid(Number(ann.ay))){const size=el._fullLayout?._size||{},w=Number(size.w)||Math.max(1,el.clientWidth-(el.layout.margin?.l||0)-(el.layout.margin?.r||0)),h=Number(size.h)||Math.max(1,el.clientHeight-(el.layout.margin?.t||0)-(el.layout.margin?.b||0));item.scatter.onLabelMove?.(name,{ax:Number(ann.ax),ay:Number(ann.ay),nx:Number(ann.ax)/w,ny:Number(ann.ay)/h});}}
            if(Object.prototype.hasOwnProperty.call(event,'legend.x')||Object.prototype.hasOwnProperty.call(event,'legend.y'))item.scatter.onLegendMove?.({x:Number(el.layout.legend?.x),y:Number(el.layout.legend?.y),xanchor:el.layout.legend?.xanchor,yanchor:el.layout.legend?.yanchor});
          }
          if(Object.keys(event).some(k=>/^(xaxis|yaxis2?)\.range|autorange|autosize|width|height/.test(k))){C.reflowLabels?.(el);C.reflowTimeLabels?.(el);}
          if(item.scatter)requestAnimationFrame(()=>C.refreshScatterLabelHandles(el,item));
        });
      }
      catch(e){el.textContent='圖表無法顯示：'+e.message;el.classList.add('chart-error');throw e;}
    });
  };
  C.seasons=(start,end)=>{
    const visible=B.state.data.seasons.filter(s=>s.end>=start&&s.start<=end);
    return {
      shapes:visible.map((s,i)=>({type:'rect',xref:'x',yref:'paper',x0:s.start<start?start:s.start,x1:B.iso(new Date((s.end>end?end:s.end)+'T00:00:00Z').getTime()+B.DAY),y0:0,y1:1,fillcolor:palette[i%palette.length],opacity:.09,line:{width:0},layer:'below'})),
      annotations:visible.map((s,i)=>({xref:'x',yref:'paper',x:s.start<start?start:s.start,y:1-(i%3)*.07,text:B.esc(s.name),showarrow:false,xanchor:'left',yanchor:'top',font:{size:11,color:palette[i%palette.length]}}))
    };
  };
  C.timeline=(id,series,metric,{title,summary,team=false,unit='month',history=series}={})=>{
    const x=series.map(r=>r.start),y=series.map(r=>r.value),traces=[];
    const customdata=series.map(r=>[B.esc(r.label||r.period),B.fmt(r.value),B.fmt(r.delta,true),B.fmt(r.pct,true),B.esc(r.baseLabel||r.base||'—'),r.n??'']);
    traces.push({type:'scatter',x,y,customdata,mode:team?'markers':'lines+markers',connectgaps:false,name:team?'群體平均':'個人代表值',marker:{size:team?9:7,color:'#15799c',line:{color:'white',width:1}},line:{width:2,color:'#15799c'},hovertemplate:'%{customdata[0]}<br>'+B.esc(metric.label)+'：%{customdata[1]} '+B.esc(metric.unit)+'<br>Δ：%{customdata[2]}<br>Δ%：%{customdata[3]}<br>比較基準：%{customdata[4]}'+(team?'<br>人數：%{customdata[5]}':'')+'<extra></extra>'});
    if(!team){const gx=[],gy=[];let prev=-1;series.forEach((r,i)=>{if(B.valid(r.value)){if(prev>=0&&i>prev+1){gx.push(series[prev].start,r.start,null);gy.push(series[prev].value,r.value,null);}prev=i;}});if(gx.length)traces.push({type:'scatter',x:gx,y:gy,mode:'lines',name:'跨缺失期間',line:{dash:'dash',width:2,color:'#15799c'},hoverinfo:'skip'});}
    const layout=C.base(title,summary),start=series[0]?.start,end=series.at(-1)?.end;
    layout.xaxis={...layout.xaxis,title:{text:unit==='week'?'週次':unit==='day'?'日期':unit==='year'?'年度':'月份'},type:'date',...(start?{range:[B.iso(new Date(start+'T00:00:00Z')-B.DAY*2),B.iso(new Date(end+'T00:00:00Z').getTime()+B.DAY*2)]}:{}),...(C.timeTicks?.(series,unit,C.timeOptions?.(id))||{tickmode:'array',tickvals:x,ticktext:series.map(r=>r.label||r.period),tickangle:series.length>6?-40:0})};
    layout.yaxis.title={text:`${B.esc(metric.label)} (${B.esc(metric.unit)})`};
    if(start){Object.assign(layout,C.seasons(start,end));layout._seasonAnnotations=layout.annotations;if(C.preferences.get(id)?.seasons===false)layout.annotations=[];}
    if(!y.some(B.valid))layout.annotations=[...(layout.annotations||[]),{xref:'paper',yref:'paper',x:.5,y:.5,text:'此期間沒有有效指標資料',showarrow:false,font:{color:'#6d8193'}}];
    const decorated=C.decorateTime?.(id,traces,layout,[{series,history,metric}],start,end,unit)?.[0];
    // Team charts keep the original season bands and grid by default, but both are user-configurable.
    // Personal time charts preserve the cleaner no-grid/no-band presentation.
    const visualOptions=C.timeOptions?.(id)||{};
    const gridMode=team?(visualOptions.gridMode||'both'):'none';
    const showVertical=gridMode==='both'||gridMode==='vertical';
    const showHorizontal=gridMode==='both'||gridMode==='horizontal';
    layout.paper_bgcolor='#fff';
    layout.plot_bgcolor='#fff';
    layout.xaxis={...layout.xaxis,showgrid:showVertical,gridcolor:layout.xaxis?.gridcolor||'#edf1f5',zeroline:false};
    layout.yaxis={...layout.yaxis,showgrid:showHorizontal,gridcolor:layout.yaxis?.gridcolor||'#e7edf3',zeroline:false};
    if(layout.yaxis2)layout.yaxis2={...layout.yaxis2,showgrid:false,zeroline:false};
    if(!team||visualOptions.seasonBands===false)layout.shapes=(layout.shapes||[]).filter(shape=>shape?.type!=='rect');
    const rows=series.map(r=>({期間:r.label||r.period,開始:r.start,結束:r.end,指標:metric.key,單位:metric.unit,代表值:B.fmt(r.value),...(team?{人數:r.n}:{}),['Δ'+metric.label]:B.fmt(r.delta,true),['Δ'+metric.label+'%']:B.fmt(r.pct,true),比較基準:r.baseLabel||r.base||'—',分析條件:summary}));
    if(decorated){const options=C.timeOptions(id);for(const [i,row] of rows.entries()){for(const [key,stat,label] of [['high','max','歷史最高'],['low','min','歷史最低'],['mean','mean','歷史期間點平均']])if(options[key])row[label]=B.fmt(decorated.referenceStats[stat]);if(options.trend)row.趨勢估計=B.fmt(decorated.trendFit?.predict(series[i].start));}}
    C.mount(id,traces,layout,rows,title);
    const item=B.state.chartData.get(id);if(item)item.redraw=()=>C.timeline(id,series,metric,{title,summary,team,unit,history});
  };
  // Only labels move; the measurement coordinates and exports remain exact.
  C.labelAnnotations=(points,xrange,yrange,width,height,options={})=>{
    const {centerX=(xrange[0]+xrange[1])/2,centerY=(yrange[0]+yrange[1])/2,marks=new Map()}=options;
    const placed=[],out=[],pixels=points.map(p=>({x:(p.x-xrange[0])/(xrange[1]-xrange[0])*width,y:(yrange[1]-p.y)/(yrange[1]-yrange[0])*height}));
    const mx=(centerX-xrange[0])/(xrange[1]-xrange[0])*width,my=(yrange[1]-centerY)/(yrange[1]-yrange[0])*height;
    for(let i=0;i<points.length;i++){
      const p=points[i],anchor=pixels[i];if(anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height)continue;
      const sx=p.x<centerX?-1:1,sy=p.y<centerY?1:-1;
      const w=Math.min(width/2-8,Math.max(38,Array.from(p.player.name).reduce((n,c)=>n+(c.charCodeAt(0)>255?12:7),0)+10)),h=23;
      const xlo=sx<0?w/2:Math.max(w/2,mx+w/2+2),xhi=sx<0?Math.min(width-w/2,mx-w/2-2):width-w/2;
      const ylo=sy<0?h/2:Math.max(h/2,my+h/2+2),yhi=sy<0?Math.min(height-h/2,my-h/2-2):height-h/2;
      let best=null,bestScore=Infinity;
      search:for(let ring=0;ring<45;ring++)for(let angle=0;angle<=12;angle++){
        const theta=angle*Math.PI/24,radius=20+ring*18;
        const cx=Math.min(xhi,Math.max(xlo,anchor.x+sx*Math.cos(theta)*radius)),cy=Math.min(yhi,Math.max(ylo,anchor.y+sy*Math.sin(theta)*radius));
        if(xlo>xhi||ylo>yhi||(cx-anchor.x)*sx<-.01||(cy-anchor.y)*sy<-.01)continue;
        const box={left:cx-w/2-3,right:cx+w/2+3,top:cy-h/2-2,bottom:cy+h/2+2};
        const collisions=placed.filter(b=>b.left<box.right&&b.right>box.left&&b.top<box.bottom&&b.bottom>box.top).length;
        const covers=pixels.filter(a=>a.x>box.left-4&&a.x<box.right+4&&a.y>box.top-4&&a.y<box.bottom+4).length;
        const score=collisions*100000+covers*10000+Math.hypot(cx-anchor.x,cy-anchor.y);
        if(score<bestScore){bestScore=score;best={box,cx,cy};}if(!collisions&&!covers)break search;
      }
      if(!best){const cx=anchor.x+sx*22,cy=anchor.y+sy*24;best={cx,cy,box:{left:cx-w/2,right:cx+w/2,top:cy-h/2,bottom:cy+h/2}};}
      const manual=options.labelOffsets?.get?.(p.player.name),ax=B.valid(manual?.nx)?manual.nx*width:(manual?.ax??best.cx-anchor.x),ay=B.valid(manual?.ny)?manual.ny*height:(manual?.ay??best.cy-anchor.y);
      const cx=anchor.x+ax,cy=anchor.y+ay,finalBox={left:cx-w/2-3,right:cx+w/2+3,top:cy-h/2-2,bottom:cy+h/2+2};
      placed.push(finalBox);out.push({name:p.player.name,x:p.x,y:p.y,xref:'x',yref:'y',text:B.esc(p.player.name),ax,ay,axref:'pixel',ayref:'pixel',showarrow:true,arrowhead:0,arrowwidth:.8,arrowcolor:'#9baebb',standoff:6,startstandoff:2,font:{size:12,color:'#111827'},bgcolor:'rgba(255,255,255,.92)',borderpad:2,captureevents:true});
    }
    return out;
  };
  C.reflowLabels=el=>{
    const item=B.state.chartData.get(el.id),meta=item?.scatter;if(!meta||!el.layout)return;
    const {xaxis,yaxis,margin}=el.layout;
    return Plotly.relayout(el,{annotations:[...meta.arrows.filter(a=>!a.name?.startsWith('axis-title-')),...C.axisTitleAnnotations(el.layout,item.axisTitleMeta),...(meta.names&&meta.spread?C.labelAnnotations(meta.points,xaxis.range,yaxis.range,Math.max(120,el.clientWidth-(margin.l||0)-(margin.r||0)),Math.max(150,el.clientHeight-(margin.t||0)-(margin.b||0)),meta):[])]});
  };
  C.scatterExportFigure=(el,item,width,height)=>{
    const layout={...el.layout,width,height,autosize:false,margin:{l:98,r:34,t:64,b:130},font:{...el.layout.font,size:13},title:{...el.layout.title,x:.025,font:{...(el.layout.title?.font||{}),size:17}},legend:{...el.layout.legend,font:{...(el.layout.legend?.font||{}),size:12}},xaxis:{...el.layout.xaxis},yaxis:{...el.layout.yaxis}};
    for(const key of ['xaxis','yaxis'])if(el._fullLayout?.[key]?.range)layout[key]={...layout[key],range:[...el._fullLayout[key].range],autorange:false};
    const meta=item.scatter,gW=Math.max(120,width-layout.margin.l-layout.margin.r),gH=Math.max(150,height-layout.margin.t-layout.margin.b);
    const liveLegends=(el.layout.annotations||[]).filter(a=>a?.name?.startsWith('legend-item-')).map(a=>({...a}));
    const staticArrows=meta.arrows.filter(a=>!a.name?.startsWith('axis-title-')&&!a.name?.startsWith('legend-item-'));
    const storedLegends=meta.arrows.filter(a=>a.name?.startsWith('legend-item-'));
    layout.annotations=[...staticArrows,...(liveLegends.length?liveLegends:storedLegends),...C.axisTitleAnnotations(layout,item.axisTitleMeta),...(meta.names&&meta.spread?C.labelAnnotations(meta.points,layout.xaxis.range,layout.yaxis.range,gW,gH,meta):[])];
    return {data:el.data,layout};
  };
  C.scatter=(id,result,xAxis,yAxis,{title,summary,names=true,previous=false,movement=false,spread=true,onClick,onLabelMove,onLegendEdit,onLegendMove,onLegendItemMove,onLegendItemEdit,legendPosition=null,seriesLegends={},labelOffsets=new Map(),markStyles=new Map(),region=null,pair=false,referenceLabel='前一期有效位置',currentLabel='當期球員'}={})=>{
    const metric=k=>B.state.data.registry.find(m=>m.key===k),xm=metric(xAxis.key),ym=metric(yAxis.key),marks=new Map([...markStyles].map(([name,style])=>[name,style.color]));
    const axisLabel=(a,m)=>`${a.mode==='delta'?'Δ':''}${m.label} (${a.mode==='delta'&&m.key==='pbf'?'百分點':m.unit})`;
    const points=result.points,traces=[],prior=result.referencePoints||points.filter(p=>p.prior).map(p=>p.prior);
    const detail=(p,axis)=>{const d=p[axis+'Detail'];return `${B.esc(d.label||d.period)}；比較基準 ${B.esc(d.baseLabel||d.base||'—')}`;};
    const hover=p=>`${B.esc(p.player.name)} · ${B.esc(p.player.level)} · ${B.esc(p.player.position)}<br>${B.esc(axisLabel(xAxis,xm))}：${B.fmt(p.x,xAxis.mode==='delta')}<br>${B.esc(axisLabel(yAxis,ym))}：${B.fmt(p.y,yAxis.mode==='delta')}<br>X 期間：${detail(p,'x')}<br>Y 期間：${detail(p,'y')}`;
    const defaultColor=()=> '#197AA4',movementLegend={visible:true,name:'移動軌跡',color:'#9AACBA',x:.43,y:-.10,...(seriesLegends.movement||{})},previousLegend={visible:true,name:referenceLabel,color:'#197AA4',x:.20,y:-.10,...(seriesLegends.previous||{})},currentLegend={visible:true,name:currentLabel,color:'#197AA4',x:.02,y:-.10,...(seriesLegends.current||{})};
    let hasMovement=false;
    if(movement){const lx=[],ly=[];for(const p of points)if(p.prior){lx.push(p.prior.x,p.x,null);ly.push(p.prior.y,p.y,null);}if(lx.length){hasMovement=true;traces.push({type:'scatter',x:lx,y:ly,mode:'lines',name:movementLegend.name||'移動軌跡',showlegend:false,line:{color:movementLegend.color||'#9AACBA',dash:'dash',width:1.3},hoverinfo:'skip'});}}
    if(previous&&prior.length)traces.push({type:'scatter',x:prior.map(p=>p.x),y:prior.map(p=>p.y),mode:'markers',name:previousLegend.name||referenceLabel,showlegend:false,customdata:prior.map(p=>p.player.name),text:prior.map(hover),hovertemplate:'%{text}<extra>'+B.esc(previousLegend.name||referenceLabel)+'</extra>',marker:{size:9,symbol:'circle-open',color:previousLegend.color||'#197AA4',line:{width:1.5,color:previousLegend.color||'#197AA4'}}});
    const pointTrace=(subset,name,color,legendgroup,showlegend=true)=>({type:'scatter',x:subset.map(p=>p.x),y:subset.map(p=>p.y),mode:names&&!spread?'markers+text':'markers',name,text:names&&!spread?subset.map(p=>B.esc(p.player.name)):undefined,textposition:subset.map(p=>(p.y<result.centerY?'bottom ':'top ')+(p.x<result.centerX?'left':'right')),textfont:{size:12,color:'#111827'},hovertext:subset.map(hover),hovertemplate:'%{hovertext}<extra></extra>',customdata:subset.map(p=>p.player.name),legendgroup,showlegend,marker:{size:11,color:color||subset.map(defaultColor),line:{width:1,color:'white'}}});
    const unmarked=points.filter(p=>!markStyles.has(p.player.name));if(unmarked.length)traces.push(pointTrace(unmarked,currentLabel,null,'current',false));else traces.push({type:'scatter',x:[null],y:[null],mode:'markers',name:currentLabel,legendgroup:'current',showlegend:false,hoverinfo:'skip',marker:{size:11,color:'#197AA4',line:{width:1,color:'white'}}});
    const groups=[];for(const style of markStyles.values())if(style&&!groups.some(g=>g.id===style.id))groups.push(style);
    for(const group of groups){const subset=points.filter(p=>markStyles.get(p.player.name)?.id===group.id);if(subset.length)traces.push(pointTrace(subset,group.name||'未命名標記',group.color,'marker-'+group.id,false));}
    const layout=C.base(title,summary);layout.margin={l:74,r:32,t:86,b:96};layout.showlegend=false;if(legendPosition)layout.legend={...layout.legend,...legendPosition};
    const extent=(key,center)=>{const vals=[...points,...((previous||movement)?prior:[])].map(p=>p[key]);if(B.valid(center))vals.push(center);if(!vals.length)return [-1,1];let min=Math.min(...vals),max=Math.max(...vals);const pad=Math.max((max-min)*.23,.1);return[min-pad,max+pad];};
    layout.xaxis={...layout.xaxis,title:{text:B.esc(axisLabel(xAxis,xm))},tickformat:'.2f',range:extent('x',result.centerX)};
    layout.yaxis={...layout.yaxis,title:{text:B.esc(axisLabel(yAxis,ym))},range:extent('y',result.centerY)};
    layout.shapes=[];
    // Positive-direction axes: keep the dashed shaft and render only the arrow HEAD
    // as a normal scatter marker inside the plotting area.  This avoids Plotly/SVG
    // annotation clipping at the top/right export boundary.
    const axisHeadX=.985,axisHeadY=.970;
    if(B.valid(result.centerX))layout.shapes.push({type:'line',xref:'x',yref:'paper',x0:result.centerX,x1:result.centerX,y0:0,y1:axisHeadY,line:{color:'#5f7f91',width:1,dash:'dot'}});
    if(B.valid(result.centerY))layout.shapes.push({type:'line',xref:'paper',yref:'y',x0:0,x1:axisHeadX,y0:result.centerY,y1:result.centerY,line:{color:'#5f7f91',width:1,dash:'dot'}});
    const xr=layout.xaxis.range,yr=layout.yaxis.range;
    if(B.valid(result.centerY)&&xr?.length===2){const hx=xr[0]+(xr[1]-xr[0])*axisHeadX;traces.push({type:'scatter',mode:'markers',x:[hx],y:[result.centerY],showlegend:false,hoverinfo:'skip',cliponaxis:true,marker:{symbol:'triangle-right',size:10,color:'#5f7f91',line:{width:0}}});}
    if(B.valid(result.centerX)&&yr?.length===2){const hy=yr[0]+(yr[1]-yr[0])*axisHeadY;traces.push({type:'scatter',mode:'markers',x:[result.centerX],y:[hy],showlegend:false,hoverinfo:'skip',cliponaxis:true,marker:{symbol:'triangle-up',size:10,color:'#5f7f91',line:{width:0}}});}
    if(region?.enabled){
      region=B.Extras.bounds(region);
      const xr=layout.xaxis.range,yr=layout.yaxis.range;
      const x0=Math.max(xr[0],region.xMin??xr[0]),x1=Math.min(xr[1],region.xMax??xr[1]),y0=Math.max(yr[0],region.yMin??yr[0]),y1=Math.min(yr[1],region.yMax??yr[1]);
      if(x0<x1&&y0<y1)layout.shapes.unshift({type:'rect',xref:'x',yref:'y',x0,x1,y0,y1,fillcolor:region.color,opacity:.2,line:{color:region.color,width:1},layer:'below'});
    }
    layout.annotations=movement?points.filter(p=>p.prior&&(p.x!==p.prior.x||p.y!==p.prior.y)).map(p=>({x:p.x,y:p.y,ax:p.x-(p.x-p.prior.x)*.08,ay:p.y-(p.y-p.prior.y)*.08,xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,text:'',arrowhead:2,arrowsize:1,arrowwidth:1.2,arrowcolor:'#9aacba'})):[];
    const legendAnnotation=(key,cfg,icon,color)=>({name:'legend-item-'+key,xref:'paper',yref:'paper',x:B.valid(cfg.x)?cfg.x:.02,y:B.valid(cfg.y)?cfg.y:-.10,xanchor:cfg.xanchor||'left',yanchor:'middle',text:`<span style="color:${B.esc(color)}">${icon}</span>&nbsp;${B.esc(cfg.name||'')}`,showarrow:false,font:{size:11,color:'#243e53'},bgcolor:'rgba(255,255,255,.94)',borderpad:2,captureevents:true});
    const hasCurrentDefault=points.some(p=>markStyles.get(p.player.name)?.default);
    if(currentLegend.visible!==false&&hasCurrentDefault)layout.annotations.push(legendAnnotation('current',currentLegend,'●',currentLegend.color||'#197AA4'));
    if(previous&&prior.length&&previousLegend.visible!==false)layout.annotations.push(legendAnnotation('previous',previousLegend,'○',previousLegend.color||'#197AA4'));
    if(hasMovement&&movementLegend.visible!==false)layout.annotations.push(legendAnnotation('movement',movementLegend,'┄┄',movementLegend.color||'#9AACBA'));
    let customLegendIndex=0;for(const group of groups){if(group.default||group.legendVisible===false)continue;const subset=points.filter(p=>markStyles.get(p.player.name)?.id===group.id);if(!subset.length)continue;const cfg={name:group.name||'未命名標記',x:B.valid(group.legendX)?group.legendX:.02+Math.min(customLegendIndex,4)*.16,y:B.valid(group.legendY)?group.legendY:-.10,xanchor:group.legendAnchor||'left'};layout.annotations.push(legendAnnotation('marker:'+group.id,cfg,'●',group.color||'#C2323B'));customLegendIndex++;}
    if(!points.length&&!(previous&&prior.length))layout.annotations.push({x:.5,y:.5,xref:'paper',yref:'paper',text:'沒有同時具備 X、Y 有效值的球員',showarrow:false});
    const exportPoint=(p,type)=>{const style=markStyles.get(p.player.name);return {資料點:type,姓名:p.player.name,背號:p.player.number,分級:p.player.level,位置:p.player.position,標記點:style?.name||'',標記顏色:style?.color||'',期間:p.label||p.period,X指標:xAxis.key,X模式:xAxis.mode,X單位:xAxis.mode==='delta'&&xm.key==='pbf'?'百分點':xm.unit,X值:B.fmt(p.x,xAxis.mode==='delta'),X比較基準:p.xDetail.baseLabel||p.xDetail.base||'—',X前期值:B.fmt(p.xDetail.previous),Y指標:yAxis.key,Y模式:yAxis.mode,Y單位:yAxis.mode==='delta'&&ym.key==='pbf'?'百分點':ym.unit,Y值:B.fmt(p.y,yAxis.mode==='delta'),Y比較基準:p.yDetail.baseLabel||p.yDetail.base||'—',Y前期值:B.fmt(p.yDetail.previous),X中心:B.fmt(result.centerX),Y中心:B.fmt(result.centerY),分析條件:summary};};
    const rows=[...points.map(p=>exportPoint(p,currentLabel)),...((previous||movement)?prior.map(p=>exportPoint(p,referenceLabel)):[])];
    if(pair)for(const row of rows)for(const key of ['X比較基準','X前期值','Y比較基準','Y前期值'])delete row[key];
    if(region?.enabled)for(const row of rows)Object.assign(row,{標記框X下限:region.xMin??'不限',標記框X上限:region.xMax??'不限',標記框Y下限:region.yMin??'不限',標記框Y上限:region.yMax??'不限',標記框顏色:region.color});
    if(!rows.length)rows.push({資料點:'無有效資料',分析條件:summary,X指標:xAxis.key,Y指標:yAxis.key});
    C.placeAxisTitles(id,layout,{kind:'scatter',centerX:result.centerX,centerY:result.centerY});
    const arrows=[...layout.annotations],labelPoints=[...points,...(previous?prior.filter(p=>!points.some(q=>q.player.name===p.player.name)):[])],labelOptions={marks,labelOffsets,centerX:B.valid(result.centerX)?result.centerX:(layout.xaxis.range[0]+layout.xaxis.range[1])/2,centerY:B.valid(result.centerY)?result.centerY:(layout.yaxis.range[0]+layout.yaxis.range[1])/2};
    if(names&&spread){const el=typeof document==='undefined'?null:document.getElementById(id);layout.annotations.push(...C.labelAnnotations(labelPoints,layout.xaxis.range,layout.yaxis.range,Math.max(120,(el?.clientWidth||900)-layout.margin.l-layout.margin.r),Math.max(150,(el?.clientHeight||480)-layout.margin.t-layout.margin.b),labelOptions));}
    C.mount(id,traces,layout,rows,title,event=>{const clicked=event.points?.find(p=>p.customdata);if(!clicked)return;const pool=[...points,...((previous||movement)?prior:[])];const same=[...new Set(pool.filter(p=>p.x===clicked.x&&p.y===clicked.y).map(p=>p.player.name))];onClick?.(same.length>1?same:clicked.customdata);});
    const item=B.state.chartData.get(id);if(item)item.scatter={points:labelPoints,names,spread,arrows,onClick,onLabelMove,onLegendEdit,onLegendMove,onLegendItemMove,onLegendItemEdit,...labelOptions};
  };
})(BB);
