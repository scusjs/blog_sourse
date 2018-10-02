---
title: MySQL utf8之坑
mathjax: true
tags:
  - MySQL
  - utf8
  - 编码
  - utf8mb4
date: 2018-07-27 00:19:19
categories: 笔记
---

最近遇到几个项目被MySQL的utf8编码坑，想起之前编码问题被坑的惨痛教训，记录一下，警示自己。

曾几何时，每次建库都选utf8，觉得自己比那些用乱七八糟编码的人不知道酷到哪里去了。直到好多年前的某次课程设计做项目的时候，愉快的建了个用户表：

```sql
CREATE TABLE `test_user` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

然后愉快的新增用户：`INSERT INTO test_user(`name`) VALUES("我是😁")`，接着愉快的反思人生：

```
Incorrect string value: '\xF0\x9F\x98\x81' for column 'name' at row 1
```

我是谁？我来自哪里？我在干嘛？难道是我代码里面的字符集用错了？不对啊我所有地方都用的utf8啊......

## MySQL的UTF8编码是什么？

首先来看官方文档：

> The character set named utf8 uses a maximum of three bytes per character and contains only BMP characters. The utf8mb4 character set uses a maximum of four bytes per character supports supplementary characters:

>  For a BMP character, utf8 and utf8mb4 have identical storage characteristics: same code values, same encoding, same length.
>  For a supplementary character, utf8 cannot store the character at all, whereas utf8mb4 requires four bytes to store it. Because utf8 cannot store the character at all, you have no supplementary characters in utf8 columns and need not worry about converting characters or losing data when upgrading utf8 data from older versions of MySQL.

我们再看看维基百科对UTF8编码的解释：

> UTF-8 is a variable width character encoding capable of encoding all 1,112,064 valid code points in Unicode using one to four 8-bit bytes.

{% qnimg mysql-utf8/15323992645548.jpg %}

可以看出，MySQL中的utf8实质上不是标准的UTF8。MySQL中，utf8对每个字符最多使用三个字节来表示，所以一些emoji甚至是一些生僻汉字就存不下来了，比如“𡋾”。

MySQL一直不承认这是一个bug，他们在2010年发布了“utf8mb4”字符集来绕过这个问题，在MySQL中，utf8mb4才应该是标准的utf8编码，并且官方很鸡贼的偷偷在最新的文档中加上了，算是认识到错误了吧：

> utf8 is an alias for the utf8mb3 character set. 
> The utf8mb3 character set will be replaced by utf8mb4 in some future MySQL version. Although utf8 is currently an alias for utf8mb3, at that point utf8 will become a reference to utf8mb4. To avoid ambiguity about the meaning of utf8, consider specifying utf8mb4 explicitly for character set references instead of utf8.

## MySQL UTF8问题简史

MySQL从4.1版本开始支持utf8，即2003年，但是现在的utf8标准（[RFC 3629](https://tools.ietf.org/html/rfc3629))是在其后发布的。MySQL在2002年3月28日的4.1预览版中使用了旧版的utf8标准（[RFC 2279](https://tools.ietf.org/html/rfc2279))，该标准最多支持每个字符6个字节，同年9月MySQL调整其[utf8字符集最多支持3字节](https://github.com/mysql/mysql-server/commit/43a506c0ced0e6ea101d3ab8b4b423ce3fa327d0)，而这个调整可能只是为了优化空间（05年前推荐使用CHAR类字段，而一个utf8的CHAR将会占用6字节长度）和时间性能（05年前在MySQL中使用CHAR字段会有更优的速度）。嗯可以在GitHub中看到大家对这个坑的吐槽：
{% qnimg mysql-utf8/15324047157494.jpg %}
{% qnimg mysql-utf8/15324047308992.jpg %}

但是这个字符编码发布出来，就不能轻易的修改，因为如果已经有用户开始使用了，就需要这些用户重新构建其数据库。

怎么补救呢？在上面最新文档中可以看出，他们将当前的utf8作为utf8mb3的别名，并且在将来的某一天会把utf8重新作为utf8mb4别名，这样来解决这个多年的巨坑。

## 啥是UTF8

略

{% qnimg mysql-utf8/15324055064000.jpg %}


## utf8mb4_unicode_ci 和 utf8mb4_general_ci

字符除了存储，还需要排序或者比较，这个操作与编码字符集有关，称为collation，与utf8mb4对应的是utf8mb4_unicode_ci 和 utf8mb4_general_ci这两个collation。
### 准确性

utf8mb4_unicode_ci 是基于标准Unicode来进行排序比较的，能保持在各个语言之间的精确排序；

utf8mb4_general_ci 并不基于Unicode排序规则，因此在某些特殊语言或者字符上的排序结果可能不是所期望的。

### 性能
utf8mb4_general_ci 在比较和排序时更快，因为其实现了一些性能更好的操作，但是在现代服务器上，这种性能提升几乎可以忽略不计。

utf8mb4_unicode_ci 使用Unicode的规则进行排序和比较，其排序规则为了处理一些特殊字符，实现更加复杂。

现在基本没有理由继续使用utf8mb4_general_ci了，因为其带来的性能差异很小，远不如更好的数据设计，比如使用索引等等。

## MySQL用错编码怎么救
1. 备份，不然崩了就只有删库跑路了；
2. 升级MySQL服务端到5.3.3及以上版本，以支持utf8md4；
3. 将数据库、表、列的字符编码、collation改为utf8md4:

    ```sql
    # For each database:
    ALTER DATABASE database_name CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
    # For each table:
    ALTER TABLE table_name CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    # For each column:
    ALTER TABLE table_name CHANGE column_name column_name VARCHAR(length) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```
4. 检查列和索引键的最大长度；
5. 修改连接、客户端、服务端的字符集；
6. 修复和优化所有的表，以免出现一些莫名其妙的错误，可以使用如下的方式：
    ```sql
    # For each table
    REPAIR TABLE table_name;
    OPTIMIZE TABLE table_name;
    ```
    
    或者是使用`mysqlcheck`工具：
    
    ```bash
    $ mysqlcheck -u root -p --auto-repair --optimize --all-databases
    ```

## 其他坑

[MySQL表字段字符集不同导致的索引失效问题](https://mp.weixin.qq.com/s/ns9eRxjXZfUPNSpfgGA7UA)



## 参考

* https://medium.com/@adamhooper/in-mysql-never-use-utf8-use-utf8mb4-11761243e434
* https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8.html
* https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/
* https://stackoverflow.com/questions/766809/whats-the-difference-between-utf8-general-ci-and-utf8-unicode-ci
* https://mathiasbynens.be/notes/mysql-utf8mb4#utf8-to-utf8mb4


