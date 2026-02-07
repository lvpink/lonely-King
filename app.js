// app.js
App({
  onLaunch: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-1gj4tfezbe1e39e0', 
        // 在云开发控制台概览页查看，形如：my-env-xxxx
        traceUser: true,
      });
    }
  }
})