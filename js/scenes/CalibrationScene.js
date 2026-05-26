'use strict';

/* ================================================================
    CalibrationScene — 獨立打擊區與開始鍵分離版
================================================================ */
class CalibrationScene extends Phaser.Scene {
    constructor() {
        super('CalibrationScene');
    }

    init() {
        this.bpm = 120; 
        this.intervalMs = (60 / this.bpm) * 1000; 
        
        this.isRunning = false;
        this.beatCount = 0;
        this.actualBeatTimestamps = [];
        this.offsetSamples = [];
        this.finalOffset = 0;
        
        this._beatTimerEvent = null;
    }

    preload() {
        this.load.audio('tick_high', 'assets/tick_high.mp3');
        this.load.audio('tick', 'assets/tick.mp3');
    }

    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        // 1. 建立中央互動圓圈（純打擊區域）
        this.beatCircle = this.add.circle(W / 2, H / 2 - 40, 90, 0x1a1245);
        this.beatCircle.setStrokeStyle(4, 0x5a4fff, 0.8);

        // 🚀【新增】中央圓圈內的 TAP 提示文字，跟隨圓圈位置
        this.circleTapTxt = this.add.text(W / 2, H / 2 - 40, 'TAP', {
            fontSize: '28px', fill: '#5a4fff', fontFamily: 'monospace', fontWeight: 'bold'
        }).setOrigin(0.5);

        // 2. 文字顯示介面
        this.titleTxt = this.add.text(W / 2, H / 2 - 190, '硬體延遲校準系統', {
            fontSize: '26px', fill: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold'
        }).setOrigin(0.5);

