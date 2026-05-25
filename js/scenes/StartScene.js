'use strict';

/* ================================================================
   StartScene — 標題畫面
================================================================ */
class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }

    preload() {
        this.load.image('start_bg', 'assets/start_bg.png');
    }

    create() {
        const W = this.scale.width, H = this.scale.height;

        this.add.image(W/2 - 5, H/2, 'start_bg').setDisplaySize(W, H);

        this.add.text(W / 2, H * 0.578, 'D A T E L I N E', {
            fontSize: '13px', fill: '#3d3470', fontFamily: 'monospace', letterSpacing: 7,
        }).setOrigin(0.5);

        const hint = this.add.text(W / 2, H * 0.75, '觸碰或按任意鍵開始', {
            fontSize: '20px', fill: '#a5e8ff',
            fontFamily: "'Noto Sans TC', monospace", letterSpacing: 3,
        }).setOrigin(0.5);

        this.tweens.add({
            targets: hint, alpha: 0.15, duration: 900,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        this.input.once('pointerdown', () => this.scene.start('GameScene'));
        this.input.keyboard.once('keydown', () => this.scene.start('GameScene'));
    }
}