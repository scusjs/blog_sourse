---
title: Redis的List，从linkedlist和ziplist再到quicklist
mathjax: true
tags:
  - redis
  - 数据结构
  - quicklist
  - ziplist
  - 笔记
date: 2019-12-28 23:47:36
categories: Redis
---

## List的底层编码及演进

Redis对外暴露最基本的5种结构，比如String、List、Set、ZSet和Hash，而每种结构在底层又能通过不同的数据结构来实现。在service.h中定义了底层使用的数据结构：

```c
/* Objects encoding. Some kind of objects like Strings and Hashes can be
 * internally represented in multiple ways. The 'encoding' field of the object
 * is set to one of this fields for this object. */
#define OBJ_ENCODING_RAW 0     /* Raw representation */
#define OBJ_ENCODING_INT 1     /* Encoded as integer */
#define OBJ_ENCODING_HT 2      /* Encoded as hash table */
#define OBJ_ENCODING_ZIPMAP 3  /* Encoded as zipmap */
#define OBJ_ENCODING_LINKEDLIST 4 /* No longer used: old list encoding. */
#define OBJ_ENCODING_ZIPLIST 5 /* Encoded as ziplist */
#define OBJ_ENCODING_INTSET 6  /* Encoded as intset */
#define OBJ_ENCODING_SKIPLIST 7  /* Encoded as skiplist */
#define OBJ_ENCODING_EMBSTR 8  /* Embedded sds string encoding */
#define OBJ_ENCODING_QUICKLIST 9 /* Encoded as linked list of ziplists */
#define OBJ_ENCODING_STREAM 10 /* Encoded as a radix tree of listpacks */
```

对于List，在Redis中的相关代码在`t_list.c`，在3.0及之前的版本中，对于list的调用为如下代码：

```c
if (subject->encoding == REDIS_ENCODING_ZIPLIST) {
    //something
} else if (subject->encoding == REDIS_ENCODING_LINKEDLIST) {
    //something
} else {
    redisPanic("Unknown list encoding");
}
```

即对于3.0及之前版本，对于list在底层存在两种不同的实现方式，ziplist以及linkedlist，但是在3.2版本开始，对于list的调用变成了如下形式：

```c
if (subject->encoding == OBJ_ENCODING_QUICKLIST) {
    //something
} else {
    serverPanic("Unknown list encoding");
}
```

显然，在3.2及之后的版本，Redis使用了quicklist这个新的实现方式来替换以前的ziplist以及linkedlist。

## linkedlist

linkedlist即经典的双链表，其定义在3.0及之前版本的`adlist.h`文件中：

```c
/* Node, List, and Iterator are the only data structures used currently. */

typedef struct listNode {
    struct listNode *prev;
    struct listNode *next;
    void *value;
} listNode;

typedef struct list {
    listNode *head;
    listNode *tail;
    void *(*dup)(void *ptr);
    void (*free)(void *ptr);
    int (*match)(void *ptr, void *key);
    unsigned long len;
} list;
```

每个node包含了三个部分，指向前一个节点和后一个节点的指针，以及一个数据值。而一个list包含了指向首尾的指针、整个list的长度，以及三个函数指针，用来复制节点的值、释放节点的值，以及比较节点内容。

{% qnimg from-ziplist-linkedlist-to-quicklist/15773759260279.jpg title:linkedlist示意图 alt:linkedlist示意图 %}

即对于每一个节点，value指向robj对象，而robj对象中的ptr指向实际的SDS对象，包含了长度，空余长度，真实字符串+'\0'，对于链表中每增加一个节点，需要实际内容额外42个字节（3.0.6版本，32位）的存储空间。

```c
#define REDIS_LRU_BITS 24
typedef struct redisObject {
    unsigned type:4;
    unsigned encoding:4;
    unsigned lru:REDIS_LRU_BITS; /* lru time (relative to server.lruclock) */
    int refcount;
    void *ptr;
} robj;

typedef char *sds;

struct sdshdr {
    unsigned int len;
    unsigned int free;
    char buf[];
};
```

显然，linkedlist在频繁前后端插入情况下表现良好，但是查找效率比较低，并且比较耗内存。

## ziplist

在Redis源码中，ziplist的实现在`ziplist.c`文件中，一开头就介绍了，ziplist是一种特殊编码的节省内存空间的双链表，能以O(1)的时间复杂度在两端`push`和`pop`数据，具有如下结构：

> `<zlbytes><zltail><zllen><entry><entry><zlend>`

* zlbytes是一个`unsigned integer`，保存ziplist占用的总内存空间，在重新分配内存时，借助这个字段可以不用遍历整个ziplist；
* zltail是指向最后一个entry的偏移量，这样对于尾部的操作不用去遍历所有entry；
* zllen固定两个字节长度，表示entry的数量，最大能表示`2^16-2`个entry，如果超过了，则其值为`2^16-1`，需要遍历entry才能知道具体的数量；
* zlend固定一个字节，值固定为255，表示ziplist的结尾。

zlbytes、zltail、zllen统称为ziplist的header，其空间总占用定义如下：

```c
#define ZIPLIST_HEADER_SIZE     (sizeof(uint32_t)*2+sizeof(uint16_t))
```

新建一个空的ziplist的代码如下：

```c
/* Create a new empty ziplist. */
unsigned char *ziplistNew(void) {
    unsigned int bytes = ZIPLIST_HEADER_SIZE+1;
    unsigned char *zl = zmalloc(bytes);
    ZIPLIST_BYTES(zl) = intrev32ifbe(bytes);
    ZIPLIST_TAIL_OFFSET(zl) = intrev32ifbe(ZIPLIST_HEADER_SIZE);
    ZIPLIST_LENGTH(zl) = 0;
    zl[bytes-1] = ZIP_END;
    return zl;
}
```

entry的定义如下：

```c
typedef struct zlentry {
    unsigned int prevrawlensize, prevrawlen;
    unsigned int lensize, len;
    unsigned int headersize;
    unsigned char encoding;
    unsigned char *p;
} zlentry;
```

prevrawlen和len均采用变长编码的方式来存储数据。

其中prevrawlen表示前一个节点的长度，prevrawlensize用来表示prevrawlen的大小，有1字节和5字节两种。如果prevrawlen小于254字节，则只需要一字节来保存，如果大于等于254字节，则需要5字节保存，第一个字节被置为254，其余4字节用来保存实际长度；len为当前节点长度 lensize为编码len所需的字节大小；headersize为当前节点的header大小；encoding为节点的编码方式；*p为指向节点的指针。

redis通过如下的代码来获取prevrawlen和prevrawlensize。

