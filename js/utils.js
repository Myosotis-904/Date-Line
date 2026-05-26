/* ================================================================
   PlayerState — 全局遊戲狀態管理器（修正 GameScene.js 崩潰之核心）
================================================================ */
const PlayerState = {
    // 基礎玩家資料與設定
    name: '匿名',
    mood: '😊',
    timingOffset: 0, // 音訊校準延遲數據 (ms)

    // 當前節奏遊戲選曲狀態
    currentSong: null,
    currentDifficulty: 'Normal',

    // 歷史最高紀錄暫存 (可供場景讀取渲染)
    lastScore: 0,
    lastCombo: 0,
    lastAccuracy: 0,
    lastGrade: 'F',

    // 初始化或重置狀態的方法 (防止 GameScene 呼叫時噴錯)
    reset() {
        this.lastScore = 0;
        this.lastCombo = 0;
        this.lastAccuracy = 0;
        this.lastGrade = 'F';
        console.log('[PlayerState] 遊戲狀態已成功重置');
    },

    // 自訂讀取/寫入校準值防呆
    loadOffset() {
        try {
            const saved = localStorage.getItem('timingOffset');
            if (saved !== null) {
                this.timingOffset = parseInt(saved, 10) || 0;
            }
        } catch(e) {
            this.timingOffset = 0;
        }
    }
};

// 立即執行一次校準值讀取
PlayerState.loadOffset();


/* ================================================================
   GSheets — Google Sheets API 完美整合版（表單盲送跨域無敵版）
================================================================ */
const GSheets = {
    // ⚡ 寫入/更新數據 (相容 bug, message, update_bug)
    async post(url, data) {
        if (!url || url.startsWith('YOUR_')) {
            console.warn('[GSheets] URL 尚未設定。', data);
            return { ok: false, reason: 'no_url' };
        }
        try {
            // 建立一個網頁底層的隱形 HTML 表單，暴力破解 GitHub Pages 的 NetworkError 跨域阻擋
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = url;
            form.target = 'hidden_iframe';
            form.style.display = 'none';

            // 塞入原有資料，並補上隨機時間戳記破壞快取
            const extendedData = { ...data, _cb: Date.now() };

            for (const key in extendedData) {
                if (extendedData.hasOwnProperty(key)) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = extendedData[key];
                    form.appendChild(input);
                }
            }

            let iframe = document.getElementById('hidden_iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'hidden_iframe';
                iframe.name = 'hidden_iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            document.body.appendChild(form);
            form.submit(); // 出航！

            setTimeout(() => { form.remove(); }, 500);
            return { ok: true }; 
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
