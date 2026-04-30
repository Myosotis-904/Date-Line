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
        })
        this.load.image('up', 'assets/up.png');
        this.load.image('down', 'assets/down.png');
        this.load.image('right', 'assets/right.png');
        this.load.image('left', 'assets/left.png');
    }

    create() {
        this.input.addPointer(1);

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

        this.player.anims.play('idle');

        this.anims.create({
            key: 'walk_left',
            frames: [
                { key: 'player', frame: 2 },
                { key: 'player', frame: 3 },
                { key: 'player', frame: 4 },
                { key: 'player', frame: 3 }
            ],
            frameRate: 2.5,
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
            frameRate: 2.5,
            repeat: -1
        });

        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, 1600, 1200);

        this.up = this.add.image(140, 380, 'up').setInteractive().setScale(0.2);
        this.down = this.add.image(140, 500, 'down').setInteractive().setScale(0.2);
        this.left = this.add.image(80, 440, 'left').setInteractive().setScale(0.2);
        this.right = this.add.image(200, 440, 'right').setInteractive().setScale(0.2);

        this.up.setScrollFactor(0);
        this.down.setScrollFactor(0);
        this.left.setScrollFactor(0);
        this.right.setScrollFactor(0);

        this.bindButton(this.up);
        this.bindButton(this.down);
        this.bindButton(this.left);
        this.bindButton(this.right);

    }

update() {
    let speed = 1.5;
    let isMoving = false;

    if (this.up.isDown) this.player.y -= speed;
    if (this.down.isDown) this.player.y += speed;

    if (this.left.isDown) {
        this.player.x -= speed;
        this.player.anims.play('walk_left', true);
        isMoving = true;
    }

    if (this.right.isDown) {
         this.player.x += speed;
         this.player.anims.play('walk_right', true);
         isMoving = true;

    }

    if (!isMoving) {
        this.player.anims.play('idle', true);
    }

    if (this.up.isDown || this.down.isDown || this.left.isDown || this.right.isDown) {
        this.player.y += Math.sin(Date.now() / 100) * 0.3;
    }

    if (!this.input.manager.pointers[0].isDown) {
        this.up.isDown = false;
        this.down.isDown = false;
        this.left.isDown = false;
        this.right.isDown = false;
    }
}

   bindButton(button) {
    button.isDown = false;

    button.on('pointerdown', () => button.isDown = true);

    button.on('pointerover', () => {
        if (this.input.activePointer.isDown) {
            button.isDown = true;
        }
    });

    button.on('pointerup', () => button.isDown = false);
    button.on('pointerout', () => button.isDown = false);
    button.on('pointerupoutside', () => button.isDown = false);
}}

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
