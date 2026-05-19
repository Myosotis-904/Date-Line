'use strict';
const API = {
    BUG_URL: 'https://script.google.com/macros/s/AKfycbwM2J5p6scneB-d7DpeQVa-usWjEj0n7nMHP79J5JHuGR_Q1OlQSbsB5sGpD9igY82JEQ/exec',
    MSG_URL: 'https://script.google.com/macros/s/AKfycbwM2J5p6scneB-d7DpeQVa-usWjEj0n7nMHP79J5JHuGR_Q1OlQSbsB5sGpD9igY82JEQ/exec',
};

/* ================================================================
   [iOS-FIX-1] 安全的 localStorage 存取封裝
   iOS Safari 私密模式下 localStorage 會拋出例外
================================================================ */
const SafeStorage = {
    getItem(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    },
    setItem(key, value) {
        try { localStorage.setItem(key, value); } catch(e) { /* silent fail */ }
    },
};

const GSheets = {
    async post(url, data) {
        if (!url || url.startsWith('YOUR_')) {
            console.warn('[GSheets] URL 尚未設定，資料僅印出：', data);
            return { ok: false, reason: 'no_url' };
        }
        try {
            const body = new URLSearchParams(data).toString();
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            return { ok: true };
        } catch (e) {
            console.error('[GSheets] post failed', e);
            return { ok: false, reason: e.message };
        }
    },
    async get(url, params = {}) {
        if (!url || url.startsWith('YOUR_')) {
            console.warn('[GSheets] URL 尚未設定，回傳空留言。');
            return [];
        }
        try {
            const qs  = new URLSearchParams({ ...params, action: 'read' }).toString();
            const res = await fetch(`${url}?${qs}`);
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data ?? []);
        } catch (e) {
            console.error('[GSheets] get failed', e);
            return [];
        }
    },
};

/* ================================================================
   [FIX-4] 全域玩家位置記憶（退出音樂場景後保留位置）
================================================================ */
const PlayerState = {
    x: null,
    y: null,
    save(x, y) { this.x = x; this.y = y; },
    load() { return { x: this.x, y: this.y }; },
    hasPosition() { return this.x !== null && this.y !== null; },
};

/* ================================================================
   地標資料表
================================================================ */
const LANDMARKS = [

 // ── [NEW-5] 海浪地標（動態精靈圖，垂直4幀，每幀2000x250）──
    {
        key: 'wave', x: 720, y: 890, scale: 0.719,
        // colW: 200, colH: 60,
        nearDist: 180, interactDist: 220,
        isWave: true,         // 標記為海浪動畫地標
        dialog: {
            title: '海浪',
            lines: [' '],
        },
    },

    {
        key: 'cord',
        x: 1070, y: 1500, scale: 0.4,
        colW: 30, colH: 35,
        nearDist: 150, interactDist: 190,
        dialog: {
            title: '沙灘藝術...?',
            lines: [
                '沒有人跟你說來路不明的 QR Cord 不要亂掃嗎?',
                '我已經提醒過你了。'
            ],
            action: 'open_link',          
            actionLabel: '🌟打開連結', 
        },
    },

    {
        key: 'stage', x: 300, y: 1450, scale: 2.5,
        colW: 150, colH: 110,
        nearDist: 200, interactDist: 240,
        dialog: {
            title: '5/27-5/29 畢業歌音樂會',
            lines: ['這是主要演出場地。', '進入舞台可遊玩音樂節奏遊戲！'],
            action: 'enter',
            actionLabel: '▶  進入舞台',
        },
    },

     {
        key: 'cocona', x: 980, y: 2100, scale: 0.8,
        colW: 30, colH: 35,
        nearDist: 150, interactDist: 190,
        dialog: {
            title: '椰子樹',
            lines: ['這是一棵椰子樹'],
        },
    },

     {
        key: 'mailbox', x: 1350, y: 1670, scale: 0.12,
        colW: 40, colH: 55,
        nearDist: 160, interactDist: 200,
        dialog: {
            title: '神奇海螺(留言板)',
            lines: ['為什麼不告訴神奇海螺呢?',' ', '(神奇海螺會把秘密告訴所有人。)'],
            action: 'guestbook',
            actionLabel: '💬 開啟留言板',
        },
    },

    {
        key: 'tree1', x: 1120, y: 2160, scale: 0.8,
        colW: 30, colH: 35,
        nearDist: 150, interactDist: 190,
        dialog: {
            title: '海邊的草叢',
            lines: ['只是普通的草叢，', '撞一撞有機會穿模卡在裡面。'],
        },
    },
    {
        key: 'tree2', x: 320, y: 2160, scale: 0.8,
        colW: 30, colH: 50,
        nearDist: 80, interactDist: 100,
        dialog: {
            title: '另一邊的草叢',
            lines: ['好像散發奇怪的氣息...?', '感覺不要靠太近比較好...'],
        },
    },

    {
        key: 'crab', x: 320, y: 2000, scale: 0.8,
        colW: 30, colH: 50,
        nearDist: 80, interactDist: 100,
        dialog: {
            title: '螃蟹',
            lines: ['放心他不會把你丟出蟹堡王。',' 還有他真的沒熟。'],
        },
    },

    {
        key: 'sign', x: 540, y: 2090, scale: 0.6,
        colW: 40, colH: 40,
        nearDist: 140, interactDist: 180,
        dialog: {
            title: '場地公告牌',
            lines: [
                '高雄女中第78屆畢業典禮-換日線',
                '這是一個看起來有一點潦草的導覽網站，',
                '路邊長出來的怪東西都可以戳戳看，有機會會跟你說話。',
                '呃我程式寫的一坨史，有bug或建議可以去舞台邊找綠兔子回報。大感謝!',
            ],
        },
    },
    {
        key: 'bunny', x: 540, y: 1480, scale: 0.5,
        colW: 35, colH: 50,
        nearDist: 160, interactDist: 200,
        dialog: {
            title: '可疑的綠色兔子',
            lines: ['發現 bug 或有建議嗎？', '點下面填寫回報，我會努力修修看:)'],
            action: 'bug_report',
            actionLabel: '📝 填寫回報',
        },
    },
    // ── [NEW-1] 吉祥物（太陽）地標 ──
    {
        key: 'sun', x:1300, y: 1900, scale: 0.2,
        colW: 50, colH: 60,
        nearDist: 170, interactDist: 210,
        floatAmplitude: 12,   // 上下漂浮幅度（像素）
        floatSpeed: 1.8,      // 漂浮速度
        hasShadow: true,      // 開啟陰影
        dialog: {
            title: '✨太陽朋友',
            lines: [, '想知道更多相關資訊嗎？', '快去追蹤我們的 IG 吧！'],
            action: 'open_ig',
            actionLabel: '🌟 前往 IG',
        },
    },
    // ── [NEW-2] 漂流瓶地標 ──
    {
        key: 'buttle', x: 300, y: 300, scale: 0.9,
        colW: 35, colH: 50,
        nearDist: 160, interactDist: 200,
        floatAmplitude: 8,
        floatSpeed: 1.9,
        hasShadow: true,
        dialog: {
            title: '漂流瓶',
            lines: ['瓶子裡好像裝著什麼...', '要打開來看看嗎？'],
            action: 'show_card',
            actionLabel: '💌 打開漂流瓶',
        },
    },

];

