---
title: macOS 开发配置
mathjax: false
date: 2017-08-11 23:49:22
categories: 杂
tags:
- macOS
- 配置
---

某人心心念念的rmbp终于到手了，然而我还在杭州没法帮忙各种配置，这里就写一份教程好了，自己拿去照着撸吧（￣︶￣）↗ 

ps. 毕竟你的是高大上的17带bar rmbp。。。然而，bar的操作我都！不！知！道！



大概介绍 macOS 的一些基本操作以及常见的软件、开发环境的搭建。

## 基本操作介绍

1. 17的触摸板应该是二段的按压，意思就是分为轻按和重按，按到底会响两次，轻按表示单击，重按表示双击。但是也可以配置成双指按表示双击；


2. 键盘键位，Mac的键位和Windows的不太一样，没有`Win`那个图标，取而代之的是`command`（长这样：`⌘`）但是功能差不多；`alt`又叫做`option`（一些地方画成`⌥`）；退格、`del`合并为`delete`；`Shift`画成`⇧`，`control`画成`⌃`，大小写锁定画成`⇪`

3. 一些常用的快捷键：

   > 1. 截屏，默认的截屏快捷键有两种：`⌘+shift+control+4`（区域截图到剪切板），`⌘+shift+control+3`（全屏截图到剪切板），`⌘+shift+4`（区域截图到桌面），`⌘+shift+3`（全屏截图到桌面）
   > 2. 复制：`⌘+c`，粘贴：`⌘+v`，全选：`⌘+a`
   > 3. 输入法切换：`control+空格`（选择上一个输入法），`control+option+空格`（选择下一个输入法）
   > 4. 其他自己看[官方的文档](https://support.apple.com/zh-cn/HT201236)

## 系统基本配置

1. 开机首先是各种基本的配置，什么语言呐区域呐用户名呐乱七八糟就不说啦。

2. 首先是调整下分辨率。进入系统后，点击桌面左上角的，点击 系统偏好设置-显示器，这里把分辨率调了吧，默认的太太太大了，不仅看着难受，而且因为大，所以显示的东西太少了，怎么愉快的撸代码。

3. 设置窗口的左上方，有后退前进的按钮，点击后退可以退回主菜单。

4. 其次，在触摸板中把全部的东西都打开吧，rmbp最优秀的就是那个触摸板了。而且17款这么大的触摸板，好好用~ps.建议把“轻点来点按”打开，就不用每次都按下去了。ps. 每一个选项右边都有图示，可以看看。

5. 然后打开一些安全设置，不然装不上第三方的软件。找到“安全性与隐私”，点击左下角的🔐并输入密码，以允许后面的修改。然后“允许从以下位置下载的应用”中选择“任何来源”。

6. 接着在系统设置的辅助功能中，左边一列选中“鼠标与触控板”，右边点击“触控板选项…”，然后打开启用拖拽-“三指拖拽”，这样，鼠标放在窗口的标题栏，三个手指就能拖动窗口了，非常方便。

7. iCloud 中，登录 iCloud 账户并且开启“查找我的 Mac”选项。

8. Docker（类似 Windows 底部的菜单栏） 配置。建议小一些，放左边或者右边，并且自动隐藏。

9. 接着配置网络，网络选项在桌面上面一栏，一个WiFi图标，点击可以选择网络。

10. 其他设置：点击电池图标，勾选显示百分比；时间显示日期、星期等



## 系统基本介绍

### 一些介绍

1. 首先 macOS 是基于 Unix 的发行版，所以文件结构、命令上，都和 *nix 系统非常像（但是非常多坑）。

2. 点击 Dock 上的 Finder（即 macOS 的资源管理器）{% qnimg macos-dev-setup/1502459911.jpg %}，可以看到左边有一栏，里面有个应用程序（/Applications），应用程序放在这里的。然后 macOS 中，用户目录是`/Users/username`，而不是`/home/username`，这个需要注意。激活 Finder 的情况下，屏幕左上角会有一排菜单，这个菜单针对每个软件可能不同。一般软件的设置都是`软件名-偏好设置`中，或者使用`⌘+,`快捷键打开软件的偏好设置。在显示中是一些显示的选项，对于 Finder 可以打开显示标签页、路径、状态等

3. 如果前面触摸板中打开了 Launchpad 的手势，捏拢拇指与其他三个手指即可打开 Launchpad，或者点击 Dock 中的小火箭图标{% qnimg macos-dev-setup/1502460257.jpg %}，则能看到所有安装的应用程序，可以两个手指轻扫翻页。

### 安装软件
1. App Store 下载。App Store 中直接下载即可；
2. 第三方下载安装。下载下来的软件一般是 dmg 格式的或者无格式（解压后）的。dmg 和 exe 类似，打开后，里面一般有个软件图标和一个 Application 文件夹，直接把软件图标拖到 Application 即可。或者直接把下载的无格式（如果是压缩文件，打开即可解压）拖到 Application 即可。

## 软件

### iTerm2

 Mac 上传说中最强大的终端工具，主页戳[这里](https://www.iterm2.com/)。建议把 iTerm2 固定到 Docker，方便打开，双指点按 iTerm 图标-选项-在 Docker 中固定。
 
### Homebrew

一个包管理工具，在终端（iTerm）中输入下面语句即可安装。其官网为：[点这里](https://brew.sh/)

```bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

`brew upgrade`更新软件包，然后`brew install 软件名`即可安装一些软件。

#### Cask
[Homebrew-Cask](https://caskroom.github.io/)是 Homebrew 的扩展，用以安装其他一些软件，可以用于安装其他一些软件以前需要使用`brew cask`来使用 Cask，现在直接使用 Cask 的 tap 即可：

``` bash
brew install caskroom/cask/google-chrome #安装chrome
brew install caskroom/cask/java # 安装java
brew install caskroom/cask/visual-studio-code#安装 vs code
brew install caskroom/cask/iina#安装iina，一个非常棒的视频播放器
brew install maven #安装maven
brew install you-get youtube-dl #安装两个视频下载工具
brew install vim #用 brew 管理 vim，能升级到更新版
```

### fish

90后用的 shell~其他常用的还有 zsh。使用 brew 安装即可：

```bash
brew install fish
```

然后切换默认的 shell 为 fish：

```bash
chsh -s /usr/local/bin/fish
```

安装好后，还有个方便的 fish 管理工具：[oh my fish](http://git.io/oh-my-fish)，安装命令：

```bash
curl -L https://get.oh-my.fish | fish
```

然后可以选择[主题](https://github.com/oh-my-fish/oh-my-fish/blob/master/docs/Themes.md)，我用的 ocean，这么安装：

```bash
omf install ocean
omf theme ocean
```

当然也可以安装其他主题，去上面那个链接选选。。安装好后长这样：

{% qnimg macos-dev-setup/1502463526.png title:Ocean主题  alt:Ocean主题 %}



### ShadowsocksX

[ShadowsocksX](https://github.com/shadowsocks/ShadowsocksX-NG/releases)这个就不多说了。。。

### Karabiner-Elements

[Karabiner-Elements](https://github.com/tekezo/Karabiner-Elements) 是一个修改键位的软件，建议用它把 `caps lock`和`control`位置替换。因为大小写锁定占据了更好的位置，而 `control` 是更加频繁使用的一个按键，调换后更方便。

{% qnimg macos-dev-setup/1502469911.jpg title:Karabiner-Elements alt:Karabiner-Elements %}


### 其他软件

[IntelliJ IDEA](https://www.jetbrains.com/idea/download/)(不过强烈建议通过[JetBrains Toolbox](https://www.jetbrains.com/toolbox/app/?fromMenu) 安装)、
[Office 365](https://go.microsoft.com/fwlink/p/?LinkID=511647)、
[搜狗输入法](http://pinyin.sogou.com/mac/)、
[迅雷](http://mac.xunlei.com/)、
[Alfred](https://www.alfredapp.com/)（[这里](http://www.alfredworkflow.com)有一堆工作流工具）、
[iStat](http://bjango.com/)、
[腾讯电脑管家](http://mac.guanjia.qq.com/)、
[QQ](http://im.qq.com/macqq/)、
[微信](https://mac.weixin.qq.com/)

## 其他参考

1. [收集&推荐优秀的 Apps/硬件/技巧/周边等](https://github.com/hzlzh/Best-App)
2. [Mac新手入门以及常用软件推荐](https://wsgzao.github.io/post/mac/)
3. [高效macbook工作环境配置](http://xialeizhou.com/2019/06/23/%E9%AB%98%E6%95%88macbook%E5%B7%A5%E4%BD%9C%E7%8E%AF%E5%A2%83%E9%85%8D%E7%BD%AE/)
4. [Mac 开发配置手册](https://www.gitbook.com/book/aaaaaashu/mac-dev-setup/details)


自己折腾去吧~╰(￣▽￣)╭



