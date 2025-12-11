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

/**
 * モバイル操作ボタンの表示/非表示をチェックし、設定する
 */
function checkMobileControlsVisibility() {
    const mobileControls = document.getElementById('mobile-controls');
    if (!mobileControls) return;

    // プレイモードかつ画面幅が650px以下の場合に表示
    if (gameState === 'playing' && window.innerWidth <= 650) {
        mobileControls.style.display = 'flex';
    } else {
        mobileControls.style.display = 'none';
    }
}


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

    // 初期状態はプレイモードなので、エディットモードへのアイコンを設定
    const modeIcon = document.getElementById('mode-icon');
    if (modeIcon) modeIcon.className = 'icon-edit';

    generateNewPuyo();
    
    updateUI();
    
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
        
        setupEditModeListeners(); 
        
        document.initializedKeyHandler = true;
    }
    
    checkMobileControlsVisibility(); // モバイルコントロールの初期表示
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
    const infoPanel = document.getElementById('info-panel');
    const modeIcon = document.getElementById('mode-icon');
    const boardElement = document.getElementById('puyo-board');
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // -> エディットモードへ切り替え
        gameState = 'editing';
        infoPanel.classList.add('edit-mode-active');
        if (modeIcon) modeIcon.className = 'icon-play'; // プレイモードへ誘導するアイコン (コントローラー)
        
        // モバイル操作ボタンを非表示
        document.getElementById('mobile-controls').style.display = 'none'; 
        
        // 盤面クリックイベントをエディット用に設定
        boardElement.addEventListener('click', handleBoardClickEditMode);
        
        selectPaletteColor(currentEditColor); 
        renderEditNextPuyos(); 
        renderBoard(); 
        
    } else if (gameState === 'editing') {
        // -> プレイモードへ切り替え
        gameState = 'playing';
        infoPanel.classList.remove('edit-mode-active');
        if (modeIcon) modeIcon.className = 'icon-edit'; // エディットモードへ誘導するアイコン (ペン)
        
        // モバイル操作ボタンを再表示 (画面幅に応じて)
        checkMobileControlsVisibility();

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

// ... (getPuyoCoords, getCoordsFromState, getGhostCoords, checkCollision, movePuyo, rotatePuyoCW, rotatePuyoCCW, hardDrop, lockPuyo, findConnectedPuyos, runChain, calculateScore, gravity は省略)

// ... (省略された関数は前回のコードと同様です)

/**
 * エディットモードのネクスト描画 (タップイベントの組み込み)
 */
function renderEditNextPuyos() {
    const slots = [document.getElementById('edit-next-1'), document.getElementById('edit-next-2')];
    
    const createPuyo = (color, listIndex, puyoIndex) => {
        let puyo = document.createElement('div');
        puyo.className = `puyo puyo-${color}`;
        
        // 個々のぷよにクリックイベントを設定
        puyo.addEventListener('click', (event) => {
            event.stopPropagation(); // 親要素（スロット）へのイベント伝播を停止
            if (gameState !== 'editing') return;
            
            if (editingNextPuyos.length > listIndex) {
                // 選択中の色を反映
                // おじゃまぷよ(5)と空(0)を含むすべての色を反映可能
                editingNextPuyos[listIndex][puyoIndex] = currentEditColor; 
                selectPaletteColor(currentEditColor);
                renderEditNextPuyos(); // 変更後に再描画
            }
        });
        
        return puyo;
    };
    
    slots.forEach((slot, listIndex) => { // listIndex は 0 or 1
        if (!slot) return;
        slot.innerHTML = '';
        if (editingNextPuyos[listIndex]) {
            const [c1, c2] = editingNextPuyos[listIndex];
            slot.appendChild(createPuyo(c1, listIndex, 0)); // puyoIndex 0
            slot.appendChild(createPuyo(c2, listIndex, 1)); // puyoIndex 1
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
