'use strict';

/* ================================================================
   MusicScene — 音樂節奏遊戲場景
================================================================ */
class MusicScene extends Phaser.Scene {
    constructor() { super('MusicScene'); }

    preload() {
        this.load.audio('music', 'assets/music.mp3');
        this.load.image('ui_bg', 'assets/your_image.jpg');
        this.load.audio('prepare_bgm', 'assets/prepare.mp3');
    }

    create() {
        // iOS Safari：確保 AudioContext 已啟動
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
        }

        this.bg = this.add.image(
            this.cameras.main.width / 2, this.cameras.main.height / 2, 'ui_bg'
        ).setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        this.isPreparing = true; this.gameReady = false;
        this.input.addPointer(9);

        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.laneCount = MUSIC_CFG.LANES;
        this.laneWidth = W / this.laneCount;
        this.hitY = H * MUSIC_CFG.HIT_RATIO;
        this.keyH = H * MUSIC_CFG.KEY_RATIO;

        this.noteQueue = []; this.activeNotes = [];
        this.score = 0; this.combo = 0; this.maxCombo = 0;
        this.perfectCnt = 0; this.goodCnt = 0; this.missCnt = 0;
        this.musicStartAudioTime = 0;
        this.touchLanes = {}; this.holdingNotes = {};
        this._pointerDownTime = {};

        this.add.rectangle(W/2, H/2, W, H, 0x07070f);
        this.laneGfx = this.add.graphics(); this._drawLanes();
        this.add.rectangle(W/2, this.hitY, W, 3, 0xccbbff, 0.8);
        this.keyGfx = this.add.graphics();
        this.holdGfx = this.add.graphics().setDepth(1);

        this._keyLabels = MUSIC_CFG.KEY_LABELS.map((label, i) =>
            this.add.text(i*this.laneWidth + this.laneWidth/2, this.hitY + this.keyH/2, label, {
                fontSize: Math.max(12, Math.round(this.laneWidth*0.28)) + 'px',
                fontFamily: 'monospace', fill: '#444466',
            }).setOrigin(0.5, 0.5).setAlpha(0.5)
        );

        this.scoreTxt = this.add.text(W-16, 12, '0', {fontSize:'28px', fill:'#d4caff', fontFamily:'monospace', align:'right'}).setOrigin(1, 0);
        this.comboTxt = this.add.text(W-16, 48, '',  {fontSize:'16px', fill:'#7c70c0', fontFamily:'monospace', align:'right'}).setOrigin(1, 0);
        this.judgeTxt = this.add.text(W/2, H*0.34, '', {fontSize:'20px', fill:'#ffffff', fontFamily:'monospace', align:'center'}).setOrigin(0.5, 0.5).setAlpha(0);
        this.statusTxt = this.add.text(W/2, H/2, '載入譜面中…', {fontSize:'20px', fill:'#a5e8ff', fontFamily:'monospace'}).setOrigin(0.5);

        // 離開按鈕
        this.add.text(16, 12, '← 離開', {
            fontSize:'16px', fill:'#666', fontFamily:'monospace',
            backgroundColor:'#111', padding:{x:8, y:4},
        }).setScrollFactor(0).setInteractive()
          .on('pointerdown', () => {
            if (this.prepareBGM?.isPlaying) this.prepareBGM.stop();
            this.scene.start('GameScene');
        });

