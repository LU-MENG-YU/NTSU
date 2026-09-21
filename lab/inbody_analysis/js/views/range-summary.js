(function(B){
  'use strict';
  const U=B.UI,V=B.Views=B.Views||{},R=V.RangeSummary={},defaults=['weight','ffmi','pbf','smm'];
  let state,source;
  const prettyDate=s=>String(s||'').replaceAll('-','/');
  const scope=r=>U.levelPositionText(r.filter);
  const unit=(m,delta=false)=>delta&&m.unit==='%'?'百分點':m.unit;
  const unitName=u=>u==='day'?'日':u==='week'?'週':'月';
  const periodLabel=p=>p?.label||p?.key||`${prettyDate(p?.start)}～${prettyDate(p?.end)}`;
  const interval=r=>r.start===r.end?prettyDate(r.start):`${prettyDate(r.start)}～${prettyDate(r.end)}`;
  const deltaPeriod=r=>`${periodLabel(r.endPeriod)} − ${periodLabel(r.startPeriod)}`;
  const note=r=>`平均：起訖${unitName(r.unit)}期間內，每位球員所有有效測量值的平均。Δ：終點${unitName(r.unit)}平均 − 起點${unitName(r.unit)}平均；任一端缺值時顯示 —。停用測量不列入。`;
  const missing=(c,r)=>!c.startCount&&!c.endCount?`起點${unitName(r.unit)}與終點${unitName(r.unit)}皆缺值`:!c.startCount?`起點${unitName(r.unit)}缺值`:!c.endCount?`終點${unitName(r.unit)}缺值`:'';
  const tip=(c,r,delta)=>delta?`${periodLabel(r.endPeriod)} 平均 ${B.fmt(c.end)}（${c.endCount} 筆） − ${periodLabel(r.startPeriod)} 平均 ${B.fmt(c.start)}（${c.startCount} 筆）${missing(c,r)?'；'+missing(c,r):''}`:`${interval(r)}：${c.count} 筆有效值`;
  const monthPeriod=month=>({...B.range(month,month),key:month,label:month.replace('-','/')});
  const dayPeriod=day=>({start:day,end:day,key:day,label:prettyDate(day)});
  const weekPeriod=(month,index)=>{
    const p=B.Extras.monthWeeks(month).find(w=>w.index===String(index));
    if(!p)throw Error('請選擇有效的週次。');
    return {...p,label:p.weekLabel+'（'+p.dateLabel+'）'};
  };
  const periodsFrom=s=>{
    if(s.unit==='month')return {startPeriod:monthPeriod(s.startMonth),endPeriod:monthPeriod(s.endMonth)};
    if(s.unit==='week')return {startPeriod:weekPeriod(s.startWeekMonth,s.startWeek),endPeriod:weekPeriod(s.endWeekMonth,s.endWeek)};
    return {startPeriod:dayPeriod(s.startDay),endPeriod:dayPeriod(s.endDay)};
  };
  const endpointFields=r=>({start:`起點${unitName(r.unit)}`,end:`終點${unitName(r.unit)}`});
  R.table=r=>`<table class="range-summary-table"><caption class="sr-only">${U.e(scope(r))} ${interval(r)} 區間平均與首尾${unitName(r.unit)}差值</caption><thead><tr><th rowspan="2" scope="col">姓名</th><th colspan="${r.metrics.length}" scope="colgroup">${interval(r)} 區間平均</th>${r.metrics.map((m,i)=>`<th scope="col" class="${i===0?'range-delta-start':''}">Δ${U.e(m.label)}<small>${U.e(unit(m,true))}</small></th>`).join('')}</tr><tr>${r.metrics.map(m=>`<th scope="col">${U.e(m.label)}<small>${U.e(unit(m))}</small></th>`).join('')}${r.metrics.map((m,i)=>`<th class="${i===0?'range-delta-start':''}"><span class="delta-period">${U.e(deltaPeriod(r))}</span></th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr><th scope="row" title="${U.e(row.player.level+' · '+row.player.position+' · 背號 '+row.player.number)}">${U.e(row.player.name)}</th>${r.metrics.map(m=>`<td tabindex="0" title="${U.e(tip(row.cells[m.key],r,false))}">${B.fmt(row.cells[m.key].mean)}</td>`).join('')}${r.metrics.map((m,i)=>`<td tabindex="0" class="${i===0?'range-delta-start':''}" title="${U.e(tip(row.cells[m.key],r,true))}">${B.fmt(row.cells[m.key].delta,true)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${1+r.metrics.length*2}" class="range-empty">目前沒有選取球員，或此條件下沒有球員。</td></tr>`}</tbody></table>`;
  R.csvRows=r=>r.rows.map(row=>{
    const ep=endpointFields(r),out={姓名:row.player.name,分級:row.player.level,位置:row.player.position,背號:row.player.number,時間單位:unitName(r.unit),起點期間:periodLabel(r.startPeriod),終點期間:periodLabel(r.endPeriod)};
    for(const m of r.metrics)out[`${m.label}區間平均${unit(m)?' ('+unit(m)+')':''}`]=B.fmt(row.cells[m.key].mean);
    for(const m of r.metrics)out[`Δ${m.label}${unit(m,true)?' ('+unit(m,true)+')':''}`]=B.fmt(row.cells[m.key].delta,true);
    for(const m of r.metrics){const c=row.cells[m.key];out[`${m.label}有效筆數`]=c.count;out[`${m.label}${ep.start}平均`]=B.fmt(c.start);out[`${m.label}${ep.start}有效筆數`]=c.startCount;out[`${m.label}${ep.end}平均`]=B.fmt(c.end);out[`${m.label}${ep.end}有效筆數`]=c.endCount;out[`${m.label}差值提示`]=missing(c,r);}
    return out;
  });
  const card=(r,id,title)=>{
    const active=r.rows.filter(row=>r.metrics.some(m=>B.valid(row.cells[m.key].mean))).length;
    return `<section class="panel range-result" id="${id}"><div class="metric-header"><div><h3>${U.e(title)} · ${U.e(interval(r))}</h3><p>${U.e(scope(r))} · 顯示 ${r.rows.length} 人 · 區間有值 ${active} 人</p></div><div class="actions">${['png','svg','csv'].map(f=>`<button class="small" data-summary-export="${id}" data-format="${f}" ${r.rows.length?'':'disabled'}>${f.toUpperCase()}</button>`).join('')}${U.expandButton(id,'全螢幕')}</div></div><div class="table-scroll" tabindex="0" aria-label="${U.e(title)}，可左右捲動">${R.table(r)}</div><div class="table-note">${U.e(note(r))}<br>數值皆保留兩位小數；體脂率 Δ 的單位為百分點。滑鼠停留或鍵盤聚焦儲存格可核對有效筆數及端點平均。</div><div class="range-cell-detail" role="status" aria-live="polite">點選數值，可在此查看計算依據。</div></section>`;
  };
  const eligible=()=>B.state.engine.players({positionsByLevel:state.positionsByLevel});
  const filteredResult=r=>({...r,rows:r.rows.filter(row=>!state.hidden.has(row.player.name))});
  const result=keys=>{
    const p=periodsFrom(state),r=B.Analysis.rangeSummary(B.state.engine,{filter:{positionsByLevel:state.positionsByLevel},unit:state.unit,...p,keys});
    return filteredResult(r);
  };
  const selectorMarkup=()=>{
    const people=eligible(),levels=B.levels(people).filter(level=>people.some(p=>p.level===level));
    const groups=levels.map(level=>{
      const byLevel=people.filter(p=>p.level===level);
      return `<section class="range-roster-level"><div class="range-roster-level-head"><strong>${U.e(level||'未分級')}</strong><span>${byLevel.length} 人</span></div>${B.positions(byLevel).map(position=>{const ps=B.sortPlayers(byLevel.filter(p=>p.position===position));return ps.length?`<div class="range-roster-group"><div class="position-label">${U.e(position)}</div><div class="range-player-list">${ps.map(p=>`<label class="range-player-pick"><input type="checkbox" data-range-player="${U.e(p.name)}" ${state.hidden.has(p.name)?'':'checked'}><span class="jersey">${U.e(p.number)}</span><span>${U.e(p.name)}</span></label>`).join('')}</div></div>`:'';}).join('')}</section>`;
    }).join('');
    const shown=people.filter(p=>!state.hidden.has(p.name)).length;
    return `<details class="range-player-selector" open><summary>顯示球員（${shown} / ${people.length}）</summary><div class="range-player-actions"><button type="button" class="small" id="range-player-all">全部顯示</button><button type="button" class="small" id="range-player-none">全部隱藏</button></div><div class="range-roster-grid">${groups||'<p class="muted small">目前篩選沒有球員。</p>'}</div></details>`;
  };
  const periodControls=()=>{
    if(state.unit==='month')return `<label>起點月份<input id="range-summary-start-month" type="month" required value="${state.startMonth}"></label><label>終點月份<input id="range-summary-end-month" type="month" required value="${state.endMonth}"></label>`;
    if(state.unit==='day')return `<label>起點日期<input id="range-summary-start-day" type="date" required value="${state.startDay}"></label><label>終點日期<input id="range-summary-end-day" type="date" required value="${state.endDay}"></label>`;
    const sw=B.Extras.monthWeeks(state.startWeekMonth),ew=B.Extras.monthWeeks(state.endWeekMonth);
    return `<label>起點月<input id="range-summary-start-week-month" type="month" required value="${state.startWeekMonth}"></label>${U.select('range-summary-start-week','起點週',sw.map(w=>({value:w.index,label:w.label})),state.startWeek)}<label>終點月<input id="range-summary-end-week-month" type="month" required value="${state.endWeekMonth}"></label>${U.select('range-summary-end-week','終點週',ew.map(w=>({value:w.index,label:w.label})),state.endWeek)}`;
  };
  const readControls=()=>{
    const next={...state,positionsByLevel:U.readLevelPositions('range-summary-'),unit:U.val('range-summary-unit')};
    if(next.unit==='month'){next.startMonth=U.val('range-summary-start-month');next.endMonth=U.val('range-summary-end-month');}
    else if(next.unit==='day'){next.startDay=U.val('range-summary-start-day');next.endDay=U.val('range-summary-end-day');}
    else{next.startWeekMonth=U.val('range-summary-start-week-month');next.startWeek=U.val('range-summary-start-week');next.endWeekMonth=U.val('range-summary-end-week-month');next.endWeek=U.val('range-summary-end-week');}
    return next;
  };
  const validate=s=>{
    const p=periodsFrom(s);B.Analysis.rangeSummary(B.state.engine,{filter:{positionsByLevel:s.positionsByLevel},unit:s.unit,...p,keys:defaults});
    return p;
  };
  R.render=id=>{
    const root=document.getElementById(id);if(!root)return;
    const e=B.state.engine,data=B.state.data;
    if(source!==data){
      const endMonth=e.max.slice(0,7),d=new Date(endMonth+'-01T00:00:00Z'),prior=B.iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).slice(0,7),startMonth=prior<e.min.slice(0,7)?endMonth:prior;
      const sWeeks=B.Extras.monthWeeks(startMonth),eWeeks=B.Extras.monthWeeks(endMonth);
      state={positionsByLevel:U.defaultLevelPositions(),unit:'month',startMonth,endMonth,startDay:e.min,endDay:e.max,startWeekMonth:startMonth,startWeek:sWeeks[0]?.index||'1',endWeekMonth:endMonth,endWeek:eWeeks.at(-1)?.index||'1',hidden:new Set(),customOpen:false,customKeys:['weight']};source=data;
    }
    root.className='range-summary';
    root.innerHTML=`<div class="dual-heading"><h2>區間平均與首尾${unitName(state.unit)}差值</h2><p>依球員列出區間平均，以及指定起點${unitName(state.unit)}到終點${unitName(state.unit)}的變化。</p></div><form id="range-summary-form" class="range-summary-controls"><div class="toolbar">${U.levelPositionControls(state.positionsByLevel,'range-summary-')}${U.select('range-summary-unit','時間單位',[{value:'month',label:'月 Month'},{value:'week',label:'週（日～六）'},{value:'day',label:'日 Day'}],state.unit)}${periodControls()}<button type="submit" class="primary">更新表格</button></div><p class="conditions">本區獨立篩選，固定採用 Average 平均。週次固定為週日～週六，月初與月底所在週可跨月。</p><p id="range-summary-error" role="alert" hidden></p>${selectorMarkup()}</form><div id="range-summary-results"></div><details id="range-summary-custom" class="panel range-custom" ${state.customOpen?'open':''}><summary>自訂指標表（選用）</summary><p class="conditions">沿用本區一軍／二軍位置、顯示球員與起訖期間；可增加其他指標，與預設四項分開顯示。</p><div id="range-summary-custom-controls"></div><div id="range-summary-custom-result"></div></details>`;
    U.wireLevelPositions('range-summary-');R.wireControls();R.paint();R.paintCustomControls();
    U.bind('range-summary-custom','toggle',()=>{state.customOpen=document.getElementById('range-summary-custom').open;if(state.customOpen)R.paintCustom();});
  };
  R.wireControls=()=>{
    const rerenderFor=()=>{const next=readControls();try{validate(next);const eligibleNames=new Set(B.state.engine.players({positionsByLevel:next.positionsByLevel}).map(p=>p.name)),hidden=new Set([...state.hidden].filter(name=>eligibleNames.has(name)));state={...next,hidden,customOpen:state.customOpen,customKeys:state.customKeys};R.render(document.querySelector('.range-summary')?.id||'comparison-range-summary');}catch(err){U.toast(err.message);}};
    for(const id of U.levelPositionIds('range-summary-'))U.bind(id,'change',rerenderFor);
    U.bind('range-summary-unit','change',()=>{state.unit=U.val('range-summary-unit');R.render(document.querySelector('.range-summary')?.id||'comparison-range-summary');});
    for(const id of ['range-summary-start-week-month','range-summary-end-week-month'])U.bind(id,'change',()=>{const isStart=id.includes('start'),m=U.val(id),weeks=B.Extras.monthWeeks(m);if(isStart){state.startWeekMonth=m;state.startWeek=weeks[0]?.index||'1';}else{state.endWeekMonth=m;state.endWeek=weeks.at(-1)?.index||'1';}R.render(document.querySelector('.range-summary')?.id||'comparison-range-summary');});
    document.getElementById('range-summary-form').onsubmit=event=>{
      event.preventDefault();const next=readControls(),error=document.getElementById('range-summary-error');
      try{validate(next);const eligibleNames=new Set(B.state.engine.players({positionsByLevel:next.positionsByLevel}).map(p=>p.name)),hidden=new Set([...state.hidden].filter(name=>eligibleNames.has(name)));state={...next,hidden,customOpen:state.customOpen,customKeys:state.customKeys};error.hidden=true;R.render(document.querySelector('.range-summary')?.id||'comparison-range-summary');}
      catch(err){error.textContent=err.message+' 表格仍顯示上次套用的條件。';error.hidden=false;}
    };
    document.getElementById('range-player-all')?.addEventListener('click',()=>{eligible().forEach(p=>state.hidden.delete(p.name));R.paintPlayerSelector();R.paint();});
    document.getElementById('range-player-none')?.addEventListener('click',()=>{eligible().forEach(p=>state.hidden.add(p.name));R.paintPlayerSelector();R.paint();});
    document.querySelectorAll('[data-range-player]').forEach(input=>input.onchange=()=>{input.checked?state.hidden.delete(input.dataset.rangePlayer):state.hidden.add(input.dataset.rangePlayer);R.paintPlayerSelector(false);R.paint();});
  };
  R.paintPlayerSelector=(replace=true)=>{
    const current=document.querySelector('.range-player-selector');if(!current)return;
    if(replace){current.outerHTML=selectorMarkup();document.getElementById('range-player-all')?.addEventListener('click',()=>{eligible().forEach(p=>state.hidden.delete(p.name));R.paintPlayerSelector();R.paint();});document.getElementById('range-player-none')?.addEventListener('click',()=>{eligible().forEach(p=>state.hidden.add(p.name));R.paintPlayerSelector();R.paint();});document.querySelectorAll('[data-range-player]').forEach(input=>input.onchange=()=>{input.checked?state.hidden.delete(input.dataset.rangePlayer):state.hidden.add(input.dataset.rangePlayer);R.paintPlayerSelector(false);R.paint();});}
    else{const summary=current.querySelector('summary'),people=eligible();if(summary)summary.textContent=`顯示球員（${people.filter(p=>!state.hidden.has(p.name)).length} / ${people.length}）`;}
  };
  R.paint=()=>{
    U.closeViewer();const root=document.getElementById('range-summary-results');if(!root)return;const r=result(defaults);
    root.innerHTML=card(r,'range-summary-default-table','預設四項');R.wireCard(root,r);
    if(state.customOpen)R.paintCustom();else{const custom=document.getElementById('range-summary-custom-result');if(custom)custom.innerHTML='';}
  };
  R.paintCustomControls=()=>{
    const root=document.getElementById('range-summary-custom-controls');if(!root)return;
    root.innerHTML=`<div class="metric-tags">${state.customKeys.map(key=>{const m=B.state.data.registry.find(m=>m.key===key);return `<button class="metric-tag" data-summary-remove="${U.e(key)}" aria-label="從自訂表移除${U.e(m.label)}">${U.e(m.label)} ×</button>`;}).join('')}</div><div class="metric-add">${U.metricSelect('range-summary-metric','加入指標',state.customKeys.at(-1))}<button class="small" id="range-summary-add">加入自訂表</button></div>`;
    U.wireMetric('range-summary-metric');
    U.bind('range-summary-add','click',()=>{const key=U.readMetric('range-summary-metric');if(state.customKeys.includes(key))return U.toast('此指標已在自訂表中。');state.customKeys.push(key);R.paintCustomControls();R.paintCustom();});
    root.querySelectorAll('[data-summary-remove]').forEach(button=>button.onclick=()=>{if(state.customKeys.length===1)return U.toast('自訂表至少保留一項指標。');state.customKeys=state.customKeys.filter(k=>k!==button.dataset.summaryRemove);R.paintCustomControls();R.paintCustom();});
  };
  R.paintCustom=()=>{
    U.closeViewer();const root=document.getElementById('range-summary-custom-result');if(!root)return;const r=result(state.customKeys);
    root.innerHTML=card(r,'range-summary-custom-table','自訂指標');R.wireCard(root,r);
  };
  R.wireCard=(root,r)=>{
    root.querySelectorAll('[data-expand]').forEach(button=>button.onclick=()=>U.expand(button.dataset.expand));
    root.querySelectorAll('td[title]').forEach(cell=>{const show=()=>{cell.closest('.range-result').querySelector('.range-cell-detail').textContent=cell.parentElement.querySelector('th').textContent+' · '+cell.title;};cell.onclick=show;cell.onfocus=show;});
    root.querySelectorAll('[data-summary-export]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;try{await R.export(r,button.dataset.format,button.dataset.summaryExport.includes('custom')?'自訂指標':'預設四項');U.toast(button.dataset.format==='svg'?'SVG 已準備完成，請點選下載 SVG。':'已產生 '+button.dataset.format.toUpperCase()+' 檔案。');}
      catch(err){U.toast('匯出失敗：'+err.message);}finally{button.disabled=false;}
    });
  };
  R.svg=(r,title='預設四項')=>{
    const textWidth=s=>Array.from(s).reduce((sum,c)=>sum+(c.charCodeAt(0)<256?9:16),0)+32;
    const columns=[Math.max(150,...r.rows.map(row=>textWidth(row.player.name))),...r.metrics.map(m=>Math.max(124,textWidth(m.label+' ('+unit(m)+')'))),...r.metrics.map(m=>Math.max(124,textWidth('Δ'+m.label+' ('+unit(m,true)+')'),textWidth(deltaPeriod(r))))];
    const x=[24];columns.forEach(w=>x.push(x.at(-1)+w));const width=Math.max(960,x.at(-1)+24),top=106,header=88,rowH=38,height=top+header+Math.max(1,r.rows.length)*rowH+104;
    const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Microsoft JhengHei, Noto Sans CJK TC, Arial, sans-serif" font-size="16" fill="#243e53">`];
    const text=(value,tx,ty,size=16,anchor='start',weight=400)=>parts.push(`<text x="${tx}" y="${ty}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}">${U.e(value)}</text>`);
    const cell=(col,y,w,h,value,head=false)=>{parts.push(`<rect x="${x[col]}" y="${y}" width="${w}" height="${h}" fill="${head?'#f1f5f8':'#ffffff'}" stroke="#c7d3dd"/>`);text(value,col===0?x[col]+14:x[col]+w/2,y+h/2+6,16,col===0?'start':'middle',head?600:400);};
    text(`${title} · ${interval(r)} 區間平均與首尾${unitName(r.unit)}差值`,24,37,23,'start',600);text(`${scope(r)} · ${r.rows.length} 人 · 平均採區間內所有有效測量`,24,70,15);
    cell(0,top,columns[0],header,'姓名',true);const n=r.metrics.length;
    cell(1,top,columns.slice(1,n+1).reduce((a,b)=>a+b,0),44,interval(r)+' 區間平均',true);
    r.metrics.forEach((m,i)=>{cell(i+1,top+44,columns[i+1],44,m.label+(unit(m)?' ('+unit(m)+')':''),true);cell(n+i+1,top,columns[n+i+1],44,'Δ'+m.label+(unit(m,true)?' ('+unit(m,true)+')':''),true);cell(n+i+1,top+44,columns[n+i+1],44,deltaPeriod(r),true);});
    r.rows.forEach((row,i)=>{const y=top+header+i*rowH;cell(0,y,columns[0],rowH,row.player.name);r.metrics.forEach((m,j)=>cell(j+1,y,columns[j+1],rowH,B.fmt(row.cells[m.key].mean)));r.metrics.forEach((m,j)=>cell(n+j+1,y,columns[n+j+1],rowH,B.fmt(row.cells[m.key].delta,true)));});
    const bottom=top+header+Math.max(1,r.rows.length)*rowH;
    text(`Δ = ${periodLabel(r.endPeriod)} 平均 − ${periodLabel(r.startPeriod)} 平均。任一端缺值顯示 —，不借用其他期間。`,24,bottom+31,14);
    text('各指標分別排除缺值；停用整筆測量不列入。體脂率 Δ 單位為百分點。',24,bottom+57,14);
    parts.push('</g></svg>');return {content:parts.join(''),width,height};
  };
  R.export=async(r,format,title)=>{
    const filename=`${title}－${scope(r)}－${interval(r)}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
    if(format==='csv')return B.Charts.csv(R.csvRows(r),filename+'.csv');
    const svg=R.svg(r,title);
    if(format==='svg'){
      const url=URL.createObjectURL(new Blob([svg.content],{type:'application/octet-stream'})),dialog=document.createElement('dialog');
      dialog.id='range-summary-svg-export';dialog.innerHTML='<button class="close" aria-label="關閉 SVG 匯出">×</button><h2>SVG 已準備完成</h2><p class="small muted" style="margin:14px 0;overflow-wrap:anywhere">'+U.e(filename+'.svg')+'</p><a class="button primary menu-link" href="'+url+'" download="'+U.e(filename+'.svg')+'">下載 SVG</a>';
      dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});document.body.append(dialog);dialog.showModal();return;
    }
    const url=URL.createObjectURL(new Blob([svg.content],{type:'image/svg+xml;charset=utf-8'}));
    try{
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('無法產生表格圖片。'));img.src=url;});
      const scale=Math.min(2,16384/svg.width,16384/svg.height,Math.sqrt(32000000/(svg.width*svg.height))),canvas=document.createElement('canvas');
      canvas.width=Math.ceil(svg.width*scale);canvas.height=Math.ceil(svg.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('瀏覽器無法建立圖片，請使用 SVG 匯出。');
      ctx.scale(scale,scale);ctx.drawImage(img,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('圖片過大，請縮小球員範圍或使用 SVG。');B.Charts.download(blob,filename+'.png','image/png');
    }finally{URL.revokeObjectURL(url);}
  };
})(BB);
