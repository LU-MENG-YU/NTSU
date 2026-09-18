(function(B){
  'use strict';
  const U=B.UI,V=B.Views,A=B.Analysis;
  let state,sequence=0;
  const metric=k=>B.state.data.registry.find(m=>m.key===k);
  const centers=[{value:'avg',label:'群體平均'},{value:'median',label:'群體中位數'}];
  const modes=[{value:'absolute',label:'絕對值'},{value:'delta',label:'Δ 改變值'}];
  const makeCard=(x,y,delta=false,custom=false)=>({id:'comparison-'+(++sequence),x:{key:x,mode:delta?'delta':'absolute',center:'avg'},y:{key:y,mode:delta?'delta':'absolute',center:'avg'},period:'',names:true,spread:true,previous:false,movement:false,tableOpen:false,basesOpen:false,custom});
  const title=c=>(c.y.mode==='delta'?'Δ':'')+metric(c.y.key).label+' × '+(c.x.mode==='delta'?'Δ':'')+metric(c.x.key).label;
  V.comparison=()=>{
    const e=B.state.engine;if(!e)return V.import();const year=e.years.at(-1),latest=B.state.data.seasons.filter(p=>p.start<=year+'-12-31'&&p.end>=year+'-01-01').at(-1);
    state={year,filter:{level:'',position:''},scope:latest?'season':'month',season:latest?String(B.state.data.seasons.indexOf(latest)):'',start:latest?.start||e.max.slice(0,7)+'-01',end:latest?.end||B.date(e.max.slice(0,7),true,true),method:'avg',history:[],period:'',cards:[makeCard('pbf','ffmi'),makeCard('pbf','ffmi',true),makeCard('pbf','weight',true),makeCard('smm','ffmi',true),makeCard('pbf','ffmi',false,true)]};
    V.renderComparison();
  };
  const dataset=()=>{
    const s=state,e=B.state.engine,allSeasons=B.state.data.seasons;let defs,visible;
    if(s.scope==='season'){
      defs=allSeasons.map((p,i)=>({...p,key:'season-'+i,label:`${p.name}（${p.start}～${p.end}）`}));visible=defs.filter(p=>p.start<=s.year+'-12-31'&&p.end>=s.year+'-01-01');
      const selected=defs[Number(s.season)];if(selected){s.start=selected.start;s.end=selected.end;}if(!s.period)s.period=selected?.key||visible.at(-1)?.key;
    }else if(s.scope==='custom'){
      defs=A.customPeriods(s.start,s.end,s.history);visible=[...defs];s.period=defs.at(-1)?.key;
    }else{
      const unit=s.scope==='day'?'day':s.scope==='year'?'year':'month',start=e.min<s.start?e.min:s.start,end=s.end;
      defs=A.periods(start,end,unit).map(p=>({...p,start:p.end>=s.start&&p.start<s.start?s.start:p.start,end:p.end>end?end:p.end}));visible=defs.filter(p=>p.end>=s.start&&p.start<=s.end);
      if(!visible.some(p=>p.key===s.period)){const last=e.data.rows.filter(r=>!r.disabled&&r.date>=s.start&&r.date<=s.end).at(-1)?.date;s.period=visible.find(p=>last>=p.start&&last<=p.end)?.key||visible.at(-1)?.key;}
    }
    if(!defs.length||!visible.length)return null;
    const start=defs.reduce((a,p)=>p.start<a?p.start:a,defs[0].start),end=defs.reduce((a,p)=>p.end>a?p.end:a,defs[0].end);
    if(!visible.some(p=>p.key===s.period))s.period=visible.at(-1).key;
    return {ds:e.aggregate({filter:s.filter,method:s.method,start,end,periods:defs}),visible,active:defs.find(p=>p.key===s.period)};
  };
  const resetPeriods=()=>{state.period='';state.cards.forEach(c=>c.period='');};
  V.renderComparison=()=>{
    U.clear();const s=state,e=B.state.engine,data=B.state.data,pack=dataset();if(!pack){U.main().innerHTML=U.empty('沒有可比較的期間','請檢查賽季與測量日期。');return;}
    const {ds,active}=pack,summary=`${active.label} · ${s.filter.level||'不分級'} · ${s.filter.position||'全部位置'} · ${B.methodName(s.method)}`;
    const summaries=['weight','ffmi','pbf','smm'].map(k=>{const m=metric(k),r=e.team(ds,k).find(r=>r.period===s.period);return {label:m.label,value:B.fmt(r?.value),unit:m.unit,foot:`Δ${B.esc(m.label)} ${U.change(r?.delta)} · ${U.change(r?.pct,true)}<br>基準：${B.esc(r?.baseLabel||'—')} · ${r?.n||0} 人`};});
    U.main().innerHTML=U.heading('COMPARISON / QUADRANTS','個人分析／球員比較','每組包含一張圖與專屬核對表；當期、中心與顯示選項可在各組獨立調整。')+`
      <section class="panel control-panel"><h2 class="control-title">共同分析範圍</h2><div class="toolbar">${U.filter(s.filter,s.year)}${U.select('scope','比較單位',[{value:'season',label:'整個賽季'},{value:'month',label:'月'},{value:'day',label:'日'},{value:'year',label:'年'},{value:'custom',label:'自訂整段區間'}].filter(o=>o.value!=='season'||data.seasons.length),s.scope)}${U.method(s.method)}</div>
      <div class="toolbar secondary">${U.select('season','賽季範圍',[{value:'',label:'自訂範圍'},...data.seasons.map((p,i)=>({value:String(i),label:`${p.name} · ${p.start}～${p.end}`})).filter(p=>{const season=data.seasons[Number(p.value)];return season.start<=s.year+'-12-31'&&season.end>=s.year+'-01-01';})],s.season)}<label>開始（年月／日期）<input id="compare-start" value="${s.start}" ${s.scope==='season'?'disabled':''}></label><label>結束（年月／日期）<input id="compare-end" value="${s.end}" ${s.scope==='season'?'disabled':''}></label><button id="compare-range" class="small" ${s.scope==='season'?'disabled':''}>套用範圍</button></div>
      ${s.scope==='custom'?`<div class="toolbar secondary"><label style="flex:3">較早比較區間（每行「開始,結束」）<textarea id="comparison-history" rows="2">${B.esc(s.history.map(p=>p.start+','+p.end).join('\n'))}</textarea></label><button id="history-apply" class="small">套用較早區間</button></div>`:''}
      <p class="conditions">${s.scope==='season'?'賽季依開始日期排序，重疊賽季分別彙總。':s.scope==='custom'?'整段自訂期間不推定等長前一期，僅使用明確輸入的較早區間。':'日／月／年基準可早於顯示範圍。'} Δ 仍逐指標尋找前一期有效值。</p></section>
      <p class="conditions">群體摘要期間：${B.esc(summary)}。各圖若改選當期，請以該圖標題與核對表為準。</p>${U.stats(summaries)}
      <div class="comparison-stack" id="comparison-cards">${s.cards.map(c=>`<section id="card-${c.id}" class="panel metric-block comparison-card"></section>`).join('')}</div>
      <section class="panel control-panel" id="add-comparison"><h2 class="control-title">＋ 新增自訂散佈圖與核對表</h2><div class="toolbar">${U.metricSelect('new-x','X 指標','pbf')}${U.select('new-x-mode','X 模式',modes,'absolute')}${U.metricSelect('new-y','Y 指標','ffmi')}${U.select('new-y-mode','Y 模式',modes,'absolute')}<button id="add-scatter" class="primary">新增一組圖表</button></div></section>`;
    s.cards.forEach(c=>V.paintComparisonCard(c,pack));
    for(const id of ['level','position','method'])U.bind(id,'change',()=>{s.filter={level:U.val('level'),position:U.val('position')};s.method=U.val('method');V.renderComparison();});
    U.bind('year','change',()=>{s.year=U.val('year');s.history=[];const seasons=data.seasons.map((p,i)=>({...p,i})).filter(p=>p.start<=s.year+'-12-31'&&p.end>=s.year+'-01-01'),season=seasons.at(-1);s.season=season?String(season.i):'';s.start=season?.start||s.year+'-01-01';s.end=season?.end||s.year+'-12-31';if(!season&&s.scope==='season')s.scope='month';resetPeriods();V.renderComparison();});
    U.bind('scope','change',()=>{s.scope=U.val('scope');if(s.scope==='season'&&!s.season)s.season=String(data.seasons.length-1);resetPeriods();V.renderComparison();});
    U.bind('season','change',()=>{s.season=U.val('season');s.history=[];const p=data.seasons[Number(s.season)];if(s.season!==''&&p){s.start=p.start;s.end=p.end;}else if(s.scope==='season')s.scope='month';resetPeriods();V.renderComparison();});
    U.bind('compare-range','click',()=>{try{const r=B.range(U.val('compare-start'),U.val('compare-end'));if(s.scope==='custom')A.customPeriods(r.start,r.end,s.history);s.start=r.start;s.end=r.end;s.season='';resetPeriods();V.renderComparison();}catch(e){U.toast(e.message);}});
    U.bind('history-apply','click',()=>{try{const history=U.val('comparison-history').split(/\n/).filter(x=>x.trim()).map(line=>{const pair=line.split(/[,，]/).map(x=>x.trim());if(pair.length!==2)throw Error('每行請以逗號分隔開始與結束。');return B.range(pair[0],pair[1]);});A.customPeriods(s.start,s.end,history);s.history=history;resetPeriods();V.renderComparison();}catch(e){U.toast(e.message);}});
    U.wireMetric('new-x');U.wireMetric('new-y');
    U.bind('add-scatter','click',()=>{const card=makeCard(U.readMetric('new-x'),U.readMetric('new-y'),false,true);card.x.mode=U.val('new-x-mode');card.y.mode=U.val('new-y-mode');s.cards.push(card);const node=document.createElement('section');node.id='card-'+card.id;node.className='panel metric-block comparison-card';document.getElementById('comparison-cards').append(node);V.paintComparisonCard(card,dataset());U.flushCharts(node);node.scrollIntoView({behavior:'smooth',block:'start'});});
    U.flushCharts();
  };
  V.paintComparisonCard=(card,pack)=>{
    const c=card,s=state,{ds,visible}=pack,id=c.id,root=document.getElementById('card-'+id),e=B.state.engine;
    if(!visible.some(p=>p.key===c.period))c.period=s.period;
    const active=ds.periods.find(p=>p.key===c.period),summary=`${active.label} · ${s.filter.level||'不分級'} · ${s.filter.position||'全部位置'} · ${B.methodName(s.method)}`,result=e.scatter(ds,c.x,c.y,c.period);
    const prior=ds.periods[ds.periods.findIndex(p=>p.key===c.period)-1],audits=V.baselineAudit(ds,c,prior),warningCount=audits.filter(a=>a.warning).length;
    const repeated=new Map();for(const p of result.points){const k=p.x+'|'+p.y;if(!repeated.has(k))repeated.set(k,[]);repeated.get(k).push(p.player.name);}const overlaps=[...repeated.values()].filter(a=>a.length>1);
    root.innerHTML=`<div class="metric-header"><div><span class="eyebrow">${c.custom?'自訂':'預設'} · 圖與核對表</span><h2>${B.esc(title(c))}</h2><p>${B.esc(summary)}</p></div><div class="actions">${U.exportButtons(id)}${U.expandButton('card-'+id,'全螢幕')}${c.custom?'<button class="small danger" data-remove-card>移除這組</button>':''}</div></div>
      <div class="card-controls"><div class="toolbar">${U.select(id+'-period','當期',visible.map(p=>({value:p.key,label:p.label})),c.period)}${U.select(id+'-x-center','X 絕對值中心',centers,c.x.center,c.x.mode==='delta'?'disabled':'')}${U.select(id+'-y-center','Y 絕對值中心',centers,c.y.center,c.y.mode==='delta'?'disabled':'')}</div>
      ${c.custom?`<details class="axis-settings"><summary>調整此圖的 X／Y 指標</summary><div class="toolbar">${U.metricSelect(id+'-x','X 指標',c.x.key)}${U.select(id+'-x-mode','X 模式',modes,c.x.mode)}${U.metricSelect(id+'-y','Y 指標',c.y.key)}${U.select(id+'-y-mode','Y 模式',modes,c.y.mode)}<button id="${id}-axes" class="small primary">更新此圖與表格</button></div></details>`:''}
      <div class="local-toolbar">${[['names','顯示姓名'],['spread','分散姓名標籤'],['previous','顯示前一期'],['movement','顯示移動軌跡']].map(([key,label])=>`<label class="check"><input id="${id}-${key}" type="checkbox" ${c[key]?'checked':''}>${label}</label>`).join('')}${U.expandButton(id+'-figure','放大圖表')}</div></div>
      <div id="${id}-figure" class="figure-area"><div id="${id}" class="chart"></div></div>
      <div class="scatter-note"><span>${result.points.length} 名球員 · X 中心 ${B.fmt(result.centerX)} · Y 中心 ${B.fmt(result.centerY)}</span><p class="small muted">姓名以引線分散，資料點座標與計算維持原值。完全重疊時可點選資料點選擇球員。</p>${overlaps.length?`<details><summary>完全重疊位置（${overlaps.length} 組）</summary>${overlaps.map(names=>`<div class="overlap-list">${names.map(n=>`<button class="small" data-player-menu="${B.esc(n)}">${B.esc(n)}</button>`).join('')}</div>`).join('')}</details>`:''}${result.omitted.length?`<p class="small">未繪製（X／Y 或 Δ 資料不足）：${B.esc(result.omitted.join('、'))}</p>`:''}</div>
      <details id="${id}-baselines" class="baseline-review ${warningCount?'needs-review':'normal-review'}" ${c.basesOpen?'open':''}><summary>${warningCount?'需核對 '+warningCount+' 人':'基準一致'} · 查看實際比較基準</summary><p class="small muted">預期基準為相鄰前一期：${B.esc(prior?.label||'無（第一期）')}。黄色表示跨期或資料不足，並不代表數值錯誤；仍依規格採前一期有效值。</p>${V.auditTable(audits,c)}</details>
      <details id="${id}-details" class="paired-table" ${c.tableOpen?'open':''}><summary>${B.esc(title(c))} · 逐期核對表（${ds.players.length} 人）</summary><div class="table-actions"><p class="small muted">每位球員的每項指標分為代表值、Δ、Δ% 三列；橫向為時間。標號對照表下方實際基準。</p>${U.expandButton(id+'-table','放大表格')}</div><div id="${id}-table" class="comparison-table">${c.tableOpen?V.comparisonTable(ds,visible,c):''}</div></details>`;
    B.Charts.scatter(id,result,c.x,c.y,{title:title(c),summary,names:c.names,spread:c.spread,previous:c.previous,movement:c.movement,onClick:V.playerMenu});
    const refresh=()=>V.refreshComparisonCard(id);
    U.bind(id+'-period','change',()=>{c.period=U.val(id+'-period');refresh();});
    for(const axis of ['x','y'])U.bind(id+'-'+axis+'-center','change',()=>{c[axis].center=U.val(id+'-'+axis+'-center');refresh();});
    for(const key of ['names','spread','previous','movement'])U.bind(id+'-'+key,'change',()=>{c[key]=document.getElementById(id+'-'+key).checked;refresh();});
    U.bind(id+'-baselines','toggle',()=>{c.basesOpen=document.getElementById(id+'-baselines').open;});
    U.bind(id+'-details','toggle',()=>{const d=document.getElementById(id+'-details');c.tableOpen=d.open;const table=document.getElementById(id+'-table');if(d.open&&!table.childElementCount){table.innerHTML=V.comparisonTable(ds,visible,c);V.wirePlayerLinks(table);}U.resizeCharts();});
    if(c.custom){U.wireMetric(id+'-x');U.wireMetric(id+'-y');U.bind(id+'-axes','click',()=>{for(const axis of ['x','y']){c[axis].key=U.readMetric(id+'-'+axis);c[axis].mode=U.val(id+'-'+axis+'-mode');}refresh();});root.querySelector('[data-remove-card]').onclick=()=>{U.closeViewer();Plotly.purge(document.getElementById(id));B.state.chartData.delete(id);s.cards=s.cards.filter(x=>x.id!==id);root.remove();};}
    V.wirePlayerLinks(root);
  };
  V.refreshComparisonCard=id=>{
    const c=state.cards.find(c=>c.id===id);if(!c)return;
    const viewer=document.getElementById('chart-viewer'),expanded=viewer?.open?viewer.dataset.target:null;
    if(expanded&&expanded!=='card-'+id&&expanded.startsWith(id))U.closeViewer();
    const root=document.getElementById('card-'+id),plot=document.getElementById(id),focus=document.activeElement?.id;
    if(plot)Plotly.purge(plot);B.state.chartData.delete(id);V.paintComparisonCard(c,dataset());
    return U.flushCharts(root).then(()=>{if(expanded&&expanded!=='card-'+id&&expanded.startsWith(id))U.expand(expanded);document.getElementById(focus)?.focus({preventScroll:true});});
  };
  V.baselineAudit=(ds,c,prior)=>B.sortPlayers(ds.players).map(player=>{
    const x=B.state.engine.personal(ds,player.name,c.x.key).find(r=>r.period===c.period),y=B.state.engine.personal(ds,player.name,c.y.key).find(r=>r.period===c.period);
    const missing=!B.valid(c.x.mode==='delta'?x.delta:x.value)||!B.valid(c.y.mode==='delta'?y.delta:y.value),cross=!!prior&&(x.base!==prior.key||y.base!==prior.key);
    return {player,x,y,expected:prior?.label||'—',warning:missing||cross,note:missing?'資料不足':cross?'基準跨期／缺失':'一致'};
  });
  V.auditTable=(audits,c)=>`<div class="table-scroll"><table><thead><tr><th>球員</th><th>預期基準</th><th>${B.esc(metric(c.x.key).label)}實際基準</th><th>${B.esc(metric(c.y.key).label)}實際基準</th><th>核對狀態</th></tr></thead><tbody>${audits.map(a=>`<tr class="${a.warning?'review-row':''}"><td><button class="small" data-player-menu="${B.esc(a.player.name)}">${B.esc(a.player.name)}</button></td><td>${B.esc(a.expected)}</td><td>${B.esc(a.x.baseLabel||'—')}</td><td>${B.esc(a.y.baseLabel||'—')}</td><td>${a.note}</td></tr>`).join('')}</tbody></table></div>`;
  V.comparisonTable=(ds,visible,c)=>{
    const keys=[...new Set([c.x.key,c.y.key])],e=B.state.engine,footnotes=new Map();
    const baseIndex=r=>{if(!r?.base)return '';const text=(r.label||r.period)+' → '+(r.baseLabel||r.base);if(!footnotes.has(text))footnotes.set(text,footnotes.size+1);return '<sup>['+footnotes.get(text)+']</sup>';};
    let body='';for(const player of B.sortPlayers(ds.players)){
      keys.forEach((k,mi)=>{const m=metric(k),series=e.personal(ds,player.name,k),byPeriod=new Map(series.map(r=>[r.period,r]));
        [['value',m.label+' ('+m.unit+')'],['delta','Δ'+m.label],['pct','Δ'+m.label+'%']].forEach(([kind,label],ri)=>{
          body+=`<tr>${mi===0&&ri===0?`<th rowspan="${keys.length*3}" scope="rowgroup" class="player-cell"><button class="small" data-player-menu="${B.esc(player.name)}">${B.esc(player.name)}</button></th>`:''}<th scope="row" class="statistic-cell">${B.esc(label)}</th>${visible.map(period=>{const r=byPeriod.get(period.key);return `<td class="${period.key===c.period?'current-cell':''}">${kind==='value'?B.fmt(r?.value):U.change(r?.[kind],kind==='pct')+(B.valid(r?.[kind])?baseIndex(r):'')}</td>`;}).join('')}</tr>`;
        });
      });
    }
    return `<div class="table-scroll"><table class="comparison-matrix"><thead><tr><th>球員</th><th>指標／統計</th>${visible.map(p=>`<th class="${p.key===c.period?'current-cell':''}">${B.esc(p.label)}</th>`).join('')}</tr></thead><tbody>${body||'<tr><td>此條件無球員</td></tr>'}</tbody></table></div><div class="matrix-footnotes">${[...footnotes].map(([text,n])=>`<span>[${n}] ${B.esc(text)}</span>`).join('')||'此範圍沒有可計算的前一期變化。'}</div>`;
  };
  V.wirePlayerLinks=root=>root.querySelectorAll('[data-player-menu]').forEach(b=>b.onclick=()=>V.playerMenu(b.dataset.playerMenu));
  V.playerMenu=input=>{
    const names=Array.isArray(input)?input:[input],d=document.getElementById('player-menu');
    if(names.length>1){d.innerHTML=`<button class="close" aria-label="關閉">×</button><h2 id="menu-title">此位置有 ${names.length} 名球員</h2><p class="muted small">数值完全重疊，請選擇球員。</p><div class="overlap-list">${names.map(n=>`<button data-choose-player="${B.esc(n)}">${B.esc(n)}</button>`).join('')}</div>`;d.querySelector('.close').onclick=()=>d.close();d.querySelectorAll('[data-choose-player]').forEach(b=>b.onclick=()=>V.playerMenu(b.dataset.choosePlayer));if(!d.open)d.showModal();return;}
    const name=names[0],p=B.state.data.players.find(p=>p.name===name);if(!p)return;
    d.innerHTML=`<button class="close" aria-label="關閉">×</button><h2 id="menu-title">${B.esc(name)}</h2><p class="muted small">${B.esc(p.level)} · ${B.esc(p.position)} · ${B.esc(p.number)}</p><p style="margin-top:18px">標記顏色</p><div class="swatches">${[['紅','#c2323b'],['藍','#176da2'],['綠','#177342'],['黑','#182c3c']].map(([name,color])=>`<button class="swatch" data-color="${color}" style="background:${color}" aria-label="標記${name}色"></button>`).join('')}</div><button id="clear-mark" class="small">清除標記</button><a href="#player/${encodeURIComponent(name)}" class="button primary menu-link">查看個人檔案</a>`;
    d.querySelector('.close').onclick=()=>d.close();d.querySelector('a').onclick=()=>{d.close();U.closeViewer();};
    const refresh=()=>{d.close();state.cards.forEach(c=>V.refreshComparisonCard(c.id));};
    d.querySelectorAll('[data-color]').forEach(btn=>btn.onclick=()=>{B.state.marks.set(name,btn.dataset.color);refresh();});d.querySelector('#clear-mark').onclick=()=>{B.state.marks.delete(name);refresh();};if(!d.open)d.showModal();
  };
})(BB);
