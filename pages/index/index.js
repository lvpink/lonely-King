Page({
  data: {
    showModal: true,
    showResult: false,
    pieceCount: 37,
    boardData: [],
    selected: null,
    isFirst: true,
    history: [], 
    rankIcon: '🏆',
    rankName: '称号',
    bgmList: ['/sounds/bgm1.mp3', '/sounds/bgm2.mp3'], // 确保你的文件夹里有这两个文件
    currentBgmIdx: -1
  },

  onLoad() {
    this.initAudio();
    this.initBoard();
  },

  // --- 音频管理 ---
  initAudio() {
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOtherAudio: true 
      });
    }
  
    // --- 修改部分：初始化音效池 ---
    this.popPool = [];
    this.poolSize = 4; // 准备4个实例轮换，足以应对快速点击
    this.poolIdx = 0;
  
    for (let i = 0; i < this.poolSize; i++) {
      const audio = wx.createInnerAudioContext();
      audio.src = '/sounds/pop.wav';
      audio.volume = 0.8;
      this.popPool.push(audio);
    }
  
    // 背景音乐保持不变
    this.bgmAudio = wx.createInnerAudioContext();
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.2;
  },

  // 随机选择并播放 BGM
  playRandomBGM() {
    if (!this.bgmAudio || this.data.bgmList.length === 0) return;

    const idx = Math.floor(Math.random() * this.data.bgmList.length);
    const selectedSrc = this.data.bgmList[idx];

    this.bgmAudio.stop();
    this.bgmAudio.src = selectedSrc;
    this.bgmAudio.title = "背景音乐"; // 增加 title 提高兼容性
    
    this.bgmAudio.play();
    console.log("正在播放:", selectedSrc);
  },

  playPop() {
    if (this.popPool && this.popPool.length > 0) {
      // 轮流使用池子里的实例
      const audio = this.popPool[this.poolIdx];
      
      // 重置进度到开头并播放
      audio.seek(0); 
      audio.play();
  
      // 移动索引到下一个实例
      this.poolIdx = (this.poolIdx + 1) % this.poolSize;
    }
  },

// --- 游戏核心逻辑 ---
 initBoard() {
    const layout = [
      [null, null, [2,7], [3,7], [4,7], null, null],
      [null, [1,6], [2,6], [3,6], [4,6], [5,6], null],
      [[0,5], [1,5], [2,5], [3,5], [4,5], [5,5], [6,5]],
      [[0,4], [1,4], [2,4], [3,4], [4,4], [5,4], [6,4]],
      [[0,3], [1,3], [2,3], [3,3], [4,3], [5,3], [6,3]],
      [null, [1,2], [2,2], [3,2], [4,2], [5,2], null],
      [null, null, [2,1], [3,1], [4,1], null, null]
    ];
    let board = layout.map(row => row.map(cell => cell ? {
      x: cell[0], y: cell[1], hasPiece: true, color: Math.floor(Math.random() * 5) + 1
    } : null));

    this.setData({
      boardData: board,
      isFirst: true,
      selected: null,
      pieceCount: 37,
      history: [],
      showResult: false
    });
    // this.startBGM(); // 重置时也重新播放音乐
  },

  saveHistory() {
    const { boardData, pieceCount, isFirst } = this.data;
    const history = this.data.history;
    history.push(JSON.stringify({ boardData, pieceCount, isFirst }));
    this.setData({ history });
  },

  undoMove() {
    if (this.data.history.length === 0) {
      wx.showToast({ title: '无法撤销', icon: 'none' });
      return;
    }
    const last = JSON.parse(this.data.history.pop());
    this.setData({
      boardData: last.boardData,
      pieceCount: last.pieceCount,
      isFirst: last.isFirst,
      history: this.data.history,
      selected: null
    });
  },

  handleTap(e) {
    const { ri, ci } = e.currentTarget.dataset;
    const boardData = this.data.boardData;
    const cell = boardData[ri][ci];

    // 第一步：点击移除任意一颗棋子开始
    if (this.data.isFirst) {
      if (cell && cell.hasPiece) {
        boardData[ri][ci].hasPiece = false;
        this.playPop();
        this.setData({ boardData, isFirst: false });
        this.updateCount();
      }
      return;
    }

    // 第二步：跳棋逻辑
    if (cell && cell.hasPiece) {
      // 选中棋子
      this.setData({ selected: { ri, ci } });
    } else if (cell && !cell.hasPiece && this.data.selected) {
      // 尝试移动到空位
      const sel = this.data.selected;
      const dr = ri - sel.ri;
      const dc = ci - sel.ci;

      // 检查是否是直线跳跃两格
      if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
        const midRi = sel.ri + dr / 2;
        const midCi = sel.ci + dc / 2;

        if (boardData[midRi][midCi].hasPiece) {
          // 执行消除
          boardData[sel.ri][sel.ci].hasPiece = false;
          boardData[ri][ci].hasPiece = true;
          boardData[midRi][midCi].hasPiece = false;
          
          this.playPop();
          this.setData({ boardData, selected: null });
          this.updateCount();
        }
      }
    }
  },

  updateCount() {
    let count = 0;
    this.data.boardData.forEach(row => row && row.forEach(c => { if (c?.hasPiece) count++ }));
    this.setData({ pieceCount: count });

    // 检查是否游戏结束
    if (!this.data.isFirst && !this.checkMoves()) {
      this.showRank(count);
    }
  },

  checkMoves() {
    const b = this.data.boardData;
    for (let r = 0; r < b.length; r++) {
      for (let c = 0; c < b[r].length; c++) {
        if (!b[r][c] || !b[r][c].hasPiece) continue;
        const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]];
        for (let [dr, dc] of dirs) {
          const tr = r + dr, tc = c + dc, mr = r + dr / 2, mc = c + dc / 2;
          if (b[tr] && b[tr][tc] && !b[tr][tc].hasPiece && b[mr][mc]?.hasPiece) return true;
        }
      }
    }
    return false;
  },

  showRank(count) {
    let icon = '😅', name = '再接再厉';
    if (count === 1) { icon = '🏆'; name = '孤独求败'; }
    else if (count <= 3) { icon = '🥇'; name = '智力大师'; }
    else if (count <= 5) { icon = '🥈'; name = '棋坛高手'; }
    this.setData({ showResult: true, rankIcon: icon, rankName: name });
  },

  // --- 弹窗与控制逻辑 ---
  closeModal() {
    this.setData({ showModal: false });
    // 关键点：在用户点击“开始挑战”按钮的回调里触发音乐
    this.playRandomBGM();
  },
  
resetGame() {
    this.initBoard();
    this.setData({
      showResult: false,
      showModal: false,
      isFirst: true,
      history: []
    });
    // 重置时可以考虑切换下一首音乐
    this.playRandomBGM();
  },

  onUnload() {
    if (this.bgmAudio) this.bgmAudio.destroy();
    if (this.popPool) {
      this.popPool.forEach(audio => audio.destroy());
    }
  }
});