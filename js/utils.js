/* ================================================================
   GSheets — Google Sheets API 完美整合版（全面相容 type 參數分流）
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
            
            // 由於你的 bugs 讀取回傳的是 { role: '...', data: [...] }，而 messages 回傳的是 [...] 
            // 這裡做一層相容性解析，確保 Phaser 呼叫時不會報錯
            if (json && json.data) {
                return json.data; // 如果是 bug 回報包，提取裡面的 data 陣列
            }
            return Array.isArray(json) ? json : [];
        } catch (e) {
            console.error('[GSheets] get failed', e);
            return [];
        }
    },
};