```c
/* Encode the length of the previous entry and write it to "p". Return the
 * number of bytes needed to encode this length if "p" is NULL. */
static unsigned int zipPrevEncodeLength(unsigned char *p, unsigned int len) {
    if (p == NULL) {
        return (len < ZIP_BIGLEN) ? 1 : sizeof(len)+1;
    } else {
        if (len < ZIP_BIGLEN) {
            p[0] = len;
            return 1;
        } else {
            p[0] = ZIP_BIGLEN;
            memcpy(p+1,&len,sizeof(len));
            memrev32ifbe(p+1);
            return 1+sizeof(len);
        }
    }
}
```

对于lensize和len，这二者的值和entry内存储的类型有关。如果存储string，则前两个bit位用来存储string的编码方式，后面跟上实际的长度。如果存储integer，则前两个bit位置为1，随后两个bit位指定integer的类型。具体如下：

```c
* |00pppppp| - 1 byte
*      String value with length less than or equal to 63 bytes (6 bits).
* |01pppppp|qqqqqqqq| - 2 bytes
*      String value with length less than or equal to 16383 bytes (14 bits).
* |10______|qqqqqqqq|rrrrrrrr|ssssssss|tttttttt| - 5 bytes
*      String value with length greater than or equal to 16384 bytes.
* |11000000| - 1 byte
*      Integer encoded as int16_t (2 bytes).
* |11010000| - 1 byte
*      Integer encoded as int32_t (4 bytes).
* |11100000| - 1 byte
*      Integer encoded as int64_t (8 bytes).
* |11110000| - 1 byte
*      Integer encoded as 24 bit signed (3 bytes).
* |11111110| - 1 byte
*      Integer encoded as 8 bit signed (1 byte).
* |1111xxxx| - (with xxxx between 0000 and 1101) immediate 4 bit integer.
*      Unsigned integer from 0 to 12. The encoded value is actually from
*      1 to 13 because 0000 and 1111 can not be used, so 1 should be
*      subtracted from the encoded 4 bit value to obtain the right value.
* |11111111| - End of ziplist.
```

从`ZIP_DECODE_LENGTH`可以看出具体的解码过程和每个字段的存储位置：

```c
/* Different encoding/length possibilities */
#define ZIP_STR_MASK 0xc0
#define ZIP_INT_MASK 0x30
#define ZIP_STR_06B (0 << 6)
#define ZIP_STR_14B (1 << 6)
#define ZIP_STR_32B (2 << 6)

/* Extract the encoding from the byte pointed by 'ptr' and set it into
 * 'encoding'. */
#define ZIP_ENTRY_ENCODING(ptr, encoding) do {  \
    (encoding) = (ptr[0]); \
    if ((encoding) < ZIP_STR_MASK) (encoding) &= ZIP_STR_MASK; \
} while(0)

/* Decode the length encoded in 'ptr'. The 'encoding' variable will hold the
 * entries encoding, the 'lensize' variable will hold the number of bytes
 * required to encode the entries length, and the 'len' variable will hold the
 * entries length. */
#define ZIP_DECODE_LENGTH(ptr, encoding, lensize, len) do {                    \
    ZIP_ENTRY_ENCODING((ptr), (encoding));                                     \
    if ((encoding) < ZIP_STR_MASK) {                                           \
        if ((encoding) == ZIP_STR_06B) {                                       \
            (lensize) = 1;                                                     \
            (len) = (ptr)[0] & 0x3f;                                           \
        } else if ((encoding) == ZIP_STR_14B) {                                \
            (lensize) = 2;                                                     \
            (len) = (((ptr)[0] & 0x3f) << 8) | (ptr)[1];                       \
        } else if (encoding == ZIP_STR_32B) {                                  \
            (lensize) = 5;                                                     \
            (len) = ((ptr)[1] << 24) |                                         \
                    ((ptr)[2] << 16) |                                         \
                    ((ptr)[3] <<  8) |                                         \
                    ((ptr)[4]);                                                \
        } else {                                                               \
            assert(NULL);                                                      \
        }                                                                      \
    } else {                                                                   \
        (lensize) = 1;                                                         \
        (len) = zipIntSize(encoding);                                          \
    }                                                                          \
} while(0);
```

对len字段进行计算的过程如下面的函数：

```c
/* Encode the length 'rawlen' writing it in 'p'. If p is NULL it just returns
 * the amount of bytes required to encode such a length. */
static unsigned int zipEncodeLength(unsigned char *p, unsigned char encoding, unsigned int rawlen) {
    unsigned char len = 1, buf[5];

    if (ZIP_IS_STR(encoding)) {
        /* Although encoding is given it may not be set for strings,
         * so we determine it here using the raw length. */
        if (rawlen <= 0x3f) {
            if (!p) return len;
            buf[0] = ZIP_STR_06B | rawlen;
        } else if (rawlen <= 0x3fff) {
            len += 1;
            if (!p) return len;
            buf[0] = ZIP_STR_14B | ((rawlen >> 8) & 0x3f);
            buf[1] = rawlen & 0xff;
        } else {
            len += 4;
            if (!p) return len;
            buf[0] = ZIP_STR_32B;
            buf[1] = (rawlen >> 24) & 0xff;
            buf[2] = (rawlen >> 16) & 0xff;
            buf[3] = (rawlen >> 8) & 0xff;
            buf[4] = rawlen & 0xff;
        }
    } else {
        /* Implies integer encoding, so length is always 1. */
        if (!p) return len;
        buf[0] = encoding;
    }

    /* Store this length at p */
    memcpy(p,buf,len);
    return len;
}
```

可以看到，对于integer编码，长度恒为1，否则读取实际的string的长度值。

而实际上，encoding又是保存在len字段的第一个字节，判断是否是字符串的方法如下：

```c
#define ZIP_STR_MASK 0xc0
/* Macro to determine type */
#define ZIP_IS_STR(enc) (((enc) & ZIP_STR_MASK) < ZIP_STR_MASK)
```

encoding和p表示元素编码和内容，其具体的定义可参考如下函数：

