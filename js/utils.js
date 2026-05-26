'use strict';

/* ================================================================
   SafeStorage — iOS Safari 私密模式下 localStorage 安全封裝
================================================================ */
const SafeStorage = {
    getItem(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    },
    setItem(key, value) {
        try { localStorage.setItem(key, value); } catch(e) { /* silent fail */ }
    },
};

/* ================================================================
   GSheets — Google Sheets API 封裝
================================================================ */
const GSheets = {
    async post(url, data) {
        if (!url || url.startsWith('YOUR_')) {
            console.warn('[GSheets] URL 尚未設定，資料僅印出：', data);
            return { ok: false, reason: 'no_url' };
        }
        try {
            // 🚀 改用 text/plain 發送純 JSON 字串，完美繞過所有 GitHub Pages 的 CORS 預檢限制
            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors', // 🚀 必須用 cors 才能看得到試算表有沒有真的寫入成功！
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data), // 🚀 後端用 JSON.parse 接收，格式絕對精準
            });
            
            const result = await response.json();
            
            if (result.status === 'ok' || result.status === 'success') {
                return { ok: true };
            } else {
                return { ok: false, reason: result.msg || result.message || '後端寫入失敗' };
            }
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
            // 將所有參數轉成 query string 串在網址後面
            const qs = new URLSearchParams(params).toString();
            const res = await fetch(`${url}?${qs}`, {
                method: 'GET',
                mode: 'cors' // 🚀 確保讀取也是相容跨網域的
            });
            
            const json = await res.json();
            
            // 判斷回傳結構，如果是管理員後台的 { data: [...] } 就拆開，否則直接回傳陣列
            if (json && json.data && Array.isArray(json.data)) {
                return json.data;
            }
            return Array.isArray(json) ? json : [];
        } catch (e) {
            console.error('[GSheets] get failed', e);
            return [];
        }
    },
};

/* ================================================================
   PlayerState — 全域玩家位置記憶（退出音樂場景後保留位置）
================================================================ */
const PlayerState = {
    x: null,
    y: null,
    save(x, y) { this.x = x; this.y = y; },
    load() { return { x: this.x, y: this.y }; },
    hasPosition() { return this.x !== null && this.y !== null; },
};
