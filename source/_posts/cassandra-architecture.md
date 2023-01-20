title: Cassandra 架构
date: 2016-09-08 15:54:29
categories: Cassandra
description: 描述Cassandra的主要技术架构，以及读写的流程和内部实现方式。
tags:
- Cassandra
- 笔记
- 分布式
- NOSQL
mathjax: true
---

# 架构

## 关键词
首先有几个关键词：

| KeyWord | Explain |
| --- | --- |
| Gossip | 集群中节点相互交换信息的通信协议 |
| Partitioner | 决定在哪儿放置第一个副本 |
| Snitch | 定义了复制策略用来放置副本和路由请求所使用的拓扑信息 |
| Virtual nodes | 虚拟节点，用来避免热点以及提高宕机时数据转移效率 |
| Token Ring | 令牌环 |


## Gossip

Gossip用于在集群中节点间交换位置和状态信息。名字和“八卦”一样，大体上就是A告诉B自己的情况和自己知道的别人的情况，B转而告诉别人A告诉自己的情况与自己的情况，并以此进行下去。

Gossip每秒钟运行一次，与至多3个节点交换信息，这样所有节点可很快了解集群中的所有节点的信息。每个节点都会保存集群中的所有其他节点信息，这样随便连到哪一个节点，都能知道集群中的所有其他节点，因此客户端请求可以连接到集群中任意一节点。

通过Gossip还可检测节点是否正常以及性能，避免将请求路由至不可达或者性能差（需配置Dynamic Snitch）的节点。
## 一致性HASH

为了将数据放入指定节点，并且避免热点问题，引入了一致性HASH。如图：

<img src="/images/cassandra-architecture/14733913102676.jpg"  title="一致性hash" alt="一致性hash"/>
Hash的值空间$0\sim2^{32}$形成一个环，称为HASH空间环。对每一个节点计算其HASH值，可以用其ip地址或者其他机器信息，这将唯一确定其在HASH空间环上的位置。之后将数据key通过函数计算出其HASH值，并在圆环上唯一确定位置，在此位置沿着顺时针遇到的第一个节点就是该数据需要被放入的位置。

在节点很多时，这能够保证数据分布均匀，但是如果节点很少，可能因为节点分布不均导致数据倾斜，因此在一致性HASH的技术上引入虚拟节点（vnode)概念。

把每个节点分为v个虚拟节点，然后再对每一个虚拟节点进行上面所述的HASH并分配到HASH空间环上。

## vnode

<img src="/images/cassandra-architecture/14734072658090.jpg"  title="vnode" alt="vnode"/>
如图上半部分所示，是没有虚拟节点的情况。这时候如果某个节点挂掉了，只能从很少的几个节点中交换数据，将会造成节点负载太高，如图：

<img src="/images/cassandra-architecture/14734075656982.jpg" width="418" title="" alt=""/>
但是如果将节点拆分成许多虚拟节点，如下半部分所示，某一个节点挂了，能够从其他很多节点那里去获取副本，将大大降低负载：

<img src="/images/cassandra-architecture/14734078747157.jpg" width="411" title="" alt=""/>
## 数据复制

目前Cassandra提供了两种复制策略：

> SimpleStrategy：用于单数据中心，第一个副本放在某个节点，其他副本放在HASH中顺时针的近邻节点。
> NetworkTopologyStrategy：用于多数据中心，可以指定每个数据中心存放多少个副本。

在创建keyspace时需要指定复制策略：

```sql
CREATE KEYSPACE Excelsior WITH REPLICATION = { 'class' : 'SimpleStrategy','replication_factor' : 3 };  
CREATE KEYSPACE Excalibur WITH REPLICATION = {'class' :'NetworkTopologyStrategy', 'dc1' : 3, 'dc2' : 2};
```

其中数据中心名需要与snitch中配置吻合。

## Partitioners

Cassandra中每一行由唯一的主键标识，partitioner相当于用来计算主键token的hash函数。Cassandra依据这个token值在集群中放置对应的行。目前有三种partitioner：

