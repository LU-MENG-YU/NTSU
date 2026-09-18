(function(B){
  'use strict';
  const U=B.UI={};
  U.e=B.esc;U.main=()=>document.getElementById('main');
  U.toast=msg=>{const el=document.getElementById('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(U.toastTimer);U.toastTimer=setTimeout(()=>el.classList.remove('visible'),5000);};
  U.heading=(tag,title,description='',actions='')=>`<div class="heading"><div><div class="eyebrow">${B.esc(tag)}</div><h1>${B.esc(title)}</h1>${description?`<p>${B.esc(description)}</p>`:''}</div><div class="actions">${actions}</div></div>`;
  U.opt=(values,selected)=>values.map(v=>{const k=typeof v==='object'?v.value:v,l=typeof v==='object'?v.label:v;return `<option value="${B.esc(k)}" ${String(k)===String(selected)?'selected':''}>${B.esc(l)}</option>`;}).join('');
  U.select=(id,label,values,selected,extra='')=>`<label>${B.esc(label)}<select id="${id}" ${extra}>${U.opt(values,selected)}</select></label>`;
  U.method=m=>U.select('method','期間代表方式',[{value:'avg',label:'Average 平均'},{value:'max',label:'Maximum 最大'},{value:'min',label:'Minimum 最小'}],m);
  U.filter=(filter,year)=>`${U.select('year','年份',B.state.engine.years,year)}${U.select('level','分級',[{value:'',label:'不分級'},...B.levels(B.state.data.players)],filter.level)}${U.select('position','位置',[{value:'',label:'全部位置'},...B.positions(B.state.data.players)],filter.position)}`;
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
  U.metricBlock=(id,title,summary,table='')=>`<section id="block-${id}" class="panel metric-block"><div class="metric-header"><div><h2>${B.esc(title)}</h2><p>${B.esc(summary)}</p></div><div class="actions">${U.exportButtons(id)}${U.expandButton('block-'+id,'全螢幕')}</div></div><div class="local-toolbar"><label class="check"><input type="checkbox" data-season-labels="${id}" ${B.Charts.preferences.get(id)?.seasons===false?'':'checked'}>顯示賽季名稱</label>${U.expandButton(id+'-figure','放大圖表')}${table?U.expandButton(id+'-table','放大表格'):''}</div><div class="metric-body"><div id="${id}-figure" class="figure-area"><div id="${id}" class="chart"></div></div>${table?`<div id="${id}-table" class="metric-table">${table}</div>`:''}</div></section>`;
  U.resizeCharts=()=>{clearTimeout(U.resizeTimer);U.resizeTimer=setTimeout(()=>document.querySelectorAll('.js-plotly-plot').forEach(el=>{if(el.isConnected&&el.clientWidth)Promise.resolve(Plotly.Plots.resize(el)).then(()=>B.Charts.reflowLabels?.(el)).catch(()=>{});}),40);};
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
    root.querySelectorAll('[data-season-labels]').forEach(input=>input.onchange=()=>{const id=input.dataset.seasonLabels;B.Charts.preferences.set(id,{...B.Charts.preferences.get(id),seasons:input.checked});const chart=B.state.chartData.get(id);if(chart)Plotly.relayout(id,{annotations:[...(chart.staticAnnotations||[]),...(input.checked?chart.seasonAnnotations||[]:[])]});});
    document.documentElement.dataset.ready='true';
  };
  U.clear=()=>{U.closeViewer();document.documentElement.dataset.ready='false';U.main().querySelectorAll('.js-plotly-plot').forEach(el=>Plotly.purge(el));B.state.chartJobs=[];B.state.chartData.clear();};
  U.periodSummary=(start,end,method)=>`${start} ～ ${end} · ${B.methodName(method)}`;
  U.guard=fn=>async(...args)=>{try{await fn(...args);}catch(e){U.toast(e.message);console.error(e);}};
  window.addEventListener('resize',U.resizeCharts);
})(BB);
