'use strict';

/* ================================================================
   GameScene — 主要探索地圖場景
================================================================ */
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    preload() {
        this.load.image('map',      'assets/map.png');
        this.load.image('stage',    'assets/stage.png');
        this.load.image('tree1',    'assets/tree1.png');
        this.load.image('tree2',    'assets/tree2.png');
        this.load.image('cocona',   'assets/cocona.png');
        this.load.image('sign',     'assets/sign.png');
        this.load.image('crab',     'assets/crab.png');
        this.load.image('cord',     'assets/cord.png');
        this.load.image('bunny',    'assets/bunny.png');
        this.load.image('mailbox',  'assets/mailbox.png');
        this.load.image('btn_idle', 'assets/btn_idle.png');
        this.load.image('btn_active','assets/btn_active.png');
        this.load.image('sun',      'assets/sun.png');
        this.load.image('buttle',   'assets/buttle.png');
        this.load.image('card',     'assets/card.png');
        this.load.spritesheet('wave',   'assets/wave.png',   { frameWidth: 2000, frameHeight: 1240 });
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 256, frameHeight: 256 });
        this.load.audio('bgm_game', './assets/bgm.mp3');
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

        /* ── 海浪動畫 ── */
        this.anims.create({
            key: 'wave_anim',
            frames: [0,1,2,3,2,1].map(f => ({ key: 'wave', frame: f })),
            frameRate: 2.5,
            repeat: -1,
        });

        /* ── 地標 ── */
        this.landmarks = LANDMARKS.map(def => {
            let sprite;

            if (def.isWave) {
                sprite = this.add.sprite(def.x, def.y, 'wave')
                    .setOrigin(0.5, 1).setScale(def.scale).setDepth(5);
                sprite.play('wave_anim');
                sprite.anims.setProgress(Math.random());
            } else {
                sprite = this.add.image(def.x, def.y, def.key)
                    .setOrigin(0.5, 1).setScale(def.scale).setDepth(5);
            }

            const halo = this.add.ellipse(def.x, def.y - 8, (def.colW || 30) * 2.8, 28, 0x9988ff, 0).setDepth(4);

            let shadow = null;
            if (def.hasShadow) {
                shadow = this.add.ellipse(def.x, def.y - 4, (def.colW || 30) * 2.2, 18, 0x000000, 0.25).setDepth(4);
            }

            return { ...def, sprite, halo, shadow, isNear: false, _floatOffset: Math.random() * Math.PI * 2 };
        });

        /* ── 玩家 ── */
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

        /* ── 虛擬搖桿 ── */
        this.baseX = 120;
        this.baseY = this.scale.height - 120;
        this.joyBase  = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4).setScrollFactor(0).setDepth(20);
        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7).setScrollFactor(0).setDepth(21);
        this.joyActive = false;
        this.joyPointerId = null;
        this.joyX = 0;
        this.joyY = 0;

        this.input.on('pointerdown', (ptr) => {
            if (this.dialogOpen) return;
            if (this.joyActive) return;
            const sx = ptr.x, sy = ptr.y;
            if (sx < this.scale.width * 0.5 && sy > this.scale.height * 0.55) {
                this.joyActive = true; this.joyPointerId = ptr.id;
                this.baseX = sx; this.baseY = sy;
                this.joyBase.setPosition(sx, sy);
                this.joyStick.setPosition(sx, sy);
            }
        });

        this.input.on('pointermove', (ptr) => {
            if (!this.joyActive || ptr.id !== this.joyPointerId) return;
            let dx = ptr.x - this.baseX, dy = ptr.y - this.baseY;
            const dist = Math.sqrt(dx*dx + dy*dy), max = 60;
            if (dist > max) { dx = dx/dist*max; dy = dy/dist*max; }
            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);
            this.joyX = dx/max; this.joyY = dy/max;
        });

        this.input.on('pointerup', (ptr) => {
            if (ptr.id !== this.joyPointerId) return;
            this.joyActive = false; this.joyPointerId = null;
            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0; this.joyY = 0;
        });

        this.scale.on('resize', (gs) => {
            this.joyBase.setPosition(this.baseX, gs.height - 120);
            this.joyStick.setPosition(this.baseX, gs.height - 120);
        });

        /* ── 互動按鈕 ── */
        this.interactBtn = this.add.image(
            this.scale.width - 60,
            this.scale.height * 0.78,
            'btn_idle'
        )
        .setOrigin(1, 0.5)
        .setScrollFactor(0)
        .setDepth(30)
        .setScale(0.25)
        .setInteractive()
        .on('pointerdown', () => this._triggerInteract());

        /* ── UI 層建立 ── */
        this._buildDialog();
        this._buildBugForm();
        this._buildGuestbook();

        this.input.keyboard.on('keydown-E',     () => this._triggerInteract());
        this.input.keyboard.on('keydown-ENTER', () => this._triggerInteract());

        /* ── 背景音樂 ── */
        this.bgm = this.sound.add('bgm_game', { loop: true, volume: 0.5 });
        this.bgm.play();
        this.events.on('shutdown', () => { if (this.bgm) this.bgm.stop(); });
    }

    /* ────────────────────────────────────────────────────────
       對話框
    ──────────────────────────────────────────────────────── */
    _buildDialog() {
        const W = this.scale.width, H = this.scale.height;
        const bw = Math.min(W*0.76, 460), bh = 210, cx = W/2, cy = H/2;
        this.dlg = {};

        this.dlg.overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.55)
            .setScrollFactor(0).setDepth(40).setVisible(false).setInteractive()
            .on('pointerdown', () => this._closeDialog());

        this.dlg.box = this.add.rectangle(cx, cy, bw, bh, 0x0c0c22, 1)
            .setStrokeStyle(1.5, 0x5a4fff, 0.85).setScrollFactor(0).setDepth(41).setVisible(false);

        this.dlg.title = this.add.text(cx, cy-bh/2+20, '', {
            fontSize: '19px', fill: '#d4caff', fontFamily: "'Noto Sans TC',monospace",
            fontStyle: 'bold', letterSpacing: 3,
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(42).setVisible(false);

        this.dlg.divider = this.add.rectangle(cx, cy-bh/2+52, bw-36, 1, 0x2a2460)
            .setScrollFactor(0).setDepth(42).setVisible(false);

        this.dlg.rows = Array.from({length: 5}, (_, i) =>
            this.add.text(cx, cy-bh/2+64+i*26, '', {
                fontSize: '14px', fill: '#a197c8', fontFamily: "'Noto Sans TC',monospace",
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(42).setVisible(false)
        );

        this.dlg.actionBtn = this.add.text(cx-52, cy+bh/2-40, '', {
            fontSize: '14px', fill: '#b3aaff', fontFamily: "'Noto Sans TC',monospace",
            backgroundColor: '#1a1233', padding: {x:14, y:7},
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(43).setVisible(false)
          .setInteractive()
          .on('pointerover',  function(){ this.setStyle({fill:'#fff'}); })
          .on('pointerout',   function(){ this.setStyle({fill:'#b3aaff'}); })
          .on('pointerdown',  () => this._dialogAction());

        this.dlg.closeBtn = this.add.text(cx+52, cy+bh/2-40, '關閉', {
            fontSize: '14px', fill: '#555577', fontFamily: 'monospace',
            backgroundColor: '#111122', padding: {x:14, y:7},
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(43).setVisible(false)
          .setInteractive()
          .on('pointerover',  function(){ this.setStyle({fill:'#aaa'}); })
          .on('pointerout',   function(){ this.setStyle({fill:'#555577'}); })
          .on('pointerdown',  () => this._closeDialog());

        this._activeLandmark = null;
    }

    _openDialog(lm) {
        if (this.dialogOpen) return;
        this.dialogOpen = true; this._activeLandmark = lm;
        this.joyX = 0; this.joyY = 0; this.joyActive = false;
        this.joyStick.setPosition(this.baseX, this.baseY);
        const d = lm.dialog;
        this.dlg.title.setText(d.title);
        this.dlg.rows.forEach((r, i) =>
            i < d.lines.length ? r.setText(d.lines[i]).setVisible(true) : r.setVisible(false)
        );
        d.action
            ? this.dlg.actionBtn.setText(d.actionLabel || '確認').setVisible(true)
            : this.dlg.actionBtn.setVisible(false);
        [this.dlg.overlay, this.dlg.box, this.dlg.title, this.dlg.divider, this.dlg.closeBtn]
            .forEach(e => e.setVisible(true));
    }

    _closeDialog() {
        if (!this.dialogOpen) return;
        this.dialogOpen = false; this._activeLandmark = null;
        [this.dlg.overlay, this.dlg.box, this.dlg.title, this.dlg.divider,
         this.dlg.actionBtn, this.dlg.closeBtn].forEach(e => e.setVisible(false));
        this.dlg.rows.forEach(r => r.setVisible(false));
    }

    _dialogAction() {
        if (!this._activeLandmark) return;
        const action = this._activeLandmark.dialog.action;
        this._closeDialog();
        if (action === 'enter')      { PlayerState.save(this.player.x, this.player.y); this.scene.start('MusicScene'); }
        if (action === 'bug_report') this._openBugForm();
        if (action === 'guestbook')  this._openGuestbook();
        if (action === 'open_ig')    this._openIG();
        if (action === 'show_card')  this._showCard();
        if (action === 'open_link')  this._open_link();
       
    }

    _triggerInteract() {
        if (this.dialogOpen) return;
        let best = null, bestD = Infinity;
        for (const lm of this.landmarks) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, lm.x, lm.y);
            if (d < lm.interactDist && d < bestD) { bestD = d; best = lm; }
        }
        if (best) this._openDialog(best);
    }

    /* ── 外部連結 ── */
    _openIG() {
        window.open('https://www.instagram.com/kghs_78grad?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==', '_blank');
    }

    _open_link() {
        window.open('https://youtu.be/dQw4w9WgXcQ?si=nINUW_aP17-9zywm', '_blank');
    }

    // /* ── 邀請卡 DOM overlay ── */
    // _showCard() {
    //     if (this._cardEl) return;

    //     const overlay = document.createElement('div');
    //     overlay.style.cssText = `
    //         position:fixed; inset:0;
    //         background:rgba(0,0,0,0.82);
    //         display:flex; align-items:center; justify-content:center;
    //         z-index:9999; cursor:pointer;
    //         animation: fadeInCard 0.3s ease;
    //     `;

    //     if (!document.getElementById('card-style')) {
    //         const style = document.createElement('style');
    //         style.id = 'card-style';
    //         style.textContent = `
    //             @keyframes fadeInCard {
    //                 from { opacity:0; transform:scale(0.92); }
    //                 to   { opacity:1; transform:scale(1); }
    //             }
    //             @keyframes bobCard {
    //                 0%,100% { transform:translateY(0px) rotate(-1deg); }
    //                 50%     { transform:translateY(-8px) rotate(1deg); }
    //             }
    //         `;
    //         document.head.appendChild(style);
    //     }

    //     overlay.innerHTML = `
    //         <div style="position:relative; max-width:min(480px,88vw); text-align:center;">
    //             <img src="assets/card.png" alt="邀請卡"
    //                 style="width:100%; border-radius:12px;
    //                 box-shadow:0 0 60px rgba(90,79,255,0.6), 0 0 20px rgba(0,0,0,0.8);
    //                 animation: bobCard 3s ease-in-out infinite;">
    //             <div style="margin-top:14px; color:#9080cc; font-size:13px;
    //                 font-family:'Noto Sans TC',monospace; letter-spacing:2px;">
    //                 點擊任意處關閉
    //             </div>
    //         </div>
    //     `;

    //     overlay.onclick = () => {
    //         overlay.remove();
    //         this._cardEl = null;
    //         this.dialogOpen = false;
    //     };

    //     document.body.appendChild(overlay);
    //     this._cardEl = overlay;
    // }

    /* ── Bug 回報 ── */
  /* ── Bug 報表功能（開源安全最佳操作方案） ── */
    _buildBugForm() {
        this._bugFormEl = null;
        
        // 🔍 自動去撈網址後面有沒有掛 ?key=xxxx
        const urlParams = new URLSearchParams(window.location.search);
        this.bugAdminKey = urlParams.get('key') || ''; 
        
        // 預設不是管理員，由後端回傳的資料結構動態判定
        this.isAdmin = false; 
    }

    _openBugForm() {
        if (this._bugFormEl) return;

        const overlay = document.createElement('div');
        overlay.id = 'bug-form-layout';
        overlay.style.cssText = `position:fixed; inset:0; background:rgba(10,10,25,0.85); display:flex; align-items:center; justify-content:center; z-index:9999; font-family:'Noto Sans TC', sans-serif;`;

        overlay.innerHTML = `
            <div style="background:#131326; border:1px solid #5a4fff; border-radius:12px; padding:24px 28px; width:min(550px, 92vw); box-shadow:0 0 30px rgba(90,79,255,0.3); color:#d4caff;">
                <div style="font-size:18px; font-weight:bold; letter-spacing:2px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    🐇 Bug 回報與官方公告
                </div>
                
                <div id="bug-core-content">
                    <div id="form-view">
                        <label style="color:#9080cc; font-size:13px; display:block; margin-bottom:4px;">你的名字（可不填）</label>
                        <input id="bug-name" type="text" maxlength="30" placeholder="匿名" style="width:100%; box-sizing:border-box; padding:10px; background:#1a1a33; border:1px solid #3a3460; color:#fff; font-size:14px; border-radius:6px; outline:none; margin-bottom:12px;">
                        
                        <label style="color:#9080cc; font-size:13px; display:block; margin-bottom:4px;">問題或建議描述 *</label>
                        <textarea id="bug-desc" rows="5" maxlength="500" placeholder="請詳細描述您遇到的問題..." style="width:100%; box-sizing:border-box; padding:10px; background:#1a1a33; border:1px solid #3a3460; color:#fff; font-size:14px; border-radius:6px; outline:none; resize:vertical; margin-bottom:16px;"></textarea>
                    </div>
                    
                    <div id="list-view" style="display:none; max-height:380px; overflow-y:auto; margin-bottom:16px; padding-right:4px;">
                        <p style="text-align:center; color:#ffe066;">載入中...</p>
                    </div>
                </div>

                <div id="bug-status" style="color:#5fffb8; font-size:12px; margin-bottom:12px; text-align:center; min-height:18px;"></div>

                <div style="display:flex; gap:10px; justify-content:flex-end; align-items:center;">
                    <button id="bug-view-btn" style="background:#0f1a33; border:1px solid #4fa3ff; color:#9fd0ff; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:13px;">📋 檢視公告/後台</button>
                    <div style="flex-grow:1;"></div>
                    <button id="bug-cancel-btn" style="background:transparent; border:1px solid #333355; color:#777799; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px;">取消</button>
                    <button id="bug-submit-btn" style="background:#1a1233; border:1px solid #5a4fff; color:#b3aaff; padding:8px 24px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">📤 寄送</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._bugFormEl = overlay;

        const setStatus = (msg, color = '#5fffb8') => {
            const el = document.getElementById('bug-status');
            if (el) { el.textContent = msg; el.style.color = color; }
        };

        document.getElementById('bug-cancel-btn').onclick = () => this._closeBugForm();

        // ── 核心功能：切換與加載列表 ──
        document.getElementById('bug-view-btn').onclick = async () => {
            const formView = document.getElementById('form-view');
            const listView = document.getElementById('list-view');
            const submitBtn = document.getElementById('bug-submit-btn');

            if (listView.style.display === 'block') {
                listView.style.display = 'none';
                formView.style.display = 'block';
                submitBtn.style.display = 'block';
                document.getElementById('bug-view-btn').textContent = "📋 檢視公告/後台";
                setStatus('');
                return;
            }

            formView.style.display = 'none';
            submitBtn.style.display = 'none';
            listView.style.display = 'block';
            document.getElementById('bug-view-btn').textContent = "✍️ 我要回報";
            listView.innerHTML = '<p style="text-align:center; color:#ffe066;">安全連線加載中...</p>';

            try {
                // 將從網址上撈到的 bugAdminKey 傳給後端驗證
                const res = await fetch(`${API.BUG_URL}?type=bugs&key=${this.bugAdminKey}`);
                const result = await res.json();
                listView.innerHTML = '';

                // 依據後端判定傳回的身份，決定解鎖什麼介面
                this.isAdmin = (result.role === 'admin');
                const list = result.data || [];

                if (!list || list.length === 0) {
                    listView.innerHTML = `<p style="text-align:center; color:#9080cc; padding:20px;">${this.isAdmin ? '目前沒有待審核的回報資料。' : '目前尚無官方發布的 Bug 公告。'}</p>`;
                    return;
                }

                list.reverse().forEach(b => {
                    const itemEl = document.createElement('div');
                    itemEl.style.cssText = "background:#1a1a33; border:1px solid #2a2a4d; border-radius:8px; padding:14px; margin-bottom:12px; font-size:13px;";
                    
                    if (this.isAdmin) {
                        // 👑👑👑 【管理員專屬後台界面】 👑👑👑
                        const isChecked = b.isPublic === '1' ? 'checked' : '';
                        itemEl.innerHTML = `
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#7a7ab3; font-size:11px;">
                                <span>👤 回報者: ${b.name} (${b.time})</span>
                                <span style="color:#ffe066;">${b.isPublic === '1' ? '🌐 已公開公告' : '🔒 私密待審'}</span>
                            </div>
                            <div style="color:#888; background:#111122; padding:6px; border-radius:4px; margin-bottom:8px; font-size:12px; border-left:2px solid #3a3460; word-break:break-all;">
                                <b style="color:#666;">[玩家原始內容]:</b> ${b.desc}
                            </div>
                            <div style="margin-bottom:8px;">
                                <span style="color:#9fd0ff; font-size:11px; display:block; margin-bottom:2px;">✍️ 官方篩選/改寫後的公告問題描述：</span>
                                <textarea id="admin-desc-${b.id}" rows="2" style="width:100%; box-sizing:border-box; background:#0d0d1a; border:1px solid #4a4473; color:#fff; padding:6px; border-radius:4px; font-size:13px; resize:vertical;">${b.adminDesc || b.desc}</textarea>
                            </div>
                            <div style="margin-bottom:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                <span style="color:#9080cc;">狀況:</span>
                                <label><input type="radio" name="status-${b.id}" value="處理中" ${b.status === '處理中' ? 'checked' : ''}> 🟡 處理中</label>
                                <label><input type="radio" name="status-${b.id}" value="已修復" ${b.status === '已修復' ? 'checked' : ''}> 🟢 已修復</label>
                                <label><input type="radio" name="status-${b.id}" value="其他" ${b.status === '其他' ? 'checked' : ''}> 🔵 其他</label>
                                <div style="flex-grow:1;"></div>
                                <label style="background:#221b40; padding:3px 8px; border-radius:4px; border:1px solid #5a4fff; cursor:pointer; font-size:11px;">
                                    <input id="public-check-${b.id}" type="checkbox" ${isChecked}> 公開此公告
                                </label>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <input id="reply-input-${b.id}" type="text" value="${b.reply || ''}" placeholder="輸入給玩家看的回覆描述..." style="flex-grow:1; background:#0d0d1a; border:1px solid #4a4473; color:#fff; padding:6px; border-radius:4px; font-size:12px;">
                                <button class="save-bug-btn" data-id="${b.id}" style="background:#5a4fff; border:none; color:#fff; padding:4px 14px; border-radius:4px; cursor:pointer; font-weight:bold;">發布</button>
                            </div>
                        `;

                        // 點擊儲存單條 Bug 狀態
                        itemEl.querySelector('.save-bug-btn').onclick = async (e) => {
                            const rId = e.target.getAttribute('data-id');
                            const rAdminDesc = document.getElementById(`admin-desc-${rId}`).value.trim();
                            const rReply = document.getElementById(`reply-input-${rId}`).value.trim();
                            const rStatus = itemEl.querySelector(`input[name="status-${rId}"]:checked`).value;
                            const rIsPublic = document.getElementById(`public-check-${rId}`).checked ? '1' : '0';

                            e.target.disabled = true;
                            setStatus('正在同步至雲端試算表...', '#ffe066');

                            try {
                                await fetch(API.BUG_URL, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        type: 'update_bug',
                                        key: this.bugAdminKey, // 帶上暗號才能寫入
                                        id: rId,
                                        status: rStatus,
                                        reply: rReply,
                                        isPublic: rIsPublic,
                                        adminDesc: rAdminDesc
                                    })
                                });
                                setStatus('✓ 發布更新成功！', '#5fffb8');
                                e.target.disabled = false;
                            } catch (err) {
                                setStatus('❌ 儲存失敗', '#ff7eb3');
                                e.target.disabled = false;
                            }
                        };

                    } else {
                        // 👥👥👥 【一般玩家純公告界面】 👥👥👥
                        let statusColor = b.status === '已修復' ? '#5fffb8' : (b.status === '其他' ? '#4fa3ff' : '#ffe066');
                        itemEl.innerHTML = `
                            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                                <span style="color:#7a7ab3;">📢 官方公告狀況</span>
                                <span style="color:${statusColor}; font-weight:bold;">● ${b.status}</span>
                            </div>
                            <div style="color:#e0e0ff; background:#111126; padding:8px; border-radius:4px; white-space:pre-line; line-height:1.4;">${b.adminDesc}</div>
                            <div style="margin-top:6px; padding:6px 8px; background:#192340; border-left:3px solid #4fa3ff; border-radius:2px; color:#9fd0ff;">
                                <span style="font-weight:bold; font-size:11px; display:block; color:#4fa3ff;">官方回覆：</span>
                                ${b.reply || '感謝回報，技術人員正全力排查中。'}
                            </div>
                        `;
                    }
                    listView.appendChild(itemEl);
                });

            } catch (err) {
                listView.innerHTML = '<p style="text-align:center; color:#ff7eb3;">連線失敗，請重試</p>';
            }
        };

        // ── 玩家寄送新 Bug ──
        document.getElementById('bug-submit-btn').onclick = async () => {
            const name = document.getElementById('bug-name').value.trim() || '匿名';
            const desc = document.getElementById('bug-desc').value.trim();

            if (!desc) { setStatus('請填入問題或建議描述！', '#ff7eb3'); return; }

            document.getElementById('bug-submit-btn').disabled = true;
            setStatus('正在加密傳送中...', '#ffe066');

            try {
                await fetch(API.BUG_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'bug',
                        name: name,
                        desc: desc,
                        time: new Date().toLocaleString('zh-TW'),
                        ua: navigator.userAgent.substring(0, 80)
                    })
                });
                setStatus('✓ 提交成功！將進入人工審核，感謝回報 🐇');
                setTimeout(() => this._closeBugForm(), 1800);
            } catch (e) {
                setStatus('⚠️ 傳送失敗', '#ff7eb3');
                document.getElementById('bug-submit-btn').disabled = false;
            }
        };
    }

    _closeBugForm() {
        if (this._bugFormEl) { this._bugFormEl.remove(); this._bugFormEl = null; }
        this.dialogOpen = false;
    }


    /* ── 留言板 ── */
    _buildGuestbook() { this._gbEl = null; }

    async _openGuestbook() {
        if (this._gbEl) return;

        const overlay = document.createElement('div');
        overlay.id = 'gb-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.75);
            display:flex; align-items:center; justify-content:center;
            z-index:9999; font-family:'Noto Sans TC',monospace;
        `;
        overlay.innerHTML = `
            <div style="background:#0c0c22;border:1.5px solid #5a4fff;border-radius:10px;
                padding:24px 28px;width:min(520px,92vw);max-height:85vh;
                display:flex;flex-direction:column;box-shadow:0 0 40px #5a4fff44;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="color:#d4caff;font-size:18px;font-weight:bold;letter-spacing:3px;">📮 留言板</span>
                    <button id="gb-close" style="background:transparent;border:none;color:#555577;font-size:18px;cursor:pointer;">✕</button>
                </div>
                <div style="height:1px;background:#2a2460;margin-bottom:12px;"></div>
                <div id="gb-list" style="flex:1;overflow-y:auto;margin-bottom:14px;max-height:300px;min-height:80px;padding-right:4px;">
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
                            <option value="🌙">🌙</option><option value="🌸">🌸</option>
                            <option value="⭐">⭐</option><option value="🎵">🎵</option>
                            <option value="🐇">🐇</option><option value="💜">💜</option>
                            <option value="🌊">🌊</option>
                        </select>
                    </div>
                    <textarea id="gb-msg" rows="2" maxlength="200" placeholder="說點什麼吧…（200字以內）"
                        style="padding:7px 10px;background:#1a1a33;border:1px solid #3a3460;
                        color:#d4caff;font-size:13px;border-radius:5px;outline:none;resize:none;"></textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span id="gb-status" style="color:#5fffb8;font-size:12px;min-height:16px;"></span>
                        <button id="gb-submit" style="background:#1a1233;border:1px solid #5a4fff;
                            color:#b3aaff;padding:7px 20px;border-radius:5px;cursor:pointer;font-size:13px;">💬 留言</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this._gbEl = overlay;

        const setStatus = (msg, color='#5fffb8') => {
            const el = document.getElementById('gb-status');
            if (el) { el.textContent = msg; el.style.color = color; }
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
                this._insertMessageEl({ name, mood, msg, time: '剛剛' }, true);
            }
            document.getElementById('gb-submit').disabled = false;
        };
    }

    async _loadMessages() {
        const list = document.getElementById('gb-list');
        if (!list) return;
        const messages = await GSheets.get(API.MSG_URL, { type: 'messages' });
        if (!messages.length) {
            list.innerHTML = `<div style="color:#444466;font-size:13px;text-align:center;padding:20px 0;">
                還沒有留言，來第一個留言吧！🌙</div>`;
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
        card.style.cssText = `background:#131328;border:1px solid #2a2460;border-radius:6px;padding:10px 12px;margin-bottom:8px;`;
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#7c70c0;font-size:12px;">
                    ${m.mood || '🌙'} <strong style="color:#b3aaff;">${this._esc(m.name || '匿名')}</strong>
                </span>
                <span style="color:#333355;font-size:11px;">${this._esc(m.time || '')}</span>
            </div>
            <div style="color:#d4caff;font-size:13px;line-height:1.6;word-break:break-all;">
                ${this._esc(m.msg || '').replace(/\n/g, '<br>')}
            </div>
        `;
        if (prepend) list.insertBefore(card, list.firstChild);
        else list.appendChild(card);
    }

    _closeGuestbook() {
        if (this._gbEl) { this._gbEl.remove(); this._gbEl = null; }
        this.dialogOpen = false;
    }

    _esc(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    /* ── update loop ── */
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
            if (!lm.colW) continue;
            const inside = this.player.x > lm.x - lm.colW && this.player.x < lm.x + lm.colW
                        && this.player.y > lm.y - lm.colH && this.player.y < lm.y;
            if (inside) {
                this.player.x = prevX;
                const stillX = prevX > lm.x - lm.colW && prevX < lm.x + lm.colW
                             && this.player.y > lm.y - lm.colH && this.player.y < lm.y;
                if (stillX) this.player.y = prevY;
            }
        }

        if      (this.joyX < -0.2) this.player.anims.play('walk_left',  true);
        else if (this.joyX >  0.2) this.player.anims.play('walk_right', true);
        else                        this.player.anims.play('idle',       true);

        const t = time / 1000;
        let anyNear = false;

        for (const lm of this.landmarks) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, lm.x, lm.y);
            const near = dist < lm.nearDist;

            if (near && !lm.isNear) {
                lm.isNear = true;
                this.tweens.add({ targets: lm.halo, alpha: 0.30, duration: 350 });
            } else if (!near && lm.isNear) {
                lm.isNear = false;
                this.tweens.add({ targets: lm.halo, alpha: 0, duration: 300 });
            }
            if (near) anyNear = true;

            // 漂浮動畫
            if (lm.floatAmplitude && lm.sprite && lm.sprite.active) {
                const phase = t * lm.floatSpeed + lm._floatOffset;
                const floatY = Math.sin(phase) * lm.floatAmplitude;
                lm.sprite.y = lm.y + floatY;

                if (lm.shadow && lm.shadow.active) {
                    const shadowScale = 1 - Math.abs(floatY) / (lm.floatAmplitude * 3);
                    lm.shadow.setScale(shadowScale, 1).setAlpha(0.25 * shadowScale);
                    lm.shadow.setPosition(lm.x, lm.y - 4);
                }
            }
        }

        this.interactBtn.setVisible(true);
        if (anyNear) {
            this.interactBtn.setTexture('btn_active').setAlpha(1);
        } else {
            this.interactBtn.setTexture('btn_idle').setAlpha(0.5);
        }
    }
}