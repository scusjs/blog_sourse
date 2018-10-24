title: 最长公共子序列问题
date: 2016-01-05 17:35:23
categories: 算法
description: 通过给定序列求最长公共子序列。使用动态规划求解。
tags:
- algorithms
- LCS
- dynamic programming
mathjax: true
---
首先定义子序列，形式化定义为：给定一个序列$X=\\{x\_1,x\_2,...,x\_m\\}$，另一个序列$Z=\\{z\_1,z\_2,...,z\_k\\}$满足如下条件时称为X的子序列，即存在一个严格递增的X的下标序列$\\{i\_1,i\_2,...,i\_k\\}$，对所有$j=1,2,...,k$，满足，$x\_{i_j} = z_j$例如，$Z=\\{B,C,D,B\\}$是$X=\\{A,B,C,B,D,A,B\\}$的子序列，对应的下标序列为$\\{2,3,5,7\\}$。

给定两个序列 X 和 Y，如果 Z 既是 X 的子序列，也是 Y 的子序列，则称它是 X 和 Y 的公共子序列。

求两个序列的最长公共子序列，可以使用动态规划求解。

刻画最长公共子序列特征
---

（LCS 的最优子结构）令$X=\\{x\_1,x\_2,...,x\_m\\}$和$Y=\\{y\_1,y\_2,...,y\_n\\}$为两个序列，$Z=\\{z\_1,z\_2,...,z\_k\\}$为 X 和 Y 的任意 LCS。

1. 如果$x\_m = y\_n$，则$z\_k=x\_m=y\_n$，且$Z\_{k-1}$是$X\_{m-1}$和$Y\_{n-1}$的一个 LCS；
2. 如果$x\_m \neq y\_n$，那么$z\_k \neq x\_m$意味着 Z 是$X\_{m-1}$和 Y 的一个 LCS；
3. 如果$x\_m \neq y\_n$，那么$z\_k \neq y\_n$意味着 Z 是$Y\_{n-1}$和 Y 的一个 LCS。

一个递归解
---

定义$c[i,j]$表示$X\_i$和$Y\_j$的 LCS 长度，根据最优子结构性质易得：
$\begin{equation}\label{Dirichlet}
c[i,j]=\begin{cases} 
0, & \text{ 若 } i=1或i=0\\\ 
c[i-1,j-1] + 1, & \text{ 若 } i,j \>0且x_i = y_j\\\ 
max(c[i-1,j], c[i,j-1]), & \text{ 若 } i,j \>0且x_i \neq y_j
\end{cases}\end{equation}$

计算 LCS 的长度
---

由上式可以很容易写出一个指数时间的递归算法来计算。但是 LCS 问题只有$\Theta (mn)$个子问题，可以使用动态规划自底向上计算。运行时间为$\Theta (mn)$。

假设一个表格C，c[i,j]表示$A\_i$和$B\_j$的最长 LCS。

C++实现代码如下：

	#include <iostream>
	#include <vector>
	
	using namespace std;
	
	void get_lcs(string x, string y, vector<vector<int>> &c) {
		for (int i = 0; i < x.size(); ++i)
			for (int j = 0; j < y.size(); ++j) {
				if (x[i] == y[j])
					c[i + 1][j + 1] = c[i][j] + 1;
				else
					c[i + 1][j + 1] = c[i][j + 1] > c[i + 1][j] ? c[i][j + 1] : c[i + 1][j];
			}
	}
	
	void print_lcs(string x, vector<vector<int>> c) {
		int i = c.size() - 1;
		int j = c[0].size() -1;
		string result = "";
		while (i > 0 && j > 0) {
			if (c[i][j] > c[i - 1][j] && c[i][j] > c[i][j - 1]) {
				i--;
				j--;
				result = result + x[i];
			}
			else if (c[i][j] > c[i - 1][j]) {
				j--;
			}
			else
				i--;
		}
		cout << result;
	}
	
	int main() {
		string x = "10010101";
		string y = "010110110";
		vector<vector<int>> c;
		for (int i = 0; i <= x.size(); ++i) {
			vector<int> tmp;
			tmp.resize(y.size() + 1);
			c.push_back(tmp);
		}
		get_lcs(x, y, c);
		print_lcs(x, c);
		return 0;
	}


构造 LCS
---

上面代码 print_lcs()函数构造 LCS。从 i，j 取最大值开始，由于每个c[i,j]只依赖于其他三项，c[i-1,j]，c[i,j-1]，c[i-1,j-1]，所以可以在$O(1)$的时间内判断出来使用了哪一项。

