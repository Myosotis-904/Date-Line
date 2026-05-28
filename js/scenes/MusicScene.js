'use strict';

/* ================================================================
    MusicScene — 音樂節奏遊戲場景（全功能優化流暢 + 延遲校準完美連動版）
================================================================ */
class MusicScene extends Phaser.Scene {
    constructor() { super('MusicScene'); }

    preload() {
        // === 1. 節奏遊戲原本需要的音樂與音效資源載入 ===
        this.load.audio('music', 'assets/music.mp3');
        this.load.image('ui_bg', 'assets/your_image.jpg');
        this.load.audio('prepare_bgm', 'assets/prepare.mp3');
        this.load.audio('hitsound', 'assets/hitsound.mp3'); 

        // === 2. ✨ 【完美同步移植】 — Loading 視覺系統 ===
        const W = this.scale.width;
        const H = this.scale.height;

        // 🟢 建立粒子繪圖層 (在最底層漂浮)
        const particleGfx = this.add.graphics().setDepth(1);
        const particles = [];
        
        // 初始化 40 個電子科技微粒數據
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H + H * 0.5, // 隨機分佈在螢幕中下方
                size: Math.random() * 4 + 2,    // 小方塊大小
                speedY: -(Math.random() * 1.2 + 0.4), // 緩慢向上漂浮
                alpha: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.4 ? 0x5fffb8 : 0x6c5fff // 藍綠色與紫外光色
            });
        }

        // 🟣 建立進度條繪圖層 (在中間)
        const progressGfx = this.add.graphics().setDepth(2);

        // ⚪ 建立故障風 LOADING... 提示文字
        const loadTxt = this.add.text(W / 2, H / 2 - 35, 'LOADING...', {
            fontSize: '26px', 
            fontFamily: 'Arial Black', 
            fontWeight: '900', 
            fill: '#ffffff',
            letterSpacing: 4
        }).setOrigin(0.5).setDepth(3);
        
        // 為文字加上發光的霓虹陰影
        loadTxt.setShadow(0, 0, '#5fffb8', 12, true, true);

        // 💥 文字的科技故障風 (Glitch) 定時隨機錯位動畫
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

        // 🔄 監聽 Phaser 的載入進度事件，即時重繪進度條
        this.load.on('progress', (value) => {
            progressGfx.clear();
            // 1. 繪製極細的科技感背景軌道外框
            progressGfx.lineStyle(1, 0x3d3470, 0.4);
            progressGfx.strokeRect(W / 2 - 160, H / 2, 320, 6);

            // 2. 繪製填滿的發光進度條本體
            progressGfx.fillStyle(0x5fffb8, 0.9); 
            progressGfx.fillRect(W / 2 - 160, H / 2 + 1, 320 * value, 4);
        });

        // 🏃 驅動背景粒子緩慢往上飄
        const updateListener = () => {
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
        };
        this.events.on('update', updateListener);

        // 🎬 當音樂與音效加載完畢後，優雅清場，釋放記憶體
        this.load.on('complete', () => {
            glitchTimer.remove(); 
            this.events.off('update', updateListener); 
            
            this.tweens.add({
                targets: [particleGfx, progressGfx, loadTxt],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    particleGfx.destroy();
                    progressGfx.destroy();
                    loadTxt.destroy();
                }
            });
        });
    }

    create() {
        // iOS Safari 安全解鎖音訊
        if (this.sound.context && this.sound.context.state === 'suspended') {
            document.addEventListener('click', () => {
                this.sound.context.resume().catch(() => {});
            }, { once: true });
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;

        this.bg = this.add.image(W / 2, H / 2, 'ui_bg')
            .setDisplaySize(W, H).setDepth(-2);

        this.isPreparing = true; 
        this.gameReady = false;
        this.isPaused = false; // ⏸️ 暫停狀態鎖
        this.input.addPointer(9);

        this.laneCount = MUSIC_CFG.LANES;
        this.laneWidth = W / this.laneCount;
        this.hitY = H * MUSIC_CFG.HIT_RATIO;
        this.keyH = H * MUSIC_CFG.KEY_RATIO;

        this.noteQueue = []; 
        this.activeNotes = [];
        this.score = 0; 
        this.combo = 0; 
        this.maxCombo = 0;
        this.perfectCnt = 0; 
        this.goodCnt = 0; 
        this.missCnt = 0;
        this.musicStartAudioTime = 0;
        this.pausedAudioElapsed = 0; // 記錄暫停時的音樂時間點

        this.touchLanes = {}; 
        this.holdingNotes = {};
        this._pointerDownTime = {};

        // 底色
        this.add.rectangle(W/2, H/2, W, H, 0x07070f, 0.4).setDepth(-1);
        
        this.laneGfx = this.add.graphics(); 
        this._drawLanes();
        
        // 判定基準線
        this.add.rectangle(W/2, this.hitY, W, 4, 0x9f8eff, 0.85);
        
        this.keyGfx = this.add.graphics();
        this.holdGfx = this.add.graphics().setDepth(1);
        this.syncLineGfx = this.add.graphics().setDepth(0.5); // 🔗 同時按下的連線圖層

        this._keyLabels = MUSIC_CFG.KEY_LABELS.map((label, i) =>
            this.add.text(i*this.laneWidth + this.laneWidth/2, this.hitY + this.keyH/2, label, {
                fontSize: Math.max(12, Math.round(this.laneWidth*0.28)) + 'px',
                fontFamily: 'monospace', fill: '#444466',
                fontWeight: 'bold'
            }).setOrigin(0.5, 0.5).setAlpha(0.4)
        );

        // UI 介面
        this.scoreTxt = this.add.text(W-24, 16, '0', {fontSize:'26px', fill:'#e0deff', fontFamily:'monospace', fontWeight:'bold'}).setOrigin(1, 0);
        
        // 🪐 4. 將 Combo 數移動到畫面正中央（判定線上方約 120px 處），並初始化美化樣式
        this.comboNumTxt = this.add.text(W/2, this.hitY - 140, '', {
            fontSize: '56px', fill: '#ffffff', fontFamily: 'Arial Black', fontWeight: '900', align: 'center'
        }).setOrigin(0.5, 0.5).setAlpha(0);

        this.comboLabelTxt = this.add.text(W/2, this.hitY - 95, 'COMBO', {
            fontSize: '14px', fill: '#7c70c0', fontFamily: 'monospace', letterSpacing: 4
        }).setOrigin(0.5, 0.5).setAlpha(0);

        this.judgeTxt = this.add.text(W/2, this.hitY - 50, '', {fontSize:'24px', fill:'#ffffff', fontFamily:'monospace', fontWeight:'bold', align:'center'}).setOrigin(0.5, 0.5).setAlpha(0);
        this.statusTxt = this.add.text(W/2, H/2, '載入譜面中…', {fontSize:'20px', fill:'#a5e8ff', fontFamily:'monospace'}).setOrigin(0.5);

       // ⏸️ 2. 將離開功能改為「暫停按鈕」（防誤觸邊緣 + 顯眼高質感優化版）
        // 🚀 【防誤觸核心】: 將 X 由 20 移至 45，Y 由 16 移至 45，挪出螢幕極邊緣的安全區
        this.pauseBtn = this.add.text(45, 45, ' ‖   暫停 ', {
            fontSize: '16px',               // 稍微放大字體
            fontWeight: 'bold',
            fill: '#5fffb8',                // 改為亮眼的霓虹綠
            fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#0f0f22',     // 深邃的高級背景色
            padding: { x: 16, y: 10 }       // 加大內邊距，讓按鈕實體變大
        })
        .setScrollFactor(0)
        .setOrigin(0, 0)                    // 靠左上對齊方便定位
        .setInteractive({ useHandCursor: true })
        .setVisible(false);

        // ✨ 幫按鈕加上高級的霓虹外框與陰影發光
        this.pauseBtn.setShadow(0, 0, '#5fffb8', 8, true, true);

        // 🎯 【黑科技】: 額外把點擊判定範圍「再放大」，即使手指按偏了也絕對抓得到！
        // 這裡把觸控區往外擴張，但視覺上按鈕大小保持精緻
        this.pauseBtn.input.hitArea.setTo(-10, -10, this.pauseBtn.width + 20, this.pauseBtn.height + 20);

        // 🎨 互動動態回饋（點擊或滑過時會閃爍發光變色）
        this.pauseBtn.on('pointerover', () => {
            this.pauseBtn.setStyle({ fill: '#ffffff', backgroundColor: '#6c5fff' });
            this.pauseBtn.setShadow(0, 0, '#6c5fff', 12, true, true);
        });

        this.pauseBtn.on('pointerout', () => {
            this.pauseBtn.setStyle({ fill: '#5fffb8', backgroundColor: '#0f0f22' });
            this.pauseBtn.setShadow(0, 0, '#5fffb8', 8, true, true);
        });

        // 點擊觸發暫停
        this.pauseBtn.on('pointerdown', () => {
            // 輕微縮放動畫，讓按鈕有被按下去的實體物理回饋感
            this.tweens.add({
                targets: this.pauseBtn,
                scale: 0.92,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    this._triggerPause();
                }
            });
        });
        
        // 觸控與點擊偵測（優化判定區）
        this.input.on('pointerdown', (ptr) => {
            if (!this.gameReady || this.isPaused) return;
            // 🧱 1. 傳入 ptr.y 但內部不再卡死高度，只要點擊 X 軸對應軌道即算觸發
            const lane = this._getLane(ptr.x, ptr.y);
            if (lane === -1) return;
            this._pointerDownTime[ptr.id] = this.time.now;
            this.touchLanes[ptr.id] = lane;
            this._tryHit(lane, ptr.id);
            this._drawKeys();
        });

        this.input.on('pointerup', (ptr) => {
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) this._tryHoldRelease(lane, false);
            delete this.touchLanes[ptr.id];
            delete this._pointerDownTime[ptr.id];
            this._drawKeys();
        });

        this.input.on('pointercancel', (ptr) => {
            const downTime = this._pointerDownTime[ptr.id];
            const elapsed = downTime !== undefined ? (this.time.now - downTime) : 999;
            if (elapsed < 80) {
                delete this.touchLanes[ptr.id];
                delete this._pointerDownTime[ptr.id];
                this._drawKeys();
                return;
            }
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) this._tryHoldRelease(lane, false);
            delete this.touchLanes[ptr.id];
            delete this._pointerDownTime[ptr.id];
            this._drawKeys();
        });

        // 螢幕 RWD 縮放
        this.scale.on('resize', (gs) => {
            const nW = gs.width, nH = gs.height;
            this.laneWidth = nW / this.laneCount;
            this.hitY = nH * MUSIC_CFG.HIT_RATIO;
            this.keyH = nH * MUSIC_CFG.KEY_RATIO;
            this._drawLanes(); this._drawKeys();
            this._keyLabels.forEach((t, i) =>
                t.setPosition(i*this.laneWidth + this.laneWidth/2, this.hitY + this.keyH/2)
            );
            if (this.comboNumTxt) this.comboNumTxt.setPosition(nW/2, this.hitY - 140);
            if (this.comboLabelTxt) this.comboLabelTxt.setPosition(nW/2, this.hitY - 95);
            if (this.judgeTxt) this.judgeTxt.setPosition(nW/2, this.hitY - 50);
        });

        // 讀取本地快取
        if (typeof SafeStorage !== 'undefined') {
            this.timingOffset = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        } else {
            this.timingOffset = parseInt(localStorage.getItem('timingOffset')) || 0;
        }

        this.prepareBGM = this.sound.add('prepare_bgm', { loop: true, volume: 0.4 });
        this.prepareBGM.play();

        this.speedMultiplier = 1.0;
        this._initAsync();
        this._createPrepareUI();

        // 🧼 3. 徹底拔除、釋放資源，杜絕退出後網頁卡死的問題
        this.events.on('shutdown', () => {
            this._cleanUpScene();
        });
    }

    async _initAsync() {
        try {
            const data = await this._loadBeatmap('beatmap.txt');
            this.noteQueue = data; 
            this.statusTxt.setVisible(false);
            this.music = this.sound.add('music');
            this.hitSound = this.sound.add('hitsound', { volume: 0.6 }); // 打擊音效
            this.isPreparing = true;
        } catch(err) {
            console.error('譜面載入失敗', err);
            this.statusTxt.setText('譜面載入失敗\n' + err.message);
        }
    }

    _createPrepareUI() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.prepareUI = this.add.container(0, 0).setDepth(50);

        const bg = this.add.image(W/2, H/2, 'ui_bg').setDisplaySize(W, H);
        this.prepareUI.add(bg);

        // ① 延遲校準
        const calibX1 = W * 0.60, calibX2 = W * 0.935;
        const calibY1 = H * 0.17, calibY2 = H * 0.285;
        const calibCX = (calibX1 + calibX2) / 2;
        const calibCY = (calibY1 + calibY2) / 2;

        const savedOfs = this.timingOffset;
        this.calibOfsText = this.add.text(
            calibX2 - 40, calibY1 + 40,
            `${savedOfs > 0 ? '+' : ''}${savedOfs} ms`,
            { fontSize:'19px', fill:'#a5e8ff', fontFamily:'monospace', align:'right' }
        ).setOrigin(1, 0).setDepth(52);

        const calibHover = this.add.rectangle(calibCX, calibCY, calibX2 - calibX1, calibY2 - calibY1, 0x7c6fff, 0).setDepth(50);
        this.prepareUI.add(calibHover);

        this.add.rectangle(calibCX, calibCY, calibX2 - calibX1, calibY2 - calibY1, 0xffffff, 0)
            .setDepth(55).setInteractive()
            .on('pointerover', () => calibHover.setAlpha(0.18))
            .on('pointerout',  () => calibHover.setAlpha(0))
            .on('pointerdown', () => { this.scene.start('CalibrationScene'); });

        // ② 速度滑桿
        const speedX1 = W * 0.575, speedX2 = W * 0.895;
        const speedY1 = H * 0.315, speedY2 = H * 0.510;
        const speedCX = (speedX1 + speedX2) / 2;
        const speedCY = (speedY1 + speedY2) / 2;

        const speedHover = this.add.rectangle(speedCX, speedCY, speedX2 - speedX1, speedY2 - speedY1, 0x5fb8ff, 0).setDepth(51);
        this.prepareUI.add(speedHover);

        this.speedValueTxt = this.add.text(speedCX, speedY1 + 10, '1.00×', { fontSize:'15px', fill:'#d4caff', fontFamily:'monospace' }).setOrigin(0.5, 0).setDepth(52);

        const slY = speedCY - 20, slX0 = speedX1 + 87, slLen = speedX2 - speedX1 - 150;
        const slTrackG = this.add.graphics().setDepth(52);
        slTrackG.lineStyle(3, 0x4a4d78, 1);
        slTrackG.lineBetween(slX0, slY, slX0 + slLen, slY);

        const slFillG = this.add.graphics().setDepth(52);
        const _redrawFill = (px) => {
            slFillG.clear(); slFillG.fillStyle(0x7c6fff, 0.85); slFillG.fillRect(slX0, slY - 3, px - slX0, 6);
        };
        _redrawFill(slX0 + slLen / 2);

        const slHandle = this.add.circle(slX0 + slLen/2, slY, 9, 0xd4caff).setDepth(53).setInteractive({ draggable: true });
        this.input.setDraggable(slHandle);
        this.input.on('drag', (pointer, obj, dragX) => {
            if (obj !== slHandle) return;
            const cx = Phaser.Math.Clamp(dragX, slX0, slX0 + slLen);
            obj.x = cx;
            const t = (cx - slX0) / slLen;
            this.speedMultiplier = parseFloat((0.5 + t * 2.5).toFixed(2));
            this.speedValueTxt.setText(this.speedMultiplier.toFixed(2) + '×');
            _redrawFill(cx);
        });

        // ③ Start 按鈕
        const startX1 = W * 0.685, startX2 = W * 0.895;
        const startY1 = H * 0.705, startY2 = H * 0.865;
        const startCX = (startX1 + startX2) / 2, startCY = (startY1 + startY2) / 2;

        const startHover = this.add.rectangle(startCX, startCY, startX2 - startX1, startY2 - startY1, 0xffffff, 0).setDepth(51);
        this.prepareUI.add(startHover);

        this.add.rectangle(startCX, startCY, startX2 - startX1, startY2 - startY1, 0xffffff, 0)
            .setDepth(55).setInteractive()
            .on('pointerover', () => startHover.setAlpha(0.22))
            .on('pointerout',  () => startHover.setAlpha(0))
            .on('pointerdown', () => {
                if (this.prepareBGM) this.prepareBGM.stop();
                this._startGame();
            });

        this.prepareUI.add([slTrackG, slFillG, slHandle, this.speedValueTxt, this.calibOfsText]);

        const startGlow = this.add.rectangle(startCX, startCY, startX2 - startX1 - 6, startY2 - startY1 - 6, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.7).setDepth(52);
        this.prepareUI.add(startGlow);
        this.tweens.add({
            targets: startGlow, strokeAlpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    _startGame() {
        if (this.gameReady) return;
        if (!this.noteQueue.length) return;

        // 🚀 出發前動態讀取最新延遲
        if (typeof SafeStorage !== 'undefined') {
            this.timingOffset = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        } else {
            this.timingOffset = parseInt(localStorage.getItem('timingOffset')) || 0;
        }

        this.prepareUI?.destroy();
        this.input.off('drag');
        this.pauseBtn.setVisible(true);

        const ctx = this.sound.context;
        const doPlay = () => {
            this.music.stop();
            this.music.play();
            this.musicStartAudioTime = ctx.currentTime;
            this.isPreparing = false;
            this.gameReady = true;
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(doPlay).catch(doPlay);
        } else {
            doPlay();
        }
    }

    // ⏸️ 2. 暫停核心觸發邏輯
    _triggerPause() {
        if (!this.gameReady || this.isPaused) return;
        this.isPaused = true;

        // 凍結音樂與時間軸
        this.pausedAudioElapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000;
        if (this.music && this.music.isPlaying) {
            this.music.pause();
        }
        this.tweens.pauseAll();

        // 繪製半透明黑色暫停背景
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.pauseOverlay = this.add.container(0, 0).setDepth(100);
        
        const mask = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75);
        const panel = this.add.rectangle(W/2, H/2, 320, 240, 0x131326).setStrokeStyle(2, 0x5a4fff, 0.8);
        
        const title = this.add.text(W/2, H/2 - 70, '遊戲暫停', { fontSize: '24px', fill: '#fff', fontFamily: 'monospace', fontWeight:'bold' }).setOrigin(0.5);

        // 按鈕：繼續遊戲
        const resumeBtn = this.add.text(W/2, H/2 - 10, '▶  繼續遊戲', { fontSize: '16px', fill: '#5fffb8', backgroundColor: '#1d2a2d', padding: { x: 30, y: 10 } }).setOrigin(0.5).setInteractive()
            .on('pointerdown', () => this._resumeGame());

        // 按鈕：退出遊戲
        const exitBtn = this.add.text(W/2, H/2 + 50, '🚪 退出遊戲', { fontSize: '16px', fill: '#ff6b6b', backgroundColor: '#2d1d1d', padding: { x: 30, y: 10 } }).setOrigin(0.5).setInteractive()
            .on('pointerdown', () => {
                this._cleanUpScene();
                this.scene.start('GameScene');
            });

        this.pauseOverlay.add([mask, panel, title, resumeBtn, exitBtn]);
    }

    // ⏸️ 2. 恢復遊戲邏輯
    _resumeGame() {
        if (!this.isPaused) return;
        this.pauseOverlay?.destroy();
        
        // 重新對齊音樂基準時間，扣除暫停流逝的時間段
        this.musicStartAudioTime = this.sound.context.currentTime - (this.pausedAudioElapsed / 1000);
        if (this.music) {
            this.music.resume();
        }
        this.tweens.resumeAll();
        this.isPaused = false;
    }

    update() {
        if (this.isPreparing || !this.gameReady || this.isPaused) return;

        // 🎵 物理音樂真正的流逝時間（毫秒）
        const baseMusicTime = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000;
        
        // 🚀 判定與視覺核心時間軸：扣除延遲。生成、打擊、過期、繪圖全部統一用它！
        const elapsed = baseMusicTime - this.timingOffset;

        this._spawnNotes(elapsed);               
        this._updateNotes(elapsed); 
        this._drawHoldBodies(elapsed); // 👈 長條繪製改用統一的 elapsed 驅動
        this._drawSyncLines();                   
        this._drawKeys();

        // 檢查譜面是否播放完畢
        const holdsDone = Object.keys(this.holdingNotes).length === 0;
        if (this.noteQueue.length === 0 && this.activeNotes.length === 0 && holdsDone) {
            this.gameReady = false; this._showResult();
        }
        if (this.music && !this.music.isPlaying && this.gameReady) {
            this.gameReady = false; this._showResult();
        }
    }

    _spawnNotes(elapsed) {
        while (this.noteQueue.length && this.noteQueue[0].time <= elapsed + MUSIC_CFG.LOOK_AHEAD) {
            this._spawnNote(this.noteQueue.shift(), elapsed);
        }
    }

    _spawnNote(data, elapsed) {
        const x = this.laneWidth * data.lane + this.laneWidth / 2;
        const nw = this.laneWidth * MUSIC_CFG.NOTE_W;
        
        // 初始高度先按時間軸分配（隨後會立刻在下個 Update 的 _updateNotes 刷新位置）
        const y = this.hitY - (data.time - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
        
        const note = this.add.rectangle(x, y, nw, MUSIC_CFG.NOTE_H, MUSIC_CFG.COLORS[data.lane]);
        note.setStrokeStyle(1.5, 0xffffff, 0.4);
        
        note._noteTime = data.time; 
        note._noteEndTime = data.isHold ? data.endTime : data.time;
        note._lane = data.lane; 
        note._isHold = data.isHold; 
        note._state = 'alive';
        
        this.activeNotes.push(note);
    }

    _updateNotes(elapsed) {
        const H = this.cameras.main.height;
        const targetLineY = this.hitY;

        for (const note of this.activeNotes) {
            if (!note.active) continue;
            
            // 🚀【位置公式重合修正】完全使用判定時間軸 (elapsed) 驅動！
            // 確保當完美時間點到時 (elapsed === note._noteTime)，Y 軸百分之百重合在判定線 targetLineY 上。
            note.y = targetLineY - (note._noteTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
            
            // --- 長條音符按住中的狀態處理 ---
            if (note._state === 'holding') {
                note.y = targetLineY;
                if (elapsed >= note._noteEndTime) this._completeHold(note);
                continue;
            }

            // 2. 過期判定：當判定時間超過「音符時間 + Good 判定寬度」才算 Miss
            if (note._state === 'alive' && elapsed > note._noteTime + MUSIC_CFG.WIN_GD) {
                note._state = 'missed'; 
                this._onMiss(); 
                
                if (!note._isHold) {
                    note.setAlpha(0.35); 
                }
                continue; 
            }

            // 3. 長條音符漏掉或中途斷開的過期判定
            if (note._isHold && note._state !== 'holding' && note._state !== 'missed') {
                if (elapsed > note._noteEndTime + MUSIC_CFG.WIN_GD) {
                    note._state = 'missed';
                    this._onMiss();
                    continue;
                }
            }

            // 4. 邊界銷毀守門員：只有當音符真正滾出螢幕底部才銷毀
            if (!note._isHold) {
                if (note.y > H + 50) { 
                    note.destroy(); 
                    continue; 
                }
            } else {
                // 長條音符的尾巴也改用相同時間基準驅動
                const tailY = targetLineY - (note._noteEndTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
                if (tailY > H + 50) { 
                    note.destroy(); 
                    continue; 
                }
            }
        }
        // 過濾掉已經被 destroy 的音符
        this.activeNotes = this.activeNotes.filter(n => n.active);
    }

    _drawHoldBodies(elapsed) {
        this.holdGfx.clear();
        const H = this.cameras.main.height;
        const targetLineY = this.hitY;

        for (const note of this.activeNotes) {
            if (!note.active || !note._isHold) continue;
            if (note._state === 'missed') continue;

            const lane = note._lane;
            const startX = this.lanePositions ? (this.lanePositions[lane] - this.noteW / 2) : (lane * this.laneWidth + (this.laneWidth * (1 - MUSIC_CFG.NOTE_W)) / 2);

            // 🚀 改用 elapsed 驅動長條頭尾的 Y 座標
            let currY = targetLineY - (note._noteTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
            let tailY = targetLineY - (note._noteEndTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

            if (note._state === 'holding') {
                currY = targetLineY;
            }

            if (tailY > H && currY > H) continue;
            if (currY < 0 && tailY < 0) continue;

            const rectH = currY - tailY;
            if (rectH <= 0) continue;

            let fillColor = 0x6c5fff;
            let alpha = 0.35;
            if (note._state === 'holding') {
                fillColor = 0x5fffb8;
                alpha = 0.55;
            }

            this.holdGfx.fillStyle(fillColor, alpha);
            this.holdGfx.fillRect(startX, tailY, this.laneWidth * MUSIC_CFG.NOTE_W, rectH);

            this.holdGfx.lineStyle(2, fillColor, alpha * 1.5);
            this.holdGfx.strokeRect(startX, tailY, this.laneWidth * MUSIC_CFG.NOTE_W, rectH);
        }
    }

    _drawSyncLines() {
        this.syncLineGfx.clear();
        if (this.activeNotes.length < 2) return;

        // 找出畫面上所有處於 alive 狀態且時間相同的音符組
        const groups = {};
        for (const note of this.activeNotes) {
            if (!note.active || note._state !== 'alive') continue;
            const t = note._noteTime;
            if (!groups[t]) groups[t] = [];
            groups[t].push(note);
        }

        this.syncLineGfx.lineStyle(2, 0xffffff, 0.4);
        for (const t in groups) {
            const notes = groups[t];
            if (notes.length < 2) continue;
            
            // 由左至右排序
            notes.sort((a, b) => a.x - b.x);
            this.syncLineGfx.beginPath();
            this.syncLineGfx.moveTo(notes[0].x, notes[0].y);
            for (let i = 1; i < notes.length; i++) {
                this.syncLineGfx.lineTo(notes[i].x, notes[i].y);
            }
            this.syncLineGfx.strokePath();
        }
    }

    _tryHit(lane, pointerId) {
        if (!this.gameReady || this.holdingNotes[lane]) return;
        
        // 🚀 點擊判定必須統一「減去」全域延遲
        const baseMusicTime = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000;
        const elapsed = baseMusicTime - this.timingOffset;
        
        let best = null, bestDiff = Infinity;
        for (const n of this.activeNotes) {
            // 安全鎖：只有 alive 的音符能被按到
            if (!n.active || n._state !== 'alive' || n._lane !== lane) continue;
            const diff = Math.abs(n._noteTime - elapsed);
            if (diff < bestDiff) { bestDiff = diff; best = n; }
        }
        
        if (!best) return;
        
        if (bestDiff <= MUSIC_CFG.WIN_PF) {
            this.hitSound?.play();
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'perfect'; this.holdingNotes[lane] = best; this._showJudge('HOLD ✦', '#c4b8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(300, 'PERFECT ✦', '#fffb80'); }
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            this.hitSound?.play();
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'good'; this.holdingNotes[lane] = best; this._showJudge('HOLD', '#5fb8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(100, 'GOOD', '#5fb8ff'); }
        }
    }

    _completeHold(note) {
        const lane = note._lane, pts = note._hitQuality === 'perfect' ? 500 : 200;
        const label = note._hitQuality === 'perfect' ? 'PERFECT ✦' : 'GOOD';
        const color = note._hitQuality === 'perfect' ? '#fffb80' : '#5fb8ff';
        
        this.hitSound?.play();
        note._state = 'hit'; note.destroy(); 
        delete this.holdingNotes[lane]; 
        this._onHit(pts, label, color);
    }

    _tryHoldRelease(lane, isCompleted) {
        const note = this.holdingNotes[lane]; if (!note) return;
        if (isCompleted) { this._completeHold(note); }
        else { note._state = 'break'; note.destroy(); delete this.holdingNotes[lane]; this._onMiss(); this._showJudge('BREAK', '#ff8844'); }
    }

    _onHit(pts, label, color) {
        this.score += pts * Math.max(1, 1 + Math.floor(this.combo / 10));
        this.combo++; 
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        if (label.startsWith('PERFECT')) this.perfectCnt++; else this.goodCnt++;
        this.scoreTxt.setText(this.score.toLocaleString());
        
        // 🪐 4. 動態更新畫面中央美化後的 Combo
        if (this.combo > 1) {
            this.comboNumTxt.setText(this.combo).setAlpha(1);
            this.comboLabelTxt.setAlpha(0.7);
            
            if (this.combo >= 50) this.comboNumTxt.setStyle({ fill: '#fffb80' });
            else this.comboNumTxt.setStyle({ fill: '#ffffff' });

            this.tweens.killTweensOf(this.comboNumTxt);
            this.comboNumTxt.setScale(1.2);
            this.tweens.add({
                targets: this.comboNumTxt, scaleX: 1, scaleY: 1, duration: 110, ease: 'Back.easeOut'
            });
        }
        
        this._showJudge(label, color);
    }

    _onMiss() {
        this.combo = 0; 
        this.missCnt++; 
        
        this.comboNumTxt.setAlpha(0);
        this.comboLabelTxt.setAlpha(0);
        
        this._showJudge('MISS', '#ff4466');
    }

    _showJudge(text, color) {
        const W = this.cameras.main.width;
        this.judgeTxt.setText(text).setStyle({fill: color}).setAlpha(1).setPosition(W/2, this.hitY - 50);
        
        this.tweens.killTweensOf(this.judgeTxt);
        this.judgeTxt.setScale(0.8);
        this.tweens.add({ targets: this.judgeTxt, scaleX: 1.1, scaleY: 1.1, duration: 80, yoyo: true, repeat: 0 });

        if (this._judgeTimer) this._judgeTimer.remove();
        this._judgeTimer = this.time.delayedCall(350, () =>
            this.tweens.add({ targets: this.judgeTxt, alpha: 0, duration: 150 })
        );
    }

    _drawLanes() {
        const W = this.cameras.main.width, H = this.cameras.main.height, g = this.laneGfx; g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            g.fillStyle(i%2===0 ? 0x121226 : 0x0e0e1a, 0.95); g.fillRect(i*this.laneWidth, 0, this.laneWidth, H);
            g.lineStyle(1, 0xffffff, 0.05); g.lineBetween(i*this.laneWidth, 0, i*this.laneWidth, H);
        }
        g.lineStyle(1, 0xffffff, 0.05); g.lineBetween(W, 0, W, H);
    }

    _drawKeys() {
        const g = this.keyGfx, pressed = new Set(Object.values(this.touchLanes));
        Object.keys(this.holdingNotes).forEach(lane => pressed.add(Number(lane)));
        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            const x = i*this.laneWidth, y = this.hitY+2, col = MUSIC_CFG.COLORS[i];
            const isP = pressed.has(i), isH = !!this.holdingNotes[i];
            g.fillStyle(col, isH ? 0.38 : isP ? 0.25 : 0.05); g.fillRect(x, y, this.laneWidth, this.keyH);
            g.lineStyle(isH ? 4 : isP ? 3 : 1, col, isH ? 1.0 : isP ? 1.0 : 0.2); g.lineBetween(x, y, x+this.laneWidth, y);
        }
    }

    _getLane(screenX, screenY) {
        const lane = Math.floor(screenX / this.laneWidth);
        return (lane < 0 || lane >= this.laneCount) ? -1 : lane;
    }

    _cleanUpScene() {
        this.gameReady = false;
        this.tweens?.killAll();
        this.time?.removeAllEvents();

        if (this.music) { this.music.stop(); this.music.destroy(); this.music = null; }
        if (this.prepareBGM) { this.prepareBGM.stop(); this.prepareBGM.destroy(); this.prepareBGM = null; }
        if (this.hitSound) { this.hitSound.destroy(); this.hitSound = null; }
        
        this.sound?.stopAll();
    }

    async _loadBeatmap(url) {
        const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return this._parseBeatmap(await res.text());
    }

    _parseBeatmap(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const isOsu = lines.some(l => l === '[HitObjects]');
        const notes = isOsu ? this._parseOsu(lines) : this._parseCsv(lines);
        if (!notes.length) throw new Error('找不到有效音符');
        return notes.sort((a, b) => a.time - b.time);
    }

    _parseOsu(lines) {
        const LANE_W = 512 / MUSIC_CFG.LANES, notes = []; let inHit = false;
        for (const line of lines) {
            if (line === '[HitObjects]') { inHit = true; continue; }
            if (line.startsWith('[') && inHit) break; if (!inHit) continue;
            const p = line.split(','); if (p.length < 4) continue;
            const x = parseInt(p[0]), time = parseInt(p[2]), type = parseInt(p[3]);
            if (isNaN(x) || isNaN(time) || isNaN(type)) continue;
            const isHold = (type & 128) !== 0; let endTime = time;
            if (isHold && p[5]) { const e = parseInt(p[5].split(':')[0]); if (!isNaN(e) && e > time) endTime = e; }
            notes.push({ lane: Math.min(MUSIC_CFG.LANES-1, Math.floor(x/LANE_W)), time, endTime, isHold });
        }
        return notes;
    }

    _parseCsv(lines) {
        const notes = [];
        for (const line of lines) {
            if (line.startsWith('#') || line.startsWith('//')) continue;
            const p = line.split(','); if (p.length < 2) continue;
            const time = parseInt(p[0]), lane = parseInt(p[1]);
            if (isNaN(time) || isNaN(lane) || lane < 0 || lane >= MUSIC_CFG.LANES) continue;
            const isHold = p[2] ? parseInt(p[2]) === 1 : false;
            const endTime = (isHold && p[3]) ? parseInt(p[3]) : time;
            notes.push({ time, lane, isHold, endTime });
        }
        return notes;
    }

    _showResult() {
        this.pauseBtn.setVisible(false);
        const W = this.cameras.main.width, H = this.cameras.main.height;
        const judged = this.perfectCnt + this.goodCnt + this.missCnt;
        const acc = judged ? Math.round((this.perfectCnt + this.goodCnt) / judged * 100) : 0;
        let grade = 'D';
        if (acc >= 95) grade = 'S'; else if (acc >= 85) grade = 'A';
        else if (acc >= 70) grade = 'B'; else if (acc >= 55) grade = 'C';
        
        this.add.rectangle(W/2, H/2, W*0.86, H*0.68, 0x0f0f22, 0.96).setStrokeStyle(1.5, 0x6c5fff, 0.7);
        const cx = W/2; let oy = H/2 - H*0.27;
        const row = (text, color, size, gap=10) => {
            if (!text) { oy += gap; return; }
            this.add.text(cx, oy, text, {fontSize: size+'px', fill: color, fontFamily:'monospace'}).setOrigin(0.5, 0);
            oy += size + gap;
        };
        row('RESULT', '#d4caff', 28, 4); row('', '', 0, 8);
        row(`GRADE  ${grade}`, grade==='S' ? '#ffe066' : '#e0deff', 32, 4); row('', '', 0, 6);
        row(`SCORE  ${this.score.toLocaleString()}`, '#e0deff', 20);
        row(`COMBO  ${this.maxCombo}x`, '#5fb8ff', 18);
        row(`ACC    ${acc}%`, '#5fffb8', 18); row('', '', 0, 4);
        row(`PF ${this.perfectCnt}  GD ${this.goodCnt}  MS ${this.missCnt}`, '#666', 14, 6);
        oy += 10;
        
        this.add.text(cx, oy, '再玩一次', { fontSize:'22px', fill:'#b3aaff', fontFamily:'monospace', backgroundColor:'#1a1a33', padding:{x:20, y:10} }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this._cleanUpScene(); this.scene.restart(); });
        this.add.text(cx, oy+56, '回到地圖', { fontSize:'16px', fill:'#666', fontFamily:'monospace', backgroundColor:'#111', padding:{x:14, y:8} }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this._cleanUpScene(); this.scene.start('GameScene'); });
    }
}
