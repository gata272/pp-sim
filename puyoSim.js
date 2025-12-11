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

    // ネクストぷよリストを完全にランダムなぷよで初期化
    nextPuyoColors = [getRandomPair(), getRandomPair()];

    generateNewPuyo();
    
    updateUI();
    
    // キーボードイベントリスナーとボタンイベントリスナーは一度だけ設定
    if (!document.initializedKeyHandler) {
        document.addEventListener('keydown', handleInput);
        
        // 【最終確認】モバイル操作ボタンのイベントリスナー設定
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnRotateCW = document.getElementById('btn-rotate-cw'); // Aボタン (右回転)
        const btnRotateCCW = document.getElementById('btn-rotate-ccw'); // Bボタン (左回転)
        const btnHardDrop = document.getElementById('btn-hard-drop');

        if (btnLeft) btnLeft.addEventListener('click', () => movePuyo(-1, 0));
        if (btnRight) btnRight.addEventListener('click', () => movePuyo(1, 0));
        // ソフトドロップボタンはモバイル操作から削除
        if (btnRotateCW) btnRotateCW.addEventListener('click', rotatePuyoCW);
        if (btnRotateCCW) btnRotateCCW.addEventListener('click', rotatePuyoCCW);
        if (btnHardDrop) btnHardDrop.addEventListener('click', hardDrop);
        
        document.initializedKeyHandler = true;
    }
    
    renderBoard();
}

/**
 * 盤面リセット関数
 */
function resetGame() {
    initializeGame();
    alert('盤面をリセットしました。');
}


// --- ぷよの生成と操作 ---

function getRandomColor() {
    // 赤(1)から黄(4)までのランダムな色を返す
    return Math.floor(Math.random() * 4) + 1;
}

// ランダムな色の組ぷよを生成するヘルパー関数
function getRandomPair() {
    return [getRandomColor(), getRandomColor()];
}

function generateNewPuyo() {
    if (gameState === 'gameover') return;

    const [c1, c2] = nextPuyoColors.shift();

    currentPuyo = {
        mainColor: c1,
        subColor: c2,
        mainX: 2, 
        mainY: HEIGHT - 3, 
        rotation: 0 
    };
    
    const startingCoords = getPuyoCoords();
    if (checkCollision(startingCoords)) {
        gameState = 'gameover';
        alert('ゲームオーバーです！');
        updateUI();
        renderBoard();
        return; 
    }

    nextPuyoColors.push(getRandomPair());
}

/**
 * 特定のぷよの状態から座標（位置のみ）を取得するヘルパー関数
 */
function getCoordsFromState(puyoState) {
    const { mainX, mainY, rotation } = puyoState;
    let subX = mainX;
    let subY = mainY;

    if (rotation === 0) subY = mainY + 1; // 下
    if (rotation === 1) subX = mainX - 1; // 左
    if (rotation === 2) subY = mainY - 1; // 上
    if (rotation === 3) subX = mainX + 1; // 右

    return [
        { x: mainX, y: mainY },
        { x: subX, y: subY }
    ];
}


function getPuyoCoords() {
    if (!currentPuyo) return [];
    
    const { mainX, mainY, rotation } = currentPuyo;
    let subX = mainX;
    let subY = mainY;

    if (rotation === 0) subY = mainY + 1; 
    if (rotation === 1) subX = mainX - 1; 
    if (rotation === 2) subY = mainY - 1; 
    if (rotation === 3) subX = mainX + 1; 

    return [{ x: mainX, y: mainY, color: currentPuyo.mainColor },
            { x: subX, y: subY, color: currentPuyo.subColor }];
}

/**
 * ゴーストぷよの落下地点を計算する関数
 */
function getGhostCoords() {
    if (!currentPuyo || gameState !== 'playing') return [];

    let tempPuyo = { ...currentPuyo };
    
    while (true) {
        let testPuyo = { ...tempPuyo, mainY: tempPuyo.mainY - 1 };
        
        const testCoords = getCoordsFromState(testPuyo);
        
        if (checkCollision(testCoords)) {
            const finalCoords = getCoordsFromState(tempPuyo);
            
            finalCoords[0].color = currentPuyo.mainColor;
            finalCoords[1].color = currentPuyo.subColor;
            
            return finalCoords;
        }
        
        tempPuyo.mainY -= 1;
    }
}


