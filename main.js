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

        // 旋轉自適應
        this.scale.on('resize', (gameSize) => {
            const { width, height } = gameSize;

            this.titleText.setPosition(width / 2, height / 2 - 50);
            this.startText.setPosition(width / 2, height / 2 + 50);
        });

        // ⭐ 強制刷新尺寸（解決 iPhone 工具列問題）
        setTimeout(() => {
            this.scale.resize(window.innerWidth, window.innerHeight);
        }, 200);

            this.scale.resize(window.innerWidth, window.innerHeight);
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

        // 地圖
        this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);

        let scaleX = this.scale.width / this.map.width;
        let scaleY = this.scale.height / this.map.height;

        // ⭐ 地圖比畫面大
        let scale = Math.max(scaleX, scaleY) * 1.5;
        this.map.setScale(scale);

        let worldWidth = this.map.width * scale;
        let worldHeight = this.map.height * scale;

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
            frames: [{ key: 'player', frame: 0 }, { key: 'player', frame: 1 }],
            frameRate: 2,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_left',
            frames: [2,3,4,3].map(f => ({ key:'player', frame:f })),
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_right',
            frames: [5,6,7,6].map(f => ({ key:'player', frame:f })),
            frameRate: 6,
            repeat: -1
        });

        this.player.anims.play('idle');

        // 鏡頭跟隨
        this.cameras.main.startFollow(this.player);

        // 🎮 搖桿
        this.baseX = 120;
        let safeBottom = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('padding-bottom')) || 0;

        this.baseY = this.scale.height - 120 - safeBottom;

        this.joyBase = this.add.circle(this.baseX, this.baseY, 60, 0x888888, 0.4)
            .setScrollFactor(0);

        this.joyStick = this.add.circle(this.baseX, this.baseY, 30, 0xffffff, 0.7)
            .setInteractive()
            .setScrollFactor(0);

        this.joyActive = false;
        this.joyX = 0;
        this.joyY = 0;

        // ⭐ 改用全域 pointer（超穩）
        this.input.on('pointerdown', () => {
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

        // 旋轉時調整搖桿

        function getSafeBottom() {
        return parseInt(
        getComputedStyle(document.documentElement)
        .getPropertyValue('padding-bottom')
        ) || 0;
}
        this.scale.on('resize', (gameSize) => {
            const { height } = gameSize;

            let safeBottom = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('padding-bottom')) || 0;

            this.baseY = height - 120 - safeBottom;

            this.joyBase.setPosition(this.baseX, this.baseY);
            this.joyStick.setPosition(this.baseX, this.baseY);
        });
    }

    update() {
        let speed = 5; 

        this.player.x += this.joyX * speed;
        this.player.y += this.joyY * speed;

        // 限制範圍
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
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [StartScene, GameScene]
};
    window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
    })

new Phaser.Game(config);
