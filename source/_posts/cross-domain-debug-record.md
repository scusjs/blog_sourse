---
title: 跨域访问踩坑日志
mathjax: false
tags:
  - 跨域
  - Spring Boot
  - 踩坑日志
date: 2018-03-20 20:39:49
description: 关于 CORS 踩的一些坑，以及介绍了一些Spring中CORS相关的代码
categories: 笔记
---
{% blockquote 我也不知道是谁说的%}
拨开云雾见天日 守得云开见月明
{% endblockquote %}

终于把毕设撸完了，我的毕设刚好值10斤肉。赶论文这段时间无比的想撸代码，第一版写完赶紧的写了一晚上 bug，愉快的熬到了半夜。效果见本站左上角，后端调用了韩寒的“一个”，每天都是不一样的话，后端主要是 Spring 那一套。计划最近写一些常用的接口并且开放出来。

在过程中遇到一个坑，尽管用了`@CrossOrigin`注解，但是返回内容依然没有Access-Control-Allow-Origin头部，postman上没有（之前写 PHP，在 nginx 中直接对接口调用加上了这个头，所以。。。嗯是我太菜），ajax去访问也没有（这里是我自己脑抽了，后面讲），导致前端无法跨域访问，但是神奇的是，如果任务起在我电脑上，同一个局域网上室友的电脑上 postman 返回正常，微笑脸。。。嗯情况大概就是这样，然后这个 bug 调了我一晚。

## CORS 基本概念
这里首先说一下[CORS](https://www.w3.org/TR/cors/)，CORS是一个 W3C的标准，全称是跨域资源共享（Cross-origin resource sharing）。CORS需要服务器返回的数据头部包含相应的信息，CORS在客户端是浏览器自动支持的（IE 走开），如果浏览器收到服务器返回数据中包含了对应的头部，则可以使用其数据。对于简单请求（HEAD、GET、POST 方法之一，并且请求的头部不能超出如Accept、Accept-Language、Content-Language、Last-Event-ID、Content-Type这几个字段，并且Content-Type只限于application/x-www-form-urlencoded、multipart/form-data、text/plain这三个值），浏览器会自动在请求中增加一个 `Origin`字段，对于非简单请求，浏览器会提前进行一次“预检”请求（请求方法为OPTIONS）查询服务器一些信息，然后再发送加上了`Origin`字段的正常请求。比如发送一个`PUT`请求，浏览器首先发送“预检”请求：
```http
OPTIONS /cors HTTP/1.1
Origin: https://api.liexing.me
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: X-Custom-Header
Host: api.liexing.me
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Connection: keep-alive
User-Agent: Mozilla/5.0...
```
“预检”请求用来向服务器确认，当前网页所在的域名是否在服务器的许可名单之中，以及可以使用哪些HTTP动词和头信息字段。只有得到肯定答复，浏览器才会发出正式的请求。`Access-Control-Request-Method`用来询问是否支持该方法，`Access-Control-Request-Headers`用来指定浏览器CORS请求会额外发送的头信息字段。如果服务器确认了请求，则做出回应：
```http
HTTP/1.1 200 OK
Date: Thu, 20 Mar 2018 22:30:39 GMT
Server: Apache/2.0.61 (Unix)
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: X-Custom-Header
Content-Type: text/html; charset=utf-8
Content-Encoding: gzip
Content-Length: 0
Keep-Alive: timeout=2, max=100
Connection: Keep-Alive
Content-Type: text/plain
```
其中，`Access-Control-Allow-Origin`即为允许访问的域名，可以为*或者域名，`Access-Control-Allow-Methods`表示允许跨域的方法，`Access-Control-Allow-Headers`为允许跨域需要的头部。

在预检通过之后，会发送正常的`PUT`请求，并且在头部自动添加`Origin` 字段，服务器对这个请求需要校验是否含有`Access-Control-Allow-Headers`标注的头部，是否是允许的方法以及来源域名，如果都通过则返回会带上`Access-Control-Allow-Origin`，这时候浏览器才能使用。

## 服务端对跨域请求的识别

在[CORS](https://www.w3.org/TR/cors/)的文档中可以看到这样一句话：

> Server-side applications are enabled to discover that an HTTP request was deemed a cross-origin request by the user agent, through the Origin header.

这是第一个坑，当然这是我自己的问题，因为之前写PHP时候，为了方便，直接在通过Nginx代理中加上一个`Access-Control-Allow-Origin`头部，而 Spring Boot 对于 CORS 是按照标准来的，这里后面会说。

## 浏览器对CORS的操作

前面说了，浏览器在跨域访问时，会自动加上一个`Origin`头部来标注来源，这也是后端识别跨域访问的判定标准。而我在写 js 时（嗯我就是前端渣，不然咋会掉坑），域名没有加上协议，即 `https://`或者`//`，尽管浏览器给了我提示，然而我瞎了，而且还认为是浏览器 bug 换了一堆浏览器。

<img src="/images/cross-domain-debug-record/1521556978.jpg" width="600" title="浏览器对于协议缺失的报错" alt="浏览器对于协议缺失的报错"/>
## Postman 的坑

这下来了让我当时无比懵逼的一个坑了，就是我的 Postman 是 app 版本（Mac）的，我室友的是 Chrome 的应用版，而Chrome 应用版本的Postman在请求时，会加上一个`Origin`字段，而 app 版的不会，因此这也算为啥我室友电脑上没事╭(╯^╰)╮

<img src="/images/cross-domain-debug-record/1521557592.png" width="600" title="Chrome应用版postman" alt="Chrome应用版postman"/>
<img src="/images/cross-domain-debug-record/1521558256.jpg" width="600" title="app应用版postman" alt="app应用版postman"/>
从上面两个图可以看出，不同版本的 postman 发送的请求头部会有不同。

## Spring中CORS相关操作

Spring 中，检查是否是CORS只是看`Origin`头部，即完全按照W3C标准。Spring 通过`org.springframework.web.cors`中的`CorsUtils.isCorsRequest`来判断，如下图。
<img src="/images/cross-domain-debug-record/1521558645.jpg" width="600" title="Spring中判断CORS" alt="Spring中判断CORS"/>
对于 CORS 的各种操作，会在`org.springframework.web.cors`中进行，比如在`org.springframework.web.cors.reactive`中的`DefaultCorsProcessor。handleInternal`对 CORS 请求的返回进行各种校验并且添加头部操作，如下图。
<img src="/images/cross-domain-debug-record/1521558994.jpg" width="600" title="Spring中添加CORS头" alt="Spring中添加CORS头"/>
anyway，总结一下这次的坑，首先是自己懒没看CORS详细的规范，以及习惯性的自己用错了都加上跨域的头部；其次是自己傻ajax写错了，导致一直以为是后端代码的问题；最后是postman太坑，室友的电脑上正常我的电脑错误，导致我懵逼了半天。嗯就这样。
