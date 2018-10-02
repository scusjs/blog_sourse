title: "Oh My Hexo"
date: 2015-09-01 01:04:30
categories: 建站相关
description: 
tags: [hexo]
---
之前一直用着默认终端跑着 bash shell，直到遇到了 zsh，用着 oh-my-zsh，简直见到新天地。Hexo 也给了我一样的感觉，之前博客用过 wp，用过 emlog，也折腾过各种各样的三方博客，要么太死要么折腾起来没完，最后改代码发现写博客反而没太大意思的节奏=。=。

出自[tommy351](http://twitter.com/tommy351)之手的 Hexo 简直第一感觉就是高逼格，而且很炫酷，查了下作者。。。丫蛋又是同龄人，再一次感受到了人和狗的区别，汪汪。tommy 在[自己博客](http://zespia.tw/blog/2012/10/11/hexo-debut/)中曾经描述过开发 Hexo 的起因以及吐槽 Octopress。嗯看来是时候开始好好撸代码有点产出了，没事就去造造轮子啥的。

对了，这句话很喜欢，算是 Hexo 的哲学吧：

- 如果你对默认配置满意，只需几个命令便可秒搭一个 Hexo。
- 如果你跟我一样喜欢折腾下，30分钟也足够个性化。
- 如果你过于喜欢折腾，可以折腾个把星期，尽情的玩。

废话不多说了，开始这个博客第一篇吧（之前的坑太 low 就全扔了吧，重新做人😂）。

## 软件安装
### 安装 Node
在 [Node.js](https://nodejs.org/) 官网下载一路安装，如果是 MAC 可通过 Homebrew 安装:

	brew install node
不过需要提前安装好 Homebrew：

	ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"
	
通过以下命令验证是否安装成功：

	node -v
	npm -v
	
### 安装 Git
Windows 用户可以安装 [TortoiseGit](https://tortoisegit.org/)，Mac 直接 brew 安装：

	brew install git
	
### 配置 SSH-Key
首先设置 git 的用户名和邮箱：

	git config --global user.name "你的名字"
	git config --global user.email "你的邮箱"
SSH-Key 用来保证通信安全。终端下到 ~/.ssh 目录下：

	mkdir ~/.ssh 如果没有~/.ssh目录则新建这个目录
	cd ~/.ssh
通过 ls 查看是否已有文件，如果为空则生成：

	ssh-keygen -t rsa -C "你的邮箱地址" #一路回车，Enter passphrase 时一般不用输入密码
如果 ls 不为空则查看 id_rsa.pub 文件内容，可使用 cat id_rsa.pub 命令查看，复制下来。
	
更多git相关操作请转[这里](http://git-scm.com/book/zh/v2)。ps. 如果是程序员别告诉我你不会git，每次带新生绝对很早就要他们熟悉git，这是码农基本技能。

### Hexo 安装
在 Node 和 Git 装好后，通过 npm 安装 Hexo：

	npm install -g hexo
	
## 环境准备
### Hexo 准备
安装好 Hexo 后，初始化 Hexo 到一个你指定的目录：

	hexo init <folder>
	
或者在目录下执行 hexo init 即可。

这时 cd 到 init 的目录，执行命令生成静态页面到 <folder>/public/ 下面：

	hexo generate #或者 hexo g
	
执行如下命令可在本地启动服务，并进行预览：

	hexo server #或者 hexo s
	
默认地址为：http://0.0.0.0:4000，可通过配置更改改地址。
### GitHub或者其他提供类似服务的厂商
将前面复制的 id_rsa.pub 文件内容填入相关服务商个人页面，如 GitHub 是在 <https://github.com/settings/ssh>,具体参加各服务商帮助文档：
> https://help.github.com/articles/generating-ssh-keys/
> https://help.gitcafe.com/manuals/help/ssh-key#4-添加-ssh-公钥到-gitcafe

然后创建 [GithubPages](https://pages.github.com/)，或者 [GitCafe Pages](https://help.gitcafe.com/manuals/help/pages-services)。我这里两个都用到了，习惯 Github，但是 GitCafe 国内访问流畅一些，后面配置中可以同时 git push 到两边。

## 写文章
在前面的初始化 Hexo 的目录下，执行如下命令，将自动生成文章到 ./source/_post/ 目录下：

	hexo new [layout] "postName"
其中 layout 为可选参数，默认值为 post，即使用 ./scaffolds 目录下的 post.md 为模板创建新文章，你也可以创建自己的模板；new 可以缩写为 n。查看刚才生成的文件：./source/_post/postName.md：

	title: "postName" #页面上显示的标题，可以更改
	date: 2015-09-01 02:22:16 #生成时间
	categories: #文章分类，如果为空需要留空格
	description: #文章描述
	tags: #标签，多个标签按照[tag1,tag2,tag3]格式
	---
	这里是博文的正文
> 注意所有的冒号后面都有空格

关于 Markdown 更多语法戳[这里](http://www.appinn.com/markdown/)

> markdown 头部加上 layout: false，则 hexo 不会自动处理你的文件
> 
> markdown 头部加上 description 将会覆盖全局配置文件中的描述内容
> 
> 在正文部分通过如下代码自动分割摘要和正文：

	这是摘要
	<!--more-->
	这是余下全文
	
## 主题安装
Hexo 有很多主题可供选择，这是主题列表：[Hexo Themes](https://github.com/hexojs/hexo/wiki/Themes)。

之前选择过 pacman 主题，但是发现很久没有维护，而且在读取底部作者图片的时候存在一个 bug，读取目录级数错误，并且配置项参数没有怎么分离，因此最终使用了一个长得差不多的主题 [jacman](https://github.com/wuchong/jacman)，在博客目录下这样安装：

	git clone https://github.com/wuchong/jacman.git themes/jacman
并且在博客目录下的 _config.yml 中将主题 theme 配置成 jacman 即可。

到主题目录下， git pull 即可更新主题（更新之前备份好自己主题的 _config.yml 配置文件）：

	cd themes/jacman
	git pull origin master
可以参考[这里](http://wuchong.me/blog/2014/11/20/how-to-use-jacman/)修改主题配置文件。

## 评论框
Hexo 自带了 [Disqus](https://disqus.com/)，但是国内慢到生活不能自理，所以一般使用[多说](http://duoshuo.com/)评论框。在主题配置文件中 shortname 填入多说的__基本设置->域名__即可。

但是多说默认的评论框不是太好看，这里修改一下 CSS，在多说后台管理中，点击__设置->基本设置__，在自定义 CSS 中，加入如下代码实现评论头像的旋转：

	/*Head Start*/
	#ds-thread #ds-reset ul.ds-comments-tabs li.ds-tab a.ds-current {
    	border: 0px;
    	color: #6D6D6B;
    	text-shadow: none;
    	background: #F3F3F3;
	}

	#ds-thread #ds-reset .ds-highlight {
    	font-family: Microsoft YaHei, "Helvetica Neue", Helvetica, Arial, Sans-serif;
    	font-size: 100%;
    	color: #6D6D6B !important;
	}

	#ds-thread #ds-reset ul.ds-comments-tabs li.ds-tab a.ds-current:hover {
    	color: #696a52;
    	background: #F2F2F2;
	}

	#ds-thread #ds-reset a.ds-highlight:hover {
    	color: #696a52 !important;
	}

	#ds-thread {
    	padding-left: 30px;
	}

	#ds-thread #ds-reset li.ds-post,#ds-thread #ds-reset #ds-hot-posts 	{
    	overflow: visible;
	}

	#ds-thread #ds-reset .ds-post-self {
    	padding: 10px 0 10px 10px;
	}

	#ds-thread #ds-reset li.ds-post,#ds-thread #ds-reset .ds-post-self 	{
    	border: 0 !important;
	}

	#ds-reset .ds-avatar, #ds-thread #ds-reset ul.ds-children .ds-avatar {
    	top: 15px;
    	left: -20px;
    	padding: 5px;
    	width: 36px;
    	height: 36px;
    	box-shadow: -1px 0 1px rgba(0,0,0,.15) inset;
    	border-radius: 46px;
    	background: #FAFAFA;
	}

	#ds-thread .ds-avatar a {
    	display: inline-block;
    	padding: 1px;
    	width: 32px;
    	height: 32px;
    	border: 1px solid #b9baa6;
    	border-radius: 50%;
    	background-color: #fff !important;
	}

	#ds-thread .ds-avatar a:hover {
	}

	#ds-thread .ds-avatar > img {
    	margin: 2px 0 0 2px;
	}

	#ds-thread #ds-reset .ds-replybox {
    	box-shadow: none;
	}

	#ds-thread #ds-reset ul.ds-children .ds-replybox.ds-inline-replybox a.ds-avatar,
	#ds-reset .ds-replybox.ds-inline-replybox a.ds-avatar {
    	left: 0;
    	top: 0;
    	padding: 0;
    	width: 32px !important;
    	height: 32px !important;
    	background: none;
    	box-shadow: none;
	}

	#ds-reset .ds-replybox.ds-inline-replybox a.ds-avatar img {
    	width: 32px !important;
    	height: 32px !important;
    	border-radius: 50%;
	}

	#ds-reset .ds-replybox a.ds-avatar,
	#ds-reset .ds-replybox .ds-avatar img {
    	padding: 0;
    	width: 50px !important;
    	height: 50px !important;
    	border-radius: 5px;
	}

	#ds-reset .ds-avatar img {
    	width: 32px !important;
    	height: 32px !important;
    	border-radius: 32px;
    	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
    	-webkit-transition: .8s all ease-in-out;
    	-moz-transition: .4s all ease-in-out;
    	-o-transition: .4s all ease-in-out;
    	-ms-transition: .4s all ease-in-out;
    	transition: .4s all ease-in-out;
	}

	.ds-post-self:hover .ds-avatar img {
    	-webkit-transform: rotateX(360deg);
    	-moz-transform: rotate(360deg);
    	-o-transform: rotate(360deg);
    	-ms-transform: rotate(360deg);
    	transform: rotate(360deg);
	}

	#ds-thread #ds-reset .ds-comment-body {
    	-webkit-transition-delay: initial;
    	-webkit-transition-duration: 0.4s;
    	-webkit-transition-property: all;
    	-webkit-transition-timing-function: initial;
    	background: #F7F7F7;
    	padding: 15px 15px 15px 47px;
    	border-radius: 5px;
    	box-shadow: #B8B9B9 0 1px 3px;
    	border: white 1px solid;
	}

	#ds-thread #ds-reset ul.ds-children .ds-comment-body {
    	padding-left: 15px;
	}

	#ds-thread #ds-reset .ds-comment-body p {
    	color: #787968;
	}

	#ds-thread #ds-reset .ds-comments {
    	border-bottom: 0px;
	}

	#ds-thread #ds-reset .ds-powered-by {
    	display: none;
	}

	#ds-thread #ds-reset .ds-comments a.ds-user-name {
    	font-weight: normal;
    	color: #3D3D3D !important;
	}

	#ds-thread #ds-reset .ds-comments a.ds-user-name:hover {
    	color: #D32 !important;
	}

	#ds-thread #ds-reset #ds-bubble {
    	display: none !important;
	}

	#ds-thread #ds-reset #ds-hot-posts {
    	border: 0;
	}

	#ds-reset #ds-hot-posts .ds-gradient-bg {
    	background: none;
	}

	#ds-thread #ds-reset .ds-comment-body:hover {
    	background-color: #F1F1F1;
    	-webkit-transition-delay: initial;
    	-webkit-transition-duration: 0.4s;
    	-webkit-transition-property: all;
    	-webkit-transition-timing-function: initial;
	}
	/*Head End*/

