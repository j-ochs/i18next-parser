import * as acorn from 'acorn-jsx'
import * as walk from 'acorn/dist/walk'
import BaseLexer from './base-lexer'

export default class JavascriptLexer extends BaseLexer {
  constructor(options = {}) {
    super(options)

    this.acornOptions = { sourceType: 'module', ...options.acorn }
    this.functions = options.functions || ['t']
    this.attr = options.attr || 'i18nKey'
  }

  extract(content) {
    const that = this

    walk.simple(
      acorn.parse(content, this.acornOptions),
      {
        CallExpression(node) {
          that.expressionExtractor.call(that, node)
        }
      }
    )

    return this.keys
  }

  expressionExtractor(node) {
    const entry = {}
    const isTranslationFunction = (
      node.callee && (
        this.functions.includes(node.callee.name) ||
        node.callee.property && this.functions.includes(node.callee.property.name)
      )
    )
    if (isTranslationFunction) {
      const keyArgument = node.arguments.shift()

      if (keyArgument && keyArgument.type === 'Literal') {
        entry.key = keyArgument.value
      }
      else if (keyArgument && keyArgument.type === 'BinaryExpression') {
        const concatenatedString = this.concatenateString(keyArgument)
        if (!concatenatedString) {
          this.emit('warning', `Key is not a string litteral: ${keyArgument.name}`)
          return
        }
        entry.key = concatenatedString
      }
      else {
        if (keyArgument.type === 'Identifier') {
          this.emit('warning', `Key is not a string litteral: ${keyArgument.name}`)
        }

        return
      }


      const optionsArgument = node.arguments.shift()

      if (optionsArgument && optionsArgument.type === 'Literal') {
        entry.defaultValue = optionsArgument.value
      }
      else if (optionsArgument && optionsArgument.type === 'ObjectExpression') {
        optionsArgument.properties.forEach(p => {
          entry[p.key.name || p.key.value] = p.value.value
        })
      }

      this.keys.push(entry)
    }
  }

  concatenateString(binaryExpression, string = '') {
    if (binaryExpression.operator !== '+') {
      return
    }

    if (binaryExpression.left.type === 'BinaryExpression') {
      string += this.concatenateString(binaryExpression.left, string)
    }
    else if (binaryExpression.left.type === 'Literal') {
      string += binaryExpression.left.value
    }
    else {
      return
    }

    if (binaryExpression.right.type === 'BinaryExpression') {
      string += this.concatenateString(binaryExpression.right, string)
    }
    else if (binaryExpression.right.type === 'Literal') {
      string += binaryExpression.right.value
    }
    else {
      return
    }

    return string
  }
}
