title: SSH 自动连接脚本
date: 2016-04-21 15:50:30
categories: 笔记
description: 在不支持免密登录的跳转机上通过expect自动连接主机
tags:
- linux
- bash
- 笔记
---

公司开发跳转机不支持免密登录，各个主机自动生成的密码忒恶心~所以使用expect进行跳转登录，做了个伪自动的脚本。但是这个方法目前**需要把密码保存在本地**。

使用awk读取配置信息，expect登录主机。

主机配置hostlist：

```text
hostalias	user@hostname	password
testhost	root@ip	hostpassword
```

跳转脚本jump.sh:

```bash
#!/bin/bash
HOSTALIAS=$1
host=`awk -v hostalias=$HOSTALIAS '$1==hostalias{printf $2}' hostlist`
password=`awk -v hostalias=$HOSTALIAS '$1==hostalias{printf $3}' hostlist`
./exp.sh $host $password
```

expect登录脚本：

```bash
#!/usr/bin/expect -f
set host [lindex $argv 0]
set password [lindex $argv 1]
spawn ssh $host
expect "password:"
send "$password\r"
interact
```

可以将jump.sh脚本加入PATH。