```c
#define ZIP_INT_16B (0xc0 | 0<<4)
#define ZIP_INT_32B (0xc0 | 1<<4)
#define ZIP_INT_64B (0xc0 | 2<<4)
#define ZIP_INT_24B (0xc0 | 3<<4)
#define ZIP_INT_8B 0xfe
/* 4 bit integer immediate encoding */
#define ZIP_INT_IMM_MASK 0x0f
#define ZIP_INT_IMM_MIN 0xf1    /* 11110001 */
#define ZIP_INT_IMM_MAX 0xfd    /* 11111101 */

/* Check if string pointed to by 'entry' can be encoded as an integer.
 * Stores the integer value in 'v' and its encoding in 'encoding'. */
static int zipTryEncoding(unsigned char *entry, unsigned int entrylen, long long *v, unsigned char *encoding) {
    long long value;

    if (entrylen >= 32 || entrylen == 0) return 0;
    if (string2ll((char*)entry,entrylen,&value)) {
        /* Great, the string can be encoded. Check what's the smallest
         * of our encoding types that can hold this value. */
        if (value >= 0 && value <= 12) {
            *encoding = ZIP_INT_IMM_MIN+value;
        } else if (value >= INT8_MIN && value <= INT8_MAX) {
            *encoding = ZIP_INT_8B;
        } else if (value >= INT16_MIN && value <= INT16_MAX) {
            *encoding = ZIP_INT_16B;
        } else if (value >= INT24_MIN && value <= INT24_MAX) {
            *encoding = ZIP_INT_24B;
        } else if (value >= INT32_MIN && value <= INT32_MAX) {
            *encoding = ZIP_INT_32B;
        } else {
            *encoding = ZIP_INT_64B;
        }
        *v = value;
        return 1;
    }
    return 0;
}

/* Convert a string into a long long. Returns 1 if the string could be parsed
 * into a (non-overflowing) long long, 0 otherwise. The value will be set to
 * the parsed value when appropriate. */
int string2ll(const char *s, size_t slen, long long *value);
```

显然如上面的描述，对于entrylen>=32不用做处理，接下来设置encoding为具体的值。

对于ziplist的push操作，在`ziplistPush`中具体定义，简单描述其流程如下：

1. 获取指向尾部或者头部节点的指针p；
2. 获取p的prevlensize和prevlen；
3. 通过prevlen以及coding、实际插入数据来计算待插入的节点reqlen；
4. 如不在队尾插入，则需要校验p对应节点的prelen是否够reqlen使用，不够需要扩展，够不进行压缩，防止连锁更新；
5. 更新队尾偏移量；
6. 判断是否需要连锁更新；
7. 保存插入节点内容；
8. ziplist的长度加一。

连锁更新的执行函数以及解释如下：

```c
/* When an entry is inserted, we need to set the prevlen field of the next
 * entry to equal the length of the inserted entry. It can occur that this
 * length cannot be encoded in 1 byte and the next entry needs to be grow
 * a bit larger to hold the 5-byte encoded prevlen. This can be done for free,
 * because this only happens when an entry is already being inserted (which
 * causes a realloc and memmove). However, encoding the prevlen may require
 * that this entry is grown as well. This effect may cascade throughout
 * the ziplist when there are consecutive entries with a size close to
 * ZIP_BIGLEN, so we need to check that the prevlen can be encoded in every
 * consecutive entry.
 *
 * Note that this effect can also happen in reverse, where the bytes required
 * to encode the prevlen field can shrink. This effect is deliberately ignored,
 * because it can cause a "flapping" effect where a chain prevlen fields is
 * first grown and then shrunk again after consecutive inserts. Rather, the
 * field is allowed to stay larger than necessary, because a large prevlen
 * field implies the ziplist is holding large entries anyway.
 *
 * The pointer "p" points to the first entry that does NOT need to be
 * updated, i.e. consecutive fields MAY need an update. */
static unsigned char *__ziplistCascadeUpdate(unsigned char *zl, unsigned char *p);
```

如上面的描述，可以得到ziplist的简易示意图如下，每个节点是单独的entry，每个entry中一个字段表示前一个entry的长度（长度小于254时采用一个字节编码，否则采用5个字节），一个encoding字段保存当前节点的编码方式和数据长度，content保存着entry的具体数据，可以是字符数组或整数，如果是整数且在0-12之间则不再保存content。

{% qnimg from-ziplist-linkedlist-to-quicklist/15774500192728.jpg title:ziplist示意图 alt:ziplist示意图 %}


ziplist可以很方便的拿到头节点或者尾节点，由于每个节点都保存前一个节点的长度，因此对于任意节点可以方便的前后遍历。相比linkedlist，除了链表结构节省少量空间外，每个entry可以节省大量的额外内存（最大额外空间才10字节，对于不大于12的正整数，甚至不用content空间来进行存储）。对于主要是pop或push并且每个元素长度不大的场景来说，ziplist相比于linkedlist有较大的优势。

但是如前面所说，通过`ZIP_BIGLEN`即`254`这个分界点来确认prevlen的长度，如果每一个节点的长度原本都是253，如果在头部插入时下一个节点的prevlen需要扩展，则会导致整个ziplist都进行更新。在删除时也可能出现类似情况。但是这种情况出现的概率不大，并且在使用ziplist时，entry总量不大，因此可以忽略不计。

ziplist的弊端也很明显了，对于较多的entry或者entry长度较大时，需要大量的连续内存，并且节省的空间比例相对不在占优势，就可以考虑使用其他结构了。

{% qnimg from-ziplist-linkedlist-to-quicklist/15774517236868.jpg title:redis中list配置 alt:redis中list配置 %}

如图所示是3.0.6版本redis中的默认值，即单个entry长度官方默认要求小于64时才使用ziplist，否则使用其他底层结构；entry数量也有限制，一般要求在512个(hash和list)或者128个（zset）之内才使用。

## QuickList

前面介绍的两种结构，一种耗内存但是能应付数据较大（数量或者单个的长度）的情况，但是插入和删除成本低，而另一个则在小规模数据情况下表现很好并且非常节省内存，数据规模大时会有问题，并且插入和删除成本高。显然这时候QuickList该上场了。这时候让我们忘记3.0及之前的版本，开始进入新的结构吧。

首先看代码定义，`quicklist.h`：

```c
/* Node, quicklist, and Iterator are the only data structures used currently. */

/* quicklistNode is a 32 byte struct describing a ziplist for a quicklist.
 * We use bit fields keep the quicklistNode at 32 bytes.
 * count: 16 bits, max 65536 (max zl bytes is 65k, so max count actually < 32k).
 * encoding: 2 bits, RAW=1, LZF=2.
 * container: 2 bits, NONE=1, ZIPLIST=2.
 * recompress: 1 bit, bool, true if node is temporarry decompressed for usage.
 * attempted_compress: 1 bit, boolean, used for verifying during testing.
 * extra: 10 bits, free for future use; pads out the remainder of 32 bits */
typedef struct quicklistNode {
    struct quicklistNode *prev;
    struct quicklistNode *next;
    unsigned char *zl;
    unsigned int sz;             /* ziplist size in bytes */
    unsigned int count : 16;     /* count of items in ziplist */
    unsigned int encoding : 2;   /* RAW==1 or LZF==2 */
    unsigned int container : 2;  /* NONE==1 or ZIPLIST==2 */
    unsigned int recompress : 1; /* was this node previous compressed? */
    unsigned int attempted_compress : 1; /* node can't compress; too small */
    unsigned int extra : 10; /* more bits to steal for future usage */
} quicklistNode;

/* quicklistLZF is a 4+N byte struct holding 'sz' followed by 'compressed'.
 * 'sz' is byte length of 'compressed' field.
 * 'compressed' is LZF data with total (compressed) length 'sz'
 * NOTE: uncompressed length is stored in quicklistNode->sz.
 * When quicklistNode->zl is compressed, node->zl points to a quicklistLZF */
typedef struct quicklistLZF {
    unsigned int sz; /* LZF size in bytes*/
    char compressed[];
} quicklistLZF;

/* quicklist is a 40 byte struct (on 64-bit systems) describing a quicklist.
 * 'count' is the number of total entries.
 * 'len' is the number of quicklist nodes.
 * 'compress' is: -1 if compression disabled, otherwise it's the number
 *                of quicklistNodes to leave uncompressed at ends of quicklist.
 * 'fill' is the user-requested (or default) fill factor. */
typedef struct quicklist {
    quicklistNode *head;
    quicklistNode *tail;
    unsigned long count;        /* total count of all entries in all ziplists */
    unsigned long len;          /* number of quicklistNodes */
    int fill : 16;              /* fill factor for individual nodes */
    unsigned int compress : 16; /* depth of end nodes not to compress;0=off */
} quicklist;
```

