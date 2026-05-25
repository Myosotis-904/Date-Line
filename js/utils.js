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
   PlayerState — 全域玩家位置記憶（退出音樂場景後保留位置）
================================================================ */
const PlayerState = {
    x: null,
    y: null,
    save(x, y) { this.x = x; this.y = y; },
    load() { return { x: this.x, y: this.y }; },
    hasPosition() { return this.x !== null && this.y !== null; },
};