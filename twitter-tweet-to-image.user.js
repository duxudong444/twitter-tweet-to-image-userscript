// ==UserScript==
// @name         Twitter/X 推文转图片
// @namespace    tw2img
// @version      1.0.0
// @description  将 Twitter/X 推文生成分享图片，支持下载 PNG 和复制到剪贴板
// @author       tw2img
// @license      MIT
// @homepageURL  https://github.com/duxudong444/twitter-tweet-to-image-userscript
// @supportURL   https://github.com/duxudong444/twitter-tweet-to-image-userscript/issues
// @match        https://x.com/*
// @match        https://twitter.com/*
// @require      https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js
// @grant        GM_xmlhttpRequest
// @connect      pbs.twimg.com
// @connect      abs.twimg.com
// @connect      ton.twitter.com
// @connect      video.twimg.com
// @connect      x.com
// @connect      twitter.com
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 常量 ====================

  var INJECTED_ATTR = 'data-tw2img-injected';

  // 适配 @grant none (页面上下文) 与 @grant GM_xmlhttpRequest (沙箱) 两种环境
  function getHtmlToImage() {
    // 沙箱模式下 @require 的库挂在全局变量 htmlToImage
    if (typeof htmlToImage !== 'undefined' && htmlToImage && htmlToImage.toBlob) {
      return htmlToImage;
    }
    // 页面上下文模式下库挂在 window.htmlToImage
    if (typeof window.htmlToImage !== 'undefined' && window.htmlToImage && window.htmlToImage.toBlob) {
      return window.htmlToImage;
    }
    return null;
  }
  var CARD_WIDTH = 600;

  // 图片加载失败时的占位图：1x1 透明 PNG
  var PLACEHOLDER_IMAGE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  // ==================== SVG 图标 ====================

  var ICON_REPLY =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#536471"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.21-.876 4.22-2.305 5.682l-1.241 1.24-4.89 4.89c-.28.28-.72.16-.78-.22l-.6-4.53c-3.83-.65-6.68-3.86-6.68-7.69z"/></svg>';
  var ICON_RETWEET =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#536471"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>';
  var ICON_LIKE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#536471"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.479-4.82-.561-1.13-1.667-1.84-2.91-1.91zM12 20.28l-.41-.26C7.693 17.26 5.154 14.6 3.846 12.2 2.508 9.75 2.584 7.47 3.6 5.4c.99-2.02 3.05-3.17 5.4-2.9 1.63.19 3.06 1.08 3.92 2.44l.01.01.01-.01c.86-1.36 2.29-2.25 3.92-2.44 2.35-.27 4.41.88 5.4 2.9 1.016 2.07 1.092 4.35-.246 6.8-1.308 2.4-3.847 5.06-7.754 7.82l-.41.26z"/></svg>';
  var ICON_VIEWS =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#536471"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>';
  var ICON_X_LOGO =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#1d9bf0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var ICON_IMAGE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

  // ==================== CSS 样式 ====================

  function injectStyles() {
    var s = document.createElement('style');
    s.id = 'tw2img-styles';
    s.textContent =
      '' +
      /* 推文上的按钮 */
      '.tw2img-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid #cfd9de;border-radius:16px;background:#fff;color:#536471;cursor:pointer;font-size:13px;font-family:TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;white-space:nowrap;transition:background .15s;margin-left:auto;flex-shrink:0}' +
      '.tw2img-btn:hover{background:#f7f9f9;color:#1d9bf0}' +
      '.tw2img-btn svg{flex-shrink:0}' +
      /* 弹窗遮罩 */
      '.tw2img-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;animation:tw2img-fadein .15s}' +
      /* 弹窗主体 */
      '.tw2img-dialog{background:#fff;border-radius:16px;padding:20px 20px 16px;max-width:95vw;max-height:95vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;min-width:360px}' +
      /* 弹窗头部 */
      '.tw2img-dialog-header{display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:16px;flex-shrink:0}' +
      '.tw2img-dialog-title{font-size:17px;font-weight:700;color:#0f1419;font-family:TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
      '.tw2img-dialog-close{background:none;border:none;font-size:22px;cursor:pointer;color:#536471;padding:4px 10px;border-radius:50%;line-height:1;transition:background .15s}' +
      '.tw2img-dialog-close:hover{background:#f7f9f9}' +
      /* 预览区域 */
      '.tw2img-preview-wrap{overflow:auto;max-height:70vh;width:100%;display:flex;justify-content:center;flex-shrink:1}' +
      /* 错误提示 */
      '.tw2img-error{display:none;color:#f4212e;font-size:13px;text-align:center;padding:8px 0;width:100%;flex-shrink:0}' +
      /* 操作按钮区 */
      '.tw2img-dialog-actions{display:flex;gap:10px;margin-top:14px;flex-shrink:0;flex-wrap:wrap;justify-content:center}' +
      '.tw2img-dialog-actions button{padding:8px 20px;border-radius:20px;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s,opacity .15s}' +
      '.tw2img-btn-download{background:#1d9bf0;color:#fff}' +
      '.tw2img-btn-download:hover{background:#1a8cd8}' +
      '.tw2img-btn-download:disabled{background:#8ec5f2;cursor:not-allowed}' +
      '.tw2img-btn-copy{background:#fff;color:#1d9bf0;border:1px solid #1d9bf0!important}' +
      '.tw2img-btn-copy:hover{background:#e8f5fd}' +
      '.tw2img-btn-copy:disabled{opacity:.5;cursor:not-allowed}' +
      '.tw2img-btn-cancel{background:#f7f9f9;color:#536471}' +
      '.tw2img-btn-cancel:hover{background:#eff3f4}' +
      /* 分享卡片 */
      '.tw2img-card{width:' +
      CARD_WIDTH +
      'px;background:#fff;border:1px solid #cfd9de;border-radius:16px;padding:16px;font-family:TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f1419;box-sizing:border-box;font-size:15px;line-height:1.5}' +
      '.tw2img-card *{box-sizing:border-box}' +
      /* 卡片头部 */
      '.tw2img-card-header{display:flex;align-items:center;gap:10px;margin-bottom:4px}' +
      '.tw2img-card-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#cfd9de;flex-shrink:0}' +
      '.tw2img-card-author-info{min-width:0}' +
      '.tw2img-card-name{font-size:15px;font-weight:700;color:#0f1419;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.tw2img-card-handle{font-size:13px;color:#536471;line-height:1.2}' +
      /* 时间 */
      '.tw2img-card-time{font-size:13px;color:#536471;margin-left:58px;margin-bottom:8px}' +
      /* 正文 */
      '.tw2img-card-body{font-size:15px;line-height:1.5;margin-bottom:12px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word}' +
      /* 图片网格 */
      '.tw2img-card-images{display:grid;gap:4px;margin-bottom:12px;overflow:hidden;border-radius:16px}' +
      '.tw2img-card-images.cols1{grid-template-columns:1fr}' +
      '.tw2img-card-images.cols1 .tw2img-card-image{max-height:900px}' +
      '.tw2img-card-images.cols2{grid-template-columns:1fr 1fr}' +
      '.tw2img-card-images.cols3{grid-template-columns:1fr 1fr 1fr}' +
      '.tw2img-card-images.cols4{grid-template-columns:1fr 1fr}' +
      '.tw2img-card-images.cols2,.tw2img-card-images.cols3,.tw2img-card-images.cols4{align-items:start}' +
      '.tw2img-card-image{width:100%;height:auto;max-height:900px;object-fit:contain;background:#f7f9f9;display:block}' +
      /* 视频封面 + 播放按钮 */
      '.tw2img-card-video{position:relative;overflow:hidden;border-radius:16px;margin-bottom:12px}' +
      '.tw2img-card-video .tw2img-card-image{width:100%;aspect-ratio:auto;max-height:900px;object-fit:contain;display:block;border-radius:16px}' +
      '.tw2img-card-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(15,20,25,.75);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1}' +
      /* 引用推文 */
      '.tw2img-card-quote{border:1px solid #cfd9de;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:1.4}' +
      '.tw2img-card-quote-name{font-weight:700;color:#0f1419}' +
      '.tw2img-card-quote-handle{color:#536471;margin-left:4px}' +
      '.tw2img-card-quote-text{color:#536471;margin-top:4px;white-space:pre-wrap;word-wrap:break-word}' +
      '.tw2img-card-quote-avatar{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#cfd9de}' +
      /* 卡片底部 */
      '.tw2img-card-footer{border-top:1px solid #eff3f4;padding-top:12px;display:flex;flex-direction:column;gap:8px}' +
      '.tw2img-card-stats{display:flex;gap:20px;font-size:13px;color:#536471;flex-wrap:wrap}' +
      '.tw2img-card-stat{display:flex;align-items:center;gap:4px}' +
      '.tw2img-card-logo{display:flex;justify-content:space-between;align-items:center}' +
      '.tw2img-card-link{font-size:12px;color:#1d9bf0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%}' +
      /* Toast 提示 */
      '.tw2img-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f1419;color:#fff;padding:10px 24px;border-radius:20px;font-size:14px;z-index:100001;white-space:nowrap;font-family:TwitterChirp,-apple-system,sans-serif}' +
      '@keyframes tw2img-fadein{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(s);
  }

  // ==================== 工具函数 ====================

  function showToast(msg) {
    var el = document.createElement('div');
    el.className = 'tw2img-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2500);
  }

  function safeText(el) {
    return el ? (el.textContent || '').trim() : '';
  }

  function parseCount(text) {
    if (!text) return null;
    // 匹配数字，支持 , 分隔符和 K/M 后缀
    var match = text.match(/([\d,.]+)\s*([KkMm]?)/);
    if (!match) return null;
    var num = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(num)) return null;
    var suffix = match[2].toLowerCase();
    if (suffix === 'k') num *= 1000;
    if (suffix === 'm') num *= 1000000;
    return Math.round(num);
  }

  function formatCount(num) {
    if (num === null || num === undefined) return '';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString('en-US');
  }

  function upgradeImageUrl(url) {
    if (!url) return url;
    // 已有 name 参数：替换为 large
    if (/[?&]name=/.test(url)) return url.replace(/([?&])name=[^&]+/g, '$1name=large');
    // pbs.twimg.com 媒体图无 name 参数：追加
    if (url.indexOf('pbs.twimg.com/media') !== -1 || url.indexOf('pbs.twimg.com/profile') !== -1) {
      return url + (url.indexOf('?') === -1 ? '?format=jpg&name=large' : '&name=large');
    }
    return url;
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80);
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var y = d.getFullYear();
      var mo = ('0' + (d.getMonth() + 1)).slice(-2);
      var da = ('0' + d.getDate()).slice(-2);
      var h = ('0' + d.getHours()).slice(-2);
      var mi = ('0' + d.getMinutes()).slice(-2);
      return y + '-' + mo + '-' + da + ' ' + h + ':' + mi;
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==================== 数据提取 ====================

  function extractNameHandleFromUserName(userNameEl) {
    var result = { name: '', handle: '' };
    if (!userNameEl) return result;

    var spans = userNameEl.querySelectorAll('span');
    // 第一遍：找 handle（@ 开头）
    for (var i = 0; i < spans.length; i++) {
      var t = (spans[i].textContent || '').trim();
      if (t && t.indexOf('@') === 0 && !result.handle) {
        result.handle = t;
      }
    }
    // 第二遍：找 display name（非 @ 开头，非时间/分隔符/短词）
    for (var j = 0; j < spans.length; j++) {
      var s = (spans[j].textContent || '').trim();
      if (
        s &&
        s.indexOf('@') !== 0 &&
        !/^\d+[smhd]?$/i.test(s) &&
        s !== '·' &&
        s.length > 1
      ) {
        result.name = s;
        // 如果文字里混了 Verified 等后缀，尽量取第一段非 @ 文本
        break;
      }
    }

    // 兜底：如果仍没有 name 但有 handle，用去掉 @ 的 handle
    if (!result.name && result.handle) {
      result.name = result.handle.replace(/^@/, '');
    }

    // 兜底：从 a 链接文本取
    if (!result.name) {
      var links = userNameEl.querySelectorAll('a');
      if (links.length > 0) {
        var linkText = links[0].textContent.trim();
        if (linkText && linkText.indexOf('@') !== 0) {
          result.name = linkText;
        }
      }
    }

    return result;
  }

  function collectVideoCoverUrls(root, filterFn) {
    var urls = [];
    var seen = {};
    function add(url) {
      if (!url) return;
      var u = upgradeImageUrl(url);
      if (!seen[u]) { seen[u] = true; urls.push(u); }
    }

    // 1. video[poster]
    var videos = root.querySelectorAll('video[poster]');
    for (var v = 0; v < videos.length && urls.length < 4; v++) {
      if (!filterFn(videos[v])) continue;
      add(videos[v].getAttribute('poster') || '');
    }
    // 2. videoPlayer 内的 img
    var players = root.querySelectorAll('[data-testid="videoPlayer"] img');
    for (var p = 0; p < players.length && urls.length < 4; p++) {
      if (!filterFn(players[p])) continue;
      add(players[p].getAttribute('src') || '');
    }
    // 3. 视频缩略图
    var thumbs = root.querySelectorAll('img[src*="ext_tw_video_thumb"], img[src*="amplify_video_thumb"]');
    for (var t = 0; t < thumbs.length && urls.length < 4; t++) {
      if (!filterFn(thumbs[t])) continue;
      add(thumbs[t].getAttribute('src') || '');
    }
    return urls;
  }

  function extractTweetData(article) {
    var data = {
      author: { name: '', handle: '', avatarUrl: null },
      text: '',
      images: [],
      videoCoverUrl: '',
      media: [],
      createdAt: '',
      stats: { replies: null, reposts: null, likes: null, views: null },
      tweetUrl: '',
      quotedTweet: null,
    };

    // --- 作者信息 ---
    var userNameEl = article.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      var identity = extractNameHandleFromUserName(userNameEl);
      data.author.name = identity.name;
      data.author.handle = identity.handle;
      // 兜底：从链接 href 提取 handle
      if (!data.author.handle) {
        var firstLink = userNameEl.querySelector('a[role="link"]');
        if (firstLink) {
          var href = firstLink.getAttribute('href') || '';
          var hm = href.match(/^\/(\w+)/);
          if (hm) data.author.handle = '@' + hm[1];
        }
      }
    }

    // --- 头像 ---
    var avatarImg =
      article.querySelector('[data-testid="Tweet-User-Avatar"] img') ||
      article.querySelector('img[src*="pbs.twimg.com/profile_images"]');
    if (avatarImg) {
      var avSrc = avatarImg.getAttribute('src') || '';
      // 使用 normal 尺寸（200x200）
      data.author.avatarUrl = avSrc.replace(/([?&])name=\w+/g, '$1name=200x200');
    }

    // --- 正文 ---
    var textEl = article.querySelector('[data-testid="tweetText"]');
    if (textEl) {
      data.text = textEl.textContent.trim();
    }

    // --- 时间和链接 ---
    var timeEl = article.querySelector('time');
    if (timeEl) {
      data.createdAt = timeEl.getAttribute('datetime') || '';
      var timeLink = timeEl.closest('a');
      if (timeLink) {
        var tUrl = timeLink.getAttribute('href') || '';
        if (tUrl && tUrl.indexOf('http') !== 0) {
          tUrl = 'https://x.com' + tUrl;
        }
        data.tweetUrl = tUrl;
      }
    }

    // --- 图片 ---
    // 先定位引用卡片容器，后续媒体归属判断时排除它们
    function findQuoteContainers(article) {
      var containers = [];
      var mainUserName = article.querySelector('[data-testid="User-Name"]');
      var allUserNames = article.querySelectorAll('[data-testid="User-Name"]');
      for (var i = 0; i < allUserNames.length; i++) {
        var el = allUserNames[i];
        if (el === mainUserName) continue;
        var c = el.closest('[role="link"]');
        if (!c) {
          var p = el.parentElement;
          for (var up = 0; up < 6 && p && p !== article; up++ , p = p.parentElement) {
            if (p.querySelector('[data-testid="tweetText"]')) {
              c = p;
              break;
            }
          }
        }
        if (c && containers.indexOf(c) === -1) containers.push(c);
      }
      return containers;
    }

    var quoteContainers = findQuoteContainers(article);

    function isOwnMediaNode(node) {
      // 属于引用卡片容器的一律排除
      for (var q = 0; q < quoteContainers.length; q++) {
        if (quoteContainers[q].contains(node)) return false;
      }
      // 属于嵌套 article 的也排除
      var nestedArticle = node.closest('article[data-testid="tweet"]');
      return nestedArticle === article || nestedArticle === null;
    }

    // isOwnImage 别名，保持引用兼容
    function isOwnImage(img) { return isOwnMediaNode(img); }

    var allPhotoImgs = article.querySelectorAll('[data-testid="tweetPhoto"] img');
    var seen = {};
    for (var pi = 0; pi < allPhotoImgs.length && data.images.length < 4; pi++) {
      if (!isOwnImage(allPhotoImgs[pi])) continue;
      var src = allPhotoImgs[pi].getAttribute('src') || allPhotoImgs[pi].getAttribute('data-src') || '';
      if (src && src.indexOf('pbs.twimg.com/media') !== -1) {
        var upgraded = upgradeImageUrl(src);
        if (!seen[upgraded]) {
          seen[upgraded] = true;
          data.images.push(upgraded);
        }
      }
    }
    // 兜底：查找所有媒体图片
    if (data.images.length === 0) {
      var allMediaImgs = article.querySelectorAll('img[src*="pbs.twimg.com/media"]');
      for (var ai = 0; ai < allMediaImgs.length && data.images.length < 4; ai++) {
        if (!isOwnImage(allMediaImgs[ai])) continue;
        var asrc = allMediaImgs[ai].getAttribute('src') || '';
        if (!asrc) continue;
        var upgraded2 = upgradeImageUrl(asrc);
        if (!seen[upgraded2]) {
          seen[upgraded2] = true;
          data.images.push(upgraded2);
        }
      }
    }

    // --- 视频封面（排除引用推文，支持多个视频） ---
    var videoCoverUrls = collectVideoCoverUrls(article, isOwnImage);
    data.videoCoverUrl = videoCoverUrls[0] || '';

    // --- 统一媒体数组（图片优先，视频封面接后，最多 4 项） ---
    for (var mi = 0; mi < data.images.length && data.media.length < 4; mi++) {
      data.media.push({ type: 'image', url: data.images[mi] });
    }
    for (var mj = 0; mj < videoCoverUrls.length && data.media.length < 4; mj++) {
      data.media.push({ type: 'video', url: videoCoverUrls[mj] });
    }

    // --- 统计数据 ---
    function findStat(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = article.querySelector(selectors[i]);
        if (el) {
          var label = el.getAttribute('aria-label') || el.textContent || '';
          return parseCount(label);
        }
      }
      return null;
    }

    data.stats.replies = findStat([
      'button[data-testid="reply"]',
      '[role="button"][aria-label*="repl" i]',
    ]);
    data.stats.reposts = findStat([
      'button[data-testid="retweet"]',
      'button[data-testid="unretweet"]',
      '[role="button"][aria-label*="repost" i]',
      '[role="button"][aria-label*="retweet" i]',
    ]);
    data.stats.likes = findStat([
      'button[data-testid="like"]',
      'button[data-testid="unlike"]',
      '[role="button"][aria-label*="Like" i]',
      '[role="button"][aria-label*="like" i]',
    ]);

    // 浏览量：搜索所有 aria-label 含 "view" 的元素
    var allLabelEls = article.querySelectorAll('[aria-label]');
    for (var li = 0; li < allLabelEls.length; li++) {
      var label = allLabelEls[li].getAttribute('aria-label') || '';
      if (/view/i.test(label) && !/reply|repost|retweet|like/i.test(label)) {
        var vc = parseCount(label);
        if (vc !== null) {
          data.stats.views = vc;
          break;
        }
      }
    }

    // --- 引用推文 ---
    // 优先：嵌套的 article[data-testid="tweet"]
    var nestedArticles = article.querySelectorAll('article[data-testid="tweet"]');
    if (nestedArticles.length > 0) {
      var qData = extractTweetDataBasic(nestedArticles[0]);
      if (qData.author.name || qData.text) {
        data.quotedTweet = qData;
      }
    }

    // 兜底：X/Twitter 的引用卡片常常不是 article，而是 div[role="link"] 等容器
    // 查找第二个 [data-testid="User-Name"]（主推文作者是第一个）
    if (!data.quotedTweet) {
      var allUserNames = article.querySelectorAll('[data-testid="User-Name"]');
      if (allUserNames.length > 1) {
        for (var ui = 1; ui < allUserNames.length; ui++) {
          var quoteUserName = allUserNames[ui];
          // 排除已属于嵌套 article 的情况（上面已处理）
          if (quoteUserName.closest('article[data-testid="tweet"]') === nestedArticles[0]) continue;

          // 找引用卡片容器：向上找 role="link" 或带 border 的 div
          var container = quoteUserName.closest('[role="link"]');
          if (!container) {
            var p = quoteUserName.parentElement;
            for (var up = 0; up < 6 && p && p !== article; up++ , p = p.parentElement) {
              if (p.children.length > 1 && p !== article) {
                container = p;
                break;
              }
            }
          }
          if (!container) continue;

          var qData = {
            author: { name: '', handle: '', avatarUrl: null },
            text: '',
            images: [],
            media: [],
            tweetUrl: '',
          };

          // 引用推文作者头像
          var qAvatar = container.querySelector('img[src*="pbs.twimg.com/profile"]');
          if (qAvatar) {
            var qAvSrc = qAvatar.getAttribute('src') || '';
            qData.author.avatarUrl = qAvSrc.replace(/([?&])name=\w+/g, '$1name=200x200');
          }

          var qLinks = container.querySelectorAll('a');
          var qLinkHref = qLinks.length > 0 ? (qLinks[0].getAttribute('href') || '') : '';
          var qHm = qLinkHref.match(/^\/(\w+)/);

          // 用 extractNameHandleFromUserName 从 quoteUserName 提取
          var qIdentity = extractNameHandleFromUserName(quoteUserName);
          qData.author.name = qIdentity.name;
          qData.author.handle = qIdentity.handle || (qHm ? '@' + qHm[1] : '');

          var qText = container.querySelector('[data-testid="tweetText"]');
          if (qText) qData.text = qText.textContent.trim();

          // 引用推文媒体：视频优先，防止视频封面 URL 被 image 抢占
          var qSeen = {};

          var qVC = collectVideoCoverUrls(container, function () { return true; });
          for (var qv = 0; qv < qVC.length && qData.media.length < 4; qv++) {
            if (!qSeen[qVC[qv]]) {
              qSeen[qVC[qv]] = true;
              qData.media.push({ type: 'video', url: qVC[qv] });
            }
          }

          var qMediaImgs = container.querySelectorAll('img[src*="pbs.twimg.com/media"]');
          for (var qm = 0; qm < qMediaImgs.length && qData.media.length < 4; qm++) {
            var qmSrc = qMediaImgs[qm].getAttribute('src') || '';
            if (!qmSrc) continue;
            var qmUpgraded = upgradeImageUrl(qmSrc);
            if (!qSeen[qmUpgraded]) {
              qSeen[qmUpgraded] = true;
              qData.images.push(qmUpgraded);
              qData.media.push({ type: 'image', url: qmUpgraded });
            }
          }

          if (qData.author.name || qData.text) {
            data.quotedTweet = qData;
            break;
          }
        }
      }
    }

    return data;
  }

  function extractTweetDataBasic(article) {
    var data = {
      author: { name: '', handle: '', avatarUrl: null },
      text: '',
      images: [],
      videoCoverUrl: '',
      media: [],
      createdAt: '',
      stats: { replies: null, reposts: null, likes: null, views: null },
      tweetUrl: '',
      quotedTweet: null,
    };

    var userNameEl = article.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      var identity = extractNameHandleFromUserName(userNameEl);
      data.author.name = identity.name;
      data.author.handle = identity.handle;
    }

    // 头像
    var qAv =
      article.querySelector('img[src*="pbs.twimg.com/profile"]') ||
      article.querySelector('[data-testid="Tweet-User-Avatar"] img');
    if (qAv) {
      var qAvSrc = qAv.getAttribute('src') || '';
      data.author.avatarUrl = qAvSrc.replace(/([?&])name=\w+/g, '$1name=200x200');
    }

    var textEl = article.querySelector('[data-testid="tweetText"]');
    if (textEl) data.text = textEl.textContent.trim();

    // 媒体：视频优先，防止封面 URL 被 image 抢占
    var qSeen = {};

    var qVC = collectVideoCoverUrls(article, function () { return true; });
    for (var qvi = 0; qvi < qVC.length && data.media.length < 4; qvi++) {
      if (!qSeen[qVC[qvi]]) {
        qSeen[qVC[qvi]] = true;
        data.media.push({ type: 'video', url: qVC[qvi] });
      }
    }

    var qImgs = article.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    for (var qi = 0; qi < qImgs.length && data.images.length < 4; qi++) {
      var qiSrc = qImgs[qi].getAttribute('src') || '';
      if (qiSrc) {
        var qiUp = upgradeImageUrl(qiSrc);
        if (!qSeen[qiUp]) {
          qSeen[qiUp] = true;
          data.images.push(qiUp);
          data.media.push({ type: 'image', url: qiUp });
        }
      }
    }

    var timeEl = article.querySelector('time');
    if (timeEl) {
      data.createdAt = timeEl.getAttribute('datetime') || '';
      var timeLink = timeEl.closest('a');
      if (timeLink) {
        var tUrl = timeLink.getAttribute('href') || '';
        if (tUrl && tUrl.indexOf('http') !== 0) tUrl = 'https://x.com' + tUrl;
        data.tweetUrl = tUrl;
      }
    }

    return data;
  }

  // ==================== 图片预取（GM_xmlhttpRequest → data: URL） ====================

  function fetchImageAsDataUrl(url) {
    return new Promise(function (resolve) {
      if (!url || url.indexOf('data:') === 0) {
        resolve(url || '');
        return;
      }

      if (typeof GM_xmlhttpRequest !== 'function') {
        resolve(url);
        return;
      }

      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        responseType: 'blob',
        timeout: 10000,
      onload: function (res) {
        if (res.status < 200 || res.status >= 300 || !res.response) {
          console.warn('[tw2img] 图片请求失败 HTTP ' + res.status, url);
          resolve('');
          return;
        }
        var blob = res.response;
        if (!blob) { resolve(''); return; }
        var reader = new FileReader();
        reader.onloadend = function () {
          resolve(reader.result || '');
        };
        reader.onerror = function () {
          console.warn('[tw2img] FileReader 读取失败', url);
          resolve('');
        };
        reader.readAsDataURL(blob);
      },
      onerror: function (err) {
        console.warn('[tw2img] 图片请求错误', url, err);
        resolve('');
      },
      ontimeout: function () {
        console.warn('[tw2img] 图片请求超时', url);
        resolve('');
      },
      });
    });
  }

  function prepareTweetDataForRender(data) {
    var tasks = [];

    // 头像
    tasks.push(
      fetchImageAsDataUrl(data.author.avatarUrl).then(function (dataUrl) {
        if (dataUrl) data.author.avatarUrl = dataUrl;
      })
    );

    // 推文图片：保留原始 URL 作为兜底
    tasks.push(
      Promise.all(
        data.images.map(function (url) {
          return fetchImageAsDataUrl(url);
        })
      ).then(function (dataUrls) {
        data.images = data.images.map(function (url, index) {
          return dataUrls[index] || url;
        });
      })
    );

    // 视频封面
    if (data.videoCoverUrl) {
      tasks.push(
        fetchImageAsDataUrl(data.videoCoverUrl).then(function (dataUrl) {
          if (dataUrl) data.videoCoverUrl = dataUrl;
        })
      );
    }

    // 统一媒体数组：预取每个 url
    if (data.media && data.media.length > 0) {
      tasks.push(
        Promise.all(
          data.media.map(function (item) { return fetchImageAsDataUrl(item.url); })
        ).then(function (dataUrls) {
          for (var m = 0; m < data.media.length; m++) {
            if (dataUrls[m]) data.media[m].url = dataUrls[m];
          }
        })
      );
    }

    // 引用推文：预取头像和媒体
    if (data.quotedTweet) {
      var q = data.quotedTweet;
      if (q.author.avatarUrl) {
        tasks.push(
          fetchImageAsDataUrl(q.author.avatarUrl).then(function (dataUrl) {
            if (dataUrl) q.author.avatarUrl = dataUrl;
          })
        );
      }
      if (q.media && q.media.length > 0) {
        tasks.push(
          Promise.all(
            q.media.map(function (item) { return fetchImageAsDataUrl(item.url); })
          ).then(function (dataUrls) {
            for (var qm = 0; qm < q.media.length; qm++) {
              if (dataUrls[qm]) q.media[qm].url = dataUrls[qm];
            }
          })
        );
      }
      if (q.images && q.images.length > 0) {
        tasks.push(
          Promise.all(
            q.images.map(function (url) { return fetchImageAsDataUrl(url); })
          ).then(function (dataUrls) {
            q.images = q.images.map(function (url, index) {
              return dataUrls[index] || url;
            });
          })
        );
      }
    }

    return Promise.all(tasks).then(function () {
      return data;
    });
  }

  // ==================== 分享卡片 DOM 构建 ====================

  function renderMediaItem(item, isOnly) {
    var url = escapeAttr(item.url);
    if (item.type === 'video') {
      // 视频封面：大图 + 播放按钮
      return (
        '<div class="tw2img-card-video">' +
        '<img class="tw2img-card-image" src="' + url + '" alt="" crossorigin="anonymous" />' +
        '<div class="tw2img-card-play">&#9654;</div>' +
        '</div>'
      );
    }
    // 普通图片
    return '<img class="tw2img-card-image" src="' + url + '" alt="" crossorigin="anonymous" />';
  }

  function renderMediaItems(items) {
    var out = '';
    if (items.length === 0) return out;
    if (items.length === 1) {
      // 单项直接用 renderMediaItem
      out += renderMediaItem(items[0], true);
      return out;
    }

    // 多项网格
    var colsClass =
      items.length === 3 ? 'cols3' : items.length === 2 ? 'cols2' : 'cols4';
    out += '<div class="tw2img-card-images ' + colsClass + '">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var url = escapeAttr(item.url);
      if (item.type === 'video') {
        out += '<div class="tw2img-card-video">';
        out += '<img class="tw2img-card-image" src="' + url + '" alt="" crossorigin="anonymous" />';
        out += '<div class="tw2img-card-play">&#9654;</div>';
        out += '</div>';
      } else {
        out += '<img class="tw2img-card-image" src="' + url + '" alt="" crossorigin="anonymous" />';
      }
    }
    out += '</div>';
    return out;
  }

  function buildCardHTML(data) {
    var html = '';

    html += '<div class="tw2img-card">';

    // 头部：头像 + 名字 + handle
    html += '<div class="tw2img-card-header">';
    html +=
      '<img class="tw2img-card-avatar" src="' +
      escapeAttr(data.author.avatarUrl || PLACEHOLDER_IMAGE) +
      '" alt="" crossorigin="anonymous" />';
    html += '<div class="tw2img-card-author-info">';
    html += '<div class="tw2img-card-name">' + escapeHtml(data.author.name || 'Unknown') + '</div>';
    html += '<div class="tw2img-card-handle">' + escapeHtml(data.author.handle || '') + '</div>';
    html += '</div></div>';

    // 时间
    if (data.createdAt) {
      html += '<div class="tw2img-card-time">' + escapeHtml(formatTime(data.createdAt)) + '</div>';
    }

    // 正文
    if (data.text) {
      html += '<div class="tw2img-card-body">' + escapeHtml(data.text) + '</div>';
    }

    // 媒体区域：图片和视频封面
    var displayMedia = (data.media && data.media.length > 0)
      ? data.media.slice(0, 4)
      : data.images.map(function (url) { return { type: 'image', url: url }; });
    if (displayMedia.length === 0 && data.videoCoverUrl) {
      displayMedia = [{ type: 'video', url: data.videoCoverUrl }];
    }

    if (displayMedia.length > 0) {
      html += renderMediaItems(displayMedia);
    }

    // 引用推文
    if (data.quotedTweet) {
      var q = data.quotedTweet;
      html += '<div class="tw2img-card-quote">';
      // 引用推文头部：小头像 + 名字 + handle
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
      html +=
        '<img class="tw2img-card-quote-avatar" src="' +
        escapeAttr(q.author.avatarUrl || PLACEHOLDER_IMAGE) +
        '" alt="" crossorigin="anonymous" />';
      html += '<div>';
      html +=
        '<span class="tw2img-card-quote-name">' + escapeHtml(q.author.name || 'Unknown') + '</span>';
      html +=
        '<span class="tw2img-card-quote-handle">' + escapeHtml(q.author.handle || '') + '</span>';
      html += '</div></div>';
      if (q.text) {
        html +=
          '<div class="tw2img-card-quote-text">' +
          escapeHtml(q.text.substring(0, 200)) +
          '</div>';
      }
      // 引用推文媒体
      var qMedia = [];
      if (q.media && q.media.length > 0) {
        qMedia = q.media.slice(0, 4);
      } else if (q.images && q.images.length > 0) {
        qMedia = q.images.slice(0, 4).map(function (url) { return { type: 'image', url: url }; });
      }
      if (qMedia.length > 0) {
        html += renderMediaItems(qMedia);
      }
      html += '</div>';
    }

    // 底部：统计数据 + 链接 + Logo
    var hasStats =
      data.stats.replies !== null ||
      data.stats.reposts !== null ||
      data.stats.likes !== null ||
      data.stats.views !== null;
    if (hasStats || data.tweetUrl) {
      html += '<div class="tw2img-card-footer">';

      if (hasStats) {
        html += '<div class="tw2img-card-stats">';
        if (data.stats.replies !== null) {
          html +=
            '<span class="tw2img-card-stat">' +
            ICON_REPLY +
            ' <span>' +
            formatCount(data.stats.replies) +
            '</span></span>';
        }
        if (data.stats.reposts !== null) {
          html +=
            '<span class="tw2img-card-stat">' +
            ICON_RETWEET +
            ' <span>' +
            formatCount(data.stats.reposts) +
            '</span></span>';
        }
        if (data.stats.likes !== null) {
          html +=
            '<span class="tw2img-card-stat">' +
            ICON_LIKE +
            ' <span>' +
            formatCount(data.stats.likes) +
            '</span></span>';
        }
        if (data.stats.views !== null) {
          html +=
            '<span class="tw2img-card-stat">' +
            ICON_VIEWS +
            ' <span>' +
            formatCount(data.stats.views) +
            '</span></span>';
        }
        html += '</div>';
      }

      html += '<div class="tw2img-card-logo">';
      if (data.tweetUrl) {
        html +=
          '<span class="tw2img-card-link">' + escapeHtml(data.tweetUrl) + '</span>';
      }
      html += '<span>' + ICON_X_LOGO + '</span>';
      html += '</div>';

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ==================== 图片生成 ====================

  function waitForCardImages(cardEl) {
    var imgs = cardEl.querySelectorAll('img');
    var promises = [];
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        if (!img.src || img.src.indexOf('data:') === 0) return;
        if (img.complete && img.naturalWidth > 0) return;
        promises.push(
          new Promise(function (resolve) {
            var done = false;
            function finish() {
              if (!done) {
                done = true;
                resolve();
              }
            }
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
            setTimeout(finish, 8000);
          })
        );
      })(imgs[i]);
    }
    return Promise.all(promises);
  }

  function hideFailedImages(cardEl) {
    var imgs = cardEl.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].src || imgs[i].src.indexOf('data:') === 0) continue;
      if (!imgs[i].complete || imgs[i].naturalWidth === 0) {
        imgs[i].style.display = 'none';
      }
    }
  }

  function getCapturePixelRatio(cardEl) {
    var h = cardEl.scrollHeight || cardEl.offsetHeight || 0;
    if (h > 1200) return 1;
    return 1.5;
  }

  function toBlobOptions(cardEl) {
    var w = cardEl.scrollWidth || CARD_WIDTH;
    return {
      pixelRatio: getCapturePixelRatio(cardEl),
      cacheBust: true,
      imagePlaceholder: PLACEHOLDER_IMAGE,
      backgroundColor: '#fff',
      width: w,
      height: cardEl.scrollHeight || cardEl.offsetHeight || 0,
      style: { width: w + 'px', background: '#fff' },
      filter: function (node) {
        if (
          node.nodeType === 1 &&
          node.tagName === 'LINK' &&
          node.getAttribute('rel') === 'stylesheet'
        ) {
          return false;
        }
        return true;
      },
    };
  }

  function captureCardAsBlob(cardEl) {
    // 预览容器可能有 max-height / overflow 限制，导出前临时解除
    var wrap = cardEl.closest('.tw2img-preview-wrap');
    var oldMaxH = wrap ? wrap.style.maxHeight : null;
    var oldOverflow = wrap ? wrap.style.overflow : null;
    if (wrap) {
      wrap.style.maxHeight = 'none';
      wrap.style.overflow = 'visible';
    }

    return Promise.resolve()
      .then(function () { return waitForCardImages(cardEl); })
      .then(function () {
        hideFailedImages(cardEl);
        var hti = getHtmlToImage();
        if (!hti) throw new Error('html-to-image not loaded');
        return hti.toBlob(cardEl, toBlobOptions(cardEl));
      })
      .catch(function (firstErr) {
        console.warn('[tw2img] 导出失败，尝试占位图兜底:', firstErr);
        var imgs = cardEl.querySelectorAll('img');
        var saved = [];
        for (var k = 0; k < imgs.length; k++) {
          saved.push(imgs[k].src);
          if (imgs[k].src && imgs[k].src.indexOf('data:') !== 0) {
            imgs[k].src = PLACEHOLDER_IMAGE;
            imgs[k].removeAttribute('crossorigin');
          }
        }
        var hti2 = getHtmlToImage();
        if (!hti2) throw new Error('html-to-image not loaded');
        return hti2.toBlob(cardEl, toBlobOptions(cardEl)).finally(function () {
          for (var r = 0; r < imgs.length; r++) { imgs[r].src = saved[r]; }
        });
      })
      .finally(function () {
        if (wrap) {
          wrap.style.maxHeight = oldMaxH || '';
          wrap.style.overflow = oldOverflow || '';
        }
      });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 延迟 revoke 确保下载开始
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function copyBlobToClipboard(blob) {
    try {
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (e) {
      return navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    }
  }

  // ==================== 弹窗管理 ====================

  function closeCurrentDialog() {
    var existing = document.querySelector('.tw2img-overlay');
    if (existing) existing.remove();
  }

  function showDialog(data) {
    closeCurrentDialog();

    // 创建遮罩层
    var overlay = document.createElement('div');
    overlay.className = 'tw2img-overlay';

    // 弹窗容器
    var dialog = document.createElement('div');
    dialog.className = 'tw2img-dialog';

    // 头部
    var header = document.createElement('div');
    header.className = 'tw2img-dialog-header';
    header.innerHTML =
      '<span class="tw2img-dialog-title">推文分享图片预览</span>';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tw2img-dialog-close';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.title = '关闭';
    closeBtn.addEventListener('click', function () {
      overlay.remove();
    });
    header.appendChild(closeBtn);

    // 预览区域
    var previewWrap = document.createElement('div');
    previewWrap.className = 'tw2img-preview-wrap';

    var cardHTML = buildCardHTML(data);
    previewWrap.innerHTML = cardHTML;
    var card = previewWrap.querySelector('.tw2img-card');

    // 错误提示
    var errorEl = document.createElement('div');
    errorEl.className = 'tw2img-error';

    // 操作按钮
    var actions = document.createElement('div');
    actions.className = 'tw2img-dialog-actions';

    // 下载按钮
    var downloadBtn = document.createElement('button');
    downloadBtn.className = 'tw2img-btn-download';
    downloadBtn.textContent = '下载 PNG';
    downloadBtn.addEventListener('click', function () {
      if (downloadBtn.disabled) return;
      downloadBtn.disabled = true;
      downloadBtn.textContent = '生成中...';
      errorEl.style.display = 'none';

      captureCardAsBlob(card)
        .then(function (blob) {
          if (!blob) throw new Error('生成失败');
          var filename =
            'tweet_' +
            sanitizeFilename(data.author.handle || 'unknown') +
            '_' +
            Date.now() +
            '.png';
          return downloadBlob(blob, filename);
        })
        .then(function () {
          showToast('图片已下载');
        })
        .catch(function (err) {
          console.error('[tw2img] 下载失败:', err);
          errorEl.textContent = '下载失败，请重试';
          errorEl.style.display = 'block';
        })
        .finally(function () {
          downloadBtn.disabled = false;
          downloadBtn.textContent = '下载 PNG';
        });
    });

    // 复制按钮（仅在浏览器支持时创建）
    var clipboardSupported =
      typeof ClipboardItem !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function';

    if (clipboardSupported) {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'tw2img-btn-copy';
      copyBtn.textContent = '复制图片';
      copyBtn.addEventListener('click', function () {
        if (copyBtn.disabled) return;
        copyBtn.disabled = true;
        copyBtn.textContent = '处理中...';
        errorEl.style.display = 'none';

        captureCardAsBlob(card)
          .then(function (blob) {
            if (!blob) throw new Error('生成失败');
            return copyBlobToClipboard(blob);
          })
          .then(function () {
            showToast('已复制到剪贴板');
          })
          .catch(function (err) {
            console.error('[tw2img] 复制失败:', err);
            errorEl.textContent = '复制失败，请重试';
            errorEl.style.display = 'block';
          })
          .finally(function () {
            copyBtn.disabled = false;
            copyBtn.textContent = '复制图片';
          });
      });
    }

    // 关闭按钮
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'tw2img-btn-cancel';
    cancelBtn.textContent = '关闭';
    cancelBtn.addEventListener('click', function () {
      overlay.remove();
    });

    actions.appendChild(downloadBtn);
    if (clipboardSupported) actions.appendChild(copyBtn);
    actions.appendChild(cancelBtn);

    // 组装弹窗
    dialog.appendChild(header);
    dialog.appendChild(previewWrap);
    dialog.appendChild(errorEl);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    // 点击遮罩关闭
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // ESC 关闭
    function escHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    }
    document.addEventListener('keydown', escHandler);
    // overlay 移除时清理事件
    var observer = new MutationObserver(function () {
      if (!document.contains(overlay)) {
        document.removeEventListener('keydown', escHandler);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });

    document.body.appendChild(overlay);
  }

  // ==================== 按钮注入 ====================

  function createButton(article) {
    var btn = document.createElement('button');
    btn.className = 'tw2img-btn';
    btn.setAttribute('type', 'button');
    btn.title = '生成推文分享图片';
    btn.innerHTML = ICON_IMAGE + ' 转图片';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        var data = extractTweetData(article);
        if (!data.author.name && !data.text) {
          showToast('无法提取推文数据');
          return;
        }
        showToast('加载图片中...');
        prepareTweetDataForRender(data).then(function (preparedData) {
          // 清除加载 toast
          var toasts = document.querySelectorAll('.tw2img-toast');
          for (var ti = 0; ti < toasts.length; ti++) { toasts[ti].remove(); }
          showDialog(preparedData);
        }).catch(function (prepErr) {
          console.warn('[tw2img] 图片预取出错，使用原始 URL:', prepErr);
          var toasts = document.querySelectorAll('.tw2img-toast');
          for (var ti = 0; ti < toasts.length; ti++) { toasts[ti].remove(); }
          showDialog(data);
        });
      } catch (err) {
        console.error('[tw2img] 提取数据出错:', err);
        showToast('提取数据失败，请刷新后重试');
      }
    });

    return btn;
  }

  function injectButton(article) {
    if (article.hasAttribute(INJECTED_ATTR)) return;

    // 尝试注入到推文操作栏
    var actionBar = article.querySelector('[role="group"]');
    if (actionBar) {
      var btn = createButton(article);
      actionBar.appendChild(btn);
      article.setAttribute(INJECTED_ATTR, '1');
      return;
    }

    // 兜底：注入到推文底部区域
    var bottomDivs = article.querySelectorAll(':scope > div > div > div');
    for (var i = bottomDivs.length - 1; i >= 0; i--) {
      if (bottomDivs[i].querySelector('[role="group"]') || bottomDivs[i].children.length > 2) {
        var btn2 = createButton(article);
        bottomDivs[i].appendChild(btn2);
        article.setAttribute(INJECTED_ATTR, '1');
        return;
      }
    }
    // 未找到插入点：不标记，让后续 MutationObserver 重试
  }

  // ==================== SPA 扫描 ====================

  var scanTimer = null;
  var SCAN_DEBOUNCE = 350;

  function scanAndInject() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = null;
      var articles = document.querySelectorAll(
        'article[data-testid="tweet"]:not([' + INJECTED_ATTR + '])'
      );
      for (var i = 0; i < articles.length; i++) {
        injectButton(articles[i]);
      }
    }, SCAN_DEBOUNCE);
  }

  function startObserving() {
    var observer = new MutationObserver(function () {
      scanAndInject();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 初始扫描
    scanAndInject();
  }

  // ==================== 初始化 ====================

  function init() {
    // 避免多次初始化
    if (window.__tw2img_initialized) return;
    window.__tw2img_initialized = true;

    // 等待 html-to-image 加载
    function waitForLib(cb, attempts) {
      attempts = attempts || 0;
      if (getHtmlToImage() !== null) {
        cb();
      } else if (attempts < 30) {
        setTimeout(function () {
          waitForLib(cb, attempts + 1);
        }, 500);
      } else {
        console.error('[tw2img] html-to-image 库加载超时');
      }
    }

    waitForLib(function () {
      injectStyles();
      startObserving();
      console.log('[tw2img] Twitter/X 推文转图片脚本已就绪');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
