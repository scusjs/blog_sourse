title: Druid Indexing Service（索引服务）
date: 2016-04-15 10:47:47
categories: Druid
description: Indexing Service 是 Druid 的一个核心组件，用来对数据进行索引，控制Druid的段的产生以及销毁。
tags:
- Druid
- 分布式
- 实时计算
---

索引服务是一种用来运行索引相关任务的高可用、分布式的服务。索引服务任务创建或者销毁Druid的段。其架构类似主奴机制。

索引服务由三个主要部件组成：peon运行单个的任务，Middle Manager组件管理peon，overlord组件控制任务向Middle Manager的分配。Middle Manager和Peon通常运行在同一个节点，Overlord和Middle Manager能运行在相同节点或者多个节点上。

索引服务的示意图如下：


{% qnimg 14605158741221.png title:Druid Indexing Service alt:Druid Indexing Service %}

## Overlord节点

Overlord节点负责接收任务，负责任务的分配，对任务加锁，向调用者返回任务状态。Overlord有两种模式：本地模式或者远程模式。其中本地模式是默认模式。在本地模式下Overlord也负责创建Peon来执行任务，所有的Middle Manager和Peon的配置此时也应当被提供，这种模式一般用于普通的工作流。远程模式中，Overlord和Middle Manager运行在不同的进程中，也可以在不同服务器上运行，如果想让索引服务成为Druid索引的单一端点，推荐使用这种模式。

可以通过向Overlor节点以POST请求提交JSON对象的方式提交任务：

```
http://<OVERLORD_IP>:<port>/druid/indexer/v1/task
```

这将会返回提交的任务id。任务也能通过POST请求来关闭：

```
http://<OVERLORD_IP>:<port>/druid/indexer/v1/task/{taskId}/status
```

或者通过GET请求来查询状态：

```
http://<OVERLORD_IP>:<port>/druid/indexer/v1/task/{taskId}/segments
```
可以在浏览器中访问

```
http://<OVERLORD_IP>:<port>/console.html
```

来查看任务一些信息。

## Middle Manger

Middle Manger是执行提交任务的工作节点。Middle Manger向运行在独立JVM的Peon发送任务。独立开JVM是因为资源问题与日志隔离。每一个Peon一次只能执行一个任务。一个Middle Manger可以有多个Peon。

通过`io.druid.cli.Main server middleManager`来启动Middle Manager。


## Peon

Peon在独立的JVM中执行单个任务。MiddleManager负责创建Peon来执行任务。Peon很少单独运行。

除了开发目的，很少独立的运行Peon。通过`io.druid.cli.Main internal peon <task_file> <status_file>
`来独立执行。其中task_file包含了任务的JSON对象。status_file表示在那里输出任务的状态。

## HTTP 端

可以通过HTTP的GET请求`http://<NODE_IP>:<port>/status`来获取一些节点的信息，包括版本、载入的扩展、内存使用、总内存数等，比如：

```json
{
    "version": "0.9.0-rc3",
    "modules": [
        {
            "name": "io.druid.data.input.avro.AvroExtensionsModule",
            "artifact": "druid-avro-extensions",
            "version": "0.9.1-SNAPSHOT"
        }
    ],
    "memory": {
        "maxMemory": 67108864,
        "totalMemory": 67108864,
        "freeMemory": 32278264,
        "usedMemory": 34830600
    }
}
```


