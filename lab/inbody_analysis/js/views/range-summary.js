(function(B){
  'use strict';
  const U=B.UI,V=B.Views=B.Views||{},R=V.RangeSummary={},defaults=['weight','ffmi','pbf','smm'];
  let state,source;
  const month=s=>s.replace('-','/');
  const interval=r=>month(r.startMonth)+(r.startMonth===r.endMonth?'':'～'+month(r.endMonth));
  const scope=r=>`${r.filter.level||'不分級'} · ${r.filter.position||'全部位置'}`;
  const unit=(m,delta=false)=>delta&&m.unit==='%'?'百分點':m.unit;
  const note='平均：起訖月份內，每位球員所有有效測量值的平均。Δ：終點月平均 − 起點月平均；任一端缺值時顯示 —。停用測量不列入。';
  const shortMonth=(s,r)=>r.startMonth.slice(0,4)===r.endMonth.slice(0,4)?Number(s.slice(5))+'月':month(s);
  const deltaPeriod=r=>shortMonth(r.endMonth,r)+' − '+shortMonth(r.startMonth,r);
  const missing=c=>!c.startCount&&!c.endCount?'起點月與終點月皆缺值':!c.startCount?'起點月缺值':!c.endCount?'終點月缺值':'';
  const tip=(c,r,delta)=>delta?`${month(r.endMonth)} 平均 ${B.fmt(c.end)}（${c.endCount} 筆） − ${month(r.startMonth)} 平均 ${B.fmt(c.start)}（${c.startCount} 筆）${missing(c)?'；'+missing(c):''}`:`${interval(r)}：${c.count} 筆有效值`;
  R.table=r=>`<table class="range-summary-table"><caption class="sr-only">${U.e(scope(r))} ${interval(r)} 區間平均與首尾月差值</caption><thead><tr><th rowspan="2" scope="col">姓名</th><th colspan="${r.metrics.length}" scope="colgroup">${interval(r)} 區間平均</th>${r.metrics.map((m,i)=>`<th scope="col" class="${i===0?'range-delta-start':''}">Δ${U.e(m.label)}<small>${U.e(unit(m,true))}</small></th>`).join('')}</tr><tr>${r.metrics.map(m=>`<th scope="col">${U.e(m.label)}<small>${U.e(unit(m))}</small></th>`).join('')}${r.metrics.map((m,i)=>`<th class="${i===0?'range-delta-start':''}"><span class="delta-period">${deltaPeriod(r)}</span></th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr><th scope="row" title="${U.e(row.player.level+' · '+row.player.position+' · 背號 '+row.player.number)}">${U.e(row.player.name)}</th>${r.metrics.map(m=>`<td tabindex="0" title="${U.e(tip(row.cells[m.key],r,false))}">${B.fmt(row.cells[m.key].mean)}</td>`).join('')}${r.metrics.map((m,i)=>`<td tabindex="0" class="${i===0?'range-delta-start':''}" title="${U.e(tip(row.cells[m.key],r,true))}">${B.fmt(row.cells[m.key].delta,true)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${1+r.metrics.length*2}" class="range-empty">此分級與位置沒有球員。</td></tr>`}</tbody></table>`;
  R.csvRows=r=>r.rows.map(row=>{
    const out={姓名:row.player.name,分級:row.player.level,位置:row.player.position,背號:row.player.number,起點月份:r.startMonth,終點月份:r.endMonth};
    for(const m of r.metrics)out[`${m.label}區間平均${unit(m)?' ('+unit(m)+')':''}`]=B.fmt(row.cells[m.key].mean);
    for(const m of r.metrics)out[`Δ${m.label}${unit(m,true)?' ('+unit(m,true)+')':''}`]=B.fmt(row.cells[m.key].delta,true);
    for(const m of r.metrics){const c=row.cells[m.key];out[`${m.label}有效筆數`]=c.count;out[`${m.label}起點月平均`]=B.fmt(c.start);out[`${m.label}起點月有效筆數`]=c.startCount;out[`${m.label}終點月平均`]=B.fmt(c.end);out[`${m.label}終點月有效筆數`]=c.endCount;out[`${m.label}差值提示`]=missing(c);}
    return out;
  });
  const card=(r,id,title)=>{
    const active=r.rows.filter(row=>r.metrics.some(m=>B.valid(row.cells[m.key].mean))).length;
    return `<section class="panel range-result" id="${id}"><div class="metric-header"><div><h3>${U.e(title)} · ${interval(r)}</h3><p>${U.e(scope(r))} · 名單 ${r.rows.length} 人 · 區間有值 ${active} 人</p></div><div class="actions">${['png','svg','csv'].map(f=>`<button class="small" data-summary-export="${id}" data-format="${f}" ${r.rows.length?'':'disabled'}>${f.toUpperCase()}</button>`).join('')}${U.expandButton(id,'全螢幕')}</div></div><div class="table-scroll" tabindex="0" aria-label="${U.e(title)}，可左右捲動">${R.table(r)}</div><div class="table-note">${note}<br>數值皆保留兩位小數；體脂率 Δ 的單位為百分點。滑鼠停留或鍵盤聚焦儲存格可核對有效筆數及端點月平均。</div><div class="range-cell-detail" role="status" aria-live="polite">點選數值，可在此查看計算依據。</div></section>`;
  };
  const result=keys=>B.Analysis.rangeSummary(B.state.engine,{filter:{level:state.level,position:state.position},startMonth:state.startMonth,endMonth:state.endMonth,keys});
  R.render=id=>{
    const root=document.getElementById(id);if(!root)return;
    const e=B.state.engine,data=B.state.data;
    if(source!==data){
      const end=e.max.slice(0,7),d=new Date(end+'-01T00:00:00Z'),prior=B.iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).slice(0,7);
      state={level:'',position:'',startMonth:prior<e.min.slice(0,7)?end:prior,endMonth:end,customOpen:false,customKeys:['weight']};source=data;
    }
    root.className='range-summary';
    root.innerHTML=`<div class="dual-heading"><h2>區間平均與首尾月差值</h2><p>依球員列出區間內的平均，以及指定起點月到終點月的變化。</p></div><form id="range-summary-form" class="range-summary-controls"><div class="toolbar">${U.select('range-summary-level','分級',[{value:'',label:'不分級'},...B.levels(data.players).filter(Boolean)],state.level)}${U.select('range-summary-position','位置',[{value:'',label:'全部位置'},...B.positions(data.players)],state.position)}<label>起點月份<input id="range-summary-start" type="month" required value="${state.startMonth}"></label><label>終點月份<input id="range-summary-end" type="month" required value="${state.endMonth}"></label><button type="submit" class="primary">更新表格</button></div><p class="conditions">本區獨立篩選，固定採用平均。選好條件後按「更新表格」。</p><p id="range-summary-error" role="alert" hidden></p></form><div id="range-summary-results"></div><details id="range-summary-custom" class="panel range-custom" ${state.customOpen?'open':''}><summary>自訂指標表（選用）</summary><p class="conditions">沿用本區分級、位置及起訖月份；可增加其他指標，與預設四項分開顯示。</p><div id="range-summary-custom-controls"></div><div id="range-summary-custom-result"></div></details>`;
    R.paint();R.paintCustomControls();
    document.getElementById('range-summary-form').onsubmit=event=>{
      event.preventDefault();const next={...state,level:U.val('range-summary-level'),position:U.val('range-summary-position'),startMonth:U.val('range-summary-start'),endMonth:U.val('range-summary-end')};
      const error=document.getElementById('range-summary-error');
      try{B.Analysis.rangeSummary(e,{filter:{level:next.level,position:next.position},startMonth:next.startMonth,endMonth:next.endMonth});state=next;error.hidden=true;R.paint();}
      catch(err){error.textContent=err.message+' 表格仍顯示上次套用的條件。';error.hidden=false;}
    };
    U.bind('range-summary-custom','toggle',()=>{state.customOpen=document.getElementById('range-summary-custom').open;if(state.customOpen)R.paintCustom();});
  };
  R.paint=()=>{
    U.closeViewer();const root=document.getElementById('range-summary-results'),r=result(defaults);
    root.innerHTML=card(r,'range-summary-default-table','預設四項');R.wireCard(root,r);
    if(state.customOpen)R.paintCustom();else document.getElementById('range-summary-custom-result').innerHTML='';
  };
  R.paintCustomControls=()=>{
    const root=document.getElementById('range-summary-custom-controls');
    root.innerHTML=`<div class="metric-tags">${state.customKeys.map(key=>{const m=B.state.data.registry.find(m=>m.key===key);return `<button class="metric-tag" data-summary-remove="${U.e(key)}" aria-label="從自訂表移除${U.e(m.label)}">${U.e(m.label)} ×</button>`;}).join('')}</div><div class="metric-add">${U.metricSelect('range-summary-metric','加入指標',state.customKeys.at(-1))}<button class="small" id="range-summary-add">加入自訂表</button></div>`;
    U.wireMetric('range-summary-metric');
    U.bind('range-summary-add','click',()=>{const key=U.readMetric('range-summary-metric');if(state.customKeys.includes(key))return U.toast('此指標已在自訂表中。');state.customKeys.push(key);R.paintCustomControls();R.paintCustom();});
    root.querySelectorAll('[data-summary-remove]').forEach(button=>button.onclick=()=>{if(state.customKeys.length===1)return U.toast('自訂表至少保留一項指標。');state.customKeys=state.customKeys.filter(k=>k!==button.dataset.summaryRemove);R.paintCustomControls();R.paintCustom();});
  };
  R.paintCustom=()=>{
    U.closeViewer();const root=document.getElementById('range-summary-custom-result'),r=result(state.customKeys);
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
  // Draw the same table as self-contained vector cells (no DOM capture or fonts fetched).
  R.svg=(r,title='預設四項')=>{
    const textWidth=s=>Array.from(s).reduce((sum,c)=>sum+(c.charCodeAt(0)<256?9:16),0)+32;
    const columns=[Math.max(150,...r.rows.map(row=>textWidth(row.player.name))),...r.metrics.map(m=>Math.max(124,textWidth(m.label+' ('+unit(m)+')'))),...r.metrics.map(m=>Math.max(124,textWidth('Δ'+m.label+' ('+unit(m,true)+')'),textWidth(deltaPeriod(r))))];
    const x=[24];columns.forEach(w=>x.push(x.at(-1)+w));const width=Math.max(960,x.at(-1)+24),top=106,header=88,rowH=38,height=top+header+Math.max(1,r.rows.length)*rowH+104;
    const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Microsoft JhengHei, Noto Sans CJK TC, Arial, sans-serif" font-size="16" fill="#243e53">`];
    const text=(value,tx,ty,size=16,anchor='start',weight=400)=>parts.push(`<text x="${tx}" y="${ty}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}">${U.e(value)}</text>`);
    const cell=(col,y,w,h,value,head=false)=>{parts.push(`<rect x="${x[col]}" y="${y}" width="${w}" height="${h}" fill="${head?'#f1f5f8':'#ffffff'}" stroke="#c7d3dd"/>`);text(value,col===0?x[col]+14:x[col]+w/2,y+h/2+6,16,col===0?'start':'middle',head?600:400);};
    text(`${title} · ${interval(r)} 區間平均與首尾月差值`,24,37,23,'start',600);text(`${scope(r)} · ${r.rows.length} 人 · 平均採區間內所有有效測量`,24,70,15);
    cell(0,top,columns[0],header,'姓名',true);const n=r.metrics.length;
    cell(1,top,columns.slice(1,n+1).reduce((a,b)=>a+b,0),44,interval(r)+' 區間平均',true);
    r.metrics.forEach((m,i)=>{cell(i+1,top+44,columns[i+1],44,m.label+(unit(m)?' ('+unit(m)+')':''),true);cell(n+i+1,top,columns[n+i+1],44,'Δ'+m.label+(unit(m,true)?' ('+unit(m,true)+')':''),true);cell(n+i+1,top+44,columns[n+i+1],44,deltaPeriod(r),true);});
    r.rows.forEach((row,i)=>{const y=top+header+i*rowH;cell(0,y,columns[0],rowH,row.player.name);r.metrics.forEach((m,j)=>cell(j+1,y,columns[j+1],rowH,B.fmt(row.cells[m.key].mean)));r.metrics.forEach((m,j)=>cell(n+j+1,y,columns[n+j+1],rowH,B.fmt(row.cells[m.key].delta,true)));});
    const bottom=top+header+Math.max(1,r.rows.length)*rowH;
    text(`Δ = ${month(r.endMonth)} 月平均 − ${month(r.startMonth)} 月平均。任一端缺值顯示 —，不借用其他月份。`,24,bottom+31,14);
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
