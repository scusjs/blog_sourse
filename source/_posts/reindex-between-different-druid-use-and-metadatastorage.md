title: 使用不同Metadata Storage的Druid集群间转移DataSource
date: 2016-04-20 18:19:58
categories: Druid
description: 
tags: 
- Druid
- 分布式
- 实时计算
---

在Druid中读取已有的数据比较简单，有很多方法可以使用，[详见这里](http://druid.io/docs/0.9.0/ingestion/update-existing-data.html)。但是如果不同的Druid集群使用了不同的Metadata Storage，迁移任务首先回去找datasource下的segments，但是由于旧的Druid集群把相关信息保存在其他地方，这将会导致找不到Segments。

因此考虑将旧集群中需要转移的datasource的metadata转到新集群的Metadata Storage。假设两个集群均使用MySQL作为Metadata Storage。

首先将满足条件的segments数据导出：

```bash
mysql -uroot -p -e 'select * from druid.druid_segments where datasource="datasourcename";' > ./segments.metadata.sql
```

然后在新集群的MySQL终端中执行下面语句将数据导入：

```bash
load data local infile 'path_to_sql/segments.metadata.sql' INTO TABLE druid.druid_segments FIELDS TERMINATED BY '\t';
```

然后执行Hadoop Index任务即可，部分配置如下：

```json
{
  "type" : "index_hadoop",
  "spec" : {
    "ioConfig" : {
      "type" : "hadoop",
      "inputSpec" : {
        "type" : "dataSource",
        "ingestionSpec" : {
          "dataSource" : "datasourcename",
          "interval" : "2016-04-09T00:00:00+08:00/P1D"
        }
      }
    },
    ...
}
```
向overlord提交任务：

```bash
curl -X 'POST' -H 'Content-Type:application/json' -d @task_config.json <overlord_host>:<port>/druid/indexer/v1/task
```

> 注：此方法适用于两个集群使用相同的Deep Storage，否则还需要迁移Deep Storage中存储的Segments。


