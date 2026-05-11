class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        this.titleText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2 - 50,
            '換日線',
            { fontSize: '40px', fill: '#fff' }
        ).setOrigin(0.5);

        this.startText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2 + 50,
            '點擊開始',
            { fontSize: '30px', fill: '#a5e8ff' }
        )
        .setOrigin(0.5)
        .setInteractive();

        this.startText.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        this.scale.on('resize', (gameSize) => {
            const { width, height } = gameSize;

            this.titleText.setPosition(width / 2, height / 2 - 50);
            this.startText.setPosition(width / 2, height / 2 + 50);
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
        this.load.image('stage', 'assets/stage.png');
    }

    create() {
        this.input.addPointer(3);

        // 地圖
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);

        // 舞台位置（這裡可以改座標）
        this.stage = this.add.image(600, 300, 'stage')
       .setOrigin(0.5, 1),
       .setScale(scale);

        let scaleX = this.scale.width / this.map.width;
        let scaleY = this.scale.height / this.map.height;

        let scale = Math.max(scaleX, scaleY) * 1.5;
        this.map.setScale(scale);

        let worldWidth = this.map.width * scale;
        let worldHeight = this.map.height * scale;

        // 世界邊界
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // 玩家（底部中央）
        this.player = this.add.sprite(
            worldWidth / 2,
            worldHeight,
            'player'
        )
        .setOrigin(0.5, 1)
        .setScale(0.7);

        // 動畫
        this.anims.create({
            key: 'idle',
            frames: [0,1].map(f => ({ key:'player', frame:f })),
            frameRate: 2,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_left',
            frames: [2,3,4,3].map(f => ({ key:'player', frame:f })),
            frameRate: 3,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_right',
            frames: [5,6,7,6].map(f => ({ key:'player', frame:f })),
            frameRate: 3,
            repeat: -1
        });

        this.player.anims.play('idle');

        // 鏡頭跟隨
        this.cameras.main.startFollow(this.player);

        // 搖桿
        this.baseX = 120;
        this.baseY = this.scale.height - 120;

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
            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0;
            this.joyY = 0;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.joyActive) return;

            let dx = pointer.x - this.baseX;
            let dy = pointer.y - this.baseY;

            let distance = Math.sqrt(dx*dx + dy*dy);
            let max = 60;

            if (distance > max) {
                dx = dx / distance * max;
                dy = dy / distance * max;
            }

            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);

            this.joyX = dx / max;
            this.joyY = dy / max;
        });

        // 旋轉時修正
        this.scale.on('resize', (gameSize) => {
            const { height } = gameSize;

            this.baseY = height - 120;

            this.joyBase.setPosition(this.baseX, this.baseY);
            this.joyStick.setPosition(this.baseX, this.baseY);

            this.stage = this.add.image(1000, 800, 'stage');
            
        });

        this.actionButton = this.add.text(
        this.scale.width - 120,
        this.scale.height - 120,
        '進入舞台',
        { fontSize: '24px', fill: '#fff', backgroundColor: '#000' }
        )
        .setScrollFactor(0)
        .setInteractive()
        .setVisible(false);

        this.actionButton.on('pointerdown', () => {
        this.scene.start('MusicScene');
});
        
    }

    update() {
        let speed = 5;

        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;

        // 邊界限制
        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            0,
            this.map.width * this.map.scaleX
        );

        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            0,
            this.map.height * this.map.scaleY
        );

        // 動畫
        if (this.joyX < -0.2) {
            this.player.anims.play('walk_left', true);
        } else if (this.joyX > 0.2) {
            this.player.anims.play('walk_right', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // 判斷玩家是否靠近舞台
        let distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.stage.x,
            this.stage.y
        );

        if (distance < 200) {
            this.actionButton.setVisible(true);
        } else {
            this.actionButton.setVisible(false);
        }
    }
}

class MusicScene extends Phaser.Scene {
    constructor() {
        super('MusicScene');
    }

    create() {
        this.add.text(400, 200, '音樂遊戲', {
            fontSize: '40px',
            fill: '#fff'
        });

        // 點擊返回
        this.input.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
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

    scene: [StartScene, GameScene, MusicScene]
};

const game = new Phaser.Game(config);
