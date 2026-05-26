'use strict';

/* ================================================================
   StartScene — 標題畫面（整合：iOS 橫螢幕滾動驅逐工具列、音訊硬體激醒、精美公告彈窗）
================================================================ */
class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }

    preload() {
        this.load.image('start_bg', 'assets/start_bg.png');
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        this.add.image(W/2 - 5, H/2, 'start_bg').setDisplaySize(W, H);

        this.add.text(W / 2, H * 0.578, 'D A T E L I N E', {
            fontSize: '13px', fill: '#3d3470', fontFamily: 'monospace', letterSpacing: 7,
        }).setOrigin(0.5);

        const hint = this.add.text(W / 2, H * 0.75, '觸碰或按任意鍵開始', {
            fontSize: '20px', fill: '#a5e8ff',
            fontFamily: "'Noto Sans TC', monospace", letterSpacing: 3,
        }).setOrigin(0.5);

        this.tweens.add({
            targets: hint, alpha: 0.15, duration: 900,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // 封裝核心激醒優化邏輯，確保滑鼠點擊或鍵盤按下都能同時觸發
        const handleStartTrigger = () => {
            // 清除另一個還沒被觸發的監聽器，避免重複執行
            this.input.off('pointerdown', handleStartTrigger);
            if (this.input.keyboard) {
                this.input.keyboard.off('keydown', handleStartTrigger);
            }

            // 📱 【核心優化：嘗試調用全螢幕 API（安卓裝置在此處會直接進入完美全螢幕）】
            try {
                let docElm = document.documentElement;
                if (docElm.requestFullscreen) docElm.requestFullscreen();
                else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen();
            } catch (e) {}

            // 🎵 【低延遲 Web Audio 核心硬體激醒】
            if (this.sound.context) {
                this.sound.context.resume().then(() => {
                    let buffer = this.sound.context.createBuffer(1, 1, 22050);
                    let source = this.sound.context.createBufferSource();
                    source.buffer = buffer;
                    source.connect(this.sound.context.destination);
                    source.start(0);
                }).catch(() => {});
            }

            // 隱藏閃爍的提示文字
            hint.destroy();

            // 🎬 呼叫並彈出公告視窗
            this._showNoticeModal(W, H);
        };

        // 同時監聽觸控/滑鼠點擊，以及鍵盤任意鍵按下
        this.input.once('pointerdown', handleStartTrigger);
        this.input.keyboard.once('keydown', handleStartTrigger);
    }

    // ================================================================
    // ✨ 精美公告系統 — 整合「橫螢幕自動滾動隱藏工具列」機制
    // ================================================================
    _showNoticeModal(W, H) {
        // 建立元件容器，方便最後一鍵淡出
        const modalContainer = this.add.container(0, 0).setDepth(1000).setAlpha(0);

        // 黑色半透明背景遮罩
        const mask = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.65);
        modalContainer.add(mask);

        // 公告視窗主體外框與底色 (霓虹深紫底、亮紫邊框)
        const dialogW = W * 0.72;
        const dialogH = H * 0.68;
        const bgRect = this.add.rectangle(W/2, H/2, dialogW, dialogH, 0x0f0f22, 0.95)
            .setStrokeStyle(2, 0x6c5fff, 0.8);
        modalContainer.add(bgRect);

        // 科技感裝飾用亮綠色邊角流光線 (左上與右下)
        const deco1 = this.add.rectangle(W/2 - dialogW/2 + 10, H/2 - dialogH/2 + 2, 40, 3, 0x5fffb8);
        const deco2 = this.add.rectangle(W/2 - dialogW/2 + 2, H/2 - dialogH/2 + 10, 3, 40, 0x5fffb8);
        modalContainer.add([deco1, deco2]);

        // 公告標題：INFORMATION
        const titleTxt = this.add.text(W/2, H/2 - dialogH/2 + 30, 'INFORMATION', {
            fontSize: '22px', fontFamily: 'Arial Black', fontWeight: '900', fill: '#5fffb8', letterSpacing: 2
        }).setOrigin(0.5);
        titleTxt.setShadow(0, 0, '#5fffb8', 8, true, true);
        modalContainer.add(titleTxt);

               // ── 📝 遊戲資訊內文 ──

        const newsLines = [
                    '【 換日線 DATELINE - 專案公告 】',
                    '',
                    '✨ 歡迎來到雄女第 78 屆畢業典禮特設互動網站！',
                    '📢 [重要提示] 建議保持在橫螢幕狀態下遊玩。',
                    ' ',
                    '[更新公告]  重新處理了音遊相關的問題與畫面優化。',

                    '                  新增了場景切換動畫，卡頓問題處理中。'
        ];

        // 依序渲染公告文字行
        let startY = H/2 - dialogH/2 + 80;
        newsLines.forEach((line) => {
            const isHeader = line.startsWith('【');
            const txt = this.add.text(W/2 - dialogW/2 + 40, startY, line, {
                fontSize: isHeader ? '16px' : '14px',
                fontFamily: "'Noto Sans TC', monospace",
                fill: isHeader ? '#ffffff' : '#c3baff',
                fontWeight: isHeader ? '700' : '400',
                lineSpacing: 6
            });
            modalContainer.add(txt);
            startY += 24;
        });

        // 🟢 進入遊戲按鈕 (ENTER STAGE)
        const btnW = 180, btnH = 42;
        const btnX = W / 2;
        const btnY = H / 2 + dialogH / 2 - 40;

        // 按鈕邊框與滑過發光底色
        const btnHover = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0).setStrokeStyle(1.5, 0x5fffb8);
        modalContainer.add(btnHover);

        const btnTxt = this.add.text(btnX, btnY, 'ENTER STAGE', {
            fontSize: '15px', fontFamily: 'monospace', fontWeight: 'bold', fill: '#5fffb8', letterSpacing: 1
        }).setOrigin(0.5);
        modalContainer.add(btnTxt);

        // 建立透明按鈕點擊判定區
        const btnTrigger = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                btnHover.setFillStyle(0x5fffb8, 0.2);
                btnTxt.setFill('#ffffff');
            })
            .on('pointerout', () => {
                btnHover.setFillStyle(0xffffff, 0);
                btnTxt.setFill('#5fffb8');
            })
            .on('pointerdown', () => {
                
                // 📱 ⚡ 【針對橫向遊玩：發動強迫滾動驅逐工具列】
                // 點擊瞬間往下大力滾動 100 像素。由於 index.html 預留了足夠的高度，
                // Safari 橫向狀態下會完美觸發原生收合，將上下網址列、工具列完美隱藏或縮到最細！
                window.scrollTo(0, 100);

                // 點擊後將整組公告淡出，並流暢切換至下一個 Scene
                this.tweens.add({
                    targets: modalContainer,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        
                        // 📱 ⚡ 【網頁安全鎖定與同步刷新】
                        // 工具列退場後，立刻用 fixed 把網頁釘在 100dvh，消滅剛才多給的溢出肉塊，防止遊戲中回彈
                        try {
                            document.documentElement.style.height = '100dvh';
                            document.body.style.height = '100dvh';
                            document.body.style.overflow = 'hidden';
                            document.body.style.position = 'fixed';
                            
                            // 同步通知 Phaser 引擎尺寸變更，讓畫布完美配合最新淨空尺寸
                            if (this.scale) {
                                this.scale.refresh();
                            }
                        } catch (e) {}

                        // 優雅淡出畫布並切換場景
                        this.cameras.main.fadeOut(500, 0, 0, 0);
                        this.cameras.main.once('camerafadeoutcomplete', () => {
                            this.scene.start('GameScene'); 
                        });
                    }
                });
            });
        modalContainer.add(btnTrigger);

        // 公告視窗優雅淡入
        this.tweens.add({
            targets: modalContainer,
            alpha: 1,
            duration: 400
        });
    }
}
