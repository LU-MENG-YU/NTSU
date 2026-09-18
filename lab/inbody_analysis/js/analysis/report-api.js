(function(B){
  'use strict';
  // Phase 2 extension boundary: report adapters receive the SAME engine and chart builders.
  B.Reports={version:1,available:false,createContext:()=>({engine:B.state.engine,charts:B.Charts,players:B.state.data?.players,seasons:B.state.data?.seasons}),async generate(){throw Error('年度報告屬第二階段，尚未啟用。');},async exportPPTX(){throw Error('PPTX 匯出屬第二階段，尚未啟用。');}};
})(BB);
