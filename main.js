/* =========================================================
   StartScene
========================================================= */
class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, '換日線', {
            fontSize: '40px', fill: '#fff'
        }).setOrigin(0.5);

        this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, '點擊開始', {
            fontSize: '30px', fill: '#a5e8ff'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => this.scene.start('GameScene'));
    }
}

/* =========================================================
   GameScene
========================================================= */
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        this.load.image('map',    'assets/map.png');
        this.load.image('stage',  'assets/stage.png');
        this.load.image('tree',   'assets/tree.png');
        this.load.image('sign',   'assets/sign.png');
        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: 256, frameHeight: 256
        });
    }

    create() {
        // [9] 提高 pointer 數量，確保多指不漏
        this.input.addPointer(5);
        setTimeout(() => this.scale.refresh(), 200);

        // ── 地圖 ──
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);
        const mapScale = Math.max(
            this.scale.width  / this.map.width,
            this.scale.height / this.map.height
        ) * 1.5;
        this.map.setScale(mapScale);
        this.worldWidth  = this.map.width  * mapScale;
        this.worldHeight = this.map.height * mapScale;
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // ── 物件（碰撞用）──
        this.objects = [];
        const addObject = (x, y, key, scale, w, h) => {
            const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale);
            this.objects.push({ sprite, width: w, height: h });
        };
        addObject(600,  1200, 'stage', 2.5, 300, 120);
        addObject(700,  2150, 'tree',  0.8, 120,  80);
        addObject(500,  2150, 'sign',  0.8, 100,  60);

        // ── 玩家 ──
        this.player = this.add.sprite(
            this.worldWidth / 2,
            this.worldHeight - 50,
            'player'
        ).setOrigin(0.5, 1).setScale(0.7);

        this.safeZone = { x: this.player.x, y: this.player.y, radius: 100 };

        // ── 動畫 ──
        this.anims.create({ key: 'idle',
            frames: [0,1].map(f => ({ key:'player', frame:f })),
            frameRate: 2, repeat: -1 });
        this.anims.create({ key: 'walk_left',
            frames: [2,3,4,3].map(f => ({ key:'player', frame:f })),
            frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'walk_right',
            frames: [5,6,7,6].map(f => ({ key:'player', frame:f })),
            frameRate: 4, repeat: -1 });
        this.player.anims.play('idle');
        this.cameras.main.startFollow(this.player);

        // ── 搖桿 [8] 改為底部任意區域按壓 ──
        this.baseX = 120;
        this.baseY = this.scale.height - 120;
        this.joyBase = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4)
            .setScrollFactor(0);
        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7)
            .setScrollFactor(0);

        this.joyActive    = false;
        this.joyPointerId = null;
        this.joyX = 0;
        this.joyY = 0;

        // 整個場景 pointerdown：左半部下方啟動搖桿
        this.input.on('pointerdown', (pointer) => {
            if (this.joyActive) return;
            const screenX = pointer.x;
            const screenY = pointer.y;
            // 只在左半部且下方 40% 響應
            if (screenX < this.scale.width * 0.5 && screenY > this.scale.height * 0.55) {
                this.joyActive    = true;
                this.joyPointerId = pointer.id;
                this.baseX = screenX;
                this.baseY = screenY;
                this.joyBase.setPosition(this.baseX, this.baseY);
                this.joyStick.setPosition(this.baseX, this.baseY);
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.joyActive || pointer.id !== this.joyPointerId) return;
            let dx = pointer.x - this.baseX;
            let dy = pointer.y - this.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const max  = 60;
            if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);
            this.joyX = dx / max;
            this.joyY = dy / max;
        });

        this.input.on('pointerup', (pointer) => {
            if (pointer.id !== this.joyPointerId) return;
            this.joyActive    = false;
            this.joyPointerId = null;
            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0;
            this.joyY = 0;
        });

        this.scale.on('resize', (gameSize) => {
            this.joyBase.setPosition(this.baseX, gameSize.height - 120);
            this.joyStick.setPosition(this.baseX, gameSize.height - 120);
        });

        // ── 互動按鈕 ──
        this.actionButton = this.add.text(
            this.scale.width - 120,
            this.scale.height - 120,
            '進入舞台',
            { fontSize: '24px', fill: '#fff', backgroundColor: '#000', padding: { x:8, y:6 } }
        )
        .setScrollFactor(0)
        .setInteractive()
        .setVisible(false)
        .on('pointerdown', () => this.scene.start('MusicScene'));
    }

    update() {
        const speed = 5;
        const prevX = this.player.x;
        const prevY = this.player.y;

        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;
        this.player.x  = Phaser.Math.Clamp(this.player.x, 0, this.worldWidth);
        this.player.y  = Phaser.Math.Clamp(this.player.y, 0, this.worldHeight);

        const inSafe = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.safeZone.x, this.safeZone.y
        ) < this.safeZone.radius;

        for (const obj of this.objects) {
            const inside =
                this.player.x > obj.sprite.x - obj.width  / 2 &&
                this.player.x < obj.sprite.x + obj.width  / 2 &&
                this.player.y > obj.sprite.y - obj.height &&
                this.player.y < obj.sprite.y;

            if (inside && !inSafe) {
                this.player.x = prevX;
                const stillInside =
                    prevX > obj.sprite.x - obj.width  / 2 &&
                    prevX < obj.sprite.x + obj.width  / 2 &&
                    this.player.y > obj.sprite.y - obj.height &&
                    this.player.y < obj.sprite.y;
                if (stillInside) this.player.y = prevY;
            }
        }

        if      (this.joyX < -0.2) this.player.anims.play('walk_left',  true);
        else if (this.joyX >  0.2) this.player.anims.play('walk_right', true);
        else                        this.player.anims.play('idle',       true);

        const stageD = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.objects[0].sprite.x, this.objects[0].sprite.y
        );
        this.actionButton.setVisible(stageD < 200);
    }
}

