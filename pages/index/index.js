// 在 Page 外面定义动画控制变量
let animationId = null;
Page({
  data: {
    showModal: true,
    showResult: false,
    showRankModal: false,
    showNickNameModal: false,
    pieceCount: 37,
    boardData: [],
    selected: null,
    isFirst: true,
    history: [],
    rankList: [],
    tempCount: 0,
    rankIcon: '😅',
    fireworks: [], 
    showConfetti: false,
    rankName: '再接再厉',
    isSubmitting: false,
    hasCloudName: false, // 标记云端是否有名字
    bgmList: ['/sounds/bgm1.mp3', '/sounds/bgm2.mp3'],
    defaultNickname: wx.getStorageSync('user_nickname') || ''
  },

  onLoad() {
    this.checkUserCloudRecord(); // 新增：检查云端记录
    this.initAudio();
    this.initBoard();
    this.fetchRankList();
  },
  checkUserCloudRecord() {
    const db = wx.cloud.database();
    // 注意：云函数或云数据库查询会自动带上当前用户的 OpenID
    db.collection('rank-king').where({
      _openid: '{openid}' // 微信会自动识别当前用户
    }).get().then(res => {
      if (res.data.length > 0) {
        const cloudName = res.data[0].name;
        // 查到了就同步到本地缓存，并更新状态
        wx.setStorageSync('user_nickname', cloudName);
        this.setData({ 
          defaultNickname: cloudName,
          hasCloudName: true 
        });
      }
    });
  },

  // --- 音频管理 ---
  initAudio() {
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOtherAudio: true });
    }
    this.popPool = [];
    this.poolSize = 4;
    this.poolIdx = 0;
    for (let i = 0; i < this.poolSize; i++) {
      const audio = wx.createInnerAudioContext();
      audio.src = '/sounds/pop.wav';
      this.popPool.push(audio);
    }
    this.bgmAudio = wx.createInnerAudioContext();
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.2;
  },

  playPop() {
    const audio = this.popPool[this.poolIdx];
    if (audio) {
      audio.seek(0);
      audio.play();
      this.poolIdx = (this.poolIdx + 1) % this.poolSize;
    }
  },

  playRandomBGM() {
     // 1. 先停止当前播放，清除缓冲区
    if (this.bgmAudio) {
      this.bgmAudio.stop(); 
    }

    const idx = Math.floor(Math.random() * this.data.bgmList.length);
    const newSrc = this.data.bgmList[idx];

    // 2. 检查：如果随机到的还是同一首歌且正在播放，可以不处理，或者强制重头开始
    // 这里直接强制换源播放
    this.bgmAudio.src = newSrc;
  
    // 3. 微信小程序音频的一个“坑”：
    // 最好在 onCanplay 回调中执行 play，或者显式 seek(0)
    this.bgmAudio.play();
  },

  // --- 游戏核心逻辑 ---
  initBoard() {
    const layout = [
      [null, null, [2, 7], [3, 7], [4, 7], null, null],
      [null, [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], null],
      [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]],
      [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]],
      [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]],
      [null, [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], null],
      [null, null, [2, 1], [3, 1], [4, 1], null, null]
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
      showResult: false,
      showNickNameModal: false
    });
  },

  onCellTap(e) {
    const { ri, ci } = e.currentTarget.dataset;
    if (this.data.isFirst) {
      this.removeFirstPiece(ri, ci);
    } else {
      this.handleMove(ri, ci);
    }
  },

  removeFirstPiece(ri, ci) {
    let board = this.data.boardData;
    // --- 新增：在修改前，记录当前棋盘状态到历史记录中 ---
  const history = [...this.data.history, JSON.parse(JSON.stringify(board))];
    board[ri][ci].hasPiece = false;
    this.playPop();
    this.setData({ boardData: board, pieceCount: 36, isFirst: false ,history: history });
  },

  handleMove(ri, ci) {
    const { selected, boardData } = this.data;
    if (!selected) {
      if (boardData[ri][ci].hasPiece) this.setData({ selected: { ri, ci } });
    } else {
      if (selected.ri === ri && selected.ci === ci) {
        this.setData({ selected: null });
      } else if (boardData[ri][ci].hasPiece) {
        this.setData({ selected: { ri, ci } });
      } else {
        this.executeMove(selected.ri, selected.ci, ri, ci);
      }
    }
  },

  executeMove(r1, c1, r2, c2) {
    const dr = r2 - r1, dc = c2 - c1;
    if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
      const mr = r1 + dr / 2, mc = c1 + dc / 2;
      let board = JSON.parse(JSON.stringify(this.data.boardData));
      if (board[mr][mc].hasPiece) {
        const history = [...this.data.history, JSON.parse(JSON.stringify(this.data.boardData))];
        board[r1][c1].hasPiece = false;
        board[mr][mc].hasPiece = false;
        board[r2][c2].hasPiece = true;
        board[r2][c2].color = board[r1][c1].color;

        this.playPop();
        this.setData({
          boardData: board,
          pieceCount: this.data.pieceCount - 1,
          selected: null,
          history
        }, () => {
          this.checkGameOver();
        });
      }
    }
  },
  handleResultClick() {
    if (this.data.needNickName) {
      // 隐藏结果，开启起名弹窗
      this.setData({
        showResult: false,
        showNickNameModal: true
        // needNickName: false // 注意：这里不要急着把 needNickName 设为 false，防止用户起名中途退出
      });
      
      // 延迟触发烟花，解决 Canvas 在弹窗切换时节点渲染的问题
      setTimeout(() => {
        this.triggerCelebration();
      }, 300);
    } else {
      // 没破纪录或已有名字，直接重置游戏
      this.resetGame();
    }
  },
  
  hasAvailableMoves() {
    const b = this.data.boardData;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (b[r] && b[r][c] && b[r][c].hasPiece) {
          const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]];
          for (const [dr, dc] of dirs) {
            const tr = r + dr, tc = c + dc, mr = r + dr / 2, mc = c + dc / 2;
            if (b[tr] && b[tr][tc] && !b[tr][tc].hasPiece && b[mr][mc] && b[mr][mc].hasPiece) return true;
          }
        }
      }
    }
    return false;
  },

  showRank(count) {
    let rankData = {
      1: { icon: '👑', name: '神之境界', color: '#ff4400' },
      2: { icon: '🌟', name: '智力巅峰', color: '#ff8800' },
      3: { icon: '🔥', name: '棋坛精英', color: '#ffaa00' }
    };
    const currentRank = rankData[count] || { icon: '👍', name: '继续努力', color: '#888' };

    this.setData({
      showResult: true,
      rankIcon: currentRank.icon,
      rankName: currentRank.name,
      rankColor: currentRank.color, // 可以在页面上动态绑定文字颜色
      tempCount: count
    });
  },
  closeRank() {
    // 1. 先关闭排行榜
    this.setData({ showRankModal: false });
  
    // 2. 核心判断：
    // 如果当前是挑战结束状态（showResult 之前被 switchToRank 关掉的），就把它重新打开
    // 如果 needNickName 还是 true，说明用户还没存名字呢，得让他看结算页去点“记录大名”
    if (this.data.pieceCount < 37) { // 只要不是初始状态
      this.setData({
        showResult: true 
      });
    }
  },
  // 修改触发烟花的方法
  triggerCelebration() {
    const query = wx.createSelectorQuery();
    query.select('#confettiCanvas')
      .node()
      .exec((res) => {
        if (!res || !res[0]) return;
  
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const systemInfo = wx.getSystemInfoSync();
        const dpr = systemInfo.pixelRatio;
  
        canvas.width = systemInfo.windowWidth * dpr;
        canvas.height = systemInfo.windowHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
  
        const particles = [];
        const colors = ['#ff4d4f', '#ffec3d', '#73d13d', '#40a9ff', '#9254de', '#ffffff'];
  
        const createParticle = (x, y, angle) => {
          return {
            x: x,
            y: y,
            // 初始速度：让纸屑更有冲力
            v: Math.random() * 20 + 15, 
            angle: angle + (Math.random() - 0.5) * 1.0, 
            color: colors[Math.floor(Math.random() * colors.length)],
            // 形状大小多样化
            r: Math.random() * 4 + 2, 
            // 增加旋转角度，模拟纸片翻转
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            alpha: 1,
            gravity: 0.2, // 模拟重力
            friction: 0.95 // 模拟空气阻力
          };
        };
  
        let frameCount = 0;
        const render = () => {
          if (frameCount < 60) {
            for (let i = 0; i < 4; i++) {
              // 左边中点：x=0, y=屏幕高度一半。角度：向右上方喷 (-Math.PI / 6)
              particles.push(createParticle(0, systemInfo.windowHeight / 2, -Math.PI / 6));
              
              // 右边中点：x=宽度, y=屏幕高度一半。角度：向左上方喷 (-Math.PI * 5 / 6)
              particles.push(createParticle(systemInfo.windowWidth, systemInfo.windowHeight / 2, -Math.PI * 5 / 6));
            }
            frameCount++;
          }
  
          ctx.clearRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);
  
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += Math.cos(p.angle) * p.v;
            p.y += Math.sin(p.angle) * p.v + p.gravity;
            p.v *= p.friction;
            p.gravity += 0.08;
            p.alpha -= 0.015;
  
            if (p.alpha <= 0) {
              particles.splice(i, 1);
              continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            // 绘制长方形纸屑比圆形更真实
            ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 1.5); 
            ctx.restore();

            p.rotation += p.rotationSpeed; // 更新旋转
          }
  
          if (particles.length > 0) {
            canvas.requestAnimationFrame(render);
          } else {
            ctx.clearRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);
          }
        };
  
        render();
      });
  },

  switchToRank() {
    this.setData({ showResult: false, showRankModal: true });
    this.fetchRankList();
  },

  fetchRankList() {
    const db = wx.cloud.database();
    db.collection('rank-king').orderBy('count', 'asc').limit(10).get({
      success: res => this.setData({ rankList: res.data }),
      fail: err => console.error("获取排行失败", err)
    });
  },

  onNameConfirm(e) {
    const name = e.detail.value.nickname;
    if (!name || name.trim() === '') {
      wx.showToast({ title: '没有留下大名~', icon: 'none' });
      this.setData({ showNickNameModal: false, showResult: true }); // 退回结果页
      return;
    }

    wx.setStorageSync('user_nickname', name);
    this.setData({ defaultNickname: name, showNickNameModal: false, showResult: true });
    // 2. 延迟放烟花，确保 Canvas 节点此时是可见且可用的
    setTimeout(() => {
      this.triggerCelebration();
    }, 300);
    // 保存并刷新
    this.doSaveRecord(name, this.data.tempCount);
  },
