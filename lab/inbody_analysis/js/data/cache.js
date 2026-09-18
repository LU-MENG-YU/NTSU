(function (B) {
  'use strict';
  // One atomic snapshot. UI preferences and color marks never enter this store.
  const open = () => new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(Error('瀏覽器不提供 IndexedDB'));return;}
    const req=indexedDB.open('baseball-body-local-v1',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('本機資料庫被其他頁面占用，請關閉其他分頁後重試。'));
  });
  B.Cache={
    async read(){const db=await open();try{return await new Promise((res,rej)=>{const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('current');r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);});}finally{db.close();}},
    async write(data){const db=await open();try{await new Promise((res,rej)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(data,'current');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('快取交易中止'));});}finally{db.close();}},
    async clear(){const db=await open();try{await new Promise((res,rej)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').delete('current');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}finally{db.close();}}
  };
})(BB);
