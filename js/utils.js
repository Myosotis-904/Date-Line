/* ================================================================
   PlayerState — 全局遊戲狀態管理器（修正 GameScene.js 崩潰之核心）
================================================================ */
/* ================================================================
   PlayerState — 全局遊戲狀態管理器（最終完美修復版）
================================================================ */
const PlayerState = {
    // 基礎玩家資料與設定
    name: '匿名',
    mood: '😊',
    timingOffset: 0, // 音訊校準延遲數據 (ms)
    
    // 🌟 記憶玩家在地圖上的座標（預設給 null，方便 hasPosition 判斷）
    startX: null,
    startY: null,

    // 當前節奏遊戲選曲狀態
    currentSong: null,
    currentDifficulty: 'Normal',

    // 歷史最高紀錄暫存
    lastScore: 0,
    lastCombo: 0,
    lastAccuracy: 0,
    lastGrade: 'F',

    // 初始化或重置狀態的方法
    reset() {
        this.lastScore = 0;
        this.lastCombo = 0;
        this.lastAccuracy = 0;
        this.lastGrade = 'F';
        this.startX = null;
        this.startY = null;
        console.log('[PlayerState] 遊戲狀態已成功重置');
    },

    // 讀取本地延遲校準值
    loadOffset() {
        try {
            const saved = localStorage.getItem('timingOffset');
            if (saved !== null) {
                this.timingOffset = parseInt(saved, 10) || 0;
            }
        } catch(e) {
            this.timingOffset = 0;
        }
    },

    // 🌟 防呆：全域防禦 load 噴錯
    load() {
        this.loadOffset();
        console.log(`[PlayerState] 延遲設定已讀入: ${this.timingOffset} ms`);
    },

    // 🌟 實作 save 函式：暫存玩家目前的位置
    save(x, y) {
        this.startX = x;
        this.startY = y;
        console.log(`[PlayerState] 已記憶玩家位置: (${Math.round(x)}, ${Math.round(y)})`);
    },

    // 🌟 【全新補上】實作 hasPosition 函式：消滅 hasPosition is not a function 報錯！
    // 檢查有沒有記憶過玩家座標，如果有就回傳 true，沒有就回傳 false
    hasPosition() {
        return this.startX !== null && this.startY !== null;
    }
};

// 立即執行一次校準值讀取
PlayerState.loadOffset();


/* ================================================================
   GSheets — Google Sheets API 完美整合版（表單盲送跨域無敵版）
================================================================ */
const GSheets = {
    // ⚡ 寫入/更新數據 (相容 bug, message, update_bug)
   // ⚡ 寫入/更新數據 (修正後的 JSON 提交版)
    async post(url, data) {
        if (!url || url.startsWith('YOUR_')) {
            console.warn('[GSheets] URL 尚未設定。', data);
            return { ok: false, reason: 'no_url' };
        }
        try {
            const response = await fetch(url, {
                method: 'POST',
                // ⚠️ 注意：不要使用 no-cors，否則後端收不到正確的數據。
                // 只要你的 GAS 部署權限設定為「Anyone / 所有人」，fetch 就可以直接運作
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json(); // 讀取後端回傳的狀態
            console.log('[GSheets] POST 成功:', result);
            return { ok: true, data: result };
        } catch (e) {
            console.error('[GSheets] post failed', e);
            return { ok: false, reason: e.message };
        }
    },
    // 📖 讀取數據 (相容 type='messages' 與 type='bugs')
    async get(url, params = {}) {
        if (!url || url.startsWith('YOUR_')) {
            return [];
        }
        try {
            // 加上 _cb 毫秒級時間戳，確保非本地端環境每次點開留言板都是最新的
            const qs = new URLSearchParams({ ...params, _cb: Date.now() }).toString();
            const res = await fetch(`${url}?${qs}`);
            const json = await res.json();
            
            if (json && json.data) {
                return json.data; 
            }
            return Array.isArray(json) ? json : [];
        } catch (e) {
            console.error('[GSheets] get failed', e);
            return [];
        }
    },
};
