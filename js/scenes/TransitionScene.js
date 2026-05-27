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
        // 🚀 【核心概念】：把下一個場景需要的「重度資源」或先前漏掉的素材放到這裡載入
        // 如果你的 GameScene 有大型地圖或音檔，可以改在這邊 load，它就會觸發真實進度。
        // （註：如果只是想當作純場景切換的緩衝動畫，仍維持 preload 監聽，但保留最底下的安全模擬機制）
        
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

        // 🔄 5. 【核心修復：監聽瀏覽器實際下載進度】
        // value 是一個從 0.0 到 1.0 的精準浮點數，代表瀏覽器目前加載該場景 preload 素材的真實進度
        this.load.on('progress', (value) => {
            this._drawProgressBar(W, H, value);
        });

        // 🔒 防掐斷鎖
        this.isTransitioning = false;
    }

    create() {
        // 當 preload 裡的真實資源全部「百分之百下載完畢」後，才會進入 create()
        const W = this.scale.width;
        const H = this.scale.height;

        // 確保進度條畫滿 100%
        this._drawProgressBar(W, H, 1);

        if (!this.isTransitioning) {
            this.isTransitioning = true;

            // 1. 停止文字抖動與粒子定時器
            this.glitchTimer.remove();

            // 2. 🚀 電影級等待：穩穩凝結 150 毫秒，等玩家看清 100% 滿格
            this.time.delayedCall(150, () => {
                
                // 3. 讓所有 Loading 元件優雅淡出
                this.tweens.add({
                    targets: [this.bgMask, this.particleGfx, this.progressGfx, this.loadTxt],
                    alpha: 0,
                    duration: 350,
                    ease: 'Power1.easeOut',
                    onComplete: () => {
                        // 4. 關閉粒子更新
                        this.particleUpdateTimer.remove();

                        // 5. 🚀 100% 下載完、動畫放完，正式安全開往目標場景
                        this.scene.start(this.nextScene, this.sceneData);

                        // 6. 深度內存釋放
                        this.particleGfx.destroy();
                        this.progressGfx.destroy();
                        this.loadTxt.destroy();
                        this.bgMask.destroy();
                    }
                });
            });
        }
    }

    // 繪製進度條的內部方法
    _drawProgressBar(W, H, progress) {
        if (!this.progressGfx || !this.progressGfx.active) return;
        this.progressGfx.clear();
        // 外襯底框
        this.progressGfx.lineStyle(1, 0x3d3470, 0.4);
        this.progressGfx.strokeRect(W / 2 - 160, H / 2, 320, 6);
        // 真實進度內條
        this.progressGfx.fillStyle(0x5fffb8, 0.9);
        this.progressGfx.fillRect(W / 2 - 160, H / 2 + 1, 320 * progress, 4);
    }
}