        // 🚀 修改初始提示
        this.hintTxt = this.add.text(W / 2, H / 2 + 100, '請點擊下方的「START」按鈕開始', {
            fontSize: '16px', fill: '#a5e8ff', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5);

        this.samplesTxt = this.add.text(W / 2, H / 2 + 140, '準備就緒', {
            fontSize: '15px', fill: '#7c70c0', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.offsetTxt = this.add.text(W / 2, H / 2 + 170, '延遲修正值：-- ms', {
            fontSize: '20px', fill: '#fffb80', fontFamily: 'monospace', fontWeight: 'bold'
        }).setOrigin(0.5);

        // 3. 建立按鈕群組（START 已移至下方）
        this._createControlButtons(W, H);

        // 4. 全螢幕點擊監聽
        this.input.on('pointerdown', (pointer) => {
            if (!this.isRunning) return;
            
            // 排除下方所有控制按鈕區域的點擊，確保點擊按鈕不計入校準
            if (this.backBtn.getBounds().contains(pointer.x, pointer.y)) return;
            if (this.startCalibrationBtn.visible && this.startCalibrationBtn.getBounds().contains(pointer.x, pointer.y)) return;
            if (this.resetBtn.visible && this.resetBtn.getBounds().contains(pointer.x, pointer.y)) return;
            if (this.doneBtn.visible && this.doneBtn.getBounds().contains(pointer.x, pointer.y)) return;

            this._recordTap();
        });
    }

    _createControlButtons(W, H) {
        const btnY = H / 2 + 230; // 下方統一按鈕高度

        // 🚀【修改】START 按鈕移到下方，與中央打擊區分離
        this.startCalibrationBtn = this.add.text(W / 2, btnY, '▶ START', {
            fontSize: '18px', fill: '#fffb80', fontFamily: 'monospace', fontWeight: 'bold',
            backgroundColor: '#111026', padding: { x: 24, y: 12 }
        }).setOrigin(0.5).setInteractive()
          .on('pointerdown', () => {
              if (this.sound.context && this.sound.context.state === 'suspended') {
                  this.sound.context.resume().then(() => this._startCalibration()).catch(() => this._startCalibration());
              } else {
                  this._startCalibration();
              }
          });
        this.startCalibrationBtn.setStyle({ stroke: '#5a4fff', strokeThickness: 1 });

        // 🔄 重新測試按鈕（位於左下方）
        this.resetBtn = this.add.text(W / 2 - 100, btnY, '🔄 重新測試', {
            fontSize: '15px', fill: '#d4caff', backgroundColor: '#1a1a33', padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerdown', () => this._startCalibration());

        // 💾 儲存並返回按鈕（位於右下方）
        this.doneBtn = this.add.text(W / 2 + 100, btnY, '💾 儲存並返回', {
            fontSize: '15px', fill: '#5fffb8', backgroundColor: '#0a2416', padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerdown', () => this._finishCalibration());

        // ◀ 放棄按鈕
        this.backBtn = this.add.text(20, 20, '◀ 放棄', {
            fontSize: '14px', fill: '#999', backgroundColor: '#222', padding: { x: 10, y: 6 }
        }).setInteractive().on('pointerdown', () => {
            this._cleanUpCalibration();
            this.scene.start('MusicScene');
        });
    }

   _startCalibration() {
        this._cleanUpCalibration();

        // 🚀【核心修正】先不要把 isRunning 設為 true，防止同一時間的全螢幕點擊事件偷跑
        this.isRunning = false; 
        this.beatCount = 0;
        this.actualBeatTimestamps = [];
        this.offsetSamples = [];

        // 隱藏下方的開始與控制按鈕
        this.startCalibrationBtn.setVisible(false);
        this.resetBtn.setVisible(false);
        this.doneBtn.setVisible(false);
        
        this.beatCircle.setFillStyle(0x1a1245).setScale(1);
        this.circleTapTxt.setFill('#ffffff'); 

        this.hintTxt.setText('請聽著「高音強拍」的節奏點擊螢幕');
        this.samplesTxt.setText('已採集樣本：0 / 4');
        this.offsetTxt.setText('延遲修正值：-- ms');

        // 🚀【核心修正】延遲 100 毫秒（手指離開螢幕後），才正式把啟動開關打開並播放節拍
        this.time.delayedCall(100, () => {
            this.isRunning = true;
            this._nextBeatLoop();
        }, [], this);
    }

    _nextBeatLoop() {
        if (!this.isRunning) return;

        this.beatCount++;
        const currentAudioTimeMs = this.time.now;
        this.actualBeatTimestamps.push(currentAudioTimeMs);

        if (this.beatCount % 4 === 1) {
            this.sound.play('tick_high', { volume: 0.8 });
        } else {
            this.sound.play('tick', { volume: 0.8 });
        }

        this._beatTimerEvent = this.time.delayedCall(this.intervalMs, () => {
            this._nextBeatLoop();
        }, [], this);
    }

    _recordTap() {
        const tapAudioTimeMs = this.time.now;
        if (this.actualBeatTimestamps.length === 0) return;

        // 🚀 點觸視覺同步閃爍（圓圈變白，TAP文字稍微放大變色）
        if (this.beatCircle && this.beatCircle.active) {
            this.beatCircle.setFillStyle(0xffffff); 
            this.beatCircle.setScale(1.25);
            this.circleTapTxt.setFill('#000000').setScale(1.25); // 文字變成黑色突顯

            this.tweens.killTweensOf([this.beatCircle, this.circleTapTxt]);
            this.tweens.add({
                targets: [this.beatCircle, this.circleTapTxt],
                scaleX: 1,
                scaleY: 1,
                duration: 130,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    if (this.beatCircle && this.beatCircle.active) {
                        this.beatCircle.setFillStyle(0x1a1245); 
                        this.circleTapTxt.setFill('#ffffff'); // 還原白字
                    }
                }
            });
        }

        const strongBeats = this.actualBeatTimestamps.filter((time, index) => index % 4 === 0);
        if (strongBeats.length === 0) return;

        let closestBeatTime = strongBeats[0];
        let minDiff = Infinity;
        for (const beatTime of strongBeats) {
            const diff = Math.abs(tapAudioTimeMs - beatTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestBeatTime = beatTime;
            }
        }

        const offset = tapAudioTimeMs - closestBeatTime;

        if (Math.abs(offset) < this.intervalMs * 1.5) {
            this.offsetSamples.push(offset);
        }

        const count = this.offsetSamples.length;
        this.samplesTxt.setText(`已採集樣本：${count} / 4`);

        if (count >= 2) {
            const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / count;
            const rounded = Math.round(avg);
            this.offsetTxt.setText(`延遲修正值：${rounded > 0 ? '+' : ''}${rounded} ms`);
            this.hintTxt.setText('偵測中... 請繼續跟隨強拍點擊');
        }

        if (count >= 4) {
            this._stopCalibration();
        }
    }

    _stopCalibration() {
        this.isRunning = false;
        if (this._beatTimerEvent) {
            this._beatTimerEvent.remove();
            this._beatTimerEvent = null;
        }

        this.resetBtn.setVisible(true);
        this.doneBtn.setVisible(true);
        
        // 讓中央的 TAP 字樣暗下來，代表測試結束
        this.circleTapTxt.setFill('#5a4fff');

        if (this.offsetSamples.length < 4) {
            this.hintTxt.setText('❌ 有效強拍點擊未滿 4 次，請點選重新測試。');
            this.doneBtn.setStyle({ fill: '#555', backgroundColor: '#222' });
        } else {
            const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
            this.finalOffset = Math.round(avg);

            this.doneBtn.setStyle({ fill: '#5fffb8', backgroundColor: '#0a2416' });
            this.offsetTxt.setText(`最終延遲數據：${this.finalOffset > 0 ? '+' : ''}${this.finalOffset} ms`);
            this.hintTxt.setText('⚙️ 資料已就緒，請儲存此設定。');
        }
    }

    _finishCalibration() {
        if (this.offsetSamples.length < 4) return;

        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem('timingOffset', this.finalOffset);
        } else {
            localStorage.setItem('timingOffset', this.finalOffset);
        }
        console.log(`[校準系統] 成功儲存延遲: ${this.finalOffset} ms`);

        this._cleanUpCalibration();
        this.scene.start('MusicScene');
    }

    _cleanUpCalibration() {
        this.isRunning = false;
        if (this._beatTimerEvent) {
            this._beatTimerEvent.remove();
            this._beatTimerEvent = null;
        }
        if (this.tweens) this.tweens.killAll();
        if (this.sound) this.sound.stopAll();
    }
}
