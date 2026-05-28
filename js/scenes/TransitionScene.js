'use strict';

class TransitionScene extends Phaser.Scene {
    constructor() {
        super('TransitionScene');
    }

    init(data) {
        // 接收從前一個場景傳過來的：下一個要去哪裡
        this.nextScene = data.nextScene || 'GameScene';
        this.sceneData = data.data || {};
    }

    preload() {
        const W = this.scale.width;
        const H = this.scale.height;

        // 🖤 1. 建立一片純黑底色遮罩
        this.bgMask = this.add.rectangle(W / 2, H / 2, W, H, 0x0c0c22).setOrigin(0.5).setDepth(1);

        // 🟢 2. 建立粒子與進度條繪圖層
        this.particleGfx = this.add.graphics().setDepth(2);
        this.progressGfx = this.add.graphics().setDepth(3);

        // 初始化 40 個粒子數據
        this.particles = [];
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random() * W,
                y: Math.random() * H + H * 0.5,
                size: Math.random() * 4 + 2,
                speedY: -(Math.random() * 1.2 + 0.4),
                alpha: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.4 ? 0x5fffb8 : 0x6c5fff
            });
        }

        // ⚪ 3. 建立故障風 LOADING... 文字
        this.loadTxt = this.add.text(W / 2, H / 2 - 35, 'LOADING...', {
            fontSize: '26px', fontFamily: 'Arial Black', fontWeight: '900', fill: '#ffffff', letterSpacing: 4
        }).setOrigin(0.5).setDepth(4);
        this.loadTxt.setShadow(0, 0, '#5fffb8', 12, true, true);

        // 💥 4. 文字 Glitch 定時器
        this.glitchTimer = this.time.addEvent({
            delay: 350,
            callback: () => {
                if (Math.random() > 0.55) {
                    this.loadTxt.x = W / 2 + (Math.random() * 10 - 5);
                    this.loadTxt.setStyle({ fill: Math.random() > 0.5 ? '#5fffb8' : '#6c5fff' });
                    this.time.delayedCall(70, () => {
                        this.loadTxt.x = W / 2;
                        this.loadTxt.setStyle({ fill: '#ffffff' });
                    });
                }
            },
            loop: true
        });

        // 每幀更新粒子上飄的輔助定時器
        this.particleUpdateTimer = this.time.addEvent({
            delay: 16,
            callback: () => {
                this.particleGfx.clear();
                this.particles.forEach(p => {
                    p.y += p.speedY;
                    if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
                    this.particleGfx.fillStyle(p.color, p.alpha);
                    this.particleGfx.fillRect(p.x, p.y, p.size, p.size);
                });
            },
            loop: true
        });

        // 🔄 5. 【真實進度監聽核心】
        this.load.on('progress', (value) => {
            this._drawProgressBar(W, H, value);
        });

        // 🔒 防掐斷鎖
        this.isTransitioning = false;

        // =================================================================
        // 🚀 【資源大搬家】把重度載入素材移到此處，進度條才會跟著它們的讀取進度走
        // =================================================================
        this.load.image('map',        'assets/map.png');
        this.load.image('stage',      'assets/stage.png');
        this.load.image('tree1',      'assets/tree1.png');
        this.load.image('tree2',      'assets/tree2.png');
        this.load.image('cocona',     'assets/cocona.png');
        this.load.image('sign',       'assets/sign.png');
        this.load.image('crab',       'assets/crab.png');
        this.load.image('cord',       'assets/cord.png');
        this.load.image('bunny',      'assets/bunny.png');
        this.load.image('mailbox',    'assets/mailbox.png');
        this.load.image('btn_idle',   'assets/btn_idle.png');
        this.load.image('btn_active', 'assets/btn_active.png');
        this.load.image('sun',        'assets/sun.png');
        this.load.image('buttle',     'assets/buttle.png');
        this.load.image('card',       'assets/card.png');
        
        // 🎬 序列幀動畫
        this.load.spritesheet('wave',   'assets/wave.png',   { frameWidth: 2000, frameHeight: 1240 });
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
        
        // 🎵 音樂大檔案
        this.load.audio('bgm_game', './assets/bgm.mp3');
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // 確保進度條最後百分之百畫滿
        this._drawProgressBar(W, H, 1);

        if (!this.isTransitioning) {
            this.isTransitioning = true;

            // 1. 停止文字抖動
            this.glitchTimer.remove();

            // 2. 🚀 電影級凝結：穩穩在 100% 停頓 150 毫秒，給玩家眼睛看清楚加載完畢
            this.time.delayedCall(150, () => {
                
                // 3. 所有過場 UI 平滑淡出
                this.tweens.add({
                    targets: [this.bgMask, this.particleGfx, this.progressGfx, this.loadTxt],
                    alpha: 0,
                    duration: 350,
                    ease: 'Power1.easeOut',
                    onComplete: () => {
                        // 4. 關閉粒子定時器
                        this.particleUpdateTimer.remove();

                        // 5. 🚀 100% 載入好、動畫播完，安全開往 GameScene
                        this.scene.start(this.nextScene, this.sceneData);

                        // 6. 釋放網頁內存
                        this.particleGfx.destroy();
                        this.progressGfx.destroy();
                        this.loadTxt.destroy();
                        this.bgMask.destroy();
                    }
                });
            });
        }
    }

    // 內部繪製進度條方法
    _drawProgressBar(W, H, progress) {
        if (!this.progressGfx || !this.progressGfx.active) return;
        this.progressGfx.clear();
        // 外框
        this.progressGfx.lineStyle(1, 0x3d3470, 0.4);
        this.progressGfx.strokeRect(W / 2 - 160, H / 2, 320, 6);
        // 霓虹綠進度內條
        this.progressGfx.fillStyle(0x5fffb8, 0.9);
        this.progressGfx.fillRect(W / 2 - 160, H / 2 + 1, 320 * progress, 4);
    }
}
