# Twitter/X 推文转图片油猴脚本需求文档

## 背景

用户希望做一个简单的 Tampermonkey / Violentmonkey 用户脚本，在 Twitter/X 网页上把单条推文生成分享图片。

需求重点是“推文转图片”，不是完整客户端、不是推文下载器、不是复杂浏览器扩展。请优先做最小可用版本，保证普通推文和带图推文能稳定生成 PNG。

## 参考项目

请参考本地已克隆项目：

`C:\Users\admin\Documents\Codex\2026-05-25\roboflow-supervision-https-github-com-roboflow\xb`

这是 GitHub 项目：

`https://github.com/nnecec/xb`

该项目是一个重构微博网页版体验的浏览器扩展。我们主要参考它的“微博生图”实现，而不是照搬整个扩展架构。

重点参考文件：

- `src/lib/weibo/components/gen-image-dialog.tsx`
- `src/lib/weibo/components/gen-image/utils.ts`
- `src/lib/weibo/components/gen-image/types.ts`
- `src/lib/weibo/components/gen-image/card-default.tsx`
- `src/lib/weibo/components/gen-image/share-card-content.tsx`
- `src/lib/weibo/components/feed-card-more-menu.tsx`

参考思路：

1. 不直接截图原始微博 DOM。
2. 先把页面数据转换成统一分享图数据结构。
3. 用自己的 UI 重新渲染一张干净的卡片。
4. 用 `html-to-image` 把卡片 DOM 转成 PNG Blob。
5. 支持下载 PNG，最好支持复制图片到剪贴板。
6. 图片加载失败时使用占位图或跳过，不能让整个导出失败。

迁移到 Twitter/X 时，也请采用类似链路：

```text
Tweet DOM -> TweetShareCardData -> 自定义分享卡片 DOM -> html-to-image -> PNG
```

## 目标

开发一个单文件用户脚本：

`twitter-tweet-to-image.user.js`

运行在：

```js
// @match https://x.com/*
// @match https://twitter.com/*
```

用户浏览 X/Twitter 时，每条可见推文旁边出现一个“转图片”按钮。点击后弹出预览弹窗，可以下载该推文生成的 PNG 图片。

## 技术要求

- 实现为单个 `.user.js` 文件。
- 不使用构建工具。
- 不使用 React/Vue。
- 原生 JavaScript + DOM API 即可。
- 可以通过 `@require` 引入 `html-to-image` 的 UMD/CDN 版本。
- 不调用第三方后端服务。
- 不依赖 Twitter/X 私有 API。
- 不要求支持未登录状态，只需要在用户正常登录浏览 X/Twitter 时可用。

建议使用：

```js
// @require https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js
```

如果使用其他 CDN，请确认 Tampermonkey 可直接加载。

## 功能要求

### 1. 按钮注入

在每个推文元素上注入一个按钮。

目标推文选择器建议从这里开始：

```js
article[data-testid="tweet"]
```

要求：

- 不重复注入按钮。
- 使用自定义属性标记已处理推文，例如 `data-tw2img-injected="1"`。
- 支持 SPA 路由切换。
- 支持滚动加载后的新推文。
- 使用 `MutationObserver` 监听新增内容。
- 避免频繁全量扫描造成性能问题，可以做 debounce/throttle。
- 按钮尽量放在推文操作区附近，或右上角菜单附近。
- 不破坏 X/Twitter 原页面布局。

按钮文案可以是：

```text
转图片
```

也可以使用简短图标按钮，但需要有 `title="转图片"`。

### 2. 数据提取

点击按钮后，从对应 `article[data-testid="tweet"]` 中提取：

- 作者昵称
- 用户 handle，例如 `@openai`
- 头像 URL
- 推文正文
- 发布时间，如可获取
- 推文图片，最多 4 张
- 回复数，如可获取
- 转发数，如可获取
- 点赞数，如可获取
- 浏览量，如可获取
- 原推文链接，如可获取
- 引用推文的基础内容，如可合理获取

最低要求：

- 普通文字推文可用。
- 带图片推文可用。
- 推文详情页可用。

允许部分统计数据为空。不要为了统计数据不完整而让生成失败。

