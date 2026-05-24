# Mural Flashlight

一个基于浏览器的互动壁画原型。它模拟手持手电筒照射壁画的效果：在黑白水墨风壁画中，用光斑局部显露彩色图层。

## 源码

- GitHub: https://github.com/hu-qi/mural-flashlight

## 第一步：鼠标 / 触屏驱动的照亮效果

Demo 会渲染一幅程序生成的双层壁画：

- 黑白水墨 / 线稿基础层
- 暖色灯光 / 彩色照亮层

移动鼠标或触摸屏幕时，会移动一个柔边光斑。光斑区域会显示彩色层，并叠加暖色光晕，模拟手电筒照亮壁画的效果。

## 第二步：MediaPipe Hands 手部输入

点击 **Start hand tracking** 后，页面会打开摄像头并加载 MediaPipe Hands。应用会追踪食指指尖关键点，并将它映射到画布坐标，从而用手指控制手电筒位置。

说明：

- 关闭手部追踪时，仍然可以使用鼠标 / 触屏输入。
- 摄像头预览是镜像显示，食指坐标也做了镜像处理，方向与预览一致。
- 食指位置经过平滑处理，以减少光斑抖动。
- 浏览器摄像头访问需要 HTTPS 或 localhost 环境。

## 第三步：模块化追踪架构

代码已经拆成 Renderer、Input、Mapper 三层，方便后续把 AprilTag 作为新的输入源接入：

```text
src/
  main.ts                      # 应用启动、模式切换
  types.ts                     # TrackingPoint / TrackingInput 类型契约
  renderer/MuralRenderer.ts    # 壁画绘制、显色遮罩、光晕、调试覆盖层
  inputs/PointerInput.ts       # 鼠标 / 触屏 / 触控笔输入适配器
  inputs/MediaPipeHandInput.ts # MediaPipe Hands 输入适配器
  mapping/CanvasMapper.ts      # 输入坐标 -> 画布坐标
  utils/smoother.ts            # 抖动平滑工具
```

所有输入适配器都会输出统一的 `TrackingPoint` 数据结构：

```ts
{
  x: number
  y: number
  confidence: number
  active: boolean
  source: 'pointer' | 'mediapipe-hand' | 'apriltag'
  label?: string
}
```

Renderer 只消费 `TrackingPoint`，不关心这个点来自鼠标、手部关键点，还是未来的 AprilTag 检测器。

## 本地运行

```bash
npm install
npm run dev
```

如果要在同一局域网的手机或其他设备上测试摄像头，可以使用 HTTPS 开发服务：

```bash
npm run dev:https
```

然后在浏览器中打开 Vite 输出的本地地址。

## 部署到 Vercel

仓库中已经包含 `vercel.json`，可直接用于 Vite 项目部署。

推荐 Vercel 配置：

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

因为 MediaPipe 手部追踪需要摄像头权限，建议使用 Vercel 生成的 HTTPS 生产链接在手机或其他设备上测试。

## 操作方式

- 移动鼠标 / 触摸屏幕：在 Pointer 模式下移动手电筒
- Start hand tracking：使用食指指尖移动手电筒
- Radius：调整照亮区域大小
- Feather：调整光斑边缘柔和程度
- Glow：调整暖色光晕强度

## 后续计划

1. 增加手势触发，例如用捏合手势开关手电筒。
2. 增加 `AprilTagInput` 适配器，并输出相同的 `TrackingPoint` 接口。
3. 增加四点标定，用于摄像头坐标到屏幕坐标的映射。
