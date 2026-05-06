class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        this.add.text(400, 200, '換日線', {
            fontSize: '40px',
            fill: '#fff'
        });

        let startText = this.add.text(400, 300, '點擊開始', {
            fontSize: '30px',
            fill: '#a5e8ff'
        }).setInteractive();

        startText.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        this.load.image('map', 'assets/map.png');

        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: 256,
            frameHeight: 256
        });
    }

    create() {
        this.input.addPointer(3);

        let map = this.add.image(0, 0, 'map').setOrigin(0, 0);
        map.displayWidth = 1600;
        map.displayHeight = 1200;

        this.player = this.add.sprite(800, 600, 'player').setScale(0.7);

        this.anims.create({
            key: 'idle',
            frames: [
                { key: 'player', frame: 0 },
                { key: 'player', frame: 1 }
            ],
            frameRate: 2,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_left',
            frames: [
                { key: 'player', frame: 2 },
                { key: 'player', frame: 3 },
                { key: 'player', frame: 4 },
                { key: 'player', frame: 3 }
            ],
            frameRate: 4,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_right',
            frames: [
                { key: 'player', frame: 5 },
                { key: 'player', frame: 6 },
                { key: 'player', frame: 7 },
                { key: 'player', frame: 6 }
            ],
            frameRate: 4,
            repeat: -1
        });

        this.player.anims.play('idle');

        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, 1600, 1200);

        this.baseX = 120;
        this.baseY = 420;

        this.joyBase = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4)
            .setScrollFactor(0);

        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7)
            .setInteractive()
            .setScrollFactor(0);

        this.joyActive = false;
        this.joyX = 0;
        this.joyY = 0;

        this.joyStick.on('pointerdown', () => {
            this.joyActive = true;
        });

        this.input.on('pointerup', () => {
            this.joyActive = false;
            this.joyStick.x = this.baseX;
            this.joyStick.y = this.baseY;
            this.joyX = 0;
            this.joyY = 0;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.joyActive) return;

            let dx = pointer.x - this.baseX;
            let dy = pointer.y - this.baseY;

            let distance = Math.sqrt(dx * dx + dy * dy);
            let max = 50;

            if (distance > max) {
                dx = dx / distance * max;
                dy = dy / distance * max;
            }

            this.joyStick.x = this.baseX + dx;
            this.joyStick.y = this.baseY + dy;

            this.joyX = dx / max;
            this.joyY = dy / max;
        });
    }

    update() {
        let speed = 3;

        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;

        if (this.joyX < -0.2) {
            this.player.anims.play('walk_left', true);
        } else if (this.joyX > 0.2) {
            this.player.anims.play('walk_right', true);
        } else {
            this.player.anims.play('idle', true);
        }

        if (this.joyX !== 0 || this.joyY !== 0) {
            this.player.y += Math.sin(Date.now() / 100) * 0.3;
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [StartScene, GameScene]
};

const game = new Phaser.Game(config);
