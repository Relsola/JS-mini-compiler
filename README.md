# JavaScript-mini-compiler

这里使用 `JavaScript` 实现一个微型编译器：
=> 2 + (4 - 2)
将 `(add 2 (subtract 4 2)` 语法编译为 `add(2, subtract(4, 2))`，
这个微型编译器能让你入门了解编译器的简单实现原理。

大多数编译器分为三个主要阶段:

1. 解析：将原始代码转化为更抽象代码的表示。
2. 转换：采用这种抽象的表示和操作来做编译器希望它做的任何事情。
3. 代码生成：获取代码的转换表示并将其转换为新代码。

## 解析

解析通常分为两个阶段：

### 1. 词法分析

使用词法分析器将原始代码分割成叫做标记的东西。

标记是一组描述语法中孤立部分的微小对象，它们可以是数字、标签、标点符号、运算符，等等。

### 2. 语法分析

将标记重新格式化为描述语法中每个部分及其相互关系的表示形式，这被称为抽象语法树。

抽象语法树(简称 `AST`)是一个深度嵌套的对象，它以一种既易于使用又能告诉我们很多信息的方式表示代码。

这里以 `(add 2 (subtract 4 2))` 为示例：

标记可是是这样的：

```JavaScript
[
	{ type: 'paren', value: '(' },
	{ type: 'name', value: 'add' },
	{ type: 'number', value: '2' },
	{ type: 'paren', value: '(' },
	{ type: 'name', value: 'subtract' },
	{ type: 'number', value: '4' },
	{ type: 'number', value: '2' },
	{ type: 'paren', value: ')' },
	{ type: 'paren', value: ')' }
];
```

转换成 `AST`：

```JavaScript
{
	type: 'Program',
	body: [
		{
			type: 'CallExpression',
			name: 'add',
			params: [
				{
					type: 'NumberLiteral',
					value: '2'
				},
				{
					type: 'CallExpression',
					name: 'subtract',
					params: [
						{
							type: 'NumberLiteral',
							value: '4'
						},
						{
							type: 'NumberLiteral',
							value: '2'
						}
					]
				}
			]
		}
	]
};
```

## 转换

编译器从上一步中提取 `AST` 并对其进行修改。它可以用相同的语言处理 `AST`，也可以将其翻译成一种全新的语言。
`AST` 对象中的 `node` 元素都带有 `type` 属性，每一个 `AST` 节点都有定义好的属性，用来描述树中的一个孤立部分。

转换 `AST` 时，我们可以通过添加/删除/替换属性进行添加新节点，删除节点，或者保留现有的 `AST`，然后在此基础上创建一个全新的 `AST`。

为了浏览所有 `node`，我们需要能够遍历它们，这个遍历过程对 `AST` 中的每个节点都是深度优先。

如果我们直接操作这个 `AST`，而不是创建一个单独的 `AST` 很可能会在这里引入各种抽象概念，
但这个项目里仅仅访问 `AST` 树中的每个 `node` 就足够了。

访问的基本思想是，我们将创建一个 `visitor` 对象，它具有接受不同 `node.type` 的方法。

```JavaScript
const visitor = {
	NumberLiteral() {},
	CallExpression() {}
};
const visitor = {
	NumberLiteral(node, parent) {},
	CallExpression(node, parent) {}
};
```

当我们遍历 `AST` 时，每当我们进入匹配的 `node.type` 时，都会调用 `visitor` 的方法。
为了让它更有用，我们还将传递当前节点和指向父节点的引用。

```JavaScript
const visitor = {
	NumberLiteral(node, parent) {},
	CallExpression(node, parent) {}
};
```

注意进行遍历访问的顺序：

```JavaScript
-->   Program
    -->   CallExpression
        -->   NumberLiteral
        -->   CallExpression
            -->   NumberLiteral
            -->   NumberLiteral

// 可以理解为进出栈
-->  Program (enter)
  -->  CallExpression (enter)
    -->  Number Literal (enter)
    -->  Number Literal (exit)
    -->  Call Expression (enter)
       -->  Number Literal (enter)
       -->  Number Literal (exit)
       -->  Number Literal (enter)
       -->  Number Literal (exit)
    -->  CallExpression (exit)
  --> CallExpression (exit)
-->  Program (exit)
```

为了支持这一点，我们的访问者的最终形式将如下所示：

```JavaScript
const visitor = {
	NumberLiteral: {
		enter(node, parent) {},
		exit(node, parent) {}
	}
};
```

## 代码生成：

编译器的最后阶段是代码生成，有时编译器会做与转换重叠的事情。
但在大多数情况下，代码生成只是将我们的 `AST` 转化为字符串代码返回出来。

代码生成器有几种不同的工作方式，有的编译器会重复使用之前的标记，有的编译器会为代码创建一个单独的表示法，这样它们就能打印出代码。
代码的单独表示法，以便线性打印节点，会使用我们刚刚创建的 `AST`，这也是我们要关注的。

编译器有许多不同的用途，它们需要的步骤可能比这里详述的更多，但现在你应该对大多数编译器的样子有了一个大致的高层次概念。