// 1. 实时监听输入框（防止 type="nickname" 在 submit 时取不到值）
onInputNickname(e) {
  this.setData({
    defaultNickname: e.detail.value
  });
},

// 2. 确认保存按钮
saveNameAndScore() {
  const name = this.data.defaultNickname;
  if (!name || name.trim() === '') {
    wx.showToast({ title: '请输入名字', icon: 'none' });
    return;
  }
  wx.showLoading({ title: '核对名号中...' });
  const db = wx.cloud.database();
  
  // 查询数据库中是否已有该名字
  db.collection('rank-king').where({
    name: name
  }).get().then(res => {
    wx.hideLoading();
    
    if (res.data.length > 0) {
      // 关键判断：查到了这个名字，但 _openid 是不是我？
      // 注意：在小程序端直接读取的 res.data[0]._openid 
      // 只有在权限设置为“所有人可读，仅创建者可写”时才有效
      const record = res.data[0];
      
      // 如果云开发环境中没有开启“自动注入openid”，
      // 我们可以简单地认为：只要查到这个名字，且本地没存过，就是重名
      if (wx.getStorageSync('user_nickname') !== name) {
         wx.showModal({
           title: '名号被占领',
           content: '真不凑巧，江湖上已有同名大侠，换个响亮的名字吧！',
           showCancel: false
         });
         return; 
      }
    }
    
    // 校验通过，执行保存
    this.executeSave(name);
  });

  
},
executeSave(name) {
  wx.setStorageSync('user_nickname', name);
  
  // 关闭所有弹窗并进入排行榜
  this.setData({ 
    showNickNameModal: false,
    showResult: false ,
    needNickName: false, // 关键：标记已经记录过了
    showRankModal: true  // 记录完通常会自动展示排行榜
  });

  // 最终成功的烟花
  setTimeout(() => {
    this.triggerCelebration();
    // this.switchToRank(); 
  }, 300);

  this.doSaveRecord(name, this.data.tempCount);
  this.fetchRankList();
},

