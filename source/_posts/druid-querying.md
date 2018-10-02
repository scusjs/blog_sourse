title: Druid Querying
date: 2016-04-25 16:42:33
categories: Druid
tags:
- Druid
- 分布式
- 实时计算
- 笔记
---

Druid的查询都通过向可查询节点（Broker、Historcal或者Realtime）发送HTTP REST风格的请求来获得结果。请求使用JSON格式，通常发送到Broker节点。

Druid的查询分为三类：

* 聚合查询（Aggregation Queries）

> [Timeseries](http://druid.io/docs/0.8.3/querying/timeseriesquery.html)
> [TopN](http://druid.io/docs/0.8.3/querying/topnquery.html)
> [GroupBy](http://druid.io/docs/0.8.3/querying/groupbyquery.html)

聚合查询中，尽量使用Timeseries和TopN，因为GroupBy虽然最灵活，但是性能最差。

* 元查询（Metadata Queries）

> [Time Boundary](http://druid.io/docs/0.8.3/querying/timeboundaryquery.html)
> [Segment Metadata](http://druid.io/docs/0.8.3/querying/segmentmetadataquery.html)
> [Datasource Metadata](http://druid.io/docs/0.8.3/querying/datasourcemetadataquery.html)

* 搜索查询（Search Queries）

> [Search] (http://druid.io/docs/0.8.3/querying/searchquery.html)

Druid的查询可以通过Query的唯一标识取消：

	DELETE /druid/v2/{queryId}
	
## Timeseries queries
这类查询使用时间序列查询对象，获得JSON对象数组，每个JSON对象表示一个时间序列查询的结果。

每一个时间序列查询有七个主要的部分组成：


属性 | 描述 | 是否必须
--- | --- | ---
queryType | 这类查询中都为：timeseries，Druid首先检查这个字段来决定如何处理查询语句 | 是
dataSource | 描述数据源的字符串或者对象 | 是
intervals | 一个描述ISO-8601时间间隔的JSON对象，定义查询的时间区间 | 是
granularity | 定义查询结果的时间粒度 | 是
filter | 一个说明哪些字段参与查询的JSON对象，类似SQL中的where语句 | 否
aggregations | 定义汇总查询哪些指标 | 是
postAggregations | 定义汇总数据执行哪些操作 | 否
context | 定义查询配置参数 | 否


一个时间序列查询对象的示例：

```json
{
	"queryType": "timeseries",
	"dataSource": "sample_datasource",
	"granularity": "day",
	"filter": {
		"type": "and",
  		"fields": [
     		{ "type": "selector", "dimension": "sample_dimension1", "value": "sample_value1" },
     		{ "type": "or",
     		  "fields": [
					{ "type": "selector", "dimension": "sample_dimension2", "value": "sample_value2" },
					{ "type": "selector", "dimension": "sample_dimension3", "value": "sample_value3" }
     		  ]
     		}
  		]
  	},
	"aggregations": [
			{ "type": "longSum", "name": "sample_name1", "fieldName": "sample_fieldName1" },
			{ "type": "doubleSum", "name": "sample_name2", "fieldName": "sample_fieldName2" }
	],
	"postAggregations": [
		{ 
			"type": "arithmetic",
			"name": "sample_divide",
			"fn": "/",
			"fields": [
				{"type": "fieldAccess", "name": "sample_name1", "fieldName": "sample_fieldName1" },
				{"type": "fieldAccess", "name": "sample_name2", "fieldName": "sample_fieldName2" }
			]
		}
	],
	"intervals": [ "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000" ]
}
```

这个查询执行后，返回数据如下：

```json
[
	{
    	"timestamp": "2012-01-01T00:00:00.000Z",
    	"result": { "sample_name1": <some_value>, "sample_name2": <some_value>, "sample_divide": <some_value> } 
	},
	{
		"timestamp": "2012-01-02T00:00:00.000Z",
		"result": { "sample_name1": <some_value>, "sample_name2": <some_value>, 		"sample_divide": <some_value> }
	}
]
```
	
数据以粒度为天进行处理，返回两个结果，每个代表一天。如果某一天没有数据，则该处<some_value>为0。可以在context中设置`"skipEmptyBuckets": "true"`，则不返回空数据的结果。

## TopN queries
TopN查询返回一个指定维度上有序的结果数组。在单一维度上，和GroupBy与Ordering的组合效果类似，但是TopN效率更高。

TopN查询内部近似为每个节点对内部数据排序并返回最大的K个结果到broker。`K=max(1000, threshold)`。

topN查询由以下11部分组成：

属性 | 描述 | 是否必须
--- | --- | ---
queryType | 总是topN | 是
dataSource | 描述数据源的字符串或者对象 | 是
intervals | 一个描述ISO-8601时间间隔的JSON对象，定义查询的时间区间 | 是
granularity | 定义查询结果的时间粒度 | 是
filter | 一个说明哪些字段参与查询的JSON对象，类似SQL中的where语句 | 否
aggregations | 定义汇总查询哪些指标 | 是
postAggregations | 定义汇总数据执行哪些操作 | 否
dimension | 用来描述进行top操作选择字段的字符串或对象 | 是
threshold | 阈值，控制topN中N | 是
metric | 用来描述在top列表中排序的字段的字符串或者对象 | 是
context | 定义查询配置参数 | 否

例如：

```json
{
	"queryType": "topN",
	"dataSource": "sample_data",
	"dimension": "sample_dim",
	"threshold": 5,
	"metric": "count",
	"granularity": "all",
	"filter": {
		"type": "and",
		"fields": [
			{
     			"type": "selector",
     			"dimension": "dim1",
     			"value": "some_value"
			},
			{
     			"type": "selector",
     			"dimension": "dim2",
     			"value": "some_other_val"
			}
  		]
  },
	"aggregations": [
		{
			"type": "longSum",
			"name": "count",
			"fieldName": "count"
		},
		{
			"type": "doubleSum",
			"name": "some_metric",
			"fieldName": "some_metric"
		}
	],
	"postAggregations": [
		{
			"type": "arithmetic",
			"name": "sample_divide",
			"fn": "/",
			"fields": [
				{
					"type": "fieldAccess",
					"name": "some_metric",
					"fieldName": "some_metric"
        		},
        		{
					"type": "fieldAccess",
					"name": "count",
					"fieldName": "count"
        		}
      	]
    	}
	],
	"intervals": [
		"2013-08-31T00:00:00.000/2013-09-03T00:00:00.000"
	]
}
```
	
返回数据示例：

```json
[
	{
		"timestamp": "2013-08-31T00:00:00.000Z",
		"result": [
			{
				"dim1": "dim1_val",
				"count": 111,
				"some_metrics": 10669,
				"average": 96.11711711711712
			},
			{
				"dim1": "another_dim1_val",
				"count": 88,
				"some_metrics": 28344,
				"average": 322.09090909090907
			},
			{
				"dim1": "dim1_val3",
				"count": 70,
				"some_metrics": 871,
				"average": 12.442857142857143
			},
			{
				"dim1": "dim1_val4",
				"count": 62,
				"some_metrics": 815,
				"average": 13.14516129032258
			},
			{
				"dim1": "dim1_val5",
				"count": 60,
				"some_metrics": 2787,
				"average": 46.45
			}
		]
	}
]
```
	
	
由前面描述，topN是取每个节点的topK汇总，因此这个算法得到的排名和结果在数据维度大于1000时都是近似值，维度小于1000的时候得到的是准确的值。

通过服务器参数`druid.query.topN.minTopNThreshold`可以更改这个K阈值。

但是这样的处理过程可能会导致部分数据缺失。但是想要获得准确的topN需要更多的性能，可以考虑通过两次topN来获取。

## groupBy Queries

> Note: 如果只是想要获取一段时间范围内的简单的统计，使用更佳性能的Timeseries更好。如果是需要对一个维度进行有序的分组，使用topN更好。

groupBy查询语句有11部分组成：

属性 | 描述 | 是否必须
--- | --- | ---
queryType | 总是topN | 是
dataSource | 描述数据源的字符串或者对象 | 是
dimensions | 需要分组的维度列表 | 是
limitSpec | 分组结果的数量限制 | 否
having | 分组语句中判断一个数据项是否被返回的条件 | 否
granularity | 定义查询结果的时间粒度 | 是
filter | 一个说明哪些字段参与查询的JSON对象，类似SQL中的where语句 | 否
aggregations | 定义汇总查询哪些指标 | 是
postAggregations | 定义汇总数据执行哪些操作 | 否
intervals | 一个描述ISO-8601时间间隔的JSON对象，定义查询的时间区间 | 是
context | 定义查询配置参数 | 否

比如：

```json
{
  "queryType": "groupBy",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "dimensions": ["country", "device"],
  "limitSpec": { "type": "default", "limit": 5000, "columns": ["country", "data_transfer"] },
  "filter": {
    "type": "and",
    "fields": [
      { "type": "selector", "dimension": "carrier", "value": "AT&T" },
      { "type": "or", 
        "fields": [
          { "type": "selector", "dimension": "make", "value": "Apple" },
          { "type": "selector", "dimension": "make", "value": "Samsung" }
        ]
      }
    ]
  },
  "aggregations": [
    { "type": "longSum", "name": "total_usage", "fieldName": "user_count" },
    { "type": "doubleSum", "name": "data_transfer", "fieldName": "data_transfer" }
  ],
  "postAggregations": [
    { "type": "arithmetic",
      "name": "avg_usage",
      "fn": "/",
      "fields": [
        { "type": "fieldAccess", "fieldName": "data_transfer" },
        { "type": "fieldAccess", "fieldName": "total_usage" }
      ]
    }
  ],
  "intervals": [ "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000" ],
  "having": {
    "type": "greaterThan",
    "aggregation": "total_usage",
    "value": 100
  }
}
```

这个查询将会返回时间段内每一天中，`m*n`个数据，最多是5000个。n表示`country`的基数，m表示`device`的基数。返回数据如下：

```json
[ 
  {
    "version" : "v1",
    "timestamp" : "2012-01-01T00:00:00.000Z",
    "event" : {
      "country" : <some_dim_value_one>,
      "device" : <some_dim_value_two>,
      "total_usage" : <some_value_one>,
      "data_transfer" :<some_value_two>,
      "avg_usage" : <some_avg_usage_value>
    }
  }, 
  {
    "version" : "v1",
    "timestamp" : "2012-01-01T00:00:12.000Z",
    "event" : {
      "dim1" : <some_other_dim_value_one>,
      "dim2" : <some_other_dim_value_two>,
      "sample_name1" : <some_other_value_one>,
      "sample_name2" :<some_other_value_two>,
      "avg_usage" : <some_other_avg_usage_value>
    }
  },
...
]
```

## Time Boundary Queries

时间界限查询。该查询实例如下：

```json
{
    "queryType" : "timeBoundary",
    "dataSource": "sample_datasource",
    "bound"     : < "maxTime" | "minTime" > # optional, defaults to returning both timestamps if not set 
}
```

返回的数据如下：

```json
[ {
  "timestamp" : "2013-05-09T18:24:00.000Z",
  "result" : {
    "minTime" : "2013-05-09T18:24:00.000Z",
    "maxTime" : "2013-05-09T18:37:00.000Z"
  }
} ]
```

## Search Queries

搜索查询包含以下部分：

属性 | 描述 | 是否必须
--- | --- | ---
queryType | 总是search | 是
dataSource | 描述数据源的字符串或者对象 | 是
granularity | 定义查询结果的时间粒度 | 是
filter | 一个说明哪些字段参与查询的JSON对象，类似SQL中的where语句 | 否
intervals | 一个描述ISO-8601时间间隔的JSON对象，定义查询的时间区间 | 是
searchDimensions | 进行搜索查询的维度。如果不存在这个参数则表示在所有参数上进行 | 否
query | 定义怎么匹配，有InsensitiveContainsSearchQuerySpec和FragmentSearchQuerySpec两种方式 | 是
sort | 指定结果的排序方式。有lexicographic（默认）和strlen两种方式| 否
context | 定义查询配置参数 | 否

查询示例如下：

```json
{
  "queryType": "search",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "searchDimensions": [
    "dim1",
    "dim2"
  ],
  "query": {
    "type": "insensitive_contains",
    "value": "Ke"
  },
  "sort" : {
    "type": "lexicographic"
  },
  "intervals": [
    "2013-01-01T00:00:00.000/2013-01-03T00:00:00.000"
  ]
}
```

返回数据如下：

```json
[
  {
    "timestamp": "2012-01-01T00:00:00.000Z",
    "result": [
      {
        "dimension": "dim1",
        "value": "Ke$ha"
      },
      {
        "dimension": "dim2",
        "value": "Ke$haForPresident"
      }
    ]
  },
  {
    "timestamp": "2012-01-02T00:00:00.000Z",
    "result": [
      {
        "dimension": "dim1",
        "value": "SomethingThatContainsKe"
      },
      {
        "dimension": "dim2",
        "value": "SomethingElseThatContainsKe"
      }
    ]
  }
]
```


