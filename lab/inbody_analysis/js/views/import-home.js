(function(B){
  'use strict';
  const U=B.UI,V=B.Views=B.Views||{};
  const queue=new B.Import.FileQueue();let staged=[],pending=null,parsedRevision=-1,busy=false;
  const fieldLabels={number:'背號',name:'姓名／名稱',analysis_date:'測量日期',weight:'體重',pbf:'體脂率',ffmi:'FFMI',smm:'骨骼肌',foreign:'外援',english:'英文 NAME',level:'分級',position:'位置',role:'角色／功能',note:'備註',start:'開始',end:'結束'};
  const invalidate=()=>{staged=[];pending=null;parsedRevision=-1;};
  V.resetImport=()=>{queue.clear();invalidate();};
  const valueCell=value=>`<span class="raw-value">${B.esc(B.clean(value)||'（空白）')}</span>`;
  V.problemFields=r=>r.problemFields||Object.fromEntries(Object.entries(r.raw||{}).filter(([k])=>/^(name|姓名|analysis_date|測量日期|analysis_time)$/.test(k)));
  V.import=()=>{
    U.clear();const data=B.state.data;
    U.main().innerHTML=U.heading('DATA / IMPORT','資料匯入與驗證','可分次加入檔案；讀取後先核對內容，再套用完整新資料。',data?'<a href="#home" class="button">返回首頁</a>':'')+`
      <div class="upload-grid"><section class="panel control-panel"><div class="panel-title"><h2>選取本機資料</h2><span class="badge">CSV / XLSX / XLS</span></div><p class="muted small">可以先加入身體組成檔，再加入基本資料檔。同一 Excel 只需加入一次，所有工作表會一起讀取。</p>
      <label class="file-label" for="files">＋ 加入檔案（可分次選取）</label><input id="files" type="file" accept=".csv,.xlsx,.xls" multiple aria-label="加入來源檔案" ${busy?'disabled':''}>
      <div id="queued-files">${queue.files.length?`<div class="queue-heading">待讀取 ${queue.files.length} 個檔案 <button id="queue-clear" class="small">移除全部</button></div>${queue.files.map((f,i)=>`<div class="queued-file"><div><strong>${B.esc(f.name)}</strong><small>${(f.size/1024).toFixed(1)} KB · 修改 ${B.esc(new Date(f.lastModified).toLocaleString('zh-TW',{hour12:false}))}</small></div><button class="small" data-remove-file="${i}" aria-label="移除 ${B.esc(f.name)}">移除</button></div>`).join('')}`:'<p class="muted small" style="padding:14px 0">尚未加入檔案。</p>'}</div>
      <p class="muted small">同名檔案再次加入時會取代待匯入版本。修改原始檔後，請重新選取該檔案，再按「讀取全部檔案」。</p>
      <div class="toolbar secondary">${U.select('encoding','CSV 文字編碼',[{value:'auto',label:'自動（UTF-8 / Big5）'},{value:'utf-8',label:'UTF-8'},{value:'big5',label:'Big5'}],'auto')}<button id="read-files" class="primary" ${busy?'disabled':''}>讀取全部檔案</button></div><div id="import-error" role="alert"></div><div id="import-busy"></div></section>
      <section class="panel"><h2>需要的資料</h2><div class="upload-steps"><div class="step"><span>A</span><div>身體組成<small>姓名、測量日期，以及原始身體組成欄位。</small></div></div><div class="step"><span>B</span><div>球員基本資料<small>背號、姓名、外援 T/F、分級、位置。外援須有 NAME。</small></div></div><div class="step"><span>C</span><div>賽季資料<small>賽季名稱、開始、結束。可在基本資料 Excel 的另一個工作表。</small></div></div></div><div class="notice">只有基本資料名單中的球員納入分析。</div><div class="actions"><button id="demo-data" class="small">載入合成示範資料</button><button id="templates" class="small">下載空白範本 XLSX</button></div></section></div>
      ${staged.length?`<section class="panel"><div class="panel-title"><h2>工作表辨識與欄位對應</h2><span class="badge">已讀取 ${staged.length} 張工作表</span></div>${staged.map((s,i)=>`<div class="sheet-row"><div class="toolbar"><div style="flex:2;min-width:160px"><strong>${B.esc(s.file)} / ${B.esc(s.sheet)}</strong><p class="muted small">${s.rows.length} 列 · ${s.headers.length} 欄${s.fileInfo?` · 內容識別 ${s.fileInfo.fingerprint}`:''}</p></div>${U.select('sheet-'+i,'資料類型',[{value:'unknown',label:'請手動指定'},{value:'body',label:'身體組成'},{value:'players',label:'球員基本資料'},{value:'seasons',label:'賽季資料'},{value:'ignore',label:'忽略此工作表'}],s.type)}</div>${B.Import.schemas[s.type]?`<details><summary class="small">檢查／調整欄位對應</summary><div class="mapping">${Object.keys(B.Import.schemas[s.type]).map(k=>U.select(`map-${i}-${k}`,`${fieldLabels[k]||k}${B.Import.required[s.type].includes(k)?' *':''}`,[{value:'',label:'未指定'},...s.headers],s.map[k])).join('')}</div></details>`:''}</div>`).join('')}<div class="actions"><button id="validate-data" class="primary">驗證與姓名匹配</button><span class="small muted">尚未覆蓋現有資料</span></div></section>`:''}
      ${pending?V.importReport(pending,true):data?V.importReport(data,false):''}`;
    U.bind('files','change',()=>{if(busy)return;const files=[...document.getElementById('files').files];if(!files.length)return;queue.add(files);invalidate();V.import();});
    U.main().querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{if(busy)return;queue.remove(Number(b.dataset.removeFile));invalidate();V.import();});
    U.bind('queue-clear','click',()=>{if(busy)return;V.resetImport();V.import();});
    U.bind('read-files','click',async()=>{
      if(busy)return;if(!queue.files.length){U.toast('請先加入來源檔案。');return;}
      const revision=queue.revision;invalidate();busy=true;document.getElementById('read-files').disabled=true;document.getElementById('files').disabled=true;document.getElementById('import-busy').innerHTML='<p class="progress">正在重新讀取選取的所有檔案…</p>';
      document.getElementById('apply-data')?.setAttribute('disabled','');
      try{const result=await B.Import.load([...queue.files],U.val('encoding'));if(revision!==queue.revision)return;staged=result;parsedRevision=revision;busy=false;V.import();}
      catch(e){busy=false;V.import();document.getElementById('import-error').innerHTML=`<div class="notice error">${B.esc(e.message)}<br>若剛修改原始檔，請重新選取該檔案後再讀取。</div>`;}
      finally{busy=false;}
    });
    staged.forEach((s,i)=>{U.bind('sheet-'+i,'change',()=>{s.type=U.val('sheet-'+i);s.map=B.Import.mapping(s.headers,s.type);pending=null;V.import();});for(const k of Object.keys(s.map))U.bind(`map-${i}-${k}`,'change',()=>{s.map[k]=U.val(`map-${i}-${k}`);pending=null;document.getElementById('apply-data')?.setAttribute('disabled','');});});
    U.bind('validate-data','click',()=>{if(busy)return;try{if(parsedRevision!==queue.revision)throw Error('檔案已變更，請重新讀取。');pending=B.preserveMeasurementStatus(B.Import.normalize(staged),B.state.data);V.import();document.getElementById('report-summary')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){pending=null;document.getElementById('import-error').innerHTML=`<div class="notice error">${B.esc(e.message)}<br>目前資料未變更。</div>`;document.getElementById('import-error').scrollIntoView();}});
    U.bind('demo-data','click',()=>{if(busy)return;V.resetImport();staged=B.Demo.sets();parsedRevision=queue.revision;pending=B.Import.normalize(staged,{demo:true});V.import();document.getElementById('report-summary').scrollIntoView({block:'start'});});
    U.bind('templates','click',()=>{const wb=XLSX.utils.book_new();for(const [name,headers] of [['球員',['背號','姓名','外援','NAME','分級','位置','功能／角色','備註']],['賽季',['賽季名稱','開始','結束']],['身體組成',['name','analysis_date','weight','pbf','ffmi','smm','left_arm_impedance']]])XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers]),name);XLSX.writeFile(wb,'匯入範本.xlsx');});
    U.bind('apply-data','click',async()=>{
      if(busy||!pending?.rows.length||parsedRevision!==queue.revision)return;
      const next=pending;busy=true;const btn=document.getElementById('apply-data');btn.disabled=true;
      const activate=()=>{B.activate(next);V.resetImport();busy=false;if(location.hash==='#home')B.route();else location.hash='home';};
      try{await B.Cache.write(next);B.state.cacheOK=true;activate();}
      catch(e){busy=false;btn.disabled=false;document.getElementById('cache-error').innerHTML=`<div class="notice error">無法寫入本機快取：${B.esc(e.message)}。<button id="memory-only" class="small">僅在本次頁面使用新資料</button></div>`;U.bind('memory-only','click',()=>{B.state.cacheOK=false;activate();});}
    });
    U.bind('clear-cache','click',()=>{
      if(busy)return;
      const dialog=document.createElement('dialog');dialog.id='clear-data-dialog';dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','clear-title');
      dialog.innerHTML='<h2 id="clear-title">清除本機資料？</h2><p class="muted small" style="margin:16px 0">目前分析資料、停用標記與待匯入檔案清單將一併清除。電腦上的來源檔案不會刪除。</p><div class="actions"><button data-cancel>取消</button><button class="danger" data-confirm>確認清除</button></div><p data-error role="alert"></p>';
      document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      dialog.querySelector('[data-confirm]').onclick=async()=>{busy=true;dialog.querySelector('[data-confirm]').disabled=true;try{await B.Cache.clear();V.resetImport();B.state.data=null;B.state.engine=null;B.state.cacheOK=false;B.state.marks.clear();B.updateStatus();dialog.close();busy=false;V.import();U.toast('已清除資料，請重新選取修改後的來源檔案。');}catch(e){busy=false;dialog.querySelector('[data-confirm]').disabled=false;dialog.querySelector('[data-error]').textContent='清除失敗：'+e.message;}};
      dialog.showModal();
    });
    U.bind('validation-csv','click',()=>B.Charts.csv((pending||data).metadata.report.issues,'匯入驗證明細.csv'));
    U.bind('excluded-csv','click',()=>{const d=pending||data;B.Charts.csv(d.metadata.report.excluded.map(r=>({來源檔:r.source.file,工作表:r.source.sheet,列:r.source.row,排除原因:r.reason,...V.problemFields(r)})),'排除紀錄.csv');});
    U.flushCharts();
  };
  V.importReport=(data,canApply)=>{
    const r=data.metadata.report,totalIssues=Object.values(r.counts).reduce((a,b)=>a+b,0);
    const signature=row=>JSON.stringify(Object.keys(row.raw).sort().map(k=>[k,row.raw[k]]));
    let diff='';if(canApply&&B.state.data){const old=new Set(B.state.data.rows.map(signature)),next=new Set(data.rows.map(signature));const added=[...next].filter(k=>!old.has(k)).length,removed=[...old].filter(k=>!next.has(k)).length;diff=`與目前資料相比：新增 ${added} 筆、移除 ${removed} 筆、內容相同 ${next.size-added} 筆。`;}
    const impedance=data.registry.filter(m=>m.parent&&m.band===1).map(m=>{const good=data.rows.filter(r=>[1,2,3].every(i=>B.valid(r.values[m.parent+'_'+i]))).length;const first=data.rows.find(r=>B.valid(r.values[m.parent+'_1']));return [B.esc(m.parent),good,data.rows.length-good,first?[1,2,3].map(i=>B.fmt(first.values[m.parent+'_'+i])).join(' / '):'—'];});
    return `<section id="report-summary" class="panel"><div class="panel-title"><h2>${canApply?'驗證結果 · 待套用':'目前資料的匯入結果'}</h2>${data.metadata.demo?'<span class="badge demo">合成示範資料</span>':''}</div>${U.stats([{label:'原始測量列',value:r.total},{label:'納入資料集',value:r.included},{label:'排除紀錄',value:r.excluded.length,foot:`其中 ${r.duplicates} 列完全重複`},{label:'名單球員',value:data.players.length}])}
      <p class="muted small">${data.registry.length} 個可分析指標 · ${data.seasons.length} 個賽季 · ${totalIssues} 項提示 · 本機停用 ${data.rows.filter(x=>x.disabled).length} 筆。</p>
      ${canApply?`<div class="notice ${data.rows.length?'success':'error'}">${data.rows.length?'驗證完成。套用後會完整替換測量資料；內容完全相同的測量保留停用標記，已修改內容則視為新測量。':'沒有可分析資料，請修正來源檔。現有資料不變。'}${diff?'<br>'+diff:''}</div><button id="apply-data" class="primary" ${data.rows.length&&!busy?'':'disabled'}>套用資料並進入首頁</button><div id="cache-error"></div>`:`<div class="actions" style="margin-top:16px"><button id="clear-cache" class="danger small">清除本機快取與待匯入資料</button></div>`}
      <details class="validation-section"><summary>來源版本與讀取時間</summary>${U.table(['檔案／工作表','測量／名單列數','內容識別','讀取時間'],data.metadata.sources.map(s=>[B.esc(s.file+' / '+s.sheet),s.rows,B.esc(s.fingerprint||'示範／舊版'),B.esc(new Date(s.readAt||data.metadata.importedAt).toLocaleString('zh-TW',{hour12:false}))]))}</details>
      ${impedance.length?`<details class="validation-section"><summary>阻抗解析概況（${impedance.length} 個區段）</summary><p class="small muted">僅計算納入資料集的測量。三波段依來源順序，未假設頻率；此欄缺失不會排除整筆測量。</p>${U.table(['區段','成功列数','缺失／格式錯誤列數','首筆成功值：波段 1 / 2 / 3'],impedance)}</details>`:''}
      <details class="validation-section"><summary>排除紀錄（${r.excluded.length}）</summary><p class="small muted">只顯示導致排除的欄位。完全重複列顯示測量資訊供定位；畫面前 200 列，CSV 包含全部排除紀錄。</p><button id="excluded-csv" class="small">下載排除紀錄 CSV</button>${U.table(['來源','列','原因','原因相關欄位'],r.excluded.slice(0,200).map(x=>[B.esc(x.source.file+' / '+x.source.sheet),x.source.row,B.esc(x.reason),Object.entries(V.problemFields(x)).map(([k,v])=>`<div class="problem-field"><b>${B.esc(k)}</b> ${valueCell(v)}</div>`).join('')]))}</details>
      <details class="validation-section"><summary>缺值與驗證明細（${totalIssues}）</summary><p class="small muted">畫面前 200 項，CSV 最多 5,000 項；原始值與無法解析的原因直接列出。${Object.entries(r.counts).map(([k,v])=>B.esc(k)+': '+v).join(' · ')}</p><button id="validation-csv" class="small">下載驗證明細 CSV</button>${U.table(['來源','列','欄位','原始值','提示'],r.issues.slice(0,200).map(x=>[B.esc((x.file||'')+' / '+(x.sheet||'')),x.row||'—',B.esc(x.field),valueCell(x.rawValue),`<span class="problem-field">${B.esc(x.message)}</span>`]))}</details></section>`;
  };
  V.home=()=>{
    U.clear();const data=B.state.data,e=B.state.engine;
    if(!data){V.import();return;}
    const r=data.metadata.report;
    U.main().innerHTML=U.heading('OVERVIEW','球隊資料總覽',`測量期間 ${e.min} ～ ${e.max}`,`<a class="button" href="#import">重新載入資料</a>`)+
      (data.metadata.version!==B.VERSION?'<div class="notice warning">目前使用舊版解析的快取。請<a href="#import">重新匯入來源檔</a>，讓新版阻抗解析與驗證結果生效。</div>':'')+
      (data.metadata.demo?'<div class="notice warning">目前使用合成示範資料，可安全測試所有分析與匯出功能。</div>':'')+
      U.stats([{label:'目前球員名單',value:data.players.length,unit:'人'},{label:'使用中測量',value:data.rows.filter(r=>!r.disabled).length,unit:'筆',foot:'全部 '+data.rows.length+' 筆 · 停用 '+data.rows.filter(r=>r.disabled).length+' 筆'},{label:'最新測量月份',value:e.max.slice(0,7)},{label:'可分析指標',value:data.registry.length,unit:'項'}])+`
      <div class="entry-grid"><a class="entry" href="#team"><div class="eyebrow">TEAM</div><h2>團隊分析 →</h2><p>檢視月份趨勢與跨年度比較</p></a><a class="entry" href="#comparison"><div class="eyebrow">COMPARISON</div><h2>個人分析 →</h2><p>球員比較、四象限與移動軌跡</p></a><a class="entry" href="#report"><div class="eyebrow">PHASE 2</div><h2>年度報告</h2><p>模組介面已保留，後續功能</p></a></div>
      <section class="panel"><div class="panel-title"><h2>目前資料狀態</h2><a href="#import" class="small">查看驗證結果 →</a></div><div class="status-grid"><div>身體組成資料<strong>已載入 · ${r.included} 筆</strong></div><div>基本資料<strong>已載入 · ${data.players.length} 人</strong></div><div>賽季資料<strong>${data.seasons.length?'已載入 · '+data.seasons.length+' 個區間':'未提供'}</strong></div></div><p class="muted small" style="margin-top:15px">最後更新：${B.esc(new Date(data.metadata.importedAt).toLocaleString('zh-TW',{hour12:false}))} · 排除 ${r.excluded.length} 列</p></section>
      <div class="panel-title"><h2>球員名單</h2><span class="muted small">依目前分級與位置 · 點姓名查看個人檔案</span></div><div class="roster-grid">${B.levels(data.players).map(level=>{const people=data.players.filter(p=>p.level===level);return `<section class="panel"><div class="panel-title"><h2>${B.esc(level)}</h2><span class="badge">${people.length} 人</span></div>${B.positions(data.players).map(position=>{const ps=B.sortPlayers(people.filter(p=>p.position===position));return ps.length?`<div class="roster-group"><div class="position-label">${B.esc(position)}</div><div class="player-list">${ps.map(p=>`<a class="player-link" href="#player/${encodeURIComponent(p.name)}"><span class="jersey">${B.esc(p.number)}</span>${B.esc(p.name)}</a>`).join('')}</div></div>`:'';}).join('')||'<p class="muted small">目前名單無此分級球員。</p>'}</section>`;}).join('')}</div>`;
    U.flushCharts();
  };
  V.report=()=>{U.clear();U.main().innerHTML=U.heading('REPORT / PHASE 2','年度報告','年度報告與 PPTX 匯出保留擴充介面。')+'<div class="panel empty"><h2>年度報告將在下一階段加入</h2><p>目前可從各分析頁下載 PNG、SVG 及對應 CSV，製作報告素材。</p><div class="actions"><a class="button primary" href="#team">前往團隊分析</a><a class="button" href="#comparison">前往球員比較</a></div></div>';U.flushCharts();};
})(BB);