> Murmur3Partitioner：当前的默认值，依据MurmurHash哈希值在集群中均匀分布数据。（推荐使用）
> RandomPartitioner：依据MD5哈希值在集群中均匀分布数据。
> ByteOrderedPartitioner：依据行key的字节从字面上在集群中顺序分布数据。（不推荐使用）

注意：若使用虚拟节点(vnodes)则无需手工计算tokens。若不使用虚拟节点则必须手工计算tokens将所得的值指派给cassandra.ymal主配置文件中的initial_token参数。

## Snitches

snitch决定了节点属于哪个数据中心或者机架。提供网络拓扑信息，用以确定向/从哪个数据中心或者网架写入/读取数据。

注意：

1. 所有节点需用相同的snitch;
2. 集群中已插入数据后由更改了snitch则需运行一次fullrepair。

几种常用的snitch：

> Dynamic snitching：监控从不同副本读操作的性能，选择性能最好的副本。dynamic snitch默认开启，所有其他snitch会默认使用dynamic snitch 层。
> SimpleSnitch：默认值，用于单数据中心部署，不使用数据中心和网架信息。使用该值时keyspace复制策略中唯一需指定的是replication factor
> RackInferringSnitch：根据数据中心和网架确定节点位置，而数据中心及网架信息又由节点的IP地址隐含指示。
> PropertyFileSnitch：根据数据中心和网架确定节点位置，而网络拓扑信息又由用户定义的配置文件cassandra-topology.properties 获取。在节点IP地址格式不统一无法隐含指示数据中心及网架信息或者复杂的复制组中使用该值。
> GossipingPropertyFileSnitch：产品中推荐使用。通过cassandra-rackdc.properties中信息确定本机机架和数据中心，并且使用Gossip通知其他节点。为了方便从PropertyFileSnitch迁移，优先使用
cassandra-topology.properties中配置，迁移完成后记得删除。


# 写流程
## 单节点写示例

<img src="/images/cassandra-architecture/14733849232892.jpg"  title="" alt=""/>
如果所示是一个对单数据中心的写数据。副本因子为3，表示每一行数据有3个副本，放在三个不同的机器上。一致性设置为ONE，表示查询的时候有一个节点副本返回即可。

首先客户端向集群中任意一个节点发送查询命令，这个节点充当客户端和读写节点间的协调者（coordinator）。Coordinator根据集群配置决定请求分发到环中具体哪些节点上。由于副本因子为3，所以有三个节点保存副本，假设为1、3、6。数据分发到三个节点并写入，因为一致性为ONE，所以任何一个节点写入完成则返回，其他节点在后台继续写入直到完成。

## 多数据中心的写实例

<img src="/images/cassandra-architecture/14734127912685.jpg"  title="" alt=""/>
同上，但是多数据中心时，请求的数据中心的Coordinator将请求分发到其他数据中心的Coordinator执行操作。

# 读流程

<img src="/images/cassandra-architecture/14734131292169.jpg"  title="" alt=""/>
读请求可分为两个步骤进行，一个是读数据返回客户端，一个是后台自动校验数据的一致性。协调者首先与一致性级别确定的所有副本联系，被联系的节点返回请求的数据，若多个节点被联系，则来自各replica的row会在内存中作比较，若不一致，则协调者使用含最新数据的副本向客户端返回结果。同时，协调者在后台联系和比较来自其余拥有对应row的副本的数据，若不一致，会向过时的副本发写请求用最新的数据进行更新。这一过程叫read repair。

# 内部实现

## 数据结构

内部使用了LSM树结构，LSM树的设计思想非常朴素：将对数据的修改增量保持在内存中，达到指定的大小限制后将这些修改操作批量写入磁盘。因此，LSM树有个很大的好处，就是避免询盘开销，大大提高的写入性能。基于LSM树实现的HBase的写性能比Mysql高了一个数量级，读性能低了一个数量级。

## 写操作

通过在多个同级节点创建数据的多个副本保证可靠性和容错。表是非关系型的，无需过多额外工作来维护关联的表的完整性，因此写操作较关系型数据库快很多。

