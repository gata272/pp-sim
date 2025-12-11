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
let gameState = 'playing'; // 'playing', 'chaining', 'gameover', 'editing'
let currentEditColor = COLORS.RED; // エディットモードで選択中の色 (デフォルトは赤)
let editingNextPuyos = []; // エディットモードで編集中のネクストぷよリスト


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

    // ネクストぷよリストを完全にランダムなぷよで初期化 (最低2個)
    nextPuyoColors = [getRandomPair(), getRandomPair()];
    // エディット用のネクストリストも初期化
    editingNextPuyos = JSON.parse(JSON.stringify(nextPuyoColors));


    generateNewPuyo();
    
    updateUI();
    
    // キーボードイベントリスナーとボタンイベントリスナーは一度だけ設定
    if (!document.initializedKeyHandler) {
        document.addEventListener('keydown', handleInput);
        
        // モバイル操作ボタンのイベントリスナー設定 (グローバル関数を呼び出す)
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnRotateCW = document.getElementById('btn-rotate-cw'); 
        const btnRotateCCW = document.getElementById('btn-rotate-ccw'); 
        const btnHardDrop = document.getElementById('btn-hard-drop');

        if (btnLeft) btnLeft.addEventListener('click', () => movePuyo(-1, 0));
        if (btnRight) btnRight.addEventListener('click', () => movePuyo(1, 0));
        
        if (btnRotateCW) btnRotateCW.addEventListener('click', window.rotatePuyoCCW); 
        if (btnRotateCCW) btnRotateCCW.addEventListener('click', window.rotatePuyoCW); 
        
        if (btnHardDrop) btnHardDrop.addEventListener('click', window.hardDrop);
        
        setupEditModeListeners(); // 【新規】エディットモードのイベントを設定
        
        document.initializedKeyHandler = true;
    }
    
    renderBoard();
}

/**
 * 盤面リセット関数 (グローバル公開)
 */
window.resetGame = function() { 
    initializeGame();
    alert('盤面をリセットしました。');
}

/**
 * モード切り替え関数 (グローバル公開)
 */
window.toggleMode = function() {
    const toggleButton = document.getElementById('mode-toggle-button');
    const playInfo = document.getElementById('play-mode-info');
    const editInfo = document.getElementById('edit-mode-info');
    const controlsPanel = document.getElementById('controls-panel');
    const mobileControls = document.getElementById('mobile-controls');
    const boardElement = document.getElementById('puyo-board');
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // -> エディットモードへ切り替え
        gameState = 'editing';
        toggleButton.textContent = 'プレイモードへ';
        
        playInfo.style.display = 'none';
        editInfo.style.display = 'flex';
        controlsPanel.style.display = 'none'; 
        mobileControls.style.display = 'none'; 
        
        // 盤面クリックイベントをエディット用に設定
        boardElement.addEventListener('click', handleBoardClickEditMode);
        
        // 初期パレットの選択状態を設定
        selectPaletteColor(currentEditColor); 
        renderEditNextPuyos(); 
        renderBoard(); 
        
    } else if (gameState === 'editing') {
        // -> プレイモードへ切り替え
        gameState = 'playing';
        toggleButton.textContent = 'エディットモードへ';
        
        playInfo.style.display = 'flex';
        editInfo.style.display = 'none';
        
        // PC/モバイルの操作パネルの表示を復元
        controlsPanel.style.display = 'block'; 
        // モバイル環境ならモバイルコントロールを表示
        if (window.innerWidth <= 650) {
             mobileControls.style.display = 'flex';
        } else {
             mobileControls.style.display = 'none';
        }

        // 盤面クリックイベントをエディットモードから解除
        boardElement.removeEventListener('click', handleBoardClickEditMode);
        
        // 既存のネクストを再生成
        currentPuyo = null; 
        generateNewPuyo(); // 新しいぷよを生成
        
        renderBoard();
    }
}


// --- エディットモード機能 ---

