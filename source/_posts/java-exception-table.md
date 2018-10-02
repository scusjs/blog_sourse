---
title: Java 异常表与异常处理原理
mathjax: true
date: 2017-09-17 15:12:11
categories: Java
tags:
- JVM
- 异常处理
- 异常表
---

Java 在代码中通过使用 `try{}catch(){}finally{}` 块来对异常进行捕获或者处理。但是对于 JVM 来说，是如何处理 try/catch 代码块与异常的呢。

实际上 Java 编译后，会在代码后附加异常表的形式来实现 Java 的异常处理及 finally 机制（在 JDK1.4.2之前，javac 编译器使用 jsr 和 ret 指令来实现 finally 语句，但是1.4.2之后自动在每段可能的分支路径后将 finally 语句块内容冗余生成一遍来实现。JDK1.7及之后版本，则完全禁止在 Class 文件中使用 jsr 和 ret 指令）。

## 异常表

属性表（attribute_info）可以存在于 Class 文件、字段表、方法表中，用于描述某些场景的专有信息。属性表中有个 Code 属性，该属性在方法表中使用，Java 程序方法体中的代码被编译成的字节码指令存储在 Code 属性中。而异常表（exception_table）则是存储在 Code 属性表中的一个结构，这个结构是可选的。

## 异常表结构

异常表结构如下表所示。它包含四个字段：如果当字节码在第 start_pc 行到 end_pc 行之间（即[start_pc, end_pc)）出现了类型为 catch_type 或者其子类的异常（catch_type 为指向一个 CONSTANT_Class_info 型常量的索引），则跳转到第 handler_pc 行执行。如果 catch_type 为0，表示任意异常情况都需要转到 handler_pc 处进行处理。

| 类型 | 名称 | 数量 |
| --- | --- | --- |
| u2 | start_pc | 1 |
| u2 | end_pc | 1 |
| u2 | handler_pc | 1 |
| u2 | catch_type | 1 |

## 处理异常机制

如上面所说，每个类编译后，都会跟随一个异常表，如果发生异常，首先在异常表中查找对应的行（即代码中相应的 `try{}catch(){}` 代码块），如果找到，则跳转到异常处理代码执行，如果没有找到，则返回（执行 finally 之后），并 copy 异常的应用给父调用者，接着查询父调用的异常表，以此类推。

## 异常处理实例

对于 Java 源码：

```java
public int inc() {
    int x;
    try {
        x = 1;
        return x;
    } catch (Exception e) {
        x = 2;
        return x;
    } finally {
        x = 3;
    }
}
```

将其编译为 ByteCode 字节码：

```bytecode
public int inc();
  Code:
    Stack=1, Locals=5, Args_size=1
    0:	iconst_1		//try 中的x=1
    1:	istore_1
    2:	iload_1		//保存 x 到 returnValue 中
    3:	istore	4
    5:	iconst_3		//finally 中的 x=3
    6:	istore_1
    7: 	iload		4	//将 returnValue 中的值放到栈顶，准备给 ireturn 返回
    9:	ireturn
    10:	astore_2		//给 catch 中的 Exception e 赋值，存储在 Slot 2 中
    11:	iconst_2		//catch 中的 x=2
    12:	istore_1
    13:	iload_1		//保存 x 到 returnValue 中，此时 x=2
    14:	istore	4
    16:	iconst_3		//finally 中的 x=3
    17:	istore_1
    18:	iload	4	//将 returnValue 中的值放到栈顶，准备给 ireturn 返回
    20:	ireturn
    21:	astore_3		//如果出现了不属于 java.lang.Exception 及其子类中的异常则到这里
    22:	iconst_3		//finally 中的 x=3
    23:	istore_1
    24:	aload_3		//将异常放置到栈顶，并抛出
    25:	athrow
    
    
  Exception table:
    from		to		target		type
    0			5		10		Class java/lang/Exception
    0			5		21		any
    10		16		21		any
```

首先可以看到，对于 finally，编译器将每个可能出现的分支后都放置了冗余。并且编译器生成了三个异常表记录，从 Java 代码的语义上讲，执行路径分别为：

> 1. 如果 try 语句块中出现了属于 Exception 及其子类的异常，则跳转到 catch 处理；
> 2. 如果 try 语句块中出现了不属于 Exception 及其子类的异常，则跳转到 finally 处理；
> 3. 如果 catch 语句块中出现了任何异常，则跳转到 finally 处理。

由此可以分析此段代码可能的返回结果：

> 1. 如果没有出现异常，返回1；
> 2. 如果出现 Exception 异常，返回2；
> 3. 如果出现了 Exception 意外的异常，非正常退出，没有返回；

我们来分析字节码：

首先，0-4行，就是把整数1赋值给 x，并且将此时 x 的值复制一个副本到本地变量表的 Slot 中（即 returnValue），这个 Slot 里面的值在 ireturn 指令执行前会被重新读到栈顶，作为返回值。这是如果没有异常，则执行5-9行，把 x 赋值为3，然后返回 returnValue 中保存的1，方法结束。如果出现异常，读取异常表发现应该执行第10行，pc 寄存器指针转向10行，10-20行就是把2赋值给 x，然后把 x 赋值给 returnValue，再将 x 赋值为3，然后将 returnValue 中的2读到操作栈顶返回。第21行开始是把 x 赋值为3并且将栈顶的异常抛出，方法结束。








