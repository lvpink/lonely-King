// 注意路径深度，根据你的文件实际位置调整
const { encrypt } = require('../../utils/encrypt.js');
// app.js 或在 Page 顶部定义
const LAF_URL = "https://rf3pmm2lnj.sealosbja.site"; // 替换为你在Laf后台看到的域名
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
    isCloudSyncing: true, // 标记云端数据是否同步完成
    hasCloudName: false, // 标记云端是否有名字
    needNickName: false,
    bgmList: ['/sounds/bgm1.mp3', '/sounds/bgm2.mp3'],
    defaultNickname: wx.getStorageSync('user_nickname') || ''
  },

  onLoad() {
    const testModule = require('../../utils/encrypt.js');
console.log('1. 工具包加载结果:', testModule);
console.log('2. encrypt函数是否存在:', typeof testModule.encrypt);

try {
  const result = testModule.encrypt("test");
  console.log('3. 加密测试成功:', result);
} catch (e) {
  console.error('4. 运行加密函数报错:', e);
}
    this.initAudio();
    this.initBoard();
    
    wx.showLoading({ title: '同步数据中...', mask: true });
    wx.login({
      success: (res) => {
        if (res.code) {
          // 这里的 encrypt 就不会报 ReferenceError 了
          const encryptedCode = encrypt(res.code);
          console.log("--- 密文长相 ---", encryptedCode);
          wx.request({
            url: `${LAF_URL}/get-openid`,
            method: 'POST',
            // 2. 🚩 修改这里：必须传加密后的变量，且字段名要跟云函数 ctx.body.code 对应
            // 如果你云函数写的是 const { code } = ctx.body，那就传 code: encryptedCode
            data: { code: encryptedCode }, 
            success: (lafRes) => {
              console.log("Laf 返回结果:", lafRes.data);
              
              if (lafRes.data && lafRes.data.openid) {
                const openid = lafRes.data.openid;
                wx.setStorageSync('user_openid', openid);
                this.setData({ user_openid: openid });
                this.checkUserCloudRecord();
                this.fetchRankList();
              } else {
                // 这里加个报错提示，方便你调试
                console.error("未能获取 OpenID:", lafRes.data.msg || "未知错误");
                this.setData({ isCloudSyncing: false });
                wx.hideLoading();
              }
            },
            fail: (err) => {
              console.error("网络请求失败:", err);
              this.setData({ isCloudSyncing: false });
              wx.hideLoading();
            }
          });
        }
      },
      fail: () => {
        this.setData({ isCloudSyncing: false });
        wx.hideLoading();
      }
    });
  },
