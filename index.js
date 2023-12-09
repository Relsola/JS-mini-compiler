'use strict';

// 将把代码串分解成一个数组  (add 2 (subtract 4 2)) => [{ type: 'paren', value: '(' }, ...]]
function tokenizer(input) {
	let current = 0;
	const tokens = [];

	const WHITESPACE = /\s/;
	const NUMBERS = /\d/;
	const LETTERS = /[a-z]/i;
	while (current < input.length) {
		let char = input[current];

		if (char == '(') {
			tokens.push({ type: 'paren', value: '(' });
			current++;
			continue;
		}

		if (char == ')') {
			tokens.push({ type: 'paren', value: ')' });
			current++;
			continue;
		}

		// 空字符
		if (WHITESPACE.test(char)) {
			current++;
			continue;
		}

		//   (add 123 456)
		//        ^^^ ^^^
		//    Only two separate number tokens

		if (NUMBERS.test(char)) {
			let value = '';
			while (NUMBERS.test(char)) {
				value += char;
				char = input[++current];
			}
			tokens.push({ type: 'number', value });
			continue;
		}

		//   (concat "foo" "bar")
		//            ^^^   ^^^
		//   string tokens

		if (char === '"') {
			let value = '';
			char = input[++current];
			while (char !== '"') {
				value += char;
				char = input[++current];
			}
			current++;
			tokens.push({ type: 'string', value });
			continue;
		}

		//   (add 2 4)
		//    ^^^
		//    Name token

		if (LETTERS.test(char)) {
			let value = '';
			while (LETTERS.test(char)) {
				value += char;
				char = input[++current];
			}
			tokens.push({ type: 'name', value });
			continue;
		}

		// 最后，如果我们到现在还没有匹配到一个字符，我们将抛出错误并完全退出。
		throw new TypeError("I don't know what this character is: " + char);
	}

	return tokens;
}

// 把标记数组转换成一个AST [{ type: 'paren', value: '(' }, ...]   =>   { type: 'Program', body: [...] }
function parser(tokens) {
	let current = 0;

	// 使用递归
	function walk() {
		const { type, value } = tokens[current];

		// 将不同标记转换成 AST 节点
		if (type === 'number') {
			current++;
			return { type: 'NumberLiteral', value };
		}

		if (type === 'string') {
			current++;
			return { type: 'StringLiteral', value };
		}

		if (type === 'paren' && value === '(') {
			// 在递归中跳过，因为 AST 并不关注它
			let token = tokens[++current];

			// 一个表达式
			const node = {
				type: 'CallExpression',
				name: token.value,
				params: []
			};

			token = tokens[++current];
			// 如果没有遇到 ')' 就往表达式中添加参数
			while (
				token.type !== 'paren' ||
				(token.type === 'paren' && token.value !== ')')
			) {
				// 进行递归
				node.params.push(walk());
				token = tokens[current];
			}

			current++;
			return node;
		}

		throw new TypeError(type);
	}

	// 程序的开始
	const ast = { type: 'Program', body: [] };

	// 解析多个表达式 =>  (add 2 2) (subtract 4 2)
	while (current < tokens.length) {
		ast.body.push(walk());
	}

	return ast;
}

/* 
匹配 AST 节点，每次匹配到节点调用 visitor 方法
traverse(ast, {
  Program: {
    enter(node, parent) {
      // ...
    },
    exit(node, parent) {
      // ...
    },
  },

  CallExpression: {
    enter(node, parent) {
      // ...
    },
    exit(node, parent) {
      // ...
    },=
  },

  NumberLiteral: {
    enter(node, parent) {
      // ...
    },
    exit(node, parent) {
      // ...
    },
  },
});

*/

function traverser(ast, visitor) {
	// 遍历使每个节点调用 traverseNode
	function traverseArray(array, parent) {
		array.forEach(child => {
			traverseNode(child, parent);
		});
	}

	// 接收一个 AST 节点 和它的父节点 传递给 visitor 方法
	function traverseNode(node, parent) {
		const methods = visitor[node.type];
		// 如果存在该节点类型的 enter 方法，进行调用
		if (methods && methods.enter) {
			methods.enter(node, parent);
		}

		// 递归遍历
		switch (node.type) {
			case 'Program':
				traverseArray(node.body, node);
				break;

			case 'CallExpression':
				traverseArray(node.params, node);
				break;

			case 'NumberLiteral':
			case 'StringLiteral':
				break;

			default:
				throw new TypeError(node.type);
		}

		if (methods && methods.exit) {
			methods.exit(node, parent);
		}
	}

	// 如果该节点类型有一个 exit 方法，进行调用
	traverseNode(ast, null);
}

