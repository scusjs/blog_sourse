title: 统计学习方法（笔记）-k 近邻法
mathjax: true
date: 2016-11-02 16:55:58
categories: 统计学习
description:
tags:
- 统计学习
- 笔记
- 机器学习
- k 邻近法
- knn
---

k 近邻法（knn）是一种基本的分类与回归方法。这里只讨论分类问题。knn 分类可以简单理解为，找到距离输入实例最近的 k 个训练数据集中的实例点，其中多数属于某个类，则新输入的实例也属于某个类。

# knn 算法

根据上述描述，其算法表示为：

$$y=\arg \max \limits_{c_j} \sum \limits_{x_i \in N_{k}(x)} I(y_i = c_j),\quad i=1,2,...,N;j=1,2,...,K$$

其中，$N_{k}(x)$表示涵盖训练集 T 中与 x 最邻近的 k 个点的邻域。I 为指示函数，当$y_i=c_j$时为1，否则为0。

显然，k 近邻法没有显示的学习过程。

# knn 模型

knn 实际使用的模型对应于对特征空间的划分。模型由三个要素——距离度量、k 值的选择和分类策略规则决定。当上面三要素与训练集确定后，对于任意输入实例，所属的类别唯一地确定。

相当于在特征空间中划分一些子空间，判断新输入落入哪个子空间中即可。knn 中，k 为1叫做最近邻。这时候对每个训练集实例点划分一个区域（单元），如图：

<img src="/images/statistical-learning-method/1478078547.jpg"  title="k近邻法的模型对应特征空间的一个划分" alt="k近邻法的模型对应特征空间的一个划分"/>
对于 knn，距离度量是一个比较关键的因素，一般使用欧式距离，也可能使用其他距离。对于两点$x_i,x_j\in \mathcal{X}$，其距离定义为：

$$L_p(x_i,x_j)=(\sum \limits_{l=1}^n |x_i^{(l)}-x_j^{(l)}|^p)^{\frac{1}{p}}$$

这里，$p\geq 1$，p=1 时叫做曼哈顿距离，p=2 时叫做欧式距离，$p=\infty$时，为求各个坐标距离的最大值：

$$L_{\infty}(x_i,x_j)=\max \limits_l|x_i^{(l)}-x_j^{(l)}|$$

不同的距离度量所确定的最近邻点是不同的。如图：

<img src="/images/statistical-learning-method/1478081508.jpg"  title="L_p距离间的关系" alt="L_p距离间的关系"/>
其次，k 值的选择对结果影响也很大。k 较小时，近似误差小，但是估算误差大，噪声对其影响大，模型复杂，容易过拟合；k 较大时，可减小估算误差，但是近似误差大，模型变得简单。在应用时，取较小 k 的值，通过交叉验证来选取合适的值。

knn 的分类策略往往是多数表决，其等价于经验风险最小化。

# kd 树

knn 最简单的实现是线性扫描，但是其开销巨大，不可取。

kd 树是一种对 k 维空间中的实例点进行存储以便对其进行快速检索的二叉树形数据结构。

构造 kd 树相当于不断地用垂直于坐标轴的超平面将 k 维空间切分，构成一系列的 k 维超矩形区域。kd 树的每个节点对应于一个 k 维超矩形区域。通常，一次选择坐标轴对空间切分，选择训练实例点在选定坐标轴的中位数为切分点，直到子区域没有实例点，这样得到的 kd 树是平衡的（搜索效率未必最优）。

搜索时，从根开始，递归向下访问，如果目标点当前维的坐标小于切分点的坐标，则移动到左子树，否则移动到右子树，直到叶节点，这时候取当前叶节点为当前最近点。这时候递归向上回退，如果该节点比当前实例点距离目标点更近，则当前点为当前最近点；检查当前最近点另一个子节点对应的区域是否与目标点为球心、目标点与当前最近点为半径的超球体相交，如果相交则另一个子节点中可能存在更近的点，移动到另一子节点递归进行搜索，如果不想交则向上回退；直到会退到根节点，最后的当前最近点即为目标点的最近邻点。

如果实例点是随机分布的，则搜索的平均复杂度为$O(\log N)$，kd 树更适合训练实例点远大于空间维数时的 k 近邻搜索。当空间位数接近训练实例数时，效率会迅速下降，几乎接近线性扫描。