/* ================================================================
   音樂場景設定
================================================================ */
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

    preload() {
    this.load.image('start_bg', 'assets/start_bg.png'); 
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        this.add.image(W/2-5, H/2, 'start_bg')
        .setDisplaySize(W, H);

        this.add.text(W / 2, H * 0.578 , 'D A T E L I N E', {
            fontSize: '13px', fill: '#3d3470', fontFamily: 'monospace', letterSpacing: 7,
        }).setOrigin(0.5);

        const hint = this.add.text(W / 2, H * 0.75 , '觸碰或按任意鍵開始', {
            fontSize: '20px', fill: '#a5e8ff',
            fontFamily: "'Noto Sans TC', monospace", letterSpacing: 3,
        }).setOrigin(0.5);
        this.tweens.add({ targets: hint, alpha: 0.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
        this.load.image('map',     'assets/map.png');
        this.load.image('stage',   'assets/stage.png');
        this.load.image('tree1',   'assets/tree1.png');
        this.load.image('tree2',   'assets/tree2.png');
        this.load.image('cocona',  'assets/cocona.png');
        this.load.image('sign',    'assets/sign.png');
        this.load.image('crab',    'assets/crab.png');
        this.load.image('cord',    'assets/cord.png');
        this.load.image('bunny',   'assets/bunny.png');
        this.load.image('mailbox', 'assets/mailbox.png');
        this.load.image('btn_idle', 'assets/btn_idle.png');
        this.load.image('btn_active', 'assets/btn_active.png');
        this.load.image('sun',     'assets/sun.png');      // [NEW-1] 吉祥物
        this.load.image('buttle',  'assets/buttle.png');   // [NEW-2] 漂流瓶
        this.load.image('card',    'assets/card.png');     // [NEW-2] 邀請卡
        this.load.spritesheet('wave', 'assets/wave.png',{ frameWidth: 2000, frameHeight: 1240 });
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
    }

    create() {
        this.input.addPointer(5);
        setTimeout(() => this.scale.refresh(), 200);
        this.dialogOpen = false;

        /* ── 地圖 ── */
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);
        const mapScale = Math.max(this.scale.width / this.map.width, this.scale.height / this.map.height) * 1.5;
        this.map.setScale(mapScale);
        this.worldWidth  = this.map.width  * mapScale;
        this.worldHeight = this.map.height * mapScale;
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        /* ── [NEW-5] 海浪動畫 ── */
        this.anims.create({
            key: 'wave_anim',
            frames: [0,1,2,3,2,1].map(f => ({
                key: 'wave',
                frame: f
            })),
            frameRate: 2.5,
            repeat: -1,
        });
        /* ── 地標 ── */
        this.landmarks = LANDMARKS.map(def => {
            let sprite;

            if (def.isWave) {
                // [NEW-5] 海浪：使用 Sprite 並播放動畫
                sprite = this.add.sprite(def.x, def.y, 'wave').setOrigin(0.5, 1).setScale(def.scale).setDepth(5);
                sprite.play('wave_anim');
                sprite.anims.setProgress(Math.random());
            } else {
                sprite = this.add.image(def.x, def.y, def.key).setOrigin(0.5, 1).setScale(def.scale).setDepth(5);
            }

            const halo = this.add.ellipse(def.x, def.y - 8, def.colW * 2.8, 28, 0x9988ff, 0).setDepth(4);

            // [NEW-1][NEW-2] 漂浮陰影（橢圓）
            let shadow = null;
            if (def.hasShadow) {
                shadow = this.add.ellipse(def.x, def.y - 4, def.colW * 2.2, 18, 0x000000, 0.25).setDepth(4);
            }

            return { ...def, sprite, halo, shadow, isNear: false, _floatOffset: Math.random() * Math.PI * 2 };
        });

        /* ── 玩家 ── */
        // [FIX-4] 優先使用記憶的位置
        const savedPos = PlayerState.load();
        const startX = PlayerState.hasPosition() ? savedPos.x : this.worldWidth / 2;
        const startY = PlayerState.hasPosition() ? savedPos.y : this.worldHeight - 50;

        this.player = this.add.sprite(startX, startY, 'player')
            .setOrigin(0.5, 1).setScale(0.7).setDepth(10);

        if (!this.anims.exists('idle'))
            this.anims.create({ key:'idle', frames:[0,1].map(f=>({key:'player',frame:f})), frameRate:2, repeat:-1 });
        if (!this.anims.exists('walk_left'))
            this.anims.create({ key:'walk_left', frames:[2,3,4,3].map(f=>({key:'player',frame:f})), frameRate:4, repeat:-1 });
        if (!this.anims.exists('walk_right'))
            this.anims.create({ key:'walk_right', frames:[5,6,7,6].map(f=>({key:'player',frame:f})), frameRate:4, repeat:-1 });
        this.player.anims.play('idle');
        this.cameras.main.startFollow(this.player);

        /* ── 搖桿 ── */
        this.baseX = 120; this.baseY = this.scale.height - 120;
        this.joyBase  = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4).setScrollFactor(0).setDepth(20);
        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7).setScrollFactor(0).setDepth(21);
        this.joyActive = false; this.joyPointerId = null; this.joyX = 0; this.joyY = 0;

        this.input.on('pointerdown', (ptr) => {
            if (this.dialogOpen) return;
            if (this.joyActive) return;
            const sx = ptr.x, sy = ptr.y;
            if (sx < this.scale.width * 0.5 && sy > this.scale.height * 0.55) {
                this.joyActive = true; this.joyPointerId = ptr.id;
                this.baseX = sx; this.baseY = sy;
                this.joyBase.setPosition(sx, sy); this.joyStick.setPosition(sx, sy);
            }
        });
        this.input.on('pointermove', (ptr) => {
            if (!this.joyActive || ptr.id !== this.joyPointerId) return;
            let dx = ptr.x - this.baseX, dy = ptr.y - this.baseY;
            const dist = Math.sqrt(dx*dx+dy*dy), max = 60;
            if (dist > max) { dx=dx/dist*max; dy=dy/dist*max; }
            this.joyStick.setPosition(this.baseX+dx, this.baseY+dy);
            this.joyX = dx/max; this.joyY = dy/max;
        });
        this.input.on('pointerup', (ptr) => {
            if (ptr.id !== this.joyPointerId) return;
            this.joyActive = false; this.joyPointerId = null;
            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0; this.joyY = 0;
        });
        this.scale.on('resize', (gs) => {
            this.joyBase.setPosition(this.baseX, gs.height-120);
            this.joyStick.setPosition(this.baseX, gs.height-120);
        });

        this.interactBtn = this.add.image(
            this.scale.width - 60,
            this.scale.height *0.78,
            'btn_idle'
        )
        .setOrigin(1, 0.5)
        .setScrollFactor(0)
        .setDepth(30)
        .setScale(0.25) // 👈 這裡調
        .setInteractive()
        .on('pointerdown', () => this._triggerInteract());
        /* ── 建立所有 UI 層 ── */
        this._buildDialog();
        this._buildBugForm();
        this._buildGuestbook();

        this.input.keyboard.on('keydown-E',     () => this._triggerInteract());
        this.input.keyboard.on('keydown-ENTER', () => this._triggerInteract());
    }

    /* ────────────────────────────────────────────────────────
       一般對話框
    ──────────────────────────────────────────────────────── */
    _buildDialog() {
        const W = this.scale.width, H = this.scale.height;
        const bw = Math.min(W*0.76,460), bh = 210, cx = W/2, cy = H/2;
        this.dlg = {};
        this.dlg.overlay = this.add.rectangle(cx,cy,W,H,0x000000,0.55)
            .setScrollFactor(0).setDepth(40).setVisible(false).setInteractive()
            .on('pointerdown', ()=> this._closeDialog());
        this.dlg.box = this.add.rectangle(cx,cy,bw,bh,0x0c0c22,1)
            .setStrokeStyle(1.5,0x5a4fff,0.85).setScrollFactor(0).setDepth(41).setVisible(false);
        this.dlg.title = this.add.text(cx,cy-bh/2+20,'',{
            fontSize:'19px', fill:'#d4caff', fontFamily:"'Noto Sans TC',monospace", fontStyle:'bold', letterSpacing:3,
        }).setOrigin(0.5,0).setScrollFactor(0).setDepth(42).setVisible(false);
        this.dlg.divider = this.add.rectangle(cx,cy-bh/2+52,bw-36,1,0x2a2460)
            .setScrollFactor(0).setDepth(42).setVisible(false);
        this.dlg.rows = Array.from({length:5},(_,i)=>
            this.add.text(cx,cy-bh/2+64+i*26,'',{
                fontSize:'14px', fill:'#a197c8', fontFamily:"'Noto Sans TC',monospace",
            }).setOrigin(0.5,0).setScrollFactor(0).setDepth(42).setVisible(false)
        );
        this.dlg.actionBtn = this.add.text(cx-52,cy+bh/2-40,'',{
            fontSize:'14px', fill:'#b3aaff', fontFamily:"'Noto Sans TC',monospace",
            backgroundColor:'#1a1233', padding:{x:14,y:7},
        }).setOrigin(0.5,0).setScrollFactor(0).setDepth(43).setVisible(false)
          .setInteractive()
          .on('pointerover',  function(){ this.setStyle({fill:'#fff'}); })
          .on('pointerout',   function(){ this.setStyle({fill:'#b3aaff'}); })
          .on('pointerdown',  ()=> this._dialogAction());
        this.dlg.closeBtn = this.add.text(cx+52,cy+bh/2-40,'關閉',{
            fontSize:'14px', fill:'#555577', fontFamily:'monospace', backgroundColor:'#111122', padding:{x:14,y:7},
        }).setOrigin(0.5,0).setScrollFactor(0).setDepth(43).setVisible(false)
          .setInteractive()
          .on('pointerover',  function(){ this.setStyle({fill:'#aaa'}); })
          .on('pointerout',   function(){ this.setStyle({fill:'#555577'}); })
          .on('pointerdown',  ()=> this._closeDialog());
        this._activeLandmark = null;
    }

    _openDialog(lm) {
        if (this.dialogOpen) return;
        this.dialogOpen = true; this._activeLandmark = lm;
        this.joyX=0; this.joyY=0; this.joyActive=false;
        this.joyStick.setPosition(this.baseX, this.baseY);
        const d = lm.dialog;
        this.dlg.title.setText(d.title);
        this.dlg.rows.forEach((r,i)=> i<d.lines.length ? r.setText(d.lines[i]).setVisible(true) : r.setVisible(false));
        d.action ? this.dlg.actionBtn.setText(d.actionLabel||'確認').setVisible(true) : this.dlg.actionBtn.setVisible(false);
        [this.dlg.overlay,this.dlg.box,this.dlg.title,this.dlg.divider,this.dlg.closeBtn].forEach(e=>e.setVisible(true));
    }

    _closeDialog() {
        if (!this.dialogOpen) return;
        this.dialogOpen=false; this._activeLandmark=null;
        [this.dlg.overlay,this.dlg.box,this.dlg.title,this.dlg.divider,this.dlg.actionBtn,this.dlg.closeBtn].forEach(e=>e.setVisible(false));
        this.dlg.rows.forEach(r=>r.setVisible(false));
    }

    _dialogAction() {
        if (!this._activeLandmark) return;
        const action = this._activeLandmark.dialog.action;
        this._closeDialog();
        if (action === 'enter')      {
            // [FIX-4] 進入音樂場景前記憶位置
            PlayerState.save(this.player.x, this.player.y);
            this.scene.start('MusicScene');
        }
        if (action === 'bug_report') this._openBugForm();
        if (action === 'guestbook')  this._openGuestbook();
        if (action === 'open_ig')    this._openIG();       // [NEW-1]
        if (action === 'show_card')  this._showCard();     // [NEW-2]
         if (action === 'open_link')    this._open_link();
    }

    _triggerInteract() {
        if (this.dialogOpen) return;
        let best=null, bestD=Infinity;
        for (const lm of this.landmarks) {
            const d = Phaser.Math.Distance.Between(this.player.x,this.player.y,lm.x,lm.y);
            if (d<lm.interactDist && d<bestD) { bestD=d; best=lm; }
        }
        if (best) this._openDialog(best);
    }

    /* ────────────────────────────────────────────────────────
       [NEW-1] 開啟 IG 連結
    ──────────────────────────────────────────────────────── */
    _openIG() {
        window.open('https://www.instagram.com/kghs_78grad?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==', '_blank');
    }

    _open_link() {
        window.open('https://youtu.be/dQw4w9WgXcQ?si=nINUW_aP17-9zywm', '_blank');
    }

    /* ────────────────────────────────────────────────────────
       [NEW-2] 顯示邀請卡圖片（DOM overlay）
    ──────────────────────────────────────────────────────── */
    _showCard() {
        if (this._cardEl) return;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0;
            background:rgba(0,0,0,0.82);
            display:flex; align-items:center; justify-content:center;
            z-index:9999; cursor:pointer;
            animation: fadeInCard 0.3s ease;
        `;

        // 注入動畫 keyframe（只加一次）
        if (!document.getElementById('card-style')) {
            const style = document.createElement('style');
            style.id = 'card-style';
            style.textContent = `
                @keyframes fadeInCard {
                    from { opacity:0; transform:scale(0.92); }
                    to   { opacity:1; transform:scale(1); }
                }
                @keyframes bobCard {
                    0%,100% { transform:translateY(0px) rotate(-1deg); }
                    50%     { transform:translateY(-8px) rotate(1deg); }
                }
            `;
            document.head.appendChild(style);
        }

        overlay.innerHTML = `
            <div style="position:relative; max-width:min(480px,88vw); text-align:center;">
                <img src="assets/card.png" alt="邀請卡"
                    style="width:100%; border-radius:12px;
                    box-shadow:0 0 60px rgba(90,79,255,0.6), 0 0 20px rgba(0,0,0,0.8);
                    animation: bobCard 3s ease-in-out infinite;">
                <div style="margin-top:14px; color:#9080cc; font-size:13px;
                    font-family:'Noto Sans TC',monospace; letter-spacing:2px;">
                    點擊任意處關閉
                </div>
            </div>
        `;

        overlay.onclick = () => {
            overlay.remove();
            this._cardEl = null;
            this.dialogOpen = false;
        };

        document.body.appendChild(overlay);
        this._cardEl = overlay;
    }

    /* ────────────────────────────────────────────────────────
       [G1] Bug 回報表單
    ──────────────────────────────────────────────────────── */
    _buildBugForm() {
        this._bugFormEl = null;
    }

    _openBugForm() {
        if (this._bugFormEl) return;

        const overlay = document.createElement('div');
        overlay.id = 'bug-form-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0;
            background:rgba(0,0,0,0.72);
            display:flex; align-items:center; justify-content:center;
            z-index:9999; font-family:'Noto Sans TC',monospace;
        `;

        overlay.innerHTML = `
            <div style="
                background:#0c0c22; border:1.5px solid #5a4fff;
                border-radius:10px; padding:28px 32px; width:min(480px,90vw);
                box-shadow:0 0 40px #5a4fff44;
            ">
                <div style="color:#d4caff;font-size:18px;font-weight:bold;letter-spacing:3px;margin-bottom:6px;">
                    🐇 Bug 回報 / 建議
                </div>
                <div style="height:1px;background:#2a2460;margin-bottom:16px;"></div>
                <label style="color:#9080cc;font-size:13px;display:block;margin-bottom:4px;">你的名字（可不填）</label>
                <input id="bug-name" type="text" maxlength="30" placeholder="匿名"
                    style="width:100%;padding:8px 10px;background:#1a1a33;border:1px solid #3a3460;
                    color:#d4caff;font-size:14px;border-radius:5px;outline:none;margin-bottom:12px;">
                <label style="color:#9080cc;font-size:13px;display:block;margin-bottom:4px;">問題或建議 *</label>
                <textarea id="bug-desc" rows="4" maxlength="500" placeholder="請描述 bug 或你的建議..."
                    style="width:100%;padding:8px 10px;background:#1a1a33;border:1px solid #3a3460;
                    color:#d4caff;font-size:14px;border-radius:5px;outline:none;resize:vertical;
                    margin-bottom:16px;"></textarea>
                <div style="display:flex;gap:12px;justify-content:flex-end;">
                    <button id="bug-cancel" style="
                        background:transparent;border:1px solid #333355;color:#555577;
                        padding:8px 20px;border-radius:5px;cursor:pointer;font-size:13px;">取消</button>
                    <button id="bug-submit" style="
                        background:#1a1233;border:1px solid #5a4fff;color:#b3aaff;
                        padding:8px 24px;border-radius:5px;cursor:pointer;font-size:13px;">📤 送出</button>
                </div>
                <div id="bug-status" style="color:#5fffb8;font-size:12px;margin-top:10px;text-align:center;min-height:18px;"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._bugFormEl = overlay;

        const setStatus = (msg, color='#5fffb8') => {
            const el = document.getElementById('bug-status');
            if (el) { el.textContent = msg; el.style.color = color; }
        };

        document.getElementById('bug-cancel').onclick = () => this._closeBugForm();
        document.getElementById('bug-submit').onclick = async () => {
            const name = document.getElementById('bug-name').value.trim() || '匿名';
            const desc = document.getElementById('bug-desc').value.trim();
            if (!desc) { setStatus('請填寫問題描述！', '#ff7eb3'); return; }
            document.getElementById('bug-submit').disabled = true;
            setStatus('送出中…', '#ffe066');
            const result = await GSheets.post(API.BUG_URL, {
                type: 'bug', name, desc,
                time: new Date().toLocaleString('zh-TW'),
                ua:   navigator.userAgent.substring(0,80),
            });
            if (result.reason === 'no_url') {
                setStatus('⚠️ API URL 未設定（開發模式）', '#ffe066');
                setTimeout(()=> this._closeBugForm(), 1800);
            } else {
                setStatus('✓ 送出成功！感謝回報 🐇');
                setTimeout(()=> this._closeBugForm(), 1500);
            }
        };
    }

    _closeBugForm() {
        if (this._bugFormEl) { this._bugFormEl.remove(); this._bugFormEl = null; }
        this.dialogOpen = false;
    }

    /* ────────────────────────────────────────────────────────
       [G2] 留言板
    ──────────────────────────────────────────────────────── */
    _buildGuestbook() {
        this._gbEl = null;
    }

    async _openGuestbook() {
        if (this._gbEl) return;

        const overlay = document.createElement('div');
        overlay.id = 'gb-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0;
            background:rgba(0,0,0,0.75);
            display:flex; align-items:center; justify-content:center;
            z-index:9999; font-family:'Noto Sans TC',monospace;
        `;

        overlay.innerHTML = `
            <div style="
                background:#0c0c22; border:1.5px solid #5a4fff;
                border-radius:10px; padding:24px 28px; width:min(520px,92vw);
                max-height:85vh; display:flex; flex-direction:column;
                box-shadow:0 0 40px #5a4fff44;
            ">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="color:#d4caff;font-size:18px;font-weight:bold;letter-spacing:3px;">📮 留言板</span>
                    <button id="gb-close" style="background:transparent;border:none;color:#555577;font-size:18px;cursor:pointer;">✕</button>
                </div>
                <div style="height:1px;background:#2a2460;margin-bottom:12px;"></div>
                <div id="gb-list" style="
                    flex:1; overflow-y:auto; margin-bottom:14px;
                    max-height:300px; min-height:80px; padding-right:4px;">
                    <div style="color:#444466;font-size:13px;text-align:center;padding:20px 0;">載入中…</div>
                </div>
                <div style="height:1px;background:#2a2460;margin-bottom:12px;"></div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;gap:8px;">
                        <input id="gb-name" type="text" maxlength="20" placeholder="你的名字（可不填）"
                            style="flex:1;padding:7px 10px;background:#1a1a33;border:1px solid #3a3460;
                            color:#d4caff;font-size:13px;border-radius:5px;outline:none;">
                        <select id="gb-mood" style="padding:7px 6px;background:#1a1a33;border:1px solid #3a3460;
                            color:#d4caff;font-size:14px;border-radius:5px;outline:none;cursor:pointer;">
                            <option value="🌙">🌙</option>
                            <option value="🌸">🌸</option>
                            <option value="⭐">⭐</option>
                            <option value="🎵">🎵</option>
                            <option value="🐇">🐇</option>
                            <option value="💜">💜</option>
                            <option value="🌊">🌊</option>
                        </select>
                    </div>
                    <textarea id="gb-msg" rows="2" maxlength="200" placeholder="說點什麼吧…（200字以內）"
                        style="padding:7px 10px;background:#1a1a33;border:1px solid #3a3460;
                        color:#d4caff;font-size:13px;border-radius:5px;outline:none;resize:none;"></textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span id="gb-status" style="color:#5fffb8;font-size:12px;min-height:16px;"></span>
                        <button id="gb-submit" style="
                            background:#1a1233;border:1px solid #5a4fff;color:#b3aaff;
                            padding:7px 20px;border-radius:5px;cursor:pointer;font-size:13px;">💬 留言</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._gbEl = overlay;

        const setStatus = (msg, color='#5fffb8') => {
            const el = document.getElementById('gb-status');
            if (el) { el.textContent=msg; el.style.color=color; }
        };

        document.getElementById('gb-close').onclick = () => this._closeGuestbook();
        this._loadMessages();

        document.getElementById('gb-submit').onclick = async () => {
            const name = document.getElementById('gb-name').value.trim() || '匿名旅人';
            const mood = document.getElementById('gb-mood').value;
            const msg  = document.getElementById('gb-msg').value.trim();
            if (!msg) { setStatus('請輸入留言內容！', '#ff7eb3'); return; }
            document.getElementById('gb-submit').disabled = true;
            setStatus('送出中…', '#ffe066');
            const result = await GSheets.post(API.MSG_URL, {
                type: 'message', name, mood, msg,
                time: new Date().toLocaleString('zh-TW'),
            });
            if (result.reason === 'no_url') {
                setStatus('⚠️ API 未設定（開發模式）', '#ffe066');
            } else {
                setStatus('✓ 留言成功！', '#5fffb8');
                document.getElementById('gb-msg').value = '';
                this._insertMessageEl({ name, mood, msg, time:'剛剛' }, true);
            }
            document.getElementById('gb-submit').disabled = false;
        };
    }

    async _loadMessages() {
        const list = document.getElementById('gb-list');
        if (!list) return;
        const messages = await GSheets.get(API.MSG_URL, { type:'messages' });
        if (!messages.length) {
            list.innerHTML = `<div style="color:#444466;font-size:13px;text-align:center;padding:20px 0;">
                還沒有留言，來第一個留言吧！🌙
            </div>`;
            return;
        }
        list.innerHTML = '';
        [...messages].reverse().forEach(m => this._insertMessageEl(m, false));
    }

    _insertMessageEl(m, prepend = false) {
        const list = document.getElementById('gb-list');
        if (!list) return;
        if (list.querySelector('div[style*="text-align:center"]')) list.innerHTML = '';
        const card = document.createElement('div');
        card.style.cssText = `
            background:#131328; border:1px solid #2a2460; border-radius:6px;
            padding:10px 12px; margin-bottom:8px;
        `;
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#7c70c0;font-size:12px;">
                    ${m.mood || '🌙'} <strong style="color:#b3aaff;">${this._esc(m.name||'匿名')}</strong>
                </span>
                <span style="color:#333355;font-size:11px;">${this._esc(m.time||'')}</span>
            </div>
            <div style="color:#d4caff;font-size:13px;line-height:1.6;word-break:break-all;">
                ${this._esc(m.msg||'').replace(/\n/g,'<br>')}
            </div>
        `;
        if (prepend) list.insertBefore(card, list.firstChild);
        else list.appendChild(card);
    }

    _closeGuestbook() {
        if (this._gbEl) { this._gbEl.remove(); this._gbEl=null; }
        this.dialogOpen = false;
    }

    _esc(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    /* ── update ── */
    update(time) {
        if (this.dialogOpen) return;

        const speed = 5;
        const prevX = this.player.x, prevY = this.player.y;
        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.worldWidth);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.worldHeight);

        // AABB 碰撞
        for (const lm of this.landmarks) {
            const inside = this.player.x>lm.x-lm.colW && this.player.x<lm.x+lm.colW
                        && this.player.y>lm.y-lm.colH && this.player.y<lm.y;
            if (inside) {
                this.player.x = prevX;
                const stillX = prevX>lm.x-lm.colW && prevX<lm.x+lm.colW
                             && this.player.y>lm.y-lm.colH && this.player.y<lm.y;
                if (stillX) this.player.y = prevY;
            }
        }

        if      (this.joyX<-0.2) this.player.anims.play('walk_left',  true);
        else if (this.joyX> 0.2) this.player.anims.play('walk_right', true);
        else                      this.player.anims.play('idle',       true);

        // 地標靠近動畫 + [NEW-1][NEW-2] 漂浮效果
        let anyNear = false;
        const t = time / 1000;

        for (const lm of this.landmarks) {
            const dist = Phaser.Math.Distance.Between(this.player.x,this.player.y,lm.x,lm.y);
            const near = dist < lm.nearDist;
            if (near && !lm.isNear) {
                lm.isNear=true;
                this.tweens.add({targets:lm.halo, alpha:0.30, duration:350});
            } else if (!near && lm.isNear) {
                lm.isNear=false;
                this.tweens.add({targets:lm.halo, alpha:0, duration:300});
            }
            if (near) anyNear=true;

            // [NEW-1][NEW-2] 漂浮動畫：更新 sprite Y 座標和陰影
            if (lm.floatAmplitude && lm.sprite && lm.sprite.active) {
                const phase = t * lm.floatSpeed + lm._floatOffset;
                const floatY = Math.sin(phase) * lm.floatAmplitude;
                lm.sprite.y = lm.y + floatY;

                // 陰影隨漂浮縮放（離得越遠陰影越小）
                if (lm.shadow && lm.shadow.active) {
                    const shadowScale = 1 - Math.abs(floatY) / (lm.floatAmplitude * 3);
                    const shadowAlpha = 0.25 * shadowScale;
                    lm.shadow.setScale(shadowScale, 1);
                    lm.shadow.setAlpha(shadowAlpha);
                    // 陰影位置固定在地標底部
                    lm.shadow.setPosition(lm.x, lm.y - 4);
                }
            }
        }

        this.interactBtn.setVisible(true);

        if (anyNear) {
            this.interactBtn.setTexture('btn_active');
            this.interactBtn.setAlpha(1);
        } else {
            this.interactBtn.setTexture('btn_idle');
            this.interactBtn.setAlpha(0.5); // 👈 待機淡掉
        }
    }
}