乍一看貌似很复杂，但是整个结构却是非常的清晰。

首先是`quicklistNode`，这是`quicklist`的节点，可以看做对`ziplist`的高层封装。包含指向前后节点的指针，以及指向实际`ziplist`的指针zl，从定义上看，`quicklist`的节点上支持了压缩能力，并且多个字段通过位域方式申明内存节省空间。

而`quicklistLZF`用来存储压缩后的`ziplist`，占用空间4+N字节，其中N为压缩后的实际长度。

通过`quicklist`将`quicklistNode`连接起来，形成了完整的`quicklist`结构。由于`quicklist`同时包含了`ziplist`和`quicklist`的结构，因此每个`quicklistNode`的大小就非常重要：如果太大其就更接近ziplist，影响插入效率；如果太小就更接近`quicklist`，浪费空间。其通过`fill`字段来控制大小，正数表示单个节点允许的最大数量，最大为2^15，负数表示单个节点的内存空间大小，其中-1表示单个节点最多存储4kb，-2表示单个节点最多存储8kb，以此类推，-5表示单个节点最多保存64kb，在创建时默认的值为-2。这个字段的设置代码即判定是否还能继续插入数据的代码如下。compress表示压缩的深度，0表示不压缩，正数表示头尾多少个节点不压缩其余节点都压缩。

```c
#define FILL_MAX (1 << 15)
void quicklistSetFill(quicklist *quicklist, int fill) {
    if (fill > FILL_MAX) {
        fill = FILL_MAX;
    } else if (fill < -5) {
        fill = -5;
    }
    quicklist->fill = fill;
}
```

```c
/* Maximum size in bytes of any multi-element ziplist.
 * Larger values will live in their own isolated ziplists. */
#define SIZE_SAFETY_LIMIT 8192
#define sizeMeetsSafetyLimit(sz) ((sz) <= SIZE_SAFETY_LIMIT)

REDIS_STATIC int _quicklistNodeAllowInsert(const quicklistNode *node,
                                           const int fill, const size_t sz) {
    if (unlikely(!node))
        return 0;

    int ziplist_overhead;
    /* size of previous offset */
    if (sz < 254)
        ziplist_overhead = 1;
    else
        ziplist_overhead = 5;

    /* size of forward offset */
    if (sz < 64)
        ziplist_overhead += 1;
    else if (likely(sz < 16384))
        ziplist_overhead += 2;
    else
        ziplist_overhead += 5;

    /* new_sz overestimates if 'sz' encodes to an integer type */
    unsigned int new_sz = node->sz + sz + ziplist_overhead;
    if (likely(_quicklistNodeSizeMeetsOptimizationRequirement(new_sz, fill)))
        return 1;
    else if (!sizeMeetsSafetyLimit(new_sz))
        return 0;
    else if ((int)node->count < fill)
        return 1;
    else
        return 0;
}
```