// 3. 修改 checkGameOver 里的触发逻辑
checkGameOver() {
  if (this.hasAvailableMoves()) return;

  const count = this.data.pieceCount;
  // 综合判断：本地缓存里没有，且云端也没查到过
  const savedName = wx.getStorageSync('user_nickname');
  const hasName = savedName || this.data.hasCloudName; 

  // const savedName = wx.getStorageSync('user_nickname');
  const lastBest = wx.getStorageSync('best_score') || 99;
  const isNewRecord = count < lastBest;
  const isQualified = count <= 10;

  // 更新本地最高分记录
  if (isNewRecord) {
    wx.setStorageSync('best_score', count);
  }

  // 判定是否需要后续起名（符合资格且没存过名字）
  const needNickName = isQualified && !hasName;

  // 1. 始终先显示结果弹窗
  this.showRank(count);

  // 2. 将起名状态存入 data，但不立刻显示起名弹窗
  this.setData({
    tempCount: count,
    needNickName: needNickName 
  });

  // 3. 如果已经有名字且破纪录，直接静默上传
  if (isQualified && isNewRecord && savedName) {
    this.doSaveRecord(savedName, count);
  }

  // 4. 表现好就放烟花
  if (count <= 10) {
    this.triggerCelebration();
  }
},
  closeNameModal() {
    this.setData({ showNickNameModal: false, showResult: true });
  },

  doSaveRecord(name, count) {
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '记录中...' });
    
    const db = wx.cloud.database();
    db.collection('rank-king').where({_openid: '{openid}' }).get().then(res => {
      if (res.data.length > 0) {
        const docId = res.data[0]._id;
        if (count < res.data[0].count) {
          return db.collection('rank-king').doc(docId).update({
            data: { name: name,count: count, createTime: db.serverDate() }
          });
        }
      } else {
        return db.collection('rank-king').add({
          data: { name, count, createTime: db.serverDate() }
        });
      }
    }).then(() => {
      this.afterSaveSuccess();
    }).catch(err => {
      console.error("保存失败", err);
    }).finally(() => {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
    });
  },

  afterSaveSuccess() {
    wx.showToast({ title: '金榜题名！' });
    this.fetchRankList();
  },

  undoMove() {
    // 1. 获取当前的历史记录数组
    const history = this.data.history;
    if (history.length === 0) return;
  
    // 2. 取出最近的一次记录
    const lastBoardState = history.pop();
    
    // 3. 关键点：判断撤销后是否回到了初始状态
    // 如果 pop 之后 history 空了，说明刚才撤销的是“移除第一颗棋”的操作
    const isBackToFirst = history.length === 0;
  
    // 4. 计算棋子数量
    // 如果回到了第一步，数量恢复到 37，否则就是当前数量 + 1
    const newPieceCount = isBackToFirst ? 37 : this.data.pieceCount + 1;
  
    this.setData({
      boardData: lastBoardState,
      pieceCount: newPieceCount,
      history: history, // 更新掉刚才 pop 后的数组
      selected: null,
      isFirst: isBackToFirst // 恢复第一步的状态标记
    });
  },

  closeModal() { 
    this.setData({ showModal: false }); 
    if(this.bgmAudio.paused) this.playRandomBGM(); 
  },

  resetGame() {
     // 重置时可以考虑切换下一首音乐
     this.playRandomBGM();
    this.initBoard();
    this.setData({
      showResult: false,
      showRankModal: false,
      showNickNameModal: false,
      selected: null,
      history: []
    });
  },

  startNewGame() {
    this.resetGame();
  },

  onUnload() {
    if (this.bgmAudio) this.bgmAudio.destroy();
    if (this.popPool) {
      this.popPool.forEach(audio => audio.destroy());
    }
    if (animationId) {
      // 如果使用了 canvas.requestAnimationFrame，需要根据对应平台处理停止
    }
  }
});