/* ================================================================
   MusicScene
================================================================ */
class MusicScene extends Phaser.Scene {
    constructor() { super('MusicScene'); }

    preload() {
        this.load.audio('music', 'assets/music.mp3');
        this.load.image('ui_bg', 'assets/your_image.jpg');
    }

    create() {
        /* ── [iOS-FIX-2] 強制 resume AudioContext（iOS Safari 需要用戶手勢後才會啟動）── */
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
        }

        this.bg = this.add.image(
            this.cameras.main.width/2, this.cameras.main.height/2, 'ui_bg'
        ).setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        this.isPreparing=true; this.gameReady=false;
        this.input.addPointer(9);

        const W=this.cameras.main.width, H=this.cameras.main.height;
        this.laneCount=MUSIC_CFG.LANES;
        this.laneWidth=W/this.laneCount;
        this.hitY=H*MUSIC_CFG.HIT_RATIO;
        this.keyH=H*MUSIC_CFG.KEY_RATIO;

        this.noteQueue=[]; this.activeNotes=[];
        this.score=0; this.combo=0; this.maxCombo=0;
        this.perfectCnt=0; this.goodCnt=0; this.missCnt=0;
        this.musicStartAudioTime=0;
        this.touchLanes={}; this.holdingNotes={};

        /* ── [iOS-FIX-3] 記錄每個 pointer 的按下時間，防止 pointercancel 誤判 ── */
        this._pointerDownTime = {};