function checkCollision(coords) {
    for (const puyo of coords) {
        if (puyo.x < 0 || puyo.x >= WIDTH || puyo.y < 0) return true;

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

/**
 * 時計回り回転 (Aボタン, Zキー)
 */
function rotatePuyoCW() {
    if (gameState !== 'playing' || !currentPuyo) return false;

    // 時計回り: +1
    const newRotation = (currentPuyo.rotation + 1) % 4;
        
    // 回転試行
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    
    return false;
}

/**
 * 反時計回り回転 (Bボタン, Xキー)
 */
function rotatePuyoCCW() {
    if (gameState !== 'playing' || !currentPuyo) return false;

    // 反時計回り: -1 
    const newRotation = (currentPuyo.rotation - 1 + 4) % 4;
        
    // 回転試行
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    
    return false;
}


function hardDrop() {
    if (gameState !== 'playing' || !currentPuyo) return;

    // 衝突するまで下に移動
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

/**
 * 連鎖処理フロー: 落下(ちぎり) -> 判定 -> 消去 -> 再帰
 */
async function runChain() {
    
    // フェーズ1: 重力処理 (ちぎりを含む)。
    gravity(); 
    renderBoard(); 
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // フェーズ2: 連鎖チェック
    const groups = findConnectedPuyos();

    if (groups.length === 0) {
        // 連鎖が検出されなかった場合、連鎖終了。
        gameState = 'playing';
        generateNewPuyo(); 
        renderBoard();
        return;
    }

    // フェーズ3: ぷよの削除とスコア計算
    chainCount++;

    let chainScore = calculateScore(groups, chainCount);
    score += chainScore;

    // ぷよの削除 (データを更新)
    groups.forEach(({ group }) => {
        group.forEach(({ x, y }) => {
            board[y][x] = COLORS.EMPTY; 
        });
    });

    renderBoard(); // 削除後の盤面を描画 (消滅演出)
    updateUI();

    await new Promise(resolve => setTimeout(resolve, 300));

    // フェーズ4: 再帰的に次の連鎖をチェック (重力処理から再スタート)
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
    
    const currentPuyoCoords = currentPuyo && gameState === 'playing' ? getPuyoCoords() : [];
    const ghostPuyoCoords = getGhostCoords(); 

    for (let y = HEIGHT - 3; y >= 0; y--) { 
        for (let x = 0; x < WIDTH; x++) {
            const puyoElement = document.createElement('div');
            
            let cellColor = board[y][x]; 
            let isGhost = false;

            // 1. ゴーストぷよがこのセルにあるかチェック
            const puyoGhost = ghostPuyoCoords.find(p => p.x === x && p.y === y);
            if (puyoGhost) {
                cellColor = puyoGhost.color; 
                isGhost = true;
            }

            // 2. 落下中のぷよがこのセルにあるかチェックし、色とクラスを上書き
            const puyoInFlight = currentPuyoCoords.find(p => p.x === x && p.y === y);
            
            if (puyoInFlight) {
                cellColor = puyoInFlight.color; 
                isGhost = false; 
            }
            
            puyoElement.className = `puyo puyo-${cellColor} ${isGhost ? 'puyo-ghost' : ''}`;
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
        case 'Z':
            rotatePuyoCW(); // Zキー: 時計回り回転 (Aボタン)
            break;
        case 'x':
        case 'X':
            rotatePuyoCCW(); // Xキー: 反時計回り回転 (Bボタン)
            break;
        case 'ArrowDown':
            movePuyo(0, -1); // ソフトドロップ
            break;
        case ' ': // スペースキー
            event.preventDefault(); 
            hardDrop(); 
            break;
    }
}

// グローバルスコープに関数を公開
window.resetGame = resetGame;
window.rotatePuyoCW = rotatePuyoCW;
window.rotatePuyoCCW = rotatePuyoCCW;

// ゲーム開始
document.addEventListener('DOMContentLoaded', initializeGame);
