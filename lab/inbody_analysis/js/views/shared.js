(function(B){
  'use strict';
  const U=B.UI={};
  U.e=B.esc;U.main=()=>document.getElementById('main');
  U.toast=msg=>{const el=document.getElementById('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(U.toastTimer);U.toastTimer=setTimeout(()=>el.classList.remove('visible'),5000);};
  U.heading=(tag,title,description='',actions='')=>`<div class="heading"><div><div class="eyebrow">${B.esc(tag)}</div><h1>${B.esc(title)}</h1>${description?`<p>${B.esc(description)}</p>`:''}</div><div class="actions">${actions}</div></div>`;
  U.opt=(values,selected)=>values.map(v=>{const k=typeof v==='object'?v.value:v,l=typeof v==='object'?v.label:v;return `<option value="${B.esc(k)}" ${String(k)===String(selected)?'selected':''}>${B.esc(l)}</option>`;}).join('');
  U.select=(id,label,values,selected,extra='')=>`<label>${B.esc(label)}<select id="${id}" ${extra}>${U.opt(values,selected)}</select></label>`;
  U.multiSelect=(id,label,values,selected,allLabel='全部')=>{
    const choices=values.map(v=>typeof v==='object'?v:{value:v,label:v}),list=B.filterList(selected),active=list===null?new Set(choices.map(v=>String(v.value))):new Set(list.map(String));
    const text=list===null?allLabel:list.length?choices.filter(v=>active.has(String(v.value))).map(v=>v.label).join('、'):'未選';
    return `<div class="multi-select-field"><span class="multi-select-label">${B.esc(label)}</span><details class="multi-select" id="${id}" data-multi-select data-multi-all-label="${B.esc(allLabel)}"><summary><strong>${B.esc(text)}</strong></summary><div class="multi-select-menu"><div class="multi-select-actions"><button type="button" class="small" data-multi-all="${id}">全部</button><button type="button" class="small" data-multi-none="${id}">取消全部</button><button type="button" class="small primary" data-multi-apply="${id}">完成</button></div><div class="multi-select-options">${choices.map(v=>`<label><input type="checkbox" data-multi-option="${id}" value="${B.esc(v.value)}" ${active.has(String(v.value))?'checked':''}><span>${B.esc(v.label)}</span></label>`).join('')}</div></div></details></div>`;
  };
  U.multiVal=id=>{const root=document.getElementById(id);if(!root)return [];const inputs=[...root.querySelectorAll(`[data-multi-option="${id}"]`)],checked=inputs.filter(x=>x.checked).map(x=>x.value);return checked.length===inputs.length?[]:checked.length?checked:['__NONE__'];};
  U.wireMulti=id=>{const root=document.getElementById(id);if(!root)return;const details=root,inputs=()=>[...root.querySelectorAll(`[data-multi-option="${id}"]`)];const update=()=>{const all=inputs(),checked=all.filter(x=>x.checked),strong=root.querySelector('summary strong');if(strong)strong.textContent=checked.length===all.length?(root.dataset.multiAllLabel||'全部'):checked.length?checked.map(x=>x.closest('label')?.querySelector('span')?.textContent||x.value).join('、'):'未選';};const fire=()=>{update();if(details)details.open=false;root.dispatchEvent(new Event('change',{bubbles:false}));};inputs().forEach(input=>input.addEventListener('change',event=>{event.stopPropagation();update();}));root.querySelector(`[data-multi-all="${id}"]`)?.addEventListener('click',event=>{event.stopPropagation();inputs().forEach(x=>x.checked=true);update();});root.querySelector(`[data-multi-none="${id}"]`)?.addEventListener('click',event=>{event.stopPropagation();inputs().forEach(x=>x.checked=false);update();});root.querySelector(`[data-multi-apply="${id}"]`)?.addEventListener('click',event=>{event.stopPropagation();fire();});};
  U.method=(m,unit)=>U.select('method',unit==='week'?'週次代表方式（固定平均）':'期間代表方式',[{value:'avg',label:'Average 平均'},{value:'max',label:'Maximum 最大'},{value:'min',label:'Minimum 最小'}],unit==='week'?'avg':m,unit==='week'?'disabled':'');
  U.levelPositionLevels=()=>['一軍','二軍'];
  U.defaultLevelPositions=()=>Object.fromEntries(U.levelPositionLevels().map(level=>[level,[]]));
  U.levelPositionIds=(prefix='')=>U.levelPositionLevels().map((level,i)=>`${prefix}level-position-${i+1}`);
  U.levelPositionControls=(positionsByLevel={},prefix='')=>U.levelPositionLevels().map((level,i)=>{const values=B.positions(B.state.data.players.filter(p=>p.level===level));return U.multiSelect(`${prefix}level-position-${i+1}`,`${level}位置`,values,positionsByLevel?.[level]??[],'全部位置');}).join('');
  U.readLevelPositions=(prefix='')=>Object.fromEntries(U.levelPositionLevels().map((level,i)=>[level,U.multiVal(`${prefix}level-position-${i+1}`)]));
  U.wireLevelPositions=(prefix='')=>U.levelPositionIds(prefix).forEach(U.wireMulti);
  U.levelPositionText=filter=>{const byLevel=filter?.positionsByLevel;if(!byLevel)return `${B.filterText(filter?.level,'不分級')} · ${B.filterText(filter?.position,'全部位置')}`;const one=value=>{const list=B.filterList(value);return list===null?'全部位置':list.length?list.join('、'):'不選';};return U.levelPositionLevels().map(level=>`${level}：${one(byLevel[level])}`).join(' · ');};
  U.filter=(filter,year)=>`${U.select('year','年份',B.state.engine.years,year)}${U.levelPositionControls(filter.positionsByLevel||U.defaultLevelPositions())}`;
  U.filterText=(value,allLabel)=>B.filterText(value,allLabel);
  U.val=id=>document.getElementById(id)?.value||'';
  U.bind=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
  U.direction=n=>!B.valid(n)?'muted':Number(n.toFixed(2))>0?'up':Number(n.toFixed(2))<0?'down':'neutral';
  U.change=(n,percent=false)=>`<span class="${U.direction(n)}">${B.fmt(n,true)}${B.valid(n)&&percent?'%':''}</span>`;
  U.table=(headers,rows,cls='')=>`<div class="table-scroll"><table class="${cls}"><thead><tr>${headers.map(h=>`<th scope="col">${B.esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">此條件下沒有資料。</td></tr>`}</tbody></table></div>`;
  U.seriesTable=(series,metric,team=false)=>U.table(['期間',`${metric.label}${metric.unit?' ('+metric.unit+')':''}`,...(team?['人數']:[]),'Δ'+metric.label,'Δ'+metric.label+'%','比較基準'],series.map(r=>[B.esc(r.label||r.period),B.fmt(r.value),...(team?[r.n]:[]),U.change(r.delta),U.change(r.pct,true),B.esc(r.baseLabel||r.base||'—')]));
  U.empty=(title,description)=>`<div class="panel empty"><h2>${B.esc(title)}</h2><p>${B.esc(description)}</p><div class="actions"><a class="button primary" href="#import">匯入資料</a></div></div>`;
  U.metricPicker=keys=>`<div class="metric-tags">${keys.map(k=>{const m=B.state.data.registry.find(x=>x.key===k);return `<button class="metric-tag" data-remove-metric="${B.esc(k)}" aria-label="移除${B.esc(m.label)}">${B.esc(m.label)} <span aria-hidden="true">×</span></button>`;}).join('')}</div><div class="metric-add">${U.metricSelect('add-metric','增加指標',B.state.data.registry[0]?.key)}<button id="add-metric-button" class="small">加入指標</button></div>`;
  U.metricSelect=(id,label,key)=>{
    const reg=B.state.data.registry,m=reg.find(x=>x.key===key),value=m?.parent||key;
    const options=reg.filter(x=>!x.parent||x.band===1).map(x=>({value:x.parent||x.key,label:x.parent?`${x.parent}（阻抗）`:`${x.label} · ${x.unit}`}));
    return `${U.select(id,label,options,value)}<label id="${id}-band-label" ${m?.parent?'':'class="hide"'}>波段<select id="${id}-band">${U.opt([1,2,3].map(n=>({value:n,label:'波段 '+n})),m?.band||1)}</select></label>`;
  };
  U.readMetric=id=>{const v=U.val(id),reg=B.state.data.registry;return reg.some(x=>x.parent===v)?reg.find(x=>x.parent===v&&x.band===Number(U.val(id+'-band'))).key:v;};
  U.wireMetric=id=>U.bind(id,'change',()=>{document.getElementById(id+'-band-label').classList.toggle('hide',!B.state.data.registry.some(m=>m.parent===U.val(id)));});
  U.wireMetrics=(keys,render)=>{
    U.wireMetric('add-metric');U.bind('add-metric-button','click',()=>{const key=U.readMetric('add-metric');if(!keys.includes(key)){keys.push(key);render();}else U.toast('此指標已在頁面中。');});
    U.main().querySelectorAll('[data-remove-metric]').forEach(el=>el.addEventListener('click',()=>{if(keys.length===1)return U.toast('至少保留一項指標。');keys.splice(keys.indexOf(el.dataset.removeMetric),1);render();}));
  };
  U.stats=items=>`<div class="stats">${items.map(i=>`<div class="stat"><div class="stat-label">${B.esc(i.label)}</div><div class="stat-value">${i.value}<small>${B.esc(i.unit||'')}</small></div><div class="stat-foot">${i.foot||''}</div></div>`).join('')}</div>`;
  U.exportButtons=id=>`<div class="actions"><button class="small" data-export="${id}" data-format="png">PNG</button><button class="small" data-export="${id}" data-format="svg">SVG</button><button class="small" data-export="${id}" data-format="csv">CSV</button></div>`;
  U.expandButton=(id,label)=>`<button class="small" data-expand="${B.esc(id)}">${B.esc(label)}</button>`;
  U.axisTitleControl=(id,dual=false)=>{
    const options=B.Charts.axisOptions(id);
    return `<label class="check" title="只調整標題位置，資料座標與刻度維持原樣"><input type="checkbox" data-axis-title="${id}" ${options.titlesFollowAxes!==false?'checked':''}>軸標題跟著軸</label><details class="axis-visibility" data-axis-panel="${id}" ${options.axisPanelOpen?'open':''}><summary>軸標題與刻度</summary><div class="axis-visibility-options">${[['xTitle','X 軸標題'],['xTicks','X 軸刻度數值'],['yTitle',dual?'左 Y 軸標題':'Y 軸標題'],['yTicks',dual?'左 Y 軸刻度數值':'Y 軸刻度數值'],...(dual?[['y2Title','右 Y 軸標題'],['y2Ticks','右 Y 軸刻度數值']]:[])].map(([key,label])=>`<label class="check"><input type="checkbox" data-axis-option="${id}" data-axis-key="${key}" ${options[key]?'checked':''}>${label}</label>`).join('')}</div></details>`;
  };
  U.timeControls=(id,{unit='month',dual=false,team=false}={})=>{
    const options=B.Charts.timeOptions?.(id)||{seasons:true,seasonBands:true,gridMode:'both',values:true,deltas:true};
    const teamVisuals=team?`<label class="time-grid-control">網格線<select data-time-grid="${id}"><option value="both" ${options.gridMode==='both'?'selected':''}>全部開啟</option><option value="horizontal" ${options.gridMode==='horizontal'?'selected':''}>僅水平（平行 X 軸）</option><option value="vertical" ${options.gridMode==='vertical'?'selected':''}>僅垂直（平行 Y 軸）</option><option value="none" ${options.gridMode==='none'?'selected':''}>全部隱藏</option></select></label><label class="check"><input type="checkbox" data-time-chart="${id}" data-time-option="seasonBands" ${options.seasonBands!==false?'checked':''}>顯示賽季背景</label>`:'';
    return `<div class="local-toolbar time-options">${U.axisTitleControl(id,dual)}${teamVisuals}${[...(unit==='week'?[['weekDates','顯示週次日期區間']]:[]),['seasons','顯示賽季名稱'],['values','顯示數值'],['deltas','顯示改變量 Δ'],['high','歷史最高'],['low','歷史最低'],['mean','歷史平均'],['trend','趨勢線']].map(([key,label])=>`<label class="check"><input type="checkbox" data-time-chart="${id}" data-time-option="${key}" ${options[key]?'checked':''}>${label}</label>`).join('')}</div><details class="reference-help"><summary>參考線與 Δ 的計算範圍</summary><p>${unit==='week'?'週次以週日到週六分組，首尾週依選取日期截斷；週代表值固定平均，W1 由顯示區間第一週起算。':''}歷史最高、最低、平均：同一篩選、時間單位及代表方式，自最早資料至本圖結束日的各期代表值；平均線是這些期間點的平均。趨勢線：對顯示期有效點依實際日期作線性迴歸，至少需 2 點。參考線均為虛線。Δ 維持前一期有效值；跨缺期時另標實際基準。</p></details>`;
  };
  U.metricBlock=(id,title,summary,table='',options={})=>`<section id="block-${id}" class="panel metric-block"><div class="metric-header"><div><h2>${B.esc(title)}</h2><p>${B.esc(summary)}</p></div><div class="actions">${U.exportButtons(id)}${U.expandButton('block-'+id,'全螢幕')}</div></div>${U.timeControls(id,options)}<div class="local-toolbar">${U.expandButton(id+'-figure','放大圖表')}${table?U.expandButton(id+'-table','放大表格'):''}</div><div class="metric-body"><div id="${id}-figure" class="figure-area"><div id="${id}" class="chart"></div></div>${table?`<div id="${id}-table" class="metric-table">${table}</div>`:''}</div></section>`;
  U.resizeCharts=()=>{clearTimeout(U.resizeTimer);U.resizeTimer=setTimeout(()=>document.querySelectorAll('.js-plotly-plot').forEach(el=>{if(el.isConnected&&el.clientWidth)Promise.resolve(Plotly.Plots.resize(el)).then(()=>B.Charts.reflowLabels?.(el)).then(()=>B.Charts.reflowTimeLabels?.(el)).catch(()=>{});}),40);};
  U.closeViewer=()=>{const d=document.getElementById('chart-viewer');if(d?.open){d._restore?.();d.close();}};
  U.expand=id=>{
    U.closeViewer();const target=document.getElementById(id);if(!target)return;
    let dialog=document.getElementById('chart-viewer');if(!dialog){dialog=document.createElement('dialog');dialog.id='chart-viewer';dialog.className='viewer';dialog.innerHTML='<div class="viewer-header"><strong>全螢幕閱讀</strong><button class="small" aria-label="關閉全螢幕">關閉全螢幕 · Esc</button></div><div class="viewer-body"></div>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>U.closeViewer();dialog.addEventListener('close',()=>{if(!dialog.open)dialog._restore?.();});}
    const marker=document.createComment('viewer origin');target.before(marker);dialog.dataset.target=id;target.classList.add('expanded-content');dialog.querySelector('.viewer-body').append(target);
    let restored=false;dialog._restore=()=>{if(restored)return;restored=true;marker.replaceWith(target);target.classList.remove('expanded-content');dialog.dataset.target='';U.resizeCharts();};dialog.showModal();U.resizeCharts();
  };
  U.flushCharts=async(root=U.main())=>{
    const jobs=B.state.chartJobs.splice(0);
    await Promise.allSettled(jobs.map(fn=>fn()));
    root.querySelectorAll('[data-export]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await B.Charts.export(btn.dataset.export,btn.dataset.format);U.toast(btn.dataset.format==='svg'?'SVG 已準備完成，請點選下載 SVG。':'已產生 '+btn.dataset.format.toUpperCase()+' 檔案。');}catch(e){U.toast('匯出失敗：'+e.message);}finally{btn.disabled=false;}});
    root.querySelectorAll('[data-expand]').forEach(btn=>btn.onclick=()=>U.expand(btn.dataset.expand));
    root.querySelectorAll('[data-axis-panel]').forEach(panel=>panel.ontoggle=()=>{const id=panel.dataset.axisPanel;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),axisPanelOpen:panel.open});});
    root.querySelectorAll('[data-axis-title],[data-axis-option]').forEach(input=>input.onchange=async()=>{const id=input.dataset.axisTitle||input.dataset.axisOption,key=input.dataset.axisTitle?'titlesFollowAxes':input.dataset.axisKey;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),[key]:input.checked});const chart=B.state.chartData.get(id);input.disabled=true;try{if(chart?.scatter)await B.Views.refreshComparisonCard(id);else if(chart?.redraw){chart.redraw();await U.flushCharts(root);}}catch(e){U.toast('座標軸更新失敗：'+e.message);}finally{input.disabled=false;}});
    root.querySelectorAll('[data-time-option]').forEach(input=>input.onchange=async()=>{const id=input.dataset.timeChart;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),[input.dataset.timeOption]:input.checked});const chart=B.state.chartData.get(id);if(chart?.redraw){input.disabled=true;try{chart.redraw();await U.flushCharts(root);}catch(e){U.toast('圖表更新失敗：'+e.message);}finally{input.disabled=false;}}});
    root.querySelectorAll('[data-time-grid]').forEach(select=>select.onchange=async()=>{const id=select.dataset.timeGrid;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),gridMode:select.value});const chart=B.state.chartData.get(id);if(chart?.redraw){select.disabled=true;try{chart.redraw();await U.flushCharts(root);}catch(e){U.toast('網格線更新失敗：'+e.message);}finally{select.disabled=false;}}});
    root.querySelectorAll('[data-season-labels]').forEach(input=>input.onchange=()=>{const id=input.dataset.seasonLabels;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),seasons:input.checked});const chart=B.state.chartData.get(id);if(chart)Plotly.relayout(id,{annotations:[...(chart.staticAnnotations||[]),...(input.checked?chart.seasonAnnotations||[]:[])]});});
    document.documentElement.dataset.ready='true';
  };
  U.clear=()=>{U.closeViewer();document.documentElement.dataset.ready='false';U.main().querySelectorAll('.js-plotly-plot').forEach(el=>Plotly.purge(el));B.state.chartJobs=[];B.state.chartData.clear();};
  U.periodSummary=(start,end,method)=>`${start} ～ ${end} · ${B.methodName(method)}`;
  U.guard=fn=>async(...args)=>{try{await fn(...args);}catch(e){U.toast(e.message);console.error(e);}};
  window.addEventListener('resize',U.resizeCharts);
})(BB);