/* 
转换，通过 visitor 创建一个新的 AST，需要重点理解

----------------------------------------------------------------------------
  Original AST                     |   Transformed AST
----------------------------------------------------------------------------
  {                                |   {
    type: 'Program',               |     type: 'Program',
    body: [{                       |     body: [{
      type: 'CallExpression',      |       type: 'ExpressionStatement',
      name: 'add',                 |       expression: {
      params: [{                   |         type: 'CallExpression',
        type: 'NumberLiteral',     |         callee: {
        value: '2'                 |           type: 'Identifier',
      }, {                         |           name: 'add'
        type: 'CallExpression',    |         },
        name: 'subtract',          |         arguments: [{
        params: [{                 |           type: 'NumberLiteral',
          type: 'NumberLiteral',   |           value: '2'
          value: '4'               |         }, {
        }, {                       |           type: 'CallExpression',
          type: 'NumberLiteral',   |           callee: {
          value: '2'               |             type: 'Identifier',
        }]                         |             name: 'subtract'
      }]                           |           },
    }]                             |           arguments: [{
  }                                |             type: 'NumberLiteral',
                                   |             value: '4'
---------------------------------- |           }, {
                                   |             type: 'NumberLiteral',
                                   |             value: '2'
                                   |           }]
 (sorry the other one is longer.)  |         }
                                   |       }
                                   |     }]
                                   |   }
----------------------------------------------------------------------------
*/
function transformer(ast) {
	// 新 AST 及其程序的起点
	const newAst = { type: 'Program', body: [] };

	// 使访问的上下文保存在父结点中，可以使转化变简单
	ast._context = newAst.body;

	traverser(ast, {
		// 创建一个新 NumberLiteral 节点并保存在父节点上下文中
		NumberLiteral: {
			enter(node, parent) {
				parent._context.push({
					type: 'NumberLiteral',
					value: node.value
				});
			}
		},

		// 创建一个新 StringLiteral 节点并保存在父节点上下文中
		StringLiteral: {
			enter(node, parent) {
				parent._context.push({
					type: 'StringLiteral',
					value: node.value
				});
			}
		},

		// 创建一个新 CallExpression 节点并保存在父节点上下文中
		CallExpression: {
			enter(node, parent) {
				// 创建一个 CallExpression 节点并嵌套一个 Identifier
				let expression = {
					type: 'CallExpression',
					callee: {
						type: 'Identifier',
						name: node.name
					},
					arguments: []
				};

				// 在原始的节点上定义一个新的上下文，该上下文将引用 CallExpression 的参数
				node._context = expression.arguments;

				// 如果父节点不是 CallExpression
				// 用 ExpressionStatement 节点来封装 "CallExpression" 节点
				// 因为 CallExpression 实际上是语句
				if (parent.type !== 'CallExpression') {
					expression = {
						type: 'ExpressionStatement',
						expression: expression
					};
				}

				parent._context.push(expression);
			}
		}
	});

	return newAst;
}

// 代码生成器将递归调用自身，将 AST 树中的每个节点打印成语法字符串。
function codeGenerator(node) {
	// 根据  node.type 进行细分。
	switch (node.type) {
		// 将 body 中的 node 通过 codeGenerator 映射成语法字符串并拼接
		case 'Program':
			return node.body.map(codeGenerator).join('\n');

		// 调用 codeGenerator 并添加一个分号形成语句
		case 'ExpressionStatement':
			return codeGenerator(node.expression) + ';';

		// 将 CallExpression 表达式 name 和参数进行拼接
		case 'CallExpression':
			return (
				codeGenerator(node.callee) +
				'(' +
				node.arguments.map(codeGenerator).join(', ') +
				')'
			);

		// 表达式的 name
		case 'Identifier':
			return node.name;

		// 数字节点
		case 'NumberLiteral':
			return node.value;

		// 字符串节点
		case 'StringLiteral':
			return '"' + node.value + '"';

		// 其他无法识别的节点，抛出错误
		default:
			throw new TypeError(node.type);
	}
}

function compiler(input) {
	const tokens = tokenizer(input);
	const ast = parser(tokens);
	const newAst = transformer(ast);
	const output = codeGenerator(newAst);

	return output;
}

module.exports = {
	tokenizer,
	parser,
	traverser,
	transformer,
	codeGenerator,
	compiler
};