        this.add.rectangle(W/2,H/2,W,H,0x07070f);
        this.laneGfx=this.add.graphics(); this._drawLanes();
        this.add.rectangle(W/2,this.hitY,W,3,0xccbbff,0.8);
        this.keyGfx=this.add.graphics();
        this.holdGfx=this.add.graphics().setDepth(1);

        this._keyLabels=MUSIC_CFG.KEY_LABELS.map((label,i)=>
            this.add.text(i*this.laneWidth+this.laneWidth/2, this.hitY+this.keyH/2, label, {
                fontSize:Math.max(12,Math.round(this.laneWidth*0.28))+'px',
                fontFamily:'monospace', fill:'#444466',
            }).setOrigin(0.5,0.5).setAlpha(0.5)
        );

        this.scoreTxt=this.add.text(W-16,12,'0',{fontSize:'28px',fill:'#d4caff',fontFamily:'monospace',align:'right'}).setOrigin(1,0);
        this.comboTxt=this.add.text(W-16,48,'',{fontSize:'16px',fill:'#7c70c0',fontFamily:'monospace',align:'right'}).setOrigin(1,0);
        this.judgeTxt=this.add.text(W/2,H*0.34,'',{fontSize:'20px',fill:'#ffffff',fontFamily:'monospace',align:'center'}).setOrigin(0.5,0.5).setAlpha(0);
        this.statusTxt=this.add.text(W/2,H/2,'載入譜面中…',{fontSize:'20px',fill:'#a5e8ff',fontFamily:'monospace'}).setOrigin(0.5);

