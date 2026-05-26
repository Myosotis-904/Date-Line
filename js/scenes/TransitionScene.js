'use strict';

/* ================================================================
   TransitionScene — 全局海洋藍色調 Loading 過場畫面
================================================================ */
class TransitionScene extends Phaser.Scene {
    constructor() {
        super('TransitionScene');
    }

    init(data) {
        // 接收要前往的目標場景 Key
        this.nextScene = data.nextScene;
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        // 🌊 1. 設置深邃海夜藍背景底色
        this.add.rectangle(0, 0, W, H, 0x0c0c22).setOrigin(0);

        // 🌊 2. 水藍色 (0x5fb8ff) 的載入中提示文字與海洋 emoji
        const loadingText = this.add.text(W / 2, H / 2, '🌊 穿越換日線中…', {
            fontSize: '22px',
            fill: '#5fb8ff',
            fontFamily: "'Noto Sans TC', 'monospace'",
            letterSpacing: 4,
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // 🌊 3. 為文字加上流暢的波浪呼吸（淡入淡出）動畫，讓玩家知道網頁正常運作中
        this.tweens.add({
            targets: loadingText,
            alpha: 0.25,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 🌊 4. 漸暗淡出並流暢轉場（強制停留 0.8 秒提供讀取緩衝）
        this.time.delayedCall(800, () => {
            this.cameras.main.fadeOut(250, 12, 12, 34); // 漸暗至深海色
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start(this.nextScene);
            });
        });
    }
}