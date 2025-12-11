// --- ぷよぷよシミュレーションの定数と設定 ---

// 盤面サイズ
const WIDTH = 6;
const HEIGHT = 14; // 可視領域12 + 隠し領域2

// ぷよの色定義
const COLORS = {
    EMPTY: 0,
    RED: 1,
    BLUE: 2,
    GREEN: 3,
    YELLOW: 4,
    GARBAGE: 5
};

// スコア計算に必要なボーナス値（ぷよぷよ通準拠）
const BONUS_TABLE = {
    // 連鎖ボーナス (CB): 1連鎖=0, 2連鎖=8, 3連鎖=16...
    CHAIN: [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512],
    // 連結ボーナス (PB): 4個=0, 5個=2, 6個=3...
    GROUP: [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    // 色数ボーナス (Color): 1色=0, 2色=3, 3色=6, 4色=12
    COLOR: [0, 0, 3, 6, 12]
};


// --- ゲームの状態管理 ---

let board = []; 
let currentPuyo = null; 
let nextPuyoColors = [
    [COLORS.RED, COLORS.BLUE], // NEXT
    [COLORS.YELLOW, COLORS.GREEN] // NEXT NEXT
];
let score = 0;
let chainCount = 0;
let gameState = 'playing'; // 'playing', 'chaining', 'gameover'


// --- 初期化関数 ---

function initializeGame() {
    // 盤面を空で初期化
    for (let y = 0; y < HEIGHT; y++) {
        board[y] = [];
        for (let x = 0; x < WIDTH; x++) {
            board[y][x] = COLORS.EMPTY;
        }
    }

    score = 0;
    chainCount = 0;
    gameState = 'playing';

    // 最初のネクストを生成
    generateNewPuyo();
    
    // UIを更新
    updateUI();
    
    // キー入力の監視を開始
    document.addEventListener('keydown', handleInput);
    
    renderBoard();
}

// --- ぷよの生成と操作 ---

function getRandomColor() {
    return Math.floor(Math.random() * 4) + 1;
}

function generateNewPuyo() {
    const [c1, c2] = nextPuyoColors.shift();

    currentPuyo = {
        mainColor: c1,
        subColor: c2,
        mainX: 2, 
        mainY: HEIGHT - 1, 
        rotation: 0 
    };

    nextPuyoColors.push([getRandomColor(), getRandomColor()]);
}

function getPuyoCoords() {
    const { mainX, mainY, rotation } = currentPuyo;
    let subX = mainX;
    let subY = mainY;

    // rotationに基づき、子ぷよの相対座標を計算
    if (rotation === 0) subY = mainY + 1; // 上下 (子ぷよが軸ぷよの真上)
    if (rotation === 1) subX = mainX - 1; // 左右 (子ぷよが軸ぷよの左)
    if (rotation === 2) subY = mainY - 1; // 下上 (子ぷよが軸ぷよの真下)
    if (rotation === 3) subX = mainX + 1; // 右左 (子ぷよが軸ぷよの右)

    return [{ x: mainX, y: mainY, color: currentPuyo.mainColor },
            { x: subX, y: subY, color: currentPuyo.subColor }];
}

function checkCollision(coords) {
    for (const puyo of coords) {
        // 画面外チェック (横)
        if (puyo.x < 0 || puyo.x >= WIDTH) return true;
        // 画面外チェック (下)
        if (puyo.y < 0) return true;

        // 既にぷよがある場所との衝突チェック
        if (puyo.y < HEIGHT && puyo.y >= 0 && board[puyo.y][puyo.x] !== COLORS.EMPTY) {
            return true;
        }
    }
    return false;
}

function movePuyo(dx, dy, newRotation) {
    if (gameState !== 'playing' || !currentPuyo) return false;

    const { mainX, mainY, rotation } = currentPuyo;
    const testPuyo = { mainX: mainX + dx, mainY: mainY + dy, rotation: newRotation !== undefined ? newRotation : rotation };
    
    // テスト用の座標を取得
    const testCoords = (() => {
        let subX = testPuyo.mainX;
        let subY = testPuyo.mainY;

        if (testPuyo.rotation === 0) subY = testPuyo.mainY + 1;
        if (testPuyo.rotation === 1) subX = testPuyo.mainX - 1;
        if (testPuyo.rotation === 2) subY = testPuyo.mainY - 1;
        if (testPuyo.rotation === 3) subX = testPuyo.mainX + 1;

        return [
            { x: testPuyo.mainX, y: testPuyo.mainY },
            { x: subX, y: subY }
        ];
    })();

    if (!checkCollision(testCoords)) {
        currentPuyo.mainX = testPuyo.mainX;
        currentPuyo.mainY = testPuyo.mainY;
        if (newRotation !== undefined) {
            currentPuyo.rotation = newRotation;
        }
        renderBoard();
        return true;
    }
    return false;
}

function rotatePuyo() {
    if (gameState !== 'playing' || !currentPuyo) return false;

    for (let i = 0; i < 4; i++) {
        const newRotation = (currentPuyo.rotation + 1) % 4;
        
        // 1. 通常の回転
        if (movePuyo(0, 0, newRotation)) return true;

        // 2. 簡易的な壁蹴り
        if (movePuyo(1, 0, newRotation)) return true; 
        if (movePuyo(-1, 0, newRotation)) return true; 
        
        return false;
    }
}

function hardDrop() {
    if (gameState !== 'playing' || !currentPuyo) return;

    // 衝突するまで下に落とし続ける
    while (movePuyo(0, -1));

    // ぷよを盤面に固定し、連鎖処理へ
    lockPuyo();
}

function lockPuyo() {
    if (gameState !== 'playing' || !currentPuyo) return;

    const coords = getPuyoCoords();
    let isGameOver = false;

    for (const puyo of coords) {
        if (puyo.y >= HEIGHT - 2) {
            // 隠し領域(12段目)を超えて固定されたらゲームオーバー
            isGameOver = true;
            break;
        }
        if (puyo.y >= 0) {
            board[puyo.y][puyo.x] = puyo.color;
        }
    }

    if (isGameOver) {
        gameState = 'gameover';
        alert('ゲームオーバーです！');
        updateUI();
        renderBoard();
        return;
    }
    
    currentPuyo = null;
    gameState = 'chaining';
    chainCount = 0;
    runChain();
}

// --- 連鎖判定ロジック (DFS) ---

function findConnectedPuyos() {
    let disappearingGroups = [];
    let visited = Array(HEIGHT).fill(0).map(() => Array(WIDTH).fill(false));

    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const color = board[y][x];
            
            if (color === COLORS.EMPTY || color === COLORS.GARBAGE || visited[y][x]) continue;

            let group = [];
            let stack = [{ x, y }];
            visited[y][x] = true;

            // DFS（深さ優先探索）で連結グループを探索
            while (stack.length > 0) {
                const current = stack.pop();
                group.push(current);

                // 上下左右をチェック
                [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                    const nx = current.x + dx;
                    const ny = current.y + dy;

                    if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT &&
                        !visited[ny][nx] && board[ny][nx] === color) {
                        
                        visited[ny][nx] = true;
                        stack.push({ x: nx, y: ny });
                    }
                });
            }

            // 4つ以上繋がっていたら、消去グループとして追加
            if (group.length >= 4) {
                disappearingGroups.push({ group, color });
            }
        }
    }
    return disappearingGroups;
}