<img src="/images/cassandra-architecture/14735649834122.jpg"  title="" alt=""/>
先将数据写进内存中的数据结构memtable，同时追加到磁盘中的commitlog中。表使用的越多，对应的memtable应越大，cassandra动态的为memtable分配内存，也可自己手工指定。memtable内容超出指定容量后memtable数据（包括索引）被放进将被刷入磁盘的队列，可通过memtable_flush_queue_size配置队列长度。若将被刷入磁盘的数据超出了队列长度，cassandra会锁定写。memtable表中的数据由连续的I/O刷进磁盘中的SSTable，之后commit log被清空。每个表有独立的memtable和SSTable。

## 更新

<img src="/images/cassandra-architecture/14735652254246.jpg"  title="" alt=""/>
<img src="/images/cassandra-architecture/14735651935180.jpg"  title="" alt=""/>
不直接在磁盘中原地更新而是先在memtable进行所有的更新。最后更新内容被刷入磁盘存储在新的SSTable中，仅当column的时间戳比既存的column更新时才覆盖原来的数据。

## 删除

删除操作不会理解从硬盘上删除数据，而是会被tombstone标记以指定其状态，它会存在一定的时间（由gc_grace_seconds指定），超出该时间后compaction进程永久删除该column。

若删除期间节点down掉，被标记为tombstone的column会发送信号给Cassandra使其重发删除请求给该replica节点。若replica在gc_grace_seconds期间复活，会最终受到删除请求，若replica在gc_grace_seconds之后复活，节点可能错过删除请求，而在节点恢复后立即删除数据。需定期执行节点修复操作来避免删除数据重现。


## hinted handoff writes

在不要求一致性时确保写的高可用，在cassandra.yaml中开启该功能。执行write操作时若拥有对应row的replica down掉了或者无回应，则协调者会在本地的system.hints表中存储一个hint，指示该写操作需在不可用的replica恢复后重新执行。默认hints保存3小时，可通过max_hint_window_in_ms改变该值。提示的write不计入consistencylevel中的ONE，QUORUM或ALL，但计入ANY。ANY一致性级别可确保cassandra在所有replica不可用时仍可接受write，并且在适当的replica可用且收到hint重放后该write操作可读。移除节点后节点对应的hints自动移除，删除表后对应的hints也会被移除。仍需定期执行repair（避免硬件故障造成的数据丢失）

## 读数据

Cassandra推荐使用SSD，以partition key读/写，消除了关系型数据库中复杂的查询。

<img src="/images/cassandra-architecture/14736459048469.jpg"  title="" alt=""/>
首先检查Bloom filter，每个SSTable都有一个Bloomfilter，用以在进行任何磁盘I/O前检查请求的partition key对应的数据在SSTable中存在的可能性。若数据很可能存在，则检查Partition key cache(Cassandra表partition index的缓存)，之后根据index条目是否在cache中找到而执行不同步骤：

1. 找到。从compression offset map中查找拥有对应数据的压缩块。从磁盘取出压缩的数据，返回结果集。
2. 未找到。搜索Partition summary（partition index的样本集）确定index条目在磁盘中的近似位置。从磁盘中SSTable内取出index条目。从compression offset map中查找拥有对应数据的压缩块。从磁盘取出压缩的数据，返回结果集。

<img src="/images/cassandra-architecture/14736460775048.jpg"  title="" alt=""/>
由insert/update过程可知，read请求到达某一节点后，必须结合所有包含请求的row中的column的SSTable以及memtable来产生请求的数据。

<img src="/images/cassandra-architecture/14736461515400.jpg"  title="" alt=""/>

例如，要更新包含用户数据的某个row中的email 列，cassandra并不重写整个row到新的数据文件，而仅仅将新的email写进新的数据文件，username等仍处于旧的数据文件中。上图中红线表示Cassandra需要整合的row的片段用以产生用户请求的结果。为节省CPU和磁盘I/O，Cassandra会缓存合并后的结果，且可直接在该cache中更新row而不用重新合并。



> 参考：[Apache Cassandra架构理解](http://zqhxuyuan.github.io/2015/08/25/2015-08-25-Cassandra-Architecture)、[Cassandra研究报告](http://blog.csdn.net/zyz511919766/article/details/38683219)


