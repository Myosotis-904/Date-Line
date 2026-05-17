/* =====StartScene====== */

class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }
'use strict';
/* ================================================================
   換日線 — main.js  v4
   基底：document 5（含 Hold Note、CalibrationScene、速度滑桿）
   新增功能：
   [N1] 完整 AABB 碰撞：玩家無法穿越任何地標
   [N2] 地標對話框系統：靠近後點互動鍵 → 彈出對話視窗
        - 舞台（stage）對話框有「進入舞台」動作按鈕
        - 其他地標顯示說明文字 + 關閉按鈕
        - 對話框開啟時搖桿凍結、玩家停止移動
   [N3] 地標靠近動畫：
        - sprite 上下浮動 tween（靠近時啟動、離開時停止）
        - 光暈 ellipse 淡入淡出
        - 螢幕右側互動鍵出現並閃爍
   Bug 修正：
   [B1] activeNotes 每幀過濾已 destroy 物件，防止操作死物件
   [B2] 動畫 key 重複建立保護（scene.restart 時不報錯）
   既有功能全數保留：Hold Note、BREAK 判定、CalibrationScene、
   速度滑桿、timingOffset、Grade 評級、結果畫面
================================================================ */

/* ----------------------------------------------------------------
   地標資料表（集中管理）
   colW / colH：AABB 碰撞半寬 / 全高（以地標底部中心為基準）
   nearDist：觸發動畫距離；interactDist：可開啟對話框距離
---------------------------------------------------------------- */
const LANDMARKS = [
    {
        key: 'stage', x: 600, y: 1200, scale: 2.5,
        colW: 150, colH: 110,
        nearDist: 200, interactDist: 240,
        dialog: {
            title: '換日線舞台',
            lines: ['這是主要演出場地。', '靠近後可以進入音樂節奏遊戲！'],
            action: 'enter',
            actionLabel: '▶  進入舞台',
        },
    },
    {
        key: 'tree1', x: 1120, y: 2160, scale: 0.8,
        colW: 30, colH: 35,
        nearDist: 150, interactDist: 190,
        dialog: {
            title: '海邊的草叢',
            lines: ['只是普通的草叢，','撞一撞有機會穿模卡在裡面。'],
        },
    },
    {
        key: 'tree2', x: 320, y: 2160, scale: 0.8,
        colW: 30, colH: 50,
        nearDist: 80, interactDist: 100,
        dialog: {
            title:'另一邊的草叢',
            lines: ['好像散發奇怪的氣息...?','感覺不要靠太近比較好...'],
        },
    },
    {
        key: 'sign', x: 700, y: 2180, scale: 0.8,
        colW: 40, colH: 40,
        nearDist: 140, interactDist: 180,
        dialog: {
            title: '場地公告牌',
            lines: ['高雄女中第78屆畢業典禮-換日線', 
                    '這是一個看起來有一點潦草的導覽網站，','路邊長出來的怪東西都可以戳戳看，有機會會跟你說話。',
                    '呃我程式寫的一坨史，有bug或建議可以去舞台邊找綠兔子回報。大感謝!'
            ],
        },
    },
];

/* ----------------------------------------------------------------
   音樂場景設定
---------------------------------------------------------------- */
const MUSIC_CFG = {
    LANES:      7,
    NOTE_SPEED: 400,
    HIT_RATIO:  0.82,
    KEY_RATIO:  0.13,
    NOTE_W:     0.80,
    NOTE_H:     16,
    WIN_PF:     55,
    WIN_GD:     110,
    LOOK_AHEAD: 1600,
    COLORS: [0x7c6fff, 0x5fb8ff, 0x5fffb8, 0xffe066, 0xff7eb3, 0xff6f6f, 0xc084fc],
    KEY_LABELS: ['①', '②', '③', '④', '⑤', '⑥', '⑦'],
};

/* ================================================================
   StartScene
================================================================ */
class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }

    create() {
        const W = this.scale.width, H = this.scale.height;

        // 背景 + 格線
        this.add.rectangle(W / 2, H / 2, W, H, 0x07070f);
        const g = this.add.graphics();
        g.lineStyle(0.5, 0x1e1860, 0.45);
        for (let x = 0; x < W; x += 44) g.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 44) g.lineBetween(0, y, W, y);

        // 標題
        this.add.text(W / 2, H / 2 - 58, '換日線', {
            fontSize: '44px', fill: '#d4caff',
            fontFamily: "'Noto Sans TC', monospace", letterSpacing: 14,
        }).setOrigin(0.5);

        this.add.text(W / 2, H / 2 - 14, 'D A T E L I N E', {
            fontSize: '13px', fill: '#3d3470', fontFamily: 'monospace', letterSpacing: 7,
        }).setOrigin(0.5);

        // 開始提示（閃爍）
        const hint = this.add.text(W / 2, H / 2 + 62, '觸碰或按任意鍵開始', {
            fontSize: '20px', fill: '#a5e8ff',
            fontFamily: "'Noto Sans TC', monospace", letterSpacing: 3,
        }).setOrigin(0.5);

        this.tweens.add({
            targets: hint, alpha: 0.15,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        this.input.once('pointerdown', () => this.scene.start('GameScene'));
        this.input.keyboard.once('keydown', () => this.scene.start('GameScene'));
    }
}

