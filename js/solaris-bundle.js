(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":3,"isarray":4}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
const game = require('./game');

class Camera extends THREE.PerspectiveCamera {

	constructor() {

		const aspectRatio = game.width / game.height;
		const fieldOfView = 40;
		const nearPlane = 1;
		const farPlane = 10000;

		super(fieldOfView, aspectRatio, nearPlane, farPlane);

		game.scene.add(this);

		// Redéfinir le haut
		this.up.copy(new THREE.Vector3(0, 0, 1));

		// Position de la caméra par rapport au joueur
		this.distanceToPlayer = new THREE.Vector3(0, 10, 5);
	}

	update(event) {

		// Adoucissement du déplacement de la caméra
		const speed = 0.5;
		const target = game.player.position.clone().add(this.distanceToPlayer);
		const position = this.position;

		position.x += (target.x - position.x) / speed * event.delta;
		position.y += (target.y - position.y) / speed * event.delta;
		position.z += (target.z - position.z) / speed * event.delta;

		// Regarder le joueur
		this.lookAt(game.player.getWorldPosition());
	}
}

module.exports = Camera;

},{"./game":8}],6:[function(require,module,exports){
module.exports = {
	red: 0xf25346,
	white: 0xd8d0d1,
	brown: 0x59332e,
	pink: 0xF5986E,
	brownDark: 0x23190f,
	blue: 0x68c3c0
};

},{}],7:[function(require,module,exports){
/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class Controls {

	constructor() {

		this.gamepad = null;
		this.deadzone = 0.2;

		// Contrôleur actuellement utilisé ('gamepad' ou 'keyboard')
		this.controller = 'keyboard';

		// Valeurs sauvegardées
		this.values = {
			keyboard: {},
			gamepad: null
		};

		// Valeurs précédentes
		this.previous = {
			keyboard: {},
			gamepad: null
		};

		// Constantes
		this.GAMEPAD = {
			A: 0,
			B: 1,
			X: 2,
			Y: 3,
			LB: 4,
			RB: 5,
			LT: 6,
			RT: 7,
			BACK: 8,
			START: 9,
			UP: 12,
			DOWN: 13,
			LEFT: 14,
			RIGHT: 15,

			LEFT_X: 0,
			LEFT_Y: 1,
			RIGHT_X: 2,
			RIGHT_Y: 3
		};

		/**
   * Branchement d'une manette
   */
		window.addEventListener("gamepadconnected", event => {

			let gp = event.gamepad;

			console.log("Contrôleur n°%d connecté : %s. %d boutons, %d axes.", gp.index, gp.id, gp.buttons.length, gp.axes.length);

			this.gamepad = gp;
			this.controller = 'gamepad';
		});

		/**
   * Appui sur une touche
   */
		window.addEventListener("keydown", event => {

			this.values.keyboard[event.key] = true;
			this.controller = 'keyboard';
		});

		/**
   * Appui sur une touche
   */
		window.addEventListener("keyup", event => {

			this.values.keyboard[event.key] = false;
			this.controller = 'keyboard';
		});
	}

	/**
  * Mise à jour
  */
	update(event) {

		let gamepads = navigator.getGamepads();
		this.gamepad = gamepads[0];

		if (this.gamepad) {

			const previous = this.previous.gamepad;
			const current = this.copyGamepadValues(this.gamepad);

			if (previous) {

				for (let i = 0; i < current.buttons.length; i++) {

					if (previous.buttons[i].pressed !== current.buttons[i].pressed) {

						this.controller = 'gamepad';
					}
				}

				for (let i = 0; i < current.axes.length; i++) {

					if (previous.axes[i] !== current.axes[i]) {

						this.controller = 'gamepad';
					}
				}
			}

			this.previous.gamepad = this.values.gamepad;
			this.values.gamepad = current;
		}
	}

	/**
  * Transforme un axe de joystick pour prendre en compte la zone morte.
  * @param <Number> axis
  * @return <Number>
  */
	applyDeadzone(x) {

		let deadzone = this.deadzone;

		x = x < 0 ? Math.min(x, -deadzone) : Math.max(x, deadzone);

		return (Math.abs(x) - deadzone) / (1 - deadzone) * Math.sign(x);
	}

	/**
  * Axe X principal (joystick ou souris)
  * @param <Number> gamepadAxisIndex
  * @param <Object> keyboardKeys : { positive: <String>, negative: <String> }
  */
	getAxis(gamepadAxisIndex, keyboardKeys) {

		switch (this.controller) {

			case 'gamepad':

				if (this.values.gamepad === null) return 0;

				return this.values.gamepad.axes[gamepadAxisIndex];

				break;

			default:
			case 'keyboard':

				let positive = this.values.keyboard[keyboardKeys.positive] ? +1 : 0;
				let negative = this.values.keyboard[keyboardKeys.negative] ? -1 : 0;

				return positive + negative;

				break;

		}
	}

	/**
  * Copie toutes les valeurs du gamepad dans un objet
  * @param <Gamepad>
  * @return <Object>
  */
	copyGamepadValues(gamepad) {

		let axes = [];
		let buttons = [];

		for (let i = 0; i < gamepad.buttons.length; i++) {

			buttons[i] = {
				value: gamepad.buttons[i].value,
				pressed: gamepad.buttons[i].pressed
			};
		}

		for (let i = 0; i < gamepad.axes.length; i++) {

			axes[i] = this.applyDeadzone(gamepad.axes[i]);
		}

		return {
			axes: axes,
			buttons: buttons
		};
	}

}

module.exports = Controls;

},{}],8:[function(require,module,exports){
const colors = require('./colors');
const Chance = require('chance');
const game = {};

/**
 * Fichiers JSON
 */
game.files = {
	player: {
		path: '../models/player.json'
	}
};

/**
 * Charger les fichiers
 */
game.load = function (callback) {

	// Loader
	const loader = new THREE.JSONLoader();

	// Vérifier qu'un fichier est chargé
	const isLoaded = file => {

		return file.geometry !== undefined || file.materials !== undefined;
	};

	// Charger chaque fichier
	for (let f in this.files) {

		let file = this.files[f];

		if (!isLoaded(file)) {

			loader.load(file.path, (geometry, materials) => {

				file.geometry = geometry;
				file.materials = materials;

				console.info(`Loaded: ${file.path}`);

				let allLoaded = true;

				for (let ff in this.files) {

					allLoaded = allLoaded && isLoaded(this.files[ff]);
				}

				if (allLoaded) callback();
			});
		}
	}
};

/**
 * Création de la scène
 */
game.createScene = function () {

	// Get the width and the height of the screen,
	// use them to set up the aspect ratio of the camera 
	// and the size of the renderer.
	this.height = window.innerHeight;
	this.width = window.innerWidth;

	// Create the scene
	this.scene = new THREE.Scene();

	// Random
	this.chance = new Chance('4536453');

	// dat.gui
	this.gui = new dat.GUI();

	// Contrôles
	const Controls = require('./solaris-controls');
	this.controls = new Controls();

	// Add a fog effect to the scene same color as the
	// background color used in the style sheet
	// this.scene.fog = new THREE.Fog(new THREE.Color("#5DBDE5"), 150, 300)

	// Create the renderer
	const renderer = this.renderer = new THREE.WebGLRenderer({
		// Allow transparency to show the gradient background
		// we defined in the CSS
		alpha: true,

		// Activate the anti-aliasing this is less performant,
		// but, as our project is low-poly based, it should be fine :)
		antialias: true
	});

	// Define the size of the renderer in this case,
	// it will fill the entire screen
	renderer.setSize(this.width, this.height);

	// Enable shadow rendering
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	// Add the DOM element of the renderer to the 
	// container we created in the HTML
	const container = document.querySelector('main');
	container.appendChild(renderer.domElement);

	// Listen to the screen: if the user resizes it
	// we have to update the camera and the renderer size
	window.addEventListener('resize', () => {

		this.height = window.innerHeight;
		this.width = window.innerWidth;

		renderer.setSize(this.width, this.height);

		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
	}, false);
};

/**
 * Création des lumières
 */
game.createLights = function () {

	// A hemisphere light is a gradient colored light; 
	// the first parameter is the sky color, the second parameter is the ground color, 
	// the third parameter is the intensity of the light
	const hemisphereLight = new THREE.HemisphereLight(new THREE.Color("#FFFFFF"), new THREE.Color("#FFFFFF"), 1);

	// A directional light shines from a specific direction. 
	// It acts like the sun, that means that all the rays produced are parallel. 
	const shadowLight = new THREE.DirectionalLight(0xffffff, 0.3);

	// Set the direction of the light  
	shadowLight.position.set(0, 0, 10);

	// Allow shadow casting 
	shadowLight.castShadow = true;
	// shadowLight.shadowCameraVisible = true

	// // define the visible area of the projected shadow
	shadowLight.shadow.camera.left = -20;
	shadowLight.shadow.camera.right = 20;
	shadowLight.shadow.camera.top = 20;
	shadowLight.shadow.camera.bottom = -20;
	shadowLight.shadow.camera.near = 1;
	shadowLight.shadow.camera.far = 1000;

	// define the resolution of the shadow; the higher the better, 
	// but also the more expensive and less performant
	shadowLight.shadow.mapSize.width = 2048;
	shadowLight.shadow.mapSize.height = 2048;
	this.shadowLight = shadowLight;

	this.scene.add(shadowLight);
	this.scene.add(hemisphereLight);
};

/**
 * Création du sol
 */
game.createObjects = function () {

	const Ground = require('./ground.js');
	const Player = require('./player.js');
	const Camera = require('./camera.js');

	this.ground = new Ground();
	this.player = new Player();

	// Create the camera
	this.camera = new Camera();
};

game.line = function (a, b, color, dashed = false) {

	color = new THREE.Color(color || `hsl(${this.chance.integer({ min: 0, max: 360 })}, 100%, 50%)`);

	let material;

	if (dashed) {
		material = THREE.LineDashedMaterial({
			color: color,
			dashSize: 2,
			gapSize: 3
		});
	} else {
		material = new THREE.LineBasicMaterial({
			color: color
		});
	}

	var geometry = new THREE.Geometry();
	geometry.vertices.push(a);
	geometry.vertices.push(b);

	const line = new THREE.Line(geometry, material);
	line.name = "Line " + this.chance.string();

	return line;
};

/**
 * Boucle du jeu
 */
const event = {
	delta: 0,
	time: 0
};

game.loop = function (time = 0) {

	time /= 1000;

	event.delta = time - event.time;
	event.time = time;

	// Mise à jour des contrôles
	this.controls.update(event);

	// Mise à jour des objets
	this.scene.traverseVisible(child => {

		if (child.name && child.name.match(/^Line/)) {
			child.geometry.verticesNeedUpdate = true;
		}

		child.update && child.update(event);
	});

	// Mise à jour de la caméra
	this.camera.update(event);

	// Affichage
	this.renderer.render(this.scene, this.camera);

	// Prochaine frame
	window.requestAnimationFrame(this.loop.bind(this));
};

module.exports = game;

},{"./camera.js":5,"./colors":6,"./ground.js":9,"./player.js":10,"./solaris-controls":11,"chance":13}],9:[function(require,module,exports){
const game = require('./game');

/**
 * Class Ground
 */
class Ground extends THREE.Mesh {

	/**
  * Ground constructor
  */
	constructor() {

		super();

		this.name = "Ground";

		this.geometry = new THREE.PlaneGeometry(20, 20);

		this.material = new THREE.MeshLambertMaterial({
			color: new THREE.Color('#9DDD87'),
			side: THREE.DoubleSide
		});

		this.castShadow = false;
		this.receiveShadow = true;

		game.scene.add(this);
	}

	/**
  * Mise à jour
  */
	update(delta, time) {}

}

module.exports = Ground;

},{"./game":8}],10:[function(require,module,exports){
const game = require('./game');
const PI = Math.PI;

/**
 * Class Player
 */
class Player extends THREE.SkinnedMesh {

	/**
  * Player constructor
  */
	constructor() {

		const geometry = game.files.player.geometry;

		const materials = game.files.player.materials;
		const material = new THREE.MeshLambertMaterial({
			color: new THREE.Color('#F6C357'),
			skinning: true
		});

		super(geometry, material);

		this.name = "Player";

		this.castShadow = true;
		this.receiveShadow = false;

		// Gestionnaire des animations
		this.mixer = new THREE.AnimationMixer(this);

		// Vitesse de déplacement
		this.velocity = new THREE.Vector3(0, 0, 0);

		// Vitesse de déplacement maximale
		this.maxVelocity = 0.1;

		// Rotation du modèle 3D
		this.geometry.rotateX(Math.PI / 2);
		this.geometry.computeFaceNormals();
		this.geometry.computeVertexNormals();
		this.geometry.computeMorphNormals();

		// Chargement des animations
		this.actions = {};

		for (let i = 0; i < this.geometry.animations.length; i++) {

			const clip = this.geometry.animations[i];
			const action = this.mixer.clipAction(clip);

			action.setEffectiveWeight(1).stop();

			this.actions[clip.name] = action;

			console.log(action);
		}

		game.scene.add(this);
	}

	/**
  * Mise à jour
  */
	update(event) {

		// Joystick / clavier
		const control = new THREE.Vector2(-game.controls.mainAxisX, +game.controls.mainAxisY);

		// Force appliquée sur le joystick
		const force = control.length();

		// Changement de vitesse
		this.velocity.x += (control.x - this.velocity.x) / 0.1 * event.delta;
		this.velocity.y += (control.y - this.velocity.y) / 0.1 * event.delta;

		// Vitesse du personnage en fonction de la force d'appui sur le joystick
		if (force > 0) this.velocity.multiplyScalar(force);

		// Limitation de la vitesse
		this.velocity.clampLength(-this.maxVelocity, +this.maxVelocity);

		// Application de la vitesse sur la position
		this.position.add(this.velocity);

		// Rotation du personnage
		const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);

		// Différence avec l'angle réel
		let diff = targetRotation - this.rotation.z;

		// Aller au plus court
		if (Math.abs(diff) > Math.PI) {

			this.rotation.z += Math.PI * 2 * Math.sign(diff);
			diff = targetRotation - this.rotation.z;
		}

		// Appliquer la différence de rotation sur la rotation réelle
		this.rotation.z += diff / 0.15 * event.delta;

		// Mise à jour de l'animation
		this.mixer.update(event.delta);
	}

	/**
  * Jouer une animation
  */
	play(animName, weight = 1) {
		return this.mixer.clipAction(animName).setEffectiveWeight(weight).play();
	}

}

module.exports = Player;

},{"./game":8}],11:[function(require,module,exports){
const game = require('./game');
const Controls = require('./controls');

/**
 * Gère les contrôles (clavier/souris et manette) du joueur
 */
class SolarisControls extends Controls {

	constructor() {

		super();

		game.gui.add(this, 'mainAxisX', -1, 1).step(0.01).listen();
		game.gui.add(this, 'mainAxisY', -1, 1).step(0.01).listen();
		game.gui.add(this, 'controller').listen();
	}

	get actionButton() {

		return this.getAxis(this.GAMEPAD.LEFT_X, {
			positive: 'd',
			negative: 'q'
		});
	}

	get mainAxisX() {

		return this.getAxis(this.GAMEPAD.LEFT_X, {
			positive: 'd',
			negative: 'q'
		});
	}

	get mainAxisY() {

		return this.getAxis(this.GAMEPAD.LEFT_Y, {
			positive: 's',
			negative: 'z'
		});
	}

}

module.exports = SolarisControls;

},{"./controls":7,"./game":8}],12:[function(require,module,exports){
const game = require('./game');
const colors = require('./colors');

window.addEventListener('load', function () {

	game.load(() => {

		game.createScene();
		game.createLights();
		game.createObjects();

		console.log(game);

		window.game = game;

		game.loop();
	});
}, false);

},{"./colors":6,"./game":8}],13:[function(require,module,exports){
(function (Buffer){
//  Chance.js 1.0.6
//  http://chancejs.com
//  (c) 2013 Victor Quinn
//  Chance may be freely distributed or modified under the MIT license.

(function () {

    // Constants
    var MAX_INT = 9007199254740992;
    var MIN_INT = -MAX_INT;
    var NUMBERS = '0123456789';
    var CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
    var CHARS_UPPER = CHARS_LOWER.toUpperCase();
    var HEX_POOL  = NUMBERS + "abcdef";

    // Cached array helpers
    var slice = Array.prototype.slice;

    // Constructor
    function Chance (seed) {
        if (!(this instanceof Chance)) {
            return seed == null ? new Chance() : new Chance(seed);
        }

        // if user has provided a function, use that as the generator
        if (typeof seed === 'function') {
            this.random = seed;
            return this;
        }

        if (arguments.length) {
            // set a starting value of zero so we can add to it
            this.seed = 0;
        }

        // otherwise, leave this.seed blank so that MT will receive a blank

        for (var i = 0; i < arguments.length; i++) {
            var seedling = 0;
            if (Object.prototype.toString.call(arguments[i]) === '[object String]') {
                for (var j = 0; j < arguments[i].length; j++) {
                    // create a numeric hash for each argument, add to seedling
                    var hash = 0;
                    for (var k = 0; k < arguments[i].length; k++) {
                        hash = arguments[i].charCodeAt(k) + (hash << 6) + (hash << 16) - hash;
                    }
                    seedling += hash;
                }
            } else {
                seedling = arguments[i];
            }
            this.seed += (arguments.length - i) * seedling;
        }

        // If no generator function was provided, use our MT
        this.mt = this.mersenne_twister(this.seed);
        this.bimd5 = this.blueimp_md5();
        this.random = function () {
            return this.mt.random(this.seed);
        };

        return this;
    }

    Chance.prototype.VERSION = "1.0.6";

    // Random helper functions
    function initOptions(options, defaults) {
        options || (options = {});

        if (defaults) {
            for (var i in defaults) {
                if (typeof options[i] === 'undefined') {
                    options[i] = defaults[i];
                }
            }
        }

        return options;
    }

    function testRange(test, errorMessage) {
        if (test) {
            throw new RangeError(errorMessage);
        }
    }

    /**
     * Encode the input string with Base64.
     */
    var base64 = function() {
        throw new Error('No Base64 encoder available.');
    };

    // Select proper Base64 encoder.
    (function determineBase64Encoder() {
        if (typeof btoa === 'function') {
            base64 = btoa;
        } else if (typeof Buffer === 'function') {
            base64 = function(input) {
                return new Buffer(input).toString('base64');
            };
        }
    })();

    // -- Basics --

    /**
     *  Return a random bool, either true or false
     *
     *  @param {Object} [options={ likelihood: 50 }] alter the likelihood of
     *    receiving a true or false value back.
     *  @throws {RangeError} if the likelihood is out of bounds
     *  @returns {Bool} either true or false
     */
    Chance.prototype.bool = function (options) {
        // likelihood of success (true)
        options = initOptions(options, {likelihood : 50});

        // Note, we could get some minor perf optimizations by checking range
        // prior to initializing defaults, but that makes code a bit messier
        // and the check more complicated as we have to check existence of
        // the object then existence of the key before checking constraints.
        // Since the options initialization should be minor computationally,
        // decision made for code cleanliness intentionally. This is mentioned
        // here as it's the first occurrence, will not be mentioned again.
        testRange(
            options.likelihood < 0 || options.likelihood > 100,
            "Chance: Likelihood accepts values from 0 to 100."
        );

        return this.random() * 100 < options.likelihood;
    };

    /**
     *  Return a random character.
     *
     *  @param {Object} [options={}] can specify a character pool, only alpha,
     *    only symbols, and casing (lower or upper)
     *  @returns {String} a single random character
     *  @throws {RangeError} Can only specify alpha or symbols, not both
     */
    Chance.prototype.character = function (options) {
        options = initOptions(options);
        testRange(
            options.alpha && options.symbols,
            "Chance: Cannot specify both alpha and symbols."
        );

        var symbols = "!@#$%^&*()[]",
            letters, pool;

        if (options.casing === 'lower') {
            letters = CHARS_LOWER;
        } else if (options.casing === 'upper') {
            letters = CHARS_UPPER;
        } else {
            letters = CHARS_LOWER + CHARS_UPPER;
        }

        if (options.pool) {
            pool = options.pool;
        } else if (options.alpha) {
            pool = letters;
        } else if (options.symbols) {
            pool = symbols;
        } else {
            pool = letters + NUMBERS + symbols;
        }

        return pool.charAt(this.natural({max: (pool.length - 1)}));
    };

    // Note, wanted to use "float" or "double" but those are both JS reserved words.

    // Note, fixed means N OR LESS digits after the decimal. This because
    // It could be 14.9000 but in JavaScript, when this is cast as a number,
    // the trailing zeroes are dropped. Left to the consumer if trailing zeroes are
    // needed
    /**
     *  Return a random floating point number
     *
     *  @param {Object} [options={}] can specify a fixed precision, min, max
     *  @returns {Number} a single floating point number
     *  @throws {RangeError} Can only specify fixed or precision, not both. Also
     *    min cannot be greater than max
     */
    Chance.prototype.floating = function (options) {
        options = initOptions(options, {fixed : 4});
        testRange(
            options.fixed && options.precision,
            "Chance: Cannot specify both fixed and precision."
        );

        var num;
        var fixed = Math.pow(10, options.fixed);

        var max = MAX_INT / fixed;
        var min = -max;

        testRange(
            options.min && options.fixed && options.min < min,
            "Chance: Min specified is out of range with fixed. Min should be, at least, " + min
        );
        testRange(
            options.max && options.fixed && options.max > max,
            "Chance: Max specified is out of range with fixed. Max should be, at most, " + max
        );

        options = initOptions(options, { min : min, max : max });

        // Todo - Make this work!
        // options.precision = (typeof options.precision !== "undefined") ? options.precision : false;

        num = this.integer({min: options.min * fixed, max: options.max * fixed});
        var num_fixed = (num / fixed).toFixed(options.fixed);

        return parseFloat(num_fixed);
    };

    /**
     *  Return a random integer
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.integer({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.integer = function (options) {
        // 9007199254740992 (2^53) is the max integer number in JavaScript
        // See: http://vq.io/132sa2j
        options = initOptions(options, {min: MIN_INT, max: MAX_INT});
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return Math.floor(this.random() * (options.max - options.min + 1) + options.min);
    };

    /**
     *  Return a random natural
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.natural({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.natural = function (options) {
        options = initOptions(options, {min: 0, max: MAX_INT});
        testRange(options.min < 0, "Chance: Min cannot be less than zero.");
        return this.integer(options);
    };
	
	/**
     *  Return a random hex number as string
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.hex({min: '9', max: 'B'});
     *  would return either '9', 'A' or 'B'.
     *
     *  @param {Object} [options={}] can specify a min and/or max and/or casing
     *  @returns {String} a single random string hex number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.hex = function (options) {
        options = initOptions(options, {min: 0, max: MAX_INT, casing: 'lower'});
        testRange(options.min < 0, "Chance: Min cannot be less than zero.");
		var integer = this.natural({min: options.min, max: options.max});
		if (options.casing === 'upper') {
			return integer.toString(16).toUpperCase();
		}
		return integer.toString(16);
    };

    /**
     *  Return a random string
     *
     *  @param {Object} [options={}] can specify a length
     *  @returns {String} a string of random length
     *  @throws {RangeError} length cannot be less than zero
     */
    Chance.prototype.string = function (options) {
        options = initOptions(options, { length: this.natural({min: 5, max: 20}) });
        testRange(options.length < 0, "Chance: Length cannot be less than zero.");
        var length = options.length,
            text = this.n(this.character, length, options);

        return text.join("");
    };

    // -- End Basics --

    // -- Helpers --

    Chance.prototype.capitalize = function (word) {
        return word.charAt(0).toUpperCase() + word.substr(1);
    };

    Chance.prototype.mixin = function (obj) {
        for (var func_name in obj) {
            Chance.prototype[func_name] = obj[func_name];
        }
        return this;
    };

    /**
     *  Given a function that generates something random and a number of items to generate,
     *    return an array of items where none repeat.
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} num number of terms to generate
     *  @param {Object} options any options to pass on to the generator function
     *  @returns {Array} an array of length `num` with every item generated by `fn` and unique
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.unique = function(fn, num, options) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        var comparator = function(arr, val) { return arr.indexOf(val) !== -1; };

        if (options) {
            comparator = options.comparator || comparator;
        }

        var arr = [], count = 0, result, MAX_DUPLICATES = num * 50, params = slice.call(arguments, 2);

        while (arr.length < num) {
            var clonedParams = JSON.parse(JSON.stringify(params));
            result = fn.apply(this, clonedParams);
            if (!comparator(arr, result)) {
                arr.push(result);
                // reset count when unique found
                count = 0;
            }

            if (++count > MAX_DUPLICATES) {
                throw new RangeError("Chance: num is likely too large for sample set");
            }
        }
        return arr;
    };

    /**
     *  Gives an array of n random terms
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} n number of terms to generate
     *  @returns {Array} an array of length `n` with items generated by `fn`
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.n = function(fn, n) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        if (typeof n === 'undefined') {
            n = 1;
        }
        var i = n, arr = [], params = slice.call(arguments, 2);

        // Providing a negative count should result in a noop.
        i = Math.max( 0, i );

        for (null; i--; null) {
            arr.push(fn.apply(this, params));
        }

        return arr;
    };

    // H/T to SO for this one: http://vq.io/OtUrZ5
    Chance.prototype.pad = function (number, width, pad) {
        // Default pad to 0 if none provided
        pad = pad || '0';
        // Convert number to a string
        number = number + '';
        return number.length >= width ? number : new Array(width - number.length + 1).join(pad) + number;
    };

    // DEPRECATED on 2015-10-01
    Chance.prototype.pick = function (arr, count) {
        if (arr.length === 0) {
            throw new RangeError("Chance: Cannot pick() from an empty array");
        }
        if (!count || count === 1) {
            return arr[this.natural({max: arr.length - 1})];
        } else {
            return this.shuffle(arr).slice(0, count);
        }
    };

    // Given an array, returns a single random element
    Chance.prototype.pickone = function (arr) {
        if (arr.length === 0) {
          throw new RangeError("Chance: Cannot pickone() from an empty array");
        }
        return arr[this.natural({max: arr.length - 1})];
    };

    // Given an array, returns a random set with 'count' elements
    Chance.prototype.pickset = function (arr, count) {
        if (count === 0) {
            return [];
        }
        if (arr.length === 0) {
            throw new RangeError("Chance: Cannot pickset() from an empty array");
        }
        if (count < 0) {
            throw new RangeError("Chance: count must be positive number");
        }
        if (!count || count === 1) {
            return [ this.pickone(arr) ];
        } else {
            return this.shuffle(arr).slice(0, count);
        }
    };

    Chance.prototype.shuffle = function (arr) {
        var old_array = arr.slice(0),
            new_array = [],
            j = 0,
            length = Number(old_array.length);

        for (var i = 0; i < length; i++) {
            // Pick a random index from the array
            j = this.natural({max: old_array.length - 1});
            // Add it to the new array
            new_array[i] = old_array[j];
            // Remove that element from the original array
            old_array.splice(j, 1);
        }

        return new_array;
    };

    // Returns a single item from an array with relative weighting of odds
    Chance.prototype.weighted = function (arr, weights, trim) {
        if (arr.length !== weights.length) {
            throw new RangeError("Chance: length of array and weights must match");
        }

        // scan weights array and sum valid entries
        var sum = 0;
        var val;
        for (var weightIndex = 0; weightIndex < weights.length; ++weightIndex) {
            val = weights[weightIndex];
            if (isNaN(val)) {
                throw new RangeError("all weights must be numbers");
            }

            if (val > 0) {
                sum += val;
            }
        }

        if (sum === 0) {
            throw new RangeError("Chance: no valid entries in array weights");
        }

        // select a value within range
        var selected = this.random() * sum;

        // find array entry corresponding to selected value
        var total = 0;
        var lastGoodIdx = -1;
        var chosenIdx;
        for (weightIndex = 0; weightIndex < weights.length; ++weightIndex) {
            val = weights[weightIndex];
            total += val;
            if (val > 0) {
                if (selected <= total) {
                    chosenIdx = weightIndex;
                    break;
                }
                lastGoodIdx = weightIndex;
            }

            // handle any possible rounding error comparison to ensure something is picked
            if (weightIndex === (weights.length - 1)) {
                chosenIdx = lastGoodIdx;
            }
        }

        var chosen = arr[chosenIdx];
        trim = (typeof trim === 'undefined') ? false : trim;
        if (trim) {
            arr.splice(chosenIdx, 1);
            weights.splice(chosenIdx, 1);
        }

        return chosen;
    };

    // -- End Helpers --

    // -- Text --

    Chance.prototype.paragraph = function (options) {
        options = initOptions(options);

        var sentences = options.sentences || this.natural({min: 3, max: 7}),
            sentence_array = this.n(this.sentence, sentences);

        return sentence_array.join(' ');
    };

    // Could get smarter about this than generating random words and
    // chaining them together. Such as: http://vq.io/1a5ceOh
    Chance.prototype.sentence = function (options) {
        options = initOptions(options);

        var words = options.words || this.natural({min: 12, max: 18}),
            punctuation = options.punctuation,
            text, word_array = this.n(this.word, words);

        text = word_array.join(' ');

        // Capitalize first letter of sentence
        text = this.capitalize(text);

        // Make sure punctuation has a usable value
        if (punctuation !== false && !/^[\.\?;!:]$/.test(punctuation)) {
            punctuation = '.';
        }

        // Add punctuation mark
        if (punctuation) {
            text += punctuation;
        }

        return text;
    };

    Chance.prototype.syllable = function (options) {
        options = initOptions(options);

        var length = options.length || this.natural({min: 2, max: 3}),
            consonants = 'bcdfghjklmnprstvwz', // consonants except hard to speak ones
            vowels = 'aeiou', // vowels
            all = consonants + vowels, // all
            text = '',
            chr;

        // I'm sure there's a more elegant way to do this, but this works
        // decently well.
        for (var i = 0; i < length; i++) {
            if (i === 0) {
                // First character can be anything
                chr = this.character({pool: all});
            } else if (consonants.indexOf(chr) === -1) {
                // Last character was a vowel, now we want a consonant
                chr = this.character({pool: consonants});
            } else {
                // Last character was a consonant, now we want a vowel
                chr = this.character({pool: vowels});
            }

            text += chr;
        }

        if (options.capitalize) {
            text = this.capitalize(text);
        }

        return text;
    };

    Chance.prototype.word = function (options) {
        options = initOptions(options);

        testRange(
            options.syllables && options.length,
            "Chance: Cannot specify both syllables AND length."
        );

        var syllables = options.syllables || this.natural({min: 1, max: 3}),
            text = '';

        if (options.length) {
            // Either bound word by length
            do {
                text += this.syllable();
            } while (text.length < options.length);
            text = text.substring(0, options.length);
        } else {
            // Or by number of syllables
            for (var i = 0; i < syllables; i++) {
                text += this.syllable();
            }
        }

        if (options.capitalize) {
            text = this.capitalize(text);
        }

        return text;
    };

    // -- End Text --

    // -- Person --

    Chance.prototype.age = function (options) {
        options = initOptions(options);
        var ageRange;

        switch (options.type) {
            case 'child':
                ageRange = {min: 0, max: 12};
                break;
            case 'teen':
                ageRange = {min: 13, max: 19};
                break;
            case 'adult':
                ageRange = {min: 18, max: 65};
                break;
            case 'senior':
                ageRange = {min: 65, max: 100};
                break;
            case 'all':
                ageRange = {min: 0, max: 100};
                break;
            default:
                ageRange = {min: 18, max: 65};
                break;
        }

        return this.natural(ageRange);
    };

    Chance.prototype.birthday = function (options) {
        var age = this.age(options);
        var currentYear = new Date().getFullYear();

        if (options && options.type) {
            var min = new Date();
            var max = new Date();
            min.setFullYear(currentYear - age - 1);
            max.setFullYear(currentYear - age);

            options = initOptions(options, {
                min: min,
                max: max
            });
        } else {
            options = initOptions(options, {
                year: currentYear - age
            });
        }

        return this.date(options);
    };

    // CPF; ID to identify taxpayers in Brazil
    Chance.prototype.cpf = function (options) {
        options = initOptions(options, {
            formatted: true
        });

        var n = this.n(this.natural, 9, { max: 9 });
        var d1 = n[8]*2+n[7]*3+n[6]*4+n[5]*5+n[4]*6+n[3]*7+n[2]*8+n[1]*9+n[0]*10;
        d1 = 11 - (d1 % 11);
        if (d1>=10) {
            d1 = 0;
        }
        var d2 = d1*2+n[8]*3+n[7]*4+n[6]*5+n[5]*6+n[4]*7+n[3]*8+n[2]*9+n[1]*10+n[0]*11;
        d2 = 11 - (d2 % 11);
        if (d2>=10) {
            d2 = 0;
        }
        var cpf = ''+n[0]+n[1]+n[2]+'.'+n[3]+n[4]+n[5]+'.'+n[6]+n[7]+n[8]+'-'+d1+d2;
        return options.formatted ? cpf : cpf.replace(/\D/g,'');
    };

    // CNPJ: ID to identify companies in Brazil
    Chance.prototype.cnpj = function (options) {
        options = initOptions(options, {
            formatted: true
        });

        var n = this.n(this.natural, 12, { max: 12 });
        var d1 = n[11]*2+n[10]*3+n[9]*4+n[8]*5+n[7]*6+n[6]*7+n[5]*8+n[4]*9+n[3]*2+n[2]*3+n[1]*4+n[0]*5;
        d1 = 11 - (d1 % 11);
        if (d1<2) {
            d1 = 0;
        }
        var d2 = d1*2+n[11]*3+n[10]*4+n[9]*5+n[8]*6+n[7]*7+n[6]*8+n[5]*9+n[4]*2+n[3]*3+n[2]*4+n[1]*5+n[0]*6;
        d2 = 11 - (d2 % 11);
        if (d2<2) {
            d2 = 0;
        }
        var cnpj = ''+n[0]+n[1]+'.'+n[2]+n[3]+n[4]+'.'+n[5]+n[6]+n[7]+'/'+n[8]+n[9]+n[10]+n[11]+'-'+d1+d2;
        return options.formatted ? cnpj : cnpj.replace(/\D/g,'');
    };

    Chance.prototype.first = function (options) {
        options = initOptions(options, {gender: this.gender(), nationality: 'en'});
        return this.pick(this.get("firstNames")[options.gender.toLowerCase()][options.nationality.toLowerCase()]);
    };

    Chance.prototype.profession = function () {
        return this.pick(this.get("professions"));
    };

    Chance.prototype.gender = function (options) {
        options = initOptions(options, {extraGenders: []});
        return this.pick(['Male', 'Female'].concat(options.extraGenders));
    };

    Chance.prototype.last = function (options) {
        options = initOptions(options, {nationality: 'en'});
        return this.pick(this.get("lastNames")[options.nationality.toLowerCase()]);
    };

    Chance.prototype.israelId=function(){
        var x=this.string({pool: '0123456789',length:8});
        var y=0;
        for (var i=0;i<x.length;i++){
            var thisDigit=  x[i] *  (i/2===parseInt(i/2) ? 1 : 2);
            thisDigit=this.pad(thisDigit,2).toString();
            thisDigit=parseInt(thisDigit[0]) + parseInt(thisDigit[1]);
            y=y+thisDigit;
        }
        x=x+(10-parseInt(y.toString().slice(-1))).toString().slice(-1);
        return x;
    };

    Chance.prototype.mrz = function (options) {
        var checkDigit = function (input) {
            var alpha = "<ABCDEFGHIJKLMNOPQRSTUVWXYXZ".split(''),
                multipliers = [ 7, 3, 1 ],
                runningTotal = 0;

            if (typeof input !== 'string') {
                input = input.toString();
            }

            input.split('').forEach(function(character, idx) {
                var pos = alpha.indexOf(character);

                if(pos !== -1) {
                    character = pos === 0 ? 0 : pos + 9;
                } else {
                    character = parseInt(character, 10);
                }
                character *= multipliers[idx % multipliers.length];
                runningTotal += character;
            });
            return runningTotal % 10;
        };
        var generate = function (opts) {
            var pad = function (length) {
                return new Array(length + 1).join('<');
            };
            var number = [ 'P<',
                           opts.issuer,
                           opts.last.toUpperCase(),
                           '<<',
                           opts.first.toUpperCase(),
                           pad(39 - (opts.last.length + opts.first.length + 2)),
                           opts.passportNumber,
                           checkDigit(opts.passportNumber),
                           opts.nationality,
                           opts.dob,
                           checkDigit(opts.dob),
                           opts.gender,
                           opts.expiry,
                           checkDigit(opts.expiry),
                           pad(14),
                           checkDigit(pad(14)) ].join('');

            return number +
                (checkDigit(number.substr(44, 10) +
                            number.substr(57, 7) +
                            number.substr(65, 7)));
        };

        var that = this;

        options = initOptions(options, {
            first: this.first(),
            last: this.last(),
            passportNumber: this.integer({min: 100000000, max: 999999999}),
            dob: (function () {
                var date = that.birthday({type: 'adult'});
                return [date.getFullYear().toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            expiry: (function () {
                var date = new Date();
                return [(date.getFullYear() + 5).toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            gender: this.gender() === 'Female' ? 'F': 'M',
            issuer: 'GBR',
            nationality: 'GBR'
        });
        return generate (options);
    };

    Chance.prototype.name = function (options) {
        options = initOptions(options);

        var first = this.first(options),
            last = this.last(options),
            name;

        if (options.middle) {
            name = first + ' ' + this.first(options) + ' ' + last;
        } else if (options.middle_initial) {
            name = first + ' ' + this.character({alpha: true, casing: 'upper'}) + '. ' + last;
        } else {
            name = first + ' ' + last;
        }

        if (options.prefix) {
            name = this.prefix(options) + ' ' + name;
        }

        if (options.suffix) {
            name = name + ' ' + this.suffix(options);
        }

        return name;
    };

    // Return the list of available name prefixes based on supplied gender.
    // @todo introduce internationalization
    Chance.prototype.name_prefixes = function (gender) {
        gender = gender || "all";
        gender = gender.toLowerCase();

        var prefixes = [
            { name: 'Doctor', abbreviation: 'Dr.' }
        ];

        if (gender === "male" || gender === "all") {
            prefixes.push({ name: 'Mister', abbreviation: 'Mr.' });
        }

        if (gender === "female" || gender === "all") {
            prefixes.push({ name: 'Miss', abbreviation: 'Miss' });
            prefixes.push({ name: 'Misses', abbreviation: 'Mrs.' });
        }

        return prefixes;
    };

    // Alias for name_prefix
    Chance.prototype.prefix = function (options) {
        return this.name_prefix(options);
    };

    Chance.prototype.name_prefix = function (options) {
        options = initOptions(options, { gender: "all" });
        return options.full ?
            this.pick(this.name_prefixes(options.gender)).name :
            this.pick(this.name_prefixes(options.gender)).abbreviation;
    };
    //Hungarian ID number
    Chance.prototype.HIDN= function(){
     //Hungarian ID nuber structure: XXXXXXYY (X=number,Y=Capital Latin letter)
      var idn_pool="0123456789";
      var idn_chrs="ABCDEFGHIJKLMNOPQRSTUVWXYXZ";
      var idn="";
        idn+=this.string({pool:idn_pool,length:6});
        idn+=this.string({pool:idn_chrs,length:2});
        return idn;
    };


    Chance.prototype.ssn = function (options) {
        options = initOptions(options, {ssnFour: false, dashes: true});
        var ssn_pool = "1234567890",
            ssn,
            dash = options.dashes ? '-' : '';

        if(!options.ssnFour) {
            ssn = this.string({pool: ssn_pool, length: 3}) + dash +
            this.string({pool: ssn_pool, length: 2}) + dash +
            this.string({pool: ssn_pool, length: 4});
        } else {
            ssn = this.string({pool: ssn_pool, length: 4});
        }
        return ssn;
    };

    // Return the list of available name suffixes
    // @todo introduce internationalization
    Chance.prototype.name_suffixes = function () {
        var suffixes = [
            { name: 'Doctor of Osteopathic Medicine', abbreviation: 'D.O.' },
            { name: 'Doctor of Philosophy', abbreviation: 'Ph.D.' },
            { name: 'Esquire', abbreviation: 'Esq.' },
            { name: 'Junior', abbreviation: 'Jr.' },
            { name: 'Juris Doctor', abbreviation: 'J.D.' },
            { name: 'Master of Arts', abbreviation: 'M.A.' },
            { name: 'Master of Business Administration', abbreviation: 'M.B.A.' },
            { name: 'Master of Science', abbreviation: 'M.S.' },
            { name: 'Medical Doctor', abbreviation: 'M.D.' },
            { name: 'Senior', abbreviation: 'Sr.' },
            { name: 'The Third', abbreviation: 'III' },
            { name: 'The Fourth', abbreviation: 'IV' },
            { name: 'Bachelor of Engineering', abbreviation: 'B.E' },
            { name: 'Bachelor of Technology', abbreviation: 'B.TECH' }
        ];
        return suffixes;
    };

    // Alias for name_suffix
    Chance.prototype.suffix = function (options) {
        return this.name_suffix(options);
    };

    Chance.prototype.name_suffix = function (options) {
        options = initOptions(options);
        return options.full ?
            this.pick(this.name_suffixes()).name :
            this.pick(this.name_suffixes()).abbreviation;
    };

    Chance.prototype.nationalities = function () {
        return this.get("nationalities");
    };

    // Generate random nationality based on json list
    Chance.prototype.nationality = function () {
        var nationality = this.pick(this.nationalities());
        return nationality.name;
    };

    // -- End Person --

    // -- Mobile --
    // Android GCM Registration ID
    Chance.prototype.android_id = function () {
        return "APA91" + this.string({ pool: "0123456789abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_", length: 178 });
    };

    // Apple Push Token
    Chance.prototype.apple_token = function () {
        return this.string({ pool: "abcdef1234567890", length: 64 });
    };

    // Windows Phone 8 ANID2
    Chance.prototype.wp8_anid2 = function () {
        return base64( this.hash( { length : 32 } ) );
    };

    // Windows Phone 7 ANID
    Chance.prototype.wp7_anid = function () {
        return 'A=' + this.guid().replace(/-/g, '').toUpperCase() + '&E=' + this.hash({ length:3 }) + '&W=' + this.integer({ min:0, max:9 });
    };

    // BlackBerry Device PIN
    Chance.prototype.bb_pin = function () {
        return this.hash({ length: 8 });
    };

    // -- End Mobile --

    // -- Web --
    Chance.prototype.avatar = function (options) {
        var url = null;
        var URL_BASE = '//www.gravatar.com/avatar/';
        var PROTOCOLS = {
            http: 'http',
            https: 'https'
        };
        var FILE_TYPES = {
            bmp: 'bmp',
            gif: 'gif',
            jpg: 'jpg',
            png: 'png'
        };
        var FALLBACKS = {
            '404': '404', // Return 404 if not found
            mm: 'mm', // Mystery man
            identicon: 'identicon', // Geometric pattern based on hash
            monsterid: 'monsterid', // A generated monster icon
            wavatar: 'wavatar', // A generated face
            retro: 'retro', // 8-bit icon
            blank: 'blank' // A transparent png
        };
        var RATINGS = {
            g: 'g',
            pg: 'pg',
            r: 'r',
            x: 'x'
        };
        var opts = {
            protocol: null,
            email: null,
            fileExtension: null,
            size: null,
            fallback: null,
            rating: null
        };

        if (!options) {
            // Set to a random email
            opts.email = this.email();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.email = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if (options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if (!opts.email) {
            // Set to a random email
            opts.email = this.email();
        }

        // Safe checking for params
        opts.protocol = PROTOCOLS[opts.protocol] ? opts.protocol + ':' : '';
        opts.size = parseInt(opts.size, 0) ? opts.size : '';
        opts.rating = RATINGS[opts.rating] ? opts.rating : '';
        opts.fallback = FALLBACKS[opts.fallback] ? opts.fallback : '';
        opts.fileExtension = FILE_TYPES[opts.fileExtension] ? opts.fileExtension : '';

        url =
            opts.protocol +
            URL_BASE +
            this.bimd5.md5(opts.email) +
            (opts.fileExtension ? '.' + opts.fileExtension : '') +
            (opts.size || opts.rating || opts.fallback ? '?' : '') +
            (opts.size ? '&s=' + opts.size.toString() : '') +
            (opts.rating ? '&r=' + opts.rating : '') +
            (opts.fallback ? '&d=' + opts.fallback : '')
            ;

        return url;
    };

    /**
     * #Description:
     * ===============================================
     * Generate random color value base on color type:
     * -> hex
     * -> rgb
     * -> rgba
     * -> 0x
     * -> named color
     *
     * #Examples:
     * ===============================================
     * * Geerate random hex color
     * chance.color() => '#79c157' / 'rgb(110,52,164)' / '0x67ae0b' / '#e2e2e2' / '#29CFA7'
     *
     * * Generate Hex based color value
     * chance.color({format: 'hex'})    => '#d67118'
     *
     * * Generate simple rgb value
     * chance.color({format: 'rgb'})    => 'rgb(110,52,164)'
     *
     * * Generate Ox based color value
     * chance.color({format: '0x'})     => '0x67ae0b'
     *
     * * Generate graiscale based value
     * chance.color({grayscale: true})  => '#e2e2e2'
     *
     * * Return valide color name
     * chance.color({format: 'name'})   => 'red'
     *
     * * Make color uppercase
     * chance.color({casing: 'upper'})  => '#29CFA7'
	 
	 * * Min Max values for RGBA
	 * var light_red = chance.color({format: 'hex', min_red: 200, max_red: 255, max_green: 0, max_blue: 0, min_alpha: .2, max_alpha: .3});
     *
     * @param  [object] options
     * @return [string] color value
     */
    Chance.prototype.color = function (options) {
		function pad(n, width, z) {
			z = z || '0';
			n = n + '';
			return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
		}
		
        function gray(value, delimiter) {
            return [value, value, value].join(delimiter || '');
        }

        function rgb(hasAlpha) {
            var rgbValue     = (hasAlpha)    ? 'rgba' : 'rgb';
            var alphaChannel = (hasAlpha)    ? (',' + this.floating({min:min_alpha, max:max_alpha})) : "";
            var colorValue   = (isGrayscale) ? (gray(this.natural({min: min_rgb, max: max_rgb}), ',')) : (this.natural({min: min_green, max: max_green}) + ',' + this.natural({min: min_blue, max: max_blue}) + ',' + this.natural({max: 255}));
            return rgbValue + '(' + colorValue + alphaChannel + ')';
        }

        function hex(start, end, withHash) {
            var symbol = (withHash) ? "#" : "";
			var hexstring = "";
			
			if (isGrayscale) {
				hexstring = gray(pad(this.hex({min: min_rgb, max: max_rgb}), 2));
				if (options.format === "shorthex") {
					hexstring = gray(this.hex({min: 0, max: 15}));
					console.log("hex: " + hexstring);
				}
			}
			else {
				if (options.format === "shorthex") {
					hexstring = pad(this.hex({min: Math.floor(min_red / 16), max: Math.floor(max_red / 16)}), 1) + pad(this.hex({min: Math.floor(min_green / 16), max: Math.floor(max_green / 16)}), 1) + pad(this.hex({min: Math.floor(min_blue / 16), max: Math.floor(max_blue / 16)}), 1);
				}
				else if (min_red !== undefined || max_red !== undefined || min_green !== undefined || max_green !== undefined || min_blue !== undefined || max_blue !== undefined) {
					hexstring = pad(this.hex({min: min_red, max: max_red}), 2) + pad(this.hex({min: min_green, max: max_green}), 2) + pad(this.hex({min: min_blue, max: max_blue}), 2);
				}
				else {
					hexstring = pad(this.hex({min: min_rgb, max: max_rgb}), 2) + pad(this.hex({min: min_rgb, max: max_rgb}), 2) + pad(this.hex({min: min_rgb, max: max_rgb}), 2);
				}
			}
			
            return symbol + hexstring;
        }

        options = initOptions(options, {
            format: this.pick(['hex', 'shorthex', 'rgb', 'rgba', '0x', 'name']),
            grayscale: false,
            casing: 'lower', 
			min: 0, 
			max: 255, 
			min_red: undefined,
			max_red: undefined, 
			min_green: undefined,
			max_green: undefined, 
			min_blue: undefined, 
			max_blue: undefined, 
			min_alpha: 0,
			max_alpha: 1
        });

        var isGrayscale = options.grayscale;
		var min_rgb = options.min;
		var max_rgb = options.max;		
		var min_red = options.min_red;
		var max_red = options.max_red;
		var min_green = options.min_green;
		var max_green = options.max_green;
		var min_blue = options.min_blue;
		var max_blue = options.max_blue;
		var min_alpha = options.min_alpha;
		var max_alpha = options.max_alpha;
		if (options.min_red === undefined) { min_red = min_rgb; }
		if (options.max_red === undefined) { max_red = max_rgb; }
		if (options.min_green === undefined) { min_green = min_rgb; }
		if (options.max_green === undefined) { max_green = max_rgb; }
		if (options.min_blue === undefined) { min_blue = min_rgb; }
		if (options.max_blue === undefined) { max_blue = max_rgb; }
		if (options.min_alpha === undefined) { min_alpha = 0; }
		if (options.max_alpha === undefined) { max_alpha = 1; }
		if (isGrayscale && min_rgb === 0 && max_rgb === 255 && min_red !== undefined && max_red !== undefined) {			
			min_rgb = ((min_red + min_green + min_blue) / 3);
			max_rgb = ((max_red + max_green + max_blue) / 3);
		}
        var colorValue;

        if (options.format === 'hex') {
            colorValue = hex.call(this, 2, 6, true);
        }
        else if (options.format === 'shorthex') {
            colorValue = hex.call(this, 1, 3, true);
        }
        else if (options.format === 'rgb') {
            colorValue = rgb.call(this, false);
        }
        else if (options.format === 'rgba') {
            colorValue = rgb.call(this, true);
        }
        else if (options.format === '0x') {
            colorValue = '0x' + hex.call(this, 2, 6);
        }
        else if(options.format === 'name') {
            return this.pick(this.get("colorNames"));
        }
        else {
            throw new RangeError('Invalid format provided. Please provide one of "hex", "shorthex", "rgb", "rgba", "0x" or "name".');
        }

        if (options.casing === 'upper' ) {
            colorValue = colorValue.toUpperCase();
        }

        return colorValue;
    };

    Chance.prototype.domain = function (options) {
        options = initOptions(options);
        return this.word() + '.' + (options.tld || this.tld());
    };

    Chance.prototype.email = function (options) {
        options = initOptions(options);
        return this.word({length: options.length}) + '@' + (options.domain || this.domain());
    };

    Chance.prototype.fbid = function () {
        return parseInt('10000' + this.natural({max: 100000000000}), 10);
    };

    Chance.prototype.google_analytics = function () {
        var account = this.pad(this.natural({max: 999999}), 6);
        var property = this.pad(this.natural({max: 99}), 2);

        return 'UA-' + account + '-' + property;
    };

    Chance.prototype.hashtag = function () {
        return '#' + this.word();
    };

    Chance.prototype.ip = function () {
        // Todo: This could return some reserved IPs. See http://vq.io/137dgYy
        // this should probably be updated to account for that rare as it may be
        return this.natural({min: 1, max: 254}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({min: 1, max: 254});
    };

    Chance.prototype.ipv6 = function () {
        var ip_addr = this.n(this.hash, 8, {length: 4});

        return ip_addr.join(":");
    };

    Chance.prototype.klout = function () {
        return this.natural({min: 1, max: 99});
    };

    Chance.prototype.semver = function (options) {
        options = initOptions(options, { include_prerelease: true });

        var range = this.pickone(["^", "~", "<", ">", "<=", ">=", "="]);
        if (options.range) {
            range = options.range;
        }

        var prerelease = "";
        if (options.include_prerelease) {
            prerelease = this.weighted(["", "-dev", "-beta", "-alpha"], [50, 10, 5, 1]);
        }
        return range + this.rpg('3d10').join('.') + prerelease;
    };

    Chance.prototype.tlds = function () {
        return ['com', 'org', 'edu', 'gov', 'co.uk', 'net', 'io', 'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'an', 'ao', 'aq', 'ar', 'as', 'at', 'au', 'aw', 'ax', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'bq', 'br', 'bs', 'bt', 'bv', 'bw', 'by', 'bz', 'ca', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv', 'cw', 'cx', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'eh', 'er', 'es', 'et', 'eu', 'fi', 'fj', 'fk', 'fm', 'fo', 'fr', 'ga', 'gb', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq', 'gr', 'gs', 'gt', 'gu', 'gw', 'gy', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im', 'in', 'io', 'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz', 'om', 'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'su', 'sv', 'sx', 'sy', 'sz', 'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tp', 'tr', 'tt', 'tv', 'tw', 'tz', 'ua', 'ug', 'uk', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu', 'wf', 'ws', 'ye', 'yt', 'za', 'zm', 'zw'];
    };

    Chance.prototype.tld = function () {
        return this.pick(this.tlds());
    };

    Chance.prototype.twitter = function () {
        return '@' + this.word();
    };

    Chance.prototype.url = function (options) {
        options = initOptions(options, { protocol: "http", domain: this.domain(options), domain_prefix: "", path: this.word(), extensions: []});

        var extension = options.extensions.length > 0 ? "." + this.pick(options.extensions) : "";
        var domain = options.domain_prefix ? options.domain_prefix + "." + options.domain : options.domain;

        return options.protocol + "://" + domain + "/" + options.path + extension;
    };

    Chance.prototype.port = function() {
        return this.integer({min: 0, max: 65535});
    };

    // -- End Web --

    // -- Location --

    Chance.prototype.address = function (options) {
        options = initOptions(options);
        return this.natural({min: 5, max: 2000}) + ' ' + this.street(options);
    };

    Chance.prototype.altitude = function (options) {
        options = initOptions(options, {fixed: 5, min: 0, max: 8848});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.areacode = function (options) {
        options = initOptions(options, {parens : true});
        // Don't want area codes to start with 1, or have a 9 as the second digit
        var areacode = this.natural({min: 2, max: 9}).toString() +
                this.natural({min: 0, max: 8}).toString() +
                this.natural({min: 0, max: 9}).toString();

        return options.parens ? '(' + areacode + ')' : areacode;
    };

    Chance.prototype.city = function () {
        return this.capitalize(this.word({syllables: 3}));
    };

    Chance.prototype.coordinates = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options);
    };

    Chance.prototype.countries = function () {
        return this.get("countries");
    };

    Chance.prototype.country = function (options) {
        options = initOptions(options);
        var country = this.pick(this.countries());
        return options.full ? country.name : country.abbreviation;
    };

    Chance.prototype.depth = function (options) {
        options = initOptions(options, {fixed: 5, min: -10994, max: 0});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.geohash = function (options) {
        options = initOptions(options, { length: 7 });
        return this.string({ length: options.length, pool: '0123456789bcdefghjkmnpqrstuvwxyz' });
    };

    Chance.prototype.geojson = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options) + ', ' + this.altitude(options);
    };

    Chance.prototype.latitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -90, max: 90});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.longitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -180, max: 180});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.phone = function (options) {
        var self = this,
            numPick,
            ukNum = function (parts) {
                var section = [];
                //fills the section part of the phone number with random numbers.
                parts.sections.forEach(function(n) {
                    section.push(self.string({ pool: '0123456789', length: n}));
                });
                return parts.area + section.join(' ');
            };
        options = initOptions(options, {
            formatted: true,
            country: 'us',
            mobile: false
        });
        if (!options.formatted) {
            options.parens = false;
        }
        var phone;
        switch (options.country) {
            case 'fr':
                if (!options.mobile) {
                    numPick = this.pick([
                        // Valid zone and département codes.
                        '01' + this.pick(['30', '34', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '53', '55', '56', '58', '60', '64', '69', '70', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83']) + self.string({ pool: '0123456789', length: 6}),
                        '02' + this.pick(['14', '18', '22', '23', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '40', '41', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '56', '57', '61', '62', '69', '72', '76', '77', '78', '85', '90', '96', '97', '98', '99']) + self.string({ pool: '0123456789', length: 6}),
                        '03' + this.pick(['10', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '39', '44', '45', '51', '52', '54', '55', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90']) + self.string({ pool: '0123456789', length: 6}),
                        '04' + this.pick(['11', '13', '15', '20', '22', '26', '27', '30', '32', '34', '37', '42', '43', '44', '50', '56', '57', '63', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '88', '89', '90', '91', '92', '93', '94', '95', '97', '98']) + self.string({ pool: '0123456789', length: 6}),
                        '05' + this.pick(['08', '16', '17', '19', '24', '31', '32', '33', '34', '35', '40', '45', '46', '47', '49', '53', '55', '56', '57', '58', '59', '61', '62', '63', '64', '65', '67', '79', '81', '82', '86', '87', '90', '94']) + self.string({ pool: '0123456789', length: 6}),
                        '09' + self.string({ pool: '0123456789', length: 8}),
                    ]);
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                } else {
                    numPick = this.pick(['06', '07']) + self.string({ pool: '0123456789', length: 8});
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                }
                break;
            case 'uk':
                if (!options.mobile) {
                    numPick = this.pick([
                        //valid area codes of major cities/counties followed by random numbers in required format.

                        { area: '01' + this.character({ pool: '234569' }) + '1 ', sections: [3,4] },
                        { area: '020 ' + this.character({ pool: '378' }), sections: [3,4] },
                        { area: '023 ' + this.character({ pool: '89' }), sections: [3,4] },
                        { area: '024 7', sections: [3,4] },
                        { area: '028 ' + this.pick(['25','28','37','71','82','90','92','95']), sections: [2,4] },
                        { area: '012' + this.pick(['04','08','54','76','97','98']) + ' ', sections: [6] },
                        { area: '013' + this.pick(['63','64','84','86']) + ' ', sections: [6] },
                        { area: '014' + this.pick(['04','20','60','61','80','88']) + ' ', sections: [6] },
                        { area: '015' + this.pick(['24','27','62','66']) + ' ', sections: [6] },
                        { area: '016' + this.pick(['06','29','35','47','59','95']) + ' ', sections: [6] },
                        { area: '017' + this.pick(['26','44','50','68']) + ' ', sections: [6] },
                        { area: '018' + this.pick(['27','37','84','97']) + ' ', sections: [6] },
                        { area: '019' + this.pick(['00','05','35','46','49','63','95']) + ' ', sections: [6] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '', 'g');
                } else {
                    numPick = this.pick([
                        { area: '07' + this.pick(['4','5','7','8','9']), sections: [2,6] },
                        { area: '07624 ', sections: [6] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '');
                }
                break;
            case 'za':
                if (!options.mobile) {
                    numPick = this.pick([
                       '01' + this.pick(['0', '1', '2', '3', '4', '5', '6', '7', '8']) + self.string({ pool: '0123456789', length: 7}),
                       '02' + this.pick(['1', '2', '3', '4', '7', '8']) + self.string({ pool: '0123456789', length: 7}),
                       '03' + this.pick(['1', '2', '3', '5', '6', '9']) + self.string({ pool: '0123456789', length: 7}),
                       '04' + this.pick(['1', '2', '3', '4', '5','6','7', '8','9']) + self.string({ pool: '0123456789', length: 7}),   
                       '05' + this.pick(['1', '3', '4', '6', '7', '8']) + self.string({ pool: '0123456789', length: 7}),
                    ]);
                    phone = options.formatted || numPick;
                } else {
                    numPick = this.pick([
                        '060' + this.pick(['3','4','5','6','7','8','9']) + self.string({ pool: '0123456789', length: 6}),
                        '061' + this.pick(['0','1','2','3','4','5','8']) + self.string({ pool: '0123456789', length: 6}),
                        '06'  + self.string({ pool: '0123456789', length: 7}),
                        '071' + this.pick(['0','1','2','3','4','5','6','7','8','9']) + self.string({ pool: '0123456789', length: 6}),
                        '07'  + this.pick(['2','3','4','6','7','8','9']) + self.string({ pool: '0123456789', length: 7}),
                        '08'  + this.pick(['0','1','2','3','4','5']) + self.string({ pool: '0123456789', length: 7}),                     
                    ]);
                    phone = options.formatted || numPick;
                }
                
                break;

            case 'us':
                var areacode = this.areacode(options).toString();
                var exchange = this.natural({ min: 2, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString();
                var subscriber = this.natural({ min: 1000, max: 9999 }).toString(); // this could be random [0-9]{4}
                phone = options.formatted ? areacode + ' ' + exchange + '-' + subscriber : areacode + exchange + subscriber;
        }
        return phone;
    };

    Chance.prototype.postal = function () {
        // Postal District
        var pd = this.character({pool: "XVTSRPNKLMHJGECBA"});
        // Forward Sortation Area (FSA)
        var fsa = pd + this.natural({max: 9}) + this.character({alpha: true, casing: "upper"});
        // Local Delivery Unut (LDU)
        var ldu = this.natural({max: 9}) + this.character({alpha: true, casing: "upper"}) + this.natural({max: 9});

        return fsa + " " + ldu;
    };

    Chance.prototype.counties = function (options) {
        options = initOptions(options, { country: 'uk' });
        return this.get("counties")[options.country.toLowerCase()];
    };

    Chance.prototype.county = function (options) {
        return this.pick(this.counties(options)).name;
    };

    Chance.prototype.provinces = function (options) {
        options = initOptions(options, { country: 'ca' });
        return this.get("provinces")[options.country.toLowerCase()];
    };

    Chance.prototype.province = function (options) {
        return (options && options.full) ?
            this.pick(this.provinces(options)).name :
            this.pick(this.provinces(options)).abbreviation;
    };

    Chance.prototype.state = function (options) {
        return (options && options.full) ?
            this.pick(this.states(options)).name :
            this.pick(this.states(options)).abbreviation;
    };

    Chance.prototype.states = function (options) {
        options = initOptions(options, { country: 'us', us_states_and_dc: true } );

        var states;

        switch (options.country.toLowerCase()) {
            case 'us':
                var us_states_and_dc = this.get("us_states_and_dc"),
                    territories = this.get("territories"),
                    armed_forces = this.get("armed_forces");

                states = [];

                if (options.us_states_and_dc) {
                    states = states.concat(us_states_and_dc);
                }
                if (options.territories) {
                    states = states.concat(territories);
                }
                if (options.armed_forces) {
                    states = states.concat(armed_forces);
                }
                break;
            case 'it':
                states = this.get("country_regions")[options.country.toLowerCase()];
                break;
            case 'uk':
                states = this.get("counties")[options.country.toLowerCase()];
                break;
        }

        return states;
    };

    Chance.prototype.street = function (options) {
        options = initOptions(options, { country: 'us', syllables: 2 });
        var     street;

        switch (options.country.toLowerCase()) {
            case 'us':
                street = this.word({ syllables: options.syllables });
                street = this.capitalize(street);
                street += ' ';
                street += options.short_suffix ?
                    this.street_suffix(options).abbreviation :
                    this.street_suffix(options).name;
                break;
            case 'it':
                street = this.word({ syllables: options.syllables });
                street = this.capitalize(street);
                street = (options.short_suffix ?
                    this.street_suffix(options).abbreviation :
                    this.street_suffix(options).name) + " " + street;
                break;
        }
        return street;
    };

    Chance.prototype.street_suffix = function (options) {
        options = initOptions(options, { country: 'us' });
        return this.pick(this.street_suffixes(options));
    };

    Chance.prototype.street_suffixes = function (options) {
        options = initOptions(options, { country: 'us' });
        // These are the most common suffixes.
        return this.get("street_suffixes")[options.country.toLowerCase()];
    };

    // Note: only returning US zip codes, internationalization will be a whole
    // other beast to tackle at some point.
    Chance.prototype.zip = function (options) {
        var zip = this.n(this.natural, 5, {max: 9});

        if (options && options.plusfour === true) {
            zip.push('-');
            zip = zip.concat(this.n(this.natural, 4, {max: 9}));
        }

        return zip.join("");
    };

    // -- End Location --

    // -- Time

    Chance.prototype.ampm = function () {
        return this.bool() ? 'am' : 'pm';
    };

    Chance.prototype.date = function (options) {
        var date_string, date;

        // If interval is specified we ignore preset
        if(options && (options.min || options.max)) {
            options = initOptions(options, {
                american: true,
                string: false
            });
            var min = typeof options.min !== "undefined" ? options.min.getTime() : 1;
            // 100,000,000 days measured relative to midnight at the beginning of 01 January, 1970 UTC. http://es5.github.io/#x15.9.1.1
            var max = typeof options.max !== "undefined" ? options.max.getTime() : 8640000000000000;

            date = new Date(this.integer({min: min, max: max}));
        } else {
            var m = this.month({raw: true});
            var daysInMonth = m.days;

            if(options && options.month) {
                // Mod 12 to allow months outside range of 0-11 (not encouraged, but also not prevented).
                daysInMonth = this.get('months')[((options.month % 12) + 12) % 12].days;
            }

            options = initOptions(options, {
                year: parseInt(this.year(), 10),
                // Necessary to subtract 1 because Date() 0-indexes month but not day or year
                // for some reason.
                month: m.numeric - 1,
                day: this.natural({min: 1, max: daysInMonth}),
                hour: this.hour({twentyfour: true}),
                minute: this.minute(),
                second: this.second(),
                millisecond: this.millisecond(),
                american: true,
                string: false
            });

            date = new Date(options.year, options.month, options.day, options.hour, options.minute, options.second, options.millisecond);
        }

        if (options.american) {
            // Adding 1 to the month is necessary because Date() 0-indexes
            // months but not day for some odd reason.
            date_string = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
        } else {
            date_string = date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
        }

        return options.string ? date_string : date;
    };

    Chance.prototype.hammertime = function (options) {
        return this.date(options).getTime();
    };

    Chance.prototype.hour = function (options) {
        options = initOptions(options, {
            min: options && options.twentyfour ? 0 : 1,
            max: options && options.twentyfour ? 23 : 12
        });

        testRange(options.min < 0, "Chance: Min cannot be less than 0.");
        testRange(options.twentyfour && options.max > 23, "Chance: Max cannot be greater than 23 for twentyfour option.");
        testRange(!options.twentyfour && options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.millisecond = function () {
        return this.natural({max: 999});
    };

    Chance.prototype.minute = Chance.prototype.second = function (options) {
        options = initOptions(options, {min: 0, max: 59});

        testRange(options.min < 0, "Chance: Min cannot be less than 0.");
        testRange(options.max > 59, "Chance: Max cannot be greater than 59.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.month = function (options) {
        options = initOptions(options, {min: 1, max: 12});

        testRange(options.min < 1, "Chance: Min cannot be less than 1.");
        testRange(options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        var month = this.pick(this.months().slice(options.min - 1, options.max));
        return options.raw ? month : month.name;
    };

    Chance.prototype.months = function () {
        return this.get("months");
    };

    Chance.prototype.second = function () {
        return this.natural({max: 59});
    };

    Chance.prototype.timestamp = function () {
        return this.natural({min: 1, max: parseInt(new Date().getTime() / 1000, 10)});
    };

    Chance.prototype.weekday = function (options) {
        options = initOptions(options, {weekday_only: false});
        var weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        if (!options.weekday_only) {
            weekdays.push("Saturday");
            weekdays.push("Sunday");
        }
        return this.pickone(weekdays);
    };

    Chance.prototype.year = function (options) {
        // Default to current year as min if none specified
        options = initOptions(options, {min: new Date().getFullYear()});

        // Default to one century after current year as max if none specified
        options.max = (typeof options.max !== "undefined") ? options.max : options.min + 100;

        return this.natural(options).toString();
    };

    // -- End Time

    // -- Finance --

    Chance.prototype.cc = function (options) {
        options = initOptions(options);

        var type, number, to_generate;

        type = (options.type) ?
                    this.cc_type({ name: options.type, raw: true }) :
                    this.cc_type({ raw: true });

        number = type.prefix.split("");
        to_generate = type.length - type.prefix.length - 1;

        // Generates n - 1 digits
        number = number.concat(this.n(this.integer, to_generate, {min: 0, max: 9}));

        // Generates the last digit according to Luhn algorithm
        number.push(this.luhn_calculate(number.join("")));

        return number.join("");
    };

    Chance.prototype.cc_types = function () {
        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        return this.get("cc_types");
    };

    Chance.prototype.cc_type = function (options) {
        options = initOptions(options);
        var types = this.cc_types(),
            type = null;

        if (options.name) {
            for (var i = 0; i < types.length; i++) {
                // Accept either name or short_name to specify card type
                if (types[i].name === options.name || types[i].short_name === options.name) {
                    type = types[i];
                    break;
                }
            }
            if (type === null) {
                throw new RangeError("Credit card type '" + options.name + "'' is not supported");
            }
        } else {
            type = this.pick(types);
        }

        return options.raw ? type : type.name;
    };

    //return all world currency by ISO 4217
    Chance.prototype.currency_types = function () {
        return this.get("currency_types");
    };

    //return random world currency by ISO 4217
    Chance.prototype.currency = function () {
        return this.pick(this.currency_types());
    };

    //return all timezones availabel
    Chance.prototype.timezones = function () {
        return this.get("timezones");
    };

    //return random timezone
    Chance.prototype.timezone = function () {
        return this.pick(this.timezones());
    };

    //Return random correct currency exchange pair (e.g. EUR/USD) or array of currency code
    Chance.prototype.currency_pair = function (returnAsString) {
        var currencies = this.unique(this.currency, 2, {
            comparator: function(arr, val) {

                return arr.reduce(function(acc, item) {
                    // If a match has been found, short circuit check and just return
                    return acc || (item.code === val.code);
                }, false);
            }
        });

        if (returnAsString) {
            return currencies[0].code + '/' + currencies[1].code;
        } else {
            return currencies;
        }
    };

    Chance.prototype.dollar = function (options) {
        // By default, a somewhat more sane max for dollar than all available numbers
        options = initOptions(options, {max : 10000, min : 0});

        var dollar = this.floating({min: options.min, max: options.max, fixed: 2}).toString(),
            cents = dollar.split('.')[1];

        if (cents === undefined) {
            dollar += '.00';
        } else if (cents.length < 2) {
            dollar = dollar + '0';
        }

        if (dollar < 0) {
            return '-$' + dollar.replace('-', '');
        } else {
            return '$' + dollar;
        }
    };

    Chance.prototype.euro = function (options) {
        return Number(this.dollar(options).replace("$", "")).toLocaleString() + "€";
    };

    Chance.prototype.exp = function (options) {
        options = initOptions(options);
        var exp = {};

        exp.year = this.exp_year();

        // If the year is this year, need to ensure month is greater than the
        // current month or this expiration will not be valid
        if (exp.year === (new Date().getFullYear()).toString()) {
            exp.month = this.exp_month({future: true});
        } else {
            exp.month = this.exp_month();
        }

        return options.raw ? exp : exp.month + '/' + exp.year;
    };

    Chance.prototype.exp_month = function (options) {
        options = initOptions(options);
        var month, month_int,
            // Date object months are 0 indexed
            curMonth = new Date().getMonth() + 1;

        if (options.future && (curMonth !== 12)) {
            do {
                month = this.month({raw: true}).numeric;
                month_int = parseInt(month, 10);
            } while (month_int <= curMonth);
        } else {
            month = this.month({raw: true}).numeric;
        }

        return month;
    };

    Chance.prototype.exp_year = function () {
        var curMonth = new Date().getMonth() + 1,
            curYear = new Date().getFullYear();

        return this.year({min: ((curMonth === 12) ? (curYear + 1) : curYear), max: (curYear + 10)});
    };

    Chance.prototype.vat = function (options) {
        options = initOptions(options, { country: 'it' });
        switch (options.country.toLowerCase()) {
            case 'it':
                return this.it_vat();
        }
    };

    /**
     * Generate a string matching IBAN pattern (https://en.wikipedia.org/wiki/International_Bank_Account_Number). 
     * No country-specific formats support (yet)
     */
    Chance.prototype.iban = function () {
        var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        var alphanum = alpha + '0123456789';
        var iban = 
            this.string({ length: 2, pool: alpha }) + 
            this.pad(this.integer({ min: 0, max: 99 }), 2) + 
            this.string({ length: 4, pool: alphanum }) + 
            this.pad(this.natural(), this.natural({ min: 6, max: 26 }));
        return iban;
    };

    // -- End Finance

    // -- Regional

    Chance.prototype.it_vat = function () {
        var it_vat = this.natural({min: 1, max: 1800000});

        it_vat = this.pad(it_vat, 7) + this.pad(this.pick(this.provinces({ country: 'it' })).code, 3);
        return it_vat + this.luhn_calculate(it_vat);
    };

    /*
     * this generator is written following the official algorithm
     * all data can be passed explicitely or randomized by calling chance.cf() without options
     * the code does not check that the input data is valid (it goes beyond the scope of the generator)
     *
     * @param  [Object] options = { first: first name,
     *                              last: last name,
     *                              gender: female|male,
                                    birthday: JavaScript date object,
                                    city: string(4), 1 letter + 3 numbers
                                   }
     * @return [string] codice fiscale
     *
    */
    Chance.prototype.cf = function (options) {
        options = options || {};
        var gender = !!options.gender ? options.gender : this.gender(),
            first = !!options.first ? options.first : this.first( { gender: gender, nationality: 'it'} ),
            last = !!options.last ? options.last : this.last( { nationality: 'it'} ),
            birthday = !!options.birthday ? options.birthday : this.birthday(),
            city = !!options.city ? options.city : this.pickone(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'Z']) + this.pad(this.natural({max:999}), 3),
            cf = [],
            name_generator = function(name, isLast) {
                var temp,
                    return_value = [];

                if (name.length < 3) {
                    return_value = name.split("").concat("XXX".split("")).splice(0,3);
                }
                else {
                    temp = name.toUpperCase().split('').map(function(c){
                        return ("BCDFGHJKLMNPRSTVWZ".indexOf(c) !== -1) ? c : undefined;
                    }).join('');
                    if (temp.length > 3) {
                        if (isLast) {
                            temp = temp.substr(0,3);
                        } else {
                            temp = temp[0] + temp.substr(2,2);
                        }
                    }
                    if (temp.length < 3) {
                        return_value = temp;
                        temp = name.toUpperCase().split('').map(function(c){
                            return ("AEIOU".indexOf(c) !== -1) ? c : undefined;
                        }).join('').substr(0, 3 - return_value.length);
                    }
                    return_value = return_value + temp;
                }

                return return_value;
            },
            date_generator = function(birthday, gender, that) {
                var lettermonths = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T'];

                return  birthday.getFullYear().toString().substr(2) +
                        lettermonths[birthday.getMonth()] +
                        that.pad(birthday.getDate() + ((gender.toLowerCase() === "female") ? 40 : 0), 2);
            },
            checkdigit_generator = function(cf) {
                var range1 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    range2 = "ABCDEFGHIJABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    evens  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    odds   = "BAKPLCQDREVOSFTGUHMINJWZYX",
                    digit  = 0;


                for(var i = 0; i < 15; i++) {
                    if (i % 2 !== 0) {
                        digit += evens.indexOf(range2[range1.indexOf(cf[i])]);
                    }
                    else {
                        digit +=  odds.indexOf(range2[range1.indexOf(cf[i])]);
                    }
                }
                return evens[digit % 26];
            };

        cf = cf.concat(name_generator(last, true), name_generator(first), date_generator(birthday, gender, this), city.toUpperCase().split("")).join("");
        cf += checkdigit_generator(cf.toUpperCase(), this);

        return cf.toUpperCase();
    };

    Chance.prototype.pl_pesel = function () {
        var number = this.natural({min: 1, max: 9999999999});
        var arr = this.pad(number, 10).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (1 * arr[0] + 3 * arr[1] + 7 * arr[2] + 9 * arr[3] + 1 * arr[4] + 3 * arr[5] + 7 * arr[6] + 9 * arr[7] + 1 * arr[8] + 3 * arr[9]) % 10;
        if(controlNumber !== 0) {
            controlNumber = 10 - controlNumber;
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_nip = function () {
        var number = this.natural({min: 1, max: 999999999});
        var arr = this.pad(number, 9).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (6 * arr[0] + 5 * arr[1] + 7 * arr[2] + 2 * arr[3] + 3 * arr[4] + 4 * arr[5] + 5 * arr[6] + 6 * arr[7] + 7 * arr[8]) % 11;
        if(controlNumber === 10) {
            return this.pl_nip();
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_regon = function () {
        var number = this.natural({min: 1, max: 99999999});
        var arr = this.pad(number, 8).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (8 * arr[0] + 9 * arr[1] + 2 * arr[2] + 3 * arr[3] + 4 * arr[4] + 5 * arr[5] + 6 * arr[6] + 7 * arr[7]) % 11;
        if(controlNumber === 10) {
            controlNumber = 0;
        }

        return arr.join('') + controlNumber;
    };

    // -- End Regional

    // -- Miscellaneous --

    // Dice - For all the board game geeks out there, myself included ;)
    function diceFn (range) {
        return function () {
            return this.natural(range);
        };
    }
    Chance.prototype.d4 = diceFn({min: 1, max: 4});
    Chance.prototype.d6 = diceFn({min: 1, max: 6});
    Chance.prototype.d8 = diceFn({min: 1, max: 8});
    Chance.prototype.d10 = diceFn({min: 1, max: 10});
    Chance.prototype.d12 = diceFn({min: 1, max: 12});
    Chance.prototype.d20 = diceFn({min: 1, max: 20});
    Chance.prototype.d30 = diceFn({min: 1, max: 30});
    Chance.prototype.d100 = diceFn({min: 1, max: 100});

    Chance.prototype.rpg = function (thrown, options) {
        options = initOptions(options);
        if (!thrown) {
            throw new RangeError("A type of die roll must be included");
        } else {
            var bits = thrown.toLowerCase().split("d"),
                rolls = [];

            if (bits.length !== 2 || !parseInt(bits[0], 10) || !parseInt(bits[1], 10)) {
                throw new Error("Invalid format provided. Please provide #d# where the first # is the number of dice to roll, the second # is the max of each die");
            }
            for (var i = bits[0]; i > 0; i--) {
                rolls[i - 1] = this.natural({min: 1, max: bits[1]});
            }
            return (typeof options.sum !== 'undefined' && options.sum) ? rolls.reduce(function (p, c) { return p + c; }) : rolls;
        }
    };

    // Guid
    Chance.prototype.guid = function (options) {
        options = initOptions(options, { version: 5 });

        var guid_pool = "abcdef1234567890",
            variant_pool = "ab89",
            guid = this.string({ pool: guid_pool, length: 8 }) + '-' +
                   this.string({ pool: guid_pool, length: 4 }) + '-' +
                   // The Version
                   options.version +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   // The Variant
                   this.string({ pool: variant_pool, length: 1 }) +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   this.string({ pool: guid_pool, length: 12 });
        return guid;
    };

    // Hash
    Chance.prototype.hash = function (options) {
        options = initOptions(options, {length : 40, casing: 'lower'});
        var pool = options.casing === 'upper' ? HEX_POOL.toUpperCase() : HEX_POOL;
        return this.string({pool: pool, length: options.length});
    };

    Chance.prototype.luhn_check = function (num) {
        var str = num.toString();
        var checkDigit = +str.substring(str.length - 1);
        return checkDigit === this.luhn_calculate(+str.substring(0, str.length - 1));
    };

    Chance.prototype.luhn_calculate = function (num) {
        var digits = num.toString().split("").reverse();
        var sum = 0;
        var digit;

        for (var i = 0, l = digits.length; l > i; ++i) {
            digit = +digits[i];
            if (i % 2 === 0) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
        }
        return (sum * 9) % 10;
    };

    // MD5 Hash
    Chance.prototype.md5 = function(options) {
        var opts = { str: '', key: null, raw: false };

        if (!options) {
            opts.str = this.string();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.str = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if(options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if(!opts.str){
            throw new Error('A parameter is required to return an md5 hash.');
        }

        return this.bimd5.md5(opts.str, opts.key, opts.raw);
    };

    /**
     * #Description:
     * =====================================================
     * Generate random file name with extension
     *
     * The argument provide extension type
     * -> raster
     * -> vector
     * -> 3d
     * -> document
     *
     * If nothing is provided the function return random file name with random
     * extension type of any kind
     *
     * The user can validate the file name length range
     * If nothing provided the generated file name is random
     *
     * #Extension Pool :
     * * Currently the supported extensions are
     *  -> some of the most popular raster image extensions
     *  -> some of the most popular vector image extensions
     *  -> some of the most popular 3d image extensions
     *  -> some of the most popular document extensions
     *
     * #Examples :
     * =====================================================
     *
     * Return random file name with random extension. The file extension
     * is provided by a predefined collection of extensions. More about the extension
     * pool can be found in #Extension Pool section
     *
     * chance.file()
     * => dsfsdhjf.xml
     *
     * In order to generate a file name with specific length, specify the
     * length property and integer value. The extension is going to be random
     *
     * chance.file({length : 10})
     * => asrtineqos.pdf
     *
     * In order to generate file with extension from some of the predefined groups
     * of the extension pool just specify the extension pool category in fileType property
     *
     * chance.file({fileType : 'raster'})
     * => dshgssds.psd
     *
     * You can provide specific extension for your files
     * chance.file({extension : 'html'})
     * => djfsd.html
     *
     * Or you could pass custom collection of extensions by array or by object
     * chance.file({extensions : [...]})
     * => dhgsdsd.psd
     *
     * chance.file({extensions : { key : [...], key : [...]}})
     * => djsfksdjsd.xml
     *
     * @param  [collection] options
     * @return [string]
     *
     */
    Chance.prototype.file = function(options) {

        var fileOptions = options || {};
        var poolCollectionKey = "fileExtension";
        var typeRange   = Object.keys(this.get("fileExtension"));//['raster', 'vector', '3d', 'document'];
        var fileName;
        var fileExtension;

        // Generate random file name
        fileName = this.word({length : fileOptions.length});

        // Generate file by specific extension provided by the user
        if(fileOptions.extension) {

            fileExtension = fileOptions.extension;
            return (fileName + '.' + fileExtension);
        }

        // Generate file by specific extension collection
        if(fileOptions.extensions) {

            if(Array.isArray(fileOptions.extensions)) {

                fileExtension = this.pickone(fileOptions.extensions);
                return (fileName + '.' + fileExtension);
            }
            else if(fileOptions.extensions.constructor === Object) {

                var extensionObjectCollection = fileOptions.extensions;
                var keys = Object.keys(extensionObjectCollection);

                fileExtension = this.pickone(extensionObjectCollection[this.pickone(keys)]);
                return (fileName + '.' + fileExtension);
            }

            throw new Error("Expect collection of type Array or Object to be passed as an argument ");
        }

        // Generate file extension based on specific file type
        if(fileOptions.fileType) {

            var fileType = fileOptions.fileType;
            if(typeRange.indexOf(fileType) !== -1) {

                fileExtension = this.pickone(this.get(poolCollectionKey)[fileType]);
                return (fileName + '.' + fileExtension);
            }

            throw new Error("Expect file type value to be 'raster', 'vector', '3d' or 'document' ");
        }

        // Generate random file name if no extension options are passed
        fileExtension = this.pickone(this.get(poolCollectionKey)[this.pickone(typeRange)]);
        return (fileName + '.' + fileExtension);
    };

    var data = {

        firstNames: {
            "male": {
                "en": ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Charles", "Thomas", "Christopher", "Daniel", "Matthew", "George", "Donald", "Anthony", "Paul", "Mark", "Edward", "Steven", "Kenneth", "Andrew", "Brian", "Joshua", "Kevin", "Ronald", "Timothy", "Jason", "Jeffrey", "Frank", "Gary", "Ryan", "Nicholas", "Eric", "Stephen", "Jacob", "Larry", "Jonathan", "Scott", "Raymond", "Justin", "Brandon", "Gregory", "Samuel", "Benjamin", "Patrick", "Jack", "Henry", "Walter", "Dennis", "Jerry", "Alexander", "Peter", "Tyler", "Douglas", "Harold", "Aaron", "Jose", "Adam", "Arthur", "Zachary", "Carl", "Nathan", "Albert", "Kyle", "Lawrence", "Joe", "Willie", "Gerald", "Roger", "Keith", "Jeremy", "Terry", "Harry", "Ralph", "Sean", "Jesse", "Roy", "Louis", "Billy", "Austin", "Bruce", "Eugene", "Christian", "Bryan", "Wayne", "Russell", "Howard", "Fred", "Ethan", "Jordan", "Philip", "Alan", "Juan", "Randy", "Vincent", "Bobby", "Dylan", "Johnny", "Phillip", "Victor", "Clarence", "Ernest", "Martin", "Craig", "Stanley", "Shawn", "Travis", "Bradley", "Leonard", "Earl", "Gabriel", "Jimmy", "Francis", "Todd", "Noah", "Danny", "Dale", "Cody", "Carlos", "Allen", "Frederick", "Logan", "Curtis", "Alex", "Joel", "Luis", "Norman", "Marvin", "Glenn", "Tony", "Nathaniel", "Rodney", "Melvin", "Alfred", "Steve", "Cameron", "Chad", "Edwin", "Caleb", "Evan", "Antonio", "Lee", "Herbert", "Jeffery", "Isaac", "Derek", "Ricky", "Marcus", "Theodore", "Elijah", "Luke", "Jesus", "Eddie", "Troy", "Mike", "Dustin", "Ray", "Adrian", "Bernard", "Leroy", "Angel", "Randall", "Wesley", "Ian", "Jared", "Mason", "Hunter", "Calvin", "Oscar", "Clifford", "Jay", "Shane", "Ronnie", "Barry", "Lucas", "Corey", "Manuel", "Leo", "Tommy", "Warren", "Jackson", "Isaiah", "Connor", "Don", "Dean", "Jon", "Julian", "Miguel", "Bill", "Lloyd", "Charlie", "Mitchell", "Leon", "Jerome", "Darrell", "Jeremiah", "Alvin", "Brett", "Seth", "Floyd", "Jim", "Blake", "Micheal", "Gordon", "Trevor", "Lewis", "Erik", "Edgar", "Vernon", "Devin", "Gavin", "Jayden", "Chris", "Clyde", "Tom", "Derrick", "Mario", "Brent", "Marc", "Herman", "Chase", "Dominic", "Ricardo", "Franklin", "Maurice", "Max", "Aiden", "Owen", "Lester", "Gilbert", "Elmer", "Gene", "Francisco", "Glen", "Cory", "Garrett", "Clayton", "Sam", "Jorge", "Chester", "Alejandro", "Jeff", "Harvey", "Milton", "Cole", "Ivan", "Andre", "Duane", "Landon"],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0163
                "it": ["Adolfo", "Alberto", "Aldo", "Alessandro", "Alessio", "Alfredo", "Alvaro", "Andrea", "Angelo", "Angiolo", "Antonino", "Antonio", "Attilio", "Benito", "Bernardo", "Bruno", "Carlo", "Cesare", "Christian", "Claudio", "Corrado", "Cosimo", "Cristian", "Cristiano", "Daniele", "Dario", "David", "Davide", "Diego", "Dino", "Domenico", "Duccio", "Edoardo", "Elia", "Elio", "Emanuele", "Emiliano", "Emilio", "Enrico", "Enzo", "Ettore", "Fabio", "Fabrizio", "Federico", "Ferdinando", "Fernando", "Filippo", "Francesco", "Franco", "Gabriele", "Giacomo", "Giampaolo", "Giampiero", "Giancarlo", "Gianfranco", "Gianluca", "Gianmarco", "Gianni", "Gino", "Giorgio", "Giovanni", "Giuliano", "Giulio", "Giuseppe", "Graziano", "Gregorio", "Guido", "Iacopo", "Jacopo", "Lapo", "Leonardo", "Lorenzo", "Luca", "Luciano", "Luigi", "Manuel", "Marcello", "Marco", "Marino", "Mario", "Massimiliano", "Massimo", "Matteo", "Mattia", "Maurizio", "Mauro", "Michele", "Mirko", "Mohamed", "Nello", "Neri", "Niccolò", "Nicola", "Osvaldo", "Otello", "Paolo", "Pier Luigi", "Piero", "Pietro", "Raffaele", "Remo", "Renato", "Renzo", "Riccardo", "Roberto", "Rolando", "Romano", "Salvatore", "Samuele", "Sandro", "Sergio", "Silvano", "Simone", "Stefano", "Thomas", "Tommaso", "Ubaldo", "Ugo", "Umberto", "Valerio", "Valter", "Vasco", "Vincenzo", "Vittorio"]
            },
            "female": {
                "en": ["Mary", "Emma", "Elizabeth", "Minnie", "Margaret", "Ida", "Alice", "Bertha", "Sarah", "Annie", "Clara", "Ella", "Florence", "Cora", "Martha", "Laura", "Nellie", "Grace", "Carrie", "Maude", "Mabel", "Bessie", "Jennie", "Gertrude", "Julia", "Hattie", "Edith", "Mattie", "Rose", "Catherine", "Lillian", "Ada", "Lillie", "Helen", "Jessie", "Louise", "Ethel", "Lula", "Myrtle", "Eva", "Frances", "Lena", "Lucy", "Edna", "Maggie", "Pearl", "Daisy", "Fannie", "Josephine", "Dora", "Rosa", "Katherine", "Agnes", "Marie", "Nora", "May", "Mamie", "Blanche", "Stella", "Ellen", "Nancy", "Effie", "Sallie", "Nettie", "Della", "Lizzie", "Flora", "Susie", "Maud", "Mae", "Etta", "Harriet", "Sadie", "Caroline", "Katie", "Lydia", "Elsie", "Kate", "Susan", "Mollie", "Alma", "Addie", "Georgia", "Eliza", "Lulu", "Nannie", "Lottie", "Amanda", "Belle", "Charlotte", "Rebecca", "Ruth", "Viola", "Olive", "Amelia", "Hannah", "Jane", "Virginia", "Emily", "Matilda", "Irene", "Kathryn", "Esther", "Willie", "Henrietta", "Ollie", "Amy", "Rachel", "Sara", "Estella", "Theresa", "Augusta", "Ora", "Pauline", "Josie", "Lola", "Sophia", "Leona", "Anne", "Mildred", "Ann", "Beulah", "Callie", "Lou", "Delia", "Eleanor", "Barbara", "Iva", "Louisa", "Maria", "Mayme", "Evelyn", "Estelle", "Nina", "Betty", "Marion", "Bettie", "Dorothy", "Luella", "Inez", "Lela", "Rosie", "Allie", "Millie", "Janie", "Cornelia", "Victoria", "Ruby", "Winifred", "Alta", "Celia", "Christine", "Beatrice", "Birdie", "Harriett", "Mable", "Myra", "Sophie", "Tillie", "Isabel", "Sylvia", "Carolyn", "Isabelle", "Leila", "Sally", "Ina", "Essie", "Bertie", "Nell", "Alberta", "Katharine", "Lora", "Rena", "Mina", "Rhoda", "Mathilda", "Abbie", "Eula", "Dollie", "Hettie", "Eunice", "Fanny", "Ola", "Lenora", "Adelaide", "Christina", "Lelia", "Nelle", "Sue", "Johanna", "Lilly", "Lucinda", "Minerva", "Lettie", "Roxie", "Cynthia", "Helena", "Hilda", "Hulda", "Bernice", "Genevieve", "Jean", "Cordelia", "Marian", "Francis", "Jeanette", "Adeline", "Gussie", "Leah", "Lois", "Lura", "Mittie", "Hallie", "Isabella", "Olga", "Phoebe", "Teresa", "Hester", "Lida", "Lina", "Winnie", "Claudia", "Marguerite", "Vera", "Cecelia", "Bess", "Emilie", "Rosetta", "Verna", "Myrtie", "Cecilia", "Elva", "Olivia", "Ophelia", "Georgie", "Elnora", "Violet", "Adele", "Lily", "Linnie", "Loretta", "Madge", "Polly", "Virgie", "Eugenia", "Lucile", "Lucille", "Mabelle", "Rosalie"],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0162
                "it": ["Ada", "Adriana", "Alessandra", "Alessia", "Alice", "Angela", "Anna", "Anna Maria", "Annalisa", "Annita", "Annunziata", "Antonella", "Arianna", "Asia", "Assunta", "Aurora", "Barbara", "Beatrice", "Benedetta", "Bianca", "Bruna", "Camilla", "Carla", "Carlotta", "Carmela", "Carolina", "Caterina", "Catia", "Cecilia", "Chiara", "Cinzia", "Clara", "Claudia", "Costanza", "Cristina", "Daniela", "Debora", "Diletta", "Dina", "Donatella", "Elena", "Eleonora", "Elisa", "Elisabetta", "Emanuela", "Emma", "Eva", "Federica", "Fernanda", "Fiorella", "Fiorenza", "Flora", "Franca", "Francesca", "Gabriella", "Gaia", "Gemma", "Giada", "Gianna", "Gina", "Ginevra", "Giorgia", "Giovanna", "Giulia", "Giuliana", "Giuseppa", "Giuseppina", "Grazia", "Graziella", "Greta", "Ida", "Ilaria", "Ines", "Iolanda", "Irene", "Irma", "Isabella", "Jessica", "Laura", "Leda", "Letizia", "Licia", "Lidia", "Liliana", "Lina", "Linda", "Lisa", "Livia", "Loretta", "Luana", "Lucia", "Luciana", "Lucrezia", "Luisa", "Manuela", "Mara", "Marcella", "Margherita", "Maria", "Maria Cristina", "Maria Grazia", "Maria Luisa", "Maria Pia", "Maria Teresa", "Marina", "Marisa", "Marta", "Martina", "Marzia", "Matilde", "Melissa", "Michela", "Milena", "Mirella", "Monica", "Natalina", "Nella", "Nicoletta", "Noemi", "Olga", "Paola", "Patrizia", "Piera", "Pierina", "Raffaella", "Rebecca", "Renata", "Rina", "Rita", "Roberta", "Rosa", "Rosanna", "Rossana", "Rossella", "Sabrina", "Sandra", "Sara", "Serena", "Silvana", "Silvia", "Simona", "Simonetta", "Sofia", "Sonia", "Stefania", "Susanna", "Teresa", "Tina", "Tiziana", "Tosca", "Valentina", "Valeria", "Vanda", "Vanessa", "Vanna", "Vera", "Veronica", "Vilma", "Viola", "Virginia", "Vittoria"]
            }
        },

        lastNames: {
            "en": ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Peterson', 'Gray', 'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Flores', 'Washington', 'Butler', 'Simmons', 'Foster', 'Gonzales', 'Bryant', 'Alexander', 'Russell', 'Griffin', 'Diaz', 'Hayes', 'Myers', 'Ford', 'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Fisher', 'Ellis', 'Harrison', 'Gibson', 'McDonald', 'Cruz', 'Marshall', 'Ortiz', 'Gomez', 'Murray', 'Freeman', 'Wells', 'Webb', 'Simpson', 'Stevens', 'Tucker', 'Porter', 'Hunter', 'Hicks', 'Crawford', 'Henry', 'Boyd', 'Mason', 'Morales', 'Kennedy', 'Warren', 'Dixon', 'Ramos', 'Reyes', 'Burns', 'Gordon', 'Shaw', 'Holmes', 'Rice', 'Robertson', 'Hunt', 'Black', 'Daniels', 'Palmer', 'Mills', 'Nichols', 'Grant', 'Knight', 'Ferguson', 'Rose', 'Stone', 'Hawkins', 'Dunn', 'Perkins', 'Hudson', 'Spencer', 'Gardner', 'Stephens', 'Payne', 'Pierce', 'Berry', 'Matthews', 'Arnold', 'Wagner', 'Willis', 'Ray', 'Watkins', 'Olson', 'Carroll', 'Duncan', 'Snyder', 'Hart', 'Cunningham', 'Bradley', 'Lane', 'Andrews', 'Ruiz', 'Harper', 'Fox', 'Riley', 'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Chavez', 'Sims', 'Austin', 'Peters', 'Kelley', 'Franklin', 'Lawson', 'Fields', 'Gutierrez', 'Ryan', 'Schmidt', 'Carr', 'Vasquez', 'Castillo', 'Wheeler', 'Chapman', 'Oliver', 'Montgomery', 'Richards', 'Williamson', 'Johnston', 'Banks', 'Meyer', 'Bishop', 'McCoy', 'Howell', 'Alvarez', 'Morrison', 'Hansen', 'Fernandez', 'Garza', 'Harvey', 'Little', 'Burton', 'Stanley', 'Nguyen', 'George', 'Jacobs', 'Reid', 'Kim', 'Fuller', 'Lynch', 'Dean', 'Gilbert', 'Garrett', 'Romero', 'Welch', 'Larson', 'Frazier', 'Burke', 'Hanson', 'Day', 'Mendoza', 'Moreno', 'Bowman', 'Medina', 'Fowler', 'Brewer', 'Hoffman', 'Carlson', 'Silva', 'Pearson', 'Holland', 'Douglas', 'Fleming', 'Jensen', 'Vargas', 'Byrd', 'Davidson', 'Hopkins', 'May', 'Terry', 'Herrera', 'Wade', 'Soto', 'Walters', 'Curtis', 'Neal', 'Caldwell', 'Lowe', 'Jennings', 'Barnett', 'Graves', 'Jimenez', 'Horton', 'Shelton', 'Barrett', 'Obrien', 'Castro', 'Sutton', 'Gregory', 'McKinney', 'Lucas', 'Miles', 'Craig', 'Rodriquez', 'Chambers', 'Holt', 'Lambert', 'Fletcher', 'Watts', 'Bates', 'Hale', 'Rhodes', 'Pena', 'Beck', 'Newman', 'Haynes', 'McDaniel', 'Mendez', 'Bush', 'Vaughn', 'Parks', 'Dawson', 'Santiago', 'Norris', 'Hardy', 'Love', 'Steele', 'Curry', 'Powers', 'Schultz', 'Barker', 'Guzman', 'Page', 'Munoz', 'Ball', 'Keller', 'Chandler', 'Weber', 'Leonard', 'Walsh', 'Lyons', 'Ramsey', 'Wolfe', 'Schneider', 'Mullins', 'Benson', 'Sharp', 'Bowen', 'Daniel', 'Barber', 'Cummings', 'Hines', 'Baldwin', 'Griffith', 'Valdez', 'Hubbard', 'Salazar', 'Reeves', 'Warner', 'Stevenson', 'Burgess', 'Santos', 'Tate', 'Cross', 'Garner', 'Mann', 'Mack', 'Moss', 'Thornton', 'Dennis', 'McGee', 'Farmer', 'Delgado', 'Aguilar', 'Vega', 'Glover', 'Manning', 'Cohen', 'Harmon', 'Rodgers', 'Robbins', 'Newton', 'Todd', 'Blair', 'Higgins', 'Ingram', 'Reese', 'Cannon', 'Strickland', 'Townsend', 'Potter', 'Goodwin', 'Walton', 'Rowe', 'Hampton', 'Ortega', 'Patton', 'Swanson', 'Joseph', 'Francis', 'Goodman', 'Maldonado', 'Yates', 'Becker', 'Erickson', 'Hodges', 'Rios', 'Conner', 'Adkins', 'Webster', 'Norman', 'Malone', 'Hammond', 'Flowers', 'Cobb', 'Moody', 'Quinn', 'Blake', 'Maxwell', 'Pope', 'Floyd', 'Osborne', 'Paul', 'McCarthy', 'Guerrero', 'Lindsey', 'Estrada', 'Sandoval', 'Gibbs', 'Tyler', 'Gross', 'Fitzgerald', 'Stokes', 'Doyle', 'Sherman', 'Saunders', 'Wise', 'Colon', 'Gill', 'Alvarado', 'Greer', 'Padilla', 'Simon', 'Waters', 'Nunez', 'Ballard', 'Schwartz', 'McBride', 'Houston', 'Christensen', 'Klein', 'Pratt', 'Briggs', 'Parsons', 'McLaughlin', 'Zimmerman', 'French', 'Buchanan', 'Moran', 'Copeland', 'Roy', 'Pittman', 'Brady', 'McCormick', 'Holloway', 'Brock', 'Poole', 'Frank', 'Logan', 'Owen', 'Bass', 'Marsh', 'Drake', 'Wong', 'Jefferson', 'Park', 'Morton', 'Abbott', 'Sparks', 'Patrick', 'Norton', 'Huff', 'Clayton', 'Massey', 'Lloyd', 'Figueroa', 'Carson', 'Bowers', 'Roberson', 'Barton', 'Tran', 'Lamb', 'Harrington', 'Casey', 'Boone', 'Cortez', 'Clarke', 'Mathis', 'Singleton', 'Wilkins', 'Cain', 'Bryan', 'Underwood', 'Hogan', 'McKenzie', 'Collier', 'Luna', 'Phelps', 'McGuire', 'Allison', 'Bridges', 'Wilkerson', 'Nash', 'Summers', 'Atkins'],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0164 (first 1000)
            "it": ["Acciai", "Aglietti", "Agostini", "Agresti", "Ahmed", "Aiazzi", "Albanese", "Alberti", "Alessi", "Alfani", "Alinari", "Alterini", "Amato", "Ammannati", "Ancillotti", "Andrei", "Andreini", "Andreoni", "Angeli", "Anichini", "Antonelli", "Antonini", "Arena", "Ariani", "Arnetoli", "Arrighi", "Baccani", "Baccetti", "Bacci", "Bacherini", "Badii", "Baggiani", "Baglioni", "Bagni", "Bagnoli", "Baldassini", "Baldi", "Baldini", "Ballerini", "Balli", "Ballini", "Balloni", "Bambi", "Banchi", "Bandinelli", "Bandini", "Bani", "Barbetti", "Barbieri", "Barchielli", "Bardazzi", "Bardelli", "Bardi", "Barducci", "Bargellini", "Bargiacchi", "Barni", "Baroncelli", "Baroncini", "Barone", "Baroni", "Baronti", "Bartalesi", "Bartoletti", "Bartoli", "Bartolini", "Bartoloni", "Bartolozzi", "Basagni", "Basile", "Bassi", "Batacchi", "Battaglia", "Battaglini", "Bausi", "Becagli", "Becattini", "Becchi", "Becucci", "Bellandi", "Bellesi", "Belli", "Bellini", "Bellucci", "Bencini", "Benedetti", "Benelli", "Beni", "Benini", "Bensi", "Benucci", "Benvenuti", "Berlincioni", "Bernacchioni", "Bernardi", "Bernardini", "Berni", "Bernini", "Bertelli", "Berti", "Bertini", "Bessi", "Betti", "Bettini", "Biagi", "Biagini", "Biagioni", "Biagiotti", "Biancalani", "Bianchi", "Bianchini", "Bianco", "Biffoli", "Bigazzi", "Bigi", "Biliotti", "Billi", "Binazzi", "Bindi", "Bini", "Biondi", "Bizzarri", "Bocci", "Bogani", "Bolognesi", "Bonaiuti", "Bonanni", "Bonciani", "Boncinelli", "Bondi", "Bonechi", "Bongini", "Boni", "Bonini", "Borchi", "Boretti", "Borghi", "Borghini", "Borgioli", "Borri", "Borselli", "Boschi", "Bottai", "Bracci", "Braccini", "Brandi", "Braschi", "Bravi", "Brazzini", "Breschi", "Brilli", "Brizzi", "Brogelli", "Brogi", "Brogioni", "Brunelli", "Brunetti", "Bruni", "Bruno", "Brunori", "Bruschi", "Bucci", "Bucciarelli", "Buccioni", "Bucelli", "Bulli", "Burberi", "Burchi", "Burgassi", "Burroni", "Bussotti", "Buti", "Caciolli", "Caiani", "Calabrese", "Calamai", "Calamandrei", "Caldini", "Calo'", "Calonaci", "Calosi", "Calvelli", "Cambi", "Camiciottoli", "Cammelli", "Cammilli", "Campolmi", "Cantini", "Capanni", "Capecchi", "Caponi", "Cappelletti", "Cappelli", "Cappellini", "Cappugi", "Capretti", "Caputo", "Carbone", "Carboni", "Cardini", "Carlesi", "Carletti", "Carli", "Caroti", "Carotti", "Carrai", "Carraresi", "Carta", "Caruso", "Casalini", "Casati", "Caselli", "Casini", "Castagnoli", "Castellani", "Castelli", "Castellucci", "Catalano", "Catarzi", "Catelani", "Cavaciocchi", "Cavallaro", "Cavallini", "Cavicchi", "Cavini", "Ceccarelli", "Ceccatelli", "Ceccherelli", "Ceccherini", "Cecchi", "Cecchini", "Cecconi", "Cei", "Cellai", "Celli", "Cellini", "Cencetti", "Ceni", "Cenni", "Cerbai", "Cesari", "Ceseri", "Checcacci", "Checchi", "Checcucci", "Cheli", "Chellini", "Chen", "Cheng", "Cherici", "Cherubini", "Chiaramonti", "Chiarantini", "Chiarelli", "Chiari", "Chiarini", "Chiarugi", "Chiavacci", "Chiesi", "Chimenti", "Chini", "Chirici", "Chiti", "Ciabatti", "Ciampi", "Cianchi", "Cianfanelli", "Cianferoni", "Ciani", "Ciapetti", "Ciappi", "Ciardi", "Ciatti", "Cicali", "Ciccone", "Cinelli", "Cini", "Ciobanu", "Ciolli", "Cioni", "Cipriani", "Cirillo", "Cirri", "Ciucchi", "Ciuffi", "Ciulli", "Ciullini", "Clemente", "Cocchi", "Cognome", "Coli", "Collini", "Colombo", "Colzi", "Comparini", "Conforti", "Consigli", "Conte", "Conti", "Contini", "Coppini", "Coppola", "Corsi", "Corsini", "Corti", "Cortini", "Cosi", "Costa", "Costantini", "Costantino", "Cozzi", "Cresci", "Crescioli", "Cresti", "Crini", "Curradi", "D'Agostino", "D'Alessandro", "D'Amico", "D'Angelo", "Daddi", "Dainelli", "Dallai", "Danti", "Davitti", "De Angelis", "De Luca", "De Marco", "De Rosa", "De Santis", "De Simone", "De Vita", "Degl'Innocenti", "Degli Innocenti", "Dei", "Del Lungo", "Del Re", "Di Marco", "Di Stefano", "Dini", "Diop", "Dobre", "Dolfi", "Donati", "Dondoli", "Dong", "Donnini", "Ducci", "Dumitru", "Ermini", "Esposito", "Evangelisti", "Fabbri", "Fabbrini", "Fabbrizzi", "Fabbroni", "Fabbrucci", "Fabiani", "Facchini", "Faggi", "Fagioli", "Failli", "Faini", "Falciani", "Falcini", "Falcone", "Fallani", "Falorni", "Falsini", "Falugiani", "Fancelli", "Fanelli", "Fanetti", "Fanfani", "Fani", "Fantappie'", "Fantechi", "Fanti", "Fantini", "Fantoni", "Farina", "Fattori", "Favilli", "Fedi", "Fei", "Ferrante", "Ferrara", "Ferrari", "Ferraro", "Ferretti", "Ferri", "Ferrini", "Ferroni", "Fiaschi", "Fibbi", "Fiesoli", "Filippi", "Filippini", "Fini", "Fioravanti", "Fiore", "Fiorentini", "Fiorini", "Fissi", "Focardi", "Foggi", "Fontana", "Fontanelli", "Fontani", "Forconi", "Formigli", "Forte", "Forti", "Fortini", "Fossati", "Fossi", "Francalanci", "Franceschi", "Franceschini", "Franchi", "Franchini", "Franci", "Francini", "Francioni", "Franco", "Frassineti", "Frati", "Fratini", "Frilli", "Frizzi", "Frosali", "Frosini", "Frullini", "Fusco", "Fusi", "Gabbrielli", "Gabellini", "Gagliardi", "Galanti", "Galardi", "Galeotti", "Galletti", "Galli", "Gallo", "Gallori", "Gambacciani", "Gargani", "Garofalo", "Garuglieri", "Gashi", "Gasperini", "Gatti", "Gelli", "Gensini", "Gentile", "Gentili", "Geri", "Gerini", "Gheri", "Ghini", "Giachetti", "Giachi", "Giacomelli", "Gianassi", "Giani", "Giannelli", "Giannetti", "Gianni", "Giannini", "Giannoni", "Giannotti", "Giannozzi", "Gigli", "Giordano", "Giorgetti", "Giorgi", "Giovacchini", "Giovannelli", "Giovannetti", "Giovannini", "Giovannoni", "Giuliani", "Giunti", "Giuntini", "Giusti", "Gonnelli", "Goretti", "Gori", "Gradi", "Gramigni", "Grassi", "Grasso", "Graziani", "Grazzini", "Greco", "Grifoni", "Grillo", "Grimaldi", "Grossi", "Gualtieri", "Guarducci", "Guarino", "Guarnieri", "Guasti", "Guerra", "Guerri", "Guerrini", "Guidi", "Guidotti", "He", "Hoxha", "Hu", "Huang", "Iandelli", "Ignesti", "Innocenti", "Jin", "La Rosa", "Lai", "Landi", "Landini", "Lanini", "Lapi", "Lapini", "Lari", "Lascialfari", "Lastrucci", "Latini", "Lazzeri", "Lazzerini", "Lelli", "Lenzi", "Leonardi", "Leoncini", "Leone", "Leoni", "Lepri", "Li", "Liao", "Lin", "Linari", "Lippi", "Lisi", "Livi", "Lombardi", "Lombardini", "Lombardo", "Longo", "Lopez", "Lorenzi", "Lorenzini", "Lorini", "Lotti", "Lu", "Lucchesi", "Lucherini", "Lunghi", "Lupi", "Madiai", "Maestrini", "Maffei", "Maggi", "Maggini", "Magherini", "Magini", "Magnani", "Magnelli", "Magni", "Magnolfi", "Magrini", "Malavolti", "Malevolti", "Manca", "Mancini", "Manetti", "Manfredi", "Mangani", "Mannelli", "Manni", "Mannini", "Mannucci", "Manuelli", "Manzini", "Marcelli", "Marchese", "Marchetti", "Marchi", "Marchiani", "Marchionni", "Marconi", "Marcucci", "Margheri", "Mari", "Mariani", "Marilli", "Marinai", "Marinari", "Marinelli", "Marini", "Marino", "Mariotti", "Marsili", "Martelli", "Martinelli", "Martini", "Martino", "Marzi", "Masi", "Masini", "Masoni", "Massai", "Materassi", "Mattei", "Matteini", "Matteucci", "Matteuzzi", "Mattioli", "Mattolini", "Matucci", "Mauro", "Mazzanti", "Mazzei", "Mazzetti", "Mazzi", "Mazzini", "Mazzocchi", "Mazzoli", "Mazzoni", "Mazzuoli", "Meacci", "Mecocci", "Meini", "Melani", "Mele", "Meli", "Mengoni", "Menichetti", "Meoni", "Merlini", "Messeri", "Messina", "Meucci", "Miccinesi", "Miceli", "Micheli", "Michelini", "Michelozzi", "Migliori", "Migliorini", "Milani", "Miniati", "Misuri", "Monaco", "Montagnani", "Montagni", "Montanari", "Montelatici", "Monti", "Montigiani", "Montini", "Morandi", "Morandini", "Morelli", "Moretti", "Morganti", "Mori", "Morini", "Moroni", "Morozzi", "Mugnai", "Mugnaini", "Mustafa", "Naldi", "Naldini", "Nannelli", "Nanni", "Nannini", "Nannucci", "Nardi", "Nardini", "Nardoni", "Natali", "Ndiaye", "Nencetti", "Nencini", "Nencioni", "Neri", "Nesi", "Nesti", "Niccolai", "Niccoli", "Niccolini", "Nigi", "Nistri", "Nocentini", "Noferini", "Novelli", "Nucci", "Nuti", "Nutini", "Oliva", "Olivieri", "Olmi", "Orlandi", "Orlandini", "Orlando", "Orsini", "Ortolani", "Ottanelli", "Pacciani", "Pace", "Paci", "Pacini", "Pagani", "Pagano", "Paggetti", "Pagliai", "Pagni", "Pagnini", "Paladini", "Palagi", "Palchetti", "Palloni", "Palmieri", "Palumbo", "Pampaloni", "Pancani", "Pandolfi", "Pandolfini", "Panerai", "Panichi", "Paoletti", "Paoli", "Paolini", "Papi", "Papini", "Papucci", "Parenti", "Parigi", "Parisi", "Parri", "Parrini", "Pasquini", "Passeri", "Pecchioli", "Pecorini", "Pellegrini", "Pepi", "Perini", "Perrone", "Peruzzi", "Pesci", "Pestelli", "Petri", "Petrini", "Petrucci", "Pettini", "Pezzati", "Pezzatini", "Piani", "Piazza", "Piazzesi", "Piazzini", "Piccardi", "Picchi", "Piccini", "Piccioli", "Pieraccini", "Pieraccioni", "Pieralli", "Pierattini", "Pieri", "Pierini", "Pieroni", "Pietrini", "Pini", "Pinna", "Pinto", "Pinzani", "Pinzauti", "Piras", "Pisani", "Pistolesi", "Poggesi", "Poggi", "Poggiali", "Poggiolini", "Poli", "Pollastri", "Porciani", "Pozzi", "Pratellesi", "Pratesi", "Prosperi", "Pruneti", "Pucci", "Puccini", "Puccioni", "Pugi", "Pugliese", "Puliti", "Querci", "Quercioli", "Raddi", "Radu", "Raffaelli", "Ragazzini", "Ranfagni", "Ranieri", "Rastrelli", "Raugei", "Raveggi", "Renai", "Renzi", "Rettori", "Ricci", "Ricciardi", "Ridi", "Ridolfi", "Rigacci", "Righi", "Righini", "Rinaldi", "Risaliti", "Ristori", "Rizzo", "Rocchi", "Rocchini", "Rogai", "Romagnoli", "Romanelli", "Romani", "Romano", "Romei", "Romeo", "Romiti", "Romoli", "Romolini", "Rontini", "Rosati", "Roselli", "Rosi", "Rossetti", "Rossi", "Rossini", "Rovai", "Ruggeri", "Ruggiero", "Russo", "Sabatini", "Saccardi", "Sacchetti", "Sacchi", "Sacco", "Salerno", "Salimbeni", "Salucci", "Salvadori", "Salvestrini", "Salvi", "Salvini", "Sanesi", "Sani", "Sanna", "Santi", "Santini", "Santoni", "Santoro", "Santucci", "Sardi", "Sarri", "Sarti", "Sassi", "Sbolci", "Scali", "Scarpelli", "Scarselli", "Scopetani", "Secci", "Selvi", "Senatori", "Senesi", "Serafini", "Sereni", "Serra", "Sestini", "Sguanci", "Sieni", "Signorini", "Silvestri", "Simoncini", "Simonetti", "Simoni", "Singh", "Sodi", "Soldi", "Somigli", "Sorbi", "Sorelli", "Sorrentino", "Sottili", "Spina", "Spinelli", "Staccioli", "Staderini", "Stefanelli", "Stefani", "Stefanini", "Stella", "Susini", "Tacchi", "Tacconi", "Taddei", "Tagliaferri", "Tamburini", "Tanganelli", "Tani", "Tanini", "Tapinassi", "Tarchi", "Tarchiani", "Targioni", "Tassi", "Tassini", "Tempesti", "Terzani", "Tesi", "Testa", "Testi", "Tilli", "Tinti", "Tirinnanzi", "Toccafondi", "Tofanari", "Tofani", "Tognaccini", "Tonelli", "Tonini", "Torelli", "Torrini", "Tosi", "Toti", "Tozzi", "Trambusti", "Trapani", "Tucci", "Turchi", "Ugolini", "Ulivi", "Valente", "Valenti", "Valentini", "Vangelisti", "Vanni", "Vannini", "Vannoni", "Vannozzi", "Vannucchi", "Vannucci", "Ventura", "Venturi", "Venturini", "Vestri", "Vettori", "Vichi", "Viciani", "Vieri", "Vigiani", "Vignoli", "Vignolini", "Vignozzi", "Villani", "Vinci", "Visani", "Vitale", "Vitali", "Viti", "Viviani", "Vivoli", "Volpe", "Volpi", "Wang", "Wu", "Xu", "Yang", "Ye", "Zagli", "Zani", "Zanieri", "Zanobini", "Zecchi", "Zetti", "Zhang", "Zheng", "Zhou", "Zhu", "Zingoni", "Zini", "Zoppi"]
        },

        // Data taken from https://github.com/umpirsky/country-list/blob/master/data/en_US/country.json
        countries: [{"name":"Afghanistan","abbreviation":"AF"},{"name":"Åland Islands","abbreviation":"AX"},{"name":"Albania","abbreviation":"AL"},{"name":"Algeria","abbreviation":"DZ"},{"name":"American Samoa","abbreviation":"AS"},{"name":"Andorra","abbreviation":"AD"},{"name":"Angola","abbreviation":"AO"},{"name":"Anguilla","abbreviation":"AI"},{"name":"Antarctica","abbreviation":"AQ"},{"name":"Antigua & Barbuda","abbreviation":"AG"},{"name":"Argentina","abbreviation":"AR"},{"name":"Armenia","abbreviation":"AM"},{"name":"Aruba","abbreviation":"AW"},{"name":"Ascension Island","abbreviation":"AC"},{"name":"Australia","abbreviation":"AU"},{"name":"Austria","abbreviation":"AT"},{"name":"Azerbaijan","abbreviation":"AZ"},{"name":"Bahamas","abbreviation":"BS"},{"name":"Bahrain","abbreviation":"BH"},{"name":"Bangladesh","abbreviation":"BD"},{"name":"Barbados","abbreviation":"BB"},{"name":"Belarus","abbreviation":"BY"},{"name":"Belgium","abbreviation":"BE"},{"name":"Belize","abbreviation":"BZ"},{"name":"Benin","abbreviation":"BJ"},{"name":"Bermuda","abbreviation":"BM"},{"name":"Bhutan","abbreviation":"BT"},{"name":"Bolivia","abbreviation":"BO"},{"name":"Bosnia & Herzegovina","abbreviation":"BA"},{"name":"Botswana","abbreviation":"BW"},{"name":"Brazil","abbreviation":"BR"},{"name":"British Indian Ocean Territory","abbreviation":"IO"},{"name":"British Virgin Islands","abbreviation":"VG"},{"name":"Brunei","abbreviation":"BN"},{"name":"Bulgaria","abbreviation":"BG"},{"name":"Burkina Faso","abbreviation":"BF"},{"name":"Burundi","abbreviation":"BI"},{"name":"Cambodia","abbreviation":"KH"},{"name":"Cameroon","abbreviation":"CM"},{"name":"Canada","abbreviation":"CA"},{"name":"Canary Islands","abbreviation":"IC"},{"name":"Cape Verde","abbreviation":"CV"},{"name":"Caribbean Netherlands","abbreviation":"BQ"},{"name":"Cayman Islands","abbreviation":"KY"},{"name":"Central African Republic","abbreviation":"CF"},{"name":"Ceuta & Melilla","abbreviation":"EA"},{"name":"Chad","abbreviation":"TD"},{"name":"Chile","abbreviation":"CL"},{"name":"China","abbreviation":"CN"},{"name":"Christmas Island","abbreviation":"CX"},{"name":"Cocos (Keeling) Islands","abbreviation":"CC"},{"name":"Colombia","abbreviation":"CO"},{"name":"Comoros","abbreviation":"KM"},{"name":"Congo - Brazzaville","abbreviation":"CG"},{"name":"Congo - Kinshasa","abbreviation":"CD"},{"name":"Cook Islands","abbreviation":"CK"},{"name":"Costa Rica","abbreviation":"CR"},{"name":"Côte d'Ivoire","abbreviation":"CI"},{"name":"Croatia","abbreviation":"HR"},{"name":"Cuba","abbreviation":"CU"},{"name":"Curaçao","abbreviation":"CW"},{"name":"Cyprus","abbreviation":"CY"},{"name":"Czech Republic","abbreviation":"CZ"},{"name":"Denmark","abbreviation":"DK"},{"name":"Diego Garcia","abbreviation":"DG"},{"name":"Djibouti","abbreviation":"DJ"},{"name":"Dominica","abbreviation":"DM"},{"name":"Dominican Republic","abbreviation":"DO"},{"name":"Ecuador","abbreviation":"EC"},{"name":"Egypt","abbreviation":"EG"},{"name":"El Salvador","abbreviation":"SV"},{"name":"Equatorial Guinea","abbreviation":"GQ"},{"name":"Eritrea","abbreviation":"ER"},{"name":"Estonia","abbreviation":"EE"},{"name":"Ethiopia","abbreviation":"ET"},{"name":"Falkland Islands","abbreviation":"FK"},{"name":"Faroe Islands","abbreviation":"FO"},{"name":"Fiji","abbreviation":"FJ"},{"name":"Finland","abbreviation":"FI"},{"name":"France","abbreviation":"FR"},{"name":"French Guiana","abbreviation":"GF"},{"name":"French Polynesia","abbreviation":"PF"},{"name":"French Southern Territories","abbreviation":"TF"},{"name":"Gabon","abbreviation":"GA"},{"name":"Gambia","abbreviation":"GM"},{"name":"Georgia","abbreviation":"GE"},{"name":"Germany","abbreviation":"DE"},{"name":"Ghana","abbreviation":"GH"},{"name":"Gibraltar","abbreviation":"GI"},{"name":"Greece","abbreviation":"GR"},{"name":"Greenland","abbreviation":"GL"},{"name":"Grenada","abbreviation":"GD"},{"name":"Guadeloupe","abbreviation":"GP"},{"name":"Guam","abbreviation":"GU"},{"name":"Guatemala","abbreviation":"GT"},{"name":"Guernsey","abbreviation":"GG"},{"name":"Guinea","abbreviation":"GN"},{"name":"Guinea-Bissau","abbreviation":"GW"},{"name":"Guyana","abbreviation":"GY"},{"name":"Haiti","abbreviation":"HT"},{"name":"Honduras","abbreviation":"HN"},{"name":"Hong Kong SAR China","abbreviation":"HK"},{"name":"Hungary","abbreviation":"HU"},{"name":"Iceland","abbreviation":"IS"},{"name":"India","abbreviation":"IN"},{"name":"Indonesia","abbreviation":"ID"},{"name":"Iran","abbreviation":"IR"},{"name":"Iraq","abbreviation":"IQ"},{"name":"Ireland","abbreviation":"IE"},{"name":"Isle of Man","abbreviation":"IM"},{"name":"Israel","abbreviation":"IL"},{"name":"Italy","abbreviation":"IT"},{"name":"Jamaica","abbreviation":"JM"},{"name":"Japan","abbreviation":"JP"},{"name":"Jersey","abbreviation":"JE"},{"name":"Jordan","abbreviation":"JO"},{"name":"Kazakhstan","abbreviation":"KZ"},{"name":"Kenya","abbreviation":"KE"},{"name":"Kiribati","abbreviation":"KI"},{"name":"Kosovo","abbreviation":"XK"},{"name":"Kuwait","abbreviation":"KW"},{"name":"Kyrgyzstan","abbreviation":"KG"},{"name":"Laos","abbreviation":"LA"},{"name":"Latvia","abbreviation":"LV"},{"name":"Lebanon","abbreviation":"LB"},{"name":"Lesotho","abbreviation":"LS"},{"name":"Liberia","abbreviation":"LR"},{"name":"Libya","abbreviation":"LY"},{"name":"Liechtenstein","abbreviation":"LI"},{"name":"Lithuania","abbreviation":"LT"},{"name":"Luxembourg","abbreviation":"LU"},{"name":"Macau SAR China","abbreviation":"MO"},{"name":"Macedonia","abbreviation":"MK"},{"name":"Madagascar","abbreviation":"MG"},{"name":"Malawi","abbreviation":"MW"},{"name":"Malaysia","abbreviation":"MY"},{"name":"Maldives","abbreviation":"MV"},{"name":"Mali","abbreviation":"ML"},{"name":"Malta","abbreviation":"MT"},{"name":"Marshall Islands","abbreviation":"MH"},{"name":"Martinique","abbreviation":"MQ"},{"name":"Mauritania","abbreviation":"MR"},{"name":"Mauritius","abbreviation":"MU"},{"name":"Mayotte","abbreviation":"YT"},{"name":"Mexico","abbreviation":"MX"},{"name":"Micronesia","abbreviation":"FM"},{"name":"Moldova","abbreviation":"MD"},{"name":"Monaco","abbreviation":"MC"},{"name":"Mongolia","abbreviation":"MN"},{"name":"Montenegro","abbreviation":"ME"},{"name":"Montserrat","abbreviation":"MS"},{"name":"Morocco","abbreviation":"MA"},{"name":"Mozambique","abbreviation":"MZ"},{"name":"Myanmar (Burma)","abbreviation":"MM"},{"name":"Namibia","abbreviation":"NA"},{"name":"Nauru","abbreviation":"NR"},{"name":"Nepal","abbreviation":"NP"},{"name":"Netherlands","abbreviation":"NL"},{"name":"New Caledonia","abbreviation":"NC"},{"name":"New Zealand","abbreviation":"NZ"},{"name":"Nicaragua","abbreviation":"NI"},{"name":"Niger","abbreviation":"NE"},{"name":"Nigeria","abbreviation":"NG"},{"name":"Niue","abbreviation":"NU"},{"name":"Norfolk Island","abbreviation":"NF"},{"name":"North Korea","abbreviation":"KP"},{"name":"Northern Mariana Islands","abbreviation":"MP"},{"name":"Norway","abbreviation":"NO"},{"name":"Oman","abbreviation":"OM"},{"name":"Pakistan","abbreviation":"PK"},{"name":"Palau","abbreviation":"PW"},{"name":"Palestinian Territories","abbreviation":"PS"},{"name":"Panama","abbreviation":"PA"},{"name":"Papua New Guinea","abbreviation":"PG"},{"name":"Paraguay","abbreviation":"PY"},{"name":"Peru","abbreviation":"PE"},{"name":"Philippines","abbreviation":"PH"},{"name":"Pitcairn Islands","abbreviation":"PN"},{"name":"Poland","abbreviation":"PL"},{"name":"Portugal","abbreviation":"PT"},{"name":"Puerto Rico","abbreviation":"PR"},{"name":"Qatar","abbreviation":"QA"},{"name":"Réunion","abbreviation":"RE"},{"name":"Romania","abbreviation":"RO"},{"name":"Russia","abbreviation":"RU"},{"name":"Rwanda","abbreviation":"RW"},{"name":"Samoa","abbreviation":"WS"},{"name":"San Marino","abbreviation":"SM"},{"name":"São Tomé and Príncipe","abbreviation":"ST"},{"name":"Saudi Arabia","abbreviation":"SA"},{"name":"Senegal","abbreviation":"SN"},{"name":"Serbia","abbreviation":"RS"},{"name":"Seychelles","abbreviation":"SC"},{"name":"Sierra Leone","abbreviation":"SL"},{"name":"Singapore","abbreviation":"SG"},{"name":"Sint Maarten","abbreviation":"SX"},{"name":"Slovakia","abbreviation":"SK"},{"name":"Slovenia","abbreviation":"SI"},{"name":"Solomon Islands","abbreviation":"SB"},{"name":"Somalia","abbreviation":"SO"},{"name":"South Africa","abbreviation":"ZA"},{"name":"South Georgia & South Sandwich Islands","abbreviation":"GS"},{"name":"South Korea","abbreviation":"KR"},{"name":"South Sudan","abbreviation":"SS"},{"name":"Spain","abbreviation":"ES"},{"name":"Sri Lanka","abbreviation":"LK"},{"name":"St. Barthélemy","abbreviation":"BL"},{"name":"St. Helena","abbreviation":"SH"},{"name":"St. Kitts & Nevis","abbreviation":"KN"},{"name":"St. Lucia","abbreviation":"LC"},{"name":"St. Martin","abbreviation":"MF"},{"name":"St. Pierre & Miquelon","abbreviation":"PM"},{"name":"St. Vincent & Grenadines","abbreviation":"VC"},{"name":"Sudan","abbreviation":"SD"},{"name":"Suriname","abbreviation":"SR"},{"name":"Svalbard & Jan Mayen","abbreviation":"SJ"},{"name":"Swaziland","abbreviation":"SZ"},{"name":"Sweden","abbreviation":"SE"},{"name":"Switzerland","abbreviation":"CH"},{"name":"Syria","abbreviation":"SY"},{"name":"Taiwan","abbreviation":"TW"},{"name":"Tajikistan","abbreviation":"TJ"},{"name":"Tanzania","abbreviation":"TZ"},{"name":"Thailand","abbreviation":"TH"},{"name":"Timor-Leste","abbreviation":"TL"},{"name":"Togo","abbreviation":"TG"},{"name":"Tokelau","abbreviation":"TK"},{"name":"Tonga","abbreviation":"TO"},{"name":"Trinidad & Tobago","abbreviation":"TT"},{"name":"Tristan da Cunha","abbreviation":"TA"},{"name":"Tunisia","abbreviation":"TN"},{"name":"Turkey","abbreviation":"TR"},{"name":"Turkmenistan","abbreviation":"TM"},{"name":"Turks & Caicos Islands","abbreviation":"TC"},{"name":"Tuvalu","abbreviation":"TV"},{"name":"U.S. Outlying Islands","abbreviation":"UM"},{"name":"U.S. Virgin Islands","abbreviation":"VI"},{"name":"Uganda","abbreviation":"UG"},{"name":"Ukraine","abbreviation":"UA"},{"name":"United Arab Emirates","abbreviation":"AE"},{"name":"United Kingdom","abbreviation":"GB"},{"name":"United States","abbreviation":"US"},{"name":"Uruguay","abbreviation":"UY"},{"name":"Uzbekistan","abbreviation":"UZ"},{"name":"Vanuatu","abbreviation":"VU"},{"name":"Vatican City","abbreviation":"VA"},{"name":"Venezuela","abbreviation":"VE"},{"name":"Vietnam","abbreviation":"VN"},{"name":"Wallis & Futuna","abbreviation":"WF"},{"name":"Western Sahara","abbreviation":"EH"},{"name":"Yemen","abbreviation":"YE"},{"name":"Zambia","abbreviation":"ZM"},{"name":"Zimbabwe","abbreviation":"ZW"}],

		counties: {
            // Data taken from http://www.downloadexcelfiles.com/gb_en/download-excel-file-list-counties-uk
            "uk": [
                {name: 'Bath and North East Somerset'},
                {name: 'Aberdeenshire'},
                {name: 'Anglesey'},
                {name: 'Angus'},
                {name: 'Bedford'},
                {name: 'Blackburn with Darwen'},
                {name: 'Blackpool'},
                {name: 'Bournemouth'},
                {name: 'Bracknell Forest'},
                {name: 'Brighton & Hove'},
                {name: 'Bristol'},
                {name: 'Buckinghamshire'},
                {name: 'Cambridgeshire'},
                {name: 'Carmarthenshire'},
                {name: 'Central Bedfordshire'},
                {name: 'Ceredigion'},
                {name: 'Cheshire East'},
                {name: 'Cheshire West and Chester'},
                {name: 'Clackmannanshire'},
                {name: 'Conwy'},
                {name: 'Cornwall'},
                {name: 'County Antrim'},
                {name: 'County Armagh'},
                {name: 'County Down'},
                {name: 'County Durham'},
                {name: 'County Fermanagh'},
                {name: 'County Londonderry'},
                {name: 'County Tyrone'},
                {name: 'Cumbria'},
                {name: 'Darlington'},
                {name: 'Denbighshire'},
                {name: 'Derby'},
                {name: 'Derbyshire'},
                {name: 'Devon'},
                {name: 'Dorset'},
                {name: 'Dumfries and Galloway'},
                {name: 'Dundee'},
                {name: 'East Lothian'},
                {name: 'East Riding of Yorkshire'},
                {name: 'East Sussex'},
                {name: 'Edinburgh?'},
                {name: 'Essex'},
                {name: 'Falkirk'},
                {name: 'Fife'},
                {name: 'Flintshire'},
                {name: 'Gloucestershire'},
                {name: 'Greater London'},
                {name: 'Greater Manchester'},
                {name: 'Gwent'},
                {name: 'Gwynedd'},
                {name: 'Halton'},
                {name: 'Hampshire'},
                {name: 'Hartlepool'},
                {name: 'Herefordshire'},
                {name: 'Hertfordshire'},
                {name: 'Highlands'},
                {name: 'Hull'},
                {name: 'Isle of Wight'},
                {name: 'Isles of Scilly'},
                {name: 'Kent'},
                {name: 'Lancashire'},
                {name: 'Leicester'},
                {name: 'Leicestershire'},
                {name: 'Lincolnshire'},
                {name: 'Lothian'},
                {name: 'Luton'},
                {name: 'Medway'},
                {name: 'Merseyside'},
                {name: 'Mid Glamorgan'},
                {name: 'Middlesbrough'},
                {name: 'Milton Keynes'},
                {name: 'Monmouthshire'},
                {name: 'Moray'},
                {name: 'Norfolk'},
                {name: 'North East Lincolnshire'},
                {name: 'North Lincolnshire'},
                {name: 'North Somerset'},
                {name: 'North Yorkshire'},
                {name: 'Northamptonshire'},
                {name: 'Northumberland'},
                {name: 'Nottingham'},
                {name: 'Nottinghamshire'},
                {name: 'Oxfordshire'},
                {name: 'Pembrokeshire'},
                {name: 'Perth and Kinross'},
                {name: 'Peterborough'},
                {name: 'Plymouth'},
                {name: 'Poole'},
                {name: 'Portsmouth'},
                {name: 'Powys'},
                {name: 'Reading'},
                {name: 'Redcar and Cleveland'},
                {name: 'Rutland'},
                {name: 'Scottish Borders'},
                {name: 'Shropshire'},
                {name: 'Slough'},
                {name: 'Somerset'},
                {name: 'South Glamorgan'},
                {name: 'South Gloucestershire'},
                {name: 'South Yorkshire'},
                {name: 'Southampton'},
                {name: 'Southend-on-Sea'},
                {name: 'Staffordshire'},
                {name: 'Stirlingshire'},
                {name: 'Stockton-on-Tees'},
                {name: 'Stoke-on-Trent'},
                {name: 'Strathclyde'},
                {name: 'Suffolk'},
                {name: 'Surrey'},
                {name: 'Swindon'},
                {name: 'Telford and Wrekin'},
                {name: 'Thurrock'},
                {name: 'Torbay'},
                {name: 'Tyne and Wear'},
                {name: 'Warrington'},
                {name: 'Warwickshire'},
                {name: 'West Berkshire'},
                {name: 'West Glamorgan'},
                {name: 'West Lothian'},
                {name: 'West Midlands'},
                {name: 'West Sussex'},
                {name: 'West Yorkshire'},
                {name: 'Western Isles'},
                {name: 'Wiltshire'},
                {name: 'Windsor and Maidenhead'},
                {name: 'Wokingham'},
                {name: 'Worcestershire'},
                {name: 'Wrexham'},
                {name: 'York'}]
				},
        provinces: {
            "ca": [
                {name: 'Alberta', abbreviation: 'AB'},
                {name: 'British Columbia', abbreviation: 'BC'},
                {name: 'Manitoba', abbreviation: 'MB'},
                {name: 'New Brunswick', abbreviation: 'NB'},
                {name: 'Newfoundland and Labrador', abbreviation: 'NL'},
                {name: 'Nova Scotia', abbreviation: 'NS'},
                {name: 'Ontario', abbreviation: 'ON'},
                {name: 'Prince Edward Island', abbreviation: 'PE'},
                {name: 'Quebec', abbreviation: 'QC'},
                {name: 'Saskatchewan', abbreviation: 'SK'},

                // The case could be made that the following are not actually provinces
                // since they are technically considered "territories" however they all
                // look the same on an envelope!
                {name: 'Northwest Territories', abbreviation: 'NT'},
                {name: 'Nunavut', abbreviation: 'NU'},
                {name: 'Yukon', abbreviation: 'YT'}
            ],
            "it": [
                { name: "Agrigento", abbreviation: "AG", code: 84 },
                { name: "Alessandria", abbreviation: "AL", code: 6 },
                { name: "Ancona", abbreviation: "AN", code: 42 },
                { name: "Aosta", abbreviation: "AO", code: 7 },
                { name: "L'Aquila", abbreviation: "AQ", code: 66 },
                { name: "Arezzo", abbreviation: "AR", code: 51 },
                { name: "Ascoli-Piceno", abbreviation: "AP", code: 44 },
                { name: "Asti", abbreviation: "AT", code: 5 },
                { name: "Avellino", abbreviation: "AV", code: 64 },
                { name: "Bari", abbreviation: "BA", code: 72 },
                { name: "Barletta-Andria-Trani", abbreviation: "BT", code: 72 },
                { name: "Belluno", abbreviation: "BL", code: 25 },
                { name: "Benevento", abbreviation: "BN", code: 62 },
                { name: "Bergamo", abbreviation: "BG", code: 16 },
                { name: "Biella", abbreviation: "BI", code: 96 },
                { name: "Bologna", abbreviation: "BO", code: 37 },
                { name: "Bolzano", abbreviation: "BZ", code: 21 },
                { name: "Brescia", abbreviation: "BS", code: 17 },
                { name: "Brindisi", abbreviation: "BR", code: 74 },
                { name: "Cagliari", abbreviation: "CA", code: 92 },
                { name: "Caltanissetta", abbreviation: "CL", code: 85 },
                { name: "Campobasso", abbreviation: "CB", code: 70 },
                { name: "Carbonia Iglesias", abbreviation: "CI", code: 70 },
                { name: "Caserta", abbreviation: "CE", code: 61 },
                { name: "Catania", abbreviation: "CT", code: 87 },
                { name: "Catanzaro", abbreviation: "CZ", code: 79 },
                { name: "Chieti", abbreviation: "CH", code: 69 },
                { name: "Como", abbreviation: "CO", code: 13 },
                { name: "Cosenza", abbreviation: "CS", code: 78 },
                { name: "Cremona", abbreviation: "CR", code: 19 },
                { name: "Crotone", abbreviation: "KR", code: 101 },
                { name: "Cuneo", abbreviation: "CN", code: 4 },
                { name: "Enna", abbreviation: "EN", code: 86 },
                { name: "Fermo", abbreviation: "FM", code: 86 },
                { name: "Ferrara", abbreviation: "FE", code: 38 },
                { name: "Firenze", abbreviation: "FI", code: 48 },
                { name: "Foggia", abbreviation: "FG", code: 71 },
                { name: "Forli-Cesena", abbreviation: "FC", code: 71 },
                { name: "Frosinone", abbreviation: "FR", code: 60 },
                { name: "Genova", abbreviation: "GE", code: 10 },
                { name: "Gorizia", abbreviation: "GO", code: 31 },
                { name: "Grosseto", abbreviation: "GR", code: 53 },
                { name: "Imperia", abbreviation: "IM", code: 8 },
                { name: "Isernia", abbreviation: "IS", code: 94 },
                { name: "La-Spezia", abbreviation: "SP", code: 66 },
                { name: "Latina", abbreviation: "LT", code: 59 },
                { name: "Lecce", abbreviation: "LE", code: 75 },
                { name: "Lecco", abbreviation: "LC", code: 97 },
                { name: "Livorno", abbreviation: "LI", code: 49 },
                { name: "Lodi", abbreviation: "LO", code: 98 },
                { name: "Lucca", abbreviation: "LU", code: 46 },
                { name: "Macerata", abbreviation: "MC", code: 43 },
                { name: "Mantova", abbreviation: "MN", code: 20 },
                { name: "Massa-Carrara", abbreviation: "MS", code: 45 },
                { name: "Matera", abbreviation: "MT", code: 77 },
                { name: "Medio Campidano", abbreviation: "VS", code: 77 },
                { name: "Messina", abbreviation: "ME", code: 83 },
                { name: "Milano", abbreviation: "MI", code: 15 },
                { name: "Modena", abbreviation: "MO", code: 36 },
                { name: "Monza-Brianza", abbreviation: "MB", code: 36 },
                { name: "Napoli", abbreviation: "NA", code: 63 },
                { name: "Novara", abbreviation: "NO", code: 3 },
                { name: "Nuoro", abbreviation: "NU", code: 91 },
                { name: "Ogliastra", abbreviation: "OG", code: 91 },
                { name: "Olbia Tempio", abbreviation: "OT", code: 91 },
                { name: "Oristano", abbreviation: "OR", code: 95 },
                { name: "Padova", abbreviation: "PD", code: 28 },
                { name: "Palermo", abbreviation: "PA", code: 82 },
                { name: "Parma", abbreviation: "PR", code: 34 },
                { name: "Pavia", abbreviation: "PV", code: 18 },
                { name: "Perugia", abbreviation: "PG", code: 54 },
                { name: "Pesaro-Urbino", abbreviation: "PU", code: 41 },
                { name: "Pescara", abbreviation: "PE", code: 68 },
                { name: "Piacenza", abbreviation: "PC", code: 33 },
                { name: "Pisa", abbreviation: "PI", code: 50 },
                { name: "Pistoia", abbreviation: "PT", code: 47 },
                { name: "Pordenone", abbreviation: "PN", code: 93 },
                { name: "Potenza", abbreviation: "PZ", code: 76 },
                { name: "Prato", abbreviation: "PO", code: 100 },
                { name: "Ragusa", abbreviation: "RG", code: 88 },
                { name: "Ravenna", abbreviation: "RA", code: 39 },
                { name: "Reggio-Calabria", abbreviation: "RC", code: 35 },
                { name: "Reggio-Emilia", abbreviation: "RE", code: 35 },
                { name: "Rieti", abbreviation: "RI", code: 57 },
                { name: "Rimini", abbreviation: "RN", code: 99 },
                { name: "Roma", abbreviation: "Roma", code: 58 },
                { name: "Rovigo", abbreviation: "RO", code: 29 },
                { name: "Salerno", abbreviation: "SA", code: 65 },
                { name: "Sassari", abbreviation: "SS", code: 90 },
                { name: "Savona", abbreviation: "SV", code: 9 },
                { name: "Siena", abbreviation: "SI", code: 52 },
                { name: "Siracusa", abbreviation: "SR", code: 89 },
                { name: "Sondrio", abbreviation: "SO", code: 14 },
                { name: "Taranto", abbreviation: "TA", code: 73 },
                { name: "Teramo", abbreviation: "TE", code: 67 },
                { name: "Terni", abbreviation: "TR", code: 55 },
                { name: "Torino", abbreviation: "TO", code: 1 },
                { name: "Trapani", abbreviation: "TP", code: 81 },
                { name: "Trento", abbreviation: "TN", code: 22 },
                { name: "Treviso", abbreviation: "TV", code: 26 },
                { name: "Trieste", abbreviation: "TS", code: 32 },
                { name: "Udine", abbreviation: "UD", code: 30 },
                { name: "Varese", abbreviation: "VA", code: 12 },
                { name: "Venezia", abbreviation: "VE", code: 27 },
                { name: "Verbania", abbreviation: "VB", code: 27 },
                { name: "Vercelli", abbreviation: "VC", code: 2 },
                { name: "Verona", abbreviation: "VR", code: 23 },
                { name: "Vibo-Valentia", abbreviation: "VV", code: 102 },
                { name: "Vicenza", abbreviation: "VI", code: 24 },
                { name: "Viterbo", abbreviation: "VT", code: 56 }
            ]
        },

            // from: https://github.com/samsargent/Useful-Autocomplete-Data/blob/master/data/nationalities.json
        nationalities: [
           {name: 'Afghan'},
           {name: 'Albanian'},
           {name: 'Algerian'},
           {name: 'American'},
           {name: 'Andorran'},
           {name: 'Angolan'},
           {name: 'Antiguans'},
           {name: 'Argentinean'},
           {name: 'Armenian'},
           {name: 'Australian'},
           {name: 'Austrian'},
           {name: 'Azerbaijani'},
           {name: 'Bahami'},
           {name: 'Bahraini'},
           {name: 'Bangladeshi'},
           {name: 'Barbadian'},
           {name: 'Barbudans'},
           {name: 'Batswana'},
           {name: 'Belarusian'},
           {name: 'Belgian'},
           {name: 'Belizean'},
           {name: 'Beninese'},
           {name: 'Bhutanese'},
           {name: 'Bolivian'},
           {name: 'Bosnian'},
           {name: 'Brazilian'},
           {name: 'British'},
           {name: 'Bruneian'},
           {name: 'Bulgarian'},
           {name: 'Burkinabe'},
           {name: 'Burmese'},
           {name: 'Burundian'},
           {name: 'Cambodian'},
           {name: 'Cameroonian'},
           {name: 'Canadian'},
           {name: 'Cape Verdean'},
           {name: 'Central African'},
           {name: 'Chadian'},
           {name: 'Chilean'},
           {name: 'Chinese'},
           {name: 'Colombian'},
           {name: 'Comoran'},
           {name: 'Congolese'},
           {name: 'Costa Rican'},
           {name: 'Croatian'},
           {name: 'Cuban'},
           {name: 'Cypriot'},
           {name: 'Czech'},
           {name: 'Danish'},
           {name: 'Djibouti'},
           {name: 'Dominican'},
           {name: 'Dutch'},
           {name: 'East Timorese'},
           {name: 'Ecuadorean'},
           {name: 'Egyptian'},
           {name: 'Emirian'},
           {name: 'Equatorial Guinean'},
           {name: 'Eritrean'},
           {name: 'Estonian'},
           {name: 'Ethiopian'},
           {name: 'Fijian'},
           {name: 'Filipino'},
           {name: 'Finnish'},
           {name: 'French'},
           {name: 'Gabonese'},
           {name: 'Gambian'},
           {name: 'Georgian'},
           {name: 'German'},
           {name: 'Ghanaian'},
           {name: 'Greek'},
           {name: 'Grenadian'},
           {name: 'Guatemalan'},
           {name: 'Guinea-Bissauan'},
           {name: 'Guinean'},
           {name: 'Guyanese'},
           {name: 'Haitian'},
           {name: 'Herzegovinian'},
           {name: 'Honduran'},
           {name: 'Hungarian'},
           {name: 'I-Kiribati'},
           {name: 'Icelander'},
           {name: 'Indian'},
           {name: 'Indonesian'},
           {name: 'Iranian'},
           {name: 'Iraqi'},
           {name: 'Irish'},
           {name: 'Israeli'},
           {name: 'Italian'},
           {name: 'Ivorian'},
           {name: 'Jamaican'},
           {name: 'Japanese'},
           {name: 'Jordanian'},
           {name: 'Kazakhstani'},
           {name: 'Kenyan'},
           {name: 'Kittian and Nevisian'},
           {name: 'Kuwaiti'},
           {name: 'Kyrgyz'},
           {name: 'Laotian'},
           {name: 'Latvian'},
           {name: 'Lebanese'},
           {name: 'Liberian'},
           {name: 'Libyan'},
           {name: 'Liechtensteiner'},
           {name: 'Lithuanian'},
           {name: 'Luxembourger'},
           {name: 'Macedonian'},
           {name: 'Malagasy'},
           {name: 'Malawian'},
           {name: 'Malaysian'},
           {name: 'Maldivan'},
           {name: 'Malian'},
           {name: 'Maltese'},
           {name: 'Marshallese'},
           {name: 'Mauritanian'},
           {name: 'Mauritian'},
           {name: 'Mexican'},
           {name: 'Micronesian'},
           {name: 'Moldovan'},
           {name: 'Monacan'},
           {name: 'Mongolian'},
           {name: 'Moroccan'},
           {name: 'Mosotho'},
           {name: 'Motswana'},
           {name: 'Mozambican'},
           {name: 'Namibian'},
           {name: 'Nauruan'},
           {name: 'Nepalese'},
           {name: 'New Zealander'},
           {name: 'Nicaraguan'},
           {name: 'Nigerian'},
           {name: 'Nigerien'},
           {name: 'North Korean'},
           {name: 'Northern Irish'},
           {name: 'Norwegian'},
           {name: 'Omani'},
           {name: 'Pakistani'},
           {name: 'Palauan'},
           {name: 'Panamanian'},
           {name: 'Papua New Guinean'},
           {name: 'Paraguayan'},
           {name: 'Peruvian'},
           {name: 'Polish'},
           {name: 'Portuguese'},
           {name: 'Qatari'},
           {name: 'Romani'},
           {name: 'Russian'},
           {name: 'Rwandan'},
           {name: 'Saint Lucian'},
           {name: 'Salvadoran'},
           {name: 'Samoan'},
           {name: 'San Marinese'},
           {name: 'Sao Tomean'},
           {name: 'Saudi'},
           {name: 'Scottish'},
           {name: 'Senegalese'},
           {name: 'Serbian'},
           {name: 'Seychellois'},
           {name: 'Sierra Leonean'},
           {name: 'Singaporean'},
           {name: 'Slovakian'},
           {name: 'Slovenian'},
           {name: 'Solomon Islander'},
           {name: 'Somali'},
           {name: 'South African'},
           {name: 'South Korean'},
           {name: 'Spanish'},
           {name: 'Sri Lankan'},
           {name: 'Sudanese'},
           {name: 'Surinamer'},
           {name: 'Swazi'},
           {name: 'Swedish'},
           {name: 'Swiss'},
           {name: 'Syrian'},
           {name: 'Taiwanese'},
           {name: 'Tajik'},
           {name: 'Tanzanian'},
           {name: 'Thai'},
           {name: 'Togolese'},
           {name: 'Tongan'},
           {name: 'Trinidadian or Tobagonian'},
           {name: 'Tunisian'},
           {name: 'Turkish'},
           {name: 'Tuvaluan'},
           {name: 'Ugandan'},
           {name: 'Ukrainian'},
           {name: 'Uruguaya'},
           {name: 'Uzbekistani'},
           {name: 'Venezuela'},
           {name: 'Vietnamese'},
           {name: 'Wels'},
           {name: 'Yemenit'},
           {name: 'Zambia'},
           {name: 'Zimbabwe'},
        ],

        us_states_and_dc: [
            {name: 'Alabama', abbreviation: 'AL'},
            {name: 'Alaska', abbreviation: 'AK'},
            {name: 'Arizona', abbreviation: 'AZ'},
            {name: 'Arkansas', abbreviation: 'AR'},
            {name: 'California', abbreviation: 'CA'},
            {name: 'Colorado', abbreviation: 'CO'},
            {name: 'Connecticut', abbreviation: 'CT'},
            {name: 'Delaware', abbreviation: 'DE'},
            {name: 'District of Columbia', abbreviation: 'DC'},
            {name: 'Florida', abbreviation: 'FL'},
            {name: 'Georgia', abbreviation: 'GA'},
            {name: 'Hawaii', abbreviation: 'HI'},
            {name: 'Idaho', abbreviation: 'ID'},
            {name: 'Illinois', abbreviation: 'IL'},
            {name: 'Indiana', abbreviation: 'IN'},
            {name: 'Iowa', abbreviation: 'IA'},
            {name: 'Kansas', abbreviation: 'KS'},
            {name: 'Kentucky', abbreviation: 'KY'},
            {name: 'Louisiana', abbreviation: 'LA'},
            {name: 'Maine', abbreviation: 'ME'},
            {name: 'Maryland', abbreviation: 'MD'},
            {name: 'Massachusetts', abbreviation: 'MA'},
            {name: 'Michigan', abbreviation: 'MI'},
            {name: 'Minnesota', abbreviation: 'MN'},
            {name: 'Mississippi', abbreviation: 'MS'},
            {name: 'Missouri', abbreviation: 'MO'},
            {name: 'Montana', abbreviation: 'MT'},
            {name: 'Nebraska', abbreviation: 'NE'},
            {name: 'Nevada', abbreviation: 'NV'},
            {name: 'New Hampshire', abbreviation: 'NH'},
            {name: 'New Jersey', abbreviation: 'NJ'},
            {name: 'New Mexico', abbreviation: 'NM'},
            {name: 'New York', abbreviation: 'NY'},
            {name: 'North Carolina', abbreviation: 'NC'},
            {name: 'North Dakota', abbreviation: 'ND'},
            {name: 'Ohio', abbreviation: 'OH'},
            {name: 'Oklahoma', abbreviation: 'OK'},
            {name: 'Oregon', abbreviation: 'OR'},
            {name: 'Pennsylvania', abbreviation: 'PA'},
            {name: 'Rhode Island', abbreviation: 'RI'},
            {name: 'South Carolina', abbreviation: 'SC'},
            {name: 'South Dakota', abbreviation: 'SD'},
            {name: 'Tennessee', abbreviation: 'TN'},
            {name: 'Texas', abbreviation: 'TX'},
            {name: 'Utah', abbreviation: 'UT'},
            {name: 'Vermont', abbreviation: 'VT'},
            {name: 'Virginia', abbreviation: 'VA'},
            {name: 'Washington', abbreviation: 'WA'},
            {name: 'West Virginia', abbreviation: 'WV'},
            {name: 'Wisconsin', abbreviation: 'WI'},
            {name: 'Wyoming', abbreviation: 'WY'}
        ],

        territories: [
            {name: 'American Samoa', abbreviation: 'AS'},
            {name: 'Federated States of Micronesia', abbreviation: 'FM'},
            {name: 'Guam', abbreviation: 'GU'},
            {name: 'Marshall Islands', abbreviation: 'MH'},
            {name: 'Northern Mariana Islands', abbreviation: 'MP'},
            {name: 'Puerto Rico', abbreviation: 'PR'},
            {name: 'Virgin Islands, U.S.', abbreviation: 'VI'}
        ],

        armed_forces: [
            {name: 'Armed Forces Europe', abbreviation: 'AE'},
            {name: 'Armed Forces Pacific', abbreviation: 'AP'},
            {name: 'Armed Forces the Americas', abbreviation: 'AA'}
        ],

        country_regions: {
            it: [
                { name: "Valle d'Aosta", abbreviation: "VDA" },
                { name: "Piemonte", abbreviation: "PIE" },
                { name: "Lombardia", abbreviation: "LOM" },
                { name: "Veneto", abbreviation: "VEN" },
                { name: "Trentino Alto Adige", abbreviation: "TAA" },
                { name: "Friuli Venezia Giulia", abbreviation: "FVG" },
                { name: "Liguria", abbreviation: "LIG" },
                { name: "Emilia Romagna", abbreviation: "EMR" },
                { name: "Toscana", abbreviation: "TOS" },
                { name: "Umbria", abbreviation: "UMB" },
                { name: "Marche", abbreviation: "MAR" },
                { name: "Abruzzo", abbreviation: "ABR" },
                { name: "Lazio", abbreviation: "LAZ" },
                { name: "Campania", abbreviation: "CAM" },
                { name: "Puglia", abbreviation: "PUG" },
                { name: "Basilicata", abbreviation: "BAS" },
                { name: "Molise", abbreviation: "MOL" },
                { name: "Calabria", abbreviation: "CAL" },
                { name: "Sicilia", abbreviation: "SIC" },
                { name: "Sardegna", abbreviation: "SAR" }
            ]
        },

        street_suffixes: {
            'us': [
                {name: 'Avenue', abbreviation: 'Ave'},
                {name: 'Boulevard', abbreviation: 'Blvd'},
                {name: 'Center', abbreviation: 'Ctr'},
                {name: 'Circle', abbreviation: 'Cir'},
                {name: 'Court', abbreviation: 'Ct'},
                {name: 'Drive', abbreviation: 'Dr'},
                {name: 'Extension', abbreviation: 'Ext'},
                {name: 'Glen', abbreviation: 'Gln'},
                {name: 'Grove', abbreviation: 'Grv'},
                {name: 'Heights', abbreviation: 'Hts'},
                {name: 'Highway', abbreviation: 'Hwy'},
                {name: 'Junction', abbreviation: 'Jct'},
                {name: 'Key', abbreviation: 'Key'},
                {name: 'Lane', abbreviation: 'Ln'},
                {name: 'Loop', abbreviation: 'Loop'},
                {name: 'Manor', abbreviation: 'Mnr'},
                {name: 'Mill', abbreviation: 'Mill'},
                {name: 'Park', abbreviation: 'Park'},
                {name: 'Parkway', abbreviation: 'Pkwy'},
                {name: 'Pass', abbreviation: 'Pass'},
                {name: 'Path', abbreviation: 'Path'},
                {name: 'Pike', abbreviation: 'Pike'},
                {name: 'Place', abbreviation: 'Pl'},
                {name: 'Plaza', abbreviation: 'Plz'},
                {name: 'Point', abbreviation: 'Pt'},
                {name: 'Ridge', abbreviation: 'Rdg'},
                {name: 'River', abbreviation: 'Riv'},
                {name: 'Road', abbreviation: 'Rd'},
                {name: 'Square', abbreviation: 'Sq'},
                {name: 'Street', abbreviation: 'St'},
                {name: 'Terrace', abbreviation: 'Ter'},
                {name: 'Trail', abbreviation: 'Trl'},
                {name: 'Turnpike', abbreviation: 'Tpke'},
                {name: 'View', abbreviation: 'Vw'},
                {name: 'Way', abbreviation: 'Way'}
            ],
            'it': [
                { name: 'Accesso', abbreviation: 'Acc.' },
                { name: 'Alzaia', abbreviation: 'Alz.' },
                { name: 'Arco', abbreviation: 'Arco' },
                { name: 'Archivolto', abbreviation: 'Acv.' },
                { name: 'Arena', abbreviation: 'Arena' },
                { name: 'Argine', abbreviation: 'Argine' },
                { name: 'Bacino', abbreviation: 'Bacino' },
                { name: 'Banchi', abbreviation: 'Banchi' },
                { name: 'Banchina', abbreviation: 'Ban.' },
                { name: 'Bastioni', abbreviation: 'Bas.' },
                { name: 'Belvedere', abbreviation: 'Belv.' },
                { name: 'Borgata', abbreviation: 'B.ta' },
                { name: 'Borgo', abbreviation: 'B.go' },
                { name: 'Calata', abbreviation: 'Cal.' },
                { name: 'Calle', abbreviation: 'Calle' },
                { name: 'Campiello', abbreviation: 'Cam.' },
                { name: 'Campo', abbreviation: 'Cam.' },
                { name: 'Canale', abbreviation: 'Can.' },
                { name: 'Carraia', abbreviation: 'Carr.' },
                { name: 'Cascina', abbreviation: 'Cascina' },
                { name: 'Case sparse', abbreviation: 'c.s.' },
                { name: 'Cavalcavia', abbreviation: 'Cv.' },
                { name: 'Circonvallazione', abbreviation: 'Cv.' },
                { name: 'Complanare', abbreviation: 'C.re' },
                { name: 'Contrada', abbreviation: 'C.da' },
                { name: 'Corso', abbreviation: 'C.so' },
                { name: 'Corte', abbreviation: 'C.te' },
                { name: 'Cortile', abbreviation: 'C.le' },
                { name: 'Diramazione', abbreviation: 'Dir.' },
                { name: 'Fondaco', abbreviation: 'F.co' },
                { name: 'Fondamenta', abbreviation: 'F.ta' },
                { name: 'Fondo', abbreviation: 'F.do' },
                { name: 'Frazione', abbreviation: 'Fr.' },
                { name: 'Isola', abbreviation: 'Is.' },
                { name: 'Largo', abbreviation: 'L.go' },
                { name: 'Litoranea', abbreviation: 'Lit.' },
                { name: 'Lungolago', abbreviation: 'L.go lago' },
                { name: 'Lungo Po', abbreviation: 'l.go Po' },
                { name: 'Molo', abbreviation: 'Molo' },
                { name: 'Mura', abbreviation: 'Mura' },
                { name: 'Passaggio privato', abbreviation: 'pass. priv.' },
                { name: 'Passeggiata', abbreviation: 'Pass.' },
                { name: 'Piazza', abbreviation: 'P.zza' },
                { name: 'Piazzale', abbreviation: 'P.le' },
                { name: 'Ponte', abbreviation: 'P.te' },
                { name: 'Portico', abbreviation: 'P.co' },
                { name: 'Rampa', abbreviation: 'Rampa' },
                { name: 'Regione', abbreviation: 'Reg.' },
                { name: 'Rione', abbreviation: 'R.ne' },
                { name: 'Rio', abbreviation: 'Rio' },
                { name: 'Ripa', abbreviation: 'Ripa' },
                { name: 'Riva', abbreviation: 'Riva' },
                { name: 'Rondò', abbreviation: 'Rondò' },
                { name: 'Rotonda', abbreviation: 'Rot.' },
                { name: 'Sagrato', abbreviation: 'Sagr.' },
                { name: 'Salita', abbreviation: 'Sal.' },
                { name: 'Scalinata', abbreviation: 'Scal.' },
                { name: 'Scalone', abbreviation: 'Scal.' },
                { name: 'Slargo', abbreviation: 'Sl.' },
                { name: 'Sottoportico', abbreviation: 'Sott.' },
                { name: 'Strada', abbreviation: 'Str.' },
                { name: 'Stradale', abbreviation: 'Str.le' },
                { name: 'Strettoia', abbreviation: 'Strett.' },
                { name: 'Traversa', abbreviation: 'Trav.' },
                { name: 'Via', abbreviation: 'V.' },
                { name: 'Viale', abbreviation: 'V.le' },
                { name: 'Vicinale', abbreviation: 'Vic.le' },
                { name: 'Vicolo', abbreviation: 'Vic.' }
            ],
            'uk' : [
                {name: 'Avenue', abbreviation: 'Ave'},
                {name: 'Close', abbreviation: 'Cl'},
                {name: 'Court', abbreviation: 'Ct'},
                {name: 'Crescent', abbreviation: 'Cr'},
                {name: 'Drive', abbreviation: 'Dr'},
                {name: 'Garden', abbreviation: 'Gdn'},
                {name: 'Gardens', abbreviation: 'Gdns'},
                {name: 'Green', abbreviation: 'Gn'},
                {name: 'Grove', abbreviation: 'Gr'},
                {name: 'Lane', abbreviation: 'Ln'},
                {name: 'Mount', abbreviation: 'Mt'},
                {name: 'Place', abbreviation: 'Pl'},
                {name: 'Park', abbreviation: 'Pk'},
                {name: 'Ridge', abbreviation: 'Rdg'},
                {name: 'Road', abbreviation: 'Rd'},
                {name: 'Square', abbreviation: 'Sq'},
                {name: 'Street', abbreviation: 'St'},
                {name: 'Terrace', abbreviation: 'Ter'},
                {name: 'Valley', abbreviation: 'Val'}
            ]
        },

        months: [
            {name: 'January', short_name: 'Jan', numeric: '01', days: 31},
            // Not messing with leap years...
            {name: 'February', short_name: 'Feb', numeric: '02', days: 28},
            {name: 'March', short_name: 'Mar', numeric: '03', days: 31},
            {name: 'April', short_name: 'Apr', numeric: '04', days: 30},
            {name: 'May', short_name: 'May', numeric: '05', days: 31},
            {name: 'June', short_name: 'Jun', numeric: '06', days: 30},
            {name: 'July', short_name: 'Jul', numeric: '07', days: 31},
            {name: 'August', short_name: 'Aug', numeric: '08', days: 31},
            {name: 'September', short_name: 'Sep', numeric: '09', days: 30},
            {name: 'October', short_name: 'Oct', numeric: '10', days: 31},
            {name: 'November', short_name: 'Nov', numeric: '11', days: 30},
            {name: 'December', short_name: 'Dec', numeric: '12', days: 31}
        ],

        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        cc_types: [
            {name: "American Express", short_name: 'amex', prefix: '34', length: 15},
            {name: "Bankcard", short_name: 'bankcard', prefix: '5610', length: 16},
            {name: "China UnionPay", short_name: 'chinaunion', prefix: '62', length: 16},
            {name: "Diners Club Carte Blanche", short_name: 'dccarte', prefix: '300', length: 14},
            {name: "Diners Club enRoute", short_name: 'dcenroute', prefix: '2014', length: 15},
            {name: "Diners Club International", short_name: 'dcintl', prefix: '36', length: 14},
            {name: "Diners Club United States & Canada", short_name: 'dcusc', prefix: '54', length: 16},
            {name: "Discover Card", short_name: 'discover', prefix: '6011', length: 16},
            {name: "InstaPayment", short_name: 'instapay', prefix: '637', length: 16},
            {name: "JCB", short_name: 'jcb', prefix: '3528', length: 16},
            {name: "Laser", short_name: 'laser', prefix: '6304', length: 16},
            {name: "Maestro", short_name: 'maestro', prefix: '5018', length: 16},
            {name: "Mastercard", short_name: 'mc', prefix: '51', length: 16},
            {name: "Solo", short_name: 'solo', prefix: '6334', length: 16},
            {name: "Switch", short_name: 'switch', prefix: '4903', length: 16},
            {name: "Visa", short_name: 'visa', prefix: '4', length: 16},
            {name: "Visa Electron", short_name: 'electron', prefix: '4026', length: 16}
        ],

        //return all world currency by ISO 4217
        currency_types: [
            {'code' : 'AED', 'name' : 'United Arab Emirates Dirham'},
            {'code' : 'AFN', 'name' : 'Afghanistan Afghani'},
            {'code' : 'ALL', 'name' : 'Albania Lek'},
            {'code' : 'AMD', 'name' : 'Armenia Dram'},
            {'code' : 'ANG', 'name' : 'Netherlands Antilles Guilder'},
            {'code' : 'AOA', 'name' : 'Angola Kwanza'},
            {'code' : 'ARS', 'name' : 'Argentina Peso'},
            {'code' : 'AUD', 'name' : 'Australia Dollar'},
            {'code' : 'AWG', 'name' : 'Aruba Guilder'},
            {'code' : 'AZN', 'name' : 'Azerbaijan New Manat'},
            {'code' : 'BAM', 'name' : 'Bosnia and Herzegovina Convertible Marka'},
            {'code' : 'BBD', 'name' : 'Barbados Dollar'},
            {'code' : 'BDT', 'name' : 'Bangladesh Taka'},
            {'code' : 'BGN', 'name' : 'Bulgaria Lev'},
            {'code' : 'BHD', 'name' : 'Bahrain Dinar'},
            {'code' : 'BIF', 'name' : 'Burundi Franc'},
            {'code' : 'BMD', 'name' : 'Bermuda Dollar'},
            {'code' : 'BND', 'name' : 'Brunei Darussalam Dollar'},
            {'code' : 'BOB', 'name' : 'Bolivia Boliviano'},
            {'code' : 'BRL', 'name' : 'Brazil Real'},
            {'code' : 'BSD', 'name' : 'Bahamas Dollar'},
            {'code' : 'BTN', 'name' : 'Bhutan Ngultrum'},
            {'code' : 'BWP', 'name' : 'Botswana Pula'},
            {'code' : 'BYR', 'name' : 'Belarus Ruble'},
            {'code' : 'BZD', 'name' : 'Belize Dollar'},
            {'code' : 'CAD', 'name' : 'Canada Dollar'},
            {'code' : 'CDF', 'name' : 'Congo/Kinshasa Franc'},
            {'code' : 'CHF', 'name' : 'Switzerland Franc'},
            {'code' : 'CLP', 'name' : 'Chile Peso'},
            {'code' : 'CNY', 'name' : 'China Yuan Renminbi'},
            {'code' : 'COP', 'name' : 'Colombia Peso'},
            {'code' : 'CRC', 'name' : 'Costa Rica Colon'},
            {'code' : 'CUC', 'name' : 'Cuba Convertible Peso'},
            {'code' : 'CUP', 'name' : 'Cuba Peso'},
            {'code' : 'CVE', 'name' : 'Cape Verde Escudo'},
            {'code' : 'CZK', 'name' : 'Czech Republic Koruna'},
            {'code' : 'DJF', 'name' : 'Djibouti Franc'},
            {'code' : 'DKK', 'name' : 'Denmark Krone'},
            {'code' : 'DOP', 'name' : 'Dominican Republic Peso'},
            {'code' : 'DZD', 'name' : 'Algeria Dinar'},
            {'code' : 'EGP', 'name' : 'Egypt Pound'},
            {'code' : 'ERN', 'name' : 'Eritrea Nakfa'},
            {'code' : 'ETB', 'name' : 'Ethiopia Birr'},
            {'code' : 'EUR', 'name' : 'Euro Member Countries'},
            {'code' : 'FJD', 'name' : 'Fiji Dollar'},
            {'code' : 'FKP', 'name' : 'Falkland Islands (Malvinas) Pound'},
            {'code' : 'GBP', 'name' : 'United Kingdom Pound'},
            {'code' : 'GEL', 'name' : 'Georgia Lari'},
            {'code' : 'GGP', 'name' : 'Guernsey Pound'},
            {'code' : 'GHS', 'name' : 'Ghana Cedi'},
            {'code' : 'GIP', 'name' : 'Gibraltar Pound'},
            {'code' : 'GMD', 'name' : 'Gambia Dalasi'},
            {'code' : 'GNF', 'name' : 'Guinea Franc'},
            {'code' : 'GTQ', 'name' : 'Guatemala Quetzal'},
            {'code' : 'GYD', 'name' : 'Guyana Dollar'},
            {'code' : 'HKD', 'name' : 'Hong Kong Dollar'},
            {'code' : 'HNL', 'name' : 'Honduras Lempira'},
            {'code' : 'HRK', 'name' : 'Croatia Kuna'},
            {'code' : 'HTG', 'name' : 'Haiti Gourde'},
            {'code' : 'HUF', 'name' : 'Hungary Forint'},
            {'code' : 'IDR', 'name' : 'Indonesia Rupiah'},
            {'code' : 'ILS', 'name' : 'Israel Shekel'},
            {'code' : 'IMP', 'name' : 'Isle of Man Pound'},
            {'code' : 'INR', 'name' : 'India Rupee'},
            {'code' : 'IQD', 'name' : 'Iraq Dinar'},
            {'code' : 'IRR', 'name' : 'Iran Rial'},
            {'code' : 'ISK', 'name' : 'Iceland Krona'},
            {'code' : 'JEP', 'name' : 'Jersey Pound'},
            {'code' : 'JMD', 'name' : 'Jamaica Dollar'},
            {'code' : 'JOD', 'name' : 'Jordan Dinar'},
            {'code' : 'JPY', 'name' : 'Japan Yen'},
            {'code' : 'KES', 'name' : 'Kenya Shilling'},
            {'code' : 'KGS', 'name' : 'Kyrgyzstan Som'},
            {'code' : 'KHR', 'name' : 'Cambodia Riel'},
            {'code' : 'KMF', 'name' : 'Comoros Franc'},
            {'code' : 'KPW', 'name' : 'Korea (North) Won'},
            {'code' : 'KRW', 'name' : 'Korea (South) Won'},
            {'code' : 'KWD', 'name' : 'Kuwait Dinar'},
            {'code' : 'KYD', 'name' : 'Cayman Islands Dollar'},
            {'code' : 'KZT', 'name' : 'Kazakhstan Tenge'},
            {'code' : 'LAK', 'name' : 'Laos Kip'},
            {'code' : 'LBP', 'name' : 'Lebanon Pound'},
            {'code' : 'LKR', 'name' : 'Sri Lanka Rupee'},
            {'code' : 'LRD', 'name' : 'Liberia Dollar'},
            {'code' : 'LSL', 'name' : 'Lesotho Loti'},
            {'code' : 'LTL', 'name' : 'Lithuania Litas'},
            {'code' : 'LYD', 'name' : 'Libya Dinar'},
            {'code' : 'MAD', 'name' : 'Morocco Dirham'},
            {'code' : 'MDL', 'name' : 'Moldova Leu'},
            {'code' : 'MGA', 'name' : 'Madagascar Ariary'},
            {'code' : 'MKD', 'name' : 'Macedonia Denar'},
            {'code' : 'MMK', 'name' : 'Myanmar (Burma) Kyat'},
            {'code' : 'MNT', 'name' : 'Mongolia Tughrik'},
            {'code' : 'MOP', 'name' : 'Macau Pataca'},
            {'code' : 'MRO', 'name' : 'Mauritania Ouguiya'},
            {'code' : 'MUR', 'name' : 'Mauritius Rupee'},
            {'code' : 'MVR', 'name' : 'Maldives (Maldive Islands) Rufiyaa'},
            {'code' : 'MWK', 'name' : 'Malawi Kwacha'},
            {'code' : 'MXN', 'name' : 'Mexico Peso'},
            {'code' : 'MYR', 'name' : 'Malaysia Ringgit'},
            {'code' : 'MZN', 'name' : 'Mozambique Metical'},
            {'code' : 'NAD', 'name' : 'Namibia Dollar'},
            {'code' : 'NGN', 'name' : 'Nigeria Naira'},
            {'code' : 'NIO', 'name' : 'Nicaragua Cordoba'},
            {'code' : 'NOK', 'name' : 'Norway Krone'},
            {'code' : 'NPR', 'name' : 'Nepal Rupee'},
            {'code' : 'NZD', 'name' : 'New Zealand Dollar'},
            {'code' : 'OMR', 'name' : 'Oman Rial'},
            {'code' : 'PAB', 'name' : 'Panama Balboa'},
            {'code' : 'PEN', 'name' : 'Peru Nuevo Sol'},
            {'code' : 'PGK', 'name' : 'Papua New Guinea Kina'},
            {'code' : 'PHP', 'name' : 'Philippines Peso'},
            {'code' : 'PKR', 'name' : 'Pakistan Rupee'},
            {'code' : 'PLN', 'name' : 'Poland Zloty'},
            {'code' : 'PYG', 'name' : 'Paraguay Guarani'},
            {'code' : 'QAR', 'name' : 'Qatar Riyal'},
            {'code' : 'RON', 'name' : 'Romania New Leu'},
            {'code' : 'RSD', 'name' : 'Serbia Dinar'},
            {'code' : 'RUB', 'name' : 'Russia Ruble'},
            {'code' : 'RWF', 'name' : 'Rwanda Franc'},
            {'code' : 'SAR', 'name' : 'Saudi Arabia Riyal'},
            {'code' : 'SBD', 'name' : 'Solomon Islands Dollar'},
            {'code' : 'SCR', 'name' : 'Seychelles Rupee'},
            {'code' : 'SDG', 'name' : 'Sudan Pound'},
            {'code' : 'SEK', 'name' : 'Sweden Krona'},
            {'code' : 'SGD', 'name' : 'Singapore Dollar'},
            {'code' : 'SHP', 'name' : 'Saint Helena Pound'},
            {'code' : 'SLL', 'name' : 'Sierra Leone Leone'},
            {'code' : 'SOS', 'name' : 'Somalia Shilling'},
            {'code' : 'SPL', 'name' : 'Seborga Luigino'},
            {'code' : 'SRD', 'name' : 'Suriname Dollar'},
            {'code' : 'STD', 'name' : 'São Tomé and Príncipe Dobra'},
            {'code' : 'SVC', 'name' : 'El Salvador Colon'},
            {'code' : 'SYP', 'name' : 'Syria Pound'},
            {'code' : 'SZL', 'name' : 'Swaziland Lilangeni'},
            {'code' : 'THB', 'name' : 'Thailand Baht'},
            {'code' : 'TJS', 'name' : 'Tajikistan Somoni'},
            {'code' : 'TMT', 'name' : 'Turkmenistan Manat'},
            {'code' : 'TND', 'name' : 'Tunisia Dinar'},
            {'code' : 'TOP', 'name' : 'Tonga Pa\'anga'},
            {'code' : 'TRY', 'name' : 'Turkey Lira'},
            {'code' : 'TTD', 'name' : 'Trinidad and Tobago Dollar'},
            {'code' : 'TVD', 'name' : 'Tuvalu Dollar'},
            {'code' : 'TWD', 'name' : 'Taiwan New Dollar'},
            {'code' : 'TZS', 'name' : 'Tanzania Shilling'},
            {'code' : 'UAH', 'name' : 'Ukraine Hryvnia'},
            {'code' : 'UGX', 'name' : 'Uganda Shilling'},
            {'code' : 'USD', 'name' : 'United States Dollar'},
            {'code' : 'UYU', 'name' : 'Uruguay Peso'},
            {'code' : 'UZS', 'name' : 'Uzbekistan Som'},
            {'code' : 'VEF', 'name' : 'Venezuela Bolivar'},
            {'code' : 'VND', 'name' : 'Viet Nam Dong'},
            {'code' : 'VUV', 'name' : 'Vanuatu Vatu'},
            {'code' : 'WST', 'name' : 'Samoa Tala'},
            {'code' : 'XAF', 'name' : 'Communauté Financière Africaine (BEAC) CFA Franc BEAC'},
            {'code' : 'XCD', 'name' : 'East Caribbean Dollar'},
            {'code' : 'XDR', 'name' : 'International Monetary Fund (IMF) Special Drawing Rights'},
            {'code' : 'XOF', 'name' : 'Communauté Financière Africaine (BCEAO) Franc'},
            {'code' : 'XPF', 'name' : 'Comptoirs Français du Pacifique (CFP) Franc'},
            {'code' : 'YER', 'name' : 'Yemen Rial'},
            {'code' : 'ZAR', 'name' : 'South Africa Rand'},
            {'code' : 'ZMW', 'name' : 'Zambia Kwacha'},
            {'code' : 'ZWD', 'name' : 'Zimbabwe Dollar'}
        ],

        // return the names of all valide colors
        colorNames : [  "AliceBlue", "Black", "Navy", "DarkBlue", "MediumBlue", "Blue", "DarkGreen", "Green", "Teal", "DarkCyan", "DeepSkyBlue", "DarkTurquoise", "MediumSpringGreen", "Lime", "SpringGreen",
            "Aqua", "Cyan", "MidnightBlue", "DodgerBlue", "LightSeaGreen", "ForestGreen", "SeaGreen", "DarkSlateGray", "LimeGreen", "MediumSeaGreen", "Turquoise", "RoyalBlue", "SteelBlue", "DarkSlateBlue", "MediumTurquoise",
            "Indigo", "DarkOliveGreen", "CadetBlue", "CornflowerBlue", "RebeccaPurple", "MediumAquaMarine", "DimGray", "SlateBlue", "OliveDrab", "SlateGray", "LightSlateGray", "MediumSlateBlue", "LawnGreen", "Chartreuse",
            "Aquamarine", "Maroon", "Purple", "Olive", "Gray", "SkyBlue", "LightSkyBlue", "BlueViolet", "DarkRed", "DarkMagenta", "SaddleBrown", "Ivory", "White",
            "DarkSeaGreen", "LightGreen", "MediumPurple", "DarkViolet", "PaleGreen", "DarkOrchid", "YellowGreen", "Sienna", "Brown", "DarkGray", "LightBlue", "GreenYellow", "PaleTurquoise", "LightSteelBlue", "PowderBlue",
            "FireBrick", "DarkGoldenRod", "MediumOrchid", "RosyBrown", "DarkKhaki", "Silver", "MediumVioletRed", "IndianRed", "Peru", "Chocolate", "Tan", "LightGray", "Thistle", "Orchid", "GoldenRod", "PaleVioletRed",
            "Crimson", "Gainsboro", "Plum", "BurlyWood", "LightCyan", "Lavender", "DarkSalmon", "Violet", "PaleGoldenRod", "LightCoral", "Khaki", "AliceBlue", "HoneyDew", "Azure", "SandyBrown", "Wheat", "Beige", "WhiteSmoke",
            "MintCream", "GhostWhite", "Salmon", "AntiqueWhite", "Linen", "LightGoldenRodYellow", "OldLace", "Red", "Fuchsia", "Magenta", "DeepPink", "OrangeRed", "Tomato", "HotPink", "Coral", "DarkOrange", "LightSalmon", "Orange",
            "LightPink", "Pink", "Gold", "PeachPuff", "NavajoWhite", "Moccasin", "Bisque", "MistyRose", "BlanchedAlmond", "PapayaWhip", "LavenderBlush", "SeaShell", "Cornsilk", "LemonChiffon", "FloralWhite", "Snow", "Yellow", "LightYellow"
        ],

        fileExtension : {
            "raster"    : ["bmp", "gif", "gpl", "ico", "jpeg", "psd", "png", "psp", "raw", "tiff"],
            "vector"    : ["3dv", "amf", "awg", "ai", "cgm", "cdr", "cmx", "dxf", "e2d", "egt", "eps", "fs", "odg", "svg", "xar"],
            "3d"        : ["3dmf", "3dm", "3mf", "3ds", "an8", "aoi", "blend", "cal3d", "cob", "ctm", "iob", "jas", "max", "mb", "mdx", "obj", "x", "x3d"],
            "document"  : ["doc", "docx", "dot", "html", "xml", "odt", "odm", "ott", "csv", "rtf", "tex", "xhtml", "xps"]
        },

        // Data taken from https://github.com/dmfilipenko/timezones.json/blob/master/timezones.json
        timezones: [
                  {
                    "name": "Dateline Standard Time",
                    "abbr": "DST",
                    "offset": -12,
                    "isdst": false,
                    "text": "(UTC-12:00) International Date Line West",
                    "utc": [
                      "Etc/GMT+12"
                    ]
                  },
                  {
                    "name": "UTC-11",
                    "abbr": "U",
                    "offset": -11,
                    "isdst": false,
                    "text": "(UTC-11:00) Coordinated Universal Time-11",
                    "utc": [
                      "Etc/GMT+11",
                      "Pacific/Midway",
                      "Pacific/Niue",
                      "Pacific/Pago_Pago"
                    ]
                  },
                  {
                    "name": "Hawaiian Standard Time",
                    "abbr": "HST",
                    "offset": -10,
                    "isdst": false,
                    "text": "(UTC-10:00) Hawaii",
                    "utc": [
                      "Etc/GMT+10",
                      "Pacific/Honolulu",
                      "Pacific/Johnston",
                      "Pacific/Rarotonga",
                      "Pacific/Tahiti"
                    ]
                  },
                  {
                    "name": "Alaskan Standard Time",
                    "abbr": "AKDT",
                    "offset": -8,
                    "isdst": true,
                    "text": "(UTC-09:00) Alaska",
                    "utc": [
                      "America/Anchorage",
                      "America/Juneau",
                      "America/Nome",
                      "America/Sitka",
                      "America/Yakutat"
                    ]
                  },
                  {
                    "name": "Pacific Standard Time (Mexico)",
                    "abbr": "PDT",
                    "offset": -7,
                    "isdst": true,
                    "text": "(UTC-08:00) Baja California",
                    "utc": [
                      "America/Santa_Isabel"
                    ]
                  },
                  {
                    "name": "Pacific Standard Time",
                    "abbr": "PDT",
                    "offset": -7,
                    "isdst": true,
                    "text": "(UTC-08:00) Pacific Time (US & Canada)",
                    "utc": [
                      "America/Dawson",
                      "America/Los_Angeles",
                      "America/Tijuana",
                      "America/Vancouver",
                      "America/Whitehorse",
                      "PST8PDT"
                    ]
                  },
                  {
                    "name": "US Mountain Standard Time",
                    "abbr": "UMST",
                    "offset": -7,
                    "isdst": false,
                    "text": "(UTC-07:00) Arizona",
                    "utc": [
                      "America/Creston",
                      "America/Dawson_Creek",
                      "America/Hermosillo",
                      "America/Phoenix",
                      "Etc/GMT+7"
                    ]
                  },
                  {
                    "name": "Mountain Standard Time (Mexico)",
                    "abbr": "MDT",
                    "offset": -6,
                    "isdst": true,
                    "text": "(UTC-07:00) Chihuahua, La Paz, Mazatlan",
                    "utc": [
                      "America/Chihuahua",
                      "America/Mazatlan"
                    ]
                  },
                  {
                    "name": "Mountain Standard Time",
                    "abbr": "MDT",
                    "offset": -6,
                    "isdst": true,
                    "text": "(UTC-07:00) Mountain Time (US & Canada)",
                    "utc": [
                      "America/Boise",
                      "America/Cambridge_Bay",
                      "America/Denver",
                      "America/Edmonton",
                      "America/Inuvik",
                      "America/Ojinaga",
                      "America/Yellowknife",
                      "MST7MDT"
                    ]
                  },
                  {
                    "name": "Central America Standard Time",
                    "abbr": "CAST",
                    "offset": -6,
                    "isdst": false,
                    "text": "(UTC-06:00) Central America",
                    "utc": [
                      "America/Belize",
                      "America/Costa_Rica",
                      "America/El_Salvador",
                      "America/Guatemala",
                      "America/Managua",
                      "America/Tegucigalpa",
                      "Etc/GMT+6",
                      "Pacific/Galapagos"
                    ]
                  },
                  {
                    "name": "Central Standard Time",
                    "abbr": "CDT",
                    "offset": -5,
                    "isdst": true,
                    "text": "(UTC-06:00) Central Time (US & Canada)",
                    "utc": [
                      "America/Chicago",
                      "America/Indiana/Knox",
                      "America/Indiana/Tell_City",
                      "America/Matamoros",
                      "America/Menominee",
                      "America/North_Dakota/Beulah",
                      "America/North_Dakota/Center",
                      "America/North_Dakota/New_Salem",
                      "America/Rainy_River",
                      "America/Rankin_Inlet",
                      "America/Resolute",
                      "America/Winnipeg",
                      "CST6CDT"
                    ]
                  },
                  {
                    "name": "Central Standard Time (Mexico)",
                    "abbr": "CDT",
                    "offset": -5,
                    "isdst": true,
                    "text": "(UTC-06:00) Guadalajara, Mexico City, Monterrey",
                    "utc": [
                      "America/Bahia_Banderas",
                      "America/Cancun",
                      "America/Merida",
                      "America/Mexico_City",
                      "America/Monterrey"
                    ]
                  },
                  {
                    "name": "Canada Central Standard Time",
                    "abbr": "CCST",
                    "offset": -6,
                    "isdst": false,
                    "text": "(UTC-06:00) Saskatchewan",
                    "utc": [
                      "America/Regina",
                      "America/Swift_Current"
                    ]
                  },
                  {
                    "name": "SA Pacific Standard Time",
                    "abbr": "SPST",
                    "offset": -5,
                    "isdst": false,
                    "text": "(UTC-05:00) Bogota, Lima, Quito",
                    "utc": [
                      "America/Bogota",
                      "America/Cayman",
                      "America/Coral_Harbour",
                      "America/Eirunepe",
                      "America/Guayaquil",
                      "America/Jamaica",
                      "America/Lima",
                      "America/Panama",
                      "America/Rio_Branco",
                      "Etc/GMT+5"
                    ]
                  },
                  {
                    "name": "Eastern Standard Time",
                    "abbr": "EDT",
                    "offset": -4,
                    "isdst": true,
                    "text": "(UTC-05:00) Eastern Time (US & Canada)",
                    "utc": [
                      "America/Detroit",
                      "America/Havana",
                      "America/Indiana/Petersburg",
                      "America/Indiana/Vincennes",
                      "America/Indiana/Winamac",
                      "America/Iqaluit",
                      "America/Kentucky/Monticello",
                      "America/Louisville",
                      "America/Montreal",
                      "America/Nassau",
                      "America/New_York",
                      "America/Nipigon",
                      "America/Pangnirtung",
                      "America/Port-au-Prince",
                      "America/Thunder_Bay",
                      "America/Toronto",
                      "EST5EDT"
                    ]
                  },
                  {
                    "name": "US Eastern Standard Time",
                    "abbr": "UEDT",
                    "offset": -4,
                    "isdst": true,
                    "text": "(UTC-05:00) Indiana (East)",
                    "utc": [
                      "America/Indiana/Marengo",
                      "America/Indiana/Vevay",
                      "America/Indianapolis"
                    ]
                  },
                  {
                    "name": "Venezuela Standard Time",
                    "abbr": "VST",
                    "offset": -4.5,
                    "isdst": false,
                    "text": "(UTC-04:30) Caracas",
                    "utc": [
                      "America/Caracas"
                    ]
                  },
                  {
                    "name": "Paraguay Standard Time",
                    "abbr": "PST",
                    "offset": -4,
                    "isdst": false,
                    "text": "(UTC-04:00) Asuncion",
                    "utc": [
                      "America/Asuncion"
                    ]
                  },
                  {
                    "name": "Atlantic Standard Time",
                    "abbr": "ADT",
                    "offset": -3,
                    "isdst": true,
                    "text": "(UTC-04:00) Atlantic Time (Canada)",
                    "utc": [
                      "America/Glace_Bay",
                      "America/Goose_Bay",
                      "America/Halifax",
                      "America/Moncton",
                      "America/Thule",
                      "Atlantic/Bermuda"
                    ]
                  },
                  {
                    "name": "Central Brazilian Standard Time",
                    "abbr": "CBST",
                    "offset": -4,
                    "isdst": false,
                    "text": "(UTC-04:00) Cuiaba",
                    "utc": [
                      "America/Campo_Grande",
                      "America/Cuiaba"
                    ]
                  },
                  {
                    "name": "SA Western Standard Time",
                    "abbr": "SWST",
                    "offset": -4,
                    "isdst": false,
                    "text": "(UTC-04:00) Georgetown, La Paz, Manaus, San Juan",
                    "utc": [
                      "America/Anguilla",
                      "America/Antigua",
                      "America/Aruba",
                      "America/Barbados",
                      "America/Blanc-Sablon",
                      "America/Boa_Vista",
                      "America/Curacao",
                      "America/Dominica",
                      "America/Grand_Turk",
                      "America/Grenada",
                      "America/Guadeloupe",
                      "America/Guyana",
                      "America/Kralendijk",
                      "America/La_Paz",
                      "America/Lower_Princes",
                      "America/Manaus",
                      "America/Marigot",
                      "America/Martinique",
                      "America/Montserrat",
                      "America/Port_of_Spain",
                      "America/Porto_Velho",
                      "America/Puerto_Rico",
                      "America/Santo_Domingo",
                      "America/St_Barthelemy",
                      "America/St_Kitts",
                      "America/St_Lucia",
                      "America/St_Thomas",
                      "America/St_Vincent",
                      "America/Tortola",
                      "Etc/GMT+4"
                    ]
                  },
                  {
                    "name": "Pacific SA Standard Time",
                    "abbr": "PSST",
                    "offset": -4,
                    "isdst": false,
                    "text": "(UTC-04:00) Santiago",
                    "utc": [
                      "America/Santiago",
                      "Antarctica/Palmer"
                    ]
                  },
                  {
                    "name": "Newfoundland Standard Time",
                    "abbr": "NDT",
                    "offset": -2.5,
                    "isdst": true,
                    "text": "(UTC-03:30) Newfoundland",
                    "utc": [
                      "America/St_Johns"
                    ]
                  },
                  {
                    "name": "E. South America Standard Time",
                    "abbr": "ESAST",
                    "offset": -3,
                    "isdst": false,
                    "text": "(UTC-03:00) Brasilia",
                    "utc": [
                      "America/Sao_Paulo"
                    ]
                  },
                  {
                    "name": "Argentina Standard Time",
                    "abbr": "AST",
                    "offset": -3,
                    "isdst": false,
                    "text": "(UTC-03:00) Buenos Aires",
                    "utc": [
                      "America/Argentina/La_Rioja",
                      "America/Argentina/Rio_Gallegos",
                      "America/Argentina/Salta",
                      "America/Argentina/San_Juan",
                      "America/Argentina/San_Luis",
                      "America/Argentina/Tucuman",
                      "America/Argentina/Ushuaia",
                      "America/Buenos_Aires",
                      "America/Catamarca",
                      "America/Cordoba",
                      "America/Jujuy",
                      "America/Mendoza"
                    ]
                  },
                  {
                    "name": "SA Eastern Standard Time",
                    "abbr": "SEST",
                    "offset": -3,
                    "isdst": false,
                    "text": "(UTC-03:00) Cayenne, Fortaleza",
                    "utc": [
                      "America/Araguaina",
                      "America/Belem",
                      "America/Cayenne",
                      "America/Fortaleza",
                      "America/Maceio",
                      "America/Paramaribo",
                      "America/Recife",
                      "America/Santarem",
                      "Antarctica/Rothera",
                      "Atlantic/Stanley",
                      "Etc/GMT+3"
                    ]
                  },
                  {
                    "name": "Greenland Standard Time",
                    "abbr": "GDT",
                    "offset": -2,
                    "isdst": true,
                    "text": "(UTC-03:00) Greenland",
                    "utc": [
                      "America/Godthab"
                    ]
                  },
                  {
                    "name": "Montevideo Standard Time",
                    "abbr": "MST",
                    "offset": -3,
                    "isdst": false,
                    "text": "(UTC-03:00) Montevideo",
                    "utc": [
                      "America/Montevideo"
                    ]
                  },
                  {
                    "name": "Bahia Standard Time",
                    "abbr": "BST",
                    "offset": -3,
                    "isdst": false,
                    "text": "(UTC-03:00) Salvador",
                    "utc": [
                      "America/Bahia"
                    ]
                  },
                  {
                    "name": "UTC-02",
                    "abbr": "U",
                    "offset": -2,
                    "isdst": false,
                    "text": "(UTC-02:00) Coordinated Universal Time-02",
                    "utc": [
                      "America/Noronha",
                      "Atlantic/South_Georgia",
                      "Etc/GMT+2"
                    ]
                  },
                  {
                    "name": "Mid-Atlantic Standard Time",
                    "abbr": "MDT",
                    "offset": -1,
                    "isdst": true,
                    "text": "(UTC-02:00) Mid-Atlantic - Old"
                  },
                  {
                    "name": "Azores Standard Time",
                    "abbr": "ADT",
                    "offset": 0,
                    "isdst": true,
                    "text": "(UTC-01:00) Azores",
                    "utc": [
                      "America/Scoresbysund",
                      "Atlantic/Azores"
                    ]
                  },
                  {
                    "name": "Cape Verde Standard Time",
                    "abbr": "CVST",
                    "offset": -1,
                    "isdst": false,
                    "text": "(UTC-01:00) Cape Verde Is.",
                    "utc": [
                      "Atlantic/Cape_Verde",
                      "Etc/GMT+1"
                    ]
                  },
                  {
                    "name": "Morocco Standard Time",
                    "abbr": "MDT",
                    "offset": 1,
                    "isdst": true,
                    "text": "(UTC) Casablanca",
                    "utc": [
                      "Africa/Casablanca",
                      "Africa/El_Aaiun"
                    ]
                  },
                  {
                    "name": "UTC",
                    "abbr": "CUT",
                    "offset": 0,
                    "isdst": false,
                    "text": "(UTC) Coordinated Universal Time",
                    "utc": [
                      "America/Danmarkshavn",
                      "Etc/GMT"
                    ]
                  },
                  {
                    "name": "GMT Standard Time",
                    "abbr": "GDT",
                    "offset": 1,
                    "isdst": true,
                    "text": "(UTC) Dublin, Edinburgh, Lisbon, London",
                    "utc": [
                      "Atlantic/Canary",
                      "Atlantic/Faeroe",
                      "Atlantic/Madeira",
                      "Europe/Dublin",
                      "Europe/Guernsey",
                      "Europe/Isle_of_Man",
                      "Europe/Jersey",
                      "Europe/Lisbon",
                      "Europe/London"
                    ]
                  },
                  {
                    "name": "Greenwich Standard Time",
                    "abbr": "GST",
                    "offset": 0,
                    "isdst": false,
                    "text": "(UTC) Monrovia, Reykjavik",
                    "utc": [
                      "Africa/Abidjan",
                      "Africa/Accra",
                      "Africa/Bamako",
                      "Africa/Banjul",
                      "Africa/Bissau",
                      "Africa/Conakry",
                      "Africa/Dakar",
                      "Africa/Freetown",
                      "Africa/Lome",
                      "Africa/Monrovia",
                      "Africa/Nouakchott",
                      "Africa/Ouagadougou",
                      "Africa/Sao_Tome",
                      "Atlantic/Reykjavik",
                      "Atlantic/St_Helena"
                    ]
                  },
                  {
                    "name": "W. Europe Standard Time",
                    "abbr": "WEDT",
                    "offset": 2,
                    "isdst": true,
                    "text": "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna",
                    "utc": [
                      "Arctic/Longyearbyen",
                      "Europe/Amsterdam",
                      "Europe/Andorra",
                      "Europe/Berlin",
                      "Europe/Busingen",
                      "Europe/Gibraltar",
                      "Europe/Luxembourg",
                      "Europe/Malta",
                      "Europe/Monaco",
                      "Europe/Oslo",
                      "Europe/Rome",
                      "Europe/San_Marino",
                      "Europe/Stockholm",
                      "Europe/Vaduz",
                      "Europe/Vatican",
                      "Europe/Vienna",
                      "Europe/Zurich"
                    ]
                  },
                  {
                    "name": "Central Europe Standard Time",
                    "abbr": "CEDT",
                    "offset": 2,
                    "isdst": true,
                    "text": "(UTC+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague",
                    "utc": [
                      "Europe/Belgrade",
                      "Europe/Bratislava",
                      "Europe/Budapest",
                      "Europe/Ljubljana",
                      "Europe/Podgorica",
                      "Europe/Prague",
                      "Europe/Tirane"
                    ]
                  },
                  {
                    "name": "Romance Standard Time",
                    "abbr": "RDT",
                    "offset": 2,
                    "isdst": true,
                    "text": "(UTC+01:00) Brussels, Copenhagen, Madrid, Paris",
                    "utc": [
                      "Africa/Ceuta",
                      "Europe/Brussels",
                      "Europe/Copenhagen",
                      "Europe/Madrid",
                      "Europe/Paris"
                    ]
                  },
                  {
                    "name": "Central European Standard Time",
                    "abbr": "CEDT",
                    "offset": 2,
                    "isdst": true,
                    "text": "(UTC+01:00) Sarajevo, Skopje, Warsaw, Zagreb",
                    "utc": [
                      "Europe/Sarajevo",
                      "Europe/Skopje",
                      "Europe/Warsaw",
                      "Europe/Zagreb"
                    ]
                  },
                  {
                    "name": "W. Central Africa Standard Time",
                    "abbr": "WCAST",
                    "offset": 1,
                    "isdst": false,
                    "text": "(UTC+01:00) West Central Africa",
                    "utc": [
                      "Africa/Algiers",
                      "Africa/Bangui",
                      "Africa/Brazzaville",
                      "Africa/Douala",
                      "Africa/Kinshasa",
                      "Africa/Lagos",
                      "Africa/Libreville",
                      "Africa/Luanda",
                      "Africa/Malabo",
                      "Africa/Ndjamena",
                      "Africa/Niamey",
                      "Africa/Porto-Novo",
                      "Africa/Tunis",
                      "Etc/GMT-1"
                    ]
                  },
                  {
                    "name": "Namibia Standard Time",
                    "abbr": "NST",
                    "offset": 1,
                    "isdst": false,
                    "text": "(UTC+01:00) Windhoek",
                    "utc": [
                      "Africa/Windhoek"
                    ]
                  },
                  {
                    "name": "GTB Standard Time",
                    "abbr": "GDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Athens, Bucharest",
                    "utc": [
                      "Asia/Nicosia",
                      "Europe/Athens",
                      "Europe/Bucharest",
                      "Europe/Chisinau"
                    ]
                  },
                  {
                    "name": "Middle East Standard Time",
                    "abbr": "MEDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Beirut",
                    "utc": [
                      "Asia/Beirut"
                    ]
                  },
                  {
                    "name": "Egypt Standard Time",
                    "abbr": "EST",
                    "offset": 2,
                    "isdst": false,
                    "text": "(UTC+02:00) Cairo",
                    "utc": [
                      "Africa/Cairo"
                    ]
                  },
                  {
                    "name": "Syria Standard Time",
                    "abbr": "SDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Damascus",
                    "utc": [
                      "Asia/Damascus"
                    ]
                  },
                  {
                    "name": "E. Europe Standard Time",
                    "abbr": "EEDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) E. Europe"
                  },
                  {
                    "name": "South Africa Standard Time",
                    "abbr": "SAST",
                    "offset": 2,
                    "isdst": false,
                    "text": "(UTC+02:00) Harare, Pretoria",
                    "utc": [
                      "Africa/Blantyre",
                      "Africa/Bujumbura",
                      "Africa/Gaborone",
                      "Africa/Harare",
                      "Africa/Johannesburg",
                      "Africa/Kigali",
                      "Africa/Lubumbashi",
                      "Africa/Lusaka",
                      "Africa/Maputo",
                      "Africa/Maseru",
                      "Africa/Mbabane",
                      "Etc/GMT-2"
                    ]
                  },
                  {
                    "name": "FLE Standard Time",
                    "abbr": "FDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius",
                    "utc": [
                      "Europe/Helsinki",
                      "Europe/Kiev",
                      "Europe/Mariehamn",
                      "Europe/Riga",
                      "Europe/Sofia",
                      "Europe/Tallinn",
                      "Europe/Uzhgorod",
                      "Europe/Vilnius",
                      "Europe/Zaporozhye"
                    ]
                  },
                  {
                    "name": "Turkey Standard Time",
                    "abbr": "TDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Istanbul",
                    "utc": [
                      "Europe/Istanbul"
                    ]
                  },
                  {
                    "name": "Israel Standard Time",
                    "abbr": "JDT",
                    "offset": 3,
                    "isdst": true,
                    "text": "(UTC+02:00) Jerusalem",
                    "utc": [
                      "Asia/Jerusalem"
                    ]
                  },
                  {
                    "name": "Libya Standard Time",
                    "abbr": "LST",
                    "offset": 2,
                    "isdst": false,
                    "text": "(UTC+02:00) Tripoli",
                    "utc": [
                      "Africa/Tripoli"
                    ]
                  },
                  {
                    "name": "Jordan Standard Time",
                    "abbr": "JST",
                    "offset": 3,
                    "isdst": false,
                    "text": "(UTC+03:00) Amman",
                    "utc": [
                      "Asia/Amman"
                    ]
                  },
                  {
                    "name": "Arabic Standard Time",
                    "abbr": "AST",
                    "offset": 3,
                    "isdst": false,
                    "text": "(UTC+03:00) Baghdad",
                    "utc": [
                      "Asia/Baghdad"
                    ]
                  },
                  {
                    "name": "Kaliningrad Standard Time",
                    "abbr": "KST",
                    "offset": 3,
                    "isdst": false,
                    "text": "(UTC+03:00) Kaliningrad, Minsk",
                    "utc": [
                      "Europe/Kaliningrad",
                      "Europe/Minsk"
                    ]
                  },
                  {
                    "name": "Arab Standard Time",
                    "abbr": "AST",
                    "offset": 3,
                    "isdst": false,
                    "text": "(UTC+03:00) Kuwait, Riyadh",
                    "utc": [
                      "Asia/Aden",
                      "Asia/Bahrain",
                      "Asia/Kuwait",
                      "Asia/Qatar",
                      "Asia/Riyadh"
                    ]
                  },
                  {
                    "name": "E. Africa Standard Time",
                    "abbr": "EAST",
                    "offset": 3,
                    "isdst": false,
                    "text": "(UTC+03:00) Nairobi",
                    "utc": [
                      "Africa/Addis_Ababa",
                      "Africa/Asmera",
                      "Africa/Dar_es_Salaam",
                      "Africa/Djibouti",
                      "Africa/Juba",
                      "Africa/Kampala",
                      "Africa/Khartoum",
                      "Africa/Mogadishu",
                      "Africa/Nairobi",
                      "Antarctica/Syowa",
                      "Etc/GMT-3",
                      "Indian/Antananarivo",
                      "Indian/Comoro",
                      "Indian/Mayotte"
                    ]
                  },
                  {
                    "name": "Iran Standard Time",
                    "abbr": "IDT",
                    "offset": 4.5,
                    "isdst": true,
                    "text": "(UTC+03:30) Tehran",
                    "utc": [
                      "Asia/Tehran"
                    ]
                  },
                  {
                    "name": "Arabian Standard Time",
                    "abbr": "AST",
                    "offset": 4,
                    "isdst": false,
                    "text": "(UTC+04:00) Abu Dhabi, Muscat",
                    "utc": [
                      "Asia/Dubai",
                      "Asia/Muscat",
                      "Etc/GMT-4"
                    ]
                  },
                  {
                    "name": "Azerbaijan Standard Time",
                    "abbr": "ADT",
                    "offset": 5,
                    "isdst": true,
                    "text": "(UTC+04:00) Baku",
                    "utc": [
                      "Asia/Baku"
                    ]
                  },
                  {
                    "name": "Russian Standard Time",
                    "abbr": "RST",
                    "offset": 4,
                    "isdst": false,
                    "text": "(UTC+04:00) Moscow, St. Petersburg, Volgograd",
                    "utc": [
                      "Europe/Moscow",
                      "Europe/Samara",
                      "Europe/Simferopol",
                      "Europe/Volgograd"
                    ]
                  },
                  {
                    "name": "Mauritius Standard Time",
                    "abbr": "MST",
                    "offset": 4,
                    "isdst": false,
                    "text": "(UTC+04:00) Port Louis",
                    "utc": [
                      "Indian/Mahe",
                      "Indian/Mauritius",
                      "Indian/Reunion"
                    ]
                  },
                  {
                    "name": "Georgian Standard Time",
                    "abbr": "GST",
                    "offset": 4,
                    "isdst": false,
                    "text": "(UTC+04:00) Tbilisi",
                    "utc": [
                      "Asia/Tbilisi"
                    ]
                  },
                  {
                    "name": "Caucasus Standard Time",
                    "abbr": "CST",
                    "offset": 4,
                    "isdst": false,
                    "text": "(UTC+04:00) Yerevan",
                    "utc": [
                      "Asia/Yerevan"
                    ]
                  },
                  {
                    "name": "Afghanistan Standard Time",
                    "abbr": "AST",
                    "offset": 4.5,
                    "isdst": false,
                    "text": "(UTC+04:30) Kabul",
                    "utc": [
                      "Asia/Kabul"
                    ]
                  },
                  {
                    "name": "West Asia Standard Time",
                    "abbr": "WAST",
                    "offset": 5,
                    "isdst": false,
                    "text": "(UTC+05:00) Ashgabat, Tashkent",
                    "utc": [
                      "Antarctica/Mawson",
                      "Asia/Aqtau",
                      "Asia/Aqtobe",
                      "Asia/Ashgabat",
                      "Asia/Dushanbe",
                      "Asia/Oral",
                      "Asia/Samarkand",
                      "Asia/Tashkent",
                      "Etc/GMT-5",
                      "Indian/Kerguelen",
                      "Indian/Maldives"
                    ]
                  },
                  {
                    "name": "Pakistan Standard Time",
                    "abbr": "PST",
                    "offset": 5,
                    "isdst": false,
                    "text": "(UTC+05:00) Islamabad, Karachi",
                    "utc": [
                      "Asia/Karachi"
                    ]
                  },
                  {
                    "name": "India Standard Time",
                    "abbr": "IST",
                    "offset": 5.5,
                    "isdst": false,
                    "text": "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi",
                    "utc": [
                      "Asia/Calcutta"
                    ]
                  },
                  {
                    "name": "Sri Lanka Standard Time",
                    "abbr": "SLST",
                    "offset": 5.5,
                    "isdst": false,
                    "text": "(UTC+05:30) Sri Jayawardenepura",
                    "utc": [
                      "Asia/Colombo"
                    ]
                  },
                  {
                    "name": "Nepal Standard Time",
                    "abbr": "NST",
                    "offset": 5.75,
                    "isdst": false,
                    "text": "(UTC+05:45) Kathmandu",
                    "utc": [
                      "Asia/Katmandu"
                    ]
                  },
                  {
                    "name": "Central Asia Standard Time",
                    "abbr": "CAST",
                    "offset": 6,
                    "isdst": false,
                    "text": "(UTC+06:00) Astana",
                    "utc": [
                      "Antarctica/Vostok",
                      "Asia/Almaty",
                      "Asia/Bishkek",
                      "Asia/Qyzylorda",
                      "Asia/Urumqi",
                      "Etc/GMT-6",
                      "Indian/Chagos"
                    ]
                  },
                  {
                    "name": "Bangladesh Standard Time",
                    "abbr": "BST",
                    "offset": 6,
                    "isdst": false,
                    "text": "(UTC+06:00) Dhaka",
                    "utc": [
                      "Asia/Dhaka",
                      "Asia/Thimphu"
                    ]
                  },
                  {
                    "name": "Ekaterinburg Standard Time",
                    "abbr": "EST",
                    "offset": 6,
                    "isdst": false,
                    "text": "(UTC+06:00) Ekaterinburg",
                    "utc": [
                      "Asia/Yekaterinburg"
                    ]
                  },
                  {
                    "name": "Myanmar Standard Time",
                    "abbr": "MST",
                    "offset": 6.5,
                    "isdst": false,
                    "text": "(UTC+06:30) Yangon (Rangoon)",
                    "utc": [
                      "Asia/Rangoon",
                      "Indian/Cocos"
                    ]
                  },
                  {
                    "name": "SE Asia Standard Time",
                    "abbr": "SAST",
                    "offset": 7,
                    "isdst": false,
                    "text": "(UTC+07:00) Bangkok, Hanoi, Jakarta",
                    "utc": [
                      "Antarctica/Davis",
                      "Asia/Bangkok",
                      "Asia/Hovd",
                      "Asia/Jakarta",
                      "Asia/Phnom_Penh",
                      "Asia/Pontianak",
                      "Asia/Saigon",
                      "Asia/Vientiane",
                      "Etc/GMT-7",
                      "Indian/Christmas"
                    ]
                  },
                  {
                    "name": "N. Central Asia Standard Time",
                    "abbr": "NCAST",
                    "offset": 7,
                    "isdst": false,
                    "text": "(UTC+07:00) Novosibirsk",
                    "utc": [
                      "Asia/Novokuznetsk",
                      "Asia/Novosibirsk",
                      "Asia/Omsk"
                    ]
                  },
                  {
                    "name": "China Standard Time",
                    "abbr": "CST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi",
                    "utc": [
                      "Asia/Hong_Kong",
                      "Asia/Macau",
                      "Asia/Shanghai"
                    ]
                  },
                  {
                    "name": "North Asia Standard Time",
                    "abbr": "NAST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Krasnoyarsk",
                    "utc": [
                      "Asia/Krasnoyarsk"
                    ]
                  },
                  {
                    "name": "Singapore Standard Time",
                    "abbr": "MPST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Kuala Lumpur, Singapore",
                    "utc": [
                      "Asia/Brunei",
                      "Asia/Kuala_Lumpur",
                      "Asia/Kuching",
                      "Asia/Makassar",
                      "Asia/Manila",
                      "Asia/Singapore",
                      "Etc/GMT-8"
                    ]
                  },
                  {
                    "name": "W. Australia Standard Time",
                    "abbr": "WAST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Perth",
                    "utc": [
                      "Antarctica/Casey",
                      "Australia/Perth"
                    ]
                  },
                  {
                    "name": "Taipei Standard Time",
                    "abbr": "TST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Taipei",
                    "utc": [
                      "Asia/Taipei"
                    ]
                  },
                  {
                    "name": "Ulaanbaatar Standard Time",
                    "abbr": "UST",
                    "offset": 8,
                    "isdst": false,
                    "text": "(UTC+08:00) Ulaanbaatar",
                    "utc": [
                      "Asia/Choibalsan",
                      "Asia/Ulaanbaatar"
                    ]
                  },
                  {
                    "name": "North Asia East Standard Time",
                    "abbr": "NAEST",
                    "offset": 9,
                    "isdst": false,
                    "text": "(UTC+09:00) Irkutsk",
                    "utc": [
                      "Asia/Irkutsk"
                    ]
                  },
                  {
                    "name": "Tokyo Standard Time",
                    "abbr": "TST",
                    "offset": 9,
                    "isdst": false,
                    "text": "(UTC+09:00) Osaka, Sapporo, Tokyo",
                    "utc": [
                      "Asia/Dili",
                      "Asia/Jayapura",
                      "Asia/Tokyo",
                      "Etc/GMT-9",
                      "Pacific/Palau"
                    ]
                  },
                  {
                    "name": "Korea Standard Time",
                    "abbr": "KST",
                    "offset": 9,
                    "isdst": false,
                    "text": "(UTC+09:00) Seoul",
                    "utc": [
                      "Asia/Pyongyang",
                      "Asia/Seoul"
                    ]
                  },
                  {
                    "name": "Cen. Australia Standard Time",
                    "abbr": "CAST",
                    "offset": 9.5,
                    "isdst": false,
                    "text": "(UTC+09:30) Adelaide",
                    "utc": [
                      "Australia/Adelaide",
                      "Australia/Broken_Hill"
                    ]
                  },
                  {
                    "name": "AUS Central Standard Time",
                    "abbr": "ACST",
                    "offset": 9.5,
                    "isdst": false,
                    "text": "(UTC+09:30) Darwin",
                    "utc": [
                      "Australia/Darwin"
                    ]
                  },
                  {
                    "name": "E. Australia Standard Time",
                    "abbr": "EAST",
                    "offset": 10,
                    "isdst": false,
                    "text": "(UTC+10:00) Brisbane",
                    "utc": [
                      "Australia/Brisbane",
                      "Australia/Lindeman"
                    ]
                  },
                  {
                    "name": "AUS Eastern Standard Time",
                    "abbr": "AEST",
                    "offset": 10,
                    "isdst": false,
                    "text": "(UTC+10:00) Canberra, Melbourne, Sydney",
                    "utc": [
                      "Australia/Melbourne",
                      "Australia/Sydney"
                    ]
                  },
                  {
                    "name": "West Pacific Standard Time",
                    "abbr": "WPST",
                    "offset": 10,
                    "isdst": false,
                    "text": "(UTC+10:00) Guam, Port Moresby",
                    "utc": [
                      "Antarctica/DumontDUrville",
                      "Etc/GMT-10",
                      "Pacific/Guam",
                      "Pacific/Port_Moresby",
                      "Pacific/Saipan",
                      "Pacific/Truk"
                    ]
                  },
                  {
                    "name": "Tasmania Standard Time",
                    "abbr": "TST",
                    "offset": 10,
                    "isdst": false,
                    "text": "(UTC+10:00) Hobart",
                    "utc": [
                      "Australia/Currie",
                      "Australia/Hobart"
                    ]
                  },
                  {
                    "name": "Yakutsk Standard Time",
                    "abbr": "YST",
                    "offset": 10,
                    "isdst": false,
                    "text": "(UTC+10:00) Yakutsk",
                    "utc": [
                      "Asia/Chita",
                      "Asia/Khandyga",
                      "Asia/Yakutsk"
                    ]
                  },
                  {
                    "name": "Central Pacific Standard Time",
                    "abbr": "CPST",
                    "offset": 11,
                    "isdst": false,
                    "text": "(UTC+11:00) Solomon Is., New Caledonia",
                    "utc": [
                      "Antarctica/Macquarie",
                      "Etc/GMT-11",
                      "Pacific/Efate",
                      "Pacific/Guadalcanal",
                      "Pacific/Kosrae",
                      "Pacific/Noumea",
                      "Pacific/Ponape"
                    ]
                  },
                  {
                    "name": "Vladivostok Standard Time",
                    "abbr": "VST",
                    "offset": 11,
                    "isdst": false,
                    "text": "(UTC+11:00) Vladivostok",
                    "utc": [
                      "Asia/Sakhalin",
                      "Asia/Ust-Nera",
                      "Asia/Vladivostok"
                    ]
                  },
                  {
                    "name": "New Zealand Standard Time",
                    "abbr": "NZST",
                    "offset": 12,
                    "isdst": false,
                    "text": "(UTC+12:00) Auckland, Wellington",
                    "utc": [
                      "Antarctica/McMurdo",
                      "Pacific/Auckland"
                    ]
                  },
                  {
                    "name": "UTC+12",
                    "abbr": "U",
                    "offset": 12,
                    "isdst": false,
                    "text": "(UTC+12:00) Coordinated Universal Time+12",
                    "utc": [
                      "Etc/GMT-12",
                      "Pacific/Funafuti",
                      "Pacific/Kwajalein",
                      "Pacific/Majuro",
                      "Pacific/Nauru",
                      "Pacific/Tarawa",
                      "Pacific/Wake",
                      "Pacific/Wallis"
                    ]
                  },
                  {
                    "name": "Fiji Standard Time",
                    "abbr": "FST",
                    "offset": 12,
                    "isdst": false,
                    "text": "(UTC+12:00) Fiji",
                    "utc": [
                      "Pacific/Fiji"
                    ]
                  },
                  {
                    "name": "Magadan Standard Time",
                    "abbr": "MST",
                    "offset": 12,
                    "isdst": false,
                    "text": "(UTC+12:00) Magadan",
                    "utc": [
                      "Asia/Anadyr",
                      "Asia/Kamchatka",
                      "Asia/Magadan",
                      "Asia/Srednekolymsk"
                    ]
                  },
                  {
                    "name": "Kamchatka Standard Time",
                    "abbr": "KDT",
                    "offset": 13,
                    "isdst": true,
                    "text": "(UTC+12:00) Petropavlovsk-Kamchatsky - Old"
                  },
                  {
                    "name": "Tonga Standard Time",
                    "abbr": "TST",
                    "offset": 13,
                    "isdst": false,
                    "text": "(UTC+13:00) Nuku'alofa",
                    "utc": [
                      "Etc/GMT-13",
                      "Pacific/Enderbury",
                      "Pacific/Fakaofo",
                      "Pacific/Tongatapu"
                    ]
                  },
                  {
                    "name": "Samoa Standard Time",
                    "abbr": "SST",
                    "offset": 13,
                    "isdst": false,
                    "text": "(UTC+13:00) Samoa",
                    "utc": [
                      "Pacific/Apia"
                    ]
                  }
                ],
        //List source: http://answers.google.com/answers/threadview/id/589312.html
        profession: [
            "Airline Pilot",
            "Academic Team",
            "Accountant",
            "Account Executive",
            "Actor",
            "Actuary",
            "Acquisition Analyst",
            "Administrative Asst.",
            "Administrative Analyst",
            "Administrator",
            "Advertising Director",
            "Aerospace Engineer",
            "Agent",
            "Agricultural Inspector",
            "Agricultural Scientist",
            "Air Traffic Controller",
            "Animal Trainer",
            "Anthropologist",
            "Appraiser",
            "Architect",
            "Art Director",
            "Artist",
            "Astronomer",
            "Athletic Coach",
            "Auditor",
            "Author",
            "Baker",
            "Banker",
            "Bankruptcy Attorney",
            "Benefits Manager",
            "Biologist",
            "Bio-feedback Specialist",
            "Biomedical Engineer",
            "Biotechnical Researcher",
            "Broadcaster",
            "Broker",
            "Building Manager",
            "Building Contractor",
            "Building Inspector",
            "Business Analyst",
            "Business Planner",
            "Business Manager",
            "Buyer",
            "Call Center Manager",
            "Career Counselor",
            "Cash Manager",
            "Ceramic Engineer",
            "Chief Executive Officer",
            "Chief Operation Officer",
            "Chef",
            "Chemical Engineer",
            "Chemist",
            "Child Care Manager",
            "Chief Medical Officer",
            "Chiropractor",
            "Cinematographer",
            "City Housing Manager",
            "City Manager",
            "Civil Engineer",
            "Claims Manager",
            "Clinical Research Assistant",
            "Collections Manager.",
            "Compliance Manager",
            "Comptroller",
            "Computer Manager",
            "Commercial Artist",
            "Communications Affairs Director",
            "Communications Director",
            "Communications Engineer",
            "Compensation Analyst",
            "Computer Programmer",
            "Computer Ops. Manager",
            "Computer Engineer",
            "Computer Operator",
            "Computer Graphics Specialist",
            "Construction Engineer",
            "Construction Manager",
            "Consultant",
            "Consumer Relations Manager",
            "Contract Administrator",
            "Copyright Attorney",
            "Copywriter",
            "Corporate Planner",
            "Corrections Officer",
            "Cosmetologist",
            "Credit Analyst",
            "Cruise Director",
            "Chief Information Officer",
            "Chief Technology Officer",
            "Customer Service Manager",
            "Cryptologist",
            "Dancer",
            "Data Security Manager",
            "Database Manager",
            "Day Care Instructor",
            "Dentist",
            "Designer",
            "Design Engineer",
            "Desktop Publisher",
            "Developer",
            "Development Officer",
            "Diamond Merchant",
            "Dietitian",
            "Direct Marketer",
            "Director",
            "Distribution Manager",
            "Diversity Manager",
            "Economist",
            "EEO Compliance Manager",
            "Editor",
            "Education Adminator",
            "Electrical Engineer",
            "Electro Optical Engineer",
            "Electronics Engineer",
            "Embassy Management",
            "Employment Agent",
            "Engineer Technician",
            "Entrepreneur",
            "Environmental Analyst",
            "Environmental Attorney",
            "Environmental Engineer",
            "Environmental Specialist",
            "Escrow Officer",
            "Estimator",
            "Executive Assistant",
            "Executive Director",
            "Executive Recruiter",
            "Facilities Manager",
            "Family Counselor",
            "Fashion Events Manager",
            "Fashion Merchandiser",
            "Fast Food Manager",
            "Film Producer",
            "Film Production Assistant",
            "Financial Analyst",
            "Financial Planner",
            "Financier",
            "Fine Artist",
            "Wildlife Specialist",
            "Fitness Consultant",
            "Flight Attendant",
            "Flight Engineer",
            "Floral Designer",
            "Food & Beverage Director",
            "Food Service Manager",
            "Forestry Technician",
            "Franchise Management",
            "Franchise Sales",
            "Fraud Investigator",
            "Freelance Writer",
            "Fund Raiser",
            "General Manager",
            "Geologist",
            "General Counsel",
            "Geriatric Specialist",
            "Gerontologist",
            "Glamour Photographer",
            "Golf Club Manager",
            "Gourmet Chef",
            "Graphic Designer",
            "Grounds Keeper",
            "Hazardous Waste Manager",
            "Health Care Manager",
            "Health Therapist",
            "Health Service Administrator",
            "Hearing Officer",
            "Home Economist",
            "Horticulturist",
            "Hospital Administrator",
            "Hotel Manager",
            "Human Resources Manager",
            "Importer",
            "Industrial Designer",
            "Industrial Engineer",
            "Information Director",
            "Inside Sales",
            "Insurance Adjuster",
            "Interior Decorator",
            "Internal Controls Director",
            "International Acct.",
            "International Courier",
            "International Lawyer",
            "Interpreter",
            "Investigator",
            "Investment Banker",
            "Investment Manager",
            "IT Architect",
            "IT Project Manager",
            "IT Systems Analyst",
            "Jeweler",
            "Joint Venture Manager",
            "Journalist",
            "Labor Negotiator",
            "Labor Organizer",
            "Labor Relations Manager",
            "Lab Services Director",
            "Lab Technician",
            "Land Developer",
            "Landscape Architect",
            "Law Enforcement Officer",
            "Lawyer",
            "Lead Software Engineer",
            "Lead Software Test Engineer",
            "Leasing Manager",
            "Legal Secretary",
            "Library Manager",
            "Litigation Attorney",
            "Loan Officer",
            "Lobbyist",
            "Logistics Manager",
            "Maintenance Manager",
            "Management Consultant",
            "Managed Care Director",
            "Managing Partner",
            "Manufacturing Director",
            "Manpower Planner",
            "Marine Biologist",
            "Market Res. Analyst",
            "Marketing Director",
            "Materials Manager",
            "Mathematician",
            "Membership Chairman",
            "Mechanic",
            "Mechanical Engineer",
            "Media Buyer",
            "Medical Investor",
            "Medical Secretary",
            "Medical Technician",
            "Mental Health Counselor",
            "Merchandiser",
            "Metallurgical Engineering",
            "Meteorologist",
            "Microbiologist",
            "MIS Manager",
            "Motion Picture Director",
            "Multimedia Director",
            "Musician",
            "Network Administrator",
            "Network Specialist",
            "Network Operator",
            "New Product Manager",
            "Novelist",
            "Nuclear Engineer",
            "Nuclear Specialist",
            "Nutritionist",
            "Nursing Administrator",
            "Occupational Therapist",
            "Oceanographer",
            "Office Manager",
            "Operations Manager",
            "Operations Research Director",
            "Optical Technician",
            "Optometrist",
            "Organizational Development Manager",
            "Outplacement Specialist",
            "Paralegal",
            "Park Ranger",
            "Patent Attorney",
            "Payroll Specialist",
            "Personnel Specialist",
            "Petroleum Engineer",
            "Pharmacist",
            "Photographer",
            "Physical Therapist",
            "Physician",
            "Physician Assistant",
            "Physicist",
            "Planning Director",
            "Podiatrist",
            "Political Analyst",
            "Political Scientist",
            "Politician",
            "Portfolio Manager",
            "Preschool Management",
            "Preschool Teacher",
            "Principal",
            "Private Banker",
            "Private Investigator",
            "Probation Officer",
            "Process Engineer",
            "Producer",
            "Product Manager",
            "Product Engineer",
            "Production Engineer",
            "Production Planner",
            "Professional Athlete",
            "Professional Coach",
            "Professor",
            "Project Engineer",
            "Project Manager",
            "Program Manager",
            "Property Manager",
            "Public Administrator",
            "Public Safety Director",
            "PR Specialist",
            "Publisher",
            "Purchasing Agent",
            "Publishing Director",
            "Quality Assurance Specialist",
            "Quality Control Engineer",
            "Quality Control Inspector",
            "Radiology Manager",
            "Railroad Engineer",
            "Real Estate Broker",
            "Recreational Director",
            "Recruiter",
            "Redevelopment Specialist",
            "Regulatory Affairs Manager",
            "Registered Nurse",
            "Rehabilitation Counselor",
            "Relocation Manager",
            "Reporter",
            "Research Specialist",
            "Restaurant Manager",
            "Retail Store Manager",
            "Risk Analyst",
            "Safety Engineer",
            "Sales Engineer",
            "Sales Trainer",
            "Sales Promotion Manager",
            "Sales Representative",
            "Sales Manager",
            "Service Manager",
            "Sanitation Engineer",
            "Scientific Programmer",
            "Scientific Writer",
            "Securities Analyst",
            "Security Consultant",
            "Security Director",
            "Seminar Presenter",
            "Ship's Officer",
            "Singer",
            "Social Director",
            "Social Program Planner",
            "Social Research",
            "Social Scientist",
            "Social Worker",
            "Sociologist",
            "Software Developer",
            "Software Engineer",
            "Software Test Engineer",
            "Soil Scientist",
            "Special Events Manager",
            "Special Education Teacher",
            "Special Projects Director",
            "Speech Pathologist",
            "Speech Writer",
            "Sports Event Manager",
            "Statistician",
            "Store Manager",
            "Strategic Alliance Director",
            "Strategic Planning Director",
            "Stress Reduction Specialist",
            "Stockbroker",
            "Surveyor",
            "Structural Engineer",
            "Superintendent",
            "Supply Chain Director",
            "System Engineer",
            "Systems Analyst",
            "Systems Programmer",
            "System Administrator",
            "Tax Specialist",
            "Teacher",
            "Technical Support Specialist",
            "Technical Illustrator",
            "Technical Writer",
            "Technology Director",
            "Telecom Analyst",
            "Telemarketer",
            "Theatrical Director",
            "Title Examiner",
            "Tour Escort",
            "Tour Guide Director",
            "Traffic Manager",
            "Trainer Translator",
            "Transportation Manager",
            "Travel Agent",
            "Treasurer",
            "TV Programmer",
            "Underwriter",
            "Union Representative",
            "University Administrator",
            "University Dean",
            "Urban Planner",
            "Veterinarian",
            "Vendor Relations Director",
            "Viticulturist",
            "Warehouse Manager"
        ]
    };

    var o_hasOwnProperty = Object.prototype.hasOwnProperty;
    var o_keys = (Object.keys || function(obj) {
      var result = [];
      for (var key in obj) {
        if (o_hasOwnProperty.call(obj, key)) {
          result.push(key);
        }
      }

      return result;
    });

    function _copyObject(source, target) {
      var keys = o_keys(source);
      var key;

      for (var i = 0, l = keys.length; i < l; i++) {
        key = keys[i];
        target[key] = source[key] || target[key];
      }
    }

    function _copyArray(source, target) {
      for (var i = 0, l = source.length; i < l; i++) {
        target[i] = source[i];
      }
    }

    function copyObject(source, _target) {
        var isArray = Array.isArray(source);
        var target = _target || (isArray ? new Array(source.length) : {});

        if (isArray) {
          _copyArray(source, target);
        } else {
          _copyObject(source, target);
        }

        return target;
    }

    /** Get the data based on key**/
    Chance.prototype.get = function (name) {
        return copyObject(data[name]);
    };

    // Mac Address
    Chance.prototype.mac_address = function(options){
        // typically mac addresses are separated by ":"
        // however they can also be separated by "-"
        // the network variant uses a dot every fourth byte

        options = initOptions(options);
        if(!options.separator) {
            options.separator =  options.networkVersion ? "." : ":";
        }

        var mac_pool="ABCDEF1234567890",
            mac = "";
        if(!options.networkVersion) {
            mac = this.n(this.string, 6, { pool: mac_pool, length:2 }).join(options.separator);
        } else {
            mac = this.n(this.string, 3, { pool: mac_pool, length:4 }).join(options.separator);
        }

        return mac;
    };

    Chance.prototype.normal = function (options) {
        options = initOptions(options, {mean : 0, dev : 1, pool : []});

        testRange(
            options.pool.constructor !== Array,
            "Chance: The pool option must be a valid array."
        );

        // If a pool has been passed, then we are returning an item from that pool,
        // using the normal distribution settings that were passed in
        if (options.pool.length > 0) {
            return this.normal_pool(options);
        }

        // The Marsaglia Polar method
        var s, u, v, norm,
            mean = options.mean,
            dev = options.dev;

        do {
            // U and V are from the uniform distribution on (-1, 1)
            u = this.random() * 2 - 1;
            v = this.random() * 2 - 1;

            s = u * u + v * v;
        } while (s >= 1);

        // Compute the standard normal variate
        norm = u * Math.sqrt(-2 * Math.log(s) / s);

        // Shape and scale
        return dev * norm + mean;
    };

    Chance.prototype.normal_pool = function(options) {
        var performanceCounter = 0;
        do {
            var idx = Math.round(this.normal({ mean: options.mean, dev: options.dev }));
            if (idx < options.pool.length && idx >= 0) {
                return options.pool[idx];
            } else {
                performanceCounter++;
            }
        } while(performanceCounter < 100);

        throw new RangeError("Chance: Your pool is too small for the given mean and standard deviation. Please adjust.");
    };

    Chance.prototype.radio = function (options) {
        // Initial Letter (Typically Designated by Side of Mississippi River)
        options = initOptions(options, {side : "?"});
        var fl = "";
        switch (options.side.toLowerCase()) {
        case "east":
        case "e":
            fl = "W";
            break;
        case "west":
        case "w":
            fl = "K";
            break;
        default:
            fl = this.character({pool: "KW"});
            break;
        }

        return fl + this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"});
    };

    // Set the data as key and data or the data map
    Chance.prototype.set = function (name, values) {
        if (typeof name === "string") {
            data[name] = values;
        } else {
            data = copyObject(name, data);
        }
    };

    Chance.prototype.tv = function (options) {
        return this.radio(options);
    };

    // ID number for Brazil companies
    Chance.prototype.cnpj = function () {
        var n = this.n(this.natural, 8, { max: 9 });
        var d1 = 2+n[7]*6+n[6]*7+n[5]*8+n[4]*9+n[3]*2+n[2]*3+n[1]*4+n[0]*5;
        d1 = 11 - (d1 % 11);
        if (d1>=10){
            d1 = 0;
        }
        var d2 = d1*2+3+n[7]*7+n[6]*8+n[5]*9+n[4]*2+n[3]*3+n[2]*4+n[1]*5+n[0]*6;
        d2 = 11 - (d2 % 11);
        if (d2>=10){
            d2 = 0;
        }
        return ''+n[0]+n[1]+'.'+n[2]+n[3]+n[4]+'.'+n[5]+n[6]+n[7]+'/0001-'+d1+d2;
    };

    // -- End Miscellaneous --

    Chance.prototype.mersenne_twister = function (seed) {
        return new MersenneTwister(seed);
    };

    Chance.prototype.blueimp_md5 = function () {
        return new BlueImpMD5();
    };

    // Mersenne Twister from https://gist.github.com/banksean/300494
    var MersenneTwister = function (seed) {
        if (seed === undefined) {
            // kept random number same size as time used previously to ensure no unexpected results downstream
            seed = Math.floor(Math.random()*Math.pow(10,13));
        }
        /* Period parameters */
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 0x9908b0df;   /* constant vector a */
        this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
        this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

        this.mt = new Array(this.N); /* the array for the state vector */
        this.mti = this.N + 1; /* mti==N + 1 means mt[N] is not initialized */

        this.init_genrand(seed);
    };

    /* initializes mt[N] with a seed */
    MersenneTwister.prototype.init_genrand = function (s) {
        this.mt[0] = s >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
            s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + this.mti;
            /* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
            /* In the previous versions, MSBs of the seed affect   */
            /* only MSBs of the array mt[].                        */
            /* 2002/01/09 modified by Makoto Matsumoto             */
            this.mt[this.mti] >>>= 0;
            /* for >32 bit machines */
        }
    };

    /* initialize by an array with array-length */
    /* init_key is the array for initializing keys */
    /* key_length is its length */
    /* slight change for C++, 2004/2/26 */
    MersenneTwister.prototype.init_by_array = function (init_key, key_length) {
        var i = 1, j = 0, k, s;
        this.init_genrand(19650218);
        k = (this.N > key_length ? this.N : key_length);
        for (; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525))) + init_key[j] + j; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            j++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
            if (j >= key_length) { j = 0; }
        }
        for (k = this.N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941)) - i; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
        }

        this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
    };

    /* generates a random number on [0,0xffffffff]-interval */
    MersenneTwister.prototype.genrand_int32 = function () {
        var y;
        var mag01 = new Array(0x0, this.MATRIX_A);
        /* mag01[x] = x * MATRIX_A  for x=0,1 */

        if (this.mti >= this.N) { /* generate N words at one time */
            var kk;

            if (this.mti === this.N + 1) {   /* if init_genrand() has not been called, */
                this.init_genrand(5489); /* a default initial seed is used */
            }
            for (kk = 0; kk < this.N - this.M; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            for (;kk < this.N - 1; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            y = (this.mt[this.N - 1]&this.UPPER_MASK)|(this.mt[0]&this.LOWER_MASK);
            this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

            this.mti = 0;
        }

        y = this.mt[this.mti++];

        /* Tempering */
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        return y >>> 0;
    };

    /* generates a random number on [0,0x7fffffff]-interval */
    MersenneTwister.prototype.genrand_int31 = function () {
        return (this.genrand_int32() >>> 1);
    };

    /* generates a random number on [0,1]-real-interval */
    MersenneTwister.prototype.genrand_real1 = function () {
        return this.genrand_int32() * (1.0 / 4294967295.0);
        /* divided by 2^32-1 */
    };

    /* generates a random number on [0,1)-real-interval */
    MersenneTwister.prototype.random = function () {
        return this.genrand_int32() * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on (0,1)-real-interval */
    MersenneTwister.prototype.genrand_real3 = function () {
        return (this.genrand_int32() + 0.5) * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on [0,1) with 53-bit resolution*/
    MersenneTwister.prototype.genrand_res53 = function () {
        var a = this.genrand_int32()>>>5, b = this.genrand_int32()>>>6;
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    };

    // BlueImp MD5 hashing algorithm from https://github.com/blueimp/JavaScript-MD5
    var BlueImpMD5 = function () {};

    BlueImpMD5.prototype.VERSION = '1.0.1';

    /*
    * Add integers, wrapping at 2^32. This uses 16-bit operations internally
    * to work around bugs in some JS interpreters.
    */
    BlueImpMD5.prototype.safe_add = function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    };

    /*
    * Bitwise rotate a 32-bit number to the left.
    */
    BlueImpMD5.prototype.bit_roll = function (num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    };

    /*
    * These functions implement the five basic operations the algorithm uses.
    */
    BlueImpMD5.prototype.md5_cmn = function (q, a, b, x, s, t) {
        return this.safe_add(this.bit_roll(this.safe_add(this.safe_add(a, q), this.safe_add(x, t)), s), b);
    };
    BlueImpMD5.prototype.md5_ff = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_gg = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_hh = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(b ^ c ^ d, a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_ii = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    };

    /*
    * Calculate the MD5 of an array of little-endian words, and a bit length.
    */
    BlueImpMD5.prototype.binl_md5 = function (x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << (len % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var i, olda, oldb, oldc, oldd,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = this.md5_ff(a, b, c, d, x[i],       7, -680876936);
            d = this.md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
            c = this.md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
            b = this.md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
            a = this.md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
            d = this.md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
            c = this.md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
            b = this.md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
            a = this.md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
            d = this.md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
            c = this.md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = this.md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = this.md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
            d = this.md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = this.md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = this.md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

            a = this.md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
            d = this.md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
            c = this.md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
            b = this.md5_gg(b, c, d, a, x[i],      20, -373897302);
            a = this.md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
            d = this.md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
            c = this.md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = this.md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
            a = this.md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
            d = this.md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
            c = this.md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
            b = this.md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
            a = this.md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
            d = this.md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
            c = this.md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
            b = this.md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = this.md5_hh(a, b, c, d, x[i +  5],  4, -378558);
            d = this.md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
            c = this.md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
            b = this.md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = this.md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
            d = this.md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
            c = this.md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
            b = this.md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = this.md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
            d = this.md5_hh(d, a, b, c, x[i],      11, -358537222);
            c = this.md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
            b = this.md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
            a = this.md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
            d = this.md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = this.md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
            b = this.md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

            a = this.md5_ii(a, b, c, d, x[i],       6, -198630844);
            d = this.md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
            c = this.md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = this.md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
            a = this.md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
            d = this.md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
            c = this.md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = this.md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
            a = this.md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
            d = this.md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = this.md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
            b = this.md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
            a = this.md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
            d = this.md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = this.md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
            b = this.md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

            a = this.safe_add(a, olda);
            b = this.safe_add(b, oldb);
            c = this.safe_add(c, oldc);
            d = this.safe_add(d, oldd);
        }
        return [a, b, c, d];
    };

    /*
    * Convert an array of little-endian words to a string
    */
    BlueImpMD5.prototype.binl2rstr = function (input) {
        var i,
            output = '';
        for (i = 0; i < input.length * 32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
        }
        return output;
    };

    /*
    * Convert a raw string to an array of little-endian words
    * Characters >255 have their high-byte silently ignored.
    */
    BlueImpMD5.prototype.rstr2binl = function (input) {
        var i,
            output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        for (i = 0; i < input.length * 8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return output;
    };

    /*
    * Calculate the MD5 of a raw string
    */
    BlueImpMD5.prototype.rstr_md5 = function (s) {
        return this.binl2rstr(this.binl_md5(this.rstr2binl(s), s.length * 8));
    };

    /*
    * Calculate the HMAC-MD5, of a key and some data (raw strings)
    */
    BlueImpMD5.prototype.rstr_hmac_md5 = function (key, data) {
        var i,
            bkey = this.rstr2binl(key),
            ipad = [],
            opad = [],
            hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = this.binl_md5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }
        hash = this.binl_md5(ipad.concat(this.rstr2binl(data)), 512 + data.length * 8);
        return this.binl2rstr(this.binl_md5(opad.concat(hash), 512 + 128));
    };

    /*
    * Convert a raw string to a hex string
    */
    BlueImpMD5.prototype.rstr2hex = function (input) {
        var hex_tab = '0123456789abcdef',
            output = '',
            x,
            i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hex_tab.charAt((x >>> 4) & 0x0F) +
                hex_tab.charAt(x & 0x0F);
        }
        return output;
    };

    /*
    * Encode a string as utf-8
    */
    BlueImpMD5.prototype.str2rstr_utf8 = function (input) {
        return unescape(encodeURIComponent(input));
    };

    /*
    * Take string arguments and return either raw or hex encoded strings
    */
    BlueImpMD5.prototype.raw_md5 = function (s) {
        return this.rstr_md5(this.str2rstr_utf8(s));
    };
    BlueImpMD5.prototype.hex_md5 = function (s) {
        return this.rstr2hex(this.raw_md5(s));
    };
    BlueImpMD5.prototype.raw_hmac_md5 = function (k, d) {
        return this.rstr_hmac_md5(this.str2rstr_utf8(k), this.str2rstr_utf8(d));
    };
    BlueImpMD5.prototype.hex_hmac_md5 = function (k, d) {
        return this.rstr2hex(this.raw_hmac_md5(k, d));
    };

    BlueImpMD5.prototype.md5 = function (string, key, raw) {
        if (!key) {
            if (!raw) {
                return this.hex_md5(string);
            }

            return this.raw_md5(string);
        }

        if (!raw) {
            return this.hex_hmac_md5(key, string);
        }

        return this.raw_hmac_md5(key, string);
    };

    // CommonJS module
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = Chance;
        }
        exports.Chance = Chance;
    }

    // Register as an anonymous AMD module
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return Chance;
        });
    }

    // if there is a importsScrips object define chance for worker
    if (typeof importScripts !== 'undefined') {
        chance = new Chance();
    }

    // If there is a window object, that at least has a document property,
    // instantiate and define chance on the window
    if (typeof window === "object" && typeof window.document === "object") {
        window.Chance = Chance;
        window.chance = new Chance();
    }
})();

}).call(this,require("buffer").Buffer)

},{"buffer":2}]},{},[12])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJqc1xcc3JjXFxjYW1lcmEuanMiLCJqc1xcc3JjXFxjb2xvcnMuanMiLCJqc1xcc3JjXFxjb250cm9scy5qcyIsImpzXFxzcmNcXGdhbWUuanMiLCJqc1xcc3JjXFxncm91bmQuanMiLCJqc1xcc3JjXFxwbGF5ZXIuanMiLCJqc1xcc3JjXFxzb2xhcmlzLWNvbnRyb2xzLmpzIiwianNcXHNyY1xcc29sYXJpcy5qcyIsIm5vZGVfbW9kdWxlcy9jaGFuY2UvY2hhbmNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjs7QUFFQSxNQUFNLE1BQU4sU0FBcUIsTUFBTSxpQkFBM0IsQ0FBNkM7O0FBRTVDLGVBQWM7O0FBRWIsUUFBTSxjQUFjLEtBQUssS0FBTCxHQUFhLEtBQUssTUFBdEM7QUFDQSxRQUFNLGNBQWMsRUFBcEI7QUFDQSxRQUFNLFlBQVksQ0FBbEI7QUFDQSxRQUFNLFdBQVcsS0FBakI7O0FBRUEsUUFDQyxXQURELEVBRUMsV0FGRCxFQUdDLFNBSEQsRUFJQyxRQUpEOztBQU9BLE9BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxJQUFmOztBQUVBO0FBQ0EsT0FBSyxFQUFMLENBQVEsSUFBUixDQUFhLElBQUksTUFBTSxPQUFWLENBQWtCLENBQWxCLEVBQXFCLENBQXJCLEVBQXdCLENBQXhCLENBQWI7O0FBRUE7QUFDQSxPQUFLLGdCQUFMLEdBQXdCLElBQUksTUFBTSxPQUFWLENBQWtCLENBQWxCLEVBQXFCLEVBQXJCLEVBQXlCLENBQXpCLENBQXhCO0FBRUE7O0FBRUQsUUFBTyxLQUFQLEVBQWM7O0FBRWI7QUFDQSxRQUFNLFFBQVEsR0FBZDtBQUNBLFFBQU0sU0FBUyxLQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLEtBQXJCLEdBQTZCLEdBQTdCLENBQWlDLEtBQUssZ0JBQXRDLENBQWY7QUFDQSxRQUFNLFdBQVcsS0FBSyxRQUF0Qjs7QUFFQSxXQUFTLENBQVQsSUFBYyxDQUFDLE9BQU8sQ0FBUCxHQUFXLFNBQVMsQ0FBckIsSUFBMEIsS0FBMUIsR0FBa0MsTUFBTSxLQUF0RDtBQUNBLFdBQVMsQ0FBVCxJQUFjLENBQUMsT0FBTyxDQUFQLEdBQVcsU0FBUyxDQUFyQixJQUEwQixLQUExQixHQUFrQyxNQUFNLEtBQXREO0FBQ0EsV0FBUyxDQUFULElBQWMsQ0FBQyxPQUFPLENBQVAsR0FBVyxTQUFTLENBQXJCLElBQTBCLEtBQTFCLEdBQWtDLE1BQU0sS0FBdEQ7O0FBRUE7QUFDQSxPQUFLLE1BQUwsQ0FBWSxLQUFLLE1BQUwsQ0FBWSxnQkFBWixFQUFaO0FBRUE7QUF4QzJDOztBQTJDN0MsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7QUM3Q0EsT0FBTyxPQUFQLEdBQWlCO0FBQ2hCLE1BQUssUUFEVztBQUVoQixRQUFPLFFBRlM7QUFHaEIsUUFBTyxRQUhTO0FBSWhCLE9BQU0sUUFKVTtBQUtoQixZQUFXLFFBTEs7QUFNaEIsT0FBTTtBQU5VLENBQWpCOzs7QUNBQTs7O0FBR0EsTUFBTSxRQUFOLENBQWU7O0FBRWQsZUFBYzs7QUFFYixPQUFLLE9BQUwsR0FBZSxJQUFmO0FBQ0EsT0FBSyxRQUFMLEdBQWdCLEdBQWhCOztBQUVBO0FBQ0EsT0FBSyxVQUFMLEdBQWtCLFVBQWxCOztBQUVBO0FBQ0EsT0FBSyxNQUFMLEdBQWM7QUFDYixhQUFVLEVBREc7QUFFYixZQUFTO0FBRkksR0FBZDs7QUFLQTtBQUNBLE9BQUssUUFBTCxHQUFnQjtBQUNmLGFBQVUsRUFESztBQUVmLFlBQVM7QUFGTSxHQUFoQjs7QUFLQTtBQUNBLE9BQUssT0FBTCxHQUFlO0FBQ2QsTUFBRyxDQURXO0FBRWQsTUFBRyxDQUZXO0FBR2QsTUFBRyxDQUhXO0FBSWQsTUFBRyxDQUpXO0FBS2QsT0FBSSxDQUxVO0FBTWQsT0FBSSxDQU5VO0FBT2QsT0FBSSxDQVBVO0FBUWQsT0FBSSxDQVJVO0FBU2QsU0FBTSxDQVRRO0FBVWQsVUFBTyxDQVZPO0FBV2QsT0FBSSxFQVhVO0FBWWQsU0FBTSxFQVpRO0FBYWQsU0FBTSxFQWJRO0FBY2QsVUFBTyxFQWRPOztBQWdCZCxXQUFRLENBaEJNO0FBaUJkLFdBQVEsQ0FqQk07QUFrQmQsWUFBUyxDQWxCSztBQW1CZCxZQUFTO0FBbkJLLEdBQWY7O0FBc0JBOzs7QUFHQSxTQUFPLGdCQUFQLENBQXdCLGtCQUF4QixFQUE2QyxLQUFELElBQVc7O0FBRXRELE9BQUksS0FBSyxNQUFNLE9BQWY7O0FBRUEsV0FBUSxHQUFSLENBQVkscURBQVosRUFDQyxHQUFHLEtBREosRUFDVyxHQUFHLEVBRGQsRUFFQyxHQUFHLE9BQUgsQ0FBVyxNQUZaLEVBRW9CLEdBQUcsSUFBSCxDQUFRLE1BRjVCOztBQUlBLFFBQUssT0FBTCxHQUFlLEVBQWY7QUFDQSxRQUFLLFVBQUwsR0FBa0IsU0FBbEI7QUFFQSxHQVhEOztBQWFBOzs7QUFHQSxTQUFPLGdCQUFQLENBQXdCLFNBQXhCLEVBQW9DLEtBQUQsSUFBVzs7QUFFN0MsUUFBSyxNQUFMLENBQVksUUFBWixDQUFxQixNQUFNLEdBQTNCLElBQWtDLElBQWxDO0FBQ0EsUUFBSyxVQUFMLEdBQWtCLFVBQWxCO0FBRUEsR0FMRDs7QUFPQTs7O0FBR0EsU0FBTyxnQkFBUCxDQUF3QixPQUF4QixFQUFrQyxLQUFELElBQVc7O0FBRTNDLFFBQUssTUFBTCxDQUFZLFFBQVosQ0FBcUIsTUFBTSxHQUEzQixJQUFrQyxLQUFsQztBQUNBLFFBQUssVUFBTCxHQUFrQixVQUFsQjtBQUVBLEdBTEQ7QUFPQTs7QUFFRDs7O0FBR0EsUUFBTyxLQUFQLEVBQWM7O0FBRWIsTUFBSSxXQUFXLFVBQVUsV0FBVixFQUFmO0FBQ0EsT0FBSyxPQUFMLEdBQWUsU0FBUyxDQUFULENBQWY7O0FBRUEsTUFBSSxLQUFLLE9BQVQsRUFBa0I7O0FBRWpCLFNBQU0sV0FBVyxLQUFLLFFBQUwsQ0FBYyxPQUEvQjtBQUNBLFNBQU0sVUFBVSxLQUFLLGlCQUFMLENBQXVCLEtBQUssT0FBNUIsQ0FBaEI7O0FBRUEsT0FBSSxRQUFKLEVBQWM7O0FBRWIsU0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsT0FBUixDQUFnQixNQUFwQyxFQUE0QyxHQUE1QyxFQUFpRDs7QUFFaEQsU0FBSSxTQUFTLE9BQVQsQ0FBaUIsQ0FBakIsRUFBb0IsT0FBcEIsS0FBZ0MsUUFBUSxPQUFSLENBQWdCLENBQWhCLEVBQW1CLE9BQXZELEVBQWdFOztBQUUvRCxXQUFLLFVBQUwsR0FBa0IsU0FBbEI7QUFFQTtBQUVEOztBQUVELFNBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxRQUFRLElBQVIsQ0FBYSxNQUFqQyxFQUF5QyxHQUF6QyxFQUE4Qzs7QUFFN0MsU0FBSSxTQUFTLElBQVQsQ0FBYyxDQUFkLE1BQXFCLFFBQVEsSUFBUixDQUFhLENBQWIsQ0FBekIsRUFBMEM7O0FBRXpDLFdBQUssVUFBTCxHQUFrQixTQUFsQjtBQUVBO0FBRUQ7QUFFRDs7QUFFRCxRQUFLLFFBQUwsQ0FBYyxPQUFkLEdBQXdCLEtBQUssTUFBTCxDQUFZLE9BQXBDO0FBQ0EsUUFBSyxNQUFMLENBQVksT0FBWixHQUFzQixPQUF0QjtBQUVBO0FBRUQ7O0FBRUQ7Ozs7O0FBS0EsZUFBYyxDQUFkLEVBQWlCOztBQUVoQixNQUFJLFdBQVcsS0FBSyxRQUFwQjs7QUFFQSxNQUFJLElBQUksQ0FBSixHQUFRLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxDQUFDLFFBQWIsQ0FBUixHQUFpQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksUUFBWixDQUFyQzs7QUFFQSxTQUFPLENBQUMsS0FBSyxHQUFMLENBQVMsQ0FBVCxJQUFjLFFBQWYsS0FBNEIsSUFBSSxRQUFoQyxJQUE0QyxLQUFLLElBQUwsQ0FBVSxDQUFWLENBQW5EO0FBRUE7O0FBRUQ7Ozs7O0FBS0EsU0FBUSxnQkFBUixFQUEwQixZQUExQixFQUF3Qzs7QUFFdkMsVUFBUSxLQUFLLFVBQWI7O0FBRUMsUUFBSyxTQUFMOztBQUVDLFFBQUksS0FBSyxNQUFMLENBQVksT0FBWixLQUF3QixJQUE1QixFQUFrQyxPQUFPLENBQVA7O0FBRWxDLFdBQU8sS0FBSyxNQUFMLENBQVksT0FBWixDQUFvQixJQUFwQixDQUF5QixnQkFBekIsQ0FBUDs7QUFFQTs7QUFFRDtBQUNBLFFBQUssVUFBTDs7QUFFQyxRQUFJLFdBQVcsS0FBSyxNQUFMLENBQVksUUFBWixDQUFxQixhQUFhLFFBQWxDLElBQThDLENBQUMsQ0FBL0MsR0FBbUQsQ0FBbEU7QUFDQSxRQUFJLFdBQVcsS0FBSyxNQUFMLENBQVksUUFBWixDQUFxQixhQUFhLFFBQWxDLElBQThDLENBQUMsQ0FBL0MsR0FBbUQsQ0FBbEU7O0FBRUEsV0FBTyxXQUFXLFFBQWxCOztBQUVBOztBQWxCRjtBQXNCQTs7QUFFRDs7Ozs7QUFLQSxtQkFBa0IsT0FBbEIsRUFBMkI7O0FBRTFCLE1BQUksT0FBTyxFQUFYO0FBQ0EsTUFBSSxVQUFVLEVBQWQ7O0FBRUEsT0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsT0FBUixDQUFnQixNQUFwQyxFQUE0QyxHQUE1QyxFQUFpRDs7QUFFaEQsV0FBUSxDQUFSLElBQWE7QUFDWixXQUFPLFFBQVEsT0FBUixDQUFnQixDQUFoQixFQUFtQixLQURkO0FBRVosYUFBUyxRQUFRLE9BQVIsQ0FBZ0IsQ0FBaEIsRUFBbUI7QUFGaEIsSUFBYjtBQUtBOztBQUVELE9BQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxRQUFRLElBQVIsQ0FBYSxNQUFqQyxFQUF5QyxHQUF6QyxFQUE4Qzs7QUFFN0MsUUFBSyxDQUFMLElBQVUsS0FBSyxhQUFMLENBQW1CLFFBQVEsSUFBUixDQUFhLENBQWIsQ0FBbkIsQ0FBVjtBQUVBOztBQUVELFNBQU87QUFDTixTQUFNLElBREE7QUFFTixZQUFTO0FBRkgsR0FBUDtBQUtBOztBQTNNYTs7QUErTWYsT0FBTyxPQUFQLEdBQWlCLFFBQWpCOzs7QUNsTkEsTUFBTSxTQUFTLFFBQVEsVUFBUixDQUFmO0FBQ0EsTUFBTSxTQUFTLFFBQVEsUUFBUixDQUFmO0FBQ0EsTUFBTSxPQUFPLEVBQWI7O0FBRUE7OztBQUdBLEtBQUssS0FBTCxHQUFhO0FBQ1osU0FBUTtBQUNQLFFBQU07QUFEQztBQURJLENBQWI7O0FBTUE7OztBQUdBLEtBQUssSUFBTCxHQUFZLFVBQVUsUUFBVixFQUFvQjs7QUFFL0I7QUFDQSxPQUFNLFNBQVMsSUFBSSxNQUFNLFVBQVYsRUFBZjs7QUFFQTtBQUNBLE9BQU0sV0FBWSxJQUFELElBQVU7O0FBRTFCLFNBQU8sS0FBSyxRQUFMLEtBQWtCLFNBQWxCLElBQStCLEtBQUssU0FBTCxLQUFtQixTQUF6RDtBQUVBLEVBSkQ7O0FBTUE7QUFDQSxNQUFLLElBQUksQ0FBVCxJQUFjLEtBQUssS0FBbkIsRUFBMEI7O0FBRXpCLE1BQUksT0FBTyxLQUFLLEtBQUwsQ0FBVyxDQUFYLENBQVg7O0FBRUEsTUFBSSxDQUFFLFNBQVMsSUFBVCxDQUFOLEVBQXNCOztBQUVyQixVQUFPLElBQVAsQ0FBWSxLQUFLLElBQWpCLEVBQXVCLENBQUMsUUFBRCxFQUFXLFNBQVgsS0FBeUI7O0FBRS9DLFNBQUssUUFBTCxHQUFnQixRQUFoQjtBQUNBLFNBQUssU0FBTCxHQUFpQixTQUFqQjs7QUFFQSxZQUFRLElBQVIsQ0FBYyxXQUFVLEtBQUssSUFBSyxFQUFsQzs7QUFFQSxRQUFJLFlBQVksSUFBaEI7O0FBRUEsU0FBSyxJQUFJLEVBQVQsSUFBZSxLQUFLLEtBQXBCLEVBQTJCOztBQUUxQixpQkFBWSxhQUFhLFNBQVMsS0FBSyxLQUFMLENBQVcsRUFBWCxDQUFULENBQXpCO0FBRUE7O0FBRUQsUUFBSSxTQUFKLEVBQWU7QUFFZixJQWpCRDtBQW1CQTtBQUVEO0FBRUQsQ0ExQ0Q7O0FBNENBOzs7QUFHQSxLQUFLLFdBQUwsR0FBbUIsWUFBWTs7QUFFOUI7QUFDQTtBQUNBO0FBQ0EsTUFBSyxNQUFMLEdBQWMsT0FBTyxXQUFyQjtBQUNBLE1BQUssS0FBTCxHQUFhLE9BQU8sVUFBcEI7O0FBRUE7QUFDQSxNQUFLLEtBQUwsR0FBYSxJQUFJLE1BQU0sS0FBVixFQUFiOztBQUVBO0FBQ0EsTUFBSyxNQUFMLEdBQWMsSUFBSSxNQUFKLENBQVcsU0FBWCxDQUFkOztBQUVBO0FBQ0EsTUFBSyxHQUFMLEdBQVcsSUFBSSxJQUFJLEdBQVIsRUFBWDs7QUFFQTtBQUNBLE9BQU0sV0FBVyxRQUFRLG9CQUFSLENBQWpCO0FBQ0EsTUFBSyxRQUFMLEdBQWdCLElBQUksUUFBSixFQUFoQjs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxPQUFNLFdBQVcsS0FBSyxRQUFMLEdBQWdCLElBQUksTUFBTSxhQUFWLENBQXdCO0FBQ3hEO0FBQ0E7QUFDQSxTQUFPLElBSGlEOztBQUt4RDtBQUNBO0FBQ0EsYUFBVztBQVA2QyxFQUF4QixDQUFqQzs7QUFVQTtBQUNBO0FBQ0EsVUFBUyxPQUFULENBQWlCLEtBQUssS0FBdEIsRUFBNkIsS0FBSyxNQUFsQzs7QUFFQTtBQUNBLFVBQVMsU0FBVCxDQUFtQixPQUFuQixHQUE2QixJQUE3QjtBQUNBLFVBQVMsU0FBVCxDQUFtQixJQUFuQixHQUEwQixNQUFNLGdCQUFoQzs7QUFFQTtBQUNBO0FBQ0EsT0FBTSxZQUFZLFNBQVMsYUFBVCxDQUF1QixNQUF2QixDQUFsQjtBQUNBLFdBQVUsV0FBVixDQUFzQixTQUFTLFVBQS9COztBQUVBO0FBQ0E7QUFDQSxRQUFPLGdCQUFQLENBQXdCLFFBQXhCLEVBQWtDLE1BQU07O0FBRXZDLE9BQUssTUFBTCxHQUFjLE9BQU8sV0FBckI7QUFDQSxPQUFLLEtBQUwsR0FBYSxPQUFPLFVBQXBCOztBQUVBLFdBQVMsT0FBVCxDQUFpQixLQUFLLEtBQXRCLEVBQTZCLEtBQUssTUFBbEM7O0FBRUEsT0FBSyxNQUFMLENBQVksTUFBWixHQUFxQixLQUFLLEtBQUwsR0FBYSxLQUFLLE1BQXZDO0FBQ0EsT0FBSyxNQUFMLENBQVksc0JBQVo7QUFFQSxFQVZELEVBVUcsS0FWSDtBQVlBLENBL0REOztBQWlFQTs7O0FBR0EsS0FBSyxZQUFMLEdBQW9CLFlBQVk7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBLE9BQU0sa0JBQWtCLElBQUksTUFBTSxlQUFWLENBQ3ZCLElBQUksTUFBTSxLQUFWLENBQWdCLFNBQWhCLENBRHVCLEVBRXZCLElBQUksTUFBTSxLQUFWLENBQWdCLFNBQWhCLENBRnVCLEVBR3ZCLENBSHVCLENBQXhCOztBQU9BO0FBQ0E7QUFDQSxPQUFNLGNBQWMsSUFBSSxNQUFNLGdCQUFWLENBQTJCLFFBQTNCLEVBQXFDLEdBQXJDLENBQXBCOztBQUVBO0FBQ0EsYUFBWSxRQUFaLENBQXFCLEdBQXJCLENBQXlCLENBQXpCLEVBQTRCLENBQTVCLEVBQStCLEVBQS9COztBQUVBO0FBQ0EsYUFBWSxVQUFaLEdBQXlCLElBQXpCO0FBQ0E7O0FBRUE7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsSUFBMUIsR0FBaUMsQ0FBQyxFQUFsQztBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixLQUExQixHQUFrQyxFQUFsQztBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixHQUExQixHQUFnQyxFQUFoQztBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixNQUExQixHQUFtQyxDQUFDLEVBQXBDO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLElBQTFCLEdBQWlDLENBQWpDO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLEdBQTFCLEdBQWdDLElBQWhDOztBQUVBO0FBQ0E7QUFDQSxhQUFZLE1BQVosQ0FBbUIsT0FBbkIsQ0FBMkIsS0FBM0IsR0FBbUMsSUFBbkM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsT0FBbkIsQ0FBMkIsTUFBM0IsR0FBb0MsSUFBcEM7QUFDQSxNQUFLLFdBQUwsR0FBbUIsV0FBbkI7O0FBRUEsTUFBSyxLQUFMLENBQVcsR0FBWCxDQUFlLFdBQWY7QUFDQSxNQUFLLEtBQUwsQ0FBVyxHQUFYLENBQWUsZUFBZjtBQUNBLENBdkNEOztBQXlDQTs7O0FBR0EsS0FBSyxhQUFMLEdBQXFCLFlBQVk7O0FBRWhDLE9BQU0sU0FBUyxRQUFRLGFBQVIsQ0FBZjtBQUNBLE9BQU0sU0FBUyxRQUFRLGFBQVIsQ0FBZjtBQUNBLE9BQU0sU0FBUyxRQUFRLGFBQVIsQ0FBZjs7QUFFQSxNQUFLLE1BQUwsR0FBYyxJQUFJLE1BQUosRUFBZDtBQUNBLE1BQUssTUFBTCxHQUFjLElBQUksTUFBSixFQUFkOztBQUVBO0FBQ0EsTUFBSyxNQUFMLEdBQWMsSUFBSSxNQUFKLEVBQWQ7QUFFQSxDQVpEOztBQWNBLEtBQUssSUFBTCxHQUFZLFVBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsS0FBaEIsRUFBdUIsU0FBUyxLQUFoQyxFQUF1Qzs7QUFFbEQsU0FBUSxJQUFJLE1BQU0sS0FBVixDQUFnQixTQUFVLE9BQU0sS0FBSyxNQUFMLENBQVksT0FBWixDQUFvQixFQUFDLEtBQUssQ0FBTixFQUFTLEtBQUssR0FBZCxFQUFwQixDQUF3QyxjQUF4RSxDQUFSOztBQUVBLEtBQUksUUFBSjs7QUFFQSxLQUFJLE1BQUosRUFBWTtBQUNYLGFBQVcsTUFBTSxrQkFBTixDQUF5QjtBQUNuQyxVQUFPLEtBRDRCO0FBRW5DLGFBQVUsQ0FGeUI7QUFHbkMsWUFBUztBQUgwQixHQUF6QixDQUFYO0FBS0EsRUFORCxNQVFLO0FBQ0osYUFBVyxJQUFJLE1BQU0saUJBQVYsQ0FBNEI7QUFDdEMsVUFBTztBQUQrQixHQUE1QixDQUFYO0FBR0E7O0FBRUUsS0FBSSxXQUFXLElBQUksTUFBTSxRQUFWLEVBQWY7QUFDQSxVQUFTLFFBQVQsQ0FBa0IsSUFBbEIsQ0FBdUIsQ0FBdkI7QUFDQSxVQUFTLFFBQVQsQ0FBa0IsSUFBbEIsQ0FBdUIsQ0FBdkI7O0FBRUEsT0FBTSxPQUFPLElBQUksTUFBTSxJQUFWLENBQWUsUUFBZixFQUF5QixRQUF6QixDQUFiO0FBQ0EsTUFBSyxJQUFMLEdBQVksVUFBVSxLQUFLLE1BQUwsQ0FBWSxNQUFaLEVBQXRCOztBQUVBLFFBQU8sSUFBUDtBQUVILENBN0JEOztBQStCQTs7O0FBR0EsTUFBTSxRQUFRO0FBQ2IsUUFBTyxDQURNO0FBRWIsT0FBTTtBQUZPLENBQWQ7O0FBS0EsS0FBSyxJQUFMLEdBQVksVUFBVSxPQUFPLENBQWpCLEVBQW9COztBQUUvQixTQUFRLElBQVI7O0FBRUEsT0FBTSxLQUFOLEdBQWMsT0FBTyxNQUFNLElBQTNCO0FBQ0EsT0FBTSxJQUFOLEdBQWEsSUFBYjs7QUFFQTtBQUNBLE1BQUssUUFBTCxDQUFjLE1BQWQsQ0FBcUIsS0FBckI7O0FBRUE7QUFDQSxNQUFLLEtBQUwsQ0FBVyxlQUFYLENBQTRCLEtBQUQsSUFBVzs7QUFFckMsTUFBSSxNQUFNLElBQU4sSUFBYyxNQUFNLElBQU4sQ0FBVyxLQUFYLENBQWlCLE9BQWpCLENBQWxCLEVBQTZDO0FBQzVDLFNBQU0sUUFBTixDQUFlLGtCQUFmLEdBQW9DLElBQXBDO0FBQ0E7O0FBRUQsUUFBTSxNQUFOLElBQWdCLE1BQU0sTUFBTixDQUFhLEtBQWIsQ0FBaEI7QUFFQSxFQVJEOztBQVVBO0FBQ0EsTUFBSyxNQUFMLENBQVksTUFBWixDQUFtQixLQUFuQjs7QUFFQTtBQUNBLE1BQUssUUFBTCxDQUFjLE1BQWQsQ0FBcUIsS0FBSyxLQUExQixFQUFpQyxLQUFLLE1BQXRDOztBQUVBO0FBQ0EsUUFBTyxxQkFBUCxDQUE2QixLQUFLLElBQUwsQ0FBVSxJQUFWLENBQWUsSUFBZixDQUE3QjtBQUNBLENBN0JEOztBQWlDQSxPQUFPLE9BQVAsR0FBaUIsSUFBakI7OztBQ3JRQSxNQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7O0FBRUE7OztBQUdBLE1BQU0sTUFBTixTQUFxQixNQUFNLElBQTNCLENBQWdDOztBQUUvQjs7O0FBR0EsZUFBYzs7QUFFYjs7QUFFQSxPQUFLLElBQUwsR0FBWSxRQUFaOztBQUVBLE9BQUssUUFBTCxHQUFnQixJQUFJLE1BQU0sYUFBVixDQUF3QixFQUF4QixFQUE0QixFQUE1QixDQUFoQjs7QUFFQSxPQUFLLFFBQUwsR0FBZ0IsSUFBSSxNQUFNLG1CQUFWLENBQThCO0FBQzdDLFVBQU8sSUFBSSxNQUFNLEtBQVYsQ0FBZ0IsU0FBaEIsQ0FEc0M7QUFFN0MsU0FBTSxNQUFNO0FBRmlDLEdBQTlCLENBQWhCOztBQUtBLE9BQUssVUFBTCxHQUFrQixLQUFsQjtBQUNBLE9BQUssYUFBTCxHQUFxQixJQUFyQjs7QUFFQSxPQUFLLEtBQUwsQ0FBVyxHQUFYLENBQWUsSUFBZjtBQUVBOztBQUVEOzs7QUFHQSxRQUFPLEtBQVAsRUFBYyxJQUFkLEVBQW9CLENBRW5COztBQTlCOEI7O0FBa0NoQyxPQUFPLE9BQVAsR0FBaUIsTUFBakI7OztBQ3ZDQSxNQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxNQUFNLEtBQUssS0FBSyxFQUFoQjs7QUFFQTs7O0FBR0EsTUFBTSxNQUFOLFNBQXFCLE1BQU0sV0FBM0IsQ0FBdUM7O0FBRXRDOzs7QUFHQSxlQUFjOztBQUViLFFBQU0sV0FBVyxLQUFLLEtBQUwsQ0FBVyxNQUFYLENBQWtCLFFBQW5DOztBQUVBLFFBQU0sWUFBWSxLQUFLLEtBQUwsQ0FBVyxNQUFYLENBQWtCLFNBQXBDO0FBQ0EsUUFBTSxXQUFXLElBQUksTUFBTSxtQkFBVixDQUE4QjtBQUM5QyxVQUFPLElBQUksTUFBTSxLQUFWLENBQWdCLFNBQWhCLENBRHVDO0FBRTlDLGFBQVU7QUFGb0MsR0FBOUIsQ0FBakI7O0FBS0EsUUFBTSxRQUFOLEVBQWdCLFFBQWhCOztBQUVBLE9BQUssSUFBTCxHQUFZLFFBQVo7O0FBRUEsT0FBSyxVQUFMLEdBQWtCLElBQWxCO0FBQ0EsT0FBSyxhQUFMLEdBQXFCLEtBQXJCOztBQUVBO0FBQ0EsT0FBSyxLQUFMLEdBQWEsSUFBSSxNQUFNLGNBQVYsQ0FBeUIsSUFBekIsQ0FBYjs7QUFFQTtBQUNBLE9BQUssUUFBTCxHQUFnQixJQUFJLE1BQU0sT0FBVixDQUFrQixDQUFsQixFQUFxQixDQUFyQixFQUF3QixDQUF4QixDQUFoQjs7QUFFQTtBQUNBLE9BQUssV0FBTCxHQUFtQixHQUFuQjs7QUFFQTtBQUNBLE9BQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsS0FBSyxFQUFMLEdBQVUsQ0FBaEM7QUFDQSxPQUFLLFFBQUwsQ0FBYyxrQkFBZDtBQUNBLE9BQUssUUFBTCxDQUFjLG9CQUFkO0FBQ0EsT0FBSyxRQUFMLENBQWMsbUJBQWQ7O0FBRUE7QUFDQSxPQUFLLE9BQUwsR0FBZSxFQUFmOztBQUVBLE9BQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxLQUFLLFFBQUwsQ0FBYyxVQUFkLENBQXlCLE1BQTdDLEVBQXFELEdBQXJELEVBQTBEOztBQUV6RCxTQUFNLE9BQU8sS0FBSyxRQUFMLENBQWMsVUFBZCxDQUF5QixDQUF6QixDQUFiO0FBQ0EsU0FBTSxTQUFTLEtBQUssS0FBTCxDQUFXLFVBQVgsQ0FBc0IsSUFBdEIsQ0FBZjs7QUFFQSxVQUFPLGtCQUFQLENBQTBCLENBQTFCLEVBQTZCLElBQTdCOztBQUVBLFFBQUssT0FBTCxDQUFhLEtBQUssSUFBbEIsSUFBMEIsTUFBMUI7O0FBRUEsV0FBUSxHQUFSLENBQVksTUFBWjtBQUVBOztBQUdELE9BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxJQUFmO0FBQ0E7O0FBRUQ7OztBQUdBLFFBQU8sS0FBUCxFQUFjOztBQUViO0FBQ0EsUUFBTSxVQUFVLElBQUksTUFBTSxPQUFWLENBQ2YsQ0FBQyxLQUFLLFFBQUwsQ0FBYyxTQURBLEVBRWYsQ0FBQyxLQUFLLFFBQUwsQ0FBYyxTQUZBLENBQWhCOztBQUtBO0FBQ0EsUUFBTSxRQUFRLFFBQVEsTUFBUixFQUFkOztBQUVBO0FBQ0EsT0FBSyxRQUFMLENBQWMsQ0FBZCxJQUFtQixDQUFDLFFBQVEsQ0FBUixHQUFZLEtBQUssUUFBTCxDQUFjLENBQTNCLElBQWdDLEdBQWhDLEdBQXNDLE1BQU0sS0FBL0Q7QUFDQSxPQUFLLFFBQUwsQ0FBYyxDQUFkLElBQW1CLENBQUMsUUFBUSxDQUFSLEdBQVksS0FBSyxRQUFMLENBQWMsQ0FBM0IsSUFBZ0MsR0FBaEMsR0FBc0MsTUFBTSxLQUEvRDs7QUFFQTtBQUNBLE1BQUksUUFBUSxDQUFaLEVBQWUsS0FBSyxRQUFMLENBQWMsY0FBZCxDQUE2QixLQUE3Qjs7QUFFZjtBQUNBLE9BQUssUUFBTCxDQUFjLFdBQWQsQ0FBMEIsQ0FBQyxLQUFLLFdBQWhDLEVBQTZDLENBQUMsS0FBSyxXQUFuRDs7QUFFQTtBQUNBLE9BQUssUUFBTCxDQUFjLEdBQWQsQ0FBa0IsS0FBSyxRQUF2Qjs7QUFHQTtBQUNBLFFBQU0saUJBQWlCLEtBQUssS0FBTCxDQUFXLEtBQUssUUFBTCxDQUFjLENBQXpCLEVBQTRCLEtBQUssUUFBTCxDQUFjLENBQTFDLENBQXZCOztBQUVBO0FBQ0EsTUFBSSxPQUFPLGlCQUFpQixLQUFLLFFBQUwsQ0FBYyxDQUExQzs7QUFFQTtBQUNBLE1BQUksS0FBSyxHQUFMLENBQVMsSUFBVCxJQUFpQixLQUFLLEVBQTFCLEVBQThCOztBQUU3QixRQUFLLFFBQUwsQ0FBYyxDQUFkLElBQW1CLEtBQUssRUFBTCxHQUFVLENBQVYsR0FBYyxLQUFLLElBQUwsQ0FBVSxJQUFWLENBQWpDO0FBQ0EsVUFBTyxpQkFBaUIsS0FBSyxRQUFMLENBQWMsQ0FBdEM7QUFFQTs7QUFFRDtBQUNBLE9BQUssUUFBTCxDQUFjLENBQWQsSUFBbUIsT0FBTyxJQUFQLEdBQWMsTUFBTSxLQUF2Qzs7QUFFQTtBQUNBLE9BQUssS0FBTCxDQUFXLE1BQVgsQ0FBa0IsTUFBTSxLQUF4QjtBQUNBOztBQUVEOzs7QUFHQSxNQUFLLFFBQUwsRUFBZSxTQUFTLENBQXhCLEVBQTJCO0FBQzFCLFNBQU8sS0FBSyxLQUFMLENBQ0wsVUFESyxDQUNNLFFBRE4sRUFFTCxrQkFGSyxDQUVjLE1BRmQsRUFHTCxJQUhLLEVBQVA7QUFJQTs7QUFsSHFDOztBQXNIdkMsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7QUM1SEEsTUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiO0FBQ0EsTUFBTSxXQUFXLFFBQVEsWUFBUixDQUFqQjs7QUFFQTs7O0FBR0EsTUFBTSxlQUFOLFNBQThCLFFBQTlCLENBQXVDOztBQUV0QyxlQUFjOztBQUViOztBQUVBLE9BQUssR0FBTCxDQUFTLEdBQVQsQ0FBYSxJQUFiLEVBQW1CLFdBQW5CLEVBQWdDLENBQUMsQ0FBakMsRUFBb0MsQ0FBcEMsRUFBdUMsSUFBdkMsQ0FBNEMsSUFBNUMsRUFBa0QsTUFBbEQ7QUFDQSxPQUFLLEdBQUwsQ0FBUyxHQUFULENBQWEsSUFBYixFQUFtQixXQUFuQixFQUFnQyxDQUFDLENBQWpDLEVBQW9DLENBQXBDLEVBQXVDLElBQXZDLENBQTRDLElBQTVDLEVBQWtELE1BQWxEO0FBQ0EsT0FBSyxHQUFMLENBQVMsR0FBVCxDQUFhLElBQWIsRUFBbUIsWUFBbkIsRUFBaUMsTUFBakM7QUFFQTs7QUFFRCxLQUFJLFlBQUosR0FBbUI7O0FBRWxCLFNBQU8sS0FBSyxPQUFMLENBQ04sS0FBSyxPQUFMLENBQWEsTUFEUCxFQUVOO0FBQ0MsYUFBVSxHQURYO0FBRUMsYUFBVTtBQUZYLEdBRk0sQ0FBUDtBQVFBOztBQUVELEtBQUksU0FBSixHQUFnQjs7QUFFZixTQUFPLEtBQUssT0FBTCxDQUNOLEtBQUssT0FBTCxDQUFhLE1BRFAsRUFFTjtBQUNDLGFBQVUsR0FEWDtBQUVDLGFBQVU7QUFGWCxHQUZNLENBQVA7QUFRQTs7QUFFRCxLQUFJLFNBQUosR0FBZ0I7O0FBRWYsU0FBTyxLQUFLLE9BQUwsQ0FDTixLQUFLLE9BQUwsQ0FBYSxNQURQLEVBRU47QUFDQyxhQUFVLEdBRFg7QUFFQyxhQUFVO0FBRlgsR0FGTSxDQUFQO0FBUUE7O0FBOUNxQzs7QUFrRHZDLE9BQU8sT0FBUCxHQUFpQixlQUFqQjs7O0FDeERBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLE1BQU0sU0FBUyxRQUFRLFVBQVIsQ0FBZjs7QUFFQSxPQUFPLGdCQUFQLENBQXdCLE1BQXhCLEVBQWdDLFlBQVk7O0FBRTNDLE1BQUssSUFBTCxDQUFVLE1BQU07O0FBRWYsT0FBSyxXQUFMO0FBQ0EsT0FBSyxZQUFMO0FBQ0EsT0FBSyxhQUFMOztBQUVBLFVBQVEsR0FBUixDQUFZLElBQVo7O0FBRUEsU0FBTyxJQUFQLEdBQWMsSUFBZDs7QUFFQSxPQUFLLElBQUw7QUFFQSxFQVpEO0FBY0EsQ0FoQkQsRUFnQkcsS0FoQkg7Ozs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG52YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgbG9va3VwW2ldID0gY29kZVtpXVxuICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbn1cblxucmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG5yZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcblxuZnVuY3Rpb24gcGxhY2VIb2xkZXJzQ291bnQgKGI2NCkge1xuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcbiAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAvLyByZXByZXNlbnQgb25lIGJ5dGVcbiAgLy8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG4gIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgcmV0dXJuIGI2NFtsZW4gLSAyXSA9PT0gJz0nID8gMiA6IGI2NFtsZW4gLSAxXSA9PT0gJz0nID8gMSA6IDBcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoYjY0KSB7XG4gIC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuICByZXR1cm4gYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzQ291bnQoYjY0KVxufVxuXG5mdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG4gIHBsYWNlSG9sZGVycyA9IHBsYWNlSG9sZGVyc0NvdW50KGI2NClcblxuICBhcnIgPSBuZXcgQXJyKGxlbiAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBsZW4gLSA0IDogbGVuXG5cbiAgdmFyIEwgPSAwXG5cbiAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltMKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgb3V0cHV0ID0gJydcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDJdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz09J1xuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyAodWludDhbbGVuIC0gMV0pXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMTBdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPSdcbiAgfVxuXG4gIHBhcnRzLnB1c2gob3V0cHV0KVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbi8qXG4gKiBFeHBvcnQga01heExlbmd0aCBhZnRlciB0eXBlZCBhcnJheSBzdXBwb3J0IGlzIGRldGVybWluZWQuXG4gKi9cbmV4cG9ydHMua01heExlbmd0aCA9IGtNYXhMZW5ndGgoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLl9fcHJvdG9fXyA9IHtfX3Byb3RvX186IFVpbnQ4QXJyYXkucHJvdG90eXBlLCBmb286IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH19XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKGtNYXhMZW5ndGgoKSA8IGxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgaWYgKHRoYXQgPT09IG51bGwpIHtcbiAgICAgIHRoYXQgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgICB9XG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZnVuY3Rpb24gQnVmZmVyIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdJZiBlbmNvZGluZyBpcyBzcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZydcbiAgICAgIClcbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jVW5zYWZlKHRoaXMsIGFyZylcbiAgfVxuICByZXR1cm4gZnJvbSh0aGlzLCBhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb20gKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh0aGF0LCB2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbShudWxsLCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRTaXplIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfSBlbHNlIGlmIChzaXplIDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBuZWdhdGl2ZScpXG4gIH1cbn1cblxuZnVuY3Rpb24gYWxsb2MgKHRoYXQsIHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgaWYgKHNpemUgPD0gMCkge1xuICAgIHJldHVybiBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSlcbiAgfVxuICBpZiAoZmlsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gT25seSBwYXkgYXR0ZW50aW9uIHRvIGVuY29kaW5nIGlmIGl0J3MgYSBzdHJpbmcuIFRoaXNcbiAgICAvLyBwcmV2ZW50cyBhY2NpZGVudGFsbHkgc2VuZGluZyBpbiBhIG51bWJlciB0aGF0IHdvdWxkXG4gICAgLy8gYmUgaW50ZXJwcmV0dGVkIGFzIGEgc3RhcnQgb2Zmc2V0LlxuICAgIHJldHVybiB0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnXG4gICAgICA/IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKS5maWxsKGZpbGwsIGVuY29kaW5nKVxuICAgICAgOiBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSkuZmlsbChmaWxsKVxuICB9XG4gIHJldHVybiBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSlcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiBhbGxvYyhzaXplWywgZmlsbFssIGVuY29kaW5nXV0pXG4gKiovXG5CdWZmZXIuYWxsb2MgPSBmdW5jdGlvbiAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGFsbG9jKG51bGwsIHNpemUsIGZpbGwsIGVuY29kaW5nKVxufVxuXG5mdW5jdGlvbiBhbGxvY1Vuc2FmZSAodGhhdCwgc2l6ZSkge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSA8IDAgPyAwIDogY2hlY2tlZChzaXplKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNpemU7ICsraSkge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIEJ1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShudWxsLCBzaXplKVxufVxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIFNsb3dCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShudWxsLCBzaXplKVxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiZW5jb2RpbmdcIiBtdXN0IGJlIGEgdmFsaWQgc3RyaW5nIGVuY29kaW5nJylcbiAgfVxuXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIGxlbmd0aClcblxuICB2YXIgYWN0dWFsID0gdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuXG4gIGlmIChhY3R1YWwgIT09IGxlbmd0aCkge1xuICAgIC8vIFdyaXRpbmcgYSBoZXggc3RyaW5nLCBmb3IgZXhhbXBsZSwgdGhhdCBjb250YWlucyBpbnZhbGlkIGNoYXJhY3RlcnMgd2lsbFxuICAgIC8vIGNhdXNlIGV2ZXJ5dGhpbmcgYWZ0ZXIgdGhlIGZpcnN0IGludmFsaWQgY2hhcmFjdGVyIHRvIGJlIGlnbm9yZWQuIChlLmcuXG4gICAgLy8gJ2FieHhjZCcgd2lsbCBiZSB0cmVhdGVkIGFzICdhYicpXG4gICAgdGhhdCA9IHRoYXQuc2xpY2UoMCwgYWN0dWFsKVxuICB9XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnb2Zmc2V0XFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcXCdsZW5ndGhcXCcgaXMgb3V0IG9mIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYnl0ZU9mZnNldCA9PT0gdW5kZWZpbmVkICYmIGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQpXG4gIH0gZWxzZSB7XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IGFycmF5XG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tQXJyYXlMaWtlKHRoYXQsIGFycmF5KVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIGxlbilcblxuICAgIGlmICh0aGF0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoYXRcbiAgICB9XG5cbiAgICBvYmouY29weSh0aGF0LCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIHRoYXRcbiAgfVxuXG4gIGlmIChvYmopIHtcbiAgICBpZiAoKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB8fCAnbGVuZ3RoJyBpbiBvYmopIHtcbiAgICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgaXNuYW4ob2JqLmxlbmd0aCkpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCAwKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqKVxuICAgIH1cblxuICAgIGlmIChvYmoudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmouZGF0YSkpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iai5kYXRhKVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCBvciBhcnJheS1saWtlIG9iamVjdC4nKVxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aCgpYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAobGVuZ3RoKSB7XG4gIGlmICgrbGVuZ3RoICE9IGxlbmd0aCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxuICAgIGxlbmd0aCA9IDBcbiAgfVxuICByZXR1cm4gQnVmZmVyLmFsbG9jKCtsZW5ndGgpXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBCdWZmZXIuYWxsb2MoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGJ1ZiA9IGxpc3RbaV1cbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICAgIH1cbiAgICBidWYuY29weShidWZmZXIsIHBvcylcbiAgICBwb3MgKz0gYnVmLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZmZXJcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBBcnJheUJ1ZmZlci5pc1ZpZXcgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIChBcnJheUJ1ZmZlci5pc1ZpZXcoc3RyaW5nKSB8fCBzdHJpbmcgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcbiAgICByZXR1cm4gc3RyaW5nLmJ5dGVMZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICBzdHJpbmcgPSAnJyArIHN0cmluZ1xuICB9XG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgLy8gTm8gbmVlZCB0byB2ZXJpZnkgdGhhdCBcInRoaXMubGVuZ3RoIDw9IE1BWF9VSU5UMzJcIiBzaW5jZSBpdCdzIGEgcmVhZC1vbmx5XG4gIC8vIHByb3BlcnR5IG9mIGEgdHlwZWQgYXJyYXkuXG5cbiAgLy8gVGhpcyBiZWhhdmVzIG5laXRoZXIgbGlrZSBTdHJpbmcgbm9yIFVpbnQ4QXJyYXkgaW4gdGhhdCB3ZSBzZXQgc3RhcnQvZW5kXG4gIC8vIHRvIHRoZWlyIHVwcGVyL2xvd2VyIGJvdW5kcyBpZiB0aGUgdmFsdWUgcGFzc2VkIGlzIG91dCBvZiByYW5nZS5cbiAgLy8gdW5kZWZpbmVkIGlzIGhhbmRsZWQgc3BlY2lhbGx5IGFzIHBlciBFQ01BLTI2MiA2dGggRWRpdGlvbixcbiAgLy8gU2VjdGlvbiAxMy4zLjMuNyBSdW50aW1lIFNlbWFudGljczogS2V5ZWRCaW5kaW5nSW5pdGlhbGl6YXRpb24uXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIC8vIFJldHVybiBlYXJseSBpZiBzdGFydCA+IHRoaXMubGVuZ3RoLiBEb25lIGhlcmUgdG8gcHJldmVudCBwb3RlbnRpYWwgdWludDMyXG4gIC8vIGNvZXJjaW9uIGZhaWwgYmVsb3cuXG4gIGlmIChzdGFydCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKGVuZCA8PSAwKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICAvLyBGb3JjZSBjb2Vyc2lvbiB0byB1aW50MzIuIFRoaXMgd2lsbCBhbHNvIGNvZXJjZSBmYWxzZXkvTmFOIHZhbHVlcyB0byAwLlxuICBlbmQgPj4+PSAwXG4gIHN0YXJ0ID4+Pj0gMFxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5mdW5jdGlvbiBzd2FwIChiLCBuLCBtKSB7XG4gIHZhciBpID0gYltuXVxuICBiW25dID0gYlttXVxuICBiW21dID0gaVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAxNiA9IGZ1bmN0aW9uIHN3YXAxNiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgMiAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMTYtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDEpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMzIgPSBmdW5jdGlvbiBzd2FwMzIgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDMyLWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAzKVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyAyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDY0ID0gZnVuY3Rpb24gc3dhcDY0ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA4ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA2NC1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA4KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgNylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgNilcbiAgICBzd2FwKHRoaXMsIGkgKyAyLCBpICsgNSlcbiAgICBzd2FwKHRoaXMsIGkgKyAzLCBpICsgNClcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAodGFyZ2V0LCBzdGFydCwgZW5kLCB0aGlzU3RhcnQsIHRoaXNFbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbi8vIEZpbmRzIGVpdGhlciB0aGUgZmlyc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0ID49IGBieXRlT2Zmc2V0YCxcbi8vIE9SIHRoZSBsYXN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA8PSBgYnl0ZU9mZnNldGAuXG4vL1xuLy8gQXJndW1lbnRzOlxuLy8gLSBidWZmZXIgLSBhIEJ1ZmZlciB0byBzZWFyY2hcbi8vIC0gdmFsIC0gYSBzdHJpbmcsIEJ1ZmZlciwgb3IgbnVtYmVyXG4vLyAtIGJ5dGVPZmZzZXQgLSBhbiBpbmRleCBpbnRvIGBidWZmZXJgOyB3aWxsIGJlIGNsYW1wZWQgdG8gYW4gaW50MzJcbi8vIC0gZW5jb2RpbmcgLSBhbiBvcHRpb25hbCBlbmNvZGluZywgcmVsZXZhbnQgaXMgdmFsIGlzIGEgc3RyaW5nXG4vLyAtIGRpciAtIHRydWUgZm9yIGluZGV4T2YsIGZhbHNlIGZvciBsYXN0SW5kZXhPZlxuZnVuY3Rpb24gYmlkaXJlY3Rpb25hbEluZGV4T2YgKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIC8vIEVtcHR5IGJ1ZmZlciBtZWFucyBubyBtYXRjaFxuICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXRcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPSArYnl0ZU9mZnNldCAgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKGlzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiZcbiAgICAgICAgdHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSByZXR1cm4gaVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gbGF0aW4xV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdCdWZmZXIud3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0WywgbGVuZ3RoXSkgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZCdcbiAgICApXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGxhdGluMVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyArK2kpIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7ICsraSkge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyArK2kpIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gVXNhZ2U6XG4vLyAgICBidWZmZXIuZmlsbChudW1iZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKGJ1ZmZlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoc3RyaW5nWywgb2Zmc2V0WywgZW5kXV1bLCBlbmNvZGluZ10pXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWwsIHN0YXJ0LCBlbmQsIGVuY29kaW5nKSB7XG4gIC8vIEhhbmRsZSBzdHJpbmcgY2FzZXM6XG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IHN0YXJ0XG4gICAgICBzdGFydCA9IDBcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZW5kID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBlbmRcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfVxuICAgIGlmICh2YWwubGVuZ3RoID09PSAxKSB7XG4gICAgICB2YXIgY29kZSA9IHZhbC5jaGFyQ29kZUF0KDApXG4gICAgICBpZiAoY29kZSA8IDI1Nikge1xuICAgICAgICB2YWwgPSBjb2RlXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuY29kaW5nIG11c3QgYmUgYSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJyAmJiAhQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMjU1XG4gIH1cblxuICAvLyBJbnZhbGlkIHJhbmdlcyBhcmUgbm90IHNldCB0byBhIGRlZmF1bHQsIHNvIGNhbiByYW5nZSBjaGVjayBlYXJseS5cbiAgaWYgKHN0YXJ0IDwgMCB8fCB0aGlzLmxlbmd0aCA8IHN0YXJ0IHx8IHRoaXMubGVuZ3RoIDwgZW5kKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghdmFsKSB2YWwgPSAwXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgdGhpc1tpXSA9IHZhbFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuaXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogdXRmOFRvQnl0ZXMobmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSAwOyBpIDwgZW5kIC0gc3RhcnQ7ICsraSkge1xuICAgICAgdGhpc1tpICsgc3RhcnRdID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBpc25hbiAodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IHZhbCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsImNvbnN0IGdhbWUgPSByZXF1aXJlKCcuL2dhbWUnKVxyXG5cclxuY2xhc3MgQ2FtZXJhIGV4dGVuZHMgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEge1xyXG5cdFxyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHRjb25zdCBhc3BlY3RSYXRpbyA9IGdhbWUud2lkdGggLyBnYW1lLmhlaWdodFxyXG5cdFx0Y29uc3QgZmllbGRPZlZpZXcgPSA0MFxyXG5cdFx0Y29uc3QgbmVhclBsYW5lID0gMVxyXG5cdFx0Y29uc3QgZmFyUGxhbmUgPSAxMDAwMFxyXG5cdFx0XHJcblx0XHRzdXBlcihcclxuXHRcdFx0ZmllbGRPZlZpZXcsXHJcblx0XHRcdGFzcGVjdFJhdGlvLFxyXG5cdFx0XHRuZWFyUGxhbmUsXHJcblx0XHRcdGZhclBsYW5lXHJcblx0XHQpXHJcblx0XHRcclxuXHRcdGdhbWUuc2NlbmUuYWRkKHRoaXMpXHJcblx0XHRcclxuXHRcdC8vIFJlZMOpZmluaXIgbGUgaGF1dFxyXG5cdFx0dGhpcy51cC5jb3B5KG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpKVxyXG5cdFx0XHJcblx0XHQvLyBQb3NpdGlvbiBkZSBsYSBjYW3DqXJhIHBhciByYXBwb3J0IGF1IGpvdWV1clxyXG5cdFx0dGhpcy5kaXN0YW5jZVRvUGxheWVyID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMTAsIDUpXHJcblxyXG5cdH1cclxuXHRcclxuXHR1cGRhdGUoZXZlbnQpIHtcclxuXHRcdFxyXG5cdFx0Ly8gQWRvdWNpc3NlbWVudCBkdSBkw6lwbGFjZW1lbnQgZGUgbGEgY2Ftw6lyYVxyXG5cdFx0Y29uc3Qgc3BlZWQgPSAwLjVcclxuXHRcdGNvbnN0IHRhcmdldCA9IGdhbWUucGxheWVyLnBvc2l0aW9uLmNsb25lKCkuYWRkKHRoaXMuZGlzdGFuY2VUb1BsYXllcilcclxuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvblxyXG5cdFx0XHJcblx0XHRwb3NpdGlvbi54ICs9ICh0YXJnZXQueCAtIHBvc2l0aW9uLngpIC8gc3BlZWQgKiBldmVudC5kZWx0YVxyXG5cdFx0cG9zaXRpb24ueSArPSAodGFyZ2V0LnkgLSBwb3NpdGlvbi55KSAvIHNwZWVkICogZXZlbnQuZGVsdGFcclxuXHRcdHBvc2l0aW9uLnogKz0gKHRhcmdldC56IC0gcG9zaXRpb24ueikgLyBzcGVlZCAqIGV2ZW50LmRlbHRhXHJcblx0XHRcclxuXHRcdC8vIFJlZ2FyZGVyIGxlIGpvdWV1clxyXG5cdFx0dGhpcy5sb29rQXQoZ2FtZS5wbGF5ZXIuZ2V0V29ybGRQb3NpdGlvbigpKVxyXG5cdFx0XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENhbWVyYSIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdHJlZDogMHhmMjUzNDYsXHJcblx0d2hpdGU6IDB4ZDhkMGQxLFxyXG5cdGJyb3duOiAweDU5MzMyZSxcclxuXHRwaW5rOiAweEY1OTg2RSxcclxuXHRicm93bkRhcms6IDB4MjMxOTBmLFxyXG5cdGJsdWU6IDB4NjhjM2MwLFxyXG59OyIsIi8qKlxyXG4gKiBHw6hyZSBsZXMgY29udHLDtGxlcyAoY2xhdmllci9zb3VyaXMgZXQgbWFuZXR0ZSkgZHUgam91ZXVyXHJcbiAqL1xyXG5jbGFzcyBDb250cm9scyB7XHJcblx0XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRcclxuXHRcdHRoaXMuZ2FtZXBhZCA9IG51bGxcclxuXHRcdHRoaXMuZGVhZHpvbmUgPSAwLjJcclxuXHRcdFxyXG5cdFx0Ly8gQ29udHLDtGxldXIgYWN0dWVsbGVtZW50IHV0aWxpc8OpICgnZ2FtZXBhZCcgb3UgJ2tleWJvYXJkJylcclxuXHRcdHRoaXMuY29udHJvbGxlciA9ICdrZXlib2FyZCdcclxuXHRcdFxyXG5cdFx0Ly8gVmFsZXVycyBzYXV2ZWdhcmTDqWVzXHJcblx0XHR0aGlzLnZhbHVlcyA9IHtcclxuXHRcdFx0a2V5Ym9hcmQ6IHt9LFxyXG5cdFx0XHRnYW1lcGFkOiBudWxsXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdC8vIFZhbGV1cnMgcHLDqWPDqWRlbnRlc1xyXG5cdFx0dGhpcy5wcmV2aW91cyA9IHtcclxuXHRcdFx0a2V5Ym9hcmQ6IHt9LFxyXG5cdFx0XHRnYW1lcGFkOiBudWxsXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdC8vIENvbnN0YW50ZXNcclxuXHRcdHRoaXMuR0FNRVBBRCA9IHtcclxuXHRcdFx0QTogMCxcclxuXHRcdFx0QjogMSxcclxuXHRcdFx0WDogMixcclxuXHRcdFx0WTogMyxcclxuXHRcdFx0TEI6IDQsXHJcblx0XHRcdFJCOiA1LFxyXG5cdFx0XHRMVDogNixcclxuXHRcdFx0UlQ6IDcsXHJcblx0XHRcdEJBQ0s6IDgsXHJcblx0XHRcdFNUQVJUOiA5LFxyXG5cdFx0XHRVUDogMTIsXHJcblx0XHRcdERPV046IDEzLFxyXG5cdFx0XHRMRUZUOiAxNCxcclxuXHRcdFx0UklHSFQ6IDE1LFxyXG5cdFx0XHRcclxuXHRcdFx0TEVGVF9YOiAwLFxyXG5cdFx0XHRMRUZUX1k6IDEsXHJcblx0XHRcdFJJR0hUX1g6IDIsXHJcblx0XHRcdFJJR0hUX1k6IDNcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBCcmFuY2hlbWVudCBkJ3VuZSBtYW5ldHRlXHJcblx0XHQgKi9cclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiZ2FtZXBhZGNvbm5lY3RlZFwiLCAoZXZlbnQpID0+IHtcclxuXHRcdFx0XHJcblx0XHRcdGxldCBncCA9IGV2ZW50LmdhbWVwYWRcclxuXHRcdFx0XHJcblx0XHRcdGNvbnNvbGUubG9nKFwiQ29udHLDtGxldXIgbsKwJWQgY29ubmVjdMOpIDogJXMuICVkIGJvdXRvbnMsICVkIGF4ZXMuXCIsXHJcblx0XHRcdFx0Z3AuaW5kZXgsIGdwLmlkLFxyXG5cdFx0XHRcdGdwLmJ1dHRvbnMubGVuZ3RoLCBncC5heGVzLmxlbmd0aClcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuZ2FtZXBhZCA9IGdwXHJcblx0XHRcdHRoaXMuY29udHJvbGxlciA9ICdnYW1lcGFkJ1xyXG5cclxuXHRcdH0pXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwdWkgc3VyIHVuZSB0b3VjaGVcclxuXHRcdCAqL1xyXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4ge1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy52YWx1ZXMua2V5Ym9hcmRbZXZlbnQua2V5XSA9IHRydWVcclxuXHRcdFx0dGhpcy5jb250cm9sbGVyID0gJ2tleWJvYXJkJ1xyXG5cdFx0XHRcclxuXHRcdH0pXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwdWkgc3VyIHVuZSB0b3VjaGVcclxuXHRcdCAqL1xyXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMudmFsdWVzLmtleWJvYXJkW2V2ZW50LmtleV0gPSBmYWxzZVxyXG5cdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAna2V5Ym9hcmQnXHJcblx0XHRcdFxyXG5cdFx0fSlcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBNaXNlIMOgIGpvdXJcclxuXHQgKi9cclxuXHR1cGRhdGUoZXZlbnQpIHtcclxuXHRcdFxyXG5cdFx0bGV0IGdhbWVwYWRzID0gbmF2aWdhdG9yLmdldEdhbWVwYWRzKClcclxuXHRcdHRoaXMuZ2FtZXBhZCA9IGdhbWVwYWRzWzBdXHJcblx0XHRcclxuXHRcdGlmICh0aGlzLmdhbWVwYWQpIHtcclxuXHRcdFx0XHJcblx0XHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5wcmV2aW91cy5nYW1lcGFkXHJcblx0XHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLmNvcHlHYW1lcGFkVmFsdWVzKHRoaXMuZ2FtZXBhZClcclxuXHRcdFx0XHJcblx0XHRcdGlmIChwcmV2aW91cykge1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5idXR0b25zLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGlmIChwcmV2aW91cy5idXR0b25zW2ldLnByZXNzZWQgIT09IGN1cnJlbnQuYnV0dG9uc1tpXS5wcmVzc2VkKSB7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAnZ2FtZXBhZCdcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY3VycmVudC5heGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGlmIChwcmV2aW91cy5heGVzW2ldICE9PSBjdXJyZW50LmF4ZXNbaV0pIHtcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdHRoaXMuY29udHJvbGxlciA9ICdnYW1lcGFkJ1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdH1cclxuXHRcdFxyXG5cdFx0XHR0aGlzLnByZXZpb3VzLmdhbWVwYWQgPSB0aGlzLnZhbHVlcy5nYW1lcGFkXHJcblx0XHRcdHRoaXMudmFsdWVzLmdhbWVwYWQgPSBjdXJyZW50XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0fVxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIFRyYW5zZm9ybWUgdW4gYXhlIGRlIGpveXN0aWNrIHBvdXIgcHJlbmRyZSBlbiBjb21wdGUgbGEgem9uZSBtb3J0ZS5cclxuXHQgKiBAcGFyYW0gPE51bWJlcj4gYXhpc1xyXG5cdCAqIEByZXR1cm4gPE51bWJlcj5cclxuXHQgKi9cclxuXHRhcHBseURlYWR6b25lKHgpIHtcclxuXHRcdFxyXG5cdFx0bGV0IGRlYWR6b25lID0gdGhpcy5kZWFkem9uZVxyXG5cdFx0XHRcdFxyXG5cdFx0eCA9IHggPCAwID8gTWF0aC5taW4oeCwgLWRlYWR6b25lKSA6IE1hdGgubWF4KHgsIGRlYWR6b25lKVxyXG5cdFx0XHJcblx0XHRyZXR1cm4gKE1hdGguYWJzKHgpIC0gZGVhZHpvbmUpIC8gKDEgLSBkZWFkem9uZSkgKiBNYXRoLnNpZ24oeClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBBeGUgWCBwcmluY2lwYWwgKGpveXN0aWNrIG91IHNvdXJpcylcclxuXHQgKiBAcGFyYW0gPE51bWJlcj4gZ2FtZXBhZEF4aXNJbmRleFxyXG5cdCAqIEBwYXJhbSA8T2JqZWN0PiBrZXlib2FyZEtleXMgOiB7IHBvc2l0aXZlOiA8U3RyaW5nPiwgbmVnYXRpdmU6IDxTdHJpbmc+IH1cclxuXHQgKi9cclxuXHRnZXRBeGlzKGdhbWVwYWRBeGlzSW5kZXgsIGtleWJvYXJkS2V5cykge1xyXG5cdFx0XHJcblx0XHRzd2l0Y2ggKHRoaXMuY29udHJvbGxlcikge1xyXG5cdFx0XHRcclxuXHRcdFx0Y2FzZSAnZ2FtZXBhZCc6XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKHRoaXMudmFsdWVzLmdhbWVwYWQgPT09IG51bGwpIHJldHVybiAwXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMudmFsdWVzLmdhbWVwYWQuYXhlc1tnYW1lcGFkQXhpc0luZGV4XVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGJyZWFrXHJcblx0XHRcdFxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRjYXNlICdrZXlib2FyZCc6XHJcblx0XHRcdFxyXG5cdFx0XHRcdGxldCBwb3NpdGl2ZSA9IHRoaXMudmFsdWVzLmtleWJvYXJkW2tleWJvYXJkS2V5cy5wb3NpdGl2ZV0gPyArMSA6IDBcclxuXHRcdFx0XHRsZXQgbmVnYXRpdmUgPSB0aGlzLnZhbHVlcy5rZXlib2FyZFtrZXlib2FyZEtleXMubmVnYXRpdmVdID8gLTEgOiAwXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0cmV0dXJuIHBvc2l0aXZlICsgbmVnYXRpdmVcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRicmVha1xyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBDb3BpZSB0b3V0ZXMgbGVzIHZhbGV1cnMgZHUgZ2FtZXBhZCBkYW5zIHVuIG9iamV0XHJcblx0ICogQHBhcmFtIDxHYW1lcGFkPlxyXG5cdCAqIEByZXR1cm4gPE9iamVjdD5cclxuXHQgKi9cclxuXHRjb3B5R2FtZXBhZFZhbHVlcyhnYW1lcGFkKSB7XHJcblx0XHRcclxuXHRcdGxldCBheGVzID0gW11cclxuXHRcdGxldCBidXR0b25zID0gW11cclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBnYW1lcGFkLmJ1dHRvbnMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHJcblx0XHRcdGJ1dHRvbnNbaV0gPSB7XHJcblx0XHRcdFx0dmFsdWU6IGdhbWVwYWQuYnV0dG9uc1tpXS52YWx1ZSxcclxuXHRcdFx0XHRwcmVzc2VkOiBnYW1lcGFkLmJ1dHRvbnNbaV0ucHJlc3NlZFxyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGdhbWVwYWQuYXhlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcclxuXHRcdFx0YXhlc1tpXSA9IHRoaXMuYXBwbHlEZWFkem9uZShnYW1lcGFkLmF4ZXNbaV0pXHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRheGVzOiBheGVzLFxyXG5cdFx0XHRidXR0b25zOiBidXR0b25zXHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblx0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbHNcclxuXHJcbiIsImNvbnN0IGNvbG9ycyA9IHJlcXVpcmUoJy4vY29sb3JzJylcclxuY29uc3QgQ2hhbmNlID0gcmVxdWlyZSgnY2hhbmNlJylcclxuY29uc3QgZ2FtZSA9IHt9XHJcblxyXG4vKipcclxuICogRmljaGllcnMgSlNPTlxyXG4gKi9cclxuZ2FtZS5maWxlcyA9IHtcclxuXHRwbGF5ZXI6IHtcclxuXHRcdHBhdGg6ICcuLi9tb2RlbHMvcGxheWVyLmpzb24nXHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQ2hhcmdlciBsZXMgZmljaGllcnNcclxuICovXHJcbmdhbWUubG9hZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG5cdFxyXG5cdC8vIExvYWRlclxyXG5cdGNvbnN0IGxvYWRlciA9IG5ldyBUSFJFRS5KU09OTG9hZGVyKClcclxuXHRcclxuXHQvLyBWw6lyaWZpZXIgcXUndW4gZmljaGllciBlc3QgY2hhcmfDqVxyXG5cdGNvbnN0IGlzTG9hZGVkID0gKGZpbGUpID0+IHtcclxuXHRcdFxyXG5cdFx0cmV0dXJuIGZpbGUuZ2VvbWV0cnkgIT09IHVuZGVmaW5lZCB8fCBmaWxlLm1hdGVyaWFscyAhPT0gdW5kZWZpbmVkXHJcblx0XHJcblx0fVxyXG5cdFxyXG5cdC8vIENoYXJnZXIgY2hhcXVlIGZpY2hpZXJcclxuXHRmb3IgKGxldCBmIGluIHRoaXMuZmlsZXMpIHtcclxuXHRcdFxyXG5cdFx0bGV0IGZpbGUgPSB0aGlzLmZpbGVzW2ZdXHJcblx0XHRcclxuXHRcdGlmICghIGlzTG9hZGVkKGZpbGUpKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRsb2FkZXIubG9hZChmaWxlLnBhdGgsIChnZW9tZXRyeSwgbWF0ZXJpYWxzKSA9PiB7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0ZmlsZS5nZW9tZXRyeSA9IGdlb21ldHJ5XHJcblx0XHRcdFx0ZmlsZS5tYXRlcmlhbHMgPSBtYXRlcmlhbHNcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRjb25zb2xlLmluZm8oYExvYWRlZDogJHtmaWxlLnBhdGh9YClcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRsZXQgYWxsTG9hZGVkID0gdHJ1ZVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGZvciAobGV0IGZmIGluIHRoaXMuZmlsZXMpIHtcclxuXHJcblx0XHRcdFx0XHRhbGxMb2FkZWQgPSBhbGxMb2FkZWQgJiYgaXNMb2FkZWQodGhpcy5maWxlc1tmZl0pXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmIChhbGxMb2FkZWQpIGNhbGxiYWNrKClcclxuXHRcdFx0XHRcclxuXHRcdFx0fSlcclxuXHRcdFx0XHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblx0XHJcbn1cclxuIFxyXG4vKipcclxuICogQ3LDqWF0aW9uIGRlIGxhIHNjw6huZVxyXG4gKi9cclxuZ2FtZS5jcmVhdGVTY2VuZSA9IGZ1bmN0aW9uICgpIHtcclxuXHRcclxuXHQvLyBHZXQgdGhlIHdpZHRoIGFuZCB0aGUgaGVpZ2h0IG9mIHRoZSBzY3JlZW4sXHJcblx0Ly8gdXNlIHRoZW0gdG8gc2V0IHVwIHRoZSBhc3BlY3QgcmF0aW8gb2YgdGhlIGNhbWVyYSBcclxuXHQvLyBhbmQgdGhlIHNpemUgb2YgdGhlIHJlbmRlcmVyLlxyXG5cdHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0XHJcblx0dGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoXHJcblxyXG5cdC8vIENyZWF0ZSB0aGUgc2NlbmVcclxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKClcclxuXHRcclxuXHQvLyBSYW5kb21cclxuXHR0aGlzLmNoYW5jZSA9IG5ldyBDaGFuY2UoJzQ1MzY0NTMnKVxyXG5cdFxyXG5cdC8vIGRhdC5ndWlcclxuXHR0aGlzLmd1aSA9IG5ldyBkYXQuR1VJKClcclxuXHRcclxuXHQvLyBDb250csO0bGVzXHJcblx0Y29uc3QgQ29udHJvbHMgPSByZXF1aXJlKCcuL3NvbGFyaXMtY29udHJvbHMnKVxyXG5cdHRoaXMuY29udHJvbHMgPSBuZXcgQ29udHJvbHNcclxuXHRcclxuXHQvLyBBZGQgYSBmb2cgZWZmZWN0IHRvIHRoZSBzY2VuZSBzYW1lIGNvbG9yIGFzIHRoZVxyXG5cdC8vIGJhY2tncm91bmQgY29sb3IgdXNlZCBpbiB0aGUgc3R5bGUgc2hlZXRcclxuXHQvLyB0aGlzLnNjZW5lLmZvZyA9IG5ldyBUSFJFRS5Gb2cobmV3IFRIUkVFLkNvbG9yKFwiIzVEQkRFNVwiKSwgMTUwLCAzMDApXHJcblx0XHJcblx0Ly8gQ3JlYXRlIHRoZSByZW5kZXJlclxyXG5cdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHsgXHJcblx0XHQvLyBBbGxvdyB0cmFuc3BhcmVuY3kgdG8gc2hvdyB0aGUgZ3JhZGllbnQgYmFja2dyb3VuZFxyXG5cdFx0Ly8gd2UgZGVmaW5lZCBpbiB0aGUgQ1NTXHJcblx0XHRhbHBoYTogdHJ1ZSwgXHJcblxyXG5cdFx0Ly8gQWN0aXZhdGUgdGhlIGFudGktYWxpYXNpbmcgdGhpcyBpcyBsZXNzIHBlcmZvcm1hbnQsXHJcblx0XHQvLyBidXQsIGFzIG91ciBwcm9qZWN0IGlzIGxvdy1wb2x5IGJhc2VkLCBpdCBzaG91bGQgYmUgZmluZSA6KVxyXG5cdFx0YW50aWFsaWFzOiB0cnVlIFxyXG5cdH0pXHJcblxyXG5cdC8vIERlZmluZSB0aGUgc2l6ZSBvZiB0aGUgcmVuZGVyZXIgaW4gdGhpcyBjYXNlLFxyXG5cdC8vIGl0IHdpbGwgZmlsbCB0aGUgZW50aXJlIHNjcmVlblxyXG5cdHJlbmRlcmVyLnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpXHJcblx0XHJcblx0Ly8gRW5hYmxlIHNoYWRvdyByZW5kZXJpbmdcclxuXHRyZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWVcclxuXHRyZW5kZXJlci5zaGFkb3dNYXAudHlwZSA9IFRIUkVFLlBDRlNvZnRTaGFkb3dNYXBcclxuXHRcclxuXHQvLyBBZGQgdGhlIERPTSBlbGVtZW50IG9mIHRoZSByZW5kZXJlciB0byB0aGUgXHJcblx0Ly8gY29udGFpbmVyIHdlIGNyZWF0ZWQgaW4gdGhlIEhUTUxcclxuXHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluJylcclxuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyZXIuZG9tRWxlbWVudClcclxuXHRcclxuXHQvLyBMaXN0ZW4gdG8gdGhlIHNjcmVlbjogaWYgdGhlIHVzZXIgcmVzaXplcyBpdFxyXG5cdC8vIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBjYW1lcmEgYW5kIHRoZSByZW5kZXJlciBzaXplXHJcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsICgpID0+IHtcclxuXHRcdFxyXG5cdFx0dGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHRcclxuXHRcdHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aFxyXG5cdFx0XHJcblx0XHRyZW5kZXJlci5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KVxyXG5cdFx0XHJcblx0XHR0aGlzLmNhbWVyYS5hc3BlY3QgPSB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHRcclxuXHRcdHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKVxyXG5cdFx0XHJcblx0fSwgZmFsc2UpXHJcblx0XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcsOpYXRpb24gZGVzIGx1bWnDqHJlc1xyXG4gKi9cclxuZ2FtZS5jcmVhdGVMaWdodHMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHJcblx0Ly8gQSBoZW1pc3BoZXJlIGxpZ2h0IGlzIGEgZ3JhZGllbnQgY29sb3JlZCBsaWdodDsgXHJcblx0Ly8gdGhlIGZpcnN0IHBhcmFtZXRlciBpcyB0aGUgc2t5IGNvbG9yLCB0aGUgc2Vjb25kIHBhcmFtZXRlciBpcyB0aGUgZ3JvdW5kIGNvbG9yLCBcclxuXHQvLyB0aGUgdGhpcmQgcGFyYW1ldGVyIGlzIHRoZSBpbnRlbnNpdHkgb2YgdGhlIGxpZ2h0XHJcblx0Y29uc3QgaGVtaXNwaGVyZUxpZ2h0ID0gbmV3IFRIUkVFLkhlbWlzcGhlcmVMaWdodChcclxuXHRcdG5ldyBUSFJFRS5Db2xvcihcIiNGRkZGRkZcIiksXHJcblx0XHRuZXcgVEhSRUUuQ29sb3IoXCIjRkZGRkZGXCIpLFxyXG5cdFx0MVxyXG5cdClcclxuXHRcclxuXHRcclxuXHQvLyBBIGRpcmVjdGlvbmFsIGxpZ2h0IHNoaW5lcyBmcm9tIGEgc3BlY2lmaWMgZGlyZWN0aW9uLiBcclxuXHQvLyBJdCBhY3RzIGxpa2UgdGhlIHN1biwgdGhhdCBtZWFucyB0aGF0IGFsbCB0aGUgcmF5cyBwcm9kdWNlZCBhcmUgcGFyYWxsZWwuIFxyXG5cdGNvbnN0IHNoYWRvd0xpZ2h0ID0gbmV3IFRIUkVFLkRpcmVjdGlvbmFsTGlnaHQoMHhmZmZmZmYsIDAuMylcclxuXHRcclxuXHQvLyBTZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgbGlnaHQgIFxyXG5cdHNoYWRvd0xpZ2h0LnBvc2l0aW9uLnNldCgwLCAwLCAxMClcclxuXHRcclxuXHQvLyBBbGxvdyBzaGFkb3cgY2FzdGluZyBcclxuXHRzaGFkb3dMaWdodC5jYXN0U2hhZG93ID0gdHJ1ZVxyXG5cdC8vIHNoYWRvd0xpZ2h0LnNoYWRvd0NhbWVyYVZpc2libGUgPSB0cnVlXHJcblxyXG5cdC8vIC8vIGRlZmluZSB0aGUgdmlzaWJsZSBhcmVhIG9mIHRoZSBwcm9qZWN0ZWQgc2hhZG93XHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5sZWZ0ID0gLTIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5yaWdodCA9IDIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS50b3AgPSAyMFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEuYm90dG9tID0gLTIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5uZWFyID0gMVxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEuZmFyID0gMTAwMFxyXG5cclxuXHQvLyBkZWZpbmUgdGhlIHJlc29sdXRpb24gb2YgdGhlIHNoYWRvdzsgdGhlIGhpZ2hlciB0aGUgYmV0dGVyLCBcclxuXHQvLyBidXQgYWxzbyB0aGUgbW9yZSBleHBlbnNpdmUgYW5kIGxlc3MgcGVyZm9ybWFudFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5tYXBTaXplLndpZHRoID0gMjA0OFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5tYXBTaXplLmhlaWdodCA9IDIwNDhcclxuXHR0aGlzLnNoYWRvd0xpZ2h0ID0gc2hhZG93TGlnaHRcclxuXHJcblx0dGhpcy5zY2VuZS5hZGQoc2hhZG93TGlnaHQpXHJcblx0dGhpcy5zY2VuZS5hZGQoaGVtaXNwaGVyZUxpZ2h0KVxyXG59XHJcblxyXG4vKipcclxuICogQ3LDqWF0aW9uIGR1IHNvbFxyXG4gKi9cclxuZ2FtZS5jcmVhdGVPYmplY3RzID0gZnVuY3Rpb24gKCkge1xyXG5cdFxyXG5cdGNvbnN0IEdyb3VuZCA9IHJlcXVpcmUoJy4vZ3JvdW5kLmpzJylcclxuXHRjb25zdCBQbGF5ZXIgPSByZXF1aXJlKCcuL3BsYXllci5qcycpXHJcblx0Y29uc3QgQ2FtZXJhID0gcmVxdWlyZSgnLi9jYW1lcmEuanMnKVxyXG5cdFxyXG5cdHRoaXMuZ3JvdW5kID0gbmV3IEdyb3VuZFxyXG5cdHRoaXMucGxheWVyID0gbmV3IFBsYXllclxyXG5cdFxyXG5cdC8vIENyZWF0ZSB0aGUgY2FtZXJhXHJcblx0dGhpcy5jYW1lcmEgPSBuZXcgQ2FtZXJhXHJcblx0XHJcbn1cclxuXHJcbmdhbWUubGluZSA9IGZ1bmN0aW9uIChhLCBiLCBjb2xvciwgZGFzaGVkID0gZmFsc2UpIHtcclxuXHRcclxuXHRjb2xvciA9IG5ldyBUSFJFRS5Db2xvcihjb2xvciB8fCBgaHNsKCR7dGhpcy5jaGFuY2UuaW50ZWdlcih7bWluOiAwLCBtYXg6IDM2MH0pfSwgMTAwJSwgNTAlKWApXHJcblx0XHJcblx0bGV0IG1hdGVyaWFsXHJcblx0XHJcblx0aWYgKGRhc2hlZCkge1xyXG5cdFx0bWF0ZXJpYWwgPSBUSFJFRS5MaW5lRGFzaGVkTWF0ZXJpYWwoe1xyXG5cdFx0XHRjb2xvcjogY29sb3IsXHJcblx0XHRcdGRhc2hTaXplOiAyLFxyXG5cdFx0XHRnYXBTaXplOiAzXHJcblx0XHR9KVxyXG5cdH1cclxuXHRcclxuXHRlbHNlIHtcclxuXHRcdG1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcclxuXHRcdFx0Y29sb3I6IGNvbG9yXHJcblx0XHR9KVxyXG5cdH1cclxuXHRcclxuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpXHJcbiAgICBnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKGEpXHJcbiAgICBnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKGIpXHJcblx0XHJcbiAgICBjb25zdCBsaW5lID0gbmV3IFRIUkVFLkxpbmUoZ2VvbWV0cnksIG1hdGVyaWFsKVxyXG4gICAgbGluZS5uYW1lID0gXCJMaW5lIFwiICsgdGhpcy5jaGFuY2Uuc3RyaW5nKClcclxuICAgIFxyXG4gICAgcmV0dXJuIGxpbmVcclxuICAgIFxyXG59XHJcblxyXG4vKipcclxuICogQm91Y2xlIGR1IGpldVxyXG4gKi9cclxuY29uc3QgZXZlbnQgPSB7XHJcblx0ZGVsdGE6IDAsXHJcblx0dGltZTogMFxyXG59XHJcblxyXG5nYW1lLmxvb3AgPSBmdW5jdGlvbiAodGltZSA9IDApIHtcclxuXHRcclxuXHR0aW1lIC89IDEwMDBcclxuXHRcclxuXHRldmVudC5kZWx0YSA9IHRpbWUgLSBldmVudC50aW1lXHJcblx0ZXZlbnQudGltZSA9IHRpbWVcclxuXHRcclxuXHQvLyBNaXNlIMOgIGpvdXIgZGVzIGNvbnRyw7RsZXNcclxuXHR0aGlzLmNvbnRyb2xzLnVwZGF0ZShldmVudClcclxuXHRcclxuXHQvLyBNaXNlIMOgIGpvdXIgZGVzIG9iamV0c1xyXG5cdHRoaXMuc2NlbmUudHJhdmVyc2VWaXNpYmxlKChjaGlsZCkgPT4ge1xyXG5cdFx0XHJcblx0XHRpZiAoY2hpbGQubmFtZSAmJiBjaGlsZC5uYW1lLm1hdGNoKC9eTGluZS8pKSB7XHJcblx0XHRcdGNoaWxkLmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWVcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Y2hpbGQudXBkYXRlICYmIGNoaWxkLnVwZGF0ZShldmVudClcclxuXHRcdFxyXG5cdH0pXHJcblx0XHJcblx0Ly8gTWlzZSDDoCBqb3VyIGRlIGxhIGNhbcOpcmFcclxuXHR0aGlzLmNhbWVyYS51cGRhdGUoZXZlbnQpXHJcblx0XHJcblx0Ly8gQWZmaWNoYWdlXHJcblx0dGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpXHJcblx0XHJcblx0Ly8gUHJvY2hhaW5lIGZyYW1lXHJcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLmxvb3AuYmluZCh0aGlzKSlcclxufVxyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGdhbWUiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuXHJcbi8qKlxyXG4gKiBDbGFzcyBHcm91bmRcclxuICovXHJcbmNsYXNzIEdyb3VuZCBleHRlbmRzIFRIUkVFLk1lc2gge1xyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIEdyb3VuZCBjb25zdHJ1Y3RvclxyXG5cdCAqL1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHRzdXBlcigpXHJcblx0XHRcclxuXHRcdHRoaXMubmFtZSA9IFwiR3JvdW5kXCJcclxuXHRcclxuXHRcdHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuUGxhbmVHZW9tZXRyeSgyMCwgMjApXHJcblx0XHRcclxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaExhbWJlcnRNYXRlcmlhbCh7XHJcblx0XHRcdGNvbG9yOiBuZXcgVEhSRUUuQ29sb3IoJyM5REREODcnKSxcclxuXHRcdFx0c2lkZTogVEhSRUUuRG91YmxlU2lkZVxyXG5cdFx0fSlcclxuXHRcdFxyXG5cdFx0dGhpcy5jYXN0U2hhZG93ID0gZmFsc2VcclxuXHRcdHRoaXMucmVjZWl2ZVNoYWRvdyA9IHRydWVcclxuXHRcdFxyXG5cdFx0Z2FtZS5zY2VuZS5hZGQodGhpcylcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBNaXNlIMOgIGpvdXJcclxuXHQgKi9cclxuXHR1cGRhdGUoZGVsdGEsIHRpbWUpIHtcclxuXHRcdFxyXG5cdH1cclxuXHRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcm91bmQiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgUEkgPSBNYXRoLlBJXHJcblxyXG4vKipcclxuICogQ2xhc3MgUGxheWVyXHJcbiAqL1xyXG5jbGFzcyBQbGF5ZXIgZXh0ZW5kcyBUSFJFRS5Ta2lubmVkTWVzaCB7XHJcblx0XHJcblx0LyoqXHJcblx0ICogUGxheWVyIGNvbnN0cnVjdG9yXHJcblx0ICovXHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRcclxuXHRcdGNvbnN0IGdlb21ldHJ5ID0gZ2FtZS5maWxlcy5wbGF5ZXIuZ2VvbWV0cnlcclxuXHRcdFxyXG5cdFx0Y29uc3QgbWF0ZXJpYWxzID0gZ2FtZS5maWxlcy5wbGF5ZXIubWF0ZXJpYWxzXHJcblx0XHRjb25zdCBtYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoTGFtYmVydE1hdGVyaWFsKHtcclxuXHRcdFx0Y29sb3I6IG5ldyBUSFJFRS5Db2xvcignI0Y2QzM1NycpLFxyXG5cdFx0XHRza2lubmluZzogdHJ1ZVxyXG5cdFx0fSlcclxuXHRcdFx0XHJcblx0XHRzdXBlcihnZW9tZXRyeSwgbWF0ZXJpYWwpXHJcblx0XHRcclxuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyXCJcclxuXHRcdFxyXG5cdFx0dGhpcy5jYXN0U2hhZG93ID0gdHJ1ZVxyXG5cdFx0dGhpcy5yZWNlaXZlU2hhZG93ID0gZmFsc2VcclxuXHRcdFxyXG5cdFx0Ly8gR2VzdGlvbm5haXJlIGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLm1peGVyID0gbmV3IFRIUkVFLkFuaW1hdGlvbk1peGVyKHRoaXMpXHJcblx0XHRcclxuXHRcdC8vIFZpdGVzc2UgZGUgZMOpcGxhY2VtZW50XHJcblx0XHR0aGlzLnZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMClcclxuXHRcdFxyXG5cdFx0Ly8gVml0ZXNzZSBkZSBkw6lwbGFjZW1lbnQgbWF4aW1hbGVcclxuXHRcdHRoaXMubWF4VmVsb2NpdHkgPSAwLjFcclxuXHRcdFxyXG5cdFx0Ly8gUm90YXRpb24gZHUgbW9kw6hsZSAzRFxyXG5cdFx0dGhpcy5nZW9tZXRyeS5yb3RhdGVYKE1hdGguUEkgLyAyKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlRmFjZU5vcm1hbHMoKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlVmVydGV4Tm9ybWFscygpXHJcblx0XHR0aGlzLmdlb21ldHJ5LmNvbXB1dGVNb3JwaE5vcm1hbHMoKVxyXG5cdFx0XHJcblx0XHQvLyBDaGFyZ2VtZW50IGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLmFjdGlvbnMgPSB7fVxyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZ2VvbWV0cnkuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcclxuXHRcdFx0Y29uc3QgY2xpcCA9IHRoaXMuZ2VvbWV0cnkuYW5pbWF0aW9uc1tpXVxyXG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0aGlzLm1peGVyLmNsaXBBY3Rpb24oY2xpcClcclxuXHRcdFx0XHJcblx0XHRcdGFjdGlvbi5zZXRFZmZlY3RpdmVXZWlnaHQoMSkuc3RvcCgpXHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmFjdGlvbnNbY2xpcC5uYW1lXSA9IGFjdGlvblxyXG5cdFx0XHRcclxuXHRcdFx0Y29uc29sZS5sb2coYWN0aW9uKVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0XHJcblx0XHRnYW1lLnNjZW5lLmFkZCh0aGlzKVxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBNaXNlIMOgIGpvdXJcclxuXHQgKi9cclxuXHR1cGRhdGUoZXZlbnQpIHtcclxuXHRcdFxyXG5cdFx0Ly8gSm95c3RpY2sgLyBjbGF2aWVyXHJcblx0XHRjb25zdCBjb250cm9sID0gbmV3IFRIUkVFLlZlY3RvcjIoXHJcblx0XHRcdC1nYW1lLmNvbnRyb2xzLm1haW5BeGlzWCxcclxuXHRcdFx0K2dhbWUuY29udHJvbHMubWFpbkF4aXNZXHJcblx0XHQpXHJcblx0XHRcclxuXHRcdC8vIEZvcmNlIGFwcGxpcXXDqWUgc3VyIGxlIGpveXN0aWNrXHJcblx0XHRjb25zdCBmb3JjZSA9IGNvbnRyb2wubGVuZ3RoKClcclxuXHRcdFxyXG5cdFx0Ly8gQ2hhbmdlbWVudCBkZSB2aXRlc3NlXHJcblx0XHR0aGlzLnZlbG9jaXR5LnggKz0gKGNvbnRyb2wueCAtIHRoaXMudmVsb2NpdHkueCkgLyAwLjEgKiBldmVudC5kZWx0YVxyXG5cdFx0dGhpcy52ZWxvY2l0eS55ICs9IChjb250cm9sLnkgLSB0aGlzLnZlbG9jaXR5LnkpIC8gMC4xICogZXZlbnQuZGVsdGFcclxuXHRcdFxyXG5cdFx0Ly8gVml0ZXNzZSBkdSBwZXJzb25uYWdlIGVuIGZvbmN0aW9uIGRlIGxhIGZvcmNlIGQnYXBwdWkgc3VyIGxlIGpveXN0aWNrXHJcblx0XHRpZiAoZm9yY2UgPiAwKSB0aGlzLnZlbG9jaXR5Lm11bHRpcGx5U2NhbGFyKGZvcmNlKVxyXG5cdFx0XHJcblx0XHQvLyBMaW1pdGF0aW9uIGRlIGxhIHZpdGVzc2VcclxuXHRcdHRoaXMudmVsb2NpdHkuY2xhbXBMZW5ndGgoLXRoaXMubWF4VmVsb2NpdHksICt0aGlzLm1heFZlbG9jaXR5KVxyXG5cdFx0XHJcblx0XHQvLyBBcHBsaWNhdGlvbiBkZSBsYSB2aXRlc3NlIHN1ciBsYSBwb3NpdGlvblxyXG5cdFx0dGhpcy5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eSlcclxuXHRcdFxyXG5cdFx0XHJcblx0XHQvLyBSb3RhdGlvbiBkdSBwZXJzb25uYWdlXHJcblx0XHRjb25zdCB0YXJnZXRSb3RhdGlvbiA9IE1hdGguYXRhbjIodGhpcy52ZWxvY2l0eS55LCB0aGlzLnZlbG9jaXR5LngpXHJcblx0XHRcclxuXHRcdC8vIERpZmbDqXJlbmNlIGF2ZWMgbCdhbmdsZSByw6llbFxyXG5cdFx0bGV0IGRpZmYgPSB0YXJnZXRSb3RhdGlvbiAtIHRoaXMucm90YXRpb24uelxyXG5cdFx0XHJcblx0XHQvLyBBbGxlciBhdSBwbHVzIGNvdXJ0XHJcblx0XHRpZiAoTWF0aC5hYnMoZGlmZikgPiBNYXRoLlBJKSB7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLnJvdGF0aW9uLnogKz0gTWF0aC5QSSAqIDIgKiBNYXRoLnNpZ24oZGlmZilcclxuXHRcdFx0ZGlmZiA9IHRhcmdldFJvdGF0aW9uIC0gdGhpcy5yb3RhdGlvbi56XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBBcHBsaXF1ZXIgbGEgZGlmZsOpcmVuY2UgZGUgcm90YXRpb24gc3VyIGxhIHJvdGF0aW9uIHLDqWVsbGVcclxuXHRcdHRoaXMucm90YXRpb24ueiArPSBkaWZmIC8gMC4xNSAqIGV2ZW50LmRlbHRhXHJcblx0XHRcclxuXHRcdC8vIE1pc2Ugw6Agam91ciBkZSBsJ2FuaW1hdGlvblxyXG5cdFx0dGhpcy5taXhlci51cGRhdGUoZXZlbnQuZGVsdGEpXHJcblx0fVxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIEpvdWVyIHVuZSBhbmltYXRpb25cclxuXHQgKi9cclxuXHRwbGF5KGFuaW1OYW1lLCB3ZWlnaHQgPSAxKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5taXhlclxyXG5cdFx0XHQuY2xpcEFjdGlvbihhbmltTmFtZSlcclxuXHRcdFx0LnNldEVmZmVjdGl2ZVdlaWdodCh3ZWlnaHQpXHJcblx0XHRcdC5wbGF5KClcclxuXHR9XHJcblx0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUGxheWVyXHJcblxyXG4iLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgQ29udHJvbHMgPSByZXF1aXJlKCcuL2NvbnRyb2xzJylcclxuXHJcbi8qKlxyXG4gKiBHw6hyZSBsZXMgY29udHLDtGxlcyAoY2xhdmllci9zb3VyaXMgZXQgbWFuZXR0ZSkgZHUgam91ZXVyXHJcbiAqL1xyXG5jbGFzcyBTb2xhcmlzQ29udHJvbHMgZXh0ZW5kcyBDb250cm9scyB7XHJcblx0XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRcclxuXHRcdHN1cGVyKClcclxuXHRcdFxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdtYWluQXhpc1gnLCAtMSwgMSkuc3RlcCgwLjAxKS5saXN0ZW4oKVxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdtYWluQXhpc1knLCAtMSwgMSkuc3RlcCgwLjAxKS5saXN0ZW4oKVxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdjb250cm9sbGVyJykubGlzdGVuKClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgYWN0aW9uQnV0dG9uKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9YLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdkJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3EnXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgbWFpbkF4aXNYKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9YLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdkJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3EnXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgbWFpbkF4aXNZKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9ZLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdzJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3onXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTb2xhcmlzQ29udHJvbHMiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgY29sb3JzID0gcmVxdWlyZSgnLi9jb2xvcnMnKVxyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHJcblx0Z2FtZS5sb2FkKCgpID0+IHtcclxuXHRcdFxyXG5cdFx0Z2FtZS5jcmVhdGVTY2VuZSgpXHJcblx0XHRnYW1lLmNyZWF0ZUxpZ2h0cygpXHJcblx0XHRnYW1lLmNyZWF0ZU9iamVjdHMoKVxyXG5cclxuXHRcdGNvbnNvbGUubG9nKGdhbWUpXHJcblx0XHRcclxuXHRcdHdpbmRvdy5nYW1lID0gZ2FtZVxyXG5cdFx0XHJcblx0XHRnYW1lLmxvb3AoKVxyXG5cdFx0XHJcblx0fSlcclxuXHRcclxufSwgZmFsc2UpIiwiLy8gIENoYW5jZS5qcyAxLjAuNlxuLy8gIGh0dHA6Ly9jaGFuY2Vqcy5jb21cbi8vICAoYykgMjAxMyBWaWN0b3IgUXVpbm5cbi8vICBDaGFuY2UgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCBvciBtb2RpZmllZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbihmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBDb25zdGFudHNcbiAgICB2YXIgTUFYX0lOVCA9IDkwMDcxOTkyNTQ3NDA5OTI7XG4gICAgdmFyIE1JTl9JTlQgPSAtTUFYX0lOVDtcbiAgICB2YXIgTlVNQkVSUyA9ICcwMTIzNDU2Nzg5JztcbiAgICB2YXIgQ0hBUlNfTE9XRVIgPSAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXonO1xuICAgIHZhciBDSEFSU19VUFBFUiA9IENIQVJTX0xPV0VSLnRvVXBwZXJDYXNlKCk7XG4gICAgdmFyIEhFWF9QT09MICA9IE5VTUJFUlMgKyBcImFiY2RlZlwiO1xuXG4gICAgLy8gQ2FjaGVkIGFycmF5IGhlbHBlcnNcbiAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICAvLyBDb25zdHJ1Y3RvclxuICAgIGZ1bmN0aW9uIENoYW5jZSAoc2VlZCkge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ2hhbmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNlZWQgPT0gbnVsbCA/IG5ldyBDaGFuY2UoKSA6IG5ldyBDaGFuY2Uoc2VlZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB1c2VyIGhhcyBwcm92aWRlZCBhIGZ1bmN0aW9uLCB1c2UgdGhhdCBhcyB0aGUgZ2VuZXJhdG9yXG4gICAgICAgIGlmICh0eXBlb2Ygc2VlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5yYW5kb20gPSBzZWVkO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gc2V0IGEgc3RhcnRpbmcgdmFsdWUgb2YgemVybyBzbyB3ZSBjYW4gYWRkIHRvIGl0XG4gICAgICAgICAgICB0aGlzLnNlZWQgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3RoZXJ3aXNlLCBsZWF2ZSB0aGlzLnNlZWQgYmxhbmsgc28gdGhhdCBNVCB3aWxsIHJlY2VpdmUgYSBibGFua1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc2VlZGxpbmcgPSAwO1xuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHNbaV0pID09PSAnW29iamVjdCBTdHJpbmddJykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgYXJndW1lbnRzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG51bWVyaWMgaGFzaCBmb3IgZWFjaCBhcmd1bWVudCwgYWRkIHRvIHNlZWRsaW5nXG4gICAgICAgICAgICAgICAgICAgIHZhciBoYXNoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBhcmd1bWVudHNbaV0ubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSBhcmd1bWVudHNbaV0uY2hhckNvZGVBdChrKSArIChoYXNoIDw8IDYpICsgKGhhc2ggPDwgMTYpIC0gaGFzaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWVkbGluZyArPSBoYXNoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VlZGxpbmcgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNlZWQgKz0gKGFyZ3VtZW50cy5sZW5ndGggLSBpKSAqIHNlZWRsaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm8gZ2VuZXJhdG9yIGZ1bmN0aW9uIHdhcyBwcm92aWRlZCwgdXNlIG91ciBNVFxuICAgICAgICB0aGlzLm10ID0gdGhpcy5tZXJzZW5uZV90d2lzdGVyKHRoaXMuc2VlZCk7XG4gICAgICAgIHRoaXMuYmltZDUgPSB0aGlzLmJsdWVpbXBfbWQ1KCk7XG4gICAgICAgIHRoaXMucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubXQucmFuZG9tKHRoaXMuc2VlZCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5WRVJTSU9OID0gXCIxLjAuNlwiO1xuXG4gICAgLy8gUmFuZG9tIGhlbHBlciBmdW5jdGlvbnNcbiAgICBmdW5jdGlvbiBpbml0T3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0cykge1xuICAgICAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuXG4gICAgICAgIGlmIChkZWZhdWx0cykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBkZWZhdWx0cykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc1tpXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1tpXSA9IGRlZmF1bHRzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRlc3RSYW5nZSh0ZXN0LCBlcnJvck1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKHRlc3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmNvZGUgdGhlIGlucHV0IHN0cmluZyB3aXRoIEJhc2U2NC5cbiAgICAgKi9cbiAgICB2YXIgYmFzZTY0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gQmFzZTY0IGVuY29kZXIgYXZhaWxhYmxlLicpO1xuICAgIH07XG5cbiAgICAvLyBTZWxlY3QgcHJvcGVyIEJhc2U2NCBlbmNvZGVyLlxuICAgIChmdW5jdGlvbiBkZXRlcm1pbmVCYXNlNjRFbmNvZGVyKCkge1xuICAgICAgICBpZiAodHlwZW9mIGJ0b2EgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGJhc2U2NCA9IGJ0b2E7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIEJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgYmFzZTY0ID0gZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEJ1ZmZlcihpbnB1dCkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvLyAtLSBCYXNpY3MgLS1cblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gYm9vbCwgZWl0aGVyIHRydWUgb3IgZmFsc2VcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9eyBsaWtlbGlob29kOiA1MCB9XSBhbHRlciB0aGUgbGlrZWxpaG9vZCBvZlxuICAgICAqICAgIHJlY2VpdmluZyBhIHRydWUgb3IgZmFsc2UgdmFsdWUgYmFjay5cbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gaWYgdGhlIGxpa2VsaWhvb2QgaXMgb3V0IG9mIGJvdW5kc1xuICAgICAqICBAcmV0dXJucyB7Qm9vbH0gZWl0aGVyIHRydWUgb3IgZmFsc2VcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmJvb2wgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyBsaWtlbGlob29kIG9mIHN1Y2Nlc3MgKHRydWUpXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bGlrZWxpaG9vZCA6IDUwfSk7XG5cbiAgICAgICAgLy8gTm90ZSwgd2UgY291bGQgZ2V0IHNvbWUgbWlub3IgcGVyZiBvcHRpbWl6YXRpb25zIGJ5IGNoZWNraW5nIHJhbmdlXG4gICAgICAgIC8vIHByaW9yIHRvIGluaXRpYWxpemluZyBkZWZhdWx0cywgYnV0IHRoYXQgbWFrZXMgY29kZSBhIGJpdCBtZXNzaWVyXG4gICAgICAgIC8vIGFuZCB0aGUgY2hlY2sgbW9yZSBjb21wbGljYXRlZCBhcyB3ZSBoYXZlIHRvIGNoZWNrIGV4aXN0ZW5jZSBvZlxuICAgICAgICAvLyB0aGUgb2JqZWN0IHRoZW4gZXhpc3RlbmNlIG9mIHRoZSBrZXkgYmVmb3JlIGNoZWNraW5nIGNvbnN0cmFpbnRzLlxuICAgICAgICAvLyBTaW5jZSB0aGUgb3B0aW9ucyBpbml0aWFsaXphdGlvbiBzaG91bGQgYmUgbWlub3IgY29tcHV0YXRpb25hbGx5LFxuICAgICAgICAvLyBkZWNpc2lvbiBtYWRlIGZvciBjb2RlIGNsZWFubGluZXNzIGludGVudGlvbmFsbHkuIFRoaXMgaXMgbWVudGlvbmVkXG4gICAgICAgIC8vIGhlcmUgYXMgaXQncyB0aGUgZmlyc3Qgb2NjdXJyZW5jZSwgd2lsbCBub3QgYmUgbWVudGlvbmVkIGFnYWluLlxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLmxpa2VsaWhvb2QgPCAwIHx8IG9wdGlvbnMubGlrZWxpaG9vZCA+IDEwMCxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBMaWtlbGlob29kIGFjY2VwdHMgdmFsdWVzIGZyb20gMCB0byAxMDAuXCJcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5yYW5kb20oKSAqIDEwMCA8IG9wdGlvbnMubGlrZWxpaG9vZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBjaGFyYWN0ZXIuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIGNoYXJhY3RlciBwb29sLCBvbmx5IGFscGhhLFxuICAgICAqICAgIG9ubHkgc3ltYm9scywgYW5kIGNhc2luZyAobG93ZXIgb3IgdXBwZXIpXG4gICAgICogIEByZXR1cm5zIHtTdHJpbmd9IGEgc2luZ2xlIHJhbmRvbSBjaGFyYWN0ZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gQ2FuIG9ubHkgc3BlY2lmeSBhbHBoYSBvciBzeW1ib2xzLCBub3QgYm90aFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuY2hhcmFjdGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLmFscGhhICYmIG9wdGlvbnMuc3ltYm9scyxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBDYW5ub3Qgc3BlY2lmeSBib3RoIGFscGhhIGFuZCBzeW1ib2xzLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIHN5bWJvbHMgPSBcIiFAIyQlXiYqKClbXVwiLFxuICAgICAgICAgICAgbGV0dGVycywgcG9vbDtcblxuICAgICAgICBpZiAob3B0aW9ucy5jYXNpbmcgPT09ICdsb3dlcicpIHtcbiAgICAgICAgICAgIGxldHRlcnMgPSBDSEFSU19MT1dFUjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJykge1xuICAgICAgICAgICAgbGV0dGVycyA9IENIQVJTX1VQUEVSO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0dGVycyA9IENIQVJTX0xPV0VSICsgQ0hBUlNfVVBQRVI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wb29sKSB7XG4gICAgICAgICAgICBwb29sID0gb3B0aW9ucy5wb29sO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuYWxwaGEpIHtcbiAgICAgICAgICAgIHBvb2wgPSBsZXR0ZXJzO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc3ltYm9scykge1xuICAgICAgICAgICAgcG9vbCA9IHN5bWJvbHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb29sID0gbGV0dGVycyArIE5VTUJFUlMgKyBzeW1ib2xzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBvb2wuY2hhckF0KHRoaXMubmF0dXJhbCh7bWF4OiAocG9vbC5sZW5ndGggLSAxKX0pKTtcbiAgICB9O1xuXG4gICAgLy8gTm90ZSwgd2FudGVkIHRvIHVzZSBcImZsb2F0XCIgb3IgXCJkb3VibGVcIiBidXQgdGhvc2UgYXJlIGJvdGggSlMgcmVzZXJ2ZWQgd29yZHMuXG5cbiAgICAvLyBOb3RlLCBmaXhlZCBtZWFucyBOIE9SIExFU1MgZGlnaXRzIGFmdGVyIHRoZSBkZWNpbWFsLiBUaGlzIGJlY2F1c2VcbiAgICAvLyBJdCBjb3VsZCBiZSAxNC45MDAwIGJ1dCBpbiBKYXZhU2NyaXB0LCB3aGVuIHRoaXMgaXMgY2FzdCBhcyBhIG51bWJlcixcbiAgICAvLyB0aGUgdHJhaWxpbmcgemVyb2VzIGFyZSBkcm9wcGVkLiBMZWZ0IHRvIHRoZSBjb25zdW1lciBpZiB0cmFpbGluZyB6ZXJvZXMgYXJlXG4gICAgLy8gbmVlZGVkXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBmbG9hdGluZyBwb2ludCBudW1iZXJcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgZml4ZWQgcHJlY2lzaW9uLCBtaW4sIG1heFxuICAgICAqICBAcmV0dXJucyB7TnVtYmVyfSBhIHNpbmdsZSBmbG9hdGluZyBwb2ludCBudW1iZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gQ2FuIG9ubHkgc3BlY2lmeSBmaXhlZCBvciBwcmVjaXNpb24sIG5vdCBib3RoLiBBbHNvXG4gICAgICogICAgbWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gbWF4XG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5mbG9hdGluZyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQgOiA0fSk7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5wcmVjaXNpb24sXG4gICAgICAgICAgICBcIkNoYW5jZTogQ2Fubm90IHNwZWNpZnkgYm90aCBmaXhlZCBhbmQgcHJlY2lzaW9uLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIG51bTtcbiAgICAgICAgdmFyIGZpeGVkID0gTWF0aC5wb3coMTAsIG9wdGlvbnMuZml4ZWQpO1xuXG4gICAgICAgIHZhciBtYXggPSBNQVhfSU5UIC8gZml4ZWQ7XG4gICAgICAgIHZhciBtaW4gPSAtbWF4O1xuXG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMubWluICYmIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5taW4gPCBtaW4sXG4gICAgICAgICAgICBcIkNoYW5jZTogTWluIHNwZWNpZmllZCBpcyBvdXQgb2YgcmFuZ2Ugd2l0aCBmaXhlZC4gTWluIHNob3VsZCBiZSwgYXQgbGVhc3QsIFwiICsgbWluXG4gICAgICAgICk7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMubWF4ICYmIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5tYXggPiBtYXgsXG4gICAgICAgICAgICBcIkNoYW5jZTogTWF4IHNwZWNpZmllZCBpcyBvdXQgb2YgcmFuZ2Ugd2l0aCBmaXhlZC4gTWF4IHNob3VsZCBiZSwgYXQgbW9zdCwgXCIgKyBtYXhcbiAgICAgICAgKTtcblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBtaW4gOiBtaW4sIG1heCA6IG1heCB9KTtcblxuICAgICAgICAvLyBUb2RvIC0gTWFrZSB0aGlzIHdvcmshXG4gICAgICAgIC8vIG9wdGlvbnMucHJlY2lzaW9uID0gKHR5cGVvZiBvcHRpb25zLnByZWNpc2lvbiAhPT0gXCJ1bmRlZmluZWRcIikgPyBvcHRpb25zLnByZWNpc2lvbiA6IGZhbHNlO1xuXG4gICAgICAgIG51bSA9IHRoaXMuaW50ZWdlcih7bWluOiBvcHRpb25zLm1pbiAqIGZpeGVkLCBtYXg6IG9wdGlvbnMubWF4ICogZml4ZWR9KTtcbiAgICAgICAgdmFyIG51bV9maXhlZCA9IChudW0gLyBmaXhlZCkudG9GaXhlZChvcHRpb25zLmZpeGVkKTtcblxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChudW1fZml4ZWQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGludGVnZXJcbiAgICAgKlxuICAgICAqICBOT1RFIHRoZSBtYXggYW5kIG1pbiBhcmUgSU5DTFVERUQgaW4gdGhlIHJhbmdlLiBTbzpcbiAgICAgKiAgY2hhbmNlLmludGVnZXIoe21pbjogMSwgbWF4OiAzfSk7XG4gICAgICogIHdvdWxkIHJldHVybiBlaXRoZXIgMSwgMiwgb3IgMy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbWluIGFuZC9vciBtYXhcbiAgICAgKiAgQHJldHVybnMge051bWJlcn0gYSBzaW5nbGUgcmFuZG9tIGludGVnZXIgbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuaW50ZWdlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIDkwMDcxOTkyNTQ3NDA5OTIgKDJeNTMpIGlzIHRoZSBtYXggaW50ZWdlciBudW1iZXIgaW4gSmF2YVNjcmlwdFxuICAgICAgICAvLyBTZWU6IGh0dHA6Ly92cS5pby8xMzJzYTJqXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiBNSU5fSU5ULCBtYXg6IE1BWF9JTlR9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluID4gb3B0aW9ucy5tYXgsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBNYXguXCIpO1xuXG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKHRoaXMucmFuZG9tKCkgKiAob3B0aW9ucy5tYXggLSBvcHRpb25zLm1pbiArIDEpICsgb3B0aW9ucy5taW4pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIG5hdHVyYWxcbiAgICAgKlxuICAgICAqICBOT1RFIHRoZSBtYXggYW5kIG1pbiBhcmUgSU5DTFVERUQgaW4gdGhlIHJhbmdlLiBTbzpcbiAgICAgKiAgY2hhbmNlLm5hdHVyYWwoe21pbjogMSwgbWF4OiAzfSk7XG4gICAgICogIHdvdWxkIHJldHVybiBlaXRoZXIgMSwgMiwgb3IgMy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbWluIGFuZC9vciBtYXhcbiAgICAgKiAgQHJldHVybnMge051bWJlcn0gYSBzaW5nbGUgcmFuZG9tIGludGVnZXIgbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUubmF0dXJhbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiAwLCBtYXg6IE1BWF9JTlR9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIHplcm8uXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlZ2VyKG9wdGlvbnMpO1xuICAgIH07XG5cdFxuXHQvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGhleCBudW1iZXIgYXMgc3RyaW5nXG4gICAgICpcbiAgICAgKiAgTk9URSB0aGUgbWF4IGFuZCBtaW4gYXJlIElOQ0xVREVEIGluIHRoZSByYW5nZS4gU286XG4gICAgICogIGNoYW5jZS5oZXgoe21pbjogJzknLCBtYXg6ICdCJ30pO1xuICAgICAqICB3b3VsZCByZXR1cm4gZWl0aGVyICc5JywgJ0EnIG9yICdCJy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbWluIGFuZC9vciBtYXggYW5kL29yIGNhc2luZ1xuICAgICAqICBAcmV0dXJucyB7U3RyaW5nfSBhIHNpbmdsZSByYW5kb20gc3RyaW5nIGhleCBudW1iZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gbWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gbWF4XG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5oZXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogMCwgbWF4OiBNQVhfSU5ULCBjYXNpbmc6ICdsb3dlcid9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIHplcm8uXCIpO1xuXHRcdHZhciBpbnRlZ2VyID0gdGhpcy5uYXR1cmFsKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4fSk7XG5cdFx0aWYgKG9wdGlvbnMuY2FzaW5nID09PSAndXBwZXInKSB7XG5cdFx0XHRyZXR1cm4gaW50ZWdlci50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGludGVnZXIudG9TdHJpbmcoMTYpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIHN0cmluZ1xuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBsZW5ndGhcbiAgICAgKiAgQHJldHVybnMge1N0cmluZ30gYSBzdHJpbmcgb2YgcmFuZG9tIGxlbmd0aFxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBsZW5ndGggY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJpbmcgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBsZW5ndGg6IHRoaXMubmF0dXJhbCh7bWluOiA1LCBtYXg6IDIwfSkgfSk7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLmxlbmd0aCA8IDAsIFwiQ2hhbmNlOiBMZW5ndGggY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvLlwiKTtcbiAgICAgICAgdmFyIGxlbmd0aCA9IG9wdGlvbnMubGVuZ3RoLFxuICAgICAgICAgICAgdGV4dCA9IHRoaXMubih0aGlzLmNoYXJhY3RlciwgbGVuZ3RoLCBvcHRpb25zKTtcblxuICAgICAgICByZXR1cm4gdGV4dC5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgQmFzaWNzIC0tXG5cbiAgICAvLyAtLSBIZWxwZXJzIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNhcGl0YWxpemUgPSBmdW5jdGlvbiAod29yZCkge1xuICAgICAgICByZXR1cm4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc3Vic3RyKDEpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1peGluID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBmb3IgKHZhciBmdW5jX25hbWUgaW4gb2JqKSB7XG4gICAgICAgICAgICBDaGFuY2UucHJvdG90eXBlW2Z1bmNfbmFtZV0gPSBvYmpbZnVuY19uYW1lXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIEdpdmVuIGEgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgc29tZXRoaW5nIHJhbmRvbSBhbmQgYSBudW1iZXIgb2YgaXRlbXMgdG8gZ2VuZXJhdGUsXG4gICAgICogICAgcmV0dXJuIGFuIGFycmF5IG9mIGl0ZW1zIHdoZXJlIG5vbmUgcmVwZWF0LlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7RnVuY3Rpb259IGZuIHRoZSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBzb21ldGhpbmcgcmFuZG9tXG4gICAgICogIEBwYXJhbSB7TnVtYmVyfSBudW0gbnVtYmVyIG9mIHRlcm1zIHRvIGdlbmVyYXRlXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIGFueSBvcHRpb25zIHRvIHBhc3Mgb24gdG8gdGhlIGdlbmVyYXRvciBmdW5jdGlvblxuICAgICAqICBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IG9mIGxlbmd0aCBgbnVtYCB3aXRoIGV2ZXJ5IGl0ZW0gZ2VuZXJhdGVkIGJ5IGBmbmAgYW5kIHVuaXF1ZVxuICAgICAqXG4gICAgICogIFRoZXJlIGNhbiBiZSBtb3JlIHBhcmFtZXRlcnMgYWZ0ZXIgdGhlc2UuIEFsbCBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgYXJlIHByb3ZpZGVkIHRvIHRoZSBnaXZlbiBmdW5jdGlvblxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUudW5pcXVlID0gZnVuY3Rpb24oZm4sIG51bSwgb3B0aW9ucykge1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICB0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIixcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIGZ1bmN0aW9uLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIGNvbXBhcmF0b3IgPSBmdW5jdGlvbihhcnIsIHZhbCkgeyByZXR1cm4gYXJyLmluZGV4T2YodmFsKSAhPT0gLTE7IH07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbXBhcmF0b3IgPSBvcHRpb25zLmNvbXBhcmF0b3IgfHwgY29tcGFyYXRvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhcnIgPSBbXSwgY291bnQgPSAwLCByZXN1bHQsIE1BWF9EVVBMSUNBVEVTID0gbnVtICogNTAsIHBhcmFtcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcblxuICAgICAgICB3aGlsZSAoYXJyLmxlbmd0aCA8IG51bSkge1xuICAgICAgICAgICAgdmFyIGNsb25lZFBhcmFtcyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocGFyYW1zKSk7XG4gICAgICAgICAgICByZXN1bHQgPSBmbi5hcHBseSh0aGlzLCBjbG9uZWRQYXJhbXMpO1xuICAgICAgICAgICAgaWYgKCFjb21wYXJhdG9yKGFyciwgcmVzdWx0KSkge1xuICAgICAgICAgICAgICAgIGFyci5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgLy8gcmVzZXQgY291bnQgd2hlbiB1bmlxdWUgZm91bmRcbiAgICAgICAgICAgICAgICBjb3VudCA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgrK2NvdW50ID4gTUFYX0RVUExJQ0FURVMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogbnVtIGlzIGxpa2VseSB0b28gbGFyZ2UgZm9yIHNhbXBsZSBzZXRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIEdpdmVzIGFuIGFycmF5IG9mIG4gcmFuZG9tIHRlcm1zXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtGdW5jdGlvbn0gZm4gdGhlIGZ1bmN0aW9uIHRoYXQgZ2VuZXJhdGVzIHNvbWV0aGluZyByYW5kb21cbiAgICAgKiAgQHBhcmFtIHtOdW1iZXJ9IG4gbnVtYmVyIG9mIHRlcm1zIHRvIGdlbmVyYXRlXG4gICAgICogIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgb2YgbGVuZ3RoIGBuYCB3aXRoIGl0ZW1zIGdlbmVyYXRlZCBieSBgZm5gXG4gICAgICpcbiAgICAgKiAgVGhlcmUgY2FuIGJlIG1vcmUgcGFyYW1ldGVycyBhZnRlciB0aGVzZS4gQWxsIGFkZGl0aW9uYWwgcGFyYW1ldGVycyBhcmUgcHJvdmlkZWQgdG8gdGhlIGdpdmVuIGZ1bmN0aW9uXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uID0gZnVuY3Rpb24oZm4sIG4pIHtcbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgdHlwZW9mIGZuICE9PSBcImZ1bmN0aW9uXCIsXG4gICAgICAgICAgICBcIkNoYW5jZTogVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBmdW5jdGlvbi5cIlxuICAgICAgICApO1xuXG4gICAgICAgIGlmICh0eXBlb2YgbiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG4gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpID0gbiwgYXJyID0gW10sIHBhcmFtcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcblxuICAgICAgICAvLyBQcm92aWRpbmcgYSBuZWdhdGl2ZSBjb3VudCBzaG91bGQgcmVzdWx0IGluIGEgbm9vcC5cbiAgICAgICAgaSA9IE1hdGgubWF4KCAwLCBpICk7XG5cbiAgICAgICAgZm9yIChudWxsOyBpLS07IG51bGwpIHtcbiAgICAgICAgICAgIGFyci5wdXNoKGZuLmFwcGx5KHRoaXMsIHBhcmFtcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9O1xuXG4gICAgLy8gSC9UIHRvIFNPIGZvciB0aGlzIG9uZTogaHR0cDovL3ZxLmlvL090VXJaNVxuICAgIENoYW5jZS5wcm90b3R5cGUucGFkID0gZnVuY3Rpb24gKG51bWJlciwgd2lkdGgsIHBhZCkge1xuICAgICAgICAvLyBEZWZhdWx0IHBhZCB0byAwIGlmIG5vbmUgcHJvdmlkZWRcbiAgICAgICAgcGFkID0gcGFkIHx8ICcwJztcbiAgICAgICAgLy8gQ29udmVydCBudW1iZXIgdG8gYSBzdHJpbmdcbiAgICAgICAgbnVtYmVyID0gbnVtYmVyICsgJyc7XG4gICAgICAgIHJldHVybiBudW1iZXIubGVuZ3RoID49IHdpZHRoID8gbnVtYmVyIDogbmV3IEFycmF5KHdpZHRoIC0gbnVtYmVyLmxlbmd0aCArIDEpLmpvaW4ocGFkKSArIG51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gREVQUkVDQVRFRCBvbiAyMDE1LTEwLTAxXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5waWNrID0gZnVuY3Rpb24gKGFyciwgY291bnQpIHtcbiAgICAgICAgaWYgKGFyci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBDYW5ub3QgcGljaygpIGZyb20gYW4gZW1wdHkgYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFjb3VudCB8fCBjb3VudCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGFyclt0aGlzLm5hdHVyYWwoe21heDogYXJyLmxlbmd0aCAtIDF9KV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaHVmZmxlKGFycikuc2xpY2UoMCwgY291bnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEdpdmVuIGFuIGFycmF5LCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5waWNrb25lID0gZnVuY3Rpb24gKGFycikge1xuICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBDYW5ub3QgcGlja29uZSgpIGZyb20gYW4gZW1wdHkgYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFyclt0aGlzLm5hdHVyYWwoe21heDogYXJyLmxlbmd0aCAtIDF9KV07XG4gICAgfTtcblxuICAgIC8vIEdpdmVuIGFuIGFycmF5LCByZXR1cm5zIGEgcmFuZG9tIHNldCB3aXRoICdjb3VudCcgZWxlbWVudHNcbiAgICBDaGFuY2UucHJvdG90eXBlLnBpY2tzZXQgPSBmdW5jdGlvbiAoYXJyLCBjb3VudCkge1xuICAgICAgICBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IENhbm5vdCBwaWNrc2V0KCkgZnJvbSBhbiBlbXB0eSBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY291bnQgPCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogY291bnQgbXVzdCBiZSBwb3NpdGl2ZSBudW1iZXJcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFjb3VudCB8fCBjb3VudCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIFsgdGhpcy5waWNrb25lKGFycikgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNodWZmbGUoYXJyKS5zbGljZSgwLCBjb3VudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zaHVmZmxlID0gZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgb2xkX2FycmF5ID0gYXJyLnNsaWNlKDApLFxuICAgICAgICAgICAgbmV3X2FycmF5ID0gW10sXG4gICAgICAgICAgICBqID0gMCxcbiAgICAgICAgICAgIGxlbmd0aCA9IE51bWJlcihvbGRfYXJyYXkubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAvLyBQaWNrIGEgcmFuZG9tIGluZGV4IGZyb20gdGhlIGFycmF5XG4gICAgICAgICAgICBqID0gdGhpcy5uYXR1cmFsKHttYXg6IG9sZF9hcnJheS5sZW5ndGggLSAxfSk7XG4gICAgICAgICAgICAvLyBBZGQgaXQgdG8gdGhlIG5ldyBhcnJheVxuICAgICAgICAgICAgbmV3X2FycmF5W2ldID0gb2xkX2FycmF5W2pdO1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHRoYXQgZWxlbWVudCBmcm9tIHRoZSBvcmlnaW5hbCBhcnJheVxuICAgICAgICAgICAgb2xkX2FycmF5LnNwbGljZShqLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdfYXJyYXk7XG4gICAgfTtcblxuICAgIC8vIFJldHVybnMgYSBzaW5nbGUgaXRlbSBmcm9tIGFuIGFycmF5IHdpdGggcmVsYXRpdmUgd2VpZ2h0aW5nIG9mIG9kZHNcbiAgICBDaGFuY2UucHJvdG90eXBlLndlaWdodGVkID0gZnVuY3Rpb24gKGFyciwgd2VpZ2h0cywgdHJpbSkge1xuICAgICAgICBpZiAoYXJyLmxlbmd0aCAhPT0gd2VpZ2h0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBsZW5ndGggb2YgYXJyYXkgYW5kIHdlaWdodHMgbXVzdCBtYXRjaFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjYW4gd2VpZ2h0cyBhcnJheSBhbmQgc3VtIHZhbGlkIGVudHJpZXNcbiAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgIHZhciB2YWw7XG4gICAgICAgIGZvciAodmFyIHdlaWdodEluZGV4ID0gMDsgd2VpZ2h0SW5kZXggPCB3ZWlnaHRzLmxlbmd0aDsgKyt3ZWlnaHRJbmRleCkge1xuICAgICAgICAgICAgdmFsID0gd2VpZ2h0c1t3ZWlnaHRJbmRleF07XG4gICAgICAgICAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiYWxsIHdlaWdodHMgbXVzdCBiZSBudW1iZXJzXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsID4gMCkge1xuICAgICAgICAgICAgICAgIHN1bSArPSB2YWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VtID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogbm8gdmFsaWQgZW50cmllcyBpbiBhcnJheSB3ZWlnaHRzXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2VsZWN0IGEgdmFsdWUgd2l0aGluIHJhbmdlXG4gICAgICAgIHZhciBzZWxlY3RlZCA9IHRoaXMucmFuZG9tKCkgKiBzdW07XG5cbiAgICAgICAgLy8gZmluZCBhcnJheSBlbnRyeSBjb3JyZXNwb25kaW5nIHRvIHNlbGVjdGVkIHZhbHVlXG4gICAgICAgIHZhciB0b3RhbCA9IDA7XG4gICAgICAgIHZhciBsYXN0R29vZElkeCA9IC0xO1xuICAgICAgICB2YXIgY2hvc2VuSWR4O1xuICAgICAgICBmb3IgKHdlaWdodEluZGV4ID0gMDsgd2VpZ2h0SW5kZXggPCB3ZWlnaHRzLmxlbmd0aDsgKyt3ZWlnaHRJbmRleCkge1xuICAgICAgICAgICAgdmFsID0gd2VpZ2h0c1t3ZWlnaHRJbmRleF07XG4gICAgICAgICAgICB0b3RhbCArPSB2YWw7XG4gICAgICAgICAgICBpZiAodmFsID4gMCkge1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3RlZCA8PSB0b3RhbCkge1xuICAgICAgICAgICAgICAgICAgICBjaG9zZW5JZHggPSB3ZWlnaHRJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxhc3RHb29kSWR4ID0gd2VpZ2h0SW5kZXg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBhbnkgcG9zc2libGUgcm91bmRpbmcgZXJyb3IgY29tcGFyaXNvbiB0byBlbnN1cmUgc29tZXRoaW5nIGlzIHBpY2tlZFxuICAgICAgICAgICAgaWYgKHdlaWdodEluZGV4ID09PSAod2VpZ2h0cy5sZW5ndGggLSAxKSkge1xuICAgICAgICAgICAgICAgIGNob3NlbklkeCA9IGxhc3RHb29kSWR4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNob3NlbiA9IGFycltjaG9zZW5JZHhdO1xuICAgICAgICB0cmltID0gKHR5cGVvZiB0cmltID09PSAndW5kZWZpbmVkJykgPyBmYWxzZSA6IHRyaW07XG4gICAgICAgIGlmICh0cmltKSB7XG4gICAgICAgICAgICBhcnIuc3BsaWNlKGNob3NlbklkeCwgMSk7XG4gICAgICAgICAgICB3ZWlnaHRzLnNwbGljZShjaG9zZW5JZHgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNob3NlbjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIEhlbHBlcnMgLS1cblxuICAgIC8vIC0tIFRleHQgLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUucGFyYWdyYXBoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciBzZW50ZW5jZXMgPSBvcHRpb25zLnNlbnRlbmNlcyB8fCB0aGlzLm5hdHVyYWwoe21pbjogMywgbWF4OiA3fSksXG4gICAgICAgICAgICBzZW50ZW5jZV9hcnJheSA9IHRoaXMubih0aGlzLnNlbnRlbmNlLCBzZW50ZW5jZXMpO1xuXG4gICAgICAgIHJldHVybiBzZW50ZW5jZV9hcnJheS5qb2luKCcgJyk7XG4gICAgfTtcblxuICAgIC8vIENvdWxkIGdldCBzbWFydGVyIGFib3V0IHRoaXMgdGhhbiBnZW5lcmF0aW5nIHJhbmRvbSB3b3JkcyBhbmRcbiAgICAvLyBjaGFpbmluZyB0aGVtIHRvZ2V0aGVyLiBTdWNoIGFzOiBodHRwOi8vdnEuaW8vMWE1Y2VPaFxuICAgIENoYW5jZS5wcm90b3R5cGUuc2VudGVuY2UgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIHdvcmRzID0gb3B0aW9ucy53b3JkcyB8fCB0aGlzLm5hdHVyYWwoe21pbjogMTIsIG1heDogMTh9KSxcbiAgICAgICAgICAgIHB1bmN0dWF0aW9uID0gb3B0aW9ucy5wdW5jdHVhdGlvbixcbiAgICAgICAgICAgIHRleHQsIHdvcmRfYXJyYXkgPSB0aGlzLm4odGhpcy53b3JkLCB3b3Jkcyk7XG5cbiAgICAgICAgdGV4dCA9IHdvcmRfYXJyYXkuam9pbignICcpO1xuXG4gICAgICAgIC8vIENhcGl0YWxpemUgZmlyc3QgbGV0dGVyIG9mIHNlbnRlbmNlXG4gICAgICAgIHRleHQgPSB0aGlzLmNhcGl0YWxpemUodGV4dCk7XG5cbiAgICAgICAgLy8gTWFrZSBzdXJlIHB1bmN0dWF0aW9uIGhhcyBhIHVzYWJsZSB2YWx1ZVxuICAgICAgICBpZiAocHVuY3R1YXRpb24gIT09IGZhbHNlICYmICEvXltcXC5cXD87ITpdJC8udGVzdChwdW5jdHVhdGlvbikpIHtcbiAgICAgICAgICAgIHB1bmN0dWF0aW9uID0gJy4nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHB1bmN0dWF0aW9uIG1hcmtcbiAgICAgICAgaWYgKHB1bmN0dWF0aW9uKSB7XG4gICAgICAgICAgICB0ZXh0ICs9IHB1bmN0dWF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3lsbGFibGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIGxlbmd0aCA9IG9wdGlvbnMubGVuZ3RoIHx8IHRoaXMubmF0dXJhbCh7bWluOiAyLCBtYXg6IDN9KSxcbiAgICAgICAgICAgIGNvbnNvbmFudHMgPSAnYmNkZmdoamtsbW5wcnN0dnd6JywgLy8gY29uc29uYW50cyBleGNlcHQgaGFyZCB0byBzcGVhayBvbmVzXG4gICAgICAgICAgICB2b3dlbHMgPSAnYWVpb3UnLCAvLyB2b3dlbHNcbiAgICAgICAgICAgIGFsbCA9IGNvbnNvbmFudHMgKyB2b3dlbHMsIC8vIGFsbFxuICAgICAgICAgICAgdGV4dCA9ICcnLFxuICAgICAgICAgICAgY2hyO1xuXG4gICAgICAgIC8vIEknbSBzdXJlIHRoZXJlJ3MgYSBtb3JlIGVsZWdhbnQgd2F5IHRvIGRvIHRoaXMsIGJ1dCB0aGlzIHdvcmtzXG4gICAgICAgIC8vIGRlY2VudGx5IHdlbGwuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gRmlyc3QgY2hhcmFjdGVyIGNhbiBiZSBhbnl0aGluZ1xuICAgICAgICAgICAgICAgIGNociA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiBhbGx9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29uc29uYW50cy5pbmRleE9mKGNocikgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gTGFzdCBjaGFyYWN0ZXIgd2FzIGEgdm93ZWwsIG5vdyB3ZSB3YW50IGEgY29uc29uYW50XG4gICAgICAgICAgICAgICAgY2hyID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IGNvbnNvbmFudHN9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTGFzdCBjaGFyYWN0ZXIgd2FzIGEgY29uc29uYW50LCBub3cgd2Ugd2FudCBhIHZvd2VsXG4gICAgICAgICAgICAgICAgY2hyID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IHZvd2Vsc30pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0ZXh0ICs9IGNocjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNhcGl0YWxpemUpIHtcbiAgICAgICAgICAgIHRleHQgPSB0aGlzLmNhcGl0YWxpemUodGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53b3JkID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMuc3lsbGFibGVzICYmIG9wdGlvbnMubGVuZ3RoLFxuICAgICAgICAgICAgXCJDaGFuY2U6IENhbm5vdCBzcGVjaWZ5IGJvdGggc3lsbGFibGVzIEFORCBsZW5ndGguXCJcbiAgICAgICAgKTtcblxuICAgICAgICB2YXIgc3lsbGFibGVzID0gb3B0aW9ucy5zeWxsYWJsZXMgfHwgdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogM30pLFxuICAgICAgICAgICAgdGV4dCA9ICcnO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gRWl0aGVyIGJvdW5kIHdvcmQgYnkgbGVuZ3RoXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgdGV4dCArPSB0aGlzLnN5bGxhYmxlKCk7XG4gICAgICAgICAgICB9IHdoaWxlICh0ZXh0Lmxlbmd0aCA8IG9wdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBvcHRpb25zLmxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBPciBieSBudW1iZXIgb2Ygc3lsbGFibGVzXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN5bGxhYmxlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGV4dCArPSB0aGlzLnN5bGxhYmxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jYXBpdGFsaXplKSB7XG4gICAgICAgICAgICB0ZXh0ID0gdGhpcy5jYXBpdGFsaXplKHRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBUZXh0IC0tXG5cbiAgICAvLyAtLSBQZXJzb24gLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuYWdlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB2YXIgYWdlUmFuZ2U7XG5cbiAgICAgICAgc3dpdGNoIChvcHRpb25zLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2NoaWxkJzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDAsIG1heDogMTJ9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndGVlbic6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAxMywgbWF4OiAxOX07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdhZHVsdCc6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAxOCwgbWF4OiA2NX07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdzZW5pb3InOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogNjUsIG1heDogMTAwfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAwLCBtYXg6IDEwMH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMTgsIG1heDogNjV9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbChhZ2VSYW5nZSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYmlydGhkYXkgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgYWdlID0gdGhpcy5hZ2Uob3B0aW9ucyk7XG4gICAgICAgIHZhciBjdXJyZW50WWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnR5cGUpIHtcbiAgICAgICAgICAgIHZhciBtaW4gPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgdmFyIG1heCA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICBtaW4uc2V0RnVsbFllYXIoY3VycmVudFllYXIgLSBhZ2UgLSAxKTtcbiAgICAgICAgICAgIG1heC5zZXRGdWxsWWVhcihjdXJyZW50WWVhciAtIGFnZSk7XG5cbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgbWluOiBtaW4sXG4gICAgICAgICAgICAgICAgbWF4OiBtYXhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICB5ZWFyOiBjdXJyZW50WWVhciAtIGFnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRlKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvLyBDUEY7IElEIHRvIGlkZW50aWZ5IHRheHBheWVycyBpbiBCcmF6aWxcbiAgICBDaGFuY2UucHJvdG90eXBlLmNwZiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmb3JtYXR0ZWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIG4gPSB0aGlzLm4odGhpcy5uYXR1cmFsLCA5LCB7IG1heDogOSB9KTtcbiAgICAgICAgdmFyIGQxID0gbls4XSoyK25bN10qMytuWzZdKjQrbls1XSo1K25bNF0qNituWzNdKjcrblsyXSo4K25bMV0qOStuWzBdKjEwO1xuICAgICAgICBkMSA9IDExIC0gKGQxICUgMTEpO1xuICAgICAgICBpZiAoZDE+PTEwKSB7XG4gICAgICAgICAgICBkMSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGQyID0gZDEqMituWzhdKjMrbls3XSo0K25bNl0qNStuWzVdKjYrbls0XSo3K25bM10qOCtuWzJdKjkrblsxXSoxMCtuWzBdKjExO1xuICAgICAgICBkMiA9IDExIC0gKGQyICUgMTEpO1xuICAgICAgICBpZiAoZDI+PTEwKSB7XG4gICAgICAgICAgICBkMiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNwZiA9ICcnK25bMF0rblsxXStuWzJdKycuJytuWzNdK25bNF0rbls1XSsnLicrbls2XStuWzddK25bOF0rJy0nK2QxK2QyO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mb3JtYXR0ZWQgPyBjcGYgOiBjcGYucmVwbGFjZSgvXFxEL2csJycpO1xuICAgIH07XG5cbiAgICAvLyBDTlBKOiBJRCB0byBpZGVudGlmeSBjb21wYW5pZXMgaW4gQnJhemlsXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jbnBqID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGZvcm1hdHRlZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgbiA9IHRoaXMubih0aGlzLm5hdHVyYWwsIDEyLCB7IG1heDogMTIgfSk7XG4gICAgICAgIHZhciBkMSA9IG5bMTFdKjIrblsxMF0qMytuWzldKjQrbls4XSo1K25bN10qNituWzZdKjcrbls1XSo4K25bNF0qOStuWzNdKjIrblsyXSozK25bMV0qNCtuWzBdKjU7XG4gICAgICAgIGQxID0gMTEgLSAoZDEgJSAxMSk7XG4gICAgICAgIGlmIChkMTwyKSB7XG4gICAgICAgICAgICBkMSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGQyID0gZDEqMituWzExXSozK25bMTBdKjQrbls5XSo1K25bOF0qNituWzddKjcrbls2XSo4K25bNV0qOStuWzRdKjIrblszXSozK25bMl0qNCtuWzFdKjUrblswXSo2O1xuICAgICAgICBkMiA9IDExIC0gKGQyICUgMTEpO1xuICAgICAgICBpZiAoZDI8Mikge1xuICAgICAgICAgICAgZDIgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjbnBqID0gJycrblswXStuWzFdKycuJytuWzJdK25bM10rbls0XSsnLicrbls1XStuWzZdK25bN10rJy8nK25bOF0rbls5XStuWzEwXStuWzExXSsnLScrZDErZDI7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZvcm1hdHRlZCA/IGNucGogOiBjbnBqLnJlcGxhY2UoL1xcRC9nLCcnKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5maXJzdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Z2VuZGVyOiB0aGlzLmdlbmRlcigpLCBuYXRpb25hbGl0eTogJ2VuJ30pO1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuZ2V0KFwiZmlyc3ROYW1lc1wiKVtvcHRpb25zLmdlbmRlci50b0xvd2VyQ2FzZSgpXVtvcHRpb25zLm5hdGlvbmFsaXR5LnRvTG93ZXJDYXNlKCldKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wcm9mZXNzaW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuZ2V0KFwicHJvZmVzc2lvbnNcIikpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmdlbmRlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7ZXh0cmFHZW5kZXJzOiBbXX0pO1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKFsnTWFsZScsICdGZW1hbGUnXS5jb25jYXQob3B0aW9ucy5leHRyYUdlbmRlcnMpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sYXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtuYXRpb25hbGl0eTogJ2VuJ30pO1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuZ2V0KFwibGFzdE5hbWVzXCIpW29wdGlvbnMubmF0aW9uYWxpdHkudG9Mb3dlckNhc2UoKV0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmlzcmFlbElkPWZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciB4PXRoaXMuc3RyaW5nKHtwb29sOiAnMDEyMzQ1Njc4OScsbGVuZ3RoOjh9KTtcbiAgICAgICAgdmFyIHk9MDtcbiAgICAgICAgZm9yICh2YXIgaT0wO2k8eC5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHZhciB0aGlzRGlnaXQ9ICB4W2ldICogIChpLzI9PT1wYXJzZUludChpLzIpID8gMSA6IDIpO1xuICAgICAgICAgICAgdGhpc0RpZ2l0PXRoaXMucGFkKHRoaXNEaWdpdCwyKS50b1N0cmluZygpO1xuICAgICAgICAgICAgdGhpc0RpZ2l0PXBhcnNlSW50KHRoaXNEaWdpdFswXSkgKyBwYXJzZUludCh0aGlzRGlnaXRbMV0pO1xuICAgICAgICAgICAgeT15K3RoaXNEaWdpdDtcbiAgICAgICAgfVxuICAgICAgICB4PXgrKDEwLXBhcnNlSW50KHkudG9TdHJpbmcoKS5zbGljZSgtMSkpKS50b1N0cmluZygpLnNsaWNlKC0xKTtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubXJ6ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGNoZWNrRGlnaXQgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgICAgIHZhciBhbHBoYSA9IFwiPEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlYWlwiLnNwbGl0KCcnKSxcbiAgICAgICAgICAgICAgICBtdWx0aXBsaWVycyA9IFsgNywgMywgMSBdLFxuICAgICAgICAgICAgICAgIHJ1bm5pbmdUb3RhbCA9IDA7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQgPSBpbnB1dC50b1N0cmluZygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbnB1dC5zcGxpdCgnJykuZm9yRWFjaChmdW5jdGlvbihjaGFyYWN0ZXIsIGlkeCkge1xuICAgICAgICAgICAgICAgIHZhciBwb3MgPSBhbHBoYS5pbmRleE9mKGNoYXJhY3Rlcik7XG5cbiAgICAgICAgICAgICAgICBpZihwb3MgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoYXJhY3RlciA9IHBvcyA9PT0gMCA/IDAgOiBwb3MgKyA5O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNoYXJhY3RlciA9IHBhcnNlSW50KGNoYXJhY3RlciwgMTApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjaGFyYWN0ZXIgKj0gbXVsdGlwbGllcnNbaWR4ICUgbXVsdGlwbGllcnMubGVuZ3RoXTtcbiAgICAgICAgICAgICAgICBydW5uaW5nVG90YWwgKz0gY2hhcmFjdGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcnVubmluZ1RvdGFsICUgMTA7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBnZW5lcmF0ZSA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgICAgICB2YXIgcGFkID0gZnVuY3Rpb24gKGxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQXJyYXkobGVuZ3RoICsgMSkuam9pbignPCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciBudW1iZXIgPSBbICdQPCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmlzc3VlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMubGFzdC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgJzw8JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZmlyc3QudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZCgzOSAtIChvcHRzLmxhc3QubGVuZ3RoICsgb3B0cy5maXJzdC5sZW5ndGggKyAyKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLnBhc3Nwb3J0TnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChvcHRzLnBhc3Nwb3J0TnVtYmVyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMubmF0aW9uYWxpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmRvYixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrRGlnaXQob3B0cy5kb2IpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5nZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmV4cGlyeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrRGlnaXQob3B0cy5leHBpcnkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkKDE0KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrRGlnaXQocGFkKDE0KSkgXS5qb2luKCcnKTtcblxuICAgICAgICAgICAgcmV0dXJuIG51bWJlciArXG4gICAgICAgICAgICAgICAgKGNoZWNrRGlnaXQobnVtYmVyLnN1YnN0cig0NCwgMTApICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1iZXIuc3Vic3RyKDU3LCA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtYmVyLnN1YnN0cig2NSwgNykpKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGZpcnN0OiB0aGlzLmZpcnN0KCksXG4gICAgICAgICAgICBsYXN0OiB0aGlzLmxhc3QoKSxcbiAgICAgICAgICAgIHBhc3Nwb3J0TnVtYmVyOiB0aGlzLmludGVnZXIoe21pbjogMTAwMDAwMDAwLCBtYXg6IDk5OTk5OTk5OX0pLFxuICAgICAgICAgICAgZG9iOiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYXRlID0gdGhhdC5iaXJ0aGRheSh7dHlwZTogJ2FkdWx0J30pO1xuICAgICAgICAgICAgICAgIHJldHVybiBbZGF0ZS5nZXRGdWxsWWVhcigpLnRvU3RyaW5nKCkuc3Vic3RyKDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoZGF0ZS5nZXRNb250aCgpICsgMSwgMiksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChkYXRlLmdldERhdGUoKSwgMildLmpvaW4oJycpO1xuICAgICAgICAgICAgfSgpKSxcbiAgICAgICAgICAgIGV4cGlyeTogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFsoZGF0ZS5nZXRGdWxsWWVhcigpICsgNSkudG9TdHJpbmcoKS5zdWJzdHIoMiksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChkYXRlLmdldE1vbnRoKCkgKyAxLCAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0RGF0ZSgpLCAyKV0uam9pbignJyk7XG4gICAgICAgICAgICB9KCkpLFxuICAgICAgICAgICAgZ2VuZGVyOiB0aGlzLmdlbmRlcigpID09PSAnRmVtYWxlJyA/ICdGJzogJ00nLFxuICAgICAgICAgICAgaXNzdWVyOiAnR0JSJyxcbiAgICAgICAgICAgIG5hdGlvbmFsaXR5OiAnR0JSJ1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlIChvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciBmaXJzdCA9IHRoaXMuZmlyc3Qob3B0aW9ucyksXG4gICAgICAgICAgICBsYXN0ID0gdGhpcy5sYXN0KG9wdGlvbnMpLFxuICAgICAgICAgICAgbmFtZTtcblxuICAgICAgICBpZiAob3B0aW9ucy5taWRkbGUpIHtcbiAgICAgICAgICAgIG5hbWUgPSBmaXJzdCArICcgJyArIHRoaXMuZmlyc3Qob3B0aW9ucykgKyAnICcgKyBsYXN0O1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubWlkZGxlX2luaXRpYWwpIHtcbiAgICAgICAgICAgIG5hbWUgPSBmaXJzdCArICcgJyArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiAndXBwZXInfSkgKyAnLiAnICsgbGFzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hbWUgPSBmaXJzdCArICcgJyArIGxhc3Q7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wcmVmaXgpIHtcbiAgICAgICAgICAgIG5hbWUgPSB0aGlzLnByZWZpeChvcHRpb25zKSArICcgJyArIG5hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5zdWZmaXgpIHtcbiAgICAgICAgICAgIG5hbWUgPSBuYW1lICsgJyAnICsgdGhpcy5zdWZmaXgob3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmFtZTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIHRoZSBsaXN0IG9mIGF2YWlsYWJsZSBuYW1lIHByZWZpeGVzIGJhc2VkIG9uIHN1cHBsaWVkIGdlbmRlci5cbiAgICAvLyBAdG9kbyBpbnRyb2R1Y2UgaW50ZXJuYXRpb25hbGl6YXRpb25cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWVfcHJlZml4ZXMgPSBmdW5jdGlvbiAoZ2VuZGVyKSB7XG4gICAgICAgIGdlbmRlciA9IGdlbmRlciB8fCBcImFsbFwiO1xuICAgICAgICBnZW5kZXIgPSBnZW5kZXIudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICB2YXIgcHJlZml4ZXMgPSBbXG4gICAgICAgICAgICB7IG5hbWU6ICdEb2N0b3InLCBhYmJyZXZpYXRpb246ICdEci4nIH1cbiAgICAgICAgXTtcblxuICAgICAgICBpZiAoZ2VuZGVyID09PSBcIm1hbGVcIiB8fCBnZW5kZXIgPT09IFwiYWxsXCIpIHtcbiAgICAgICAgICAgIHByZWZpeGVzLnB1c2goeyBuYW1lOiAnTWlzdGVyJywgYWJicmV2aWF0aW9uOiAnTXIuJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChnZW5kZXIgPT09IFwiZmVtYWxlXCIgfHwgZ2VuZGVyID09PSBcImFsbFwiKSB7XG4gICAgICAgICAgICBwcmVmaXhlcy5wdXNoKHsgbmFtZTogJ01pc3MnLCBhYmJyZXZpYXRpb246ICdNaXNzJyB9KTtcbiAgICAgICAgICAgIHByZWZpeGVzLnB1c2goeyBuYW1lOiAnTWlzc2VzJywgYWJicmV2aWF0aW9uOiAnTXJzLicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJlZml4ZXM7XG4gICAgfTtcblxuICAgIC8vIEFsaWFzIGZvciBuYW1lX3ByZWZpeFxuICAgIENoYW5jZS5wcm90b3R5cGUucHJlZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmFtZV9wcmVmaXgob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZV9wcmVmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBnZW5kZXI6IFwiYWxsXCIgfSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZ1bGwgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMubmFtZV9wcmVmaXhlcyhvcHRpb25zLmdlbmRlcikpLm5hbWUgOlxuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMubmFtZV9wcmVmaXhlcyhvcHRpb25zLmdlbmRlcikpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuICAgIC8vSHVuZ2FyaWFuIElEIG51bWJlclxuICAgIENoYW5jZS5wcm90b3R5cGUuSElETj0gZnVuY3Rpb24oKXtcbiAgICAgLy9IdW5nYXJpYW4gSUQgbnViZXIgc3RydWN0dXJlOiBYWFhYWFhZWSAoWD1udW1iZXIsWT1DYXBpdGFsIExhdGluIGxldHRlcilcbiAgICAgIHZhciBpZG5fcG9vbD1cIjAxMjM0NTY3ODlcIjtcbiAgICAgIHZhciBpZG5fY2hycz1cIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlYWlwiO1xuICAgICAgdmFyIGlkbj1cIlwiO1xuICAgICAgICBpZG4rPXRoaXMuc3RyaW5nKHtwb29sOmlkbl9wb29sLGxlbmd0aDo2fSk7XG4gICAgICAgIGlkbis9dGhpcy5zdHJpbmcoe3Bvb2w6aWRuX2NocnMsbGVuZ3RoOjJ9KTtcbiAgICAgICAgcmV0dXJuIGlkbjtcbiAgICB9O1xuXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnNzbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7c3NuRm91cjogZmFsc2UsIGRhc2hlczogdHJ1ZX0pO1xuICAgICAgICB2YXIgc3NuX3Bvb2wgPSBcIjEyMzQ1Njc4OTBcIixcbiAgICAgICAgICAgIHNzbixcbiAgICAgICAgICAgIGRhc2ggPSBvcHRpb25zLmRhc2hlcyA/ICctJyA6ICcnO1xuXG4gICAgICAgIGlmKCFvcHRpb25zLnNzbkZvdXIpIHtcbiAgICAgICAgICAgIHNzbiA9IHRoaXMuc3RyaW5nKHtwb29sOiBzc25fcG9vbCwgbGVuZ3RoOiAzfSkgKyBkYXNoICtcbiAgICAgICAgICAgIHRoaXMuc3RyaW5nKHtwb29sOiBzc25fcG9vbCwgbGVuZ3RoOiAyfSkgKyBkYXNoICtcbiAgICAgICAgICAgIHRoaXMuc3RyaW5nKHtwb29sOiBzc25fcG9vbCwgbGVuZ3RoOiA0fSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzc24gPSB0aGlzLnN0cmluZyh7cG9vbDogc3NuX3Bvb2wsIGxlbmd0aDogNH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzc247XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgbGlzdCBvZiBhdmFpbGFibGUgbmFtZSBzdWZmaXhlc1xuICAgIC8vIEB0b2RvIGludHJvZHVjZSBpbnRlcm5hdGlvbmFsaXphdGlvblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZV9zdWZmaXhlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHN1ZmZpeGVzID0gW1xuICAgICAgICAgICAgeyBuYW1lOiAnRG9jdG9yIG9mIE9zdGVvcGF0aGljIE1lZGljaW5lJywgYWJicmV2aWF0aW9uOiAnRC5PLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0RvY3RvciBvZiBQaGlsb3NvcGh5JywgYWJicmV2aWF0aW9uOiAnUGguRC4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdFc3F1aXJlJywgYWJicmV2aWF0aW9uOiAnRXNxLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0p1bmlvcicsIGFiYnJldmlhdGlvbjogJ0pyLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0p1cmlzIERvY3RvcicsIGFiYnJldmlhdGlvbjogJ0ouRC4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdNYXN0ZXIgb2YgQXJ0cycsIGFiYnJldmlhdGlvbjogJ00uQS4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdNYXN0ZXIgb2YgQnVzaW5lc3MgQWRtaW5pc3RyYXRpb24nLCBhYmJyZXZpYXRpb246ICdNLkIuQS4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdNYXN0ZXIgb2YgU2NpZW5jZScsIGFiYnJldmlhdGlvbjogJ00uUy4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdNZWRpY2FsIERvY3RvcicsIGFiYnJldmlhdGlvbjogJ00uRC4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdTZW5pb3InLCBhYmJyZXZpYXRpb246ICdTci4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdUaGUgVGhpcmQnLCBhYmJyZXZpYXRpb246ICdJSUknIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdUaGUgRm91cnRoJywgYWJicmV2aWF0aW9uOiAnSVYnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdCYWNoZWxvciBvZiBFbmdpbmVlcmluZycsIGFiYnJldmlhdGlvbjogJ0IuRScgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0JhY2hlbG9yIG9mIFRlY2hub2xvZ3knLCBhYmJyZXZpYXRpb246ICdCLlRFQ0gnIH1cbiAgICAgICAgXTtcbiAgICAgICAgcmV0dXJuIHN1ZmZpeGVzO1xuICAgIH07XG5cbiAgICAvLyBBbGlhcyBmb3IgbmFtZV9zdWZmaXhcbiAgICBDaGFuY2UucHJvdG90eXBlLnN1ZmZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hbWVfc3VmZml4KG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWVfc3VmZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mdWxsID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfc3VmZml4ZXMoKSkubmFtZSA6XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5uYW1lX3N1ZmZpeGVzKCkpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYXRpb25hbGl0aWVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJuYXRpb25hbGl0aWVzXCIpO1xuICAgIH07XG5cbiAgICAvLyBHZW5lcmF0ZSByYW5kb20gbmF0aW9uYWxpdHkgYmFzZWQgb24ganNvbiBsaXN0XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYXRpb25hbGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5hdGlvbmFsaXR5ID0gdGhpcy5waWNrKHRoaXMubmF0aW9uYWxpdGllcygpKTtcbiAgICAgICAgcmV0dXJuIG5hdGlvbmFsaXR5Lm5hbWU7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBQZXJzb24gLS1cblxuICAgIC8vIC0tIE1vYmlsZSAtLVxuICAgIC8vIEFuZHJvaWQgR0NNIFJlZ2lzdHJhdGlvbiBJRFxuICAgIENoYW5jZS5wcm90b3R5cGUuYW5kcm9pZF9pZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFwiQVBBOTFcIiArIHRoaXMuc3RyaW5nKHsgcG9vbDogXCIwMTIzNDU2Nzg5YWJjZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaLV9cIiwgbGVuZ3RoOiAxNzggfSk7XG4gICAgfTtcblxuICAgIC8vIEFwcGxlIFB1c2ggVG9rZW5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFwcGxlX3Rva2VuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmcoeyBwb29sOiBcImFiY2RlZjEyMzQ1Njc4OTBcIiwgbGVuZ3RoOiA2NCB9KTtcbiAgICB9O1xuXG4gICAgLy8gV2luZG93cyBQaG9uZSA4IEFOSUQyXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53cDhfYW5pZDIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBiYXNlNjQoIHRoaXMuaGFzaCggeyBsZW5ndGggOiAzMiB9ICkgKTtcbiAgICB9O1xuXG4gICAgLy8gV2luZG93cyBQaG9uZSA3IEFOSURcbiAgICBDaGFuY2UucHJvdG90eXBlLndwN19hbmlkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ0E9JyArIHRoaXMuZ3VpZCgpLnJlcGxhY2UoLy0vZywgJycpLnRvVXBwZXJDYXNlKCkgKyAnJkU9JyArIHRoaXMuaGFzaCh7IGxlbmd0aDozIH0pICsgJyZXPScgKyB0aGlzLmludGVnZXIoeyBtaW46MCwgbWF4OjkgfSk7XG4gICAgfTtcblxuICAgIC8vIEJsYWNrQmVycnkgRGV2aWNlIFBJTlxuICAgIENoYW5jZS5wcm90b3R5cGUuYmJfcGluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5oYXNoKHsgbGVuZ3RoOiA4IH0pO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgTW9iaWxlIC0tXG5cbiAgICAvLyAtLSBXZWIgLS1cbiAgICBDaGFuY2UucHJvdG90eXBlLmF2YXRhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciB1cmwgPSBudWxsO1xuICAgICAgICB2YXIgVVJMX0JBU0UgPSAnLy93d3cuZ3JhdmF0YXIuY29tL2F2YXRhci8nO1xuICAgICAgICB2YXIgUFJPVE9DT0xTID0ge1xuICAgICAgICAgICAgaHR0cDogJ2h0dHAnLFxuICAgICAgICAgICAgaHR0cHM6ICdodHRwcydcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIEZJTEVfVFlQRVMgPSB7XG4gICAgICAgICAgICBibXA6ICdibXAnLFxuICAgICAgICAgICAgZ2lmOiAnZ2lmJyxcbiAgICAgICAgICAgIGpwZzogJ2pwZycsXG4gICAgICAgICAgICBwbmc6ICdwbmcnXG4gICAgICAgIH07XG4gICAgICAgIHZhciBGQUxMQkFDS1MgPSB7XG4gICAgICAgICAgICAnNDA0JzogJzQwNCcsIC8vIFJldHVybiA0MDQgaWYgbm90IGZvdW5kXG4gICAgICAgICAgICBtbTogJ21tJywgLy8gTXlzdGVyeSBtYW5cbiAgICAgICAgICAgIGlkZW50aWNvbjogJ2lkZW50aWNvbicsIC8vIEdlb21ldHJpYyBwYXR0ZXJuIGJhc2VkIG9uIGhhc2hcbiAgICAgICAgICAgIG1vbnN0ZXJpZDogJ21vbnN0ZXJpZCcsIC8vIEEgZ2VuZXJhdGVkIG1vbnN0ZXIgaWNvblxuICAgICAgICAgICAgd2F2YXRhcjogJ3dhdmF0YXInLCAvLyBBIGdlbmVyYXRlZCBmYWNlXG4gICAgICAgICAgICByZXRybzogJ3JldHJvJywgLy8gOC1iaXQgaWNvblxuICAgICAgICAgICAgYmxhbms6ICdibGFuaycgLy8gQSB0cmFuc3BhcmVudCBwbmdcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIFJBVElOR1MgPSB7XG4gICAgICAgICAgICBnOiAnZycsXG4gICAgICAgICAgICBwZzogJ3BnJyxcbiAgICAgICAgICAgIHI6ICdyJyxcbiAgICAgICAgICAgIHg6ICd4J1xuICAgICAgICB9O1xuICAgICAgICB2YXIgb3B0cyA9IHtcbiAgICAgICAgICAgIHByb3RvY29sOiBudWxsLFxuICAgICAgICAgICAgZW1haWw6IG51bGwsXG4gICAgICAgICAgICBmaWxlRXh0ZW5zaW9uOiBudWxsLFxuICAgICAgICAgICAgc2l6ZTogbnVsbCxcbiAgICAgICAgICAgIGZhbGxiYWNrOiBudWxsLFxuICAgICAgICAgICAgcmF0aW5nOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgICAgICAvLyBTZXQgdG8gYSByYW5kb20gZW1haWxcbiAgICAgICAgICAgIG9wdHMuZW1haWwgPSB0aGlzLmVtYWlsKCk7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBvcHRzLmVtYWlsID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuY29uc3RydWN0b3IgPT09ICdBcnJheScpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgb3B0cyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIG9wdHMpO1xuXG4gICAgICAgIGlmICghb3B0cy5lbWFpbCkge1xuICAgICAgICAgICAgLy8gU2V0IHRvIGEgcmFuZG9tIGVtYWlsXG4gICAgICAgICAgICBvcHRzLmVtYWlsID0gdGhpcy5lbWFpbCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2FmZSBjaGVja2luZyBmb3IgcGFyYW1zXG4gICAgICAgIG9wdHMucHJvdG9jb2wgPSBQUk9UT0NPTFNbb3B0cy5wcm90b2NvbF0gPyBvcHRzLnByb3RvY29sICsgJzonIDogJyc7XG4gICAgICAgIG9wdHMuc2l6ZSA9IHBhcnNlSW50KG9wdHMuc2l6ZSwgMCkgPyBvcHRzLnNpemUgOiAnJztcbiAgICAgICAgb3B0cy5yYXRpbmcgPSBSQVRJTkdTW29wdHMucmF0aW5nXSA/IG9wdHMucmF0aW5nIDogJyc7XG4gICAgICAgIG9wdHMuZmFsbGJhY2sgPSBGQUxMQkFDS1Nbb3B0cy5mYWxsYmFja10gPyBvcHRzLmZhbGxiYWNrIDogJyc7XG4gICAgICAgIG9wdHMuZmlsZUV4dGVuc2lvbiA9IEZJTEVfVFlQRVNbb3B0cy5maWxlRXh0ZW5zaW9uXSA/IG9wdHMuZmlsZUV4dGVuc2lvbiA6ICcnO1xuXG4gICAgICAgIHVybCA9XG4gICAgICAgICAgICBvcHRzLnByb3RvY29sICtcbiAgICAgICAgICAgIFVSTF9CQVNFICtcbiAgICAgICAgICAgIHRoaXMuYmltZDUubWQ1KG9wdHMuZW1haWwpICtcbiAgICAgICAgICAgIChvcHRzLmZpbGVFeHRlbnNpb24gPyAnLicgKyBvcHRzLmZpbGVFeHRlbnNpb24gOiAnJykgK1xuICAgICAgICAgICAgKG9wdHMuc2l6ZSB8fCBvcHRzLnJhdGluZyB8fCBvcHRzLmZhbGxiYWNrID8gJz8nIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLnNpemUgPyAnJnM9JyArIG9wdHMuc2l6ZS50b1N0cmluZygpIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLnJhdGluZyA/ICcmcj0nICsgb3B0cy5yYXRpbmcgOiAnJykgK1xuICAgICAgICAgICAgKG9wdHMuZmFsbGJhY2sgPyAnJmQ9JyArIG9wdHMuZmFsbGJhY2sgOiAnJylcbiAgICAgICAgICAgIDtcblxuICAgICAgICByZXR1cm4gdXJsO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAjRGVzY3JpcHRpb246XG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBHZW5lcmF0ZSByYW5kb20gY29sb3IgdmFsdWUgYmFzZSBvbiBjb2xvciB0eXBlOlxuICAgICAqIC0+IGhleFxuICAgICAqIC0+IHJnYlxuICAgICAqIC0+IHJnYmFcbiAgICAgKiAtPiAweFxuICAgICAqIC0+IG5hbWVkIGNvbG9yXG4gICAgICpcbiAgICAgKiAjRXhhbXBsZXM6XG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAqIEdlZXJhdGUgcmFuZG9tIGhleCBjb2xvclxuICAgICAqIGNoYW5jZS5jb2xvcigpID0+ICcjNzljMTU3JyAvICdyZ2IoMTEwLDUyLDE2NCknIC8gJzB4NjdhZTBiJyAvICcjZTJlMmUyJyAvICcjMjlDRkE3J1xuICAgICAqXG4gICAgICogKiBHZW5lcmF0ZSBIZXggYmFzZWQgY29sb3IgdmFsdWVcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2Zvcm1hdDogJ2hleCd9KSAgICA9PiAnI2Q2NzExOCdcbiAgICAgKlxuICAgICAqICogR2VuZXJhdGUgc2ltcGxlIHJnYiB2YWx1ZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Zm9ybWF0OiAncmdiJ30pICAgID0+ICdyZ2IoMTEwLDUyLDE2NCknXG4gICAgICpcbiAgICAgKiAqIEdlbmVyYXRlIE94IGJhc2VkIGNvbG9yIHZhbHVlXG4gICAgICogY2hhbmNlLmNvbG9yKHtmb3JtYXQ6ICcweCd9KSAgICAgPT4gJzB4NjdhZTBiJ1xuICAgICAqXG4gICAgICogKiBHZW5lcmF0ZSBncmFpc2NhbGUgYmFzZWQgdmFsdWVcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2dyYXlzY2FsZTogdHJ1ZX0pICA9PiAnI2UyZTJlMidcbiAgICAgKlxuICAgICAqICogUmV0dXJuIHZhbGlkZSBjb2xvciBuYW1lXG4gICAgICogY2hhbmNlLmNvbG9yKHtmb3JtYXQ6ICduYW1lJ30pICAgPT4gJ3JlZCdcbiAgICAgKlxuICAgICAqICogTWFrZSBjb2xvciB1cHBlcmNhc2VcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2Nhc2luZzogJ3VwcGVyJ30pICA9PiAnIzI5Q0ZBNydcblx0IFxuXHQgKiAqIE1pbiBNYXggdmFsdWVzIGZvciBSR0JBXG5cdCAqIHZhciBsaWdodF9yZWQgPSBjaGFuY2UuY29sb3Ioe2Zvcm1hdDogJ2hleCcsIG1pbl9yZWQ6IDIwMCwgbWF4X3JlZDogMjU1LCBtYXhfZ3JlZW46IDAsIG1heF9ibHVlOiAwLCBtaW5fYWxwaGE6IC4yLCBtYXhfYWxwaGE6IC4zfSk7XG4gICAgICpcbiAgICAgKiBAcGFyYW0gIFtvYmplY3RdIG9wdGlvbnNcbiAgICAgKiBAcmV0dXJuIFtzdHJpbmddIGNvbG9yIHZhbHVlXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb2xvciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cdFx0ZnVuY3Rpb24gcGFkKG4sIHdpZHRoLCB6KSB7XG5cdFx0XHR6ID0geiB8fCAnMCc7XG5cdFx0XHRuID0gbiArICcnO1xuXHRcdFx0cmV0dXJuIG4ubGVuZ3RoID49IHdpZHRoID8gbiA6IG5ldyBBcnJheSh3aWR0aCAtIG4ubGVuZ3RoICsgMSkuam9pbih6KSArIG47XG5cdFx0fVxuXHRcdFxuICAgICAgICBmdW5jdGlvbiBncmF5KHZhbHVlLCBkZWxpbWl0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdmFsdWUsIHZhbHVlLCB2YWx1ZV0uam9pbihkZWxpbWl0ZXIgfHwgJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmdiKGhhc0FscGhhKSB7XG4gICAgICAgICAgICB2YXIgcmdiVmFsdWUgICAgID0gKGhhc0FscGhhKSAgICA/ICdyZ2JhJyA6ICdyZ2InO1xuICAgICAgICAgICAgdmFyIGFscGhhQ2hhbm5lbCA9IChoYXNBbHBoYSkgICAgPyAoJywnICsgdGhpcy5mbG9hdGluZyh7bWluOm1pbl9hbHBoYSwgbWF4Om1heF9hbHBoYX0pKSA6IFwiXCI7XG4gICAgICAgICAgICB2YXIgY29sb3JWYWx1ZSAgID0gKGlzR3JheXNjYWxlKSA/IChncmF5KHRoaXMubmF0dXJhbCh7bWluOiBtaW5fcmdiLCBtYXg6IG1heF9yZ2J9KSwgJywnKSkgOiAodGhpcy5uYXR1cmFsKHttaW46IG1pbl9ncmVlbiwgbWF4OiBtYXhfZ3JlZW59KSArICcsJyArIHRoaXMubmF0dXJhbCh7bWluOiBtaW5fYmx1ZSwgbWF4OiBtYXhfYmx1ZX0pICsgJywnICsgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pKTtcbiAgICAgICAgICAgIHJldHVybiByZ2JWYWx1ZSArICcoJyArIGNvbG9yVmFsdWUgKyBhbHBoYUNoYW5uZWwgKyAnKSc7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoZXgoc3RhcnQsIGVuZCwgd2l0aEhhc2gpIHtcbiAgICAgICAgICAgIHZhciBzeW1ib2wgPSAod2l0aEhhc2gpID8gXCIjXCIgOiBcIlwiO1xuXHRcdFx0dmFyIGhleHN0cmluZyA9IFwiXCI7XG5cdFx0XHRcblx0XHRcdGlmIChpc0dyYXlzY2FsZSkge1xuXHRcdFx0XHRoZXhzdHJpbmcgPSBncmF5KHBhZCh0aGlzLmhleCh7bWluOiBtaW5fcmdiLCBtYXg6IG1heF9yZ2J9KSwgMikpO1xuXHRcdFx0XHRpZiAob3B0aW9ucy5mb3JtYXQgPT09IFwic2hvcnRoZXhcIikge1xuXHRcdFx0XHRcdGhleHN0cmluZyA9IGdyYXkodGhpcy5oZXgoe21pbjogMCwgbWF4OiAxNX0pKTtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhcImhleDogXCIgKyBoZXhzdHJpbmcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0aWYgKG9wdGlvbnMuZm9ybWF0ID09PSBcInNob3J0aGV4XCIpIHtcblx0XHRcdFx0XHRoZXhzdHJpbmcgPSBwYWQodGhpcy5oZXgoe21pbjogTWF0aC5mbG9vcihtaW5fcmVkIC8gMTYpLCBtYXg6IE1hdGguZmxvb3IobWF4X3JlZCAvIDE2KX0pLCAxKSArIHBhZCh0aGlzLmhleCh7bWluOiBNYXRoLmZsb29yKG1pbl9ncmVlbiAvIDE2KSwgbWF4OiBNYXRoLmZsb29yKG1heF9ncmVlbiAvIDE2KX0pLCAxKSArIHBhZCh0aGlzLmhleCh7bWluOiBNYXRoLmZsb29yKG1pbl9ibHVlIC8gMTYpLCBtYXg6IE1hdGguZmxvb3IobWF4X2JsdWUgLyAxNil9KSwgMSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAobWluX3JlZCAhPT0gdW5kZWZpbmVkIHx8IG1heF9yZWQgIT09IHVuZGVmaW5lZCB8fCBtaW5fZ3JlZW4gIT09IHVuZGVmaW5lZCB8fCBtYXhfZ3JlZW4gIT09IHVuZGVmaW5lZCB8fCBtaW5fYmx1ZSAhPT0gdW5kZWZpbmVkIHx8IG1heF9ibHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRoZXhzdHJpbmcgPSBwYWQodGhpcy5oZXgoe21pbjogbWluX3JlZCwgbWF4OiBtYXhfcmVkfSksIDIpICsgcGFkKHRoaXMuaGV4KHttaW46IG1pbl9ncmVlbiwgbWF4OiBtYXhfZ3JlZW59KSwgMikgKyBwYWQodGhpcy5oZXgoe21pbjogbWluX2JsdWUsIG1heDogbWF4X2JsdWV9KSwgMik7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0aGV4c3RyaW5nID0gcGFkKHRoaXMuaGV4KHttaW46IG1pbl9yZ2IsIG1heDogbWF4X3JnYn0pLCAyKSArIHBhZCh0aGlzLmhleCh7bWluOiBtaW5fcmdiLCBtYXg6IG1heF9yZ2J9KSwgMikgKyBwYWQodGhpcy5oZXgoe21pbjogbWluX3JnYiwgbWF4OiBtYXhfcmdifSksIDIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcbiAgICAgICAgICAgIHJldHVybiBzeW1ib2wgKyBoZXhzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZm9ybWF0OiB0aGlzLnBpY2soWydoZXgnLCAnc2hvcnRoZXgnLCAncmdiJywgJ3JnYmEnLCAnMHgnLCAnbmFtZSddKSxcbiAgICAgICAgICAgIGdyYXlzY2FsZTogZmFsc2UsXG4gICAgICAgICAgICBjYXNpbmc6ICdsb3dlcicsIFxuXHRcdFx0bWluOiAwLCBcblx0XHRcdG1heDogMjU1LCBcblx0XHRcdG1pbl9yZWQ6IHVuZGVmaW5lZCxcblx0XHRcdG1heF9yZWQ6IHVuZGVmaW5lZCwgXG5cdFx0XHRtaW5fZ3JlZW46IHVuZGVmaW5lZCxcblx0XHRcdG1heF9ncmVlbjogdW5kZWZpbmVkLCBcblx0XHRcdG1pbl9ibHVlOiB1bmRlZmluZWQsIFxuXHRcdFx0bWF4X2JsdWU6IHVuZGVmaW5lZCwgXG5cdFx0XHRtaW5fYWxwaGE6IDAsXG5cdFx0XHRtYXhfYWxwaGE6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGlzR3JheXNjYWxlID0gb3B0aW9ucy5ncmF5c2NhbGU7XG5cdFx0dmFyIG1pbl9yZ2IgPSBvcHRpb25zLm1pbjtcblx0XHR2YXIgbWF4X3JnYiA9IG9wdGlvbnMubWF4O1x0XHRcblx0XHR2YXIgbWluX3JlZCA9IG9wdGlvbnMubWluX3JlZDtcblx0XHR2YXIgbWF4X3JlZCA9IG9wdGlvbnMubWF4X3JlZDtcblx0XHR2YXIgbWluX2dyZWVuID0gb3B0aW9ucy5taW5fZ3JlZW47XG5cdFx0dmFyIG1heF9ncmVlbiA9IG9wdGlvbnMubWF4X2dyZWVuO1xuXHRcdHZhciBtaW5fYmx1ZSA9IG9wdGlvbnMubWluX2JsdWU7XG5cdFx0dmFyIG1heF9ibHVlID0gb3B0aW9ucy5tYXhfYmx1ZTtcblx0XHR2YXIgbWluX2FscGhhID0gb3B0aW9ucy5taW5fYWxwaGE7XG5cdFx0dmFyIG1heF9hbHBoYSA9IG9wdGlvbnMubWF4X2FscGhhO1xuXHRcdGlmIChvcHRpb25zLm1pbl9yZWQgPT09IHVuZGVmaW5lZCkgeyBtaW5fcmVkID0gbWluX3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1heF9yZWQgPT09IHVuZGVmaW5lZCkgeyBtYXhfcmVkID0gbWF4X3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1pbl9ncmVlbiA9PT0gdW5kZWZpbmVkKSB7IG1pbl9ncmVlbiA9IG1pbl9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5tYXhfZ3JlZW4gPT09IHVuZGVmaW5lZCkgeyBtYXhfZ3JlZW4gPSBtYXhfcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWluX2JsdWUgPT09IHVuZGVmaW5lZCkgeyBtaW5fYmx1ZSA9IG1pbl9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5tYXhfYmx1ZSA9PT0gdW5kZWZpbmVkKSB7IG1heF9ibHVlID0gbWF4X3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1pbl9hbHBoYSA9PT0gdW5kZWZpbmVkKSB7IG1pbl9hbHBoYSA9IDA7IH1cblx0XHRpZiAob3B0aW9ucy5tYXhfYWxwaGEgPT09IHVuZGVmaW5lZCkgeyBtYXhfYWxwaGEgPSAxOyB9XG5cdFx0aWYgKGlzR3JheXNjYWxlICYmIG1pbl9yZ2IgPT09IDAgJiYgbWF4X3JnYiA9PT0gMjU1ICYmIG1pbl9yZWQgIT09IHVuZGVmaW5lZCAmJiBtYXhfcmVkICE9PSB1bmRlZmluZWQpIHtcdFx0XHRcblx0XHRcdG1pbl9yZ2IgPSAoKG1pbl9yZWQgKyBtaW5fZ3JlZW4gKyBtaW5fYmx1ZSkgLyAzKTtcblx0XHRcdG1heF9yZ2IgPSAoKG1heF9yZWQgKyBtYXhfZ3JlZW4gKyBtYXhfYmx1ZSkgLyAzKTtcblx0XHR9XG4gICAgICAgIHZhciBjb2xvclZhbHVlO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ2hleCcpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSBoZXguY2FsbCh0aGlzLCAyLCA2LCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ3Nob3J0aGV4Jykge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IGhleC5jYWxsKHRoaXMsIDEsIDMsIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAncmdiJykge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IHJnYi5jYWxsKHRoaXMsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ3JnYmEnKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gcmdiLmNhbGwodGhpcywgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICcweCcpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSAnMHgnICsgaGV4LmNhbGwodGhpcywgMiwgNik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLmZvcm1hdCA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuZ2V0KFwiY29sb3JOYW1lc1wiKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCBmb3JtYXQgcHJvdmlkZWQuIFBsZWFzZSBwcm92aWRlIG9uZSBvZiBcImhleFwiLCBcInNob3J0aGV4XCIsIFwicmdiXCIsIFwicmdiYVwiLCBcIjB4XCIgb3IgXCJuYW1lXCIuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jYXNpbmcgPT09ICd1cHBlcicgKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gY29sb3JWYWx1ZS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbG9yVmFsdWU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZG9tYWluID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy53b3JkKCkgKyAnLicgKyAob3B0aW9ucy50bGQgfHwgdGhpcy50bGQoKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZW1haWwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzLndvcmQoe2xlbmd0aDogb3B0aW9ucy5sZW5ndGh9KSArICdAJyArIChvcHRpb25zLmRvbWFpbiB8fCB0aGlzLmRvbWFpbigpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5mYmlkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQoJzEwMDAwJyArIHRoaXMubmF0dXJhbCh7bWF4OiAxMDAwMDAwMDAwMDB9KSwgMTApO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmdvb2dsZV9hbmFseXRpY3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhY2NvdW50ID0gdGhpcy5wYWQodGhpcy5uYXR1cmFsKHttYXg6IDk5OTk5OX0pLCA2KTtcbiAgICAgICAgdmFyIHByb3BlcnR5ID0gdGhpcy5wYWQodGhpcy5uYXR1cmFsKHttYXg6IDk5fSksIDIpO1xuXG4gICAgICAgIHJldHVybiAnVUEtJyArIGFjY291bnQgKyAnLScgKyBwcm9wZXJ0eTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5oYXNodGFnID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyMnICsgdGhpcy53b3JkKCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFRvZG86IFRoaXMgY291bGQgcmV0dXJuIHNvbWUgcmVzZXJ2ZWQgSVBzLiBTZWUgaHR0cDovL3ZxLmlvLzEzN2RnWXlcbiAgICAgICAgLy8gdGhpcyBzaG91bGQgcHJvYmFibHkgYmUgdXBkYXRlZCB0byBhY2NvdW50IGZvciB0aGF0IHJhcmUgYXMgaXQgbWF5IGJlXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiAyNTR9KSArICcuJyArXG4gICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21heDogMjU1fSkgKyAnLicgK1xuICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJy4nICtcbiAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDI1NH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmlwdjYgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpcF9hZGRyID0gdGhpcy5uKHRoaXMuaGFzaCwgOCwge2xlbmd0aDogNH0pO1xuXG4gICAgICAgIHJldHVybiBpcF9hZGRyLmpvaW4oXCI6XCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmtsb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zZW12ZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBpbmNsdWRlX3ByZXJlbGVhc2U6IHRydWUgfSk7XG5cbiAgICAgICAgdmFyIHJhbmdlID0gdGhpcy5waWNrb25lKFtcIl5cIiwgXCJ+XCIsIFwiPFwiLCBcIj5cIiwgXCI8PVwiLCBcIj49XCIsIFwiPVwiXSk7XG4gICAgICAgIGlmIChvcHRpb25zLnJhbmdlKSB7XG4gICAgICAgICAgICByYW5nZSA9IG9wdGlvbnMucmFuZ2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJlcmVsZWFzZSA9IFwiXCI7XG4gICAgICAgIGlmIChvcHRpb25zLmluY2x1ZGVfcHJlcmVsZWFzZSkge1xuICAgICAgICAgICAgcHJlcmVsZWFzZSA9IHRoaXMud2VpZ2h0ZWQoW1wiXCIsIFwiLWRldlwiLCBcIi1iZXRhXCIsIFwiLWFscGhhXCJdLCBbNTAsIDEwLCA1LCAxXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhbmdlICsgdGhpcy5ycGcoJzNkMTAnKS5qb2luKCcuJykgKyBwcmVyZWxlYXNlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnRsZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBbJ2NvbScsICdvcmcnLCAnZWR1JywgJ2dvdicsICdjby51aycsICduZXQnLCAnaW8nLCAnYWMnLCAnYWQnLCAnYWUnLCAnYWYnLCAnYWcnLCAnYWknLCAnYWwnLCAnYW0nLCAnYW4nLCAnYW8nLCAnYXEnLCAnYXInLCAnYXMnLCAnYXQnLCAnYXUnLCAnYXcnLCAnYXgnLCAnYXonLCAnYmEnLCAnYmInLCAnYmQnLCAnYmUnLCAnYmYnLCAnYmcnLCAnYmgnLCAnYmknLCAnYmonLCAnYm0nLCAnYm4nLCAnYm8nLCAnYnEnLCAnYnInLCAnYnMnLCAnYnQnLCAnYnYnLCAnYncnLCAnYnknLCAnYnonLCAnY2EnLCAnY2MnLCAnY2QnLCAnY2YnLCAnY2cnLCAnY2gnLCAnY2knLCAnY2snLCAnY2wnLCAnY20nLCAnY24nLCAnY28nLCAnY3InLCAnY3UnLCAnY3YnLCAnY3cnLCAnY3gnLCAnY3knLCAnY3onLCAnZGUnLCAnZGonLCAnZGsnLCAnZG0nLCAnZG8nLCAnZHonLCAnZWMnLCAnZWUnLCAnZWcnLCAnZWgnLCAnZXInLCAnZXMnLCAnZXQnLCAnZXUnLCAnZmknLCAnZmonLCAnZmsnLCAnZm0nLCAnZm8nLCAnZnInLCAnZ2EnLCAnZ2InLCAnZ2QnLCAnZ2UnLCAnZ2YnLCAnZ2cnLCAnZ2gnLCAnZ2knLCAnZ2wnLCAnZ20nLCAnZ24nLCAnZ3AnLCAnZ3EnLCAnZ3InLCAnZ3MnLCAnZ3QnLCAnZ3UnLCAnZ3cnLCAnZ3knLCAnaGsnLCAnaG0nLCAnaG4nLCAnaHInLCAnaHQnLCAnaHUnLCAnaWQnLCAnaWUnLCAnaWwnLCAnaW0nLCAnaW4nLCAnaW8nLCAnaXEnLCAnaXInLCAnaXMnLCAnaXQnLCAnamUnLCAnam0nLCAnam8nLCAnanAnLCAna2UnLCAna2cnLCAna2gnLCAna2knLCAna20nLCAna24nLCAna3AnLCAna3InLCAna3cnLCAna3knLCAna3onLCAnbGEnLCAnbGInLCAnbGMnLCAnbGknLCAnbGsnLCAnbHInLCAnbHMnLCAnbHQnLCAnbHUnLCAnbHYnLCAnbHknLCAnbWEnLCAnbWMnLCAnbWQnLCAnbWUnLCAnbWcnLCAnbWgnLCAnbWsnLCAnbWwnLCAnbW0nLCAnbW4nLCAnbW8nLCAnbXAnLCAnbXEnLCAnbXInLCAnbXMnLCAnbXQnLCAnbXUnLCAnbXYnLCAnbXcnLCAnbXgnLCAnbXknLCAnbXonLCAnbmEnLCAnbmMnLCAnbmUnLCAnbmYnLCAnbmcnLCAnbmknLCAnbmwnLCAnbm8nLCAnbnAnLCAnbnInLCAnbnUnLCAnbnonLCAnb20nLCAncGEnLCAncGUnLCAncGYnLCAncGcnLCAncGgnLCAncGsnLCAncGwnLCAncG0nLCAncG4nLCAncHInLCAncHMnLCAncHQnLCAncHcnLCAncHknLCAncWEnLCAncmUnLCAncm8nLCAncnMnLCAncnUnLCAncncnLCAnc2EnLCAnc2InLCAnc2MnLCAnc2QnLCAnc2UnLCAnc2cnLCAnc2gnLCAnc2knLCAnc2onLCAnc2snLCAnc2wnLCAnc20nLCAnc24nLCAnc28nLCAnc3InLCAnc3MnLCAnc3QnLCAnc3UnLCAnc3YnLCAnc3gnLCAnc3knLCAnc3onLCAndGMnLCAndGQnLCAndGYnLCAndGcnLCAndGgnLCAndGonLCAndGsnLCAndGwnLCAndG0nLCAndG4nLCAndG8nLCAndHAnLCAndHInLCAndHQnLCAndHYnLCAndHcnLCAndHonLCAndWEnLCAndWcnLCAndWsnLCAndXMnLCAndXknLCAndXonLCAndmEnLCAndmMnLCAndmUnLCAndmcnLCAndmknLCAndm4nLCAndnUnLCAnd2YnLCAnd3MnLCAneWUnLCAneXQnLCAnemEnLCAnem0nLCAnencnXTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50bGQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy50bGRzKCkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnR3aXR0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnQCcgKyB0aGlzLndvcmQoKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS51cmwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBwcm90b2NvbDogXCJodHRwXCIsIGRvbWFpbjogdGhpcy5kb21haW4ob3B0aW9ucyksIGRvbWFpbl9wcmVmaXg6IFwiXCIsIHBhdGg6IHRoaXMud29yZCgpLCBleHRlbnNpb25zOiBbXX0pO1xuXG4gICAgICAgIHZhciBleHRlbnNpb24gPSBvcHRpb25zLmV4dGVuc2lvbnMubGVuZ3RoID4gMCA/IFwiLlwiICsgdGhpcy5waWNrKG9wdGlvbnMuZXh0ZW5zaW9ucykgOiBcIlwiO1xuICAgICAgICB2YXIgZG9tYWluID0gb3B0aW9ucy5kb21haW5fcHJlZml4ID8gb3B0aW9ucy5kb21haW5fcHJlZml4ICsgXCIuXCIgKyBvcHRpb25zLmRvbWFpbiA6IG9wdGlvbnMuZG9tYWluO1xuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnByb3RvY29sICsgXCI6Ly9cIiArIGRvbWFpbiArIFwiL1wiICsgb3B0aW9ucy5wYXRoICsgZXh0ZW5zaW9uO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZWdlcih7bWluOiAwLCBtYXg6IDY1NTM1fSk7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBXZWIgLS1cblxuICAgIC8vIC0tIExvY2F0aW9uIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFkZHJlc3MgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogNSwgbWF4OiAyMDAwfSkgKyAnICcgKyB0aGlzLnN0cmVldChvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hbHRpdHVkZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQ6IDUsIG1pbjogMCwgbWF4OiA4ODQ4fSk7XG4gICAgICAgIHJldHVybiB0aGlzLmZsb2F0aW5nKHtcbiAgICAgICAgICAgIG1pbjogb3B0aW9ucy5taW4sXG4gICAgICAgICAgICBtYXg6IG9wdGlvbnMubWF4LFxuICAgICAgICAgICAgZml4ZWQ6IG9wdGlvbnMuZml4ZWRcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYXJlYWNvZGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge3BhcmVucyA6IHRydWV9KTtcbiAgICAgICAgLy8gRG9uJ3Qgd2FudCBhcmVhIGNvZGVzIHRvIHN0YXJ0IHdpdGggMSwgb3IgaGF2ZSBhIDkgYXMgdGhlIHNlY29uZCBkaWdpdFxuICAgICAgICB2YXIgYXJlYWNvZGUgPSB0aGlzLm5hdHVyYWwoe21pbjogMiwgbWF4OiA5fSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttaW46IDAsIG1heDogOH0pLnRvU3RyaW5nKCkgK1xuICAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWluOiAwLCBtYXg6IDl9KS50b1N0cmluZygpO1xuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnBhcmVucyA/ICcoJyArIGFyZWFjb2RlICsgJyknIDogYXJlYWNvZGU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2l0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FwaXRhbGl6ZSh0aGlzLndvcmQoe3N5bGxhYmxlczogM30pKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb29yZGluYXRlcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxhdGl0dWRlKG9wdGlvbnMpICsgJywgJyArIHRoaXMubG9uZ2l0dWRlKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvdW50cmllcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwiY291bnRyaWVzXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvdW50cnkgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciBjb3VudHJ5ID0gdGhpcy5waWNrKHRoaXMuY291bnRyaWVzKCkpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mdWxsID8gY291bnRyeS5uYW1lIDogY291bnRyeS5hYmJyZXZpYXRpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZGVwdGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2ZpeGVkOiA1LCBtaW46IC0xMDk5NCwgbWF4OiAwfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmZsb2F0aW5nKHtcbiAgICAgICAgICAgIG1pbjogb3B0aW9ucy5taW4sXG4gICAgICAgICAgICBtYXg6IG9wdGlvbnMubWF4LFxuICAgICAgICAgICAgZml4ZWQ6IG9wdGlvbnMuZml4ZWRcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZ2VvaGFzaCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGxlbmd0aDogNyB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nKHsgbGVuZ3RoOiBvcHRpb25zLmxlbmd0aCwgcG9vbDogJzAxMjM0NTY3ODliY2RlZmdoamttbnBxcnN0dXZ3eHl6JyB9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZW9qc29uID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF0aXR1ZGUob3B0aW9ucykgKyAnLCAnICsgdGhpcy5sb25naXR1ZGUob3B0aW9ucykgKyAnLCAnICsgdGhpcy5hbHRpdHVkZShvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sYXRpdHVkZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQ6IDUsIG1pbjogLTkwLCBtYXg6IDkwfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmZsb2F0aW5nKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4LCBmaXhlZDogb3B0aW9ucy5maXhlZH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmxvbmdpdHVkZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQ6IDUsIG1pbjogLTE4MCwgbWF4OiAxODB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXgsIGZpeGVkOiBvcHRpb25zLmZpeGVkfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGhvbmUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBudW1QaWNrLFxuICAgICAgICAgICAgdWtOdW0gPSBmdW5jdGlvbiAocGFydHMpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VjdGlvbiA9IFtdO1xuICAgICAgICAgICAgICAgIC8vZmlsbHMgdGhlIHNlY3Rpb24gcGFydCBvZiB0aGUgcGhvbmUgbnVtYmVyIHdpdGggcmFuZG9tIG51bWJlcnMuXG4gICAgICAgICAgICAgICAgcGFydHMuc2VjdGlvbnMuZm9yRWFjaChmdW5jdGlvbihuKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlY3Rpb24ucHVzaChzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiBufSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0cy5hcmVhICsgc2VjdGlvbi5qb2luKCcgJyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZm9ybWF0dGVkOiB0cnVlLFxuICAgICAgICAgICAgY291bnRyeTogJ3VzJyxcbiAgICAgICAgICAgIG1vYmlsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghb3B0aW9ucy5mb3JtYXR0ZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucGFyZW5zID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBob25lO1xuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuY291bnRyeSkge1xuICAgICAgICAgICAgY2FzZSAnZnInOlxuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5tb2JpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZCB6b25lIGFuZCBkw6lwYXJ0ZW1lbnQgY29kZXMuXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDEnICsgdGhpcy5waWNrKFsnMzAnLCAnMzQnLCAnMzknLCAnNDAnLCAnNDEnLCAnNDInLCAnNDMnLCAnNDQnLCAnNDUnLCAnNDYnLCAnNDcnLCAnNDgnLCAnNDknLCAnNTMnLCAnNTUnLCAnNTYnLCAnNTgnLCAnNjAnLCAnNjQnLCAnNjknLCAnNzAnLCAnNzInLCAnNzMnLCAnNzQnLCAnNzUnLCAnNzYnLCAnNzcnLCAnNzgnLCAnNzknLCAnODAnLCAnODEnLCAnODInLCAnODMnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDInICsgdGhpcy5waWNrKFsnMTQnLCAnMTgnLCAnMjInLCAnMjMnLCAnMjgnLCAnMjknLCAnMzAnLCAnMzEnLCAnMzInLCAnMzMnLCAnMzQnLCAnMzUnLCAnMzYnLCAnMzcnLCAnMzgnLCAnNDAnLCAnNDEnLCAnNDMnLCAnNDQnLCAnNDUnLCAnNDYnLCAnNDcnLCAnNDgnLCAnNDknLCAnNTAnLCAnNTEnLCAnNTInLCAnNTMnLCAnNTQnLCAnNTYnLCAnNTcnLCAnNjEnLCAnNjInLCAnNjknLCAnNzInLCAnNzYnLCAnNzcnLCAnNzgnLCAnODUnLCAnOTAnLCAnOTYnLCAnOTcnLCAnOTgnLCAnOTknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDMnICsgdGhpcy5waWNrKFsnMTAnLCAnMjAnLCAnMjEnLCAnMjInLCAnMjMnLCAnMjQnLCAnMjUnLCAnMjYnLCAnMjcnLCAnMjgnLCAnMjknLCAnMzknLCAnNDQnLCAnNDUnLCAnNTEnLCAnNTInLCAnNTQnLCAnNTUnLCAnNTcnLCAnNTgnLCAnNTknLCAnNjAnLCAnNjEnLCAnNjInLCAnNjMnLCAnNjQnLCAnNjUnLCAnNjYnLCAnNjcnLCAnNjgnLCAnNjknLCAnNzAnLCAnNzEnLCAnNzInLCAnNzMnLCAnODAnLCAnODEnLCAnODInLCAnODMnLCAnODQnLCAnODUnLCAnODYnLCAnODcnLCAnODgnLCAnODknLCAnOTAnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDQnICsgdGhpcy5waWNrKFsnMTEnLCAnMTMnLCAnMTUnLCAnMjAnLCAnMjInLCAnMjYnLCAnMjcnLCAnMzAnLCAnMzInLCAnMzQnLCAnMzcnLCAnNDInLCAnNDMnLCAnNDQnLCAnNTAnLCAnNTYnLCAnNTcnLCAnNjMnLCAnNjYnLCAnNjcnLCAnNjgnLCAnNjknLCAnNzAnLCAnNzEnLCAnNzInLCAnNzMnLCAnNzQnLCAnNzUnLCAnNzYnLCAnNzcnLCAnNzgnLCAnNzknLCAnODAnLCAnODEnLCAnODInLCAnODMnLCAnODQnLCAnODUnLCAnODYnLCAnODgnLCAnODknLCAnOTAnLCAnOTEnLCAnOTInLCAnOTMnLCAnOTQnLCAnOTUnLCAnOTcnLCAnOTgnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDUnICsgdGhpcy5waWNrKFsnMDgnLCAnMTYnLCAnMTcnLCAnMTknLCAnMjQnLCAnMzEnLCAnMzInLCAnMzMnLCAnMzQnLCAnMzUnLCAnNDAnLCAnNDUnLCAnNDYnLCAnNDcnLCAnNDknLCAnNTMnLCAnNTUnLCAnNTYnLCAnNTcnLCAnNTgnLCAnNTknLCAnNjEnLCAnNjInLCAnNjMnLCAnNjQnLCAnNjUnLCAnNjcnLCAnNzknLCAnODEnLCAnODInLCAnODYnLCAnODcnLCAnOTAnLCAnOTQnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDknICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogOH0pLFxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCA/IG51bVBpY2subWF0Y2goLy4uL2cpLmpvaW4oJyAnKSA6IG51bVBpY2s7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbJzA2JywgJzA3J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogOH0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gbnVtUGljay5tYXRjaCgvLi4vZykuam9pbignICcpIDogbnVtUGljaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd1ayc6XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLm1vYmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vdmFsaWQgYXJlYSBjb2RlcyBvZiBtYWpvciBjaXRpZXMvY291bnRpZXMgZm9sbG93ZWQgYnkgcmFuZG9tIG51bWJlcnMgaW4gcmVxdWlyZWQgZm9ybWF0LlxuXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMScgKyB0aGlzLmNoYXJhY3Rlcih7IHBvb2w6ICcyMzQ1NjknIH0pICsgJzEgJywgc2VjdGlvbnM6IFszLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMjAgJyArIHRoaXMuY2hhcmFjdGVyKHsgcG9vbDogJzM3OCcgfSksIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDIzICcgKyB0aGlzLmNoYXJhY3Rlcih7IHBvb2w6ICc4OScgfSksIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDI0IDcnLCBzZWN0aW9uczogWzMsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAyOCAnICsgdGhpcy5waWNrKFsnMjUnLCcyOCcsJzM3JywnNzEnLCc4MicsJzkwJywnOTInLCc5NSddKSwgc2VjdGlvbnM6IFsyLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTInICsgdGhpcy5waWNrKFsnMDQnLCcwOCcsJzU0JywnNzYnLCc5NycsJzk4J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTMnICsgdGhpcy5waWNrKFsnNjMnLCc2NCcsJzg0JywnODYnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNCcgKyB0aGlzLnBpY2soWycwNCcsJzIwJywnNjAnLCc2MScsJzgwJywnODgnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNScgKyB0aGlzLnBpY2soWycyNCcsJzI3JywnNjInLCc2NiddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE2JyArIHRoaXMucGljayhbJzA2JywnMjknLCczNScsJzQ3JywnNTknLCc5NSddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE3JyArIHRoaXMucGljayhbJzI2JywnNDQnLCc1MCcsJzY4J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTgnICsgdGhpcy5waWNrKFsnMjcnLCczNycsJzg0JywnOTcnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxOScgKyB0aGlzLnBpY2soWycwMCcsJzA1JywnMzUnLCc0NicsJzQ5JywnNjMnLCc5NSddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9XG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gdWtOdW0obnVtUGljaykgOiB1a051bShudW1QaWNrKS5yZXBsYWNlKCcgJywgJycsICdnJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwNycgKyB0aGlzLnBpY2soWyc0JywnNScsJzcnLCc4JywnOSddKSwgc2VjdGlvbnM6IFsyLDZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwNzYyNCAnLCBzZWN0aW9uczogWzZdIH1cbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyB1a051bShudW1QaWNrKSA6IHVrTnVtKG51bVBpY2spLnJlcGxhY2UoJyAnLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnemEnOlxuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5tb2JpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICcwMScgKyB0aGlzLnBpY2soWycwJywgJzEnLCAnMicsICczJywgJzQnLCAnNScsICc2JywgJzcnLCAnOCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgJzAyJyArIHRoaXMucGljayhbJzEnLCAnMicsICczJywgJzQnLCAnNycsICc4J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICAgICAnMDMnICsgdGhpcy5waWNrKFsnMScsICcyJywgJzMnLCAnNScsICc2JywgJzknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgICAgICcwNCcgKyB0aGlzLnBpY2soWycxJywgJzInLCAnMycsICc0JywgJzUnLCc2JywnNycsICc4JywnOSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSwgICBcbiAgICAgICAgICAgICAgICAgICAgICAgJzA1JyArIHRoaXMucGljayhbJzEnLCAnMycsICc0JywgJzYnLCAnNycsICc4J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCB8fCBudW1QaWNrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAgJzA2MCcgKyB0aGlzLnBpY2soWyczJywnNCcsJzUnLCc2JywnNycsJzgnLCc5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA2MScgKyB0aGlzLnBpY2soWycwJywnMScsJzInLCczJywnNCcsJzUnLCc4J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA2JyAgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDcxJyArIHRoaXMucGljayhbJzAnLCcxJywnMicsJzMnLCc0JywnNScsJzYnLCc3JywnOCcsJzknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDcnICArIHRoaXMucGljayhbJzInLCczJywnNCcsJzYnLCc3JywnOCcsJzknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDgnICArIHRoaXMucGljayhbJzAnLCcxJywnMicsJzMnLCc0JywnNSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSwgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgfHwgbnVtUGljaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3VzJzpcbiAgICAgICAgICAgICAgICB2YXIgYXJlYWNvZGUgPSB0aGlzLmFyZWFjb2RlKG9wdGlvbnMpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgdmFyIGV4Y2hhbmdlID0gdGhpcy5uYXR1cmFsKHsgbWluOiAyLCBtYXg6IDkgfSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7IG1pbjogMCwgbWF4OiA5IH0pLnRvU3RyaW5nKCkgK1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoeyBtaW46IDAsIG1heDogOSB9KS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHZhciBzdWJzY3JpYmVyID0gdGhpcy5uYXR1cmFsKHsgbWluOiAxMDAwLCBtYXg6IDk5OTkgfSkudG9TdHJpbmcoKTsgLy8gdGhpcyBjb3VsZCBiZSByYW5kb20gWzAtOV17NH1cbiAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gYXJlYWNvZGUgKyAnICcgKyBleGNoYW5nZSArICctJyArIHN1YnNjcmliZXIgOiBhcmVhY29kZSArIGV4Y2hhbmdlICsgc3Vic2NyaWJlcjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGhvbmU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucG9zdGFsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBQb3N0YWwgRGlzdHJpY3RcbiAgICAgICAgdmFyIHBkID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IFwiWFZUU1JQTktMTUhKR0VDQkFcIn0pO1xuICAgICAgICAvLyBGb3J3YXJkIFNvcnRhdGlvbiBBcmVhIChGU0EpXG4gICAgICAgIHZhciBmc2EgPSBwZCArIHRoaXMubmF0dXJhbCh7bWF4OiA5fSkgKyB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSk7XG4gICAgICAgIC8vIExvY2FsIERlbGl2ZXJ5IFVudXQgKExEVSlcbiAgICAgICAgdmFyIGxkdSA9IHRoaXMubmF0dXJhbCh7bWF4OiA5fSkgKyB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSkgKyB0aGlzLm5hdHVyYWwoe21heDogOX0pO1xuXG4gICAgICAgIHJldHVybiBmc2EgKyBcIiBcIiArIGxkdTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb3VudGllcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICd1aycgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcImNvdW50aWVzXCIpW29wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpXTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb3VudHkgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuY291bnRpZXMob3B0aW9ucykpLm5hbWU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucHJvdmluY2VzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ2NhJyB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwicHJvdmluY2VzXCIpW29wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpXTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wcm92aW5jZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiAob3B0aW9ucyAmJiBvcHRpb25zLmZ1bGwpID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLnByb3ZpbmNlcyhvcHRpb25zKSkubmFtZSA6XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5wcm92aW5jZXMob3B0aW9ucykpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdGF0ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiAob3B0aW9ucyAmJiBvcHRpb25zLmZ1bGwpID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLnN0YXRlcyhvcHRpb25zKSkubmFtZSA6XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5zdGF0ZXMob3B0aW9ucykpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdGF0ZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAndXMnLCB1c19zdGF0ZXNfYW5kX2RjOiB0cnVlIH0gKTtcblxuICAgICAgICB2YXIgc3RhdGVzO1xuXG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgJ3VzJzpcbiAgICAgICAgICAgICAgICB2YXIgdXNfc3RhdGVzX2FuZF9kYyA9IHRoaXMuZ2V0KFwidXNfc3RhdGVzX2FuZF9kY1wiKSxcbiAgICAgICAgICAgICAgICAgICAgdGVycml0b3JpZXMgPSB0aGlzLmdldChcInRlcnJpdG9yaWVzXCIpLFxuICAgICAgICAgICAgICAgICAgICBhcm1lZF9mb3JjZXMgPSB0aGlzLmdldChcImFybWVkX2ZvcmNlc1wiKTtcblxuICAgICAgICAgICAgICAgIHN0YXRlcyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNfc3RhdGVzX2FuZF9kYykge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMgPSBzdGF0ZXMuY29uY2F0KHVzX3N0YXRlc19hbmRfZGMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy50ZXJyaXRvcmllcykge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMgPSBzdGF0ZXMuY29uY2F0KHRlcnJpdG9yaWVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuYXJtZWRfZm9yY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlcyA9IHN0YXRlcy5jb25jYXQoYXJtZWRfZm9yY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdpdCc6XG4gICAgICAgICAgICAgICAgc3RhdGVzID0gdGhpcy5nZXQoXCJjb3VudHJ5X3JlZ2lvbnNcIilbb3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCldO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndWsnOlxuICAgICAgICAgICAgICAgIHN0YXRlcyA9IHRoaXMuZ2V0KFwiY291bnRpZXNcIilbb3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCldO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlcztcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJlZXQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAndXMnLCBzeWxsYWJsZXM6IDIgfSk7XG4gICAgICAgIHZhciAgICAgc3RyZWV0O1xuXG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgJ3VzJzpcbiAgICAgICAgICAgICAgICBzdHJlZXQgPSB0aGlzLndvcmQoeyBzeWxsYWJsZXM6IG9wdGlvbnMuc3lsbGFibGVzIH0pO1xuICAgICAgICAgICAgICAgIHN0cmVldCA9IHRoaXMuY2FwaXRhbGl6ZShzdHJlZXQpO1xuICAgICAgICAgICAgICAgIHN0cmVldCArPSAnICc7XG4gICAgICAgICAgICAgICAgc3RyZWV0ICs9IG9wdGlvbnMuc2hvcnRfc3VmZml4ID9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHJlZXRfc3VmZml4KG9wdGlvbnMpLmFiYnJldmlhdGlvbiA6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyZWV0X3N1ZmZpeChvcHRpb25zKS5uYW1lO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnaXQnOlxuICAgICAgICAgICAgICAgIHN0cmVldCA9IHRoaXMud29yZCh7IHN5bGxhYmxlczogb3B0aW9ucy5zeWxsYWJsZXMgfSk7XG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gdGhpcy5jYXBpdGFsaXplKHN0cmVldCk7XG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gKG9wdGlvbnMuc2hvcnRfc3VmZml4ID9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHJlZXRfc3VmZml4KG9wdGlvbnMpLmFiYnJldmlhdGlvbiA6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyZWV0X3N1ZmZpeChvcHRpb25zKS5uYW1lKSArIFwiIFwiICsgc3RyZWV0O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdHJlZXQ7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3RyZWV0X3N1ZmZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICd1cycgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5zdHJlZXRfc3VmZml4ZXMob3B0aW9ucykpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmVldF9zdWZmaXhlcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICd1cycgfSk7XG4gICAgICAgIC8vIFRoZXNlIGFyZSB0aGUgbW9zdCBjb21tb24gc3VmZml4ZXMuXG4gICAgICAgIHJldHVybiB0aGlzLmdldChcInN0cmVldF9zdWZmaXhlc1wiKVtvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKV07XG4gICAgfTtcblxuICAgIC8vIE5vdGU6IG9ubHkgcmV0dXJuaW5nIFVTIHppcCBjb2RlcywgaW50ZXJuYXRpb25hbGl6YXRpb24gd2lsbCBiZSBhIHdob2xlXG4gICAgLy8gb3RoZXIgYmVhc3QgdG8gdGFja2xlIGF0IHNvbWUgcG9pbnQuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS56aXAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgemlwID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgNSwge21heDogOX0pO1xuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucGx1c2ZvdXIgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHppcC5wdXNoKCctJyk7XG4gICAgICAgICAgICB6aXAgPSB6aXAuY29uY2F0KHRoaXMubih0aGlzLm5hdHVyYWwsIDQsIHttYXg6IDl9KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gemlwLmpvaW4oXCJcIik7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBMb2NhdGlvbiAtLVxuXG4gICAgLy8gLS0gVGltZVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hbXBtID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib29sKCkgPyAnYW0nIDogJ3BtJztcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kYXRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGRhdGVfc3RyaW5nLCBkYXRlO1xuXG4gICAgICAgIC8vIElmIGludGVydmFsIGlzIHNwZWNpZmllZCB3ZSBpZ25vcmUgcHJlc2V0XG4gICAgICAgIGlmKG9wdGlvbnMgJiYgKG9wdGlvbnMubWluIHx8IG9wdGlvbnMubWF4KSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICBhbWVyaWNhbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzdHJpbmc6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciBtaW4gPSB0eXBlb2Ygb3B0aW9ucy5taW4gIT09IFwidW5kZWZpbmVkXCIgPyBvcHRpb25zLm1pbi5nZXRUaW1lKCkgOiAxO1xuICAgICAgICAgICAgLy8gMTAwLDAwMCwwMDAgZGF5cyBtZWFzdXJlZCByZWxhdGl2ZSB0byBtaWRuaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIDAxIEphbnVhcnksIDE5NzAgVVRDLiBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjkuMS4xXG4gICAgICAgICAgICB2YXIgbWF4ID0gdHlwZW9mIG9wdGlvbnMubWF4ICE9PSBcInVuZGVmaW5lZFwiID8gb3B0aW9ucy5tYXguZ2V0VGltZSgpIDogODY0MDAwMDAwMDAwMDAwMDtcblxuICAgICAgICAgICAgZGF0ZSA9IG5ldyBEYXRlKHRoaXMuaW50ZWdlcih7bWluOiBtaW4sIG1heDogbWF4fSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIG0gPSB0aGlzLm1vbnRoKHtyYXc6IHRydWV9KTtcbiAgICAgICAgICAgIHZhciBkYXlzSW5Nb250aCA9IG0uZGF5cztcblxuICAgICAgICAgICAgaWYob3B0aW9ucyAmJiBvcHRpb25zLm1vbnRoKSB7XG4gICAgICAgICAgICAgICAgLy8gTW9kIDEyIHRvIGFsbG93IG1vbnRocyBvdXRzaWRlIHJhbmdlIG9mIDAtMTEgKG5vdCBlbmNvdXJhZ2VkLCBidXQgYWxzbyBub3QgcHJldmVudGVkKS5cbiAgICAgICAgICAgICAgICBkYXlzSW5Nb250aCA9IHRoaXMuZ2V0KCdtb250aHMnKVsoKG9wdGlvbnMubW9udGggJSAxMikgKyAxMikgJSAxMl0uZGF5cztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICB5ZWFyOiBwYXJzZUludCh0aGlzLnllYXIoKSwgMTApLFxuICAgICAgICAgICAgICAgIC8vIE5lY2Vzc2FyeSB0byBzdWJ0cmFjdCAxIGJlY2F1c2UgRGF0ZSgpIDAtaW5kZXhlcyBtb250aCBidXQgbm90IGRheSBvciB5ZWFyXG4gICAgICAgICAgICAgICAgLy8gZm9yIHNvbWUgcmVhc29uLlxuICAgICAgICAgICAgICAgIG1vbnRoOiBtLm51bWVyaWMgLSAxLFxuICAgICAgICAgICAgICAgIGRheTogdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogZGF5c0luTW9udGh9KSxcbiAgICAgICAgICAgICAgICBob3VyOiB0aGlzLmhvdXIoe3R3ZW50eWZvdXI6IHRydWV9KSxcbiAgICAgICAgICAgICAgICBtaW51dGU6IHRoaXMubWludXRlKCksXG4gICAgICAgICAgICAgICAgc2Vjb25kOiB0aGlzLnNlY29uZCgpLFxuICAgICAgICAgICAgICAgIG1pbGxpc2Vjb25kOiB0aGlzLm1pbGxpc2Vjb25kKCksXG4gICAgICAgICAgICAgICAgYW1lcmljYW46IHRydWUsXG4gICAgICAgICAgICAgICAgc3RyaW5nOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRhdGUgPSBuZXcgRGF0ZShvcHRpb25zLnllYXIsIG9wdGlvbnMubW9udGgsIG9wdGlvbnMuZGF5LCBvcHRpb25zLmhvdXIsIG9wdGlvbnMubWludXRlLCBvcHRpb25zLnNlY29uZCwgb3B0aW9ucy5taWxsaXNlY29uZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5hbWVyaWNhbikge1xuICAgICAgICAgICAgLy8gQWRkaW5nIDEgdG8gdGhlIG1vbnRoIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIERhdGUoKSAwLWluZGV4ZXNcbiAgICAgICAgICAgIC8vIG1vbnRocyBidXQgbm90IGRheSBmb3Igc29tZSBvZGQgcmVhc29uLlxuICAgICAgICAgICAgZGF0ZV9zdHJpbmcgPSAoZGF0ZS5nZXRNb250aCgpICsgMSkgKyAnLycgKyBkYXRlLmdldERhdGUoKSArICcvJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRhdGVfc3RyaW5nID0gZGF0ZS5nZXREYXRlKCkgKyAnLycgKyAoZGF0ZS5nZXRNb250aCgpICsgMSkgKyAnLycgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5zdHJpbmcgPyBkYXRlX3N0cmluZyA6IGRhdGU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaGFtbWVydGltZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGUob3B0aW9ucykuZ2V0VGltZSgpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmhvdXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgbWluOiBvcHRpb25zICYmIG9wdGlvbnMudHdlbnR5Zm91ciA/IDAgOiAxLFxuICAgICAgICAgICAgbWF4OiBvcHRpb25zICYmIG9wdGlvbnMudHdlbnR5Zm91ciA/IDIzIDogMTJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIDAuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy50d2VudHlmb3VyICYmIG9wdGlvbnMubWF4ID4gMjMsIFwiQ2hhbmNlOiBNYXggY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiAyMyBmb3IgdHdlbnR5Zm91ciBvcHRpb24uXCIpO1xuICAgICAgICB0ZXN0UmFuZ2UoIW9wdGlvbnMudHdlbnR5Zm91ciAmJiBvcHRpb25zLm1heCA+IDEyLCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gMTIuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1pbGxpc2Vjb25kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttYXg6IDk5OX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1pbnV0ZSA9IENoYW5jZS5wcm90b3R5cGUuc2Vjb25kID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDAsIG1heDogNTl9KTtcblxuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAwLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gMC5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1heCA+IDU5LCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gNTkuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1vbnRoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDEsIG1heDogMTJ9KTtcblxuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAxLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gMS5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1heCA+IDEyLCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gMTIuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgdmFyIG1vbnRoID0gdGhpcy5waWNrKHRoaXMubW9udGhzKCkuc2xpY2Uob3B0aW9ucy5taW4gLSAxLCBvcHRpb25zLm1heCkpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5yYXcgPyBtb250aCA6IG1vbnRoLm5hbWU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubW9udGhzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJtb250aHNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc2Vjb25kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttYXg6IDU5fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudGltZXN0YW1wID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogcGFyc2VJbnQobmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwLCAxMCl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53ZWVrZGF5ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHt3ZWVrZGF5X29ubHk6IGZhbHNlfSk7XG4gICAgICAgIHZhciB3ZWVrZGF5cyA9IFtcIk1vbmRheVwiLCBcIlR1ZXNkYXlcIiwgXCJXZWRuZXNkYXlcIiwgXCJUaHVyc2RheVwiLCBcIkZyaWRheVwiXTtcbiAgICAgICAgaWYgKCFvcHRpb25zLndlZWtkYXlfb25seSkge1xuICAgICAgICAgICAgd2Vla2RheXMucHVzaChcIlNhdHVyZGF5XCIpO1xuICAgICAgICAgICAgd2Vla2RheXMucHVzaChcIlN1bmRheVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5waWNrb25lKHdlZWtkYXlzKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS55ZWFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gRGVmYXVsdCB0byBjdXJyZW50IHllYXIgYXMgbWluIGlmIG5vbmUgc3BlY2lmaWVkXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCl9KTtcblxuICAgICAgICAvLyBEZWZhdWx0IHRvIG9uZSBjZW50dXJ5IGFmdGVyIGN1cnJlbnQgeWVhciBhcyBtYXggaWYgbm9uZSBzcGVjaWZpZWRcbiAgICAgICAgb3B0aW9ucy5tYXggPSAodHlwZW9mIG9wdGlvbnMubWF4ICE9PSBcInVuZGVmaW5lZFwiKSA/IG9wdGlvbnMubWF4IDogb3B0aW9ucy5taW4gKyAxMDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbChvcHRpb25zKS50b1N0cmluZygpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgVGltZVxuXG4gICAgLy8gLS0gRmluYW5jZSAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jYyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgdHlwZSwgbnVtYmVyLCB0b19nZW5lcmF0ZTtcblxuICAgICAgICB0eXBlID0gKG9wdGlvbnMudHlwZSkgP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNjX3R5cGUoeyBuYW1lOiBvcHRpb25zLnR5cGUsIHJhdzogdHJ1ZSB9KSA6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2NfdHlwZSh7IHJhdzogdHJ1ZSB9KTtcblxuICAgICAgICBudW1iZXIgPSB0eXBlLnByZWZpeC5zcGxpdChcIlwiKTtcbiAgICAgICAgdG9fZ2VuZXJhdGUgPSB0eXBlLmxlbmd0aCAtIHR5cGUucHJlZml4Lmxlbmd0aCAtIDE7XG5cbiAgICAgICAgLy8gR2VuZXJhdGVzIG4gLSAxIGRpZ2l0c1xuICAgICAgICBudW1iZXIgPSBudW1iZXIuY29uY2F0KHRoaXMubih0aGlzLmludGVnZXIsIHRvX2dlbmVyYXRlLCB7bWluOiAwLCBtYXg6IDl9KSk7XG5cbiAgICAgICAgLy8gR2VuZXJhdGVzIHRoZSBsYXN0IGRpZ2l0IGFjY29yZGluZyB0byBMdWhuIGFsZ29yaXRobVxuICAgICAgICBudW1iZXIucHVzaCh0aGlzLmx1aG5fY2FsY3VsYXRlKG51bWJlci5qb2luKFwiXCIpKSk7XG5cbiAgICAgICAgcmV0dXJuIG51bWJlci5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNjX3R5cGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0JhbmtfY2FyZF9udW1iZXIjSXNzdWVyX2lkZW50aWZpY2F0aW9uX251bWJlcl8uMjhJSU4uMjlcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwiY2NfdHlwZXNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2NfdHlwZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIHR5cGVzID0gdGhpcy5jY190eXBlcygpLFxuICAgICAgICAgICAgdHlwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubmFtZSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIEFjY2VwdCBlaXRoZXIgbmFtZSBvciBzaG9ydF9uYW1lIHRvIHNwZWNpZnkgY2FyZCB0eXBlXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVzW2ldLm5hbWUgPT09IG9wdGlvbnMubmFtZSB8fCB0eXBlc1tpXS5zaG9ydF9uYW1lID09PSBvcHRpb25zLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA9IHR5cGVzW2ldO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ3JlZGl0IGNhcmQgdHlwZSAnXCIgKyBvcHRpb25zLm5hbWUgKyBcIicnIGlzIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0eXBlID0gdGhpcy5waWNrKHR5cGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnJhdyA/IHR5cGUgOiB0eXBlLm5hbWU7XG4gICAgfTtcblxuICAgIC8vcmV0dXJuIGFsbCB3b3JsZCBjdXJyZW5jeSBieSBJU08gNDIxN1xuICAgIENoYW5jZS5wcm90b3R5cGUuY3VycmVuY3lfdHlwZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcImN1cnJlbmN5X3R5cGVzXCIpO1xuICAgIH07XG5cbiAgICAvL3JldHVybiByYW5kb20gd29ybGQgY3VycmVuY3kgYnkgSVNPIDQyMTdcbiAgICBDaGFuY2UucHJvdG90eXBlLmN1cnJlbmN5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuY3VycmVuY3lfdHlwZXMoKSk7XG4gICAgfTtcblxuICAgIC8vcmV0dXJuIGFsbCB0aW1lem9uZXMgYXZhaWxhYmVsXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50aW1lem9uZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcInRpbWV6b25lc1wiKTtcbiAgICB9O1xuXG4gICAgLy9yZXR1cm4gcmFuZG9tIHRpbWV6b25lXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50aW1lem9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLnRpbWV6b25lcygpKTtcbiAgICB9O1xuXG4gICAgLy9SZXR1cm4gcmFuZG9tIGNvcnJlY3QgY3VycmVuY3kgZXhjaGFuZ2UgcGFpciAoZS5nLiBFVVIvVVNEKSBvciBhcnJheSBvZiBjdXJyZW5jeSBjb2RlXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jdXJyZW5jeV9wYWlyID0gZnVuY3Rpb24gKHJldHVybkFzU3RyaW5nKSB7XG4gICAgICAgIHZhciBjdXJyZW5jaWVzID0gdGhpcy51bmlxdWUodGhpcy5jdXJyZW5jeSwgMiwge1xuICAgICAgICAgICAgY29tcGFyYXRvcjogZnVuY3Rpb24oYXJyLCB2YWwpIHtcblxuICAgICAgICAgICAgICAgIHJldHVybiBhcnIucmVkdWNlKGZ1bmN0aW9uKGFjYywgaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIG1hdGNoIGhhcyBiZWVuIGZvdW5kLCBzaG9ydCBjaXJjdWl0IGNoZWNrIGFuZCBqdXN0IHJldHVyblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjIHx8IChpdGVtLmNvZGUgPT09IHZhbC5jb2RlKTtcbiAgICAgICAgICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXR1cm5Bc1N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbmNpZXNbMF0uY29kZSArICcvJyArIGN1cnJlbmNpZXNbMV0uY29kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW5jaWVzO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZG9sbGFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gQnkgZGVmYXVsdCwgYSBzb21ld2hhdCBtb3JlIHNhbmUgbWF4IGZvciBkb2xsYXIgdGhhbiBhbGwgYXZhaWxhYmxlIG51bWJlcnNcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttYXggOiAxMDAwMCwgbWluIDogMH0pO1xuXG4gICAgICAgIHZhciBkb2xsYXIgPSB0aGlzLmZsb2F0aW5nKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4LCBmaXhlZDogMn0pLnRvU3RyaW5nKCksXG4gICAgICAgICAgICBjZW50cyA9IGRvbGxhci5zcGxpdCgnLicpWzFdO1xuXG4gICAgICAgIGlmIChjZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkb2xsYXIgKz0gJy4wMCc7XG4gICAgICAgIH0gZWxzZSBpZiAoY2VudHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgZG9sbGFyID0gZG9sbGFyICsgJzAnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRvbGxhciA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiAnLSQnICsgZG9sbGFyLnJlcGxhY2UoJy0nLCAnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJyQnICsgZG9sbGFyO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZXVybyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBOdW1iZXIodGhpcy5kb2xsYXIob3B0aW9ucykucmVwbGFjZShcIiRcIiwgXCJcIikpLnRvTG9jYWxlU3RyaW5nKCkgKyBcIuKCrFwiO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmV4cCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGV4cCA9IHt9O1xuXG4gICAgICAgIGV4cC55ZWFyID0gdGhpcy5leHBfeWVhcigpO1xuXG4gICAgICAgIC8vIElmIHRoZSB5ZWFyIGlzIHRoaXMgeWVhciwgbmVlZCB0byBlbnN1cmUgbW9udGggaXMgZ3JlYXRlciB0aGFuIHRoZVxuICAgICAgICAvLyBjdXJyZW50IG1vbnRoIG9yIHRoaXMgZXhwaXJhdGlvbiB3aWxsIG5vdCBiZSB2YWxpZFxuICAgICAgICBpZiAoZXhwLnllYXIgPT09IChuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkpLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgICAgIGV4cC5tb250aCA9IHRoaXMuZXhwX21vbnRoKHtmdXR1cmU6IHRydWV9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cC5tb250aCA9IHRoaXMuZXhwX21vbnRoKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5yYXcgPyBleHAgOiBleHAubW9udGggKyAnLycgKyBleHAueWVhcjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5leHBfbW9udGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciBtb250aCwgbW9udGhfaW50LFxuICAgICAgICAgICAgLy8gRGF0ZSBvYmplY3QgbW9udGhzIGFyZSAwIGluZGV4ZWRcbiAgICAgICAgICAgIGN1ck1vbnRoID0gbmV3IERhdGUoKS5nZXRNb250aCgpICsgMTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mdXR1cmUgJiYgKGN1ck1vbnRoICE9PSAxMikpIHtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtb250aCA9IHRoaXMubW9udGgoe3JhdzogdHJ1ZX0pLm51bWVyaWM7XG4gICAgICAgICAgICAgICAgbW9udGhfaW50ID0gcGFyc2VJbnQobW9udGgsIDEwKTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1vbnRoX2ludCA8PSBjdXJNb250aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtb250aCA9IHRoaXMubW9udGgoe3JhdzogdHJ1ZX0pLm51bWVyaWM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9udGg7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZXhwX3llYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjdXJNb250aCA9IG5ldyBEYXRlKCkuZ2V0TW9udGgoKSArIDEsXG4gICAgICAgICAgICBjdXJZZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnllYXIoe21pbjogKChjdXJNb250aCA9PT0gMTIpID8gKGN1clllYXIgKyAxKSA6IGN1clllYXIpLCBtYXg6IChjdXJZZWFyICsgMTApfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudmF0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ2l0JyB9KTtcbiAgICAgICAgc3dpdGNoIChvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgY2FzZSAnaXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLml0X3ZhdCgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGEgc3RyaW5nIG1hdGNoaW5nIElCQU4gcGF0dGVybiAoaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW50ZXJuYXRpb25hbF9CYW5rX0FjY291bnRfTnVtYmVyKS4gXG4gICAgICogTm8gY291bnRyeS1zcGVjaWZpYyBmb3JtYXRzIHN1cHBvcnQgKHlldClcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmliYW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhbHBoYSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWic7XG4gICAgICAgIHZhciBhbHBoYW51bSA9IGFscGhhICsgJzAxMjM0NTY3ODknO1xuICAgICAgICB2YXIgaWJhbiA9IFxuICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBsZW5ndGg6IDIsIHBvb2w6IGFscGhhIH0pICsgXG4gICAgICAgICAgICB0aGlzLnBhZCh0aGlzLmludGVnZXIoeyBtaW46IDAsIG1heDogOTkgfSksIDIpICsgXG4gICAgICAgICAgICB0aGlzLnN0cmluZyh7IGxlbmd0aDogNCwgcG9vbDogYWxwaGFudW0gfSkgKyBcbiAgICAgICAgICAgIHRoaXMucGFkKHRoaXMubmF0dXJhbCgpLCB0aGlzLm5hdHVyYWwoeyBtaW46IDYsIG1heDogMjYgfSkpO1xuICAgICAgICByZXR1cm4gaWJhbjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIEZpbmFuY2VcblxuICAgIC8vIC0tIFJlZ2lvbmFsXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLml0X3ZhdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGl0X3ZhdCA9IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDE4MDAwMDB9KTtcblxuICAgICAgICBpdF92YXQgPSB0aGlzLnBhZChpdF92YXQsIDcpICsgdGhpcy5wYWQodGhpcy5waWNrKHRoaXMucHJvdmluY2VzKHsgY291bnRyeTogJ2l0JyB9KSkuY29kZSwgMyk7XG4gICAgICAgIHJldHVybiBpdF92YXQgKyB0aGlzLmx1aG5fY2FsY3VsYXRlKGl0X3ZhdCk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgICogdGhpcyBnZW5lcmF0b3IgaXMgd3JpdHRlbiBmb2xsb3dpbmcgdGhlIG9mZmljaWFsIGFsZ29yaXRobVxuICAgICAqIGFsbCBkYXRhIGNhbiBiZSBwYXNzZWQgZXhwbGljaXRlbHkgb3IgcmFuZG9taXplZCBieSBjYWxsaW5nIGNoYW5jZS5jZigpIHdpdGhvdXQgb3B0aW9uc1xuICAgICAqIHRoZSBjb2RlIGRvZXMgbm90IGNoZWNrIHRoYXQgdGhlIGlucHV0IGRhdGEgaXMgdmFsaWQgKGl0IGdvZXMgYmV5b25kIHRoZSBzY29wZSBvZiB0aGUgZ2VuZXJhdG9yKVxuICAgICAqXG4gICAgICogQHBhcmFtICBbT2JqZWN0XSBvcHRpb25zID0geyBmaXJzdDogZmlyc3QgbmFtZSxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3Q6IGxhc3QgbmFtZSxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdlbmRlcjogZmVtYWxlfG1hbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaXJ0aGRheTogSmF2YVNjcmlwdCBkYXRlIG9iamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNpdHk6IHN0cmluZyg0KSwgMSBsZXR0ZXIgKyAzIG51bWJlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAqIEByZXR1cm4gW3N0cmluZ10gY29kaWNlIGZpc2NhbGVcbiAgICAgKlxuICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jZiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB2YXIgZ2VuZGVyID0gISFvcHRpb25zLmdlbmRlciA/IG9wdGlvbnMuZ2VuZGVyIDogdGhpcy5nZW5kZXIoKSxcbiAgICAgICAgICAgIGZpcnN0ID0gISFvcHRpb25zLmZpcnN0ID8gb3B0aW9ucy5maXJzdCA6IHRoaXMuZmlyc3QoIHsgZ2VuZGVyOiBnZW5kZXIsIG5hdGlvbmFsaXR5OiAnaXQnfSApLFxuICAgICAgICAgICAgbGFzdCA9ICEhb3B0aW9ucy5sYXN0ID8gb3B0aW9ucy5sYXN0IDogdGhpcy5sYXN0KCB7IG5hdGlvbmFsaXR5OiAnaXQnfSApLFxuICAgICAgICAgICAgYmlydGhkYXkgPSAhIW9wdGlvbnMuYmlydGhkYXkgPyBvcHRpb25zLmJpcnRoZGF5IDogdGhpcy5iaXJ0aGRheSgpLFxuICAgICAgICAgICAgY2l0eSA9ICEhb3B0aW9ucy5jaXR5ID8gb3B0aW9ucy5jaXR5IDogdGhpcy5waWNrb25lKFsnQScsICdCJywgJ0MnLCAnRCcsICdFJywgJ0YnLCAnRycsICdIJywgJ0knLCAnTCcsICdNJywgJ1onXSkgKyB0aGlzLnBhZCh0aGlzLm5hdHVyYWwoe21heDo5OTl9KSwgMyksXG4gICAgICAgICAgICBjZiA9IFtdLFxuICAgICAgICAgICAgbmFtZV9nZW5lcmF0b3IgPSBmdW5jdGlvbihuYW1lLCBpc0xhc3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGVtcCxcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuX3ZhbHVlID0gW107XG5cbiAgICAgICAgICAgICAgICBpZiAobmFtZS5sZW5ndGggPCAzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybl92YWx1ZSA9IG5hbWUuc3BsaXQoXCJcIikuY29uY2F0KFwiWFhYXCIuc3BsaXQoXCJcIikpLnNwbGljZSgwLDMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGVtcCA9IG5hbWUudG9VcHBlckNhc2UoKS5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcIkJDREZHSEpLTE1OUFJTVFZXWlwiLmluZGV4T2YoYykgIT09IC0xKSA/IGMgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGVtcC5sZW5ndGggPiAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNMYXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcCA9IHRlbXAuc3Vic3RyKDAsMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXAgPSB0ZW1wWzBdICsgdGVtcC5zdWJzdHIoMiwyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodGVtcC5sZW5ndGggPCAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5fdmFsdWUgPSB0ZW1wO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcCA9IG5hbWUudG9VcHBlckNhc2UoKS5zcGxpdCgnJykubWFwKGZ1bmN0aW9uKGMpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXCJBRUlPVVwiLmluZGV4T2YoYykgIT09IC0xKSA/IGMgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcnKS5zdWJzdHIoMCwgMyAtIHJldHVybl92YWx1ZS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybl92YWx1ZSA9IHJldHVybl92YWx1ZSArIHRlbXA7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldHVybl92YWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkYXRlX2dlbmVyYXRvciA9IGZ1bmN0aW9uKGJpcnRoZGF5LCBnZW5kZXIsIHRoYXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGV0dGVybW9udGhzID0gWydBJywgJ0InLCAnQycsICdEJywgJ0UnLCAnSCcsICdMJywgJ00nLCAnUCcsICdSJywgJ1MnLCAnVCddO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuICBiaXJ0aGRheS5nZXRGdWxsWWVhcigpLnRvU3RyaW5nKCkuc3Vic3RyKDIpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldHRlcm1vbnRoc1tiaXJ0aGRheS5nZXRNb250aCgpXSArXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChiaXJ0aGRheS5nZXREYXRlKCkgKyAoKGdlbmRlci50b0xvd2VyQ2FzZSgpID09PSBcImZlbWFsZVwiKSA/IDQwIDogMCksIDIpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNoZWNrZGlnaXRfZ2VuZXJhdG9yID0gZnVuY3Rpb24oY2YpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmFuZ2UxID0gXCIwMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpcIixcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2UyID0gXCJBQkNERUZHSElKQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpcIixcbiAgICAgICAgICAgICAgICAgICAgZXZlbnMgID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWlwiLFxuICAgICAgICAgICAgICAgICAgICBvZGRzICAgPSBcIkJBS1BMQ1FEUkVWT1NGVEdVSE1JTkpXWllYXCIsXG4gICAgICAgICAgICAgICAgICAgIGRpZ2l0ICA9IDA7XG5cblxuICAgICAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCAxNTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpICUgMiAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlnaXQgKz0gZXZlbnMuaW5kZXhPZihyYW5nZTJbcmFuZ2UxLmluZGV4T2YoY2ZbaV0pXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWdpdCArPSAgb2Rkcy5pbmRleE9mKHJhbmdlMltyYW5nZTEuaW5kZXhPZihjZltpXSldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZXZlbnNbZGlnaXQgJSAyNl07XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGNmID0gY2YuY29uY2F0KG5hbWVfZ2VuZXJhdG9yKGxhc3QsIHRydWUpLCBuYW1lX2dlbmVyYXRvcihmaXJzdCksIGRhdGVfZ2VuZXJhdG9yKGJpcnRoZGF5LCBnZW5kZXIsIHRoaXMpLCBjaXR5LnRvVXBwZXJDYXNlKCkuc3BsaXQoXCJcIikpLmpvaW4oXCJcIik7XG4gICAgICAgIGNmICs9IGNoZWNrZGlnaXRfZ2VuZXJhdG9yKGNmLnRvVXBwZXJDYXNlKCksIHRoaXMpO1xuXG4gICAgICAgIHJldHVybiBjZi50b1VwcGVyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBsX3Blc2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbnVtYmVyID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTk5OTk5OTk5OX0pO1xuICAgICAgICB2YXIgYXJyID0gdGhpcy5wYWQobnVtYmVyLCAxMCkuc3BsaXQoJycpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJyW2ldID0gcGFyc2VJbnQoYXJyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250cm9sTnVtYmVyID0gKDEgKiBhcnJbMF0gKyAzICogYXJyWzFdICsgNyAqIGFyclsyXSArIDkgKiBhcnJbM10gKyAxICogYXJyWzRdICsgMyAqIGFycls1XSArIDcgKiBhcnJbNl0gKyA5ICogYXJyWzddICsgMSAqIGFycls4XSArIDMgKiBhcnJbOV0pICUgMTA7XG4gICAgICAgIGlmKGNvbnRyb2xOdW1iZXIgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnRyb2xOdW1iZXIgPSAxMCAtIGNvbnRyb2xOdW1iZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyLmpvaW4oJycpICsgY29udHJvbE51bWJlcjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wbF9uaXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBudW1iZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OTk5OTk5OTl9KTtcbiAgICAgICAgdmFyIGFyciA9IHRoaXMucGFkKG51bWJlciwgOSkuc3BsaXQoJycpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJyW2ldID0gcGFyc2VJbnQoYXJyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250cm9sTnVtYmVyID0gKDYgKiBhcnJbMF0gKyA1ICogYXJyWzFdICsgNyAqIGFyclsyXSArIDIgKiBhcnJbM10gKyAzICogYXJyWzRdICsgNCAqIGFycls1XSArIDUgKiBhcnJbNl0gKyA2ICogYXJyWzddICsgNyAqIGFycls4XSkgJSAxMTtcbiAgICAgICAgaWYoY29udHJvbE51bWJlciA9PT0gMTApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBsX25pcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFyci5qb2luKCcnKSArIGNvbnRyb2xOdW1iZXI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGxfcmVnb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBudW1iZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OTk5OTk5OX0pO1xuICAgICAgICB2YXIgYXJyID0gdGhpcy5wYWQobnVtYmVyLCA4KS5zcGxpdCgnJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcnJbaV0gPSBwYXJzZUludChhcnJbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnRyb2xOdW1iZXIgPSAoOCAqIGFyclswXSArIDkgKiBhcnJbMV0gKyAyICogYXJyWzJdICsgMyAqIGFyclszXSArIDQgKiBhcnJbNF0gKyA1ICogYXJyWzVdICsgNiAqIGFycls2XSArIDcgKiBhcnJbN10pICUgMTE7XG4gICAgICAgIGlmKGNvbnRyb2xOdW1iZXIgPT09IDEwKSB7XG4gICAgICAgICAgICBjb250cm9sTnVtYmVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnIuam9pbignJykgKyBjb250cm9sTnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgUmVnaW9uYWxcblxuICAgIC8vIC0tIE1pc2NlbGxhbmVvdXMgLS1cblxuICAgIC8vIERpY2UgLSBGb3IgYWxsIHRoZSBib2FyZCBnYW1lIGdlZWtzIG91dCB0aGVyZSwgbXlzZWxmIGluY2x1ZGVkIDspXG4gICAgZnVuY3Rpb24gZGljZUZuIChyYW5nZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbChyYW5nZSk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIENoYW5jZS5wcm90b3R5cGUuZDQgPSBkaWNlRm4oe21pbjogMSwgbWF4OiA0fSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kNiA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDZ9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQ4ID0gZGljZUZuKHttaW46IDEsIG1heDogOH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDEwID0gZGljZUZuKHttaW46IDEsIG1heDogMTB9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQxMiA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDEyfSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMjAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAyMH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDMwID0gZGljZUZuKHttaW46IDEsIG1heDogMzB9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQxMDAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAxMDB9KTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucnBnID0gZnVuY3Rpb24gKHRocm93biwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIGlmICghdGhyb3duKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkEgdHlwZSBvZiBkaWUgcm9sbCBtdXN0IGJlIGluY2x1ZGVkXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGJpdHMgPSB0aHJvd24udG9Mb3dlckNhc2UoKS5zcGxpdChcImRcIiksXG4gICAgICAgICAgICAgICAgcm9sbHMgPSBbXTtcblxuICAgICAgICAgICAgaWYgKGJpdHMubGVuZ3RoICE9PSAyIHx8ICFwYXJzZUludChiaXRzWzBdLCAxMCkgfHwgIXBhcnNlSW50KGJpdHNbMV0sIDEwKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgZm9ybWF0IHByb3ZpZGVkLiBQbGVhc2UgcHJvdmlkZSAjZCMgd2hlcmUgdGhlIGZpcnN0ICMgaXMgdGhlIG51bWJlciBvZiBkaWNlIHRvIHJvbGwsIHRoZSBzZWNvbmQgIyBpcyB0aGUgbWF4IG9mIGVhY2ggZGllXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IGJpdHNbMF07IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICByb2xsc1tpIC0gMV0gPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiBiaXRzWzFdfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gKHR5cGVvZiBvcHRpb25zLnN1bSAhPT0gJ3VuZGVmaW5lZCcgJiYgb3B0aW9ucy5zdW0pID8gcm9sbHMucmVkdWNlKGZ1bmN0aW9uIChwLCBjKSB7IHJldHVybiBwICsgYzsgfSkgOiByb2xscztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBHdWlkXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ndWlkID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgdmVyc2lvbjogNSB9KTtcblxuICAgICAgICB2YXIgZ3VpZF9wb29sID0gXCJhYmNkZWYxMjM0NTY3ODkwXCIsXG4gICAgICAgICAgICB2YXJpYW50X3Bvb2wgPSBcImFiODlcIixcbiAgICAgICAgICAgIGd1aWQgPSB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiA4IH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiA0IH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICAvLyBUaGUgVmVyc2lvblxuICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudmVyc2lvbiArXG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogMyB9KSArICctJyArXG4gICAgICAgICAgICAgICAgICAgLy8gVGhlIFZhcmlhbnRcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IHZhcmlhbnRfcG9vbCwgbGVuZ3RoOiAxIH0pICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiAzIH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiAxMiB9KTtcbiAgICAgICAgcmV0dXJuIGd1aWQ7XG4gICAgfTtcblxuICAgIC8vIEhhc2hcbiAgICBDaGFuY2UucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2xlbmd0aCA6IDQwLCBjYXNpbmc6ICdsb3dlcid9KTtcbiAgICAgICAgdmFyIHBvb2wgPSBvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJyA/IEhFWF9QT09MLnRvVXBwZXJDYXNlKCkgOiBIRVhfUE9PTDtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nKHtwb29sOiBwb29sLCBsZW5ndGg6IG9wdGlvbnMubGVuZ3RofSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubHVobl9jaGVjayA9IGZ1bmN0aW9uIChudW0pIHtcbiAgICAgICAgdmFyIHN0ciA9IG51bS50b1N0cmluZygpO1xuICAgICAgICB2YXIgY2hlY2tEaWdpdCA9ICtzdHIuc3Vic3RyaW5nKHN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgcmV0dXJuIGNoZWNrRGlnaXQgPT09IHRoaXMubHVobl9jYWxjdWxhdGUoK3N0ci5zdWJzdHJpbmcoMCwgc3RyLmxlbmd0aCAtIDEpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sdWhuX2NhbGN1bGF0ZSA9IGZ1bmN0aW9uIChudW0pIHtcbiAgICAgICAgdmFyIGRpZ2l0cyA9IG51bS50b1N0cmluZygpLnNwbGl0KFwiXCIpLnJldmVyc2UoKTtcbiAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgIHZhciBkaWdpdDtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRpZ2l0cy5sZW5ndGg7IGwgPiBpOyArK2kpIHtcbiAgICAgICAgICAgIGRpZ2l0ID0gK2RpZ2l0c1tpXTtcbiAgICAgICAgICAgIGlmIChpICUgMiA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRpZ2l0ICo9IDI7XG4gICAgICAgICAgICAgICAgaWYgKGRpZ2l0ID4gOSkge1xuICAgICAgICAgICAgICAgICAgICBkaWdpdCAtPSA5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN1bSArPSBkaWdpdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKHN1bSAqIDkpICUgMTA7XG4gICAgfTtcblxuICAgIC8vIE1ENSBIYXNoXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tZDUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBvcHRzID0geyBzdHI6ICcnLCBrZXk6IG51bGwsIHJhdzogZmFsc2UgfTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdHMuc3RyID0gdGhpcy5zdHJpbmcoKTtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wdHMuc3RyID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5jb25zdHJ1Y3RvciA9PT0gJ0FycmF5Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRzID0gaW5pdE9wdGlvbnMob3B0aW9ucywgb3B0cyk7XG5cbiAgICAgICAgaWYoIW9wdHMuc3RyKXtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQSBwYXJhbWV0ZXIgaXMgcmVxdWlyZWQgdG8gcmV0dXJuIGFuIG1kNSBoYXNoLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYmltZDUubWQ1KG9wdHMuc3RyLCBvcHRzLmtleSwgb3B0cy5yYXcpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAjRGVzY3JpcHRpb246XG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBHZW5lcmF0ZSByYW5kb20gZmlsZSBuYW1lIHdpdGggZXh0ZW5zaW9uXG4gICAgICpcbiAgICAgKiBUaGUgYXJndW1lbnQgcHJvdmlkZSBleHRlbnNpb24gdHlwZVxuICAgICAqIC0+IHJhc3RlclxuICAgICAqIC0+IHZlY3RvclxuICAgICAqIC0+IDNkXG4gICAgICogLT4gZG9jdW1lbnRcbiAgICAgKlxuICAgICAqIElmIG5vdGhpbmcgaXMgcHJvdmlkZWQgdGhlIGZ1bmN0aW9uIHJldHVybiByYW5kb20gZmlsZSBuYW1lIHdpdGggcmFuZG9tXG4gICAgICogZXh0ZW5zaW9uIHR5cGUgb2YgYW55IGtpbmRcbiAgICAgKlxuICAgICAqIFRoZSB1c2VyIGNhbiB2YWxpZGF0ZSB0aGUgZmlsZSBuYW1lIGxlbmd0aCByYW5nZVxuICAgICAqIElmIG5vdGhpbmcgcHJvdmlkZWQgdGhlIGdlbmVyYXRlZCBmaWxlIG5hbWUgaXMgcmFuZG9tXG4gICAgICpcbiAgICAgKiAjRXh0ZW5zaW9uIFBvb2wgOlxuICAgICAqICogQ3VycmVudGx5IHRoZSBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhcmVcbiAgICAgKiAgLT4gc29tZSBvZiB0aGUgbW9zdCBwb3B1bGFyIHJhc3RlciBpbWFnZSBleHRlbnNpb25zXG4gICAgICogIC0+IHNvbWUgb2YgdGhlIG1vc3QgcG9wdWxhciB2ZWN0b3IgaW1hZ2UgZXh0ZW5zaW9uc1xuICAgICAqICAtPiBzb21lIG9mIHRoZSBtb3N0IHBvcHVsYXIgM2QgaW1hZ2UgZXh0ZW5zaW9uc1xuICAgICAqICAtPiBzb21lIG9mIHRoZSBtb3N0IHBvcHVsYXIgZG9jdW1lbnQgZXh0ZW5zaW9uc1xuICAgICAqXG4gICAgICogI0V4YW1wbGVzIDpcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqXG4gICAgICogUmV0dXJuIHJhbmRvbSBmaWxlIG5hbWUgd2l0aCByYW5kb20gZXh0ZW5zaW9uLiBUaGUgZmlsZSBleHRlbnNpb25cbiAgICAgKiBpcyBwcm92aWRlZCBieSBhIHByZWRlZmluZWQgY29sbGVjdGlvbiBvZiBleHRlbnNpb25zLiBNb3JlIGFib3V0IHRoZSBleHRlbnNpb25cbiAgICAgKiBwb29sIGNhbiBiZSBmb3VuZCBpbiAjRXh0ZW5zaW9uIFBvb2wgc2VjdGlvblxuICAgICAqXG4gICAgICogY2hhbmNlLmZpbGUoKVxuICAgICAqID0+IGRzZnNkaGpmLnhtbFxuICAgICAqXG4gICAgICogSW4gb3JkZXIgdG8gZ2VuZXJhdGUgYSBmaWxlIG5hbWUgd2l0aCBzcGVjaWZpYyBsZW5ndGgsIHNwZWNpZnkgdGhlXG4gICAgICogbGVuZ3RoIHByb3BlcnR5IGFuZCBpbnRlZ2VyIHZhbHVlLiBUaGUgZXh0ZW5zaW9uIGlzIGdvaW5nIHRvIGJlIHJhbmRvbVxuICAgICAqXG4gICAgICogY2hhbmNlLmZpbGUoe2xlbmd0aCA6IDEwfSlcbiAgICAgKiA9PiBhc3J0aW5lcW9zLnBkZlxuICAgICAqXG4gICAgICogSW4gb3JkZXIgdG8gZ2VuZXJhdGUgZmlsZSB3aXRoIGV4dGVuc2lvbiBmcm9tIHNvbWUgb2YgdGhlIHByZWRlZmluZWQgZ3JvdXBzXG4gICAgICogb2YgdGhlIGV4dGVuc2lvbiBwb29sIGp1c3Qgc3BlY2lmeSB0aGUgZXh0ZW5zaW9uIHBvb2wgY2F0ZWdvcnkgaW4gZmlsZVR5cGUgcHJvcGVydHlcbiAgICAgKlxuICAgICAqIGNoYW5jZS5maWxlKHtmaWxlVHlwZSA6ICdyYXN0ZXInfSlcbiAgICAgKiA9PiBkc2hnc3Nkcy5wc2RcbiAgICAgKlxuICAgICAqIFlvdSBjYW4gcHJvdmlkZSBzcGVjaWZpYyBleHRlbnNpb24gZm9yIHlvdXIgZmlsZXNcbiAgICAgKiBjaGFuY2UuZmlsZSh7ZXh0ZW5zaW9uIDogJ2h0bWwnfSlcbiAgICAgKiA9PiBkamZzZC5odG1sXG4gICAgICpcbiAgICAgKiBPciB5b3UgY291bGQgcGFzcyBjdXN0b20gY29sbGVjdGlvbiBvZiBleHRlbnNpb25zIGJ5IGFycmF5IG9yIGJ5IG9iamVjdFxuICAgICAqIGNoYW5jZS5maWxlKHtleHRlbnNpb25zIDogWy4uLl19KVxuICAgICAqID0+IGRoZ3Nkc2QucHNkXG4gICAgICpcbiAgICAgKiBjaGFuY2UuZmlsZSh7ZXh0ZW5zaW9ucyA6IHsga2V5IDogWy4uLl0sIGtleSA6IFsuLi5dfX0pXG4gICAgICogPT4gZGpzZmtzZGpzZC54bWxcbiAgICAgKlxuICAgICAqIEBwYXJhbSAgW2NvbGxlY3Rpb25dIG9wdGlvbnNcbiAgICAgKiBAcmV0dXJuIFtzdHJpbmddXG4gICAgICpcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmZpbGUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG5cbiAgICAgICAgdmFyIGZpbGVPcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgdmFyIHBvb2xDb2xsZWN0aW9uS2V5ID0gXCJmaWxlRXh0ZW5zaW9uXCI7XG4gICAgICAgIHZhciB0eXBlUmFuZ2UgICA9IE9iamVjdC5rZXlzKHRoaXMuZ2V0KFwiZmlsZUV4dGVuc2lvblwiKSk7Ly9bJ3Jhc3RlcicsICd2ZWN0b3InLCAnM2QnLCAnZG9jdW1lbnQnXTtcbiAgICAgICAgdmFyIGZpbGVOYW1lO1xuICAgICAgICB2YXIgZmlsZUV4dGVuc2lvbjtcblxuICAgICAgICAvLyBHZW5lcmF0ZSByYW5kb20gZmlsZSBuYW1lXG4gICAgICAgIGZpbGVOYW1lID0gdGhpcy53b3JkKHtsZW5ndGggOiBmaWxlT3B0aW9ucy5sZW5ndGh9KTtcblxuICAgICAgICAvLyBHZW5lcmF0ZSBmaWxlIGJ5IHNwZWNpZmljIGV4dGVuc2lvbiBwcm92aWRlZCBieSB0aGUgdXNlclxuICAgICAgICBpZihmaWxlT3B0aW9ucy5leHRlbnNpb24pIHtcblxuICAgICAgICAgICAgZmlsZUV4dGVuc2lvbiA9IGZpbGVPcHRpb25zLmV4dGVuc2lvbjtcbiAgICAgICAgICAgIHJldHVybiAoZmlsZU5hbWUgKyAnLicgKyBmaWxlRXh0ZW5zaW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIGZpbGUgYnkgc3BlY2lmaWMgZXh0ZW5zaW9uIGNvbGxlY3Rpb25cbiAgICAgICAgaWYoZmlsZU9wdGlvbnMuZXh0ZW5zaW9ucykge1xuXG4gICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGZpbGVPcHRpb25zLmV4dGVuc2lvbnMpKSB7XG5cbiAgICAgICAgICAgICAgICBmaWxlRXh0ZW5zaW9uID0gdGhpcy5waWNrb25lKGZpbGVPcHRpb25zLmV4dGVuc2lvbnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoZmlsZU5hbWUgKyAnLicgKyBmaWxlRXh0ZW5zaW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYoZmlsZU9wdGlvbnMuZXh0ZW5zaW9ucy5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0ZW5zaW9uT2JqZWN0Q29sbGVjdGlvbiA9IGZpbGVPcHRpb25zLmV4dGVuc2lvbnM7XG4gICAgICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhleHRlbnNpb25PYmplY3RDb2xsZWN0aW9uKTtcblxuICAgICAgICAgICAgICAgIGZpbGVFeHRlbnNpb24gPSB0aGlzLnBpY2tvbmUoZXh0ZW5zaW9uT2JqZWN0Q29sbGVjdGlvblt0aGlzLnBpY2tvbmUoa2V5cyldKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGZpbGVOYW1lICsgJy4nICsgZmlsZUV4dGVuc2lvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdCBjb2xsZWN0aW9uIG9mIHR5cGUgQXJyYXkgb3IgT2JqZWN0IHRvIGJlIHBhc3NlZCBhcyBhbiBhcmd1bWVudCBcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBmaWxlIGV4dGVuc2lvbiBiYXNlZCBvbiBzcGVjaWZpYyBmaWxlIHR5cGVcbiAgICAgICAgaWYoZmlsZU9wdGlvbnMuZmlsZVR5cGUpIHtcblxuICAgICAgICAgICAgdmFyIGZpbGVUeXBlID0gZmlsZU9wdGlvbnMuZmlsZVR5cGU7XG4gICAgICAgICAgICBpZih0eXBlUmFuZ2UuaW5kZXhPZihmaWxlVHlwZSkgIT09IC0xKSB7XG5cbiAgICAgICAgICAgICAgICBmaWxlRXh0ZW5zaW9uID0gdGhpcy5waWNrb25lKHRoaXMuZ2V0KHBvb2xDb2xsZWN0aW9uS2V5KVtmaWxlVHlwZV0pO1xuICAgICAgICAgICAgICAgIHJldHVybiAoZmlsZU5hbWUgKyAnLicgKyBmaWxlRXh0ZW5zaW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0IGZpbGUgdHlwZSB2YWx1ZSB0byBiZSAncmFzdGVyJywgJ3ZlY3RvcicsICczZCcgb3IgJ2RvY3VtZW50JyBcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSByYW5kb20gZmlsZSBuYW1lIGlmIG5vIGV4dGVuc2lvbiBvcHRpb25zIGFyZSBwYXNzZWRcbiAgICAgICAgZmlsZUV4dGVuc2lvbiA9IHRoaXMucGlja29uZSh0aGlzLmdldChwb29sQ29sbGVjdGlvbktleSlbdGhpcy5waWNrb25lKHR5cGVSYW5nZSldKTtcbiAgICAgICAgcmV0dXJuIChmaWxlTmFtZSArICcuJyArIGZpbGVFeHRlbnNpb24pO1xuICAgIH07XG5cbiAgICB2YXIgZGF0YSA9IHtcblxuICAgICAgICBmaXJzdE5hbWVzOiB7XG4gICAgICAgICAgICBcIm1hbGVcIjoge1xuICAgICAgICAgICAgICAgIFwiZW5cIjogW1wiSmFtZXNcIiwgXCJKb2huXCIsIFwiUm9iZXJ0XCIsIFwiTWljaGFlbFwiLCBcIldpbGxpYW1cIiwgXCJEYXZpZFwiLCBcIlJpY2hhcmRcIiwgXCJKb3NlcGhcIiwgXCJDaGFybGVzXCIsIFwiVGhvbWFzXCIsIFwiQ2hyaXN0b3BoZXJcIiwgXCJEYW5pZWxcIiwgXCJNYXR0aGV3XCIsIFwiR2VvcmdlXCIsIFwiRG9uYWxkXCIsIFwiQW50aG9ueVwiLCBcIlBhdWxcIiwgXCJNYXJrXCIsIFwiRWR3YXJkXCIsIFwiU3RldmVuXCIsIFwiS2VubmV0aFwiLCBcIkFuZHJld1wiLCBcIkJyaWFuXCIsIFwiSm9zaHVhXCIsIFwiS2V2aW5cIiwgXCJSb25hbGRcIiwgXCJUaW1vdGh5XCIsIFwiSmFzb25cIiwgXCJKZWZmcmV5XCIsIFwiRnJhbmtcIiwgXCJHYXJ5XCIsIFwiUnlhblwiLCBcIk5pY2hvbGFzXCIsIFwiRXJpY1wiLCBcIlN0ZXBoZW5cIiwgXCJKYWNvYlwiLCBcIkxhcnJ5XCIsIFwiSm9uYXRoYW5cIiwgXCJTY290dFwiLCBcIlJheW1vbmRcIiwgXCJKdXN0aW5cIiwgXCJCcmFuZG9uXCIsIFwiR3JlZ29yeVwiLCBcIlNhbXVlbFwiLCBcIkJlbmphbWluXCIsIFwiUGF0cmlja1wiLCBcIkphY2tcIiwgXCJIZW5yeVwiLCBcIldhbHRlclwiLCBcIkRlbm5pc1wiLCBcIkplcnJ5XCIsIFwiQWxleGFuZGVyXCIsIFwiUGV0ZXJcIiwgXCJUeWxlclwiLCBcIkRvdWdsYXNcIiwgXCJIYXJvbGRcIiwgXCJBYXJvblwiLCBcIkpvc2VcIiwgXCJBZGFtXCIsIFwiQXJ0aHVyXCIsIFwiWmFjaGFyeVwiLCBcIkNhcmxcIiwgXCJOYXRoYW5cIiwgXCJBbGJlcnRcIiwgXCJLeWxlXCIsIFwiTGF3cmVuY2VcIiwgXCJKb2VcIiwgXCJXaWxsaWVcIiwgXCJHZXJhbGRcIiwgXCJSb2dlclwiLCBcIktlaXRoXCIsIFwiSmVyZW15XCIsIFwiVGVycnlcIiwgXCJIYXJyeVwiLCBcIlJhbHBoXCIsIFwiU2VhblwiLCBcIkplc3NlXCIsIFwiUm95XCIsIFwiTG91aXNcIiwgXCJCaWxseVwiLCBcIkF1c3RpblwiLCBcIkJydWNlXCIsIFwiRXVnZW5lXCIsIFwiQ2hyaXN0aWFuXCIsIFwiQnJ5YW5cIiwgXCJXYXluZVwiLCBcIlJ1c3NlbGxcIiwgXCJIb3dhcmRcIiwgXCJGcmVkXCIsIFwiRXRoYW5cIiwgXCJKb3JkYW5cIiwgXCJQaGlsaXBcIiwgXCJBbGFuXCIsIFwiSnVhblwiLCBcIlJhbmR5XCIsIFwiVmluY2VudFwiLCBcIkJvYmJ5XCIsIFwiRHlsYW5cIiwgXCJKb2hubnlcIiwgXCJQaGlsbGlwXCIsIFwiVmljdG9yXCIsIFwiQ2xhcmVuY2VcIiwgXCJFcm5lc3RcIiwgXCJNYXJ0aW5cIiwgXCJDcmFpZ1wiLCBcIlN0YW5sZXlcIiwgXCJTaGF3blwiLCBcIlRyYXZpc1wiLCBcIkJyYWRsZXlcIiwgXCJMZW9uYXJkXCIsIFwiRWFybFwiLCBcIkdhYnJpZWxcIiwgXCJKaW1teVwiLCBcIkZyYW5jaXNcIiwgXCJUb2RkXCIsIFwiTm9haFwiLCBcIkRhbm55XCIsIFwiRGFsZVwiLCBcIkNvZHlcIiwgXCJDYXJsb3NcIiwgXCJBbGxlblwiLCBcIkZyZWRlcmlja1wiLCBcIkxvZ2FuXCIsIFwiQ3VydGlzXCIsIFwiQWxleFwiLCBcIkpvZWxcIiwgXCJMdWlzXCIsIFwiTm9ybWFuXCIsIFwiTWFydmluXCIsIFwiR2xlbm5cIiwgXCJUb255XCIsIFwiTmF0aGFuaWVsXCIsIFwiUm9kbmV5XCIsIFwiTWVsdmluXCIsIFwiQWxmcmVkXCIsIFwiU3RldmVcIiwgXCJDYW1lcm9uXCIsIFwiQ2hhZFwiLCBcIkVkd2luXCIsIFwiQ2FsZWJcIiwgXCJFdmFuXCIsIFwiQW50b25pb1wiLCBcIkxlZVwiLCBcIkhlcmJlcnRcIiwgXCJKZWZmZXJ5XCIsIFwiSXNhYWNcIiwgXCJEZXJla1wiLCBcIlJpY2t5XCIsIFwiTWFyY3VzXCIsIFwiVGhlb2RvcmVcIiwgXCJFbGlqYWhcIiwgXCJMdWtlXCIsIFwiSmVzdXNcIiwgXCJFZGRpZVwiLCBcIlRyb3lcIiwgXCJNaWtlXCIsIFwiRHVzdGluXCIsIFwiUmF5XCIsIFwiQWRyaWFuXCIsIFwiQmVybmFyZFwiLCBcIkxlcm95XCIsIFwiQW5nZWxcIiwgXCJSYW5kYWxsXCIsIFwiV2VzbGV5XCIsIFwiSWFuXCIsIFwiSmFyZWRcIiwgXCJNYXNvblwiLCBcIkh1bnRlclwiLCBcIkNhbHZpblwiLCBcIk9zY2FyXCIsIFwiQ2xpZmZvcmRcIiwgXCJKYXlcIiwgXCJTaGFuZVwiLCBcIlJvbm5pZVwiLCBcIkJhcnJ5XCIsIFwiTHVjYXNcIiwgXCJDb3JleVwiLCBcIk1hbnVlbFwiLCBcIkxlb1wiLCBcIlRvbW15XCIsIFwiV2FycmVuXCIsIFwiSmFja3NvblwiLCBcIklzYWlhaFwiLCBcIkNvbm5vclwiLCBcIkRvblwiLCBcIkRlYW5cIiwgXCJKb25cIiwgXCJKdWxpYW5cIiwgXCJNaWd1ZWxcIiwgXCJCaWxsXCIsIFwiTGxveWRcIiwgXCJDaGFybGllXCIsIFwiTWl0Y2hlbGxcIiwgXCJMZW9uXCIsIFwiSmVyb21lXCIsIFwiRGFycmVsbFwiLCBcIkplcmVtaWFoXCIsIFwiQWx2aW5cIiwgXCJCcmV0dFwiLCBcIlNldGhcIiwgXCJGbG95ZFwiLCBcIkppbVwiLCBcIkJsYWtlXCIsIFwiTWljaGVhbFwiLCBcIkdvcmRvblwiLCBcIlRyZXZvclwiLCBcIkxld2lzXCIsIFwiRXJpa1wiLCBcIkVkZ2FyXCIsIFwiVmVybm9uXCIsIFwiRGV2aW5cIiwgXCJHYXZpblwiLCBcIkpheWRlblwiLCBcIkNocmlzXCIsIFwiQ2x5ZGVcIiwgXCJUb21cIiwgXCJEZXJyaWNrXCIsIFwiTWFyaW9cIiwgXCJCcmVudFwiLCBcIk1hcmNcIiwgXCJIZXJtYW5cIiwgXCJDaGFzZVwiLCBcIkRvbWluaWNcIiwgXCJSaWNhcmRvXCIsIFwiRnJhbmtsaW5cIiwgXCJNYXVyaWNlXCIsIFwiTWF4XCIsIFwiQWlkZW5cIiwgXCJPd2VuXCIsIFwiTGVzdGVyXCIsIFwiR2lsYmVydFwiLCBcIkVsbWVyXCIsIFwiR2VuZVwiLCBcIkZyYW5jaXNjb1wiLCBcIkdsZW5cIiwgXCJDb3J5XCIsIFwiR2FycmV0dFwiLCBcIkNsYXl0b25cIiwgXCJTYW1cIiwgXCJKb3JnZVwiLCBcIkNoZXN0ZXJcIiwgXCJBbGVqYW5kcm9cIiwgXCJKZWZmXCIsIFwiSGFydmV5XCIsIFwiTWlsdG9uXCIsIFwiQ29sZVwiLCBcIkl2YW5cIiwgXCJBbmRyZVwiLCBcIkR1YW5lXCIsIFwiTGFuZG9uXCJdLFxuICAgICAgICAgICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwOi8vd3d3LmRhdGkuZ292Lml0L2RhdGFzZXQvY29tdW5lLWRpLWZpcmVuemVfMDE2M1xuICAgICAgICAgICAgICAgIFwiaXRcIjogW1wiQWRvbGZvXCIsIFwiQWxiZXJ0b1wiLCBcIkFsZG9cIiwgXCJBbGVzc2FuZHJvXCIsIFwiQWxlc3Npb1wiLCBcIkFsZnJlZG9cIiwgXCJBbHZhcm9cIiwgXCJBbmRyZWFcIiwgXCJBbmdlbG9cIiwgXCJBbmdpb2xvXCIsIFwiQW50b25pbm9cIiwgXCJBbnRvbmlvXCIsIFwiQXR0aWxpb1wiLCBcIkJlbml0b1wiLCBcIkJlcm5hcmRvXCIsIFwiQnJ1bm9cIiwgXCJDYXJsb1wiLCBcIkNlc2FyZVwiLCBcIkNocmlzdGlhblwiLCBcIkNsYXVkaW9cIiwgXCJDb3JyYWRvXCIsIFwiQ29zaW1vXCIsIFwiQ3Jpc3RpYW5cIiwgXCJDcmlzdGlhbm9cIiwgXCJEYW5pZWxlXCIsIFwiRGFyaW9cIiwgXCJEYXZpZFwiLCBcIkRhdmlkZVwiLCBcIkRpZWdvXCIsIFwiRGlub1wiLCBcIkRvbWVuaWNvXCIsIFwiRHVjY2lvXCIsIFwiRWRvYXJkb1wiLCBcIkVsaWFcIiwgXCJFbGlvXCIsIFwiRW1hbnVlbGVcIiwgXCJFbWlsaWFub1wiLCBcIkVtaWxpb1wiLCBcIkVucmljb1wiLCBcIkVuem9cIiwgXCJFdHRvcmVcIiwgXCJGYWJpb1wiLCBcIkZhYnJpemlvXCIsIFwiRmVkZXJpY29cIiwgXCJGZXJkaW5hbmRvXCIsIFwiRmVybmFuZG9cIiwgXCJGaWxpcHBvXCIsIFwiRnJhbmNlc2NvXCIsIFwiRnJhbmNvXCIsIFwiR2FicmllbGVcIiwgXCJHaWFjb21vXCIsIFwiR2lhbXBhb2xvXCIsIFwiR2lhbXBpZXJvXCIsIFwiR2lhbmNhcmxvXCIsIFwiR2lhbmZyYW5jb1wiLCBcIkdpYW5sdWNhXCIsIFwiR2lhbm1hcmNvXCIsIFwiR2lhbm5pXCIsIFwiR2lub1wiLCBcIkdpb3JnaW9cIiwgXCJHaW92YW5uaVwiLCBcIkdpdWxpYW5vXCIsIFwiR2l1bGlvXCIsIFwiR2l1c2VwcGVcIiwgXCJHcmF6aWFub1wiLCBcIkdyZWdvcmlvXCIsIFwiR3VpZG9cIiwgXCJJYWNvcG9cIiwgXCJKYWNvcG9cIiwgXCJMYXBvXCIsIFwiTGVvbmFyZG9cIiwgXCJMb3JlbnpvXCIsIFwiTHVjYVwiLCBcIkx1Y2lhbm9cIiwgXCJMdWlnaVwiLCBcIk1hbnVlbFwiLCBcIk1hcmNlbGxvXCIsIFwiTWFyY29cIiwgXCJNYXJpbm9cIiwgXCJNYXJpb1wiLCBcIk1hc3NpbWlsaWFub1wiLCBcIk1hc3NpbW9cIiwgXCJNYXR0ZW9cIiwgXCJNYXR0aWFcIiwgXCJNYXVyaXppb1wiLCBcIk1hdXJvXCIsIFwiTWljaGVsZVwiLCBcIk1pcmtvXCIsIFwiTW9oYW1lZFwiLCBcIk5lbGxvXCIsIFwiTmVyaVwiLCBcIk5pY2NvbMOyXCIsIFwiTmljb2xhXCIsIFwiT3N2YWxkb1wiLCBcIk90ZWxsb1wiLCBcIlBhb2xvXCIsIFwiUGllciBMdWlnaVwiLCBcIlBpZXJvXCIsIFwiUGlldHJvXCIsIFwiUmFmZmFlbGVcIiwgXCJSZW1vXCIsIFwiUmVuYXRvXCIsIFwiUmVuem9cIiwgXCJSaWNjYXJkb1wiLCBcIlJvYmVydG9cIiwgXCJSb2xhbmRvXCIsIFwiUm9tYW5vXCIsIFwiU2FsdmF0b3JlXCIsIFwiU2FtdWVsZVwiLCBcIlNhbmRyb1wiLCBcIlNlcmdpb1wiLCBcIlNpbHZhbm9cIiwgXCJTaW1vbmVcIiwgXCJTdGVmYW5vXCIsIFwiVGhvbWFzXCIsIFwiVG9tbWFzb1wiLCBcIlViYWxkb1wiLCBcIlVnb1wiLCBcIlVtYmVydG9cIiwgXCJWYWxlcmlvXCIsIFwiVmFsdGVyXCIsIFwiVmFzY29cIiwgXCJWaW5jZW56b1wiLCBcIlZpdHRvcmlvXCJdXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJmZW1hbGVcIjoge1xuICAgICAgICAgICAgICAgIFwiZW5cIjogW1wiTWFyeVwiLCBcIkVtbWFcIiwgXCJFbGl6YWJldGhcIiwgXCJNaW5uaWVcIiwgXCJNYXJnYXJldFwiLCBcIklkYVwiLCBcIkFsaWNlXCIsIFwiQmVydGhhXCIsIFwiU2FyYWhcIiwgXCJBbm5pZVwiLCBcIkNsYXJhXCIsIFwiRWxsYVwiLCBcIkZsb3JlbmNlXCIsIFwiQ29yYVwiLCBcIk1hcnRoYVwiLCBcIkxhdXJhXCIsIFwiTmVsbGllXCIsIFwiR3JhY2VcIiwgXCJDYXJyaWVcIiwgXCJNYXVkZVwiLCBcIk1hYmVsXCIsIFwiQmVzc2llXCIsIFwiSmVubmllXCIsIFwiR2VydHJ1ZGVcIiwgXCJKdWxpYVwiLCBcIkhhdHRpZVwiLCBcIkVkaXRoXCIsIFwiTWF0dGllXCIsIFwiUm9zZVwiLCBcIkNhdGhlcmluZVwiLCBcIkxpbGxpYW5cIiwgXCJBZGFcIiwgXCJMaWxsaWVcIiwgXCJIZWxlblwiLCBcIkplc3NpZVwiLCBcIkxvdWlzZVwiLCBcIkV0aGVsXCIsIFwiTHVsYVwiLCBcIk15cnRsZVwiLCBcIkV2YVwiLCBcIkZyYW5jZXNcIiwgXCJMZW5hXCIsIFwiTHVjeVwiLCBcIkVkbmFcIiwgXCJNYWdnaWVcIiwgXCJQZWFybFwiLCBcIkRhaXN5XCIsIFwiRmFubmllXCIsIFwiSm9zZXBoaW5lXCIsIFwiRG9yYVwiLCBcIlJvc2FcIiwgXCJLYXRoZXJpbmVcIiwgXCJBZ25lc1wiLCBcIk1hcmllXCIsIFwiTm9yYVwiLCBcIk1heVwiLCBcIk1hbWllXCIsIFwiQmxhbmNoZVwiLCBcIlN0ZWxsYVwiLCBcIkVsbGVuXCIsIFwiTmFuY3lcIiwgXCJFZmZpZVwiLCBcIlNhbGxpZVwiLCBcIk5ldHRpZVwiLCBcIkRlbGxhXCIsIFwiTGl6emllXCIsIFwiRmxvcmFcIiwgXCJTdXNpZVwiLCBcIk1hdWRcIiwgXCJNYWVcIiwgXCJFdHRhXCIsIFwiSGFycmlldFwiLCBcIlNhZGllXCIsIFwiQ2Fyb2xpbmVcIiwgXCJLYXRpZVwiLCBcIkx5ZGlhXCIsIFwiRWxzaWVcIiwgXCJLYXRlXCIsIFwiU3VzYW5cIiwgXCJNb2xsaWVcIiwgXCJBbG1hXCIsIFwiQWRkaWVcIiwgXCJHZW9yZ2lhXCIsIFwiRWxpemFcIiwgXCJMdWx1XCIsIFwiTmFubmllXCIsIFwiTG90dGllXCIsIFwiQW1hbmRhXCIsIFwiQmVsbGVcIiwgXCJDaGFybG90dGVcIiwgXCJSZWJlY2NhXCIsIFwiUnV0aFwiLCBcIlZpb2xhXCIsIFwiT2xpdmVcIiwgXCJBbWVsaWFcIiwgXCJIYW5uYWhcIiwgXCJKYW5lXCIsIFwiVmlyZ2luaWFcIiwgXCJFbWlseVwiLCBcIk1hdGlsZGFcIiwgXCJJcmVuZVwiLCBcIkthdGhyeW5cIiwgXCJFc3RoZXJcIiwgXCJXaWxsaWVcIiwgXCJIZW5yaWV0dGFcIiwgXCJPbGxpZVwiLCBcIkFteVwiLCBcIlJhY2hlbFwiLCBcIlNhcmFcIiwgXCJFc3RlbGxhXCIsIFwiVGhlcmVzYVwiLCBcIkF1Z3VzdGFcIiwgXCJPcmFcIiwgXCJQYXVsaW5lXCIsIFwiSm9zaWVcIiwgXCJMb2xhXCIsIFwiU29waGlhXCIsIFwiTGVvbmFcIiwgXCJBbm5lXCIsIFwiTWlsZHJlZFwiLCBcIkFublwiLCBcIkJldWxhaFwiLCBcIkNhbGxpZVwiLCBcIkxvdVwiLCBcIkRlbGlhXCIsIFwiRWxlYW5vclwiLCBcIkJhcmJhcmFcIiwgXCJJdmFcIiwgXCJMb3Vpc2FcIiwgXCJNYXJpYVwiLCBcIk1heW1lXCIsIFwiRXZlbHluXCIsIFwiRXN0ZWxsZVwiLCBcIk5pbmFcIiwgXCJCZXR0eVwiLCBcIk1hcmlvblwiLCBcIkJldHRpZVwiLCBcIkRvcm90aHlcIiwgXCJMdWVsbGFcIiwgXCJJbmV6XCIsIFwiTGVsYVwiLCBcIlJvc2llXCIsIFwiQWxsaWVcIiwgXCJNaWxsaWVcIiwgXCJKYW5pZVwiLCBcIkNvcm5lbGlhXCIsIFwiVmljdG9yaWFcIiwgXCJSdWJ5XCIsIFwiV2luaWZyZWRcIiwgXCJBbHRhXCIsIFwiQ2VsaWFcIiwgXCJDaHJpc3RpbmVcIiwgXCJCZWF0cmljZVwiLCBcIkJpcmRpZVwiLCBcIkhhcnJpZXR0XCIsIFwiTWFibGVcIiwgXCJNeXJhXCIsIFwiU29waGllXCIsIFwiVGlsbGllXCIsIFwiSXNhYmVsXCIsIFwiU3lsdmlhXCIsIFwiQ2Fyb2x5blwiLCBcIklzYWJlbGxlXCIsIFwiTGVpbGFcIiwgXCJTYWxseVwiLCBcIkluYVwiLCBcIkVzc2llXCIsIFwiQmVydGllXCIsIFwiTmVsbFwiLCBcIkFsYmVydGFcIiwgXCJLYXRoYXJpbmVcIiwgXCJMb3JhXCIsIFwiUmVuYVwiLCBcIk1pbmFcIiwgXCJSaG9kYVwiLCBcIk1hdGhpbGRhXCIsIFwiQWJiaWVcIiwgXCJFdWxhXCIsIFwiRG9sbGllXCIsIFwiSGV0dGllXCIsIFwiRXVuaWNlXCIsIFwiRmFubnlcIiwgXCJPbGFcIiwgXCJMZW5vcmFcIiwgXCJBZGVsYWlkZVwiLCBcIkNocmlzdGluYVwiLCBcIkxlbGlhXCIsIFwiTmVsbGVcIiwgXCJTdWVcIiwgXCJKb2hhbm5hXCIsIFwiTGlsbHlcIiwgXCJMdWNpbmRhXCIsIFwiTWluZXJ2YVwiLCBcIkxldHRpZVwiLCBcIlJveGllXCIsIFwiQ3ludGhpYVwiLCBcIkhlbGVuYVwiLCBcIkhpbGRhXCIsIFwiSHVsZGFcIiwgXCJCZXJuaWNlXCIsIFwiR2VuZXZpZXZlXCIsIFwiSmVhblwiLCBcIkNvcmRlbGlhXCIsIFwiTWFyaWFuXCIsIFwiRnJhbmNpc1wiLCBcIkplYW5ldHRlXCIsIFwiQWRlbGluZVwiLCBcIkd1c3NpZVwiLCBcIkxlYWhcIiwgXCJMb2lzXCIsIFwiTHVyYVwiLCBcIk1pdHRpZVwiLCBcIkhhbGxpZVwiLCBcIklzYWJlbGxhXCIsIFwiT2xnYVwiLCBcIlBob2ViZVwiLCBcIlRlcmVzYVwiLCBcIkhlc3RlclwiLCBcIkxpZGFcIiwgXCJMaW5hXCIsIFwiV2lubmllXCIsIFwiQ2xhdWRpYVwiLCBcIk1hcmd1ZXJpdGVcIiwgXCJWZXJhXCIsIFwiQ2VjZWxpYVwiLCBcIkJlc3NcIiwgXCJFbWlsaWVcIiwgXCJSb3NldHRhXCIsIFwiVmVybmFcIiwgXCJNeXJ0aWVcIiwgXCJDZWNpbGlhXCIsIFwiRWx2YVwiLCBcIk9saXZpYVwiLCBcIk9waGVsaWFcIiwgXCJHZW9yZ2llXCIsIFwiRWxub3JhXCIsIFwiVmlvbGV0XCIsIFwiQWRlbGVcIiwgXCJMaWx5XCIsIFwiTGlubmllXCIsIFwiTG9yZXR0YVwiLCBcIk1hZGdlXCIsIFwiUG9sbHlcIiwgXCJWaXJnaWVcIiwgXCJFdWdlbmlhXCIsIFwiTHVjaWxlXCIsIFwiTHVjaWxsZVwiLCBcIk1hYmVsbGVcIiwgXCJSb3NhbGllXCJdLFxuICAgICAgICAgICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwOi8vd3d3LmRhdGkuZ292Lml0L2RhdGFzZXQvY29tdW5lLWRpLWZpcmVuemVfMDE2MlxuICAgICAgICAgICAgICAgIFwiaXRcIjogW1wiQWRhXCIsIFwiQWRyaWFuYVwiLCBcIkFsZXNzYW5kcmFcIiwgXCJBbGVzc2lhXCIsIFwiQWxpY2VcIiwgXCJBbmdlbGFcIiwgXCJBbm5hXCIsIFwiQW5uYSBNYXJpYVwiLCBcIkFubmFsaXNhXCIsIFwiQW5uaXRhXCIsIFwiQW5udW56aWF0YVwiLCBcIkFudG9uZWxsYVwiLCBcIkFyaWFubmFcIiwgXCJBc2lhXCIsIFwiQXNzdW50YVwiLCBcIkF1cm9yYVwiLCBcIkJhcmJhcmFcIiwgXCJCZWF0cmljZVwiLCBcIkJlbmVkZXR0YVwiLCBcIkJpYW5jYVwiLCBcIkJydW5hXCIsIFwiQ2FtaWxsYVwiLCBcIkNhcmxhXCIsIFwiQ2FybG90dGFcIiwgXCJDYXJtZWxhXCIsIFwiQ2Fyb2xpbmFcIiwgXCJDYXRlcmluYVwiLCBcIkNhdGlhXCIsIFwiQ2VjaWxpYVwiLCBcIkNoaWFyYVwiLCBcIkNpbnppYVwiLCBcIkNsYXJhXCIsIFwiQ2xhdWRpYVwiLCBcIkNvc3RhbnphXCIsIFwiQ3Jpc3RpbmFcIiwgXCJEYW5pZWxhXCIsIFwiRGVib3JhXCIsIFwiRGlsZXR0YVwiLCBcIkRpbmFcIiwgXCJEb25hdGVsbGFcIiwgXCJFbGVuYVwiLCBcIkVsZW9ub3JhXCIsIFwiRWxpc2FcIiwgXCJFbGlzYWJldHRhXCIsIFwiRW1hbnVlbGFcIiwgXCJFbW1hXCIsIFwiRXZhXCIsIFwiRmVkZXJpY2FcIiwgXCJGZXJuYW5kYVwiLCBcIkZpb3JlbGxhXCIsIFwiRmlvcmVuemFcIiwgXCJGbG9yYVwiLCBcIkZyYW5jYVwiLCBcIkZyYW5jZXNjYVwiLCBcIkdhYnJpZWxsYVwiLCBcIkdhaWFcIiwgXCJHZW1tYVwiLCBcIkdpYWRhXCIsIFwiR2lhbm5hXCIsIFwiR2luYVwiLCBcIkdpbmV2cmFcIiwgXCJHaW9yZ2lhXCIsIFwiR2lvdmFubmFcIiwgXCJHaXVsaWFcIiwgXCJHaXVsaWFuYVwiLCBcIkdpdXNlcHBhXCIsIFwiR2l1c2VwcGluYVwiLCBcIkdyYXppYVwiLCBcIkdyYXppZWxsYVwiLCBcIkdyZXRhXCIsIFwiSWRhXCIsIFwiSWxhcmlhXCIsIFwiSW5lc1wiLCBcIklvbGFuZGFcIiwgXCJJcmVuZVwiLCBcIklybWFcIiwgXCJJc2FiZWxsYVwiLCBcIkplc3NpY2FcIiwgXCJMYXVyYVwiLCBcIkxlZGFcIiwgXCJMZXRpemlhXCIsIFwiTGljaWFcIiwgXCJMaWRpYVwiLCBcIkxpbGlhbmFcIiwgXCJMaW5hXCIsIFwiTGluZGFcIiwgXCJMaXNhXCIsIFwiTGl2aWFcIiwgXCJMb3JldHRhXCIsIFwiTHVhbmFcIiwgXCJMdWNpYVwiLCBcIkx1Y2lhbmFcIiwgXCJMdWNyZXppYVwiLCBcIkx1aXNhXCIsIFwiTWFudWVsYVwiLCBcIk1hcmFcIiwgXCJNYXJjZWxsYVwiLCBcIk1hcmdoZXJpdGFcIiwgXCJNYXJpYVwiLCBcIk1hcmlhIENyaXN0aW5hXCIsIFwiTWFyaWEgR3JhemlhXCIsIFwiTWFyaWEgTHVpc2FcIiwgXCJNYXJpYSBQaWFcIiwgXCJNYXJpYSBUZXJlc2FcIiwgXCJNYXJpbmFcIiwgXCJNYXJpc2FcIiwgXCJNYXJ0YVwiLCBcIk1hcnRpbmFcIiwgXCJNYXJ6aWFcIiwgXCJNYXRpbGRlXCIsIFwiTWVsaXNzYVwiLCBcIk1pY2hlbGFcIiwgXCJNaWxlbmFcIiwgXCJNaXJlbGxhXCIsIFwiTW9uaWNhXCIsIFwiTmF0YWxpbmFcIiwgXCJOZWxsYVwiLCBcIk5pY29sZXR0YVwiLCBcIk5vZW1pXCIsIFwiT2xnYVwiLCBcIlBhb2xhXCIsIFwiUGF0cml6aWFcIiwgXCJQaWVyYVwiLCBcIlBpZXJpbmFcIiwgXCJSYWZmYWVsbGFcIiwgXCJSZWJlY2NhXCIsIFwiUmVuYXRhXCIsIFwiUmluYVwiLCBcIlJpdGFcIiwgXCJSb2JlcnRhXCIsIFwiUm9zYVwiLCBcIlJvc2FubmFcIiwgXCJSb3NzYW5hXCIsIFwiUm9zc2VsbGFcIiwgXCJTYWJyaW5hXCIsIFwiU2FuZHJhXCIsIFwiU2FyYVwiLCBcIlNlcmVuYVwiLCBcIlNpbHZhbmFcIiwgXCJTaWx2aWFcIiwgXCJTaW1vbmFcIiwgXCJTaW1vbmV0dGFcIiwgXCJTb2ZpYVwiLCBcIlNvbmlhXCIsIFwiU3RlZmFuaWFcIiwgXCJTdXNhbm5hXCIsIFwiVGVyZXNhXCIsIFwiVGluYVwiLCBcIlRpemlhbmFcIiwgXCJUb3NjYVwiLCBcIlZhbGVudGluYVwiLCBcIlZhbGVyaWFcIiwgXCJWYW5kYVwiLCBcIlZhbmVzc2FcIiwgXCJWYW5uYVwiLCBcIlZlcmFcIiwgXCJWZXJvbmljYVwiLCBcIlZpbG1hXCIsIFwiVmlvbGFcIiwgXCJWaXJnaW5pYVwiLCBcIlZpdHRvcmlhXCJdXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgbGFzdE5hbWVzOiB7XG4gICAgICAgICAgICBcImVuXCI6IFsnU21pdGgnLCAnSm9obnNvbicsICdXaWxsaWFtcycsICdKb25lcycsICdCcm93bicsICdEYXZpcycsICdNaWxsZXInLCAnV2lsc29uJywgJ01vb3JlJywgJ1RheWxvcicsICdBbmRlcnNvbicsICdUaG9tYXMnLCAnSmFja3NvbicsICdXaGl0ZScsICdIYXJyaXMnLCAnTWFydGluJywgJ1Rob21wc29uJywgJ0dhcmNpYScsICdNYXJ0aW5leicsICdSb2JpbnNvbicsICdDbGFyaycsICdSb2RyaWd1ZXonLCAnTGV3aXMnLCAnTGVlJywgJ1dhbGtlcicsICdIYWxsJywgJ0FsbGVuJywgJ1lvdW5nJywgJ0hlcm5hbmRleicsICdLaW5nJywgJ1dyaWdodCcsICdMb3BleicsICdIaWxsJywgJ1Njb3R0JywgJ0dyZWVuJywgJ0FkYW1zJywgJ0Jha2VyJywgJ0dvbnphbGV6JywgJ05lbHNvbicsICdDYXJ0ZXInLCAnTWl0Y2hlbGwnLCAnUGVyZXonLCAnUm9iZXJ0cycsICdUdXJuZXInLCAnUGhpbGxpcHMnLCAnQ2FtcGJlbGwnLCAnUGFya2VyJywgJ0V2YW5zJywgJ0Vkd2FyZHMnLCAnQ29sbGlucycsICdTdGV3YXJ0JywgJ1NhbmNoZXonLCAnTW9ycmlzJywgJ1JvZ2VycycsICdSZWVkJywgJ0Nvb2snLCAnTW9yZ2FuJywgJ0JlbGwnLCAnTXVycGh5JywgJ0JhaWxleScsICdSaXZlcmEnLCAnQ29vcGVyJywgJ1JpY2hhcmRzb24nLCAnQ294JywgJ0hvd2FyZCcsICdXYXJkJywgJ1RvcnJlcycsICdQZXRlcnNvbicsICdHcmF5JywgJ1JhbWlyZXonLCAnSmFtZXMnLCAnV2F0c29uJywgJ0Jyb29rcycsICdLZWxseScsICdTYW5kZXJzJywgJ1ByaWNlJywgJ0Jlbm5ldHQnLCAnV29vZCcsICdCYXJuZXMnLCAnUm9zcycsICdIZW5kZXJzb24nLCAnQ29sZW1hbicsICdKZW5raW5zJywgJ1BlcnJ5JywgJ1Bvd2VsbCcsICdMb25nJywgJ1BhdHRlcnNvbicsICdIdWdoZXMnLCAnRmxvcmVzJywgJ1dhc2hpbmd0b24nLCAnQnV0bGVyJywgJ1NpbW1vbnMnLCAnRm9zdGVyJywgJ0dvbnphbGVzJywgJ0JyeWFudCcsICdBbGV4YW5kZXInLCAnUnVzc2VsbCcsICdHcmlmZmluJywgJ0RpYXonLCAnSGF5ZXMnLCAnTXllcnMnLCAnRm9yZCcsICdIYW1pbHRvbicsICdHcmFoYW0nLCAnU3VsbGl2YW4nLCAnV2FsbGFjZScsICdXb29kcycsICdDb2xlJywgJ1dlc3QnLCAnSm9yZGFuJywgJ093ZW5zJywgJ1JleW5vbGRzJywgJ0Zpc2hlcicsICdFbGxpcycsICdIYXJyaXNvbicsICdHaWJzb24nLCAnTWNEb25hbGQnLCAnQ3J1eicsICdNYXJzaGFsbCcsICdPcnRpeicsICdHb21leicsICdNdXJyYXknLCAnRnJlZW1hbicsICdXZWxscycsICdXZWJiJywgJ1NpbXBzb24nLCAnU3RldmVucycsICdUdWNrZXInLCAnUG9ydGVyJywgJ0h1bnRlcicsICdIaWNrcycsICdDcmF3Zm9yZCcsICdIZW5yeScsICdCb3lkJywgJ01hc29uJywgJ01vcmFsZXMnLCAnS2VubmVkeScsICdXYXJyZW4nLCAnRGl4b24nLCAnUmFtb3MnLCAnUmV5ZXMnLCAnQnVybnMnLCAnR29yZG9uJywgJ1NoYXcnLCAnSG9sbWVzJywgJ1JpY2UnLCAnUm9iZXJ0c29uJywgJ0h1bnQnLCAnQmxhY2snLCAnRGFuaWVscycsICdQYWxtZXInLCAnTWlsbHMnLCAnTmljaG9scycsICdHcmFudCcsICdLbmlnaHQnLCAnRmVyZ3Vzb24nLCAnUm9zZScsICdTdG9uZScsICdIYXdraW5zJywgJ0R1bm4nLCAnUGVya2lucycsICdIdWRzb24nLCAnU3BlbmNlcicsICdHYXJkbmVyJywgJ1N0ZXBoZW5zJywgJ1BheW5lJywgJ1BpZXJjZScsICdCZXJyeScsICdNYXR0aGV3cycsICdBcm5vbGQnLCAnV2FnbmVyJywgJ1dpbGxpcycsICdSYXknLCAnV2F0a2lucycsICdPbHNvbicsICdDYXJyb2xsJywgJ0R1bmNhbicsICdTbnlkZXInLCAnSGFydCcsICdDdW5uaW5naGFtJywgJ0JyYWRsZXknLCAnTGFuZScsICdBbmRyZXdzJywgJ1J1aXonLCAnSGFycGVyJywgJ0ZveCcsICdSaWxleScsICdBcm1zdHJvbmcnLCAnQ2FycGVudGVyJywgJ1dlYXZlcicsICdHcmVlbmUnLCAnTGF3cmVuY2UnLCAnRWxsaW90dCcsICdDaGF2ZXonLCAnU2ltcycsICdBdXN0aW4nLCAnUGV0ZXJzJywgJ0tlbGxleScsICdGcmFua2xpbicsICdMYXdzb24nLCAnRmllbGRzJywgJ0d1dGllcnJleicsICdSeWFuJywgJ1NjaG1pZHQnLCAnQ2FycicsICdWYXNxdWV6JywgJ0Nhc3RpbGxvJywgJ1doZWVsZXInLCAnQ2hhcG1hbicsICdPbGl2ZXInLCAnTW9udGdvbWVyeScsICdSaWNoYXJkcycsICdXaWxsaWFtc29uJywgJ0pvaG5zdG9uJywgJ0JhbmtzJywgJ01leWVyJywgJ0Jpc2hvcCcsICdNY0NveScsICdIb3dlbGwnLCAnQWx2YXJleicsICdNb3JyaXNvbicsICdIYW5zZW4nLCAnRmVybmFuZGV6JywgJ0dhcnphJywgJ0hhcnZleScsICdMaXR0bGUnLCAnQnVydG9uJywgJ1N0YW5sZXknLCAnTmd1eWVuJywgJ0dlb3JnZScsICdKYWNvYnMnLCAnUmVpZCcsICdLaW0nLCAnRnVsbGVyJywgJ0x5bmNoJywgJ0RlYW4nLCAnR2lsYmVydCcsICdHYXJyZXR0JywgJ1JvbWVybycsICdXZWxjaCcsICdMYXJzb24nLCAnRnJhemllcicsICdCdXJrZScsICdIYW5zb24nLCAnRGF5JywgJ01lbmRvemEnLCAnTW9yZW5vJywgJ0Jvd21hbicsICdNZWRpbmEnLCAnRm93bGVyJywgJ0JyZXdlcicsICdIb2ZmbWFuJywgJ0Nhcmxzb24nLCAnU2lsdmEnLCAnUGVhcnNvbicsICdIb2xsYW5kJywgJ0RvdWdsYXMnLCAnRmxlbWluZycsICdKZW5zZW4nLCAnVmFyZ2FzJywgJ0J5cmQnLCAnRGF2aWRzb24nLCAnSG9wa2lucycsICdNYXknLCAnVGVycnknLCAnSGVycmVyYScsICdXYWRlJywgJ1NvdG8nLCAnV2FsdGVycycsICdDdXJ0aXMnLCAnTmVhbCcsICdDYWxkd2VsbCcsICdMb3dlJywgJ0plbm5pbmdzJywgJ0Jhcm5ldHQnLCAnR3JhdmVzJywgJ0ppbWVuZXonLCAnSG9ydG9uJywgJ1NoZWx0b24nLCAnQmFycmV0dCcsICdPYnJpZW4nLCAnQ2FzdHJvJywgJ1N1dHRvbicsICdHcmVnb3J5JywgJ01jS2lubmV5JywgJ0x1Y2FzJywgJ01pbGVzJywgJ0NyYWlnJywgJ1JvZHJpcXVleicsICdDaGFtYmVycycsICdIb2x0JywgJ0xhbWJlcnQnLCAnRmxldGNoZXInLCAnV2F0dHMnLCAnQmF0ZXMnLCAnSGFsZScsICdSaG9kZXMnLCAnUGVuYScsICdCZWNrJywgJ05ld21hbicsICdIYXluZXMnLCAnTWNEYW5pZWwnLCAnTWVuZGV6JywgJ0J1c2gnLCAnVmF1Z2huJywgJ1BhcmtzJywgJ0Rhd3NvbicsICdTYW50aWFnbycsICdOb3JyaXMnLCAnSGFyZHknLCAnTG92ZScsICdTdGVlbGUnLCAnQ3VycnknLCAnUG93ZXJzJywgJ1NjaHVsdHonLCAnQmFya2VyJywgJ0d1em1hbicsICdQYWdlJywgJ011bm96JywgJ0JhbGwnLCAnS2VsbGVyJywgJ0NoYW5kbGVyJywgJ1dlYmVyJywgJ0xlb25hcmQnLCAnV2Fsc2gnLCAnTHlvbnMnLCAnUmFtc2V5JywgJ1dvbGZlJywgJ1NjaG5laWRlcicsICdNdWxsaW5zJywgJ0JlbnNvbicsICdTaGFycCcsICdCb3dlbicsICdEYW5pZWwnLCAnQmFyYmVyJywgJ0N1bW1pbmdzJywgJ0hpbmVzJywgJ0JhbGR3aW4nLCAnR3JpZmZpdGgnLCAnVmFsZGV6JywgJ0h1YmJhcmQnLCAnU2FsYXphcicsICdSZWV2ZXMnLCAnV2FybmVyJywgJ1N0ZXZlbnNvbicsICdCdXJnZXNzJywgJ1NhbnRvcycsICdUYXRlJywgJ0Nyb3NzJywgJ0dhcm5lcicsICdNYW5uJywgJ01hY2snLCAnTW9zcycsICdUaG9ybnRvbicsICdEZW5uaXMnLCAnTWNHZWUnLCAnRmFybWVyJywgJ0RlbGdhZG8nLCAnQWd1aWxhcicsICdWZWdhJywgJ0dsb3ZlcicsICdNYW5uaW5nJywgJ0NvaGVuJywgJ0hhcm1vbicsICdSb2RnZXJzJywgJ1JvYmJpbnMnLCAnTmV3dG9uJywgJ1RvZGQnLCAnQmxhaXInLCAnSGlnZ2lucycsICdJbmdyYW0nLCAnUmVlc2UnLCAnQ2Fubm9uJywgJ1N0cmlja2xhbmQnLCAnVG93bnNlbmQnLCAnUG90dGVyJywgJ0dvb2R3aW4nLCAnV2FsdG9uJywgJ1Jvd2UnLCAnSGFtcHRvbicsICdPcnRlZ2EnLCAnUGF0dG9uJywgJ1N3YW5zb24nLCAnSm9zZXBoJywgJ0ZyYW5jaXMnLCAnR29vZG1hbicsICdNYWxkb25hZG8nLCAnWWF0ZXMnLCAnQmVja2VyJywgJ0VyaWNrc29uJywgJ0hvZGdlcycsICdSaW9zJywgJ0Nvbm5lcicsICdBZGtpbnMnLCAnV2Vic3RlcicsICdOb3JtYW4nLCAnTWFsb25lJywgJ0hhbW1vbmQnLCAnRmxvd2VycycsICdDb2JiJywgJ01vb2R5JywgJ1F1aW5uJywgJ0JsYWtlJywgJ01heHdlbGwnLCAnUG9wZScsICdGbG95ZCcsICdPc2Jvcm5lJywgJ1BhdWwnLCAnTWNDYXJ0aHknLCAnR3VlcnJlcm8nLCAnTGluZHNleScsICdFc3RyYWRhJywgJ1NhbmRvdmFsJywgJ0dpYmJzJywgJ1R5bGVyJywgJ0dyb3NzJywgJ0ZpdHpnZXJhbGQnLCAnU3Rva2VzJywgJ0RveWxlJywgJ1NoZXJtYW4nLCAnU2F1bmRlcnMnLCAnV2lzZScsICdDb2xvbicsICdHaWxsJywgJ0FsdmFyYWRvJywgJ0dyZWVyJywgJ1BhZGlsbGEnLCAnU2ltb24nLCAnV2F0ZXJzJywgJ051bmV6JywgJ0JhbGxhcmQnLCAnU2Nod2FydHonLCAnTWNCcmlkZScsICdIb3VzdG9uJywgJ0NocmlzdGVuc2VuJywgJ0tsZWluJywgJ1ByYXR0JywgJ0JyaWdncycsICdQYXJzb25zJywgJ01jTGF1Z2hsaW4nLCAnWmltbWVybWFuJywgJ0ZyZW5jaCcsICdCdWNoYW5hbicsICdNb3JhbicsICdDb3BlbGFuZCcsICdSb3knLCAnUGl0dG1hbicsICdCcmFkeScsICdNY0Nvcm1pY2snLCAnSG9sbG93YXknLCAnQnJvY2snLCAnUG9vbGUnLCAnRnJhbmsnLCAnTG9nYW4nLCAnT3dlbicsICdCYXNzJywgJ01hcnNoJywgJ0RyYWtlJywgJ1dvbmcnLCAnSmVmZmVyc29uJywgJ1BhcmsnLCAnTW9ydG9uJywgJ0FiYm90dCcsICdTcGFya3MnLCAnUGF0cmljaycsICdOb3J0b24nLCAnSHVmZicsICdDbGF5dG9uJywgJ01hc3NleScsICdMbG95ZCcsICdGaWd1ZXJvYScsICdDYXJzb24nLCAnQm93ZXJzJywgJ1JvYmVyc29uJywgJ0JhcnRvbicsICdUcmFuJywgJ0xhbWInLCAnSGFycmluZ3RvbicsICdDYXNleScsICdCb29uZScsICdDb3J0ZXonLCAnQ2xhcmtlJywgJ01hdGhpcycsICdTaW5nbGV0b24nLCAnV2lsa2lucycsICdDYWluJywgJ0JyeWFuJywgJ1VuZGVyd29vZCcsICdIb2dhbicsICdNY0tlbnppZScsICdDb2xsaWVyJywgJ0x1bmEnLCAnUGhlbHBzJywgJ01jR3VpcmUnLCAnQWxsaXNvbicsICdCcmlkZ2VzJywgJ1dpbGtlcnNvbicsICdOYXNoJywgJ1N1bW1lcnMnLCAnQXRraW5zJ10sXG4gICAgICAgICAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHA6Ly93d3cuZGF0aS5nb3YuaXQvZGF0YXNldC9jb211bmUtZGktZmlyZW56ZV8wMTY0IChmaXJzdCAxMDAwKVxuICAgICAgICAgICAgXCJpdFwiOiBbXCJBY2NpYWlcIiwgXCJBZ2xpZXR0aVwiLCBcIkFnb3N0aW5pXCIsIFwiQWdyZXN0aVwiLCBcIkFobWVkXCIsIFwiQWlhenppXCIsIFwiQWxiYW5lc2VcIiwgXCJBbGJlcnRpXCIsIFwiQWxlc3NpXCIsIFwiQWxmYW5pXCIsIFwiQWxpbmFyaVwiLCBcIkFsdGVyaW5pXCIsIFwiQW1hdG9cIiwgXCJBbW1hbm5hdGlcIiwgXCJBbmNpbGxvdHRpXCIsIFwiQW5kcmVpXCIsIFwiQW5kcmVpbmlcIiwgXCJBbmRyZW9uaVwiLCBcIkFuZ2VsaVwiLCBcIkFuaWNoaW5pXCIsIFwiQW50b25lbGxpXCIsIFwiQW50b25pbmlcIiwgXCJBcmVuYVwiLCBcIkFyaWFuaVwiLCBcIkFybmV0b2xpXCIsIFwiQXJyaWdoaVwiLCBcIkJhY2NhbmlcIiwgXCJCYWNjZXR0aVwiLCBcIkJhY2NpXCIsIFwiQmFjaGVyaW5pXCIsIFwiQmFkaWlcIiwgXCJCYWdnaWFuaVwiLCBcIkJhZ2xpb25pXCIsIFwiQmFnbmlcIiwgXCJCYWdub2xpXCIsIFwiQmFsZGFzc2luaVwiLCBcIkJhbGRpXCIsIFwiQmFsZGluaVwiLCBcIkJhbGxlcmluaVwiLCBcIkJhbGxpXCIsIFwiQmFsbGluaVwiLCBcIkJhbGxvbmlcIiwgXCJCYW1iaVwiLCBcIkJhbmNoaVwiLCBcIkJhbmRpbmVsbGlcIiwgXCJCYW5kaW5pXCIsIFwiQmFuaVwiLCBcIkJhcmJldHRpXCIsIFwiQmFyYmllcmlcIiwgXCJCYXJjaGllbGxpXCIsIFwiQmFyZGF6emlcIiwgXCJCYXJkZWxsaVwiLCBcIkJhcmRpXCIsIFwiQmFyZHVjY2lcIiwgXCJCYXJnZWxsaW5pXCIsIFwiQmFyZ2lhY2NoaVwiLCBcIkJhcm5pXCIsIFwiQmFyb25jZWxsaVwiLCBcIkJhcm9uY2luaVwiLCBcIkJhcm9uZVwiLCBcIkJhcm9uaVwiLCBcIkJhcm9udGlcIiwgXCJCYXJ0YWxlc2lcIiwgXCJCYXJ0b2xldHRpXCIsIFwiQmFydG9saVwiLCBcIkJhcnRvbGluaVwiLCBcIkJhcnRvbG9uaVwiLCBcIkJhcnRvbG96emlcIiwgXCJCYXNhZ25pXCIsIFwiQmFzaWxlXCIsIFwiQmFzc2lcIiwgXCJCYXRhY2NoaVwiLCBcIkJhdHRhZ2xpYVwiLCBcIkJhdHRhZ2xpbmlcIiwgXCJCYXVzaVwiLCBcIkJlY2FnbGlcIiwgXCJCZWNhdHRpbmlcIiwgXCJCZWNjaGlcIiwgXCJCZWN1Y2NpXCIsIFwiQmVsbGFuZGlcIiwgXCJCZWxsZXNpXCIsIFwiQmVsbGlcIiwgXCJCZWxsaW5pXCIsIFwiQmVsbHVjY2lcIiwgXCJCZW5jaW5pXCIsIFwiQmVuZWRldHRpXCIsIFwiQmVuZWxsaVwiLCBcIkJlbmlcIiwgXCJCZW5pbmlcIiwgXCJCZW5zaVwiLCBcIkJlbnVjY2lcIiwgXCJCZW52ZW51dGlcIiwgXCJCZXJsaW5jaW9uaVwiLCBcIkJlcm5hY2NoaW9uaVwiLCBcIkJlcm5hcmRpXCIsIFwiQmVybmFyZGluaVwiLCBcIkJlcm5pXCIsIFwiQmVybmluaVwiLCBcIkJlcnRlbGxpXCIsIFwiQmVydGlcIiwgXCJCZXJ0aW5pXCIsIFwiQmVzc2lcIiwgXCJCZXR0aVwiLCBcIkJldHRpbmlcIiwgXCJCaWFnaVwiLCBcIkJpYWdpbmlcIiwgXCJCaWFnaW9uaVwiLCBcIkJpYWdpb3R0aVwiLCBcIkJpYW5jYWxhbmlcIiwgXCJCaWFuY2hpXCIsIFwiQmlhbmNoaW5pXCIsIFwiQmlhbmNvXCIsIFwiQmlmZm9saVwiLCBcIkJpZ2F6emlcIiwgXCJCaWdpXCIsIFwiQmlsaW90dGlcIiwgXCJCaWxsaVwiLCBcIkJpbmF6emlcIiwgXCJCaW5kaVwiLCBcIkJpbmlcIiwgXCJCaW9uZGlcIiwgXCJCaXp6YXJyaVwiLCBcIkJvY2NpXCIsIFwiQm9nYW5pXCIsIFwiQm9sb2duZXNpXCIsIFwiQm9uYWl1dGlcIiwgXCJCb25hbm5pXCIsIFwiQm9uY2lhbmlcIiwgXCJCb25jaW5lbGxpXCIsIFwiQm9uZGlcIiwgXCJCb25lY2hpXCIsIFwiQm9uZ2luaVwiLCBcIkJvbmlcIiwgXCJCb25pbmlcIiwgXCJCb3JjaGlcIiwgXCJCb3JldHRpXCIsIFwiQm9yZ2hpXCIsIFwiQm9yZ2hpbmlcIiwgXCJCb3JnaW9saVwiLCBcIkJvcnJpXCIsIFwiQm9yc2VsbGlcIiwgXCJCb3NjaGlcIiwgXCJCb3R0YWlcIiwgXCJCcmFjY2lcIiwgXCJCcmFjY2luaVwiLCBcIkJyYW5kaVwiLCBcIkJyYXNjaGlcIiwgXCJCcmF2aVwiLCBcIkJyYXp6aW5pXCIsIFwiQnJlc2NoaVwiLCBcIkJyaWxsaVwiLCBcIkJyaXp6aVwiLCBcIkJyb2dlbGxpXCIsIFwiQnJvZ2lcIiwgXCJCcm9naW9uaVwiLCBcIkJydW5lbGxpXCIsIFwiQnJ1bmV0dGlcIiwgXCJCcnVuaVwiLCBcIkJydW5vXCIsIFwiQnJ1bm9yaVwiLCBcIkJydXNjaGlcIiwgXCJCdWNjaVwiLCBcIkJ1Y2NpYXJlbGxpXCIsIFwiQnVjY2lvbmlcIiwgXCJCdWNlbGxpXCIsIFwiQnVsbGlcIiwgXCJCdXJiZXJpXCIsIFwiQnVyY2hpXCIsIFwiQnVyZ2Fzc2lcIiwgXCJCdXJyb25pXCIsIFwiQnVzc290dGlcIiwgXCJCdXRpXCIsIFwiQ2FjaW9sbGlcIiwgXCJDYWlhbmlcIiwgXCJDYWxhYnJlc2VcIiwgXCJDYWxhbWFpXCIsIFwiQ2FsYW1hbmRyZWlcIiwgXCJDYWxkaW5pXCIsIFwiQ2FsbydcIiwgXCJDYWxvbmFjaVwiLCBcIkNhbG9zaVwiLCBcIkNhbHZlbGxpXCIsIFwiQ2FtYmlcIiwgXCJDYW1pY2lvdHRvbGlcIiwgXCJDYW1tZWxsaVwiLCBcIkNhbW1pbGxpXCIsIFwiQ2FtcG9sbWlcIiwgXCJDYW50aW5pXCIsIFwiQ2FwYW5uaVwiLCBcIkNhcGVjY2hpXCIsIFwiQ2Fwb25pXCIsIFwiQ2FwcGVsbGV0dGlcIiwgXCJDYXBwZWxsaVwiLCBcIkNhcHBlbGxpbmlcIiwgXCJDYXBwdWdpXCIsIFwiQ2FwcmV0dGlcIiwgXCJDYXB1dG9cIiwgXCJDYXJib25lXCIsIFwiQ2FyYm9uaVwiLCBcIkNhcmRpbmlcIiwgXCJDYXJsZXNpXCIsIFwiQ2FybGV0dGlcIiwgXCJDYXJsaVwiLCBcIkNhcm90aVwiLCBcIkNhcm90dGlcIiwgXCJDYXJyYWlcIiwgXCJDYXJyYXJlc2lcIiwgXCJDYXJ0YVwiLCBcIkNhcnVzb1wiLCBcIkNhc2FsaW5pXCIsIFwiQ2FzYXRpXCIsIFwiQ2FzZWxsaVwiLCBcIkNhc2luaVwiLCBcIkNhc3RhZ25vbGlcIiwgXCJDYXN0ZWxsYW5pXCIsIFwiQ2FzdGVsbGlcIiwgXCJDYXN0ZWxsdWNjaVwiLCBcIkNhdGFsYW5vXCIsIFwiQ2F0YXJ6aVwiLCBcIkNhdGVsYW5pXCIsIFwiQ2F2YWNpb2NjaGlcIiwgXCJDYXZhbGxhcm9cIiwgXCJDYXZhbGxpbmlcIiwgXCJDYXZpY2NoaVwiLCBcIkNhdmluaVwiLCBcIkNlY2NhcmVsbGlcIiwgXCJDZWNjYXRlbGxpXCIsIFwiQ2VjY2hlcmVsbGlcIiwgXCJDZWNjaGVyaW5pXCIsIFwiQ2VjY2hpXCIsIFwiQ2VjY2hpbmlcIiwgXCJDZWNjb25pXCIsIFwiQ2VpXCIsIFwiQ2VsbGFpXCIsIFwiQ2VsbGlcIiwgXCJDZWxsaW5pXCIsIFwiQ2VuY2V0dGlcIiwgXCJDZW5pXCIsIFwiQ2VubmlcIiwgXCJDZXJiYWlcIiwgXCJDZXNhcmlcIiwgXCJDZXNlcmlcIiwgXCJDaGVjY2FjY2lcIiwgXCJDaGVjY2hpXCIsIFwiQ2hlY2N1Y2NpXCIsIFwiQ2hlbGlcIiwgXCJDaGVsbGluaVwiLCBcIkNoZW5cIiwgXCJDaGVuZ1wiLCBcIkNoZXJpY2lcIiwgXCJDaGVydWJpbmlcIiwgXCJDaGlhcmFtb250aVwiLCBcIkNoaWFyYW50aW5pXCIsIFwiQ2hpYXJlbGxpXCIsIFwiQ2hpYXJpXCIsIFwiQ2hpYXJpbmlcIiwgXCJDaGlhcnVnaVwiLCBcIkNoaWF2YWNjaVwiLCBcIkNoaWVzaVwiLCBcIkNoaW1lbnRpXCIsIFwiQ2hpbmlcIiwgXCJDaGlyaWNpXCIsIFwiQ2hpdGlcIiwgXCJDaWFiYXR0aVwiLCBcIkNpYW1waVwiLCBcIkNpYW5jaGlcIiwgXCJDaWFuZmFuZWxsaVwiLCBcIkNpYW5mZXJvbmlcIiwgXCJDaWFuaVwiLCBcIkNpYXBldHRpXCIsIFwiQ2lhcHBpXCIsIFwiQ2lhcmRpXCIsIFwiQ2lhdHRpXCIsIFwiQ2ljYWxpXCIsIFwiQ2ljY29uZVwiLCBcIkNpbmVsbGlcIiwgXCJDaW5pXCIsIFwiQ2lvYmFudVwiLCBcIkNpb2xsaVwiLCBcIkNpb25pXCIsIFwiQ2lwcmlhbmlcIiwgXCJDaXJpbGxvXCIsIFwiQ2lycmlcIiwgXCJDaXVjY2hpXCIsIFwiQ2l1ZmZpXCIsIFwiQ2l1bGxpXCIsIFwiQ2l1bGxpbmlcIiwgXCJDbGVtZW50ZVwiLCBcIkNvY2NoaVwiLCBcIkNvZ25vbWVcIiwgXCJDb2xpXCIsIFwiQ29sbGluaVwiLCBcIkNvbG9tYm9cIiwgXCJDb2x6aVwiLCBcIkNvbXBhcmluaVwiLCBcIkNvbmZvcnRpXCIsIFwiQ29uc2lnbGlcIiwgXCJDb250ZVwiLCBcIkNvbnRpXCIsIFwiQ29udGluaVwiLCBcIkNvcHBpbmlcIiwgXCJDb3Bwb2xhXCIsIFwiQ29yc2lcIiwgXCJDb3JzaW5pXCIsIFwiQ29ydGlcIiwgXCJDb3J0aW5pXCIsIFwiQ29zaVwiLCBcIkNvc3RhXCIsIFwiQ29zdGFudGluaVwiLCBcIkNvc3RhbnRpbm9cIiwgXCJDb3p6aVwiLCBcIkNyZXNjaVwiLCBcIkNyZXNjaW9saVwiLCBcIkNyZXN0aVwiLCBcIkNyaW5pXCIsIFwiQ3VycmFkaVwiLCBcIkQnQWdvc3Rpbm9cIiwgXCJEJ0FsZXNzYW5kcm9cIiwgXCJEJ0FtaWNvXCIsIFwiRCdBbmdlbG9cIiwgXCJEYWRkaVwiLCBcIkRhaW5lbGxpXCIsIFwiRGFsbGFpXCIsIFwiRGFudGlcIiwgXCJEYXZpdHRpXCIsIFwiRGUgQW5nZWxpc1wiLCBcIkRlIEx1Y2FcIiwgXCJEZSBNYXJjb1wiLCBcIkRlIFJvc2FcIiwgXCJEZSBTYW50aXNcIiwgXCJEZSBTaW1vbmVcIiwgXCJEZSBWaXRhXCIsIFwiRGVnbCdJbm5vY2VudGlcIiwgXCJEZWdsaSBJbm5vY2VudGlcIiwgXCJEZWlcIiwgXCJEZWwgTHVuZ29cIiwgXCJEZWwgUmVcIiwgXCJEaSBNYXJjb1wiLCBcIkRpIFN0ZWZhbm9cIiwgXCJEaW5pXCIsIFwiRGlvcFwiLCBcIkRvYnJlXCIsIFwiRG9sZmlcIiwgXCJEb25hdGlcIiwgXCJEb25kb2xpXCIsIFwiRG9uZ1wiLCBcIkRvbm5pbmlcIiwgXCJEdWNjaVwiLCBcIkR1bWl0cnVcIiwgXCJFcm1pbmlcIiwgXCJFc3Bvc2l0b1wiLCBcIkV2YW5nZWxpc3RpXCIsIFwiRmFiYnJpXCIsIFwiRmFiYnJpbmlcIiwgXCJGYWJicml6emlcIiwgXCJGYWJicm9uaVwiLCBcIkZhYmJydWNjaVwiLCBcIkZhYmlhbmlcIiwgXCJGYWNjaGluaVwiLCBcIkZhZ2dpXCIsIFwiRmFnaW9saVwiLCBcIkZhaWxsaVwiLCBcIkZhaW5pXCIsIFwiRmFsY2lhbmlcIiwgXCJGYWxjaW5pXCIsIFwiRmFsY29uZVwiLCBcIkZhbGxhbmlcIiwgXCJGYWxvcm5pXCIsIFwiRmFsc2luaVwiLCBcIkZhbHVnaWFuaVwiLCBcIkZhbmNlbGxpXCIsIFwiRmFuZWxsaVwiLCBcIkZhbmV0dGlcIiwgXCJGYW5mYW5pXCIsIFwiRmFuaVwiLCBcIkZhbnRhcHBpZSdcIiwgXCJGYW50ZWNoaVwiLCBcIkZhbnRpXCIsIFwiRmFudGluaVwiLCBcIkZhbnRvbmlcIiwgXCJGYXJpbmFcIiwgXCJGYXR0b3JpXCIsIFwiRmF2aWxsaVwiLCBcIkZlZGlcIiwgXCJGZWlcIiwgXCJGZXJyYW50ZVwiLCBcIkZlcnJhcmFcIiwgXCJGZXJyYXJpXCIsIFwiRmVycmFyb1wiLCBcIkZlcnJldHRpXCIsIFwiRmVycmlcIiwgXCJGZXJyaW5pXCIsIFwiRmVycm9uaVwiLCBcIkZpYXNjaGlcIiwgXCJGaWJiaVwiLCBcIkZpZXNvbGlcIiwgXCJGaWxpcHBpXCIsIFwiRmlsaXBwaW5pXCIsIFwiRmluaVwiLCBcIkZpb3JhdmFudGlcIiwgXCJGaW9yZVwiLCBcIkZpb3JlbnRpbmlcIiwgXCJGaW9yaW5pXCIsIFwiRmlzc2lcIiwgXCJGb2NhcmRpXCIsIFwiRm9nZ2lcIiwgXCJGb250YW5hXCIsIFwiRm9udGFuZWxsaVwiLCBcIkZvbnRhbmlcIiwgXCJGb3Jjb25pXCIsIFwiRm9ybWlnbGlcIiwgXCJGb3J0ZVwiLCBcIkZvcnRpXCIsIFwiRm9ydGluaVwiLCBcIkZvc3NhdGlcIiwgXCJGb3NzaVwiLCBcIkZyYW5jYWxhbmNpXCIsIFwiRnJhbmNlc2NoaVwiLCBcIkZyYW5jZXNjaGluaVwiLCBcIkZyYW5jaGlcIiwgXCJGcmFuY2hpbmlcIiwgXCJGcmFuY2lcIiwgXCJGcmFuY2luaVwiLCBcIkZyYW5jaW9uaVwiLCBcIkZyYW5jb1wiLCBcIkZyYXNzaW5ldGlcIiwgXCJGcmF0aVwiLCBcIkZyYXRpbmlcIiwgXCJGcmlsbGlcIiwgXCJGcml6emlcIiwgXCJGcm9zYWxpXCIsIFwiRnJvc2luaVwiLCBcIkZydWxsaW5pXCIsIFwiRnVzY29cIiwgXCJGdXNpXCIsIFwiR2FiYnJpZWxsaVwiLCBcIkdhYmVsbGluaVwiLCBcIkdhZ2xpYXJkaVwiLCBcIkdhbGFudGlcIiwgXCJHYWxhcmRpXCIsIFwiR2FsZW90dGlcIiwgXCJHYWxsZXR0aVwiLCBcIkdhbGxpXCIsIFwiR2FsbG9cIiwgXCJHYWxsb3JpXCIsIFwiR2FtYmFjY2lhbmlcIiwgXCJHYXJnYW5pXCIsIFwiR2Fyb2ZhbG9cIiwgXCJHYXJ1Z2xpZXJpXCIsIFwiR2FzaGlcIiwgXCJHYXNwZXJpbmlcIiwgXCJHYXR0aVwiLCBcIkdlbGxpXCIsIFwiR2Vuc2luaVwiLCBcIkdlbnRpbGVcIiwgXCJHZW50aWxpXCIsIFwiR2VyaVwiLCBcIkdlcmluaVwiLCBcIkdoZXJpXCIsIFwiR2hpbmlcIiwgXCJHaWFjaGV0dGlcIiwgXCJHaWFjaGlcIiwgXCJHaWFjb21lbGxpXCIsIFwiR2lhbmFzc2lcIiwgXCJHaWFuaVwiLCBcIkdpYW5uZWxsaVwiLCBcIkdpYW5uZXR0aVwiLCBcIkdpYW5uaVwiLCBcIkdpYW5uaW5pXCIsIFwiR2lhbm5vbmlcIiwgXCJHaWFubm90dGlcIiwgXCJHaWFubm96emlcIiwgXCJHaWdsaVwiLCBcIkdpb3JkYW5vXCIsIFwiR2lvcmdldHRpXCIsIFwiR2lvcmdpXCIsIFwiR2lvdmFjY2hpbmlcIiwgXCJHaW92YW5uZWxsaVwiLCBcIkdpb3Zhbm5ldHRpXCIsIFwiR2lvdmFubmluaVwiLCBcIkdpb3Zhbm5vbmlcIiwgXCJHaXVsaWFuaVwiLCBcIkdpdW50aVwiLCBcIkdpdW50aW5pXCIsIFwiR2l1c3RpXCIsIFwiR29ubmVsbGlcIiwgXCJHb3JldHRpXCIsIFwiR29yaVwiLCBcIkdyYWRpXCIsIFwiR3JhbWlnbmlcIiwgXCJHcmFzc2lcIiwgXCJHcmFzc29cIiwgXCJHcmF6aWFuaVwiLCBcIkdyYXp6aW5pXCIsIFwiR3JlY29cIiwgXCJHcmlmb25pXCIsIFwiR3JpbGxvXCIsIFwiR3JpbWFsZGlcIiwgXCJHcm9zc2lcIiwgXCJHdWFsdGllcmlcIiwgXCJHdWFyZHVjY2lcIiwgXCJHdWFyaW5vXCIsIFwiR3Vhcm5pZXJpXCIsIFwiR3Vhc3RpXCIsIFwiR3VlcnJhXCIsIFwiR3VlcnJpXCIsIFwiR3VlcnJpbmlcIiwgXCJHdWlkaVwiLCBcIkd1aWRvdHRpXCIsIFwiSGVcIiwgXCJIb3hoYVwiLCBcIkh1XCIsIFwiSHVhbmdcIiwgXCJJYW5kZWxsaVwiLCBcIklnbmVzdGlcIiwgXCJJbm5vY2VudGlcIiwgXCJKaW5cIiwgXCJMYSBSb3NhXCIsIFwiTGFpXCIsIFwiTGFuZGlcIiwgXCJMYW5kaW5pXCIsIFwiTGFuaW5pXCIsIFwiTGFwaVwiLCBcIkxhcGluaVwiLCBcIkxhcmlcIiwgXCJMYXNjaWFsZmFyaVwiLCBcIkxhc3RydWNjaVwiLCBcIkxhdGluaVwiLCBcIkxhenplcmlcIiwgXCJMYXp6ZXJpbmlcIiwgXCJMZWxsaVwiLCBcIkxlbnppXCIsIFwiTGVvbmFyZGlcIiwgXCJMZW9uY2luaVwiLCBcIkxlb25lXCIsIFwiTGVvbmlcIiwgXCJMZXByaVwiLCBcIkxpXCIsIFwiTGlhb1wiLCBcIkxpblwiLCBcIkxpbmFyaVwiLCBcIkxpcHBpXCIsIFwiTGlzaVwiLCBcIkxpdmlcIiwgXCJMb21iYXJkaVwiLCBcIkxvbWJhcmRpbmlcIiwgXCJMb21iYXJkb1wiLCBcIkxvbmdvXCIsIFwiTG9wZXpcIiwgXCJMb3JlbnppXCIsIFwiTG9yZW56aW5pXCIsIFwiTG9yaW5pXCIsIFwiTG90dGlcIiwgXCJMdVwiLCBcIkx1Y2NoZXNpXCIsIFwiTHVjaGVyaW5pXCIsIFwiTHVuZ2hpXCIsIFwiTHVwaVwiLCBcIk1hZGlhaVwiLCBcIk1hZXN0cmluaVwiLCBcIk1hZmZlaVwiLCBcIk1hZ2dpXCIsIFwiTWFnZ2luaVwiLCBcIk1hZ2hlcmluaVwiLCBcIk1hZ2luaVwiLCBcIk1hZ25hbmlcIiwgXCJNYWduZWxsaVwiLCBcIk1hZ25pXCIsIFwiTWFnbm9sZmlcIiwgXCJNYWdyaW5pXCIsIFwiTWFsYXZvbHRpXCIsIFwiTWFsZXZvbHRpXCIsIFwiTWFuY2FcIiwgXCJNYW5jaW5pXCIsIFwiTWFuZXR0aVwiLCBcIk1hbmZyZWRpXCIsIFwiTWFuZ2FuaVwiLCBcIk1hbm5lbGxpXCIsIFwiTWFubmlcIiwgXCJNYW5uaW5pXCIsIFwiTWFubnVjY2lcIiwgXCJNYW51ZWxsaVwiLCBcIk1hbnppbmlcIiwgXCJNYXJjZWxsaVwiLCBcIk1hcmNoZXNlXCIsIFwiTWFyY2hldHRpXCIsIFwiTWFyY2hpXCIsIFwiTWFyY2hpYW5pXCIsIFwiTWFyY2hpb25uaVwiLCBcIk1hcmNvbmlcIiwgXCJNYXJjdWNjaVwiLCBcIk1hcmdoZXJpXCIsIFwiTWFyaVwiLCBcIk1hcmlhbmlcIiwgXCJNYXJpbGxpXCIsIFwiTWFyaW5haVwiLCBcIk1hcmluYXJpXCIsIFwiTWFyaW5lbGxpXCIsIFwiTWFyaW5pXCIsIFwiTWFyaW5vXCIsIFwiTWFyaW90dGlcIiwgXCJNYXJzaWxpXCIsIFwiTWFydGVsbGlcIiwgXCJNYXJ0aW5lbGxpXCIsIFwiTWFydGluaVwiLCBcIk1hcnRpbm9cIiwgXCJNYXJ6aVwiLCBcIk1hc2lcIiwgXCJNYXNpbmlcIiwgXCJNYXNvbmlcIiwgXCJNYXNzYWlcIiwgXCJNYXRlcmFzc2lcIiwgXCJNYXR0ZWlcIiwgXCJNYXR0ZWluaVwiLCBcIk1hdHRldWNjaVwiLCBcIk1hdHRldXp6aVwiLCBcIk1hdHRpb2xpXCIsIFwiTWF0dG9saW5pXCIsIFwiTWF0dWNjaVwiLCBcIk1hdXJvXCIsIFwiTWF6emFudGlcIiwgXCJNYXp6ZWlcIiwgXCJNYXp6ZXR0aVwiLCBcIk1henppXCIsIFwiTWF6emluaVwiLCBcIk1henpvY2NoaVwiLCBcIk1henpvbGlcIiwgXCJNYXp6b25pXCIsIFwiTWF6enVvbGlcIiwgXCJNZWFjY2lcIiwgXCJNZWNvY2NpXCIsIFwiTWVpbmlcIiwgXCJNZWxhbmlcIiwgXCJNZWxlXCIsIFwiTWVsaVwiLCBcIk1lbmdvbmlcIiwgXCJNZW5pY2hldHRpXCIsIFwiTWVvbmlcIiwgXCJNZXJsaW5pXCIsIFwiTWVzc2VyaVwiLCBcIk1lc3NpbmFcIiwgXCJNZXVjY2lcIiwgXCJNaWNjaW5lc2lcIiwgXCJNaWNlbGlcIiwgXCJNaWNoZWxpXCIsIFwiTWljaGVsaW5pXCIsIFwiTWljaGVsb3p6aVwiLCBcIk1pZ2xpb3JpXCIsIFwiTWlnbGlvcmluaVwiLCBcIk1pbGFuaVwiLCBcIk1pbmlhdGlcIiwgXCJNaXN1cmlcIiwgXCJNb25hY29cIiwgXCJNb250YWduYW5pXCIsIFwiTW9udGFnbmlcIiwgXCJNb250YW5hcmlcIiwgXCJNb250ZWxhdGljaVwiLCBcIk1vbnRpXCIsIFwiTW9udGlnaWFuaVwiLCBcIk1vbnRpbmlcIiwgXCJNb3JhbmRpXCIsIFwiTW9yYW5kaW5pXCIsIFwiTW9yZWxsaVwiLCBcIk1vcmV0dGlcIiwgXCJNb3JnYW50aVwiLCBcIk1vcmlcIiwgXCJNb3JpbmlcIiwgXCJNb3JvbmlcIiwgXCJNb3JvenppXCIsIFwiTXVnbmFpXCIsIFwiTXVnbmFpbmlcIiwgXCJNdXN0YWZhXCIsIFwiTmFsZGlcIiwgXCJOYWxkaW5pXCIsIFwiTmFubmVsbGlcIiwgXCJOYW5uaVwiLCBcIk5hbm5pbmlcIiwgXCJOYW5udWNjaVwiLCBcIk5hcmRpXCIsIFwiTmFyZGluaVwiLCBcIk5hcmRvbmlcIiwgXCJOYXRhbGlcIiwgXCJOZGlheWVcIiwgXCJOZW5jZXR0aVwiLCBcIk5lbmNpbmlcIiwgXCJOZW5jaW9uaVwiLCBcIk5lcmlcIiwgXCJOZXNpXCIsIFwiTmVzdGlcIiwgXCJOaWNjb2xhaVwiLCBcIk5pY2NvbGlcIiwgXCJOaWNjb2xpbmlcIiwgXCJOaWdpXCIsIFwiTmlzdHJpXCIsIFwiTm9jZW50aW5pXCIsIFwiTm9mZXJpbmlcIiwgXCJOb3ZlbGxpXCIsIFwiTnVjY2lcIiwgXCJOdXRpXCIsIFwiTnV0aW5pXCIsIFwiT2xpdmFcIiwgXCJPbGl2aWVyaVwiLCBcIk9sbWlcIiwgXCJPcmxhbmRpXCIsIFwiT3JsYW5kaW5pXCIsIFwiT3JsYW5kb1wiLCBcIk9yc2luaVwiLCBcIk9ydG9sYW5pXCIsIFwiT3R0YW5lbGxpXCIsIFwiUGFjY2lhbmlcIiwgXCJQYWNlXCIsIFwiUGFjaVwiLCBcIlBhY2luaVwiLCBcIlBhZ2FuaVwiLCBcIlBhZ2Fub1wiLCBcIlBhZ2dldHRpXCIsIFwiUGFnbGlhaVwiLCBcIlBhZ25pXCIsIFwiUGFnbmluaVwiLCBcIlBhbGFkaW5pXCIsIFwiUGFsYWdpXCIsIFwiUGFsY2hldHRpXCIsIFwiUGFsbG9uaVwiLCBcIlBhbG1pZXJpXCIsIFwiUGFsdW1ib1wiLCBcIlBhbXBhbG9uaVwiLCBcIlBhbmNhbmlcIiwgXCJQYW5kb2xmaVwiLCBcIlBhbmRvbGZpbmlcIiwgXCJQYW5lcmFpXCIsIFwiUGFuaWNoaVwiLCBcIlBhb2xldHRpXCIsIFwiUGFvbGlcIiwgXCJQYW9saW5pXCIsIFwiUGFwaVwiLCBcIlBhcGluaVwiLCBcIlBhcHVjY2lcIiwgXCJQYXJlbnRpXCIsIFwiUGFyaWdpXCIsIFwiUGFyaXNpXCIsIFwiUGFycmlcIiwgXCJQYXJyaW5pXCIsIFwiUGFzcXVpbmlcIiwgXCJQYXNzZXJpXCIsIFwiUGVjY2hpb2xpXCIsIFwiUGVjb3JpbmlcIiwgXCJQZWxsZWdyaW5pXCIsIFwiUGVwaVwiLCBcIlBlcmluaVwiLCBcIlBlcnJvbmVcIiwgXCJQZXJ1enppXCIsIFwiUGVzY2lcIiwgXCJQZXN0ZWxsaVwiLCBcIlBldHJpXCIsIFwiUGV0cmluaVwiLCBcIlBldHJ1Y2NpXCIsIFwiUGV0dGluaVwiLCBcIlBlenphdGlcIiwgXCJQZXp6YXRpbmlcIiwgXCJQaWFuaVwiLCBcIlBpYXp6YVwiLCBcIlBpYXp6ZXNpXCIsIFwiUGlhenppbmlcIiwgXCJQaWNjYXJkaVwiLCBcIlBpY2NoaVwiLCBcIlBpY2NpbmlcIiwgXCJQaWNjaW9saVwiLCBcIlBpZXJhY2NpbmlcIiwgXCJQaWVyYWNjaW9uaVwiLCBcIlBpZXJhbGxpXCIsIFwiUGllcmF0dGluaVwiLCBcIlBpZXJpXCIsIFwiUGllcmluaVwiLCBcIlBpZXJvbmlcIiwgXCJQaWV0cmluaVwiLCBcIlBpbmlcIiwgXCJQaW5uYVwiLCBcIlBpbnRvXCIsIFwiUGluemFuaVwiLCBcIlBpbnphdXRpXCIsIFwiUGlyYXNcIiwgXCJQaXNhbmlcIiwgXCJQaXN0b2xlc2lcIiwgXCJQb2dnZXNpXCIsIFwiUG9nZ2lcIiwgXCJQb2dnaWFsaVwiLCBcIlBvZ2dpb2xpbmlcIiwgXCJQb2xpXCIsIFwiUG9sbGFzdHJpXCIsIFwiUG9yY2lhbmlcIiwgXCJQb3p6aVwiLCBcIlByYXRlbGxlc2lcIiwgXCJQcmF0ZXNpXCIsIFwiUHJvc3BlcmlcIiwgXCJQcnVuZXRpXCIsIFwiUHVjY2lcIiwgXCJQdWNjaW5pXCIsIFwiUHVjY2lvbmlcIiwgXCJQdWdpXCIsIFwiUHVnbGllc2VcIiwgXCJQdWxpdGlcIiwgXCJRdWVyY2lcIiwgXCJRdWVyY2lvbGlcIiwgXCJSYWRkaVwiLCBcIlJhZHVcIiwgXCJSYWZmYWVsbGlcIiwgXCJSYWdhenppbmlcIiwgXCJSYW5mYWduaVwiLCBcIlJhbmllcmlcIiwgXCJSYXN0cmVsbGlcIiwgXCJSYXVnZWlcIiwgXCJSYXZlZ2dpXCIsIFwiUmVuYWlcIiwgXCJSZW56aVwiLCBcIlJldHRvcmlcIiwgXCJSaWNjaVwiLCBcIlJpY2NpYXJkaVwiLCBcIlJpZGlcIiwgXCJSaWRvbGZpXCIsIFwiUmlnYWNjaVwiLCBcIlJpZ2hpXCIsIFwiUmlnaGluaVwiLCBcIlJpbmFsZGlcIiwgXCJSaXNhbGl0aVwiLCBcIlJpc3RvcmlcIiwgXCJSaXp6b1wiLCBcIlJvY2NoaVwiLCBcIlJvY2NoaW5pXCIsIFwiUm9nYWlcIiwgXCJSb21hZ25vbGlcIiwgXCJSb21hbmVsbGlcIiwgXCJSb21hbmlcIiwgXCJSb21hbm9cIiwgXCJSb21laVwiLCBcIlJvbWVvXCIsIFwiUm9taXRpXCIsIFwiUm9tb2xpXCIsIFwiUm9tb2xpbmlcIiwgXCJSb250aW5pXCIsIFwiUm9zYXRpXCIsIFwiUm9zZWxsaVwiLCBcIlJvc2lcIiwgXCJSb3NzZXR0aVwiLCBcIlJvc3NpXCIsIFwiUm9zc2luaVwiLCBcIlJvdmFpXCIsIFwiUnVnZ2VyaVwiLCBcIlJ1Z2dpZXJvXCIsIFwiUnVzc29cIiwgXCJTYWJhdGluaVwiLCBcIlNhY2NhcmRpXCIsIFwiU2FjY2hldHRpXCIsIFwiU2FjY2hpXCIsIFwiU2FjY29cIiwgXCJTYWxlcm5vXCIsIFwiU2FsaW1iZW5pXCIsIFwiU2FsdWNjaVwiLCBcIlNhbHZhZG9yaVwiLCBcIlNhbHZlc3RyaW5pXCIsIFwiU2FsdmlcIiwgXCJTYWx2aW5pXCIsIFwiU2FuZXNpXCIsIFwiU2FuaVwiLCBcIlNhbm5hXCIsIFwiU2FudGlcIiwgXCJTYW50aW5pXCIsIFwiU2FudG9uaVwiLCBcIlNhbnRvcm9cIiwgXCJTYW50dWNjaVwiLCBcIlNhcmRpXCIsIFwiU2FycmlcIiwgXCJTYXJ0aVwiLCBcIlNhc3NpXCIsIFwiU2JvbGNpXCIsIFwiU2NhbGlcIiwgXCJTY2FycGVsbGlcIiwgXCJTY2Fyc2VsbGlcIiwgXCJTY29wZXRhbmlcIiwgXCJTZWNjaVwiLCBcIlNlbHZpXCIsIFwiU2VuYXRvcmlcIiwgXCJTZW5lc2lcIiwgXCJTZXJhZmluaVwiLCBcIlNlcmVuaVwiLCBcIlNlcnJhXCIsIFwiU2VzdGluaVwiLCBcIlNndWFuY2lcIiwgXCJTaWVuaVwiLCBcIlNpZ25vcmluaVwiLCBcIlNpbHZlc3RyaVwiLCBcIlNpbW9uY2luaVwiLCBcIlNpbW9uZXR0aVwiLCBcIlNpbW9uaVwiLCBcIlNpbmdoXCIsIFwiU29kaVwiLCBcIlNvbGRpXCIsIFwiU29taWdsaVwiLCBcIlNvcmJpXCIsIFwiU29yZWxsaVwiLCBcIlNvcnJlbnRpbm9cIiwgXCJTb3R0aWxpXCIsIFwiU3BpbmFcIiwgXCJTcGluZWxsaVwiLCBcIlN0YWNjaW9saVwiLCBcIlN0YWRlcmluaVwiLCBcIlN0ZWZhbmVsbGlcIiwgXCJTdGVmYW5pXCIsIFwiU3RlZmFuaW5pXCIsIFwiU3RlbGxhXCIsIFwiU3VzaW5pXCIsIFwiVGFjY2hpXCIsIFwiVGFjY29uaVwiLCBcIlRhZGRlaVwiLCBcIlRhZ2xpYWZlcnJpXCIsIFwiVGFtYnVyaW5pXCIsIFwiVGFuZ2FuZWxsaVwiLCBcIlRhbmlcIiwgXCJUYW5pbmlcIiwgXCJUYXBpbmFzc2lcIiwgXCJUYXJjaGlcIiwgXCJUYXJjaGlhbmlcIiwgXCJUYXJnaW9uaVwiLCBcIlRhc3NpXCIsIFwiVGFzc2luaVwiLCBcIlRlbXBlc3RpXCIsIFwiVGVyemFuaVwiLCBcIlRlc2lcIiwgXCJUZXN0YVwiLCBcIlRlc3RpXCIsIFwiVGlsbGlcIiwgXCJUaW50aVwiLCBcIlRpcmlubmFuemlcIiwgXCJUb2NjYWZvbmRpXCIsIFwiVG9mYW5hcmlcIiwgXCJUb2ZhbmlcIiwgXCJUb2duYWNjaW5pXCIsIFwiVG9uZWxsaVwiLCBcIlRvbmluaVwiLCBcIlRvcmVsbGlcIiwgXCJUb3JyaW5pXCIsIFwiVG9zaVwiLCBcIlRvdGlcIiwgXCJUb3p6aVwiLCBcIlRyYW1idXN0aVwiLCBcIlRyYXBhbmlcIiwgXCJUdWNjaVwiLCBcIlR1cmNoaVwiLCBcIlVnb2xpbmlcIiwgXCJVbGl2aVwiLCBcIlZhbGVudGVcIiwgXCJWYWxlbnRpXCIsIFwiVmFsZW50aW5pXCIsIFwiVmFuZ2VsaXN0aVwiLCBcIlZhbm5pXCIsIFwiVmFubmluaVwiLCBcIlZhbm5vbmlcIiwgXCJWYW5ub3p6aVwiLCBcIlZhbm51Y2NoaVwiLCBcIlZhbm51Y2NpXCIsIFwiVmVudHVyYVwiLCBcIlZlbnR1cmlcIiwgXCJWZW50dXJpbmlcIiwgXCJWZXN0cmlcIiwgXCJWZXR0b3JpXCIsIFwiVmljaGlcIiwgXCJWaWNpYW5pXCIsIFwiVmllcmlcIiwgXCJWaWdpYW5pXCIsIFwiVmlnbm9saVwiLCBcIlZpZ25vbGluaVwiLCBcIlZpZ25venppXCIsIFwiVmlsbGFuaVwiLCBcIlZpbmNpXCIsIFwiVmlzYW5pXCIsIFwiVml0YWxlXCIsIFwiVml0YWxpXCIsIFwiVml0aVwiLCBcIlZpdmlhbmlcIiwgXCJWaXZvbGlcIiwgXCJWb2xwZVwiLCBcIlZvbHBpXCIsIFwiV2FuZ1wiLCBcIld1XCIsIFwiWHVcIiwgXCJZYW5nXCIsIFwiWWVcIiwgXCJaYWdsaVwiLCBcIlphbmlcIiwgXCJaYW5pZXJpXCIsIFwiWmFub2JpbmlcIiwgXCJaZWNjaGlcIiwgXCJaZXR0aVwiLCBcIlpoYW5nXCIsIFwiWmhlbmdcIiwgXCJaaG91XCIsIFwiWmh1XCIsIFwiWmluZ29uaVwiLCBcIlppbmlcIiwgXCJab3BwaVwiXVxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdW1waXJza3kvY291bnRyeS1saXN0L2Jsb2IvbWFzdGVyL2RhdGEvZW5fVVMvY291bnRyeS5qc29uXG4gICAgICAgIGNvdW50cmllczogW3tcIm5hbWVcIjpcIkFmZ2hhbmlzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFGXCJ9LHtcIm5hbWVcIjpcIsOFbGFuZCBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFYXCJ9LHtcIm5hbWVcIjpcIkFsYmFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiQUxcIn0se1wibmFtZVwiOlwiQWxnZXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJEWlwifSx7XCJuYW1lXCI6XCJBbWVyaWNhbiBTYW1vYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBU1wifSx7XCJuYW1lXCI6XCJBbmRvcnJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFEXCJ9LHtcIm5hbWVcIjpcIkFuZ29sYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBT1wifSx7XCJuYW1lXCI6XCJBbmd1aWxsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBSVwifSx7XCJuYW1lXCI6XCJBbnRhcmN0aWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFRXCJ9LHtcIm5hbWVcIjpcIkFudGlndWEgJiBCYXJidWRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFHXCJ9LHtcIm5hbWVcIjpcIkFyZ2VudGluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBUlwifSx7XCJuYW1lXCI6XCJBcm1lbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFNXCJ9LHtcIm5hbWVcIjpcIkFydWJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFXXCJ9LHtcIm5hbWVcIjpcIkFzY2Vuc2lvbiBJc2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiQUNcIn0se1wibmFtZVwiOlwiQXVzdHJhbGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFVXCJ9LHtcIm5hbWVcIjpcIkF1c3RyaWFcIixcImFiYnJldmlhdGlvblwiOlwiQVRcIn0se1wibmFtZVwiOlwiQXplcmJhaWphblwiLFwiYWJicmV2aWF0aW9uXCI6XCJBWlwifSx7XCJuYW1lXCI6XCJCYWhhbWFzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJTXCJ9LHtcIm5hbWVcIjpcIkJhaHJhaW5cIixcImFiYnJldmlhdGlvblwiOlwiQkhcIn0se1wibmFtZVwiOlwiQmFuZ2xhZGVzaFwiLFwiYWJicmV2aWF0aW9uXCI6XCJCRFwifSx7XCJuYW1lXCI6XCJCYXJiYWRvc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCQlwifSx7XCJuYW1lXCI6XCJCZWxhcnVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJZXCJ9LHtcIm5hbWVcIjpcIkJlbGdpdW1cIixcImFiYnJldmlhdGlvblwiOlwiQkVcIn0se1wibmFtZVwiOlwiQmVsaXplXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJaXCJ9LHtcIm5hbWVcIjpcIkJlbmluXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJKXCJ9LHtcIm5hbWVcIjpcIkJlcm11ZGFcIixcImFiYnJldmlhdGlvblwiOlwiQk1cIn0se1wibmFtZVwiOlwiQmh1dGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJUXCJ9LHtcIm5hbWVcIjpcIkJvbGl2aWFcIixcImFiYnJldmlhdGlvblwiOlwiQk9cIn0se1wibmFtZVwiOlwiQm9zbmlhICYgSGVyemVnb3ZpbmFcIixcImFiYnJldmlhdGlvblwiOlwiQkFcIn0se1wibmFtZVwiOlwiQm90c3dhbmFcIixcImFiYnJldmlhdGlvblwiOlwiQldcIn0se1wibmFtZVwiOlwiQnJhemlsXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJSXCJ9LHtcIm5hbWVcIjpcIkJyaXRpc2ggSW5kaWFuIE9jZWFuIFRlcnJpdG9yeVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJT1wifSx7XCJuYW1lXCI6XCJCcml0aXNoIFZpcmdpbiBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZHXCJ9LHtcIm5hbWVcIjpcIkJydW5laVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCTlwifSx7XCJuYW1lXCI6XCJCdWxnYXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCR1wifSx7XCJuYW1lXCI6XCJCdXJraW5hIEZhc29cIixcImFiYnJldmlhdGlvblwiOlwiQkZcIn0se1wibmFtZVwiOlwiQnVydW5kaVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCSVwifSx7XCJuYW1lXCI6XCJDYW1ib2RpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJLSFwifSx7XCJuYW1lXCI6XCJDYW1lcm9vblwiLFwiYWJicmV2aWF0aW9uXCI6XCJDTVwifSx7XCJuYW1lXCI6XCJDYW5hZGFcIixcImFiYnJldmlhdGlvblwiOlwiQ0FcIn0se1wibmFtZVwiOlwiQ2FuYXJ5IElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiSUNcIn0se1wibmFtZVwiOlwiQ2FwZSBWZXJkZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDVlwifSx7XCJuYW1lXCI6XCJDYXJpYmJlYW4gTmV0aGVybGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiQlFcIn0se1wibmFtZVwiOlwiQ2F5bWFuIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiS1lcIn0se1wibmFtZVwiOlwiQ2VudHJhbCBBZnJpY2FuIFJlcHVibGljXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNGXCJ9LHtcIm5hbWVcIjpcIkNldXRhICYgTWVsaWxsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFQVwifSx7XCJuYW1lXCI6XCJDaGFkXCIsXCJhYmJyZXZpYXRpb25cIjpcIlREXCJ9LHtcIm5hbWVcIjpcIkNoaWxlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNMXCJ9LHtcIm5hbWVcIjpcIkNoaW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNOXCJ9LHtcIm5hbWVcIjpcIkNocmlzdG1hcyBJc2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiQ1hcIn0se1wibmFtZVwiOlwiQ29jb3MgKEtlZWxpbmcpIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiQ0NcIn0se1wibmFtZVwiOlwiQ29sb21iaWFcIixcImFiYnJldmlhdGlvblwiOlwiQ09cIn0se1wibmFtZVwiOlwiQ29tb3Jvc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJLTVwifSx7XCJuYW1lXCI6XCJDb25nbyAtIEJyYXp6YXZpbGxlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNHXCJ9LHtcIm5hbWVcIjpcIkNvbmdvIC0gS2luc2hhc2FcIixcImFiYnJldmlhdGlvblwiOlwiQ0RcIn0se1wibmFtZVwiOlwiQ29vayBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNLXCJ9LHtcIm5hbWVcIjpcIkNvc3RhIFJpY2FcIixcImFiYnJldmlhdGlvblwiOlwiQ1JcIn0se1wibmFtZVwiOlwiQ8O0dGUgZCdJdm9pcmVcIixcImFiYnJldmlhdGlvblwiOlwiQ0lcIn0se1wibmFtZVwiOlwiQ3JvYXRpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIUlwifSx7XCJuYW1lXCI6XCJDdWJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNVXCJ9LHtcIm5hbWVcIjpcIkN1cmHDp2FvXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNXXCJ9LHtcIm5hbWVcIjpcIkN5cHJ1c1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDWVwifSx7XCJuYW1lXCI6XCJDemVjaCBSZXB1YmxpY1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDWlwifSx7XCJuYW1lXCI6XCJEZW5tYXJrXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRLXCJ9LHtcIm5hbWVcIjpcIkRpZWdvIEdhcmNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJER1wifSx7XCJuYW1lXCI6XCJEamlib3V0aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJESlwifSx7XCJuYW1lXCI6XCJEb21pbmljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJETVwifSx7XCJuYW1lXCI6XCJEb21pbmljYW4gUmVwdWJsaWNcIixcImFiYnJldmlhdGlvblwiOlwiRE9cIn0se1wibmFtZVwiOlwiRWN1YWRvclwiLFwiYWJicmV2aWF0aW9uXCI6XCJFQ1wifSx7XCJuYW1lXCI6XCJFZ3lwdFwiLFwiYWJicmV2aWF0aW9uXCI6XCJFR1wifSx7XCJuYW1lXCI6XCJFbCBTYWx2YWRvclwiLFwiYWJicmV2aWF0aW9uXCI6XCJTVlwifSx7XCJuYW1lXCI6XCJFcXVhdG9yaWFsIEd1aW5lYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHUVwifSx7XCJuYW1lXCI6XCJFcml0cmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVSXCJ9LHtcIm5hbWVcIjpcIkVzdG9uaWFcIixcImFiYnJldmlhdGlvblwiOlwiRUVcIn0se1wibmFtZVwiOlwiRXRoaW9waWFcIixcImFiYnJldmlhdGlvblwiOlwiRVRcIn0se1wibmFtZVwiOlwiRmFsa2xhbmQgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJGS1wifSx7XCJuYW1lXCI6XCJGYXJvZSBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZPXCJ9LHtcIm5hbWVcIjpcIkZpamlcIixcImFiYnJldmlhdGlvblwiOlwiRkpcIn0se1wibmFtZVwiOlwiRmlubGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJGSVwifSx7XCJuYW1lXCI6XCJGcmFuY2VcIixcImFiYnJldmlhdGlvblwiOlwiRlJcIn0se1wibmFtZVwiOlwiRnJlbmNoIEd1aWFuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHRlwifSx7XCJuYW1lXCI6XCJGcmVuY2ggUG9seW5lc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBGXCJ9LHtcIm5hbWVcIjpcIkZyZW5jaCBTb3V0aGVybiBUZXJyaXRvcmllc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJURlwifSx7XCJuYW1lXCI6XCJHYWJvblwiLFwiYWJicmV2aWF0aW9uXCI6XCJHQVwifSx7XCJuYW1lXCI6XCJHYW1iaWFcIixcImFiYnJldmlhdGlvblwiOlwiR01cIn0se1wibmFtZVwiOlwiR2VvcmdpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHRVwifSx7XCJuYW1lXCI6XCJHZXJtYW55XCIsXCJhYmJyZXZpYXRpb25cIjpcIkRFXCJ9LHtcIm5hbWVcIjpcIkdoYW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdIXCJ9LHtcIm5hbWVcIjpcIkdpYnJhbHRhclwiLFwiYWJicmV2aWF0aW9uXCI6XCJHSVwifSx7XCJuYW1lXCI6XCJHcmVlY2VcIixcImFiYnJldmlhdGlvblwiOlwiR1JcIn0se1wibmFtZVwiOlwiR3JlZW5sYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdMXCJ9LHtcIm5hbWVcIjpcIkdyZW5hZGFcIixcImFiYnJldmlhdGlvblwiOlwiR0RcIn0se1wibmFtZVwiOlwiR3VhZGVsb3VwZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHUFwifSx7XCJuYW1lXCI6XCJHdWFtXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdVXCJ9LHtcIm5hbWVcIjpcIkd1YXRlbWFsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHVFwifSx7XCJuYW1lXCI6XCJHdWVybnNleVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHR1wifSx7XCJuYW1lXCI6XCJHdWluZWFcIixcImFiYnJldmlhdGlvblwiOlwiR05cIn0se1wibmFtZVwiOlwiR3VpbmVhLUJpc3NhdVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHV1wifSx7XCJuYW1lXCI6XCJHdXlhbmFcIixcImFiYnJldmlhdGlvblwiOlwiR1lcIn0se1wibmFtZVwiOlwiSGFpdGlcIixcImFiYnJldmlhdGlvblwiOlwiSFRcIn0se1wibmFtZVwiOlwiSG9uZHVyYXNcIixcImFiYnJldmlhdGlvblwiOlwiSE5cIn0se1wibmFtZVwiOlwiSG9uZyBLb25nIFNBUiBDaGluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIS1wifSx7XCJuYW1lXCI6XCJIdW5nYXJ5XCIsXCJhYmJyZXZpYXRpb25cIjpcIkhVXCJ9LHtcIm5hbWVcIjpcIkljZWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiSVNcIn0se1wibmFtZVwiOlwiSW5kaWFcIixcImFiYnJldmlhdGlvblwiOlwiSU5cIn0se1wibmFtZVwiOlwiSW5kb25lc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIklEXCJ9LHtcIm5hbWVcIjpcIklyYW5cIixcImFiYnJldmlhdGlvblwiOlwiSVJcIn0se1wibmFtZVwiOlwiSXJhcVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJUVwifSx7XCJuYW1lXCI6XCJJcmVsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIklFXCJ9LHtcIm5hbWVcIjpcIklzbGUgb2YgTWFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIklNXCJ9LHtcIm5hbWVcIjpcIklzcmFlbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJJTFwifSx7XCJuYW1lXCI6XCJJdGFseVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJVFwifSx7XCJuYW1lXCI6XCJKYW1haWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpNXCJ9LHtcIm5hbWVcIjpcIkphcGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpQXCJ9LHtcIm5hbWVcIjpcIkplcnNleVwiLFwiYWJicmV2aWF0aW9uXCI6XCJKRVwifSx7XCJuYW1lXCI6XCJKb3JkYW5cIixcImFiYnJldmlhdGlvblwiOlwiSk9cIn0se1wibmFtZVwiOlwiS2F6YWtoc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJLWlwifSx7XCJuYW1lXCI6XCJLZW55YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJLRVwifSx7XCJuYW1lXCI6XCJLaXJpYmF0aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJLSVwifSx7XCJuYW1lXCI6XCJLb3Nvdm9cIixcImFiYnJldmlhdGlvblwiOlwiWEtcIn0se1wibmFtZVwiOlwiS3V3YWl0XCIsXCJhYmJyZXZpYXRpb25cIjpcIktXXCJ9LHtcIm5hbWVcIjpcIkt5cmd5enN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiS0dcIn0se1wibmFtZVwiOlwiTGFvc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJMQVwifSx7XCJuYW1lXCI6XCJMYXR2aWFcIixcImFiYnJldmlhdGlvblwiOlwiTFZcIn0se1wibmFtZVwiOlwiTGViYW5vblwiLFwiYWJicmV2aWF0aW9uXCI6XCJMQlwifSx7XCJuYW1lXCI6XCJMZXNvdGhvXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxTXCJ9LHtcIm5hbWVcIjpcIkxpYmVyaWFcIixcImFiYnJldmlhdGlvblwiOlwiTFJcIn0se1wibmFtZVwiOlwiTGlieWFcIixcImFiYnJldmlhdGlvblwiOlwiTFlcIn0se1wibmFtZVwiOlwiTGllY2h0ZW5zdGVpblwiLFwiYWJicmV2aWF0aW9uXCI6XCJMSVwifSx7XCJuYW1lXCI6XCJMaXRodWFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiTFRcIn0se1wibmFtZVwiOlwiTHV4ZW1ib3VyZ1wiLFwiYWJicmV2aWF0aW9uXCI6XCJMVVwifSx7XCJuYW1lXCI6XCJNYWNhdSBTQVIgQ2hpbmFcIixcImFiYnJldmlhdGlvblwiOlwiTU9cIn0se1wibmFtZVwiOlwiTWFjZWRvbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1LXCJ9LHtcIm5hbWVcIjpcIk1hZGFnYXNjYXJcIixcImFiYnJldmlhdGlvblwiOlwiTUdcIn0se1wibmFtZVwiOlwiTWFsYXdpXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1XXCJ9LHtcIm5hbWVcIjpcIk1hbGF5c2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1ZXCJ9LHtcIm5hbWVcIjpcIk1hbGRpdmVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1WXCJ9LHtcIm5hbWVcIjpcIk1hbGlcIixcImFiYnJldmlhdGlvblwiOlwiTUxcIn0se1wibmFtZVwiOlwiTWFsdGFcIixcImFiYnJldmlhdGlvblwiOlwiTVRcIn0se1wibmFtZVwiOlwiTWFyc2hhbGwgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNSFwifSx7XCJuYW1lXCI6XCJNYXJ0aW5pcXVlXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1RXCJ9LHtcIm5hbWVcIjpcIk1hdXJpdGFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiTVJcIn0se1wibmFtZVwiOlwiTWF1cml0aXVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1VXCJ9LHtcIm5hbWVcIjpcIk1heW90dGVcIixcImFiYnJldmlhdGlvblwiOlwiWVRcIn0se1wibmFtZVwiOlwiTWV4aWNvXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1YXCJ9LHtcIm5hbWVcIjpcIk1pY3JvbmVzaWFcIixcImFiYnJldmlhdGlvblwiOlwiRk1cIn0se1wibmFtZVwiOlwiTW9sZG92YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNRFwifSx7XCJuYW1lXCI6XCJNb25hY29cIixcImFiYnJldmlhdGlvblwiOlwiTUNcIn0se1wibmFtZVwiOlwiTW9uZ29saWFcIixcImFiYnJldmlhdGlvblwiOlwiTU5cIn0se1wibmFtZVwiOlwiTW9udGVuZWdyb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNRVwifSx7XCJuYW1lXCI6XCJNb250c2VycmF0XCIsXCJhYmJyZXZpYXRpb25cIjpcIk1TXCJ9LHtcIm5hbWVcIjpcIk1vcm9jY29cIixcImFiYnJldmlhdGlvblwiOlwiTUFcIn0se1wibmFtZVwiOlwiTW96YW1iaXF1ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNWlwifSx7XCJuYW1lXCI6XCJNeWFubWFyIChCdXJtYSlcIixcImFiYnJldmlhdGlvblwiOlwiTU1cIn0se1wibmFtZVwiOlwiTmFtaWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOQVwifSx7XCJuYW1lXCI6XCJOYXVydVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOUlwifSx7XCJuYW1lXCI6XCJOZXBhbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJOUFwifSx7XCJuYW1lXCI6XCJOZXRoZXJsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJOTFwifSx7XCJuYW1lXCI6XCJOZXcgQ2FsZWRvbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5DXCJ9LHtcIm5hbWVcIjpcIk5ldyBaZWFsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5aXCJ9LHtcIm5hbWVcIjpcIk5pY2FyYWd1YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOSVwifSx7XCJuYW1lXCI6XCJOaWdlclwiLFwiYWJicmV2aWF0aW9uXCI6XCJORVwifSx7XCJuYW1lXCI6XCJOaWdlcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5HXCJ9LHtcIm5hbWVcIjpcIk5pdWVcIixcImFiYnJldmlhdGlvblwiOlwiTlVcIn0se1wibmFtZVwiOlwiTm9yZm9sayBJc2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiTkZcIn0se1wibmFtZVwiOlwiTm9ydGggS29yZWFcIixcImFiYnJldmlhdGlvblwiOlwiS1BcIn0se1wibmFtZVwiOlwiTm9ydGhlcm4gTWFyaWFuYSBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1QXCJ9LHtcIm5hbWVcIjpcIk5vcndheVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOT1wifSx7XCJuYW1lXCI6XCJPbWFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIk9NXCJ9LHtcIm5hbWVcIjpcIlBha2lzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBLXCJ9LHtcIm5hbWVcIjpcIlBhbGF1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlBXXCJ9LHtcIm5hbWVcIjpcIlBhbGVzdGluaWFuIFRlcnJpdG9yaWVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBTXCJ9LHtcIm5hbWVcIjpcIlBhbmFtYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQQVwifSx7XCJuYW1lXCI6XCJQYXB1YSBOZXcgR3VpbmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBHXCJ9LHtcIm5hbWVcIjpcIlBhcmFndWF5XCIsXCJhYmJyZXZpYXRpb25cIjpcIlBZXCJ9LHtcIm5hbWVcIjpcIlBlcnVcIixcImFiYnJldmlhdGlvblwiOlwiUEVcIn0se1wibmFtZVwiOlwiUGhpbGlwcGluZXNcIixcImFiYnJldmlhdGlvblwiOlwiUEhcIn0se1wibmFtZVwiOlwiUGl0Y2Fpcm4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQTlwifSx7XCJuYW1lXCI6XCJQb2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiUExcIn0se1wibmFtZVwiOlwiUG9ydHVnYWxcIixcImFiYnJldmlhdGlvblwiOlwiUFRcIn0se1wibmFtZVwiOlwiUHVlcnRvIFJpY29cIixcImFiYnJldmlhdGlvblwiOlwiUFJcIn0se1wibmFtZVwiOlwiUWF0YXJcIixcImFiYnJldmlhdGlvblwiOlwiUUFcIn0se1wibmFtZVwiOlwiUsOpdW5pb25cIixcImFiYnJldmlhdGlvblwiOlwiUkVcIn0se1wibmFtZVwiOlwiUm9tYW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJST1wifSx7XCJuYW1lXCI6XCJSdXNzaWFcIixcImFiYnJldmlhdGlvblwiOlwiUlVcIn0se1wibmFtZVwiOlwiUndhbmRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJXXCJ9LHtcIm5hbWVcIjpcIlNhbW9hXCIsXCJhYmJyZXZpYXRpb25cIjpcIldTXCJ9LHtcIm5hbWVcIjpcIlNhbiBNYXJpbm9cIixcImFiYnJldmlhdGlvblwiOlwiU01cIn0se1wibmFtZVwiOlwiU8OjbyBUb23DqSBhbmQgUHLDrW5jaXBlXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNUXCJ9LHtcIm5hbWVcIjpcIlNhdWRpIEFyYWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTQVwifSx7XCJuYW1lXCI6XCJTZW5lZ2FsXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNOXCJ9LHtcIm5hbWVcIjpcIlNlcmJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJSU1wifSx7XCJuYW1lXCI6XCJTZXljaGVsbGVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNDXCJ9LHtcIm5hbWVcIjpcIlNpZXJyYSBMZW9uZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTTFwifSx7XCJuYW1lXCI6XCJTaW5nYXBvcmVcIixcImFiYnJldmlhdGlvblwiOlwiU0dcIn0se1wibmFtZVwiOlwiU2ludCBNYWFydGVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNYXCJ9LHtcIm5hbWVcIjpcIlNsb3Zha2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNLXCJ9LHtcIm5hbWVcIjpcIlNsb3ZlbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNJXCJ9LHtcIm5hbWVcIjpcIlNvbG9tb24gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJTQlwifSx7XCJuYW1lXCI6XCJTb21hbGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNPXCJ9LHtcIm5hbWVcIjpcIlNvdXRoIEFmcmljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJaQVwifSx7XCJuYW1lXCI6XCJTb3V0aCBHZW9yZ2lhICYgU291dGggU2FuZHdpY2ggSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJHU1wifSx7XCJuYW1lXCI6XCJTb3V0aCBLb3JlYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJLUlwifSx7XCJuYW1lXCI6XCJTb3V0aCBTdWRhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTU1wifSx7XCJuYW1lXCI6XCJTcGFpblwiLFwiYWJicmV2aWF0aW9uXCI6XCJFU1wifSx7XCJuYW1lXCI6XCJTcmkgTGFua2FcIixcImFiYnJldmlhdGlvblwiOlwiTEtcIn0se1wibmFtZVwiOlwiU3QuIEJhcnRow6lsZW15XCIsXCJhYmJyZXZpYXRpb25cIjpcIkJMXCJ9LHtcIm5hbWVcIjpcIlN0LiBIZWxlbmFcIixcImFiYnJldmlhdGlvblwiOlwiU0hcIn0se1wibmFtZVwiOlwiU3QuIEtpdHRzICYgTmV2aXNcIixcImFiYnJldmlhdGlvblwiOlwiS05cIn0se1wibmFtZVwiOlwiU3QuIEx1Y2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxDXCJ9LHtcIm5hbWVcIjpcIlN0LiBNYXJ0aW5cIixcImFiYnJldmlhdGlvblwiOlwiTUZcIn0se1wibmFtZVwiOlwiU3QuIFBpZXJyZSAmIE1pcXVlbG9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBNXCJ9LHtcIm5hbWVcIjpcIlN0LiBWaW5jZW50ICYgR3JlbmFkaW5lc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJWQ1wifSx7XCJuYW1lXCI6XCJTdWRhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTRFwifSx7XCJuYW1lXCI6XCJTdXJpbmFtZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTUlwifSx7XCJuYW1lXCI6XCJTdmFsYmFyZCAmIEphbiBNYXllblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTSlwifSx7XCJuYW1lXCI6XCJTd2F6aWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiU1pcIn0se1wibmFtZVwiOlwiU3dlZGVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNFXCJ9LHtcIm5hbWVcIjpcIlN3aXR6ZXJsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNIXCJ9LHtcIm5hbWVcIjpcIlN5cmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNZXCJ9LHtcIm5hbWVcIjpcIlRhaXdhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJUV1wifSx7XCJuYW1lXCI6XCJUYWppa2lzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRKXCJ9LHtcIm5hbWVcIjpcIlRhbnphbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRaXCJ9LHtcIm5hbWVcIjpcIlRoYWlsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRIXCJ9LHtcIm5hbWVcIjpcIlRpbW9yLUxlc3RlXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRMXCJ9LHtcIm5hbWVcIjpcIlRvZ29cIixcImFiYnJldmlhdGlvblwiOlwiVEdcIn0se1wibmFtZVwiOlwiVG9rZWxhdVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUS1wifSx7XCJuYW1lXCI6XCJUb25nYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUT1wifSx7XCJuYW1lXCI6XCJUcmluaWRhZCAmIFRvYmFnb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJUVFwifSx7XCJuYW1lXCI6XCJUcmlzdGFuIGRhIEN1bmhhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRBXCJ9LHtcIm5hbWVcIjpcIlR1bmlzaWFcIixcImFiYnJldmlhdGlvblwiOlwiVE5cIn0se1wibmFtZVwiOlwiVHVya2V5XCIsXCJhYmJyZXZpYXRpb25cIjpcIlRSXCJ9LHtcIm5hbWVcIjpcIlR1cmttZW5pc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJUTVwifSx7XCJuYW1lXCI6XCJUdXJrcyAmIENhaWNvcyBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRDXCJ9LHtcIm5hbWVcIjpcIlR1dmFsdVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUVlwifSx7XCJuYW1lXCI6XCJVLlMuIE91dGx5aW5nIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiVU1cIn0se1wibmFtZVwiOlwiVS5TLiBWaXJnaW4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJWSVwifSx7XCJuYW1lXCI6XCJVZ2FuZGFcIixcImFiYnJldmlhdGlvblwiOlwiVUdcIn0se1wibmFtZVwiOlwiVWtyYWluZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJVQVwifSx7XCJuYW1lXCI6XCJVbml0ZWQgQXJhYiBFbWlyYXRlc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJBRVwifSx7XCJuYW1lXCI6XCJVbml0ZWQgS2luZ2RvbVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHQlwifSx7XCJuYW1lXCI6XCJVbml0ZWQgU3RhdGVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVTXCJ9LHtcIm5hbWVcIjpcIlVydWd1YXlcIixcImFiYnJldmlhdGlvblwiOlwiVVlcIn0se1wibmFtZVwiOlwiVXpiZWtpc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJVWlwifSx7XCJuYW1lXCI6XCJWYW51YXR1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlZVXCJ9LHtcIm5hbWVcIjpcIlZhdGljYW4gQ2l0eVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWQVwifSx7XCJuYW1lXCI6XCJWZW5lenVlbGFcIixcImFiYnJldmlhdGlvblwiOlwiVkVcIn0se1wibmFtZVwiOlwiVmlldG5hbVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWTlwifSx7XCJuYW1lXCI6XCJXYWxsaXMgJiBGdXR1bmFcIixcImFiYnJldmlhdGlvblwiOlwiV0ZcIn0se1wibmFtZVwiOlwiV2VzdGVybiBTYWhhcmFcIixcImFiYnJldmlhdGlvblwiOlwiRUhcIn0se1wibmFtZVwiOlwiWWVtZW5cIixcImFiYnJldmlhdGlvblwiOlwiWUVcIn0se1wibmFtZVwiOlwiWmFtYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlpNXCJ9LHtcIm5hbWVcIjpcIlppbWJhYndlXCIsXCJhYmJyZXZpYXRpb25cIjpcIlpXXCJ9XSxcblxuXHRcdGNvdW50aWVzOiB7XG4gICAgICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cDovL3d3dy5kb3dubG9hZGV4Y2VsZmlsZXMuY29tL2diX2VuL2Rvd25sb2FkLWV4Y2VsLWZpbGUtbGlzdC1jb3VudGllcy11a1xuICAgICAgICAgICAgXCJ1a1wiOiBbXG4gICAgICAgICAgICAgICAge25hbWU6ICdCYXRoIGFuZCBOb3J0aCBFYXN0IFNvbWVyc2V0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdBYmVyZGVlbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdBbmdsZXNleSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQW5ndXMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JlZGZvcmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JsYWNrYnVybiB3aXRoIERhcndlbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQmxhY2twb29sJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCb3VybmVtb3V0aCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQnJhY2tuZWxsIEZvcmVzdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQnJpZ2h0b24gJiBIb3ZlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCcmlzdG9sJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCdWNraW5naGFtc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NhbWJyaWRnZXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDYXJtYXJ0aGVuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NlbnRyYWwgQmVkZm9yZHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDZXJlZGlnaW9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDaGVzaGlyZSBFYXN0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDaGVzaGlyZSBXZXN0IGFuZCBDaGVzdGVyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDbGFja21hbm5hbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb253eSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ29ybndhbGwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBBbnRyaW0nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBBcm1hZ2gnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBEb3duJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgRHVyaGFtJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgRmVybWFuYWdoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgTG9uZG9uZGVycnknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBUeXJvbmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0N1bWJyaWEnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Rhcmxpbmd0b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RlbmJpZ2hzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRGVyYnknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RlcmJ5c2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Rldm9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEb3JzZXQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0R1bWZyaWVzIGFuZCBHYWxsb3dheSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRHVuZGVlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFYXN0IExvdGhpYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Vhc3QgUmlkaW5nIG9mIFlvcmtzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRWFzdCBTdXNzZXgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0VkaW5idXJnaD8nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Vzc2V4J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdGYWxraXJrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdGaWZlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdGbGludHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHbG91Y2VzdGVyc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dyZWF0ZXIgTG9uZG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHcmVhdGVyIE1hbmNoZXN0ZXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0d3ZW50J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHd3luZWRkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIYWx0b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hhbXBzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGFydGxlcG9vbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGVyZWZvcmRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGVydGZvcmRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGlnaGxhbmRzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIdWxsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdJc2xlIG9mIFdpZ2h0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdJc2xlcyBvZiBTY2lsbHknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0tlbnQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xhbmNhc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xlaWNlc3Rlcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGVpY2VzdGVyc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xpbmNvbG5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTG90aGlhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTHV0b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01lZHdheSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWVyc2V5c2lkZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWlkIEdsYW1vcmdhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWlkZGxlc2Jyb3VnaCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWlsdG9uIEtleW5lcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTW9ubW91dGhzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTW9yYXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcmZvbGsnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRoIEVhc3QgTGluY29sbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aCBMaW5jb2xuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRoIFNvbWVyc2V0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aCBZb3Jrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRoYW1wdG9uc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRodW1iZXJsYW5kJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3R0aW5naGFtJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3R0aW5naGFtc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ094Zm9yZHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQZW1icm9rZXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQZXJ0aCBhbmQgS2lucm9zcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGV0ZXJib3JvdWdoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQbHltb3V0aCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUG9vbGUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BvcnRzbW91dGgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Bvd3lzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSZWFkaW5nJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSZWRjYXIgYW5kIENsZXZlbGFuZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUnV0bGFuZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU2NvdHRpc2ggQm9yZGVycyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU2hyb3BzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU2xvdWdoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb21lcnNldCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU291dGggR2xhbW9yZ2FuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb3V0aCBHbG91Y2VzdGVyc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvdXRoIFlvcmtzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU291dGhhbXB0b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvdXRoZW5kLW9uLVNlYSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RhZmZvcmRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RpcmxpbmdzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RvY2t0b24tb24tVGVlcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3Rva2Utb24tVHJlbnQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0cmF0aGNseWRlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdWZmb2xrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdXJyZXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N3aW5kb24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RlbGZvcmQgYW5kIFdyZWtpbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVGh1cnJvY2snfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RvcmJheSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVHluZSBhbmQgV2Vhcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2FycmluZ3Rvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2Fyd2lja3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IEJlcmtzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBHbGFtb3JnYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgTG90aGlhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBNaWRsYW5kcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBTdXNzZXgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgWW9ya3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0ZXJuIElzbGVzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXaWx0c2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dpbmRzb3IgYW5kIE1haWRlbmhlYWQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dva2luZ2hhbSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV29yY2VzdGVyc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dyZXhoYW0nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1lvcmsnfV1cblx0XHRcdFx0fSxcbiAgICAgICAgcHJvdmluY2VzOiB7XG4gICAgICAgICAgICBcImNhXCI6IFtcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0FsYmVydGEnLCBhYmJyZXZpYXRpb246ICdBQid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQnJpdGlzaCBDb2x1bWJpYScsIGFiYnJldmlhdGlvbjogJ0JDJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNYW5pdG9iYScsIGFiYnJldmlhdGlvbjogJ01CJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOZXcgQnJ1bnN3aWNrJywgYWJicmV2aWF0aW9uOiAnTkInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05ld2ZvdW5kbGFuZCBhbmQgTGFicmFkb3InLCBhYmJyZXZpYXRpb246ICdOTCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm92YSBTY290aWEnLCBhYmJyZXZpYXRpb246ICdOUyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnT250YXJpbycsIGFiYnJldmlhdGlvbjogJ09OJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQcmluY2UgRWR3YXJkIElzbGFuZCcsIGFiYnJldmlhdGlvbjogJ1BFJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdRdWViZWMnLCBhYmJyZXZpYXRpb246ICdRQyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU2Fza2F0Y2hld2FuJywgYWJicmV2aWF0aW9uOiAnU0snfSxcblxuICAgICAgICAgICAgICAgIC8vIFRoZSBjYXNlIGNvdWxkIGJlIG1hZGUgdGhhdCB0aGUgZm9sbG93aW5nIGFyZSBub3QgYWN0dWFsbHkgcHJvdmluY2VzXG4gICAgICAgICAgICAgICAgLy8gc2luY2UgdGhleSBhcmUgdGVjaG5pY2FsbHkgY29uc2lkZXJlZCBcInRlcnJpdG9yaWVzXCIgaG93ZXZlciB0aGV5IGFsbFxuICAgICAgICAgICAgICAgIC8vIGxvb2sgdGhlIHNhbWUgb24gYW4gZW52ZWxvcGUhXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aHdlc3QgVGVycml0b3JpZXMnLCBhYmJyZXZpYXRpb246ICdOVCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTnVuYXZ1dCcsIGFiYnJldmlhdGlvbjogJ05VJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdZdWtvbicsIGFiYnJldmlhdGlvbjogJ1lUJ31cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBcIml0XCI6IFtcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQWdyaWdlbnRvXCIsIGFiYnJldmlhdGlvbjogXCJBR1wiLCBjb2RlOiA4NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBbGVzc2FuZHJpYVwiLCBhYmJyZXZpYXRpb246IFwiQUxcIiwgY29kZTogNiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBbmNvbmFcIiwgYWJicmV2aWF0aW9uOiBcIkFOXCIsIGNvZGU6IDQyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFvc3RhXCIsIGFiYnJldmlhdGlvbjogXCJBT1wiLCBjb2RlOiA3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkwnQXF1aWxhXCIsIGFiYnJldmlhdGlvbjogXCJBUVwiLCBjb2RlOiA2NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBcmV6em9cIiwgYWJicmV2aWF0aW9uOiBcIkFSXCIsIGNvZGU6IDUxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFzY29saS1QaWNlbm9cIiwgYWJicmV2aWF0aW9uOiBcIkFQXCIsIGNvZGU6IDQ0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFzdGlcIiwgYWJicmV2aWF0aW9uOiBcIkFUXCIsIGNvZGU6IDUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQXZlbGxpbm9cIiwgYWJicmV2aWF0aW9uOiBcIkFWXCIsIGNvZGU6IDY0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJhcmlcIiwgYWJicmV2aWF0aW9uOiBcIkJBXCIsIGNvZGU6IDcyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJhcmxldHRhLUFuZHJpYS1UcmFuaVwiLCBhYmJyZXZpYXRpb246IFwiQlRcIiwgY29kZTogNzIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmVsbHVub1wiLCBhYmJyZXZpYXRpb246IFwiQkxcIiwgY29kZTogMjUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmVuZXZlbnRvXCIsIGFiYnJldmlhdGlvbjogXCJCTlwiLCBjb2RlOiA2MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCZXJnYW1vXCIsIGFiYnJldmlhdGlvbjogXCJCR1wiLCBjb2RlOiAxNiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCaWVsbGFcIiwgYWJicmV2aWF0aW9uOiBcIkJJXCIsIGNvZGU6IDk2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJvbG9nbmFcIiwgYWJicmV2aWF0aW9uOiBcIkJPXCIsIGNvZGU6IDM3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJvbHphbm9cIiwgYWJicmV2aWF0aW9uOiBcIkJaXCIsIGNvZGU6IDIxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJyZXNjaWFcIiwgYWJicmV2aWF0aW9uOiBcIkJTXCIsIGNvZGU6IDE3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJyaW5kaXNpXCIsIGFiYnJldmlhdGlvbjogXCJCUlwiLCBjb2RlOiA3NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYWdsaWFyaVwiLCBhYmJyZXZpYXRpb246IFwiQ0FcIiwgY29kZTogOTIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FsdGFuaXNzZXR0YVwiLCBhYmJyZXZpYXRpb246IFwiQ0xcIiwgY29kZTogODUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FtcG9iYXNzb1wiLCBhYmJyZXZpYXRpb246IFwiQ0JcIiwgY29kZTogNzAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FyYm9uaWEgSWdsZXNpYXNcIiwgYWJicmV2aWF0aW9uOiBcIkNJXCIsIGNvZGU6IDcwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhc2VydGFcIiwgYWJicmV2aWF0aW9uOiBcIkNFXCIsIGNvZGU6IDYxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhdGFuaWFcIiwgYWJicmV2aWF0aW9uOiBcIkNUXCIsIGNvZGU6IDg3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhdGFuemFyb1wiLCBhYmJyZXZpYXRpb246IFwiQ1pcIiwgY29kZTogNzkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2hpZXRpXCIsIGFiYnJldmlhdGlvbjogXCJDSFwiLCBjb2RlOiA2OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDb21vXCIsIGFiYnJldmlhdGlvbjogXCJDT1wiLCBjb2RlOiAxMyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDb3NlbnphXCIsIGFiYnJldmlhdGlvbjogXCJDU1wiLCBjb2RlOiA3OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDcmVtb25hXCIsIGFiYnJldmlhdGlvbjogXCJDUlwiLCBjb2RlOiAxOSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDcm90b25lXCIsIGFiYnJldmlhdGlvbjogXCJLUlwiLCBjb2RlOiAxMDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ3VuZW9cIiwgYWJicmV2aWF0aW9uOiBcIkNOXCIsIGNvZGU6IDQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRW5uYVwiLCBhYmJyZXZpYXRpb246IFwiRU5cIiwgY29kZTogODYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRmVybW9cIiwgYWJicmV2aWF0aW9uOiBcIkZNXCIsIGNvZGU6IDg2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZlcnJhcmFcIiwgYWJicmV2aWF0aW9uOiBcIkZFXCIsIGNvZGU6IDM4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZpcmVuemVcIiwgYWJicmV2aWF0aW9uOiBcIkZJXCIsIGNvZGU6IDQ4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZvZ2dpYVwiLCBhYmJyZXZpYXRpb246IFwiRkdcIiwgY29kZTogNzEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRm9ybGktQ2VzZW5hXCIsIGFiYnJldmlhdGlvbjogXCJGQ1wiLCBjb2RlOiA3MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGcm9zaW5vbmVcIiwgYWJicmV2aWF0aW9uOiBcIkZSXCIsIGNvZGU6IDYwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkdlbm92YVwiLCBhYmJyZXZpYXRpb246IFwiR0VcIiwgY29kZTogMTAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiR29yaXppYVwiLCBhYmJyZXZpYXRpb246IFwiR09cIiwgY29kZTogMzEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiR3Jvc3NldG9cIiwgYWJicmV2aWF0aW9uOiBcIkdSXCIsIGNvZGU6IDUzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkltcGVyaWFcIiwgYWJicmV2aWF0aW9uOiBcIklNXCIsIGNvZGU6IDggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiSXNlcm5pYVwiLCBhYmJyZXZpYXRpb246IFwiSVNcIiwgY29kZTogOTQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGEtU3BlemlhXCIsIGFiYnJldmlhdGlvbjogXCJTUFwiLCBjb2RlOiA2NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMYXRpbmFcIiwgYWJicmV2aWF0aW9uOiBcIkxUXCIsIGNvZGU6IDU5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxlY2NlXCIsIGFiYnJldmlhdGlvbjogXCJMRVwiLCBjb2RlOiA3NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMZWNjb1wiLCBhYmJyZXZpYXRpb246IFwiTENcIiwgY29kZTogOTcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGl2b3Jub1wiLCBhYmJyZXZpYXRpb246IFwiTElcIiwgY29kZTogNDkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTG9kaVwiLCBhYmJyZXZpYXRpb246IFwiTE9cIiwgY29kZTogOTggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTHVjY2FcIiwgYWJicmV2aWF0aW9uOiBcIkxVXCIsIGNvZGU6IDQ2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1hY2VyYXRhXCIsIGFiYnJldmlhdGlvbjogXCJNQ1wiLCBjb2RlOiA0MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNYW50b3ZhXCIsIGFiYnJldmlhdGlvbjogXCJNTlwiLCBjb2RlOiAyMCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNYXNzYS1DYXJyYXJhXCIsIGFiYnJldmlhdGlvbjogXCJNU1wiLCBjb2RlOiA0NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNYXRlcmFcIiwgYWJicmV2aWF0aW9uOiBcIk1UXCIsIGNvZGU6IDc3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1lZGlvIENhbXBpZGFub1wiLCBhYmJyZXZpYXRpb246IFwiVlNcIiwgY29kZTogNzcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWVzc2luYVwiLCBhYmJyZXZpYXRpb246IFwiTUVcIiwgY29kZTogODMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWlsYW5vXCIsIGFiYnJldmlhdGlvbjogXCJNSVwiLCBjb2RlOiAxNSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNb2RlbmFcIiwgYWJicmV2aWF0aW9uOiBcIk1PXCIsIGNvZGU6IDM2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1vbnphLUJyaWFuemFcIiwgYWJicmV2aWF0aW9uOiBcIk1CXCIsIGNvZGU6IDM2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk5hcG9saVwiLCBhYmJyZXZpYXRpb246IFwiTkFcIiwgY29kZTogNjMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTm92YXJhXCIsIGFiYnJldmlhdGlvbjogXCJOT1wiLCBjb2RlOiAzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk51b3JvXCIsIGFiYnJldmlhdGlvbjogXCJOVVwiLCBjb2RlOiA5MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJPZ2xpYXN0cmFcIiwgYWJicmV2aWF0aW9uOiBcIk9HXCIsIGNvZGU6IDkxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk9sYmlhIFRlbXBpb1wiLCBhYmJyZXZpYXRpb246IFwiT1RcIiwgY29kZTogOTEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiT3Jpc3Rhbm9cIiwgYWJicmV2aWF0aW9uOiBcIk9SXCIsIGNvZGU6IDk1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBhZG92YVwiLCBhYmJyZXZpYXRpb246IFwiUERcIiwgY29kZTogMjggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGFsZXJtb1wiLCBhYmJyZXZpYXRpb246IFwiUEFcIiwgY29kZTogODIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGFybWFcIiwgYWJicmV2aWF0aW9uOiBcIlBSXCIsIGNvZGU6IDM0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBhdmlhXCIsIGFiYnJldmlhdGlvbjogXCJQVlwiLCBjb2RlOiAxOCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQZXJ1Z2lhXCIsIGFiYnJldmlhdGlvbjogXCJQR1wiLCBjb2RlOiA1NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQZXNhcm8tVXJiaW5vXCIsIGFiYnJldmlhdGlvbjogXCJQVVwiLCBjb2RlOiA0MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQZXNjYXJhXCIsIGFiYnJldmlhdGlvbjogXCJQRVwiLCBjb2RlOiA2OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQaWFjZW56YVwiLCBhYmJyZXZpYXRpb246IFwiUENcIiwgY29kZTogMzMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGlzYVwiLCBhYmJyZXZpYXRpb246IFwiUElcIiwgY29kZTogNTAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGlzdG9pYVwiLCBhYmJyZXZpYXRpb246IFwiUFRcIiwgY29kZTogNDcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUG9yZGVub25lXCIsIGFiYnJldmlhdGlvbjogXCJQTlwiLCBjb2RlOiA5MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQb3RlbnphXCIsIGFiYnJldmlhdGlvbjogXCJQWlwiLCBjb2RlOiA3NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQcmF0b1wiLCBhYmJyZXZpYXRpb246IFwiUE9cIiwgY29kZTogMTAwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJhZ3VzYVwiLCBhYmJyZXZpYXRpb246IFwiUkdcIiwgY29kZTogODggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmF2ZW5uYVwiLCBhYmJyZXZpYXRpb246IFwiUkFcIiwgY29kZTogMzkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmVnZ2lvLUNhbGFicmlhXCIsIGFiYnJldmlhdGlvbjogXCJSQ1wiLCBjb2RlOiAzNSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSZWdnaW8tRW1pbGlhXCIsIGFiYnJldmlhdGlvbjogXCJSRVwiLCBjb2RlOiAzNSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSaWV0aVwiLCBhYmJyZXZpYXRpb246IFwiUklcIiwgY29kZTogNTcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmltaW5pXCIsIGFiYnJldmlhdGlvbjogXCJSTlwiLCBjb2RlOiA5OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSb21hXCIsIGFiYnJldmlhdGlvbjogXCJSb21hXCIsIGNvZGU6IDU4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJvdmlnb1wiLCBhYmJyZXZpYXRpb246IFwiUk9cIiwgY29kZTogMjkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2FsZXJub1wiLCBhYmJyZXZpYXRpb246IFwiU0FcIiwgY29kZTogNjUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2Fzc2FyaVwiLCBhYmJyZXZpYXRpb246IFwiU1NcIiwgY29kZTogOTAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2F2b25hXCIsIGFiYnJldmlhdGlvbjogXCJTVlwiLCBjb2RlOiA5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNpZW5hXCIsIGFiYnJldmlhdGlvbjogXCJTSVwiLCBjb2RlOiA1MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTaXJhY3VzYVwiLCBhYmJyZXZpYXRpb246IFwiU1JcIiwgY29kZTogODkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU29uZHJpb1wiLCBhYmJyZXZpYXRpb246IFwiU09cIiwgY29kZTogMTQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVGFyYW50b1wiLCBhYmJyZXZpYXRpb246IFwiVEFcIiwgY29kZTogNzMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVGVyYW1vXCIsIGFiYnJldmlhdGlvbjogXCJURVwiLCBjb2RlOiA2NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUZXJuaVwiLCBhYmJyZXZpYXRpb246IFwiVFJcIiwgY29kZTogNTUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVG9yaW5vXCIsIGFiYnJldmlhdGlvbjogXCJUT1wiLCBjb2RlOiAxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRyYXBhbmlcIiwgYWJicmV2aWF0aW9uOiBcIlRQXCIsIGNvZGU6IDgxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRyZW50b1wiLCBhYmJyZXZpYXRpb246IFwiVE5cIiwgY29kZTogMjIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVHJldmlzb1wiLCBhYmJyZXZpYXRpb246IFwiVFZcIiwgY29kZTogMjYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVHJpZXN0ZVwiLCBhYmJyZXZpYXRpb246IFwiVFNcIiwgY29kZTogMzIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVWRpbmVcIiwgYWJicmV2aWF0aW9uOiBcIlVEXCIsIGNvZGU6IDMwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZhcmVzZVwiLCBhYmJyZXZpYXRpb246IFwiVkFcIiwgY29kZTogMTIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmVuZXppYVwiLCBhYmJyZXZpYXRpb246IFwiVkVcIiwgY29kZTogMjcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmVyYmFuaWFcIiwgYWJicmV2aWF0aW9uOiBcIlZCXCIsIGNvZGU6IDI3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZlcmNlbGxpXCIsIGFiYnJldmlhdGlvbjogXCJWQ1wiLCBjb2RlOiAyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZlcm9uYVwiLCBhYmJyZXZpYXRpb246IFwiVlJcIiwgY29kZTogMjMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmliby1WYWxlbnRpYVwiLCBhYmJyZXZpYXRpb246IFwiVlZcIiwgY29kZTogMTAyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZpY2VuemFcIiwgYWJicmV2aWF0aW9uOiBcIlZJXCIsIGNvZGU6IDI0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZpdGVyYm9cIiwgYWJicmV2aWF0aW9uOiBcIlZUXCIsIGNvZGU6IDU2IH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcblxuICAgICAgICAgICAgLy8gZnJvbTogaHR0cHM6Ly9naXRodWIuY29tL3NhbXNhcmdlbnQvVXNlZnVsLUF1dG9jb21wbGV0ZS1EYXRhL2Jsb2IvbWFzdGVyL2RhdGEvbmF0aW9uYWxpdGllcy5qc29uXG4gICAgICAgIG5hdGlvbmFsaXRpZXM6IFtcbiAgICAgICAgICAge25hbWU6ICdBZmdoYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbGJhbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FsZ2VyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQW1lcmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbmRvcnJhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FuZ29sYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbnRpZ3VhbnMnfSxcbiAgICAgICAgICAge25hbWU6ICdBcmdlbnRpbmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FybWVuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQXVzdHJhbGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0F1c3RyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQXplcmJhaWphbmknfSxcbiAgICAgICAgICAge25hbWU6ICdCYWhhbWknfSxcbiAgICAgICAgICAge25hbWU6ICdCYWhyYWluaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JhbmdsYWRlc2hpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmFyYmFkaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmFyYnVkYW5zJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmF0c3dhbmEnfSxcbiAgICAgICAgICAge25hbWU6ICdCZWxhcnVzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmVsZ2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JlbGl6ZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmVuaW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdCaHV0YW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdCb2xpdmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0Jvc25pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCcmF6aWxpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCcml0aXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnJ1bmVpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCdWxnYXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCdXJraW5hYmUnfSxcbiAgICAgICAgICAge25hbWU6ICdCdXJtZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnVydW5kaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2FtYm9kaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2FtZXJvb25pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDYW5hZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NhcGUgVmVyZGVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NlbnRyYWwgQWZyaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NoYWRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDaGlsZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2hpbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0NvbG9tYmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NvbW9yYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDb25nb2xlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdDb3N0YSBSaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0Nyb2F0aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ3ViYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDeXByaW90J30sXG4gICAgICAgICAgIHtuYW1lOiAnQ3plY2gnfSxcbiAgICAgICAgICAge25hbWU6ICdEYW5pc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdEamlib3V0aSd9LFxuICAgICAgICAgICB7bmFtZTogJ0RvbWluaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0R1dGNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRWFzdCBUaW1vcmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0VjdWFkb3JlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFZ3lwdGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0VtaXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFcXVhdG9yaWFsIEd1aW5lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFcml0cmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0VzdG9uaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRXRoaW9waWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRmlqaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRmlsaXBpbm8nfSxcbiAgICAgICAgICAge25hbWU6ICdGaW5uaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRnJlbmNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR2Fib25lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdHYW1iaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR2VvcmdpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHZXJtYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHaGFuYWlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0dyZWVrJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3JlbmFkaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3VhdGVtYWxhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0d1aW5lYS1CaXNzYXVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0d1aW5lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHdXlhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0hhaXRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdIZXJ6ZWdvdmluaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSG9uZHVyYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdIdW5nYXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdJLUtpcmliYXRpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSWNlbGFuZGVyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSW5kaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSW5kb25lc2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0lyYW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdJcmFxaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0lyaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXNyYWVsaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0l0YWxpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdJdm9yaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSmFtYWljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdKYXBhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0pvcmRhbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0themFraHN0YW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnS2VueWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnS2l0dGlhbiBhbmQgTmV2aXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdLdXdhaXRpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnS3lyZ3l6J30sXG4gICAgICAgICAgIHtuYW1lOiAnTGFvdGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0xhdHZpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdMZWJhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0xpYmVyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGlieWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGllY2h0ZW5zdGVpbmVyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGl0aHVhbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0x1eGVtYm91cmdlcid9LFxuICAgICAgICAgICB7bmFtZTogJ01hY2Vkb25pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYWxhZ2FzeSd9LFxuICAgICAgICAgICB7bmFtZTogJ01hbGF3aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsYXlzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsZGl2YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYWxpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYWx0ZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFyc2hhbGxlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdNYXVyaXRhbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hdXJpdGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01leGljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNaWNyb25lc2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01vbGRvdmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW9uYWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01vbmdvbGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01vcm9jY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW9zb3Robyd9LFxuICAgICAgICAgICB7bmFtZTogJ01vdHN3YW5hJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW96YW1iaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05hbWliaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmF1cnVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05lcGFsZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmV3IFplYWxhbmRlcid9LFxuICAgICAgICAgICB7bmFtZTogJ05pY2FyYWd1YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOaWdlcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05pZ2VyaWVuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTm9ydGggS29yZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTm9ydGhlcm4gSXJpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdOb3J3ZWdpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdPbWFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1Bha2lzdGFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1BhbGF1YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdQYW5hbWFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGFwdWEgTmV3IEd1aW5lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdQYXJhZ3VheWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGVydXZpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdQb2xpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdQb3J0dWd1ZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUWF0YXJpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUm9tYW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUnVzc2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1J3YW5kYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTYWludCBMdWNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTYWx2YWRvcmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2Ftb2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2FuIE1hcmluZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2FvIFRvbWVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NhdWRpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2NvdHRpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdTZW5lZ2FsZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2VyYmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NleWNoZWxsb2lzJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2llcnJhIExlb25lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTaW5nYXBvcmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1Nsb3Zha2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1Nsb3Zlbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NvbG9tb24gSXNsYW5kZXInfSxcbiAgICAgICAgICAge25hbWU6ICdTb21hbGknfSxcbiAgICAgICAgICAge25hbWU6ICdTb3V0aCBBZnJpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU291dGggS29yZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3BhbmlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ1NyaSBMYW5rYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTdWRhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1N1cmluYW1lcid9LFxuICAgICAgICAgICB7bmFtZTogJ1N3YXppJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3dlZGlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ1N3aXNzJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3lyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVGFpd2FuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVGFqaWsnfSxcbiAgICAgICAgICAge25hbWU6ICdUYW56YW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdUaGFpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVG9nb2xlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdUb25nYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdUcmluaWRhZGlhbiBvciBUb2JhZ29uaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVHVuaXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdUdXJraXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVHV2YWx1YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdVZ2FuZGFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVWtyYWluaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVXJ1Z3VheWEnfSxcbiAgICAgICAgICAge25hbWU6ICdVemJla2lzdGFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1ZlbmV6dWVsYSd9LFxuICAgICAgICAgICB7bmFtZTogJ1ZpZXRuYW1lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdXZWxzJ30sXG4gICAgICAgICAgIHtuYW1lOiAnWWVtZW5pdCd9LFxuICAgICAgICAgICB7bmFtZTogJ1phbWJpYSd9LFxuICAgICAgICAgICB7bmFtZTogJ1ppbWJhYndlJ30sXG4gICAgICAgIF0sXG5cbiAgICAgICAgdXNfc3RhdGVzX2FuZF9kYzogW1xuICAgICAgICAgICAge25hbWU6ICdBbGFiYW1hJywgYWJicmV2aWF0aW9uOiAnQUwnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQWxhc2thJywgYWJicmV2aWF0aW9uOiAnQUsnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXJpem9uYScsIGFiYnJldmlhdGlvbjogJ0FaJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0Fya2Fuc2FzJywgYWJicmV2aWF0aW9uOiAnQVInfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ2FsaWZvcm5pYScsIGFiYnJldmlhdGlvbjogJ0NBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0NvbG9yYWRvJywgYWJicmV2aWF0aW9uOiAnQ08nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ29ubmVjdGljdXQnLCBhYmJyZXZpYXRpb246ICdDVCd9LFxuICAgICAgICAgICAge25hbWU6ICdEZWxhd2FyZScsIGFiYnJldmlhdGlvbjogJ0RFJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0Rpc3RyaWN0IG9mIENvbHVtYmlhJywgYWJicmV2aWF0aW9uOiAnREMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRmxvcmlkYScsIGFiYnJldmlhdGlvbjogJ0ZMJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0dlb3JnaWEnLCBhYmJyZXZpYXRpb246ICdHQSd9LFxuICAgICAgICAgICAge25hbWU6ICdIYXdhaWknLCBhYmJyZXZpYXRpb246ICdISSd9LFxuICAgICAgICAgICAge25hbWU6ICdJZGFobycsIGFiYnJldmlhdGlvbjogJ0lEJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0lsbGlub2lzJywgYWJicmV2aWF0aW9uOiAnSUwnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSW5kaWFuYScsIGFiYnJldmlhdGlvbjogJ0lOJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0lvd2EnLCBhYmJyZXZpYXRpb246ICdJQSd9LFxuICAgICAgICAgICAge25hbWU6ICdLYW5zYXMnLCBhYmJyZXZpYXRpb246ICdLUyd9LFxuICAgICAgICAgICAge25hbWU6ICdLZW50dWNreScsIGFiYnJldmlhdGlvbjogJ0tZJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0xvdWlzaWFuYScsIGFiYnJldmlhdGlvbjogJ0xBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01haW5lJywgYWJicmV2aWF0aW9uOiAnTUUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFyeWxhbmQnLCBhYmJyZXZpYXRpb246ICdNRCd9LFxuICAgICAgICAgICAge25hbWU6ICdNYXNzYWNodXNldHRzJywgYWJicmV2aWF0aW9uOiAnTUEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWljaGlnYW4nLCBhYmJyZXZpYXRpb246ICdNSSd9LFxuICAgICAgICAgICAge25hbWU6ICdNaW5uZXNvdGEnLCBhYmJyZXZpYXRpb246ICdNTid9LFxuICAgICAgICAgICAge25hbWU6ICdNaXNzaXNzaXBwaScsIGFiYnJldmlhdGlvbjogJ01TJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pc3NvdXJpJywgYWJicmV2aWF0aW9uOiAnTU8nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTW9udGFuYScsIGFiYnJldmlhdGlvbjogJ01UJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05lYnJhc2thJywgYWJicmV2aWF0aW9uOiAnTkUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV2YWRhJywgYWJicmV2aWF0aW9uOiAnTlYnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3IEhhbXBzaGlyZScsIGFiYnJldmlhdGlvbjogJ05IJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldyBKZXJzZXknLCBhYmJyZXZpYXRpb246ICdOSid9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgTWV4aWNvJywgYWJicmV2aWF0aW9uOiAnTk0nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3IFlvcmsnLCBhYmJyZXZpYXRpb246ICdOWSd9LFxuICAgICAgICAgICAge25hbWU6ICdOb3J0aCBDYXJvbGluYScsIGFiYnJldmlhdGlvbjogJ05DJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRoIERha290YScsIGFiYnJldmlhdGlvbjogJ05EJ30sXG4gICAgICAgICAgICB7bmFtZTogJ09oaW8nLCBhYmJyZXZpYXRpb246ICdPSCd9LFxuICAgICAgICAgICAge25hbWU6ICdPa2xhaG9tYScsIGFiYnJldmlhdGlvbjogJ09LJ30sXG4gICAgICAgICAgICB7bmFtZTogJ09yZWdvbicsIGFiYnJldmlhdGlvbjogJ09SJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Blbm5zeWx2YW5pYScsIGFiYnJldmlhdGlvbjogJ1BBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Job2RlIElzbGFuZCcsIGFiYnJldmlhdGlvbjogJ1JJJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1NvdXRoIENhcm9saW5hJywgYWJicmV2aWF0aW9uOiAnU0MnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU291dGggRGFrb3RhJywgYWJicmV2aWF0aW9uOiAnU0QnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVGVubmVzc2VlJywgYWJicmV2aWF0aW9uOiAnVE4nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVGV4YXMnLCBhYmJyZXZpYXRpb246ICdUWCd9LFxuICAgICAgICAgICAge25hbWU6ICdVdGFoJywgYWJicmV2aWF0aW9uOiAnVVQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmVybW9udCcsIGFiYnJldmlhdGlvbjogJ1ZUJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1ZpcmdpbmlhJywgYWJicmV2aWF0aW9uOiAnVkEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnV2FzaGluZ3RvbicsIGFiYnJldmlhdGlvbjogJ1dBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1dlc3QgVmlyZ2luaWEnLCBhYmJyZXZpYXRpb246ICdXVid9LFxuICAgICAgICAgICAge25hbWU6ICdXaXNjb25zaW4nLCBhYmJyZXZpYXRpb246ICdXSSd9LFxuICAgICAgICAgICAge25hbWU6ICdXeW9taW5nJywgYWJicmV2aWF0aW9uOiAnV1knfVxuICAgICAgICBdLFxuXG4gICAgICAgIHRlcnJpdG9yaWVzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FtZXJpY2FuIFNhbW9hJywgYWJicmV2aWF0aW9uOiAnQVMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRmVkZXJhdGVkIFN0YXRlcyBvZiBNaWNyb25lc2lhJywgYWJicmV2aWF0aW9uOiAnRk0nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnR3VhbScsIGFiYnJldmlhdGlvbjogJ0dVJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01hcnNoYWxsIElzbGFuZHMnLCBhYmJyZXZpYXRpb246ICdNSCd9LFxuICAgICAgICAgICAge25hbWU6ICdOb3J0aGVybiBNYXJpYW5hIElzbGFuZHMnLCBhYmJyZXZpYXRpb246ICdNUCd9LFxuICAgICAgICAgICAge25hbWU6ICdQdWVydG8gUmljbycsIGFiYnJldmlhdGlvbjogJ1BSJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1ZpcmdpbiBJc2xhbmRzLCBVLlMuJywgYWJicmV2aWF0aW9uOiAnVkknfVxuICAgICAgICBdLFxuXG4gICAgICAgIGFybWVkX2ZvcmNlczogW1xuICAgICAgICAgICAge25hbWU6ICdBcm1lZCBGb3JjZXMgRXVyb3BlJywgYWJicmV2aWF0aW9uOiAnQUUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXJtZWQgRm9yY2VzIFBhY2lmaWMnLCBhYmJyZXZpYXRpb246ICdBUCd9LFxuICAgICAgICAgICAge25hbWU6ICdBcm1lZCBGb3JjZXMgdGhlIEFtZXJpY2FzJywgYWJicmV2aWF0aW9uOiAnQUEnfVxuICAgICAgICBdLFxuXG4gICAgICAgIGNvdW50cnlfcmVnaW9uczoge1xuICAgICAgICAgICAgaXQ6IFtcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmFsbGUgZCdBb3N0YVwiLCBhYmJyZXZpYXRpb246IFwiVkRBXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGllbW9udGVcIiwgYWJicmV2aWF0aW9uOiBcIlBJRVwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxvbWJhcmRpYVwiLCBhYmJyZXZpYXRpb246IFwiTE9NXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmVuZXRvXCIsIGFiYnJldmlhdGlvbjogXCJWRU5cIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUcmVudGlubyBBbHRvIEFkaWdlXCIsIGFiYnJldmlhdGlvbjogXCJUQUFcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGcml1bGkgVmVuZXppYSBHaXVsaWFcIiwgYWJicmV2aWF0aW9uOiBcIkZWR1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxpZ3VyaWFcIiwgYWJicmV2aWF0aW9uOiBcIkxJR1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkVtaWxpYSBSb21hZ25hXCIsIGFiYnJldmlhdGlvbjogXCJFTVJcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUb3NjYW5hXCIsIGFiYnJldmlhdGlvbjogXCJUT1NcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJVbWJyaWFcIiwgYWJicmV2aWF0aW9uOiBcIlVNQlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1hcmNoZVwiLCBhYmJyZXZpYXRpb246IFwiTUFSXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQWJydXp6b1wiLCBhYmJyZXZpYXRpb246IFwiQUJSXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGF6aW9cIiwgYWJicmV2aWF0aW9uOiBcIkxBWlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhbXBhbmlhXCIsIGFiYnJldmlhdGlvbjogXCJDQU1cIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQdWdsaWFcIiwgYWJicmV2aWF0aW9uOiBcIlBVR1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJhc2lsaWNhdGFcIiwgYWJicmV2aWF0aW9uOiBcIkJBU1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1vbGlzZVwiLCBhYmJyZXZpYXRpb246IFwiTU9MXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FsYWJyaWFcIiwgYWJicmV2aWF0aW9uOiBcIkNBTFwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNpY2lsaWFcIiwgYWJicmV2aWF0aW9uOiBcIlNJQ1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNhcmRlZ25hXCIsIGFiYnJldmlhdGlvbjogXCJTQVJcIiB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sXG5cbiAgICAgICAgc3RyZWV0X3N1ZmZpeGVzOiB7XG4gICAgICAgICAgICAndXMnOiBbXG4gICAgICAgICAgICAgICAge25hbWU6ICdBdmVudWUnLCBhYmJyZXZpYXRpb246ICdBdmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JvdWxldmFyZCcsIGFiYnJldmlhdGlvbjogJ0JsdmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NlbnRlcicsIGFiYnJldmlhdGlvbjogJ0N0cid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2lyY2xlJywgYWJicmV2aWF0aW9uOiAnQ2lyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VydCcsIGFiYnJldmlhdGlvbjogJ0N0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEcml2ZScsIGFiYnJldmlhdGlvbjogJ0RyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFeHRlbnNpb24nLCBhYmJyZXZpYXRpb246ICdFeHQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dsZW4nLCBhYmJyZXZpYXRpb246ICdHbG4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dyb3ZlJywgYWJicmV2aWF0aW9uOiAnR3J2J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIZWlnaHRzJywgYWJicmV2aWF0aW9uOiAnSHRzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIaWdod2F5JywgYWJicmV2aWF0aW9uOiAnSHd5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdKdW5jdGlvbicsIGFiYnJldmlhdGlvbjogJ0pjdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnS2V5JywgYWJicmV2aWF0aW9uOiAnS2V5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMYW5lJywgYWJicmV2aWF0aW9uOiAnTG4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xvb3AnLCBhYmJyZXZpYXRpb246ICdMb29wJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNYW5vcicsIGFiYnJldmlhdGlvbjogJ01ucid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWlsbCcsIGFiYnJldmlhdGlvbjogJ01pbGwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BhcmsnLCBhYmJyZXZpYXRpb246ICdQYXJrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQYXJrd2F5JywgYWJicmV2aWF0aW9uOiAnUGt3eSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGFzcycsIGFiYnJldmlhdGlvbjogJ1Bhc3MnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BhdGgnLCBhYmJyZXZpYXRpb246ICdQYXRoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQaWtlJywgYWJicmV2aWF0aW9uOiAnUGlrZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGxhY2UnLCBhYmJyZXZpYXRpb246ICdQbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGxhemEnLCBhYmJyZXZpYXRpb246ICdQbHonfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BvaW50JywgYWJicmV2aWF0aW9uOiAnUHQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JpZGdlJywgYWJicmV2aWF0aW9uOiAnUmRnJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSaXZlcicsIGFiYnJldmlhdGlvbjogJ1Jpdid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUm9hZCcsIGFiYnJldmlhdGlvbjogJ1JkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTcXVhcmUnLCBhYmJyZXZpYXRpb246ICdTcSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RyZWV0JywgYWJicmV2aWF0aW9uOiAnU3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RlcnJhY2UnLCBhYmJyZXZpYXRpb246ICdUZXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RyYWlsJywgYWJicmV2aWF0aW9uOiAnVHJsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUdXJucGlrZScsIGFiYnJldmlhdGlvbjogJ1Rwa2UnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1ZpZXcnLCBhYmJyZXZpYXRpb246ICdWdyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2F5JywgYWJicmV2aWF0aW9uOiAnV2F5J31cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAnaXQnOiBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQWNjZXNzbycsIGFiYnJldmlhdGlvbjogJ0FjYy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQWx6YWlhJywgYWJicmV2aWF0aW9uOiAnQWx6LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBcmNvJywgYWJicmV2aWF0aW9uOiAnQXJjbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBcmNoaXZvbHRvJywgYWJicmV2aWF0aW9uOiAnQWN2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBcmVuYScsIGFiYnJldmlhdGlvbjogJ0FyZW5hJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FyZ2luZScsIGFiYnJldmlhdGlvbjogJ0FyZ2luZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCYWNpbm8nLCBhYmJyZXZpYXRpb246ICdCYWNpbm8nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFuY2hpJywgYWJicmV2aWF0aW9uOiAnQmFuY2hpJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JhbmNoaW5hJywgYWJicmV2aWF0aW9uOiAnQmFuLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCYXN0aW9uaScsIGFiYnJldmlhdGlvbjogJ0Jhcy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmVsdmVkZXJlJywgYWJicmV2aWF0aW9uOiAnQmVsdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQm9yZ2F0YScsIGFiYnJldmlhdGlvbjogJ0IudGEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQm9yZ28nLCBhYmJyZXZpYXRpb246ICdCLmdvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhbGF0YScsIGFiYnJldmlhdGlvbjogJ0NhbC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FsbGUnLCBhYmJyZXZpYXRpb246ICdDYWxsZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYW1waWVsbG8nLCBhYmJyZXZpYXRpb246ICdDYW0uJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhbXBvJywgYWJicmV2aWF0aW9uOiAnQ2FtLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYW5hbGUnLCBhYmJyZXZpYXRpb246ICdDYW4uJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhcnJhaWEnLCBhYmJyZXZpYXRpb246ICdDYXJyLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYXNjaW5hJywgYWJicmV2aWF0aW9uOiAnQ2FzY2luYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYXNlIHNwYXJzZScsIGFiYnJldmlhdGlvbjogJ2Mucy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2F2YWxjYXZpYScsIGFiYnJldmlhdGlvbjogJ0N2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDaXJjb252YWxsYXppb25lJywgYWJicmV2aWF0aW9uOiAnQ3YuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NvbXBsYW5hcmUnLCBhYmJyZXZpYXRpb246ICdDLnJlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NvbnRyYWRhJywgYWJicmV2aWF0aW9uOiAnQy5kYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDb3JzbycsIGFiYnJldmlhdGlvbjogJ0Muc28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ29ydGUnLCBhYmJyZXZpYXRpb246ICdDLnRlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NvcnRpbGUnLCBhYmJyZXZpYXRpb246ICdDLmxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0RpcmFtYXppb25lJywgYWJicmV2aWF0aW9uOiAnRGlyLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdGb25kYWNvJywgYWJicmV2aWF0aW9uOiAnRi5jbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdGb25kYW1lbnRhJywgYWJicmV2aWF0aW9uOiAnRi50YScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdGb25kbycsIGFiYnJldmlhdGlvbjogJ0YuZG8nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnRnJhemlvbmUnLCBhYmJyZXZpYXRpb246ICdGci4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnSXNvbGEnLCBhYmJyZXZpYXRpb246ICdJcy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTGFyZ28nLCBhYmJyZXZpYXRpb246ICdMLmdvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0xpdG9yYW5lYScsIGFiYnJldmlhdGlvbjogJ0xpdC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTHVuZ29sYWdvJywgYWJicmV2aWF0aW9uOiAnTC5nbyBsYWdvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0x1bmdvIFBvJywgYWJicmV2aWF0aW9uOiAnbC5nbyBQbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdNb2xvJywgYWJicmV2aWF0aW9uOiAnTW9sbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdNdXJhJywgYWJicmV2aWF0aW9uOiAnTXVyYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQYXNzYWdnaW8gcHJpdmF0bycsIGFiYnJldmlhdGlvbjogJ3Bhc3MuIHByaXYuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1Bhc3NlZ2dpYXRhJywgYWJicmV2aWF0aW9uOiAnUGFzcy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUGlhenphJywgYWJicmV2aWF0aW9uOiAnUC56emEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUGlhenphbGUnLCBhYmJyZXZpYXRpb246ICdQLmxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1BvbnRlJywgYWJicmV2aWF0aW9uOiAnUC50ZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQb3J0aWNvJywgYWJicmV2aWF0aW9uOiAnUC5jbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSYW1wYScsIGFiYnJldmlhdGlvbjogJ1JhbXBhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JlZ2lvbmUnLCBhYmJyZXZpYXRpb246ICdSZWcuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1Jpb25lJywgYWJicmV2aWF0aW9uOiAnUi5uZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSaW8nLCBhYmJyZXZpYXRpb246ICdSaW8nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUmlwYScsIGFiYnJldmlhdGlvbjogJ1JpcGEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUml2YScsIGFiYnJldmlhdGlvbjogJ1JpdmEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUm9uZMOyJywgYWJicmV2aWF0aW9uOiAnUm9uZMOyJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JvdG9uZGEnLCBhYmJyZXZpYXRpb246ICdSb3QuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NhZ3JhdG8nLCBhYmJyZXZpYXRpb246ICdTYWdyLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTYWxpdGEnLCBhYmJyZXZpYXRpb246ICdTYWwuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NjYWxpbmF0YScsIGFiYnJldmlhdGlvbjogJ1NjYWwuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NjYWxvbmUnLCBhYmJyZXZpYXRpb246ICdTY2FsLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTbGFyZ28nLCBhYmJyZXZpYXRpb246ICdTbC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU290dG9wb3J0aWNvJywgYWJicmV2aWF0aW9uOiAnU290dC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU3RyYWRhJywgYWJicmV2aWF0aW9uOiAnU3RyLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTdHJhZGFsZScsIGFiYnJldmlhdGlvbjogJ1N0ci5sZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTdHJldHRvaWEnLCBhYmJyZXZpYXRpb246ICdTdHJldHQuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1RyYXZlcnNhJywgYWJicmV2aWF0aW9uOiAnVHJhdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnVmlhJywgYWJicmV2aWF0aW9uOiAnVi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnVmlhbGUnLCBhYmJyZXZpYXRpb246ICdWLmxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1ZpY2luYWxlJywgYWJicmV2aWF0aW9uOiAnVmljLmxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1ZpY29sbycsIGFiYnJldmlhdGlvbjogJ1ZpYy4nIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAndWsnIDogW1xuICAgICAgICAgICAgICAgIHtuYW1lOiAnQXZlbnVlJywgYWJicmV2aWF0aW9uOiAnQXZlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDbG9zZScsIGFiYnJldmlhdGlvbjogJ0NsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VydCcsIGFiYnJldmlhdGlvbjogJ0N0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDcmVzY2VudCcsIGFiYnJldmlhdGlvbjogJ0NyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEcml2ZScsIGFiYnJldmlhdGlvbjogJ0RyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHYXJkZW4nLCBhYmJyZXZpYXRpb246ICdHZG4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dhcmRlbnMnLCBhYmJyZXZpYXRpb246ICdHZG5zJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHcmVlbicsIGFiYnJldmlhdGlvbjogJ0duJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHcm92ZScsIGFiYnJldmlhdGlvbjogJ0dyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMYW5lJywgYWJicmV2aWF0aW9uOiAnTG4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01vdW50JywgYWJicmV2aWF0aW9uOiAnTXQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BsYWNlJywgYWJicmV2aWF0aW9uOiAnUGwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BhcmsnLCBhYmJyZXZpYXRpb246ICdQayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUmlkZ2UnLCBhYmJyZXZpYXRpb246ICdSZGcnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JvYWQnLCBhYmJyZXZpYXRpb246ICdSZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3F1YXJlJywgYWJicmV2aWF0aW9uOiAnU3EnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0cmVldCcsIGFiYnJldmlhdGlvbjogJ1N0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUZXJyYWNlJywgYWJicmV2aWF0aW9uOiAnVGVyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdWYWxsZXknLCBhYmJyZXZpYXRpb246ICdWYWwnfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuXG4gICAgICAgIG1vbnRoczogW1xuICAgICAgICAgICAge25hbWU6ICdKYW51YXJ5Jywgc2hvcnRfbmFtZTogJ0phbicsIG51bWVyaWM6ICcwMScsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIC8vIE5vdCBtZXNzaW5nIHdpdGggbGVhcCB5ZWFycy4uLlxuICAgICAgICAgICAge25hbWU6ICdGZWJydWFyeScsIHNob3J0X25hbWU6ICdGZWInLCBudW1lcmljOiAnMDInLCBkYXlzOiAyOH0sXG4gICAgICAgICAgICB7bmFtZTogJ01hcmNoJywgc2hvcnRfbmFtZTogJ01hcicsIG51bWVyaWM6ICcwMycsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXByaWwnLCBzaG9ydF9uYW1lOiAnQXByJywgbnVtZXJpYzogJzA0JywgZGF5czogMzB9LFxuICAgICAgICAgICAge25hbWU6ICdNYXknLCBzaG9ydF9uYW1lOiAnTWF5JywgbnVtZXJpYzogJzA1JywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdKdW5lJywgc2hvcnRfbmFtZTogJ0p1bicsIG51bWVyaWM6ICcwNicsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSnVseScsIHNob3J0X25hbWU6ICdKdWwnLCBudW1lcmljOiAnMDcnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ0F1Z3VzdCcsIHNob3J0X25hbWU6ICdBdWcnLCBudW1lcmljOiAnMDgnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ1NlcHRlbWJlcicsIHNob3J0X25hbWU6ICdTZXAnLCBudW1lcmljOiAnMDknLCBkYXlzOiAzMH0sXG4gICAgICAgICAgICB7bmFtZTogJ09jdG9iZXInLCBzaG9ydF9uYW1lOiAnT2N0JywgbnVtZXJpYzogJzEwJywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdOb3ZlbWJlcicsIHNob3J0X25hbWU6ICdOb3YnLCBudW1lcmljOiAnMTEnLCBkYXlzOiAzMH0sXG4gICAgICAgICAgICB7bmFtZTogJ0RlY2VtYmVyJywgc2hvcnRfbmFtZTogJ0RlYycsIG51bWVyaWM6ICcxMicsIGRheXM6IDMxfVxuICAgICAgICBdLFxuXG4gICAgICAgIC8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmFua19jYXJkX251bWJlciNJc3N1ZXJfaWRlbnRpZmljYXRpb25fbnVtYmVyXy4yOElJTi4yOVxuICAgICAgICBjY190eXBlczogW1xuICAgICAgICAgICAge25hbWU6IFwiQW1lcmljYW4gRXhwcmVzc1wiLCBzaG9ydF9uYW1lOiAnYW1leCcsIHByZWZpeDogJzM0JywgbGVuZ3RoOiAxNX0sXG4gICAgICAgICAgICB7bmFtZTogXCJCYW5rY2FyZFwiLCBzaG9ydF9uYW1lOiAnYmFua2NhcmQnLCBwcmVmaXg6ICc1NjEwJywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJDaGluYSBVbmlvblBheVwiLCBzaG9ydF9uYW1lOiAnY2hpbmF1bmlvbicsIHByZWZpeDogJzYyJywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaW5lcnMgQ2x1YiBDYXJ0ZSBCbGFuY2hlXCIsIHNob3J0X25hbWU6ICdkY2NhcnRlJywgcHJlZml4OiAnMzAwJywgbGVuZ3RoOiAxNH0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaW5lcnMgQ2x1YiBlblJvdXRlXCIsIHNob3J0X25hbWU6ICdkY2Vucm91dGUnLCBwcmVmaXg6ICcyMDE0JywgbGVuZ3RoOiAxNX0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaW5lcnMgQ2x1YiBJbnRlcm5hdGlvbmFsXCIsIHNob3J0X25hbWU6ICdkY2ludGwnLCBwcmVmaXg6ICczNicsIGxlbmd0aDogMTR9LFxuICAgICAgICAgICAge25hbWU6IFwiRGluZXJzIENsdWIgVW5pdGVkIFN0YXRlcyAmIENhbmFkYVwiLCBzaG9ydF9uYW1lOiAnZGN1c2MnLCBwcmVmaXg6ICc1NCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiRGlzY292ZXIgQ2FyZFwiLCBzaG9ydF9uYW1lOiAnZGlzY292ZXInLCBwcmVmaXg6ICc2MDExJywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJJbnN0YVBheW1lbnRcIiwgc2hvcnRfbmFtZTogJ2luc3RhcGF5JywgcHJlZml4OiAnNjM3JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJKQ0JcIiwgc2hvcnRfbmFtZTogJ2pjYicsIHByZWZpeDogJzM1MjgnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkxhc2VyXCIsIHNob3J0X25hbWU6ICdsYXNlcicsIHByZWZpeDogJzYzMDQnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIk1hZXN0cm9cIiwgc2hvcnRfbmFtZTogJ21hZXN0cm8nLCBwcmVmaXg6ICc1MDE4JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJNYXN0ZXJjYXJkXCIsIHNob3J0X25hbWU6ICdtYycsIHByZWZpeDogJzUxJywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJTb2xvXCIsIHNob3J0X25hbWU6ICdzb2xvJywgcHJlZml4OiAnNjMzNCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiU3dpdGNoXCIsIHNob3J0X25hbWU6ICdzd2l0Y2gnLCBwcmVmaXg6ICc0OTAzJywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJWaXNhXCIsIHNob3J0X25hbWU6ICd2aXNhJywgcHJlZml4OiAnNCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiVmlzYSBFbGVjdHJvblwiLCBzaG9ydF9uYW1lOiAnZWxlY3Ryb24nLCBwcmVmaXg6ICc0MDI2JywgbGVuZ3RoOiAxNn1cbiAgICAgICAgXSxcblxuICAgICAgICAvL3JldHVybiBhbGwgd29ybGQgY3VycmVuY3kgYnkgSVNPIDQyMTdcbiAgICAgICAgY3VycmVuY3lfdHlwZXM6IFtcbiAgICAgICAgICAgIHsnY29kZScgOiAnQUVEJywgJ25hbWUnIDogJ1VuaXRlZCBBcmFiIEVtaXJhdGVzIERpcmhhbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBRk4nLCAnbmFtZScgOiAnQWZnaGFuaXN0YW4gQWZnaGFuaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBTEwnLCAnbmFtZScgOiAnQWxiYW5pYSBMZWsnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQU1EJywgJ25hbWUnIDogJ0FybWVuaWEgRHJhbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBTkcnLCAnbmFtZScgOiAnTmV0aGVybGFuZHMgQW50aWxsZXMgR3VpbGRlcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBT0EnLCAnbmFtZScgOiAnQW5nb2xhIEt3YW56YSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBUlMnLCAnbmFtZScgOiAnQXJnZW50aW5hIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQVVEJywgJ25hbWUnIDogJ0F1c3RyYWxpYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQVdHJywgJ25hbWUnIDogJ0FydWJhIEd1aWxkZXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQVpOJywgJ25hbWUnIDogJ0F6ZXJiYWlqYW4gTmV3IE1hbmF0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JBTScsICduYW1lJyA6ICdCb3NuaWEgYW5kIEhlcnplZ292aW5hIENvbnZlcnRpYmxlIE1hcmthJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JCRCcsICduYW1lJyA6ICdCYXJiYWRvcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkRUJywgJ25hbWUnIDogJ0JhbmdsYWRlc2ggVGFrYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCR04nLCAnbmFtZScgOiAnQnVsZ2FyaWEgTGV2J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JIRCcsICduYW1lJyA6ICdCYWhyYWluIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JJRicsICduYW1lJyA6ICdCdXJ1bmRpIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JNRCcsICduYW1lJyA6ICdCZXJtdWRhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCTkQnLCAnbmFtZScgOiAnQnJ1bmVpIERhcnVzc2FsYW0gRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JPQicsICduYW1lJyA6ICdCb2xpdmlhIEJvbGl2aWFubyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCUkwnLCAnbmFtZScgOiAnQnJhemlsIFJlYWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQlNEJywgJ25hbWUnIDogJ0JhaGFtYXMgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JUTicsICduYW1lJyA6ICdCaHV0YW4gTmd1bHRydW0nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQldQJywgJ25hbWUnIDogJ0JvdHN3YW5hIFB1bGEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQllSJywgJ25hbWUnIDogJ0JlbGFydXMgUnVibGUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQlpEJywgJ25hbWUnIDogJ0JlbGl6ZSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ0FEJywgJ25hbWUnIDogJ0NhbmFkYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ0RGJywgJ25hbWUnIDogJ0NvbmdvL0tpbnNoYXNhIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NIRicsICduYW1lJyA6ICdTd2l0emVybGFuZCBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDTFAnLCAnbmFtZScgOiAnQ2hpbGUgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDTlknLCAnbmFtZScgOiAnQ2hpbmEgWXVhbiBSZW5taW5iaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDT1AnLCAnbmFtZScgOiAnQ29sb21iaWEgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDUkMnLCAnbmFtZScgOiAnQ29zdGEgUmljYSBDb2xvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDVUMnLCAnbmFtZScgOiAnQ3ViYSBDb252ZXJ0aWJsZSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NVUCcsICduYW1lJyA6ICdDdWJhIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1ZFJywgJ25hbWUnIDogJ0NhcGUgVmVyZGUgRXNjdWRvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NaSycsICduYW1lJyA6ICdDemVjaCBSZXB1YmxpYyBLb3J1bmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnREpGJywgJ25hbWUnIDogJ0RqaWJvdXRpIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0RLSycsICduYW1lJyA6ICdEZW5tYXJrIEtyb25lJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0RPUCcsICduYW1lJyA6ICdEb21pbmljYW4gUmVwdWJsaWMgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdEWkQnLCAnbmFtZScgOiAnQWxnZXJpYSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFR1AnLCAnbmFtZScgOiAnRWd5cHQgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRVJOJywgJ25hbWUnIDogJ0VyaXRyZWEgTmFrZmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRVRCJywgJ25hbWUnIDogJ0V0aGlvcGlhIEJpcnInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRVVSJywgJ25hbWUnIDogJ0V1cm8gTWVtYmVyIENvdW50cmllcyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdGSkQnLCAnbmFtZScgOiAnRmlqaSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRktQJywgJ25hbWUnIDogJ0ZhbGtsYW5kIElzbGFuZHMgKE1hbHZpbmFzKSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHQlAnLCAnbmFtZScgOiAnVW5pdGVkIEtpbmdkb20gUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR0VMJywgJ25hbWUnIDogJ0dlb3JnaWEgTGFyaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHR1AnLCAnbmFtZScgOiAnR3Vlcm5zZXkgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR0hTJywgJ25hbWUnIDogJ0doYW5hIENlZGknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR0lQJywgJ25hbWUnIDogJ0dpYnJhbHRhciBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHTUQnLCAnbmFtZScgOiAnR2FtYmlhIERhbGFzaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHTkYnLCAnbmFtZScgOiAnR3VpbmVhIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dUUScsICduYW1lJyA6ICdHdWF0ZW1hbGEgUXVldHphbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHWUQnLCAnbmFtZScgOiAnR3V5YW5hIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdIS0QnLCAnbmFtZScgOiAnSG9uZyBLb25nIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdITkwnLCAnbmFtZScgOiAnSG9uZHVyYXMgTGVtcGlyYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdIUksnLCAnbmFtZScgOiAnQ3JvYXRpYSBLdW5hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hURycsICduYW1lJyA6ICdIYWl0aSBHb3VyZGUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSFVGJywgJ25hbWUnIDogJ0h1bmdhcnkgRm9yaW50J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lEUicsICduYW1lJyA6ICdJbmRvbmVzaWEgUnVwaWFoJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lMUycsICduYW1lJyA6ICdJc3JhZWwgU2hla2VsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lNUCcsICduYW1lJyA6ICdJc2xlIG9mIE1hbiBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJTlInLCAnbmFtZScgOiAnSW5kaWEgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSVFEJywgJ25hbWUnIDogJ0lyYXEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSVJSJywgJ25hbWUnIDogJ0lyYW4gUmlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJU0snLCAnbmFtZScgOiAnSWNlbGFuZCBLcm9uYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdKRVAnLCAnbmFtZScgOiAnSmVyc2V5IFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pNRCcsICduYW1lJyA6ICdKYW1haWNhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdKT0QnLCAnbmFtZScgOiAnSm9yZGFuIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pQWScsICduYW1lJyA6ICdKYXBhbiBZZW4nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS0VTJywgJ25hbWUnIDogJ0tlbnlhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tHUycsICduYW1lJyA6ICdLeXJneXpzdGFuIFNvbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLSFInLCAnbmFtZScgOiAnQ2FtYm9kaWEgUmllbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLTUYnLCAnbmFtZScgOiAnQ29tb3JvcyBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLUFcnLCAnbmFtZScgOiAnS29yZWEgKE5vcnRoKSBXb24nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1JXJywgJ25hbWUnIDogJ0tvcmVhIChTb3V0aCkgV29uJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tXRCcsICduYW1lJyA6ICdLdXdhaXQgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1lEJywgJ25hbWUnIDogJ0NheW1hbiBJc2xhbmRzIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLWlQnLCAnbmFtZScgOiAnS2F6YWtoc3RhbiBUZW5nZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMQUsnLCAnbmFtZScgOiAnTGFvcyBLaXAnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTEJQJywgJ25hbWUnIDogJ0xlYmFub24gUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTEtSJywgJ25hbWUnIDogJ1NyaSBMYW5rYSBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMUkQnLCAnbmFtZScgOiAnTGliZXJpYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTFNMJywgJ25hbWUnIDogJ0xlc290aG8gTG90aSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMVEwnLCAnbmFtZScgOiAnTGl0aHVhbmlhIExpdGFzJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xZRCcsICduYW1lJyA6ICdMaWJ5YSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNQUQnLCAnbmFtZScgOiAnTW9yb2NjbyBEaXJoYW0nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTURMJywgJ25hbWUnIDogJ01vbGRvdmEgTGV1J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01HQScsICduYW1lJyA6ICdNYWRhZ2FzY2FyIEFyaWFyeSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNS0QnLCAnbmFtZScgOiAnTWFjZWRvbmlhIERlbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01NSycsICduYW1lJyA6ICdNeWFubWFyIChCdXJtYSkgS3lhdCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNTlQnLCAnbmFtZScgOiAnTW9uZ29saWEgVHVnaHJpayd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNT1AnLCAnbmFtZScgOiAnTWFjYXUgUGF0YWNhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01STycsICduYW1lJyA6ICdNYXVyaXRhbmlhIE91Z3VpeWEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVVSJywgJ25hbWUnIDogJ01hdXJpdGl1cyBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNVlInLCAnbmFtZScgOiAnTWFsZGl2ZXMgKE1hbGRpdmUgSXNsYW5kcykgUnVmaXlhYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNV0snLCAnbmFtZScgOiAnTWFsYXdpIEt3YWNoYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNWE4nLCAnbmFtZScgOiAnTWV4aWNvIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVlSJywgJ25hbWUnIDogJ01hbGF5c2lhIFJpbmdnaXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVpOJywgJ25hbWUnIDogJ01vemFtYmlxdWUgTWV0aWNhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOQUQnLCAnbmFtZScgOiAnTmFtaWJpYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTkdOJywgJ25hbWUnIDogJ05pZ2VyaWEgTmFpcmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTklPJywgJ25hbWUnIDogJ05pY2FyYWd1YSBDb3Jkb2JhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05PSycsICduYW1lJyA6ICdOb3J3YXkgS3JvbmUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTlBSJywgJ25hbWUnIDogJ05lcGFsIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05aRCcsICduYW1lJyA6ICdOZXcgWmVhbGFuZCBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnT01SJywgJ25hbWUnIDogJ09tYW4gUmlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQQUInLCAnbmFtZScgOiAnUGFuYW1hIEJhbGJvYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQRU4nLCAnbmFtZScgOiAnUGVydSBOdWV2byBTb2wnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUEdLJywgJ25hbWUnIDogJ1BhcHVhIE5ldyBHdWluZWEgS2luYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQSFAnLCAnbmFtZScgOiAnUGhpbGlwcGluZXMgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQS1InLCAnbmFtZScgOiAnUGFraXN0YW4gUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUExOJywgJ25hbWUnIDogJ1BvbGFuZCBabG90eSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQWUcnLCAnbmFtZScgOiAnUGFyYWd1YXkgR3VhcmFuaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdRQVInLCAnbmFtZScgOiAnUWF0YXIgUml5YWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUk9OJywgJ25hbWUnIDogJ1JvbWFuaWEgTmV3IExldSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdSU0QnLCAnbmFtZScgOiAnU2VyYmlhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1JVQicsICduYW1lJyA6ICdSdXNzaWEgUnVibGUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUldGJywgJ25hbWUnIDogJ1J3YW5kYSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTQVInLCAnbmFtZScgOiAnU2F1ZGkgQXJhYmlhIFJpeWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NCRCcsICduYW1lJyA6ICdTb2xvbW9uIElzbGFuZHMgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NDUicsICduYW1lJyA6ICdTZXljaGVsbGVzIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NERycsICduYW1lJyA6ICdTdWRhbiBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTRUsnLCAnbmFtZScgOiAnU3dlZGVuIEtyb25hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NHRCcsICduYW1lJyA6ICdTaW5nYXBvcmUgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NIUCcsICduYW1lJyA6ICdTYWludCBIZWxlbmEgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0xMJywgJ25hbWUnIDogJ1NpZXJyYSBMZW9uZSBMZW9uZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTT1MnLCAnbmFtZScgOiAnU29tYWxpYSBTaGlsbGluZyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTUEwnLCAnbmFtZScgOiAnU2Vib3JnYSBMdWlnaW5vJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NSRCcsICduYW1lJyA6ICdTdXJpbmFtZSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1REJywgJ25hbWUnIDogJ1PDo28gVG9tw6kgYW5kIFByw61uY2lwZSBEb2JyYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTVkMnLCAnbmFtZScgOiAnRWwgU2FsdmFkb3IgQ29sb24nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1lQJywgJ25hbWUnIDogJ1N5cmlhIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NaTCcsICduYW1lJyA6ICdTd2F6aWxhbmQgTGlsYW5nZW5pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RIQicsICduYW1lJyA6ICdUaGFpbGFuZCBCYWh0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RKUycsICduYW1lJyA6ICdUYWppa2lzdGFuIFNvbW9uaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUTVQnLCAnbmFtZScgOiAnVHVya21lbmlzdGFuIE1hbmF0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RORCcsICduYW1lJyA6ICdUdW5pc2lhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RPUCcsICduYW1lJyA6ICdUb25nYSBQYVxcJ2FuZ2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFJZJywgJ25hbWUnIDogJ1R1cmtleSBMaXJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RURCcsICduYW1lJyA6ICdUcmluaWRhZCBhbmQgVG9iYWdvIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUVkQnLCAnbmFtZScgOiAnVHV2YWx1IERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUV0QnLCAnbmFtZScgOiAnVGFpd2FuIE5ldyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFpTJywgJ25hbWUnIDogJ1RhbnphbmlhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VBSCcsICduYW1lJyA6ICdVa3JhaW5lIEhyeXZuaWEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVUdYJywgJ25hbWUnIDogJ1VnYW5kYSBTaGlsbGluZyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVU0QnLCAnbmFtZScgOiAnVW5pdGVkIFN0YXRlcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVVlVJywgJ25hbWUnIDogJ1VydWd1YXkgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVWlMnLCAnbmFtZScgOiAnVXpiZWtpc3RhbiBTb20nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVkVGJywgJ25hbWUnIDogJ1ZlbmV6dWVsYSBCb2xpdmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1ZORCcsICduYW1lJyA6ICdWaWV0IE5hbSBEb25nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1ZVVicsICduYW1lJyA6ICdWYW51YXR1IFZhdHUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnV1NUJywgJ25hbWUnIDogJ1NhbW9hIFRhbGEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWEFGJywgJ25hbWUnIDogJ0NvbW11bmF1dMOpIEZpbmFuY2nDqHJlIEFmcmljYWluZSAoQkVBQykgQ0ZBIEZyYW5jIEJFQUMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWENEJywgJ25hbWUnIDogJ0Vhc3QgQ2FyaWJiZWFuIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYRFInLCAnbmFtZScgOiAnSW50ZXJuYXRpb25hbCBNb25ldGFyeSBGdW5kIChJTUYpIFNwZWNpYWwgRHJhd2luZyBSaWdodHMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWE9GJywgJ25hbWUnIDogJ0NvbW11bmF1dMOpIEZpbmFuY2nDqHJlIEFmcmljYWluZSAoQkNFQU8pIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hQRicsICduYW1lJyA6ICdDb21wdG9pcnMgRnJhbsOnYWlzIGR1IFBhY2lmaXF1ZSAoQ0ZQKSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdZRVInLCAnbmFtZScgOiAnWWVtZW4gUmlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdaQVInLCAnbmFtZScgOiAnU291dGggQWZyaWNhIFJhbmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWk1XJywgJ25hbWUnIDogJ1phbWJpYSBLd2FjaGEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWldEJywgJ25hbWUnIDogJ1ppbWJhYndlIERvbGxhcid9XG4gICAgICAgIF0sXG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSBuYW1lcyBvZiBhbGwgdmFsaWRlIGNvbG9yc1xuICAgICAgICBjb2xvck5hbWVzIDogWyAgXCJBbGljZUJsdWVcIiwgXCJCbGFja1wiLCBcIk5hdnlcIiwgXCJEYXJrQmx1ZVwiLCBcIk1lZGl1bUJsdWVcIiwgXCJCbHVlXCIsIFwiRGFya0dyZWVuXCIsIFwiR3JlZW5cIiwgXCJUZWFsXCIsIFwiRGFya0N5YW5cIiwgXCJEZWVwU2t5Qmx1ZVwiLCBcIkRhcmtUdXJxdW9pc2VcIiwgXCJNZWRpdW1TcHJpbmdHcmVlblwiLCBcIkxpbWVcIiwgXCJTcHJpbmdHcmVlblwiLFxuICAgICAgICAgICAgXCJBcXVhXCIsIFwiQ3lhblwiLCBcIk1pZG5pZ2h0Qmx1ZVwiLCBcIkRvZGdlckJsdWVcIiwgXCJMaWdodFNlYUdyZWVuXCIsIFwiRm9yZXN0R3JlZW5cIiwgXCJTZWFHcmVlblwiLCBcIkRhcmtTbGF0ZUdyYXlcIiwgXCJMaW1lR3JlZW5cIiwgXCJNZWRpdW1TZWFHcmVlblwiLCBcIlR1cnF1b2lzZVwiLCBcIlJveWFsQmx1ZVwiLCBcIlN0ZWVsQmx1ZVwiLCBcIkRhcmtTbGF0ZUJsdWVcIiwgXCJNZWRpdW1UdXJxdW9pc2VcIixcbiAgICAgICAgICAgIFwiSW5kaWdvXCIsIFwiRGFya09saXZlR3JlZW5cIiwgXCJDYWRldEJsdWVcIiwgXCJDb3JuZmxvd2VyQmx1ZVwiLCBcIlJlYmVjY2FQdXJwbGVcIiwgXCJNZWRpdW1BcXVhTWFyaW5lXCIsIFwiRGltR3JheVwiLCBcIlNsYXRlQmx1ZVwiLCBcIk9saXZlRHJhYlwiLCBcIlNsYXRlR3JheVwiLCBcIkxpZ2h0U2xhdGVHcmF5XCIsIFwiTWVkaXVtU2xhdGVCbHVlXCIsIFwiTGF3bkdyZWVuXCIsIFwiQ2hhcnRyZXVzZVwiLFxuICAgICAgICAgICAgXCJBcXVhbWFyaW5lXCIsIFwiTWFyb29uXCIsIFwiUHVycGxlXCIsIFwiT2xpdmVcIiwgXCJHcmF5XCIsIFwiU2t5Qmx1ZVwiLCBcIkxpZ2h0U2t5Qmx1ZVwiLCBcIkJsdWVWaW9sZXRcIiwgXCJEYXJrUmVkXCIsIFwiRGFya01hZ2VudGFcIiwgXCJTYWRkbGVCcm93blwiLCBcIkl2b3J5XCIsIFwiV2hpdGVcIixcbiAgICAgICAgICAgIFwiRGFya1NlYUdyZWVuXCIsIFwiTGlnaHRHcmVlblwiLCBcIk1lZGl1bVB1cnBsZVwiLCBcIkRhcmtWaW9sZXRcIiwgXCJQYWxlR3JlZW5cIiwgXCJEYXJrT3JjaGlkXCIsIFwiWWVsbG93R3JlZW5cIiwgXCJTaWVubmFcIiwgXCJCcm93blwiLCBcIkRhcmtHcmF5XCIsIFwiTGlnaHRCbHVlXCIsIFwiR3JlZW5ZZWxsb3dcIiwgXCJQYWxlVHVycXVvaXNlXCIsIFwiTGlnaHRTdGVlbEJsdWVcIiwgXCJQb3dkZXJCbHVlXCIsXG4gICAgICAgICAgICBcIkZpcmVCcmlja1wiLCBcIkRhcmtHb2xkZW5Sb2RcIiwgXCJNZWRpdW1PcmNoaWRcIiwgXCJSb3N5QnJvd25cIiwgXCJEYXJrS2hha2lcIiwgXCJTaWx2ZXJcIiwgXCJNZWRpdW1WaW9sZXRSZWRcIiwgXCJJbmRpYW5SZWRcIiwgXCJQZXJ1XCIsIFwiQ2hvY29sYXRlXCIsIFwiVGFuXCIsIFwiTGlnaHRHcmF5XCIsIFwiVGhpc3RsZVwiLCBcIk9yY2hpZFwiLCBcIkdvbGRlblJvZFwiLCBcIlBhbGVWaW9sZXRSZWRcIixcbiAgICAgICAgICAgIFwiQ3JpbXNvblwiLCBcIkdhaW5zYm9yb1wiLCBcIlBsdW1cIiwgXCJCdXJseVdvb2RcIiwgXCJMaWdodEN5YW5cIiwgXCJMYXZlbmRlclwiLCBcIkRhcmtTYWxtb25cIiwgXCJWaW9sZXRcIiwgXCJQYWxlR29sZGVuUm9kXCIsIFwiTGlnaHRDb3JhbFwiLCBcIktoYWtpXCIsIFwiQWxpY2VCbHVlXCIsIFwiSG9uZXlEZXdcIiwgXCJBenVyZVwiLCBcIlNhbmR5QnJvd25cIiwgXCJXaGVhdFwiLCBcIkJlaWdlXCIsIFwiV2hpdGVTbW9rZVwiLFxuICAgICAgICAgICAgXCJNaW50Q3JlYW1cIiwgXCJHaG9zdFdoaXRlXCIsIFwiU2FsbW9uXCIsIFwiQW50aXF1ZVdoaXRlXCIsIFwiTGluZW5cIiwgXCJMaWdodEdvbGRlblJvZFllbGxvd1wiLCBcIk9sZExhY2VcIiwgXCJSZWRcIiwgXCJGdWNoc2lhXCIsIFwiTWFnZW50YVwiLCBcIkRlZXBQaW5rXCIsIFwiT3JhbmdlUmVkXCIsIFwiVG9tYXRvXCIsIFwiSG90UGlua1wiLCBcIkNvcmFsXCIsIFwiRGFya09yYW5nZVwiLCBcIkxpZ2h0U2FsbW9uXCIsIFwiT3JhbmdlXCIsXG4gICAgICAgICAgICBcIkxpZ2h0UGlua1wiLCBcIlBpbmtcIiwgXCJHb2xkXCIsIFwiUGVhY2hQdWZmXCIsIFwiTmF2YWpvV2hpdGVcIiwgXCJNb2NjYXNpblwiLCBcIkJpc3F1ZVwiLCBcIk1pc3R5Um9zZVwiLCBcIkJsYW5jaGVkQWxtb25kXCIsIFwiUGFwYXlhV2hpcFwiLCBcIkxhdmVuZGVyQmx1c2hcIiwgXCJTZWFTaGVsbFwiLCBcIkNvcm5zaWxrXCIsIFwiTGVtb25DaGlmZm9uXCIsIFwiRmxvcmFsV2hpdGVcIiwgXCJTbm93XCIsIFwiWWVsbG93XCIsIFwiTGlnaHRZZWxsb3dcIlxuICAgICAgICBdLFxuXG4gICAgICAgIGZpbGVFeHRlbnNpb24gOiB7XG4gICAgICAgICAgICBcInJhc3RlclwiICAgIDogW1wiYm1wXCIsIFwiZ2lmXCIsIFwiZ3BsXCIsIFwiaWNvXCIsIFwianBlZ1wiLCBcInBzZFwiLCBcInBuZ1wiLCBcInBzcFwiLCBcInJhd1wiLCBcInRpZmZcIl0sXG4gICAgICAgICAgICBcInZlY3RvclwiICAgIDogW1wiM2R2XCIsIFwiYW1mXCIsIFwiYXdnXCIsIFwiYWlcIiwgXCJjZ21cIiwgXCJjZHJcIiwgXCJjbXhcIiwgXCJkeGZcIiwgXCJlMmRcIiwgXCJlZ3RcIiwgXCJlcHNcIiwgXCJmc1wiLCBcIm9kZ1wiLCBcInN2Z1wiLCBcInhhclwiXSxcbiAgICAgICAgICAgIFwiM2RcIiAgICAgICAgOiBbXCIzZG1mXCIsIFwiM2RtXCIsIFwiM21mXCIsIFwiM2RzXCIsIFwiYW44XCIsIFwiYW9pXCIsIFwiYmxlbmRcIiwgXCJjYWwzZFwiLCBcImNvYlwiLCBcImN0bVwiLCBcImlvYlwiLCBcImphc1wiLCBcIm1heFwiLCBcIm1iXCIsIFwibWR4XCIsIFwib2JqXCIsIFwieFwiLCBcIngzZFwiXSxcbiAgICAgICAgICAgIFwiZG9jdW1lbnRcIiAgOiBbXCJkb2NcIiwgXCJkb2N4XCIsIFwiZG90XCIsIFwiaHRtbFwiLCBcInhtbFwiLCBcIm9kdFwiLCBcIm9kbVwiLCBcIm90dFwiLCBcImNzdlwiLCBcInJ0ZlwiLCBcInRleFwiLCBcInhodG1sXCIsIFwieHBzXCJdXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9kbWZpbGlwZW5rby90aW1lem9uZXMuanNvbi9ibG9iL21hc3Rlci90aW1lem9uZXMuanNvblxuICAgICAgICB0aW1lem9uZXM6IFtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRGF0ZWxpbmUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJEU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTEyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTEyOjAwKSBJbnRlcm5hdGlvbmFsIERhdGUgTGluZSBXZXN0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrMTJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVVEMtMTFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVVwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMTEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMTE6MDApIENvb3JkaW5hdGVkIFVuaXZlcnNhbCBUaW1lLTExXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrMTFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvTWlkd2F5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL05pdWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvUGFnb19QYWdvXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSGF3YWlpYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJIU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTEwOjAwKSBIYXdhaWlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCsxMFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Ib25vbHVsdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Kb2huc3RvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9SYXJvdG9uZ2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvVGFoaXRpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQWxhc2thbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFLRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wOTowMCkgQWxhc2thXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQW5jaG9yYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0p1bmVhdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ob21lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1NpdGthXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1lha3V0YXRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJQYWNpZmljIFN0YW5kYXJkIFRpbWUgKE1leGljbylcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUERUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC03LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDg6MDApIEJhamEgQ2FsaWZvcm5pYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1NhbnRhX0lzYWJlbFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlBhY2lmaWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJQRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTcsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wODowMCkgUGFjaWZpYyBUaW1lIChVUyAmIENhbmFkYSlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9EYXdzb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTG9zX0FuZ2VsZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVGlqdWFuYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9WYW5jb3V2ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvV2hpdGVob3JzZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUFNUOFBEVFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVTIE1vdW50YWluIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVU1TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNzowMCkgQXJpem9uYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NyZXN0b25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRGF3c29uX0NyZWVrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0hlcm1vc2lsbG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUGhvZW5peFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCs3XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTW91bnRhaW4gU3RhbmRhcmQgVGltZSAoTWV4aWNvKVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNzowMCkgQ2hpaHVhaHVhLCBMYSBQYXosIE1hemF0bGFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2hpaHVhaHVhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hemF0bGFuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTW91bnRhaW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNzowMCkgTW91bnRhaW4gVGltZSAoVVMgJiBDYW5hZGEpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQm9pc2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2FtYnJpZGdlX0JheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9EZW52ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRWRtb250b25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW51dmlrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL09qaW5hZ2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvWWVsbG93a25pZmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIk1TVDdNRFRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIEFtZXJpY2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC02LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA2OjAwKSBDZW50cmFsIEFtZXJpY2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CZWxpemVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ29zdGFfUmljYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9FbF9TYWx2YWRvclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HdWF0ZW1hbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWFuYWd1YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9UZWd1Y2lnYWxwYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCs2XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0dhbGFwYWdvc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNjowMCkgQ2VudHJhbCBUaW1lIChVUyAmIENhbmFkYSlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DaGljYWdvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvS25veFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL1RlbGxfQ2l0eVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYXRhbW9yb3NcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWVub21pbmVlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05vcnRoX0Rha290YS9CZXVsYWhcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTm9ydGhfRGFrb3RhL0NlbnRlclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ob3J0aF9EYWtvdGEvTmV3X1NhbGVtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1JhaW55X1JpdmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Jhbmtpbl9JbmxldFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SZXNvbHV0ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9XaW5uaXBlZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQ1NUNkNEVFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgU3RhbmRhcmQgVGltZSAoTWV4aWNvKVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNjowMCkgR3VhZGFsYWphcmEsIE1leGljbyBDaXR5LCBNb250ZXJyZXlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CYWhpYV9CYW5kZXJhc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYW5jdW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWVyaWRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01leGljb19DaXR5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01vbnRlcnJleVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNhbmFkYSBDZW50cmFsIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0NTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNjowMCkgU2Fza2F0Y2hld2FuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmVnaW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N3aWZ0X0N1cnJlbnRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTQSBQYWNpZmljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU1BTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNTowMCkgQm9nb3RhLCBMaW1hLCBRdWl0b1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JvZ290YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYXltYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ29yYWxfSGFyYm91clwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9FaXJ1bmVwZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HdWF5YXF1aWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSmFtYWljYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9MaW1hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BhbmFtYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SaW9fQnJhbmNvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFYXN0ZXJuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDU6MDApIEVhc3Rlcm4gVGltZSAoVVMgJiBDYW5hZGEpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRGV0cm9pdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9IYXZhbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9QZXRlcnNidXJnXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvVmluY2VubmVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvV2luYW1hY1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JcWFsdWl0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0tlbnR1Y2t5L01vbnRpY2VsbG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTG91aXN2aWxsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Nb250cmVhbFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9OYXNzYXVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTmV3X1lvcmtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTmlwaWdvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9QYW5nbmlydHVuZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Qb3J0LWF1LVByaW5jZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9UaHVuZGVyX0JheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ub3JvbnRvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFU1Q1RURUXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVMgRWFzdGVybiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNTowMCkgSW5kaWFuYSAoRWFzdClcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL01hcmVuZ29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9WZXZheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hcG9saXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJWZW5lenVlbGEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJWU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDozMCkgQ2FyYWNhc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NhcmFjYXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJQYXJhZ3VheSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlBTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDowMCkgQXN1bmNpb25cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Bc3VuY2lvblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkF0bGFudGljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MDApIEF0bGFudGljIFRpbWUgKENhbmFkYSlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HbGFjZV9CYXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR29vc2VfQmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0hhbGlmYXhcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTW9uY3RvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9UaHVsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvQmVybXVkYVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgQnJhemlsaWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0JTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDowMCkgQ3VpYWJhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2FtcG9fR3JhbmRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0N1aWFiYVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNBIFdlc3Rlcm4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTV1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjAwKSBHZW9yZ2V0b3duLCBMYSBQYXosIE1hbmF1cywgU2FuIEp1YW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Bbmd1aWxsYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BbnRpZ3VhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FydWJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JhcmJhZG9zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JsYW5jLVNhYmxvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Cb2FfVmlzdGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ3VyYWNhb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Eb21pbmljYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HcmFuZF9UdXJrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0dyZW5hZGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3VhZGVsb3VwZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HdXlhbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvS3JhbGVuZGlqa1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9MYV9QYXpcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTG93ZXJfUHJpbmNlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYW5hdXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWFyaWdvdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYXJ0aW5pcXVlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01vbnRzZXJyYXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUG9ydF9vZl9TcGFpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Qb3J0b19WZWxob1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9QdWVydG9fUmljb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TYW50b19Eb21pbmdvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X0JhcnRoZWxlbXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfS2l0dHNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfTHVjaWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfVGhvbWFzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X1ZpbmNlbnRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVG9ydG9sYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCs0XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUGFjaWZpYyBTQSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlBTU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MDApIFNhbnRpYWdvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2FudGlhZ29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvUGFsbWVyXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTmV3Zm91bmRsYW5kIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTkRUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0yLjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzozMCkgTmV3Zm91bmRsYW5kXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfSm9obnNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFLiBTb3V0aCBBbWVyaWNhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRVNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIEJyYXNpbGlhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2FvX1BhdWxvXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXJnZW50aW5hIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBCdWVub3MgQWlyZXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvTGFfUmlvamFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1Jpb19HYWxsZWdvc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvU2FsdGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1Nhbl9KdWFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9TYW5fTHVpc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvVHVjdW1hblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvVXNodWFpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CdWVub3NfQWlyZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2F0YW1hcmNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NvcmRvYmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSnVqdXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWVuZG96YVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNBIEVhc3Rlcm4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTRVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBDYXllbm5lLCBGb3J0YWxlemFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmFndWFpbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmVsZW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2F5ZW5uZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Gb3J0YWxlemFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWFjZWlvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BhcmFtYXJpYm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmVjaWZlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1NhbnRhcmVtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL1JvdGhlcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL1N0YW5sZXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrM1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkdyZWVubGFuZCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkdEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBHcmVlbmxhbmRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Hb2R0aGFiXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTW9udGV2aWRlbyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgTW9udGV2aWRlb1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01vbnRldmlkZW9cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJCYWhpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkJTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgU2FsdmFkb3JcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CYWhpYVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVUQy0wMlwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0yLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAyOjAwKSBDb29yZGluYXRlZCBVbml2ZXJzYWwgVGltZS0wMlwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05vcm9uaGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL1NvdXRoX0dlb3JnaWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrMlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1pZC1BdGxhbnRpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1EVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAyOjAwKSBNaWQtQXRsYW50aWMgLSBPbGRcIlxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXpvcmVzIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMTowMCkgQXpvcmVzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2NvcmVzYnlzdW5kXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9Bem9yZXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDYXBlIFZlcmRlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ1ZTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMTowMCkgQ2FwZSBWZXJkZSBJcy5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvQ2FwZV9WZXJkZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCsxXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTW9yb2NjbyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1EVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMpIENhc2FibGFuY2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Nhc2FibGFuY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9FbF9BYWl1blwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVUQ1wiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDVVRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQykgQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9EYW5tYXJrc2hhdm5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJHTVQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJHRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKSBEdWJsaW4sIEVkaW5idXJnaCwgTGlzYm9uLCBMb25kb25cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvQ2FuYXJ5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9GYWVyb2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL01hZGVpcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9EdWJsaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9HdWVybnNleVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0lzbGVfb2ZfTWFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvSmVyc2V5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTGlzYm9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTG9uZG9uXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiR3JlZW53aWNoIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiR1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMpIE1vbnJvdmlhLCBSZXlramF2aWtcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0FiaWRqYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9BY2NyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0JhbWFrb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Jhbmp1bFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Jpc3NhdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0NvbmFrcnlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9EYWthclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0ZyZWV0b3duXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTG9tZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01vbnJvdmlhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTm91YWtjaG90dFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL091YWdhZG91Z291XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvU2FvX1RvbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL1JleWtqYXZpa1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvU3RfSGVsZW5hXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVy4gRXVyb3BlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiV0VEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIEFtc3RlcmRhbSwgQmVybGluLCBCZXJuLCBSb21lLCBTdG9ja2hvbG0sIFZpZW5uYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBcmN0aWMvTG9uZ3llYXJieWVuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQW1zdGVyZGFtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQW5kb3JyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0JlcmxpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0J1c2luZ2VuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvR2licmFsdGFyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTHV4ZW1ib3VyZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01hbHRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTW9uYWNvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvT3Nsb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1JvbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9TYW5fTWFyaW5vXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU3RvY2tob2xtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVmFkdXpcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9WYXRpY2FuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVmllbm5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvWnVyaWNoXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBFdXJvcGUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgQmVsZ3JhZGUsIEJyYXRpc2xhdmEsIEJ1ZGFwZXN0LCBManVibGphbmEsIFByYWd1ZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQmVsZ3JhZGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CcmF0aXNsYXZhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQnVkYXBlc3RcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9ManVibGphbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Qb2Rnb3JpY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9QcmFndWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9UaXJhbmVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJSb21hbmNlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUkRUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgQnJ1c3NlbHMsIENvcGVuaGFnZW4sIE1hZHJpZCwgUGFyaXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0NldXRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQnJ1c3NlbHNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Db3BlbmhhZ2VuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTWFkcmlkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvUGFyaXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0VEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIFNhcmFqZXZvLCBTa29wamUsIFdhcnNhdywgWmFncmViXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9TYXJhamV2b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1Nrb3BqZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1dhcnNhd1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1phZ3JlYlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlcuIENlbnRyYWwgQWZyaWNhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiV0NBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgV2VzdCBDZW50cmFsIEFmcmljYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQWxnaWVyc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Jhbmd1aVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0JyYXp6YXZpbGxlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRG91YWxhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvS2luc2hhc2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9MYWdvc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0xpYnJldmlsbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9MdWFuZGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9NYWxhYm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9OZGphbWVuYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL05pYW1leVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL1BvcnRvLU5vdm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9UdW5pc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0xXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTmFtaWJpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBXaW5kaG9la1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvV2luZGhvZWtcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJHVEIgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJHRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBBdGhlbnMsIEJ1Y2hhcmVzdFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL05pY29zaWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9BdGhlbnNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CdWNoYXJlc3RcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9DaGlzaW5hdVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1pZGRsZSBFYXN0IFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTUVEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEJlaXJ1dFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0JlaXJ1dFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkVneXB0IFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIENhaXJvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9DYWlyb1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlN5cmlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgRGFtYXNjdXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9EYW1hc2N1c1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkUuIEV1cm9wZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBFLiBFdXJvcGVcIlxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU291dGggQWZyaWNhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBIYXJhcmUsIFByZXRvcmlhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CbGFudHlyZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0J1anVtYnVyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0dhYm9yb25lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvSGFyYXJlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvSm9oYW5uZXNidXJnXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvS2lnYWxpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTHVidW1iYXNoaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0x1c2FrYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01hcHV0b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01hc2VydVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01iYWJhbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkZMRSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkZEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEhlbHNpbmtpLCBLeWl2LCBSaWdhLCBTb2ZpYSwgVGFsbGlubiwgVmlsbml1c1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvSGVsc2lua2lcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9LaWV2XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTWFyaWVoYW1uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvUmlnYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1NvZmlhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVGFsbGlublwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1V6aGdvcm9kXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVmlsbml1c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1phcG9yb3poeWVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJUdXJrZXkgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJURFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBJc3RhbmJ1bFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvSXN0YW5idWxcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJJc3JhZWwgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJKRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBKZXJ1c2FsZW1cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9KZXJ1c2FsZW1cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJMaWJ5YSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkxTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBUcmlwb2xpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Ucmlwb2xpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSm9yZGFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiSlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MDApIEFtbWFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQW1tYW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBcmFiaWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzowMCkgQmFnaGRhZFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0JhZ2hkYWRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJLYWxpbmluZ3JhZCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIktTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjAwKSBLYWxpbmluZ3JhZCwgTWluc2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0thbGluaW5ncmFkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTWluc2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBcmFiIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MDApIEt1d2FpdCwgUml5YWRoXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQWRlblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CYWhyYWluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0t1d2FpdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9RYXRhclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9SaXlhZGhcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFLiBBZnJpY2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MDApIE5haXJvYmlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0FkZGlzX0FiYWJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQXNtZXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRGFyX2VzX1NhbGFhbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0RqaWJvdXRpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvSnViYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0thbXBhbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9LaGFydG91bVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01vZ2FkaXNodVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL05haXJvYmlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvU3lvd2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtM1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0FudGFuYW5hcml2b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0NvbW9yb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL01heW90dGVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJJcmFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiSURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjMwKSBUZWhyYW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9UZWhyYW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBcmFiaWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIEFidSBEaGFiaSwgTXVzY2F0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvRHViYWlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTXVzY2F0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBemVyYmFpamFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgQmFrdVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0Jha3VcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJSdXNzaWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIE1vc2NvdywgU3QuIFBldGVyc2J1cmcsIFZvbGdvZ3JhZFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTW9zY293XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU2FtYXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU2ltZmVyb3BvbFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ZvbGdvZ3JhZFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1hdXJpdGl1cyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBQb3J0IExvdWlzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9NYWhlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vTWF1cml0aXVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vUmV1bmlvblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkdlb3JnaWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiR1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIFRiaWxpc2lcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9UYmlsaXNpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2F1Y2FzdXMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgWWVyZXZhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1llcmV2YW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBZmdoYW5pc3RhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MzApIEthYnVsXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS2FidWxcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJXZXN0IEFzaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJXQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDU6MDApIEFzaGdhYmF0LCBUYXNoa2VudFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL01hd3NvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BcXRhdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BcXRvYmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQXNoZ2FiYXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvRHVzaGFuYmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvT3JhbFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TYW1hcmthbmRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVGFzaGtlbnRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtNVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0tlcmd1ZWxlblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL01hbGRpdmVzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUGFraXN0YW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJQU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNTowMCkgSXNsYW1hYmFkLCBLYXJhY2hpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS2FyYWNoaVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkluZGlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiSVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNTozMCkgQ2hlbm5haSwgS29sa2F0YSwgTXVtYmFpLCBOZXcgRGVsaGlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9DYWxjdXR0YVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNyaSBMYW5rYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNMU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNS41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA1OjMwKSBTcmkgSmF5YXdhcmRlbmVwdXJhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQ29sb21ib1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5lcGFsIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUuNzUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDU6NDUpIEthdGhtYW5kdVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0thdG1hbmR1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBBc2lhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA2LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA2OjAwKSBBc3RhbmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9Wb3N0b2tcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQWxtYXR5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0Jpc2hrZWtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUXl6eWxvcmRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1VydW1xaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC02XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vQ2hhZ29zXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQmFuZ2xhZGVzaCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkJTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA2LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA2OjAwKSBEaGFrYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0RoYWthXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1RoaW1waHVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFa2F0ZXJpbmJ1cmcgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNjowMCkgRWthdGVyaW5idXJnXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvWWVrYXRlcmluYnVyZ1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk15YW5tYXIgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNi41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA2OjMwKSBZYW5nb24gKFJhbmdvb24pXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUmFuZ29vblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0NvY29zXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU0UgQXNpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNzowMCkgQmFuZ2tvaywgSGFub2ksIEpha2FydGFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9EYXZpc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CYW5na29rXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0hvdmRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSmFrYXJ0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9QaG5vbV9QZW5oXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1BvbnRpYW5ha1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TYWlnb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVmllbnRpYW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9DaHJpc3RtYXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOLiBDZW50cmFsIEFzaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOQ0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA3LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA3OjAwKSBOb3Zvc2liaXJza1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL05vdm9rdXpuZXRza1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Ob3Zvc2liaXJza1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9PbXNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2hpbmEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgQmVpamluZywgQ2hvbmdxaW5nLCBIb25nIEtvbmcsIFVydW1xaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0hvbmdfS29uZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9NYWNhdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TaGFuZ2hhaVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5vcnRoIEFzaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIEtyYXNub3lhcnNrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS3Jhc25veWFyc2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTaW5nYXBvcmUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIEt1YWxhIEx1bXB1ciwgU2luZ2Fwb3JlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQnJ1bmVpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0t1YWxhX0x1bXB1clwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LdWNoaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL01ha2Fzc2FyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL01hbmlsYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TaW5nYXBvcmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtOFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlcuIEF1c3RyYWxpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIldBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgUGVydGhcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9DYXNleVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL1BlcnRoXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVGFpcGVpIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIFRhaXBlaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1RhaXBlaVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVsYWFuYmFhdGFyIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIFVsYWFuYmFhdGFyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQ2hvaWJhbHNhblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9VbGFhbmJhYXRhclwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5vcnRoIEFzaWEgRWFzdCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5BRVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDksXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDk6MDApIElya3V0c2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Jcmt1dHNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVG9reW8gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJUU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswOTowMCkgT3Nha2EsIFNhcHBvcm8sIFRva3lvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvRGlsaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9KYXlhcHVyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Ub2t5b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC05XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1BhbGF1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiS29yZWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJLU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswOTowMCkgU2VvdWxcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9QeW9uZ3lhbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2VvdWxcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW4uIEF1c3RyYWxpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOS41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA5OjMwKSBBZGVsYWlkZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvQWRlbGFpZGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9Ccm9rZW5fSGlsbFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFVUyBDZW50cmFsIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQUNTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA5LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDk6MzApIERhcndpblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvRGFyd2luXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRS4gQXVzdHJhbGlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRUFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMDowMCkgQnJpc2JhbmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0JyaXNiYW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvTGluZGVtYW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBVVMgRWFzdGVybiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFFU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTA6MDApIENhbmJlcnJhLCBNZWxib3VybmUsIFN5ZG5leVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvTWVsYm91cm5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvU3lkbmV5XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiV2VzdCBQYWNpZmljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiV1BTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMDowMCkgR3VhbSwgUG9ydCBNb3Jlc2J5XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvRHVtb250RFVydmlsbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMTBcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvR3VhbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Qb3J0X01vcmVzYnlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvU2FpcGFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1RydWtcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJUYXNtYW5pYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlRTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMDowMCkgSG9iYXJ0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9DdXJyaWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9Ib2JhcnRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJZYWt1dHNrIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiWVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEwOjAwKSBZYWt1dHNrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQ2hpdGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS2hhbmR5Z2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvWWFrdXRza1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgUGFjaWZpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNQU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTE6MDApIFNvbG9tb24gSXMuLCBOZXcgQ2FsZWRvbmlhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvTWFjcXVhcmllXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTExXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0VmYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0d1YWRhbGNhbmFsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0tvc3JhZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Ob3VtZWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvUG9uYXBlXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVmxhZGl2b3N0b2sgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJWU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTE6MDApIFZsYWRpdm9zdG9rXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2FraGFsaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVXN0LU5lcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVmxhZGl2b3N0b2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOZXcgWmVhbGFuZCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5aU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTI6MDApIEF1Y2tsYW5kLCBXZWxsaW5ndG9uXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvTWNNdXJkb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9BdWNrbGFuZFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVUQysxMlwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEyOjAwKSBDb29yZGluYXRlZCBVbml2ZXJzYWwgVGltZSsxMlwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTEyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0Z1bmFmdXRpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0t3YWphbGVpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9NYWp1cm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvTmF1cnVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvVGFyYXdhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1dha2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvV2FsbGlzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRmlqaSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkZTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMjowMCkgRmlqaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0ZpamlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNYWdhZGFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEyOjAwKSBNYWdhZGFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQW5hZHlyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0thbWNoYXRrYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9NYWdhZGFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1NyZWRuZWtvbHltc2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJLYW1jaGF0a2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJLRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMjowMCkgUGV0cm9wYXZsb3Zzay1LYW1jaGF0c2t5IC0gT2xkXCJcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlRvbmdhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEzOjAwKSBOdWt1J2Fsb2ZhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMTNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvRW5kZXJidXJ5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0Zha2FvZm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvVG9uZ2F0YXB1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU2Ftb2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTM6MDApIFNhbW9hXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvQXBpYVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAvL0xpc3Qgc291cmNlOiBodHRwOi8vYW5zd2Vycy5nb29nbGUuY29tL2Fuc3dlcnMvdGhyZWFkdmlldy9pZC81ODkzMTIuaHRtbFxuICAgICAgICBwcm9mZXNzaW9uOiBbXG4gICAgICAgICAgICBcIkFpcmxpbmUgUGlsb3RcIixcbiAgICAgICAgICAgIFwiQWNhZGVtaWMgVGVhbVwiLFxuICAgICAgICAgICAgXCJBY2NvdW50YW50XCIsXG4gICAgICAgICAgICBcIkFjY291bnQgRXhlY3V0aXZlXCIsXG4gICAgICAgICAgICBcIkFjdG9yXCIsXG4gICAgICAgICAgICBcIkFjdHVhcnlcIixcbiAgICAgICAgICAgIFwiQWNxdWlzaXRpb24gQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJBZG1pbmlzdHJhdGl2ZSBBc3N0LlwiLFxuICAgICAgICAgICAgXCJBZG1pbmlzdHJhdGl2ZSBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiQWR2ZXJ0aXNpbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiQWVyb3NwYWNlIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkFnZW50XCIsXG4gICAgICAgICAgICBcIkFncmljdWx0dXJhbCBJbnNwZWN0b3JcIixcbiAgICAgICAgICAgIFwiQWdyaWN1bHR1cmFsIFNjaWVudGlzdFwiLFxuICAgICAgICAgICAgXCJBaXIgVHJhZmZpYyBDb250cm9sbGVyXCIsXG4gICAgICAgICAgICBcIkFuaW1hbCBUcmFpbmVyXCIsXG4gICAgICAgICAgICBcIkFudGhyb3BvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkFwcHJhaXNlclwiLFxuICAgICAgICAgICAgXCJBcmNoaXRlY3RcIixcbiAgICAgICAgICAgIFwiQXJ0IERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkFydGlzdFwiLFxuICAgICAgICAgICAgXCJBc3Ryb25vbWVyXCIsXG4gICAgICAgICAgICBcIkF0aGxldGljIENvYWNoXCIsXG4gICAgICAgICAgICBcIkF1ZGl0b3JcIixcbiAgICAgICAgICAgIFwiQXV0aG9yXCIsXG4gICAgICAgICAgICBcIkJha2VyXCIsXG4gICAgICAgICAgICBcIkJhbmtlclwiLFxuICAgICAgICAgICAgXCJCYW5rcnVwdGN5IEF0dG9ybmV5XCIsXG4gICAgICAgICAgICBcIkJlbmVmaXRzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQmlvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkJpby1mZWVkYmFjayBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIkJpb21lZGljYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQmlvdGVjaG5pY2FsIFJlc2VhcmNoZXJcIixcbiAgICAgICAgICAgIFwiQnJvYWRjYXN0ZXJcIixcbiAgICAgICAgICAgIFwiQnJva2VyXCIsXG4gICAgICAgICAgICBcIkJ1aWxkaW5nIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQnVpbGRpbmcgQ29udHJhY3RvclwiLFxuICAgICAgICAgICAgXCJCdWlsZGluZyBJbnNwZWN0b3JcIixcbiAgICAgICAgICAgIFwiQnVzaW5lc3MgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJCdXNpbmVzcyBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIkJ1c2luZXNzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQnV5ZXJcIixcbiAgICAgICAgICAgIFwiQ2FsbCBDZW50ZXIgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDYXJlZXIgQ291bnNlbG9yXCIsXG4gICAgICAgICAgICBcIkNhc2ggTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDZXJhbWljIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNoaWVmIEV4ZWN1dGl2ZSBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkNoaWVmIE9wZXJhdGlvbiBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkNoZWZcIixcbiAgICAgICAgICAgIFwiQ2hlbWljYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ2hlbWlzdFwiLFxuICAgICAgICAgICAgXCJDaGlsZCBDYXJlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2hpZWYgTWVkaWNhbCBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkNoaXJvcHJhY3RvclwiLFxuICAgICAgICAgICAgXCJDaW5lbWF0b2dyYXBoZXJcIixcbiAgICAgICAgICAgIFwiQ2l0eSBIb3VzaW5nIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2l0eSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNpdmlsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNsYWltcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNsaW5pY2FsIFJlc2VhcmNoIEFzc2lzdGFudFwiLFxuICAgICAgICAgICAgXCJDb2xsZWN0aW9ucyBNYW5hZ2VyLlwiLFxuICAgICAgICAgICAgXCJDb21wbGlhbmNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ29tcHRyb2xsZXJcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDb21tZXJjaWFsIEFydGlzdFwiLFxuICAgICAgICAgICAgXCJDb21tdW5pY2F0aW9ucyBBZmZhaXJzIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkNvbW11bmljYXRpb25zIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkNvbW11bmljYXRpb25zIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNvbXBlbnNhdGlvbiBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIFByb2dyYW1tZXJcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgT3BzLiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIE9wZXJhdG9yXCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIEdyYXBoaWNzIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiQ29uc3RydWN0aW9uIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNvbnN0cnVjdGlvbiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNvbnN1bHRhbnRcIixcbiAgICAgICAgICAgIFwiQ29uc3VtZXIgUmVsYXRpb25zIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ29udHJhY3QgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJDb3B5cmlnaHQgQXR0b3JuZXlcIixcbiAgICAgICAgICAgIFwiQ29weXdyaXRlclwiLFxuICAgICAgICAgICAgXCJDb3Jwb3JhdGUgUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJDb3JyZWN0aW9ucyBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkNvc21ldG9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiQ3JlZGl0IEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiQ3J1aXNlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkNoaWVmIEluZm9ybWF0aW9uIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ2hpZWYgVGVjaG5vbG9neSBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkN1c3RvbWVyIFNlcnZpY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDcnlwdG9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiRGFuY2VyXCIsXG4gICAgICAgICAgICBcIkRhdGEgU2VjdXJpdHkgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJEYXRhYmFzZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkRheSBDYXJlIEluc3RydWN0b3JcIixcbiAgICAgICAgICAgIFwiRGVudGlzdFwiLFxuICAgICAgICAgICAgXCJEZXNpZ25lclwiLFxuICAgICAgICAgICAgXCJEZXNpZ24gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRGVza3RvcCBQdWJsaXNoZXJcIixcbiAgICAgICAgICAgIFwiRGV2ZWxvcGVyXCIsXG4gICAgICAgICAgICBcIkRldmVsb3BtZW50IE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiRGlhbW9uZCBNZXJjaGFudFwiLFxuICAgICAgICAgICAgXCJEaWV0aXRpYW5cIixcbiAgICAgICAgICAgIFwiRGlyZWN0IE1hcmtldGVyXCIsXG4gICAgICAgICAgICBcIkRpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkRpc3RyaWJ1dGlvbiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkRpdmVyc2l0eSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkVjb25vbWlzdFwiLFxuICAgICAgICAgICAgXCJFRU8gQ29tcGxpYW5jZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkVkaXRvclwiLFxuICAgICAgICAgICAgXCJFZHVjYXRpb24gQWRtaW5hdG9yXCIsXG4gICAgICAgICAgICBcIkVsZWN0cmljYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRWxlY3RybyBPcHRpY2FsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkVsZWN0cm9uaWNzIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkVtYmFzc3kgTWFuYWdlbWVudFwiLFxuICAgICAgICAgICAgXCJFbXBsb3ltZW50IEFnZW50XCIsXG4gICAgICAgICAgICBcIkVuZ2luZWVyIFRlY2huaWNpYW5cIixcbiAgICAgICAgICAgIFwiRW50cmVwcmVuZXVyXCIsXG4gICAgICAgICAgICBcIkVudmlyb25tZW50YWwgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJFbnZpcm9ubWVudGFsIEF0dG9ybmV5XCIsXG4gICAgICAgICAgICBcIkVudmlyb25tZW50YWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRW52aXJvbm1lbnRhbCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIkVzY3JvdyBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkVzdGltYXRvclwiLFxuICAgICAgICAgICAgXCJFeGVjdXRpdmUgQXNzaXN0YW50XCIsXG4gICAgICAgICAgICBcIkV4ZWN1dGl2ZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJFeGVjdXRpdmUgUmVjcnVpdGVyXCIsXG4gICAgICAgICAgICBcIkZhY2lsaXRpZXMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJGYW1pbHkgQ291bnNlbG9yXCIsXG4gICAgICAgICAgICBcIkZhc2hpb24gRXZlbnRzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRmFzaGlvbiBNZXJjaGFuZGlzZXJcIixcbiAgICAgICAgICAgIFwiRmFzdCBGb29kIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRmlsbSBQcm9kdWNlclwiLFxuICAgICAgICAgICAgXCJGaWxtIFByb2R1Y3Rpb24gQXNzaXN0YW50XCIsXG4gICAgICAgICAgICBcIkZpbmFuY2lhbCBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkZpbmFuY2lhbCBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIkZpbmFuY2llclwiLFxuICAgICAgICAgICAgXCJGaW5lIEFydGlzdFwiLFxuICAgICAgICAgICAgXCJXaWxkbGlmZSBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIkZpdG5lc3MgQ29uc3VsdGFudFwiLFxuICAgICAgICAgICAgXCJGbGlnaHQgQXR0ZW5kYW50XCIsXG4gICAgICAgICAgICBcIkZsaWdodCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJGbG9yYWwgRGVzaWduZXJcIixcbiAgICAgICAgICAgIFwiRm9vZCAmIEJldmVyYWdlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkZvb2QgU2VydmljZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkZvcmVzdHJ5IFRlY2huaWNpYW5cIixcbiAgICAgICAgICAgIFwiRnJhbmNoaXNlIE1hbmFnZW1lbnRcIixcbiAgICAgICAgICAgIFwiRnJhbmNoaXNlIFNhbGVzXCIsXG4gICAgICAgICAgICBcIkZyYXVkIEludmVzdGlnYXRvclwiLFxuICAgICAgICAgICAgXCJGcmVlbGFuY2UgV3JpdGVyXCIsXG4gICAgICAgICAgICBcIkZ1bmQgUmFpc2VyXCIsXG4gICAgICAgICAgICBcIkdlbmVyYWwgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJHZW9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiR2VuZXJhbCBDb3Vuc2VsXCIsXG4gICAgICAgICAgICBcIkdlcmlhdHJpYyBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIkdlcm9udG9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiR2xhbW91ciBQaG90b2dyYXBoZXJcIixcbiAgICAgICAgICAgIFwiR29sZiBDbHViIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiR291cm1ldCBDaGVmXCIsXG4gICAgICAgICAgICBcIkdyYXBoaWMgRGVzaWduZXJcIixcbiAgICAgICAgICAgIFwiR3JvdW5kcyBLZWVwZXJcIixcbiAgICAgICAgICAgIFwiSGF6YXJkb3VzIFdhc3RlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSGVhbHRoIENhcmUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJIZWFsdGggVGhlcmFwaXN0XCIsXG4gICAgICAgICAgICBcIkhlYWx0aCBTZXJ2aWNlIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiSGVhcmluZyBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkhvbWUgRWNvbm9taXN0XCIsXG4gICAgICAgICAgICBcIkhvcnRpY3VsdHVyaXN0XCIsXG4gICAgICAgICAgICBcIkhvc3BpdGFsIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiSG90ZWwgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJIdW1hbiBSZXNvdXJjZXMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJJbXBvcnRlclwiLFxuICAgICAgICAgICAgXCJJbmR1c3RyaWFsIERlc2lnbmVyXCIsXG4gICAgICAgICAgICBcIkluZHVzdHJpYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiSW5mb3JtYXRpb24gRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiSW5zaWRlIFNhbGVzXCIsXG4gICAgICAgICAgICBcIkluc3VyYW5jZSBBZGp1c3RlclwiLFxuICAgICAgICAgICAgXCJJbnRlcmlvciBEZWNvcmF0b3JcIixcbiAgICAgICAgICAgIFwiSW50ZXJuYWwgQ29udHJvbHMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiSW50ZXJuYXRpb25hbCBBY2N0LlwiLFxuICAgICAgICAgICAgXCJJbnRlcm5hdGlvbmFsIENvdXJpZXJcIixcbiAgICAgICAgICAgIFwiSW50ZXJuYXRpb25hbCBMYXd5ZXJcIixcbiAgICAgICAgICAgIFwiSW50ZXJwcmV0ZXJcIixcbiAgICAgICAgICAgIFwiSW52ZXN0aWdhdG9yXCIsXG4gICAgICAgICAgICBcIkludmVzdG1lbnQgQmFua2VyXCIsXG4gICAgICAgICAgICBcIkludmVzdG1lbnQgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJJVCBBcmNoaXRlY3RcIixcbiAgICAgICAgICAgIFwiSVQgUHJvamVjdCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIklUIFN5c3RlbXMgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJKZXdlbGVyXCIsXG4gICAgICAgICAgICBcIkpvaW50IFZlbnR1cmUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJKb3VybmFsaXN0XCIsXG4gICAgICAgICAgICBcIkxhYm9yIE5lZ290aWF0b3JcIixcbiAgICAgICAgICAgIFwiTGFib3IgT3JnYW5pemVyXCIsXG4gICAgICAgICAgICBcIkxhYm9yIFJlbGF0aW9ucyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkxhYiBTZXJ2aWNlcyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJMYWIgVGVjaG5pY2lhblwiLFxuICAgICAgICAgICAgXCJMYW5kIERldmVsb3BlclwiLFxuICAgICAgICAgICAgXCJMYW5kc2NhcGUgQXJjaGl0ZWN0XCIsXG4gICAgICAgICAgICBcIkxhdyBFbmZvcmNlbWVudCBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkxhd3llclwiLFxuICAgICAgICAgICAgXCJMZWFkIFNvZnR3YXJlIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkxlYWQgU29mdHdhcmUgVGVzdCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJMZWFzaW5nIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTGVnYWwgU2VjcmV0YXJ5XCIsXG4gICAgICAgICAgICBcIkxpYnJhcnkgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJMaXRpZ2F0aW9uIEF0dG9ybmV5XCIsXG4gICAgICAgICAgICBcIkxvYW4gT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJMb2JieWlzdFwiLFxuICAgICAgICAgICAgXCJMb2dpc3RpY3MgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJNYWludGVuYW5jZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk1hbmFnZW1lbnQgQ29uc3VsdGFudFwiLFxuICAgICAgICAgICAgXCJNYW5hZ2VkIENhcmUgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTWFuYWdpbmcgUGFydG5lclwiLFxuICAgICAgICAgICAgXCJNYW51ZmFjdHVyaW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk1hbnBvd2VyIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiTWFyaW5lIEJpb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJNYXJrZXQgUmVzLiBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIk1hcmtldGluZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJNYXRlcmlhbHMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJNYXRoZW1hdGljaWFuXCIsXG4gICAgICAgICAgICBcIk1lbWJlcnNoaXAgQ2hhaXJtYW5cIixcbiAgICAgICAgICAgIFwiTWVjaGFuaWNcIixcbiAgICAgICAgICAgIFwiTWVjaGFuaWNhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJNZWRpYSBCdXllclwiLFxuICAgICAgICAgICAgXCJNZWRpY2FsIEludmVzdG9yXCIsXG4gICAgICAgICAgICBcIk1lZGljYWwgU2VjcmV0YXJ5XCIsXG4gICAgICAgICAgICBcIk1lZGljYWwgVGVjaG5pY2lhblwiLFxuICAgICAgICAgICAgXCJNZW50YWwgSGVhbHRoIENvdW5zZWxvclwiLFxuICAgICAgICAgICAgXCJNZXJjaGFuZGlzZXJcIixcbiAgICAgICAgICAgIFwiTWV0YWxsdXJnaWNhbCBFbmdpbmVlcmluZ1wiLFxuICAgICAgICAgICAgXCJNZXRlb3JvbG9naXN0XCIsXG4gICAgICAgICAgICBcIk1pY3JvYmlvbG9naXN0XCIsXG4gICAgICAgICAgICBcIk1JUyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk1vdGlvbiBQaWN0dXJlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk11bHRpbWVkaWEgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTXVzaWNpYW5cIixcbiAgICAgICAgICAgIFwiTmV0d29yayBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIk5ldHdvcmsgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJOZXR3b3JrIE9wZXJhdG9yXCIsXG4gICAgICAgICAgICBcIk5ldyBQcm9kdWN0IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTm92ZWxpc3RcIixcbiAgICAgICAgICAgIFwiTnVjbGVhciBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJOdWNsZWFyIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiTnV0cml0aW9uaXN0XCIsXG4gICAgICAgICAgICBcIk51cnNpbmcgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJPY2N1cGF0aW9uYWwgVGhlcmFwaXN0XCIsXG4gICAgICAgICAgICBcIk9jZWFub2dyYXBoZXJcIixcbiAgICAgICAgICAgIFwiT2ZmaWNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiT3BlcmF0aW9ucyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk9wZXJhdGlvbnMgUmVzZWFyY2ggRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiT3B0aWNhbCBUZWNobmljaWFuXCIsXG4gICAgICAgICAgICBcIk9wdG9tZXRyaXN0XCIsXG4gICAgICAgICAgICBcIk9yZ2FuaXphdGlvbmFsIERldmVsb3BtZW50IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiT3V0cGxhY2VtZW50IFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUGFyYWxlZ2FsXCIsXG4gICAgICAgICAgICBcIlBhcmsgUmFuZ2VyXCIsXG4gICAgICAgICAgICBcIlBhdGVudCBBdHRvcm5leVwiLFxuICAgICAgICAgICAgXCJQYXlyb2xsIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUGVyc29ubmVsIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUGV0cm9sZXVtIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlBoYXJtYWNpc3RcIixcbiAgICAgICAgICAgIFwiUGhvdG9ncmFwaGVyXCIsXG4gICAgICAgICAgICBcIlBoeXNpY2FsIFRoZXJhcGlzdFwiLFxuICAgICAgICAgICAgXCJQaHlzaWNpYW5cIixcbiAgICAgICAgICAgIFwiUGh5c2ljaWFuIEFzc2lzdGFudFwiLFxuICAgICAgICAgICAgXCJQaHlzaWNpc3RcIixcbiAgICAgICAgICAgIFwiUGxhbm5pbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiUG9kaWF0cmlzdFwiLFxuICAgICAgICAgICAgXCJQb2xpdGljYWwgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJQb2xpdGljYWwgU2NpZW50aXN0XCIsXG4gICAgICAgICAgICBcIlBvbGl0aWNpYW5cIixcbiAgICAgICAgICAgIFwiUG9ydGZvbGlvIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUHJlc2Nob29sIE1hbmFnZW1lbnRcIixcbiAgICAgICAgICAgIFwiUHJlc2Nob29sIFRlYWNoZXJcIixcbiAgICAgICAgICAgIFwiUHJpbmNpcGFsXCIsXG4gICAgICAgICAgICBcIlByaXZhdGUgQmFua2VyXCIsXG4gICAgICAgICAgICBcIlByaXZhdGUgSW52ZXN0aWdhdG9yXCIsXG4gICAgICAgICAgICBcIlByb2JhdGlvbiBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIlByb2Nlc3MgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUHJvZHVjZXJcIixcbiAgICAgICAgICAgIFwiUHJvZHVjdCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlByb2R1Y3QgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUHJvZHVjdGlvbiBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJQcm9kdWN0aW9uIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiUHJvZmVzc2lvbmFsIEF0aGxldGVcIixcbiAgICAgICAgICAgIFwiUHJvZmVzc2lvbmFsIENvYWNoXCIsXG4gICAgICAgICAgICBcIlByb2Zlc3NvclwiLFxuICAgICAgICAgICAgXCJQcm9qZWN0IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlByb2plY3QgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJQcm9ncmFtIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUHJvcGVydHkgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJQdWJsaWMgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJQdWJsaWMgU2FmZXR5IERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlBSIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUHVibGlzaGVyXCIsXG4gICAgICAgICAgICBcIlB1cmNoYXNpbmcgQWdlbnRcIixcbiAgICAgICAgICAgIFwiUHVibGlzaGluZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJRdWFsaXR5IEFzc3VyYW5jZSBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlF1YWxpdHkgQ29udHJvbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJRdWFsaXR5IENvbnRyb2wgSW5zcGVjdG9yXCIsXG4gICAgICAgICAgICBcIlJhZGlvbG9neSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlJhaWxyb2FkIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlJlYWwgRXN0YXRlIEJyb2tlclwiLFxuICAgICAgICAgICAgXCJSZWNyZWF0aW9uYWwgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiUmVjcnVpdGVyXCIsXG4gICAgICAgICAgICBcIlJlZGV2ZWxvcG1lbnQgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJSZWd1bGF0b3J5IEFmZmFpcnMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJSZWdpc3RlcmVkIE51cnNlXCIsXG4gICAgICAgICAgICBcIlJlaGFiaWxpdGF0aW9uIENvdW5zZWxvclwiLFxuICAgICAgICAgICAgXCJSZWxvY2F0aW9uIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUmVwb3J0ZXJcIixcbiAgICAgICAgICAgIFwiUmVzZWFyY2ggU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJSZXN0YXVyYW50IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUmV0YWlsIFN0b3JlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUmlzayBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIlNhZmV0eSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTYWxlcyBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTYWxlcyBUcmFpbmVyXCIsXG4gICAgICAgICAgICBcIlNhbGVzIFByb21vdGlvbiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlNhbGVzIFJlcHJlc2VudGF0aXZlXCIsXG4gICAgICAgICAgICBcIlNhbGVzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU2VydmljZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlNhbml0YXRpb24gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU2NpZW50aWZpYyBQcm9ncmFtbWVyXCIsXG4gICAgICAgICAgICBcIlNjaWVudGlmaWMgV3JpdGVyXCIsXG4gICAgICAgICAgICBcIlNlY3VyaXRpZXMgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJTZWN1cml0eSBDb25zdWx0YW50XCIsXG4gICAgICAgICAgICBcIlNlY3VyaXR5IERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlNlbWluYXIgUHJlc2VudGVyXCIsXG4gICAgICAgICAgICBcIlNoaXAncyBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIlNpbmdlclwiLFxuICAgICAgICAgICAgXCJTb2NpYWwgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU29jaWFsIFByb2dyYW0gUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJTb2NpYWwgUmVzZWFyY2hcIixcbiAgICAgICAgICAgIFwiU29jaWFsIFNjaWVudGlzdFwiLFxuICAgICAgICAgICAgXCJTb2NpYWwgV29ya2VyXCIsXG4gICAgICAgICAgICBcIlNvY2lvbG9naXN0XCIsXG4gICAgICAgICAgICBcIlNvZnR3YXJlIERldmVsb3BlclwiLFxuICAgICAgICAgICAgXCJTb2Z0d2FyZSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTb2Z0d2FyZSBUZXN0IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlNvaWwgU2NpZW50aXN0XCIsXG4gICAgICAgICAgICBcIlNwZWNpYWwgRXZlbnRzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU3BlY2lhbCBFZHVjYXRpb24gVGVhY2hlclwiLFxuICAgICAgICAgICAgXCJTcGVjaWFsIFByb2plY3RzIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlNwZWVjaCBQYXRob2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJTcGVlY2ggV3JpdGVyXCIsXG4gICAgICAgICAgICBcIlNwb3J0cyBFdmVudCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlN0YXRpc3RpY2lhblwiLFxuICAgICAgICAgICAgXCJTdG9yZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlN0cmF0ZWdpYyBBbGxpYW5jZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTdHJhdGVnaWMgUGxhbm5pbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU3RyZXNzIFJlZHVjdGlvbiBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlN0b2NrYnJva2VyXCIsXG4gICAgICAgICAgICBcIlN1cnZleW9yXCIsXG4gICAgICAgICAgICBcIlN0cnVjdHVyYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU3VwZXJpbnRlbmRlbnRcIixcbiAgICAgICAgICAgIFwiU3VwcGx5IENoYWluIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlN5c3RlbSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTeXN0ZW1zIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiU3lzdGVtcyBQcm9ncmFtbWVyXCIsXG4gICAgICAgICAgICBcIlN5c3RlbSBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIlRheCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlRlYWNoZXJcIixcbiAgICAgICAgICAgIFwiVGVjaG5pY2FsIFN1cHBvcnQgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJUZWNobmljYWwgSWxsdXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiVGVjaG5pY2FsIFdyaXRlclwiLFxuICAgICAgICAgICAgXCJUZWNobm9sb2d5IERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlRlbGVjb20gQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJUZWxlbWFya2V0ZXJcIixcbiAgICAgICAgICAgIFwiVGhlYXRyaWNhbCBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJUaXRsZSBFeGFtaW5lclwiLFxuICAgICAgICAgICAgXCJUb3VyIEVzY29ydFwiLFxuICAgICAgICAgICAgXCJUb3VyIEd1aWRlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlRyYWZmaWMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJUcmFpbmVyIFRyYW5zbGF0b3JcIixcbiAgICAgICAgICAgIFwiVHJhbnNwb3J0YXRpb24gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJUcmF2ZWwgQWdlbnRcIixcbiAgICAgICAgICAgIFwiVHJlYXN1cmVyXCIsXG4gICAgICAgICAgICBcIlRWIFByb2dyYW1tZXJcIixcbiAgICAgICAgICAgIFwiVW5kZXJ3cml0ZXJcIixcbiAgICAgICAgICAgIFwiVW5pb24gUmVwcmVzZW50YXRpdmVcIixcbiAgICAgICAgICAgIFwiVW5pdmVyc2l0eSBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIlVuaXZlcnNpdHkgRGVhblwiLFxuICAgICAgICAgICAgXCJVcmJhbiBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIlZldGVyaW5hcmlhblwiLFxuICAgICAgICAgICAgXCJWZW5kb3IgUmVsYXRpb25zIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlZpdGljdWx0dXJpc3RcIixcbiAgICAgICAgICAgIFwiV2FyZWhvdXNlIE1hbmFnZXJcIlxuICAgICAgICBdXG4gICAgfTtcblxuICAgIHZhciBvX2hhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbiAgICB2YXIgb19rZXlzID0gKE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICBpZiAob19oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIF9jb3B5T2JqZWN0KHNvdXJjZSwgdGFyZ2V0KSB7XG4gICAgICB2YXIga2V5cyA9IG9fa2V5cyhzb3VyY2UpO1xuICAgICAgdmFyIGtleTtcblxuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldIHx8IHRhcmdldFtrZXldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9jb3B5QXJyYXkoc291cmNlLCB0YXJnZXQpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gc291cmNlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0YXJnZXRbaV0gPSBzb3VyY2VbaV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29weU9iamVjdChzb3VyY2UsIF90YXJnZXQpIHtcbiAgICAgICAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KHNvdXJjZSk7XG4gICAgICAgIHZhciB0YXJnZXQgPSBfdGFyZ2V0IHx8IChpc0FycmF5ID8gbmV3IEFycmF5KHNvdXJjZS5sZW5ndGgpIDoge30pO1xuXG4gICAgICAgIGlmIChpc0FycmF5KSB7XG4gICAgICAgICAgX2NvcHlBcnJheShzb3VyY2UsIHRhcmdldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX2NvcHlPYmplY3Qoc291cmNlLCB0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvKiogR2V0IHRoZSBkYXRhIGJhc2VkIG9uIGtleSoqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGNvcHlPYmplY3QoZGF0YVtuYW1lXSk7XG4gICAgfTtcblxuICAgIC8vIE1hYyBBZGRyZXNzXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tYWNfYWRkcmVzcyA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICAvLyB0eXBpY2FsbHkgbWFjIGFkZHJlc3NlcyBhcmUgc2VwYXJhdGVkIGJ5IFwiOlwiXG4gICAgICAgIC8vIGhvd2V2ZXIgdGhleSBjYW4gYWxzbyBiZSBzZXBhcmF0ZWQgYnkgXCItXCJcbiAgICAgICAgLy8gdGhlIG5ldHdvcmsgdmFyaWFudCB1c2VzIGEgZG90IGV2ZXJ5IGZvdXJ0aCBieXRlXG5cbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICBpZighb3B0aW9ucy5zZXBhcmF0b3IpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuc2VwYXJhdG9yID0gIG9wdGlvbnMubmV0d29ya1ZlcnNpb24gPyBcIi5cIiA6IFwiOlwiO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG1hY19wb29sPVwiQUJDREVGMTIzNDU2Nzg5MFwiLFxuICAgICAgICAgICAgbWFjID0gXCJcIjtcbiAgICAgICAgaWYoIW9wdGlvbnMubmV0d29ya1ZlcnNpb24pIHtcbiAgICAgICAgICAgIG1hYyA9IHRoaXMubih0aGlzLnN0cmluZywgNiwgeyBwb29sOiBtYWNfcG9vbCwgbGVuZ3RoOjIgfSkuam9pbihvcHRpb25zLnNlcGFyYXRvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWMgPSB0aGlzLm4odGhpcy5zdHJpbmcsIDMsIHsgcG9vbDogbWFjX3Bvb2wsIGxlbmd0aDo0IH0pLmpvaW4ob3B0aW9ucy5zZXBhcmF0b3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1hYztcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ub3JtYWwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21lYW4gOiAwLCBkZXYgOiAxLCBwb29sIDogW119KTtcblxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLnBvb2wuY29uc3RydWN0b3IgIT09IEFycmF5LFxuICAgICAgICAgICAgXCJDaGFuY2U6IFRoZSBwb29sIG9wdGlvbiBtdXN0IGJlIGEgdmFsaWQgYXJyYXkuXCJcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBJZiBhIHBvb2wgaGFzIGJlZW4gcGFzc2VkLCB0aGVuIHdlIGFyZSByZXR1cm5pbmcgYW4gaXRlbSBmcm9tIHRoYXQgcG9vbCxcbiAgICAgICAgLy8gdXNpbmcgdGhlIG5vcm1hbCBkaXN0cmlidXRpb24gc2V0dGluZ3MgdGhhdCB3ZXJlIHBhc3NlZCBpblxuICAgICAgICBpZiAob3B0aW9ucy5wb29sLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vcm1hbF9wb29sKG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIE1hcnNhZ2xpYSBQb2xhciBtZXRob2RcbiAgICAgICAgdmFyIHMsIHUsIHYsIG5vcm0sXG4gICAgICAgICAgICBtZWFuID0gb3B0aW9ucy5tZWFuLFxuICAgICAgICAgICAgZGV2ID0gb3B0aW9ucy5kZXY7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgLy8gVSBhbmQgViBhcmUgZnJvbSB0aGUgdW5pZm9ybSBkaXN0cmlidXRpb24gb24gKC0xLCAxKVxuICAgICAgICAgICAgdSA9IHRoaXMucmFuZG9tKCkgKiAyIC0gMTtcbiAgICAgICAgICAgIHYgPSB0aGlzLnJhbmRvbSgpICogMiAtIDE7XG5cbiAgICAgICAgICAgIHMgPSB1ICogdSArIHYgKiB2O1xuICAgICAgICB9IHdoaWxlIChzID49IDEpO1xuXG4gICAgICAgIC8vIENvbXB1dGUgdGhlIHN0YW5kYXJkIG5vcm1hbCB2YXJpYXRlXG4gICAgICAgIG5vcm0gPSB1ICogTWF0aC5zcXJ0KC0yICogTWF0aC5sb2cocykgLyBzKTtcblxuICAgICAgICAvLyBTaGFwZSBhbmQgc2NhbGVcbiAgICAgICAgcmV0dXJuIGRldiAqIG5vcm0gKyBtZWFuO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5vcm1hbF9wb29sID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgcGVyZm9ybWFuY2VDb3VudGVyID0gMDtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgdmFyIGlkeCA9IE1hdGgucm91bmQodGhpcy5ub3JtYWwoeyBtZWFuOiBvcHRpb25zLm1lYW4sIGRldjogb3B0aW9ucy5kZXYgfSkpO1xuICAgICAgICAgICAgaWYgKGlkeCA8IG9wdGlvbnMucG9vbC5sZW5ndGggJiYgaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5wb29sW2lkeF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlcmZvcm1hbmNlQ291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IHdoaWxlKHBlcmZvcm1hbmNlQ291bnRlciA8IDEwMCk7XG5cbiAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IFlvdXIgcG9vbCBpcyB0b28gc21hbGwgZm9yIHRoZSBnaXZlbiBtZWFuIGFuZCBzdGFuZGFyZCBkZXZpYXRpb24uIFBsZWFzZSBhZGp1c3QuXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnJhZGlvID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gSW5pdGlhbCBMZXR0ZXIgKFR5cGljYWxseSBEZXNpZ25hdGVkIGJ5IFNpZGUgb2YgTWlzc2lzc2lwcGkgUml2ZXIpXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7c2lkZSA6IFwiP1wifSk7XG4gICAgICAgIHZhciBmbCA9IFwiXCI7XG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5zaWRlLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSBcImVhc3RcIjpcbiAgICAgICAgY2FzZSBcImVcIjpcbiAgICAgICAgICAgIGZsID0gXCJXXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIndlc3RcIjpcbiAgICAgICAgY2FzZSBcIndcIjpcbiAgICAgICAgICAgIGZsID0gXCJLXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGZsID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IFwiS1dcIn0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmwgKyB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSkgK1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KSArXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pO1xuICAgIH07XG5cbiAgICAvLyBTZXQgdGhlIGRhdGEgYXMga2V5IGFuZCBkYXRhIG9yIHRoZSBkYXRhIG1hcFxuICAgIENoYW5jZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG5hbWUsIHZhbHVlcykge1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGRhdGFbbmFtZV0gPSB2YWx1ZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRhID0gY29weU9iamVjdChuYW1lLCBkYXRhKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnR2ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmFkaW8ob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8vIElEIG51bWJlciBmb3IgQnJhemlsIGNvbXBhbmllc1xuICAgIENoYW5jZS5wcm90b3R5cGUuY25waiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG4gPSB0aGlzLm4odGhpcy5uYXR1cmFsLCA4LCB7IG1heDogOSB9KTtcbiAgICAgICAgdmFyIGQxID0gMituWzddKjYrbls2XSo3K25bNV0qOCtuWzRdKjkrblszXSoyK25bMl0qMytuWzFdKjQrblswXSo1O1xuICAgICAgICBkMSA9IDExIC0gKGQxICUgMTEpO1xuICAgICAgICBpZiAoZDE+PTEwKXtcbiAgICAgICAgICAgIGQxID0gMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZDIgPSBkMSoyKzMrbls3XSo3K25bNl0qOCtuWzVdKjkrbls0XSoyK25bM10qMytuWzJdKjQrblsxXSo1K25bMF0qNjtcbiAgICAgICAgZDIgPSAxMSAtIChkMiAlIDExKTtcbiAgICAgICAgaWYgKGQyPj0xMCl7XG4gICAgICAgICAgICBkMiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICcnK25bMF0rblsxXSsnLicrblsyXStuWzNdK25bNF0rJy4nK25bNV0rbls2XStuWzddKycvMDAwMS0nK2QxK2QyO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgTWlzY2VsbGFuZW91cyAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tZXJzZW5uZV90d2lzdGVyID0gZnVuY3Rpb24gKHNlZWQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNZXJzZW5uZVR3aXN0ZXIoc2VlZCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYmx1ZWltcF9tZDUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQmx1ZUltcE1ENSgpO1xuICAgIH07XG5cbiAgICAvLyBNZXJzZW5uZSBUd2lzdGVyIGZyb20gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vYmFua3NlYW4vMzAwNDk0XG4gICAgdmFyIE1lcnNlbm5lVHdpc3RlciA9IGZ1bmN0aW9uIChzZWVkKSB7XG4gICAgICAgIGlmIChzZWVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGtlcHQgcmFuZG9tIG51bWJlciBzYW1lIHNpemUgYXMgdGltZSB1c2VkIHByZXZpb3VzbHkgdG8gZW5zdXJlIG5vIHVuZXhwZWN0ZWQgcmVzdWx0cyBkb3duc3RyZWFtXG4gICAgICAgICAgICBzZWVkID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKk1hdGgucG93KDEwLDEzKSk7XG4gICAgICAgIH1cbiAgICAgICAgLyogUGVyaW9kIHBhcmFtZXRlcnMgKi9cbiAgICAgICAgdGhpcy5OID0gNjI0O1xuICAgICAgICB0aGlzLk0gPSAzOTc7XG4gICAgICAgIHRoaXMuTUFUUklYX0EgPSAweDk5MDhiMGRmOyAgIC8qIGNvbnN0YW50IHZlY3RvciBhICovXG4gICAgICAgIHRoaXMuVVBQRVJfTUFTSyA9IDB4ODAwMDAwMDA7IC8qIG1vc3Qgc2lnbmlmaWNhbnQgdy1yIGJpdHMgKi9cbiAgICAgICAgdGhpcy5MT1dFUl9NQVNLID0gMHg3ZmZmZmZmZjsgLyogbGVhc3Qgc2lnbmlmaWNhbnQgciBiaXRzICovXG5cbiAgICAgICAgdGhpcy5tdCA9IG5ldyBBcnJheSh0aGlzLk4pOyAvKiB0aGUgYXJyYXkgZm9yIHRoZSBzdGF0ZSB2ZWN0b3IgKi9cbiAgICAgICAgdGhpcy5tdGkgPSB0aGlzLk4gKyAxOyAvKiBtdGk9PU4gKyAxIG1lYW5zIG10W05dIGlzIG5vdCBpbml0aWFsaXplZCAqL1xuXG4gICAgICAgIHRoaXMuaW5pdF9nZW5yYW5kKHNlZWQpO1xuICAgIH07XG5cbiAgICAvKiBpbml0aWFsaXplcyBtdFtOXSB3aXRoIGEgc2VlZCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuaW5pdF9nZW5yYW5kID0gZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgdGhpcy5tdFswXSA9IHMgPj4+IDA7XG4gICAgICAgIGZvciAodGhpcy5tdGkgPSAxOyB0aGlzLm10aSA8IHRoaXMuTjsgdGhpcy5tdGkrKykge1xuICAgICAgICAgICAgcyA9IHRoaXMubXRbdGhpcy5tdGkgLSAxXSBeICh0aGlzLm10W3RoaXMubXRpIC0gMV0gPj4+IDMwKTtcbiAgICAgICAgICAgIHRoaXMubXRbdGhpcy5tdGldID0gKCgoKChzICYgMHhmZmZmMDAwMCkgPj4+IDE2KSAqIDE4MTI0MzMyNTMpIDw8IDE2KSArIChzICYgMHgwMDAwZmZmZikgKiAxODEyNDMzMjUzKSArIHRoaXMubXRpO1xuICAgICAgICAgICAgLyogU2VlIEtudXRoIFRBT0NQIFZvbDIuIDNyZCBFZC4gUC4xMDYgZm9yIG11bHRpcGxpZXIuICovXG4gICAgICAgICAgICAvKiBJbiB0aGUgcHJldmlvdXMgdmVyc2lvbnMsIE1TQnMgb2YgdGhlIHNlZWQgYWZmZWN0ICAgKi9cbiAgICAgICAgICAgIC8qIG9ubHkgTVNCcyBvZiB0aGUgYXJyYXkgbXRbXS4gICAgICAgICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgLyogMjAwMi8wMS8wOSBtb2RpZmllZCBieSBNYWtvdG8gTWF0c3Vtb3RvICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm10W3RoaXMubXRpXSA+Pj49IDA7XG4gICAgICAgICAgICAvKiBmb3IgPjMyIGJpdCBtYWNoaW5lcyAqL1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qIGluaXRpYWxpemUgYnkgYW4gYXJyYXkgd2l0aCBhcnJheS1sZW5ndGggKi9cbiAgICAvKiBpbml0X2tleSBpcyB0aGUgYXJyYXkgZm9yIGluaXRpYWxpemluZyBrZXlzICovXG4gICAgLyoga2V5X2xlbmd0aCBpcyBpdHMgbGVuZ3RoICovXG4gICAgLyogc2xpZ2h0IGNoYW5nZSBmb3IgQysrLCAyMDA0LzIvMjYgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmluaXRfYnlfYXJyYXkgPSBmdW5jdGlvbiAoaW5pdF9rZXksIGtleV9sZW5ndGgpIHtcbiAgICAgICAgdmFyIGkgPSAxLCBqID0gMCwgaywgcztcbiAgICAgICAgdGhpcy5pbml0X2dlbnJhbmQoMTk2NTAyMTgpO1xuICAgICAgICBrID0gKHRoaXMuTiA+IGtleV9sZW5ndGggPyB0aGlzLk4gOiBrZXlfbGVuZ3RoKTtcbiAgICAgICAgZm9yICg7IGs7IGstLSkge1xuICAgICAgICAgICAgcyA9IHRoaXMubXRbaSAtIDFdIF4gKHRoaXMubXRbaSAtIDFdID4+PiAzMCk7XG4gICAgICAgICAgICB0aGlzLm10W2ldID0gKHRoaXMubXRbaV0gXiAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTY2NDUyNSkgPDwgMTYpICsgKChzICYgMHgwMDAwZmZmZikgKiAxNjY0NTI1KSkpICsgaW5pdF9rZXlbal0gKyBqOyAvKiBub24gbGluZWFyICovXG4gICAgICAgICAgICB0aGlzLm10W2ldID4+Pj0gMDsgLyogZm9yIFdPUkRTSVpFID4gMzIgbWFjaGluZXMgKi9cbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIGlmIChpID49IHRoaXMuTikgeyB0aGlzLm10WzBdID0gdGhpcy5tdFt0aGlzLk4gLSAxXTsgaSA9IDE7IH1cbiAgICAgICAgICAgIGlmIChqID49IGtleV9sZW5ndGgpIHsgaiA9IDA7IH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGsgPSB0aGlzLk4gLSAxOyBrOyBrLS0pIHtcbiAgICAgICAgICAgIHMgPSB0aGlzLm10W2kgLSAxXSBeICh0aGlzLm10W2kgLSAxXSA+Pj4gMzApO1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA9ICh0aGlzLm10W2ldIF4gKCgoKChzICYgMHhmZmZmMDAwMCkgPj4+IDE2KSAqIDE1NjYwODM5NDEpIDw8IDE2KSArIChzICYgMHgwMDAwZmZmZikgKiAxNTY2MDgzOTQxKSkgLSBpOyAvKiBub24gbGluZWFyICovXG4gICAgICAgICAgICB0aGlzLm10W2ldID4+Pj0gMDsgLyogZm9yIFdPUkRTSVpFID4gMzIgbWFjaGluZXMgKi9cbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGlmIChpID49IHRoaXMuTikgeyB0aGlzLm10WzBdID0gdGhpcy5tdFt0aGlzLk4gLSAxXTsgaSA9IDE7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubXRbMF0gPSAweDgwMDAwMDAwOyAvKiBNU0IgaXMgMTsgYXNzdXJpbmcgbm9uLXplcm8gaW5pdGlhbCBhcnJheSAqL1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDB4ZmZmZmZmZmZdLWludGVydmFsICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX2ludDMyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgeTtcbiAgICAgICAgdmFyIG1hZzAxID0gbmV3IEFycmF5KDB4MCwgdGhpcy5NQVRSSVhfQSk7XG4gICAgICAgIC8qIG1hZzAxW3hdID0geCAqIE1BVFJJWF9BICBmb3IgeD0wLDEgKi9cblxuICAgICAgICBpZiAodGhpcy5tdGkgPj0gdGhpcy5OKSB7IC8qIGdlbmVyYXRlIE4gd29yZHMgYXQgb25lIHRpbWUgKi9cbiAgICAgICAgICAgIHZhciBraztcblxuICAgICAgICAgICAgaWYgKHRoaXMubXRpID09PSB0aGlzLk4gKyAxKSB7ICAgLyogaWYgaW5pdF9nZW5yYW5kKCkgaGFzIG5vdCBiZWVuIGNhbGxlZCwgKi9cbiAgICAgICAgICAgICAgICB0aGlzLmluaXRfZ2VucmFuZCg1NDg5KTsgLyogYSBkZWZhdWx0IGluaXRpYWwgc2VlZCBpcyB1c2VkICovXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGtrID0gMDsga2sgPCB0aGlzLk4gLSB0aGlzLk07IGtrKyspIHtcbiAgICAgICAgICAgICAgICB5ID0gKHRoaXMubXRba2tdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRba2sgKyAxXSZ0aGlzLkxPV0VSX01BU0spO1xuICAgICAgICAgICAgICAgIHRoaXMubXRba2tdID0gdGhpcy5tdFtrayArIHRoaXMuTV0gXiAoeSA+Pj4gMSkgXiBtYWcwMVt5ICYgMHgxXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoO2trIDwgdGhpcy5OIC0gMTsga2srKykge1xuICAgICAgICAgICAgICAgIHkgPSAodGhpcy5tdFtra10mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFtrayArIDFdJnRoaXMuTE9XRVJfTUFTSyk7XG4gICAgICAgICAgICAgICAgdGhpcy5tdFtra10gPSB0aGlzLm10W2trICsgKHRoaXMuTSAtIHRoaXMuTildIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5ID0gKHRoaXMubXRbdGhpcy5OIC0gMV0mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFswXSZ0aGlzLkxPV0VSX01BU0spO1xuICAgICAgICAgICAgdGhpcy5tdFt0aGlzLk4gLSAxXSA9IHRoaXMubXRbdGhpcy5NIC0gMV0gXiAoeSA+Pj4gMSkgXiBtYWcwMVt5ICYgMHgxXTtcblxuICAgICAgICAgICAgdGhpcy5tdGkgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgeSA9IHRoaXMubXRbdGhpcy5tdGkrK107XG5cbiAgICAgICAgLyogVGVtcGVyaW5nICovXG4gICAgICAgIHkgXj0gKHkgPj4+IDExKTtcbiAgICAgICAgeSBePSAoeSA8PCA3KSAmIDB4OWQyYzU2ODA7XG4gICAgICAgIHkgXj0gKHkgPDwgMTUpICYgMHhlZmM2MDAwMDtcbiAgICAgICAgeSBePSAoeSA+Pj4gMTgpO1xuXG4gICAgICAgIHJldHVybiB5ID4+PiAwO1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDB4N2ZmZmZmZmZdLWludGVydmFsICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX2ludDMxID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuZ2VucmFuZF9pbnQzMigpID4+PiAxKTtcbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwxXS1yZWFsLWludGVydmFsICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX3JlYWwxID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZW5yYW5kX2ludDMyKCkgKiAoMS4wIC8gNDI5NDk2NzI5NS4wKTtcbiAgICAgICAgLyogZGl2aWRlZCBieSAyXjMyLTEgKi9cbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwxKS1yZWFsLWludGVydmFsICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5yYW5kb20gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdlbnJhbmRfaW50MzIoKSAqICgxLjAgLyA0Mjk0OTY3Mjk2LjApO1xuICAgICAgICAvKiBkaXZpZGVkIGJ5IDJeMzIgKi9cbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiAoMCwxKS1yZWFsLWludGVydmFsICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX3JlYWwzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuZ2VucmFuZF9pbnQzMigpICsgMC41KSAqICgxLjAgLyA0Mjk0OTY3Mjk2LjApO1xuICAgICAgICAvKiBkaXZpZGVkIGJ5IDJeMzIgKi9cbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwxKSB3aXRoIDUzLWJpdCByZXNvbHV0aW9uKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfcmVzNTMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBhID0gdGhpcy5nZW5yYW5kX2ludDMyKCk+Pj41LCBiID0gdGhpcy5nZW5yYW5kX2ludDMyKCk+Pj42O1xuICAgICAgICByZXR1cm4gKGEgKiA2NzEwODg2NC4wICsgYikgKiAoMS4wIC8gOTAwNzE5OTI1NDc0MDk5Mi4wKTtcbiAgICB9O1xuXG4gICAgLy8gQmx1ZUltcCBNRDUgaGFzaGluZyBhbGdvcml0aG0gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vYmx1ZWltcC9KYXZhU2NyaXB0LU1ENVxuICAgIHZhciBCbHVlSW1wTUQ1ID0gZnVuY3Rpb24gKCkge307XG5cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5WRVJTSU9OID0gJzEuMC4xJztcblxuICAgIC8qXG4gICAgKiBBZGQgaW50ZWdlcnMsIHdyYXBwaW5nIGF0IDJeMzIuIFRoaXMgdXNlcyAxNi1iaXQgb3BlcmF0aW9ucyBpbnRlcm5hbGx5XG4gICAgKiB0byB3b3JrIGFyb3VuZCBidWdzIGluIHNvbWUgSlMgaW50ZXJwcmV0ZXJzLlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuc2FmZV9hZGQgPSBmdW5jdGlvbiBzYWZlX2FkZCh4LCB5KSB7XG4gICAgICAgIHZhciBsc3cgPSAoeCAmIDB4RkZGRikgKyAoeSAmIDB4RkZGRiksXG4gICAgICAgICAgICBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcbiAgICAgICAgcmV0dXJuIChtc3cgPDwgMTYpIHwgKGxzdyAmIDB4RkZGRik7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5iaXRfcm9sbCA9IGZ1bmN0aW9uIChudW0sIGNudCkge1xuICAgICAgICByZXR1cm4gKG51bSA8PCBjbnQpIHwgKG51bSA+Pj4gKDMyIC0gY250KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBUaGVzZSBmdW5jdGlvbnMgaW1wbGVtZW50IHRoZSBmaXZlIGJhc2ljIG9wZXJhdGlvbnMgdGhlIGFsZ29yaXRobSB1c2VzLlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2NtbiA9IGZ1bmN0aW9uIChxLCBhLCBiLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNhZmVfYWRkKHRoaXMuYml0X3JvbGwodGhpcy5zYWZlX2FkZCh0aGlzLnNhZmVfYWRkKGEsIHEpLCB0aGlzLnNhZmVfYWRkKHgsIHQpKSwgcyksIGIpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2ZmID0gZnVuY3Rpb24gKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWQ1X2NtbigoYiAmIGMpIHwgKCh+YikgJiBkKSwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfZ2cgPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKChiICYgZCkgfCAoYyAmICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9oaCA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1kNV9jbW4oYiBeIGMgXiBkLCBhLCBiLCB4LCBzLCB0KTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9paSA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1kNV9jbW4oYyBeIChiIHwgKH5kKSksIGEsIGIsIHgsIHMsIHQpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ2FsY3VsYXRlIHRoZSBNRDUgb2YgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcywgYW5kIGEgYml0IGxlbmd0aC5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmJpbmxfbWQ1ID0gZnVuY3Rpb24gKHgsIGxlbikge1xuICAgICAgICAvKiBhcHBlbmQgcGFkZGluZyAqL1xuICAgICAgICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8IChsZW4gJSAzMik7XG4gICAgICAgIHhbKCgobGVuICsgNjQpID4+PiA5KSA8PCA0KSArIDE0XSA9IGxlbjtcblxuICAgICAgICB2YXIgaSwgb2xkYSwgb2xkYiwgb2xkYywgb2xkZCxcbiAgICAgICAgICAgIGEgPSAgMTczMjU4NDE5MyxcbiAgICAgICAgICAgIGIgPSAtMjcxNzMzODc5LFxuICAgICAgICAgICAgYyA9IC0xNzMyNTg0MTk0LFxuICAgICAgICAgICAgZCA9ICAyNzE3MzM4Nzg7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KSB7XG4gICAgICAgICAgICBvbGRhID0gYTtcbiAgICAgICAgICAgIG9sZGIgPSBiO1xuICAgICAgICAgICAgb2xkYyA9IGM7XG4gICAgICAgICAgICBvbGRkID0gZDtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaV0sICAgICAgIDcsIC02ODA4NzY5MzYpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSArICAxXSwgMTIsIC0zODk1NjQ1ODYpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSArICAyXSwgMTcsICA2MDYxMDU4MTkpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSArICAzXSwgMjIsIC0xMDQ0NTI1MzMwKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9mZihhLCBiLCBjLCBkLCB4W2kgKyAgNF0sICA3LCAtMTc2NDE4ODk3KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAgNV0sIDEyLCAgMTIwMDA4MDQyNik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgIDZdLCAxNywgLTE0NzMyMzEzNDEpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSArICA3XSwgMjIsIC00NTcwNTk4Myk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpICsgIDhdLCAgNywgIDE3NzAwMzU0MTYpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSArICA5XSwgMTIsIC0xOTU4NDE0NDE3KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9mZihjLCBkLCBhLCBiLCB4W2kgKyAxMF0sIDE3LCAtNDIwNjMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSArIDExXSwgMjIsIC0xOTkwNDA0MTYyKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9mZihhLCBiLCBjLCBkLCB4W2kgKyAxMl0sICA3LCAgMTgwNDYwMzY4Mik7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZmYoZCwgYSwgYiwgYywgeFtpICsgMTNdLCAxMiwgLTQwMzQxMTAxKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9mZihjLCBkLCBhLCBiLCB4W2kgKyAxNF0sIDE3LCAtMTUwMjAwMjI5MCk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZmYoYiwgYywgZCwgYSwgeFtpICsgMTVdLCAyMiwgIDEyMzY1MzUzMjkpO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZ2coYSwgYiwgYywgZCwgeFtpICsgIDFdLCAgNSwgLTE2NTc5NjUxMCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZ2coZCwgYSwgYiwgYywgeFtpICsgIDZdLCAgOSwgLTEwNjk1MDE2MzIpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSArIDExXSwgMTQsICA2NDM3MTc3MTMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaV0sICAgICAgMjAsIC0zNzM4OTczMDIpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArICA1XSwgIDUsIC03MDE1NTg2OTEpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArIDEwXSwgIDksICAzODAxNjA4Myk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZ2coYywgZCwgYSwgYiwgeFtpICsgMTVdLCAxNCwgLTY2MDQ3ODMzNSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZ2coYiwgYywgZCwgYSwgeFtpICsgIDRdLCAyMCwgLTQwNTUzNzg0OCk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZ2coYSwgYiwgYywgZCwgeFtpICsgIDldLCAgNSwgIDU2ODQ0NjQzOCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZ2coZCwgYSwgYiwgYywgeFtpICsgMTRdLCAgOSwgLTEwMTk4MDM2OTApO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSArICAzXSwgMTQsIC0xODczNjM5NjEpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSArICA4XSwgMjAsICAxMTYzNTMxNTAxKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9nZyhhLCBiLCBjLCBkLCB4W2kgKyAxM10sICA1LCAtMTQ0NDY4MTQ2Nyk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZ2coZCwgYSwgYiwgYywgeFtpICsgIDJdLCAgOSwgLTUxNDAzNzg0KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAgN10sIDE0LCAgMTczNTMyODQ3Myk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZ2coYiwgYywgZCwgYSwgeFtpICsgMTJdLCAyMCwgLTE5MjY2MDc3MzQpO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaGgoYSwgYiwgYywgZCwgeFtpICsgIDVdLCAgNCwgLTM3ODU1OCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaGgoZCwgYSwgYiwgYywgeFtpICsgIDhdLCAxMSwgLTIwMjI1NzQ0NjMpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArIDExXSwgMTYsICAxODM5MDMwNTYyKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9oaChiLCBjLCBkLCBhLCB4W2kgKyAxNF0sIDIzLCAtMzUzMDk1NTYpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArICAxXSwgIDQsIC0xNTMwOTkyMDYwKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9oaChkLCBhLCBiLCBjLCB4W2kgKyAgNF0sIDExLCAgMTI3Mjg5MzM1Myk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaGgoYywgZCwgYSwgYiwgeFtpICsgIDddLCAxNiwgLTE1NTQ5NzYzMik7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaGgoYiwgYywgZCwgYSwgeFtpICsgMTBdLCAyMywgLTEwOTQ3MzA2NDApO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArIDEzXSwgIDQsICA2ODEyNzkxNzQpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaV0sICAgICAgMTEsIC0zNTg1MzcyMjIpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArICAzXSwgMTYsIC03MjI1MjE5NzkpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArICA2XSwgMjMsICA3NjAyOTE4OSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaGgoYSwgYiwgYywgZCwgeFtpICsgIDldLCAgNCwgLTY0MDM2NDQ4Nyk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaGgoZCwgYSwgYiwgYywgeFtpICsgMTJdLCAxMSwgLTQyMTgxNTgzNSk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaGgoYywgZCwgYSwgYiwgeFtpICsgMTVdLCAxNiwgIDUzMDc0MjUyMCk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaGgoYiwgYywgZCwgYSwgeFtpICsgIDJdLCAyMywgLTk5NTMzODY1MSk7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9paShhLCBiLCBjLCBkLCB4W2ldLCAgICAgICA2LCAtMTk4NjMwODQ0KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9paShkLCBhLCBiLCBjLCB4W2kgKyAgN10sIDEwLCAgMTEyNjg5MTQxNSk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaWkoYywgZCwgYSwgYiwgeFtpICsgMTRdLCAxNSwgLTE0MTYzNTQ5MDUpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSArICA1XSwgMjEsIC01NzQzNDA1NSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaWkoYSwgYiwgYywgZCwgeFtpICsgMTJdLCAgNiwgIDE3MDA0ODU1NzEpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSArICAzXSwgMTAsIC0xODk0OTg2NjA2KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAxMF0sIDE1LCAtMTA1MTUyMyk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaWkoYiwgYywgZCwgYSwgeFtpICsgIDFdLCAyMSwgLTIwNTQ5MjI3OTkpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSArICA4XSwgIDYsICAxODczMzEzMzU5KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9paShkLCBhLCBiLCBjLCB4W2kgKyAxNV0sIDEwLCAtMzA2MTE3NDQpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSArICA2XSwgMTUsIC0xNTYwMTk4MzgwKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAxM10sIDIxLCAgMTMwOTE1MTY0OSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaWkoYSwgYiwgYywgZCwgeFtpICsgIDRdLCAgNiwgLTE0NTUyMzA3MCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgMTFdLCAxMCwgLTExMjAyMTAzNzkpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSArICAyXSwgMTUsICA3MTg3ODcyNTkpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSArICA5XSwgMjEsIC0zNDM0ODU1NTEpO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5zYWZlX2FkZChhLCBvbGRhKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLnNhZmVfYWRkKGIsIG9sZGIpO1xuICAgICAgICAgICAgYyA9IHRoaXMuc2FmZV9hZGQoYywgb2xkYyk7XG4gICAgICAgICAgICBkID0gdGhpcy5zYWZlX2FkZChkLCBvbGRkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2EsIGIsIGMsIGRdO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ29udmVydCBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzIHRvIGEgc3RyaW5nXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5iaW5sMnJzdHIgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBvdXRwdXQgPSAnJztcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAqIDMyOyBpICs9IDgpIHtcbiAgICAgICAgICAgIG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKChpbnB1dFtpID4+IDVdID4+PiAoaSAlIDMyKSkgJiAweEZGKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3Jkc1xuICAgICogQ2hhcmFjdGVycyA+MjU1IGhhdmUgdGhlaXIgaGlnaC1ieXRlIHNpbGVudGx5IGlnbm9yZWQuXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yc3RyMmJpbmwgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBvdXRwdXQgPSBbXTtcbiAgICAgICAgb3V0cHV0WyhpbnB1dC5sZW5ndGggPj4gMikgLSAxXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG91dHB1dC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgb3V0cHV0W2ldID0gMDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoICogODsgaSArPSA4KSB7XG4gICAgICAgICAgICBvdXRwdXRbaSA+PiA1XSB8PSAoaW5wdXQuY2hhckNvZGVBdChpIC8gOCkgJiAweEZGKSA8PCAoaSAlIDMyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ2FsY3VsYXRlIHRoZSBNRDUgb2YgYSByYXcgc3RyaW5nXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yc3RyX21kNSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJpbmwycnN0cih0aGlzLmJpbmxfbWQ1KHRoaXMucnN0cjJiaW5sKHMpLCBzLmxlbmd0aCAqIDgpKTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENhbGN1bGF0ZSB0aGUgSE1BQy1NRDUsIG9mIGEga2V5IGFuZCBzb21lIGRhdGEgKHJhdyBzdHJpbmdzKVxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cl9obWFjX21kNSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBia2V5ID0gdGhpcy5yc3RyMmJpbmwoa2V5KSxcbiAgICAgICAgICAgIGlwYWQgPSBbXSxcbiAgICAgICAgICAgIG9wYWQgPSBbXSxcbiAgICAgICAgICAgIGhhc2g7XG4gICAgICAgIGlwYWRbMTVdID0gb3BhZFsxNV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChia2V5Lmxlbmd0aCA+IDE2KSB7XG4gICAgICAgICAgICBia2V5ID0gdGhpcy5iaW5sX21kNShia2V5LCBrZXkubGVuZ3RoICogOCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IDE2OyBpICs9IDEpIHtcbiAgICAgICAgICAgIGlwYWRbaV0gPSBia2V5W2ldIF4gMHgzNjM2MzYzNjtcbiAgICAgICAgICAgIG9wYWRbaV0gPSBia2V5W2ldIF4gMHg1QzVDNUM1QztcbiAgICAgICAgfVxuICAgICAgICBoYXNoID0gdGhpcy5iaW5sX21kNShpcGFkLmNvbmNhdCh0aGlzLnJzdHIyYmlubChkYXRhKSksIDUxMiArIGRhdGEubGVuZ3RoICogOCk7XG4gICAgICAgIHJldHVybiB0aGlzLmJpbmwycnN0cih0aGlzLmJpbmxfbWQ1KG9wYWQuY29uY2F0KGhhc2gpLCA1MTIgKyAxMjgpKTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENvbnZlcnQgYSByYXcgc3RyaW5nIHRvIGEgaGV4IHN0cmluZ1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cjJoZXggPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdmFyIGhleF90YWIgPSAnMDEyMzQ1Njc4OWFiY2RlZicsXG4gICAgICAgICAgICBvdXRwdXQgPSAnJyxcbiAgICAgICAgICAgIHgsXG4gICAgICAgICAgICBpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIHggPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgb3V0cHV0ICs9IGhleF90YWIuY2hhckF0KCh4ID4+PiA0KSAmIDB4MEYpICtcbiAgICAgICAgICAgICAgICBoZXhfdGFiLmNoYXJBdCh4ICYgMHgwRik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIEVuY29kZSBhIHN0cmluZyBhcyB1dGYtOFxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuc3RyMnJzdHJfdXRmOCA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICByZXR1cm4gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KGlucHV0KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBUYWtlIHN0cmluZyBhcmd1bWVudHMgYW5kIHJldHVybiBlaXRoZXIgcmF3IG9yIGhleCBlbmNvZGVkIHN0cmluZ3NcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJhd19tZDUgPSBmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyX21kNSh0aGlzLnN0cjJyc3RyX3V0ZjgocykpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuaGV4X21kNSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJzdHIyaGV4KHRoaXMucmF3X21kNShzKSk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yYXdfaG1hY19tZDUgPSBmdW5jdGlvbiAoaywgZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyX2htYWNfbWQ1KHRoaXMuc3RyMnJzdHJfdXRmOChrKSwgdGhpcy5zdHIycnN0cl91dGY4KGQpKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmhleF9obWFjX21kNSA9IGZ1bmN0aW9uIChrLCBkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJzdHIyaGV4KHRoaXMucmF3X2htYWNfbWQ1KGssIGQpKTtcbiAgICB9O1xuXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1ID0gZnVuY3Rpb24gKHN0cmluZywga2V5LCByYXcpIHtcbiAgICAgICAgaWYgKCFrZXkpIHtcbiAgICAgICAgICAgIGlmICghcmF3KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGV4X21kNShzdHJpbmcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yYXdfbWQ1KHN0cmluZyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXJhdykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGV4X2htYWNfbWQ1KGtleSwgc3RyaW5nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnJhd19obWFjX21kNShrZXksIHN0cmluZyk7XG4gICAgfTtcblxuICAgIC8vIENvbW1vbkpTIG1vZHVsZVxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICAgICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBDaGFuY2U7XG4gICAgICAgIH1cbiAgICAgICAgZXhwb3J0cy5DaGFuY2UgPSBDaGFuY2U7XG4gICAgfVxuXG4gICAgLy8gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIEFNRCBtb2R1bGVcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShbXSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIENoYW5jZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gaWYgdGhlcmUgaXMgYSBpbXBvcnRzU2NyaXBzIG9iamVjdCBkZWZpbmUgY2hhbmNlIGZvciB3b3JrZXJcbiAgICBpZiAodHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGNoYW5jZSA9IG5ldyBDaGFuY2UoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBhIHdpbmRvdyBvYmplY3QsIHRoYXQgYXQgbGVhc3QgaGFzIGEgZG9jdW1lbnQgcHJvcGVydHksXG4gICAgLy8gaW5zdGFudGlhdGUgYW5kIGRlZmluZSBjaGFuY2Ugb24gdGhlIHdpbmRvd1xuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiB3aW5kb3cuZG9jdW1lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgd2luZG93LkNoYW5jZSA9IENoYW5jZTtcbiAgICAgICAgd2luZG93LmNoYW5jZSA9IG5ldyBDaGFuY2UoKTtcbiAgICB9XG59KSgpO1xuIl19
