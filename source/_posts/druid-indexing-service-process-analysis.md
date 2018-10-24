title: Druid Indexing Service过程分析
date: 2016-05-19 18:21:48
categories: Druid
description: 对Indexing Task提交到Overlord后的执行过程进行简单的源码分析
tags:
- Druid
- 分布式
- 实时计算
- 源码分析
---

Indexing Task提交到Overlord节点后，首先创建Task对象：
```java
Task indexTask = new io.druid.indexing.common.task.IndexTask(...);
```
之后通过`TaskStorageQueryAdapter`的`getStatus`方法查看刚才创建的任务是否已经存在与任务队列里面：

```java
final Optional<TaskStatus> preRunTaskStatus = tsqa.getStatus(indexTask.getId());
```

其中，tsqa为`TaskStorageQueryAdapter`的一个实例，`getStatus()`的返回为任务的状态，由`com.google.common.base.Optional`封装，其状态有三种类型，RUNNING，SUCCESS和FAILED。如果队列里面没有这个任务，则`preRunTaskStatus.isPresent()==false`。

接着往`taskQueue`中加入任务。`taskQueue`是`io.druid.indexing.overlord.TaskQueue`一个实例，用来维护队列列表。首先检查任务队列是否启动状态，如果不是活动状态则启动它，之后向队列中添加任务：

```java
if (!taskQueue.isActive()) {
    taskQueue.start();
}
taskQueue.add(indexTask);
```

加入到taskQueue队列中的任务按照FIFO顺序由`io.druid.indexing.overlord.TaskRunner`执行（除非下一个任务没有准备好，则跳过）。其中`TaskRunner`接口有三种实现方式：

> io.druid.indexing.overlord.ForkingTaskRunner
> io.druid.indexing.overlord.RemoteTaskRunner
> io.druid.indexing.overlord.ThreadPoolTaskRunner

`ForkingTaskRunner`为使用“internal peon”方式的时候执行任务的形式，在独立的进程中执行任务。
`RemoteTaskRunner`在工作节点上执行任务，使用Zookeeper来管理和分配任务，使用HTTP来进行IPC通信。
`ThreadPoolTaskRunner`则是通过线程池执行，使用ExecutorService在一个JVM线程中执行任务。

任务执行后，返回`ListenableFuture<TaskStatus>`。通过：

```java
taskStorage.getStatus(indexTask.getId()).get()
```
获取任务的状态，其中`taskStorage`是`io.druid.indexing.overlord.TaskStorage`一个实例，用于保存任务的状态。

