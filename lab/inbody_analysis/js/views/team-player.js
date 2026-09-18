(function(B){
  'use strict';
  const U=B.UI,V=B.Views,A=B.Analysis;
  let teamState,playerState;
  const registry=k=>B.state.data.registry.find(m=>m.key===k);
  const core=()=>B.coreMetrics.map(m=>m.key);
  V.team=()=>{const e=B.state.engine;if(!e)return V.import();teamState={year:e.years.at(-1),filter:{level:'',position:''},method:'avg',metrics:core(),mode:'recent',months:[],years:[...e.years]};V.renderTeam();};
  V.rosterCounts=()=>{
    const ps=B.state.data.players,levels=B.levels(ps);
    const rows=B.positions(ps).map(position=>[B.esc(position),...levels.map(level=>ps.filter(p=>p.position===position&&p.level===level).length),ps.filter(p=>p.position===position).length]);
    rows.push(['總計',...levels.map(l=>ps.filter(p=>p.level===l).length),ps.length]);
    return `<details class="panel"><summary>目前球員名單人數統計（收合／展開）</summary><p class="muted small">此表反映完整目前名單，歷史年份篩選不會重建當時陣容。</p>${U.table(['位置',...levels,'總計'],rows)}</details>`;
  };
  V.renderTeam=()=>{
    U.clear();const t=teamState,e=B.state.engine,data=B.state.data;
    const selectedYearRows=e.byYear.get(t.year)||[],last=selectedYearRows.at(-1)?.date||`${t.year}-12-31`;
    const end=t.mode==='year'?`${t.year}-12-31`:B.date(last.slice(0,7),true,true);
    const dt=new Date(end+'T00:00:00Z');const start=t.mode==='year'?`${t.year}-01-01`:B.iso(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()-11,1));
    const ds=e.aggregate({filter:t.filter,method:t.method,start:e.min<start?e.min:start,end:end>e.max?end:e.max});
    const allMonths=ds.periods.map(p=>p.key);
    const groupLabel=`${t.year} ${t.filter.level||'不分級'} · ${t.filter.position||'全部位置'}`;
    const summary=U.periodSummary(start,end,t.method)+' · 球員等權';
    U.main().innerHTML=U.heading('TEAM / TRENDS','團隊分析','每位球員先取得期間代表值，再計算群體平均。')+`<div class="analysis-nav"><a href="#" data-jump="team-controls">01 月份趨勢</a><a href="#" data-jump="month-controls">02 自選月份／同期比較</a><a href="#" data-jump="annual-controls">03 年度比較</a></div>`+V.rosterCounts()+`
      <section id="team-controls" class="panel control-panel"><h2 class="control-title">01 月份趨勢 · 分析設定</h2><div class="toolbar">${U.filter(t.filter,t.year)}${U.method(t.method)}${U.select('team-mode','顯示期間',[{value:'recent',label:'最近 12 個月'},{value:'year',label:'本年度 1–12 月'}],t.mode)}</div><div class="toolbar secondary" style="display:block">${U.metricPicker(t.metrics)}</div></section><p class="conditions">${B.esc(groupLabel+' · '+summary)} · 目前符合名單 ${e.players(t.filter).length} 人</p>
      <div id="team-charts">${t.metrics.map((k,i)=>{const m=registry(k),series=e.team(ds,k).filter(r=>r.period>=start.slice(0,7)&&r.period<=end.slice(0,7));return U.metricBlock('team-'+i,`${groupLabel}－${m.label}變化`,summary,U.seriesTable(series,m,true));}).join('')}</div>
      <section id="month-controls" class="panel control-panel"><div class="panel-title"><div><h2>02 自選月份／同期比較 · 分析設定</h2><p>可跨年選取任意多個月份，依時間排序；Δ 比較相鄰選定有效月份。</p></div></div><details><summary>選擇比較月份（${t.months.length}）</summary><div class="actions"><button id="months-clear" class="small">清空選擇</button></div><div class="bulk-selection">${allMonths.map(m=>`<label><input type="checkbox" data-month="${m}" ${t.months.includes(m)?'checked':''}>${m}</label>`).join('')}</div><button id="months-apply" class="primary small">套用月份比較</button></details></section><div id="month-results"></div>
      <section id="annual-controls" class="panel control-panel"><div class="panel-title"><div><h2>03 年度比較 · 分析設定</h2><p>年度代表值直接使用該球員當年所有測量，之後再計算群體平均。</p></div></div><div class="bulk-selection">${e.years.map(y=>`<label><input type="checkbox" data-compare-year="${y}" ${t.years.includes(y)?'checked':''}>${y}</label>`).join('')}</div><button id="years-apply" class="small">套用年度比較</button></section><div id="year-results"></div>`;
    for(const id of ['year','level','position','method','team-mode'])U.bind(id,'change',()=>{t.year=U.val('year');t.filter={level:U.val('level'),position:U.val('position')};t.method=U.val('method');t.mode=U.val('team-mode');V.renderTeam();});
    U.wireMetrics(t.metrics,V.renderTeam);
    t.metrics.forEach((k,i)=>{const m=registry(k),series=e.team(ds,k).filter(r=>r.period>=start.slice(0,7)&&r.period<=end.slice(0,7));B.Charts.timeline('team-'+i,series,m,{title:`${groupLabel}－${m.label}變化`,summary,team:true});});
    U.bind('months-apply','click',()=>{t.months=[...U.main().querySelectorAll('[data-month]:checked')].map(x=>x.dataset.month);V.renderTeam();});
    U.bind('months-clear','click',()=>{U.main().querySelectorAll('[data-month]').forEach(x=>x.checked=false);});
    U.bind('years-apply','click',()=>{t.years=[...U.main().querySelectorAll('[data-compare-year]:checked')].map(x=>x.dataset.compareYear);V.renderTeam();});
    if(t.months.length){const wrapper=document.getElementById('month-results');wrapper.innerHTML=t.metrics.map((k,i)=>{const m=registry(k),series=A.changes(e.team(ds,k).filter(r=>t.months.includes(r.period)));return U.metricBlock('months-'+i,`${groupLabel}－${m.label} ${t.months.map(x=>x.slice(0,4)+' 年 '+Number(x.slice(5))+' 月').join('、')}比較`,`${t.months.join('、')} · ${B.methodName(t.method)}`,U.seriesTable(series,m,true));}).join('');t.metrics.forEach((k,i)=>{const series=A.changes(e.team(ds,k).filter(r=>t.months.includes(r.period)));B.Charts.timeline('months-'+i,series,registry(k),{title:`${groupLabel}－${registry(k).label} ${t.months.map(x=>x.slice(0,4)+' 年 '+Number(x.slice(5))+' 月').join('、')}比較`,summary:`${t.months.join('、')} · ${B.methodName(t.method)}`,team:true});});}
    if(t.years.length){const annual=e.aggregate({filter:t.filter,method:t.method,unit:'year'});const wrapper=document.getElementById('year-results');wrapper.innerHTML=t.metrics.map((k,i)=>{const series=A.changes(e.team(annual,k).filter(r=>t.years.includes(r.period)));return U.metricBlock('annual-'+i,`${t.filter.level||'不分級'} · ${t.filter.position||'全部位置'}－${registry(k).label}年度比較`,`${t.years.join('、')} · ${B.methodName(t.method)}`,U.seriesTable(series,registry(k),true));}).join('');t.metrics.forEach((k,i)=>B.Charts.timeline('annual-'+i,A.changes(e.team(annual,k).filter(r=>t.years.includes(r.period))),registry(k),{title:`${t.filter.level||'不分級'} · ${t.filter.position||'全部位置'}－${registry(k).label}年度比較`,summary:`${t.years.join('、')} · ${B.methodName(t.method)}`,team:true,unit:'year'}));}
    U.main().querySelectorAll('[data-jump]').forEach(a=>a.onclick=event=>{event.preventDefault();document.getElementById(a.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'});});
    U.flushCharts();
  };
  V.player=name=>{
    const e=B.state.engine;if(!e)return V.import();const p=B.state.data.players.find(p=>p.name===name);
    if(!p){U.clear();U.main().innerHTML=U.empty('找不到這名球員','球員可能已不在新版基本資料名單中。');return;}
    const latest=e.byName.get(name).at(-1)?.date;
    const end=latest?B.date(latest.slice(0,7),true,true):e.max,dt=new Date(end+'T00:00:00Z');
    playerState={player:p,mode:'recent',unit:'month',method:'avg',metrics:core(),start:B.iso(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()-11,1)),end,latest,openPeriods:new Set()};V.renderPlayer();
  };
  V.playerSeriesTable=(series,m,index)=>{
    const s=playerState,rows=B.state.engine.byName.get(s.player.name)||[];
    const columns=['期間／檢測明細',m.label+' ('+m.unit+')','Δ'+m.label,'Δ'+m.label+'%','比較基準','使用／全部'];
    return `<div class="table-scroll"><table class="period-table"><thead><tr>${columns.map(h=>'<th>'+B.esc(h)+'</th>').join('')}</tr></thead><tbody>${series.map((r,j)=>{
      const records=rows.filter(x=>x.date>=r.start&&x.date<=r.end),key=m.key+'|'+r.start+'|'+r.end,id='measure-'+index+'-'+j,open=s.openPeriods.has(key);
      return `<tr><td><button class="small period-toggle" data-period-toggle="${id}" data-open-key="${B.esc(key)}" aria-expanded="${open}">${open?'▾':'▸'} ${B.esc(r.label||r.period)} · ${records.length} 筆</button></td><td>${B.fmt(r.value)}</td><td>${U.change(r.delta)}</td><td>${U.change(r.pct,true)}</td><td>${B.esc(r.baseLabel||r.base||'—')}</td><td>${records.filter(x=>!x.disabled).length} / ${records.length}</td></tr><tr id="${id}" class="measurement-detail" ${open?'':'hidden'}><td colspan="6">${V.measurementRows(records,m)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };
  V.measurementRows=(records,m)=>{
    const s=playerState,summary=A.measurementSummary(records,m.key),metrics=[...new Set([...core(),m.key])].map(registry);
    return `<div class="measurement-box"><p class="small">${B.esc(m.label)}：${summary.valid} 筆有效數值 · 最小 ${B.fmt(summary.min)} · 最大 ${B.fmt(summary.max)}。${s.method==='avg'?'所有使用中且有值的測量納入平均。':'「採用」標記為本期 '+B.methodName(s.method)+' 的來源；同值並列。'}</p><p class="small muted">停用會排除整筆測量的所有指標，並同步更新團隊、比較與個人分析。紅色列仍可恢復。</p><div class="table-scroll"><table class="raw-measurements"><thead><tr><th>測量日期／時間</th>${metrics.map(x=>'<th>'+B.esc(x.label)+' ('+B.esc(x.unit)+')</th>').join('')}<th>${B.esc(m.label)}取值標記</th><th>來源</th><th>操作</th></tr></thead><tbody>${records.length?records.map(r=>{
      const v=r.values[m.key],isMin=!r.disabled&&B.valid(v)&&v===summary.min,isMax=!r.disabled&&B.valid(v)&&v===summary.max,used=!r.disabled&&B.valid(v)&&(s.method==='avg'||(s.method==='min'&&isMin)||(s.method==='max'&&isMax));
      return `<tr class="${r.disabled?'measurement-disabled':''}" data-measurement-row="${B.esc(r.uid)}"><td>${r.date}<br><span class="small">${B.esc(B.measurementTime(r))}</span></td>${metrics.map(x=>'<td>'+B.fmt(r.values[x.key])+'</td>').join('')}<td>${r.disabled?'<span class="badge disabled-badge">已停用整筆</span>':`${isMin?'<span class="value-tag">最小</span>':''}${isMax?'<span class="value-tag">最大</span>':''}${used?'<span class="value-tag selected">'+(s.method==='avg'?'納入平均':'採用')+'</span>':''}`}</td><td class="source-cell">${B.esc(r.source.file)} / ${B.esc(r.source.sheet)}<br>第 ${r.source.row} 列</td><td><button class="small ${r.disabled?'':'danger'}" data-toggle-measurement="${B.esc(r.uid)}" data-disabled="${r.disabled?'false':'true'}">${r.disabled?'恢復整筆':'停用整筆'}</button></td></tr>`;
    }).join(''):'<tr><td colspan="'+(metrics.length+4)+'">此期間沒有測量。</td></tr>'}</tbody></table></div></div>`;
  };
  let measurementBusy=false;
  V.wireMeasurements=()=>{
    U.main().querySelectorAll('[data-period-toggle]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.openKey,row=document.getElementById(btn.dataset.periodToggle),open=row.hidden;row.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=(open?'▾':'▸')+btn.textContent.slice(1);if(open)playerState.openPeriods.add(key);else playerState.openPeriods.delete(key);});
    U.main().querySelectorAll('[data-toggle-measurement]').forEach(btn=>btn.onclick=async()=>{
      if(measurementBusy)return;measurementBusy=true;btn.disabled=true;
      const uid=btn.dataset.toggleMeasurement,disabled=btn.dataset.disabled==='true',scrollY=window.scrollY,viewer=document.getElementById('chart-viewer'),expanded=viewer?.open?viewer.dataset.target:null;
      const finish=async()=>{await V.renderPlayer();if(expanded)U.expand(expanded);else window.scrollTo({top:scrollY,behavior:'instant'});U.toast(disabled?'已停用整筆測量，所有分析已更新。':'已恢復整筆測量，所有分析已更新。');};
      try{await B.setMeasurementDisabled(uid,disabled);await finish();}
      catch(e){btn.disabled=false;U.toast('尚未變更：本機保存失敗。可選擇僅本次頁面使用。');const box=document.createElement('div');box.className='notice error';box.textContent='無法保存：'+e.message+' ';const retry=document.createElement('button');retry.className='small';retry.textContent='僅本次頁面'+(disabled?'停用':'恢復');box.append(retry);btn.parentElement.append(box);retry.onclick=async()=>{if(measurementBusy)return;measurementBusy=true;try{await B.setMeasurementDisabled(uid,disabled,true);await finish();}finally{measurementBusy=false;}};}
      finally{measurementBusy=false;}
    });
  };
  V.renderPlayer=()=>{
    U.clear();const s=playerState,p=s.player,e=B.state.engine;
    const {start,end}=B.range(s.start,s.end);
    const defs=A.periods(e.min<start?e.min:start,end,s.unit).map(d=>({...d,start:d.end>=start&&d.start<start?start:d.start,end:d.end>end?end:d.end}));
    const ds=e.aggregate({filter:{name:p.name},method:s.method,start:e.min<start?e.min:start,end,periods:defs});
    const summary=U.periodSummary(start,end,s.method);
    const latestMonth=s.latest?.slice(0,7),latestRows=(e.byName.get(p.name)||[]).filter(r=>r.date.slice(0,7)===latestMonth);
    U.main().innerHTML=U.heading('PLAYER / PROFILE','球員個人檔案','',`<a class="button" href="#home">返回球員名單</a>`)+`
      <section class="panel"><div class="profile-hero"><div class="big-jersey">${B.esc(p.number)}</div><div><h1>${B.esc(p.name)}</h1><div class="profile-meta"><span class="badge">${B.esc(p.level)}</span><span class="badge">${B.esc(p.position)}</span><span class="muted small">角色／功能：${B.esc(p.role||'—')}</span></div></div></div><p class="profile-note">備註：${B.esc(p.note||'—')}</p><p class="muted small">${s.latest?'最新測量：'+s.latest:'此球員尚無有效測量資料。'}</p><div class="profile-counts"><strong>${latestMonth||'最近一月'}：${latestRows.filter(r=>!r.disabled).length} 筆使用中</strong><span>全部 ${latestRows.length} 筆 · 停用 ${latestRows.filter(r=>r.disabled).length} 筆</span></div></section>
      <section class="panel control-panel"><h2 class="control-title">期間與指標</h2><div class="toolbar">${U.select('player-mode','期間',[{value:'recent',label:'最新 12 個月'},{value:'year',label:'本年度'},{value:'custom',label:'自訂區間'}],s.mode)}${U.select('player-unit','時間單位',[{value:'day',label:'日 Day'},{value:'month',label:'月 Month'},{value:'year',label:'年 Year'}],s.unit)}${U.method(s.method)}<label>開始日期<input id="player-start" type="date" value="${start}" ${s.mode==='custom'?'':'disabled'}></label><label>結束日期<input id="player-end" type="date" value="${end}" ${s.mode==='custom'?'':'disabled'}></label>${s.mode==='custom'?'<button id="player-range-apply" class="primary">套用</button>':''}</div><div class="toolbar secondary" style="display:block">${U.metricPicker(s.metrics)}</div></section><p class="conditions">${B.esc(p.name+' · '+summary)} · Δ 比較前一期有效資料；跨缺失期間以虛線連接。</p>
      ${s.metrics.map((k,i)=>{const m=registry(k),series=e.personal(ds,p.name,k).filter(r=>r.end>=start&&r.start<=end);return U.metricBlock('player-'+i,`${p.name}－${m.label}`,summary,V.playerSeriesTable(series,m,i));}).join('')}`;
    U.bind('player-mode','change',()=>{s.mode=U.val('player-mode');const latest=s.latest||e.max,d=new Date(latest+'T00:00:00Z');if(s.mode==='recent'){s.start=B.iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-11,1));s.end=B.date(latest.slice(0,7),true,true);}else if(s.mode==='year'){const year=new Date().getFullYear();s.start=year+'-01-01';s.end=year+'-12-31';}V.renderPlayer();});
    U.bind('player-unit','change',()=>{s.unit=U.val('player-unit');V.renderPlayer();});U.bind('method','change',()=>{s.method=U.val('method');V.renderPlayer();});
    U.bind('player-range-apply','click',()=>{try{const range=B.range(U.val('player-start'),U.val('player-end'));s.start=range.start;s.end=range.end;V.renderPlayer();}catch(e){U.toast(e.message);}});
    U.wireMetrics(s.metrics,V.renderPlayer);
    s.metrics.forEach((k,i)=>B.Charts.timeline('player-'+i,e.personal(ds,p.name,k).filter(r=>r.end>=start&&r.start<=end),registry(k),{title:`${p.name}－${registry(k).label}`,summary,unit:s.unit}));V.wireMeasurements();return U.flushCharts();
  };
})(BB);