        // [FIX-4] 退出按鈕：返回 GameScene 並還原位置（不重置 PlayerState）
        this.add.text(16,12,'← 離開',{fontSize:'16px',fill:'#666',fontFamily:'monospace',backgroundColor:'#111',padding:{x:8,y:4}})
            .setScrollFactor(0).setInteractive()
            .on('pointerdown',()=>{
                if(this.music?.isPlaying) this.music.stop();
                this.scene.start('GameScene');
                // PlayerState 已在進入時存好，GameScene 的 create 會自動讀取
            });

        /* ── [iOS-FIX-3] 觸控事件：防止 pointercancel 在按下後立刻觸發誤判 ── */
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

        /*
         * [iOS-FIX-3] pointercancel 修正：
         * iOS Safari 在多指觸控或手勢衝突時會立刻送出 pointercancel。
         * 若按下後不到 80ms 就收到 cancel，視為誤觸，不計 miss，
         * 改為靜默解除（不呼叫 _tryHoldRelease，避免計分錯誤）。
         */
        this.input.on('pointercancel', (ptr) => {
            const downTime = this._pointerDownTime[ptr.id];
            const elapsed  = downTime !== undefined ? (this.time.now - downTime) : 999;

            if (elapsed < 80) {
                // 太短，iOS 誤發的 cancel，靜默清除不計分
                delete this.touchLanes[ptr.id];
                delete this._pointerDownTime[ptr.id];
                this._drawKeys();
                return;
            }

            // 真實的 cancel（例如來電打斷），按正常流程處理
            const lane = this.touchLanes[ptr.id];
            if (lane !== undefined) this._tryHoldRelease(lane, false);
            delete this.touchLanes[ptr.id];
            delete this._pointerDownTime[ptr.id];
            this._drawKeys();
        });

        this.scale.on('resize',(gs)=>{
            const nW=gs.width,nH=gs.height;
            this.laneWidth=nW/this.laneCount; this.hitY=nH*MUSIC_CFG.HIT_RATIO; this.keyH=nH*MUSIC_CFG.KEY_RATIO;
            this._drawLanes(); this._drawKeys();
            this._keyLabels.forEach((t,i)=>t.setPosition(i*this.laneWidth+this.laneWidth/2,this.hitY+this.keyH/2));
        });

