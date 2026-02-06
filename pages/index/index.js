Page({
  data: {
    showModal: true,    // 是否显示拿破仑规则弹窗
    pieceCount: 37,     // 剩余棋子数量
    boardData: [],      // 棋盘数据
    selected: null,     // 当前选中的棋子位置 {ri, ci, x, y}
    isFirst: true       // 是否是第一步（第一步是移除一颗棋子）
  },

  onLoad() {
    this.initAudio();   // 初始化音效
    this.initBoard();   // 初始化棋盘
  },

  // --- 1. 音效管理 ---
  initAudio() {
    // 创建内部音频上下文
    this.popAudio = wx.createInnerAudioContext();
    // 路径指向根目录下的 sounds 文件夹
    this.popAudio.src = '/sounds/pop.wav'; 
    
    // 监听错误
    this.popAudio.onError((res) => {
      console.error('音效加载失败', res.errMsg);
    });

    // 建议设置：即使手机开启静音模式也能发出声音（可选）
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        success: function() { console.log('开启静音播放模式成功') },
        fail: function(err) { console.log('开启静音播放模式失败', err) }
      });
    }
  },

  playPop() {
    if (this.popAudio) {
      this.popAudio.stop(); // 先停止上次播放，防止快速点击时重叠
      this.popAudio.play();
    }
  },

  // --- 2. 棋盘逻辑 ---
  initBoard() {
    // 37颗珠子标准欧式布局 (7x7 矩阵，去掉四个角)
    const layout = [
      [null, null, [2, 7], [3, 7], [4, 7], null, null],
      [null, [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], null],
      [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]],
      [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]],
      [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]],
      [null, [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], null],
      [null, null, [2, 1], [3, 1], [4, 1], null, null]
    ];

    let board = layout.map(row =>
      row.map(cell => cell ? {
        x: cell[0], y: cell[1],
        hasPiece: true,
        color: Math.floor(Math.random() * 5) + 1 // 随机 1-5 种颜色
      } : null)
    );

    this.setData({
      boardData: board,
      isFirst: true,
      selected: null,
      pieceCount: 37
    });
  },

  handleTap(e) {
    const { x, y, ri, ci } = e.currentTarget.dataset;
    let { boardData, isFirst, selected } = this.data;
    let target = boardData[ri][ci];

    // 第一步：点击任何一个位置移除棋子
    if (isFirst && target.hasPiece) {
      target.hasPiece = false;
      this.playPop(); // 播放音效
      this.setData({ boardData, isFirst: false });
      this.updateCount();
      return;
    }

    // 后续步骤：选择和跳跃
    if (target.hasPiece) {
      // 选中棋子
      this.setData({ selected: { x, y, ri, ci } });
    } else if (selected) {
      // 尝试跳向空位
      const dx = Math.abs(x - selected.x);
      const dy = Math.abs(y - selected.y);

      // 规则：必须直线跳过一个棋子 (距离为 2)
      if ((dx === 2 && dy === 0) || (dy === 2 && dx === 0)) {
        const mx = (x + selected.x) / 2;
        const my = (y + selected.y) / 2;

        // 寻找中间被跳过的棋子坐标
        let midRi, midCi;
        boardData.forEach((row, rIdx) => {
          row.forEach((col, cIdx) => {
            if (col && col.x === mx && col.y === my) {
              midRi = rIdx; midCi = cIdx;
            }
          });
        });

        // 如果中间有棋子，则跳跃成功
        if (midRi !== undefined && boardData[midRi][midCi].hasPiece) {
          boardData[ri][ci].hasPiece = true; // 落点变满
          boardData[ri][ci].color = boardData[selected.ri][selected.ci].color; // 继承颜色
          boardData[selected.ri][selected.ci].hasPiece = false; // 原位变空
          boardData[midRi][midCi].hasPiece = false; // 中间变空

          this.playPop(); // 播放消除音效
          this.setData({ boardData, selected: null });
          this.updateCount();
        }
      }
    }
  },

  updateCount() {
    let count = 0;
    this.data.boardData.forEach(row => {
      row.forEach(cell => {
        if (cell && cell.hasPiece) count++;
      });
    });
    this.setData({ pieceCount: count });

    if (count === 1) {
      wx.showToast({ title: '天才！只剩一颗了', icon: 'success', duration: 3000 });
    }
  },

  // 弹窗控制
  closeModal() {
    this.setData({ showModal: false });
  },

  // 重新开始
  resetGame() {
    wx.showModal({
      title: '提示',
      content: '确定要重新开始吗？',
      success: (res) => {
        if (res.confirm) {
          this.initBoard();
        }
      }
    });
  }
});