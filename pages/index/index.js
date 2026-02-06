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
    rankName: '称号'
  },

  onLoad() {
    this.initAudio();
    this.initBoard();
  },

  initAudio() {
    this.popAudio = wx.createInnerAudioContext();
    this.popAudio.src = '/sounds/pop.wav'; 
  },

  playPop() {
    if (this.popAudio) { this.popAudio.stop(); this.popAudio.play(); }
  },

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
    let { boardData, isFirst, selected } = this.data;
    let cell = boardData[ri][ci];

    if (isFirst && cell.hasPiece) {
      this.saveHistory();
      cell.hasPiece = false;
      this.playPop();
      this.setData({ boardData, isFirst: false });
      this.updateCount();
      return;
    }

    if (cell.hasPiece) {
      this.setData({ selected: { ri, ci, x: cell.x, y: cell.y } });
    } else if (selected) {
      const dx = Math.abs(cell.x - selected.x);
      const dy = Math.abs(cell.y - selected.y);

      if ((dx === 2 && dy === 0) || (dy === 2 && dx === 0)) {
        const mx = (cell.x + selected.x) / 2;
        const my = (cell.y + selected.y) / 2;
        let midRi, midCi;
        boardData.forEach((row, rIdx) => row.forEach((col, cIdx) => {
          if (col && col.x === mx && col.y === my) { midRi = rIdx; midCi = cIdx; }
        }));

        if (midRi !== undefined && boardData[midRi][midCi].hasPiece) {
          this.saveHistory();
          boardData[ri][ci].hasPiece = true;
          boardData[ri][ci].color = boardData[selected.ri][selected.ci].color;
          boardData[selected.ri][selected.ci].hasPiece = false;
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
    this.data.boardData.forEach(row => row.forEach(c => { if (c?.hasPiece) count++ }));
    this.setData({ pieceCount: count });

    if (!this.data.isFirst && !this.checkMoves()) {
      this.showRank(count);
    }
  },

  checkMoves() {
    const b = this.data.boardData;
    for (let r=0; r<b.length; r++) {
      for (let c=0; c<b[r].length; c++) {
        if (!b[r][c]?.hasPiece) continue;
        const dirs = [[0,2],[0,-2],[2,0],[-2,0]];
        for (let [dr, dc] of dirs) {
          const tr = r+dr, tc = c+dc, mr = r+dr/2, mc = c+dc/2;
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

  closeModal() { this.setData({ showModal: false }); },
  resetGame() { this.initBoard(); }
});