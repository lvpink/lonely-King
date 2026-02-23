// 1. 引入 RSA 核心库 (需确保文件路径正确)
const RSA = require('./wx_rsa.js'); 

// 2. 配置你的 RSA 公钥
// 🚩 注意：这个公钥必须和 Laf 云函数里私钥是配对的！
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApWA1r6eg6Lc910qKsjed
jjPqDstR8CueQFQxvkUfGFbi+Oq6b4bBS3q1tr70NN2YpEC2o/ldZU7ZR8BZC+2X
vLQTYj1phXrMulMC4bEVou/TLu8darPzFbNy/7zmPp+dZrAmJYlk5rHdT5Zz42sz
gSE1gbePCCpRfYPab2rvV6cpC/prrwzMWjqj9swI5gSxGzikf5iwBXyr8q0WU317
Rnpc0syrEk22lcbCIfIeFH30uYJbsyafvoyPoBX3QOzkCfzXP0SVKSlqYVI5hclR
k7biKgQO9pDri6hZSovr+V0h4ceq19UcHg8bZXnAVEYE/Bl6gLgQ22/peYL3eXFE
+wIDAQAB
-----END PUBLIC KEY-----`;

/**
 * 加密函数
 * @param {string} data 待加密的原始字符串 (code)
 * @returns {string} 加密后的 Base64 密文
 */
function encrypt(data) {
  const encryptor = new RSA.RSAKey();
  
  // 🚩 重点：直接传两个十六进制字符串
  const N = "a05859db77888474745785d41434a49562e021ae9c8d35066b5ac367d1db000365cbf05445ea391c793c829406ca475e640b3bd2f2ea634ccafbff7b7a7b94909daf5fa98802a320bcd5d00e1f7733101d08102009da494a51bac6436a149bd55873ffced3c131ddfcc35586c8aa9b1a54b32816202412dc979121604190983dc47c65b01015127cccb818c4897e8f7ec8b8d262e98cd849da121b46e7b38bb6b4fa46ac2fda5b78d0febc977386e41ba4d68b52b995e6bf821750f5c331cb7efe7de0cd6f0fd59064ced3fae8627e45afacd563a60880dd6bf91f46858839bb9557460f5d3203bde3d62148a054f25fc92dbbebd9d05961f676c2a508bc2f01";
  const E = "010001";
  
  encryptor.setPublic(N, E); 
  
  const encrypted = encryptor.encrypt(data);
  return encrypted;
}

// 3. 导出给 Page 使用
module.exports = {
  encrypt: encrypt
};