function setupEditModeListeners() {
    const palette = document.getElementById('color-palette');
    if (palette) {
        palette.querySelectorAll('.palette-color').forEach(puyoElement => {
            puyoElement.addEventListener('click', () => {
                const color = parseInt(puyoElement.getAttribute('data-color'));
                selectPaletteColor(color);
            });
        });
    }
    
    // ネクスト設定スロットのクリックイベント設定
    const editNextContainer = document.getElementById('edit-next-container');
    if(editNextContainer) {
        editNextContainer.querySelectorAll('.edit-next-slot').forEach((slot, slotIndex) => {
            slot.addEventListener('click', (event) => {
                if (gameState !== 'editing') return;
                
                const rect = slot.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                
                // 2つのぷよの境界を判定 (左右のぷよ)
                const isLeftPuyo = clickX < rect.width / 2;
                
                const listIndex = slotIndex;
                const puyoIndex = isLeftPuyo ? 0 : 1;
                
                // 選択中の色を反映
                if (editingNextPuyos.length > listIndex) {
                    editingNextPuyos[listIndex][puyoIndex] = currentEditColor;
                    renderEditNextPuyos();
                }
            });
        });
    }
}

/**
 * パレットの色を選択し、ハイライトを更新
 */
function selectPaletteColor(color) {
    currentEditColor = color;
    document.querySelectorAll('.palette-color').forEach(p => p.classList.remove('selected'));
    const selectedPuyo = document.querySelector(`.palette-color[data-color="${color}"]`);
    if (selectedPuyo) {
        selectedPuyo.classList.add('selected');
    }
}

/**
 * エディットモードで盤面をクリックした際の処理
 */
function handleBoardClickEditMode(event) {
    if (gameState !== 'editing') return;
    
    const boardElement = document.getElementById('puyo-board');
    const rect = boardElement.getBoundingClientRect();
    // セルサイズを盤面全体の幅と列数から計算
    const cellSize = rect.width / WIDTH; 

    // クリック座標を盤面座標に変換
    let x = Math.floor((event.clientX - rect.left) / cellSize);
    // Y座標は、描画が上から下にされているのに対し、盤面配列は下から上になっているため反転計算
    let y = Math.floor((rect.height - (event.clientY - rect.top)) / cellSize);

    // 可視領域内に制限 (0 <= y < HEIGHT - 2)
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT - 2) { 
        // ぷよの配置
        board[y][x] = currentEditColor;
        renderBoard(); 
    }
}

/**
 * エディットモードで設定したネクストをプレイモードに反映する (グローバル公開)
 */
window.applyNextPuyos = function() {
    if (gameState === 'editing') {
        // ネクストリストを現在の編集中のリストで上書き
        nextPuyoColors = JSON.parse(JSON.stringify(editingNextPuyos));
        alert('ネクストぷよの設定を保存しました。プレイモードで適用されます。');
    }
}


// --- ぷよの生成と操作 (プレイモード時のみ有効) ---

function getRandomColor() {
    return Math.floor(Math.random() * 4) + 1;
}

function getRandomPair() {
    return [getRandomColor(), getRandomColor()];
}

function generateNewPuyo() {
    if (gameState !== 'playing') return;

    // ネクストリストから1組取り出し、新しい1組を追加
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

// ... (getPuyoCoords, getCoordsFromState, getGhostCoords, checkCollision, lockPuyo, findConnectedPuyos, runChain, calculateScore, gravity は変更なし)

function movePuyo(dx, dy, newRotation, shouldRender = true) {
    if (gameState !== 'playing' || !currentPuyo) return false; // プレイモードでない場合は無効

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
        
        if (shouldRender) { 
            renderBoard();
        }
        return true;
    }
    return false;
}

/**
 * 時計回り回転 (CW) (Bボタンに割り当て) (グローバル公開)
 */
window.rotatePuyoCW = function() {
    if (gameState !== 'playing') return false;
    // ... 既存の回転ロジック ...
    const newRotation = (currentPuyo.rotation + 1) % 4;
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    return false;
}

/**
 * 反時計回り回転 (CCW) (Aボタンに割り当て) (グローバル公開)
 */
window.rotatePuyoCCW = function() {
    if (gameState !== 'playing') return false;
    // ... 既存の回転ロジック ...
    const newRotation = (currentPuyo.rotation - 1 + 4) % 4;
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    return false;
}

/**
 * ハードドロップ (グローバル公開)
 */