/* ================================================================
   GameScene
================================================================ */
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        this.load.image('map',    'assets/map.png');
        this.load.image('stage',  'assets/stage.png');
        this.load.image('tree1',   'assets/tree1.png');
        this.load.image('tree2',   'assets/tree2.png');
        this.load.image('sign',   'assets/sign.png');
        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: 256, frameHeight: 256,
        });
    }

    create() {
        this.input.addPointer(5);
        setTimeout(() => this.scale.refresh(), 200);

        // [N2] 對話框狀態旗標
        this.dialogOpen = false;

        /* ── 地圖 ── */
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);
        const mapScale = Math.max(
            this.scale.width  / this.map.width,
            this.scale.height / this.map.height
        ) * 1.5;
        this.map.setScale(mapScale);
        this.worldWidth  = this.map.width  * mapScale;
        this.worldHeight = this.map.height * mapScale;
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        /* ── [N1][N2][N3] 地標（依 LANDMARKS 資料表建立）── */
        this.landmarks = LANDMARKS.map(def => {
            // sprite
            const sprite = this.add.image(def.x, def.y, def.key)
                .setOrigin(0.5, 1).setScale(def.scale).setDepth(5);

            // [N3] 光暈橢圓（預設透明）
            const halo = this.add.ellipse(
                def.x, def.y - 8,
                def.colW * 2.8, 28,
                0x9988ff, 0
            ).setDepth(4);

            return { ...def, sprite, halo, isNear: false };

        });

        /* ── 玩家 ── */
        this.player = this.add.sprite(
            this.worldWidth / 2,
            this.worldHeight - 50,
            'player'
        ).setOrigin(0.5, 1).setScale(0.7).setDepth(10);

        /* ── 動畫 [B2] 防重複建立 ── */
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle',
                frames: [0, 1].map(f => ({ key: 'player', frame: f })),
                frameRate: 2, repeat: -1 });
        }
        if (!this.anims.exists('walk_left')) {
            this.anims.create({ key: 'walk_left',
                frames: [2, 3, 4, 3].map(f => ({ key: 'player', frame: f })),
                frameRate: 4, repeat: -1 });
        }
        if (!this.anims.exists('walk_right')) {
            this.anims.create({ key: 'walk_right',
                frames: [5, 6, 7, 6].map(f => ({ key: 'player', frame: f })),
                frameRate: 4, repeat: -1 });
        }
        this.player.anims.play('idle');
        this.cameras.main.startFollow(this.player);

        /* ── 搖桿（任意位置啟動版）── */
        this.baseX = 120;
        this.baseY = this.scale.height - 120;
        this.joyBase = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4)
            .setScrollFactor(0).setDepth(20);
        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7)
            .setScrollFactor(0).setDepth(21);
        this.joyActive    = false;
        this.joyPointerId = null;
        this.joyX = 0;
        this.joyY = 0;

        this.input.on('pointerdown', (pointer) => {
            if (this.dialogOpen) return;     // [N2] 對話框開啟時禁止搖桿
            if (this.joyActive) return;
            const sx = pointer.x, sy = pointer.y;
            if (sx < this.scale.width * 0.5 && sy > this.scale.height * 0.55) {
                this.joyActive    = true;
                this.joyPointerId = pointer.id;
                this.baseX = sx; this.baseY = sy;
                this.joyBase.setPosition(sx, sy);
                this.joyStick.setPosition(sx, sy);
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.joyActive || pointer.id !== this.joyPointerId) return;
            let dx = pointer.x - this.baseX;
            let dy = pointer.y - this.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy), max = 60;
            if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);
            this.joyX = dx / max;
            this.joyY = dy / max;
        });

        this.input.on('pointerup', (pointer) => {
            if (pointer.id !== this.joyPointerId) return;
            this.joyActive = false; this.joyPointerId = null;
            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0; this.joyY = 0;
        });

        this.scale.on('resize', (gameSize) => {
            this.joyBase.setPosition(this.baseX, gameSize.height - 120);
            this.joyStick.setPosition(this.baseX, gameSize.height - 120);
        });

        /* ── [N3] 右側互動鍵（固定螢幕）── */
        this.interactBtn = this.add.text(
            this.scale.width - 14,
            this.scale.height / 2,
            '！\n互動',
            {
                fontSize: '18px', fill: '#fff',
                fontFamily: "'Noto Sans TC', monospace",
                backgroundColor: '#2a1a6a',
                padding: { x: 14, y: 12 },
                align: 'center',
            }
        )
        .setOrigin(1, 0.5)
        .setScrollFactor(0).setDepth(30)
        .setVisible(false)
        .setInteractive()
        .on('pointerover',  function () { this.setStyle({ backgroundColor: '#4a2aaa' }); })
        .on('pointerout',   function () { this.setStyle({ backgroundColor: '#2a1a6a' }); })
        .on('pointerdown',  () => this._triggerInteract());

        /* ── [N2] 對話框 UI（一次建立，反覆顯示/隱藏）── */
        this._buildDialog();

        /* ── 鍵盤互動（PC：E 或 Enter）── */
        this.input.keyboard.on('keydown-E',     () => this._triggerInteract());
        this.input.keyboard.on('keydown-ENTER', () => this._triggerInteract());
    }

    /* ── [N2] 建立對話框物件 ── */
    _buildDialog() {
        const W = this.scale.width, H = this.scale.height;
        const bw = Math.min(W * 0.76, 460), bh = 210;
        const cx = W / 2, cy = H / 2;

        this.dlg = {};

        // 半透明遮罩（點擊關閉）
        this.dlg.overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.55)
            .setScrollFactor(0).setDepth(40).setVisible(false)
            .setInteractive()
            .on('pointerdown', () => this._closeDialog());

        // 外框
        this.dlg.box = this.add.rectangle(cx, cy, bw, bh, 0x0c0c22, 1)
            .setStrokeStyle(1.5, 0x5a4fff, 0.85)
            .setScrollFactor(0).setDepth(41).setVisible(false);

        // 標題
        this.dlg.title = this.add.text(cx, cy - bh / 2 + 20, '', {
            fontSize: '19px', fill: '#d4caff',
            fontFamily: "'Noto Sans TC', monospace",
            fontStyle: 'bold', letterSpacing: 3,
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(42).setVisible(false);

        // 分隔線
        this.dlg.divider = this.add.rectangle(cx, cy - bh / 2 + 52, bw - 36, 1, 0x2a2460)
            .setScrollFactor(0).setDepth(42).setVisible(false);

        // 內容行（最多 3 行）
        this.dlg.rows = Array.from({ length: 5 }, (_, i) =>
            this.add.text(cx, cy - bh / 2 + 64 + i * 26, '', {
                fontSize: '14px', fill: '#9080cc',
                fontFamily: "'Noto Sans TC', monospace",
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(42).setVisible(false)
        );

        // 動作按鈕（進入舞台等）
        this.dlg.actionBtn = this.add.text(cx - 52, cy + bh / 2 - 40, '', {
            fontSize: '14px', fill: '#b3aaff',
            fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#1a1233', padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(43).setVisible(false)
        .setInteractive()
        .on('pointerover',  function () { this.setStyle({ fill: '#fff' }); })
        .on('pointerout',   function () { this.setStyle({ fill: '#b3aaff' }); })
        .on('pointerdown',  () => this._dialogAction());

        // 關閉按鈕
        this.dlg.closeBtn = this.add.text(cx + 52, cy + bh / 2 - 40, '關閉', {
            fontSize: '14px', fill: '#555577',
            fontFamily: 'monospace',
            backgroundColor: '#111122', padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(43).setVisible(false)
        .setInteractive()
        .on('pointerover',  function () { this.setStyle({ fill: '#aaa' }); })
        .on('pointerout',   function () { this.setStyle({ fill: '#555577' }); })
        .on('pointerdown',  () => this._closeDialog());

        this._activeLandmark = null;
    }

    /* ── [N2] 開啟對話框 ── */
    _openDialog(lm) {
        if (this.dialogOpen) return;
        this.dialogOpen = true;
        this._activeLandmark = lm;

        // 停止搖桿
        this.joyX = 0; this.joyY = 0;
        this.joyActive = false;
        this.joyStick.setPosition(this.baseX, this.baseY);

        const d = lm.dialog;
        this.dlg.title.setText(d.title);

        this.dlg.rows.forEach((r, i) => {
            i < d.lines.length
                ? r.setText(d.lines[i]).setVisible(true)
                : r.setVisible(false);
        });

        if (d.action) {
            this.dlg.actionBtn.setText(d.actionLabel || '確認').setVisible(true);
        } else {
            this.dlg.actionBtn.setVisible(false);
        }

        [this.dlg.overlay, this.dlg.box, this.dlg.title,
         this.dlg.divider, this.dlg.closeBtn].forEach(e => e.setVisible(true));
    }

    /* ── [N2] 關閉對話框 ── */
    _closeDialog() {
        if (!this.dialogOpen) return;
        this.dialogOpen = false;
        this._activeLandmark = null;

        [this.dlg.overlay, this.dlg.box, this.dlg.title, this.dlg.divider,
         this.dlg.actionBtn, this.dlg.closeBtn].forEach(e => e.setVisible(false));
        this.dlg.rows.forEach(r => r.setVisible(false));
    }

    /* ── [N2] 對話框動作按鈕 ── */
    _dialogAction() {
        if (!this._activeLandmark) return;
        if (this._activeLandmark.dialog.action === 'enter') {
            this._closeDialog();
            this.scene.start('MusicScene');
        }
    }

    /* ── [N3] 互動鍵觸發 ── */
    _triggerInteract() {
        if (this.dialogOpen) return;
        let best = null, bestD = Infinity;
        for (const lm of this.landmarks) {
            const d = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, lm.x, lm.y);
            if (d < lm.interactDist && d < bestD) { bestD = d; best = lm; }
        }
        if (best) this._openDialog(best);
    }

    /* ── update ── */
    update(time) {
        // [N2] 對話框開啟時玩家凍結
        if (this.dialogOpen) return;

        const speed = 5;
        const prevX = this.player.x;
        const prevY = this.player.y;

        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.worldWidth);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.worldHeight);

        /* ── [N1] AABB 碰撞（對所有地標）── */
        for (const lm of this.landmarks) {
            const left   = lm.x - lm.colW;
            const right  = lm.x + lm.colW;
            const top    = lm.y - lm.colH;
            const bottom = lm.y;

            const inside =
                this.player.x > left   && this.player.x < right &&
                this.player.y > top    && this.player.y < bottom;

            if (inside) {
                // 先還原 X
                this.player.x = prevX;

                // 若還原 X 後仍在框內，再還原 Y
                const stillInX =
                    prevX > left && prevX < right &&
                    this.player.y > top && this.player.y < bottom;
                if (stillInX) this.player.y = prevY;
            }
        }

        /* ── 玩家動畫 ── */
        if      (this.joyX < -0.2) this.player.anims.play('walk_left',  true);
        else if (this.joyX >  0.2) this.player.anims.play('walk_right', true);
        else                        this.player.anims.play('idle',       true);

        /* ── [N3] 地標靠近動畫 + 互動鍵顯示 ── */
        let anyNear = false;
        const t = time / 1000;

        for (const lm of this.landmarks) {
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, lm.x, lm.y);
            const near = dist < lm.nearDist;

            if (near && !lm.isNear) {
                // 剛靠近：啟動浮動、光暈淡入
                lm.isNear = true;
                this.tweens.add({ targets: lm.halo, alpha: 0.30, duration: 350 });
            } else if (!near && lm.isNear) {
                // 剛離開：停止浮動、回原位、光暈淡出
                lm.isNear = false;
                this.tweens.add({ targets: lm.halo,   alpha: 0, duration: 300 });
            }

            if (near) anyNear = true;
        }

        // 互動鍵顯示 + 脈衝閃爍
        this.interactBtn.setVisible(anyNear);
        if (anyNear) {
            this.interactBtn.setAlpha(0.72 + 0.28 * Math.sin(t * 5));
        }
    }
}

/* ================================================================
   MusicScene
   ★ Hold Note 相關邏輯（_spawnNote、_updateNotes、_drawHoldBodies、
     _tryHit、_completeHold、_tryHoldRelease）完整保留，未做任何更改
================================================================ */
class MusicScene extends Phaser.Scene {
    constructor() { super('MusicScene'); }

    preload() {
        this.load.audio('music', 'assets/music.mp3');
        this.load.image('ui_bg', 'assets/your_image.jpg');
    }

    create() {

    this.bg = this.add.image(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
         'ui_bg'
        ).setDisplaySize(
        this.cameras.main.width,
        this.cameras.main.height
        );

        this.isPreparing = true;
        this.gameReady   = false;

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
        this.musicStartAudioTime = 0;

        this.touchLanes   = {};   // pointerId → lane
        this.holdingNotes = {};   // lane → note（正在 holding）

        // ── 背景 ──
        this.add.rectangle(W / 2, H / 2, W, H, 0x07070f);

        // ── 軌道 ──
        this.laneGfx = this.add.graphics();
        this._drawLanes();

        // ── 判定線 ──
        this.add.rectangle(W / 2, this.hitY, W, 3, 0xccbbff, 0.8);

        // ── 按鍵區（每幀重繪）──
        this.keyGfx = this.add.graphics();

        // ── Hold 長條（depth 低於 note）──
        this.holdGfx = this.add.graphics().setDepth(1);

        // ── 按鍵標籤 ──
        this._keyLabels = MUSIC_CFG.KEY_LABELS.map((label, i) =>
            this.add.text(
                i * this.laneWidth + this.laneWidth / 2,
                this.hitY + this.keyH / 2,
                label,
                {
                    fontSize: Math.max(12, Math.round(this.laneWidth * 0.28)) + 'px',
                    fontFamily: 'monospace',
                    fill: '#444466',
                }
            ).setOrigin(0.5, 0.5).setAlpha(0.5)
        );

        // ── HUD ──
        this.scoreTxt = this.add.text(W - 16, 12, '0', {
            fontSize: '28px', fill: '#d4caff', fontFamily: 'monospace', align: 'right',
        }).setOrigin(1, 0);

        this.comboTxt = this.add.text(W - 16, 48, '', {
            fontSize: '16px', fill: '#7c70c0', fontFamily: 'monospace', align: 'right',
        }).setOrigin(1, 0);

        this.judgeTxt = this.add.text(W / 2, H * 0.34, '', {
            fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace', align: 'center',
        }).setOrigin(0.5, 0.5).setAlpha(0);

        this.statusTxt = this.add.text(W / 2, H / 2, '載入譜面中…', {
            fontSize: '20px', fill: '#a5e8ff', fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── 離開按鈕 ──
        this.add.text(16, 12, '← 離開', {
            fontSize: '16px', fill: '#666',
            fontFamily: 'monospace',
            backgroundColor: '#111',
            padding: { x: 8, y: 4 },
        })
        .setScrollFactor(0)
        .setInteractive()
        .on('pointerdown', () => {
            if (this.music?.isPlaying) this.music.stop();
            this.scene.start('GameScene');
        });

        // ── 觸控事件 ──
        this.input.on('pointerdown', (ptr) => {
            if (!this.gameReady) return;
            const lane = this._getLane(ptr.x);
            if (lane === -1) return;
            this.touchLanes[ptr.id] = lane;
            this._tryHit(lane, ptr.id);
            this._drawKeys();
        });

        this.input.on('pointerup', (ptr) => {
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) this._tryHoldRelease(lane, false);
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        this.input.on('pointercancel', (ptr) => {
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) this._tryHoldRelease(lane, false);
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        this.scale.on('resize', (gameSize) => {
            const nW = gameSize.width, nH = gameSize.height;
            this.laneWidth = nW / this.laneCount;
            this.hitY      = nH * MUSIC_CFG.HIT_RATIO;
            this.keyH      = nH * MUSIC_CFG.KEY_RATIO;
            this._drawLanes();
            this._drawKeys();
            this._keyLabels.forEach((t, i) => {
                t.setPosition(
                    i * this.laneWidth + this.laneWidth / 2,
                    this.hitY + this.keyH / 2
                );
            });
        });

        this.speedMultiplier = 1.0;
        this.timingOffset    = parseInt(localStorage.getItem('timingOffset')) || 0;

        this._initAsync();
        this._createPrepareUI();
    }

    /* ── 非同步載入 ── */
    async _initAsync() {
        try {
            const data = await this._loadBeatmap('beatmap.txt');
            this.noteQueue = data;
            this.statusTxt.setVisible(false);
            this.music = this.sound.add('music');
            this.musicStartAudioTime = this.sound.context.currentTime;
            this.isPreparing = true;
        } catch (err) {
            console.error('譜面載入失敗', err);
            this.statusTxt.setText('譜面載入失敗\n' + err.message);
        }
        this.isLoaded = true;
    }

    /* ── 準備畫面 ── */
    _createPrepareUI() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.prepareUI = this.add.container(0, 0);

          const bg = this.add.image(W/2, H/2, 'ui_bg')
        .setDisplaySize(W, H);

        this.prepareUI.add(bg);

        this.timingText = this.add.text(W *0.7, H * 0.25, `Timing: ${this.timingOffset} ms`).setOrigin(0.5);
        this.prepareUI.add(this.timingText);

        const startBtn = this.add.text(W *0.77, H * 0.83, '       ', {
            fontSize: '22px', fill: '#fff', padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => this._startGame());
        this.prepareUI.add(startBtn);

        const slider = this._createSpeedSlider(W *0.65, H * 0.35);
        slider.forEach(obj => this.prepareUI.add(obj));

        const calibrateBtn = this.add.text(W / 2, H * 0.65, '校準 Timing', {
            fontSize: '20px', fill: '#fff', backgroundColor: '#555', padding: { x: 16, y: 8 },
        }).setOrigin(0.5).setInteractive()
          .on('pointerdown', () => this.scene.start('CalibrationScene'));
        this.prepareUI.add(calibrateBtn);

       const hardBtn = this.add.text(W * 0.8, H * 0.5, '    ', {
            fontSize: '20px',
            padding: { x: 10, y: 5 }
        }).setInteractive();

        const easyBtn = this.add.text(W * 0.7, H * 0.5, '     ', {
            fontSize: '20px',
            padding: { x: 10, y: 5 }
        }).setInteractive();

        this.prepareUI.add(hardBtn);
        this.prepareUI.add(easyBtn);
    }

    _createSpeedSlider(x, y) {
        const w   = 200;
        const bg  = this.add.rectangle(x, y, w, 6, 0x444444).setOrigin(0, 0.5);
        const hdl = this.add.circle(x + w / 2, y, 10, 0xffffff).setInteractive({ draggable: true });
        const txt = this.add.text(x, y - 30, 'Speed: 1.00x');

        this.input.setDraggable(hdl);
        this.input.off('drag');
        this.input.on('drag', (pointer, obj, dragX) => {
            if (obj !== hdl) return;
            const clamped = Phaser.Math.Clamp(dragX, x, x + w);
            obj.x = clamped;
            const t = (clamped - x) / w;
            this.speedMultiplier = 0.5 + t * 1.5;
            txt.setText(`Speed: ${this.speedMultiplier.toFixed(2)}x`);
        });
        return [bg, hdl, txt];
    }

    _startGame() {
        if (!this.noteQueue.length) { console.log('加載中...'); return; }
        this.prepareUI.destroy();
        this.input.off('drag');
        this.music.play();
        this.musicStartAudioTime = this.sound.context.currentTime;
        this.isPreparing = false;
        this.gameReady   = true;
    }

    /* ── update ── */
    update() {
        if (this.isPreparing || !this.gameReady) return;

        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000
                        + this.timingOffset;

        this._spawnNotes(elapsed);
        this._updateNotes(elapsed);
        this._drawHoldBodies(elapsed);
        this._drawKeys();

        const holdsDone = Object.keys(this.holdingNotes).length === 0;
        if (this.noteQueue.length === 0 && this.activeNotes.length === 0 && holdsDone) {
            this.gameReady = false;
            this._showResult();
        }
        if (this.music && !this.music.isPlaying && this.gameReady) {
            this.gameReady = false;
            this._showResult();
        }
    }

    /* ──────────────────────────────────────────────────────
       ★ 以下 Hold Note 相關方法：完整保留，未做任何更改
    ────────────────────────────────────────────────────── */

    _spawnNotes(elapsed) {
        while (
            this.noteQueue.length &&
            this.noteQueue[0].time <= elapsed + MUSIC_CFG.LOOK_AHEAD
        ) {
            this._spawnNote(this.noteQueue.shift(), elapsed);
        }
    }

    _spawnNote(data, elapsed) {
        const x        = this.laneWidth * data.lane + this.laneWidth / 2;
        const nw       = this.laneWidth * MUSIC_CFG.NOTE_W;
        const timeLeft = data.time - elapsed;
        const y        = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

        const note = this.add.rectangle(x, y, nw, MUSIC_CFG.NOTE_H, MUSIC_CFG.COLORS[data.lane]);
        note.setStrokeStyle(1.5, 0xffffff, 0.3);

        note._noteTime    = data.time;
        note._noteEndTime = data.isHold ? data.endTime : data.time;
        note._lane        = data.lane;
        note._isHold      = data.isHold;
        note._state       = 'alive';

        this.activeNotes.push(note);
    }

    _updateNotes(elapsed) {
        const H = this.cameras.main.height;

        for (const note of this.activeNotes) {
            if (!note.active) continue;

            const timeLeft = note._noteTime - elapsed;
            note.y = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

            if (note._state === 'holding') {
                note.y = this.hitY;
                if (elapsed >= note._noteEndTime) this._completeHold(note);
                continue;
            }

            if (note._state === 'alive' && note._noteTime < elapsed - MUSIC_CFG.WIN_GD) {
                if (!note._isHold) {
                    note._state = 'miss';
                    this._onMiss();
                    note.destroy();
                }
                continue;
            }

            if (!note._isHold && note.y > H + 200) {
                note.destroy();
                continue;
            }

            if (note._isHold) {
                const endTimeLeft = note._noteEndTime - elapsed;
                const tailY = this.hitY - endTimeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;
                if (tailY > H + 200) note.destroy();
            }
        }

        // [B1] 每幀清除已銷毀物件
        this.activeNotes = this.activeNotes.filter(n => n.active);
    }

    _drawHoldBodies(elapsed) {
        const g = this.holdGfx;
        g.clear();

        for (const note of this.activeNotes) {
            if (!note.active) continue;
            if (!note._isHold) continue;
            if (note._state === 'miss' || note._state === 'hit') continue;

            const lane      = note._lane;
            const col       = MUSIC_CFG.COLORS[lane];
            const bw        = this.laneWidth * MUSIC_CFG.NOTE_W;
            const bx        = lane * this.laneWidth + (this.laneWidth - bw) / 2;
            const isHolding = note._state === 'holding';
            const headY     = note.y;

            const endTimeLeft = note._noteEndTime - elapsed;
            const tailY = this.hitY - endTimeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

            const H          = this.cameras.main.height;
            const drawTop    = Math.max(-20, tailY);
            const drawBottom = Math.min(H + 20, headY);
            const drawHeight = drawBottom - drawTop;
            if (drawHeight <= 0) continue;

            g.fillStyle(col, isHolding ? 0.65 : 0.35);
            g.fillRect(bx, drawTop, bw, drawHeight);

            g.lineStyle(1.5, col, isHolding ? 1.0 : 0.55);
            g.strokeRect(bx, drawTop, bw, drawHeight);

            if (isHolding) {
                g.fillStyle(0xffffff, 0.18);
                g.fillRect(bx + bw * 0.25, drawTop, bw * 0.5, drawHeight);
            }

            if (tailY > -10) {
                g.fillStyle(isHolding ? 0xffffff : col, isHolding ? 0.9 : 0.85);
                g.fillRect(bx, tailY - 4, bw, 8);
            }
        }
    }

    _tryHit(lane, pointerId) {
        if (!this.gameReady) return;
        if (this.holdingNotes[lane]) return;

        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;

        let best = null, bestDiff = Infinity;
        for (const n of this.activeNotes) {
            if (!n.active || n._state !== 'alive' || n._lane !== lane) continue;
            const diff = Math.abs(n._noteTime - elapsed);
            if (diff < bestDiff) { bestDiff = diff; best = n; }
        }
        if (!best) return;

        if (bestDiff <= MUSIC_CFG.WIN_PF) {
            if (best._isHold) {
                best._state = 'holding';
                best._hitQuality = 'perfect';
                this.holdingNotes[lane] = best;
                this._showJudge('HOLD ✦', '#c4b8ff');
            } else {
                best._state = 'hit';
                best.destroy();
                this._onHit(300, 'PERFECT ✦', '#c4b8ff');
            }
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            if (best._isHold) {
                best._state = 'holding';
                best._hitQuality = 'good';
                this.holdingNotes[lane] = best;
                this._showJudge('HOLD', '#5fb8ff');
            } else {
                best._state = 'hit';
                best.destroy();
                this._onHit(100, 'GOOD', '#5fb8ff');
            }
        }
    }

    _completeHold(note) {
        const lane  = note._lane;
        const pts   = note._hitQuality === 'perfect' ? 500 : 200;
        const label = note._hitQuality === 'perfect' ? 'PERFECT ✦' : 'GOOD';
        const color = note._hitQuality === 'perfect' ? '#c4b8ff' : '#5fb8ff';
        note._state = 'hit';
        note.destroy();
        delete this.holdingNotes[lane];
        this._onHit(pts, label, color);
    }

    _tryHoldRelease(lane, isCompleted) {
        const note = this.holdingNotes[lane];
        if (!note) return;
        if (isCompleted) {
            this._completeHold(note);
        } else {
            note._state = 'break';
            note.destroy();
            delete this.holdingNotes[lane];
            this._onMiss();
            this._showJudge('BREAK', '#ff8844');
        }
    }

    /* ──────────────────────────────────────────────────────
       ★ Hold Note 方法結束
    ────────────────────────────────────────────────────── */

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

    _showJudge(text, color) {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.judgeTxt
            .setText(text).setStyle({ fill: color })
            .setAlpha(1).setPosition(W / 2, H * 0.34);
        if (this._judgeTimer) this._judgeTimer.remove();
        this._judgeTimer = this.time.delayedCall(400, () => {
            this.tweens.add({ targets: this.judgeTxt, alpha: 0, duration: 200 });
        });
    }

    _drawLanes() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        const g = this.laneGfx;
        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            g.fillStyle(i % 2 === 0 ? 0x111122 : 0x0d0d1a, 1);
            g.fillRect(i * this.laneWidth, 0, this.laneWidth, H);
            g.lineStyle(0.5, 0xffffff, 0.07);
            g.lineBetween(i * this.laneWidth, 0, i * this.laneWidth, H);
        }
        g.lineStyle(0.5, 0xffffff, 0.07);
        g.lineBetween(W, 0, W, H);
    }

    _drawKeys() {
        const g = this.keyGfx;
        const pressed = new Set(Object.values(this.touchLanes));
        Object.keys(this.holdingNotes).forEach(lane => pressed.add(Number(lane)));

        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            const x   = i * this.laneWidth;
            const y   = this.hitY + 2;
            const col = MUSIC_CFG.COLORS[i];
            const isP = pressed.has(i);
            const isH = !!this.holdingNotes[i];

            g.fillStyle(col, isH ? 0.40 : isP ? 0.28 : 0.06);
            g.fillRect(x, y, this.laneWidth, this.keyH);

            g.lineStyle(isH ? 4 : isP ? 3 : 1, col, isH ? 1.0 : isP ? 1.0 : 0.2);
            g.lineBetween(x, y, x + this.laneWidth, y);

            g.lineStyle(isP || isH ? 1.5 : 0.5, col, isP || isH ? 0.7 : 0.12);
            g.strokeRect(x + 1, y, this.laneWidth - 2, this.keyH - 2);
        }

        this._keyLabels?.forEach((t, i) => {
            const isP = pressed.has(i);
            const hex = '#' + MUSIC_CFG.COLORS[i].toString(16).padStart(6, '0');
            t.setStyle({ fill: isP ? hex : '#444466' });
            t.setAlpha(isP ? 1.0 : 0.5);
        });
    }

    _getLane(screenX) {
        const lane = Math.floor(screenX / this.laneWidth);
        return (lane < 0 || lane >= this.laneCount) ? -1 : lane;
    }

    async _loadBeatmap(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        const LANE_W = 512 / MUSIC_CFG.LANES;
        const notes  = []; let inHit = false;
        for (const line of lines) {
            if (line === '[HitObjects]') { inHit = true; continue; }
            if (line.startsWith('[') && inHit) break;
            if (!inHit) continue;
            const p = line.split(',');
            if (p.length < 4) continue;
            const x    = parseInt(p[0]);
            const time = parseInt(p[2]);
            const type = parseInt(p[3]);
            if (isNaN(x) || isNaN(time) || isNaN(type)) continue;
            const isHold = (type & 128) !== 0;
            let endTime = time;
            if (isHold && p[5]) {
                const endRaw = parseInt(p[5].split(':')[0]);
                if (!isNaN(endRaw) && endRaw > time) endTime = endRaw;
            }
            notes.push({
                lane: Math.min(MUSIC_CFG.LANES - 1, Math.floor(x / LANE_W)),
                time, endTime, isHold,
            });
        }
        return notes;
    }

    _parseCsv(lines) {
        const notes = [];
        for (const line of lines) {
            if (line.startsWith('#') || line.startsWith('//')) continue;
            const p = line.split(',');
            if (p.length < 2) continue;
            const time = parseInt(p[0]), lane = parseInt(p[1]);
            if (isNaN(time) || isNaN(lane) || lane < 0 || lane >= MUSIC_CFG.LANES) continue;
            const isHold  = p[2] ? parseInt(p[2]) === 1 : false;
            const endTime = (isHold && p[3]) ? parseInt(p[3]) : time;
            notes.push({ time, lane, isHold, endTime });
        }
        return notes;
    }

    _showResult() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        const judged = this.perfectCnt + this.goodCnt + this.missCnt;
        const acc    = judged ? Math.round((this.perfectCnt + this.goodCnt) / judged * 100) : 0;

        let grade = 'D';
        if (acc >= 95) grade = 'S';
        else if (acc >= 85) grade = 'A';
        else if (acc >= 70) grade = 'B';
        else if (acc >= 55) grade = 'C';

        this.add.rectangle(W / 2, H / 2, W * 0.86, H * 0.68, 0x0f0f22, 0.96)
            .setStrokeStyle(1.5, 0x6c5fff, 0.7);

        const cx = W / 2;
        let oy = H / 2 - H * 0.27;
        const row = (text, color, size, gap = 10) => {
            if (!text) { oy += gap; return; }
            this.add.text(cx, oy, text, {
                fontSize: size + 'px', fill: color, fontFamily: 'monospace',
            }).setOrigin(0.5, 0);
            oy += size + gap;
        };

        row('RESULT',  '#d4caff', 28, 4);
        row('',        '',         0,  8);
        row(`GRADE  ${grade}`, grade === 'S' ? '#ffe066' : '#e0deff', 32, 4);
        row('',        '',         0,  6);
        row(`SCORE  ${this.score.toLocaleString()}`, '#e0deff', 20);
        row(`COMBO  ${this.maxCombo}x`, '#5fb8ff', 18);
        row(`ACC    ${acc}%`, '#5fffb8', 18);
        row('',        '',         0,  4);
        row(`PF ${this.perfectCnt}  GD ${this.goodCnt}  MS ${this.missCnt}`, '#666', 14, 6);

        oy += 10;
        this.add.text(cx, oy, '再玩一次', {
            fontSize: '22px', fill: '#b3aaff', fontFamily: 'monospace',
            backgroundColor: '#1a1a33', padding: { x: 20, y: 10 },
        }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this.music?.stop(); this.scene.restart(); });

        this.add.text(cx, oy + 56, '回到地圖', {
            fontSize: '16px', fill: '#666', fontFamily: 'monospace',
            backgroundColor: '#111', padding: { x: 14, y: 8 },
        }).setOrigin(0.5, 0).setInteractive()
          .on('pointerdown', () => { this.music?.stop(); this.scene.start('GameScene'); });
    }
}
/* ================================================================
   CalibrationScene（完整保留）
================================================================ */
class CalibrationScene extends Phaser.Scene {
    constructor() { super('CalibrationScene'); }

    preload() {
        this.load.audio('tick', 'assets/tick.wav');
        this.load.image('ui_bg', 'assets/your_image.jpg');
    }

    create() {

        const W = this.cameras.main.width, H = this.cameras.main.height;

        this.offsetSamples = [];
        this.isRunning     = false;
        this.bpm           = 120;
        this.interval      = 60000 / this.bpm;

        this.add.text(W / 2, H * 0.3, '點擊節拍進行校準', {
            fontSize: '20px', fill: '#fff',
        }).setOrigin(0.5);

        this.resultText = this.add.text(W / 2, H * 0.6, '', {
            fontSize: '18px', fill: '#aaffaa',
        }).setOrigin(0.5);

        this.add.text(W / 2, H * 0.8, '開始校準', {
            fontSize: '22px', backgroundColor: '#333', padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => this.startCalibration());

        this.input.on('pointerdown', () => {
            if (!this.isRunning) return;
            const now        = this.sound.context.currentTime * 1000;
            const beatIndex  = Math.round((now - this.startTime) / this.interval);
            const nearestBeat = this.startTime + beatIndex * this.interval;
            this.offsetSamples.push(now - nearestBeat);
            this._flash();
        });

        this.add.text(W / 2, H * 0.9, '完成', {
            fontSize: '20px', backgroundColor: '#444', padding: { x: 20, y: 10 },
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => this.finish());
    }

    startCalibration() {
        this.input.once('pointerdown', () => this.sound.context.resume());
        this.isRunning     = true;
        this.offsetSamples = [];
        if (this.timer) this.timer.remove();
        this.timer = this.time.addEvent({
            delay: this.interval, loop: true,
            callback: () => this.playBeat(),
        });
        this.startTime = this.sound.context.currentTime * 1000;
    }

    playBeat() {
        this.sound.play('tick');
        this.lastBeatTime = this.sound.context.currentTime * 1000;
        this._flash();
    }

    _flash() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        const flash = this.add.rectangle(W / 2, H / 2, 200, 200, 0xffffff).setAlpha(0.8);
        this.tweens.add({
            targets: flash, alpha: 0, duration: 200,
            onComplete: () => flash.destroy(),
        });
    }

    finish() {
        if (!this.offsetSamples.length) return;
        const avg    = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
        const offset = Math.round(avg);
        this.resultText.setText(`校準結果: ${offset} ms`);
        localStorage.setItem('timingOffset', offset);
        this.isRunning = false;
        if (this.timer) this.timer.remove();
    }
}

/* ================================================================
   Phaser 設定
================================================================ */
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width:  960,
    height: 540,
    backgroundColor: '#000000',
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
    scene: [StartScene, GameScene, MusicScene, CalibrationScene],
};

new Phaser.Game(config);
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

/* =====GameScene===== */

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

const MUSIC_CFG = {
    LANES:      7,
    NOTE_SPEED: 400,
    HIT_RATIO:  0.82,
    KEY_RATIO:  0.13,
    NOTE_W:     0.80,
    NOTE_H:     16,
    WIN_PF:     55,
    WIN_GD:     110,
    LOOK_AHEAD: 1600,
    COLORS: [0x7c6fff, 0x5fb8ff, 0x5fffb8, 0xffe066, 0xff7eb3, 0xff6f6f, 0xc084fc],
    KEY_LABELS: ['①', '②', '③', '④', '⑤', '⑥', '⑦'],
};

class MusicScene extends Phaser.Scene {
    constructor() {
        super('MusicScene');
    }

    preload() {
        this.load.audio('music', 'assets/music.mp3');
    }

    create() {

        this.isPreparing = true;
        this.gameReady = false;

        this.input.addPointer(9);

        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.laneCount = MUSIC_CFG.LANES;
        this.laneWidth = W / this.laneCount;
        this.hitY      = H * MUSIC_CFG.HIT_RATIO;
        this.keyH      = H * MUSIC_CFG.KEY_RATIO;

        // ── 狀態 ──
        this.noteQueue   = [];
        this.activeNotes = [];  // 一般 note + hold note 頭部
        this.score       = 0;
        this.combo       = 0;
        this.maxCombo    = 0;
        this.perfectCnt  = 0;
        this.goodCnt     = 0;
        this.missCnt     = 0;
        this.gameReady   = false;
        this.musicStartAudioTime = 0;

        // 觸控：pointerId → lane
        this.touchLanes = {};
        // 各 lane 目前正在 holding 的 note（lane → note object）
        this.holdingNotes = {};

        // ── 背景 ──
        this.add.rectangle(W / 2, H / 2, W, H, 0x07070f);

        // ── 軌道 ──
        this.laneGfx = this.add.graphics();
        this._drawLanes();

        // ── 判定線 ──
        this.add.rectangle(W / 2, this.hitY, W, 3, 0xccbbff, 0.8);

        // ── 按鍵區（每幀重繪） ──
        this.keyGfx = this.add.graphics();

        // Hold note 的長條 graphics（在一般 note 底下）
        this.holdGfx = this.add.graphics();
        // 確保 holdGfx 在 note 之下（先加入場景）
        // 注意：Phaser 的 depth 預設都是 0，後加入的在上層
        // 我們讓 holdGfx depth = -1，note rect depth = 0
        this.holdGfx.setDepth(1);

        // ── 按鍵標籤 ──
        this._keyLabels = MUSIC_CFG.KEY_LABELS.map((label, i) =>
            this.add.text(
                i * this.laneWidth + this.laneWidth / 2,
                this.hitY + this.keyH / 2,
                label,
                {
                    fontSize: Math.max(12, Math.round(this.laneWidth * 0.28)) + 'px',
                    fontFamily: 'monospace',
                    fill: '#444466',
                }
            ).setOrigin(0.5, 0.5).setAlpha(0.5)
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
            if (this.music?.isPlaying) this.music.stop();
            this.scene.start('GameScene');
        });

        // ── 觸控事件 ──
        this.input.on('pointerdown', (ptr) => {
            if (!this.gameReady) return;
            const lane = this._getLane(ptr.x);
            if (lane === -1) return;
            this.touchLanes[ptr.id] = lane;
            this._tryHit(lane, ptr.id);
            this._drawKeys();
        });

        this.input.on('pointerup', (ptr) => {
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) {
                // 手指放開：如果還在 holding，判定 break
                this._tryHoldRelease(lane, false);
            }
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        this.input.on('pointercancel', (ptr) => {
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) {
                this._tryHoldRelease(lane, false);
            }
            delete this.touchLanes[ptr.id];
            this._drawKeys();
        });

        this.scale.on('resize', (gameSize) => {
            const nW = gameSize.width;
            const nH = gameSize.height;
            this.laneWidth = nW / this.laneCount;
            this.hitY      = nH * MUSIC_CFG.HIT_RATIO;
            this.keyH      = nH * MUSIC_CFG.KEY_RATIO;
            this._drawLanes();
            this._drawKeys();
            this._keyLabels.forEach((t, i) => {
                t.setPosition(
                    i * this.laneWidth + this.laneWidth / 2,
                    this.hitY + this.keyH / 2
                );
            });
        });

        this.speedMultiplier = 1.0;

        this.timingOffset = parseInt(localStorage.getItem('timingOffset')) || 0;
       
        this._initAsync();

        this._createPrepareUI();
    }

    async _initAsync() {
        try {
            const data = await this._loadBeatmap('beatmap.txt');
            this.noteQueue = data;
            this.statusTxt.setVisible(false);

            this.music = this.sound.add('music');

            this.musicStartAudioTime = this.sound.context.currentTime;
            this.isPreparing = true;
        } 
        catch (err) {
            console.error('譜面載入失敗', err);
            this.statusTxt.setText('譜面載入失敗\n' + err.message);
        }
        this.isLoaded = true;
    }

    _createPrepareUI() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.prepareUI = this.add.container(0, 0);

        const bg = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7);
        this.prepareUI.add(bg);

        const title = this.add.text(W/2, H*0.2, '準備開始', {
            fontSize: '28px',
            fill: '#fff'
        }).setOrigin(0.5);
        this.prepareUI.add(title);

        // 👉 滑桿也要自己改成回傳物件再 add 進來（或直接寫在這裡）

        this.timingText = this.add.text(W/2, H*0.55, 'Timing: 0 ms')
            .setOrigin(0.5);
        this.prepareUI.add(this.timingText);

        const startBtn = this.add.text(W/2, H*0.75, '開始遊戲', {
            fontSize: '22px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => this._startGame());

        this.prepareUI.add(startBtn);

        const slider = this._createSpeedSlider(W/2 - 100, H*0.4);
        slider.forEach(obj => this.prepareUI.add(obj));

        const calibrateBtn = this.add.text(W/2, H*0.65, '校準 Timing', {
        fontSize: '20px',
        fill: '#fff',
        backgroundColor: '#555',
        padding: { x: 16, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            this.scene.start('CalibrationScene');
        });

        this.prepareUI.add(calibrateBtn);

        this.timingText.setText(`Timing: ${this.timingOffset} ms`);
    }

   _createSpeedSlider(x, y) {
        const w = 200;

        const bg = this.add.rectangle(x, y, w, 6, 0x444444)
            .setOrigin(0, 0.5);

        const handle = this.add.circle(x + w/2, y, 10, 0xffffff)
            .setInteractive({ draggable: true });

        const text = this.add.text(x, y - 30, 'Speed: 1.00x');

        this.input.setDraggable(handle);

        this.input.off('drag');

        this.input.on('drag', (pointer, obj, dragX) => {
            if (obj !== handle) return;

            const clamped = Phaser.Math.Clamp(dragX, x, x + w);
            obj.x = clamped;

            const t = (clamped - x) / w;
            this.speedMultiplier = 0.5 + t * 1.5;

            text.setText(`Speed: ${this.speedMultiplier.toFixed(2)}x`);
        });

        return [bg, handle, text]; // 👈 回傳！
    }

   _startGame() {

        if (!this.noteQueue.length) {
            console.log('加載中...');
            return;
        }
        this.prepareUI.destroy(); 
        this.input.off('drag');

        this.music.play();
        this.musicStartAudioTime = this.sound.context.currentTime;

        this.isPreparing = false;
        this.gameReady = true;
    }

    update() {
        if (this.isPreparing) return;
        if (!this.gameReady) return;
        
        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;

        this._spawnNotes(elapsed);
        this._updateNotes(elapsed);
        this._drawHoldBodies(elapsed);   // 每幀重繪 hold 長條
        this._drawKeys();                // 每幀重繪按鍵區（含 holding 光效）

        if (this.noteQueue.length === 0 && this.activeNotes.length === 0
            && Object.keys(this.holdingNotes).length === 0) {
            this.gameReady = false;
            this._showResult();
        }

        if (this.music && !this.music.isPlaying && this.gameReady) {
        this.gameReady = false;
        this._showResult();
        }
    }

    // ── 生成 Note ───
    _spawnNotes(elapsed) {
        while (
            this.noteQueue.length &&
            this.noteQueue[0].time <= elapsed + MUSIC_CFG.LOOK_AHEAD
        ) {
            this._spawnNote(this.noteQueue.shift(), elapsed);
        }
    }

    _spawnNote(data, elapsed) {
        const x      = this.laneWidth * data.lane + this.laneWidth / 2;
        const nw     = this.laneWidth * MUSIC_CFG.NOTE_W;
        const timeLeft = data.time - elapsed;
        const y      = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

        // 頭部矩形（一般 note 和 hold note 共用）
        const note = this.add.rectangle(x, y, nw, MUSIC_CFG.NOTE_H,
            MUSIC_CFG.COLORS[data.lane]);
        note.setStrokeStyle(1.5, 0xffffff, 0.3);

        note._noteTime    = data.time;
        note._noteEndTime = data.isHold ? data.endTime : data.time; // hold 的尾部時間
        note._lane        = data.lane;
        note._isHold      = data.isHold;
        note._state       = 'alive';   // alive | holding | hit | miss | break

        this.activeNotes.push(note);
    }

    _updateNotes(elapsed) {
        const H = this.cameras.main.height;

        for (const note of this.activeNotes) {
            if (!note.active) continue;

            // 所有狀態都照 noteTime 正常移動
            const timeLeft = note._noteTime - elapsed;
            note.y = this.hitY - timeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

                if (note._state === 'holding') {
                    note.y = this.hitY; // ← 這行超重要！！！

                    if (elapsed >= note._noteEndTime) {
                        this._completeHold(note);
                    }
                    continue;
                }

                if (note._state === 'alive' && note._noteTime < elapsed - MUSIC_CFG.WIN_GD) {
                    if (!note._isHold) {
                        note._state = 'miss';
                        this._onMiss();
                        note.destroy();
                    }
                    continue;
                }

                //    一般note
                if (!note._isHold && note.y > H + 200) {
                    note.destroy();
                }

             // hold note：要看尾巴
             if (note._isHold) {
                const endTimeLeft = note._noteEndTime - elapsed;
                const tailY = this.hitY - endTimeLeft * MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

                    if (tailY > H + 200) {
                        note.destroy();
                    }
                }
                this.activeNotes = this.activeNotes.filter(n => n.active);
        }
    }

    // ── 繪製 Hold 長條（每幀） ────────────────────────────
    _drawHoldBodies(elapsed) {
        const g = this.holdGfx;
        g.clear();

            for (const note of this.activeNotes) {
            if (!note.active) continue;
            if (!note._isHold) continue;
            if (note._state === 'miss' || note._state === 'hit') continue;

            const lane = note._lane;
            const col  = MUSIC_CFG.COLORS[lane];
            const bw   = this.laneWidth * MUSIC_CFG.NOTE_W;
            const bx   = lane * this.laneWidth + (this.laneWidth - bw) / 2;
            const isHolding = note._state === 'holding';

            // 頭部（noteTime）
            const headY = note.y;

            // 尾部（endTime）
            const endTimeLeft = note._noteEndTime - elapsed;
            const tailY = this.hitY - endTimeLeft *MUSIC_CFG.NOTE_SPEED * this.speedMultiplier / 1000;

            // 只繪製畫面內的部分
            const H = this.cameras.main.height;
            const drawTop    = Math.max(-20, tailY);
            const drawBottom = Math.min(H + 20, headY);
            const drawHeight = drawBottom - drawTop;
            if (drawHeight <= 0) continue;

            // 長條主體
            g.fillStyle(col, isHolding ? 0.65 : 0.35);
            g.fillRect(bx, drawTop, bw, drawHeight);

            // 長條邊框
            g.lineStyle(1.5, col, isHolding ? 1.0 : 0.55);
            g.strokeRect(bx, drawTop, bw, drawHeight);

            // holding 時中心發光帶
            if (isHolding) {
                g.fillStyle(0xffffff, 0.18);
                g.fillRect(bx + bw * 0.25, drawTop, bw * 0.5, drawHeight);
            }

            // 尾部頂邊亮條（在畫面內才畫）
            if (tailY > -10) {
                g.fillStyle(isHolding ? 0xffffff : col, isHolding ? 0.9 : 0.85);
                g.fillRect(bx, tailY - 4, bw, 8);
            }
        }
    }

    // ── 判定：嘗試擊中 ────────────────────────────────────
    _tryHit(lane, pointerId) {
        if (!this.gameReady) return;

        // 如果這個 lane 已有 holding，不重複觸發
        if (this.holdingNotes[lane]) return;

        const elapsed = (this.sound.context.currentTime - this.musicStartAudioTime) * 1000 + this.timingOffset;

        let best = null, bestDiff = Infinity;
        for (const n of this.activeNotes) {
            if (!n.active || n._state !== 'alive' || n._lane !== lane) continue;
            const diff = Math.abs(n._noteTime - elapsed);
            if (diff < bestDiff) { bestDiff = diff; best = n; }
        }

        if (!best) return;

        if (bestDiff <= MUSIC_CFG.WIN_PF) {
            if (best._isHold) {
                // Hold note：進入 holding 狀態，等待手指放開
                best._state = 'holding';
                best._hitQuality = 'perfect';
                this.holdingNotes[lane] = best;
                this._showJudge('HOLD ✦', '#c4b8ff');
            } else {
                best._state = 'hit';
                best.destroy();
                this._onHit(300, 'PERFECT ✦', '#c4b8ff');
            }
        } else if (bestDiff <= MUSIC_CFG.WIN_GD) {
            if (best._isHold) {
                best._state = 'holding';
                best._hitQuality = 'good';
                this.holdingNotes[lane] = best;
                this._showJudge('HOLD', '#5fb8ff');
            } else {
                best._state = 'hit';
                best.destroy();
                this._onHit(100, 'GOOD', '#5fb8ff');
            }
        }
    }

    // ── Hold 自動完成（尾部到達判定線）────────────────────
    _completeHold(note) {
        const lane = note._lane;
        const pts  = note._hitQuality === 'perfect' ? 500 : 200;
        const label = note._hitQuality === 'perfect' ? 'PERFECT ✦' : 'GOOD';
        const color = note._hitQuality === 'perfect' ? '#c4b8ff' : '#5fb8ff';

        note._state = 'hit';
        note.destroy();
        delete this.holdingNotes[lane];
        this._onHit(pts, label, color);
    }

    // ── Hold 中途放開（break）────────────────────────────
    _tryHoldRelease(lane, isCompleted) {
        const note = this.holdingNotes[lane];
        if (!note) return;

        if (isCompleted) {
            this._completeHold(note);
        } else {
            // 尾部還沒到 → break
            note._state = 'break';
            note.destroy();
            delete this.holdingNotes[lane];
            this._onMiss();
            this._showJudge('BREAK', '#ff8844');
        }
    }

    // ── 得分 / Miss ───────────────────────────────────────
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
            g.fillStyle(i % 2 === 0 ? 0x111122 : 0x0d0d1a, 1);
            g.fillRect(i * this.laneWidth, 0, this.laneWidth, H);
            g.lineStyle(0.5, 0xffffff, 0.07);
            g.lineBetween(i * this.laneWidth, 0, i * this.laneWidth, H);
        }
        g.lineStyle(0.5, 0xffffff, 0.07);
        g.lineBetween(W, 0, W, H);
    }

    // ── 畫按鍵區 ──────────────────────────────────────────
    _drawKeys() {
        const g = this.keyGfx;
        const pressed = new Set(Object.values(this.touchLanes));
        // holding 中的 lane 也算按壓
        Object.keys(this.holdingNotes).forEach(lane => pressed.add(Number(lane)));

        g.clear();
        for (let i = 0; i < this.laneCount; i++) {
            const x   = i * this.laneWidth;
            const y   = this.hitY + 2;
            const col = MUSIC_CFG.COLORS[i];
            const isP = pressed.has(i);
            const isH = !!this.holdingNotes[i];   // 正在 hold

            // 底色
            g.fillStyle(col, isH ? 0.40 : isP ? 0.28 : 0.06);
            g.fillRect(x, y, this.laneWidth, this.keyH);

            // 上緣亮線（hold 時更粗）
            g.lineStyle(isH ? 4 : isP ? 3 : 1, col, isH ? 1.0 : isP ? 1.0 : 0.2);
            g.lineBetween(x, y, x + this.laneWidth, y);

            // 外框
            g.lineStyle(isP || isH ? 1.5 : 0.5, col, isP || isH ? 0.7 : 0.12);
            g.strokeRect(x + 1, y, this.laneWidth - 2, this.keyH - 2);
        }

        this._keyLabels?.forEach((t, i) => {
            const isP = pressed.has(i);
            const hex = '#' + MUSIC_CFG.COLORS[i].toString(16).padStart(6, '0');
            t.setStyle({ fill: isP ? hex : '#444466' });
            t.setAlpha(isP ? 1.0 : 0.5);
        });
    }

    // ── 取得軌道 index ────────────────────────────────────
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

    // osu! 格式：hold note 尾部時間在第 6 欄（index 5）冒號前
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

            const isHold = (type & 128) !== 0;
            // Hold note 尾部時間格式：endTime:hitsound:...
            let endTime = time;
            if (isHold && p[5]) {
                const endRaw = parseInt(p[5].split(':')[0]);
                if (!isNaN(endRaw) && endRaw > time) endTime = endRaw;
            }

            notes.push({
                lane: Math.min(MUSIC_CFG.LANES - 1, Math.floor(x / LANE_W)),
                time,
                endTime,
                isHold,
            });
        }
        return notes;
    }

    // CSV 格式：time_ms,lane[,isHold[,endTime_ms]]
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
            const isHold = p[2] ? parseInt(p[2]) === 1 : false;
            const endTime = (isHold && p[3]) ? parseInt(p[3]) : time;
            notes.push({ time, lane, isHold, endTime });
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

        this.add.rectangle(W / 2, H / 2, W * 0.86, H * 0.68, 0x0f0f22, 0.96)
            .setStrokeStyle(1.5, 0x6c5fff, 0.7);

        const cx = W / 2;
        let oy = H / 2 - H * 0.27;
        const row = (text, color, size, gap = 10) => {
            if (!text) { oy += gap; return; }
            this.add.text(cx, oy, text, {
                fontSize: size + 'px', fill: color, fontFamily: 'monospace'
            }).setOrigin(0.5, 0);
            oy += size + gap;
        };

        row('RESULT',  '#d4caff', 28, 4);
        row('',        '',         0, 8);
        row(`GRADE  ${grade}`, grade === 'S' ? '#ffe066' : '#e0deff', 32, 4);
        row('',        '',         0, 6);
        row(`SCORE  ${this.score.toLocaleString()}`, '#e0deff', 20);
        row(`COMBO  ${this.maxCombo}x`, '#5fb8ff', 18);
        row(`ACC    ${acc}%`, '#5fffb8', 18);
        row('',        '',         0, 4);
        row(`PF ${this.perfectCnt}  GD ${this.goodCnt}  MS ${this.missCnt}`, '#666', 14, 6);

        oy += 10;

        this.add.text(cx, oy, '再玩一次', {
            fontSize: '22px', fill: '#b3aaff', fontFamily: 'monospace',
            backgroundColor: '#1a1a33', padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5, 0).setInteractive()
        .on('pointerdown', () => {
            if (this.music?.isPlaying) this.music.stop();
            this.scene.restart();
        });

        this.add.text(cx, oy + 56, '回到地圖', {
            fontSize: '16px', fill: '#666', fontFamily: 'monospace',
            backgroundColor: '#111', padding: { x: 14, y: 8 }
        })
        .setOrigin(0.5, 0).setInteractive()
        .on('pointerdown', () => {
            if (this.music?.isPlaying) this.music.stop();
            this.scene.start('GameScene');
        });
    }
}

