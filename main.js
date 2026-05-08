class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        // 把文字存起來（很重要）
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

        // 加這段 → 解決橫直切換問題
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

        this.load.audio('bgm', 'assets/bgm.mp3');
    }

create() {
    this.input.addPointer(3);

    // 先建立地圖
    this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);

    // 再算縮放
    let scaleX = this.scale.width / this.map.width;
    let scaleY = this.scale.height / this.map.height;
    let scale = Math.max(scaleX, scaleY)*1.5;
    
    this.map.setScale(scale);

    // 世界邊界
    let worldWidth = this.map.width * scale;
    let worldHeight = this.map.height * scale;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 玩家
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
            frameRate: 2,
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
            frameRate: 2,
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

            let distance = Math.sqrt(dx * dx + dy * dy);
            let max = 60;

            if (distance > max) {
                dx = dx / distance * max;
                dy = dy / distance * max;
            }

            this.joyStick.setPosition(this.baseX + dx, this.baseY + dy);

            this.joyX = dx / max;
            this.joyY = dy / max;
        });

        // 旋轉時更新搖桿位置
        this.scale.on('resize', (gameSize) => {
            const { height } = gameSize;

            this.baseY = height - 120;

            this.joyBase.setPosition(this.baseX, this.baseY);
            this.joyStick.setPosition(this.baseX, this.baseY);
        });

        this.bgm = this.sound.add('bgm', {
        loop: true,   // 重複播放
        volume: 0.5   // 音量（0~1）
});

this.bgm.play();
    }

    update() {
    let speed = 3;

    this.player.x += this.joyX * speed;
    this.player.y += this.joyY * speed;

    // 限制角色不能走出地圖
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

        // 微晃動
        if (this.joyX !== 0 || this.joyY !== 0) {
            this.player.y += Math.sin(Date.now() / 100) * 0.3;
        }
    }
}

// 遊戲設定
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,

    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: [StartScene, GameScene]
};

const game = new Phaser.Game(config);
