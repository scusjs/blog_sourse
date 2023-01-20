title: 统计学习方法（笔记）-感知机
mathjax: true
date: 2016-11-01 09:54:35
categories: 统计学习
description:
tags:
- 统计学习
- 笔记
- 机器学习
- 感知机

---

感知机是二分类的线性分类模型，对应于输入空间中将实例划分为正负两类的分离超平面，属于判别模型。

# 感知机模型

$$f(x)=sign(w·x+b)$$

其中，w 和 b 为感知机模型参数，$w \in R^n$称为权指或者权指向量，$b \in R$称为偏置，$w·x$表示 w 和 x 的内积。sign 是符号函数，定义为：

$$sign(x)= \begin {cases} +1,x\geq 0\\\ -1,x\lt 0\end {cases}$$

其中，$f(x)=w·x+b$叫做线性分类器，线性方程$f(x)=0$对应于特征空间中$R^n$的一个超平面 S，其中 w 是其法向量，b 是截距。S 将空间划分为两部分，位于两部分的点被分为正负两类，如图：

<img src="/images/statistical-learning-method/1477967448.jpg"  title="感知机模型" alt="感知机模型"/>
# 感知机学习策略

能够将数据集的正实例和负实例点完全正确的划分到超平面的两侧，则数据集为线性可分数据集，否则为线性不可分。感知机学习目标是求得一个能够将数据集正实例点和负实例点完全正确分开的分离超平面。

损失函数选择能对参数 w 和 b 连续可导的函数，即误分类点到 S 的总距离。

点$(x_0,y_0)$到 S 的距离为：

$$\frac{1}{||w||}|w·x_0+b|$$

又，对于误分类点$(x_i,y_i)$来说，$-y_i(w·x_i+b)\gt 0$，因此，对于所有的误分类点集合 M，到超平面总距离为：

$$-\frac{1}{||w||}\sum_{x_i \in M} y_i(w·x_i+b)$$

不考虑$\frac{1}{||w||}$，得到感知机学习的损失函数：

$$L(w,b)=-\sum_{x_i \in M} y_i(w·x_i+b)$$

# 感知机学习算法

感知机学习算法是误分类驱动的，最小化损失函数即可：$\min \limits_{w,b} L(w,b)$，采用梯度下降法求取 w 和 b。

随机选出误分类点$(x_i,y_i)$，对 w，b 进行更新:

$$\begin{cases} w \leftarrow w+\eta y_i x_i \\\ b \leftarrow b+\eta y_i\end{cases}$$

式中$\eta (0\lt \eta \le 1)$是步长，也叫学习率。通过迭代使 L(w,b) 不断减小，直至为0。

可以证明，误分类次数 k 是有上界的，经过有限次搜索可以找到将训练数据完全分开的分离超平面，即如果训练数据集线性可分，则感知机学习算法原始形式迭代是收敛的。

# 感知机学习算法的对偶形式

上述更新 w 和 b 的过程，设修改 n 次，则 w，b 关于$(x_i,y_i)$的增量分别是$\alpha_{i} y_i x_i$和$\alpha_{i} y_i$，这里$\alpha_{i}=n_i\eta$，假设$w_0$和$b_0$均取0，则：

$$\begin{cases} w = \sum \limits_{i=1}^N \alpha_{i} y_i x_i \\\ b = \sum \limits_{i=1}^N \alpha_{i} y_i\end{cases}$$

这时，如果误分类，即：$y_i(\sum \limits_{j=1}^N \alpha_{j}y_jx_j+b)\leq 0$，则更新：

$$\begin{cases} \alpha_{i} \leftarrow \alpha_{i} + \eta \\\ b \leftarrow b + \eta y_i \end{cases}$$

# 算法特点

当训练数据集线性可分时，感知机学习算法存在无穷多个解，其解由于不同的初始值或不同的迭代顺序而有可能不同。

样本集线性可分的充要条件是正实例点集所构成的凸壳和负实例点集所构成的凸壳互不相交。


