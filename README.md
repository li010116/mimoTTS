# MiMo Studio

面向短文本反复调音的本地配音工作台，视觉依据 `DESIGN.md`。使用暖纸色画布、白色面板、细边框与蓝色主按钮，并补充深色主题。

## 启动

使用 Node.js 22.13 或更高的 LTS 版本和 pnpm 11。

```sh
pnpm install
pnpm dev
```

打开 http://127.0.0.1:3000，在「设置」中填写 MiMo API Key。也可以复制 `.env.example` 为 `.env.local`，设置 `MIMO_API_KEY` 后启动服务。

生产运行使用以下命令。

```sh
pnpm build
pnpm start
```

## 已实现

- 预置音色、文字设计音色和参考音频克隆。
- 保存个人声音、设为默认、复用演绎风格。
- 草稿自动保存、历史搜索与恢复。
- 每次生成保存文案和参数快照，支持收藏、重命名、恢复、下载与 A/B 试听。
- WAV 预置音色支持 PCM16 流式试听，完成后保存 WAV。MP3、音色设计和克隆在生成后播放。
- 浅色、深色、跟随系统，以及响应式导航和减少动态效果偏好。

按 `Ctrl / ⌘ + Enter` 生成配音。在非编辑控件中按 `N` 新建草稿。

## 数据与运行方式

工作台按本机、单 Node.js 实例使用设计，默认只监听 `127.0.0.1`。

`data/studio.sqlite` 保存声音、草稿、版本和文件元数据，`data/audio/` 保存参考样本与生成结果。可通过 `MIMO_DATA_DIR` 指定其他数据目录。部署时需要持久磁盘，迁移时一并保留数据库与音频文件。

设置页保存的 Key 位于 `data/.credentials.json`，是本地明文文件，优先于环境变量。该目录已被 Git 忽略，Key 只由服务端用于请求小米官方接口。实际文案与克隆样本会发送到 MiMo 服务。

服务重启会将未完成的生成记录标记为中断，可恢复其参数后重新生成。首次启动提供一份示例文案和「日常旁白」声音预设。

## 技术栈

Next.js App Router、React、TypeScript、Tailwind CSS、shadcn/ui、Motion、next-themes、TanStack Query、Zod、Drizzle ORM、SQLite、wavesurfer.js 与 AudioWorklet。

```sh
pnpm typecheck
pnpm build
```

官方接口说明见 [MiMo TTS 使用指南](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5)。
