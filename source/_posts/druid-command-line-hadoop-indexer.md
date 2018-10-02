title: Druid Command Line Hadoop Indexer启动流程
date: 2016-06-16 17:23:16
categories: Druid
description: 使用Hadoop往Druid读入数据时，可以不用开启Indexing服务，而且执行一个单独的hadoop indexer命令行命令即可。这个命令调用了io.druid.cli.Main类的main方法，并且通过Ariline解析命令。
tags:
- Druid
- 分布式
- 实时计算
---

首先找到启动的主类`io.druid.cli.Main`。在Main中，使用[Airline](https://github.com/airlift/airline)包来解析命令。

如图，可知Druid接收的启动命令分为五组，分别是server、example、tools、index、internal。

{% qnimg 14660495146766.jpg title:Druid启动命令分组 alt:Druid启动命令分组 %}


这里分析index命令组，详细用法可见[官方文档](http://druid.io/docs/latest/ingestion/command-line-hadoop-indexer.html)。由代码81行可知该命令组调用了CliHadoopIndexer类。

该类接收参数：
{% qnimg 14660552155689.jpg title:Druid_CliHadoopIndexer alt:Druid_CliHadoopIndexer %}

官方文档中启动命令为：
```bash
java -Xmx256m -Duser.timezone=UTC -Dfile.encoding=UTF-8 -classpath lib/*:<hadoop_config_dir> io.druid.cli.Main index hadoop <spec_file>
```
其中`spec_file`即为argumentSpec。

接着程序执行run方法。先设定Hadoop版本，然后通过注入的`extensionsConfig`设置扩展信息。接着将所有的需要的驱动包路径放入driverURLs，不含Hadoop的包位置放入nonHadoopURLS，扩展包的路径放入extensionURLs:
{% qnimg 14660645246444.jpg title:extensionURLs alt:extensionURLs %}

然后借助URLClassLoader来载入driverURLs：

```java
final URLClassLoader loader = new URLClassLoader(driverURLs.toArray(new URL[driverURLs.size()]), null);
Thread.currentThread().setContextClassLoader(loader);
```

之后将nonHadoopURLs和extensionURLs合并为jobUrls，并且设置为`druid.hadoop.internal.classpath`属性：
{% qnimg 14660646182984.jpg title:jobUrls alt:jobUrls %}

之后，重新调用main方法，并设置执行internal命令组的hadoop-indexer命令，即`CliInternalHadoopIndexer`类，并提交job到Hadoop。

{% qnimg 14660703876691.jpg title:recall_main alt:recall_main %}