async function runChain() {
    // 連鎖演出の遅延
    await new Promise(resolve => setTimeout(resolve, 300));

    const groups = findConnectedPuyos();

    if (groups.length === 0) {
        // 連鎖終了
        gameState = 'playing';
        generateNewPuyo();
        renderBoard();
        return;
    }

    chainCount++;

    // スコア計算
    let chainScore = calculateScore(groups, chainCount);
    score += chainScore;

    // ぷよの削除
    groups.forEach(({ group }) => {
        group.forEach(({ x, y }) => {
            board[y][x] = COLORS.EMPTY; 
        });
    });

    renderBoard();
    updateUI();

    // 削除演出の遅延
    await new Promise(resolve => setTimeout(resolve, 300));

    // ぷよの落下
    gravity();

    // 落下演出の遅延
    await new Promise(resolve => setTimeout(resolve, 300));

    // 再帰的に次の連鎖をチェック
    runChain();
}

function calculateScore(groups, currentChain) {
    let totalPuyos = 0;
    let colorCount = new Set();
    let bonusTotal = 0;

    groups.forEach(({ group, color }) => {
        totalPuyos += group.length;
        colorCount.add(color);

        // 連結ボーナス (PB)
        const groupBonusIndex = Math.min(group.length, BONUS_TABLE.GROUP.length - 1);
        bonusTotal += BONUS_TABLE.GROUP[groupBonusIndex];
    });

    // 連鎖ボーナス (CB)
    const chainBonusIndex = Math.min(currentChain, BONUS_TABLE.CHAIN.length - 1);
    bonusTotal += BONUS_TABLE.CHAIN[chainBonusIndex];

    // 色数ボーナス (Color)
    const colorBonusIndex = Math.min(colorCount.size, BONUS_TABLE.COLOR.length - 1);
    bonusTotal += BONUS_TABLE.COLOR[colorBonusIndex];

    // ボーナス合計が0の場合は1として計算 (最低保証)
    const finalBonus = Math.max(1, bonusTotal);

    // スコア計算
    const totalScore = (10 * totalPuyos) * finalBonus;

    return totalScore;
}


