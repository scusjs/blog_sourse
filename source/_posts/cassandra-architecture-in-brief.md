title: Cassandra 架构简述
date: 2016-08-25 21:25:01
categories: Cassandra
description:
tags:
- Cassandra
- 笔记
- 分布式
- NOSQL
---
Cassandra被设计来在多个节点中处理大量的数据负载，并且没有单点故障。它的架构建立在认为系统能够并且可能发生故障的基础上。

节点使用[gossip](http://www.cs.cornell.edu/home/rvr/papers/flowgossip.pdf)这个点对点的算法来在集群中交换自身和其他节点的状态信息。

每个节点上，顺序追加的commit log文件，捕获节点的写入动作来确保数据的持续性。数据在叫做memtable的内存结构中索引和写入，这个结构类似于回写式缓存。每当内存数据结构写满时，数据被写到硬盘上的SSTables文件中。所有的写入都自动分区并在集群中复制。Cassandra会定期使用[compaction](http://docs.datastax.com/en/cql/3.3/cql/cql_reference/tabProp.html#tabProp__moreCompaction)合并SSTables，并且丢弃使用tombstone标记的过时数据。许多[repair](http://docs.datastax.com/en/cassandra/3.x/cassandra/operations/opsRepairNodesTOC.html)机制用来确保集群中所有数据的一致性。所有的数据最先被写入commit log，在所有的数据存放到SSTable之后，commit log才能够被读取、删除或者回收。SSTable（sorted string table）只能够被追加并且顺序存放在磁盘上，用来维护所有的Cassandra表。

Cassandra是分区的行存储数据库，数据库中的每一行都有一个必须的主键。Cassandra的架构允许任何授权的用户使用CQL语言来连接到任何数据中心的任何节点和访问数据。开发者可以通过cqlsh或者应用的语言驱动来使用CQL。通常，集群中每一个应用由一个keyspace管理多个表。

分区（partitioner）用来确定哪些节点接收一块数据的第一个副本，怎样在集群的节点间分发其他副本。每一行数据都由主键唯一标示，有可能和分区键（partition key）相同，也可能包含其他一些集群键（clustering column）。分区通过对主键进行hash提取出token，然后根据token决定集群中哪个节点接收数据副本。默认的分区策略为Murmur3Partitioner。

重复因素（Replication factor）表示集群间的副本总数。重复因素大小通常大于1但是小于集群节点数量。其值表示每行数据在多少个不同的节点上有副本。

snitch定义复制策略使用数据中心和机架（拓扑）中的计算机组中哪一个节点来存放副本。当创建集群的时候必须指定snitch，所有的snitch都使用动态snitch层来监控性能和选择读取副本。默认的SimpleSnitch不能识别数据中心和机架，用来在单个数据中心和单区公共云上部署。在生产环境中推荐使用GossipingPropertyFileSnitch，它定义了节点的数据中心和机架，并使用gossip来向其他节点传播这些信息。