点击[这里](http://dev.duoshuo.com/docs/4ff1cfd0397309552c000017)查看修改 CSS 的官方文档。

然后是让评论框显示 UA(User Agent)。具体查看[这里](http://myhloli.com/duoshuo-ua-and-admin-tab.html)进行修改，将修改后的 js 代码上传到 github 或者七牛等平台，然后修改主题下 __./layout/_partial/after_footer.ejs__ 文件，将

	ds.src = '//static.duoshuo.com/embed.js';
切换成你自己的 js 地址。最后再次修改前面的那个 CSS 配置，让获取到的 UA 信息显示出来。

## 自定义页面
执行 new page 命令：

	hexo new page "about"
将会在 ./source/ 下面生成 about 目录，下面的 index.md 可以直接编辑。当然也可以手动生成这个目录并且添加这个文件。然后在主题的 _config.yml 文件中添加这个页面。

## 图床
如果使用 Github Pages 架设博客，遇到大图国内访问将会比较慢，这时候图床就是很必要的了。我使用的是七牛作为图床，你可以使用我的[邀请链接](https://portal.qiniu.com/signup?code=3lg7fvw1idhzm)。

使用 [hexo-qiniu-sync](https://github.com/gyk001/hexo-qiniu-sync) 工具可以方便的整合七牛和 Hexo。通过如下命令安装：

	npm install hexo-qiniu-sync --save
然后在主配置文件 _config.yml 中启用插件：
	
	plugins:
		- hexo-qiniu-sync
并且将配置项添加到后面即可。
> 注意，现在七牛已经不能使用 qiniudn.com 的外链域名，直接使用 z0.glb.clouddn.com 这样的域名即可。

## Hexo 公式渲染

在头部添加`mathjax: true`即可开启公式渲染。可以在模板文件中添加。

### 公式下标失效

公式中`_`下标可能失效，原因是其也是 markdown 的内置语法，会被渲染成<em>标签，因此修改 marked.js 文件，其位于`./node_modules/marked/lib/`下，修改459行和490行代码，删掉关于`_`的正则匹配：

```
// em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
em: /^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
```

```
// em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
em: /^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
```

### 多行公式换行

将换行符`\\`改写成`\\\`。

### 连续大括号渲染错误

当渲染连续的大括号时，会提示`Template render error: (unknown path) expected variable end`。可使用`\lbrace`和`\rbrace`替换大括号，或者两个括号中间加空格。

## 部署到Git服务器
安装 hexo-deployer-git：

	npm install hexo-deployer-git --save
Git Pages托管服务创建好后，在主配置文件 _config.yml 中，添加如下配置：

	deploy:
		type: git
		repo: <repository url>
		branch: [branch]
		message: [message]
也可同时部署到多个Git Pages：

	deploy:
		type: git
		repo:
			github: <repository url>,[branch]
			gitcafe: <repository url>,[branch]
配置好后，hexo deploy 即可。
## 其他
### npm 命令卡住
由于大家都懂的原因，国内 npm 命令经常卡成狗，这时可以修改 ~/.npmrc 文件，添加代理，或者使用国内 npm 镜像，比如 [cnpm](http://npm.taobao.org/)。

### 常用命令
	
	hexo new "postName"
	hexo new page "postName"
	hexo clean
	hexo generate #生成静态页面到public目录
	hexo server
	hexo deploy
	
### 页面统计
页面统计可以使用 Google Analytics 或者百度统计或者 CNZZ 的，但是他们很喜欢生成一个丑哭了的图片放在网站地步，其实只要在统计代码外层包上如下代码即可
	
	<span style="display:none">...统计代码...</span>
统计代码一般在 ./themes/you_themes/layout/_partial/ 下，一般在  after_footer.ejs 或者 analytics.ejs 里面。

### 编译错误
遇到过生成页面后出现一堆代码，或者是 CSS 错误，或者类似 URIError: URI malformed 这样的错误，查了半天，发现是 vim 修改了 ejs 文件后，自动生成了带 ~ 后缀的备份文件，这将导致 Hexo 生成的时候一起包含进去出错。删掉所有的备份文件即可。