### 3. 分享图数据结构

建议内部使用类似结构：

```js
const tweetData = {
  author: {
    name: '',
    handle: '',
    avatarUrl: null,
  },
  text: '',
  images: [],
  createdAt: '',
  stats: {
    replies: null,
    reposts: null,
    likes: null,
    views: null,
  },
  tweetUrl: '',
  quotedTweet: null,
}
```

### 4. 图片生成方式

不要直接截图原始 tweet DOM。

应当：

1. 创建一个独立的分享卡片 DOM。
2. 用提取到的数据重新渲染卡片。
3. 把卡片放进弹窗预览区域。
4. 使用 `htmlToImage.toBlob(cardElement, options)` 或等价方法转为 PNG。
5. 默认使用 2x 清晰度，例如 `pixelRatio: 2`。

建议导出参数：

```js
const blob = await htmlToImage.toBlob(cardElement, {
  pixelRatio: 2,
  cacheBust: true,
  imagePlaceholder: 'data:image/png;base64,...',
  filter: (node) => true,
})
```

### 5. 卡片样式

卡片应类似 Twitter/X 原生风格，但更适合分享：

- 白色背景。
- 卡片宽度 600px 到 720px。
- 圆角边框。
- 顶部显示头像、昵称、handle。
- 正文清晰可读，支持长文本换行。
- 图片使用网格展示，最多 4 张。
- 底部可显示回复、转发、点赞、浏览量。
- 底部可显示原推文链接。
- 生成图不包含原页面背景、侧边栏、其它推文或弹窗控件。

样式类名前缀统一使用：

```text
tw2img-
```

避免污染 X/Twitter 页面样式。

### 6. 弹窗预览

点击“转图片”后显示弹窗。

弹窗包含：

- 分享卡片预览。
- “下载 PNG”按钮。
- “复制图片”按钮，可选。
- “关闭”按钮。

要求：

- 多次点击不同推文时，不残留多个弹窗。
- 关闭弹窗后清理临时 DOM。
- 下载时按钮应显示处理中状态，避免重复点击。

### 7. 下载 PNG

实现下载功能：

```js
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = filename
a.click()
URL.revokeObjectURL(url)
```

文件名建议：

```text
tweet_<handle>_<timestamp>.png
```

注意过滤 Windows 非法文件名字符：

```text
\ / : * ? " < > |
```

### 8. 复制图片，可选但推荐

如果浏览器支持：

```js
navigator.clipboard.write([
  new ClipboardItem({ [blob.type]: blob })
])
```

如果不支持，给出提示，不影响下载功能。

### 9. 跨域图片处理

Twitter/X 头像和图片通常来自：

```text
https://pbs.twimg.com/*
```

要求：

- 图片加载失败不能导致整个生成失败。
- 图片失败时可以隐藏、替换占位图，或只导出文字卡片。
- `html-to-image` 失败时，需要显示错误提示。
- 不要因为某张图片失败导致普通文字内容也无法导出。

可考虑：

- 给图片加 `crossOrigin="anonymous"`。
- 在卡片图片加载前等待 `img.decode()`。
- 设置 `imagePlaceholder`。
- 如果图片仍失败，移除失败图片后重试一次。

### 10. 验收标准

实现完成后至少满足：

- 在时间线中，普通文字推文可生成 PNG。
- 在时间线中，带图片推文可生成 PNG。
- 在推文详情页，当前推文可生成 PNG。
- 滚动加载的新推文也会出现“转图片”按钮。
- 不重复注入按钮。
- 生成图片只包含自定义分享卡片。
- 多次点击不同推文，不残留多个弹窗。
- 图片加载失败时，仍能生成包含文字的 PNG。
- 脚本控制台没有持续刷屏错误。

## 非目标

第一版不需要实现：

- 多模板切换。
- 深色模式。
- 设置面板。
- 批量导出。
- 推文长线程拼图。
- 登录、发推、API 抓取。
- 浏览器扩展版本。

## 交付物

请交付：

1. `twitter-tweet-to-image.user.js`
2. 简短说明：如何安装到 Tampermonkey / Violentmonkey。
3. 已知限制。
4. 你自己完成的手动测试记录。
