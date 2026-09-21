(function(B){
  'use strict';
  const U=B.UI,V=B.Views,A=B.Analysis,E=B.Extras;
  let state,sequence=0,markerSequence=0;
  const metric=k=>B.state.data.registry.find(m=>m.key===k);
  const centers=[{value:'avg',label:'群體平均'},{value:'median',label:'群體中位數'}];
  const modes=[{value:'absolute',label:'絕對值'},{value:'delta',label:'Δ 改變值'}];
  const isPairMode=mode=>mode==='twoMonths'||mode==='twoWeeks';
  const markerPalette=['#C2323B','#176DA2','#177342','#182C3C','#E6AF32','#8B72AF'];
  const markerColorStorage='bb-marker-color-prefs-v1';
  const normalizeHex=value=>{
    let raw=String(value||'').trim().replace(/^#/,'');
    if(/^[0-9a-f]{3}$/i.test(raw))raw=raw.split('').map(x=>x+x).join('');
    return /^[0-9a-f]{6}$/i.test(raw)?'#'+raw.toUpperCase():null;
  };
  const loadColorPrefs=()=>{
    try{
      const raw=JSON.parse(localStorage.getItem(markerColorStorage)||'{}');
      const uniq=list=>[...new Set((Array.isArray(list)?list:[]).map(normalizeHex).filter(Boolean))];
      return {recent:uniq(raw.recent).slice(0,8),favorites:uniq(raw.favorites).slice(0,12)};
    }catch(_){return {recent:[],favorites:[]};}
  };
  let colorPrefs=loadColorPrefs();
  const saveColorPrefs=()=>{try{localStorage.setItem(markerColorStorage,JSON.stringify(colorPrefs));}catch(_){}};
  const rememberColor=value=>{const color=normalizeHex(value);if(!color)return null;colorPrefs.recent=[color,...colorPrefs.recent.filter(x=>x!==color)].slice(0,8);saveColorPrefs();return color;};
  const toggleFavorite=value=>{const color=normalizeHex(value);if(!color)return false;const exists=colorPrefs.favorites.includes(color);colorPrefs.favorites=exists?colorPrefs.favorites.filter(x=>x!==color):[color,...colorPrefs.favorites.filter(x=>x!==color)].slice(0,12);saveColorPrefs();return !exists;};
  const markerSwatches=(groupId,label,colors)=>colors.length?`<div class="marker-color-presets"><span>${label}</span><div class="marker-color-swatches">${colors.map(color=>`<button type="button" class="marker-color-swatch" data-marker-swatch="${B.esc(groupId)}" data-marker-swatch-color="${color}" title="${color}" aria-label="套用 ${color}" style="--marker-swatch:${color}"></button>`).join('')}</div></div>`:'';
  const newMarkerGroup=c=>({id:'marker-'+(++markerSequence),name:'標記 '+(c.markGroups.length+1),color:markerPalette[c.markGroups.length%markerPalette.length],open:true,legendVisible:true});
  const markerGroup=(c,id)=>c.markGroups.find(g=>g.id===id);
  const ensureLegendLayout=c=>c.legendLayout||(c.legendLayout={orientation:'horizontal',align:'left',manual:false});
  const legendWidth=name=>Math.max(.105,Math.min(.245,.055+Array.from(String(name||'')).length*.014));
  const visibleLegendEntries=c=>{
    ensureLegendLayout(c);
    const base=c.markGroups.find(g=>g.default),entries=[];
    if(base?.legendVisible!==false&&[...c.marks.values()].some(id=>id===base.id))entries.push({key:'current',name:base.name||'當期球員',target:c.seriesLegends.current});
    if(c.previous&&c.seriesLegends.previous.visible!==false)entries.push({key:'previous',name:c.seriesLegends.previous.name||'前一期有效位置',target:c.seriesLegends.previous});
    if(c.movement&&c.seriesLegends.movement.visible!==false)entries.push({key:'movement',name:c.seriesLegends.movement.name||'移動軌跡',target:c.seriesLegends.movement});
    for(const g of c.markGroups)if(!g.default&&g.legendVisible!==false&&[...c.marks.values()].some(id=>id===g.id))entries.push({key:'marker:'+g.id,name:g.name||'未命名標記',target:g,custom:true});
    return entries;
  };
  const arrangeLegendItems=(c,{reset=false}={})=>{
    const layout=ensureLegendLayout(c);if(reset){layout.orientation='horizontal';layout.align='left';layout.manual=false;}
    const entries=visibleLegendEntries(c),horizontal=layout.orientation!=='vertical',right=layout.align==='right';
    let x=right ? .98 : .02,y=-.10,row=0;
    for(const entry of entries){const width=legendWidth(entry.name),anchor=right?'right':'left';
      if(horizontal){
        if(!right&&x+width>.98&&x>.03){row++;x=.02;y=-.10-row*.065;}
        if(right&&x-width<.02&&x<.97){row++;x=.98;y=-.10-row*.065;}
      }
      if(entry.custom){entry.target.legendX=x;entry.target.legendY=y;entry.target.legendAnchor=anchor;}
      else Object.assign(entry.target,{x,y,xanchor:anchor});
      if(horizontal)x+=right?-(width+.025):(width+.025);else y-=.065;
    }
    return entries;
  };
  const markerStyleMap=c=>new Map([...c.marks].map(([name,id])=>[name,markerGroup(c,id)]).filter(([,group])=>group));
  const markerColor=(c,name)=>markerGroup(c,c.marks.get(name))?.color||'#197AA4';
  const ensureDefaultMarker=(c,players)=>{
    let group=c.markGroups.find(g=>g.default);
    if(!group){group={id:'default-'+(++markerSequence),name:'當期球員',color:'#197AA4',open:false,default:true,legendVisible:true};c.markGroups.unshift(group);}
    c.knownPlayers=c.knownPlayers||new Set();
    for(const player of players)if(!c.knownPlayers.has(player.name)){if(!c.marks.has(player.name))c.marks.set(player.name,group.id);c.knownPlayers.add(player.name);}
    return group;
  };
  const makeCard=(x,y,delta=false,custom=false)=>({id:'comparison-'+(++sequence),x:{key:x,mode:delta?'delta':'absolute',center:'avg'},y:{key:y,mode:delta?'delta':'absolute',center:'avg'},period:'',names:true,spread:true,previous:false,movement:false,tableOpen:false,basesOpen:false,listOpen:false,markerOpen:false,seriesLegendOpen:false,markGroups:[],custom,comparisonMode:'period',pairBase:'',pairCurrent:'',weekBaseMonth:'',weekBase:'',weekCurrentMonth:'',weekCurrent:'',marks:new Map(),knownPlayers:new Set(),labelOffsets:new Map(),legendPosition:null,legendLayout:{orientation:'horizontal',align:'left',manual:false},seriesLegends:{current:{visible:true,x:.02,y:-.10,xanchor:'left'},previous:{visible:true,name:'',color:'#197AA4',x:.20,y:-.10,xanchor:'left'},movement:{visible:true,name:'移動軌跡',color:'#9AACBA',x:.43,y:-.10,xanchor:'left'}},hidden:new Set(),region:{enabled:false,xMin:null,xMax:!delta&&x==='ffmi'?22:null,yMin:null,yMax:!delta&&y==='ffmi'?22:null,color:'#e6af32'},ffmi:22});
  const title=c=>(c.y.mode==='delta'?'Δ':'')+metric(c.y.key).label+' × '+(c.x.mode==='delta'?'Δ':'')+metric(c.x.key).label;
  V.comparison=()=>{
    const e=B.state.engine;if(!e)return V.import();const year=e.years.at(-1),latest=B.state.data.seasons.filter(p=>p.start<=year+'-12-31'&&p.end>=year+'-01-01').at(-1);
    state={year,filter:{positionsByLevel:U.defaultLevelPositions()},scope:latest?'season':'month',season:latest?String(B.state.data.seasons.indexOf(latest)):'',start:latest?.start||e.max.slice(0,7)+'-01',end:latest?.end||B.date(e.max.slice(0,7),true,true),method:'avg',history:[],period:'',cards:[makeCard('pbf','ffmi'),makeCard('pbf','ffmi',true),makeCard('pbf','weight',true),makeCard('smm','ffmi',true),makeCard('weight','smm',true),makeCard('pbf','ffmi',false,true)]};
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
      const unit=s.scope==='week'?'week':s.scope==='day'?'day':s.scope==='year'?'year':'month',start=e.min<s.start?e.min:s.start,end=s.end;
      defs=A.windowPeriods(start,s.start,end,unit);visible=defs.filter(p=>p.end>=s.start&&p.start<=s.end);
      if(!visible.some(p=>p.key===s.period)){const last=e.data.rows.filter(r=>!r.disabled&&r.date>=s.start&&r.date<=s.end).at(-1)?.date;s.period=visible.find(p=>last>=p.start&&last<=p.end)?.key||visible.at(-1)?.key;}
    }
    if(!defs.length||!visible.length)return null;
    const start=defs.reduce((a,p)=>p.start<a?p.start:a,defs[0].start),end=defs.reduce((a,p)=>p.end>a?p.end:a,defs[0].end);
    if(!visible.some(p=>p.key===s.period))s.period=visible.at(-1).key;
    return {ds:e.aggregate({filter:s.filter,method:s.method,unit:s.scope,start,end,periods:defs}),visible,active:defs.find(p=>p.key===s.period)};
  };
  const resetPeriods=()=>{state.period='';state.cards.forEach(c=>c.period='');};
  V.renderComparison=()=>{
    U.clear();const s=state,e=B.state.engine,data=B.state.data,pack=dataset();if(!pack){U.main().innerHTML=U.empty('沒有可比較的期間','請檢查賽季與測量日期。');return;}
    const {ds,active}=pack,summary=`${active.label} · ${U.levelPositionText(s.filter)} · ${B.methodName(ds.method)}`;
    const summaries=['weight','ffmi','pbf','smm'].map(k=>{const m=metric(k),r=e.team(ds,k).find(r=>r.period===s.period);return {label:m.label,value:B.fmt(r?.value),unit:m.unit,foot:`Δ${B.esc(m.label)} ${U.change(r?.delta)} · ${U.change(r?.pct,true)}<br>基準：${B.esc(r?.baseLabel||'—')} · ${r?.n||0} 人`};});
    U.main().innerHTML=U.heading('COMPARISON / QUADRANTS','個人分析／球員比較','每組包含一張圖與專屬核對表；當期、中心與顯示選項可在各組獨立調整。')+`
      <section class="panel control-panel"><h2 class="control-title">共同分析範圍</h2><div class="toolbar">${U.filter(s.filter,s.year)}${U.select('scope','比較單位',[{value:'season',label:'整個賽季'},{value:'month',label:'月'},{value:'week',label:'週（日～六）'},{value:'day',label:'日'},{value:'year',label:'年'},{value:'custom',label:'自訂整段區間'}].filter(o=>o.value!=='season'||data.seasons.length),s.scope)}${U.method(s.method,s.scope)}</div>
      <div class="toolbar secondary">${U.select('season','賽季範圍',[{value:'',label:'自訂範圍'},...data.seasons.map((p,i)=>({value:String(i),label:`${p.name} · ${p.start}～${p.end}`})).filter(p=>{const season=data.seasons[Number(p.value)];return season.start<=s.year+'-12-31'&&season.end>=s.year+'-01-01';})],s.season)}<label>開始日期<input id="compare-start" type="date" value="${s.start}" ${s.scope==='season'?'disabled':''}></label><label>結束日期<input id="compare-end" type="date" value="${s.end}" ${s.scope==='season'?'disabled':''}></label><button id="compare-range" class="small" ${s.scope==='season'?'disabled':''}>套用範圍</button></div>
      ${s.scope==='custom'?`<div class="custom-history-editor secondary"><div class="panel-title"><div><strong>較早比較區間</strong><p class="small muted">使用日期選擇器新增需要的較早區間；自訂整段區間不會自行推定前一期。</p></div><div class="actions"><button type="button" id="history-add" class="small">＋ 新增區間</button><button type="button" id="history-apply" class="small primary">套用較早區間</button></div></div><div id="comparison-history-list" class="custom-history-list">${s.history.map((p,i)=>`<div class="custom-history-row"><label>開始日期<input type="date" data-history-start value="${B.esc(p.start)}"></label><label>結束日期<input type="date" data-history-end value="${B.esc(p.end)}"></label><button type="button" class="small danger" data-history-remove aria-label="移除此較早區間">移除</button></div>`).join('')}</div></div>`:''}
      <p class="conditions">${s.scope==='season'?'賽季依開始日期排序，重疊賽季分別彙總。':s.scope==='custom'?'整段自訂期間不推定等長前一期，僅使用明確輸入的較早區間。':s.scope==='week'?'週日～週六分組，首尾週依選取日期截斷；採週平均，W1 由本區間起算，基準可早於顯示範圍。':'日／月／年基準可早於顯示範圍。'} Δ 仍逐指標尋找前一期有效值。</p></section>
      <p class="conditions">群體摘要期間：${B.esc(summary)}。各圖若改選當期，請以該圖標題與核對表為準。</p>${U.stats(summaries)}
      <div class="comparison-stack" id="comparison-cards">${s.cards.map(c=>`<section id="card-${c.id}" class="panel metric-block comparison-card"></section>`).join('')}</div>
      <section class="panel control-panel" id="add-comparison"><h2 class="control-title">＋ 新增自訂散佈圖與核對表</h2><div class="toolbar">${U.select('new-comparison-mode','比較方式',[{value:'period',label:'依共同分析期間'},{value:'twoMonths',label:'自選兩個月份（絕對值）'},{value:'twoWeeks',label:'自選兩週（絕對值）'}],'period')}${U.metricSelect('new-x','X 指標','pbf')}${U.select('new-x-mode','X 模式',modes,'absolute')}${U.metricSelect('new-y','Y 指標','ffmi')}${U.select('new-y-mode','Y 模式',modes,'absolute')}<button id="add-scatter" class="primary">新增一組圖表</button></div><p class="conditions">月份比較保留原本的比較月／當期月；週次比較則先選起始月與終點月，再各自選該月的週次。週次固定依週日～週六切分；若月份首日不是週日，W1 會向前延伸至該週週日，月底所在週也會延伸至週六。</p></section><section id="comparison-dual" class="dual-section"></section><section id="comparison-range-summary"></section>`;
    s.cards.forEach(c=>V.paintComparisonCard(c,pack));
    U.wireLevelPositions();for(const id of [...U.levelPositionIds(),'method'])U.bind(id,'change',()=>{s.filter={positionsByLevel:U.readLevelPositions()};if(s.scope!=='week')s.method=U.val('method');V.renderComparison();});
    U.bind('year','change',()=>{s.year=U.val('year');s.history=[];const seasons=data.seasons.map((p,i)=>({...p,i})).filter(p=>p.start<=s.year+'-12-31'&&p.end>=s.year+'-01-01'),season=seasons.at(-1);s.season=season?String(season.i):'';s.start=season?.start||s.year+'-01-01';s.end=season?.end||s.year+'-12-31';if(!season&&s.scope==='season')s.scope='month';resetPeriods();V.renderComparison();});
    U.bind('scope','change',()=>{s.scope=U.val('scope');if(s.scope==='season'&&!s.season)s.season=String(data.seasons.length-1);resetPeriods();V.renderComparison();});
    U.bind('season','change',()=>{s.season=U.val('season');s.history=[];const p=data.seasons[Number(s.season)];if(s.season!==''&&p){s.start=p.start;s.end=p.end;}else if(s.scope==='season')s.scope='month';resetPeriods();V.renderComparison();});
    U.bind('compare-range','click',()=>{try{const r=B.range(U.val('compare-start'),U.val('compare-end'));if(s.scope==='custom')A.customPeriods(r.start,r.end,s.history);s.start=r.start;s.end=r.end;s.season='';resetPeriods();V.renderComparison();}catch(e){U.toast(e.message);}});
    U.bind('history-add','click',()=>{const list=document.getElementById('comparison-history-list');if(!list)return;list.insertAdjacentHTML('beforeend','<div class="custom-history-row"><label>開始日期<input type="date" data-history-start></label><label>結束日期<input type="date" data-history-end></label><button type="button" class="small danger" data-history-remove aria-label="移除此較早區間">移除</button></div>');list.querySelector('.custom-history-row:last-child [data-history-start]')?.focus();});
    document.getElementById('comparison-history-list')?.addEventListener('click',event=>{const button=event.target.closest('[data-history-remove]');if(button)button.closest('.custom-history-row')?.remove();});
    U.bind('history-apply','click',()=>{try{const history=[...document.querySelectorAll('#comparison-history-list .custom-history-row')].map(row=>{const start=row.querySelector('[data-history-start]')?.value||'',end=row.querySelector('[data-history-end]')?.value||'';if(!start&&!end)return null;if(!start||!end)throw Error('每個較早比較區間都要同時選擇開始與結束日期。');return B.range(start,end);}).filter(Boolean);A.customPeriods(s.start,s.end,history);s.history=history;resetPeriods();V.renderComparison();}catch(e){U.toast(e.message);}});
    U.wireMetric('new-x');U.wireMetric('new-y');
    U.bind('new-comparison-mode','change',()=>{const pair=isPairMode(U.val('new-comparison-mode'));for(const axis of ['x','y']){const el=document.getElementById('new-'+axis+'-mode');el.disabled=pair;if(pair)el.value='absolute';}});
    U.bind('add-scatter','click',()=>{const card=makeCard(U.readMetric('new-x'),U.readMetric('new-y'),false,true);card.x.mode=U.val('new-x-mode');card.y.mode=U.val('new-y-mode');for(const axis of ['x','y'])if(card[axis].mode==='delta')card.region[axis+'Max']=null;card.comparisonMode=U.val('new-comparison-mode');if(isPairMode(card.comparisonMode)){card.x.mode=card.y.mode='absolute';card.previous=true;}s.cards.push(card);const node=document.createElement('section');node.id='card-'+card.id;node.className='panel metric-block comparison-card';document.getElementById('comparison-cards').append(node);V.paintComparisonCard(card,dataset());U.flushCharts(node);node.scrollIntoView({behavior:'smooth',block:'start'});});
    V.Trends.render('comparison-dual',{pickPlayer:true,filter:s.filter,method:s.method,start:s.start,end:s.end,unit:['day','week','month','year'].includes(s.scope)?s.scope:'month'});
    V.RangeSummary.render('comparison-range-summary');
    U.flushCharts();
  };
  V.cardPack=(card,pack)=>{
    const e=B.state.engine;
    if(card.comparisonMode==='twoMonths'){
      const months=A.periods(e.min,e.max).map(p=>p.key),last=months.at(-1),d=new Date(last+'-01T00:00:00Z');
      if(!card.pairCurrent)card.pairCurrent=last;
      if(!card.pairBase)card.pairBase=months.at(-2)||B.iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).slice(0,7);
      card.x.mode=card.y.mode='absolute';
      const result=E.monthComparison(e,state.filter,state.method,card.x,card.y,card.pairBase,card.pairCurrent);
      card.period=card.pairCurrent;return result;
    }
    if(card.comparisonMode==='twoWeeks'){
      const months=A.periods(e.min,e.max).map(p=>p.key),uniqueWeeks=[...new Map(months.flatMap(E.monthWeeks).filter(w=>w.end>=e.min&&w.start<=e.max).map(w=>[w.key,w])).values()].sort((a,b)=>a.start.localeCompare(b.start));
      if(uniqueWeeks.length<2)throw Error('目前資料不足兩個可比較週次。');
      const currentMonth=e.max.slice(0,7),current=E.monthWeeks(currentMonth).find(w=>e.max>=w.start&&e.max<=w.end)||uniqueWeeks.at(-1),currentIndex=uniqueWeeks.findIndex(w=>w.key===current.key),baseKey=uniqueWeeks[Math.max(0,currentIndex-1)].key;
      const base=E.monthWeeks(current.month).find(w=>w.key===baseKey)||months.flatMap(E.monthWeeks).find(w=>w.key===baseKey)||uniqueWeeks[Math.max(0,currentIndex-1)];
      if(!card.weekCurrentMonth){card.weekCurrentMonth=current.month;card.weekCurrent=current.index;}
      if(!card.weekBaseMonth){card.weekBaseMonth=base.month;card.weekBase=base.index;}
      card.x.mode=card.y.mode='absolute';
      const result=E.weekComparison(e,state.filter,card.x,card.y,card.weekBaseMonth,card.weekBase,card.weekCurrentMonth,card.weekCurrent);
      card.period=result.current.key;return result;
    }
    if(!pack.visible.some(p=>p.key===card.period))card.period=state.period;
    return {...pack,active:pack.ds.periods.find(p=>p.key===card.period),result:e.scatter(pack.ds,card.x,card.y,card.period)};
  };
  V.rangeEditor=c=>`<details id="${c.id}-range-editor" class="range-editor" ${c.rangeOpen?'open':''}><summary>標記框範圍與顏色</summary><div class="toolbar">${['x','y'].map(axis=>`<label>${axis.toUpperCase()} ${B.esc(metric(c[axis].key).label)} 下限<input type="number" step="any" id="${c.id}-${axis}-min" value="${c.region[axis+'Min']??''}" placeholder="不限"></label><label>${axis.toUpperCase()} ${B.esc(metric(c[axis].key).label)} 上限<input type="number" step="any" id="${c.id}-${axis}-max" value="${c.region[axis+'Max']??''}" placeholder="不限"></label>`).join('')}<label>標記框顏色<input id="${c.id}-range-color" type="color" value="${c.region.color}"></label><button id="${c.id}-range-apply" class="small primary">套用標記框</button></div><div class="toolbar"><label>FFMI 參考值（可調）<input id="${c.id}-ffmi" type="number" step="any" value="${c.ffmi}"></label><button id="${c.id}-ffmi-apply" class="small">標記 FFMI 低於參考值</button><p class="small muted">上下限留白代表不限制；22 為預設自訂參考值。框選只加上背景，不排除資料。</p></div></details>`;
  V.markerEditor=(c,players)=>`<details id="${c.id}-marker-editor" class="point-marker-editor" ${c.markerOpen?'open':''}><summary>標記點（${c.markGroups.length} 類）</summary><p class="small muted">標記只改變本圖點的顏色與左下圖例，姓名文字固定黑色，不改變中心線、座標或統計。預設「當期球員」可自行改名、改色與取消個別球員；雙擊圖例可直接開啟該標記編輯，圖例可拖曳位置；開啟「分散姓名標籤」時可直接拖曳姓名位置。</p><div class="marker-editor-actions"><button id="${c.id}-marker-add" class="small primary">＋ 新增標記點</button><button id="${c.id}-marker-reset" class="small">全部恢復預設標記</button></div><div class="marker-groups">${c.markGroups.length?c.markGroups.map(g=>{const count=[...c.marks.values()].filter(id=>id===g.id).length,color=normalizeHex(g.color)||'#C2323B',favorite=colorPrefs.favorites.includes(color);g.color=color;return `<details class="marker-group" data-marker-group="${B.esc(g.id)}" ${g.open?'open':''}><summary><span class="marker-preview" style="background:${color}"></span><strong>${B.esc(g.name)}</strong><small>${count} 人</small></summary><div class="marker-group-fields"><label>圖例名稱<input data-marker-name="${B.esc(g.id)}" value="${B.esc(g.name)}" maxlength="40"></label><div class="marker-color-field"><span class="marker-field-label">顏色</span><div class="marker-color-row"><input data-marker-color-picker="${B.esc(g.id)}" type="color" value="${color}" title="開啟選色器"><input class="marker-hex-input" data-marker-hex="${B.esc(g.id)}" value="${color}" maxlength="7" spellcheck="false" aria-label="HEX 色碼"><button type="button" class="small marker-favorite-toggle ${favorite?'active':''}" data-marker-favorite="${B.esc(g.id)}" title="${favorite?'從我的最愛移除':'加入我的最愛'}" aria-label="${favorite?'從我的最愛移除':'加入我的最愛'}">${favorite?'★':'☆'}</button></div>${markerSwatches(g.id,'最近使用',colorPrefs.recent)}${markerSwatches(g.id,'我的最愛',colorPrefs.favorites)}</div><label class="check"><input type="checkbox" data-marker-legend-visible="${B.esc(g.id)}" ${g.legendVisible!==false?'checked':''}>顯示圖例</label>${g.default?'<span class="badge">預設</span>':`<button class="small danger" data-marker-delete="${B.esc(g.id)}">刪除此標記</button>`}</div><div class="marker-player-picks">${B.sortPlayers(players).map(p=>`<label><input type="checkbox" data-marker-player="${B.esc(p.name)}" data-marker-group-id="${B.esc(g.id)}" ${c.marks.get(p.name)===g.id?'checked':''}><span>${B.esc(p.name)}</span><small>${B.esc(p.level)} · ${B.esc(p.position)}</small></label>`).join('')}</div></details>`;}).join(''):'<p class="marker-empty">尚未建立標記。新增後可直接在這裡指定球員，也可點圖上的球員快速套用。</p>'}</div></details>`;
  V.seriesLegendEditor=(c,referenceLabel)=>{const base=ensureDefaultMarker(c,[]),layout=ensureLegendLayout(c),items=[['current','當期球員',base.name,base.color,base.legendVisible!==false],['previous','前一期有效位置',c.seriesLegends.previous.name||referenceLabel,c.seriesLegends.previous.color,c.seriesLegends.previous.visible!==false],['movement','移動軌跡',c.seriesLegends.movement.name||'移動軌跡',c.seriesLegends.movement.color,c.seriesLegends.movement.visible!==false]];return `<details id="${c.id}-series-legend" class="scatter-series-legend" ${c.seriesLegendOpen?'open':''}><summary>圖例名稱、顏色與排列</summary><p class="small muted">基礎圖例與自訂標記共用同一套排列。預設左下橫向排列；圖例仍可個別拖曳，接近其他圖例時會自動吸附對齊。</p><div class="legend-layout-controls"><label>排列<select data-legend-layout-orientation><option value="horizontal" ${layout.orientation!=='vertical'?'selected':''}>橫向</option><option value="vertical" ${layout.orientation==='vertical'?'selected':''}>縱向</option></select></label><label>對齊<select data-legend-layout-align><option value="left" ${layout.align!=='right'?'selected':''}>靠左</option><option value="right" ${layout.align==='right'?'selected':''}>靠右</option></select></label><button type="button" class="small" data-legend-layout-reset>恢復預設排列</button></div><div class="series-legend-grid">${items.map(([key,fallback,name,color,visible])=>`<div class="series-legend-row" data-series-legend-row="${key}"><label class="check"><input type="checkbox" data-series-legend-visible="${key}" ${visible?'checked':''}>顯示</label><label>名稱<input type="text" data-series-legend-name="${key}" value="${B.esc(name||fallback)}" maxlength="40"></label><label>顏色<input type="color" data-series-legend-color="${key}" value="${normalizeHex(color)||'#197AA4'}"></label></div>`).join('')}</div></details>`;};
  V.paintComparisonCard=(card,commonPack)=>{
    const c=card,s=state,id=c.id,root=document.getElementById('card-'+id),e=B.state.engine,monthPair=c.comparisonMode==='twoMonths',weekPair=c.comparisonMode==='twoWeeks',pair=isPairMode(c.comparisonMode),pack=V.cardPack(c,commonPack);
    const {visible,active}=pack,allPlayers=pack.ds.players;ensureDefaultMarker(c,allPlayers);if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);const ds={...pack.ds,players:allPlayers.filter(p=>!c.hidden.has(p.name))};
    const pairSummary=monthPair?c.pairBase+' → '+c.pairCurrent+' · 指定月份絕對值':weekPair?pack.base.fullLabel+' → '+pack.current.fullLabel+' · 指定週次絕對值':active.label;
    const result=E.filterScatter(pack.result,c.x,c.y,c.hidden),summary=`${pairSummary} · ${U.levelPositionText(s.filter)} · ${B.methodName(ds.method)}`;
    const prior=ds.periods[ds.periods.findIndex(p=>p.key===c.period)-1],audits=pair?[]:V.baselineAudit(ds,c,prior),warningCount=audits.filter(a=>a.warning).length;
    const available=new Set([...result.points,...(c.previous?result.referencePoints||[]:[])].map(p=>p.player.name)),allAvailable=new Set([...pack.result.points,...(pack.result.referencePoints||[])].map(p=>p.player.name));
    const repeated=new Map();for(const p of [...result.points,...(c.previous?result.referencePoints||[]:[])]){const k=p.x+'|'+p.y;if(!repeated.has(k))repeated.set(k,new Set());repeated.get(k).add(p.player.name);}const overlaps=[...repeated.values()].filter(a=>a.size>1).map(a=>[...a]);
    const months=A.periods(e.min,e.max).map(p=>p.key),weekOptions=month=>E.monthWeeks(month).map(w=>({value:w.index,label:w.label}));
    const comparisonModes=[{value:'period',label:'依共同分析期間'},{value:'twoMonths',label:'自選兩個月份（絕對值）'},{value:'twoWeeks',label:'自選兩週（絕對值）'}];
    const pairSelectors=monthPair?U.select(id+'-base-month','比較月',months,c.pairBase)+U.select(id+'-current-month','當期月',months,c.pairCurrent)+`<button id="${id}-months-apply" class="small primary">套用兩個月</button>`:weekPair?U.select(id+'-base-week-month','起始月',months,c.weekBaseMonth)+U.select(id+'-base-week','起始週',weekOptions(c.weekBaseMonth),c.weekBase)+U.select(id+'-current-week-month','終點月',months,c.weekCurrentMonth)+U.select(id+'-current-week','終點週',weekOptions(c.weekCurrentMonth),c.weekCurrent)+`<button id="${id}-weeks-apply" class="small primary">套用兩週</button>`:U.select(id+'-period','當期',visible.map(p=>({value:p.key,label:p.label})),c.period);
    const previousLabel=monthPair?'顯示比較月':weekPair?'顯示起始週':'顯示前一期';
    const referenceLegendLabel=monthPair?c.pairBase+' 比較月':weekPair?pack.base.fullLabel+' 起始週':'前一期有效位置';
    const currentLegendLabel=monthPair?c.pairCurrent+' 當期月':weekPair?pack.current.fullLabel+' 終點週':'當期球員';
    const pairNote=monthPair?`<p class="small">比較月 ${c.pairBase}：${result.referencePoints.length} 人；當期月 ${c.pairCurrent}：${result.points.length} 人。月份缺資料時留缺值，不改用其他月份。</p>`:weekPair?`<p class="small">起始週 ${B.esc(pack.base.fullLabel)}：${result.referencePoints.length} 人；終點週 ${B.esc(pack.current.fullLabel)}：${result.points.length} 人。週次固定依週日～週六切分並採 Average 平均；月份首尾週可跨到前／後月，缺資料時留缺值，不跨週補值。</p>`:'';
    const tableModeLabel=monthPair?'兩月份絕對值':weekPair?'兩週絕對值':'逐期';
    const tableHelp=monthPair?'每個指標各占一列，只顯示所選兩個月份的絕對值；— 表示該月缺失。':weekPair?'每個指標各占一列，只顯示所選起始週與終點週的週平均絕對值；— 表示該週缺失。':'每項指標分為代表值、Δ、Δ% 三列；橫向為時間，標號對照表下方實際基準。';
    root.dataset.cardId=id;
    root.innerHTML=`<div class="metric-header"><div><span class="eyebrow">${c.custom?'自訂':'預設'} · 圖與核對表</span><h2>${B.esc(title(c))}</h2><p>${B.esc(summary)}</p></div><div class="actions">${U.exportButtons(id)}${U.expandButton('card-'+id,'全螢幕')}${c.custom?'<button class="small danger" data-remove-card>移除這組</button>':''}</div></div>
      <div class="card-controls"><div class="toolbar">${c.custom?U.select(id+'-compare-mode','比較方式',comparisonModes,c.comparisonMode):''}${pairSelectors}${U.select(id+'-x-center','X 絕對值中心',centers,c.x.center,c.x.mode==='delta'?'disabled':'')}${U.select(id+'-y-center','Y 絕對值中心',centers,c.y.center,c.y.mode==='delta'?'disabled':'')}</div>
      ${c.custom?`<details class="axis-settings"><summary>調整此圖的 X／Y 指標</summary><div class="toolbar">${U.metricSelect(id+'-x','X 指標',c.x.key)}${U.select(id+'-x-mode','X 模式',modes,c.x.mode,pair?'disabled':'')}${U.metricSelect(id+'-y','Y 指標',c.y.key)}${U.select(id+'-y-mode','Y 模式',modes,c.y.mode,pair?'disabled':'')}<button id="${id}-axes" class="small primary">更新此圖與表格</button></div></details>`:''}
      <div class="local-toolbar">${U.axisTitleControl(id)}${[['names','顯示姓名'],['spread','分散姓名標籤'],['previous',previousLabel],['movement','顯示移動軌跡'],['listOpen','球員顯示清單']].map(([key,label])=>`<label class="check"><input id="${id}-${key}" type="checkbox" ${c[key]?'checked':''}>${label}</label>`).join('')}<label class="check"><input id="${id}-range-enabled" type="checkbox" ${c.region.enabled?'checked':''}>顯示標記框</label>${U.expandButton(id+'-figure','放大圖表')}</div>${V.markerEditor(c,allPlayers)}${V.seriesLegendEditor(c,referenceLegendLabel)}${V.rangeEditor(c)}</div>
      <div id="${id}-figure" class="figure-area"><div class="scatter-layout ${c.listOpen?'with-roster':''}"><div id="${id}" class="chart"></div>${c.listOpen?`<aside class="scatter-roster"><h3>本圖球員</h3><p class="small muted">隱藏會連同資料點、姓名與軌跡一起隱藏；標記類別只屬於本圖。</p><div class="actions"><button class="small" data-players-show="all">全部顯示</button><button class="small" data-players-show="none">全部隱藏</button></div><div class="roster-checks">${B.sortPlayers(allPlayers).map(p=>`<div class="roster-check"><label><input type="checkbox" data-player-visible="${B.esc(p.name)}" ${c.hidden.has(p.name)?'':'checked'}><span>${B.esc(p.name)}</span></label><button class="small" data-player-menu="${B.esc(p.name)}">標記</button>${allAvailable.has(p.name)?'':'<small>當期資料不足</small>'}</div>`).join('')}</div></aside>`:''}</div></div>
      <div class="scatter-note"><span>${pair?available.size:result.points.length} 名球員有有效位置 · 隱藏 ${allPlayers.filter(p=>c.hidden.has(p.name)).length} 人 · X 中心 ${B.fmt(result.centerX)} · Y 中心 ${B.fmt(result.centerY)}</span><p class="small muted">顏色及顯示名單只影響本圖。中心依當期可見且 X／Y 皆有效的球員重算；姓名往所屬象限外側排列，座標不移動；開啟分散標籤後可直接拖曳姓名位置。</p>${overlaps.length?`<details><summary>完全重疊位置（${overlaps.length} 組）</summary>${overlaps.map(names=>`<div class="overlap-list">${names.map(n=>`<button class="small" data-player-menu="${B.esc(n)}">${B.esc(n)}</button>`).join('')}</div>`).join('')}</details>`:''}${pair?pairNote:result.omitted.filter(n=>!c.hidden.has(n)).length?`<p class="small">未繪製（X／Y 或 Δ 資料不足）：${B.esc(result.omitted.filter(n=>!c.hidden.has(n)).join('、'))}</p>`:''}</div>
      ${pair?'':`<details id="${id}-baselines" class="baseline-review ${warningCount?'needs-review':'normal-review'}" ${c.basesOpen?'open':''}><summary>${warningCount?'需核對 '+warningCount+' 人':'基準一致'} · 查看實際比較基準</summary><p class="small muted">預期基準為相鄰前一期：${B.esc(prior?.label||'無（第一期）')}。黃色表示跨期或資料不足；仍依規格採前一期有效值。</p>${V.auditTable(audits,c)}</details>`}
      <details id="${id}-details" class="paired-table" ${c.tableOpen?'open':''}><summary>${B.esc(title(c))} · ${tableModeLabel}核對表（${ds.players.length} 人）</summary><div class="table-actions"><p class="small muted">${tableHelp}表格與本圖顯示名單一致。</p>${U.expandButton(id+'-table','放大表格')}</div><div id="${id}-table" class="comparison-table">${c.tableOpen?V.comparisonTable(ds,visible,c):''}</div></details>`;
    const baseLegendGroup=ensureDefaultMarker(c,allPlayers),scatterSeriesLegends={...c.seriesLegends,current:{...c.seriesLegends.current,name:baseLegendGroup.name||currentLegendLabel,color:baseLegendGroup.color||'#197AA4',visible:baseLegendGroup.legendVisible!==false}};
    B.Charts.scatter(id,result,c.x,c.y,{title:title(c),summary,names:c.names,spread:c.spread,previous:c.previous,movement:c.movement,labelOffsets:c.labelOffsets,markStyles:markerStyleMap(c),region:c.region,pair,referenceLabel:referenceLegendLabel,currentLabel:currentLegendLabel,seriesLegends:scatterSeriesLegends,onClick:names=>V.playerMenu(names,id),onLabelMove:(name,pos)=>c.labelOffsets.set(name,pos),legendPosition:c.legendPosition,onLegendMove:pos=>{if(B.valid(pos.x)&&B.valid(pos.y))c.legendPosition=pos;},onLegendItemMove:(key,pos)=>{if(!B.valid(pos.x)||!B.valid(pos.y))return;ensureLegendLayout(c).manual=true;if(key.startsWith('marker:')){const group=markerGroup(c,key.slice(7));if(group){group.legendX=pos.x;group.legendY=pos.y;if(pos.xanchor)group.legendAnchor=pos.xanchor;}}else if(c.seriesLegends[key])Object.assign(c.seriesLegends[key],pos);},onLegendItemEdit:key=>{if(key.startsWith('marker:')){const groupId=key.slice(7),group=markerGroup(c,groupId);if(!group)return;c.markerOpen=true;group.open=true;V.refreshComparisonCard(id).then(()=>[...document.querySelectorAll('[data-marker-name]')].find(el=>el.dataset.markerName===groupId)?.focus());return;}c.seriesLegendOpen=true;V.refreshComparisonCard(id).then(()=>document.querySelector(`[data-series-legend-name="${key}"]`)?.focus());},onLegendEdit:groupId=>{const group=markerGroup(c,groupId);if(!group)return;c.markerOpen=true;group.open=true;V.refreshComparisonCard(id).then(()=>[...document.querySelectorAll('[data-marker-name]')].find(el=>el.dataset.markerName===groupId)?.focus());}});
    const refresh=()=>V.refreshComparisonCard(id);
    U.bind(id+'-period','change',()=>{c.period=U.val(id+'-period');refresh();});
    for(const axis of ['x','y'])U.bind(id+'-'+axis+'-center','change',()=>{c[axis].center=U.val(id+'-'+axis+'-center');refresh();});
    for(const key of ['names','spread','previous','movement','listOpen'])U.bind(id+'-'+key,'change',()=>{c[key]=document.getElementById(id+'-'+key).checked;if((key==='previous'||key==='movement')&&!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();});
    U.bind(id+'-baselines','toggle',()=>{c.basesOpen=document.getElementById(id+'-baselines').open;});
    U.bind(id+'-details','toggle',()=>{const d=document.getElementById(id+'-details');c.tableOpen=d.open;const table=document.getElementById(id+'-table');if(d.open&&!table.childElementCount){table.innerHTML=V.comparisonTable(ds,visible,c);V.wirePlayerLinks(table,id);}U.resizeCharts();});
    U.bind(id+'-marker-editor','toggle',()=>{c.markerOpen=document.getElementById(id+'-marker-editor').open;});
    U.bind(id+'-series-legend','toggle',()=>{c.seriesLegendOpen=document.getElementById(id+'-series-legend').open;});
    root.querySelectorAll('[data-series-legend-visible]').forEach(input=>input.onchange=()=>{const key=input.dataset.seriesLegendVisible;if(key==='current'){const base=ensureDefaultMarker(c,allPlayers);base.legendVisible=input.checked;}else c.seriesLegends[key].visible=input.checked;if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();});
    root.querySelectorAll('[data-series-legend-name]').forEach(input=>input.onchange=()=>{const key=input.dataset.seriesLegendName,value=B.clean(input.value);if(key==='current'){const base=ensureDefaultMarker(c,allPlayers);base.name=value||'當期球員';}else c.seriesLegends[key].name=value;if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();});
    root.querySelectorAll('[data-series-legend-color]').forEach(input=>input.onchange=()=>{const key=input.dataset.seriesLegendColor,color=normalizeHex(input.value)||'#197AA4';if(key==='current'){const base=ensureDefaultMarker(c,allPlayers);base.color=color;rememberColor(color);}else c.seriesLegends[key].color=color;refresh();});
    root.querySelectorAll('[data-legend-layout-orientation]').forEach(select=>select.onchange=()=>{const layout=ensureLegendLayout(c);layout.orientation=select.value==='vertical'?'vertical':'horizontal';layout.manual=false;arrangeLegendItems(c);refresh();});
    root.querySelectorAll('[data-legend-layout-align]').forEach(select=>select.onchange=()=>{const layout=ensureLegendLayout(c);layout.align=select.value==='right'?'right':'left';layout.manual=false;arrangeLegendItems(c);refresh();});
    root.querySelectorAll('[data-legend-layout-reset]').forEach(button=>button.onclick=()=>{arrangeLegendItems(c,{reset:true});refresh();});
    U.bind(id+'-marker-add','click',()=>{const group=newMarkerGroup(c);c.markGroups.push(group);rememberColor(group.color);c.markerOpen=true;ensureLegendLayout(c).manual=false;arrangeLegendItems(c);refresh();});
    U.bind(id+'-marker-reset','click',()=>{const group=ensureDefaultMarker(c,allPlayers);for(const p of allPlayers)c.marks.set(p.name,group.id);refresh();});
    root.querySelectorAll('[data-marker-group]').forEach(group=>group.ontoggle=()=>{const g=markerGroup(c,group.dataset.markerGroup);if(g)g.open=group.open;});
    root.querySelectorAll('[data-marker-name]').forEach(input=>input.onchange=()=>{const g=markerGroup(c,input.dataset.markerName);if(g){g.name=B.clean(input.value)||'未命名標記';if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();}});
    root.querySelectorAll('[data-marker-legend-visible]').forEach(input=>input.onchange=()=>{const g=markerGroup(c,input.dataset.markerLegendVisible);if(g){g.legendVisible=input.checked;if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();}});
    const applyMarkerColor=(groupId,value)=>{const g=markerGroup(c,groupId),color=normalizeHex(value);if(!g||!color){U.toast('請輸入 6 碼 HEX 色碼，例如 #C2323B。');return false;}g.color=rememberColor(color);refresh();return true;};
    root.querySelectorAll('[data-marker-color-picker]').forEach(input=>input.onchange=()=>applyMarkerColor(input.dataset.markerColorPicker,input.value));
    root.querySelectorAll('[data-marker-hex]').forEach(input=>{const apply=()=>{const color=normalizeHex(input.value);if(!color){input.value=markerGroup(c,input.dataset.markerHex)?.color||'#C2323B';U.toast('請輸入 6 碼 HEX 色碼，例如 #C2323B。');return;}applyMarkerColor(input.dataset.markerHex,color);};input.onchange=apply;input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();apply();}};});
    root.querySelectorAll('[data-marker-swatch]').forEach(button=>button.onclick=()=>applyMarkerColor(button.dataset.markerSwatch,button.dataset.markerSwatchColor));
    root.querySelectorAll('[data-marker-favorite]').forEach(button=>button.onclick=()=>{const g=markerGroup(c,button.dataset.markerFavorite);if(!g)return;toggleFavorite(g.color);refresh();});
    root.querySelectorAll('[data-marker-delete]').forEach(button=>button.onclick=()=>{const groupId=button.dataset.markerDelete,base=ensureDefaultMarker(c,allPlayers);c.markGroups=c.markGroups.filter(g=>g.id!==groupId);for(const [name,markId] of [...c.marks])if(markId===groupId)c.marks.set(name,base.id);if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();});
    root.querySelectorAll('[data-marker-player]').forEach(input=>input.onchange=()=>{const name=input.dataset.markerPlayer,groupId=input.dataset.markerGroupId,group=markerGroup(c,groupId),base=ensureDefaultMarker(c,allPlayers);if(input.checked)c.marks.set(name,groupId);else if(c.marks.get(name)===groupId){if(group?.default)c.marks.delete(name);else c.marks.set(name,base.id);}c.knownPlayers.add(name);if(!ensureLegendLayout(c).manual)arrangeLegendItems(c);refresh();});
    U.bind(id+'-range-editor','toggle',()=>{c.rangeOpen=document.getElementById(id+'-range-editor').open;});
    U.bind(id+'-range-enabled','change',()=>{c.region.enabled=document.getElementById(id+'-range-enabled').checked;refresh();});
    U.bind(id+'-range-apply','click',()=>{try{c.region=E.bounds({enabled:true,color:U.val(id+'-range-color'),xMin:U.val(id+'-x-min'),xMax:U.val(id+'-x-max'),yMin:U.val(id+'-y-min'),yMax:U.val(id+'-y-max')});refresh();}catch(err){U.toast(err.message);}});
    U.bind(id+'-ffmi-apply','click',()=>{const value=B.number(U.val(id+'-ffmi')),axis=['x','y'].find(a=>c[a].key==='ffmi'&&c[a].mode==='absolute');if(!B.valid(value))return U.toast('請輸入有效 FFMI 參考值。');if(!axis)return U.toast('請先將其中一軸設為 FFMI 絕對值。');c.ffmi=value;c.region={enabled:true,color:U.val(id+'-range-color'),xMin:null,xMax:null,yMin:null,yMax:null,[axis+'Max']:value};refresh();});
    root.querySelectorAll('[data-player-visible]').forEach(input=>input.onchange=()=>{if(input.checked)c.hidden.delete(input.dataset.playerVisible);else c.hidden.add(input.dataset.playerVisible);refresh();});
    root.querySelectorAll('[data-players-show]').forEach(button=>button.onclick=()=>{if(button.dataset.playersShow==='all')c.hidden.clear();else allPlayers.forEach(p=>c.hidden.add(p.name));refresh();});
    if(c.custom){
      U.bind(id+'-compare-mode','change',()=>{c.comparisonMode=U.val(id+'-compare-mode');c.period='';if(isPairMode(c.comparisonMode)){c.x.mode=c.y.mode='absolute';c.previous=true;}refresh();});
      U.bind(id+'-months-apply','click',()=>{try{const base=U.val(id+'-base-month'),current=U.val(id+'-current-month');E.monthComparison(e,s.filter,s.method,c.x,c.y,base,current);c.pairBase=base;c.pairCurrent=current;refresh();}catch(err){U.toast(err.message);}});
      const wireWeekMonth=(monthId,weekId)=>U.bind(monthId,'change',()=>{const month=U.val(monthId),select=document.getElementById(weekId),preferred=select?.value||'1',options=E.monthWeeks(month);if(select){select.innerHTML=U.opt(options.map(w=>({value:w.index,label:w.label})),options.some(w=>w.index===preferred)?preferred:'1');}});
      wireWeekMonth(id+'-base-week-month',id+'-base-week');wireWeekMonth(id+'-current-week-month',id+'-current-week');
      U.bind(id+'-weeks-apply','click',()=>{try{const baseMonth=U.val(id+'-base-week-month'),baseWeek=U.val(id+'-base-week'),currentMonth=U.val(id+'-current-week-month'),currentWeek=U.val(id+'-current-week');E.weekComparison(e,s.filter,c.x,c.y,baseMonth,baseWeek,currentMonth,currentWeek);c.weekBaseMonth=baseMonth;c.weekBase=baseWeek;c.weekCurrentMonth=currentMonth;c.weekCurrent=currentWeek;refresh();}catch(err){U.toast(err.message);}});
      U.wireMetric(id+'-x');U.wireMetric(id+'-y');U.bind(id+'-axes','click',()=>{for(const axis of ['x','y']){const key=U.readMetric(id+'-'+axis),mode=pair?'absolute':U.val(id+'-'+axis+'-mode');if(c[axis].key!==key||c[axis].mode!==mode){c.region[axis+'Min']=null;c.region[axis+'Max']=key==='ffmi'&&mode==='absolute'?c.ffmi:null;}c[axis].key=key;c[axis].mode=mode;}refresh();});
      root.querySelector('[data-remove-card]').onclick=()=>{U.closeViewer();Plotly.purge(document.getElementById(id));B.state.chartData.delete(id);s.cards=s.cards.filter(x=>x.id!==id);root.remove();};
    }
    V.wirePlayerLinks(root,id);
  };
  V.refreshComparisonCard=id=>{
    const c=state.cards.find(c=>c.id===id);if(!c)return;
    const viewer=document.getElementById('chart-viewer'),expanded=viewer?.open?viewer.dataset.target:null;
    if(expanded&&expanded!=='card-'+id&&expanded.startsWith(id))U.closeViewer();
    const root=document.getElementById('card-'+id),plot=document.getElementById(id),focus=document.activeElement?.id,rosterScroll=root.querySelector('.roster-checks')?.scrollTop||0,markerScrolls=new Map([...root.querySelectorAll('[data-marker-group]')].map(group=>[group.dataset.markerGroup,group.querySelector('.marker-player-picks')?.scrollTop||0]));
    if(plot)Plotly.purge(plot);B.state.chartData.delete(id);V.paintComparisonCard(c,dataset());
    return U.flushCharts(root).then(()=>{const list=root.querySelector('.roster-checks');if(list)list.scrollTop=rosterScroll;root.querySelectorAll('[data-marker-group]').forEach(group=>{const picks=group.querySelector('.marker-player-picks');if(picks)picks.scrollTop=markerScrolls.get(group.dataset.markerGroup)||0;});if(expanded&&expanded!=='card-'+id&&expanded.startsWith(id))U.expand(expanded);document.getElementById(focus)?.focus({preventScroll:true});});
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
        (isPairMode(c.comparisonMode)?[['value',m.label+' ('+m.unit+')']]:[['value',m.label+' ('+m.unit+')'],['delta','Δ'+m.label],['pct','Δ'+m.label+'%']]).forEach(([kind,label],ri)=>{
          body+=`<tr>${mi===0&&ri===0?`<th rowspan="${keys.length*(isPairMode(c.comparisonMode)?1:3)}" scope="rowgroup" class="player-cell"><button class="small" data-player-menu="${B.esc(player.name)}">${B.esc(player.name)}</button></th>`:''}<th scope="row" class="statistic-cell">${B.esc(label)}</th>${visible.map(period=>{const r=byPeriod.get(period.key);return `<td class="${period.key===c.period?'current-cell':''}">${kind==='value'?B.fmt(r?.value):U.change(r?.[kind],kind==='pct')+(B.valid(r?.[kind])?baseIndex(r):'')}</td>`;}).join('')}</tr>`;
        });
      });
    }
    return `<div class="table-scroll"><table class="comparison-matrix"><thead><tr><th>球員</th><th>指標／統計</th>${visible.map(p=>`<th class="${p.key===c.period?'current-cell':''}">${B.esc(p.label)}</th>`).join('')}</tr></thead><tbody>${body||'<tr><td>此條件無球員</td></tr>'}</tbody></table></div><div class="matrix-footnotes">${[...footnotes].map(([text,n])=>`<span>[${n}] ${B.esc(text)}</span>`).join('')||(c.comparisonMode==='twoMonths'?'依指定兩個月份直接彙總，不計算改變值。':c.comparisonMode==='twoWeeks'?'依指定起始週與終點週直接彙總週平均絕對值，不計算改變值。':'此範圍沒有可計算的前一期變化。')}</div>`;
  };
  V.wirePlayerLinks=(root,id)=>root.querySelectorAll('[data-player-menu]').forEach(b=>b.onclick=()=>V.playerMenu(b.dataset.playerMenu,id));
  V.playerMenu=(input,cardId)=>{
    const names=Array.isArray(input)?input:[input],d=document.getElementById('player-menu');
    if(names.length>1){d.innerHTML=`<button class="close" aria-label="關閉">×</button><h2 id="menu-title">此位置有 ${names.length} 名球員</h2><p class="muted small">數值完全重疊，請選擇球員。</p><div class="overlap-list">${names.map(n=>`<button data-choose-player="${B.esc(n)}">${B.esc(n)}</button>`).join('')}</div>`;d.querySelector('.close').onclick=()=>d.close();d.querySelectorAll('[data-choose-player]').forEach(b=>b.onclick=()=>V.playerMenu(b.dataset.choosePlayer,cardId));if(!d.open)d.showModal();return;}
    const name=names[0],p=B.state.data.players.find(p=>p.name===name),card=state?.cards.find(c=>c.id===cardId);if(!p||!card)return;
    const current=markerGroup(card,card.marks.get(name));
    d.innerHTML=`<button class="close" aria-label="關閉">×</button><h2 id="menu-title">${B.esc(name)}</h2><p class="muted small">${B.esc(p.level)} · ${B.esc(p.position)} · ${B.esc(p.number)}</p><p style="margin-top:18px">套用本圖標記${current?' · 目前：'+B.esc(current.name):''}</p>${card.markGroups.length?`<div class="marker-quick-list">${card.markGroups.map(group=>`<button class="marker-quick" data-marker-choice="${B.esc(group.id)}"><span class="marker-preview" style="background:${group.color}"></span>${B.esc(group.name)}</button>`).join('')}</div>`:'<p class="muted small" style="margin:12px 0">尚未建立標記類別。請先在圖表上方的「標記點」選單新增。</p>'}<button id="clear-mark" class="small">恢復預設標記</button><a href="#player/${encodeURIComponent(name)}" class="button primary menu-link">查看個人檔案</a>`;
    d.querySelector('.close').onclick=()=>d.close();d.querySelector('a').onclick=()=>{d.close();U.closeViewer();};
    const refresh=()=>{d.close();V.refreshComparisonCard(cardId);};
    d.querySelectorAll('[data-marker-choice]').forEach(btn=>btn.onclick=()=>{card.marks.set(name,btn.dataset.markerChoice);refresh();});d.querySelector('#clear-mark').onclick=()=>{const base=ensureDefaultMarker(card,B.state.engine.players(state.filter));card.marks.set(name,base.id);refresh();};if(!d.open)d.showModal();
  };
})(BB);
