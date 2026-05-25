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

     8. main.js                 ← Phaser 初始化（本檔）
================================================================ */
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 960,
    height: 540,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
    scene: [
        StartScene,
        GameScene,
        MusicScene,
        CalibrationScene,
        
    ],
};

new Phaser.Game(config);


