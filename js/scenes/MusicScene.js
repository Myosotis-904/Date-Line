'use strict';

/* ================================================================
    MusicScene — 音樂節奏遊戲場景（全功能優化流暢版）
================================================================ */
class MusicScene extends Phaser.Scene {
    constructor() { super('MusicScene'); }

    preload() {
        this.load.audio('music', 'assets/music.mp3');
        this.load.image('ui_bg', 'assets/your_image.jpg');
        this.load.audio('prepare_bgm', 'assets/prepare.mp3');
        
        // 📥 6. 載入打擊音效回饋
        this.load.audio('hitsound', 'assets/hitsound.mp3'); 
    }

    create() {
        // iOS Safari 安全解鎖音訊
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
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

        // ⏸️ 2. 將離開功能改為「暫停按鈕」
        this.pauseBtn = this.add.text(20, 16, ' ‖  暫停', {
            fontSize:'14px', fill:'#d4caff', fontFamily:'monospace',
            backgroundColor:'#1a1a33', padding:{x:12, y:6},
        }).setScrollFactor(0).setInteractive().setVisible(false)
          .on('pointerdown', () => this._triggerPause());

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

        this.prepareBGM = this.sound.add('prepare_bgm', { loop: true, volume: 0.4 });
        this.prepareBGM.play();

        this.speedMultiplier = 1.0;
        this.timingOffset = parseInt(SafeStorage.getItem('timingOffset')) || 0;
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

        const savedOfs = parseInt(SafeStorage.getItem('timingOffset')) || 0;
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

        this.prepareUI?.destroy();
        this.input.off('drag');
        this.pauseBtn.setVisible(true); // 顯示暫停按鈕

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

        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;
        
        this._spawnNotes(elapsed);
        this._updateNotes(elapsed);
        this._drawHoldBodies(elapsed);
        this._drawSyncLines(); // 🔗 5. 渲染同時按下的輔助線
        this._drawKeys();

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
        for (const note of this.activeNotes) {
            if (!note.active) continue;
            note.y = this.hitY - (note._noteTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
            
            if (note._state === 'holding') {
                note.y = this.hitY;
                if (elapsed >= note._noteEndTime) this._completeHold(note);
                continue;
            }
            if (note._state === 'alive' && note._noteTime < elapsed - MUSIC_CFG.WIN_GD) {
                if (!note._isHold) { note._state = 'miss'; this._onMiss(); note.destroy(); }
                continue;
            }
            if (!note._isHold && note.y > H + 150) { note.destroy(); continue; }
            if (note._isHold) {
                const tailY = this.hitY - (note._noteEndTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
                if (tailY > H + 150) note.destroy();
            }
        }
        this.activeNotes = this.activeNotes.filter(n => n.active);
    }

    // 🔗 5. 繪製多個音符「同時間壓下」的輔助連接線
    _drawSyncLines() {
        const g = this.syncLineGfx; g.clear();
        
        // 分組找出同一個時間點（誤差微乎其微）的 Alive 音符
        const timeGroups = {};
        for (const note of this.activeNotes) {
            if (note.active && note._state === 'alive') {
                const t = note._noteTime;
                if (!timeGroups[t]) timeGroups[t] = [];
                timeGroups[t].push(note);
            }
        }

        // 遍歷所有分組，若有 2 個以上的音符同時間出現，就在兩者間連線
        Object.values(timeGroups).forEach(notes => {
            if (notes.length < 2) return;
            // 排序 X 座標確保由左至右畫線
            notes.sort((a, b) => a.x - b.x);
            
            g.lineStyle(3, 0xffffff, 0.45); // 金屬霓虹白底線
            for (let i = 0; i < notes.length - 1; i++) {
                g.lineBetween(notes[i].x, notes[i].y, notes[i+1].x, notes[i+1].y);
            }
        });
    }

    _drawHoldBodies(elapsed) {
        const g = this.holdGfx; g.clear();
        for (const note of this.activeNotes) {
            if (!note.active || !note._isHold) continue;
            if (note._state === 'miss' || note._state === 'hit') continue;
            
            const lane = note._lane, col = MUSIC_CFG.COLORS[lane];
            const bw = this.laneWidth * MUSIC_CFG.NOTE_W, bx = lane * this.laneWidth + (this.laneWidth - bw) / 2;
            const isHolding = note._state === 'holding', headY = note.y;
            const tailY = this.hitY - (note._noteEndTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
            const H = this.cameras.main.height;
            
            const drawTop = Math.max(-20, tailY), drawBottom = Math.min(H+20, headY), drawHeight = drawBottom - drawTop;
            if (drawHeight <= 0) continue;
            
            g.fillStyle(col, isHolding ? 0.65 : 0.35); g.fillRect(bx, drawTop, bw, drawHeight);
            g.lineStyle(1.5, col, isHolding ? 1.0 : 0.55); g.strokeRect(bx, drawTop, bw, drawHeight);
            
            if (isHolding) { g.fillStyle(0xffffff, 0.18); g.fillRect(bx + bw*0.25, drawTop, bw*0.5, drawHeight); }
            if (tailY > -10) { g.fillStyle(isHolding ? 0xffffff : col, isHolding ? 0.9 : 0.85); g.fillRect(bx, tailY-4, bw, 8); }
        }
    }

    _tryHit(lane, pointerId) {
        if (!this.gameReady || this.holdingNotes[lane]) return;
        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;
        
        let best = null, bestDiff = Infinity;
        for (const n of this.activeNotes) {
            if (!n.active || n._state !== 'alive' || n._lane !== lane) continue;
            const diff = Math.abs(n._noteTime - elapsed);
            if (diff < bestDiff) { bestDiff = diff; best = n; }
        }
        
        if (!best) return;
        
        if (bestDiff <= MUSIC_CFG.WIN_PF) {
            this.hitSound?.play(); // 🔊 6. 音效打擊回饋
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'perfect'; this.holdingNotes[lane] = best; this._showJudge('HOLD ✦', '#c4b8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(300, 'PERFECT ✦', '#fffb80'); }
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            this.hitSound?.play(); // 🔊 6. 音效打擊回饋
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'good'; this.holdingNotes[lane] = best; this._showJudge('HOLD', '#5fb8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(100, 'GOOD', '#5fb8ff'); }
        }
    }

    _completeHold(note) {
        const lane = note._lane, pts = note._hitQuality === 'perfect' ? 500 : 200;
        const label = note._hitQuality === 'perfect' ? 'PERFECT ✦' : 'GOOD';
        const color = note._hitQuality === 'perfect' ? '#fffb80' : '#5fb8ff';
        
        this.hitSound?.play(); // 🔊 6. 音效打擊回饋
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
            
            // 霓虹特效色切換
            if (this.combo >= 50) this.comboNumTxt.setStyle({ fill: '#fffb80' }); // 高 Combo 變金色發光
            else this.comboNumTxt.setStyle({ fill: '#ffffff' });

            // ⚡ 每次打擊彈性內縮回彈特效 (Pop Animation)
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
        
        // 🪐 4. Miss 時淡出正中央的 Combo 顯示
        this.comboNumTxt.setAlpha(0);
        this.comboLabelTxt.setAlpha(0);
        
        this._showJudge('MISS', '#ff4466');
    }

    _showJudge(text, color) {
        const W = this.cameras.main.width;
        this.judgeTxt.setText(text).setStyle({fill: color}).setAlpha(1).setPosition(W/2, this.hitY - 50);
        
        // 判定文字跳動擴張特效
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

    // 🧱 1. 全方位判定擴大（不再卡死 Y 軸點擊限制，全螢幕高度皆可防滑防斷觸）
    _getLane(screenX, screenY) {
        const lane = Math.floor(screenX / this.laneWidth);
        return (lane < 0 || lane >= this.laneCount) ? -1 : lane;
    }

    // 🧼 3. 核心安全資源垃圾回收（完美解決離開遊戲後網頁卡死的問題）
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