/* =========================================================
   MusicScene — 完整修正版
========================================================= */
/* =========================================================
   MusicScene — 手機觸控版（完整修正版）
   修正項目：
   1. y 座標符號修正（note 從上往下落）
   2. Miss 判定與清理邏輯統一
   3. 觸控區域改為全螢幕各軌道按壓
   4. 視覺上給每軌加大觸控回饋
   5. 移除鍵盤邏輯，純觸控
   6. lookAheadMs 改為固定值，避免過早生成
   7. 結果畫面改善
========================================================= */

const MUSIC_CFG = {
    LANES:      7,
    NOTE_SPEED: 400,    // px / 秒（世界座標）
    HIT_RATIO:  0.82,   // hitY = height * HIT_RATIO
    KEY_RATIO:  0.13,   // 按鍵區高度（手機加大）
    NOTE_W:     0.80,   // note 寬 = laneW * NOTE_W
    NOTE_H:     16,     // note 高 px
    WIN_PF:     55,     // ±ms Perfect 判定窗口
    WIN_GD:     110,    // ±ms Good 判定窗口
    LOOK_AHEAD: 1600,   // ms 提前生成（固定值）
    COLORS: [0x7c6fff, 0x5fb8ff, 0x5fffb8, 0xffe066, 0xff7eb3, 0xff6f6f, 0xc084fc],
    KEY_LABELS: ['①', '②', '③', '④', '⑤', '⑥', '⑦'],
};

class MusicScene extends Phaser.Scene {
    constructor() {
        super('MusicScene');
    }

    // ── preload ──────────────────────────────────────────
    preload() {
        this.load.audio('music', 'assets/music.mp3');
    }