        this.speedMultiplier=1.0;
        this.timingOffset=parseInt(SafeStorage.getItem('timingOffset'))||0; // [iOS-FIX-1]
        this._initAsync(); this._createPrepareUI();
    }

    async _initAsync() {
        try {
            const data=await this._loadBeatmap('beatmap.txt');
            this.noteQueue=data; this.statusTxt.setVisible(false);
            this.music=this.sound.add('music');
            this.musicStartAudioTime=this.sound.context.currentTime;
            this.isPreparing=true;
        } catch(err) {
            console.error('譜面載入失敗',err);
            this.statusTxt.setText('譜面載入失敗\n'+err.message);
        }
        this.isLoaded=true;
    }

    /* ────────────────────────────────────────────────────────
       [FIX-3] 重新設計準備介面：乾淨的現代音樂遊戲風格
       - 速度滑桿保留
       - Timing 改為「聽聲按螢」自動校準（CalibrationScene）
       - 不再顯示 Timing 數值輸入欄
    ──────────────────────────────────────────────────────── */
    /* ════════════════════════════════════════════════════════
       _createPrepareUI
       直接用 ui_bg 底圖，右半疊透明互動層：
         ① 延遲校準格子 → 進入 CalibrationScene，顯示目前 offset
         ② 音符速度格子 → 拖曳滑桿調整速度倍率
         ③ Start 白色格子 → 開始遊戲
         ④ 難易度格子 → 純裝飾
    ════════════════════════════════════════════════════════ */
   /* ════════════════════════════════════════════════════════
       _createPrepareUI
       直接用 ui_bg 底圖，右半疊透明互動層：
         ① 延遲校準格子 → 進入 CalibrationScene，顯示目前 offset
         ② 音符速度格子 → 拖曳滑桿調整速度倍率
         ③ Start 白色格子 → 開始遊戲
         ④ 難易度格子 → 純裝飾
    ════════════════════════════════════════════════════════ */
    _createPrepareUI() {
        const W = this.cameras.main.width;   // 960
        const H = this.cameras.main.height;  // 540

        this.prepareUI = this.add.container(0, 0).setDepth(50);

        /* ── 底圖填滿 ── */
        const bg = this.add.image(W / 2, H / 2, 'ui_bg')
            .setDisplaySize(W, H);
        this.prepareUI.add(bg);

        /* ════════════════════════════════════
           ① 延遲校準格子
           位置：右半上方橫條
           x: 60%~93%  y: 17%~28%
        ════════════════════════════════════ */
        const calibX1 = W * 0.60, calibX2 = W * 0.935;
        const calibY1 = H * 0.17, calibY2 = H * 0.285;
        const calibCX = (calibX1 + calibX2) / 2;
        const calibCY = (calibY1 + calibY2) / 2;

        // 目前 offset 文字（顯示在格子空白處，右側）
        const savedOfs = parseInt(SafeStorage.getItem('timingOffset')) || 0; // [iOS-FIX-1]
        this.calibOfsText = this.add.text(
            calibX2 - 40, calibY1 +40,
            `${savedOfs > 0 ? '+' : ''}${savedOfs} ms`,
            {
                fontSize: '19px', fill: '#a5e8ff',
                fontFamily: 'monospace', align: 'right',
            }
        ).setOrigin(1, 0).setDepth(52);
        // 不放進 prepareUI container，讓它獨立在最上層

        // hover 高亮層
        const calibHover = this.add.rectangle(
            calibCX, calibCY,
            calibX2 - calibX1, calibY2 - calibY1,
            0x7c6fff, 0
        ).setDepth(50);
        this.prepareUI.add(calibHover);

        // 透明互動區
        this.add.rectangle(
            calibCX, calibCY,
            calibX2 - calibX1, calibY2 - calibY1,
            0xffffff, 0
        ).setDepth(55).setInteractive()
          .on('pointerover', () => calibHover.setAlpha(0.18))
          .on('pointerout',  () => calibHover.setAlpha(0))
          .on('pointerdown', () => {
              this.scene.start('CalibrationScene');
          });

        /* ════════════════════════════════════
           ② 音符速度格子（放滑桿）
           位置：x: 58%~89%  y: 31%~51%
        ════════════════════════════════════ */
        const speedX1 = W * 0.575, speedX2 = W * 0.895;
        const speedY1 = H * 0.315, speedY2 = H * 0.510;
        const speedCX = (speedX1 + speedX2) / 2;
        const speedCY = (speedY1 + speedY2) / 2;

        // hover 高亮
        const speedHover = this.add.rectangle(
            speedCX, speedCY,
            speedX2 - speedX1, speedY2 - speedY1,
            0x5fb8ff, 0
        ).setDepth(51);
        this.prepareUI.add(speedHover);
      
        // 速度值文字
        this.speedValueTxt = this.add.text(
            speedCX, speedY1 + 10,
            '1.00×',
            { fontSize: '15px', fill: '#d4caff', fontFamily: 'monospace' }
        ).setOrigin(0.5, 0).setDepth(52);

        // 滑桿
        const slY   = speedCY - 20;
        const slX0  = speedX1 + 87;
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

        const slHandle = this.add.circle(slX0 + slLen / 2, slY, 9, 0xd4caff)
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

        // 速度格子 hover（滑桿操作時不吃 hover）
        this.add.rectangle(
            speedCX, speedCY,
            speedX2 - speedX1, speedY2 - speedY1,
            0xffffff, 0
        ).setDepth(51).setInteractive()
          .on('pointerover', () => speedHover.setAlpha(0.10))
          .on('pointerout',  () => speedHover.setAlpha(0))
          .setInteractive({ useHandCursor: false })
        .disableInteractive();

        /* ════════════════════════════════════
           ③ Start 白色格子
           位置：x: 67%~87%  y: 71%~86%
        ════════════════════════════════════ */
        const startX1 = W * 0.685, startX2 = W * 0.895;
        const startY1 = H * 0.705, startY2 = H * 0.865;
        const startCX = (startX1 + startX2) / 2;
        const startCY = (startY1 + startY2) / 2;

        const startHover = this.add.rectangle(
            startCX, startCY,
            startX2 - startX1, startY2 - startY1,
            0xffffff, 0
        ).setDepth(51);
        this.prepareUI.add(startHover);

        this.add.rectangle(
            startCX, startCY,
            startX2 - startX1, startY2 - startY1,
            0xffffff, 0
        ).setDepth(55).setInteractive()
          .on('pointerover', () => startHover.setAlpha(0.22))
          .on('pointerout',  () => startHover.setAlpha(0))
          .on('pointerdown', () => this._startGame());

        /* ════════════════════════════════════
           把獨立文字加進 container（讓 destroy 時一起清除）
        ════════════════════════════════════ */
        this.prepareUI.add(slTrackG);
        this.prepareUI.add(slFillG);
        this.prepareUI.add(slHandle);
        this.prepareUI.add(this.speedValueTxt);
        this.prepareUI.add(this.calibOfsText);

        /* ── Start 閃爍提示 ── */
        // 用半透明白框閃爍，疊在 Start 格子上
        const startGlow = this.add.rectangle(
            startCX, startCY,
            startX2 - startX1 - 6, startY2 - startY1 - 6,
            0xffffff, 0
        ).setStrokeStyle(2, 0xffffff, 0.7).setDepth(52);
        this.prepareUI.add(startGlow);
        this.tweens.add({
            targets: startGlow, strokeAlpha: 0.15,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    _startGame() {
        if(!this.noteQueue.length){console.log('加載中...');return;}
        this.prepareUI.destroy(); this.input.off('drag');

        /* ── [iOS-FIX-2] 開始播放前再次確認 AudioContext 已 resume ── */
        const ctx = this.sound.context;
        const doPlay = () => {
            this.music.play();
            this.musicStartAudioTime = ctx.currentTime;
            this.isPreparing = false;
            this.gameReady   = true;
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(doPlay).catch(doPlay);
        } else {
            doPlay();
        }
    }

    update() {
        if(this.isPreparing||!this.gameReady)return;
        const elapsed=(this.sound.context.currentTime-this.musicStartAudioTime)*1000+this.timingOffset;
        this._spawnNotes(elapsed); this._updateNotes(elapsed);
        this._drawHoldBodies(elapsed); this._drawKeys();
        const holdsDone=Object.keys(this.holdingNotes).length===0;
        if(this.noteQueue.length===0&&this.activeNotes.length===0&&holdsDone){this.gameReady=false;this._showResult();}
        if(this.music&&!this.music.isPlaying&&this.gameReady){this.gameReady=false;this._showResult();}
    }

    _spawnNotes(elapsed) {
        while(this.noteQueue.length&&this.noteQueue[0].time<=elapsed+MUSIC_CFG.LOOK_AHEAD)
            this._spawnNote(this.noteQueue.shift(),elapsed);
    }
    _spawnNote(data,elapsed) {
        const x=this.laneWidth*data.lane+this.laneWidth/2;
        const nw=this.laneWidth*MUSIC_CFG.NOTE_W;
        const y=this.hitY-(data.time-elapsed)*MUSIC_CFG.NOTE_SPEED*this.speedMultiplier/1000;
        const note=this.add.rectangle(x,y,nw,MUSIC_CFG.NOTE_H,MUSIC_CFG.COLORS[data.lane]);
        note.setStrokeStyle(1.5,0xffffff,0.3);
        note._noteTime=data.time; note._noteEndTime=data.isHold?data.endTime:data.time;
        note._lane=data.lane; note._isHold=data.isHold; note._state='alive';
        this.activeNotes.push(note);
    }
    _updateNotes(elapsed) {
        const H=this.cameras.main.height;
        for(const note of this.activeNotes) {
            if(!note.active)continue;
            note.y=this.hitY-(note._noteTime-elapsed)*MUSIC_CFG.NOTE_SPEED*this.speedMultiplier/1000;
            if(note._state==='holding'){
                note.y=this.hitY;
                if(elapsed>=note._noteEndTime)this._completeHold(note);
                continue;
            }
            if(note._state==='alive'&&note._noteTime<elapsed-MUSIC_CFG.WIN_GD){
                if(!note._isHold){note._state='miss';this._onMiss();note.destroy();}
                continue;
            }
            if(!note._isHold&&note.y>H+200){note.destroy();continue;}
            if(note._isHold){
                const tailY=this.hitY-(note._noteEndTime-elapsed)*MUSIC_CFG.NOTE_SPEED*this.speedMultiplier/1000;
                if(tailY>H+200)note.destroy();
            }
        }
        this.activeNotes=this.activeNotes.filter(n=>n.active);
    }
    _drawHoldBodies(elapsed) {
        const g=this.holdGfx; g.clear();
        for(const note of this.activeNotes) {
            if(!note.active||!note._isHold)continue;
            if(note._state==='miss'||note._state==='hit')continue;
            const lane=note._lane,col=MUSIC_CFG.COLORS[lane];
            const bw=this.laneWidth*MUSIC_CFG.NOTE_W,bx=lane*this.laneWidth+(this.laneWidth-bw)/2;
            const isHolding=note._state==='holding',headY=note.y;
            const tailY=this.hitY-(note._noteEndTime-elapsed)*MUSIC_CFG.NOTE_SPEED*this.speedMultiplier/1000;
            const H=this.cameras.main.height;
            const drawTop=Math.max(-20,tailY),drawBottom=Math.min(H+20,headY),drawHeight=drawBottom-drawTop;
            if(drawHeight<=0)continue;
            g.fillStyle(col,isHolding?0.65:0.35); g.fillRect(bx,drawTop,bw,drawHeight);
            g.lineStyle(1.5,col,isHolding?1.0:0.55); g.strokeRect(bx,drawTop,bw,drawHeight);
            if(isHolding){g.fillStyle(0xffffff,0.18);g.fillRect(bx+bw*0.25,drawTop,bw*0.5,drawHeight);}
            if(tailY>-10){g.fillStyle(isHolding?0xffffff:col,isHolding?0.9:0.85);g.fillRect(bx,tailY-4,bw,8);}
        }
    }
    _tryHit(lane,pointerId) {
        if(!this.gameReady||this.holdingNotes[lane])return;
        const elapsed=(this.sound.context.currentTime-this.musicStartAudioTime)*1000+this.timingOffset;
        let best=null,bestDiff=Infinity;
        for(const n of this.activeNotes){
            if(!n.active||n._state!=='alive'||n._lane!==lane)continue;
            const diff=Math.abs(n._noteTime-elapsed);
            if(diff<bestDiff){bestDiff=diff;best=n;}
        }
        if(!best)return;
        if(bestDiff<=MUSIC_CFG.WIN_PF){
            if(best._isHold){best._state='holding';best._hitQuality='perfect';this.holdingNotes[lane]=best;this._showJudge('HOLD ✦','#c4b8ff');}
            else{best._state='hit';best.destroy();this._onHit(300,'PERFECT ✦','#c4b8ff');}
        } else if(bestDiff<=MUSIC_CFG.WIN_GD){
            if(best._isHold){best._state='holding';best._hitQuality='good';this.holdingNotes[lane]=best;this._showJudge('HOLD','#5fb8ff');}
            else{best._state='hit';best.destroy();this._onHit(100,'GOOD','#5fb8ff');}
        }
    }
    _completeHold(note) {
        const lane=note._lane,pts=note._hitQuality==='perfect'?500:200;
        const label=note._hitQuality==='perfect'?'PERFECT ✦':'GOOD';
        const color=note._hitQuality==='perfect'?'#c4b8ff':'#5fb8ff';
        note._state='hit'; note.destroy(); delete this.holdingNotes[lane]; this._onHit(pts,label,color);
    }
    _tryHoldRelease(lane,isCompleted) {
        const note=this.holdingNotes[lane]; if(!note)return;
        if(isCompleted){this._completeHold(note);}
        else{note._state='break';note.destroy();delete this.holdingNotes[lane];this._onMiss();this._showJudge('BREAK','#ff8844');}
    }
    _onHit(pts,label,color) {
        this.score+=pts*Math.max(1,1+Math.floor(this.combo/10));
        this.combo++; if(this.combo>this.maxCombo)this.maxCombo=this.combo;
        if(label.startsWith('PERFECT'))this.perfectCnt++; else this.goodCnt++;
        this.scoreTxt.setText(this.score.toLocaleString());
        this.comboTxt.setText(this.combo>1?this.combo+'x':'');
        this._showJudge(label,color);
    }
    _onMiss() {
        this.combo=0; this.missCnt++; this.comboTxt.setText(''); this._showJudge('MISS','#ff4466');
    }
    _showJudge(text,color) {
        const W=this.cameras.main.width,H=this.cameras.main.height;
        this.judgeTxt.setText(text).setStyle({fill:color}).setAlpha(1).setPosition(W/2,H*0.34);
        if(this._judgeTimer)this._judgeTimer.remove();
        this._judgeTimer=this.time.delayedCall(400,()=>this.tweens.add({targets:this.judgeTxt,alpha:0,duration:200}));
    }
    _drawLanes() {
        const W=this.cameras.main.width,H=this.cameras.main.height,g=this.laneGfx; g.clear();
        for(let i=0;i<this.laneCount;i++){
            g.fillStyle(i%2===0?0x111122:0x0d0d1a,1); g.fillRect(i*this.laneWidth,0,this.laneWidth,H);
            g.lineStyle(0.5,0xffffff,0.07); g.lineBetween(i*this.laneWidth,0,i*this.laneWidth,H);
        }
        g.lineStyle(0.5,0xffffff,0.07); g.lineBetween(W,0,W,H);
    }
    _drawKeys() {
        const g=this.keyGfx,pressed=new Set(Object.values(this.touchLanes));
        Object.keys(this.holdingNotes).forEach(lane=>pressed.add(Number(lane)));
        g.clear();
        for(let i=0;i<this.laneCount;i++){
            const x=i*this.laneWidth,y=this.hitY+2,col=MUSIC_CFG.COLORS[i];
            const isP=pressed.has(i),isH=!!this.holdingNotes[i];
            g.fillStyle(col,isH?0.40:isP?0.28:0.06); g.fillRect(x,y,this.laneWidth,this.keyH);
            g.lineStyle(isH?4:isP?3:1,col,isH?1.0:isP?1.0:0.2); g.lineBetween(x,y,x+this.laneWidth,y);
            g.lineStyle(isP||isH?1.5:0.5,col,isP||isH?0.7:0.12); g.strokeRect(x+1,y,this.laneWidth-2,this.keyH-2);
        }
        this._keyLabels?.forEach((t,i)=>{
            const isP=pressed.has(i),hex='#'+MUSIC_CFG.COLORS[i].toString(16).padStart(6,'0');
            t.setStyle({fill:isP?hex:'#444466'}); t.setAlpha(isP?1.0:0.5);
        });
    }
    _getLane(screenX) {
        const lane=Math.floor(screenX/this.laneWidth);
        return(lane<0||lane>=this.laneCount)?-1:lane;
    }
    async _loadBeatmap(url) {
        const res=await fetch(url); if(!res.ok)throw new Error(`HTTP ${res.status}`);
        return this._parseBeatmap(await res.text());
    }
    _parseBeatmap(text) {
        const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
        const isOsu=lines.some(l=>l==='[HitObjects]');
        const notes=isOsu?this._parseOsu(lines):this._parseCsv(lines);
        if(!notes.length)throw new Error('找不到有效音符');
        return notes.sort((a,b)=>a.time-b.time);
    }
    _parseOsu(lines) {
        const LANE_W=512/MUSIC_CFG.LANES,notes=[];let inHit=false;
        for(const line of lines){
            if(line==='[HitObjects]'){inHit=true;continue;}
            if(line.startsWith('[')&&inHit)break; if(!inHit)continue;
            const p=line.split(','); if(p.length<4)continue;
            const x=parseInt(p[0]),time=parseInt(p[2]),type=parseInt(p[3]);
            if(isNaN(x)||isNaN(time)||isNaN(type))continue;
            const isHold=(type&128)!==0;let endTime=time;
            if(isHold&&p[5]){const e=parseInt(p[5].split(':')[0]);if(!isNaN(e)&&e>time)endTime=e;}
            notes.push({lane:Math.min(MUSIC_CFG.LANES-1,Math.floor(x/LANE_W)),time,endTime,isHold});
        }
        return notes;
    }
    _parseCsv(lines) {
        const notes=[];
        for(const line of lines){
            if(line.startsWith('#')||line.startsWith('//'))continue;
            const p=line.split(','); if(p.length<2)continue;
            const time=parseInt(p[0]),lane=parseInt(p[1]);
            if(isNaN(time)||isNaN(lane)||lane<0||lane>=MUSIC_CFG.LANES)continue;
            const isHold=p[2]?parseInt(p[2])===1:false;
            const endTime=(isHold&&p[3])?parseInt(p[3]):time;
            notes.push({time,lane,isHold,endTime});
        }
        return notes;
    }
    _showResult() {
        const W=this.cameras.main.width,H=this.cameras.main.height;
        const judged=this.perfectCnt+this.goodCnt+this.missCnt;
        const acc=judged?Math.round((this.perfectCnt+this.goodCnt)/judged*100):0;
        let grade='D';
        if(acc>=95)grade='S'; else if(acc>=85)grade='A'; else if(acc>=70)grade='B'; else if(acc>=55)grade='C';
        this.add.rectangle(W/2,H/2,W*0.86,H*0.68,0x0f0f22,0.96).setStrokeStyle(1.5,0x6c5fff,0.7);
        const cx=W/2;let oy=H/2-H*0.27;
        const row=(text,color,size,gap=10)=>{
            if(!text){oy+=gap;return;}
            this.add.text(cx,oy,text,{fontSize:size+'px',fill:color,fontFamily:'monospace'}).setOrigin(0.5,0);
            oy+=size+gap;
        };
        row('RESULT','#d4caff',28,4); row('','',0,8);
        row(`GRADE  ${grade}`,grade==='S'?'#ffe066':'#e0deff',32,4); row('','',0,6);
        row(`SCORE  ${this.score.toLocaleString()}`,'#e0deff',20);
        row(`COMBO  ${this.maxCombo}x`,'#5fb8ff',18);
        row(`ACC    ${acc}%`,'#5fffb8',18); row('','',0,4);
        row(`PF ${this.perfectCnt}  GD ${this.goodCnt}  MS ${this.missCnt}`,'#666',14,6);
        oy+=10;
        this.add.text(cx,oy,'再玩一次',{fontSize:'22px',fill:'#b3aaff',fontFamily:'monospace',backgroundColor:'#1a1a33',padding:{x:20,y:10}})
            .setOrigin(0.5,0).setInteractive().on('pointerdown',()=>{this.music?.stop();this.scene.restart();});
        this.add.text(cx,oy+56,'回到地圖',{fontSize:'16px',fill:'#666',fontFamily:'monospace',backgroundColor:'#111',padding:{x:14,y:8}})
            .setOrigin(0.5,0).setInteractive().on('pointerdown',()=>{this.music?.stop();this.scene.start('GameScene');});
    }
}

/* ================================================================
   CalibrationScene — [FIX-3] 重新設計：聽聲按螢自動架構
   流程：
     1. 按「開始」→ 播放節拍聲（每 500ms 一拍）
     2. 玩家跟著節拍點擊螢幕
     3. 自動計算平均 offset 並即時顯示
     4. 按「完成」儲存並回到 MusicScene
================================================================ */
class CalibrationScene extends Phaser.Scene {
    constructor() { super('CalibrationScene'); }

    preload() {
        this.load.audio('tick', 'assets/tick.wav');
        this.load.image('ui_bg', 'assets/your_image.jpg');
    }

    create() {
        /* ── [iOS-FIX-2] 校準場景進入時也確保 AudioContext resume ── */
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;

        // 背景
        this.add.image(W/2, H/2, 'ui_bg').setDisplaySize(W, H).setAlpha(0.6);
        this.add.rectangle(W/2, H/2, W, H, 0x050510, 0.75);

        this.bpm = 120;
        this.intervalMs = 60000 / this.bpm;  // 500ms
        this.offsetSamples = [];
        this.isRunning = false;
        this.beatCount = 0;
        this._beatTimer = null;
        this._flashRect = null;
        this.startAudioTime = 0;

        // ── 標題 ──
        this.add.text(W/2, H*0.07, 'TIMING 校準', {
            fontSize: '22px', fill: '#d4caff', fontFamily: 'monospace', letterSpacing: 6,
        }).setOrigin(0.5);

        this.add.text(W/2, H*0.14, '聽到節拍聲後，跟著拍子點擊螢幕', {
            fontSize: '14px', fill: '#6655aa', fontFamily: "'Noto Sans TC', monospace",
        }).setOrigin(0.5);

        // ── 節拍視覺圈（大圓，會閃爍）──
        this.beatCircle = this.add.circle(W/2, H*0.42, 80, 0x1a1255, 1);
        this.beatCircle.setStrokeStyle(2, 0x5a4fff, 0.6);

        this.beatIcon = this.add.text(W/2, H*0.42, '♪', {
            fontSize: '52px', fill: '#3d3470', fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── 樣本計數 & 目前偏移 ──
        this.samplesTxt = this.add.text(W/2, H*0.60, '點擊次數：0', {
            fontSize: '15px', fill: '#555577', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.offsetTxt = this.add.text(W/2, H*0.66, '平均偏移：— ms', {
            fontSize: '18px', fill: '#5fffb8', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.hintTxt = this.add.text(W/2, H*0.73, '', {
            fontSize: '13px', fill: '#ffe066', fontFamily: "'Noto Sans TC', monospace",
        }).setOrigin(0.5);

        // ── 按鈕 ──
        this.startBtn = this.add.text(W/2, H*0.83, '▶  開始校準', {
            fontSize: '20px', fill: '#a5e8ff', fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#0d1a2a', padding: { x: 24, y: 12 },
        }).setOrigin(0.5).setInteractive()
          .on('pointerover', function(){ this.setStyle({ fill: '#fff' }); })
          .on('pointerout',  function(){ this.setStyle({ fill: '#a5e8ff' }); })
          .on('pointerdown', () => this._startCalibration());

        this.doneBtn = this.add.text(W/2, H*0.83, '✓  儲存並返回', {
            fontSize: '20px', fill: '#5fffb8', fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#0a1f15', padding: { x: 24, y: 12 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({ fill: '#fff' }); })
          .on('pointerout',  function(){ this.setStyle({ fill: '#5fffb8' }); })
          .on('pointerdown', () => this._finishCalibration());

        this.resetBtn = this.add.text(W/2, H*0.91, '↩  重新校準', {
            fontSize: '15px', fill: '#444466', fontFamily: 'monospace',
            backgroundColor: '#111122', padding: { x: 16, y: 8 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({ fill: '#aaa' }); })
          .on('pointerout',  function(){ this.setStyle({ fill: '#444466' }); })
          .on('pointerdown', () => this._resetCalibration());

        // 玩家點擊事件（校準進行中才響應）
        this.input.on('pointerdown', () => {
            if (!this.isRunning) return;
            this._recordTap();
            this._flashTap();
        });

        // 顯示目前儲存的 offset
        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0; // [iOS-FIX-1]
        this.hintTxt.setText(`目前儲存值：${saved} ms`);

        const backBtn = this.add.text(20, 20, '← 返回', {
            fontSize: '18px',
            backgroundColor: '#333',
            padding: { x: 10, y: 5 }
        })
        .setInteractive()
        .on('pointerdown', () => {

            if (this.offsetSamples.length >= 2) {
                const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
                const offset = Math.round(avg);
                SafeStorage.setItem('timingOffset', offset); // [iOS-FIX-1]
            }

            this.scene.start('MusicScene');
        });
    }

    _startCalibration() {
        /* ── [iOS-FIX-2] 校準開始時再次 resume（此時已有用戶手勢）── */
        this.sound.context.resume().then(() => {
            this._doStartCalibration();
        }).catch(() => {
            this._doStartCalibration();
        });
    }

    _doStartCalibration() {
        this.isRunning = true;
        this.offsetSamples = [];
        this.beatCount = 0;
        this.startAudioTime = this.sound.context.currentTime * 1000;

        this.startBtn.setVisible(false);
        this.doneBtn.setVisible(false);
        this.resetBtn.setVisible(false);
        this.hintTxt.setText('跟著節拍點擊螢幕！（建議點 8 拍以上）');
        this.samplesTxt.setText('點擊次數：0');
        this.offsetTxt.setText('平均偏移：— ms');

        // 立刻播一次 + 開始計時器
        this._playBeat();
        this._beatTimer = this.time.addEvent({
            delay: this.intervalMs,
            loop: true,
            callback: () => this._playBeat(),
        });

        // 8拍後自動停止讓玩家確認
        this.time.delayedCall(this.intervalMs * 10, () => {
            if (this.isRunning) this._stopCalibration();
        });
    }

    _playBeat() {
        this.sound.play('tick');
        this.beatCount++;

        /* ── [iOS-FIX-4] 改用 setFillStyle 取代 fillColor tween（部分 Phaser 版本不支援）── */
        this.beatCircle.setFillStyle(0x3a2aaa);
        this.time.delayedCall(80, () => {
            if (this.beatCircle && this.beatCircle.active) {
                this.beatCircle.setFillStyle(0x1a1255);
            }
        });

        this.tweens.add({
            targets: this.beatIcon,
            scaleX: 1.3, scaleY: 1.3,
            duration: 60,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                if (this.beatIcon && this.beatIcon.active) {
                    this.beatIcon.setFill('#a5e8ff');
                    this.time.delayedCall(150, () => {
                        if (this.beatIcon && this.beatIcon.active) {
                            this.beatIcon.setFill('#3d3470');
                        }
                    });
                }
            },
        });
    }

    _recordTap() {
        const nowMs = this.sound.context.currentTime * 1000;
        const elapsed = nowMs - this.startAudioTime;
        // 找最近的節拍時間點
        const beatIndex = Math.round(elapsed / this.intervalMs);
        const expectedMs = beatIndex * this.intervalMs;
        const offset = elapsed - expectedMs;

        // 過濾掉偏差太大的（可能是誤觸）
        if (Math.abs(offset) < this.intervalMs * 0.45) {
            this.offsetSamples.push(offset);
        }

        // 即時顯示
        const count = this.offsetSamples.length;
        this.samplesTxt.setText(`點擊次數：${count}`);

        if (count >= 2) {
            const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / count;
            const rounded = Math.round(avg);
            this.offsetTxt.setText(`平均偏移：${rounded > 0 ? '+' : ''}${rounded} ms`);
            const quality = Math.abs(rounded) < 20 ? '✓ 很準！' : Math.abs(rounded) < 50 ? '差一點' : '偏差較大';
            this.hintTxt.setText(`${quality}（共 ${count} 筆樣本）`);
        }
    }

    _flashTap() {
        // 玩家點擊時的視覺反饋：螢幕邊框短暫亮起
        const W = this.cameras.main.width, H = this.cameras.main.height;
        if (this._tapFlash) this._tapFlash.destroy();
        this._tapFlash = this.add.rectangle(W/2, H/2, W, H, 0x5a4fff, 0).setStrokeStyle(4, 0x9a8fff, 0.8);
        this.tweens.add({
            targets: this._tapFlash, strokeAlpha: 0, duration: 250,
            onComplete: () => { if (this._tapFlash) this._tapFlash.destroy(); this._tapFlash = null; },
        });
    }

    _stopCalibration() {
        this.isRunning = false;
        if (this._beatTimer) { this._beatTimer.remove(); this._beatTimer = null; }
        this.doneBtn.setVisible(true);
        this.resetBtn.setVisible(true);
        if (this.offsetSamples.length < 2) {
            this.hintTxt.setText('樣本太少，請重新校準。');
            this._resetCalibration();
        }
    }

    _finishCalibration() {
        if (this.offsetSamples.length < 2) { this._resetCalibration(); return; }
        const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
        const offset = Math.round(avg);
        SafeStorage.setItem('timingOffset', offset); // [iOS-FIX-1]
        this.scene.start('MusicScene');
    }

    _resetCalibration() {
        if (this._beatTimer) { this._beatTimer.remove(); this._beatTimer = null; }
        this.isRunning = false;
        this.offsetSamples = [];
        this.beatCount = 0;
        this.startBtn.setVisible(true);
        this.doneBtn.setVisible(false);
        this.resetBtn.setVisible(false);
        this.samplesTxt.setText('點擊次數：0');
        this.offsetTxt.setText('平均偏移：— ms');
        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0; // [iOS-FIX-1]
        this.hintTxt.setText(`目前儲存值：${saved} ms`);
        this.beatIcon.setFill('#3d3470').setScale(1);
    }
}

/* ================================================================
   Phaser 設定
================================================================ */
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 960, height: 540,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { disableWebAudio: false },
    scene: [StartScene, GameScene, MusicScene, CalibrationScene],
};
new Phaser.Game(config);
