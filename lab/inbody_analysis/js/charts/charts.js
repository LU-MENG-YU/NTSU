(function(B){
  'use strict';
  const C=B.Charts={},U=()=>B.UI;
  C.preferences=new Map();
  const palette=['#247fac','#178c89','#8b72af','#bd8e3e','#5d89b7','#aa7d91'];
  C.download=(content,filename,type)=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  C.csv=(rows,filename)=>{
    const safe=rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='string'&&/^[=+\-@\t\r]/.test(v)&&!/^[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)?"'"+v:v])));
    C.download('\uFEFF'+Papa.unparse(safe),filename,'text/csv;charset=utf-8');
  };
  C.export=async(id,format)=>{
    const chart=B.state.chartData.get(id);if(!chart)throw Error('圖表尚未完成，請稍後再試。');
    const name=chart.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
    if(format==='csv'){C.csv(chart.rows,name+'.csv');return;}
    const el=document.getElementById(id);await chart.ready;
    const url=await Plotly.toImage(el,{format,width:1400,height:900,scale:format==='png'?2:1});
    if(format==='svg'){
      const comma=url.indexOf(','),header=url.slice(0,comma),payload=url.slice(comma+1);
      const svg=header.includes(';base64')?decodeURIComponent(Array.from(atob(payload),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')):decodeURIComponent(payload);
      // Keep a real download link so the final save has a fresh user gesture.
      const objectURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
      let dialog=document.getElementById('svg-export');
      if(!dialog){dialog=document.createElement('dialog');dialog.id='svg-export';document.body.append(dialog);}
      dialog.innerHTML='<button class="close" aria-label="關閉 SVG 匯出">×</button><h2>SVG 已準備完成</h2><p class="muted small" style="margin:14px 0">'+B.esc(name+'.svg')+'</p><a class="button primary menu-link" download="'+B.esc(name+'.svg')+'" href="'+objectURL+'">下載 SVG</a>';
      dialog.querySelector('button').onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{setTimeout(()=>URL.revokeObjectURL(objectURL),30000);},{once:true});
      dialog.showModal();return;
    }
    const a=document.createElement('a');a.href=url;a.download=name+'.'+format;document.body.append(a);a.click();a.remove();
  };
  C.base=(title,subtitle)=>({title:{text:B.esc(title)+'<br><sup>'+B.esc(subtitle)+'</sup>',font:{size:15},x:.06,xanchor:'left'},font:{family:'Microsoft JhengHei, Arial, sans-serif',size:12,color:'#243e53'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{l:66,r:28,t:86,b:75},hoverlabel:{font:{size:13}},legend:{orientation:'h',x:0,y:-.19,font:{size:11}},showlegend:true,dragmode:'zoom',hovermode:'closest',xaxis:{gridcolor:'#edf1f5',zeroline:false,automargin:true},yaxis:{gridcolor:'#e7edf3',zeroline:false,automargin:true,tickformat:'.2f'}});
  C.mount=(id,traces,layout,rows,title,click)=>{
    const seasonAnnotations=layout._seasonAnnotations||[];
    const item={title,rows,ready:null,seasonAnnotations,staticAnnotations:(layout.annotations||[]).filter(a=>!seasonAnnotations.includes(a))};delete layout._seasonAnnotations;B.state.chartData.set(id,item);
    B.state.chartJobs.push(async()=>{
      const el=document.getElementById(id);if(!el)return;
      try{item.ready=Plotly.newPlot(el,traces,layout,{responsive:true,displaylogo:false,scrollZoom:false,modeBarButtonsToRemove:['toImage','select2d','lasso2d'],toImageButtonOptions:{format:'png'}});await item.ready;if(click)el.on('plotly_click',click);if(item.scatter){el.on('plotly_clickannotation',event=>{const name=event.annotation?.name;if(item.scatter.points.some(p=>p.player.name===name))item.scatter.onClick?.(name);});el.on('plotly_relayout',event=>{if(Object.keys(event).some(k=>/^(xaxis|yaxis)\.range|autosize|width|height/.test(k)))C.reflowLabels(el);});}}
      catch(e){el.textContent='圖表無法顯示：'+e.message;el.classList.add('chart-error');throw e;}
    });
  };
  C.seasons=(start,end)=>{
    const visible=B.state.data.seasons.filter(s=>s.end>=start&&s.start<=end);
    return {shapes:visible.map((s,i)=>({type:'rect',xref:'x',yref:'paper',x0:s.start<start?start:s.start,x1:B.iso(new Date((s.end>end?end:s.end)+'T00:00:00Z').getTime()+B.DAY),y0:0,y1:1,fillcolor:palette[i%palette.length],opacity:.09,line:{width:0},layer:'below'})),annotations:visible.map((s,i)=>({xref:'x',yref:'paper',x:s.start<start?start:s.start,y:1-(i%3)*.07,text:B.esc(s.name),showarrow:false,xanchor:'left',yanchor:'top',font:{size:11,color:palette[i%palette.length]}}))};
  };
  C.timeline=(id,series,metric,{title,summary,team=false,unit='month'}={})=>{
    const x=series.map(r=>r.start),y=series.map(r=>r.value),traces=[];
    const customdata=series.map(r=>[B.esc(r.label||r.period),B.fmt(r.value),B.fmt(r.delta,true),B.fmt(r.pct,true),B.esc(r.baseLabel||r.base||'—'),r.n??'']);
    traces.push({type:'scatter',x,y,customdata,mode:team?'markers':'lines+markers',connectgaps:false,name:team?'群體平均':'個人代表值',marker:{size:team?9:7,color:'#15799c',line:{color:'white',width:1}},line:{width:2,color:'#15799c'},hovertemplate:'%{customdata[0]}<br>'+B.esc(metric.label)+'：%{customdata[1]} '+B.esc(metric.unit)+'<br>Δ：%{customdata[2]}<br>Δ%：%{customdata[3]}<br>比較基準：%{customdata[4]}'+(team?'<br>人數：%{customdata[5]}':'')+'<extra></extra>'});
    if(!team){const gx=[],gy=[];let prev=-1;series.forEach((r,i)=>{if(B.valid(r.value)){if(prev>=0&&i>prev+1){gx.push(series[prev].start,r.start,null);gy.push(series[prev].value,r.value,null);}prev=i;}});if(gx.length)traces.push({type:'scatter',x:gx,y:gy,mode:'lines',name:'跨缺失期間',line:{dash:'dash',width:2,color:'#15799c'},hoverinfo:'skip'});}
    const layout=C.base(title,summary),start=series[0]?.start,end=series.at(-1)?.end;
    layout.xaxis={...layout.xaxis,title:{text:unit==='day'?'日期':unit==='year'?'年度':'月份'},type:'date',...(start?{range:[B.iso(new Date(start+'T00:00:00Z')-B.DAY*2),B.iso(new Date(end+'T00:00:00Z').getTime()+B.DAY*2)]}:{}),...(series.length<=24?{tickmode:'array',tickvals:x,ticktext:series.map(r=>r.label||r.period),tickangle:series.length>6?-40:0}:{tickformat:unit==='day'?'%m/%d':'%Y/%m',nticks:12})};
    layout.yaxis.title={text:`${B.esc(metric.label)} (${B.esc(metric.unit)})`};
    if(start){Object.assign(layout,C.seasons(start,end));layout._seasonAnnotations=layout.annotations;if(C.preferences.get(id)?.seasons===false)layout.annotations=[];}
    if(!y.some(B.valid))layout.annotations=[...(layout.annotations||[]),{xref:'paper',yref:'paper',x:.5,y:.5,text:'此期間沒有有效指標資料',showarrow:false,font:{color:'#6d8193'}}];
    const rows=series.map(r=>({期間:r.label||r.period,開始:r.start,結束:r.end,指標:metric.key,單位:metric.unit,代表值:B.fmt(r.value),...(team?{人數:r.n}:{}),['Δ'+metric.label]:B.fmt(r.delta,true),['Δ'+metric.label+'%']:B.fmt(r.pct,true),比較基準:r.baseLabel||r.base||'—',分析條件:summary}));
    C.mount(id,traces,layout,rows,title);
  };
  // Only labels move; the measurement coordinates and exports remain exact.
  C.labelAnnotations=(points,xrange,yrange,width,height)=>{
    const placed=[],out=[],pixels=points.map(p=>({x:(p.x-xrange[0])/(xrange[1]-xrange[0])*width,y:(yrange[1]-p.y)/(yrange[1]-yrange[0])*height}));
    for(let i=0;i<points.length;i++){
      const p=points[i],anchor=pixels[i];if(anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height)continue;
      const w=Math.min(width,Math.max(38,Array.from(p.player.name).reduce((n,c)=>n+(c.charCodeAt(0)>255?12:7),0)+10)),h=23;
      let best=null,bestScore=Infinity;
      search:for(let ring=0;ring<30;ring++)for(let angle=0;angle<16;angle++){
        const theta=(angle/16)*Math.PI*2-Math.PI/2,radius=20+ring*19;
        const cx=Math.min(width-w/2,Math.max(w/2,anchor.x+Math.cos(theta)*radius)),cy=Math.min(height-h/2,Math.max(h/2,anchor.y+Math.sin(theta)*radius));
        const box={left:cx-w/2-3,right:cx+w/2+3,top:cy-h/2-2,bottom:cy+h/2+2};
        const collisions=placed.filter(b=>b.left<box.right&&b.right>box.left&&b.top<box.bottom&&b.bottom>box.top).length;
        const covers=pixels.filter(a=>a.x>box.left-4&&a.x<box.right+4&&a.y>box.top-4&&a.y<box.bottom+4).length;
        const distance=Math.hypot(cx-anchor.x,cy-anchor.y),score=collisions*100000+covers*10000+distance;
        if(score<bestScore){bestScore=score;best={box,cx,cy};}if(!collisions&&!covers)break search;
      }
      placed.push(best.box);out.push({name:p.player.name,x:p.x,y:p.y,xref:'x',yref:'y',text:B.esc(p.player.name),ax:best.cx-anchor.x,ay:best.cy-anchor.y,axref:'pixel',ayref:'pixel',showarrow:true,arrowhead:0,arrowwidth:.8,arrowcolor:'#9baebb',standoff:6,font:{size:12,color:B.state.marks.get(p.player.name)||'#243e53'},bgcolor:'rgba(255,255,255,.92)',borderpad:2,captureevents:true});
    }
    return out;
  };
  C.reflowLabels=el=>{
    const meta=B.state.chartData.get(el.id)?.scatter;if(!meta?.names||!meta.spread||!el.layout)return;
    const {xaxis,yaxis,margin}=el.layout;
    return Plotly.relayout(el,{annotations:[...meta.arrows,...C.labelAnnotations(meta.points,xaxis.range,yaxis.range,Math.max(120,el.clientWidth-(margin.l||0)-(margin.r||0)),Math.max(150,el.clientHeight-(margin.t||0)-(margin.b||0)))]});
  };
  C.scatter=(id,result,xAxis,yAxis,{title,summary,names=true,previous=false,movement=false,spread=true,onClick}={})=>{
    const metric=k=>B.state.data.registry.find(m=>m.key===k),xm=metric(xAxis.key),ym=metric(yAxis.key);
    const axisLabel=(a,m)=>`${a.mode==='delta'?'Δ':''}${m.label} (${a.mode==='delta'&&m.key==='pbf'?'百分點':m.unit})`;
    const points=result.points,traces=[],prior=points.filter(p=>p.prior).map(p=>p.prior);
    const detail=(p,axis)=>{const d=p[axis+'Detail'];return `${B.esc(d.label||d.period)}；比較基準 ${B.esc(d.baseLabel||d.base||'—')}`;};
    const hover=p=>`${B.esc(p.player.name)} · ${B.esc(p.player.level)} · ${B.esc(p.player.position)}<br>${B.esc(axisLabel(xAxis,xm))}：${B.fmt(p.x,xAxis.mode==='delta')}<br>${B.esc(axisLabel(yAxis,ym))}：${B.fmt(p.y,yAxis.mode==='delta')}<br>X 期間：${detail(p,'x')}<br>Y 期間：${detail(p,'y')}`;
    const defaultColor=p=>{const v=yAxis.mode==='delta'?p.y:xAxis.mode==='delta'?p.x:null;return v===null?'#197aa4':v>0?'#c2323b':v<0?'#177342':'#687585';};
    if(movement){const lx=[],ly=[];for(const p of points)if(p.prior){lx.push(p.prior.x,p.x,null);ly.push(p.prior.y,p.y,null);}if(lx.length)traces.push({type:'scatter',x:lx,y:ly,mode:'lines',name:'移動軌跡',line:{color:'#9aacba',dash:'dash',width:1.3},hoverinfo:'skip'});}
    if(previous&&prior.length)traces.push({type:'scatter',x:prior.map(p=>p.x),y:prior.map(p=>p.y),mode:'markers',name:'前一期有效位置',customdata:prior.map(p=>p.player.name),text:prior.map(hover),hovertemplate:'%{text}<extra>前一期</extra>',marker:{size:9,symbol:'circle-open',color:'#8199ac',line:{width:1.5}}});
    traces.push({type:'scatter',x:points.map(p=>p.x),y:points.map(p=>p.y),mode:names&&!spread?'markers+text':'markers',name:'當期球員',text:names&&!spread?points.map(p=>B.esc(p.player.name)):undefined,textposition:'top center',textfont:{size:12},hovertext:points.map(hover),hovertemplate:'%{hovertext}<extra></extra>',customdata:points.map(p=>p.player.name),marker:{size:11,color:points.map(p=>B.state.marks.get(p.player.name)||defaultColor(p)),line:{width:1,color:'white'}}});
    const layout=C.base(title,summary);layout.margin={l:74,r:32,t:86,b:85};
    const extent=(key,center)=>{const vals=[...points,...((previous||movement)?prior:[])].map(p=>p[key]);if(B.valid(center))vals.push(center);if(!vals.length)return [-1,1];let min=Math.min(...vals),max=Math.max(...vals);const pad=Math.max((max-min)*.23,.1);return[min-pad,max+pad];};
    layout.xaxis={...layout.xaxis,title:{text:B.esc(axisLabel(xAxis,xm))},tickformat:'.2f',range:extent('x',result.centerX)};
    layout.yaxis={...layout.yaxis,title:{text:B.esc(axisLabel(yAxis,ym))},range:extent('y',result.centerY)};
    layout.shapes=[];
    if(B.valid(result.centerX))layout.shapes.push({type:'line',xref:'x',yref:'paper',x0:result.centerX,x1:result.centerX,y0:0,y1:1,line:{color:'#5f7f91',width:1,dash:'dot'}});
    if(B.valid(result.centerY))layout.shapes.push({type:'line',xref:'paper',yref:'y',x0:0,x1:1,y0:result.centerY,y1:result.centerY,line:{color:'#5f7f91',width:1,dash:'dot'}});
    layout.annotations=movement?points.filter(p=>p.prior&&(p.x!==p.prior.x||p.y!==p.prior.y)).map(p=>({x:p.x,y:p.y,ax:p.x-(p.x-p.prior.x)*.08,ay:p.y-(p.y-p.prior.y)*.08,xref:'x',yref:'y',axref:'x',ayref:'y',showarrow:true,text:'',arrowhead:2,arrowsize:1,arrowwidth:1.2,arrowcolor:'#9aacba'})):[];
    if(!points.length)layout.annotations.push({x:.5,y:.5,xref:'paper',yref:'paper',text:'沒有同時具備 X、Y 有效值的球員',showarrow:false});
    const exportPoint=(p,type)=>({資料點:type,姓名:p.player.name,背號:p.player.number,分級:p.player.level,位置:p.player.position,期間:p.label||p.period,X指標:xAxis.key,X模式:xAxis.mode,X單位:xAxis.mode==='delta'&&xm.key==='pbf'?'百分點':xm.unit,X值:B.fmt(p.x,xAxis.mode==='delta'),X比較基準:p.xDetail.baseLabel||p.xDetail.base||'—',X前期值:B.fmt(p.xDetail.previous),Y指標:yAxis.key,Y模式:yAxis.mode,Y單位:yAxis.mode==='delta'&&ym.key==='pbf'?'百分點':ym.unit,Y值:B.fmt(p.y,yAxis.mode==='delta'),Y比較基準:p.yDetail.baseLabel||p.yDetail.base||'—',Y前期值:B.fmt(p.yDetail.previous),X中心:B.fmt(result.centerX),Y中心:B.fmt(result.centerY),分析條件:summary});
    const rows=[...points.map(p=>exportPoint(p,'當期')),...((previous||movement)?prior.map(p=>exportPoint(p,'前一期')):[])];
    if(!rows.length)rows.push({資料點:'無有效資料',分析條件:summary,X指標:xAxis.key,Y指標:yAxis.key});
    const arrows=[...layout.annotations];
    if(names&&spread){const el=typeof document==='undefined'?null:document.getElementById(id);layout.annotations.push(...C.labelAnnotations(points,layout.xaxis.range,layout.yaxis.range,Math.max(250,(el?.clientWidth||900)-106),Math.max(220,(el?.clientHeight||480)-171)));}
    C.mount(id,traces,layout,rows,title,event=>{const clicked=event.points?.find(p=>p.customdata);if(!clicked)return;const pool=[...points,...((previous||movement)?prior:[])];const same=[...new Set(pool.filter(p=>p.x===clicked.x&&p.y===clicked.y).map(p=>p.player.name))];onClick?.(same.length>1?same:clicked.customdata);});
    const item=B.state.chartData.get(id);if(item)item.scatter={points,names,spread,arrows,onClick};
  };
})(BB);
