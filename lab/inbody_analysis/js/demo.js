(function(B){
  'use strict';
  // Entirely synthetic names and values. This fixture contains known missing/invalid cases.
  B.Demo={sets(){
    const players=[['背號','姓名','外援','NAME','分級','位置','功能／角色','備註'],['18','示範投手甲','F','','一軍','投手','先發','合成測試資料'],['7','示範投手乙','F','','一軍','投手','中繼','合成測試資料'],['42','示範外援','T','DEMO PITCHER','二軍','投手','先發','英文姓名匹配'],['3','示範內野甲','F','','一軍','內野','重砲手',''],['26','示範外野甲','F','','二軍','外野','',''],['9','示範捕手甲','F','','一軍','捕手','',''],['66','示範工具人','F','','二軍','工具人','守備替補','自訂位置'],['00','示範無測量','F','','二軍','內野','','名單保留，沒有測量']];
    const seasons=[['賽季名稱','開始','結束'],['2024 上半季','2024-03','2024-06'],['2024 下半季','2024-07','2024-10'],['2025 上半季','2025-03','2025-06'],['2025 下半季','2025-07','2025-10'],['跨年準備期','2025-11','2026-02'],['2026 上半季','2026-03','2026-06'],['調整期','2026-06-15','2026-07-15'],['2026 下半季','2026-07','2026-10']];
    const body=[['name','analysis_date','weight','pbf','ffmi','smm','left_arm_impedance','ecw_ratio','custom_score','device_note']];
    for(let year=2024;year<=2026;year++)for(let month=1;month<=12;month++){
      if(year===2026&&month>8)continue;
      players.slice(1,8).forEach((p,i)=>{
        if((i===0&&year===2026&&month===7)||(i===2&&month%5===0))return;
        const repeats=i===0?3:1;
        for(let n=0;n<repeats;n++){
          const t=(year-2024)*12+month;
          body.push([i===2?' demo   pitcher ':p[1],`${year}-${String(month).padStart(2,'0')}-${n===0?'05':n===1?'05':'20'} 09:00:00`,+(75+i*2.9+t*.055+Math.sin(t+i)*.8+n*.4).toFixed(4),i===1&&month===6?'':+(13+i*.85+Math.cos(t+i)*.7).toFixed(4),+(20+i*.4+t*.025+Math.sin(t)*.17).toFixed(4),+(34+i*1.35+t*.05+Math.sin(t+i)*.3).toFixed(4),`${450+i*10}^${400+i*10}^${350+i*10}`,+(0.36+i*.002).toFixed(4),t===1?0:t*.75,'合成範例']);
        }
      });
    }
    body.push([...body[1]]); // exact duplicate
    body.push(['名單外測試','2026-08-20','77','14','21','36','400^350^300','.38','10','應排除']);
    body.push(['','2026-08-20','77','14','21','36','400^350^300','.38','10','空姓名']);
    body.push(['示範投手甲','2026-02-30','77','14','21','36','400^350^300','.38','10','錯誤日期']);
    body.push(['示範投手乙','2026-08-25','bad','','22','37','400^bad^300','.38','10','數值與阻抗格式警告']);
    return [B.Import.matrix(body,'合成測試_身體組成.csv','CSV'),B.Import.matrix(players,'合成測試_基本資料.xlsx','球員'),B.Import.matrix(seasons,'合成測試_基本資料.xlsx','賽季')];
  }};
})(BB);