window.hardDrop = function() {
    if (gameState !== 'playing' || !currentPuyo) return;

    // 衝突するまで下に移動 (描画はスキップ: false)
    while (movePuyo(0, -1, undefined, false)); 

    // 最終的な位置で一度だけ描画
    renderBoard(); 
    
    lockPuyo(); // 即座に固定
}


// --- 描画とUI更新 ---

function renderBoard() {
    const boardElement = document.getElementById('puyo-board');
    boardElement.innerHTML = '';
    
    // エディットモード中は落下中のぷよやゴーストを表示しない
    const isPlaying = gameState === 'playing';
    const currentPuyoCoords = isPlaying ? getPuyoCoords() : [];
    const ghostPuyoCoords = isPlaying ? getGhostCoords() : []; 

    for (let y = HEIGHT - 3; y >= 0; y--) { 
        for (let x = 0; x < WIDTH; x++) {
            const puyoElement = document.createElement('div');
            
            let cellColor = board[y][x]; 
            let isGhost = false;

            // 1. ゴーストぷよがこのセルにあるかチェック (プレイモードのみ)
            const puyoGhost = ghostPuyoCoords.find(p => p.x === x && p.y === y);
            if (puyoGhost) {
                cellColor = puyoGhost.color; 
                isGhost = true;
            }

            // 2. 落下中のぷよがこのセルにあるかチェックし、色とクラスを上書き (プレイモードのみ)
            const puyoInFlight = currentPuyoCoords.find(p => p.x === x && p.y === y);
            
            if (puyoInFlight) {
                cellColor = puyoInFlight.color; 
                isGhost = false; 
            }
            
            puyoElement.className = `puyo puyo-${cellColor} ${isGhost ? 'puyo-ghost' : ''}`;
            boardElement.appendChild(puyoElement);
        }
    }

    if (gameState === 'playing') {
        renderPlayNextPuyo();
    } else if (gameState === 'editing') {
        renderEditNextPuyos(); // エディットモードのネクスト設定UIを更新
    }
}

function renderPlayNextPuyo() {
    const next1Element = document.getElementById('next-puyo-1');
    const next2Element = document.getElementById('next-puyo-2');
    
    if (!next1Element || !next2Element) return;

    next1Element.innerHTML = '';
    next2Element.innerHTML = '';

    const createPuyo = (color) => {
        let puyo = document.createElement('div');
        puyo.className = `puyo puyo-${color}`;
        return puyo;
    };
    
    // Next 1: 次に落ちてくるぷよ (nextPuyoColors[0])
    if (nextPuyoColors.length >= 1) {
        const [c1_1, c1_2] = nextPuyoColors[0];
        next1Element.appendChild(createPuyo(c1_1)); 
        next1Element.appendChild(createPuyo(c1_2)); 
    }

    // Next 2: その次に落ちてくるぷよ (nextPuyoColors[1])
    if (nextPuyoColors.length >= 2) {
        const [c2_1, c2_2] = nextPuyoColors[1];
        next2Element.appendChild(createPuyo(c2_1)); 
        next2Element.appendChild(createPuyo(c2_2)); 
    }
}

function renderEditNextPuyos() {
    const slots = [document.getElementById('edit-next-1'), document.getElementById('edit-next-2')];
    
    const createPuyo = (color) => {
        let puyo = document.createElement('div');
        puyo.className = `puyo puyo-${color}`;
        return puyo;
    };
    
    slots.forEach((slot, index) => {
        if (!slot) return;
        slot.innerHTML = '';
        if (editingNextPuyos[index]) {
            const [c1, c2] = editingNextPuyos[index];
            slot.appendChild(createPuyo(c1));
            slot.appendChild(createPuyo(c2));
        }
    });
}


function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('chain-count').textContent = chainCount;
}

// --- 入力処理 ---

function handleInput(event) {
    if (gameState !== 'playing') return; // プレイモードでない場合は無効

    switch (event.key) {
        case 'ArrowLeft':
            movePuyo(-1, 0); 
            break;
        case 'ArrowRight':
            movePuyo(1, 0); 
            break;
        case 'z':
        case 'Z':
            rotatePuyoCW(); 
            break;
        case 'x':
        case 'X':
            rotatePuyoCCW(); 
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

// ゲーム開始
document.addEventListener('DOMContentLoaded', initializeGame);
