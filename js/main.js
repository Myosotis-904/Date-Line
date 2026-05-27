'use strict';

/* ================================================================
   main.js — Phaser 遊戲入口

   檔案載入順序（在 index.html 中依序引入）：
     1. systems/config.js       ← 常數、API、地標資料、MUSIC_CFG
     2. systems/utils.js        ← SafeStorage、GSheets、PlayerState
     3. scenes/StartScene.js    ← 標題場景
     4. scenes/GameScene.js     ← 主探索場景
     5. scenes/MusicScene.js    ← 音樂節奏遊戲
     6. scenes/CalibrationScene.js ← 音訊校準
     7. scenes/TransitionScene.js  ← 🌟 全局 Loading 過場場景
     8. main.js                 ← Phaser 初始化（本檔）
================================================================ */
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 960,
    height: 540,
    backgroundColor: '#0c0c22', 

    // 🚀 【補上：核心網頁渲染優化】徹底解決走路卡頓、圖片邊緣毛邊
    render: {
        antialias: true,             // 開啟抗鋸齒
        roundPixels: true,           // 🚀 強制座標對齊整數像素，封鎖畫面微幅抖動
        powerPreference: 'high-performance' // 強制瀏覽器調用高效能 GPU
    },

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
    scene: [
        StartScene,       // 👈 預設遊戲第一個主畫面（若要一開網頁就讀條，請跟 TransitionScene 互換位置）
        GameScene,
        MusicScene,
        CalibrationScene,
        TransitionScene   
    ],
};

new Phaser.Game(config);