quicklist使用[lzf](https://en.wikipedia.org/wiki/Lossless_compression)进行压缩，具体压缩算法略过，压缩节点的代码如下，开辟新的空间压缩ziplist数据，并且释放node->zl原有的内存，最后指向压缩后的数据并修改其他属性值。

```c

/* Minimum ziplist size in bytes for attempting compression. */
#define MIN_COMPRESS_BYTES 48

/* Compress the ziplist in 'node' and update encoding details.
 * Returns 1 if ziplist compressed successfully.
 * Returns 0 if compression failed or if ziplist too small to compress. */
REDIS_STATIC int __quicklistCompressNode(quicklistNode *node) {
#ifdef REDIS_TEST
    node->attempted_compress = 1;
#endif

    /* Don't bother compressing small values */
    if (node->sz < MIN_COMPRESS_BYTES)
        return 0;

    quicklistLZF *lzf = zmalloc(sizeof(*lzf) + node->sz);

    /* Cancel if compression fails or doesn't compress small enough */
    if (((lzf->sz = lzf_compress(node->zl, node->sz, lzf->compressed,
                                 node->sz)) == 0) ||
        lzf->sz + MIN_COMPRESS_IMPROVE >= node->sz) {
        /* lzf_compress aborts/rejects compression if value not compressable. */
        zfree(lzf);
        return 0;
    }
    lzf = zrealloc(lzf, sizeof(*lzf) + lzf->sz);
    zfree(node->zl);
    node->zl = (unsigned char *)lzf;
    node->encoding = QUICKLIST_NODE_ENCODING_LZF;
    node->recompress = 0;
    return 1;
}
```

同样，解压的代码如下，开辟新的空间存放解压后的数据，同时释放压缩数据的空间，node->zl指向新的解压后的数据，最后修改其他属性值。

```c
/* Uncompress the ziplist in 'node' and update encoding details.
 * Returns 1 on successful decode, 0 on failure to decode. */
REDIS_STATIC int __quicklistDecompressNode(quicklistNode *node) {
#ifdef REDIS_TEST
    node->attempted_compress = 0;
#endif

    void *decompressed = zmalloc(node->sz);
    quicklistLZF *lzf = (quicklistLZF *)node->zl;
    if (lzf_decompress(lzf->compressed, lzf->sz, decompressed, node->sz) == 0) {
        /* Someone requested decompress, but we can't decompress.  Not good. */
        zfree(decompressed);
        return 0;
    }
    zfree(lzf);
    node->zl = decompressed;
    node->encoding = QUICKLIST_NODE_ENCODING_RAW;
    return 1;
}
```

在头尾插入节点如下，如果单个ziplist满足上面说到的大小、数量限制，则使用ziplist的push函数直接插入，否则新建一个节点用来插入即可。

```c
/* Add new entry to head node of quicklist.
 *
 * Returns 0 if used existing head.
 * Returns 1 if new head created. */
int quicklistPushHead(quicklist *quicklist, void *value, size_t sz) {
    quicklistNode *orig_head = quicklist->head;
    if (likely(
            _quicklistNodeAllowInsert(quicklist->head, quicklist->fill, sz))) {
        quicklist->head->zl =
            ziplistPush(quicklist->head->zl, value, sz, ZIPLIST_HEAD);
        quicklistNodeUpdateSz(quicklist->head);
    } else {
        quicklistNode *node = quicklistCreateNode();
        node->zl = ziplistPush(ziplistNew(), value, sz, ZIPLIST_HEAD);

        quicklistNodeUpdateSz(node);
        _quicklistInsertNodeBefore(quicklist, quicklist->head, node);
    }
    quicklist->count++;
    quicklist->head->count++;
    return (orig_head != quicklist->head);
}

/* Add new entry to tail node of quicklist.
 *
 * Returns 0 if used existing tail.
 * Returns 1 if new tail created. */
int quicklistPushTail(quicklist *quicklist, void *value, size_t sz) {
    quicklistNode *orig_tail = quicklist->tail;
    if (likely(
            _quicklistNodeAllowInsert(quicklist->tail, quicklist->fill, sz))) {
        quicklist->tail->zl =
            ziplistPush(quicklist->tail->zl, value, sz, ZIPLIST_TAIL);
        quicklistNodeUpdateSz(quicklist->tail);
    } else {
        quicklistNode *node = quicklistCreateNode();
        node->zl = ziplistPush(ziplistNew(), value, sz, ZIPLIST_TAIL);

        quicklistNodeUpdateSz(node);
        _quicklistInsertNodeAfter(quicklist, quicklist->tail, node);
    }
    quicklist->count++;
    quicklist->tail->count++;
    return (orig_tail != quicklist->tail);
}
```

除此之外，quicklist还提供了merge、旋转、指定节点前后插入等功能，均在`quicklist.[h|c]`中，其主要在linkedlist的基础上，对于每个节点融合ziplist的特征，并且对于中间节点还提供了lzf压缩的能力，综合了linkedlist和ziplist的有点，同时具有节省内存、插入删除数据高效的特点。整个quicklist的简单示意图可如下图。

{% qnimg from-ziplist-linkedlist-to-quicklist/15774679538508.jpg title:quicklist示意图 alt:quicklist示意图 %}


## 性能对比

测试平台：macOS Catalina 10.15.2，Intel Core i7 2.2GHz，16GB 1600MHz DDR3

因为系统上已有通过homebrew安装64位的5.0.7版本Redis，因此先看这个版本。因为打算对比quicklist、ziplist以及linkedlist，所以选择list结构进行测试。为了测试存储空间、插入删除性能，在不同测试中均使用`redis-benchmark`执行相同的测试。

对于ziplist以及linkedlist，使用本地编译的64位3.0.6版本。


### quicklist的性能

首先向quicklist插入1000条定长数据：
```bash
$ redis-benchmark -t lpush -n 1000
====== LPUSH ======
  1000 requests completed in 0.02 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

99.90% <= 1 milliseconds
100.00% <= 1 milliseconds
55555.56 requests per second

$ redis-cli
127.0.0.1:6379> memory usage mylist
(integer) 5131
```

实际使用5131字节，相当于每个元素使用约5.1字节，空间利用率约58.5%（实际插入的是”xxx“，三个字节长）。

再向quicklist的list中插入1000000个定长数据

```bash
$ redis-benchmark -t lpush -n 1000000

====== LPUSH ======
  1000000 requests completed in 12.36 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

99.44% <= 1 milliseconds
99.85% <= 2 milliseconds
99.91% <= 3 milliseconds
99.93% <= 4 milliseconds
99.94% <= 5 milliseconds
99.95% <= 6 milliseconds
99.96% <= 7 milliseconds
99.97% <= 8 milliseconds
99.99% <= 9 milliseconds
99.99% <= 10 milliseconds
100.00% <= 11 milliseconds
100.00% <= 17 milliseconds
100.00% <= 18 milliseconds
100.00% <= 18 milliseconds
80893.05 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7fd2ca51c2e0 refcount:1 encoding:quicklist serializedlength:72148 lru:462431 lru_seconds_idle:57 ql_nodes:612 ql_avg_node:1633.99 ql_ziplist_max:-2 ql_compressed:0 ql_uncompressed_size:5006732

$ redis-benchmark -t lpop -n 1000000
====== LPOP ======
  1000000 requests completed in 13.80 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.47% <= 1 milliseconds
99.65% <= 2 milliseconds
99.80% <= 3 milliseconds
99.87% <= 4 milliseconds
99.89% <= 5 milliseconds
99.91% <= 6 milliseconds
99.92% <= 7 milliseconds
99.94% <= 8 milliseconds
99.95% <= 9 milliseconds
99.97% <= 10 milliseconds
99.97% <= 11 milliseconds
99.98% <= 12 milliseconds
99.98% <= 13 milliseconds
99.98% <= 14 milliseconds
99.99% <= 15 milliseconds
99.99% <= 17 milliseconds
99.99% <= 21 milliseconds
99.99% <= 22 milliseconds
99.99% <= 26 milliseconds
100.00% <= 27 milliseconds
100.00% <= 29 milliseconds
100.00% <= 30 milliseconds
100.00% <= 30 milliseconds
72442.77 requests per second
```

可以看出，其插入速度基本都能保持在1ms以内，并且在未压缩情况下（value空间小于`MIN_COMPRESS_BYTES`即48字节，不执行压缩），共有612个quicklist节点，总共占用5006732字节内存，即每个值仅占用约5字节，而实际插入的值`"xxx"`本身是3字节长，约60%的空间利用率。弹出速度也大量保持在1ms以内。

接着尝试插入更长的数据，先不开启quicklist的，再看看插入和弹出性能以及内存占用情况：

```bash
$ redis-benchmark -n 1000000 lpush mylist "mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial"
====== lpush mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial ======
  1000000 requests completed in 14.27 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

97.91% <= 1 milliseconds
99.61% <= 2 milliseconds
99.83% <= 3 milliseconds
99.88% <= 4 milliseconds
99.90% <= 5 milliseconds
99.92% <= 6 milliseconds
99.93% <= 7 milliseconds
99.94% <= 8 milliseconds
99.95% <= 9 milliseconds
99.95% <= 10 milliseconds
99.96% <= 11 milliseconds
99.98% <= 12 milliseconds
99.98% <= 13 milliseconds
99.99% <= 16 milliseconds
99.99% <= 17 milliseconds
99.99% <= 18 milliseconds
100.00% <= 19 milliseconds
100.00% <= 28 milliseconds
100.00% <= 28 milliseconds
70081.99 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7fd2cfa025d0 refcount:1 encoding:quicklist serializedlength:29294298 lru:465570 lru_seconds_idle:6 ql_nodes:58824 ql_avg_node:17.00 ql_ziplist_max:-2 ql_compressed:0 ql_uncompressed_size:470411768
127.0.0.1:6379> memory usage mylist
(integer) 428062336

$ redis-benchmark -t lpop -n 1000000
====== LPOP ======
  1000000 requests completed in 13.50 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.24% <= 1 milliseconds
99.58% <= 2 milliseconds
99.77% <= 3 milliseconds
99.85% <= 4 milliseconds
99.88% <= 5 milliseconds
99.91% <= 6 milliseconds
99.94% <= 7 milliseconds
99.95% <= 8 milliseconds
99.96% <= 9 milliseconds
99.96% <= 10 milliseconds
99.97% <= 11 milliseconds
99.98% <= 12 milliseconds
99.98% <= 13 milliseconds
99.99% <= 14 milliseconds
99.99% <= 15 milliseconds
99.99% <= 16 milliseconds
100.00% <= 17 milliseconds
100.00% <= 18 milliseconds
74057.62 requests per second
```

可以看出，随着字符串的变长，实际的插入、弹出时间相差不大，每个元素占用空间`470411768/1000000≈470`字节，约98.5%的空间利用率。实际内存空间使用`428062336`字节，约408M。

如果开启压缩，设置`list-compress-depth`为1，再进行相同的测试：

```bash
$ redis-benchmark -n 1000000 lpush mylist "mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial"
====== lpush mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial ======
  1000000 requests completed in 13.99 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.09% <= 1 milliseconds
99.72% <= 2 milliseconds
99.86% <= 3 milliseconds
99.90% <= 4 milliseconds
99.92% <= 5 milliseconds
99.94% <= 6 milliseconds
99.94% <= 7 milliseconds
99.95% <= 8 milliseconds
99.96% <= 9 milliseconds
99.96% <= 10 milliseconds
99.97% <= 11 milliseconds
99.97% <= 12 milliseconds
99.98% <= 13 milliseconds
99.99% <= 14 milliseconds
99.99% <= 15 milliseconds
100.00% <= 24 milliseconds
100.00% <= 25 milliseconds
100.00% <= 27 milliseconds
71489.85 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7fd2ca4355f0 refcount:1 encoding:quicklist serializedlength:29294298 lru:465449 lru_seconds_idle:6 ql_nodes:58824 ql_avg_node:17.00 ql_ziplist_max:-2 ql_compressed:1 ql_uncompressed_size:470411768
127.0.0.1:6379> memory usage mylist
(integer) 74930099

$ redis-benchmark -t lpop -n 1000000
====== LPOP ======
  1000000 requests completed in 13.63 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.42% <= 1 milliseconds
99.69% <= 2 milliseconds
99.84% <= 3 milliseconds
99.88% <= 4 milliseconds
99.90% <= 5 milliseconds
99.91% <= 6 milliseconds
99.93% <= 7 milliseconds
99.95% <= 8 milliseconds
99.98% <= 9 milliseconds
99.98% <= 10 milliseconds
99.99% <= 11 milliseconds
99.99% <= 12 milliseconds
99.99% <= 14 milliseconds
100.00% <= 31 milliseconds
100.00% <= 32 milliseconds
100.00% <= 32 milliseconds
73351.42 requests per second
```

可以看出，在进行lzf压缩后，插入、弹出元素的时间相差无几，但是实际的空间占用降到了`74930099`，即约71M，空间节省极大。


### linkedlist的性能

在redis中，通过两处配置定义list底层使用的数据结构。`list-max-ziplist-entries`表示ziplist元素最大值，list-max-ziplist-value表示单个节点的最大长度。
```bash
# Similarly to hashes, small lists are also encoded in a special way in order
# to save a lot of space. The special representation is only used when
# you are under the following limits:
list-max-ziplist-entries 512
list-max-ziplist-value 64
```

如果元素的值的长度或者数量超过了配置值的任何一个，则ziplist会自动转变为linkedlist并且不会退化回ziplist，转换的代码如下，可以看到只允许转为`REDIS_ENCODING_LINKEDLIST`的单向转换。

```c
void listTypeConvert(robj *subject, int enc) {
    listTypeIterator *li;
    listTypeEntry entry;
    redisAssertWithInfo(NULL,subject,subject->type == REDIS_LIST);

    if (enc == REDIS_ENCODING_LINKEDLIST) {
        list *l = listCreate();
        listSetFreeMethod(l,decrRefCountVoid);

        /* listTypeGet returns a robj with incremented refcount */
        li = listTypeInitIterator(subject,0,REDIS_TAIL);
        while (listTypeNext(li,&entry)) listAddNodeTail(l,listTypeGet(&entry));
        listTypeReleaseIterator(li);

        subject->encoding = REDIS_ENCODING_LINKEDLIST;
        zfree(subject->ptr);
        subject->ptr = l;
    } else {
        redisPanic("Unsupported list conversion");
    }
}
```

因此启动`redis-server`时显式的指定`list-max-ziplist-entries`为0即可使用linkedlist进行测试。

插入100条数据：

```bash
$ redis-benchmark -t lpush -n 100
====== LPUSH ======
  1000 requests completed in 0.01 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

100.00% <= 0 milliseconds
66666.67 requests per second

```

通过redisinsight分析其实际使用内存44kb，即单个元素占用约45字节，空间利用率约6.7%。

同样，插入1000000个定长数据：

```bash
$ redis-benchmark -t lpush -n 1000000

====== LPUSH ======
  1000000 requests completed in 13.08 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.75% <= 1 milliseconds
99.72% <= 2 milliseconds
99.83% <= 3 milliseconds
99.87% <= 4 milliseconds
99.90% <= 5 milliseconds
99.92% <= 6 milliseconds
99.94% <= 7 milliseconds
99.95% <= 8 milliseconds
99.96% <= 9 milliseconds
99.96% <= 10 milliseconds
99.97% <= 11 milliseconds
99.97% <= 12 milliseconds
99.99% <= 13 milliseconds
100.00% <= 28 milliseconds
100.00% <= 29 milliseconds
100.00% <= 30 milliseconds
76440.91 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7fc41b433aa0 refcount:1 encoding:linkedlist serializedlength:4000005 lru:472156 lru_seconds_idle:24


$ redis-benchmark -t lpop -n 1000000
====== LPOP ======
  1000000 requests completed in 13.80 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.47% <= 1 milliseconds
99.65% <= 2 milliseconds
99.80% <= 3 milliseconds
99.87% <= 4 milliseconds
99.89% <= 5 milliseconds
99.91% <= 6 milliseconds
99.92% <= 7 milliseconds
99.94% <= 8 milliseconds
99.95% <= 9 milliseconds
99.97% <= 10 milliseconds
99.97% <= 11 milliseconds
99.98% <= 12 milliseconds
99.98% <= 13 milliseconds
99.98% <= 14 milliseconds
99.99% <= 15 milliseconds
99.99% <= 17 milliseconds
99.99% <= 21 milliseconds
99.99% <= 22 milliseconds
99.99% <= 26 milliseconds
100.00% <= 27 milliseconds
100.00% <= 29 milliseconds
100.00% <= 30 milliseconds
100.00% <= 30 milliseconds
72442.77 requests per second
```

其实际使用内存43M，即单个节点使用约45字节的空间，空间利用率约6.7%。但是在插入与弹出的时间消耗上，和quicklist相差不大。

再看看插入长字符串的情况：

```bash
$ redis-benchmark -n 1000000 lpush mylist "mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial"
====== lpush mylist mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial ======
  1000000 requests completed in 14.24 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

97.33% <= 1 milliseconds
99.64% <= 2 milliseconds
99.83% <= 3 milliseconds
99.87% <= 4 milliseconds
99.91% <= 5 milliseconds
99.93% <= 6 milliseconds
99.94% <= 7 milliseconds
99.94% <= 8 milliseconds
99.97% <= 9 milliseconds
99.98% <= 10 milliseconds
99.98% <= 11 milliseconds
99.99% <= 12 milliseconds
99.99% <= 13 milliseconds
100.00% <= 15 milliseconds
100.00% <= 16 milliseconds
100.00% <= 17 milliseconds
100.00% <= 18 milliseconds
100.00% <= 25 milliseconds
100.00% <= 25 milliseconds
70239.52 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7fc616f03f80 refcount:1 encoding:linkedlist serializedlength:371000005 lru:473445 lru_seconds_idle:26

$ redis-benchmark -t lpop -n 1000000
====== LPOP ======
  1000000 requests completed in 12.65 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

98.67% <= 1 milliseconds
99.78% <= 2 milliseconds
99.89% <= 3 milliseconds
99.90% <= 4 milliseconds
99.92% <= 5 milliseconds
99.95% <= 6 milliseconds
99.95% <= 7 milliseconds
99.97% <= 8 milliseconds
99.98% <= 9 milliseconds
99.98% <= 10 milliseconds
99.98% <= 11 milliseconds
99.99% <= 12 milliseconds
100.00% <= 13 milliseconds
100.00% <= 13 milliseconds
79026.39 requests per second
```

通过redisinsight分析其实际使用内存488M，即单个节点使用约512字节的空间，空间利用率约90.4%。但是在插入与弹出的时间消耗上，和quicklist以及短字符串插入都相差不大。

### ziplist的性能

最后再看看ziplist的表现。设置`list-max-ziplist-entries`与`list-max-ziplist-value`为较大的值来启动redis-server，保证使用ziplist编码来实现list。我们先插入比较少的数据：

```bash
$ redis-benchmark -t lpush -n 100
====== LPUSH ======
  100 requests completed in 0.00 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

100.00% <= 0 milliseconds
50000.00 requests per second


$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7f82e9100890 refcount:1 encoding:ziplist serializedlength:30 lru:473656 lru_seconds_idle:36

$ redis-benchmark -t lpop -n 100
====== LPOP ======
  100 requests completed in 0.00 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

100.00% <= 0 milliseconds
33333.33 requests per second
```

分析内存占用，100个元素总共占用约553字节空间，平均一个元素约5.5字节，空间利用率约54.5%。

因为ziplist插入数据量过大可能非常的慢，甚至每秒的请求数量能到个位数，因此来看看插入100000个元素的情况：

```bash
$ redis-benchmark -t lpush -n 100000
====== LPUSH ======
  100000 requests completed in 39.20 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

37.85% <= 1 milliseconds
64.63% <= 2 milliseconds
65.22% <= 3 milliseconds
65.37% <= 4 milliseconds
65.43% <= 5 milliseconds
65.43% <= 6 milliseconds
65.45% <= 7 milliseconds
65.47% <= 9 milliseconds
65.47% <= 11 milliseconds
65.47% <= 12 milliseconds
65.47% <= 13 milliseconds
65.48% <= 14 milliseconds
65.53% <= 15 milliseconds
65.53% <= 16 milliseconds
65.53% <= 17 milliseconds
65.53% <= 18 milliseconds
65.53% <= 19 milliseconds
65.54% <= 20 milliseconds
65.54% <= 23 milliseconds
65.54% <= 26 milliseconds
65.54% <= 27 milliseconds
65.54% <= 28 milliseconds
65.54% <= 29 milliseconds
65.55% <= 30 milliseconds
65.55% <= 32 milliseconds
65.55% <= 34 milliseconds
65.55% <= 35 milliseconds
65.56% <= 36 milliseconds
65.56% <= 38 milliseconds
65.57% <= 39 milliseconds
65.57% <= 40 milliseconds
65.57% <= 41 milliseconds
65.58% <= 42 milliseconds
65.97% <= 43 milliseconds
67.04% <= 44 milliseconds
68.92% <= 45 milliseconds
70.23% <= 46 milliseconds
71.32% <= 47 milliseconds
72.07% <= 48 milliseconds
72.97% <= 49 milliseconds
74.51% <= 50 milliseconds
76.12% <= 51 milliseconds
78.02% <= 52 milliseconds
80.05% <= 53 milliseconds
81.86% <= 54 milliseconds
83.42% <= 55 milliseconds
84.66% <= 56 milliseconds
86.14% <= 57 milliseconds
87.74% <= 58 milliseconds
89.33% <= 59 milliseconds
90.45% <= 60 milliseconds
91.75% <= 61 milliseconds
93.67% <= 62 milliseconds
95.49% <= 63 milliseconds
96.69% <= 64 milliseconds
97.84% <= 65 milliseconds
98.68% <= 66 milliseconds
99.03% <= 67 milliseconds
99.20% <= 68 milliseconds
99.43% <= 69 milliseconds
99.54% <= 70 milliseconds
99.66% <= 71 milliseconds
99.78% <= 72 milliseconds
99.84% <= 73 milliseconds
99.87% <= 74 milliseconds
99.90% <= 75 milliseconds
99.92% <= 76 milliseconds
99.93% <= 77 milliseconds
99.96% <= 78 milliseconds
99.97% <= 79 milliseconds
99.99% <= 80 milliseconds
100.00% <= 81 milliseconds
2551.15 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7f82e9100890 refcount:1 encoding:ziplist serializedlength:30 lru:473656 lru_seconds_idle:36

$ redis-benchmark -t lpop -n 100000
====== LPOP ======
  100000 requests completed in 21.04 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

42.08% <= 1 milliseconds
63.70% <= 2 milliseconds
65.00% <= 3 milliseconds
65.26% <= 4 milliseconds
65.36% <= 5 milliseconds
65.37% <= 6 milliseconds
65.38% <= 7 milliseconds
65.39% <= 8 milliseconds
65.44% <= 9 milliseconds
65.45% <= 10 milliseconds
65.50% <= 11 milliseconds
65.54% <= 12 milliseconds
65.54% <= 13 milliseconds
65.54% <= 14 milliseconds
65.55% <= 15 milliseconds
65.56% <= 16 milliseconds
65.57% <= 17 milliseconds
65.60% <= 18 milliseconds
65.68% <= 19 milliseconds
65.80% <= 20 milliseconds
66.01% <= 21 milliseconds
66.39% <= 22 milliseconds
67.35% <= 23 milliseconds
69.41% <= 24 milliseconds
72.64% <= 25 milliseconds
75.51% <= 26 milliseconds
77.92% <= 27 milliseconds
80.83% <= 28 milliseconds
83.25% <= 29 milliseconds
87.63% <= 30 milliseconds
91.26% <= 31 milliseconds
94.02% <= 32 milliseconds
96.35% <= 33 milliseconds
97.76% <= 34 milliseconds
98.78% <= 35 milliseconds
99.20% <= 36 milliseconds
99.45% <= 37 milliseconds
99.56% <= 38 milliseconds
99.66% <= 39 milliseconds
99.70% <= 40 milliseconds
99.78% <= 41 milliseconds
99.84% <= 42 milliseconds
99.86% <= 43 milliseconds
99.87% <= 44 milliseconds
99.90% <= 45 milliseconds
99.92% <= 46 milliseconds
99.99% <= 47 milliseconds
99.99% <= 48 milliseconds
100.00% <= 48 milliseconds
4753.08 requests per second
```

显然，插入的速度相比quicklist、linkedlist以及小规模数据量的ziplist时明显慢了许多。并且能看到，随着数据插入越来越多，插入的速度越来越慢，从数万左右的每秒请求数量慢慢下降到最后的几千每秒请求数量。在100000个元素时，内存占用约488kb，即每个元素约5.0字节，空间利用率约60%，可以看到，空间的占用几乎是线性的关系，并且空间利用率反而增加了一些。

在弹出数据时可以看到，速度越来越快，从1k左右上升到最终的数万每秒请求数量。

对于长字符串的插入，先插入100条：

```bash
$ redis-benchmark -n 100 lpush mylist "mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial"

====== lpush mylist mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial ======
  100 requests completed in 0.00 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

20.00% <= 1 milliseconds
100.00% <= 1 milliseconds
25000.00 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7f82e7f03b40 refcount:1 encoding:ziplist serializedlength:1130 lru:475907 lru_seconds_idle:55

$ redis-benchmark -t lpop -n 100
====== LPOP ======
  100 requests completed in 0.00 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

46.00% <= 1 milliseconds
100.00% <= 1 milliseconds
33333.33 requests per second
```

可以看出，插入的时间明显比短字符串更多。插入后总共占用了47kb空间，即每个元素约481字节空间，空间利用率约96.3%。

再来看长字符串的批量插入（日志有删减）：

```bash
$ redis-benchmark -n 100000 lpush mylist "mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial"

====== lpush mylist mylist str len: 463. Redis is not a plain key-value store, it is actually a data structures server, supporting different kinds of values. What this means is that, while in traditional key-value stores you associated string keys to string values, in Redis the value is not limited to a simple string, but can also hold more complex data structures. The following is the list of all the data structures supported by Redis, which will be covered separately in this tutorial ======
  100000 requests completed in 361.97 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1

0.34% <= 1 milliseconds
1.22% <= 2 milliseconds
1.84% <= 3 milliseconds
3.02% <= 4 milliseconds
3.97% <= 5 milliseconds
4.91% <= 6 milliseconds
5.91% <= 7 milliseconds
6.47% <= 8 milliseconds
7.25% <= 9 milliseconds
7.78% <= 10 milliseconds
13.51% <= 20 milliseconds
18.07% <= 30 milliseconds
23.39% <= 40 milliseconds
28.43% <= 50 milliseconds
33.09% <= 60 milliseconds
36.63% <= 70 milliseconds
41.06% <= 80 milliseconds
46.23% <= 90 milliseconds
49.85% <= 100 milliseconds
61.87% <= 120 milliseconds
64.51% <= 140 milliseconds
65.13% <= 170 milliseconds
65.46% <= 202 milliseconds
66.86% <= 320 milliseconds
71.61% <= 350 milliseconds
78.91% <= 380 milliseconds
84.36% <= 410 milliseconds
90.07% <= 440 milliseconds
95.08% <= 470 milliseconds
98.34% <= 510 milliseconds
99.45% <= 543 milliseconds
99.80% <= 570 milliseconds
100.00% <= 746 milliseconds
276.26 requests per second

$ redis-cli
127.0.0.1:6379> DEBUG OBJECT mylist
Value at:0x7f82e7e02660 refcount:1 encoding:ziplist serializedlength:661619 lru:476557 lru_seconds_idle:579

$ redis-benchmark -t lpop -n 100000
====== LPOP ======
  100000 requests completed in 344.83 seconds
  50 parallel clients
  3 bytes payload
  keep alive: 1
0.31% <= 1 milliseconds
1.17% <= 2 milliseconds
2.41% <= 3 milliseconds
3.35% <= 4 milliseconds
4.14% <= 5 milliseconds
5.10% <= 6 milliseconds
5.84% <= 7 milliseconds
6.73% <= 8 milliseconds
7.50% <= 9 milliseconds
8.19% <= 10 milliseconds
55.85% <= 100 milliseconds
65.55% <= 211 milliseconds
85.84% <= 300 milliseconds
99.40% <= 400 milliseconds
100.00% <= 72866 milliseconds
290.00 requests per second
```
可以看到，在单个元素比较大时，插入、弹出ziplist会更加的耗时，但是内存总共占用45M，即单个元素占用约472字节内存，内存利用率达到98%。

### 总结

从上面的试验可以看到，ziplist对空间的利用率非常高，在数据规模比较小时，耗时相对可接受，但是对于元素比较多或者是单个元素比较长时，插入、弹出的耗时非常大。而linkedlist在插入、删除元素时，元素数量、单个元素的长度对耗时影响小（耗时分布比较集中），但是空间利用率比较差，特别是数据规模较小时，空间利用率非常差。而quicklist结合了二者的优点，首先时间消耗上，数据规模对其影响小，其次是空间利用率，因为底层使用了ziplist，所以在小规模数据上空间表现也良好。


