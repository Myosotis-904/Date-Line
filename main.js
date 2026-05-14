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
        this.load.image('stage', 'assets/stage.png');
        this.load.image('tree', 'assets/tree.png');
        this.load.image('sign', 'assets/sign.png');

        this.load.spritesheet('player', 'assets/player.png', {
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

        this.worldWidth = this.map.width * scale;
        this.worldHeight = this.map.height * scale;

        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // ===== 物件（透明底碰撞🔥）=====
        this.objects = [];

        this.addObject = (x, y, key, scale, w, h) => {
            let sprite = this.add.image(x, y, key)
                .setOrigin(0.5, 1)
                .setScale(scale);

            this.objects.push({ sprite, width: w, height: h });
        };

        // 舞台 / 樹 / 招牌
        this.addObject(600, 1200, 'stage', 2.7, 300, 120);
        this.addObject(700, 2150, 'tree', 0.8, 120, 80);
        this.addObject(500, 2150, 'sign', 0.8, 100, 60);

        // ===== 玩家 =====
        this.player = this.add.sprite(
            this.worldWidth / 2,
            this.worldHeight - 50,
            'player'
        )
        .setOrigin(0.5, 1)
        .setScale(0.7);

        // 安全區（避免出生卡住）
        this.safeZone = {
            x: this.player.x,
            y: this.player.y,
            radius: 100
        };

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
        this.joyPointerId = null;
        this.joyX = 0;
        this.joyY = 0;

        this.joyStick.on('pointerdown', (pointer) => {
            this.joyActive = true;
            this.joyPointerId = pointer.id;
        });

        this.input.on('pointermove', (pointer) => {
            if (!this.joyActive || pointer.id !== this.joyPointerId) return;

            let dx = pointer.position.x - this.baseX;
            let dy = pointer.position.y - this.baseY;

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

        this.input.on('pointerup', (pointer) => {
            if (pointer.id !== this.joyPointerId) return;

            this.joyActive = false;
            this.joyPointerId = null;

            this.joyStick.setPosition(this.baseX, this.baseY);
            this.joyX = 0;
            this.joyY = 0;
        });

        // 螢幕旋轉修正
        this.scale.on('resize', (gameSize) => {
            const { height } = gameSize;

            this.baseY = height - 120;

            this.joyBase.setPosition(this.baseX, this.baseY);
            this.joyStick.setPosition(this.baseX, this.baseY);
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
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.worldWidth);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.worldHeight);

        // ===== 安全區 =====
        let inSafeZone =
            Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.safeZone.x,
                this.safeZone.y
            ) < this.safeZone.radius;

        // ===== 碰撞（透明底🔥）=====
        for (let obj of this.objects) {

            let inside =
                this.player.x > obj.sprite.x - obj.width / 2 &&
                this.player.x < obj.sprite.x + obj.width / 2 &&
                this.player.y > obj.sprite.y - obj.height &&
                this.player.y < obj.sprite.y;

            if (inside && !inSafeZone) {
                this.player.x = prevX;

                let stillInside =
                    prevX > obj.sprite.x - obj.width / 2 &&
                    prevX < obj.sprite.x + obj.width / 2 &&
                    this.player.y > obj.sprite.y - obj.height &&
                    this.player.y < obj.sprite.y;

                if (stillInside) {
                    this.player.y = prevY;
                }
            }
        }

        // ===== 動畫 =====
        if (this.joyX < -0.2) {
            this.player.anims.play('walk_left', true);
        } else if (this.joyX > 0.2) {
            this.player.anims.play('walk_right', true);
        } else {
            this.player.anims.play('idle', true);
        }

        // ===== 舞台互動 =====
        let d = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.objects[0].sprite.x,
            this.objects[0].sprite.y
        );

        this.actionButton.setVisible(d < 200);
    }
    setTimeout(() => {
    this.scale.refresh();
}, 200);
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

    parent: 'game-container', // ⭐超重要（讓畫面不亂）

    width: 960,
    height: 540,

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: [StartScene, GameScene, MusicScene]
};

const game = new Phaser.Game(config);