    // ── create ───────────────────────────────────────────
    create() {
        // 支援最多 10 指同時觸控
        this.input.addPointer(9);

        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.laneCount = MUSIC_CFG.LANES;
        this.laneWidth = W / this.laneCount;
        this.hitY      = H * MUSIC_CFG.HIT_RATIO;
        this.keyH      = H * MUSIC_CFG.KEY_RATIO;

        // ── 狀態 ──
        this.noteQueue   = [];
        this.activeNotes = [];
        this.score       = 0;
        this.combo       = 0;
        this.maxCombo    = 0;
        this.perfectCnt  = 0;
        this.goodCnt     = 0;
        this.missCnt     = 0;
        this.gameReady   = false;
        this.musicStartAudioTime = 0;

        // 觸控：pointerId → lane index
        this.touchLanes = {};

        // ── 背景 ──
        this.add.rectangle(W / 2, H / 2, W, H, 0x07070f);

        // ── 軌道（靜態，只畫一次）──
        this.laneGfx = this.add.graphics();
        this._drawLanes();

        // ── 判定線 ──
        this.add.rectangle(W / 2, this.hitY, W, 3, 0xccbbff, 0.8);

        // ── 按鍵區（每幀重繪，顯示按壓狀態）──
        this.keyGfx = this.add.graphics();

        // ── 按鍵標籤（只建立一次）──
        this._keyLabels = MUSIC_CFG.KEY_LABELS.map((label, i) =>
            this.add.text(
                i * this.laneWidth + this.laneWidth / 2,
                this.hitY + this.keyH / 2,
                label,
                {
                    fontSize: Math.max(12, Math.round(this.laneWidth * 0.28)) + 'px',
                    fontFamily: 'monospace',
                    fill: '#444466',
                    alpha: 0.7
                }
            ).setOrigin(0.5, 0.5)
        );

        // ── HUD ──
        this.scoreTxt = this.add.text(W - 16, 12, '0', {
            fontSize: '28px', fill: '#d4caff', fontFamily: 'monospace', align: 'right'
        }).setOrigin(1, 0);

        this.comboTxt = this.add.text(W - 16, 48, '', {
            fontSize: '16px', fill: '#7c70c0', fontFamily: 'monospace', align: 'right'
        }).setOrigin(1, 0);

        this.judgeTxt = this.add.text(W / 2, H * 0.34, '', {
            fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5, 0.5).setAlpha(0);

        // ── 載入提示 ──
        this.statusTxt = this.add.text(W / 2, H / 2, '載入譜面中…', {
            fontSize: '20px', fill: '#a5e8ff', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // ── 離開按鈕 ──
        this.add.text(16, 12, '← 離開', {
            fontSize: '16px', fill: '#666',
            fontFamily: 'monospace',
            backgroundColor: '#111',
            padding: { x: 8, y: 4 }
        })
        .setScrollFactor(0)
        .setInteractive()
        .on('pointerdown', () => {
            if (this.music && this.music.isPlaying) this.music.stop();
            this.scene.start('GameScene');
        });

        // ── 觸控輸入（純全螢幕按壓）──
        //    pointerdown / pointermove 都可以觸發判定，
        //    讓玩家在任何時刻按下就算一次 hit
        this.input.on('pointerdown', (ptr) => {
            if (!this.gameReady) return;
            const lane = this._getLane(ptr.x);
            if (lane === -1) return;
            this.touchLanes[ptr.id] = lane;
            this._tryHit(lane);
            this._drawKeys();
        });

        this.input.on('pointerup', (ptr) => {
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        this.input.on('pointercancel', (ptr) => {
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        // 視窗縮放時重新計算並重畫
        this.scale.on('resize', (gameSize) => {
            const nW = gameSize.width;
            const nH = gameSize.height;
            this.laneWidth = nW / this.laneCount;
            this.hitY      = nH * MUSIC_CFG.HIT_RATIO;
            this.keyH      = nH * MUSIC_CFG.KEY_RATIO;
            this._drawLanes();
            this._drawKeys();
            // 更新標籤位置
            this._keyLabels.forEach((t, i) => {
                t.setPosition(
                    i * this.laneWidth + this.laneWidth / 2,
                    this.hitY + this.keyH / 2
                );
            });
        });

        // ── 非同步初始化 ──
        this._initAsync();
    }

    // ── 非同步初始化 ─────────────────────────────────────
    async _initAsync() {
        try {
            const data = await this._loadBeatmap('beatmap.txt');
            this.noteQueue = data;
            this.statusTxt.setVisible(false);

            this.music = this.sound.add('music');
            this.music.play();

            // 以 AudioContext 時間為基準，避免場景時間漂移
            const actx = this.sound.context;
            this.musicStartAudioTime = actx.currentTime;

            this.gameReady = true;
        } catch (err) {
            console.error('譜面載入失敗', err);
            this.statusTxt.setText('譜面載入失敗\n' + err.message);
        }
    }

    // ── update ────────────────────────────────────────────
    update() {
        if (!this.gameReady) return;

        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000;

        this._spawnNotes(elapsed);
        this._updateNotes(elapsed);

        // 曲目結束
        if (this.noteQueue.length === 0 && this.activeNotes.length === 0) {
            this.gameReady = false;
            this._showResult();
        }
    }

    // ── 生成 Note ─────────────────────────────────────────
    _spawnNotes(elapsed) {
        while (
            this.noteQueue.length &&
            this.noteQueue[0].time <= elapsed + MUSIC_CFG.LOOK_AHEAD
        ) {
            const data = this.noteQueue.shift();
            this._spawnNote(data, elapsed);
        }
    }

    _spawnNote(data, elapsed) {
        const x  = this.laneWidth * data.lane + this.laneWidth / 2;
        const nw = this.laneWidth * MUSIC_CFG.NOTE_W;
        const nh = MUSIC_CFG.NOTE_H;

        // ★ 修正1：負號 → note 在 hitY 上方，往下落
        const timeLeft = data.time - elapsed;
        const y = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED / 1000;

        const note = this.add.rectangle(x, y, nw, nh, MUSIC_CFG.COLORS[data.lane]);
        // 加亮邊框，手機螢幕上更顯眼
        note.setStrokeStyle(1.5, 0xffffff, 0.3);

        note._noteTime = data.time;
        note._lane     = data.lane;
        note._isHold   = data.isHold;
        note._state    = 'alive';

        this.activeNotes.push(note);
    }

    // ── 更新 Note ─────────────────────────────────────────
    _updateNotes(elapsed) {
        const H = this.cameras.main.height;

        for (const note of this.activeNotes) {
            if (!note.active) continue;

            // ★ 修正2：負號 → 隨時間流逝 note 向下移
            const timeLeft = note._noteTime - elapsed;
            note.y = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED / 1000;

            // Miss 判定：超過 Good 窗口仍未打
            if (note._state === 'alive' && note._noteTime < elapsed - MUSIC_CFG.WIN_GD) {
                note._state = 'miss';
                this._onMiss();
                note.destroy();   // ★ 修正3：miss 立即銷毀
                continue;
            }

            // 離開畫面（hit 後 or 其他）才清除
            if (note.y > H + MUSIC_CFG.NOTE_H * 2) {
                note.destroy();
            }
        }

        // ★ 修正4：清理條件只用 active（不再判 state）
        this.activeNotes = this.activeNotes.filter(n => n.active);
    }

    // ── 判定邏輯 ──────────────────────────────────────────
    _tryHit(lane) {
        if (!this.gameReady) return;
        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000;

        let best = null, bestDiff = Infinity;
        for (const n of this.activeNotes) {
            if (!n.active || n._state !== 'alive' || n._lane !== lane) continue;
            const diff = Math.abs(n._noteTime - elapsed);
            if (diff < bestDiff) { bestDiff = diff; best = n; }
        }

        if (!best) return;

        if (bestDiff <= MUSIC_CFG.WIN_PF) {
            best._state = 'hit';
            best.destroy();
            this._onHit(300, 'PERFECT ✦', '#c4b8ff');
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            best._state = 'hit';
            best.destroy();
            this._onHit(100, 'GOOD', '#5fb8ff');
        }
        // 在判定窗口外按下不計分也不 miss（只是空按）
    }

    _onHit(pts, label, color) {
        this.score += pts * Math.max(1, 1 + Math.floor(this.combo / 10));
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (label.startsWith('PERFECT')) this.perfectCnt++;
        else this.goodCnt++;
        this.scoreTxt.setText(this.score.toLocaleString());
        this.comboTxt.setText(this.combo > 1 ? this.combo + 'x' : '');
        this._showJudge(label, color);
    }

    _onMiss() {
        this.combo = 0;
        this.missCnt++;
        this.comboTxt.setText('');
        this._showJudge('MISS', '#ff4466');
    }

    // ── 判定文字（彈出＋淡出）────────────────────────────
    _showJudge(text, color) {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.judgeTxt
            .setText(text)
            .setStyle({ fill: color })
            .setAlpha(1)
            .setPosition(W / 2, H * 0.34);

        if (this._judgeTimer) this._judgeTimer.remove();
        this._judgeTimer = this.time.delayedCall(400, () => {
            this.tweens.add({ targets: this.judgeTxt, alpha: 0, duration: 200 });
        });
    }

    // ── 畫軌道 ────────────────────────────────────────────
    _drawLanes() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const g = this.laneGfx;
        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            // 底色交替
            g.fillStyle(i % 2 === 0 ? 0x111122 : 0x0d0d1a, 1);
            g.fillRect(i * this.laneWidth, 0, this.laneWidth, H);
            // 分隔線
            g.lineStyle(0.5, 0xffffff, 0.07);
            g.lineBetween(i * this.laneWidth, 0, i * this.laneWidth, H);
        }
        // 最右邊界
        g.lineStyle(0.5, 0xffffff, 0.07);
        g.lineBetween(W, 0, W, H);
    }

    // ── 畫按鍵區（含觸控回饋）────────────────────────────
    _drawKeys() {
        const g = this.keyGfx;
        const pressed = new Set(Object.values(this.touchLanes));

        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            const x   = i * this.laneWidth;
            const y   = this.hitY + 2;
            const col = MUSIC_CFG.COLORS[i];
            const isP = pressed.has(i);

            // 按鍵底色（按壓時明顯亮起）
            g.fillStyle(col, isP ? 0.30 : 0.06);
            g.fillRect(x, y, this.laneWidth, this.keyH);

            // 按鍵上緣亮線（按壓時更粗更亮）
            g.lineStyle(isP ? 3 : 1, col, isP ? 1.0 : 0.2);
            g.lineBetween(x, y, x + this.laneWidth, y);

            // 外框
            g.lineStyle(isP ? 1.5 : 0.5, col, isP ? 0.7 : 0.12);
            g.strokeRect(x + 1, y, this.laneWidth - 2, this.keyH - 2);
        }

        // 更新標籤顏色
        this._keyLabels?.forEach((t, i) => {
            const isP = pressed.has(i);
            const hex = '#' + MUSIC_CFG.COLORS[i].toString(16).padStart(6, '0');
            t.setStyle({ fill: isP ? hex : '#444466' });
            t.setAlpha(isP ? 1.0 : 0.5);
        });
    }

    // ── 取得觸控對應軌道 ──────────────────────────────────
    _getLane(screenX) {
        const lane = Math.floor(screenX / this.laneWidth);
        if (lane < 0 || lane >= this.laneCount) return -1;
        return lane;
    }

    // ── 譜面載入 ──────────────────────────────────────────
    async _loadBeatmap(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return this._parseBeatmap(text);
    }

    _parseBeatmap(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const isOsu = lines.some(l => l === '[HitObjects]');
        const notes = isOsu ? this._parseOsu(lines) : this._parseCsv(lines);
        if (!notes.length) throw new Error('找不到有效音符');
        return notes.sort((a, b) => a.time - b.time);
    }

    _parseOsu(lines) {
        const LANE_W = 512 / MUSIC_CFG.LANES;
        const notes  = [];
        let inHit    = false;
        for (const line of lines) {
            if (line === '[HitObjects]') { inHit = true; continue; }
            if (line.startsWith('[') && inHit) break;
            if (!inHit) continue;
            const p    = line.split(',');
            if (p.length < 4) continue;
            const x    = parseInt(p[0]);
            const time = parseInt(p[2]);
            const type = parseInt(p[3]);
            if (isNaN(x) || isNaN(time) || isNaN(type)) continue;
            notes.push({
                lane:   Math.min(MUSIC_CFG.LANES - 1, Math.floor(x / LANE_W)),
                time,
                isHold: (type & 128) !== 0
            });
        }
        return notes;
    }

    _parseCsv(lines) {
        const notes = [];
        for (const line of lines) {
            if (line.startsWith('#') || line.startsWith('//')) continue;
            const p    = line.split(',');
            if (p.length < 2) continue;
            const time = parseInt(p[0]);
            const lane = parseInt(p[1]);
            if (isNaN(time) || isNaN(lane)) continue;
            if (lane < 0 || lane >= MUSIC_CFG.LANES) continue;
            notes.push({ time, lane, isHold: p[2] ? parseInt(p[2]) === 1 : false });
        }
        return notes;
    }

    // ── 結果畫面 ──────────────────────────────────────────
    _showResult() {
        const W      = this.cameras.main.width;
        const H      = this.cameras.main.height;
        const judged = this.perfectCnt + this.goodCnt + this.missCnt;
        const acc    = judged ? Math.round((this.perfectCnt + this.goodCnt) / judged * 100) : 0;

        let grade = 'D';
        if (acc >= 95) grade = 'S';
        else if (acc >= 85) grade = 'A';
        else if (acc >= 70) grade = 'B';
        else if (acc >= 55) grade = 'C';

        // 半透明背景板
        this.add.rectangle(W / 2, H / 2, W * 0.86, H * 0.68, 0x0f0f22, 0.96)
            .setStrokeStyle(1.5, 0x6c5fff, 0.7);

        const cx = W / 2;
        let oy = H / 2 - H * 0.27;
        const line = (text, color, size, gap = 10) => {
            if (!text) { oy += gap; return; }
            this.add.text(cx, oy, text, {
                fontSize: size + 'px', fill: color, fontFamily: 'monospace'
            }).setOrigin(0.5, 0);
            oy += size + gap;
        };

        line('RESULT',                         '#d4caff', 28, 4);
        line('',                               '',         0, 8);
        line(`GRADE  ${grade}`,               grade === 'S' ? '#ffe066' : '#e0deff', 32, 4);
        line('',                               '',         0, 6);
        line(`SCORE  ${this.score.toLocaleString()}`, '#e0deff', 20);
        line(`COMBO  ${this.maxCombo}x`,      '#5fb8ff', 18);
        line(`ACC    ${acc}%`,                 '#5fffb8', 18);
        line('',                               '',         0, 4);
        line(`PF ${this.perfectCnt}  GD ${this.goodCnt}  MS ${this.missCnt}`, '#666', 14, 6);

        oy += 10;

        this.add.text(cx, oy, '再玩一次', {
            fontSize: '22px', fill: '#b3aaff', fontFamily: 'monospace',
            backgroundColor: '#1a1a33', padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5, 0)
        .setInteractive()
        .on('pointerdown', () => {
            if (this.music?.isPlaying) this.music.stop();
            this.scene.restart();
        });

        this.add.text(cx, oy + 56, '回到地圖', {
            fontSize: '16px', fill: '#666', fontFamily: 'monospace',
            backgroundColor: '#111', padding: { x: 14, y: 8 }
        })
        .setOrigin(0.5, 0)
        .setInteractive()
        .on('pointerdown', () => {
            if (this.music?.isPlaying) this.music.stop();
            this.scene.start('GameScene');
        });
    }
}

/* =========================================================
   Phaser 設定
========================================================= */
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width:  960,
    height: 540,
    backgroundColor: '#000000',
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [StartScene, GameScene, MusicScene]
};

new Phaser.Game(config);