class CalibrationScene extends Phaser.Scene {
    constructor() {
        super('CalibrationScene');
    }

    preload() {
        this.load.audio('tick', 'assets/tick.wav');
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        this.offsetSamples = [];
        this.isRunning = false;

        this.bpm = 120;
        this.interval = 60000 / this.bpm;

        this.text = this.add.text(W/2, H*0.3, '點擊節拍進行校準', {
            fontSize: '20px',
            fill: '#fff'
        }).setOrigin(0.5);

        this.resultText = this.add.text(W/2, H*0.6, '', {
            fontSize: '18px',
            fill: '#aaffaa'
        }).setOrigin(0.5);

        const startBtn = this.add.text(W/2, H*0.8, '開始校準', {
            fontSize: '22px',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => this.startCalibration());

        this.input.on('pointerdown', () => {
        if (!this.isRunning) return;

        const now = this.sound.context.currentTime * 1000;

        // 找最近的拍點
        const beatIndex = Math.round((now - this.startTime) / this.interval);
        const nearestBeat = this.startTime + beatIndex * this.interval;

        const diff = now - nearestBeat;

        this.offsetSamples.push(diff);

        this._flash();
    });

        const finishBtn = this.add.text(W/2, H*0.9, '完成', {
            fontSize: '20px',
            backgroundColor: '#444',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => this.finish());

    }

    startCalibration() {
        // 用 pointerdown 觸發音訊解鎖
        this.input.once('pointerdown', () => {
            this.sound.context.resume();
        });

        this.isRunning = true;
        this.offsetSamples = [];

        if (this.timer) this.timer.remove();

        this.timer = this.time.addEvent({
            delay: this.interval,
            loop: true,
            callback: () => {
                this.playBeat();
            }
        });

        this.startTime = this.sound.context.currentTime * 1000;
    }

    playBeat() {
        this.sound.play('tick');

        this.lastBeatTime = this.sound.context.currentTime * 1000;

        this._flash();
    }

    _flash() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        const flash = this.add.rectangle(W/2, H/2, 200, 200, 0xffffff)
            .setAlpha(0.8);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy()
        });
    }

    finish() {
        if (this.offsetSamples.length === 0) return;

        const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
        const offset = Math.round(avg);

        this.resultText.setText(`校準結果: ${offset} ms`);
        localStorage.setItem('timingOffset', offset);

        this.isRunning = false;

        if (this.timer) this.timer.remove(); // 停止節拍
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
    scene: [StartScene, GameScene, MusicScene, CalibrationScene]
};

new Phaser.Game(config);
