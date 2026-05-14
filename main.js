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
        this.load.image('map', './assets/map.png');
        this.load.image('stage', './assets/stage.png');
        this.load.image('tree', './assets/tree.png');
        this.load.image('sign', './assets/sign.png');
        this.load.spritesheet('player', './assets/player.png', {
            frameWidth: 256,
            frameHeight: 256
        });
    }

    create() {
        this.input.addPointer(3);

        // ===== 地圖 =====
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);

        let scale = Math.max(
            this.scale.width / this.map.width,
            this.scale.height / this.map.height
        ) * 1.5;

        this.map.setScale(scale);

        let worldWidth = this.map.width * scale;
        let worldHeight = this.map.height * scale;

        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // ===== 物件（矩形碰撞）=====
        this.objects = [];

        const addObject = (x, y, key, scale, w, h) => {
            let sprite = this.add.image(x, y, key)
                .setOrigin(0.5, 1)
                .setScale(scale);

            this.objects.push({
                sprite: sprite,
                width: w,
                height: h
            });
        };

        // 👉 可調整碰撞大小（重點）
        addObject(400, 1200, 'stage', 2.7, 700, 600);
        addObject(700, 2160, 'tree', 0.7, 2000, 80);
        addObject(700,2150, 'sign', 0.8, 300, 150);

        // ===== 安全出生點 =====
        let spawnX = worldWidth / 2;
        let spawnY = worldHeight - 50;

        const isBlocked = (x, y) => {
            return this.objects.some(obj => {
                return (
                    x > obj.sprite.x - obj.width / 2 &&
                    x < obj.sprite.x + obj.width / 2 &&
                    y > obj.sprite.y - obj.height &&
                    y < obj.sprite.y
                );
            });
        };

        while (isBlocked(spawnX, spawnY)) {
            spawnY -= 50;
        }

        // ===== 玩家 =====
        this.player = this.add.sprite(spawnX, spawnY, 'player')
            .setOrigin(0.5, 1)
            .setScale(0.7);

        // ===== 影子（貼腳）=====
        this.shadow = this.add.ellipse(
            spawnX,
            spawnY + 2,
            35,
            12,
            0x000000,
            0.25
        );

        // ===== 動畫 =====
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

        this.cameras.main.startFollow(this.player);

        // ===== 搖桿 =====
        this.baseX = 120;
        this.baseY = this.cameras.main.height - 120;

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

            let dist = Math.sqrt(dx*dx + dy*dy);
            let max = 60;

            if (dist > max) {
                dx = dx / dist * max;
                dy = dy / dist * max;
            }

            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);

            this.joyX = dx / max;
            this.joyY = dy / max;
        });

        // ===== 按鈕 =====
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

        let prevX = this.player.x;
        let prevY = this.player.y;

        // ===== 移動 =====
        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;

        // ===== 邊界 =====
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

        // ===== 矩形碰撞 =====
        let nearStage = false;

        for (let obj of this.objects) {
            let inside =
                this.player.x > obj.sprite.x - obj.width / 2 &&
                this.player.x < obj.sprite.x + obj.width / 2 &&
                this.player.y > obj.sprite.y - obj.height &&
                this.player.y < obj.sprite.y;

            if (inside) {
                this.player.x = prevX;
                this.player.y = prevY;
                break;
            }

            // 第一個 = 舞台
            if (obj === this.objects[0]) {
                let d = Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    obj.sprite.x,
                    obj.sprite.y
                );
                if (d < 200) nearStage = true;
            }
        }

        // ===== 影子 =====
        this.shadow.x = this.player.x;
        this.shadow.y = this.player.y + 2;

        // ===== 動畫 =====
        if (this.joyX < -0.2) {
            this.player.anims.play('walk_left', true);
        } else if (this.joyX > 0.2) {
            this.player.anims.play('walk_right', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // ===== 按鈕 =====
        this.actionButton.setVisible(nearStage);
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

new Phaser.Game(config);
