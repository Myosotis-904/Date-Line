'use strict';

/* ================================================================
   CalibrationScene — 聽聲按螢 Timing 自動校準（計時引擎徹底修復版）
================================================================ */
class CalibrationScene extends Phaser.Scene {
    constructor() { super('CalibrationScene'); }

    preload() {
        this.load.audio('tick',      'assets/tick_1.mp3');
        this.load.audio('tick_high', 'assets/tick_2.mp3');
        this.load.image('ui_bg',     'assets/your_image.jpg');
    }

    create() {
        // 安全喚醒音訊環境
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;

        this.add.image(W/2, H/2, 'ui_bg').setDisplaySize(W, H).setAlpha(0.35).setDepth(-2);
        this.add.rectangle(W/2, H/2, W, H, 0x070714, 0.85).setDepth(-1);

        // ⚙️ 核心變數初始化
        this.bpm = 120;
        this.intervalMs = 60000 / this.bpm; // 120 BPM = 每拍 500ms
        this.maxBeats = 16;                 
        
        this.offsetSamples = [];
        this.isRunning = false;
        this.beatCount = 0;
        this._nativeTimer = null; // 🚀 改用原生計時器指標
        this.actualBeatTimestamps = []; 

        // UI 文本
        this.titleTxt = this.add.text(W/2, H*0.08, 'TIMING 延遲校準', {
            fontSize: '24px', fill: '#d4caff', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 6,
        }).setOrigin(0.5);

        this.subTxt = this.add.text(W/2, H*0.15, '請閉上眼睛聆聽節拍，並抓準拍點點擊螢幕', {
            fontSize: '14px', fill: '#8880c0', fontFamily: "'Noto Sans TC', sans-serif",
        }).setOrigin(0.5);

        this.beatCircle = this.add.circle(W/2, H*0.42, 85, 0x1a1245, 1);
        this.beatCircle.setStrokeStyle(3, 0x5a4fff, 0.5);

        this.beatIcon = this.add.text(W/2, H*0.42, '♪', {
            fontSize: '56px', fill: '#5a4fff', fontFamily: 'monospace', fontWeight: 'bold'
        }).setOrigin(0.5);

        this.samplesTxt = this.add.text(W/2, H*0.62, '點擊次數：0', {
            fontSize: '15px', fill: '#9080cc', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.offsetTxt = this.add.text(W/2, H*0.68, '平均偏移：— ms', {
            fontSize: '20px', fill: '#5fffb8', fontFamily: 'monospace', fontWeight: 'bold'
        }).setOrigin(0.5);

        this.hintTxt = this.add.text(W/2, H*0.75, '', {
            fontSize: '14px', fill: '#ffe066', fontFamily: "'Noto Sans TC', sans-serif",
        }).setOrigin(0.5);

        // 按鈕群組
        this.startBtn = this.add.text(W/2, H*0.84, '▶  開始測試', {
            fontSize: '18px', fill: '#a5e8ff', fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 'bold',
            backgroundColor: '#13233a', padding: { x:32, y:12 },
        }).setOrigin(0.5).setInteractive()
          .on('pointerover', function(){ this.setStyle({fill:'#fff', backgroundColor:'#1a3152'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#a5e8ff', backgroundColor:'#13233a'}); })
          .on('pointerdown', () => this._startCalibration());

        this.doneBtn = this.add.text(W/2, H*0.84, '✓  儲存設定並返回', {
            fontSize: '18px', fill: '#5fffb8', fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 'bold',
            backgroundColor: '#0a2416', padding: { x:32, y:12 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({fill:'#fff', backgroundColor:'#113d25'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#5fffb8', backgroundColor:'#0a2416'}); })
          .on('pointerdown', () => this._finishCalibration());

        this.resetBtn = this.add.text(W/2, H*0.92, '↩  重新測試', {
            fontSize: '14px', fill: '#7777aa', fontFamily: 'monospace',
            backgroundColor: '#16162d', padding: { x:20, y:8 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({fill:'#fff'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#7777aa'}); })
          .on('pointerdown', () => this._resetCalibration());

        // 全螢幕點擊
        this.input.on('pointerdown', (ptr) => {
            if (ptr.y > H * 0.80 || (ptr.x < 120 && ptr.y < 80)) return; 
            if (!this.isRunning) return;
            this._recordTap();
            this._flashTap();
        });

        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        this.hintTxt.setText(`目前儲存值：${saved > 0 ? '+' : ''}${saved} ms`);

        this.backBtn = this.add.text(20, 20, '← 返回', {
            fontSize: '14px', fill: '#aaa', fontFamily: 'monospace',
            backgroundColor: '#1a1a26', padding: { x:12, y:6 },
        }).setInteractive()
          .on('pointerdown', () => {
              this._cleanUpCalibration();
              this.scene.start('MusicScene');
          });

        this.events.on('shutdown', () => { this._cleanUpCalibration(); });
    }

    _startCalibration() {
        if (this.sound.context) {
            this.sound.context.resume()
                .then(() => this._doStartCalibration())
                .catch(() => this._doStartCalibration());
        } else {
            this._doStartCalibration();
        }
    }

    _doStartCalibration() {
        // 強制清理上一次可能殘留的計時器
        if (this._nativeTimer) { clearInterval(this._nativeTimer); this._nativeTimer = null; }

        this.isRunning = true;
        this.offsetSamples = [];
        this.beatCount = 0;
        this.actualBeatTimestamps = [];

        this.startBtn.setVisible(false);
        this.doneBtn.setVisible(false);
        this.resetBtn.setVisible(false);
        this.backBtn.setVisible(false); 
        
        this.hintTxt.setText(`校準進行中：第 0 / ${this.maxBeats} 拍`);
        this.samplesTxt.setText('點擊次數：0');
        this.offsetTxt.setText('平均偏移：— ms');

        // 🚀 核心改動：立刻執行第一拍
        this._playBeat();

        // 🚀 核心改動：改用 JavaScript 原生不卡死的 setInterval 引擎
        this._nativeTimer = setInterval(() => {
            // 安全防禦：如果場景已經不在執行狀態，自動自我銷毀
            if (!this || !this.sys || !this.sys.isActive() || !this.isRunning) {
                if (this._nativeTimer) { clearInterval(this._nativeTimer); this._nativeTimer = null; }
                return;
            }
            this._playBeat();
        }, this.intervalMs);
    }

    _playBeat() {
        if (!this.isRunning) return;
        this.beatCount++;
        
        const currentAudioTimeMs = this.sound.context ? this.sound.context.currentTime * 1000 : Date.now();
        this.actualBeatTimestamps.push(currentAudioTimeMs);

        // 播放聲音
        if (this.beatCount % 4 === 1) {
            this.sound.play('tick_high', { volume: 0.8 });
        } else {
            this.sound.play('tick', { volume: 0.8 });
        }

        // 節拍視覺動態脈衝 (使用簡單、不依賴複雜 Time 系統的直接 Tweens)
        if (this.beatCircle && this.beatCircle.active) {
            this.beatCircle.setFill(0x3a2da6);
            this.tweens.add({
                targets: this.beatCircle, fillAlpha: 1, duration: 100,
                onComplete: () => { if(this.beatCircle && this.beatCircle.active) this.beatCircle.fillStyle(0x1a1245, 1); }
            });
        }
        
        if (this.beatIcon && this.beatIcon.active) {
            this.beatIcon.setScale(1.25).setFill('#fffb80');
            this.tweens.add({
                targets: this.beatIcon, scaleX: 1, scaleY: 1, duration: 120,
                onComplete: () => { if(this.beatIcon && this.beatIcon.active) this.beatIcon.setFill('#5a4fff'); }
            });
        }

        // 🔢 即時更新文字（這裡一定會開始動了！）
        if (this.hintTxt && this.hintTxt.active) {
            this.hintTxt.setText(`校準進行中：第 ${this.beatCount} / ${this.maxBeats} 拍`);
        }

        // 滿 16 拍自動觸發停止機制
        if (this.beatCount >= this.maxBeats) {
            this._stopCalibration();
        }
    }

    _recordTap() {
        const tapAudioTimeMs = this.sound.context ? this.sound.context.currentTime * 1000 : Date.now();
        if (this.actualBeatTimestamps.length === 0) return;

        let closestBeatTime = this.actualBeatTimestamps[0];
        let minDiff = Infinity;

        for (const beatTime of this.actualBeatTimestamps) {
            const diff = Math.abs(tapAudioTimeMs - beatTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestBeatTime = beatTime;
            }
        }

        const offset = tapAudioTimeMs - closestBeatTime;

        if (Math.abs(offset) < this.intervalMs * 0.40) {
            this.offsetSamples.push(offset);
        }

        const count = this.offsetSamples.length;
        this.samplesTxt.setText(`有效點擊次數：${count}`);

        if (count >= 2) {
            const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / count;
            const rounded = Math.round(avg);
            this.offsetTxt.setText(`平均偏移：${rounded > 0 ? '+' : ''}${rounded} ms`);
            
            let evalStr = '';
            const absOfs = Math.abs(rounded);
            if (absOfs <= 15) evalStr = '✨ 神之神準！';
            else if (absOfs <= 35) evalStr = '🟢 狀態極佳！';
            else if (absOfs <= 65) evalStr = '🟡 稍微偏慢/快，建議儲存';
            else evalStr = '🔴 嚴重延遲（建議檢查耳機裝置）';

            this.hintTxt.setText(`${evalStr}（已採集 ${count} 個有效點擊）`);
        }
    }

    _flashTap() {
        const W = this.cameras.main.width, H = this.cameras.main.height;
        if (this._tapFlash) this._tapFlash.destroy();
        this._tapFlash = this.add.rectangle(W/2, H/2, W, H, 0x5a4fff, 0).setStrokeStyle(5, 0x5fffb8, 0.75).setDepth(10);
        this.tweens.add({
            targets: this._tapFlash, strokeAlpha: 0, duration: 200,
            onComplete: () => { if (this._tapFlash) this._tapFlash.destroy(); this._tapFlash = null; }
        });
    }

    _stopCalibration() {
        this.isRunning = false;
        if (this._nativeTimer) { clearInterval(this._nativeTimer); this._nativeTimer = null; }
        
        this.doneBtn.setVisible(true);
        this.resetBtn.setVisible(true);
        this.backBtn.setVisible(true); 

        if (this.offsetSamples.length < 3) {
            this.hintTxt.setText('❌ 有效採樣點不足 3 次，請重新測試，並記得跟著節拍敲擊螢幕唷！');
            this.doneBtn.setStyle({ fill: '#555', backgroundColor: '#222' }); 
        } else {
            this.doneBtn.setStyle({ fill: '#5fffb8', backgroundColor: '#0a2416' });
            this.hintTxt.setText('🎉 校準完成！請點擊上方綠色按鈕「儲存設定並返回」。');
        }
    }

    _finishCalibration() {
        if (this.offsetSamples.length < 3) { this._resetCalibration(); return; }
        const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
        SafeStorage.setItem('timingOffset', Math.round(avg));
        this._cleanUpCalibration();
        this.scene.start('MusicScene');
    }

    _resetCalibration() {
        this._cleanUpCalibration();
        this.startBtn.setVisible(true);
        this.doneBtn.setVisible(false);
        this.resetBtn.setVisible(false);
        this.backBtn.setVisible(true);
        this.samplesTxt.setText('點擊次數：0');
        this.offsetTxt.setText('平均偏移：— ms');
        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        this.hintTxt.setText(`目前儲存值：${saved > 0 ? '+' : ''}${saved} ms`);
        this.beatIcon.setFill('#5a4fff').setScale(1);
    }

    _cleanUpCalibration() {
        this.isRunning = false;
        if (this._nativeTimer) {
            clearInterval(this._nativeTimer);
            this._nativeTimer = null;
        }
        this.tweens?.killAll();
        this.sound?.stopAll();
    }
}