        // 觸控事件
        this.input.on('pointerdown', (ptr) => {
            if (!this.gameReady) return;
            const lane = this._getLane(ptr.x);
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

        // iOS pointercancel 修正
        this.input.on('pointercancel', (ptr) => {
            const downTime = this._pointerDownTime[ptr.id];
            const elapsed  = downTime !== undefined ? (this.time.now - downTime) : 999;

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

        this.scale.on('resize', (gs) => {
            const nW = gs.width, nH = gs.height;
            this.laneWidth = nW / this.laneCount;
            this.hitY = nH * MUSIC_CFG.HIT_RATIO;
            this.keyH = nH * MUSIC_CFG.KEY_RATIO;
            this._drawLanes(); this._drawKeys();
            this._keyLabels.forEach((t, i) =>
                t.setPosition(i*this.laneWidth + this.laneWidth/2, this.hitY + this.keyH/2)
            );
        });

        this.prepareBGM = this.sound.add('prepare_bgm', { loop: true, volume: 0.5 });
        this.prepareBGM.play();

        this.speedMultiplier = 1.0;
        this.timingOffset = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        this._initAsync();
        this._createPrepareUI();

        this.events.on('shutdown', () => {
            if (this.prepareBGM) {
                this.prepareBGM.stop();
            }
        });

        this.events.on('shutdown', () => {
            this.sound.stopAll(); // 👈 離開場景自動全關
        });
    }

    async _initAsync() {
        try {
            const data = await this._loadBeatmap('beatmap.txt');
            this.noteQueue = data; this.statusTxt.setVisible(false);
            this.music = this.sound.add('music');
            this.musicStartAudioTime = this.sound.context.currentTime;
            this.isPreparing = true;
        } catch(err) {
            console.error('譜面載入失敗', err);
            this.statusTxt.setText('譜面載入失敗\n' + err.message);
        }
        this.isLoaded = true;
    }

    _createPrepareUI() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.prepareUI = this.add.container(0, 0).setDepth(50);

        const bg = this.add.image(W/2, H/2, 'ui_bg').setDisplaySize(W, H);
        this.prepareUI.add(bg);

        /* ① 延遲校準格子 */
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

        const calibHover = this.add.rectangle(calibCX, calibCY,
            calibX2 - calibX1, calibY2 - calibY1, 0x7c6fff, 0).setDepth(50);
        this.prepareUI.add(calibHover);

        this.add.rectangle(calibCX, calibCY,
            calibX2 - calibX1, calibY2 - calibY1, 0xffffff, 0)
            .setDepth(55).setInteractive()
            .on('pointerover', () => calibHover.setAlpha(0.18))
            .on('pointerout',  () => calibHover.setAlpha(0))
            .on('pointerdown', () => { this.scene.start('CalibrationScene'); });

        /* ② 速度滑桿格子 */
        const speedX1 = W * 0.575, speedX2 = W * 0.895;
        const speedY1 = H * 0.315, speedY2 = H * 0.510;
        const speedCX = (speedX1 + speedX2) / 2;
        const speedCY = (speedY1 + speedY2) / 2;

        const speedHover = this.add.rectangle(speedCX, speedCY,
            speedX2 - speedX1, speedY2 - speedY1, 0x5fb8ff, 0).setDepth(51);
        this.prepareUI.add(speedHover);

        this.speedValueTxt = this.add.text(speedCX, speedY1 + 10, '1.00×',
            { fontSize:'15px', fill:'#d4caff', fontFamily:'monospace' }
        ).setOrigin(0.5, 0).setDepth(52);

        const slY = speedCY - 20;
        const slX0 = speedX1 + 87;
        const slLen = speedX2 - speedX1 - 150;

        const slTrackG = this.add.graphics().setDepth(52);
        slTrackG.lineStyle(3, 0x4a4d78, 1);
        slTrackG.lineBetween(slX0, slY, slX0 + slLen, slY);

        const slFillG = this.add.graphics().setDepth(52);
        const _redrawFill = (px) => {
            slFillG.clear();
            slFillG.fillStyle(0x7c6fff, 0.85);
            slFillG.fillRect(slX0, slY - 3, px - slX0, 6);
        };
        _redrawFill(slX0 + slLen / 2);

        const slHandle = this.add.circle(slX0 + slLen/2, slY, 9, 0xd4caff)
            .setDepth(53).setInteractive({ draggable: true });
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

        /* ③ Start 格子 */
        const startX1 = W * 0.685, startX2 = W * 0.895;
        const startY1 = H * 0.705, startY2 = H * 0.865;
        const startCX = (startX1 + startX2) / 2;
        const startCY = (startY1 + startY2) / 2;

        const startHover = this.add.rectangle(startCX, startCY,
            startX2 - startX1, startY2 - startY1, 0xffffff, 0).setDepth(51);
        this.prepareUI.add(startHover);

        this.add.rectangle(startCX, startCY,
            startX2 - startX1, startY2 - startY1, 0xffffff, 0)
            .setDepth(55).setInteractive()
            .on('pointerover', () => startHover.setAlpha(0.22))
            .on('pointerout',  () => startHover.setAlpha(0))
            .on('pointerdown', () => {
                if (this.prepareBGM) this.prepareBGM.stop();
                this._startGame();
            });

        this.prepareUI.add(slTrackG);
        this.prepareUI.add(slFillG);
        this.prepareUI.add(slHandle);
        this.prepareUI.add(this.speedValueTxt);
        this.prepareUI.add(this.calibOfsText);

        const startGlow = this.add.rectangle(startCX, startCY,
            startX2 - startX1 - 6, startY2 - startY1 - 6,
            0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.7).setDepth(52);
        this.prepareUI.add(startGlow);
        this.tweens.add({
            targets: startGlow, strokeAlpha: 0.15,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    _startGame() {
        if (this.gameReady) return;
        if (!this.noteQueue.length) { console.log('加載中...'); return; }

        this.prepareUI?.destroy();
        this.input.off('drag');

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

    update() {
        if (this.isPreparing || !this.gameReady) return;
        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;
        this._spawnNotes(elapsed);
        this._updateNotes(elapsed);
        this._drawHoldBodies(elapsed);
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
        while (this.noteQueue.length && this.noteQueue[0].time <= elapsed + MUSIC_CFG.LOOK_AHEAD)
            this._spawnNote(this.noteQueue.shift(), elapsed);
    }

    _spawnNote(data, elapsed) {
        const x = this.laneWidth * data.lane + this.laneWidth / 2;
        const nw = this.laneWidth * MUSIC_CFG.NOTE_W;
        const y = this.hitY - (data.time - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
        const note = this.add.rectangle(x, y, nw, MUSIC_CFG.NOTE_H, MUSIC_CFG.COLORS[data.lane]);
        note.setStrokeStyle(1.5, 0xffffff, 0.3);
        note._noteTime = data.time; note._noteEndTime = data.isHold ? data.endTime : data.time;
        note._lane = data.lane; note._isHold = data.isHold; note._state = 'alive';
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
            if (!note._isHold && note.y > H + 200) { note.destroy(); continue; }
            if (note._isHold) {
                const tailY = this.hitY - (note._noteEndTime - elapsed) * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
                if (tailY > H + 200) note.destroy();
            }
        }
        this.activeNotes = this.activeNotes.filter(n => n.active);
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
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'perfect'; this.holdingNotes[lane] = best; this._showJudge('HOLD ✦', '#c4b8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(300, 'PERFECT ✦', '#c4b8ff'); }
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            if (best._isHold) { best._state = 'holding'; best._hitQuality = 'good'; this.holdingNotes[lane] = best; this._showJudge('HOLD', '#5fb8ff'); }
            else { best._state = 'hit'; best.destroy(); this._onHit(100, 'GOOD', '#5fb8ff'); }
        }
    }

    _completeHold(note) {
        const lane = note._lane, pts = note._hitQuality === 'perfect' ? 500 : 200;
        const label = note._hitQuality === 'perfect' ? 'PERFECT ✦' : 'GOOD';
        const color = note._hitQuality === 'perfect' ? '#c4b8ff' : '#5fb8ff';
        note._state = 'hit'; note.destroy(); delete this.holdingNotes[lane]; this._onHit(pts, label, color);
    }

    _tryHoldRelease(lane, isCompleted) {
        const note = this.holdingNotes[lane]; if (!note) return;
        if (isCompleted) { this._completeHold(note); }
        else { note._state = 'break'; note.destroy(); delete this.holdingNotes[lane]; this._onMiss(); this._showJudge('BREAK', '#ff8844'); }
    }

    _onHit(pts, label, color) {
        this.score += pts * Math.max(1, 1 + Math.floor(this.combo / 10));
        this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (label.startsWith('PERFECT')) this.perfectCnt++; else this.goodCnt++;
        this.scoreTxt.setText(this.score.toLocaleString());
        this.comboTxt.setText(this.combo > 1 ? this.combo + 'x' : '');
        this._showJudge(label, color);
    }

    _onMiss() {
        this.combo = 0; this.missCnt++; this.comboTxt.setText(''); this._showJudge('MISS', '#ff4466');
    }

    _showJudge(text, color) {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.judgeTxt.setText(text).setStyle({fill: color}).setAlpha(1).setPosition(W/2, H*0.34);
        if (this._judgeTimer) this._judgeTimer.remove();
        this._judgeTimer = this.time.delayedCall(400, () =>
            this.tweens.add({ targets: this.judgeTxt, alpha: 0, duration: 200 })
        );
    }

    _drawLanes() {
        const W = this.cameras.main.width, H = this.cameras.main.height, g = this.laneGfx; g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            g.fillStyle(i%2===0 ? 0x111122 : 0x0d0d1a, 1); g.fillRect(i*this.laneWidth, 0, this.laneWidth, H);
            g.lineStyle(0.5, 0xffffff, 0.07); g.lineBetween(i*this.laneWidth, 0, i*this.laneWidth, H);
        }
        g.lineStyle(0.5, 0xffffff, 0.07); g.lineBetween(W, 0, W, H);
    }

    _drawKeys() {
        const g = this.keyGfx, pressed = new Set(Object.values(this.touchLanes));
        Object.keys(this.holdingNotes).forEach(lane => pressed.add(Number(lane)));
        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            const x = i*this.laneWidth, y = this.hitY+2, col = MUSIC_CFG.COLORS[i];
            const isP = pressed.has(i), isH = !!this.holdingNotes[i];
            g.fillStyle(col, isH ? 0.40 : isP ? 0.28 : 0.06); g.fillRect(x, y, this.laneWidth, this.keyH);
            g.lineStyle(isH ? 4 : isP ? 3 : 1, col, isH ? 1.0 : isP ? 1.0 : 0.2); g.lineBetween(x, y, x+this.laneWidth, y);
            g.lineStyle(isP||isH ? 1.5 : 0.5, col, isP||isH ? 0.7 : 0.12); g.strokeRect(x+1, y, this.laneWidth-2, this.keyH-2);
        }
        this._keyLabels?.forEach((t, i) => {
            const isP = pressed.has(i), hex = '#' + MUSIC_CFG.COLORS[i].toString(16).padStart(6, '0');
            t.setStyle({fill: isP ? hex : '#444466'}); t.setAlpha(isP ? 1.0 : 0.5);
        });
    }

    _getLane(screenX) {
        const lane = Math.floor(screenX / this.laneWidth);
        return (lane < 0 || lane >= this.laneCount) ? -1 : lane;
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
        this.add.text(cx, oy, '再玩一次', {
            fontSize:'22px', fill:'#b3aaff', fontFamily:'monospace',
            backgroundColor:'#1a1a33', padding:{x:20, y:10},
        }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this.music?.stop(); this.scene.restart(); });
        this.add.text(cx, oy+56, '回到地圖', {
            fontSize:'16px', fill:'#666', fontFamily:'monospace',
            backgroundColor:'#111', padding:{x:14, y:8},
        }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this.music?.stop(); this.scene.start('GameScene'); });
    }

}