function gravity() {
    for (let x = 0; x < WIDTH; x++) {
        let newColumn = [];

        // ぷよだけを抽出し、下に詰める
        for (let y = 0; y < HEIGHT; y++) {
            if (board[y][x] !== COLORS.EMPTY) {
                newColumn.push(board[y][x]);
            }
        }

        // 下から詰めたぷよを新しい盤面に書き戻す
        for (let y = 0; y < HEIGHT; y++) {
            if (y < newColumn.length) {
                board[y][x] = newColumn[y];
            } else {
                board[y][x] = COLORS.EMPTY; // 上部を空にする
            }
        }
    }
}


// --- 描画とUI更新 ---

function renderBoard() {
    const boardElement = document.getElementById('puyo-board');
    boardElement.innerHTML = '';
    
    // ぷよの描画（HEIGHT-12 から HEIGHT までが可視領域）
    for (let y = HEIGHT - 12; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const puyoElement = document.createElement('div');
            
            // 固定されたぷよの色
            const color = board[y][x];
            puyoElement.className = `puyo puyo-${color}`;
            
            // 落下中のぷよがそのマスにあるかチェックし、あれば色を上書き (簡易描画)
            if (currentPuyo && gameState === 'playing') {
                const coords = getPuyoCoords();
                const currentPuyoHere = coords.find(p => p.x === x && p.y === y);
                if (currentPuyoHere) {
                    puyoElement.className = `puyo puyo-${currentPuyoHere.color}`;
                }
            }
            
            boardElement.appendChild(puyoElement);
        }
    }

    renderNextPuyo();
}

function renderNextPuyo() {
    const nextElement = document.getElementById('next-puyo');
    nextElement.innerHTML = '';

    // NEXTのぷよを描画
    const [c1, c2] = nextPuyoColors[0];
    
    // 軸ぷよ (下側)
    let puyo1 = document.createElement('div');
    puyo1.className = `puyo puyo-${c1}`;
    nextElement.appendChild(puyo1);

    // 子ぷよ (上側)
    let puyo2 = document.createElement('div');
    puyo2.className = `puyo puyo-${c2}`;
    nextElement.appendChild(puyo2);
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('chain-count').textContent = chainCount;

    if (gameState === 'gameover') {
         document.getElementById('chain-count').textContent = '終了';
    }
}

// --- 入力処理 ---

function handleInput(event) {
    if (gameState !== 'playing') return;

    switch (event.key) {
        case 'ArrowLeft':
            movePuyo(-1, 0); 
            break;
        case 'ArrowRight':
            movePuyo(1, 0); 
            break;
        case 'z':
        case 'x':
        case 'Z':
        case 'X':
            rotatePuyo(); 
            break;
        case 'ArrowDown':
            movePuyo(0, -1); 
            break;
        case ' ': // スペースキー
            event.preventDefault(); 
            hardDrop(); 
            break;
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', initializeGame);
