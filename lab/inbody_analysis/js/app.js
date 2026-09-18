(function(B){
  'use strict';
  B.activate=(data,preserveMarks=false)=>{if(data.schema!==B.SCHEMA)throw Error('本機快取版本不相容，請重新匯入來源檔。');B.prepareData(data);B.state.data=data;B.state.engine=new B.Engine(data);if(!preserveMarks)B.state.marks.clear();B.updateStatus();};
  B.setMeasurementDisabled=async(uid,disabled,memoryOnly=false)=>{
    const next=B.withMeasurementStatus(B.state.data,uid,disabled);
    if(!memoryOnly)await B.Cache.write(next);
    B.state.cacheOK=!memoryOnly;B.activate(next,true);
  };
  B.updateStatus=()=>{
    const d=B.state.data,badge=document.getElementById('data-badge'),status=document.getElementById('cache-status');
    badge.textContent=d?(d.metadata.demo?'合成示範 · ':'')+d.players.length+' 人 / '+d.rows.filter(r=>!r.disabled).length+' 筆使用中'+(d.rows.some(r=>r.disabled)?' / '+d.rows.filter(r=>r.disabled).length+' 筆停用':''):'尚未匯入';badge.classList.toggle('demo',!!d?.metadata.demo);
    status.textContent=B.state.cacheOK?'本機快取已保存':d?'本次頁面使用 · 尚未快取':'等待匯入資料';
  };
  B.route=()=>{
    const hash=location.hash.slice(1)||'home',[route,...parts]=hash.split('/');
    if(route==='main'){B.UI.main().focus();return;}
    B.state.route=route;document.querySelectorAll('[data-route]').forEach(el=>el.classList.toggle('active',el.dataset.route===route));
    const dialog=document.getElementById('player-menu');if(dialog.open)dialog.close();
    try{
      if(!B.state.data&&route!=='import'&&route!=='report'){B.Views.import();return;}
      if(route==='player')B.Views.player(decodeURIComponent(parts.join('/')));
      else if(B.Views[route])B.Views[route]();else B.Views.home();
      window.scrollTo({top:0,behavior:'instant'});
    }catch(e){B.UI.main().innerHTML=B.UI.empty('目前頁面無法完成分析',e.message);console.error(e);}
  };
  const start=async()=>{
    document.getElementById('sidebar-toggle').onclick=()=>{const collapsed=document.body.classList.toggle('sidebar-collapsed');document.getElementById('sidebar-toggle').setAttribute('aria-expanded',String(!collapsed));document.getElementById('sidebar-toggle').textContent=collapsed?'☰ 展開功能欄':'☰ 收合功能欄';B.UI.resizeCharts();};
    if(!window.Papa||!window.XLSX||!window.Plotly){B.UI.main().innerHTML='<div class="notice error">本機套件未載入。請完整解壓縮專案，確認 vendor 資料夾存在，再開啟 index.html。</div>';return;}
    let cacheError;
    try{const data=await B.Cache.read();if(data){B.state.cacheOK=true;B.activate(data);}}catch(e){cacheError=e.message;}
    B.updateStatus();B.route();if(cacheError)B.UI.toast('本機快取未載入：'+cacheError+'。仍可匯入檔案使用。');
    window.addEventListener('hashchange',B.route);
    window.addEventListener('unhandledrejection',event=>{B.UI.toast('操作未完成：'+(event.reason?.message||event.reason));});
  };
  start();
})(BB);