// --- 1. 修改：检查云端记录 ---
checkUserCloudRecord() {
  const openid = this.data.user_openid || wx.getStorageSync('user_openid');
  if (!openid) {
    this.setData({ isCloudSyncing: false });
    return;
  }

  wx.request({
    url: `${LAF_URL}/get-user-score`,
    method: 'POST',
    data: { openid: openid },
    success: (res) => {
      if (res.data && res.data.data) {
        const record = res.data.data;
        wx.setStorageSync('user_nickname', record.name);
        wx.setStorageSync('best_score', record.count); 
        this.setData({ 
          defaultNickname: record.name,
          cloudBestScore: record.count, 
          hasCloudName: true
        });
      }
    },
    complete: () => {
      // 🚩 不管成功还是失败，只要请求结束，必须释放锁
      this.setData({ isCloudSyncing: false });
      wx.hideLoading();
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

// --- 4. 修改：拉取排行榜 ---
fetchRankList() {
  wx.request({
    url: `${LAF_URL}/get-rank`,
    method: 'GET',
    success: (res) => {
      if (res.data && res.data.data) {
        this.setData({ rankList: res.data.data });
      }
    }
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
// --- 2. 修改：重名校验逻辑 ---
saveNameAndScore() {
  const name = this.data.defaultNickname;
  // 关键：强制从本地缓存拿一次，防止 data 里的没同步成功
  const openid = this.data.user_openid || wx.getStorageSync('user_openid');
  
  console.log('--- 准备校验名字 ---');
  console.log('待查名字:', name);
  console.log('当前用户ID:', openid);

  if (!openid) {
    wx.showToast({ title: '账号同步中，请稍后再试', icon: 'none' });
    return;
  }
  
  if (!name || name.trim() === '') {
    wx.showToast({ title: '请输入名字', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '核对名号中...' });
  
  // 改为请求 Laf 校验名字
  wx.request({
    url: `${LAF_URL}/check-name`, // 需要在Laf建立此函数
    method: 'POST',
    data: { name: name, openid: openid },
    success: (res) => {
      wx.hideLoading();
      // 如果 code 为 1 表示名字被别人占用了
      if (res.data.code === 1) {
        wx.showModal({
          title: '名号被占领',
          content: '真不凑巧，江湖上已有同名大侠，换个响亮的名字吧！',
          showCancel: false
        });
      } else {
        this.executeSave(name);
      }
    },
    fail: () => {
      wx.hideLoading();
      this.executeSave(name); // 失败时保底允许保存
    }
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

  // 1. 异步锁：确保云端数据已读完
  if (this.data.isCloudSyncing) {
    this._syncRetry = (this._syncRetry || 0) + 1;
      if (this._syncRetry < 5) { // 最多等待 2.5 秒
    wx.showLoading({ title: '核对名号中...', mask: true });
    setTimeout(() => {
      wx.hideLoading();
      this.checkGameOver();
    }, 500);
    return;
  }else {
    console.warn("同步超时，强制进入结算");
    this.setData({ isCloudSyncing: false });
  }
}
  this._syncRetry = 0;
    wx.hideLoading();

  const count = this.data.pieceCount;
  const savedName = wx.getStorageSync('user_nickname');
  const hasName = !!(savedName || this.data.hasCloudName); 
  // --- 关键打印开始 ---
  console.log('===== 每局结算诊断报告 =====');
  console.log('1. 本局得分(count):', count);
  console.log('2. 本地缓存名字(savedName):', savedName);
  console.log('3. 云端同步标记(hasCloudName):', this.data.hasCloudName);
  console.log('4. 综合判定是否有名(hasName):', hasName);
  
  // --- 关键打印结束 ---
  // 2. 判定是否需要“记录大名”弹窗
  // 条件：成绩合格(<=10) 且 全局都没名字
  const needNickName = (count <= 10) && !hasName;

  // 3. 判定是否需要“更新云端纪录”
  // 条件：有名字 且 成绩合格 且 真的打破了云端纪录（count越小越好）
  const cloudBest = this.data.cloudBestScore || 99;
  console.log('5. 云端历史纪录分数(cloudBest):', cloudBest);
  const breakCloudRecord = hasName && (count <= 10) && (count < cloudBest);

  // 更新本地显示的最高分（用于UI显示）
  const lastBest = wx.getStorageSync('best_score') || 99;
  if (count < lastBest) {
    wx.setStorageSync('best_score', count);
  }
  console.log('6. 最终判定 - 是否需要弹窗起名(needNickName):', needNickName);
  console.log('7. 最终判定 - 是否打破云端纪录:', (hasName && count < cloudBest));
  console.log('============================');
  this.showRank(count); // 显示结算内容

  this.setData({
    tempCount: count,
    needNickName: needNickName 
  });

  // 4. 如果是老玩家打破了云端纪录，直接静默上传，不弹窗
  if (breakCloudRecord) {
    console.log('【动作】检测到破纪录，正在静默更新云端...');
    const finalName = savedName || this.data.defaultNickname;
    this.doSaveRecord(finalName, count, true); 
    // 更新本地记录的云端分数，防止同一次运行重复上传
    this.setData({ cloudBestScore: count }); 
  }

  if (count <= 10) this.triggerCelebration();
},
  closeNameModal() {
    this.setData({ showNickNameModal: false, showResult: true });
  },

  // --- 3. 修改：保存成绩逻辑（含进步判定） ---
  doSaveRecord(name, count, isSilent = false) {
    if (this.isSubmitting) return;
    
    // 逻辑判定：只有进步才更新
    const cloudBest = this.data.cloudBestScore || 99;
    if (this.data.hasCloudName && count >= cloudBest) {
      console.log('【拦截】未超越历史纪录');
      return;
    }

    this.isSubmitting = true; 
    if (!isSilent) wx.showLoading({ title: '记录中...' });
    
    const openid = this.data.user_openid || wx.getStorageSync('user_openid');

    wx.request({
      url: `${LAF_URL}/save-score`,
      method: 'POST',
      data: { name, count, openid },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({ cloudBestScore: count, hasCloudName: true });
          this.afterSaveSuccess(isSilent);
        }
      },
      finally: () => {
        if (!isSilent) wx.hideLoading();
        this.isSubmitting = false;
      }
    });
  },

  afterSaveSuccess(isSilent) {
    wx.showToast({ 
      title: isSilent ? '纪录已更新！' : '金榜题名！',
      icon: 'success'
    });
    this.fetchRankList(); // 统一负责刷新
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