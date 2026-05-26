'use strict';

/* ================================================================
   API 端點設定
================================================================ */
const API = {
    BUG_URL: 'https://script.google.com/macros/s/AKfycbyPFEJpAtVsDQEaPyii9EF_LpwPKeCGa_S6BajUjwOsVg_Fv1bEny7UxQon85BQE9YB2Q/exec',
    MSG_URL: 'https://script.google.com/macros/s/AKfycbyPFEJpAtVsDQEaPyii9EF_LpwPKeCGa_S6BajUjwOsVg_Fv1bEny7UxQon85BQE9YB2Q/exec',
    REPLY_URL: 'https://script.google.com/macros/s/AKfycbyPFEJpAtVsDQEaPyii9EF_LpwPKeCGa_S6BajUjwOsVg_Fv1bEny7UxQon85BQE9YB2Q/exec'
};

/* ================================================================
   音樂遊戲場景設定
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
   地標資料表
================================================================ */
const LANDMARKS = [

    // ── 海浪地標（動態精靈圖）──
    {
        key: 'wave', x: 720, y: 890, scale: 0.719,
        nearDist: 180, interactDist: 220,
        isWave: true,
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
            title: '神奇海螺(留言板)［系統維護中］',
            lines: ['為什麼不告訴神奇海螺呢?', ' ', '(神奇海螺會把秘密告訴所有人。)'],
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
            lines: ['放心他不會把你丟出蟹堡王。', ' 還有他真的沒熟。'],
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
            title: '可疑的綠色兔子［系統維護中］',
            lines: ['發現 bug 或有建議嗎？', '點下面填寫回報，我會努力修修看:)','絕望的作者被背板背刺了','比較複雜的BUG會在周三之後處理，大感謝'],
            action: 'bug_report',
            actionLabel: '📝 填寫回報',
        },
    },

    // ── 吉祥物（太陽）地標 ──
    {
        key: 'sun', x: 1300, y: 1900, scale: 0.2,
        colW: 50, colH: 60,
        nearDist: 170, interactDist: 210,
        floatAmplitude: 12,
        floatSpeed: 1.8,
        hasShadow: true,
        dialog: {
            title: '✨太陽朋友',
            lines: [, '想知道更多相關資訊嗎？', '快去追蹤我們的 IG 吧！'],
            action: 'open_ig',
            actionLabel: '🌟 前往 IG',
        },
    },

    // // ── 漂流瓶地標 ──
    // {
    //     key: 'buttle', x: 300, y: 300, scale: 0.9,
    //     colW: 35, colH: 50,
    //     nearDist: 160, interactDist: 200,
    //     floatAmplitude: 8,
    //     floatSpeed: 1.9,
    //     hasShadow: true,
    //     dialog: {
    //         title: '漂流瓶',
    //         lines: ['瓶子裡好像裝著什麼...', '要打開來看看嗎？'],
    //         action: 'show_card',
    //         actionLabel: '💌 打開漂流瓶',
    //     },
    // },
];