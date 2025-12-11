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
let nextPuyoColors = []; 
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

    // 修正: ネクストぷよリストを完全にランダムなぷよで初期化
    nextPuyoColors = [getRandomPair(), getRandomPair()];

    generateNewPuyo();
    
    updateUI();
    
    document.addEventListener('keydown', handleInput);
    
    renderBoard();
}

// --- ぷよの生成と操作 ---

function getRandomColor() {
    return Math.floor(Math.random() * 4) + 1;
}

// 修正: ランダムな色の組ぷよを生成するヘルパー関数
function getRandomPair() {
    return [getRandomColor(), getRandomColor()];
}

function generateNewPuyo() {
    const [c1, c2] = nextPuyoColors.shift();

    currentPuyo = {
        mainColor: c1,
        subColor: c2,
        mainX: 2, 
        mainY: 10, // 落下開始位置 (可視領域の上から2段目)
        rotation: 0 
    };

    // 新しいネクストぷよを生成し、リストに追加
    nextPuyoColors.push(getRandomPair());
}

function getPuyoCoords() {
    if (!currentPuyo) return [];
    
    const { mainX, mainY, rotation } = currentPuyo;
    let subX = mainX;
    let subY = mainY;

    // rotationに基づき、子ぷよの相対座標を計算
    if (rotation === 0) subY = mainY + 1; 
    if (rotation === 1) subX = mainX - 1; 
    if (rotation === 2) subY = mainY - 1; 
    if (rotation === 3) subX = mainX + 1; 

    return [{ x: mainX, y: mainY, color: currentPuyo.mainColor },
            { x: subX, y: subY, color: currentPuyo.subColor }];
}

function checkCollision(coords) {
    for (const puyo of coords) {
        if (puyo.x < 0 || puyo.x >= WIDTH) return true;
        if (puyo.y < 0) return true;

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
        
        if (movePuyo(0, 0, newRotation)) return true; 
        if (movePuyo(1, 0, newRotation)) return true; 
        if (movePuyo(-1, 0, newRotation)) return true; 
        
        return false;
    }
}

function hardDrop() {
    if (gameState !== 'playing' || !currentPuyo) return;

    while (movePuyo(0, -1));

    lockPuyo();
}

function lockPuyo() {
    if (gameState !== 'playing' || !currentPuyo) return;

    const coords = getPuyoCoords();
    let isGameOver = false;

    for (const puyo of coords) {
        if (puyo.y >= HEIGHT - 2) {
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

            while (stack.length > 0) {
                const current = stack.pop();
                group.push(current);

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

            if (group.length >= 4) {
                disappearingGroups.push({ group, color });
            }
        }
    }
    return disappearingGroups;
}

async function runChain() {
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

    let chainScore = calculateScore(groups, chainCount);
    score += chainScore;

    // ぷよの削除 (データを更新)
    groups.forEach(({ group }) => {
        group.forEach(({ x, y }) => {
            board[y][x] = COLORS.EMPTY; 
        });
    });

    renderBoard(); // 削除後の盤面を描画 (空きスペースができる)
    updateUI();

    await new Promise(resolve => setTimeout(resolve, 300));

    // ぷよの落下 (データを更新)
    gravity(); 

    // 落下後の盤面を描画し、ちぎり動作を画面に反映させます。
    renderBoard(); 

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

        const groupBonusIndex = Math.min(group.length, BONUS_TABLE.GROUP.length - 1);
        bonusTotal += BONUS_TABLE.GROUP[groupBonusIndex];
    });

    const chainBonusIndex = Math.min(currentChain, BONUS_TABLE.CHAIN.length - 1);
    bonusTotal += BONUS_TABLE.CHAIN[chainBonusIndex];

    const colorBonusIndex = Math.min(colorCount.size, BONUS_TABLE.COLOR.length - 1);
    bonusTotal += BONUS_TABLE.COLOR[colorBonusIndex];

    const finalBonus = Math.max(1, bonusTotal);

    const totalScore = (10 * totalPuyos) * finalBonus;

    return totalScore;
}


/**
 * ぷよぷよ標準の重力処理（列圧縮＝ちぎり）
 */
function gravity() {
    for (let x = 0; x < WIDTH; x++) {
        let newColumn = [];

        // 1. ぷよだけを抽出し、下に詰める
        for (let y = 0; y < HEIGHT; y++) {
            if (board[y][x] !== COLORS.EMPTY) {
                newColumn.push(board[y][x]);
            }
        }

        // 2. 下から詰めたぷよを盤面に戻す（落下）
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
    
    // 落下中のぷよの座標を取得しておく
    const currentPuyoCoords = currentPuyo && gameState === 'playing' ? getPuyoCoords() : [];

    // 配列インデックス y = 11 (可視領域の最上段) から y = 0 (最下段) へ逆順に描画
    // HEIGHT - 3 は、配列の12段目 (インデックス11) を指します。
    for (let y = HEIGHT - 3; y >= 0; y--) { 
        for (let x = 0; x < WIDTH; x++) {
            const puyoElement = document.createElement('div');
            
            let cellColor = board[y][x]; 

            // 落下中のぷよがこのセルにあるかチェックし、色を上書き
            const puyoInFlight = currentPuyoCoords.find(p => p.x === x && p.y === y);
            
            if (puyoInFlight) {
                cellColor = puyoInFlight.color; // 落下中のぷよを優先して描画
            }
            
            puyoElement.className = `puyo puyo-${cellColor}`;
            boardElement.appendChild(puyoElement);
        }
    }

    renderNextPuyo();
}

function renderNextPuyo() {
    const nextElement = document.getElementById('next-puyo');
    nextElement.innerHTML = '';

    if (nextPuyoColors.length === 0) return; 

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
