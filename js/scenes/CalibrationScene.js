'use strict';

/* ================================================================
   CalibrationScene — 聽聲按螢 Timing 自動校準
================================================================ */
class CalibrationScene extends Phaser.Scene {
    constructor() { super('CalibrationScene'); }

    preload() {
        this.load.audio('tick',      'assets/tick_1.mp3');
        this.load.audio('tick_high', 'assets/tick_2.mp3');
        this.load.image('ui_bg',     'assets/your_image.jpg');
    }

    create() {
        // iOS Safari：確保 AudioContext 已啟動
        if (this.sound.context && this.sound.context.state === 'suspended') {
            this.sound.context.resume().catch(() => {});
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;

        this.add.image(W/2, H/2, 'ui_bg').setDisplaySize(W, H).setAlpha(0.6);
        this.add.rectangle(W/2, H/2, W, H, 0x050510, 0.75);

        this.bpm = 120;
        this.intervalMs = 60000 / this.bpm;
        this.offsetSamples = [];
        this.isRunning = false;
        this.beatCount = 0;
        this._beatTimer = null;
        this.startAudioTime = 0;

        this.add.text(W/2, H*0.07, 'TIMING 校準', {
            fontSize: '22px', fill: '#d4caff', fontFamily: 'monospace', letterSpacing: 6,
        }).setOrigin(0.5);

        this.add.text(W/2, H*0.14, '聽到節拍聲後，跟著拍子點擊螢幕', {
            fontSize: '14px', fill: '#6655aa', fontFamily: "'Noto Sans TC', monospace",
        }).setOrigin(0.5);

        this.beatCircle = this.add.circle(W/2, H*0.42, 80, 0x1a1255, 1);
        this.beatCircle.setStrokeStyle(2, 0x5a4fff, 0.6);

        this.beatIcon = this.add.text(W/2, H*0.42, '♪', {
            fontSize: '52px', fill: '#3d3470', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.samplesTxt = this.add.text(W/2, H*0.60, '點擊次數：0', {
            fontSize: '15px', fill: '#555577', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.offsetTxt = this.add.text(W/2, H*0.66, '平均偏移：— ms', {
            fontSize: '18px', fill: '#5fffb8', fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.hintTxt = this.add.text(W/2, H*0.73, '', {
            fontSize: '13px', fill: '#ffe066', fontFamily: "'Noto Sans TC', monospace",
        }).setOrigin(0.5);

        this.startBtn = this.add.text(W/2, H*0.83, '▶  開始校準', {
            fontSize: '20px', fill: '#a5e8ff', fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#0d1a2a', padding: { x:24, y:12 },
        }).setOrigin(0.5).setInteractive()
          .on('pointerover', function(){ this.setStyle({fill:'#fff'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#a5e8ff'}); })
          .on('pointerdown', () => this._startCalibration());

        this.doneBtn = this.add.text(W/2, H*0.83, '✓  儲存並返回', {
            fontSize: '20px', fill: '#5fffb8', fontFamily: "'Noto Sans TC', monospace",
            backgroundColor: '#0a1f15', padding: { x:24, y:12 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({fill:'#fff'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#5fffb8'}); })
          .on('pointerdown', () => this._finishCalibration());

        this.resetBtn = this.add.text(W/2, H*0.91, '↩  重新校準', {
            fontSize: '15px', fill: '#444466', fontFamily: 'monospace',
            backgroundColor: '#111122', padding: { x:16, y:8 },
        }).setOrigin(0.5).setInteractive().setVisible(false)
          .on('pointerover', function(){ this.setStyle({fill:'#aaa'}); })
          .on('pointerout',  function(){ this.setStyle({fill:'#444466'}); })
          .on('pointerdown', () => this._resetCalibration());

        this.input.on('pointerdown', () => {
            if (!this.isRunning) return;
            this._recordTap();
            this._flashTap();
        });

        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        this.hintTxt.setText(`目前儲存值：${saved} ms`);

        // 返回按鈕
        this.add.text(20, 20, '← 返回', {
            fontSize: '18px', backgroundColor: '#333', padding: { x:10, y:5 },
        }).setInteractive()
          .on('pointerdown', () => {
              if (this.offsetSamples.length >= 2) {
                  const avg = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;
                  SafeStorage.setItem('timingOffset', Math.round(avg));
              }
              this.scene.start('MusicScene');
          });
    }

    _startCalibration() {
        this.sound.context.resume()
            .then(() => this._doStartCalibration())
            .catch(() => this._doStartCalibration());
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

        this._playBeat();
        this._beatTimer = this.time.addEvent({
            delay: this.intervalMs,
            loop: true,
            callback: () => this._playBeat(),
        });
    }

    _playBeat() {
        this.beatCount++;
        if (this.beatCount % 4 === 0) {
            this.sound.play('tick_high');
        } else {
            this.sound.play('tick');
        }
    }

    _recordTap() {
        const nowMs = this.sound.context.currentTime * 1000;
        const elapsed = nowMs - this.startAudioTime;
        const beatIndex = Math.round(elapsed / this.intervalMs);
        const expectedMs = beatIndex * this.intervalMs;
        const offset = elapsed - expectedMs;

        if (Math.abs(offset) < this.intervalMs * 0.45) {
            this.offsetSamples.push(offset);
        }

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
        SafeStorage.setItem('timingOffset', Math.round(avg));
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
        const saved = parseInt(SafeStorage.getItem('timingOffset')) || 0;
        this.hintTxt.setText(`目前儲存值：${saved} ms`);
        this.beatIcon.setFill('#3d3470').setScale(1);
    }
}