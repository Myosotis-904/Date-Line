'use strict';

class TransitionScene extends Phaser.Scene {
    constructor() {
        super('TransitionScene');
    }

    init(data) {
        // 接收從別的場景傳過來的「下一個要去哪裡」的參數
        this.nextScene = data.nextScene || 'GameScene';
        this.sceneData = data.data || {};
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // 🖤 1. 建立一片純黑底色遮罩，擋住後面的地圖
        const bgMask = this.add.rectangle(W / 2, H / 2, W, H, 0x0c0c22).setOrigin(0.5);

        // 🟢 2. 建立粒子繪圖層 (在最底層漂浮)
        const particleGfx = this.add.graphics();
        const particles = [];
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H + H * 0.5,
                size: Math.random() * 4 + 2,
                speedY: -(Math.random() * 1.2 + 0.4),
                alpha: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.4 ? 0x5fffb8 : 0x6c5fff
            });
        }

        // 🟣 3. 建立進度條繪圖層
        const progressGfx = this.add.graphics();

        // ⚪ 4. 建立故障風 LOADING... 提示文字
        const loadTxt = this.add.text(W / 2, H / 2 - 35, 'LOADING...', {
            fontSize: '26px', 
            fontFamily: 'Arial Black', 
            fontWeight: '900', 
            fill: '#ffffff',
            letterSpacing: 4
        }).setOrigin(0.5);
        loadTxt.setShadow(0, 0, '#5fffb8', 12, true, true);

        // 💥 5. 文字的科技故障風 (Glitch) 定時補間
        const glitchTimer = this.time.addEvent({
            delay: 350,
            callback: () => {
                if (Math.random() > 0.55) {
                    loadTxt.x = W / 2 + (Math.random() * 10 - 5);
                    loadTxt.setStyle({ fill: Math.random() > 0.5 ? '#5fffb8' : '#6c5fff' });
                    this.time.delayedCall(70, () => {
                        loadTxt.x = W / 2;
                        loadTxt.setStyle({ fill: '#ffffff' });
                    });
                }
            },
            loop: true
        });

        // 🔄 6. 平滑模擬計時器
        let fakeProgress = 0;
        const processTimer = this.time.addEvent({
            delay: 16,
            callback: () => {
                fakeProgress += 0.02; // 控制 Loading 跑的速度（0.02 大約 0.8 秒跑完）
                if (fakeProgress > 1) fakeProgress = 1;

                // 更新粒子向上漂浮
                particleGfx.clear();
                particles.forEach(p => {
                    p.y += p.speedY;
                    if (p.y < -10) {
                        p.y = H + 10;
                        p.x = Math.random() * W;
                    }
                    particleGfx.fillStyle(p.color, p.alpha);
                    particleGfx.fillRect(p.x, p.y, p.size, p.size);
                });

                // 繪製模擬進度條
                progressGfx.clear();
                progressGfx.lineStyle(1, 0x3d3470, 0.4);
                progressGfx.strokeRect(W / 2 - 160, H / 2, 320, 6);
                progressGfx.fillStyle(0x5fffb8, 0.9);
                progressGfx.fillRect(W / 2 - 160, H / 2 + 1, 320 * fakeProgress, 4);

                // 🎉 進度全滿，切換場景並優雅淡出
                if (fakeProgress >= 1) {
                    processTimer.remove();
                    glitchTimer.remove();

                    // 🚀 關鍵點：在這裡啟動下一個目標場景！
                    this.scene.start(this.nextScene, this.sceneData);

                    // 同時讓 Loading 的元件淡出
                    this.tweens.add({
                        targets: [bgMask, particleGfx, progressGfx, loadTxt],
                        alpha: 0,
                        duration: 350,
                        onComplete: () => {
                            // 徹底釋放記憶體
                            particleGfx.destroy();
                            progressGfx.destroy();
                            loadTxt.destroy();
                            bgMask.destroy();
                        }
                    });
                }
            },
            loop: true
        });
    }
}
