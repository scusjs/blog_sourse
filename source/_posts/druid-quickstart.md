title: Druid Quickstart
date: 2016-03-28 18:14:36
categories: Druid
description: Druid Quickstart笔记。Druid是一个用于大数据实时查询和分析的高容错、高性能开源分布式系统，旨在快速处理大规模的数据，并能够实现快速查询和分析。
tags: 
- Druid
- 分布式
- 实时计算
---

[Druid](http://druid.io)是一个用于大数据实时查询和分析的高容错、高性能开源分布式系统，旨在快速处理大规模的数据，并能够实现快速查询和分析。

## Druid 简单架构

### 节点类型与容错
*	Historical，对非实时数据进行处理存储和查询。从deep storage下载段（segment），并对基于段的查询请求作出响应，并且把结果返回给broker节点。它们通过Zookeeper向它们自己和段宣布提供服务，并且通过Zookeeper监视装载和删除新段的信号。如果一个Historical节点失效，其他的Historical节点将会替代它，不会导致数据损失。
*	Coordinator，监视Historical组，来确保数据是可用的、可复制的，并且处于通常“最优”的配置。它们通过读取元数据存储（metadata storage）中的段元数据信息来决定哪些段应该被集群装载，利用Zookeeper来确定存在哪些Historical节点，并且创建Zookeeper项来告诉Historical节点装载或者删除段。能通过热故障转移配置运行。如果没有Coordinator在运行，将不会发生数据拓扑的变化，但是系统任然能继续运行。
*	Broker，从外部客户端接收查询语句并且分发给Realtime或者Historical节点。当Broker接收到结果后，合并结果并且返回给调用者。对于已知拓扑，Broker通过Zookeeper来判断存在哪些Realtime节点和Historical节点。能够平行的运行或者热故障转移。
*	Indexing Service，形成一个获取批量数据和实时数据到系统中的工作集群，也允许更改系统中数据的存储方式。工作节点的摄入任务可以复制运行，协调片可热故障转移。
*	Realtime，也是装载实时数据进入系统。比建立Indexing Service更加简单，作为生产环境使用的限制代价也更小。不同的节点能够平行的运行并且摄入相同的数据流。它们向磁盘定期写入检查点并且最终都推向Deep Storage。如果这是唯一的向系统输入数据的方式，并且Realtime不能访问本地磁盘，则会导致数据丢失。
	
> 早期的Druid有读立的Realtime节点，它们从Kafka或者Rabbit拉回数据，本地索引这些数据，并且周期性的分为数据段再发送给Historical节点。这种方式相当简单并且易于扩展。但是这将导致让Kafka有高可用性变得相当困难，因为高层的消费者没有提供扩展复制者组的功能，也会导致当有很多节点时管理相当困难，因为每一个节点都需要独立的配置文件。因此使用replication，从kafka拉回数据，并且推送到druid。[参考这里](https://groups.google.com/forum/#!searchin/druid-development/fangjin$20yang$20%22thoughts%22/druid-development/aRMmNHQGdhI/muBGl0Xi_wgJ)

druid简单的架构图如下，该图展示了查询、数据流是如何通过Druid的：
<img src="/images/druid-quickstart/14591361559273.jpg"  title="Druid架构图" alt="Druid架构图"/>所有的节点都以对等无共享集群或者热插拔故障转移节点的方式运行，来保证高可用性。此外，这个系统还包含三个依赖组件：

*	ZooKeeper集群，负责集群服务发现和维持当前数据拓扑
*	元数据存储实例（metadata storage instance），用于对应用于系统的数据段的元数据维护
*	Deep Storage LOB（Large Object）存储/文件系统，存储数据段

下图演示集群的管理层，表示了某些节点和依赖组件是怎么通过追踪和交换元数据来帮助管理集群的。
<img src="/images/druid-quickstart/14591373994615.jpg"  title="Druid管理层" alt="Druid管理层"/>


## 环境要求
*	Java 7 or higher
*	Linux, Mac OS X, or other Unix-like OS (Windows is not supported)
*	8G of RAM
*	2 vCPUs

## 运行
### 运行Druid
首先下载Druid:

```bash
curl -O http://static.druid.io/artifacts/releases/druid-0.9.0-rc3-bin.tar.gz
mkdir druid-0.9.0
tar -xzf druid-0.9.0-rc3-bin.tar.gz -C druid-0.9.0 --strip-components=1
cd druid-0.9.0
```
	
目录结构如下：
	
* `LICENSE` - 许可文件
* `bin/` - 一些对quickstart有用的脚本
* `conf/*` - 集群配置文件
* `conf-quickstart/*` - quickstart的配置文件
* `extensions/*` - 所有的Druid扩展
* `hadoop-dependencies/*` - Druid的Hadoop依赖
* `lib/*` - 所有的Druid核心软件包
* `quickstart/*` - 一些对quickstart有用的文件

然后下载并启动Zookeeper：

```bash
curl http://www.gtlib.gatech.edu/pub/apache/zookeeper/zookeeper-3.4.6/zookeeper-3.4.6.tar.gz -o zookeeper-3.4.6.tar.gz
tar -xzf zookeeper-3.4.6.tar.gz
cd zookeeper-3.4.6
cp conf/zoo_sample.cfg conf/zoo.cfg
./bin/zkServer.sh start
```
	
Zookeper启动后，回到druid目录下，并且执行：

```bash	
bin/init
```
	
上面命令将会生成一些目录，然后在不同的终端下执行：

```bash
java `cat conf-quickstart/druid/historical/jvm.config | xargs` -cp conf-quickstart/druid/_common:conf-quickstart/druid/historical:lib/* io.druid.cli.Main server historical
java `cat conf-quickstart/druid/broker/jvm.config | xargs` -cp conf-quickstart/druid/_common:conf-quickstart/druid/broker:lib/* io.druid.cli.Main server broker
java `cat conf-quickstart/druid/coordinator/jvm.config | xargs` -cp conf-quickstart/druid/_common:conf-quickstart/druid/coordinator:lib/* io.druid.cli.Main server coordinator
java `cat conf-quickstart/druid/overlord/jvm.config | xargs` -cp conf-quickstart/druid/_common:conf-quickstart/druid/overlord:lib/* io.druid.cli.Main server overlord
java `cat conf-quickstart/druid/middleManager/jvm.config | xargs` -cp conf-quickstart/druid/_common:conf-quickstart/druid/middleManager:lib/* io.druid.cli.Main server middleManager
```
	
对于装载批量数据，上面运行的程序已经足够了。

### 装载批量数据

首先通过摄入任务将`wikiticker-2015-09-12-sampled.json`文件装载。提交摄入任务通过向Druid提交POST请求：
	
```bash
curl -X 'POST' -H 'Content-Type:application/json' -d @quickstart/wikiticker-index.json localhost:8090/druid/indexer/v1/task
```

返回任务的ID表示提交成功：

```bash
{"task":"index_hadoop_wikipedia_2016-03-28T17:24:21.802Z"}
```
	
可以通过访问`http://localhost:8090/console.html`查看提交任务的状态。

### 装载数据流

要使Druid装载数据流，需要借助[Tranquility](https://github.com/druid-io/tranquility)：

```bash
curl -O http://static.druid.io/tranquility/releases/tranquility-distribution-0.7.4.tgz
tar -xzf tranquility-distribution-0.7.4.tgz
cd tranquility-distribution-0.7.4
```

在Druid的`conf-quickstart/tranquility/`目录下已经有配置的例子，运行即可：

```bash
bin/tranquility server -configFile <path_to_druid_distro>/conf-quickstart/tranquility/server.json
bin/generate-example-metrics | curl -XPOST -H'Content-Type: application/json' --data-binary @- http://localhost:8200/v1/post/metrics
```

如果需要使用Kafka来搭配Druid使用，则调用：

```bash
bin/tranquility kafka -configFile <path_to_druid_distro>/conf-quickstart/tranquility/kafka.json
```

Kafka配置示例：

```bash
{
    "dataSources": [
        {
            "spec": {
                "dataSchema": {
                    "parser": {
                        "type": "string",
                        "parseSpec": {
                            "timestampSpec": {
                                "format": "auto",
                                "column": "timestamp"
                            },
                            "dimensionsSpec": {
                                "dimensions": [
                                    "url",
                                    "user"
                                ]
                            },
                            "format": "json"
                        }
                    },
                    "dataSource": "pageviews",
                    "granularitySpec": {
                        "segmentGranularity": "hour",
                        "type": "uniform",
                        "queryGranularity": "none"
                    },
                    "metricsSpec": [
                        {
                            "type": "count",
                            "name": "views"
                        },
                        {
                            "fieldName": "latencyMs",
                            "type": "doubleSum",
                            "name": "latencyMs"
                        }
                    ]
                },
                "tuningConfig": {
                    "maxRowsInMemory": "100000",
                    "type": "realtime",
                    "windowPeriod": "PT5M",
                    "intermediatePersistPeriod": "PT5M"
                }
            },
            "properties": {
                "topicPattern.priority": "1",
                "topicPattern": "pageviews"
            }
        }
    ],
    "properties": {
        "zookeeper.connect": "localhost:2181",
        "zookeeper.timeout": "PT20S",
        "druid.selectors.indexing.serviceName": "druid/overlord",
        "druid.discovery.curator.path": "/druid/discovery",
        "kafka.zookeeper.connect": "localhost:2181",
        "kafka.group.id": "tranquility-kafka",
        "consumer.numThreads": "2",
        "commit.periodMillis": "15000",
        "reportDropsAsExceptions": "false"
    }
}

```


