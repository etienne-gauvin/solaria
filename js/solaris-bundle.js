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

	return new Promise((resolve, reject) => {

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

					if (allLoaded) resolve();
				});
			}
		}
	});
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

	game.load().then(() => {

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJqc1xcc3JjXFxjYW1lcmEuanMiLCJqc1xcc3JjXFxjb2xvcnMuanMiLCJqc1xcc3JjXFxjb250cm9scy5qcyIsImpzXFxzcmNcXGdhbWUuanMiLCJqc1xcc3JjXFxncm91bmQuanMiLCJqc1xcc3JjXFxwbGF5ZXIuanMiLCJqc1xcc3JjXFxzb2xhcmlzLWNvbnRyb2xzLmpzIiwianNcXHNyY1xcc29sYXJpcy5qcyIsIm5vZGVfbW9kdWxlcy9jaGFuY2UvY2hhbmNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjs7QUFFQSxNQUFNLE1BQU4sU0FBcUIsTUFBTSxpQkFBM0IsQ0FBNkM7O0FBRTVDLGVBQWM7O0FBRWIsUUFBTSxjQUFjLEtBQUssS0FBTCxHQUFhLEtBQUssTUFBdEM7QUFDQSxRQUFNLGNBQWMsRUFBcEI7QUFDQSxRQUFNLFlBQVksQ0FBbEI7QUFDQSxRQUFNLFdBQVcsS0FBakI7O0FBRUEsUUFDQyxXQURELEVBRUMsV0FGRCxFQUdDLFNBSEQsRUFJQyxRQUpEOztBQU9BLE9BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxJQUFmOztBQUVBO0FBQ0EsT0FBSyxFQUFMLENBQVEsSUFBUixDQUFhLElBQUksTUFBTSxPQUFWLENBQWtCLENBQWxCLEVBQXFCLENBQXJCLEVBQXdCLENBQXhCLENBQWI7O0FBRUE7QUFDQSxPQUFLLGdCQUFMLEdBQXdCLElBQUksTUFBTSxPQUFWLENBQWtCLENBQWxCLEVBQXFCLEVBQXJCLEVBQXlCLENBQXpCLENBQXhCO0FBRUE7O0FBRUQsUUFBTyxLQUFQLEVBQWM7O0FBRWI7QUFDQSxRQUFNLFFBQVEsR0FBZDtBQUNBLFFBQU0sU0FBUyxLQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLEtBQXJCLEdBQTZCLEdBQTdCLENBQWlDLEtBQUssZ0JBQXRDLENBQWY7QUFDQSxRQUFNLFdBQVcsS0FBSyxRQUF0Qjs7QUFFQSxXQUFTLENBQVQsSUFBYyxDQUFDLE9BQU8sQ0FBUCxHQUFXLFNBQVMsQ0FBckIsSUFBMEIsS0FBMUIsR0FBa0MsTUFBTSxLQUF0RDtBQUNBLFdBQVMsQ0FBVCxJQUFjLENBQUMsT0FBTyxDQUFQLEdBQVcsU0FBUyxDQUFyQixJQUEwQixLQUExQixHQUFrQyxNQUFNLEtBQXREO0FBQ0EsV0FBUyxDQUFULElBQWMsQ0FBQyxPQUFPLENBQVAsR0FBVyxTQUFTLENBQXJCLElBQTBCLEtBQTFCLEdBQWtDLE1BQU0sS0FBdEQ7O0FBRUE7QUFDQSxPQUFLLE1BQUwsQ0FBWSxLQUFLLE1BQUwsQ0FBWSxnQkFBWixFQUFaO0FBRUE7QUF4QzJDOztBQTJDN0MsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7QUM3Q0EsT0FBTyxPQUFQLEdBQWlCO0FBQ2hCLE1BQUssUUFEVztBQUVoQixRQUFPLFFBRlM7QUFHaEIsUUFBTyxRQUhTO0FBSWhCLE9BQU0sUUFKVTtBQUtoQixZQUFXLFFBTEs7QUFNaEIsT0FBTTtBQU5VLENBQWpCOzs7QUNBQTs7O0FBR0EsTUFBTSxRQUFOLENBQWU7O0FBRWQsZUFBYzs7QUFFYixPQUFLLE9BQUwsR0FBZSxJQUFmO0FBQ0EsT0FBSyxRQUFMLEdBQWdCLEdBQWhCOztBQUVBO0FBQ0EsT0FBSyxVQUFMLEdBQWtCLFVBQWxCOztBQUVBO0FBQ0EsT0FBSyxNQUFMLEdBQWM7QUFDYixhQUFVLEVBREc7QUFFYixZQUFTO0FBRkksR0FBZDs7QUFLQTtBQUNBLE9BQUssUUFBTCxHQUFnQjtBQUNmLGFBQVUsRUFESztBQUVmLFlBQVM7QUFGTSxHQUFoQjs7QUFLQTtBQUNBLE9BQUssT0FBTCxHQUFlO0FBQ2QsTUFBRyxDQURXO0FBRWQsTUFBRyxDQUZXO0FBR2QsTUFBRyxDQUhXO0FBSWQsTUFBRyxDQUpXO0FBS2QsT0FBSSxDQUxVO0FBTWQsT0FBSSxDQU5VO0FBT2QsT0FBSSxDQVBVO0FBUWQsT0FBSSxDQVJVO0FBU2QsU0FBTSxDQVRRO0FBVWQsVUFBTyxDQVZPO0FBV2QsT0FBSSxFQVhVO0FBWWQsU0FBTSxFQVpRO0FBYWQsU0FBTSxFQWJRO0FBY2QsVUFBTyxFQWRPOztBQWdCZCxXQUFRLENBaEJNO0FBaUJkLFdBQVEsQ0FqQk07QUFrQmQsWUFBUyxDQWxCSztBQW1CZCxZQUFTO0FBbkJLLEdBQWY7O0FBc0JBOzs7QUFHQSxTQUFPLGdCQUFQLENBQXdCLGtCQUF4QixFQUE2QyxLQUFELElBQVc7O0FBRXRELE9BQUksS0FBSyxNQUFNLE9BQWY7O0FBRUEsV0FBUSxHQUFSLENBQVkscURBQVosRUFDQyxHQUFHLEtBREosRUFDVyxHQUFHLEVBRGQsRUFFQyxHQUFHLE9BQUgsQ0FBVyxNQUZaLEVBRW9CLEdBQUcsSUFBSCxDQUFRLE1BRjVCOztBQUlBLFFBQUssT0FBTCxHQUFlLEVBQWY7QUFDQSxRQUFLLFVBQUwsR0FBa0IsU0FBbEI7QUFFQSxHQVhEOztBQWFBOzs7QUFHQSxTQUFPLGdCQUFQLENBQXdCLFNBQXhCLEVBQW9DLEtBQUQsSUFBVzs7QUFFN0MsUUFBSyxNQUFMLENBQVksUUFBWixDQUFxQixNQUFNLEdBQTNCLElBQWtDLElBQWxDO0FBQ0EsUUFBSyxVQUFMLEdBQWtCLFVBQWxCO0FBRUEsR0FMRDs7QUFPQTs7O0FBR0EsU0FBTyxnQkFBUCxDQUF3QixPQUF4QixFQUFrQyxLQUFELElBQVc7O0FBRTNDLFFBQUssTUFBTCxDQUFZLFFBQVosQ0FBcUIsTUFBTSxHQUEzQixJQUFrQyxLQUFsQztBQUNBLFFBQUssVUFBTCxHQUFrQixVQUFsQjtBQUVBLEdBTEQ7QUFPQTs7QUFFRDs7O0FBR0EsUUFBTyxLQUFQLEVBQWM7O0FBRWIsTUFBSSxXQUFXLFVBQVUsV0FBVixFQUFmO0FBQ0EsT0FBSyxPQUFMLEdBQWUsU0FBUyxDQUFULENBQWY7O0FBRUEsTUFBSSxLQUFLLE9BQVQsRUFBa0I7O0FBRWpCLFNBQU0sV0FBVyxLQUFLLFFBQUwsQ0FBYyxPQUEvQjtBQUNBLFNBQU0sVUFBVSxLQUFLLGlCQUFMLENBQXVCLEtBQUssT0FBNUIsQ0FBaEI7O0FBRUEsT0FBSSxRQUFKLEVBQWM7O0FBRWIsU0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsT0FBUixDQUFnQixNQUFwQyxFQUE0QyxHQUE1QyxFQUFpRDs7QUFFaEQsU0FBSSxTQUFTLE9BQVQsQ0FBaUIsQ0FBakIsRUFBb0IsT0FBcEIsS0FBZ0MsUUFBUSxPQUFSLENBQWdCLENBQWhCLEVBQW1CLE9BQXZELEVBQWdFOztBQUUvRCxXQUFLLFVBQUwsR0FBa0IsU0FBbEI7QUFFQTtBQUVEOztBQUVELFNBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxRQUFRLElBQVIsQ0FBYSxNQUFqQyxFQUF5QyxHQUF6QyxFQUE4Qzs7QUFFN0MsU0FBSSxTQUFTLElBQVQsQ0FBYyxDQUFkLE1BQXFCLFFBQVEsSUFBUixDQUFhLENBQWIsQ0FBekIsRUFBMEM7O0FBRXpDLFdBQUssVUFBTCxHQUFrQixTQUFsQjtBQUVBO0FBRUQ7QUFFRDs7QUFFRCxRQUFLLFFBQUwsQ0FBYyxPQUFkLEdBQXdCLEtBQUssTUFBTCxDQUFZLE9BQXBDO0FBQ0EsUUFBSyxNQUFMLENBQVksT0FBWixHQUFzQixPQUF0QjtBQUVBO0FBRUQ7O0FBRUQ7Ozs7O0FBS0EsZUFBYyxDQUFkLEVBQWlCOztBQUVoQixNQUFJLFdBQVcsS0FBSyxRQUFwQjs7QUFFQSxNQUFJLElBQUksQ0FBSixHQUFRLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxDQUFDLFFBQWIsQ0FBUixHQUFpQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksUUFBWixDQUFyQzs7QUFFQSxTQUFPLENBQUMsS0FBSyxHQUFMLENBQVMsQ0FBVCxJQUFjLFFBQWYsS0FBNEIsSUFBSSxRQUFoQyxJQUE0QyxLQUFLLElBQUwsQ0FBVSxDQUFWLENBQW5EO0FBRUE7O0FBRUQ7Ozs7O0FBS0EsU0FBUSxnQkFBUixFQUEwQixZQUExQixFQUF3Qzs7QUFFdkMsVUFBUSxLQUFLLFVBQWI7O0FBRUMsUUFBSyxTQUFMOztBQUVDLFFBQUksS0FBSyxNQUFMLENBQVksT0FBWixLQUF3QixJQUE1QixFQUFrQyxPQUFPLENBQVA7O0FBRWxDLFdBQU8sS0FBSyxNQUFMLENBQVksT0FBWixDQUFvQixJQUFwQixDQUF5QixnQkFBekIsQ0FBUDs7QUFFQTs7QUFFRDtBQUNBLFFBQUssVUFBTDs7QUFFQyxRQUFJLFdBQVcsS0FBSyxNQUFMLENBQVksUUFBWixDQUFxQixhQUFhLFFBQWxDLElBQThDLENBQUMsQ0FBL0MsR0FBbUQsQ0FBbEU7QUFDQSxRQUFJLFdBQVcsS0FBSyxNQUFMLENBQVksUUFBWixDQUFxQixhQUFhLFFBQWxDLElBQThDLENBQUMsQ0FBL0MsR0FBbUQsQ0FBbEU7O0FBRUEsV0FBTyxXQUFXLFFBQWxCOztBQUVBOztBQWxCRjtBQXNCQTs7QUFFRDs7Ozs7QUFLQSxtQkFBa0IsT0FBbEIsRUFBMkI7O0FBRTFCLE1BQUksT0FBTyxFQUFYO0FBQ0EsTUFBSSxVQUFVLEVBQWQ7O0FBRUEsT0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsT0FBUixDQUFnQixNQUFwQyxFQUE0QyxHQUE1QyxFQUFpRDs7QUFFaEQsV0FBUSxDQUFSLElBQWE7QUFDWixXQUFPLFFBQVEsT0FBUixDQUFnQixDQUFoQixFQUFtQixLQURkO0FBRVosYUFBUyxRQUFRLE9BQVIsQ0FBZ0IsQ0FBaEIsRUFBbUI7QUFGaEIsSUFBYjtBQUtBOztBQUVELE9BQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxRQUFRLElBQVIsQ0FBYSxNQUFqQyxFQUF5QyxHQUF6QyxFQUE4Qzs7QUFFN0MsUUFBSyxDQUFMLElBQVUsS0FBSyxhQUFMLENBQW1CLFFBQVEsSUFBUixDQUFhLENBQWIsQ0FBbkIsQ0FBVjtBQUVBOztBQUVELFNBQU87QUFDTixTQUFNLElBREE7QUFFTixZQUFTO0FBRkgsR0FBUDtBQUtBOztBQTNNYTs7QUErTWYsT0FBTyxPQUFQLEdBQWlCLFFBQWpCOzs7QUNsTkEsTUFBTSxTQUFTLFFBQVEsVUFBUixDQUFmO0FBQ0EsTUFBTSxTQUFTLFFBQVEsUUFBUixDQUFmO0FBQ0EsTUFBTSxPQUFPLEVBQWI7O0FBRUE7OztBQUdBLEtBQUssS0FBTCxHQUFhO0FBQ1osU0FBUTtBQUNQLFFBQU07QUFEQztBQURJLENBQWI7O0FBTUE7OztBQUdBLEtBQUssSUFBTCxHQUFZLFVBQVUsUUFBVixFQUFvQjs7QUFFL0IsUUFBTyxJQUFJLE9BQUosQ0FBWSxDQUFDLE9BQUQsRUFBVSxNQUFWLEtBQXFCOztBQUV2QztBQUNBLFFBQU0sU0FBUyxJQUFJLE1BQU0sVUFBVixFQUFmOztBQUVBO0FBQ0EsUUFBTSxXQUFZLElBQUQsSUFBVTs7QUFFMUIsVUFBTyxLQUFLLFFBQUwsS0FBa0IsU0FBbEIsSUFBK0IsS0FBSyxTQUFMLEtBQW1CLFNBQXpEO0FBRUEsR0FKRDs7QUFNQTtBQUNBLE9BQUssSUFBSSxDQUFULElBQWMsS0FBSyxLQUFuQixFQUEwQjs7QUFFekIsT0FBSSxPQUFPLEtBQUssS0FBTCxDQUFXLENBQVgsQ0FBWDs7QUFFQSxPQUFJLENBQUUsU0FBUyxJQUFULENBQU4sRUFBc0I7O0FBRXJCLFdBQU8sSUFBUCxDQUFZLEtBQUssSUFBakIsRUFBdUIsQ0FBQyxRQUFELEVBQVcsU0FBWCxLQUF5Qjs7QUFFL0MsVUFBSyxRQUFMLEdBQWdCLFFBQWhCO0FBQ0EsVUFBSyxTQUFMLEdBQWlCLFNBQWpCOztBQUVBLGFBQVEsSUFBUixDQUFjLFdBQVUsS0FBSyxJQUFLLEVBQWxDOztBQUVBLFNBQUksWUFBWSxJQUFoQjs7QUFFQSxVQUFLLElBQUksRUFBVCxJQUFlLEtBQUssS0FBcEIsRUFBMkI7O0FBRTFCLGtCQUFZLGFBQWEsU0FBUyxLQUFLLEtBQUwsQ0FBVyxFQUFYLENBQVQsQ0FBekI7QUFFQTs7QUFFRCxTQUFJLFNBQUosRUFBZTtBQUVmLEtBakJEO0FBbUJBO0FBRUQ7QUFFRCxFQTFDTSxDQUFQO0FBNENBLENBOUNEOztBQWdEQTs7O0FBR0EsS0FBSyxXQUFMLEdBQW1CLFlBQVk7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBLE1BQUssTUFBTCxHQUFjLE9BQU8sV0FBckI7QUFDQSxNQUFLLEtBQUwsR0FBYSxPQUFPLFVBQXBCOztBQUVBO0FBQ0EsTUFBSyxLQUFMLEdBQWEsSUFBSSxNQUFNLEtBQVYsRUFBYjs7QUFFQTtBQUNBLE1BQUssTUFBTCxHQUFjLElBQUksTUFBSixDQUFXLFNBQVgsQ0FBZDs7QUFFQTtBQUNBLE1BQUssR0FBTCxHQUFXLElBQUksSUFBSSxHQUFSLEVBQVg7O0FBRUE7QUFDQSxPQUFNLFdBQVcsUUFBUSxvQkFBUixDQUFqQjtBQUNBLE1BQUssUUFBTCxHQUFnQixJQUFJLFFBQUosRUFBaEI7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsT0FBTSxXQUFXLEtBQUssUUFBTCxHQUFnQixJQUFJLE1BQU0sYUFBVixDQUF3QjtBQUN4RDtBQUNBO0FBQ0EsU0FBTyxJQUhpRDs7QUFLeEQ7QUFDQTtBQUNBLGFBQVc7QUFQNkMsRUFBeEIsQ0FBakM7O0FBVUE7QUFDQTtBQUNBLFVBQVMsT0FBVCxDQUFpQixLQUFLLEtBQXRCLEVBQTZCLEtBQUssTUFBbEM7O0FBRUE7QUFDQSxVQUFTLFNBQVQsQ0FBbUIsT0FBbkIsR0FBNkIsSUFBN0I7QUFDQSxVQUFTLFNBQVQsQ0FBbUIsSUFBbkIsR0FBMEIsTUFBTSxnQkFBaEM7O0FBRUE7QUFDQTtBQUNBLE9BQU0sWUFBWSxTQUFTLGFBQVQsQ0FBdUIsTUFBdkIsQ0FBbEI7QUFDQSxXQUFVLFdBQVYsQ0FBc0IsU0FBUyxVQUEvQjs7QUFFQTtBQUNBO0FBQ0EsUUFBTyxnQkFBUCxDQUF3QixRQUF4QixFQUFrQyxNQUFNOztBQUV2QyxPQUFLLE1BQUwsR0FBYyxPQUFPLFdBQXJCO0FBQ0EsT0FBSyxLQUFMLEdBQWEsT0FBTyxVQUFwQjs7QUFFQSxXQUFTLE9BQVQsQ0FBaUIsS0FBSyxLQUF0QixFQUE2QixLQUFLLE1BQWxDOztBQUVBLE9BQUssTUFBTCxDQUFZLE1BQVosR0FBcUIsS0FBSyxLQUFMLEdBQWEsS0FBSyxNQUF2QztBQUNBLE9BQUssTUFBTCxDQUFZLHNCQUFaO0FBRUEsRUFWRCxFQVVHLEtBVkg7QUFZQSxDQS9ERDs7QUFpRUE7OztBQUdBLEtBQUssWUFBTCxHQUFvQixZQUFZOztBQUUvQjtBQUNBO0FBQ0E7QUFDQSxPQUFNLGtCQUFrQixJQUFJLE1BQU0sZUFBVixDQUN2QixJQUFJLE1BQU0sS0FBVixDQUFnQixTQUFoQixDQUR1QixFQUV2QixJQUFJLE1BQU0sS0FBVixDQUFnQixTQUFoQixDQUZ1QixFQUd2QixDQUh1QixDQUF4Qjs7QUFPQTtBQUNBO0FBQ0EsT0FBTSxjQUFjLElBQUksTUFBTSxnQkFBVixDQUEyQixRQUEzQixFQUFxQyxHQUFyQyxDQUFwQjs7QUFFQTtBQUNBLGFBQVksUUFBWixDQUFxQixHQUFyQixDQUF5QixDQUF6QixFQUE0QixDQUE1QixFQUErQixFQUEvQjs7QUFFQTtBQUNBLGFBQVksVUFBWixHQUF5QixJQUF6QjtBQUNBOztBQUVBO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLElBQTFCLEdBQWlDLENBQUMsRUFBbEM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsS0FBMUIsR0FBa0MsRUFBbEM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsR0FBMUIsR0FBZ0MsRUFBaEM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsTUFBMUIsR0FBbUMsQ0FBQyxFQUFwQztBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixJQUExQixHQUFpQyxDQUFqQztBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixHQUExQixHQUFnQyxJQUFoQzs7QUFFQTtBQUNBO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE9BQW5CLENBQTJCLEtBQTNCLEdBQW1DLElBQW5DO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE9BQW5CLENBQTJCLE1BQTNCLEdBQW9DLElBQXBDO0FBQ0EsTUFBSyxXQUFMLEdBQW1CLFdBQW5COztBQUVBLE1BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxXQUFmO0FBQ0EsTUFBSyxLQUFMLENBQVcsR0FBWCxDQUFlLGVBQWY7QUFDQSxDQXZDRDs7QUF5Q0E7OztBQUdBLEtBQUssYUFBTCxHQUFxQixZQUFZOztBQUVoQyxPQUFNLFNBQVMsUUFBUSxhQUFSLENBQWY7QUFDQSxPQUFNLFNBQVMsUUFBUSxhQUFSLENBQWY7QUFDQSxPQUFNLFNBQVMsUUFBUSxhQUFSLENBQWY7O0FBRUEsTUFBSyxNQUFMLEdBQWMsSUFBSSxNQUFKLEVBQWQ7QUFDQSxNQUFLLE1BQUwsR0FBYyxJQUFJLE1BQUosRUFBZDs7QUFFQTtBQUNBLE1BQUssTUFBTCxHQUFjLElBQUksTUFBSixFQUFkO0FBRUEsQ0FaRDs7QUFjQSxLQUFLLElBQUwsR0FBWSxVQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLEtBQWhCLEVBQXVCLFNBQVMsS0FBaEMsRUFBdUM7O0FBRWxELFNBQVEsSUFBSSxNQUFNLEtBQVYsQ0FBZ0IsU0FBVSxPQUFNLEtBQUssTUFBTCxDQUFZLE9BQVosQ0FBb0IsRUFBQyxLQUFLLENBQU4sRUFBUyxLQUFLLEdBQWQsRUFBcEIsQ0FBd0MsY0FBeEUsQ0FBUjs7QUFFQSxLQUFJLFFBQUo7O0FBRUEsS0FBSSxNQUFKLEVBQVk7QUFDWCxhQUFXLE1BQU0sa0JBQU4sQ0FBeUI7QUFDbkMsVUFBTyxLQUQ0QjtBQUVuQyxhQUFVLENBRnlCO0FBR25DLFlBQVM7QUFIMEIsR0FBekIsQ0FBWDtBQUtBLEVBTkQsTUFRSztBQUNKLGFBQVcsSUFBSSxNQUFNLGlCQUFWLENBQTRCO0FBQ3RDLFVBQU87QUFEK0IsR0FBNUIsQ0FBWDtBQUdBOztBQUVFLEtBQUksV0FBVyxJQUFJLE1BQU0sUUFBVixFQUFmO0FBQ0EsVUFBUyxRQUFULENBQWtCLElBQWxCLENBQXVCLENBQXZCO0FBQ0EsVUFBUyxRQUFULENBQWtCLElBQWxCLENBQXVCLENBQXZCOztBQUVBLE9BQU0sT0FBTyxJQUFJLE1BQU0sSUFBVixDQUFlLFFBQWYsRUFBeUIsUUFBekIsQ0FBYjtBQUNBLE1BQUssSUFBTCxHQUFZLFVBQVUsS0FBSyxNQUFMLENBQVksTUFBWixFQUF0Qjs7QUFFQSxRQUFPLElBQVA7QUFFSCxDQTdCRDs7QUErQkE7OztBQUdBLE1BQU0sUUFBUTtBQUNiLFFBQU8sQ0FETTtBQUViLE9BQU07QUFGTyxDQUFkOztBQUtBLEtBQUssSUFBTCxHQUFZLFVBQVUsT0FBTyxDQUFqQixFQUFvQjs7QUFFL0IsU0FBUSxJQUFSOztBQUVBLE9BQU0sS0FBTixHQUFjLE9BQU8sTUFBTSxJQUEzQjtBQUNBLE9BQU0sSUFBTixHQUFhLElBQWI7O0FBRUE7QUFDQSxNQUFLLFFBQUwsQ0FBYyxNQUFkLENBQXFCLEtBQXJCOztBQUVBO0FBQ0EsTUFBSyxLQUFMLENBQVcsZUFBWCxDQUE0QixLQUFELElBQVc7O0FBRXJDLE1BQUksTUFBTSxJQUFOLElBQWMsTUFBTSxJQUFOLENBQVcsS0FBWCxDQUFpQixPQUFqQixDQUFsQixFQUE2QztBQUM1QyxTQUFNLFFBQU4sQ0FBZSxrQkFBZixHQUFvQyxJQUFwQztBQUNBOztBQUVELFFBQU0sTUFBTixJQUFnQixNQUFNLE1BQU4sQ0FBYSxLQUFiLENBQWhCO0FBRUEsRUFSRDs7QUFVQTtBQUNBLE1BQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsS0FBbkI7O0FBRUE7QUFDQSxNQUFLLFFBQUwsQ0FBYyxNQUFkLENBQXFCLEtBQUssS0FBMUIsRUFBaUMsS0FBSyxNQUF0Qzs7QUFFQTtBQUNBLFFBQU8scUJBQVAsQ0FBNkIsS0FBSyxJQUFMLENBQVUsSUFBVixDQUFlLElBQWYsQ0FBN0I7QUFDQSxDQTdCRDs7QUFpQ0EsT0FBTyxPQUFQLEdBQWlCLElBQWpCOzs7QUN6UUEsTUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiOztBQUVBOzs7QUFHQSxNQUFNLE1BQU4sU0FBcUIsTUFBTSxJQUEzQixDQUFnQzs7QUFFL0I7OztBQUdBLGVBQWM7O0FBRWI7O0FBRUEsT0FBSyxJQUFMLEdBQVksUUFBWjs7QUFFQSxPQUFLLFFBQUwsR0FBZ0IsSUFBSSxNQUFNLGFBQVYsQ0FBd0IsRUFBeEIsRUFBNEIsRUFBNUIsQ0FBaEI7O0FBRUEsT0FBSyxRQUFMLEdBQWdCLElBQUksTUFBTSxtQkFBVixDQUE4QjtBQUM3QyxVQUFPLElBQUksTUFBTSxLQUFWLENBQWdCLFNBQWhCLENBRHNDO0FBRTdDLFNBQU0sTUFBTTtBQUZpQyxHQUE5QixDQUFoQjs7QUFLQSxPQUFLLFVBQUwsR0FBa0IsS0FBbEI7QUFDQSxPQUFLLGFBQUwsR0FBcUIsSUFBckI7O0FBRUEsT0FBSyxLQUFMLENBQVcsR0FBWCxDQUFlLElBQWY7QUFFQTs7QUFFRDs7O0FBR0EsUUFBTyxLQUFQLEVBQWMsSUFBZCxFQUFvQixDQUVuQjs7QUE5QjhCOztBQWtDaEMsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7QUN2Q0EsTUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiO0FBQ0EsTUFBTSxLQUFLLEtBQUssRUFBaEI7O0FBRUE7OztBQUdBLE1BQU0sTUFBTixTQUFxQixNQUFNLFdBQTNCLENBQXVDOztBQUV0Qzs7O0FBR0EsZUFBYzs7QUFFYixRQUFNLFdBQVcsS0FBSyxLQUFMLENBQVcsTUFBWCxDQUFrQixRQUFuQzs7QUFFQSxRQUFNLFlBQVksS0FBSyxLQUFMLENBQVcsTUFBWCxDQUFrQixTQUFwQztBQUNBLFFBQU0sV0FBVyxJQUFJLE1BQU0sbUJBQVYsQ0FBOEI7QUFDOUMsVUFBTyxJQUFJLE1BQU0sS0FBVixDQUFnQixTQUFoQixDQUR1QztBQUU5QyxhQUFVO0FBRm9DLEdBQTlCLENBQWpCOztBQUtBLFFBQU0sUUFBTixFQUFnQixRQUFoQjs7QUFFQSxPQUFLLElBQUwsR0FBWSxRQUFaOztBQUVBLE9BQUssVUFBTCxHQUFrQixJQUFsQjtBQUNBLE9BQUssYUFBTCxHQUFxQixLQUFyQjs7QUFFQTtBQUNBLE9BQUssS0FBTCxHQUFhLElBQUksTUFBTSxjQUFWLENBQXlCLElBQXpCLENBQWI7O0FBRUE7QUFDQSxPQUFLLFFBQUwsR0FBZ0IsSUFBSSxNQUFNLE9BQVYsQ0FBa0IsQ0FBbEIsRUFBcUIsQ0FBckIsRUFBd0IsQ0FBeEIsQ0FBaEI7O0FBRUE7QUFDQSxPQUFLLFdBQUwsR0FBbUIsR0FBbkI7O0FBRUE7QUFDQSxPQUFLLFFBQUwsQ0FBYyxPQUFkLENBQXNCLEtBQUssRUFBTCxHQUFVLENBQWhDO0FBQ0EsT0FBSyxRQUFMLENBQWMsa0JBQWQ7QUFDQSxPQUFLLFFBQUwsQ0FBYyxvQkFBZDtBQUNBLE9BQUssUUFBTCxDQUFjLG1CQUFkOztBQUVBO0FBQ0EsT0FBSyxPQUFMLEdBQWUsRUFBZjs7QUFFQSxPQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksS0FBSyxRQUFMLENBQWMsVUFBZCxDQUF5QixNQUE3QyxFQUFxRCxHQUFyRCxFQUEwRDs7QUFFekQsU0FBTSxPQUFPLEtBQUssUUFBTCxDQUFjLFVBQWQsQ0FBeUIsQ0FBekIsQ0FBYjtBQUNBLFNBQU0sU0FBUyxLQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLElBQXRCLENBQWY7O0FBRUEsVUFBTyxrQkFBUCxDQUEwQixDQUExQixFQUE2QixJQUE3Qjs7QUFFQSxRQUFLLE9BQUwsQ0FBYSxLQUFLLElBQWxCLElBQTBCLE1BQTFCOztBQUVBLFdBQVEsR0FBUixDQUFZLE1BQVo7QUFFQTs7QUFHRCxPQUFLLEtBQUwsQ0FBVyxHQUFYLENBQWUsSUFBZjtBQUNBOztBQUVEOzs7QUFHQSxRQUFPLEtBQVAsRUFBYzs7QUFFYjtBQUNBLFFBQU0sVUFBVSxJQUFJLE1BQU0sT0FBVixDQUNmLENBQUMsS0FBSyxRQUFMLENBQWMsU0FEQSxFQUVmLENBQUMsS0FBSyxRQUFMLENBQWMsU0FGQSxDQUFoQjs7QUFLQTtBQUNBLFFBQU0sUUFBUSxRQUFRLE1BQVIsRUFBZDs7QUFFQTtBQUNBLE9BQUssUUFBTCxDQUFjLENBQWQsSUFBbUIsQ0FBQyxRQUFRLENBQVIsR0FBWSxLQUFLLFFBQUwsQ0FBYyxDQUEzQixJQUFnQyxHQUFoQyxHQUFzQyxNQUFNLEtBQS9EO0FBQ0EsT0FBSyxRQUFMLENBQWMsQ0FBZCxJQUFtQixDQUFDLFFBQVEsQ0FBUixHQUFZLEtBQUssUUFBTCxDQUFjLENBQTNCLElBQWdDLEdBQWhDLEdBQXNDLE1BQU0sS0FBL0Q7O0FBRUE7QUFDQSxNQUFJLFFBQVEsQ0FBWixFQUFlLEtBQUssUUFBTCxDQUFjLGNBQWQsQ0FBNkIsS0FBN0I7O0FBRWY7QUFDQSxPQUFLLFFBQUwsQ0FBYyxXQUFkLENBQTBCLENBQUMsS0FBSyxXQUFoQyxFQUE2QyxDQUFDLEtBQUssV0FBbkQ7O0FBRUE7QUFDQSxPQUFLLFFBQUwsQ0FBYyxHQUFkLENBQWtCLEtBQUssUUFBdkI7O0FBR0E7QUFDQSxRQUFNLGlCQUFpQixLQUFLLEtBQUwsQ0FBVyxLQUFLLFFBQUwsQ0FBYyxDQUF6QixFQUE0QixLQUFLLFFBQUwsQ0FBYyxDQUExQyxDQUF2Qjs7QUFFQTtBQUNBLE1BQUksT0FBTyxpQkFBaUIsS0FBSyxRQUFMLENBQWMsQ0FBMUM7O0FBRUE7QUFDQSxNQUFJLEtBQUssR0FBTCxDQUFTLElBQVQsSUFBaUIsS0FBSyxFQUExQixFQUE4Qjs7QUFFN0IsUUFBSyxRQUFMLENBQWMsQ0FBZCxJQUFtQixLQUFLLEVBQUwsR0FBVSxDQUFWLEdBQWMsS0FBSyxJQUFMLENBQVUsSUFBVixDQUFqQztBQUNBLFVBQU8saUJBQWlCLEtBQUssUUFBTCxDQUFjLENBQXRDO0FBRUE7O0FBRUQ7QUFDQSxPQUFLLFFBQUwsQ0FBYyxDQUFkLElBQW1CLE9BQU8sSUFBUCxHQUFjLE1BQU0sS0FBdkM7O0FBRUE7QUFDQSxPQUFLLEtBQUwsQ0FBVyxNQUFYLENBQWtCLE1BQU0sS0FBeEI7QUFDQTs7QUFFRDs7O0FBR0EsTUFBSyxRQUFMLEVBQWUsU0FBUyxDQUF4QixFQUEyQjtBQUMxQixTQUFPLEtBQUssS0FBTCxDQUNMLFVBREssQ0FDTSxRQUROLEVBRUwsa0JBRkssQ0FFYyxNQUZkLEVBR0wsSUFISyxFQUFQO0FBSUE7O0FBbEhxQzs7QUFzSHZDLE9BQU8sT0FBUCxHQUFpQixNQUFqQjs7O0FDNUhBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLE1BQU0sV0FBVyxRQUFRLFlBQVIsQ0FBakI7O0FBRUE7OztBQUdBLE1BQU0sZUFBTixTQUE4QixRQUE5QixDQUF1Qzs7QUFFdEMsZUFBYzs7QUFFYjs7QUFFQSxPQUFLLEdBQUwsQ0FBUyxHQUFULENBQWEsSUFBYixFQUFtQixXQUFuQixFQUFnQyxDQUFDLENBQWpDLEVBQW9DLENBQXBDLEVBQXVDLElBQXZDLENBQTRDLElBQTVDLEVBQWtELE1BQWxEO0FBQ0EsT0FBSyxHQUFMLENBQVMsR0FBVCxDQUFhLElBQWIsRUFBbUIsV0FBbkIsRUFBZ0MsQ0FBQyxDQUFqQyxFQUFvQyxDQUFwQyxFQUF1QyxJQUF2QyxDQUE0QyxJQUE1QyxFQUFrRCxNQUFsRDtBQUNBLE9BQUssR0FBTCxDQUFTLEdBQVQsQ0FBYSxJQUFiLEVBQW1CLFlBQW5CLEVBQWlDLE1BQWpDO0FBRUE7O0FBRUQsS0FBSSxZQUFKLEdBQW1COztBQUVsQixTQUFPLEtBQUssT0FBTCxDQUNOLEtBQUssT0FBTCxDQUFhLE1BRFAsRUFFTjtBQUNDLGFBQVUsR0FEWDtBQUVDLGFBQVU7QUFGWCxHQUZNLENBQVA7QUFRQTs7QUFFRCxLQUFJLFNBQUosR0FBZ0I7O0FBRWYsU0FBTyxLQUFLLE9BQUwsQ0FDTixLQUFLLE9BQUwsQ0FBYSxNQURQLEVBRU47QUFDQyxhQUFVLEdBRFg7QUFFQyxhQUFVO0FBRlgsR0FGTSxDQUFQO0FBUUE7O0FBRUQsS0FBSSxTQUFKLEdBQWdCOztBQUVmLFNBQU8sS0FBSyxPQUFMLENBQ04sS0FBSyxPQUFMLENBQWEsTUFEUCxFQUVOO0FBQ0MsYUFBVSxHQURYO0FBRUMsYUFBVTtBQUZYLEdBRk0sQ0FBUDtBQVFBOztBQTlDcUM7O0FBa0R2QyxPQUFPLE9BQVAsR0FBaUIsZUFBakI7OztBQ3hEQSxNQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxNQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7O0FBRUEsT0FBTyxnQkFBUCxDQUF3QixNQUF4QixFQUFnQyxZQUFZOztBQUUzQyxNQUFLLElBQUwsR0FBWSxJQUFaLENBQWlCLE1BQU07O0FBRXRCLE9BQUssV0FBTDtBQUNBLE9BQUssWUFBTDtBQUNBLE9BQUssYUFBTDs7QUFFQSxVQUFRLEdBQVIsQ0FBWSxJQUFaOztBQUVBLFNBQU8sSUFBUCxHQUFjLElBQWQ7O0FBRUEsT0FBSyxJQUFMO0FBRUEsRUFaRDtBQWNBLENBaEJELEVBZ0JHLEtBaEJIOzs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxudmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbmZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG59XG5cbnJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxucmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG5cbmZ1bmN0aW9uIHBsYWNlSG9sZGVyc0NvdW50IChiNjQpIHtcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gIHJldHVybiBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKGI2NCkge1xuICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgcmV0dXJuIGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVyc0NvdW50KGI2NClcbn1cblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICBwbGFjZUhvbGRlcnMgPSBwbGFjZUhvbGRlcnNDb3VudChiNjQpXG5cbiAgYXJyID0gbmV3IEFycihsZW4gKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gbGVuIC0gNCA6IGxlblxuXG4gIHZhciBMID0gMFxuXG4gIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIG91dHB1dCA9ICcnXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAyXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9PSdcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgKHVpbnQ4W2xlbiAtIDFdKVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDEwXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz0nXG4gIH1cblxuICBwYXJ0cy5wdXNoKG91dHB1dClcblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG4vKlxuICogRXhwb3J0IGtNYXhMZW5ndGggYWZ0ZXIgdHlwZWQgYXJyYXkgc3VwcG9ydCBpcyBkZXRlcm1pbmVkLlxuICovXG5leHBvcnRzLmtNYXhMZW5ndGggPSBrTWF4TGVuZ3RoKClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5fX3Byb3RvX18gPSB7X19wcm90b19fOiBVaW50OEFycmF5LnByb3RvdHlwZSwgZm9vOiBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9fVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1ZmZlciAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChrTWF4TGVuZ3RoKCkgPCBsZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCB0eXBlZCBhcnJheSBsZW5ndGgnKVxuICB9XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIGlmICh0aGF0ID09PSBudWxsKSB7XG4gICAgICB0aGF0ID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gICAgfVxuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gIH1cblxuICByZXR1cm4gdGhhdFxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiAhKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZ09yT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnSWYgZW5jb2RpbmcgaXMgc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcnXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZSh0aGlzLCBhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20odGhpcywgYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tICh0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIGEgbnVtYmVyJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KVxuICB9XG5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhhdCwgdmFsdWUpXG59XG5cbi8qKlxuICogRnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdG8gQnVmZmVyKGFyZywgZW5jb2RpbmcpIGJ1dCB0aHJvd3MgYSBUeXBlRXJyb3JcbiAqIGlmIHZhbHVlIGlzIGEgbnVtYmVyLlxuICogQnVmZmVyLmZyb20oc3RyWywgZW5jb2RpbmddKVxuICogQnVmZmVyLmZyb20oYXJyYXkpXG4gKiBCdWZmZXIuZnJvbShidWZmZXIpXG4gKiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlclssIGJ5dGVPZmZzZXRbLCBsZW5ndGhdXSlcbiAqKi9cbkJ1ZmZlci5mcm9tID0gZnVuY3Rpb24gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGZyb20obnVsbCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgICB2YWx1ZTogbnVsbCxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jICh0aGF0LCBzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhudWxsLCBzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHRoYXQsIHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaXplOyArK2kpIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogRXF1aXZhbGVudCB0byBCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqICovXG5CdWZmZXIuYWxsb2NVbnNhZmUgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cbi8qKlxuICogRXF1aXZhbGVudCB0byBTbG93QnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG5cbiAgdmFyIGFjdHVhbCA9IHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIHRoYXQgPSB0aGF0LnNsaWNlKDAsIGFjdHVhbClcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ29mZnNldFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnbGVuZ3RoXFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBhcnJheVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbUFycmF5TGlrZSh0aGF0LCBhcnJheSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmopIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmopKSB7XG4gICAgdmFyIGxlbiA9IGNoZWNrZWQob2JqLmxlbmd0aCkgfCAwXG4gICAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW4pXG5cbiAgICBpZiAodGhhdC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGF0XG4gICAgfVxuXG4gICAgb2JqLmNvcHkodGhhdCwgMCwgMCwgbGVuKVxuICAgIHJldHVybiB0aGF0XG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIG9iai5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgfHwgJ2xlbmd0aCcgaW4gb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggIT09ICdudW1iZXInIHx8IGlzbmFuKG9iai5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIodGhhdCwgMClcbiAgICAgIH1cbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iailcbiAgICB9XG5cbiAgICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmouZGF0YSlcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgYXJyYXktbGlrZSBvYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGgoKWAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgQXJyYXlCdWZmZXIuaXNWaWV3ID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgc3RyaW5nIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXA2NCA9IGZ1bmN0aW9uIHN3YXA2NCAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgOCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gOCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDcpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDYpXG4gICAgc3dhcCh0aGlzLCBpICsgMiwgaSArIDUpXG4gICAgc3dhcCh0aGlzLCBpICsgMywgaSArIDQpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgIC8vIENvZXJjZSB0byBOdW1iZXIuXG4gIGlmIChpc05hTihieXRlT2Zmc2V0KSkge1xuICAgIC8vIGJ5dGVPZmZzZXQ6IGl0IGl0J3MgdW5kZWZpbmVkLCBudWxsLCBOYU4sIFwiZm9vXCIsIGV0Yywgc2VhcmNoIHdob2xlIGJ1ZmZlclxuICAgIGJ5dGVPZmZzZXQgPSBkaXIgPyAwIDogKGJ1ZmZlci5sZW5ndGggLSAxKVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXQ6IG5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCArIGJ5dGVPZmZzZXRcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgIGlmIChkaXIpIHJldHVybiAtMVxuICAgIGVsc2UgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggLSAxXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICBpZiAoZGlyKSBieXRlT2Zmc2V0ID0gMFxuICAgIGVsc2UgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmFsXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICAvLyBGaW5hbGx5LCBzZWFyY2ggZWl0aGVyIGluZGV4T2YgKGlmIGRpciBpcyB0cnVlKSBvciBsYXN0SW5kZXhPZlxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmXG4gICAgICAgIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChkaXIpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggIT09IC0xKSBpIC09IGkgLSBmb3VuZEluZGV4XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYnl0ZU9mZnNldCArIHZhbExlbmd0aCA+IGFyckxlbmd0aCkgYnl0ZU9mZnNldCA9IGFyckxlbmd0aCAtIHZhbExlbmd0aFxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgZm91bmQgPSB0cnVlXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbExlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChyZWFkKGFyciwgaSArIGopICE9PSByZWFkKHZhbCwgaikpIHtcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZvdW5kKSByZXR1cm4gaVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgdHJ1ZSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uIGxhc3RJbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBmYWxzZSlcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGxhdGluMVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgKytpKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiYnVmZmVyXCIgYXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyArK2kpIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgKytpKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpIC0gMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKGNvZGUgPCAyNTYpIHtcbiAgICAgICAgdmFsID0gY29kZVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDI1NVxuICB9XG5cbiAgLy8gSW52YWxpZCByYW5nZXMgYXJlIG5vdCBzZXQgdG8gYSBkZWZhdWx0LCBzbyBjYW4gcmFuZ2UgY2hlY2sgZWFybHkuXG4gIGlmIChzdGFydCA8IDAgfHwgdGhpcy5sZW5ndGggPCBzdGFydCB8fCB0aGlzLmxlbmd0aCA8IGVuZCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIXZhbCkgdmFsID0gMFxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICAgIHRoaXNbaV0gPSB2YWxcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmlzQnVmZmVyKHZhbClcbiAgICAgID8gdmFsXG4gICAgICA6IHV0ZjhUb0J5dGVzKG5ldyBCdWZmZXIodmFsLCBlbmNvZGluZykudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyArK2kpIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gaXNuYW4gKHZhbCkge1xuICByZXR1cm4gdmFsICE9PSB2YWwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1zZWxmLWNvbXBhcmVcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuXHJcbmNsYXNzIENhbWVyYSBleHRlbmRzIFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhIHtcclxuXHRcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFxyXG5cdFx0Y29uc3QgYXNwZWN0UmF0aW8gPSBnYW1lLndpZHRoIC8gZ2FtZS5oZWlnaHRcclxuXHRcdGNvbnN0IGZpZWxkT2ZWaWV3ID0gNDBcclxuXHRcdGNvbnN0IG5lYXJQbGFuZSA9IDFcclxuXHRcdGNvbnN0IGZhclBsYW5lID0gMTAwMDBcclxuXHRcdFxyXG5cdFx0c3VwZXIoXHJcblx0XHRcdGZpZWxkT2ZWaWV3LFxyXG5cdFx0XHRhc3BlY3RSYXRpbyxcclxuXHRcdFx0bmVhclBsYW5lLFxyXG5cdFx0XHRmYXJQbGFuZVxyXG5cdFx0KVxyXG5cdFx0XHJcblx0XHRnYW1lLnNjZW5lLmFkZCh0aGlzKVxyXG5cdFx0XHJcblx0XHQvLyBSZWTDqWZpbmlyIGxlIGhhdXRcclxuXHRcdHRoaXMudXAuY29weShuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKSlcclxuXHRcdFxyXG5cdFx0Ly8gUG9zaXRpb24gZGUgbGEgY2Ftw6lyYSBwYXIgcmFwcG9ydCBhdSBqb3VldXJcclxuXHRcdHRoaXMuZGlzdGFuY2VUb1BsYXllciA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDEwLCA1KVxyXG5cclxuXHR9XHJcblx0XHJcblx0dXBkYXRlKGV2ZW50KSB7XHJcblx0XHRcclxuXHRcdC8vIEFkb3VjaXNzZW1lbnQgZHUgZMOpcGxhY2VtZW50IGRlIGxhIGNhbcOpcmFcclxuXHRcdGNvbnN0IHNwZWVkID0gMC41XHJcblx0XHRjb25zdCB0YXJnZXQgPSBnYW1lLnBsYXllci5wb3NpdGlvbi5jbG9uZSgpLmFkZCh0aGlzLmRpc3RhbmNlVG9QbGF5ZXIpXHJcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb25cclxuXHRcdFxyXG5cdFx0cG9zaXRpb24ueCArPSAodGFyZ2V0LnggLSBwb3NpdGlvbi54KSAvIHNwZWVkICogZXZlbnQuZGVsdGFcclxuXHRcdHBvc2l0aW9uLnkgKz0gKHRhcmdldC55IC0gcG9zaXRpb24ueSkgLyBzcGVlZCAqIGV2ZW50LmRlbHRhXHJcblx0XHRwb3NpdGlvbi56ICs9ICh0YXJnZXQueiAtIHBvc2l0aW9uLnopIC8gc3BlZWQgKiBldmVudC5kZWx0YVxyXG5cdFx0XHJcblx0XHQvLyBSZWdhcmRlciBsZSBqb3VldXJcclxuXHRcdHRoaXMubG9va0F0KGdhbWUucGxheWVyLmdldFdvcmxkUG9zaXRpb24oKSlcclxuXHRcdFxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDYW1lcmEiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRyZWQ6IDB4ZjI1MzQ2LFxyXG5cdHdoaXRlOiAweGQ4ZDBkMSxcclxuXHRicm93bjogMHg1OTMzMmUsXHJcblx0cGluazogMHhGNTk4NkUsXHJcblx0YnJvd25EYXJrOiAweDIzMTkwZixcclxuXHRibHVlOiAweDY4YzNjMCxcclxufTsiLCIvKipcclxuICogR8OocmUgbGVzIGNvbnRyw7RsZXMgKGNsYXZpZXIvc291cmlzIGV0IG1hbmV0dGUpIGR1IGpvdWV1clxyXG4gKi9cclxuY2xhc3MgQ29udHJvbHMge1xyXG5cdFxyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHR0aGlzLmdhbWVwYWQgPSBudWxsXHJcblx0XHR0aGlzLmRlYWR6b25lID0gMC4yXHJcblx0XHRcclxuXHRcdC8vIENvbnRyw7RsZXVyIGFjdHVlbGxlbWVudCB1dGlsaXPDqSAoJ2dhbWVwYWQnIG91ICdrZXlib2FyZCcpXHJcblx0XHR0aGlzLmNvbnRyb2xsZXIgPSAna2V5Ym9hcmQnXHJcblx0XHRcclxuXHRcdC8vIFZhbGV1cnMgc2F1dmVnYXJkw6llc1xyXG5cdFx0dGhpcy52YWx1ZXMgPSB7XHJcblx0XHRcdGtleWJvYXJkOiB7fSxcclxuXHRcdFx0Z2FtZXBhZDogbnVsbFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBWYWxldXJzIHByw6ljw6lkZW50ZXNcclxuXHRcdHRoaXMucHJldmlvdXMgPSB7XHJcblx0XHRcdGtleWJvYXJkOiB7fSxcclxuXHRcdFx0Z2FtZXBhZDogbnVsbFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBDb25zdGFudGVzXHJcblx0XHR0aGlzLkdBTUVQQUQgPSB7XHJcblx0XHRcdEE6IDAsXHJcblx0XHRcdEI6IDEsXHJcblx0XHRcdFg6IDIsXHJcblx0XHRcdFk6IDMsXHJcblx0XHRcdExCOiA0LFxyXG5cdFx0XHRSQjogNSxcclxuXHRcdFx0TFQ6IDYsXHJcblx0XHRcdFJUOiA3LFxyXG5cdFx0XHRCQUNLOiA4LFxyXG5cdFx0XHRTVEFSVDogOSxcclxuXHRcdFx0VVA6IDEyLFxyXG5cdFx0XHRET1dOOiAxMyxcclxuXHRcdFx0TEVGVDogMTQsXHJcblx0XHRcdFJJR0hUOiAxNSxcclxuXHRcdFx0XHJcblx0XHRcdExFRlRfWDogMCxcclxuXHRcdFx0TEVGVF9ZOiAxLFxyXG5cdFx0XHRSSUdIVF9YOiAyLFxyXG5cdFx0XHRSSUdIVF9ZOiAzXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQnJhbmNoZW1lbnQgZCd1bmUgbWFuZXR0ZVxyXG5cdFx0ICovXHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImdhbWVwYWRjb25uZWN0ZWRcIiwgKGV2ZW50KSA9PiB7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgZ3AgPSBldmVudC5nYW1lcGFkXHJcblx0XHRcdFxyXG5cdFx0XHRjb25zb2xlLmxvZyhcIkNvbnRyw7RsZXVyIG7CsCVkIGNvbm5lY3TDqSA6ICVzLiAlZCBib3V0b25zLCAlZCBheGVzLlwiLFxyXG5cdFx0XHRcdGdwLmluZGV4LCBncC5pZCxcclxuXHRcdFx0XHRncC5idXR0b25zLmxlbmd0aCwgZ3AuYXhlcy5sZW5ndGgpXHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmdhbWVwYWQgPSBncFxyXG5cdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAnZ2FtZXBhZCdcclxuXHJcblx0XHR9KVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEFwcHVpIHN1ciB1bmUgdG91Y2hlXHJcblx0XHQgKi9cclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMudmFsdWVzLmtleWJvYXJkW2V2ZW50LmtleV0gPSB0cnVlXHJcblx0XHRcdHRoaXMuY29udHJvbGxlciA9ICdrZXlib2FyZCdcclxuXHRcdFx0XHJcblx0XHR9KVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEFwcHVpIHN1ciB1bmUgdG91Y2hlXHJcblx0XHQgKi9cclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiB7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLnZhbHVlcy5rZXlib2FyZFtldmVudC5rZXldID0gZmFsc2VcclxuXHRcdFx0dGhpcy5jb250cm9sbGVyID0gJ2tleWJvYXJkJ1xyXG5cdFx0XHRcclxuXHRcdH0pXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogTWlzZSDDoCBqb3VyXHJcblx0ICovXHJcblx0dXBkYXRlKGV2ZW50KSB7XHJcblx0XHRcclxuXHRcdGxldCBnYW1lcGFkcyA9IG5hdmlnYXRvci5nZXRHYW1lcGFkcygpXHJcblx0XHR0aGlzLmdhbWVwYWQgPSBnYW1lcGFkc1swXVxyXG5cdFx0XHJcblx0XHRpZiAodGhpcy5nYW1lcGFkKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRjb25zdCBwcmV2aW91cyA9IHRoaXMucHJldmlvdXMuZ2FtZXBhZFxyXG5cdFx0XHRjb25zdCBjdXJyZW50ID0gdGhpcy5jb3B5R2FtZXBhZFZhbHVlcyh0aGlzLmdhbWVwYWQpXHJcblx0XHRcdFxyXG5cdFx0XHRpZiAocHJldmlvdXMpIHtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQuYnV0dG9ucy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAocHJldmlvdXMuYnV0dG9uc1tpXS5wcmVzc2VkICE9PSBjdXJyZW50LmJ1dHRvbnNbaV0ucHJlc3NlZCkge1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0dGhpcy5jb250cm9sbGVyID0gJ2dhbWVwYWQnXHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQuYXhlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAocHJldmlvdXMuYXhlc1tpXSAhPT0gY3VycmVudC5heGVzW2ldKSB7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAnZ2FtZXBhZCdcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHRcclxuXHRcdFx0dGhpcy5wcmV2aW91cy5nYW1lcGFkID0gdGhpcy52YWx1ZXMuZ2FtZXBhZFxyXG5cdFx0XHR0aGlzLnZhbHVlcy5nYW1lcGFkID0gY3VycmVudFxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBUcmFuc2Zvcm1lIHVuIGF4ZSBkZSBqb3lzdGljayBwb3VyIHByZW5kcmUgZW4gY29tcHRlIGxhIHpvbmUgbW9ydGUuXHJcblx0ICogQHBhcmFtIDxOdW1iZXI+IGF4aXNcclxuXHQgKiBAcmV0dXJuIDxOdW1iZXI+XHJcblx0ICovXHJcblx0YXBwbHlEZWFkem9uZSh4KSB7XHJcblx0XHRcclxuXHRcdGxldCBkZWFkem9uZSA9IHRoaXMuZGVhZHpvbmVcclxuXHRcdFx0XHRcclxuXHRcdHggPSB4IDwgMCA/IE1hdGgubWluKHgsIC1kZWFkem9uZSkgOiBNYXRoLm1heCh4LCBkZWFkem9uZSlcclxuXHRcdFxyXG5cdFx0cmV0dXJuIChNYXRoLmFicyh4KSAtIGRlYWR6b25lKSAvICgxIC0gZGVhZHpvbmUpICogTWF0aC5zaWduKHgpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogQXhlIFggcHJpbmNpcGFsIChqb3lzdGljayBvdSBzb3VyaXMpXHJcblx0ICogQHBhcmFtIDxOdW1iZXI+IGdhbWVwYWRBeGlzSW5kZXhcclxuXHQgKiBAcGFyYW0gPE9iamVjdD4ga2V5Ym9hcmRLZXlzIDogeyBwb3NpdGl2ZTogPFN0cmluZz4sIG5lZ2F0aXZlOiA8U3RyaW5nPiB9XHJcblx0ICovXHJcblx0Z2V0QXhpcyhnYW1lcGFkQXhpc0luZGV4LCBrZXlib2FyZEtleXMpIHtcclxuXHRcdFxyXG5cdFx0c3dpdGNoICh0aGlzLmNvbnRyb2xsZXIpIHtcclxuXHRcdFx0XHJcblx0XHRcdGNhc2UgJ2dhbWVwYWQnOlxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLnZhbHVlcy5nYW1lcGFkID09PSBudWxsKSByZXR1cm4gMFxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlcy5nYW1lcGFkLmF4ZXNbZ2FtZXBhZEF4aXNJbmRleF1cclxuXHRcdFx0XHRcclxuXHRcdFx0XHRicmVha1xyXG5cdFx0XHRcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0Y2FzZSAna2V5Ym9hcmQnOlxyXG5cdFx0XHRcclxuXHRcdFx0XHRsZXQgcG9zaXRpdmUgPSB0aGlzLnZhbHVlcy5rZXlib2FyZFtrZXlib2FyZEtleXMucG9zaXRpdmVdID8gKzEgOiAwXHJcblx0XHRcdFx0bGV0IG5lZ2F0aXZlID0gdGhpcy52YWx1ZXMua2V5Ym9hcmRba2V5Ym9hcmRLZXlzLm5lZ2F0aXZlXSA/IC0xIDogMFxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHJldHVybiBwb3NpdGl2ZSArIG5lZ2F0aXZlXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0YnJlYWtcclxuXHRcdFx0XHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogQ29waWUgdG91dGVzIGxlcyB2YWxldXJzIGR1IGdhbWVwYWQgZGFucyB1biBvYmpldFxyXG5cdCAqIEBwYXJhbSA8R2FtZXBhZD5cclxuXHQgKiBAcmV0dXJuIDxPYmplY3Q+XHJcblx0ICovXHJcblx0Y29weUdhbWVwYWRWYWx1ZXMoZ2FtZXBhZCkge1xyXG5cdFx0XHJcblx0XHRsZXQgYXhlcyA9IFtdXHJcblx0XHRsZXQgYnV0dG9ucyA9IFtdXHJcblx0XHRcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZ2FtZXBhZC5idXR0b25zLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRidXR0b25zW2ldID0ge1xyXG5cdFx0XHRcdHZhbHVlOiBnYW1lcGFkLmJ1dHRvbnNbaV0udmFsdWUsXHJcblx0XHRcdFx0cHJlc3NlZDogZ2FtZXBhZC5idXR0b25zW2ldLnByZXNzZWRcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBnYW1lcGFkLmF4ZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHJcblx0XHRcdGF4ZXNbaV0gPSB0aGlzLmFwcGx5RGVhZHpvbmUoZ2FtZXBhZC5heGVzW2ldKVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0YXhlczogYXhlcyxcclxuXHRcdFx0YnV0dG9uczogYnV0dG9uc1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0fVxyXG5cdFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2xzXHJcblxyXG4iLCJjb25zdCBjb2xvcnMgPSByZXF1aXJlKCcuL2NvbG9ycycpXHJcbmNvbnN0IENoYW5jZSA9IHJlcXVpcmUoJ2NoYW5jZScpXHJcbmNvbnN0IGdhbWUgPSB7fVxyXG5cclxuLyoqXHJcbiAqIEZpY2hpZXJzIEpTT05cclxuICovXHJcbmdhbWUuZmlsZXMgPSB7XHJcblx0cGxheWVyOiB7XHJcblx0XHRwYXRoOiAnLi4vbW9kZWxzL3BsYXllci5qc29uJ1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENoYXJnZXIgbGVzIGZpY2hpZXJzXHJcbiAqL1xyXG5nYW1lLmxvYWQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuXHJcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHJcblx0XHQvLyBMb2FkZXJcclxuXHRcdGNvbnN0IGxvYWRlciA9IG5ldyBUSFJFRS5KU09OTG9hZGVyKClcclxuXHRcdFxyXG5cdFx0Ly8gVsOpcmlmaWVyIHF1J3VuIGZpY2hpZXIgZXN0IGNoYXJnw6lcclxuXHRcdGNvbnN0IGlzTG9hZGVkID0gKGZpbGUpID0+IHtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBmaWxlLmdlb21ldHJ5ICE9PSB1bmRlZmluZWQgfHwgZmlsZS5tYXRlcmlhbHMgIT09IHVuZGVmaW5lZFxyXG5cdFx0XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdC8vIENoYXJnZXIgY2hhcXVlIGZpY2hpZXJcclxuXHRcdGZvciAobGV0IGYgaW4gdGhpcy5maWxlcykge1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGZpbGUgPSB0aGlzLmZpbGVzW2ZdXHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoISBpc0xvYWRlZChmaWxlKSkge1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGxvYWRlci5sb2FkKGZpbGUucGF0aCwgKGdlb21ldHJ5LCBtYXRlcmlhbHMpID0+IHtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0ZmlsZS5nZW9tZXRyeSA9IGdlb21ldHJ5XHJcblx0XHRcdFx0XHRmaWxlLm1hdGVyaWFscyA9IG1hdGVyaWFsc1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRjb25zb2xlLmluZm8oYExvYWRlZDogJHtmaWxlLnBhdGh9YClcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0bGV0IGFsbExvYWRlZCA9IHRydWVcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0Zm9yIChsZXQgZmYgaW4gdGhpcy5maWxlcykge1xyXG5cclxuXHRcdFx0XHRcdFx0YWxsTG9hZGVkID0gYWxsTG9hZGVkICYmIGlzTG9hZGVkKHRoaXMuZmlsZXNbZmZdKVxyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGlmIChhbGxMb2FkZWQpIHJlc29sdmUoKVxyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fSlcclxuXHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHJcblx0fSlcclxuXHJcbn1cclxuIFxyXG4vKipcclxuICogQ3LDqWF0aW9uIGRlIGxhIHNjw6huZVxyXG4gKi9cclxuZ2FtZS5jcmVhdGVTY2VuZSA9IGZ1bmN0aW9uICgpIHtcclxuXHRcclxuXHQvLyBHZXQgdGhlIHdpZHRoIGFuZCB0aGUgaGVpZ2h0IG9mIHRoZSBzY3JlZW4sXHJcblx0Ly8gdXNlIHRoZW0gdG8gc2V0IHVwIHRoZSBhc3BlY3QgcmF0aW8gb2YgdGhlIGNhbWVyYSBcclxuXHQvLyBhbmQgdGhlIHNpemUgb2YgdGhlIHJlbmRlcmVyLlxyXG5cdHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0XHJcblx0dGhpcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoXHJcblxyXG5cdC8vIENyZWF0ZSB0aGUgc2NlbmVcclxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKClcclxuXHRcclxuXHQvLyBSYW5kb21cclxuXHR0aGlzLmNoYW5jZSA9IG5ldyBDaGFuY2UoJzQ1MzY0NTMnKVxyXG5cdFxyXG5cdC8vIGRhdC5ndWlcclxuXHR0aGlzLmd1aSA9IG5ldyBkYXQuR1VJKClcclxuXHRcclxuXHQvLyBDb250csO0bGVzXHJcblx0Y29uc3QgQ29udHJvbHMgPSByZXF1aXJlKCcuL3NvbGFyaXMtY29udHJvbHMnKVxyXG5cdHRoaXMuY29udHJvbHMgPSBuZXcgQ29udHJvbHNcclxuXHRcclxuXHQvLyBBZGQgYSBmb2cgZWZmZWN0IHRvIHRoZSBzY2VuZSBzYW1lIGNvbG9yIGFzIHRoZVxyXG5cdC8vIGJhY2tncm91bmQgY29sb3IgdXNlZCBpbiB0aGUgc3R5bGUgc2hlZXRcclxuXHQvLyB0aGlzLnNjZW5lLmZvZyA9IG5ldyBUSFJFRS5Gb2cobmV3IFRIUkVFLkNvbG9yKFwiIzVEQkRFNVwiKSwgMTUwLCAzMDApXHJcblx0XHJcblx0Ly8gQ3JlYXRlIHRoZSByZW5kZXJlclxyXG5cdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHsgXHJcblx0XHQvLyBBbGxvdyB0cmFuc3BhcmVuY3kgdG8gc2hvdyB0aGUgZ3JhZGllbnQgYmFja2dyb3VuZFxyXG5cdFx0Ly8gd2UgZGVmaW5lZCBpbiB0aGUgQ1NTXHJcblx0XHRhbHBoYTogdHJ1ZSwgXHJcblxyXG5cdFx0Ly8gQWN0aXZhdGUgdGhlIGFudGktYWxpYXNpbmcgdGhpcyBpcyBsZXNzIHBlcmZvcm1hbnQsXHJcblx0XHQvLyBidXQsIGFzIG91ciBwcm9qZWN0IGlzIGxvdy1wb2x5IGJhc2VkLCBpdCBzaG91bGQgYmUgZmluZSA6KVxyXG5cdFx0YW50aWFsaWFzOiB0cnVlIFxyXG5cdH0pXHJcblxyXG5cdC8vIERlZmluZSB0aGUgc2l6ZSBvZiB0aGUgcmVuZGVyZXIgaW4gdGhpcyBjYXNlLFxyXG5cdC8vIGl0IHdpbGwgZmlsbCB0aGUgZW50aXJlIHNjcmVlblxyXG5cdHJlbmRlcmVyLnNldFNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpXHJcblx0XHJcblx0Ly8gRW5hYmxlIHNoYWRvdyByZW5kZXJpbmdcclxuXHRyZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWVcclxuXHRyZW5kZXJlci5zaGFkb3dNYXAudHlwZSA9IFRIUkVFLlBDRlNvZnRTaGFkb3dNYXBcclxuXHRcclxuXHQvLyBBZGQgdGhlIERPTSBlbGVtZW50IG9mIHRoZSByZW5kZXJlciB0byB0aGUgXHJcblx0Ly8gY29udGFpbmVyIHdlIGNyZWF0ZWQgaW4gdGhlIEhUTUxcclxuXHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluJylcclxuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyZXIuZG9tRWxlbWVudClcclxuXHRcclxuXHQvLyBMaXN0ZW4gdG8gdGhlIHNjcmVlbjogaWYgdGhlIHVzZXIgcmVzaXplcyBpdFxyXG5cdC8vIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBjYW1lcmEgYW5kIHRoZSByZW5kZXJlciBzaXplXHJcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsICgpID0+IHtcclxuXHRcdFxyXG5cdFx0dGhpcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHRcclxuXHRcdHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aFxyXG5cdFx0XHJcblx0XHRyZW5kZXJlci5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KVxyXG5cdFx0XHJcblx0XHR0aGlzLmNhbWVyYS5hc3BlY3QgPSB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHRcclxuXHRcdHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKVxyXG5cdFx0XHJcblx0fSwgZmFsc2UpXHJcblx0XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcsOpYXRpb24gZGVzIGx1bWnDqHJlc1xyXG4gKi9cclxuZ2FtZS5jcmVhdGVMaWdodHMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHJcblx0Ly8gQSBoZW1pc3BoZXJlIGxpZ2h0IGlzIGEgZ3JhZGllbnQgY29sb3JlZCBsaWdodDsgXHJcblx0Ly8gdGhlIGZpcnN0IHBhcmFtZXRlciBpcyB0aGUgc2t5IGNvbG9yLCB0aGUgc2Vjb25kIHBhcmFtZXRlciBpcyB0aGUgZ3JvdW5kIGNvbG9yLCBcclxuXHQvLyB0aGUgdGhpcmQgcGFyYW1ldGVyIGlzIHRoZSBpbnRlbnNpdHkgb2YgdGhlIGxpZ2h0XHJcblx0Y29uc3QgaGVtaXNwaGVyZUxpZ2h0ID0gbmV3IFRIUkVFLkhlbWlzcGhlcmVMaWdodChcclxuXHRcdG5ldyBUSFJFRS5Db2xvcihcIiNGRkZGRkZcIiksXHJcblx0XHRuZXcgVEhSRUUuQ29sb3IoXCIjRkZGRkZGXCIpLFxyXG5cdFx0MVxyXG5cdClcclxuXHRcclxuXHRcclxuXHQvLyBBIGRpcmVjdGlvbmFsIGxpZ2h0IHNoaW5lcyBmcm9tIGEgc3BlY2lmaWMgZGlyZWN0aW9uLiBcclxuXHQvLyBJdCBhY3RzIGxpa2UgdGhlIHN1biwgdGhhdCBtZWFucyB0aGF0IGFsbCB0aGUgcmF5cyBwcm9kdWNlZCBhcmUgcGFyYWxsZWwuIFxyXG5cdGNvbnN0IHNoYWRvd0xpZ2h0ID0gbmV3IFRIUkVFLkRpcmVjdGlvbmFsTGlnaHQoMHhmZmZmZmYsIDAuMylcclxuXHRcclxuXHQvLyBTZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgbGlnaHQgIFxyXG5cdHNoYWRvd0xpZ2h0LnBvc2l0aW9uLnNldCgwLCAwLCAxMClcclxuXHRcclxuXHQvLyBBbGxvdyBzaGFkb3cgY2FzdGluZyBcclxuXHRzaGFkb3dMaWdodC5jYXN0U2hhZG93ID0gdHJ1ZVxyXG5cdC8vIHNoYWRvd0xpZ2h0LnNoYWRvd0NhbWVyYVZpc2libGUgPSB0cnVlXHJcblxyXG5cdC8vIC8vIGRlZmluZSB0aGUgdmlzaWJsZSBhcmVhIG9mIHRoZSBwcm9qZWN0ZWQgc2hhZG93XHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5sZWZ0ID0gLTIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5yaWdodCA9IDIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS50b3AgPSAyMFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEuYm90dG9tID0gLTIwXHJcblx0c2hhZG93TGlnaHQuc2hhZG93LmNhbWVyYS5uZWFyID0gMVxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEuZmFyID0gMTAwMFxyXG5cclxuXHQvLyBkZWZpbmUgdGhlIHJlc29sdXRpb24gb2YgdGhlIHNoYWRvdzsgdGhlIGhpZ2hlciB0aGUgYmV0dGVyLCBcclxuXHQvLyBidXQgYWxzbyB0aGUgbW9yZSBleHBlbnNpdmUgYW5kIGxlc3MgcGVyZm9ybWFudFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5tYXBTaXplLndpZHRoID0gMjA0OFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5tYXBTaXplLmhlaWdodCA9IDIwNDhcclxuXHR0aGlzLnNoYWRvd0xpZ2h0ID0gc2hhZG93TGlnaHRcclxuXHJcblx0dGhpcy5zY2VuZS5hZGQoc2hhZG93TGlnaHQpXHJcblx0dGhpcy5zY2VuZS5hZGQoaGVtaXNwaGVyZUxpZ2h0KVxyXG59XHJcblxyXG4vKipcclxuICogQ3LDqWF0aW9uIGR1IHNvbFxyXG4gKi9cclxuZ2FtZS5jcmVhdGVPYmplY3RzID0gZnVuY3Rpb24gKCkge1xyXG5cdFxyXG5cdGNvbnN0IEdyb3VuZCA9IHJlcXVpcmUoJy4vZ3JvdW5kLmpzJylcclxuXHRjb25zdCBQbGF5ZXIgPSByZXF1aXJlKCcuL3BsYXllci5qcycpXHJcblx0Y29uc3QgQ2FtZXJhID0gcmVxdWlyZSgnLi9jYW1lcmEuanMnKVxyXG5cdFxyXG5cdHRoaXMuZ3JvdW5kID0gbmV3IEdyb3VuZFxyXG5cdHRoaXMucGxheWVyID0gbmV3IFBsYXllclxyXG5cdFxyXG5cdC8vIENyZWF0ZSB0aGUgY2FtZXJhXHJcblx0dGhpcy5jYW1lcmEgPSBuZXcgQ2FtZXJhXHJcblx0XHJcbn1cclxuXHJcbmdhbWUubGluZSA9IGZ1bmN0aW9uIChhLCBiLCBjb2xvciwgZGFzaGVkID0gZmFsc2UpIHtcclxuXHRcclxuXHRjb2xvciA9IG5ldyBUSFJFRS5Db2xvcihjb2xvciB8fCBgaHNsKCR7dGhpcy5jaGFuY2UuaW50ZWdlcih7bWluOiAwLCBtYXg6IDM2MH0pfSwgMTAwJSwgNTAlKWApXHJcblx0XHJcblx0bGV0IG1hdGVyaWFsXHJcblx0XHJcblx0aWYgKGRhc2hlZCkge1xyXG5cdFx0bWF0ZXJpYWwgPSBUSFJFRS5MaW5lRGFzaGVkTWF0ZXJpYWwoe1xyXG5cdFx0XHRjb2xvcjogY29sb3IsXHJcblx0XHRcdGRhc2hTaXplOiAyLFxyXG5cdFx0XHRnYXBTaXplOiAzXHJcblx0XHR9KVxyXG5cdH1cclxuXHRcclxuXHRlbHNlIHtcclxuXHRcdG1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcclxuXHRcdFx0Y29sb3I6IGNvbG9yXHJcblx0XHR9KVxyXG5cdH1cclxuXHRcclxuICAgIHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpXHJcbiAgICBnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKGEpXHJcbiAgICBnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKGIpXHJcblx0XHJcbiAgICBjb25zdCBsaW5lID0gbmV3IFRIUkVFLkxpbmUoZ2VvbWV0cnksIG1hdGVyaWFsKVxyXG4gICAgbGluZS5uYW1lID0gXCJMaW5lIFwiICsgdGhpcy5jaGFuY2Uuc3RyaW5nKClcclxuICAgIFxyXG4gICAgcmV0dXJuIGxpbmVcclxuICAgIFxyXG59XHJcblxyXG4vKipcclxuICogQm91Y2xlIGR1IGpldVxyXG4gKi9cclxuY29uc3QgZXZlbnQgPSB7XHJcblx0ZGVsdGE6IDAsXHJcblx0dGltZTogMFxyXG59XHJcblxyXG5nYW1lLmxvb3AgPSBmdW5jdGlvbiAodGltZSA9IDApIHtcclxuXHRcclxuXHR0aW1lIC89IDEwMDBcclxuXHRcclxuXHRldmVudC5kZWx0YSA9IHRpbWUgLSBldmVudC50aW1lXHJcblx0ZXZlbnQudGltZSA9IHRpbWVcclxuXHRcclxuXHQvLyBNaXNlIMOgIGpvdXIgZGVzIGNvbnRyw7RsZXNcclxuXHR0aGlzLmNvbnRyb2xzLnVwZGF0ZShldmVudClcclxuXHRcclxuXHQvLyBNaXNlIMOgIGpvdXIgZGVzIG9iamV0c1xyXG5cdHRoaXMuc2NlbmUudHJhdmVyc2VWaXNpYmxlKChjaGlsZCkgPT4ge1xyXG5cdFx0XHJcblx0XHRpZiAoY2hpbGQubmFtZSAmJiBjaGlsZC5uYW1lLm1hdGNoKC9eTGluZS8pKSB7XHJcblx0XHRcdGNoaWxkLmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWVcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Y2hpbGQudXBkYXRlICYmIGNoaWxkLnVwZGF0ZShldmVudClcclxuXHRcdFxyXG5cdH0pXHJcblx0XHJcblx0Ly8gTWlzZSDDoCBqb3VyIGRlIGxhIGNhbcOpcmFcclxuXHR0aGlzLmNhbWVyYS51cGRhdGUoZXZlbnQpXHJcblx0XHJcblx0Ly8gQWZmaWNoYWdlXHJcblx0dGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEpXHJcblx0XHJcblx0Ly8gUHJvY2hhaW5lIGZyYW1lXHJcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLmxvb3AuYmluZCh0aGlzKSlcclxufVxyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGdhbWUiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuXHJcbi8qKlxyXG4gKiBDbGFzcyBHcm91bmRcclxuICovXHJcbmNsYXNzIEdyb3VuZCBleHRlbmRzIFRIUkVFLk1lc2gge1xyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIEdyb3VuZCBjb25zdHJ1Y3RvclxyXG5cdCAqL1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHRzdXBlcigpXHJcblx0XHRcclxuXHRcdHRoaXMubmFtZSA9IFwiR3JvdW5kXCJcclxuXHRcclxuXHRcdHRoaXMuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuUGxhbmVHZW9tZXRyeSgyMCwgMjApXHJcblx0XHRcclxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaExhbWJlcnRNYXRlcmlhbCh7XHJcblx0XHRcdGNvbG9yOiBuZXcgVEhSRUUuQ29sb3IoJyM5REREODcnKSxcclxuXHRcdFx0c2lkZTogVEhSRUUuRG91YmxlU2lkZVxyXG5cdFx0fSlcclxuXHRcdFxyXG5cdFx0dGhpcy5jYXN0U2hhZG93ID0gZmFsc2VcclxuXHRcdHRoaXMucmVjZWl2ZVNoYWRvdyA9IHRydWVcclxuXHRcdFxyXG5cdFx0Z2FtZS5zY2VuZS5hZGQodGhpcylcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBNaXNlIMOgIGpvdXJcclxuXHQgKi9cclxuXHR1cGRhdGUoZGVsdGEsIHRpbWUpIHtcclxuXHRcdFxyXG5cdH1cclxuXHRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcm91bmQiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgUEkgPSBNYXRoLlBJXHJcblxyXG4vKipcclxuICogQ2xhc3MgUGxheWVyXHJcbiAqL1xyXG5jbGFzcyBQbGF5ZXIgZXh0ZW5kcyBUSFJFRS5Ta2lubmVkTWVzaCB7XHJcblx0XHJcblx0LyoqXHJcblx0ICogUGxheWVyIGNvbnN0cnVjdG9yXHJcblx0ICovXHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRcclxuXHRcdGNvbnN0IGdlb21ldHJ5ID0gZ2FtZS5maWxlcy5wbGF5ZXIuZ2VvbWV0cnlcclxuXHRcdFxyXG5cdFx0Y29uc3QgbWF0ZXJpYWxzID0gZ2FtZS5maWxlcy5wbGF5ZXIubWF0ZXJpYWxzXHJcblx0XHRjb25zdCBtYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoTGFtYmVydE1hdGVyaWFsKHtcclxuXHRcdFx0Y29sb3I6IG5ldyBUSFJFRS5Db2xvcignI0Y2QzM1NycpLFxyXG5cdFx0XHRza2lubmluZzogdHJ1ZVxyXG5cdFx0fSlcclxuXHRcdFx0XHJcblx0XHRzdXBlcihnZW9tZXRyeSwgbWF0ZXJpYWwpXHJcblx0XHRcclxuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyXCJcclxuXHRcdFxyXG5cdFx0dGhpcy5jYXN0U2hhZG93ID0gdHJ1ZVxyXG5cdFx0dGhpcy5yZWNlaXZlU2hhZG93ID0gZmFsc2VcclxuXHRcdFxyXG5cdFx0Ly8gR2VzdGlvbm5haXJlIGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLm1peGVyID0gbmV3IFRIUkVFLkFuaW1hdGlvbk1peGVyKHRoaXMpXHJcblx0XHRcclxuXHRcdC8vIFZpdGVzc2UgZGUgZMOpcGxhY2VtZW50XHJcblx0XHR0aGlzLnZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMClcclxuXHRcdFxyXG5cdFx0Ly8gVml0ZXNzZSBkZSBkw6lwbGFjZW1lbnQgbWF4aW1hbGVcclxuXHRcdHRoaXMubWF4VmVsb2NpdHkgPSAwLjFcclxuXHRcdFxyXG5cdFx0Ly8gUm90YXRpb24gZHUgbW9kw6hsZSAzRFxyXG5cdFx0dGhpcy5nZW9tZXRyeS5yb3RhdGVYKE1hdGguUEkgLyAyKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlRmFjZU5vcm1hbHMoKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlVmVydGV4Tm9ybWFscygpXHJcblx0XHR0aGlzLmdlb21ldHJ5LmNvbXB1dGVNb3JwaE5vcm1hbHMoKVxyXG5cdFx0XHJcblx0XHQvLyBDaGFyZ2VtZW50IGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLmFjdGlvbnMgPSB7fVxyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZ2VvbWV0cnkuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcclxuXHRcdFx0Y29uc3QgY2xpcCA9IHRoaXMuZ2VvbWV0cnkuYW5pbWF0aW9uc1tpXVxyXG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0aGlzLm1peGVyLmNsaXBBY3Rpb24oY2xpcClcclxuXHRcdFx0XHJcblx0XHRcdGFjdGlvbi5zZXRFZmZlY3RpdmVXZWlnaHQoMSkuc3RvcCgpXHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmFjdGlvbnNbY2xpcC5uYW1lXSA9IGFjdGlvblxyXG5cdFx0XHRcclxuXHRcdFx0Y29uc29sZS5sb2coYWN0aW9uKVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0XHJcblx0XHRnYW1lLnNjZW5lLmFkZCh0aGlzKVxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBNaXNlIMOgIGpvdXJcclxuXHQgKi9cclxuXHR1cGRhdGUoZXZlbnQpIHtcclxuXHRcdFxyXG5cdFx0Ly8gSm95c3RpY2sgLyBjbGF2aWVyXHJcblx0XHRjb25zdCBjb250cm9sID0gbmV3IFRIUkVFLlZlY3RvcjIoXHJcblx0XHRcdC1nYW1lLmNvbnRyb2xzLm1haW5BeGlzWCxcclxuXHRcdFx0K2dhbWUuY29udHJvbHMubWFpbkF4aXNZXHJcblx0XHQpXHJcblx0XHRcclxuXHRcdC8vIEZvcmNlIGFwcGxpcXXDqWUgc3VyIGxlIGpveXN0aWNrXHJcblx0XHRjb25zdCBmb3JjZSA9IGNvbnRyb2wubGVuZ3RoKClcclxuXHRcdFxyXG5cdFx0Ly8gQ2hhbmdlbWVudCBkZSB2aXRlc3NlXHJcblx0XHR0aGlzLnZlbG9jaXR5LnggKz0gKGNvbnRyb2wueCAtIHRoaXMudmVsb2NpdHkueCkgLyAwLjEgKiBldmVudC5kZWx0YVxyXG5cdFx0dGhpcy52ZWxvY2l0eS55ICs9IChjb250cm9sLnkgLSB0aGlzLnZlbG9jaXR5LnkpIC8gMC4xICogZXZlbnQuZGVsdGFcclxuXHRcdFxyXG5cdFx0Ly8gVml0ZXNzZSBkdSBwZXJzb25uYWdlIGVuIGZvbmN0aW9uIGRlIGxhIGZvcmNlIGQnYXBwdWkgc3VyIGxlIGpveXN0aWNrXHJcblx0XHRpZiAoZm9yY2UgPiAwKSB0aGlzLnZlbG9jaXR5Lm11bHRpcGx5U2NhbGFyKGZvcmNlKVxyXG5cdFx0XHJcblx0XHQvLyBMaW1pdGF0aW9uIGRlIGxhIHZpdGVzc2VcclxuXHRcdHRoaXMudmVsb2NpdHkuY2xhbXBMZW5ndGgoLXRoaXMubWF4VmVsb2NpdHksICt0aGlzLm1heFZlbG9jaXR5KVxyXG5cdFx0XHJcblx0XHQvLyBBcHBsaWNhdGlvbiBkZSBsYSB2aXRlc3NlIHN1ciBsYSBwb3NpdGlvblxyXG5cdFx0dGhpcy5wb3NpdGlvbi5hZGQodGhpcy52ZWxvY2l0eSlcclxuXHRcdFxyXG5cdFx0XHJcblx0XHQvLyBSb3RhdGlvbiBkdSBwZXJzb25uYWdlXHJcblx0XHRjb25zdCB0YXJnZXRSb3RhdGlvbiA9IE1hdGguYXRhbjIodGhpcy52ZWxvY2l0eS55LCB0aGlzLnZlbG9jaXR5LngpXHJcblx0XHRcclxuXHRcdC8vIERpZmbDqXJlbmNlIGF2ZWMgbCdhbmdsZSByw6llbFxyXG5cdFx0bGV0IGRpZmYgPSB0YXJnZXRSb3RhdGlvbiAtIHRoaXMucm90YXRpb24uelxyXG5cdFx0XHJcblx0XHQvLyBBbGxlciBhdSBwbHVzIGNvdXJ0XHJcblx0XHRpZiAoTWF0aC5hYnMoZGlmZikgPiBNYXRoLlBJKSB7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLnJvdGF0aW9uLnogKz0gTWF0aC5QSSAqIDIgKiBNYXRoLnNpZ24oZGlmZilcclxuXHRcdFx0ZGlmZiA9IHRhcmdldFJvdGF0aW9uIC0gdGhpcy5yb3RhdGlvbi56XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBBcHBsaXF1ZXIgbGEgZGlmZsOpcmVuY2UgZGUgcm90YXRpb24gc3VyIGxhIHJvdGF0aW9uIHLDqWVsbGVcclxuXHRcdHRoaXMucm90YXRpb24ueiArPSBkaWZmIC8gMC4xNSAqIGV2ZW50LmRlbHRhXHJcblx0XHRcclxuXHRcdC8vIE1pc2Ugw6Agam91ciBkZSBsJ2FuaW1hdGlvblxyXG5cdFx0dGhpcy5taXhlci51cGRhdGUoZXZlbnQuZGVsdGEpXHJcblx0fVxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIEpvdWVyIHVuZSBhbmltYXRpb25cclxuXHQgKi9cclxuXHRwbGF5KGFuaW1OYW1lLCB3ZWlnaHQgPSAxKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5taXhlclxyXG5cdFx0XHQuY2xpcEFjdGlvbihhbmltTmFtZSlcclxuXHRcdFx0LnNldEVmZmVjdGl2ZVdlaWdodCh3ZWlnaHQpXHJcblx0XHRcdC5wbGF5KClcclxuXHR9XHJcblx0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUGxheWVyXHJcblxyXG4iLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgQ29udHJvbHMgPSByZXF1aXJlKCcuL2NvbnRyb2xzJylcclxuXHJcbi8qKlxyXG4gKiBHw6hyZSBsZXMgY29udHLDtGxlcyAoY2xhdmllci9zb3VyaXMgZXQgbWFuZXR0ZSkgZHUgam91ZXVyXHJcbiAqL1xyXG5jbGFzcyBTb2xhcmlzQ29udHJvbHMgZXh0ZW5kcyBDb250cm9scyB7XHJcblx0XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHRcclxuXHRcdHN1cGVyKClcclxuXHRcdFxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdtYWluQXhpc1gnLCAtMSwgMSkuc3RlcCgwLjAxKS5saXN0ZW4oKVxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdtYWluQXhpc1knLCAtMSwgMSkuc3RlcCgwLjAxKS5saXN0ZW4oKVxyXG5cdFx0Z2FtZS5ndWkuYWRkKHRoaXMsICdjb250cm9sbGVyJykubGlzdGVuKClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgYWN0aW9uQnV0dG9uKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9YLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdkJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3EnXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgbWFpbkF4aXNYKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9YLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdkJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3EnXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHRnZXQgbWFpbkF4aXNZKCkge1xyXG5cdFx0XHJcblx0XHRyZXR1cm4gdGhpcy5nZXRBeGlzKFxyXG5cdFx0XHR0aGlzLkdBTUVQQUQuTEVGVF9ZLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0cG9zaXRpdmU6ICdzJyxcclxuXHRcdFx0XHRuZWdhdGl2ZTogJ3onXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHRcdFxyXG5cdH1cclxuXHRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTb2xhcmlzQ29udHJvbHMiLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuY29uc3QgY29sb3JzID0gcmVxdWlyZSgnLi9jb2xvcnMnKVxyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHJcblx0Z2FtZS5sb2FkKCkudGhlbigoKSA9PiB7XHJcblx0XHRcclxuXHRcdGdhbWUuY3JlYXRlU2NlbmUoKVxyXG5cdFx0Z2FtZS5jcmVhdGVMaWdodHMoKVxyXG5cdFx0Z2FtZS5jcmVhdGVPYmplY3RzKClcclxuXHJcblx0XHRjb25zb2xlLmxvZyhnYW1lKVxyXG5cdFx0XHJcblx0XHR3aW5kb3cuZ2FtZSA9IGdhbWVcclxuXHRcdFxyXG5cdFx0Z2FtZS5sb29wKClcclxuXHRcdFxyXG5cdH0pXHJcblx0XHJcbn0sIGZhbHNlKSIsIi8vICBDaGFuY2UuanMgMS4wLjZcbi8vICBodHRwOi8vY2hhbmNlanMuY29tXG4vLyAgKGMpIDIwMTMgVmljdG9yIFF1aW5uXG4vLyAgQ2hhbmNlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgb3IgbW9kaWZpZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4oZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gQ29uc3RhbnRzXG4gICAgdmFyIE1BWF9JTlQgPSA5MDA3MTk5MjU0NzQwOTkyO1xuICAgIHZhciBNSU5fSU5UID0gLU1BWF9JTlQ7XG4gICAgdmFyIE5VTUJFUlMgPSAnMDEyMzQ1Njc4OSc7XG4gICAgdmFyIENIQVJTX0xPV0VSID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6JztcbiAgICB2YXIgQ0hBUlNfVVBQRVIgPSBDSEFSU19MT1dFUi50b1VwcGVyQ2FzZSgpO1xuICAgIHZhciBIRVhfUE9PTCAgPSBOVU1CRVJTICsgXCJhYmNkZWZcIjtcblxuICAgIC8vIENhY2hlZCBhcnJheSBoZWxwZXJzXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgLy8gQ29uc3RydWN0b3JcbiAgICBmdW5jdGlvbiBDaGFuY2UgKHNlZWQpIHtcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENoYW5jZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWVkID09IG51bGwgPyBuZXcgQ2hhbmNlKCkgOiBuZXcgQ2hhbmNlKHNlZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdXNlciBoYXMgcHJvdmlkZWQgYSBmdW5jdGlvbiwgdXNlIHRoYXQgYXMgdGhlIGdlbmVyYXRvclxuICAgICAgICBpZiAodHlwZW9mIHNlZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMucmFuZG9tID0gc2VlZDtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIHNldCBhIHN0YXJ0aW5nIHZhbHVlIG9mIHplcm8gc28gd2UgY2FuIGFkZCB0byBpdFxuICAgICAgICAgICAgdGhpcy5zZWVkID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG90aGVyd2lzZSwgbGVhdmUgdGhpcy5zZWVkIGJsYW5rIHNvIHRoYXQgTVQgd2lsbCByZWNlaXZlIGEgYmxhbmtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHNlZWRsaW5nID0gMDtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnRzW2ldKSA9PT0gJ1tvYmplY3QgU3RyaW5nXScpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGFyZ3VtZW50c1tpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYSBudW1lcmljIGhhc2ggZm9yIGVhY2ggYXJndW1lbnQsIGFkZCB0byBzZWVkbGluZ1xuICAgICAgICAgICAgICAgICAgICB2YXIgaGFzaCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGsgPSAwOyBrIDwgYXJndW1lbnRzW2ldLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNoID0gYXJndW1lbnRzW2ldLmNoYXJDb2RlQXQoaykgKyAoaGFzaCA8PCA2KSArIChoYXNoIDw8IDE2KSAtIGhhc2g7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2VlZGxpbmcgKz0gaGFzaDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlZWRsaW5nID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZWVkICs9IChhcmd1bWVudHMubGVuZ3RoIC0gaSkgKiBzZWVkbGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIG5vIGdlbmVyYXRvciBmdW5jdGlvbiB3YXMgcHJvdmlkZWQsIHVzZSBvdXIgTVRcbiAgICAgICAgdGhpcy5tdCA9IHRoaXMubWVyc2VubmVfdHdpc3Rlcih0aGlzLnNlZWQpO1xuICAgICAgICB0aGlzLmJpbWQ1ID0gdGhpcy5ibHVlaW1wX21kNSgpO1xuICAgICAgICB0aGlzLnJhbmRvbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm10LnJhbmRvbSh0aGlzLnNlZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuVkVSU0lPTiA9IFwiMS4wLjZcIjtcblxuICAgIC8vIFJhbmRvbSBoZWxwZXIgZnVuY3Rpb25zXG4gICAgZnVuY3Rpb24gaW5pdE9wdGlvbnMob3B0aW9ucywgZGVmYXVsdHMpIHtcbiAgICAgICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcblxuICAgICAgICBpZiAoZGVmYXVsdHMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gZGVmYXVsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnNbaV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnNbaV0gPSBkZWZhdWx0c1tpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0ZXN0UmFuZ2UodGVzdCwgZXJyb3JNZXNzYWdlKSB7XG4gICAgICAgIGlmICh0ZXN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5jb2RlIHRoZSBpbnB1dCBzdHJpbmcgd2l0aCBCYXNlNjQuXG4gICAgICovXG4gICAgdmFyIGJhc2U2NCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEJhc2U2NCBlbmNvZGVyIGF2YWlsYWJsZS4nKTtcbiAgICB9O1xuXG4gICAgLy8gU2VsZWN0IHByb3BlciBCYXNlNjQgZW5jb2Rlci5cbiAgICAoZnVuY3Rpb24gZGV0ZXJtaW5lQmFzZTY0RW5jb2RlcigpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBidG9hID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBiYXNlNjQgPSBidG9hO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBCdWZmZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGJhc2U2NCA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoaW5wdXQpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgLy8gLS0gQmFzaWNzIC0tXG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGJvb2wsIGVpdGhlciB0cnVlIG9yIGZhbHNlXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXsgbGlrZWxpaG9vZDogNTAgfV0gYWx0ZXIgdGhlIGxpa2VsaWhvb2Qgb2ZcbiAgICAgKiAgICByZWNlaXZpbmcgYSB0cnVlIG9yIGZhbHNlIHZhbHVlIGJhY2suXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IGlmIHRoZSBsaWtlbGlob29kIGlzIG91dCBvZiBib3VuZHNcbiAgICAgKiAgQHJldHVybnMge0Jvb2x9IGVpdGhlciB0cnVlIG9yIGZhbHNlXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ib29sID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gbGlrZWxpaG9vZCBvZiBzdWNjZXNzICh0cnVlKVxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2xpa2VsaWhvb2QgOiA1MH0pO1xuXG4gICAgICAgIC8vIE5vdGUsIHdlIGNvdWxkIGdldCBzb21lIG1pbm9yIHBlcmYgb3B0aW1pemF0aW9ucyBieSBjaGVja2luZyByYW5nZVxuICAgICAgICAvLyBwcmlvciB0byBpbml0aWFsaXppbmcgZGVmYXVsdHMsIGJ1dCB0aGF0IG1ha2VzIGNvZGUgYSBiaXQgbWVzc2llclxuICAgICAgICAvLyBhbmQgdGhlIGNoZWNrIG1vcmUgY29tcGxpY2F0ZWQgYXMgd2UgaGF2ZSB0byBjaGVjayBleGlzdGVuY2Ugb2ZcbiAgICAgICAgLy8gdGhlIG9iamVjdCB0aGVuIGV4aXN0ZW5jZSBvZiB0aGUga2V5IGJlZm9yZSBjaGVja2luZyBjb25zdHJhaW50cy5cbiAgICAgICAgLy8gU2luY2UgdGhlIG9wdGlvbnMgaW5pdGlhbGl6YXRpb24gc2hvdWxkIGJlIG1pbm9yIGNvbXB1dGF0aW9uYWxseSxcbiAgICAgICAgLy8gZGVjaXNpb24gbWFkZSBmb3IgY29kZSBjbGVhbmxpbmVzcyBpbnRlbnRpb25hbGx5LiBUaGlzIGlzIG1lbnRpb25lZFxuICAgICAgICAvLyBoZXJlIGFzIGl0J3MgdGhlIGZpcnN0IG9jY3VycmVuY2UsIHdpbGwgbm90IGJlIG1lbnRpb25lZCBhZ2Fpbi5cbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5saWtlbGlob29kIDwgMCB8fCBvcHRpb25zLmxpa2VsaWhvb2QgPiAxMDAsXG4gICAgICAgICAgICBcIkNoYW5jZTogTGlrZWxpaG9vZCBhY2NlcHRzIHZhbHVlcyBmcm9tIDAgdG8gMTAwLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmFuZG9tKCkgKiAxMDAgPCBvcHRpb25zLmxpa2VsaWhvb2Q7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gY2hhcmFjdGVyLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBjaGFyYWN0ZXIgcG9vbCwgb25seSBhbHBoYSxcbiAgICAgKiAgICBvbmx5IHN5bWJvbHMsIGFuZCBjYXNpbmcgKGxvd2VyIG9yIHVwcGVyKVxuICAgICAqICBAcmV0dXJucyB7U3RyaW5nfSBhIHNpbmdsZSByYW5kb20gY2hhcmFjdGVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IENhbiBvbmx5IHNwZWNpZnkgYWxwaGEgb3Igc3ltYm9scywgbm90IGJvdGhcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmNoYXJhY3RlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5hbHBoYSAmJiBvcHRpb25zLnN5bWJvbHMsXG4gICAgICAgICAgICBcIkNoYW5jZTogQ2Fubm90IHNwZWNpZnkgYm90aCBhbHBoYSBhbmQgc3ltYm9scy5cIlxuICAgICAgICApO1xuXG4gICAgICAgIHZhciBzeW1ib2xzID0gXCIhQCMkJV4mKigpW11cIixcbiAgICAgICAgICAgIGxldHRlcnMsIHBvb2w7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2FzaW5nID09PSAnbG93ZXInKSB7XG4gICAgICAgICAgICBsZXR0ZXJzID0gQ0hBUlNfTE9XRVI7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5jYXNpbmcgPT09ICd1cHBlcicpIHtcbiAgICAgICAgICAgIGxldHRlcnMgPSBDSEFSU19VUFBFUjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldHRlcnMgPSBDSEFSU19MT1dFUiArIENIQVJTX1VQUEVSO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucG9vbCkge1xuICAgICAgICAgICAgcG9vbCA9IG9wdGlvbnMucG9vbDtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmFscGhhKSB7XG4gICAgICAgICAgICBwb29sID0gbGV0dGVycztcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnN5bWJvbHMpIHtcbiAgICAgICAgICAgIHBvb2wgPSBzeW1ib2xzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9vbCA9IGxldHRlcnMgKyBOVU1CRVJTICsgc3ltYm9scztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwb29sLmNoYXJBdCh0aGlzLm5hdHVyYWwoe21heDogKHBvb2wubGVuZ3RoIC0gMSl9KSk7XG4gICAgfTtcblxuICAgIC8vIE5vdGUsIHdhbnRlZCB0byB1c2UgXCJmbG9hdFwiIG9yIFwiZG91YmxlXCIgYnV0IHRob3NlIGFyZSBib3RoIEpTIHJlc2VydmVkIHdvcmRzLlxuXG4gICAgLy8gTm90ZSwgZml4ZWQgbWVhbnMgTiBPUiBMRVNTIGRpZ2l0cyBhZnRlciB0aGUgZGVjaW1hbC4gVGhpcyBiZWNhdXNlXG4gICAgLy8gSXQgY291bGQgYmUgMTQuOTAwMCBidXQgaW4gSmF2YVNjcmlwdCwgd2hlbiB0aGlzIGlzIGNhc3QgYXMgYSBudW1iZXIsXG4gICAgLy8gdGhlIHRyYWlsaW5nIHplcm9lcyBhcmUgZHJvcHBlZC4gTGVmdCB0byB0aGUgY29uc3VtZXIgaWYgdHJhaWxpbmcgemVyb2VzIGFyZVxuICAgIC8vIG5lZWRlZFxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gZmxvYXRpbmcgcG9pbnQgbnVtYmVyXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIGZpeGVkIHByZWNpc2lvbiwgbWluLCBtYXhcbiAgICAgKiAgQHJldHVybnMge051bWJlcn0gYSBzaW5nbGUgZmxvYXRpbmcgcG9pbnQgbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IENhbiBvbmx5IHNwZWNpZnkgZml4ZWQgb3IgcHJlY2lzaW9uLCBub3QgYm90aC4gQWxzb1xuICAgICAqICAgIG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuZmxvYXRpbmcgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2ZpeGVkIDogNH0pO1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLmZpeGVkICYmIG9wdGlvbnMucHJlY2lzaW9uLFxuICAgICAgICAgICAgXCJDaGFuY2U6IENhbm5vdCBzcGVjaWZ5IGJvdGggZml4ZWQgYW5kIHByZWNpc2lvbi5cIlxuICAgICAgICApO1xuXG4gICAgICAgIHZhciBudW07XG4gICAgICAgIHZhciBmaXhlZCA9IE1hdGgucG93KDEwLCBvcHRpb25zLmZpeGVkKTtcblxuICAgICAgICB2YXIgbWF4ID0gTUFYX0lOVCAvIGZpeGVkO1xuICAgICAgICB2YXIgbWluID0gLW1heDtcblxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLm1pbiAmJiBvcHRpb25zLmZpeGVkICYmIG9wdGlvbnMubWluIDwgbWluLFxuICAgICAgICAgICAgXCJDaGFuY2U6IE1pbiBzcGVjaWZpZWQgaXMgb3V0IG9mIHJhbmdlIHdpdGggZml4ZWQuIE1pbiBzaG91bGQgYmUsIGF0IGxlYXN0LCBcIiArIG1pblxuICAgICAgICApO1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLm1heCAmJiBvcHRpb25zLmZpeGVkICYmIG9wdGlvbnMubWF4ID4gbWF4LFxuICAgICAgICAgICAgXCJDaGFuY2U6IE1heCBzcGVjaWZpZWQgaXMgb3V0IG9mIHJhbmdlIHdpdGggZml4ZWQuIE1heCBzaG91bGQgYmUsIGF0IG1vc3QsIFwiICsgbWF4XG4gICAgICAgICk7XG5cbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgbWluIDogbWluLCBtYXggOiBtYXggfSk7XG5cbiAgICAgICAgLy8gVG9kbyAtIE1ha2UgdGhpcyB3b3JrIVxuICAgICAgICAvLyBvcHRpb25zLnByZWNpc2lvbiA9ICh0eXBlb2Ygb3B0aW9ucy5wcmVjaXNpb24gIT09IFwidW5kZWZpbmVkXCIpID8gb3B0aW9ucy5wcmVjaXNpb24gOiBmYWxzZTtcblxuICAgICAgICBudW0gPSB0aGlzLmludGVnZXIoe21pbjogb3B0aW9ucy5taW4gKiBmaXhlZCwgbWF4OiBvcHRpb25zLm1heCAqIGZpeGVkfSk7XG4gICAgICAgIHZhciBudW1fZml4ZWQgPSAobnVtIC8gZml4ZWQpLnRvRml4ZWQob3B0aW9ucy5maXhlZCk7XG5cbiAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQobnVtX2ZpeGVkKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyXG4gICAgICpcbiAgICAgKiAgTk9URSB0aGUgbWF4IGFuZCBtaW4gYXJlIElOQ0xVREVEIGluIHRoZSByYW5nZS4gU286XG4gICAgICogIGNoYW5jZS5pbnRlZ2VyKHttaW46IDEsIG1heDogM30pO1xuICAgICAqICB3b3VsZCByZXR1cm4gZWl0aGVyIDEsIDIsIG9yIDMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIG1pbiBhbmQvb3IgbWF4XG4gICAgICogIEByZXR1cm5zIHtOdW1iZXJ9IGEgc2luZ2xlIHJhbmRvbSBpbnRlZ2VyIG51bWJlclxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBtaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBtYXhcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmludGVnZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyA5MDA3MTk5MjU0NzQwOTkyICgyXjUzKSBpcyB0aGUgbWF4IGludGVnZXIgbnVtYmVyIGluIEphdmFTY3JpcHRcbiAgICAgICAgLy8gU2VlOiBodHRwOi8vdnEuaW8vMTMyc2EyalxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogTUlOX0lOVCwgbWF4OiBNQVhfSU5UfSk7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA+IG9wdGlvbnMubWF4LCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gTWF4LlwiKTtcblxuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcih0aGlzLnJhbmRvbSgpICogKG9wdGlvbnMubWF4IC0gb3B0aW9ucy5taW4gKyAxKSArIG9wdGlvbnMubWluKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBuYXR1cmFsXG4gICAgICpcbiAgICAgKiAgTk9URSB0aGUgbWF4IGFuZCBtaW4gYXJlIElOQ0xVREVEIGluIHRoZSByYW5nZS4gU286XG4gICAgICogIGNoYW5jZS5uYXR1cmFsKHttaW46IDEsIG1heDogM30pO1xuICAgICAqICB3b3VsZCByZXR1cm4gZWl0aGVyIDEsIDIsIG9yIDMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIG1pbiBhbmQvb3IgbWF4XG4gICAgICogIEByZXR1cm5zIHtOdW1iZXJ9IGEgc2luZ2xlIHJhbmRvbSBpbnRlZ2VyIG51bWJlclxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBtaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBtYXhcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hdHVyYWwgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogMCwgbWF4OiBNQVhfSU5UfSk7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA8IDAsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvLlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZWdlcihvcHRpb25zKTtcbiAgICB9O1xuXHRcblx0LyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBoZXggbnVtYmVyIGFzIHN0cmluZ1xuICAgICAqXG4gICAgICogIE5PVEUgdGhlIG1heCBhbmQgbWluIGFyZSBJTkNMVURFRCBpbiB0aGUgcmFuZ2UuIFNvOlxuICAgICAqICBjaGFuY2UuaGV4KHttaW46ICc5JywgbWF4OiAnQid9KTtcbiAgICAgKiAgd291bGQgcmV0dXJuIGVpdGhlciAnOScsICdBJyBvciAnQicuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIG1pbiBhbmQvb3IgbWF4IGFuZC9vciBjYXNpbmdcbiAgICAgKiAgQHJldHVybnMge1N0cmluZ30gYSBzaW5nbGUgcmFuZG9tIHN0cmluZyBoZXggbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuaGV4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDAsIG1heDogTUFYX0lOVCwgY2FzaW5nOiAnbG93ZXInfSk7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA8IDAsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvLlwiKTtcblx0XHR2YXIgaW50ZWdlciA9IHRoaXMubmF0dXJhbCh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heH0pO1xuXHRcdGlmIChvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJykge1xuXHRcdFx0cmV0dXJuIGludGVnZXIudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fVxuXHRcdHJldHVybiBpbnRlZ2VyLnRvU3RyaW5nKDE2KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBzdHJpbmdcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbGVuZ3RoXG4gICAgICogIEByZXR1cm5zIHtTdHJpbmd9IGEgc3RyaW5nIG9mIHJhbmRvbSBsZW5ndGhcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gbGVuZ3RoIGNhbm5vdCBiZSBsZXNzIHRoYW4gemVyb1xuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuc3RyaW5nID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgbGVuZ3RoOiB0aGlzLm5hdHVyYWwoe21pbjogNSwgbWF4OiAyMH0pIH0pO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5sZW5ndGggPCAwLCBcIkNoYW5jZTogTGVuZ3RoIGNhbm5vdCBiZSBsZXNzIHRoYW4gemVyby5cIik7XG4gICAgICAgIHZhciBsZW5ndGggPSBvcHRpb25zLmxlbmd0aCxcbiAgICAgICAgICAgIHRleHQgPSB0aGlzLm4odGhpcy5jaGFyYWN0ZXIsIGxlbmd0aCwgb3B0aW9ucyk7XG5cbiAgICAgICAgcmV0dXJuIHRleHQuam9pbihcIlwiKTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIEJhc2ljcyAtLVxuXG4gICAgLy8gLS0gSGVscGVycyAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jYXBpdGFsaXplID0gZnVuY3Rpb24gKHdvcmQpIHtcbiAgICAgICAgcmV0dXJuIHdvcmQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB3b3JkLnN1YnN0cigxKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5taXhpbiA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgZm9yICh2YXIgZnVuY19uYW1lIGluIG9iaikge1xuICAgICAgICAgICAgQ2hhbmNlLnByb3RvdHlwZVtmdW5jX25hbWVdID0gb2JqW2Z1bmNfbmFtZV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBHaXZlbiBhIGZ1bmN0aW9uIHRoYXQgZ2VuZXJhdGVzIHNvbWV0aGluZyByYW5kb20gYW5kIGEgbnVtYmVyIG9mIGl0ZW1zIHRvIGdlbmVyYXRlLFxuICAgICAqICAgIHJldHVybiBhbiBhcnJheSBvZiBpdGVtcyB3aGVyZSBub25lIHJlcGVhdC5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge0Z1bmN0aW9ufSBmbiB0aGUgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgc29tZXRoaW5nIHJhbmRvbVxuICAgICAqICBAcGFyYW0ge051bWJlcn0gbnVtIG51bWJlciBvZiB0ZXJtcyB0byBnZW5lcmF0ZVxuICAgICAqICBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBhbnkgb3B0aW9ucyB0byBwYXNzIG9uIHRvIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb25cbiAgICAgKiAgQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBvZiBsZW5ndGggYG51bWAgd2l0aCBldmVyeSBpdGVtIGdlbmVyYXRlZCBieSBgZm5gIGFuZCB1bmlxdWVcbiAgICAgKlxuICAgICAqICBUaGVyZSBjYW4gYmUgbW9yZSBwYXJhbWV0ZXJzIGFmdGVyIHRoZXNlLiBBbGwgYWRkaXRpb25hbCBwYXJhbWV0ZXJzIGFyZSBwcm92aWRlZCB0byB0aGUgZ2l2ZW4gZnVuY3Rpb25cbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLnVuaXF1ZSA9IGZ1bmN0aW9uKGZuLCBudW0sIG9wdGlvbnMpIHtcbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgdHlwZW9mIGZuICE9PSBcImZ1bmN0aW9uXCIsXG4gICAgICAgICAgICBcIkNoYW5jZTogVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBmdW5jdGlvbi5cIlxuICAgICAgICApO1xuXG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gZnVuY3Rpb24oYXJyLCB2YWwpIHsgcmV0dXJuIGFyci5pbmRleE9mKHZhbCkgIT09IC0xOyB9O1xuXG4gICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICBjb21wYXJhdG9yID0gb3B0aW9ucy5jb21wYXJhdG9yIHx8IGNvbXBhcmF0b3I7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJyID0gW10sIGNvdW50ID0gMCwgcmVzdWx0LCBNQVhfRFVQTElDQVRFUyA9IG51bSAqIDUwLCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgd2hpbGUgKGFyci5sZW5ndGggPCBudW0pIHtcbiAgICAgICAgICAgIHZhciBjbG9uZWRQYXJhbXMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHBhcmFtcykpO1xuICAgICAgICAgICAgcmVzdWx0ID0gZm4uYXBwbHkodGhpcywgY2xvbmVkUGFyYW1zKTtcbiAgICAgICAgICAgIGlmICghY29tcGFyYXRvcihhcnIsIHJlc3VsdCkpIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIC8vIHJlc2V0IGNvdW50IHdoZW4gdW5pcXVlIGZvdW5kXG4gICAgICAgICAgICAgICAgY291bnQgPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoKytjb3VudCA+IE1BWF9EVVBMSUNBVEVTKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IG51bSBpcyBsaWtlbHkgdG9vIGxhcmdlIGZvciBzYW1wbGUgc2V0XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBHaXZlcyBhbiBhcnJheSBvZiBuIHJhbmRvbSB0ZXJtc1xuICAgICAqXG4gICAgICogIEBwYXJhbSB7RnVuY3Rpb259IGZuIHRoZSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBzb21ldGhpbmcgcmFuZG9tXG4gICAgICogIEBwYXJhbSB7TnVtYmVyfSBuIG51bWJlciBvZiB0ZXJtcyB0byBnZW5lcmF0ZVxuICAgICAqICBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IG9mIGxlbmd0aCBgbmAgd2l0aCBpdGVtcyBnZW5lcmF0ZWQgYnkgYGZuYFxuICAgICAqXG4gICAgICogIFRoZXJlIGNhbiBiZSBtb3JlIHBhcmFtZXRlcnMgYWZ0ZXIgdGhlc2UuIEFsbCBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgYXJlIHByb3ZpZGVkIHRvIHRoZSBnaXZlbiBmdW5jdGlvblxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUubiA9IGZ1bmN0aW9uKGZuLCBuKSB7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiLFxuICAgICAgICAgICAgXCJDaGFuY2U6IFRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24uXCJcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAodHlwZW9mIG4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBuID0gMTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaSA9IG4sIGFyciA9IFtdLCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgLy8gUHJvdmlkaW5nIGEgbmVnYXRpdmUgY291bnQgc2hvdWxkIHJlc3VsdCBpbiBhIG5vb3AuXG4gICAgICAgIGkgPSBNYXRoLm1heCggMCwgaSApO1xuXG4gICAgICAgIGZvciAobnVsbDsgaS0tOyBudWxsKSB7XG4gICAgICAgICAgICBhcnIucHVzaChmbi5hcHBseSh0aGlzLCBwYXJhbXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcblxuICAgIC8vIEgvVCB0byBTTyBmb3IgdGhpcyBvbmU6IGh0dHA6Ly92cS5pby9PdFVyWjVcbiAgICBDaGFuY2UucHJvdG90eXBlLnBhZCA9IGZ1bmN0aW9uIChudW1iZXIsIHdpZHRoLCBwYWQpIHtcbiAgICAgICAgLy8gRGVmYXVsdCBwYWQgdG8gMCBpZiBub25lIHByb3ZpZGVkXG4gICAgICAgIHBhZCA9IHBhZCB8fCAnMCc7XG4gICAgICAgIC8vIENvbnZlcnQgbnVtYmVyIHRvIGEgc3RyaW5nXG4gICAgICAgIG51bWJlciA9IG51bWJlciArICcnO1xuICAgICAgICByZXR1cm4gbnVtYmVyLmxlbmd0aCA+PSB3aWR0aCA/IG51bWJlciA6IG5ldyBBcnJheSh3aWR0aCAtIG51bWJlci5sZW5ndGggKyAxKS5qb2luKHBhZCkgKyBudW1iZXI7XG4gICAgfTtcblxuICAgIC8vIERFUFJFQ0FURUQgb24gMjAxNS0xMC0wMVxuICAgIENoYW5jZS5wcm90b3R5cGUucGljayA9IGZ1bmN0aW9uIChhcnIsIGNvdW50KSB7XG4gICAgICAgIGlmIChhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogQ2Fubm90IHBpY2soKSBmcm9tIGFuIGVtcHR5IGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY291bnQgfHwgY291bnQgPT09IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnJbdGhpcy5uYXR1cmFsKHttYXg6IGFyci5sZW5ndGggLSAxfSldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2h1ZmZsZShhcnIpLnNsaWNlKDAsIGNvdW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBHaXZlbiBhbiBhcnJheSwgcmV0dXJucyBhIHNpbmdsZSByYW5kb20gZWxlbWVudFxuICAgIENoYW5jZS5wcm90b3R5cGUucGlja29uZSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgaWYgKGFyci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogQ2Fubm90IHBpY2tvbmUoKSBmcm9tIGFuIGVtcHR5IGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnJbdGhpcy5uYXR1cmFsKHttYXg6IGFyci5sZW5ndGggLSAxfSldO1xuICAgIH07XG5cbiAgICAvLyBHaXZlbiBhbiBhcnJheSwgcmV0dXJucyBhIHJhbmRvbSBzZXQgd2l0aCAnY291bnQnIGVsZW1lbnRzXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5waWNrc2V0ID0gZnVuY3Rpb24gKGFyciwgY291bnQpIHtcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFyci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBDYW5ub3QgcGlja3NldCgpIGZyb20gYW4gZW1wdHkgYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdW50IDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IGNvdW50IG11c3QgYmUgcG9zaXRpdmUgbnVtYmVyXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY291bnQgfHwgY291bnQgPT09IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBbIHRoaXMucGlja29uZShhcnIpIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaHVmZmxlKGFycikuc2xpY2UoMCwgY291bnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc2h1ZmZsZSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgdmFyIG9sZF9hcnJheSA9IGFyci5zbGljZSgwKSxcbiAgICAgICAgICAgIG5ld19hcnJheSA9IFtdLFxuICAgICAgICAgICAgaiA9IDAsXG4gICAgICAgICAgICBsZW5ndGggPSBOdW1iZXIob2xkX2FycmF5Lmxlbmd0aCk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gUGljayBhIHJhbmRvbSBpbmRleCBmcm9tIHRoZSBhcnJheVxuICAgICAgICAgICAgaiA9IHRoaXMubmF0dXJhbCh7bWF4OiBvbGRfYXJyYXkubGVuZ3RoIC0gMX0pO1xuICAgICAgICAgICAgLy8gQWRkIGl0IHRvIHRoZSBuZXcgYXJyYXlcbiAgICAgICAgICAgIG5ld19hcnJheVtpXSA9IG9sZF9hcnJheVtqXTtcbiAgICAgICAgICAgIC8vIFJlbW92ZSB0aGF0IGVsZW1lbnQgZnJvbSB0aGUgb3JpZ2luYWwgYXJyYXlcbiAgICAgICAgICAgIG9sZF9hcnJheS5zcGxpY2UoaiwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3X2FycmF5O1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm5zIGEgc2luZ2xlIGl0ZW0gZnJvbSBhbiBhcnJheSB3aXRoIHJlbGF0aXZlIHdlaWdodGluZyBvZiBvZGRzXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53ZWlnaHRlZCA9IGZ1bmN0aW9uIChhcnIsIHdlaWdodHMsIHRyaW0pIHtcbiAgICAgICAgaWYgKGFyci5sZW5ndGggIT09IHdlaWdodHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogbGVuZ3RoIG9mIGFycmF5IGFuZCB3ZWlnaHRzIG11c3QgbWF0Y2hcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2FuIHdlaWdodHMgYXJyYXkgYW5kIHN1bSB2YWxpZCBlbnRyaWVzXG4gICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICB2YXIgdmFsO1xuICAgICAgICBmb3IgKHZhciB3ZWlnaHRJbmRleCA9IDA7IHdlaWdodEluZGV4IDwgd2VpZ2h0cy5sZW5ndGg7ICsrd2VpZ2h0SW5kZXgpIHtcbiAgICAgICAgICAgIHZhbCA9IHdlaWdodHNbd2VpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImFsbCB3ZWlnaHRzIG11c3QgYmUgbnVtYmVyc1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbCA+IDApIHtcbiAgICAgICAgICAgICAgICBzdW0gKz0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1bSA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IG5vIHZhbGlkIGVudHJpZXMgaW4gYXJyYXkgd2VpZ2h0c1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNlbGVjdCBhIHZhbHVlIHdpdGhpbiByYW5nZVxuICAgICAgICB2YXIgc2VsZWN0ZWQgPSB0aGlzLnJhbmRvbSgpICogc3VtO1xuXG4gICAgICAgIC8vIGZpbmQgYXJyYXkgZW50cnkgY29ycmVzcG9uZGluZyB0byBzZWxlY3RlZCB2YWx1ZVxuICAgICAgICB2YXIgdG90YWwgPSAwO1xuICAgICAgICB2YXIgbGFzdEdvb2RJZHggPSAtMTtcbiAgICAgICAgdmFyIGNob3NlbklkeDtcbiAgICAgICAgZm9yICh3ZWlnaHRJbmRleCA9IDA7IHdlaWdodEluZGV4IDwgd2VpZ2h0cy5sZW5ndGg7ICsrd2VpZ2h0SW5kZXgpIHtcbiAgICAgICAgICAgIHZhbCA9IHdlaWdodHNbd2VpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgdG90YWwgKz0gdmFsO1xuICAgICAgICAgICAgaWYgKHZhbCA+IDApIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWQgPD0gdG90YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hvc2VuSWR4ID0gd2VpZ2h0SW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYXN0R29vZElkeCA9IHdlaWdodEluZGV4O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgYW55IHBvc3NpYmxlIHJvdW5kaW5nIGVycm9yIGNvbXBhcmlzb24gdG8gZW5zdXJlIHNvbWV0aGluZyBpcyBwaWNrZWRcbiAgICAgICAgICAgIGlmICh3ZWlnaHRJbmRleCA9PT0gKHdlaWdodHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBjaG9zZW5JZHggPSBsYXN0R29vZElkeDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaG9zZW4gPSBhcnJbY2hvc2VuSWR4XTtcbiAgICAgICAgdHJpbSA9ICh0eXBlb2YgdHJpbSA9PT0gJ3VuZGVmaW5lZCcpID8gZmFsc2UgOiB0cmltO1xuICAgICAgICBpZiAodHJpbSkge1xuICAgICAgICAgICAgYXJyLnNwbGljZShjaG9zZW5JZHgsIDEpO1xuICAgICAgICAgICAgd2VpZ2h0cy5zcGxpY2UoY2hvc2VuSWR4LCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaG9zZW47XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBIZWxwZXJzIC0tXG5cbiAgICAvLyAtLSBUZXh0IC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBhcmFncmFwaCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgc2VudGVuY2VzID0gb3B0aW9ucy5zZW50ZW5jZXMgfHwgdGhpcy5uYXR1cmFsKHttaW46IDMsIG1heDogN30pLFxuICAgICAgICAgICAgc2VudGVuY2VfYXJyYXkgPSB0aGlzLm4odGhpcy5zZW50ZW5jZSwgc2VudGVuY2VzKTtcblxuICAgICAgICByZXR1cm4gc2VudGVuY2VfYXJyYXkuam9pbignICcpO1xuICAgIH07XG5cbiAgICAvLyBDb3VsZCBnZXQgc21hcnRlciBhYm91dCB0aGlzIHRoYW4gZ2VuZXJhdGluZyByYW5kb20gd29yZHMgYW5kXG4gICAgLy8gY2hhaW5pbmcgdGhlbSB0b2dldGhlci4gU3VjaCBhczogaHR0cDovL3ZxLmlvLzFhNWNlT2hcbiAgICBDaGFuY2UucHJvdG90eXBlLnNlbnRlbmNlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciB3b3JkcyA9IG9wdGlvbnMud29yZHMgfHwgdGhpcy5uYXR1cmFsKHttaW46IDEyLCBtYXg6IDE4fSksXG4gICAgICAgICAgICBwdW5jdHVhdGlvbiA9IG9wdGlvbnMucHVuY3R1YXRpb24sXG4gICAgICAgICAgICB0ZXh0LCB3b3JkX2FycmF5ID0gdGhpcy5uKHRoaXMud29yZCwgd29yZHMpO1xuXG4gICAgICAgIHRleHQgPSB3b3JkX2FycmF5LmpvaW4oJyAnKTtcblxuICAgICAgICAvLyBDYXBpdGFsaXplIGZpcnN0IGxldHRlciBvZiBzZW50ZW5jZVxuICAgICAgICB0ZXh0ID0gdGhpcy5jYXBpdGFsaXplKHRleHQpO1xuXG4gICAgICAgIC8vIE1ha2Ugc3VyZSBwdW5jdHVhdGlvbiBoYXMgYSB1c2FibGUgdmFsdWVcbiAgICAgICAgaWYgKHB1bmN0dWF0aW9uICE9PSBmYWxzZSAmJiAhL15bXFwuXFw/OyE6XSQvLnRlc3QocHVuY3R1YXRpb24pKSB7XG4gICAgICAgICAgICBwdW5jdHVhdGlvbiA9ICcuJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCBwdW5jdHVhdGlvbiBtYXJrXG4gICAgICAgIGlmIChwdW5jdHVhdGlvbikge1xuICAgICAgICAgICAgdGV4dCArPSBwdW5jdHVhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN5bGxhYmxlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciBsZW5ndGggPSBvcHRpb25zLmxlbmd0aCB8fCB0aGlzLm5hdHVyYWwoe21pbjogMiwgbWF4OiAzfSksXG4gICAgICAgICAgICBjb25zb25hbnRzID0gJ2JjZGZnaGprbG1ucHJzdHZ3eicsIC8vIGNvbnNvbmFudHMgZXhjZXB0IGhhcmQgdG8gc3BlYWsgb25lc1xuICAgICAgICAgICAgdm93ZWxzID0gJ2FlaW91JywgLy8gdm93ZWxzXG4gICAgICAgICAgICBhbGwgPSBjb25zb25hbnRzICsgdm93ZWxzLCAvLyBhbGxcbiAgICAgICAgICAgIHRleHQgPSAnJyxcbiAgICAgICAgICAgIGNocjtcblxuICAgICAgICAvLyBJJ20gc3VyZSB0aGVyZSdzIGEgbW9yZSBlbGVnYW50IHdheSB0byBkbyB0aGlzLCBidXQgdGhpcyB3b3Jrc1xuICAgICAgICAvLyBkZWNlbnRseSB3ZWxsLlxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIEZpcnN0IGNoYXJhY3RlciBjYW4gYmUgYW55dGhpbmdcbiAgICAgICAgICAgICAgICBjaHIgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogYWxsfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnNvbmFudHMuaW5kZXhPZihjaHIpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIC8vIExhc3QgY2hhcmFjdGVyIHdhcyBhIHZvd2VsLCBub3cgd2Ugd2FudCBhIGNvbnNvbmFudFxuICAgICAgICAgICAgICAgIGNociA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiBjb25zb25hbnRzfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIExhc3QgY2hhcmFjdGVyIHdhcyBhIGNvbnNvbmFudCwgbm93IHdlIHdhbnQgYSB2b3dlbFxuICAgICAgICAgICAgICAgIGNociA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiB2b3dlbHN9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGV4dCArPSBjaHI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jYXBpdGFsaXplKSB7XG4gICAgICAgICAgICB0ZXh0ID0gdGhpcy5jYXBpdGFsaXplKHRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUud29yZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLnN5bGxhYmxlcyAmJiBvcHRpb25zLmxlbmd0aCxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBDYW5ub3Qgc3BlY2lmeSBib3RoIHN5bGxhYmxlcyBBTkQgbGVuZ3RoLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIHN5bGxhYmxlcyA9IG9wdGlvbnMuc3lsbGFibGVzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDN9KSxcbiAgICAgICAgICAgIHRleHQgPSAnJztcblxuICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIEVpdGhlciBib3VuZCB3b3JkIGJ5IGxlbmd0aFxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIHRleHQgKz0gdGhpcy5zeWxsYWJsZSgpO1xuICAgICAgICAgICAgfSB3aGlsZSAodGV4dC5sZW5ndGggPCBvcHRpb25zLmxlbmd0aCk7XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgb3B0aW9ucy5sZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gT3IgYnkgbnVtYmVyIG9mIHN5bGxhYmxlc1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzeWxsYWJsZXM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRleHQgKz0gdGhpcy5zeWxsYWJsZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2FwaXRhbGl6ZSkge1xuICAgICAgICAgICAgdGV4dCA9IHRoaXMuY2FwaXRhbGl6ZSh0ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgVGV4dCAtLVxuXG4gICAgLy8gLS0gUGVyc29uIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFnZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGFnZVJhbmdlO1xuXG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdjaGlsZCc6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAwLCBtYXg6IDEyfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3RlZW4nOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMTMsIG1heDogMTl9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnYWR1bHQnOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMTgsIG1heDogNjV9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnc2VuaW9yJzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDY1LCBtYXg6IDEwMH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMCwgbWF4OiAxMDB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDE4LCBtYXg6IDY1fTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoYWdlUmFuZ2UpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJpcnRoZGF5ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGFnZSA9IHRoaXMuYWdlKG9wdGlvbnMpO1xuICAgICAgICB2YXIgY3VycmVudFllYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy50eXBlKSB7XG4gICAgICAgICAgICB2YXIgbWluID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIHZhciBtYXggPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgbWluLnNldEZ1bGxZZWFyKGN1cnJlbnRZZWFyIC0gYWdlIC0gMSk7XG4gICAgICAgICAgICBtYXguc2V0RnVsbFllYXIoY3VycmVudFllYXIgLSBhZ2UpO1xuXG4gICAgICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgICAgIG1pbjogbWluLFxuICAgICAgICAgICAgICAgIG1heDogbWF4XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgeWVhcjogY3VycmVudFllYXIgLSBhZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0ZShvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLy8gQ1BGOyBJRCB0byBpZGVudGlmeSB0YXhwYXllcnMgaW4gQnJhemlsXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jcGYgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZm9ybWF0dGVkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBuID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgOSwgeyBtYXg6IDkgfSk7XG4gICAgICAgIHZhciBkMSA9IG5bOF0qMituWzddKjMrbls2XSo0K25bNV0qNStuWzRdKjYrblszXSo3K25bMl0qOCtuWzFdKjkrblswXSoxMDtcbiAgICAgICAgZDEgPSAxMSAtIChkMSAlIDExKTtcbiAgICAgICAgaWYgKGQxPj0xMCkge1xuICAgICAgICAgICAgZDEgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkMiA9IGQxKjIrbls4XSozK25bN10qNCtuWzZdKjUrbls1XSo2K25bNF0qNytuWzNdKjgrblsyXSo5K25bMV0qMTArblswXSoxMTtcbiAgICAgICAgZDIgPSAxMSAtIChkMiAlIDExKTtcbiAgICAgICAgaWYgKGQyPj0xMCkge1xuICAgICAgICAgICAgZDIgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjcGYgPSAnJytuWzBdK25bMV0rblsyXSsnLicrblszXStuWzRdK25bNV0rJy4nK25bNl0rbls3XStuWzhdKyctJytkMStkMjtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZm9ybWF0dGVkID8gY3BmIDogY3BmLnJlcGxhY2UoL1xcRC9nLCcnKTtcbiAgICB9O1xuXG4gICAgLy8gQ05QSjogSUQgdG8gaWRlbnRpZnkgY29tcGFuaWVzIGluIEJyYXppbFxuICAgIENoYW5jZS5wcm90b3R5cGUuY25waiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmb3JtYXR0ZWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIG4gPSB0aGlzLm4odGhpcy5uYXR1cmFsLCAxMiwgeyBtYXg6IDEyIH0pO1xuICAgICAgICB2YXIgZDEgPSBuWzExXSoyK25bMTBdKjMrbls5XSo0K25bOF0qNStuWzddKjYrbls2XSo3K25bNV0qOCtuWzRdKjkrblszXSoyK25bMl0qMytuWzFdKjQrblswXSo1O1xuICAgICAgICBkMSA9IDExIC0gKGQxICUgMTEpO1xuICAgICAgICBpZiAoZDE8Mikge1xuICAgICAgICAgICAgZDEgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkMiA9IGQxKjIrblsxMV0qMytuWzEwXSo0K25bOV0qNStuWzhdKjYrbls3XSo3K25bNl0qOCtuWzVdKjkrbls0XSoyK25bM10qMytuWzJdKjQrblsxXSo1K25bMF0qNjtcbiAgICAgICAgZDIgPSAxMSAtIChkMiAlIDExKTtcbiAgICAgICAgaWYgKGQyPDIpIHtcbiAgICAgICAgICAgIGQyID0gMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY25waiA9ICcnK25bMF0rblsxXSsnLicrblsyXStuWzNdK25bNF0rJy4nK25bNV0rbls2XStuWzddKycvJytuWzhdK25bOV0rblsxMF0rblsxMV0rJy0nK2QxK2QyO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mb3JtYXR0ZWQgPyBjbnBqIDogY25wai5yZXBsYWNlKC9cXEQvZywnJyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZmlyc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2dlbmRlcjogdGhpcy5nZW5kZXIoKSwgbmF0aW9uYWxpdHk6ICdlbid9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmdldChcImZpcnN0TmFtZXNcIilbb3B0aW9ucy5nZW5kZXIudG9Mb3dlckNhc2UoKV1bb3B0aW9ucy5uYXRpb25hbGl0eS50b0xvd2VyQ2FzZSgpXSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucHJvZmVzc2lvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmdldChcInByb2Zlc3Npb25zXCIpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZW5kZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2V4dHJhR2VuZGVyczogW119KTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayhbJ01hbGUnLCAnRmVtYWxlJ10uY29uY2F0KG9wdGlvbnMuZXh0cmFHZW5kZXJzKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubGFzdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bmF0aW9uYWxpdHk6ICdlbid9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmdldChcImxhc3ROYW1lc1wiKVtvcHRpb25zLm5hdGlvbmFsaXR5LnRvTG93ZXJDYXNlKCldKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pc3JhZWxJZD1mdW5jdGlvbigpe1xuICAgICAgICB2YXIgeD10aGlzLnN0cmluZyh7cG9vbDogJzAxMjM0NTY3ODknLGxlbmd0aDo4fSk7XG4gICAgICAgIHZhciB5PTA7XG4gICAgICAgIGZvciAodmFyIGk9MDtpPHgubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICB2YXIgdGhpc0RpZ2l0PSAgeFtpXSAqICAoaS8yPT09cGFyc2VJbnQoaS8yKSA/IDEgOiAyKTtcbiAgICAgICAgICAgIHRoaXNEaWdpdD10aGlzLnBhZCh0aGlzRGlnaXQsMikudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHRoaXNEaWdpdD1wYXJzZUludCh0aGlzRGlnaXRbMF0pICsgcGFyc2VJbnQodGhpc0RpZ2l0WzFdKTtcbiAgICAgICAgICAgIHk9eSt0aGlzRGlnaXQ7XG4gICAgICAgIH1cbiAgICAgICAgeD14KygxMC1wYXJzZUludCh5LnRvU3RyaW5nKCkuc2xpY2UoLTEpKSkudG9TdHJpbmcoKS5zbGljZSgtMSk7XG4gICAgICAgIHJldHVybiB4O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1yeiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBjaGVja0RpZ2l0ID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgICAgICB2YXIgYWxwaGEgPSBcIjxBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWFpcIi5zcGxpdCgnJyksXG4gICAgICAgICAgICAgICAgbXVsdGlwbGllcnMgPSBbIDcsIDMsIDEgXSxcbiAgICAgICAgICAgICAgICBydW5uaW5nVG90YWwgPSAwO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGlucHV0ID0gaW5wdXQudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5wdXQuc3BsaXQoJycpLmZvckVhY2goZnVuY3Rpb24oY2hhcmFjdGVyLCBpZHgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcG9zID0gYWxwaGEuaW5kZXhPZihjaGFyYWN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgaWYocG9zICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBjaGFyYWN0ZXIgPSBwb3MgPT09IDAgPyAwIDogcG9zICsgOTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjaGFyYWN0ZXIgPSBwYXJzZUludChjaGFyYWN0ZXIsIDEwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2hhcmFjdGVyICo9IG11bHRpcGxpZXJzW2lkeCAlIG11bHRpcGxpZXJzLmxlbmd0aF07XG4gICAgICAgICAgICAgICAgcnVubmluZ1RvdGFsICs9IGNoYXJhY3RlcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJ1bm5pbmdUb3RhbCAlIDEwO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZ2VuZXJhdGUgPSBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICAgICAgdmFyIHBhZCA9IGZ1bmN0aW9uIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEFycmF5KGxlbmd0aCArIDEpLmpvaW4oJzwnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgbnVtYmVyID0gWyAnUDwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5pc3N1ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmxhc3QudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICc8PCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmZpcnN0LnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBwYWQoMzkgLSAob3B0cy5sYXN0Lmxlbmd0aCArIG9wdHMuZmlyc3QubGVuZ3RoICsgMikpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5wYXNzcG9ydE51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrRGlnaXQob3B0cy5wYXNzcG9ydE51bWJlciksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLm5hdGlvbmFsaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5kb2IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja0RpZ2l0KG9wdHMuZG9iKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZ2VuZGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5leHBpcnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja0RpZ2l0KG9wdHMuZXhwaXJ5KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZCgxNCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja0RpZ2l0KHBhZCgxNCkpIF0uam9pbignJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBudW1iZXIgK1xuICAgICAgICAgICAgICAgIChjaGVja0RpZ2l0KG51bWJlci5zdWJzdHIoNDQsIDEwKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtYmVyLnN1YnN0cig1NywgNykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bWJlci5zdWJzdHIoNjUsIDcpKSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmaXJzdDogdGhpcy5maXJzdCgpLFxuICAgICAgICAgICAgbGFzdDogdGhpcy5sYXN0KCksXG4gICAgICAgICAgICBwYXNzcG9ydE51bWJlcjogdGhpcy5pbnRlZ2VyKHttaW46IDEwMDAwMDAwMCwgbWF4OiA5OTk5OTk5OTl9KSxcbiAgICAgICAgICAgIGRvYjogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0ZSA9IHRoYXQuYmlydGhkYXkoe3R5cGU6ICdhZHVsdCd9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2RhdGUuZ2V0RnVsbFllYXIoKS50b1N0cmluZygpLnN1YnN0cigyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0TW9udGgoKSArIDEsIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoZGF0ZS5nZXREYXRlKCksIDIpXS5qb2luKCcnKTtcbiAgICAgICAgICAgIH0oKSksXG4gICAgICAgICAgICBleHBpcnk6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBbKGRhdGUuZ2V0RnVsbFllYXIoKSArIDUpLnRvU3RyaW5nKCkuc3Vic3RyKDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoZGF0ZS5nZXRNb250aCgpICsgMSwgMiksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChkYXRlLmdldERhdGUoKSwgMildLmpvaW4oJycpO1xuICAgICAgICAgICAgfSgpKSxcbiAgICAgICAgICAgIGdlbmRlcjogdGhpcy5nZW5kZXIoKSA9PT0gJ0ZlbWFsZScgPyAnRic6ICdNJyxcbiAgICAgICAgICAgIGlzc3VlcjogJ0dCUicsXG4gICAgICAgICAgICBuYXRpb25hbGl0eTogJ0dCUidcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZSAob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgZmlyc3QgPSB0aGlzLmZpcnN0KG9wdGlvbnMpLFxuICAgICAgICAgICAgbGFzdCA9IHRoaXMubGFzdChvcHRpb25zKSxcbiAgICAgICAgICAgIG5hbWU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubWlkZGxlKSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyB0aGlzLmZpcnN0KG9wdGlvbnMpICsgJyAnICsgbGFzdDtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLm1pZGRsZV9pbml0aWFsKSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogJ3VwcGVyJ30pICsgJy4gJyArIGxhc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyBsYXN0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucHJlZml4KSB7XG4gICAgICAgICAgICBuYW1lID0gdGhpcy5wcmVmaXgob3B0aW9ucykgKyAnICcgKyBuYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3VmZml4KSB7XG4gICAgICAgICAgICBuYW1lID0gbmFtZSArICcgJyArIHRoaXMuc3VmZml4KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgbGlzdCBvZiBhdmFpbGFibGUgbmFtZSBwcmVmaXhlcyBiYXNlZCBvbiBzdXBwbGllZCBnZW5kZXIuXG4gICAgLy8gQHRvZG8gaW50cm9kdWNlIGludGVybmF0aW9uYWxpemF0aW9uXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3ByZWZpeGVzID0gZnVuY3Rpb24gKGdlbmRlcikge1xuICAgICAgICBnZW5kZXIgPSBnZW5kZXIgfHwgXCJhbGxcIjtcbiAgICAgICAgZ2VuZGVyID0gZ2VuZGVyLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgdmFyIHByZWZpeGVzID0gW1xuICAgICAgICAgICAgeyBuYW1lOiAnRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnRHIuJyB9XG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKGdlbmRlciA9PT0gXCJtYWxlXCIgfHwgZ2VuZGVyID09PSBcImFsbFwiKSB7XG4gICAgICAgICAgICBwcmVmaXhlcy5wdXNoKHsgbmFtZTogJ01pc3RlcicsIGFiYnJldmlhdGlvbjogJ01yLicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZ2VuZGVyID09PSBcImZlbWFsZVwiIHx8IGdlbmRlciA9PT0gXCJhbGxcIikge1xuICAgICAgICAgICAgcHJlZml4ZXMucHVzaCh7IG5hbWU6ICdNaXNzJywgYWJicmV2aWF0aW9uOiAnTWlzcycgfSk7XG4gICAgICAgICAgICBwcmVmaXhlcy5wdXNoKHsgbmFtZTogJ01pc3NlcycsIGFiYnJldmlhdGlvbjogJ01ycy4nIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByZWZpeGVzO1xuICAgIH07XG5cbiAgICAvLyBBbGlhcyBmb3IgbmFtZV9wcmVmaXhcbiAgICBDaGFuY2UucHJvdG90eXBlLnByZWZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hbWVfcHJlZml4KG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWVfcHJlZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgZ2VuZGVyOiBcImFsbFwiIH0pO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mdWxsID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfcHJlZml4ZXMob3B0aW9ucy5nZW5kZXIpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfcHJlZml4ZXMob3B0aW9ucy5nZW5kZXIpKS5hYmJyZXZpYXRpb247XG4gICAgfTtcbiAgICAvL0h1bmdhcmlhbiBJRCBudW1iZXJcbiAgICBDaGFuY2UucHJvdG90eXBlLkhJRE49IGZ1bmN0aW9uKCl7XG4gICAgIC8vSHVuZ2FyaWFuIElEIG51YmVyIHN0cnVjdHVyZTogWFhYWFhYWVkgKFg9bnVtYmVyLFk9Q2FwaXRhbCBMYXRpbiBsZXR0ZXIpXG4gICAgICB2YXIgaWRuX3Bvb2w9XCIwMTIzNDU2Nzg5XCI7XG4gICAgICB2YXIgaWRuX2NocnM9XCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWFpcIjtcbiAgICAgIHZhciBpZG49XCJcIjtcbiAgICAgICAgaWRuKz10aGlzLnN0cmluZyh7cG9vbDppZG5fcG9vbCxsZW5ndGg6Nn0pO1xuICAgICAgICBpZG4rPXRoaXMuc3RyaW5nKHtwb29sOmlkbl9jaHJzLGxlbmd0aDoyfSk7XG4gICAgICAgIHJldHVybiBpZG47XG4gICAgfTtcblxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zc24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge3NzbkZvdXI6IGZhbHNlLCBkYXNoZXM6IHRydWV9KTtcbiAgICAgICAgdmFyIHNzbl9wb29sID0gXCIxMjM0NTY3ODkwXCIsXG4gICAgICAgICAgICBzc24sXG4gICAgICAgICAgICBkYXNoID0gb3B0aW9ucy5kYXNoZXMgPyAnLScgOiAnJztcblxuICAgICAgICBpZighb3B0aW9ucy5zc25Gb3VyKSB7XG4gICAgICAgICAgICBzc24gPSB0aGlzLnN0cmluZyh7cG9vbDogc3NuX3Bvb2wsIGxlbmd0aDogM30pICsgZGFzaCArXG4gICAgICAgICAgICB0aGlzLnN0cmluZyh7cG9vbDogc3NuX3Bvb2wsIGxlbmd0aDogMn0pICsgZGFzaCArXG4gICAgICAgICAgICB0aGlzLnN0cmluZyh7cG9vbDogc3NuX3Bvb2wsIGxlbmd0aDogNH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3NuID0gdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDR9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3NuO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIG5hbWUgc3VmZml4ZXNcbiAgICAvLyBAdG9kbyBpbnRyb2R1Y2UgaW50ZXJuYXRpb25hbGl6YXRpb25cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWVfc3VmZml4ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdWZmaXhlcyA9IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ0RvY3RvciBvZiBPc3Rlb3BhdGhpYyBNZWRpY2luZScsIGFiYnJldmlhdGlvbjogJ0QuTy4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdEb2N0b3Igb2YgUGhpbG9zb3BoeScsIGFiYnJldmlhdGlvbjogJ1BoLkQuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnRXNxdWlyZScsIGFiYnJldmlhdGlvbjogJ0VzcS4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdKdW5pb3InLCBhYmJyZXZpYXRpb246ICdKci4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdKdXJpcyBEb2N0b3InLCBhYmJyZXZpYXRpb246ICdKLkQuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnTWFzdGVyIG9mIEFydHMnLCBhYmJyZXZpYXRpb246ICdNLkEuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnTWFzdGVyIG9mIEJ1c2luZXNzIEFkbWluaXN0cmF0aW9uJywgYWJicmV2aWF0aW9uOiAnTS5CLkEuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnTWFzdGVyIG9mIFNjaWVuY2UnLCBhYmJyZXZpYXRpb246ICdNLlMuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnTWVkaWNhbCBEb2N0b3InLCBhYmJyZXZpYXRpb246ICdNLkQuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnU2VuaW9yJywgYWJicmV2aWF0aW9uOiAnU3IuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnVGhlIFRoaXJkJywgYWJicmV2aWF0aW9uOiAnSUlJJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnVGhlIEZvdXJ0aCcsIGFiYnJldmlhdGlvbjogJ0lWJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnQmFjaGVsb3Igb2YgRW5naW5lZXJpbmcnLCBhYmJyZXZpYXRpb246ICdCLkUnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdCYWNoZWxvciBvZiBUZWNobm9sb2d5JywgYWJicmV2aWF0aW9uOiAnQi5URUNIJyB9XG4gICAgICAgIF07XG4gICAgICAgIHJldHVybiBzdWZmaXhlcztcbiAgICB9O1xuXG4gICAgLy8gQWxpYXMgZm9yIG5hbWVfc3VmZml4XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdWZmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5uYW1lX3N1ZmZpeChvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3N1ZmZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZnVsbCA/XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5uYW1lX3N1ZmZpeGVzKCkpLm5hbWUgOlxuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMubmFtZV9zdWZmaXhlcygpKS5hYmJyZXZpYXRpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubmF0aW9uYWxpdGllcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwibmF0aW9uYWxpdGllc1wiKTtcbiAgICB9O1xuXG4gICAgLy8gR2VuZXJhdGUgcmFuZG9tIG5hdGlvbmFsaXR5IGJhc2VkIG9uIGpzb24gbGlzdFxuICAgIENoYW5jZS5wcm90b3R5cGUubmF0aW9uYWxpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuYXRpb25hbGl0eSA9IHRoaXMucGljayh0aGlzLm5hdGlvbmFsaXRpZXMoKSk7XG4gICAgICAgIHJldHVybiBuYXRpb25hbGl0eS5uYW1lO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgUGVyc29uIC0tXG5cbiAgICAvLyAtLSBNb2JpbGUgLS1cbiAgICAvLyBBbmRyb2lkIEdDTSBSZWdpc3RyYXRpb24gSURcbiAgICBDaGFuY2UucHJvdG90eXBlLmFuZHJvaWRfaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBcIkFQQTkxXCIgKyB0aGlzLnN0cmluZyh7IHBvb2w6IFwiMDEyMzQ1Njc4OWFiY2VmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWi1fXCIsIGxlbmd0aDogMTc4IH0pO1xuICAgIH07XG5cbiAgICAvLyBBcHBsZSBQdXNoIFRva2VuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hcHBsZV90b2tlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nKHsgcG9vbDogXCJhYmNkZWYxMjM0NTY3ODkwXCIsIGxlbmd0aDogNjQgfSk7XG4gICAgfTtcblxuICAgIC8vIFdpbmRvd3MgUGhvbmUgOCBBTklEMlxuICAgIENoYW5jZS5wcm90b3R5cGUud3A4X2FuaWQyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYmFzZTY0KCB0aGlzLmhhc2goIHsgbGVuZ3RoIDogMzIgfSApICk7XG4gICAgfTtcblxuICAgIC8vIFdpbmRvd3MgUGhvbmUgNyBBTklEXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53cDdfYW5pZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICdBPScgKyB0aGlzLmd1aWQoKS5yZXBsYWNlKC8tL2csICcnKS50b1VwcGVyQ2FzZSgpICsgJyZFPScgKyB0aGlzLmhhc2goeyBsZW5ndGg6MyB9KSArICcmVz0nICsgdGhpcy5pbnRlZ2VyKHsgbWluOjAsIG1heDo5IH0pO1xuICAgIH07XG5cbiAgICAvLyBCbGFja0JlcnJ5IERldmljZSBQSU5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJiX3BpbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaGFzaCh7IGxlbmd0aDogOCB9KTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIE1vYmlsZSAtLVxuXG4gICAgLy8gLS0gV2ViIC0tXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hdmF0YXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgdXJsID0gbnVsbDtcbiAgICAgICAgdmFyIFVSTF9CQVNFID0gJy8vd3d3LmdyYXZhdGFyLmNvbS9hdmF0YXIvJztcbiAgICAgICAgdmFyIFBST1RPQ09MUyA9IHtcbiAgICAgICAgICAgIGh0dHA6ICdodHRwJyxcbiAgICAgICAgICAgIGh0dHBzOiAnaHR0cHMnXG4gICAgICAgIH07XG4gICAgICAgIHZhciBGSUxFX1RZUEVTID0ge1xuICAgICAgICAgICAgYm1wOiAnYm1wJyxcbiAgICAgICAgICAgIGdpZjogJ2dpZicsXG4gICAgICAgICAgICBqcGc6ICdqcGcnLFxuICAgICAgICAgICAgcG5nOiAncG5nJ1xuICAgICAgICB9O1xuICAgICAgICB2YXIgRkFMTEJBQ0tTID0ge1xuICAgICAgICAgICAgJzQwNCc6ICc0MDQnLCAvLyBSZXR1cm4gNDA0IGlmIG5vdCBmb3VuZFxuICAgICAgICAgICAgbW06ICdtbScsIC8vIE15c3RlcnkgbWFuXG4gICAgICAgICAgICBpZGVudGljb246ICdpZGVudGljb24nLCAvLyBHZW9tZXRyaWMgcGF0dGVybiBiYXNlZCBvbiBoYXNoXG4gICAgICAgICAgICBtb25zdGVyaWQ6ICdtb25zdGVyaWQnLCAvLyBBIGdlbmVyYXRlZCBtb25zdGVyIGljb25cbiAgICAgICAgICAgIHdhdmF0YXI6ICd3YXZhdGFyJywgLy8gQSBnZW5lcmF0ZWQgZmFjZVxuICAgICAgICAgICAgcmV0cm86ICdyZXRybycsIC8vIDgtYml0IGljb25cbiAgICAgICAgICAgIGJsYW5rOiAnYmxhbmsnIC8vIEEgdHJhbnNwYXJlbnQgcG5nXG4gICAgICAgIH07XG4gICAgICAgIHZhciBSQVRJTkdTID0ge1xuICAgICAgICAgICAgZzogJ2cnLFxuICAgICAgICAgICAgcGc6ICdwZycsXG4gICAgICAgICAgICByOiAncicsXG4gICAgICAgICAgICB4OiAneCdcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICBwcm90b2NvbDogbnVsbCxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgZmlsZUV4dGVuc2lvbjogbnVsbCxcbiAgICAgICAgICAgIHNpemU6IG51bGwsXG4gICAgICAgICAgICBmYWxsYmFjazogbnVsbCxcbiAgICAgICAgICAgIHJhdGluZzogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICAgICAgLy8gU2V0IHRvIGEgcmFuZG9tIGVtYWlsXG4gICAgICAgICAgICBvcHRzLmVtYWlsID0gdGhpcy5lbWFpbCgpO1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgb3B0cy5lbWFpbCA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmNvbnN0cnVjdG9yID09PSAnQXJyYXknKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdHMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCBvcHRzKTtcblxuICAgICAgICBpZiAoIW9wdHMuZW1haWwpIHtcbiAgICAgICAgICAgIC8vIFNldCB0byBhIHJhbmRvbSBlbWFpbFxuICAgICAgICAgICAgb3B0cy5lbWFpbCA9IHRoaXMuZW1haWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNhZmUgY2hlY2tpbmcgZm9yIHBhcmFtc1xuICAgICAgICBvcHRzLnByb3RvY29sID0gUFJPVE9DT0xTW29wdHMucHJvdG9jb2xdID8gb3B0cy5wcm90b2NvbCArICc6JyA6ICcnO1xuICAgICAgICBvcHRzLnNpemUgPSBwYXJzZUludChvcHRzLnNpemUsIDApID8gb3B0cy5zaXplIDogJyc7XG4gICAgICAgIG9wdHMucmF0aW5nID0gUkFUSU5HU1tvcHRzLnJhdGluZ10gPyBvcHRzLnJhdGluZyA6ICcnO1xuICAgICAgICBvcHRzLmZhbGxiYWNrID0gRkFMTEJBQ0tTW29wdHMuZmFsbGJhY2tdID8gb3B0cy5mYWxsYmFjayA6ICcnO1xuICAgICAgICBvcHRzLmZpbGVFeHRlbnNpb24gPSBGSUxFX1RZUEVTW29wdHMuZmlsZUV4dGVuc2lvbl0gPyBvcHRzLmZpbGVFeHRlbnNpb24gOiAnJztcblxuICAgICAgICB1cmwgPVxuICAgICAgICAgICAgb3B0cy5wcm90b2NvbCArXG4gICAgICAgICAgICBVUkxfQkFTRSArXG4gICAgICAgICAgICB0aGlzLmJpbWQ1Lm1kNShvcHRzLmVtYWlsKSArXG4gICAgICAgICAgICAob3B0cy5maWxlRXh0ZW5zaW9uID8gJy4nICsgb3B0cy5maWxlRXh0ZW5zaW9uIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLnNpemUgfHwgb3B0cy5yYXRpbmcgfHwgb3B0cy5mYWxsYmFjayA/ICc/JyA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5zaXplID8gJyZzPScgKyBvcHRzLnNpemUudG9TdHJpbmcoKSA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5yYXRpbmcgPyAnJnI9JyArIG9wdHMucmF0aW5nIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLmZhbGxiYWNrID8gJyZkPScgKyBvcHRzLmZhbGxiYWNrIDogJycpXG4gICAgICAgICAgICA7XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogI0Rlc2NyaXB0aW9uOlxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogR2VuZXJhdGUgcmFuZG9tIGNvbG9yIHZhbHVlIGJhc2Ugb24gY29sb3IgdHlwZTpcbiAgICAgKiAtPiBoZXhcbiAgICAgKiAtPiByZ2JcbiAgICAgKiAtPiByZ2JhXG4gICAgICogLT4gMHhcbiAgICAgKiAtPiBuYW1lZCBjb2xvclxuICAgICAqXG4gICAgICogI0V4YW1wbGVzOlxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogKiBHZWVyYXRlIHJhbmRvbSBoZXggY29sb3JcbiAgICAgKiBjaGFuY2UuY29sb3IoKSA9PiAnIzc5YzE1NycgLyAncmdiKDExMCw1MiwxNjQpJyAvICcweDY3YWUwYicgLyAnI2UyZTJlMicgLyAnIzI5Q0ZBNydcbiAgICAgKlxuICAgICAqICogR2VuZXJhdGUgSGV4IGJhc2VkIGNvbG9yIHZhbHVlXG4gICAgICogY2hhbmNlLmNvbG9yKHtmb3JtYXQ6ICdoZXgnfSkgICAgPT4gJyNkNjcxMTgnXG4gICAgICpcbiAgICAgKiAqIEdlbmVyYXRlIHNpbXBsZSByZ2IgdmFsdWVcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2Zvcm1hdDogJ3JnYid9KSAgICA9PiAncmdiKDExMCw1MiwxNjQpJ1xuICAgICAqXG4gICAgICogKiBHZW5lcmF0ZSBPeCBiYXNlZCBjb2xvciB2YWx1ZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Zm9ybWF0OiAnMHgnfSkgICAgID0+ICcweDY3YWUwYidcbiAgICAgKlxuICAgICAqICogR2VuZXJhdGUgZ3JhaXNjYWxlIGJhc2VkIHZhbHVlXG4gICAgICogY2hhbmNlLmNvbG9yKHtncmF5c2NhbGU6IHRydWV9KSAgPT4gJyNlMmUyZTInXG4gICAgICpcbiAgICAgKiAqIFJldHVybiB2YWxpZGUgY29sb3IgbmFtZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Zm9ybWF0OiAnbmFtZSd9KSAgID0+ICdyZWQnXG4gICAgICpcbiAgICAgKiAqIE1ha2UgY29sb3IgdXBwZXJjYXNlXG4gICAgICogY2hhbmNlLmNvbG9yKHtjYXNpbmc6ICd1cHBlcid9KSAgPT4gJyMyOUNGQTcnXG5cdCBcblx0ICogKiBNaW4gTWF4IHZhbHVlcyBmb3IgUkdCQVxuXHQgKiB2YXIgbGlnaHRfcmVkID0gY2hhbmNlLmNvbG9yKHtmb3JtYXQ6ICdoZXgnLCBtaW5fcmVkOiAyMDAsIG1heF9yZWQ6IDI1NSwgbWF4X2dyZWVuOiAwLCBtYXhfYmx1ZTogMCwgbWluX2FscGhhOiAuMiwgbWF4X2FscGhhOiAuM30pO1xuICAgICAqXG4gICAgICogQHBhcmFtICBbb2JqZWN0XSBvcHRpb25zXG4gICAgICogQHJldHVybiBbc3RyaW5nXSBjb2xvciB2YWx1ZVxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuY29sb3IgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuXHRcdGZ1bmN0aW9uIHBhZChuLCB3aWR0aCwgeikge1xuXHRcdFx0eiA9IHogfHwgJzAnO1xuXHRcdFx0biA9IG4gKyAnJztcblx0XHRcdHJldHVybiBuLmxlbmd0aCA+PSB3aWR0aCA/IG4gOiBuZXcgQXJyYXkod2lkdGggLSBuLmxlbmd0aCArIDEpLmpvaW4oeikgKyBuO1xuXHRcdH1cblx0XHRcbiAgICAgICAgZnVuY3Rpb24gZ3JheSh2YWx1ZSwgZGVsaW1pdGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gW3ZhbHVlLCB2YWx1ZSwgdmFsdWVdLmpvaW4oZGVsaW1pdGVyIHx8ICcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJnYihoYXNBbHBoYSkge1xuICAgICAgICAgICAgdmFyIHJnYlZhbHVlICAgICA9IChoYXNBbHBoYSkgICAgPyAncmdiYScgOiAncmdiJztcbiAgICAgICAgICAgIHZhciBhbHBoYUNoYW5uZWwgPSAoaGFzQWxwaGEpICAgID8gKCcsJyArIHRoaXMuZmxvYXRpbmcoe21pbjptaW5fYWxwaGEsIG1heDptYXhfYWxwaGF9KSkgOiBcIlwiO1xuICAgICAgICAgICAgdmFyIGNvbG9yVmFsdWUgICA9IChpc0dyYXlzY2FsZSkgPyAoZ3JheSh0aGlzLm5hdHVyYWwoe21pbjogbWluX3JnYiwgbWF4OiBtYXhfcmdifSksICcsJykpIDogKHRoaXMubmF0dXJhbCh7bWluOiBtaW5fZ3JlZW4sIG1heDogbWF4X2dyZWVufSkgKyAnLCcgKyB0aGlzLm5hdHVyYWwoe21pbjogbWluX2JsdWUsIG1heDogbWF4X2JsdWV9KSArICcsJyArIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSk7XG4gICAgICAgICAgICByZXR1cm4gcmdiVmFsdWUgKyAnKCcgKyBjb2xvclZhbHVlICsgYWxwaGFDaGFubmVsICsgJyknO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaGV4KHN0YXJ0LCBlbmQsIHdpdGhIYXNoKSB7XG4gICAgICAgICAgICB2YXIgc3ltYm9sID0gKHdpdGhIYXNoKSA/IFwiI1wiIDogXCJcIjtcblx0XHRcdHZhciBoZXhzdHJpbmcgPSBcIlwiO1xuXHRcdFx0XG5cdFx0XHRpZiAoaXNHcmF5c2NhbGUpIHtcblx0XHRcdFx0aGV4c3RyaW5nID0gZ3JheShwYWQodGhpcy5oZXgoe21pbjogbWluX3JnYiwgbWF4OiBtYXhfcmdifSksIDIpKTtcblx0XHRcdFx0aWYgKG9wdGlvbnMuZm9ybWF0ID09PSBcInNob3J0aGV4XCIpIHtcblx0XHRcdFx0XHRoZXhzdHJpbmcgPSBncmF5KHRoaXMuaGV4KHttaW46IDAsIG1heDogMTV9KSk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coXCJoZXg6IFwiICsgaGV4c3RyaW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmIChvcHRpb25zLmZvcm1hdCA9PT0gXCJzaG9ydGhleFwiKSB7XG5cdFx0XHRcdFx0aGV4c3RyaW5nID0gcGFkKHRoaXMuaGV4KHttaW46IE1hdGguZmxvb3IobWluX3JlZCAvIDE2KSwgbWF4OiBNYXRoLmZsb29yKG1heF9yZWQgLyAxNil9KSwgMSkgKyBwYWQodGhpcy5oZXgoe21pbjogTWF0aC5mbG9vcihtaW5fZ3JlZW4gLyAxNiksIG1heDogTWF0aC5mbG9vcihtYXhfZ3JlZW4gLyAxNil9KSwgMSkgKyBwYWQodGhpcy5oZXgoe21pbjogTWF0aC5mbG9vcihtaW5fYmx1ZSAvIDE2KSwgbWF4OiBNYXRoLmZsb29yKG1heF9ibHVlIC8gMTYpfSksIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKG1pbl9yZWQgIT09IHVuZGVmaW5lZCB8fCBtYXhfcmVkICE9PSB1bmRlZmluZWQgfHwgbWluX2dyZWVuICE9PSB1bmRlZmluZWQgfHwgbWF4X2dyZWVuICE9PSB1bmRlZmluZWQgfHwgbWluX2JsdWUgIT09IHVuZGVmaW5lZCB8fCBtYXhfYmx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0aGV4c3RyaW5nID0gcGFkKHRoaXMuaGV4KHttaW46IG1pbl9yZWQsIG1heDogbWF4X3JlZH0pLCAyKSArIHBhZCh0aGlzLmhleCh7bWluOiBtaW5fZ3JlZW4sIG1heDogbWF4X2dyZWVufSksIDIpICsgcGFkKHRoaXMuaGV4KHttaW46IG1pbl9ibHVlLCBtYXg6IG1heF9ibHVlfSksIDIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGhleHN0cmluZyA9IHBhZCh0aGlzLmhleCh7bWluOiBtaW5fcmdiLCBtYXg6IG1heF9yZ2J9KSwgMikgKyBwYWQodGhpcy5oZXgoe21pbjogbWluX3JnYiwgbWF4OiBtYXhfcmdifSksIDIpICsgcGFkKHRoaXMuaGV4KHttaW46IG1pbl9yZ2IsIG1heDogbWF4X3JnYn0pLCAyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG4gICAgICAgICAgICByZXR1cm4gc3ltYm9sICsgaGV4c3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGZvcm1hdDogdGhpcy5waWNrKFsnaGV4JywgJ3Nob3J0aGV4JywgJ3JnYicsICdyZ2JhJywgJzB4JywgJ25hbWUnXSksXG4gICAgICAgICAgICBncmF5c2NhbGU6IGZhbHNlLFxuICAgICAgICAgICAgY2FzaW5nOiAnbG93ZXInLCBcblx0XHRcdG1pbjogMCwgXG5cdFx0XHRtYXg6IDI1NSwgXG5cdFx0XHRtaW5fcmVkOiB1bmRlZmluZWQsXG5cdFx0XHRtYXhfcmVkOiB1bmRlZmluZWQsIFxuXHRcdFx0bWluX2dyZWVuOiB1bmRlZmluZWQsXG5cdFx0XHRtYXhfZ3JlZW46IHVuZGVmaW5lZCwgXG5cdFx0XHRtaW5fYmx1ZTogdW5kZWZpbmVkLCBcblx0XHRcdG1heF9ibHVlOiB1bmRlZmluZWQsIFxuXHRcdFx0bWluX2FscGhhOiAwLFxuXHRcdFx0bWF4X2FscGhhOiAxXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBpc0dyYXlzY2FsZSA9IG9wdGlvbnMuZ3JheXNjYWxlO1xuXHRcdHZhciBtaW5fcmdiID0gb3B0aW9ucy5taW47XG5cdFx0dmFyIG1heF9yZ2IgPSBvcHRpb25zLm1heDtcdFx0XG5cdFx0dmFyIG1pbl9yZWQgPSBvcHRpb25zLm1pbl9yZWQ7XG5cdFx0dmFyIG1heF9yZWQgPSBvcHRpb25zLm1heF9yZWQ7XG5cdFx0dmFyIG1pbl9ncmVlbiA9IG9wdGlvbnMubWluX2dyZWVuO1xuXHRcdHZhciBtYXhfZ3JlZW4gPSBvcHRpb25zLm1heF9ncmVlbjtcblx0XHR2YXIgbWluX2JsdWUgPSBvcHRpb25zLm1pbl9ibHVlO1xuXHRcdHZhciBtYXhfYmx1ZSA9IG9wdGlvbnMubWF4X2JsdWU7XG5cdFx0dmFyIG1pbl9hbHBoYSA9IG9wdGlvbnMubWluX2FscGhhO1xuXHRcdHZhciBtYXhfYWxwaGEgPSBvcHRpb25zLm1heF9hbHBoYTtcblx0XHRpZiAob3B0aW9ucy5taW5fcmVkID09PSB1bmRlZmluZWQpIHsgbWluX3JlZCA9IG1pbl9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5tYXhfcmVkID09PSB1bmRlZmluZWQpIHsgbWF4X3JlZCA9IG1heF9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5taW5fZ3JlZW4gPT09IHVuZGVmaW5lZCkgeyBtaW5fZ3JlZW4gPSBtaW5fcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWF4X2dyZWVuID09PSB1bmRlZmluZWQpIHsgbWF4X2dyZWVuID0gbWF4X3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1pbl9ibHVlID09PSB1bmRlZmluZWQpIHsgbWluX2JsdWUgPSBtaW5fcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWF4X2JsdWUgPT09IHVuZGVmaW5lZCkgeyBtYXhfYmx1ZSA9IG1heF9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5taW5fYWxwaGEgPT09IHVuZGVmaW5lZCkgeyBtaW5fYWxwaGEgPSAwOyB9XG5cdFx0aWYgKG9wdGlvbnMubWF4X2FscGhhID09PSB1bmRlZmluZWQpIHsgbWF4X2FscGhhID0gMTsgfVxuXHRcdGlmIChpc0dyYXlzY2FsZSAmJiBtaW5fcmdiID09PSAwICYmIG1heF9yZ2IgPT09IDI1NSAmJiBtaW5fcmVkICE9PSB1bmRlZmluZWQgJiYgbWF4X3JlZCAhPT0gdW5kZWZpbmVkKSB7XHRcdFx0XG5cdFx0XHRtaW5fcmdiID0gKChtaW5fcmVkICsgbWluX2dyZWVuICsgbWluX2JsdWUpIC8gMyk7XG5cdFx0XHRtYXhfcmdiID0gKChtYXhfcmVkICsgbWF4X2dyZWVuICsgbWF4X2JsdWUpIC8gMyk7XG5cdFx0fVxuICAgICAgICB2YXIgY29sb3JWYWx1ZTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdoZXgnKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gaGV4LmNhbGwodGhpcywgMiwgNiwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdzaG9ydGhleCcpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSBoZXguY2FsbCh0aGlzLCAxLCAzLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ3JnYicpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSByZ2IuY2FsbCh0aGlzLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdyZ2JhJykge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IHJnYi5jYWxsKHRoaXMsIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnMHgnKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gJzB4JyArIGhleC5jYWxsKHRoaXMsIDIsIDYpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5mb3JtYXQgPT09ICduYW1lJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmdldChcImNvbG9yTmFtZXNcIikpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgZm9ybWF0IHByb3ZpZGVkLiBQbGVhc2UgcHJvdmlkZSBvbmUgb2YgXCJoZXhcIiwgXCJzaG9ydGhleFwiLCBcInJnYlwiLCBcInJnYmFcIiwgXCIweFwiIG9yIFwibmFtZVwiLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2FzaW5nID09PSAndXBwZXInICkge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IGNvbG9yVmFsdWUudG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb2xvclZhbHVlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRvbWFpbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud29yZCgpICsgJy4nICsgKG9wdGlvbnMudGxkIHx8IHRoaXMudGxkKCkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmVtYWlsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy53b3JkKHtsZW5ndGg6IG9wdGlvbnMubGVuZ3RofSkgKyAnQCcgKyAob3B0aW9ucy5kb21haW4gfHwgdGhpcy5kb21haW4oKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZmJpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KCcxMDAwMCcgKyB0aGlzLm5hdHVyYWwoe21heDogMTAwMDAwMDAwMDAwfSksIDEwKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nb29nbGVfYW5hbHl0aWNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYWNjb3VudCA9IHRoaXMucGFkKHRoaXMubmF0dXJhbCh7bWF4OiA5OTk5OTl9KSwgNik7XG4gICAgICAgIHZhciBwcm9wZXJ0eSA9IHRoaXMucGFkKHRoaXMubmF0dXJhbCh7bWF4OiA5OX0pLCAyKTtcblxuICAgICAgICByZXR1cm4gJ1VBLScgKyBhY2NvdW50ICsgJy0nICsgcHJvcGVydHk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaGFzaHRhZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjJyArIHRoaXMud29yZCgpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmlwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBUb2RvOiBUaGlzIGNvdWxkIHJldHVybiBzb21lIHJlc2VydmVkIElQcy4gU2VlIGh0dHA6Ly92cS5pby8xMzdkZ1l5XG4gICAgICAgIC8vIHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIHVwZGF0ZWQgdG8gYWNjb3VudCBmb3IgdGhhdCByYXJlIGFzIGl0IG1heSBiZVxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogMjU0fSkgKyAnLicgK1xuICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJy4nICtcbiAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcuJyArXG4gICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiAyNTR9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pcHY2ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgaXBfYWRkciA9IHRoaXMubih0aGlzLmhhc2gsIDgsIHtsZW5ndGg6IDR9KTtcblxuICAgICAgICByZXR1cm4gaXBfYWRkci5qb2luKFwiOlwiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5rbG91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDk5fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc2VtdmVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgaW5jbHVkZV9wcmVyZWxlYXNlOiB0cnVlIH0pO1xuXG4gICAgICAgIHZhciByYW5nZSA9IHRoaXMucGlja29uZShbXCJeXCIsIFwiflwiLCBcIjxcIiwgXCI+XCIsIFwiPD1cIiwgXCI+PVwiLCBcIj1cIl0pO1xuICAgICAgICBpZiAob3B0aW9ucy5yYW5nZSkge1xuICAgICAgICAgICAgcmFuZ2UgPSBvcHRpb25zLnJhbmdlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByZXJlbGVhc2UgPSBcIlwiO1xuICAgICAgICBpZiAob3B0aW9ucy5pbmNsdWRlX3ByZXJlbGVhc2UpIHtcbiAgICAgICAgICAgIHByZXJlbGVhc2UgPSB0aGlzLndlaWdodGVkKFtcIlwiLCBcIi1kZXZcIiwgXCItYmV0YVwiLCBcIi1hbHBoYVwiXSwgWzUwLCAxMCwgNSwgMV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByYW5nZSArIHRoaXMucnBnKCczZDEwJykuam9pbignLicpICsgcHJlcmVsZWFzZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50bGRzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gWydjb20nLCAnb3JnJywgJ2VkdScsICdnb3YnLCAnY28udWsnLCAnbmV0JywgJ2lvJywgJ2FjJywgJ2FkJywgJ2FlJywgJ2FmJywgJ2FnJywgJ2FpJywgJ2FsJywgJ2FtJywgJ2FuJywgJ2FvJywgJ2FxJywgJ2FyJywgJ2FzJywgJ2F0JywgJ2F1JywgJ2F3JywgJ2F4JywgJ2F6JywgJ2JhJywgJ2JiJywgJ2JkJywgJ2JlJywgJ2JmJywgJ2JnJywgJ2JoJywgJ2JpJywgJ2JqJywgJ2JtJywgJ2JuJywgJ2JvJywgJ2JxJywgJ2JyJywgJ2JzJywgJ2J0JywgJ2J2JywgJ2J3JywgJ2J5JywgJ2J6JywgJ2NhJywgJ2NjJywgJ2NkJywgJ2NmJywgJ2NnJywgJ2NoJywgJ2NpJywgJ2NrJywgJ2NsJywgJ2NtJywgJ2NuJywgJ2NvJywgJ2NyJywgJ2N1JywgJ2N2JywgJ2N3JywgJ2N4JywgJ2N5JywgJ2N6JywgJ2RlJywgJ2RqJywgJ2RrJywgJ2RtJywgJ2RvJywgJ2R6JywgJ2VjJywgJ2VlJywgJ2VnJywgJ2VoJywgJ2VyJywgJ2VzJywgJ2V0JywgJ2V1JywgJ2ZpJywgJ2ZqJywgJ2ZrJywgJ2ZtJywgJ2ZvJywgJ2ZyJywgJ2dhJywgJ2diJywgJ2dkJywgJ2dlJywgJ2dmJywgJ2dnJywgJ2doJywgJ2dpJywgJ2dsJywgJ2dtJywgJ2duJywgJ2dwJywgJ2dxJywgJ2dyJywgJ2dzJywgJ2d0JywgJ2d1JywgJ2d3JywgJ2d5JywgJ2hrJywgJ2htJywgJ2huJywgJ2hyJywgJ2h0JywgJ2h1JywgJ2lkJywgJ2llJywgJ2lsJywgJ2ltJywgJ2luJywgJ2lvJywgJ2lxJywgJ2lyJywgJ2lzJywgJ2l0JywgJ2plJywgJ2ptJywgJ2pvJywgJ2pwJywgJ2tlJywgJ2tnJywgJ2toJywgJ2tpJywgJ2ttJywgJ2tuJywgJ2twJywgJ2tyJywgJ2t3JywgJ2t5JywgJ2t6JywgJ2xhJywgJ2xiJywgJ2xjJywgJ2xpJywgJ2xrJywgJ2xyJywgJ2xzJywgJ2x0JywgJ2x1JywgJ2x2JywgJ2x5JywgJ21hJywgJ21jJywgJ21kJywgJ21lJywgJ21nJywgJ21oJywgJ21rJywgJ21sJywgJ21tJywgJ21uJywgJ21vJywgJ21wJywgJ21xJywgJ21yJywgJ21zJywgJ210JywgJ211JywgJ212JywgJ213JywgJ214JywgJ215JywgJ216JywgJ25hJywgJ25jJywgJ25lJywgJ25mJywgJ25nJywgJ25pJywgJ25sJywgJ25vJywgJ25wJywgJ25yJywgJ251JywgJ256JywgJ29tJywgJ3BhJywgJ3BlJywgJ3BmJywgJ3BnJywgJ3BoJywgJ3BrJywgJ3BsJywgJ3BtJywgJ3BuJywgJ3ByJywgJ3BzJywgJ3B0JywgJ3B3JywgJ3B5JywgJ3FhJywgJ3JlJywgJ3JvJywgJ3JzJywgJ3J1JywgJ3J3JywgJ3NhJywgJ3NiJywgJ3NjJywgJ3NkJywgJ3NlJywgJ3NnJywgJ3NoJywgJ3NpJywgJ3NqJywgJ3NrJywgJ3NsJywgJ3NtJywgJ3NuJywgJ3NvJywgJ3NyJywgJ3NzJywgJ3N0JywgJ3N1JywgJ3N2JywgJ3N4JywgJ3N5JywgJ3N6JywgJ3RjJywgJ3RkJywgJ3RmJywgJ3RnJywgJ3RoJywgJ3RqJywgJ3RrJywgJ3RsJywgJ3RtJywgJ3RuJywgJ3RvJywgJ3RwJywgJ3RyJywgJ3R0JywgJ3R2JywgJ3R3JywgJ3R6JywgJ3VhJywgJ3VnJywgJ3VrJywgJ3VzJywgJ3V5JywgJ3V6JywgJ3ZhJywgJ3ZjJywgJ3ZlJywgJ3ZnJywgJ3ZpJywgJ3ZuJywgJ3Z1JywgJ3dmJywgJ3dzJywgJ3llJywgJ3l0JywgJ3phJywgJ3ptJywgJ3p3J107XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudGxkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMudGxkcygpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50d2l0dGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ0AnICsgdGhpcy53b3JkKCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudXJsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgcHJvdG9jb2w6IFwiaHR0cFwiLCBkb21haW46IHRoaXMuZG9tYWluKG9wdGlvbnMpLCBkb21haW5fcHJlZml4OiBcIlwiLCBwYXRoOiB0aGlzLndvcmQoKSwgZXh0ZW5zaW9uczogW119KTtcblxuICAgICAgICB2YXIgZXh0ZW5zaW9uID0gb3B0aW9ucy5leHRlbnNpb25zLmxlbmd0aCA+IDAgPyBcIi5cIiArIHRoaXMucGljayhvcHRpb25zLmV4dGVuc2lvbnMpIDogXCJcIjtcbiAgICAgICAgdmFyIGRvbWFpbiA9IG9wdGlvbnMuZG9tYWluX3ByZWZpeCA/IG9wdGlvbnMuZG9tYWluX3ByZWZpeCArIFwiLlwiICsgb3B0aW9ucy5kb21haW4gOiBvcHRpb25zLmRvbWFpbjtcblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5wcm90b2NvbCArIFwiOi8vXCIgKyBkb21haW4gKyBcIi9cIiArIG9wdGlvbnMucGF0aCArIGV4dGVuc2lvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wb3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmludGVnZXIoe21pbjogMCwgbWF4OiA2NTUzNX0pO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgV2ViIC0tXG5cbiAgICAvLyAtLSBMb2NhdGlvbiAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hZGRyZXNzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDUsIG1heDogMjAwMH0pICsgJyAnICsgdGhpcy5zdHJlZXQob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYWx0aXR1ZGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2ZpeGVkOiA1LCBtaW46IDAsIG1heDogODg0OH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5mbG9hdGluZyh7XG4gICAgICAgICAgICBtaW46IG9wdGlvbnMubWluLFxuICAgICAgICAgICAgbWF4OiBvcHRpb25zLm1heCxcbiAgICAgICAgICAgIGZpeGVkOiBvcHRpb25zLmZpeGVkXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFyZWFjb2RlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtwYXJlbnMgOiB0cnVlfSk7XG4gICAgICAgIC8vIERvbid0IHdhbnQgYXJlYSBjb2RlcyB0byBzdGFydCB3aXRoIDEsIG9yIGhhdmUgYSA5IGFzIHRoZSBzZWNvbmQgZGlnaXRcbiAgICAgICAgdmFyIGFyZWFjb2RlID0gdGhpcy5uYXR1cmFsKHttaW46IDIsIG1heDogOX0pLnRvU3RyaW5nKCkgK1xuICAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWluOiAwLCBtYXg6IDh9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21pbjogMCwgbWF4OiA5fSkudG9TdHJpbmcoKTtcblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5wYXJlbnMgPyAnKCcgKyBhcmVhY29kZSArICcpJyA6IGFyZWFjb2RlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhcGl0YWxpemUodGhpcy53b3JkKHtzeWxsYWJsZXM6IDN9KSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY29vcmRpbmF0ZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXRpdHVkZShvcHRpb25zKSArICcsICcgKyB0aGlzLmxvbmdpdHVkZShvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb3VudHJpZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcImNvdW50cmllc1wiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb3VudHJ5ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB2YXIgY291bnRyeSA9IHRoaXMucGljayh0aGlzLmNvdW50cmllcygpKTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZnVsbCA/IGNvdW50cnkubmFtZSA6IGNvdW50cnkuYWJicmV2aWF0aW9uO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRlcHRoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAtMTA5OTQsIG1heDogMH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5mbG9hdGluZyh7XG4gICAgICAgICAgICBtaW46IG9wdGlvbnMubWluLFxuICAgICAgICAgICAgbWF4OiBvcHRpb25zLm1heCxcbiAgICAgICAgICAgIGZpeGVkOiBvcHRpb25zLmZpeGVkXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmdlb2hhc2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBsZW5ndGg6IDcgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmluZyh7IGxlbmd0aDogb3B0aW9ucy5sZW5ndGgsIHBvb2w6ICcwMTIzNDU2Nzg5YmNkZWZnaGprbW5wcXJzdHV2d3h5eicgfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZ2VvanNvbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxhdGl0dWRlKG9wdGlvbnMpICsgJywgJyArIHRoaXMubG9uZ2l0dWRlKG9wdGlvbnMpICsgJywgJyArIHRoaXMuYWx0aXR1ZGUob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubGF0aXR1ZGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2ZpeGVkOiA1LCBtaW46IC05MCwgbWF4OiA5MH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5mbG9hdGluZyh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heCwgZml4ZWQ6IG9wdGlvbnMuZml4ZWR9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sb25naXR1ZGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2ZpeGVkOiA1LCBtaW46IC0xODAsIG1heDogMTgwfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmZsb2F0aW5nKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4LCBmaXhlZDogb3B0aW9ucy5maXhlZH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBob25lID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgbnVtUGljayxcbiAgICAgICAgICAgIHVrTnVtID0gZnVuY3Rpb24gKHBhcnRzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlY3Rpb24gPSBbXTtcbiAgICAgICAgICAgICAgICAvL2ZpbGxzIHRoZSBzZWN0aW9uIHBhcnQgb2YgdGhlIHBob25lIG51bWJlciB3aXRoIHJhbmRvbSBudW1iZXJzLlxuICAgICAgICAgICAgICAgIHBhcnRzLnNlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24obikge1xuICAgICAgICAgICAgICAgICAgICBzZWN0aW9uLnB1c2goc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogbn0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFydHMuYXJlYSArIHNlY3Rpb24uam9pbignICcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGZvcm1hdHRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNvdW50cnk6ICd1cycsXG4gICAgICAgICAgICBtb2JpbGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIW9wdGlvbnMuZm9ybWF0dGVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLnBhcmVucyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwaG9uZTtcbiAgICAgICAgc3dpdGNoIChvcHRpb25zLmNvdW50cnkpIHtcbiAgICAgICAgICAgIGNhc2UgJ2ZyJzpcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmFsaWQgem9uZSBhbmQgZMOpcGFydGVtZW50IGNvZGVzLlxuICAgICAgICAgICAgICAgICAgICAgICAgJzAxJyArIHRoaXMucGljayhbJzMwJywgJzM0JywgJzM5JywgJzQwJywgJzQxJywgJzQyJywgJzQzJywgJzQ0JywgJzQ1JywgJzQ2JywgJzQ3JywgJzQ4JywgJzQ5JywgJzUzJywgJzU1JywgJzU2JywgJzU4JywgJzYwJywgJzY0JywgJzY5JywgJzcwJywgJzcyJywgJzczJywgJzc0JywgJzc1JywgJzc2JywgJzc3JywgJzc4JywgJzc5JywgJzgwJywgJzgxJywgJzgyJywgJzgzJ10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzAyJyArIHRoaXMucGljayhbJzE0JywgJzE4JywgJzIyJywgJzIzJywgJzI4JywgJzI5JywgJzMwJywgJzMxJywgJzMyJywgJzMzJywgJzM0JywgJzM1JywgJzM2JywgJzM3JywgJzM4JywgJzQwJywgJzQxJywgJzQzJywgJzQ0JywgJzQ1JywgJzQ2JywgJzQ3JywgJzQ4JywgJzQ5JywgJzUwJywgJzUxJywgJzUyJywgJzUzJywgJzU0JywgJzU2JywgJzU3JywgJzYxJywgJzYyJywgJzY5JywgJzcyJywgJzc2JywgJzc3JywgJzc4JywgJzg1JywgJzkwJywgJzk2JywgJzk3JywgJzk4JywgJzk5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzAzJyArIHRoaXMucGljayhbJzEwJywgJzIwJywgJzIxJywgJzIyJywgJzIzJywgJzI0JywgJzI1JywgJzI2JywgJzI3JywgJzI4JywgJzI5JywgJzM5JywgJzQ0JywgJzQ1JywgJzUxJywgJzUyJywgJzU0JywgJzU1JywgJzU3JywgJzU4JywgJzU5JywgJzYwJywgJzYxJywgJzYyJywgJzYzJywgJzY0JywgJzY1JywgJzY2JywgJzY3JywgJzY4JywgJzY5JywgJzcwJywgJzcxJywgJzcyJywgJzczJywgJzgwJywgJzgxJywgJzgyJywgJzgzJywgJzg0JywgJzg1JywgJzg2JywgJzg3JywgJzg4JywgJzg5JywgJzkwJ10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA0JyArIHRoaXMucGljayhbJzExJywgJzEzJywgJzE1JywgJzIwJywgJzIyJywgJzI2JywgJzI3JywgJzMwJywgJzMyJywgJzM0JywgJzM3JywgJzQyJywgJzQzJywgJzQ0JywgJzUwJywgJzU2JywgJzU3JywgJzYzJywgJzY2JywgJzY3JywgJzY4JywgJzY5JywgJzcwJywgJzcxJywgJzcyJywgJzczJywgJzc0JywgJzc1JywgJzc2JywgJzc3JywgJzc4JywgJzc5JywgJzgwJywgJzgxJywgJzgyJywgJzgzJywgJzg0JywgJzg1JywgJzg2JywgJzg4JywgJzg5JywgJzkwJywgJzkxJywgJzkyJywgJzkzJywgJzk0JywgJzk1JywgJzk3JywgJzk4J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA1JyArIHRoaXMucGljayhbJzA4JywgJzE2JywgJzE3JywgJzE5JywgJzI0JywgJzMxJywgJzMyJywgJzMzJywgJzM0JywgJzM1JywgJzQwJywgJzQ1JywgJzQ2JywgJzQ3JywgJzQ5JywgJzUzJywgJzU1JywgJzU2JywgJzU3JywgJzU4JywgJzU5JywgJzYxJywgJzYyJywgJzYzJywgJzY0JywgJzY1JywgJzY3JywgJzc5JywgJzgxJywgJzgyJywgJzg2JywgJzg3JywgJzkwJywgJzk0J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA5JyArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDh9KSxcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyBudW1QaWNrLm1hdGNoKC8uLi9nKS5qb2luKCcgJykgOiBudW1QaWNrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soWycwNicsICcwNyddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDh9KTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCA/IG51bVBpY2subWF0Y2goLy4uL2cpLmpvaW4oJyAnKSA6IG51bVBpY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndWsnOlxuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5tb2JpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3ZhbGlkIGFyZWEgY29kZXMgb2YgbWFqb3IgY2l0aWVzL2NvdW50aWVzIGZvbGxvd2VkIGJ5IHJhbmRvbSBudW1iZXJzIGluIHJlcXVpcmVkIGZvcm1hdC5cblxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDEnICsgdGhpcy5jaGFyYWN0ZXIoeyBwb29sOiAnMjM0NTY5JyB9KSArICcxICcsIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDIwICcgKyB0aGlzLmNoYXJhY3Rlcih7IHBvb2w6ICczNzgnIH0pLCBzZWN0aW9uczogWzMsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAyMyAnICsgdGhpcy5jaGFyYWN0ZXIoeyBwb29sOiAnODknIH0pLCBzZWN0aW9uczogWzMsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAyNCA3Jywgc2VjdGlvbnM6IFszLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMjggJyArIHRoaXMucGljayhbJzI1JywnMjgnLCczNycsJzcxJywnODInLCc5MCcsJzkyJywnOTUnXSksIHNlY3Rpb25zOiBbMiw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDEyJyArIHRoaXMucGljayhbJzA0JywnMDgnLCc1NCcsJzc2JywnOTcnLCc5OCddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDEzJyArIHRoaXMucGljayhbJzYzJywnNjQnLCc4NCcsJzg2J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTQnICsgdGhpcy5waWNrKFsnMDQnLCcyMCcsJzYwJywnNjEnLCc4MCcsJzg4J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTUnICsgdGhpcy5waWNrKFsnMjQnLCcyNycsJzYyJywnNjYnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNicgKyB0aGlzLnBpY2soWycwNicsJzI5JywnMzUnLCc0NycsJzU5JywnOTUnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNycgKyB0aGlzLnBpY2soWycyNicsJzQ0JywnNTAnLCc2OCddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE4JyArIHRoaXMucGljayhbJzI3JywnMzcnLCc4NCcsJzk3J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTknICsgdGhpcy5waWNrKFsnMDAnLCcwNScsJzM1JywnNDYnLCc0OScsJzYzJywnOTUnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfVxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCA/IHVrTnVtKG51bVBpY2spIDogdWtOdW0obnVtUGljaykucmVwbGFjZSgnICcsICcnLCAnZycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDcnICsgdGhpcy5waWNrKFsnNCcsJzUnLCc3JywnOCcsJzknXSksIHNlY3Rpb25zOiBbMiw2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDc2MjQgJywgc2VjdGlvbnM6IFs2XSB9XG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gdWtOdW0obnVtUGljaykgOiB1a051bShudW1QaWNrKS5yZXBsYWNlKCcgJywgJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3phJzpcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAnMDEnICsgdGhpcy5waWNrKFsnMCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JywgJzgnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgICAgICcwMicgKyB0aGlzLnBpY2soWycxJywgJzInLCAnMycsICc0JywgJzcnLCAnOCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgJzAzJyArIHRoaXMucGljayhbJzEnLCAnMicsICczJywgJzUnLCAnNicsICc5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICAgICAnMDQnICsgdGhpcy5waWNrKFsnMScsICcyJywgJzMnLCAnNCcsICc1JywnNicsJzcnLCAnOCcsJzknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksICAgXG4gICAgICAgICAgICAgICAgICAgICAgICcwNScgKyB0aGlzLnBpY2soWycxJywgJzMnLCAnNCcsICc2JywgJzcnLCAnOCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgfHwgbnVtUGljaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNjAnICsgdGhpcy5waWNrKFsnMycsJzQnLCc1JywnNicsJzcnLCc4JywnOSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNjEnICsgdGhpcy5waWNrKFsnMCcsJzEnLCcyJywnMycsJzQnLCc1JywnOCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNicgICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA3MScgKyB0aGlzLnBpY2soWycwJywnMScsJzInLCczJywnNCcsJzUnLCc2JywnNycsJzgnLCc5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogNn0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA3JyAgKyB0aGlzLnBpY2soWycyJywnMycsJzQnLCc2JywnNycsJzgnLCc5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICAgICAgJzA4JyAgKyB0aGlzLnBpY2soWycwJywnMScsJzInLCczJywnNCcsJzUnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkIHx8IG51bVBpY2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICd1cyc6XG4gICAgICAgICAgICAgICAgdmFyIGFyZWFjb2RlID0gdGhpcy5hcmVhY29kZShvcHRpb25zKS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHZhciBleGNoYW5nZSA9IHRoaXMubmF0dXJhbCh7IG1pbjogMiwgbWF4OiA5IH0pLnRvU3RyaW5nKCkgK1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoeyBtaW46IDAsIG1heDogOSB9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHsgbWluOiAwLCBtYXg6IDkgfSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgc3Vic2NyaWJlciA9IHRoaXMubmF0dXJhbCh7IG1pbjogMTAwMCwgbWF4OiA5OTk5IH0pLnRvU3RyaW5nKCk7IC8vIHRoaXMgY291bGQgYmUgcmFuZG9tIFswLTldezR9XG4gICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCA/IGFyZWFjb2RlICsgJyAnICsgZXhjaGFuZ2UgKyAnLScgKyBzdWJzY3JpYmVyIDogYXJlYWNvZGUgKyBleGNoYW5nZSArIHN1YnNjcmliZXI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBob25lO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBvc3RhbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gUG9zdGFsIERpc3RyaWN0XG4gICAgICAgIHZhciBwZCA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiBcIlhWVFNSUE5LTE1ISkdFQ0JBXCJ9KTtcbiAgICAgICAgLy8gRm9yd2FyZCBTb3J0YXRpb24gQXJlYSAoRlNBKVxuICAgICAgICB2YXIgZnNhID0gcGQgKyB0aGlzLm5hdHVyYWwoe21heDogOX0pICsgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pO1xuICAgICAgICAvLyBMb2NhbCBEZWxpdmVyeSBVbnV0IChMRFUpXG4gICAgICAgIHZhciBsZHUgPSB0aGlzLm5hdHVyYWwoe21heDogOX0pICsgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pICsgdGhpcy5uYXR1cmFsKHttYXg6IDl9KTtcblxuICAgICAgICByZXR1cm4gZnNhICsgXCIgXCIgKyBsZHU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnRpZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAndWsnIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJjb3VudGllc1wiKVtvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKV07XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnR5ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmNvdW50aWVzKG9wdGlvbnMpKS5uYW1lO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnByb3ZpbmNlcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICdjYScgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcInByb3ZpbmNlc1wiKVtvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKV07XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucHJvdmluY2UgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gKG9wdGlvbnMgJiYgb3B0aW9ucy5mdWxsKSA/XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5wcm92aW5jZXMob3B0aW9ucykpLm5hbWUgOlxuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMucHJvdmluY2VzKG9wdGlvbnMpKS5hYmJyZXZpYXRpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3RhdGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gKG9wdGlvbnMgJiYgb3B0aW9ucy5mdWxsKSA/XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5zdGF0ZXMob3B0aW9ucykpLm5hbWUgOlxuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMuc3RhdGVzKG9wdGlvbnMpKS5hYmJyZXZpYXRpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3RhdGVzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ3VzJywgdXNfc3RhdGVzX2FuZF9kYzogdHJ1ZSB9ICk7XG5cbiAgICAgICAgdmFyIHN0YXRlcztcblxuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBjYXNlICd1cyc6XG4gICAgICAgICAgICAgICAgdmFyIHVzX3N0YXRlc19hbmRfZGMgPSB0aGlzLmdldChcInVzX3N0YXRlc19hbmRfZGNcIiksXG4gICAgICAgICAgICAgICAgICAgIHRlcnJpdG9yaWVzID0gdGhpcy5nZXQoXCJ0ZXJyaXRvcmllc1wiKSxcbiAgICAgICAgICAgICAgICAgICAgYXJtZWRfZm9yY2VzID0gdGhpcy5nZXQoXCJhcm1lZF9mb3JjZXNcIik7XG5cbiAgICAgICAgICAgICAgICBzdGF0ZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzX3N0YXRlc19hbmRfZGMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGVzID0gc3RhdGVzLmNvbmNhdCh1c19zdGF0ZXNfYW5kX2RjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudGVycml0b3JpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGVzID0gc3RhdGVzLmNvbmNhdCh0ZXJyaXRvcmllcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmFybWVkX2ZvcmNlcykge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMgPSBzdGF0ZXMuY29uY2F0KGFybWVkX2ZvcmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnaXQnOlxuICAgICAgICAgICAgICAgIHN0YXRlcyA9IHRoaXMuZ2V0KFwiY291bnRyeV9yZWdpb25zXCIpW29wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3VrJzpcbiAgICAgICAgICAgICAgICBzdGF0ZXMgPSB0aGlzLmdldChcImNvdW50aWVzXCIpW29wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdGF0ZXM7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3RyZWV0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ3VzJywgc3lsbGFibGVzOiAyIH0pO1xuICAgICAgICB2YXIgICAgIHN0cmVldDtcblxuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBjYXNlICd1cyc6XG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gdGhpcy53b3JkKHsgc3lsbGFibGVzOiBvcHRpb25zLnN5bGxhYmxlcyB9KTtcbiAgICAgICAgICAgICAgICBzdHJlZXQgPSB0aGlzLmNhcGl0YWxpemUoc3RyZWV0KTtcbiAgICAgICAgICAgICAgICBzdHJlZXQgKz0gJyAnO1xuICAgICAgICAgICAgICAgIHN0cmVldCArPSBvcHRpb25zLnNob3J0X3N1ZmZpeCA/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyZWV0X3N1ZmZpeChvcHRpb25zKS5hYmJyZXZpYXRpb24gOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmVldF9zdWZmaXgob3B0aW9ucykubmFtZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2l0JzpcbiAgICAgICAgICAgICAgICBzdHJlZXQgPSB0aGlzLndvcmQoeyBzeWxsYWJsZXM6IG9wdGlvbnMuc3lsbGFibGVzIH0pO1xuICAgICAgICAgICAgICAgIHN0cmVldCA9IHRoaXMuY2FwaXRhbGl6ZShzdHJlZXQpO1xuICAgICAgICAgICAgICAgIHN0cmVldCA9IChvcHRpb25zLnNob3J0X3N1ZmZpeCA/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyZWV0X3N1ZmZpeChvcHRpb25zKS5hYmJyZXZpYXRpb24gOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmVldF9zdWZmaXgob3B0aW9ucykubmFtZSkgKyBcIiBcIiArIHN0cmVldDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RyZWV0O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmVldF9zdWZmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAndXMnIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuc3RyZWV0X3N1ZmZpeGVzKG9wdGlvbnMpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJlZXRfc3VmZml4ZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAndXMnIH0pO1xuICAgICAgICAvLyBUaGVzZSBhcmUgdGhlIG1vc3QgY29tbW9uIHN1ZmZpeGVzLlxuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJzdHJlZXRfc3VmZml4ZXNcIilbb3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCldO1xuICAgIH07XG5cbiAgICAvLyBOb3RlOiBvbmx5IHJldHVybmluZyBVUyB6aXAgY29kZXMsIGludGVybmF0aW9uYWxpemF0aW9uIHdpbGwgYmUgYSB3aG9sZVxuICAgIC8vIG90aGVyIGJlYXN0IHRvIHRhY2tsZSBhdCBzb21lIHBvaW50LlxuICAgIENoYW5jZS5wcm90b3R5cGUuemlwID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHppcCA9IHRoaXMubih0aGlzLm5hdHVyYWwsIDUsIHttYXg6IDl9KTtcblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnBsdXNmb3VyID09PSB0cnVlKSB7XG4gICAgICAgICAgICB6aXAucHVzaCgnLScpO1xuICAgICAgICAgICAgemlwID0gemlwLmNvbmNhdCh0aGlzLm4odGhpcy5uYXR1cmFsLCA0LCB7bWF4OiA5fSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHppcC5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgTG9jYXRpb24gLS1cblxuICAgIC8vIC0tIFRpbWVcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYW1wbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYm9vbCgpID8gJ2FtJyA6ICdwbSc7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZGF0ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBkYXRlX3N0cmluZywgZGF0ZTtcblxuICAgICAgICAvLyBJZiBpbnRlcnZhbCBpcyBzcGVjaWZpZWQgd2UgaWdub3JlIHByZXNldFxuICAgICAgICBpZihvcHRpb25zICYmIChvcHRpb25zLm1pbiB8fCBvcHRpb25zLm1heCkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgYW1lcmljYW46IHRydWUsXG4gICAgICAgICAgICAgICAgc3RyaW5nOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgbWluID0gdHlwZW9mIG9wdGlvbnMubWluICE9PSBcInVuZGVmaW5lZFwiID8gb3B0aW9ucy5taW4uZ2V0VGltZSgpIDogMTtcbiAgICAgICAgICAgIC8vIDEwMCwwMDAsMDAwIGRheXMgbWVhc3VyZWQgcmVsYXRpdmUgdG8gbWlkbmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiAwMSBKYW51YXJ5LCAxOTcwIFVUQy4gaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS45LjEuMVxuICAgICAgICAgICAgdmFyIG1heCA9IHR5cGVvZiBvcHRpb25zLm1heCAhPT0gXCJ1bmRlZmluZWRcIiA/IG9wdGlvbnMubWF4LmdldFRpbWUoKSA6IDg2NDAwMDAwMDAwMDAwMDA7XG5cbiAgICAgICAgICAgIGRhdGUgPSBuZXcgRGF0ZSh0aGlzLmludGVnZXIoe21pbjogbWluLCBtYXg6IG1heH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBtID0gdGhpcy5tb250aCh7cmF3OiB0cnVlfSk7XG4gICAgICAgICAgICB2YXIgZGF5c0luTW9udGggPSBtLmRheXM7XG5cbiAgICAgICAgICAgIGlmKG9wdGlvbnMgJiYgb3B0aW9ucy5tb250aCkge1xuICAgICAgICAgICAgICAgIC8vIE1vZCAxMiB0byBhbGxvdyBtb250aHMgb3V0c2lkZSByYW5nZSBvZiAwLTExIChub3QgZW5jb3VyYWdlZCwgYnV0IGFsc28gbm90IHByZXZlbnRlZCkuXG4gICAgICAgICAgICAgICAgZGF5c0luTW9udGggPSB0aGlzLmdldCgnbW9udGhzJylbKChvcHRpb25zLm1vbnRoICUgMTIpICsgMTIpICUgMTJdLmRheXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgeWVhcjogcGFyc2VJbnQodGhpcy55ZWFyKCksIDEwKSxcbiAgICAgICAgICAgICAgICAvLyBOZWNlc3NhcnkgdG8gc3VidHJhY3QgMSBiZWNhdXNlIERhdGUoKSAwLWluZGV4ZXMgbW9udGggYnV0IG5vdCBkYXkgb3IgeWVhclxuICAgICAgICAgICAgICAgIC8vIGZvciBzb21lIHJlYXNvbi5cbiAgICAgICAgICAgICAgICBtb250aDogbS5udW1lcmljIC0gMSxcbiAgICAgICAgICAgICAgICBkYXk6IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IGRheXNJbk1vbnRofSksXG4gICAgICAgICAgICAgICAgaG91cjogdGhpcy5ob3VyKHt0d2VudHlmb3VyOiB0cnVlfSksXG4gICAgICAgICAgICAgICAgbWludXRlOiB0aGlzLm1pbnV0ZSgpLFxuICAgICAgICAgICAgICAgIHNlY29uZDogdGhpcy5zZWNvbmQoKSxcbiAgICAgICAgICAgICAgICBtaWxsaXNlY29uZDogdGhpcy5taWxsaXNlY29uZCgpLFxuICAgICAgICAgICAgICAgIGFtZXJpY2FuOiB0cnVlLFxuICAgICAgICAgICAgICAgIHN0cmluZzogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkYXRlID0gbmV3IERhdGUob3B0aW9ucy55ZWFyLCBvcHRpb25zLm1vbnRoLCBvcHRpb25zLmRheSwgb3B0aW9ucy5ob3VyLCBvcHRpb25zLm1pbnV0ZSwgb3B0aW9ucy5zZWNvbmQsIG9wdGlvbnMubWlsbGlzZWNvbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYW1lcmljYW4pIHtcbiAgICAgICAgICAgIC8vIEFkZGluZyAxIHRvIHRoZSBtb250aCBpcyBuZWNlc3NhcnkgYmVjYXVzZSBEYXRlKCkgMC1pbmRleGVzXG4gICAgICAgICAgICAvLyBtb250aHMgYnV0IG5vdCBkYXkgZm9yIHNvbWUgb2RkIHJlYXNvbi5cbiAgICAgICAgICAgIGRhdGVfc3RyaW5nID0gKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy8nICsgZGF0ZS5nZXREYXRlKCkgKyAnLycgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRlX3N0cmluZyA9IGRhdGUuZ2V0RGF0ZSgpICsgJy8nICsgKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy8nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuc3RyaW5nID8gZGF0ZV9zdHJpbmcgOiBkYXRlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmhhbW1lcnRpbWUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRlKG9wdGlvbnMpLmdldFRpbWUoKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ob3VyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIG1pbjogb3B0aW9ucyAmJiBvcHRpb25zLnR3ZW50eWZvdXIgPyAwIDogMSxcbiAgICAgICAgICAgIG1heDogb3B0aW9ucyAmJiBvcHRpb25zLnR3ZW50eWZvdXIgPyAyMyA6IDEyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA8IDAsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGxlc3MgdGhhbiAwLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMudHdlbnR5Zm91ciAmJiBvcHRpb25zLm1heCA+IDIzLCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gMjMgZm9yIHR3ZW50eWZvdXIgb3B0aW9uLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKCFvcHRpb25zLnR3ZW50eWZvdXIgJiYgb3B0aW9ucy5tYXggPiAxMiwgXCJDaGFuY2U6IE1heCBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIDEyLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluID4gb3B0aW9ucy5tYXgsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBNYXguXCIpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXh9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5taWxsaXNlY29uZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWF4OiA5OTl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5taW51dGUgPSBDaGFuY2UucHJvdG90eXBlLnNlY29uZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiAwLCBtYXg6IDU5fSk7XG5cbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIDAuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5tYXggPiA1OSwgXCJDaGFuY2U6IE1heCBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIDU5LlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluID4gb3B0aW9ucy5tYXgsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBNYXguXCIpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXh9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tb250aCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiAxLCBtYXg6IDEyfSk7XG5cbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMSwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIDEuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5tYXggPiAxMiwgXCJDaGFuY2U6IE1heCBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIDEyLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluID4gb3B0aW9ucy5tYXgsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBNYXguXCIpO1xuXG4gICAgICAgIHZhciBtb250aCA9IHRoaXMucGljayh0aGlzLm1vbnRocygpLnNsaWNlKG9wdGlvbnMubWluIC0gMSwgb3B0aW9ucy5tYXgpKTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucmF3ID8gbW9udGggOiBtb250aC5uYW1lO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1vbnRocyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwibW9udGhzXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnNlY29uZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWF4OiA1OX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnRpbWVzdGFtcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IHBhcnNlSW50KG5ldyBEYXRlKCkuZ2V0VGltZSgpIC8gMTAwMCwgMTApfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUud2Vla2RheSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7d2Vla2RheV9vbmx5OiBmYWxzZX0pO1xuICAgICAgICB2YXIgd2Vla2RheXMgPSBbXCJNb25kYXlcIiwgXCJUdWVzZGF5XCIsIFwiV2VkbmVzZGF5XCIsIFwiVGh1cnNkYXlcIiwgXCJGcmlkYXlcIl07XG4gICAgICAgIGlmICghb3B0aW9ucy53ZWVrZGF5X29ubHkpIHtcbiAgICAgICAgICAgIHdlZWtkYXlzLnB1c2goXCJTYXR1cmRheVwiKTtcbiAgICAgICAgICAgIHdlZWtkYXlzLnB1c2goXCJTdW5kYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGlja29uZSh3ZWVrZGF5cyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUueWVhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIERlZmF1bHQgdG8gY3VycmVudCB5ZWFyIGFzIG1pbiBpZiBub25lIHNwZWNpZmllZFxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpfSk7XG5cbiAgICAgICAgLy8gRGVmYXVsdCB0byBvbmUgY2VudHVyeSBhZnRlciBjdXJyZW50IHllYXIgYXMgbWF4IGlmIG5vbmUgc3BlY2lmaWVkXG4gICAgICAgIG9wdGlvbnMubWF4ID0gKHR5cGVvZiBvcHRpb25zLm1heCAhPT0gXCJ1bmRlZmluZWRcIikgPyBvcHRpb25zLm1heCA6IG9wdGlvbnMubWluICsgMTAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwob3B0aW9ucykudG9TdHJpbmcoKTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFRpbWVcblxuICAgIC8vIC0tIEZpbmFuY2UgLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2MgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIHR5cGUsIG51bWJlciwgdG9fZ2VuZXJhdGU7XG5cbiAgICAgICAgdHlwZSA9IChvcHRpb25zLnR5cGUpID9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jY190eXBlKHsgbmFtZTogb3B0aW9ucy50eXBlLCByYXc6IHRydWUgfSkgOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNjX3R5cGUoeyByYXc6IHRydWUgfSk7XG5cbiAgICAgICAgbnVtYmVyID0gdHlwZS5wcmVmaXguc3BsaXQoXCJcIik7XG4gICAgICAgIHRvX2dlbmVyYXRlID0gdHlwZS5sZW5ndGggLSB0eXBlLnByZWZpeC5sZW5ndGggLSAxO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlcyBuIC0gMSBkaWdpdHNcbiAgICAgICAgbnVtYmVyID0gbnVtYmVyLmNvbmNhdCh0aGlzLm4odGhpcy5pbnRlZ2VyLCB0b19nZW5lcmF0ZSwge21pbjogMCwgbWF4OiA5fSkpO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlcyB0aGUgbGFzdCBkaWdpdCBhY2NvcmRpbmcgdG8gTHVobiBhbGdvcml0aG1cbiAgICAgICAgbnVtYmVyLnB1c2godGhpcy5sdWhuX2NhbGN1bGF0ZShudW1iZXIuam9pbihcIlwiKSkpO1xuXG4gICAgICAgIHJldHVybiBudW1iZXIuam9pbihcIlwiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jY190eXBlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYW5rX2NhcmRfbnVtYmVyI0lzc3Vlcl9pZGVudGlmaWNhdGlvbl9udW1iZXJfLjI4SUlOLjI5XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcImNjX3R5cGVzXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNjX3R5cGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciB0eXBlcyA9IHRoaXMuY2NfdHlwZXMoKSxcbiAgICAgICAgICAgIHR5cGUgPSBudWxsO1xuXG4gICAgICAgIGlmIChvcHRpb25zLm5hbWUpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBBY2NlcHQgZWl0aGVyIG5hbWUgb3Igc2hvcnRfbmFtZSB0byBzcGVjaWZ5IGNhcmQgdHlwZVxuICAgICAgICAgICAgICAgIGlmICh0eXBlc1tpXS5uYW1lID09PSBvcHRpb25zLm5hbWUgfHwgdHlwZXNbaV0uc2hvcnRfbmFtZSA9PT0gb3B0aW9ucy5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSB0eXBlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNyZWRpdCBjYXJkIHR5cGUgJ1wiICsgb3B0aW9ucy5uYW1lICsgXCInJyBpcyBub3Qgc3VwcG9ydGVkXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHlwZSA9IHRoaXMucGljayh0eXBlcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5yYXcgPyB0eXBlIDogdHlwZS5uYW1lO1xuICAgIH07XG5cbiAgICAvL3JldHVybiBhbGwgd29ybGQgY3VycmVuY3kgYnkgSVNPIDQyMTdcbiAgICBDaGFuY2UucHJvdG90eXBlLmN1cnJlbmN5X3R5cGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJjdXJyZW5jeV90eXBlc1wiKTtcbiAgICB9O1xuXG4gICAgLy9yZXR1cm4gcmFuZG9tIHdvcmxkIGN1cnJlbmN5IGJ5IElTTyA0MjE3XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jdXJyZW5jeSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLmN1cnJlbmN5X3R5cGVzKCkpO1xuICAgIH07XG5cbiAgICAvL3JldHVybiBhbGwgdGltZXpvbmVzIGF2YWlsYWJlbFxuICAgIENoYW5jZS5wcm90b3R5cGUudGltZXpvbmVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJ0aW1lem9uZXNcIik7XG4gICAgfTtcblxuICAgIC8vcmV0dXJuIHJhbmRvbSB0aW1lem9uZVxuICAgIENoYW5jZS5wcm90b3R5cGUudGltZXpvbmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy50aW1lem9uZXMoKSk7XG4gICAgfTtcblxuICAgIC8vUmV0dXJuIHJhbmRvbSBjb3JyZWN0IGN1cnJlbmN5IGV4Y2hhbmdlIHBhaXIgKGUuZy4gRVVSL1VTRCkgb3IgYXJyYXkgb2YgY3VycmVuY3kgY29kZVxuICAgIENoYW5jZS5wcm90b3R5cGUuY3VycmVuY3lfcGFpciA9IGZ1bmN0aW9uIChyZXR1cm5Bc1N0cmluZykge1xuICAgICAgICB2YXIgY3VycmVuY2llcyA9IHRoaXMudW5pcXVlKHRoaXMuY3VycmVuY3ksIDIsIHtcbiAgICAgICAgICAgIGNvbXBhcmF0b3I6IGZ1bmN0aW9uKGFyciwgdmFsKSB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihhY2MsIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBtYXRjaCBoYXMgYmVlbiBmb3VuZCwgc2hvcnQgY2lyY3VpdCBjaGVjayBhbmQganVzdCByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYyB8fCAoaXRlbS5jb2RlID09PSB2YWwuY29kZSk7XG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmV0dXJuQXNTdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW5jaWVzWzBdLmNvZGUgKyAnLycgKyBjdXJyZW5jaWVzWzFdLmNvZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVuY2llcztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRvbGxhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIEJ5IGRlZmF1bHQsIGEgc29tZXdoYXQgbW9yZSBzYW5lIG1heCBmb3IgZG9sbGFyIHRoYW4gYWxsIGF2YWlsYWJsZSBudW1iZXJzXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWF4IDogMTAwMDAsIG1pbiA6IDB9KTtcblxuICAgICAgICB2YXIgZG9sbGFyID0gdGhpcy5mbG9hdGluZyh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heCwgZml4ZWQ6IDJ9KS50b1N0cmluZygpLFxuICAgICAgICAgICAgY2VudHMgPSBkb2xsYXIuc3BsaXQoJy4nKVsxXTtcblxuICAgICAgICBpZiAoY2VudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZG9sbGFyICs9ICcuMDAnO1xuICAgICAgICB9IGVsc2UgaWYgKGNlbnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIGRvbGxhciA9IGRvbGxhciArICcwJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkb2xsYXIgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gJy0kJyArIGRvbGxhci5yZXBsYWNlKCctJywgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICckJyArIGRvbGxhcjtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmV1cm8gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gTnVtYmVyKHRoaXMuZG9sbGFyKG9wdGlvbnMpLnJlcGxhY2UoXCIkXCIsIFwiXCIpKS50b0xvY2FsZVN0cmluZygpICsgXCLigqxcIjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciBleHAgPSB7fTtcblxuICAgICAgICBleHAueWVhciA9IHRoaXMuZXhwX3llYXIoKTtcblxuICAgICAgICAvLyBJZiB0aGUgeWVhciBpcyB0aGlzIHllYXIsIG5lZWQgdG8gZW5zdXJlIG1vbnRoIGlzIGdyZWF0ZXIgdGhhbiB0aGVcbiAgICAgICAgLy8gY3VycmVudCBtb250aCBvciB0aGlzIGV4cGlyYXRpb24gd2lsbCBub3QgYmUgdmFsaWRcbiAgICAgICAgaWYgKGV4cC55ZWFyID09PSAobmV3IERhdGUoKS5nZXRGdWxsWWVhcigpKS50b1N0cmluZygpKSB7XG4gICAgICAgICAgICBleHAubW9udGggPSB0aGlzLmV4cF9tb250aCh7ZnV0dXJlOiB0cnVlfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHAubW9udGggPSB0aGlzLmV4cF9tb250aCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucmF3ID8gZXhwIDogZXhwLm1vbnRoICsgJy8nICsgZXhwLnllYXI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZXhwX21vbnRoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB2YXIgbW9udGgsIG1vbnRoX2ludCxcbiAgICAgICAgICAgIC8vIERhdGUgb2JqZWN0IG1vbnRocyBhcmUgMCBpbmRleGVkXG4gICAgICAgICAgICBjdXJNb250aCA9IG5ldyBEYXRlKCkuZ2V0TW9udGgoKSArIDE7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuZnV0dXJlICYmIChjdXJNb250aCAhPT0gMTIpKSB7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgbW9udGggPSB0aGlzLm1vbnRoKHtyYXc6IHRydWV9KS5udW1lcmljO1xuICAgICAgICAgICAgICAgIG1vbnRoX2ludCA9IHBhcnNlSW50KG1vbnRoLCAxMCk7XG4gICAgICAgICAgICB9IHdoaWxlIChtb250aF9pbnQgPD0gY3VyTW9udGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbW9udGggPSB0aGlzLm1vbnRoKHtyYXc6IHRydWV9KS5udW1lcmljO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmV4cF95ZWFyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY3VyTW9udGggPSBuZXcgRGF0ZSgpLmdldE1vbnRoKCkgKyAxLFxuICAgICAgICAgICAgY3VyWWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy55ZWFyKHttaW46ICgoY3VyTW9udGggPT09IDEyKSA/IChjdXJZZWFyICsgMSkgOiBjdXJZZWFyKSwgbWF4OiAoY3VyWWVhciArIDEwKX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnZhdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICdpdCcgfSk7XG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgJ2l0JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pdF92YXQoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhIHN0cmluZyBtYXRjaGluZyBJQkFOIHBhdHRlcm4gKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0ludGVybmF0aW9uYWxfQmFua19BY2NvdW50X051bWJlcikuIFxuICAgICAqIE5vIGNvdW50cnktc3BlY2lmaWMgZm9ybWF0cyBzdXBwb3J0ICh5ZXQpXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pYmFuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYWxwaGEgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVonO1xuICAgICAgICB2YXIgYWxwaGFudW0gPSBhbHBoYSArICcwMTIzNDU2Nzg5JztcbiAgICAgICAgdmFyIGliYW4gPSBcbiAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgbGVuZ3RoOiAyLCBwb29sOiBhbHBoYSB9KSArIFxuICAgICAgICAgICAgdGhpcy5wYWQodGhpcy5pbnRlZ2VyKHsgbWluOiAwLCBtYXg6IDk5IH0pLCAyKSArIFxuICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBsZW5ndGg6IDQsIHBvb2w6IGFscGhhbnVtIH0pICsgXG4gICAgICAgICAgICB0aGlzLnBhZCh0aGlzLm5hdHVyYWwoKSwgdGhpcy5uYXR1cmFsKHsgbWluOiA2LCBtYXg6IDI2IH0pKTtcbiAgICAgICAgcmV0dXJuIGliYW47XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBGaW5hbmNlXG5cbiAgICAvLyAtLSBSZWdpb25hbFxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pdF92YXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpdF92YXQgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiAxODAwMDAwfSk7XG5cbiAgICAgICAgaXRfdmF0ID0gdGhpcy5wYWQoaXRfdmF0LCA3KSArIHRoaXMucGFkKHRoaXMucGljayh0aGlzLnByb3ZpbmNlcyh7IGNvdW50cnk6ICdpdCcgfSkpLmNvZGUsIDMpO1xuICAgICAgICByZXR1cm4gaXRfdmF0ICsgdGhpcy5sdWhuX2NhbGN1bGF0ZShpdF92YXQpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICAqIHRoaXMgZ2VuZXJhdG9yIGlzIHdyaXR0ZW4gZm9sbG93aW5nIHRoZSBvZmZpY2lhbCBhbGdvcml0aG1cbiAgICAgKiBhbGwgZGF0YSBjYW4gYmUgcGFzc2VkIGV4cGxpY2l0ZWx5IG9yIHJhbmRvbWl6ZWQgYnkgY2FsbGluZyBjaGFuY2UuY2YoKSB3aXRob3V0IG9wdGlvbnNcbiAgICAgKiB0aGUgY29kZSBkb2VzIG5vdCBjaGVjayB0aGF0IHRoZSBpbnB1dCBkYXRhIGlzIHZhbGlkIChpdCBnb2VzIGJleW9uZCB0aGUgc2NvcGUgb2YgdGhlIGdlbmVyYXRvcilcbiAgICAgKlxuICAgICAqIEBwYXJhbSAgW09iamVjdF0gb3B0aW9ucyA9IHsgZmlyc3Q6IGZpcnN0IG5hbWUsXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0OiBsYXN0IG5hbWUsXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW5kZXI6IGZlbWFsZXxtYWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmlydGhkYXk6IEphdmFTY3JpcHQgZGF0ZSBvYmplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaXR5OiBzdHJpbmcoNCksIDEgbGV0dGVyICsgMyBudW1iZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgKiBAcmV0dXJuIFtzdHJpbmddIGNvZGljZSBmaXNjYWxlXG4gICAgICpcbiAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuY2YgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgdmFyIGdlbmRlciA9ICEhb3B0aW9ucy5nZW5kZXIgPyBvcHRpb25zLmdlbmRlciA6IHRoaXMuZ2VuZGVyKCksXG4gICAgICAgICAgICBmaXJzdCA9ICEhb3B0aW9ucy5maXJzdCA/IG9wdGlvbnMuZmlyc3QgOiB0aGlzLmZpcnN0KCB7IGdlbmRlcjogZ2VuZGVyLCBuYXRpb25hbGl0eTogJ2l0J30gKSxcbiAgICAgICAgICAgIGxhc3QgPSAhIW9wdGlvbnMubGFzdCA/IG9wdGlvbnMubGFzdCA6IHRoaXMubGFzdCggeyBuYXRpb25hbGl0eTogJ2l0J30gKSxcbiAgICAgICAgICAgIGJpcnRoZGF5ID0gISFvcHRpb25zLmJpcnRoZGF5ID8gb3B0aW9ucy5iaXJ0aGRheSA6IHRoaXMuYmlydGhkYXkoKSxcbiAgICAgICAgICAgIGNpdHkgPSAhIW9wdGlvbnMuY2l0eSA/IG9wdGlvbnMuY2l0eSA6IHRoaXMucGlja29uZShbJ0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsICdJJywgJ0wnLCAnTScsICdaJ10pICsgdGhpcy5wYWQodGhpcy5uYXR1cmFsKHttYXg6OTk5fSksIDMpLFxuICAgICAgICAgICAgY2YgPSBbXSxcbiAgICAgICAgICAgIG5hbWVfZ2VuZXJhdG9yID0gZnVuY3Rpb24obmFtZSwgaXNMYXN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRlbXAsXG4gICAgICAgICAgICAgICAgICAgIHJldHVybl92YWx1ZSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgaWYgKG5hbWUubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5fdmFsdWUgPSBuYW1lLnNwbGl0KFwiXCIpLmNvbmNhdChcIlhYWFwiLnNwbGl0KFwiXCIpKS5zcGxpY2UoMCwzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRlbXAgPSBuYW1lLnRvVXBwZXJDYXNlKCkuc3BsaXQoJycpLm1hcChmdW5jdGlvbihjKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXCJCQ0RGR0hKS0xNTlBSU1RWV1pcIi5pbmRleE9mKGMpICE9PSAtMSkgPyBjIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRlbXAubGVuZ3RoID4gMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGFzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnN1YnN0cigwLDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gdGVtcFswXSArIHRlbXAuc3Vic3RyKDIsMik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRlbXAubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuX3ZhbHVlID0gdGVtcDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXAgPSBuYW1lLnRvVXBwZXJDYXNlKCkuc3BsaXQoJycpLm1hcChmdW5jdGlvbihjKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFwiQUVJT1VcIi5pbmRleE9mKGMpICE9PSAtMSkgPyBjIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuam9pbignJykuc3Vic3RyKDAsIDMgLSByZXR1cm5fdmFsdWUubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5fdmFsdWUgPSByZXR1cm5fdmFsdWUgKyB0ZW1wO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXR1cm5fdmFsdWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZGF0ZV9nZW5lcmF0b3IgPSBmdW5jdGlvbihiaXJ0aGRheSwgZ2VuZGVyLCB0aGF0KSB7XG4gICAgICAgICAgICAgICAgdmFyIGxldHRlcm1vbnRocyA9IFsnQScsICdCJywgJ0MnLCAnRCcsICdFJywgJ0gnLCAnTCcsICdNJywgJ1AnLCAnUicsICdTJywgJ1QnXTtcblxuICAgICAgICAgICAgICAgIHJldHVybiAgYmlydGhkYXkuZ2V0RnVsbFllYXIoKS50b1N0cmluZygpLnN1YnN0cigyKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXR0ZXJtb250aHNbYmlydGhkYXkuZ2V0TW9udGgoKV0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoYmlydGhkYXkuZ2V0RGF0ZSgpICsgKChnZW5kZXIudG9Mb3dlckNhc2UoKSA9PT0gXCJmZW1hbGVcIikgPyA0MCA6IDApLCAyKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjaGVja2RpZ2l0X2dlbmVyYXRvciA9IGZ1bmN0aW9uKGNmKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJhbmdlMSA9IFwiMDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaXCIsXG4gICAgICAgICAgICAgICAgICAgIHJhbmdlMiA9IFwiQUJDREVGR0hJSkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaXCIsXG4gICAgICAgICAgICAgICAgICAgIGV2ZW5zICA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpcIixcbiAgICAgICAgICAgICAgICAgICAgb2RkcyAgID0gXCJCQUtQTENRRFJFVk9TRlRHVUhNSU5KV1pZWFwiLFxuICAgICAgICAgICAgICAgICAgICBkaWdpdCAgPSAwO1xuXG5cbiAgICAgICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgMTU7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSAlIDIgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpZ2l0ICs9IGV2ZW5zLmluZGV4T2YocmFuZ2UyW3JhbmdlMS5pbmRleE9mKGNmW2ldKV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlnaXQgKz0gIG9kZHMuaW5kZXhPZihyYW5nZTJbcmFuZ2UxLmluZGV4T2YoY2ZbaV0pXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV2ZW5zW2RpZ2l0ICUgMjZdO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICBjZiA9IGNmLmNvbmNhdChuYW1lX2dlbmVyYXRvcihsYXN0LCB0cnVlKSwgbmFtZV9nZW5lcmF0b3IoZmlyc3QpLCBkYXRlX2dlbmVyYXRvcihiaXJ0aGRheSwgZ2VuZGVyLCB0aGlzKSwgY2l0eS50b1VwcGVyQ2FzZSgpLnNwbGl0KFwiXCIpKS5qb2luKFwiXCIpO1xuICAgICAgICBjZiArPSBjaGVja2RpZ2l0X2dlbmVyYXRvcihjZi50b1VwcGVyQ2FzZSgpLCB0aGlzKTtcblxuICAgICAgICByZXR1cm4gY2YudG9VcHBlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wbF9wZXNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG51bWJlciA9IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDk5OTk5OTk5OTl9KTtcbiAgICAgICAgdmFyIGFyciA9IHRoaXMucGFkKG51bWJlciwgMTApLnNwbGl0KCcnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFycltpXSA9IHBhcnNlSW50KGFycltpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY29udHJvbE51bWJlciA9ICgxICogYXJyWzBdICsgMyAqIGFyclsxXSArIDcgKiBhcnJbMl0gKyA5ICogYXJyWzNdICsgMSAqIGFycls0XSArIDMgKiBhcnJbNV0gKyA3ICogYXJyWzZdICsgOSAqIGFycls3XSArIDEgKiBhcnJbOF0gKyAzICogYXJyWzldKSAlIDEwO1xuICAgICAgICBpZihjb250cm9sTnVtYmVyICE9PSAwKSB7XG4gICAgICAgICAgICBjb250cm9sTnVtYmVyID0gMTAgLSBjb250cm9sTnVtYmVyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFyci5qb2luKCcnKSArIGNvbnRyb2xOdW1iZXI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGxfbmlwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbnVtYmVyID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTk5OTk5OTk5fSk7XG4gICAgICAgIHZhciBhcnIgPSB0aGlzLnBhZChudW1iZXIsIDkpLnNwbGl0KCcnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFycltpXSA9IHBhcnNlSW50KGFycltpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY29udHJvbE51bWJlciA9ICg2ICogYXJyWzBdICsgNSAqIGFyclsxXSArIDcgKiBhcnJbMl0gKyAyICogYXJyWzNdICsgMyAqIGFycls0XSArIDQgKiBhcnJbNV0gKyA1ICogYXJyWzZdICsgNiAqIGFycls3XSArIDcgKiBhcnJbOF0pICUgMTE7XG4gICAgICAgIGlmKGNvbnRyb2xOdW1iZXIgPT09IDEwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wbF9uaXAoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnIuam9pbignJykgKyBjb250cm9sTnVtYmVyO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBsX3JlZ29uID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbnVtYmVyID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTk5OTk5OTl9KTtcbiAgICAgICAgdmFyIGFyciA9IHRoaXMucGFkKG51bWJlciwgOCkuc3BsaXQoJycpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJyW2ldID0gcGFyc2VJbnQoYXJyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250cm9sTnVtYmVyID0gKDggKiBhcnJbMF0gKyA5ICogYXJyWzFdICsgMiAqIGFyclsyXSArIDMgKiBhcnJbM10gKyA0ICogYXJyWzRdICsgNSAqIGFycls1XSArIDYgKiBhcnJbNl0gKyA3ICogYXJyWzddKSAlIDExO1xuICAgICAgICBpZihjb250cm9sTnVtYmVyID09PSAxMCkge1xuICAgICAgICAgICAgY29udHJvbE51bWJlciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyLmpvaW4oJycpICsgY29udHJvbE51bWJlcjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFJlZ2lvbmFsXG5cbiAgICAvLyAtLSBNaXNjZWxsYW5lb3VzIC0tXG5cbiAgICAvLyBEaWNlIC0gRm9yIGFsbCB0aGUgYm9hcmQgZ2FtZSBnZWVrcyBvdXQgdGhlcmUsIG15c2VsZiBpbmNsdWRlZCA7KVxuICAgIGZ1bmN0aW9uIGRpY2VGbiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwocmFuZ2UpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBDaGFuY2UucHJvdG90eXBlLmQ0ID0gZGljZUZuKHttaW46IDEsIG1heDogNH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDYgPSBkaWNlRm4oe21pbjogMSwgbWF4OiA2fSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kOCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDh9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQxMCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDEwfSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMTIgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAxMn0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDIwID0gZGljZUZuKHttaW46IDEsIG1heDogMjB9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQzMCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDMwfSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMTAwID0gZGljZUZuKHttaW46IDEsIG1heDogMTAwfSk7XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnJwZyA9IGZ1bmN0aW9uICh0aHJvd24sIG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICBpZiAoIXRocm93bikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJBIHR5cGUgb2YgZGllIHJvbGwgbXVzdCBiZSBpbmNsdWRlZFwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBiaXRzID0gdGhyb3duLnRvTG93ZXJDYXNlKCkuc3BsaXQoXCJkXCIpLFxuICAgICAgICAgICAgICAgIHJvbGxzID0gW107XG5cbiAgICAgICAgICAgIGlmIChiaXRzLmxlbmd0aCAhPT0gMiB8fCAhcGFyc2VJbnQoYml0c1swXSwgMTApIHx8ICFwYXJzZUludChiaXRzWzFdLCAxMCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGZvcm1hdCBwcm92aWRlZC4gUGxlYXNlIHByb3ZpZGUgI2QjIHdoZXJlIHRoZSBmaXJzdCAjIGlzIHRoZSBudW1iZXIgb2YgZGljZSB0byByb2xsLCB0aGUgc2Vjb25kICMgaXMgdGhlIG1heCBvZiBlYWNoIGRpZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBiaXRzWzBdOyBpID4gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgcm9sbHNbaSAtIDFdID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogYml0c1sxXX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICh0eXBlb2Ygb3B0aW9ucy5zdW0gIT09ICd1bmRlZmluZWQnICYmIG9wdGlvbnMuc3VtKSA/IHJvbGxzLnJlZHVjZShmdW5jdGlvbiAocCwgYykgeyByZXR1cm4gcCArIGM7IH0pIDogcm9sbHM7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gR3VpZFxuICAgIENoYW5jZS5wcm90b3R5cGUuZ3VpZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IHZlcnNpb246IDUgfSk7XG5cbiAgICAgICAgdmFyIGd1aWRfcG9vbCA9IFwiYWJjZGVmMTIzNDU2Nzg5MFwiLFxuICAgICAgICAgICAgdmFyaWFudF9wb29sID0gXCJhYjg5XCIsXG4gICAgICAgICAgICBndWlkID0gdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogOCB9KSArICctJyArXG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogNCB9KSArICctJyArXG4gICAgICAgICAgICAgICAgICAgLy8gVGhlIFZlcnNpb25cbiAgICAgICAgICAgICAgICAgICBvcHRpb25zLnZlcnNpb24gK1xuICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgcG9vbDogZ3VpZF9wb29sLCBsZW5ndGg6IDMgfSkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgIC8vIFRoZSBWYXJpYW50XG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiB2YXJpYW50X3Bvb2wsIGxlbmd0aDogMSB9KSArXG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogMyB9KSArICctJyArXG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogMTIgfSk7XG4gICAgICAgIHJldHVybiBndWlkO1xuICAgIH07XG5cbiAgICAvLyBIYXNoXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5oYXNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtsZW5ndGggOiA0MCwgY2FzaW5nOiAnbG93ZXInfSk7XG4gICAgICAgIHZhciBwb29sID0gb3B0aW9ucy5jYXNpbmcgPT09ICd1cHBlcicgPyBIRVhfUE9PTC50b1VwcGVyQ2FzZSgpIDogSEVYX1BPT0w7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmluZyh7cG9vbDogcG9vbCwgbGVuZ3RoOiBvcHRpb25zLmxlbmd0aH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmx1aG5fY2hlY2sgPSBmdW5jdGlvbiAobnVtKSB7XG4gICAgICAgIHZhciBzdHIgPSBudW0udG9TdHJpbmcoKTtcbiAgICAgICAgdmFyIGNoZWNrRGlnaXQgPSArc3RyLnN1YnN0cmluZyhzdHIubGVuZ3RoIC0gMSk7XG4gICAgICAgIHJldHVybiBjaGVja0RpZ2l0ID09PSB0aGlzLmx1aG5fY2FsY3VsYXRlKCtzdHIuc3Vic3RyaW5nKDAsIHN0ci5sZW5ndGggLSAxKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubHVobl9jYWxjdWxhdGUgPSBmdW5jdGlvbiAobnVtKSB7XG4gICAgICAgIHZhciBkaWdpdHMgPSBudW0udG9TdHJpbmcoKS5zcGxpdChcIlwiKS5yZXZlcnNlKCk7XG4gICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICB2YXIgZGlnaXQ7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkaWdpdHMubGVuZ3RoOyBsID4gaTsgKytpKSB7XG4gICAgICAgICAgICBkaWdpdCA9ICtkaWdpdHNbaV07XG4gICAgICAgICAgICBpZiAoaSAlIDIgPT09IDApIHtcbiAgICAgICAgICAgICAgICBkaWdpdCAqPSAyO1xuICAgICAgICAgICAgICAgIGlmIChkaWdpdCA+IDkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlnaXQgLT0gOTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdW0gKz0gZGlnaXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChzdW0gKiA5KSAlIDEwO1xuICAgIH07XG5cbiAgICAvLyBNRDUgSGFzaFxuICAgIENoYW5jZS5wcm90b3R5cGUubWQ1ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgb3B0cyA9IHsgc3RyOiAnJywga2V5OiBudWxsLCByYXc6IGZhbHNlIH07XG5cbiAgICAgICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRzLnN0ciA9IHRoaXMuc3RyaW5nKCk7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBvcHRzLnN0ciA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMuY29uc3RydWN0b3IgPT09ICdBcnJheScpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgb3B0cyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIG9wdHMpO1xuXG4gICAgICAgIGlmKCFvcHRzLnN0cil7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgcGFyYW1ldGVyIGlzIHJlcXVpcmVkIHRvIHJldHVybiBhbiBtZDUgaGFzaC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmJpbWQ1Lm1kNShvcHRzLnN0ciwgb3B0cy5rZXksIG9wdHMucmF3KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogI0Rlc2NyaXB0aW9uOlxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogR2VuZXJhdGUgcmFuZG9tIGZpbGUgbmFtZSB3aXRoIGV4dGVuc2lvblxuICAgICAqXG4gICAgICogVGhlIGFyZ3VtZW50IHByb3ZpZGUgZXh0ZW5zaW9uIHR5cGVcbiAgICAgKiAtPiByYXN0ZXJcbiAgICAgKiAtPiB2ZWN0b3JcbiAgICAgKiAtPiAzZFxuICAgICAqIC0+IGRvY3VtZW50XG4gICAgICpcbiAgICAgKiBJZiBub3RoaW5nIGlzIHByb3ZpZGVkIHRoZSBmdW5jdGlvbiByZXR1cm4gcmFuZG9tIGZpbGUgbmFtZSB3aXRoIHJhbmRvbVxuICAgICAqIGV4dGVuc2lvbiB0eXBlIG9mIGFueSBraW5kXG4gICAgICpcbiAgICAgKiBUaGUgdXNlciBjYW4gdmFsaWRhdGUgdGhlIGZpbGUgbmFtZSBsZW5ndGggcmFuZ2VcbiAgICAgKiBJZiBub3RoaW5nIHByb3ZpZGVkIHRoZSBnZW5lcmF0ZWQgZmlsZSBuYW1lIGlzIHJhbmRvbVxuICAgICAqXG4gICAgICogI0V4dGVuc2lvbiBQb29sIDpcbiAgICAgKiAqIEN1cnJlbnRseSB0aGUgc3VwcG9ydGVkIGV4dGVuc2lvbnMgYXJlXG4gICAgICogIC0+IHNvbWUgb2YgdGhlIG1vc3QgcG9wdWxhciByYXN0ZXIgaW1hZ2UgZXh0ZW5zaW9uc1xuICAgICAqICAtPiBzb21lIG9mIHRoZSBtb3N0IHBvcHVsYXIgdmVjdG9yIGltYWdlIGV4dGVuc2lvbnNcbiAgICAgKiAgLT4gc29tZSBvZiB0aGUgbW9zdCBwb3B1bGFyIDNkIGltYWdlIGV4dGVuc2lvbnNcbiAgICAgKiAgLT4gc29tZSBvZiB0aGUgbW9zdCBwb3B1bGFyIGRvY3VtZW50IGV4dGVuc2lvbnNcbiAgICAgKlxuICAgICAqICNFeGFtcGxlcyA6XG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKlxuICAgICAqIFJldHVybiByYW5kb20gZmlsZSBuYW1lIHdpdGggcmFuZG9tIGV4dGVuc2lvbi4gVGhlIGZpbGUgZXh0ZW5zaW9uXG4gICAgICogaXMgcHJvdmlkZWQgYnkgYSBwcmVkZWZpbmVkIGNvbGxlY3Rpb24gb2YgZXh0ZW5zaW9ucy4gTW9yZSBhYm91dCB0aGUgZXh0ZW5zaW9uXG4gICAgICogcG9vbCBjYW4gYmUgZm91bmQgaW4gI0V4dGVuc2lvbiBQb29sIHNlY3Rpb25cbiAgICAgKlxuICAgICAqIGNoYW5jZS5maWxlKClcbiAgICAgKiA9PiBkc2ZzZGhqZi54bWxcbiAgICAgKlxuICAgICAqIEluIG9yZGVyIHRvIGdlbmVyYXRlIGEgZmlsZSBuYW1lIHdpdGggc3BlY2lmaWMgbGVuZ3RoLCBzcGVjaWZ5IHRoZVxuICAgICAqIGxlbmd0aCBwcm9wZXJ0eSBhbmQgaW50ZWdlciB2YWx1ZS4gVGhlIGV4dGVuc2lvbiBpcyBnb2luZyB0byBiZSByYW5kb21cbiAgICAgKlxuICAgICAqIGNoYW5jZS5maWxlKHtsZW5ndGggOiAxMH0pXG4gICAgICogPT4gYXNydGluZXFvcy5wZGZcbiAgICAgKlxuICAgICAqIEluIG9yZGVyIHRvIGdlbmVyYXRlIGZpbGUgd2l0aCBleHRlbnNpb24gZnJvbSBzb21lIG9mIHRoZSBwcmVkZWZpbmVkIGdyb3Vwc1xuICAgICAqIG9mIHRoZSBleHRlbnNpb24gcG9vbCBqdXN0IHNwZWNpZnkgdGhlIGV4dGVuc2lvbiBwb29sIGNhdGVnb3J5IGluIGZpbGVUeXBlIHByb3BlcnR5XG4gICAgICpcbiAgICAgKiBjaGFuY2UuZmlsZSh7ZmlsZVR5cGUgOiAncmFzdGVyJ30pXG4gICAgICogPT4gZHNoZ3NzZHMucHNkXG4gICAgICpcbiAgICAgKiBZb3UgY2FuIHByb3ZpZGUgc3BlY2lmaWMgZXh0ZW5zaW9uIGZvciB5b3VyIGZpbGVzXG4gICAgICogY2hhbmNlLmZpbGUoe2V4dGVuc2lvbiA6ICdodG1sJ30pXG4gICAgICogPT4gZGpmc2QuaHRtbFxuICAgICAqXG4gICAgICogT3IgeW91IGNvdWxkIHBhc3MgY3VzdG9tIGNvbGxlY3Rpb24gb2YgZXh0ZW5zaW9ucyBieSBhcnJheSBvciBieSBvYmplY3RcbiAgICAgKiBjaGFuY2UuZmlsZSh7ZXh0ZW5zaW9ucyA6IFsuLi5dfSlcbiAgICAgKiA9PiBkaGdzZHNkLnBzZFxuICAgICAqXG4gICAgICogY2hhbmNlLmZpbGUoe2V4dGVuc2lvbnMgOiB7IGtleSA6IFsuLi5dLCBrZXkgOiBbLi4uXX19KVxuICAgICAqID0+IGRqc2Zrc2Rqc2QueG1sXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIFtjb2xsZWN0aW9uXSBvcHRpb25zXG4gICAgICogQHJldHVybiBbc3RyaW5nXVxuICAgICAqXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5maWxlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuXG4gICAgICAgIHZhciBmaWxlT3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIHZhciBwb29sQ29sbGVjdGlvbktleSA9IFwiZmlsZUV4dGVuc2lvblwiO1xuICAgICAgICB2YXIgdHlwZVJhbmdlICAgPSBPYmplY3Qua2V5cyh0aGlzLmdldChcImZpbGVFeHRlbnNpb25cIikpOy8vWydyYXN0ZXInLCAndmVjdG9yJywgJzNkJywgJ2RvY3VtZW50J107XG4gICAgICAgIHZhciBmaWxlTmFtZTtcbiAgICAgICAgdmFyIGZpbGVFeHRlbnNpb247XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgcmFuZG9tIGZpbGUgbmFtZVxuICAgICAgICBmaWxlTmFtZSA9IHRoaXMud29yZCh7bGVuZ3RoIDogZmlsZU9wdGlvbnMubGVuZ3RofSk7XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgZmlsZSBieSBzcGVjaWZpYyBleHRlbnNpb24gcHJvdmlkZWQgYnkgdGhlIHVzZXJcbiAgICAgICAgaWYoZmlsZU9wdGlvbnMuZXh0ZW5zaW9uKSB7XG5cbiAgICAgICAgICAgIGZpbGVFeHRlbnNpb24gPSBmaWxlT3B0aW9ucy5leHRlbnNpb247XG4gICAgICAgICAgICByZXR1cm4gKGZpbGVOYW1lICsgJy4nICsgZmlsZUV4dGVuc2lvbik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBmaWxlIGJ5IHNwZWNpZmljIGV4dGVuc2lvbiBjb2xsZWN0aW9uXG4gICAgICAgIGlmKGZpbGVPcHRpb25zLmV4dGVuc2lvbnMpIHtcblxuICAgICAgICAgICAgaWYoQXJyYXkuaXNBcnJheShmaWxlT3B0aW9ucy5leHRlbnNpb25zKSkge1xuXG4gICAgICAgICAgICAgICAgZmlsZUV4dGVuc2lvbiA9IHRoaXMucGlja29uZShmaWxlT3B0aW9ucy5leHRlbnNpb25zKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGZpbGVOYW1lICsgJy4nICsgZmlsZUV4dGVuc2lvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKGZpbGVPcHRpb25zLmV4dGVuc2lvbnMuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dGVuc2lvbk9iamVjdENvbGxlY3Rpb24gPSBmaWxlT3B0aW9ucy5leHRlbnNpb25zO1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZXh0ZW5zaW9uT2JqZWN0Q29sbGVjdGlvbik7XG5cbiAgICAgICAgICAgICAgICBmaWxlRXh0ZW5zaW9uID0gdGhpcy5waWNrb25lKGV4dGVuc2lvbk9iamVjdENvbGxlY3Rpb25bdGhpcy5waWNrb25lKGtleXMpXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChmaWxlTmFtZSArICcuJyArIGZpbGVFeHRlbnNpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3QgY29sbGVjdGlvbiBvZiB0eXBlIEFycmF5IG9yIE9iamVjdCB0byBiZSBwYXNzZWQgYXMgYW4gYXJndW1lbnQgXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgZmlsZSBleHRlbnNpb24gYmFzZWQgb24gc3BlY2lmaWMgZmlsZSB0eXBlXG4gICAgICAgIGlmKGZpbGVPcHRpb25zLmZpbGVUeXBlKSB7XG5cbiAgICAgICAgICAgIHZhciBmaWxlVHlwZSA9IGZpbGVPcHRpb25zLmZpbGVUeXBlO1xuICAgICAgICAgICAgaWYodHlwZVJhbmdlLmluZGV4T2YoZmlsZVR5cGUpICE9PSAtMSkge1xuXG4gICAgICAgICAgICAgICAgZmlsZUV4dGVuc2lvbiA9IHRoaXMucGlja29uZSh0aGlzLmdldChwb29sQ29sbGVjdGlvbktleSlbZmlsZVR5cGVdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGZpbGVOYW1lICsgJy4nICsgZmlsZUV4dGVuc2lvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdCBmaWxlIHR5cGUgdmFsdWUgdG8gYmUgJ3Jhc3RlcicsICd2ZWN0b3InLCAnM2QnIG9yICdkb2N1bWVudCcgXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgcmFuZG9tIGZpbGUgbmFtZSBpZiBubyBleHRlbnNpb24gb3B0aW9ucyBhcmUgcGFzc2VkXG4gICAgICAgIGZpbGVFeHRlbnNpb24gPSB0aGlzLnBpY2tvbmUodGhpcy5nZXQocG9vbENvbGxlY3Rpb25LZXkpW3RoaXMucGlja29uZSh0eXBlUmFuZ2UpXSk7XG4gICAgICAgIHJldHVybiAoZmlsZU5hbWUgKyAnLicgKyBmaWxlRXh0ZW5zaW9uKTtcbiAgICB9O1xuXG4gICAgdmFyIGRhdGEgPSB7XG5cbiAgICAgICAgZmlyc3ROYW1lczoge1xuICAgICAgICAgICAgXCJtYWxlXCI6IHtcbiAgICAgICAgICAgICAgICBcImVuXCI6IFtcIkphbWVzXCIsIFwiSm9oblwiLCBcIlJvYmVydFwiLCBcIk1pY2hhZWxcIiwgXCJXaWxsaWFtXCIsIFwiRGF2aWRcIiwgXCJSaWNoYXJkXCIsIFwiSm9zZXBoXCIsIFwiQ2hhcmxlc1wiLCBcIlRob21hc1wiLCBcIkNocmlzdG9waGVyXCIsIFwiRGFuaWVsXCIsIFwiTWF0dGhld1wiLCBcIkdlb3JnZVwiLCBcIkRvbmFsZFwiLCBcIkFudGhvbnlcIiwgXCJQYXVsXCIsIFwiTWFya1wiLCBcIkVkd2FyZFwiLCBcIlN0ZXZlblwiLCBcIktlbm5ldGhcIiwgXCJBbmRyZXdcIiwgXCJCcmlhblwiLCBcIkpvc2h1YVwiLCBcIktldmluXCIsIFwiUm9uYWxkXCIsIFwiVGltb3RoeVwiLCBcIkphc29uXCIsIFwiSmVmZnJleVwiLCBcIkZyYW5rXCIsIFwiR2FyeVwiLCBcIlJ5YW5cIiwgXCJOaWNob2xhc1wiLCBcIkVyaWNcIiwgXCJTdGVwaGVuXCIsIFwiSmFjb2JcIiwgXCJMYXJyeVwiLCBcIkpvbmF0aGFuXCIsIFwiU2NvdHRcIiwgXCJSYXltb25kXCIsIFwiSnVzdGluXCIsIFwiQnJhbmRvblwiLCBcIkdyZWdvcnlcIiwgXCJTYW11ZWxcIiwgXCJCZW5qYW1pblwiLCBcIlBhdHJpY2tcIiwgXCJKYWNrXCIsIFwiSGVucnlcIiwgXCJXYWx0ZXJcIiwgXCJEZW5uaXNcIiwgXCJKZXJyeVwiLCBcIkFsZXhhbmRlclwiLCBcIlBldGVyXCIsIFwiVHlsZXJcIiwgXCJEb3VnbGFzXCIsIFwiSGFyb2xkXCIsIFwiQWFyb25cIiwgXCJKb3NlXCIsIFwiQWRhbVwiLCBcIkFydGh1clwiLCBcIlphY2hhcnlcIiwgXCJDYXJsXCIsIFwiTmF0aGFuXCIsIFwiQWxiZXJ0XCIsIFwiS3lsZVwiLCBcIkxhd3JlbmNlXCIsIFwiSm9lXCIsIFwiV2lsbGllXCIsIFwiR2VyYWxkXCIsIFwiUm9nZXJcIiwgXCJLZWl0aFwiLCBcIkplcmVteVwiLCBcIlRlcnJ5XCIsIFwiSGFycnlcIiwgXCJSYWxwaFwiLCBcIlNlYW5cIiwgXCJKZXNzZVwiLCBcIlJveVwiLCBcIkxvdWlzXCIsIFwiQmlsbHlcIiwgXCJBdXN0aW5cIiwgXCJCcnVjZVwiLCBcIkV1Z2VuZVwiLCBcIkNocmlzdGlhblwiLCBcIkJyeWFuXCIsIFwiV2F5bmVcIiwgXCJSdXNzZWxsXCIsIFwiSG93YXJkXCIsIFwiRnJlZFwiLCBcIkV0aGFuXCIsIFwiSm9yZGFuXCIsIFwiUGhpbGlwXCIsIFwiQWxhblwiLCBcIkp1YW5cIiwgXCJSYW5keVwiLCBcIlZpbmNlbnRcIiwgXCJCb2JieVwiLCBcIkR5bGFuXCIsIFwiSm9obm55XCIsIFwiUGhpbGxpcFwiLCBcIlZpY3RvclwiLCBcIkNsYXJlbmNlXCIsIFwiRXJuZXN0XCIsIFwiTWFydGluXCIsIFwiQ3JhaWdcIiwgXCJTdGFubGV5XCIsIFwiU2hhd25cIiwgXCJUcmF2aXNcIiwgXCJCcmFkbGV5XCIsIFwiTGVvbmFyZFwiLCBcIkVhcmxcIiwgXCJHYWJyaWVsXCIsIFwiSmltbXlcIiwgXCJGcmFuY2lzXCIsIFwiVG9kZFwiLCBcIk5vYWhcIiwgXCJEYW5ueVwiLCBcIkRhbGVcIiwgXCJDb2R5XCIsIFwiQ2FybG9zXCIsIFwiQWxsZW5cIiwgXCJGcmVkZXJpY2tcIiwgXCJMb2dhblwiLCBcIkN1cnRpc1wiLCBcIkFsZXhcIiwgXCJKb2VsXCIsIFwiTHVpc1wiLCBcIk5vcm1hblwiLCBcIk1hcnZpblwiLCBcIkdsZW5uXCIsIFwiVG9ueVwiLCBcIk5hdGhhbmllbFwiLCBcIlJvZG5leVwiLCBcIk1lbHZpblwiLCBcIkFsZnJlZFwiLCBcIlN0ZXZlXCIsIFwiQ2FtZXJvblwiLCBcIkNoYWRcIiwgXCJFZHdpblwiLCBcIkNhbGViXCIsIFwiRXZhblwiLCBcIkFudG9uaW9cIiwgXCJMZWVcIiwgXCJIZXJiZXJ0XCIsIFwiSmVmZmVyeVwiLCBcIklzYWFjXCIsIFwiRGVyZWtcIiwgXCJSaWNreVwiLCBcIk1hcmN1c1wiLCBcIlRoZW9kb3JlXCIsIFwiRWxpamFoXCIsIFwiTHVrZVwiLCBcIkplc3VzXCIsIFwiRWRkaWVcIiwgXCJUcm95XCIsIFwiTWlrZVwiLCBcIkR1c3RpblwiLCBcIlJheVwiLCBcIkFkcmlhblwiLCBcIkJlcm5hcmRcIiwgXCJMZXJveVwiLCBcIkFuZ2VsXCIsIFwiUmFuZGFsbFwiLCBcIldlc2xleVwiLCBcIklhblwiLCBcIkphcmVkXCIsIFwiTWFzb25cIiwgXCJIdW50ZXJcIiwgXCJDYWx2aW5cIiwgXCJPc2NhclwiLCBcIkNsaWZmb3JkXCIsIFwiSmF5XCIsIFwiU2hhbmVcIiwgXCJSb25uaWVcIiwgXCJCYXJyeVwiLCBcIkx1Y2FzXCIsIFwiQ29yZXlcIiwgXCJNYW51ZWxcIiwgXCJMZW9cIiwgXCJUb21teVwiLCBcIldhcnJlblwiLCBcIkphY2tzb25cIiwgXCJJc2FpYWhcIiwgXCJDb25ub3JcIiwgXCJEb25cIiwgXCJEZWFuXCIsIFwiSm9uXCIsIFwiSnVsaWFuXCIsIFwiTWlndWVsXCIsIFwiQmlsbFwiLCBcIkxsb3lkXCIsIFwiQ2hhcmxpZVwiLCBcIk1pdGNoZWxsXCIsIFwiTGVvblwiLCBcIkplcm9tZVwiLCBcIkRhcnJlbGxcIiwgXCJKZXJlbWlhaFwiLCBcIkFsdmluXCIsIFwiQnJldHRcIiwgXCJTZXRoXCIsIFwiRmxveWRcIiwgXCJKaW1cIiwgXCJCbGFrZVwiLCBcIk1pY2hlYWxcIiwgXCJHb3Jkb25cIiwgXCJUcmV2b3JcIiwgXCJMZXdpc1wiLCBcIkVyaWtcIiwgXCJFZGdhclwiLCBcIlZlcm5vblwiLCBcIkRldmluXCIsIFwiR2F2aW5cIiwgXCJKYXlkZW5cIiwgXCJDaHJpc1wiLCBcIkNseWRlXCIsIFwiVG9tXCIsIFwiRGVycmlja1wiLCBcIk1hcmlvXCIsIFwiQnJlbnRcIiwgXCJNYXJjXCIsIFwiSGVybWFuXCIsIFwiQ2hhc2VcIiwgXCJEb21pbmljXCIsIFwiUmljYXJkb1wiLCBcIkZyYW5rbGluXCIsIFwiTWF1cmljZVwiLCBcIk1heFwiLCBcIkFpZGVuXCIsIFwiT3dlblwiLCBcIkxlc3RlclwiLCBcIkdpbGJlcnRcIiwgXCJFbG1lclwiLCBcIkdlbmVcIiwgXCJGcmFuY2lzY29cIiwgXCJHbGVuXCIsIFwiQ29yeVwiLCBcIkdhcnJldHRcIiwgXCJDbGF5dG9uXCIsIFwiU2FtXCIsIFwiSm9yZ2VcIiwgXCJDaGVzdGVyXCIsIFwiQWxlamFuZHJvXCIsIFwiSmVmZlwiLCBcIkhhcnZleVwiLCBcIk1pbHRvblwiLCBcIkNvbGVcIiwgXCJJdmFuXCIsIFwiQW5kcmVcIiwgXCJEdWFuZVwiLCBcIkxhbmRvblwiXSxcbiAgICAgICAgICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cDovL3d3dy5kYXRpLmdvdi5pdC9kYXRhc2V0L2NvbXVuZS1kaS1maXJlbnplXzAxNjNcbiAgICAgICAgICAgICAgICBcIml0XCI6IFtcIkFkb2xmb1wiLCBcIkFsYmVydG9cIiwgXCJBbGRvXCIsIFwiQWxlc3NhbmRyb1wiLCBcIkFsZXNzaW9cIiwgXCJBbGZyZWRvXCIsIFwiQWx2YXJvXCIsIFwiQW5kcmVhXCIsIFwiQW5nZWxvXCIsIFwiQW5naW9sb1wiLCBcIkFudG9uaW5vXCIsIFwiQW50b25pb1wiLCBcIkF0dGlsaW9cIiwgXCJCZW5pdG9cIiwgXCJCZXJuYXJkb1wiLCBcIkJydW5vXCIsIFwiQ2FybG9cIiwgXCJDZXNhcmVcIiwgXCJDaHJpc3RpYW5cIiwgXCJDbGF1ZGlvXCIsIFwiQ29ycmFkb1wiLCBcIkNvc2ltb1wiLCBcIkNyaXN0aWFuXCIsIFwiQ3Jpc3RpYW5vXCIsIFwiRGFuaWVsZVwiLCBcIkRhcmlvXCIsIFwiRGF2aWRcIiwgXCJEYXZpZGVcIiwgXCJEaWVnb1wiLCBcIkRpbm9cIiwgXCJEb21lbmljb1wiLCBcIkR1Y2Npb1wiLCBcIkVkb2FyZG9cIiwgXCJFbGlhXCIsIFwiRWxpb1wiLCBcIkVtYW51ZWxlXCIsIFwiRW1pbGlhbm9cIiwgXCJFbWlsaW9cIiwgXCJFbnJpY29cIiwgXCJFbnpvXCIsIFwiRXR0b3JlXCIsIFwiRmFiaW9cIiwgXCJGYWJyaXppb1wiLCBcIkZlZGVyaWNvXCIsIFwiRmVyZGluYW5kb1wiLCBcIkZlcm5hbmRvXCIsIFwiRmlsaXBwb1wiLCBcIkZyYW5jZXNjb1wiLCBcIkZyYW5jb1wiLCBcIkdhYnJpZWxlXCIsIFwiR2lhY29tb1wiLCBcIkdpYW1wYW9sb1wiLCBcIkdpYW1waWVyb1wiLCBcIkdpYW5jYXJsb1wiLCBcIkdpYW5mcmFuY29cIiwgXCJHaWFubHVjYVwiLCBcIkdpYW5tYXJjb1wiLCBcIkdpYW5uaVwiLCBcIkdpbm9cIiwgXCJHaW9yZ2lvXCIsIFwiR2lvdmFubmlcIiwgXCJHaXVsaWFub1wiLCBcIkdpdWxpb1wiLCBcIkdpdXNlcHBlXCIsIFwiR3Jhemlhbm9cIiwgXCJHcmVnb3Jpb1wiLCBcIkd1aWRvXCIsIFwiSWFjb3BvXCIsIFwiSmFjb3BvXCIsIFwiTGFwb1wiLCBcIkxlb25hcmRvXCIsIFwiTG9yZW56b1wiLCBcIkx1Y2FcIiwgXCJMdWNpYW5vXCIsIFwiTHVpZ2lcIiwgXCJNYW51ZWxcIiwgXCJNYXJjZWxsb1wiLCBcIk1hcmNvXCIsIFwiTWFyaW5vXCIsIFwiTWFyaW9cIiwgXCJNYXNzaW1pbGlhbm9cIiwgXCJNYXNzaW1vXCIsIFwiTWF0dGVvXCIsIFwiTWF0dGlhXCIsIFwiTWF1cml6aW9cIiwgXCJNYXVyb1wiLCBcIk1pY2hlbGVcIiwgXCJNaXJrb1wiLCBcIk1vaGFtZWRcIiwgXCJOZWxsb1wiLCBcIk5lcmlcIiwgXCJOaWNjb2zDslwiLCBcIk5pY29sYVwiLCBcIk9zdmFsZG9cIiwgXCJPdGVsbG9cIiwgXCJQYW9sb1wiLCBcIlBpZXIgTHVpZ2lcIiwgXCJQaWVyb1wiLCBcIlBpZXRyb1wiLCBcIlJhZmZhZWxlXCIsIFwiUmVtb1wiLCBcIlJlbmF0b1wiLCBcIlJlbnpvXCIsIFwiUmljY2FyZG9cIiwgXCJSb2JlcnRvXCIsIFwiUm9sYW5kb1wiLCBcIlJvbWFub1wiLCBcIlNhbHZhdG9yZVwiLCBcIlNhbXVlbGVcIiwgXCJTYW5kcm9cIiwgXCJTZXJnaW9cIiwgXCJTaWx2YW5vXCIsIFwiU2ltb25lXCIsIFwiU3RlZmFub1wiLCBcIlRob21hc1wiLCBcIlRvbW1hc29cIiwgXCJVYmFsZG9cIiwgXCJVZ29cIiwgXCJVbWJlcnRvXCIsIFwiVmFsZXJpb1wiLCBcIlZhbHRlclwiLCBcIlZhc2NvXCIsIFwiVmluY2Vuem9cIiwgXCJWaXR0b3Jpb1wiXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiZmVtYWxlXCI6IHtcbiAgICAgICAgICAgICAgICBcImVuXCI6IFtcIk1hcnlcIiwgXCJFbW1hXCIsIFwiRWxpemFiZXRoXCIsIFwiTWlubmllXCIsIFwiTWFyZ2FyZXRcIiwgXCJJZGFcIiwgXCJBbGljZVwiLCBcIkJlcnRoYVwiLCBcIlNhcmFoXCIsIFwiQW5uaWVcIiwgXCJDbGFyYVwiLCBcIkVsbGFcIiwgXCJGbG9yZW5jZVwiLCBcIkNvcmFcIiwgXCJNYXJ0aGFcIiwgXCJMYXVyYVwiLCBcIk5lbGxpZVwiLCBcIkdyYWNlXCIsIFwiQ2FycmllXCIsIFwiTWF1ZGVcIiwgXCJNYWJlbFwiLCBcIkJlc3NpZVwiLCBcIkplbm5pZVwiLCBcIkdlcnRydWRlXCIsIFwiSnVsaWFcIiwgXCJIYXR0aWVcIiwgXCJFZGl0aFwiLCBcIk1hdHRpZVwiLCBcIlJvc2VcIiwgXCJDYXRoZXJpbmVcIiwgXCJMaWxsaWFuXCIsIFwiQWRhXCIsIFwiTGlsbGllXCIsIFwiSGVsZW5cIiwgXCJKZXNzaWVcIiwgXCJMb3Vpc2VcIiwgXCJFdGhlbFwiLCBcIkx1bGFcIiwgXCJNeXJ0bGVcIiwgXCJFdmFcIiwgXCJGcmFuY2VzXCIsIFwiTGVuYVwiLCBcIkx1Y3lcIiwgXCJFZG5hXCIsIFwiTWFnZ2llXCIsIFwiUGVhcmxcIiwgXCJEYWlzeVwiLCBcIkZhbm5pZVwiLCBcIkpvc2VwaGluZVwiLCBcIkRvcmFcIiwgXCJSb3NhXCIsIFwiS2F0aGVyaW5lXCIsIFwiQWduZXNcIiwgXCJNYXJpZVwiLCBcIk5vcmFcIiwgXCJNYXlcIiwgXCJNYW1pZVwiLCBcIkJsYW5jaGVcIiwgXCJTdGVsbGFcIiwgXCJFbGxlblwiLCBcIk5hbmN5XCIsIFwiRWZmaWVcIiwgXCJTYWxsaWVcIiwgXCJOZXR0aWVcIiwgXCJEZWxsYVwiLCBcIkxpenppZVwiLCBcIkZsb3JhXCIsIFwiU3VzaWVcIiwgXCJNYXVkXCIsIFwiTWFlXCIsIFwiRXR0YVwiLCBcIkhhcnJpZXRcIiwgXCJTYWRpZVwiLCBcIkNhcm9saW5lXCIsIFwiS2F0aWVcIiwgXCJMeWRpYVwiLCBcIkVsc2llXCIsIFwiS2F0ZVwiLCBcIlN1c2FuXCIsIFwiTW9sbGllXCIsIFwiQWxtYVwiLCBcIkFkZGllXCIsIFwiR2VvcmdpYVwiLCBcIkVsaXphXCIsIFwiTHVsdVwiLCBcIk5hbm5pZVwiLCBcIkxvdHRpZVwiLCBcIkFtYW5kYVwiLCBcIkJlbGxlXCIsIFwiQ2hhcmxvdHRlXCIsIFwiUmViZWNjYVwiLCBcIlJ1dGhcIiwgXCJWaW9sYVwiLCBcIk9saXZlXCIsIFwiQW1lbGlhXCIsIFwiSGFubmFoXCIsIFwiSmFuZVwiLCBcIlZpcmdpbmlhXCIsIFwiRW1pbHlcIiwgXCJNYXRpbGRhXCIsIFwiSXJlbmVcIiwgXCJLYXRocnluXCIsIFwiRXN0aGVyXCIsIFwiV2lsbGllXCIsIFwiSGVucmlldHRhXCIsIFwiT2xsaWVcIiwgXCJBbXlcIiwgXCJSYWNoZWxcIiwgXCJTYXJhXCIsIFwiRXN0ZWxsYVwiLCBcIlRoZXJlc2FcIiwgXCJBdWd1c3RhXCIsIFwiT3JhXCIsIFwiUGF1bGluZVwiLCBcIkpvc2llXCIsIFwiTG9sYVwiLCBcIlNvcGhpYVwiLCBcIkxlb25hXCIsIFwiQW5uZVwiLCBcIk1pbGRyZWRcIiwgXCJBbm5cIiwgXCJCZXVsYWhcIiwgXCJDYWxsaWVcIiwgXCJMb3VcIiwgXCJEZWxpYVwiLCBcIkVsZWFub3JcIiwgXCJCYXJiYXJhXCIsIFwiSXZhXCIsIFwiTG91aXNhXCIsIFwiTWFyaWFcIiwgXCJNYXltZVwiLCBcIkV2ZWx5blwiLCBcIkVzdGVsbGVcIiwgXCJOaW5hXCIsIFwiQmV0dHlcIiwgXCJNYXJpb25cIiwgXCJCZXR0aWVcIiwgXCJEb3JvdGh5XCIsIFwiTHVlbGxhXCIsIFwiSW5lelwiLCBcIkxlbGFcIiwgXCJSb3NpZVwiLCBcIkFsbGllXCIsIFwiTWlsbGllXCIsIFwiSmFuaWVcIiwgXCJDb3JuZWxpYVwiLCBcIlZpY3RvcmlhXCIsIFwiUnVieVwiLCBcIldpbmlmcmVkXCIsIFwiQWx0YVwiLCBcIkNlbGlhXCIsIFwiQ2hyaXN0aW5lXCIsIFwiQmVhdHJpY2VcIiwgXCJCaXJkaWVcIiwgXCJIYXJyaWV0dFwiLCBcIk1hYmxlXCIsIFwiTXlyYVwiLCBcIlNvcGhpZVwiLCBcIlRpbGxpZVwiLCBcIklzYWJlbFwiLCBcIlN5bHZpYVwiLCBcIkNhcm9seW5cIiwgXCJJc2FiZWxsZVwiLCBcIkxlaWxhXCIsIFwiU2FsbHlcIiwgXCJJbmFcIiwgXCJFc3NpZVwiLCBcIkJlcnRpZVwiLCBcIk5lbGxcIiwgXCJBbGJlcnRhXCIsIFwiS2F0aGFyaW5lXCIsIFwiTG9yYVwiLCBcIlJlbmFcIiwgXCJNaW5hXCIsIFwiUmhvZGFcIiwgXCJNYXRoaWxkYVwiLCBcIkFiYmllXCIsIFwiRXVsYVwiLCBcIkRvbGxpZVwiLCBcIkhldHRpZVwiLCBcIkV1bmljZVwiLCBcIkZhbm55XCIsIFwiT2xhXCIsIFwiTGVub3JhXCIsIFwiQWRlbGFpZGVcIiwgXCJDaHJpc3RpbmFcIiwgXCJMZWxpYVwiLCBcIk5lbGxlXCIsIFwiU3VlXCIsIFwiSm9oYW5uYVwiLCBcIkxpbGx5XCIsIFwiTHVjaW5kYVwiLCBcIk1pbmVydmFcIiwgXCJMZXR0aWVcIiwgXCJSb3hpZVwiLCBcIkN5bnRoaWFcIiwgXCJIZWxlbmFcIiwgXCJIaWxkYVwiLCBcIkh1bGRhXCIsIFwiQmVybmljZVwiLCBcIkdlbmV2aWV2ZVwiLCBcIkplYW5cIiwgXCJDb3JkZWxpYVwiLCBcIk1hcmlhblwiLCBcIkZyYW5jaXNcIiwgXCJKZWFuZXR0ZVwiLCBcIkFkZWxpbmVcIiwgXCJHdXNzaWVcIiwgXCJMZWFoXCIsIFwiTG9pc1wiLCBcIkx1cmFcIiwgXCJNaXR0aWVcIiwgXCJIYWxsaWVcIiwgXCJJc2FiZWxsYVwiLCBcIk9sZ2FcIiwgXCJQaG9lYmVcIiwgXCJUZXJlc2FcIiwgXCJIZXN0ZXJcIiwgXCJMaWRhXCIsIFwiTGluYVwiLCBcIldpbm5pZVwiLCBcIkNsYXVkaWFcIiwgXCJNYXJndWVyaXRlXCIsIFwiVmVyYVwiLCBcIkNlY2VsaWFcIiwgXCJCZXNzXCIsIFwiRW1pbGllXCIsIFwiUm9zZXR0YVwiLCBcIlZlcm5hXCIsIFwiTXlydGllXCIsIFwiQ2VjaWxpYVwiLCBcIkVsdmFcIiwgXCJPbGl2aWFcIiwgXCJPcGhlbGlhXCIsIFwiR2VvcmdpZVwiLCBcIkVsbm9yYVwiLCBcIlZpb2xldFwiLCBcIkFkZWxlXCIsIFwiTGlseVwiLCBcIkxpbm5pZVwiLCBcIkxvcmV0dGFcIiwgXCJNYWRnZVwiLCBcIlBvbGx5XCIsIFwiVmlyZ2llXCIsIFwiRXVnZW5pYVwiLCBcIkx1Y2lsZVwiLCBcIkx1Y2lsbGVcIiwgXCJNYWJlbGxlXCIsIFwiUm9zYWxpZVwiXSxcbiAgICAgICAgICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cDovL3d3dy5kYXRpLmdvdi5pdC9kYXRhc2V0L2NvbXVuZS1kaS1maXJlbnplXzAxNjJcbiAgICAgICAgICAgICAgICBcIml0XCI6IFtcIkFkYVwiLCBcIkFkcmlhbmFcIiwgXCJBbGVzc2FuZHJhXCIsIFwiQWxlc3NpYVwiLCBcIkFsaWNlXCIsIFwiQW5nZWxhXCIsIFwiQW5uYVwiLCBcIkFubmEgTWFyaWFcIiwgXCJBbm5hbGlzYVwiLCBcIkFubml0YVwiLCBcIkFubnVuemlhdGFcIiwgXCJBbnRvbmVsbGFcIiwgXCJBcmlhbm5hXCIsIFwiQXNpYVwiLCBcIkFzc3VudGFcIiwgXCJBdXJvcmFcIiwgXCJCYXJiYXJhXCIsIFwiQmVhdHJpY2VcIiwgXCJCZW5lZGV0dGFcIiwgXCJCaWFuY2FcIiwgXCJCcnVuYVwiLCBcIkNhbWlsbGFcIiwgXCJDYXJsYVwiLCBcIkNhcmxvdHRhXCIsIFwiQ2FybWVsYVwiLCBcIkNhcm9saW5hXCIsIFwiQ2F0ZXJpbmFcIiwgXCJDYXRpYVwiLCBcIkNlY2lsaWFcIiwgXCJDaGlhcmFcIiwgXCJDaW56aWFcIiwgXCJDbGFyYVwiLCBcIkNsYXVkaWFcIiwgXCJDb3N0YW56YVwiLCBcIkNyaXN0aW5hXCIsIFwiRGFuaWVsYVwiLCBcIkRlYm9yYVwiLCBcIkRpbGV0dGFcIiwgXCJEaW5hXCIsIFwiRG9uYXRlbGxhXCIsIFwiRWxlbmFcIiwgXCJFbGVvbm9yYVwiLCBcIkVsaXNhXCIsIFwiRWxpc2FiZXR0YVwiLCBcIkVtYW51ZWxhXCIsIFwiRW1tYVwiLCBcIkV2YVwiLCBcIkZlZGVyaWNhXCIsIFwiRmVybmFuZGFcIiwgXCJGaW9yZWxsYVwiLCBcIkZpb3JlbnphXCIsIFwiRmxvcmFcIiwgXCJGcmFuY2FcIiwgXCJGcmFuY2VzY2FcIiwgXCJHYWJyaWVsbGFcIiwgXCJHYWlhXCIsIFwiR2VtbWFcIiwgXCJHaWFkYVwiLCBcIkdpYW5uYVwiLCBcIkdpbmFcIiwgXCJHaW5ldnJhXCIsIFwiR2lvcmdpYVwiLCBcIkdpb3Zhbm5hXCIsIFwiR2l1bGlhXCIsIFwiR2l1bGlhbmFcIiwgXCJHaXVzZXBwYVwiLCBcIkdpdXNlcHBpbmFcIiwgXCJHcmF6aWFcIiwgXCJHcmF6aWVsbGFcIiwgXCJHcmV0YVwiLCBcIklkYVwiLCBcIklsYXJpYVwiLCBcIkluZXNcIiwgXCJJb2xhbmRhXCIsIFwiSXJlbmVcIiwgXCJJcm1hXCIsIFwiSXNhYmVsbGFcIiwgXCJKZXNzaWNhXCIsIFwiTGF1cmFcIiwgXCJMZWRhXCIsIFwiTGV0aXppYVwiLCBcIkxpY2lhXCIsIFwiTGlkaWFcIiwgXCJMaWxpYW5hXCIsIFwiTGluYVwiLCBcIkxpbmRhXCIsIFwiTGlzYVwiLCBcIkxpdmlhXCIsIFwiTG9yZXR0YVwiLCBcIkx1YW5hXCIsIFwiTHVjaWFcIiwgXCJMdWNpYW5hXCIsIFwiTHVjcmV6aWFcIiwgXCJMdWlzYVwiLCBcIk1hbnVlbGFcIiwgXCJNYXJhXCIsIFwiTWFyY2VsbGFcIiwgXCJNYXJnaGVyaXRhXCIsIFwiTWFyaWFcIiwgXCJNYXJpYSBDcmlzdGluYVwiLCBcIk1hcmlhIEdyYXppYVwiLCBcIk1hcmlhIEx1aXNhXCIsIFwiTWFyaWEgUGlhXCIsIFwiTWFyaWEgVGVyZXNhXCIsIFwiTWFyaW5hXCIsIFwiTWFyaXNhXCIsIFwiTWFydGFcIiwgXCJNYXJ0aW5hXCIsIFwiTWFyemlhXCIsIFwiTWF0aWxkZVwiLCBcIk1lbGlzc2FcIiwgXCJNaWNoZWxhXCIsIFwiTWlsZW5hXCIsIFwiTWlyZWxsYVwiLCBcIk1vbmljYVwiLCBcIk5hdGFsaW5hXCIsIFwiTmVsbGFcIiwgXCJOaWNvbGV0dGFcIiwgXCJOb2VtaVwiLCBcIk9sZ2FcIiwgXCJQYW9sYVwiLCBcIlBhdHJpemlhXCIsIFwiUGllcmFcIiwgXCJQaWVyaW5hXCIsIFwiUmFmZmFlbGxhXCIsIFwiUmViZWNjYVwiLCBcIlJlbmF0YVwiLCBcIlJpbmFcIiwgXCJSaXRhXCIsIFwiUm9iZXJ0YVwiLCBcIlJvc2FcIiwgXCJSb3Nhbm5hXCIsIFwiUm9zc2FuYVwiLCBcIlJvc3NlbGxhXCIsIFwiU2FicmluYVwiLCBcIlNhbmRyYVwiLCBcIlNhcmFcIiwgXCJTZXJlbmFcIiwgXCJTaWx2YW5hXCIsIFwiU2lsdmlhXCIsIFwiU2ltb25hXCIsIFwiU2ltb25ldHRhXCIsIFwiU29maWFcIiwgXCJTb25pYVwiLCBcIlN0ZWZhbmlhXCIsIFwiU3VzYW5uYVwiLCBcIlRlcmVzYVwiLCBcIlRpbmFcIiwgXCJUaXppYW5hXCIsIFwiVG9zY2FcIiwgXCJWYWxlbnRpbmFcIiwgXCJWYWxlcmlhXCIsIFwiVmFuZGFcIiwgXCJWYW5lc3NhXCIsIFwiVmFubmFcIiwgXCJWZXJhXCIsIFwiVmVyb25pY2FcIiwgXCJWaWxtYVwiLCBcIlZpb2xhXCIsIFwiVmlyZ2luaWFcIiwgXCJWaXR0b3JpYVwiXVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGxhc3ROYW1lczoge1xuICAgICAgICAgICAgXCJlblwiOiBbJ1NtaXRoJywgJ0pvaG5zb24nLCAnV2lsbGlhbXMnLCAnSm9uZXMnLCAnQnJvd24nLCAnRGF2aXMnLCAnTWlsbGVyJywgJ1dpbHNvbicsICdNb29yZScsICdUYXlsb3InLCAnQW5kZXJzb24nLCAnVGhvbWFzJywgJ0phY2tzb24nLCAnV2hpdGUnLCAnSGFycmlzJywgJ01hcnRpbicsICdUaG9tcHNvbicsICdHYXJjaWEnLCAnTWFydGluZXonLCAnUm9iaW5zb24nLCAnQ2xhcmsnLCAnUm9kcmlndWV6JywgJ0xld2lzJywgJ0xlZScsICdXYWxrZXInLCAnSGFsbCcsICdBbGxlbicsICdZb3VuZycsICdIZXJuYW5kZXonLCAnS2luZycsICdXcmlnaHQnLCAnTG9wZXonLCAnSGlsbCcsICdTY290dCcsICdHcmVlbicsICdBZGFtcycsICdCYWtlcicsICdHb256YWxleicsICdOZWxzb24nLCAnQ2FydGVyJywgJ01pdGNoZWxsJywgJ1BlcmV6JywgJ1JvYmVydHMnLCAnVHVybmVyJywgJ1BoaWxsaXBzJywgJ0NhbXBiZWxsJywgJ1BhcmtlcicsICdFdmFucycsICdFZHdhcmRzJywgJ0NvbGxpbnMnLCAnU3Rld2FydCcsICdTYW5jaGV6JywgJ01vcnJpcycsICdSb2dlcnMnLCAnUmVlZCcsICdDb29rJywgJ01vcmdhbicsICdCZWxsJywgJ011cnBoeScsICdCYWlsZXknLCAnUml2ZXJhJywgJ0Nvb3BlcicsICdSaWNoYXJkc29uJywgJ0NveCcsICdIb3dhcmQnLCAnV2FyZCcsICdUb3JyZXMnLCAnUGV0ZXJzb24nLCAnR3JheScsICdSYW1pcmV6JywgJ0phbWVzJywgJ1dhdHNvbicsICdCcm9va3MnLCAnS2VsbHknLCAnU2FuZGVycycsICdQcmljZScsICdCZW5uZXR0JywgJ1dvb2QnLCAnQmFybmVzJywgJ1Jvc3MnLCAnSGVuZGVyc29uJywgJ0NvbGVtYW4nLCAnSmVua2lucycsICdQZXJyeScsICdQb3dlbGwnLCAnTG9uZycsICdQYXR0ZXJzb24nLCAnSHVnaGVzJywgJ0Zsb3JlcycsICdXYXNoaW5ndG9uJywgJ0J1dGxlcicsICdTaW1tb25zJywgJ0Zvc3RlcicsICdHb256YWxlcycsICdCcnlhbnQnLCAnQWxleGFuZGVyJywgJ1J1c3NlbGwnLCAnR3JpZmZpbicsICdEaWF6JywgJ0hheWVzJywgJ015ZXJzJywgJ0ZvcmQnLCAnSGFtaWx0b24nLCAnR3JhaGFtJywgJ1N1bGxpdmFuJywgJ1dhbGxhY2UnLCAnV29vZHMnLCAnQ29sZScsICdXZXN0JywgJ0pvcmRhbicsICdPd2VucycsICdSZXlub2xkcycsICdGaXNoZXInLCAnRWxsaXMnLCAnSGFycmlzb24nLCAnR2lic29uJywgJ01jRG9uYWxkJywgJ0NydXonLCAnTWFyc2hhbGwnLCAnT3J0aXonLCAnR29tZXonLCAnTXVycmF5JywgJ0ZyZWVtYW4nLCAnV2VsbHMnLCAnV2ViYicsICdTaW1wc29uJywgJ1N0ZXZlbnMnLCAnVHVja2VyJywgJ1BvcnRlcicsICdIdW50ZXInLCAnSGlja3MnLCAnQ3Jhd2ZvcmQnLCAnSGVucnknLCAnQm95ZCcsICdNYXNvbicsICdNb3JhbGVzJywgJ0tlbm5lZHknLCAnV2FycmVuJywgJ0RpeG9uJywgJ1JhbW9zJywgJ1JleWVzJywgJ0J1cm5zJywgJ0dvcmRvbicsICdTaGF3JywgJ0hvbG1lcycsICdSaWNlJywgJ1JvYmVydHNvbicsICdIdW50JywgJ0JsYWNrJywgJ0RhbmllbHMnLCAnUGFsbWVyJywgJ01pbGxzJywgJ05pY2hvbHMnLCAnR3JhbnQnLCAnS25pZ2h0JywgJ0Zlcmd1c29uJywgJ1Jvc2UnLCAnU3RvbmUnLCAnSGF3a2lucycsICdEdW5uJywgJ1BlcmtpbnMnLCAnSHVkc29uJywgJ1NwZW5jZXInLCAnR2FyZG5lcicsICdTdGVwaGVucycsICdQYXluZScsICdQaWVyY2UnLCAnQmVycnknLCAnTWF0dGhld3MnLCAnQXJub2xkJywgJ1dhZ25lcicsICdXaWxsaXMnLCAnUmF5JywgJ1dhdGtpbnMnLCAnT2xzb24nLCAnQ2Fycm9sbCcsICdEdW5jYW4nLCAnU255ZGVyJywgJ0hhcnQnLCAnQ3VubmluZ2hhbScsICdCcmFkbGV5JywgJ0xhbmUnLCAnQW5kcmV3cycsICdSdWl6JywgJ0hhcnBlcicsICdGb3gnLCAnUmlsZXknLCAnQXJtc3Ryb25nJywgJ0NhcnBlbnRlcicsICdXZWF2ZXInLCAnR3JlZW5lJywgJ0xhd3JlbmNlJywgJ0VsbGlvdHQnLCAnQ2hhdmV6JywgJ1NpbXMnLCAnQXVzdGluJywgJ1BldGVycycsICdLZWxsZXknLCAnRnJhbmtsaW4nLCAnTGF3c29uJywgJ0ZpZWxkcycsICdHdXRpZXJyZXonLCAnUnlhbicsICdTY2htaWR0JywgJ0NhcnInLCAnVmFzcXVleicsICdDYXN0aWxsbycsICdXaGVlbGVyJywgJ0NoYXBtYW4nLCAnT2xpdmVyJywgJ01vbnRnb21lcnknLCAnUmljaGFyZHMnLCAnV2lsbGlhbXNvbicsICdKb2huc3RvbicsICdCYW5rcycsICdNZXllcicsICdCaXNob3AnLCAnTWNDb3knLCAnSG93ZWxsJywgJ0FsdmFyZXonLCAnTW9ycmlzb24nLCAnSGFuc2VuJywgJ0Zlcm5hbmRleicsICdHYXJ6YScsICdIYXJ2ZXknLCAnTGl0dGxlJywgJ0J1cnRvbicsICdTdGFubGV5JywgJ05ndXllbicsICdHZW9yZ2UnLCAnSmFjb2JzJywgJ1JlaWQnLCAnS2ltJywgJ0Z1bGxlcicsICdMeW5jaCcsICdEZWFuJywgJ0dpbGJlcnQnLCAnR2FycmV0dCcsICdSb21lcm8nLCAnV2VsY2gnLCAnTGFyc29uJywgJ0ZyYXppZXInLCAnQnVya2UnLCAnSGFuc29uJywgJ0RheScsICdNZW5kb3phJywgJ01vcmVubycsICdCb3dtYW4nLCAnTWVkaW5hJywgJ0Zvd2xlcicsICdCcmV3ZXInLCAnSG9mZm1hbicsICdDYXJsc29uJywgJ1NpbHZhJywgJ1BlYXJzb24nLCAnSG9sbGFuZCcsICdEb3VnbGFzJywgJ0ZsZW1pbmcnLCAnSmVuc2VuJywgJ1ZhcmdhcycsICdCeXJkJywgJ0Rhdmlkc29uJywgJ0hvcGtpbnMnLCAnTWF5JywgJ1RlcnJ5JywgJ0hlcnJlcmEnLCAnV2FkZScsICdTb3RvJywgJ1dhbHRlcnMnLCAnQ3VydGlzJywgJ05lYWwnLCAnQ2FsZHdlbGwnLCAnTG93ZScsICdKZW5uaW5ncycsICdCYXJuZXR0JywgJ0dyYXZlcycsICdKaW1lbmV6JywgJ0hvcnRvbicsICdTaGVsdG9uJywgJ0JhcnJldHQnLCAnT2JyaWVuJywgJ0Nhc3RybycsICdTdXR0b24nLCAnR3JlZ29yeScsICdNY0tpbm5leScsICdMdWNhcycsICdNaWxlcycsICdDcmFpZycsICdSb2RyaXF1ZXonLCAnQ2hhbWJlcnMnLCAnSG9sdCcsICdMYW1iZXJ0JywgJ0ZsZXRjaGVyJywgJ1dhdHRzJywgJ0JhdGVzJywgJ0hhbGUnLCAnUmhvZGVzJywgJ1BlbmEnLCAnQmVjaycsICdOZXdtYW4nLCAnSGF5bmVzJywgJ01jRGFuaWVsJywgJ01lbmRleicsICdCdXNoJywgJ1ZhdWdobicsICdQYXJrcycsICdEYXdzb24nLCAnU2FudGlhZ28nLCAnTm9ycmlzJywgJ0hhcmR5JywgJ0xvdmUnLCAnU3RlZWxlJywgJ0N1cnJ5JywgJ1Bvd2VycycsICdTY2h1bHR6JywgJ0JhcmtlcicsICdHdXptYW4nLCAnUGFnZScsICdNdW5veicsICdCYWxsJywgJ0tlbGxlcicsICdDaGFuZGxlcicsICdXZWJlcicsICdMZW9uYXJkJywgJ1dhbHNoJywgJ0x5b25zJywgJ1JhbXNleScsICdXb2xmZScsICdTY2huZWlkZXInLCAnTXVsbGlucycsICdCZW5zb24nLCAnU2hhcnAnLCAnQm93ZW4nLCAnRGFuaWVsJywgJ0JhcmJlcicsICdDdW1taW5ncycsICdIaW5lcycsICdCYWxkd2luJywgJ0dyaWZmaXRoJywgJ1ZhbGRleicsICdIdWJiYXJkJywgJ1NhbGF6YXInLCAnUmVldmVzJywgJ1dhcm5lcicsICdTdGV2ZW5zb24nLCAnQnVyZ2VzcycsICdTYW50b3MnLCAnVGF0ZScsICdDcm9zcycsICdHYXJuZXInLCAnTWFubicsICdNYWNrJywgJ01vc3MnLCAnVGhvcm50b24nLCAnRGVubmlzJywgJ01jR2VlJywgJ0Zhcm1lcicsICdEZWxnYWRvJywgJ0FndWlsYXInLCAnVmVnYScsICdHbG92ZXInLCAnTWFubmluZycsICdDb2hlbicsICdIYXJtb24nLCAnUm9kZ2VycycsICdSb2JiaW5zJywgJ05ld3RvbicsICdUb2RkJywgJ0JsYWlyJywgJ0hpZ2dpbnMnLCAnSW5ncmFtJywgJ1JlZXNlJywgJ0Nhbm5vbicsICdTdHJpY2tsYW5kJywgJ1Rvd25zZW5kJywgJ1BvdHRlcicsICdHb29kd2luJywgJ1dhbHRvbicsICdSb3dlJywgJ0hhbXB0b24nLCAnT3J0ZWdhJywgJ1BhdHRvbicsICdTd2Fuc29uJywgJ0pvc2VwaCcsICdGcmFuY2lzJywgJ0dvb2RtYW4nLCAnTWFsZG9uYWRvJywgJ1lhdGVzJywgJ0JlY2tlcicsICdFcmlja3NvbicsICdIb2RnZXMnLCAnUmlvcycsICdDb25uZXInLCAnQWRraW5zJywgJ1dlYnN0ZXInLCAnTm9ybWFuJywgJ01hbG9uZScsICdIYW1tb25kJywgJ0Zsb3dlcnMnLCAnQ29iYicsICdNb29keScsICdRdWlubicsICdCbGFrZScsICdNYXh3ZWxsJywgJ1BvcGUnLCAnRmxveWQnLCAnT3Nib3JuZScsICdQYXVsJywgJ01jQ2FydGh5JywgJ0d1ZXJyZXJvJywgJ0xpbmRzZXknLCAnRXN0cmFkYScsICdTYW5kb3ZhbCcsICdHaWJicycsICdUeWxlcicsICdHcm9zcycsICdGaXR6Z2VyYWxkJywgJ1N0b2tlcycsICdEb3lsZScsICdTaGVybWFuJywgJ1NhdW5kZXJzJywgJ1dpc2UnLCAnQ29sb24nLCAnR2lsbCcsICdBbHZhcmFkbycsICdHcmVlcicsICdQYWRpbGxhJywgJ1NpbW9uJywgJ1dhdGVycycsICdOdW5leicsICdCYWxsYXJkJywgJ1NjaHdhcnR6JywgJ01jQnJpZGUnLCAnSG91c3RvbicsICdDaHJpc3RlbnNlbicsICdLbGVpbicsICdQcmF0dCcsICdCcmlnZ3MnLCAnUGFyc29ucycsICdNY0xhdWdobGluJywgJ1ppbW1lcm1hbicsICdGcmVuY2gnLCAnQnVjaGFuYW4nLCAnTW9yYW4nLCAnQ29wZWxhbmQnLCAnUm95JywgJ1BpdHRtYW4nLCAnQnJhZHknLCAnTWNDb3JtaWNrJywgJ0hvbGxvd2F5JywgJ0Jyb2NrJywgJ1Bvb2xlJywgJ0ZyYW5rJywgJ0xvZ2FuJywgJ093ZW4nLCAnQmFzcycsICdNYXJzaCcsICdEcmFrZScsICdXb25nJywgJ0plZmZlcnNvbicsICdQYXJrJywgJ01vcnRvbicsICdBYmJvdHQnLCAnU3BhcmtzJywgJ1BhdHJpY2snLCAnTm9ydG9uJywgJ0h1ZmYnLCAnQ2xheXRvbicsICdNYXNzZXknLCAnTGxveWQnLCAnRmlndWVyb2EnLCAnQ2Fyc29uJywgJ0Jvd2VycycsICdSb2JlcnNvbicsICdCYXJ0b24nLCAnVHJhbicsICdMYW1iJywgJ0hhcnJpbmd0b24nLCAnQ2FzZXknLCAnQm9vbmUnLCAnQ29ydGV6JywgJ0NsYXJrZScsICdNYXRoaXMnLCAnU2luZ2xldG9uJywgJ1dpbGtpbnMnLCAnQ2FpbicsICdCcnlhbicsICdVbmRlcndvb2QnLCAnSG9nYW4nLCAnTWNLZW56aWUnLCAnQ29sbGllcicsICdMdW5hJywgJ1BoZWxwcycsICdNY0d1aXJlJywgJ0FsbGlzb24nLCAnQnJpZGdlcycsICdXaWxrZXJzb24nLCAnTmFzaCcsICdTdW1tZXJzJywgJ0F0a2lucyddLFxuICAgICAgICAgICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwOi8vd3d3LmRhdGkuZ292Lml0L2RhdGFzZXQvY29tdW5lLWRpLWZpcmVuemVfMDE2NCAoZmlyc3QgMTAwMClcbiAgICAgICAgICAgIFwiaXRcIjogW1wiQWNjaWFpXCIsIFwiQWdsaWV0dGlcIiwgXCJBZ29zdGluaVwiLCBcIkFncmVzdGlcIiwgXCJBaG1lZFwiLCBcIkFpYXp6aVwiLCBcIkFsYmFuZXNlXCIsIFwiQWxiZXJ0aVwiLCBcIkFsZXNzaVwiLCBcIkFsZmFuaVwiLCBcIkFsaW5hcmlcIiwgXCJBbHRlcmluaVwiLCBcIkFtYXRvXCIsIFwiQW1tYW5uYXRpXCIsIFwiQW5jaWxsb3R0aVwiLCBcIkFuZHJlaVwiLCBcIkFuZHJlaW5pXCIsIFwiQW5kcmVvbmlcIiwgXCJBbmdlbGlcIiwgXCJBbmljaGluaVwiLCBcIkFudG9uZWxsaVwiLCBcIkFudG9uaW5pXCIsIFwiQXJlbmFcIiwgXCJBcmlhbmlcIiwgXCJBcm5ldG9saVwiLCBcIkFycmlnaGlcIiwgXCJCYWNjYW5pXCIsIFwiQmFjY2V0dGlcIiwgXCJCYWNjaVwiLCBcIkJhY2hlcmluaVwiLCBcIkJhZGlpXCIsIFwiQmFnZ2lhbmlcIiwgXCJCYWdsaW9uaVwiLCBcIkJhZ25pXCIsIFwiQmFnbm9saVwiLCBcIkJhbGRhc3NpbmlcIiwgXCJCYWxkaVwiLCBcIkJhbGRpbmlcIiwgXCJCYWxsZXJpbmlcIiwgXCJCYWxsaVwiLCBcIkJhbGxpbmlcIiwgXCJCYWxsb25pXCIsIFwiQmFtYmlcIiwgXCJCYW5jaGlcIiwgXCJCYW5kaW5lbGxpXCIsIFwiQmFuZGluaVwiLCBcIkJhbmlcIiwgXCJCYXJiZXR0aVwiLCBcIkJhcmJpZXJpXCIsIFwiQmFyY2hpZWxsaVwiLCBcIkJhcmRhenppXCIsIFwiQmFyZGVsbGlcIiwgXCJCYXJkaVwiLCBcIkJhcmR1Y2NpXCIsIFwiQmFyZ2VsbGluaVwiLCBcIkJhcmdpYWNjaGlcIiwgXCJCYXJuaVwiLCBcIkJhcm9uY2VsbGlcIiwgXCJCYXJvbmNpbmlcIiwgXCJCYXJvbmVcIiwgXCJCYXJvbmlcIiwgXCJCYXJvbnRpXCIsIFwiQmFydGFsZXNpXCIsIFwiQmFydG9sZXR0aVwiLCBcIkJhcnRvbGlcIiwgXCJCYXJ0b2xpbmlcIiwgXCJCYXJ0b2xvbmlcIiwgXCJCYXJ0b2xvenppXCIsIFwiQmFzYWduaVwiLCBcIkJhc2lsZVwiLCBcIkJhc3NpXCIsIFwiQmF0YWNjaGlcIiwgXCJCYXR0YWdsaWFcIiwgXCJCYXR0YWdsaW5pXCIsIFwiQmF1c2lcIiwgXCJCZWNhZ2xpXCIsIFwiQmVjYXR0aW5pXCIsIFwiQmVjY2hpXCIsIFwiQmVjdWNjaVwiLCBcIkJlbGxhbmRpXCIsIFwiQmVsbGVzaVwiLCBcIkJlbGxpXCIsIFwiQmVsbGluaVwiLCBcIkJlbGx1Y2NpXCIsIFwiQmVuY2luaVwiLCBcIkJlbmVkZXR0aVwiLCBcIkJlbmVsbGlcIiwgXCJCZW5pXCIsIFwiQmVuaW5pXCIsIFwiQmVuc2lcIiwgXCJCZW51Y2NpXCIsIFwiQmVudmVudXRpXCIsIFwiQmVybGluY2lvbmlcIiwgXCJCZXJuYWNjaGlvbmlcIiwgXCJCZXJuYXJkaVwiLCBcIkJlcm5hcmRpbmlcIiwgXCJCZXJuaVwiLCBcIkJlcm5pbmlcIiwgXCJCZXJ0ZWxsaVwiLCBcIkJlcnRpXCIsIFwiQmVydGluaVwiLCBcIkJlc3NpXCIsIFwiQmV0dGlcIiwgXCJCZXR0aW5pXCIsIFwiQmlhZ2lcIiwgXCJCaWFnaW5pXCIsIFwiQmlhZ2lvbmlcIiwgXCJCaWFnaW90dGlcIiwgXCJCaWFuY2FsYW5pXCIsIFwiQmlhbmNoaVwiLCBcIkJpYW5jaGluaVwiLCBcIkJpYW5jb1wiLCBcIkJpZmZvbGlcIiwgXCJCaWdhenppXCIsIFwiQmlnaVwiLCBcIkJpbGlvdHRpXCIsIFwiQmlsbGlcIiwgXCJCaW5henppXCIsIFwiQmluZGlcIiwgXCJCaW5pXCIsIFwiQmlvbmRpXCIsIFwiQml6emFycmlcIiwgXCJCb2NjaVwiLCBcIkJvZ2FuaVwiLCBcIkJvbG9nbmVzaVwiLCBcIkJvbmFpdXRpXCIsIFwiQm9uYW5uaVwiLCBcIkJvbmNpYW5pXCIsIFwiQm9uY2luZWxsaVwiLCBcIkJvbmRpXCIsIFwiQm9uZWNoaVwiLCBcIkJvbmdpbmlcIiwgXCJCb25pXCIsIFwiQm9uaW5pXCIsIFwiQm9yY2hpXCIsIFwiQm9yZXR0aVwiLCBcIkJvcmdoaVwiLCBcIkJvcmdoaW5pXCIsIFwiQm9yZ2lvbGlcIiwgXCJCb3JyaVwiLCBcIkJvcnNlbGxpXCIsIFwiQm9zY2hpXCIsIFwiQm90dGFpXCIsIFwiQnJhY2NpXCIsIFwiQnJhY2NpbmlcIiwgXCJCcmFuZGlcIiwgXCJCcmFzY2hpXCIsIFwiQnJhdmlcIiwgXCJCcmF6emluaVwiLCBcIkJyZXNjaGlcIiwgXCJCcmlsbGlcIiwgXCJCcml6emlcIiwgXCJCcm9nZWxsaVwiLCBcIkJyb2dpXCIsIFwiQnJvZ2lvbmlcIiwgXCJCcnVuZWxsaVwiLCBcIkJydW5ldHRpXCIsIFwiQnJ1bmlcIiwgXCJCcnVub1wiLCBcIkJydW5vcmlcIiwgXCJCcnVzY2hpXCIsIFwiQnVjY2lcIiwgXCJCdWNjaWFyZWxsaVwiLCBcIkJ1Y2Npb25pXCIsIFwiQnVjZWxsaVwiLCBcIkJ1bGxpXCIsIFwiQnVyYmVyaVwiLCBcIkJ1cmNoaVwiLCBcIkJ1cmdhc3NpXCIsIFwiQnVycm9uaVwiLCBcIkJ1c3NvdHRpXCIsIFwiQnV0aVwiLCBcIkNhY2lvbGxpXCIsIFwiQ2FpYW5pXCIsIFwiQ2FsYWJyZXNlXCIsIFwiQ2FsYW1haVwiLCBcIkNhbGFtYW5kcmVpXCIsIFwiQ2FsZGluaVwiLCBcIkNhbG8nXCIsIFwiQ2Fsb25hY2lcIiwgXCJDYWxvc2lcIiwgXCJDYWx2ZWxsaVwiLCBcIkNhbWJpXCIsIFwiQ2FtaWNpb3R0b2xpXCIsIFwiQ2FtbWVsbGlcIiwgXCJDYW1taWxsaVwiLCBcIkNhbXBvbG1pXCIsIFwiQ2FudGluaVwiLCBcIkNhcGFubmlcIiwgXCJDYXBlY2NoaVwiLCBcIkNhcG9uaVwiLCBcIkNhcHBlbGxldHRpXCIsIFwiQ2FwcGVsbGlcIiwgXCJDYXBwZWxsaW5pXCIsIFwiQ2FwcHVnaVwiLCBcIkNhcHJldHRpXCIsIFwiQ2FwdXRvXCIsIFwiQ2FyYm9uZVwiLCBcIkNhcmJvbmlcIiwgXCJDYXJkaW5pXCIsIFwiQ2FybGVzaVwiLCBcIkNhcmxldHRpXCIsIFwiQ2FybGlcIiwgXCJDYXJvdGlcIiwgXCJDYXJvdHRpXCIsIFwiQ2FycmFpXCIsIFwiQ2FycmFyZXNpXCIsIFwiQ2FydGFcIiwgXCJDYXJ1c29cIiwgXCJDYXNhbGluaVwiLCBcIkNhc2F0aVwiLCBcIkNhc2VsbGlcIiwgXCJDYXNpbmlcIiwgXCJDYXN0YWdub2xpXCIsIFwiQ2FzdGVsbGFuaVwiLCBcIkNhc3RlbGxpXCIsIFwiQ2FzdGVsbHVjY2lcIiwgXCJDYXRhbGFub1wiLCBcIkNhdGFyemlcIiwgXCJDYXRlbGFuaVwiLCBcIkNhdmFjaW9jY2hpXCIsIFwiQ2F2YWxsYXJvXCIsIFwiQ2F2YWxsaW5pXCIsIFwiQ2F2aWNjaGlcIiwgXCJDYXZpbmlcIiwgXCJDZWNjYXJlbGxpXCIsIFwiQ2VjY2F0ZWxsaVwiLCBcIkNlY2NoZXJlbGxpXCIsIFwiQ2VjY2hlcmluaVwiLCBcIkNlY2NoaVwiLCBcIkNlY2NoaW5pXCIsIFwiQ2VjY29uaVwiLCBcIkNlaVwiLCBcIkNlbGxhaVwiLCBcIkNlbGxpXCIsIFwiQ2VsbGluaVwiLCBcIkNlbmNldHRpXCIsIFwiQ2VuaVwiLCBcIkNlbm5pXCIsIFwiQ2VyYmFpXCIsIFwiQ2VzYXJpXCIsIFwiQ2VzZXJpXCIsIFwiQ2hlY2NhY2NpXCIsIFwiQ2hlY2NoaVwiLCBcIkNoZWNjdWNjaVwiLCBcIkNoZWxpXCIsIFwiQ2hlbGxpbmlcIiwgXCJDaGVuXCIsIFwiQ2hlbmdcIiwgXCJDaGVyaWNpXCIsIFwiQ2hlcnViaW5pXCIsIFwiQ2hpYXJhbW9udGlcIiwgXCJDaGlhcmFudGluaVwiLCBcIkNoaWFyZWxsaVwiLCBcIkNoaWFyaVwiLCBcIkNoaWFyaW5pXCIsIFwiQ2hpYXJ1Z2lcIiwgXCJDaGlhdmFjY2lcIiwgXCJDaGllc2lcIiwgXCJDaGltZW50aVwiLCBcIkNoaW5pXCIsIFwiQ2hpcmljaVwiLCBcIkNoaXRpXCIsIFwiQ2lhYmF0dGlcIiwgXCJDaWFtcGlcIiwgXCJDaWFuY2hpXCIsIFwiQ2lhbmZhbmVsbGlcIiwgXCJDaWFuZmVyb25pXCIsIFwiQ2lhbmlcIiwgXCJDaWFwZXR0aVwiLCBcIkNpYXBwaVwiLCBcIkNpYXJkaVwiLCBcIkNpYXR0aVwiLCBcIkNpY2FsaVwiLCBcIkNpY2NvbmVcIiwgXCJDaW5lbGxpXCIsIFwiQ2luaVwiLCBcIkNpb2JhbnVcIiwgXCJDaW9sbGlcIiwgXCJDaW9uaVwiLCBcIkNpcHJpYW5pXCIsIFwiQ2lyaWxsb1wiLCBcIkNpcnJpXCIsIFwiQ2l1Y2NoaVwiLCBcIkNpdWZmaVwiLCBcIkNpdWxsaVwiLCBcIkNpdWxsaW5pXCIsIFwiQ2xlbWVudGVcIiwgXCJDb2NjaGlcIiwgXCJDb2dub21lXCIsIFwiQ29saVwiLCBcIkNvbGxpbmlcIiwgXCJDb2xvbWJvXCIsIFwiQ29semlcIiwgXCJDb21wYXJpbmlcIiwgXCJDb25mb3J0aVwiLCBcIkNvbnNpZ2xpXCIsIFwiQ29udGVcIiwgXCJDb250aVwiLCBcIkNvbnRpbmlcIiwgXCJDb3BwaW5pXCIsIFwiQ29wcG9sYVwiLCBcIkNvcnNpXCIsIFwiQ29yc2luaVwiLCBcIkNvcnRpXCIsIFwiQ29ydGluaVwiLCBcIkNvc2lcIiwgXCJDb3N0YVwiLCBcIkNvc3RhbnRpbmlcIiwgXCJDb3N0YW50aW5vXCIsIFwiQ296emlcIiwgXCJDcmVzY2lcIiwgXCJDcmVzY2lvbGlcIiwgXCJDcmVzdGlcIiwgXCJDcmluaVwiLCBcIkN1cnJhZGlcIiwgXCJEJ0Fnb3N0aW5vXCIsIFwiRCdBbGVzc2FuZHJvXCIsIFwiRCdBbWljb1wiLCBcIkQnQW5nZWxvXCIsIFwiRGFkZGlcIiwgXCJEYWluZWxsaVwiLCBcIkRhbGxhaVwiLCBcIkRhbnRpXCIsIFwiRGF2aXR0aVwiLCBcIkRlIEFuZ2VsaXNcIiwgXCJEZSBMdWNhXCIsIFwiRGUgTWFyY29cIiwgXCJEZSBSb3NhXCIsIFwiRGUgU2FudGlzXCIsIFwiRGUgU2ltb25lXCIsIFwiRGUgVml0YVwiLCBcIkRlZ2wnSW5ub2NlbnRpXCIsIFwiRGVnbGkgSW5ub2NlbnRpXCIsIFwiRGVpXCIsIFwiRGVsIEx1bmdvXCIsIFwiRGVsIFJlXCIsIFwiRGkgTWFyY29cIiwgXCJEaSBTdGVmYW5vXCIsIFwiRGluaVwiLCBcIkRpb3BcIiwgXCJEb2JyZVwiLCBcIkRvbGZpXCIsIFwiRG9uYXRpXCIsIFwiRG9uZG9saVwiLCBcIkRvbmdcIiwgXCJEb25uaW5pXCIsIFwiRHVjY2lcIiwgXCJEdW1pdHJ1XCIsIFwiRXJtaW5pXCIsIFwiRXNwb3NpdG9cIiwgXCJFdmFuZ2VsaXN0aVwiLCBcIkZhYmJyaVwiLCBcIkZhYmJyaW5pXCIsIFwiRmFiYnJpenppXCIsIFwiRmFiYnJvbmlcIiwgXCJGYWJicnVjY2lcIiwgXCJGYWJpYW5pXCIsIFwiRmFjY2hpbmlcIiwgXCJGYWdnaVwiLCBcIkZhZ2lvbGlcIiwgXCJGYWlsbGlcIiwgXCJGYWluaVwiLCBcIkZhbGNpYW5pXCIsIFwiRmFsY2luaVwiLCBcIkZhbGNvbmVcIiwgXCJGYWxsYW5pXCIsIFwiRmFsb3JuaVwiLCBcIkZhbHNpbmlcIiwgXCJGYWx1Z2lhbmlcIiwgXCJGYW5jZWxsaVwiLCBcIkZhbmVsbGlcIiwgXCJGYW5ldHRpXCIsIFwiRmFuZmFuaVwiLCBcIkZhbmlcIiwgXCJGYW50YXBwaWUnXCIsIFwiRmFudGVjaGlcIiwgXCJGYW50aVwiLCBcIkZhbnRpbmlcIiwgXCJGYW50b25pXCIsIFwiRmFyaW5hXCIsIFwiRmF0dG9yaVwiLCBcIkZhdmlsbGlcIiwgXCJGZWRpXCIsIFwiRmVpXCIsIFwiRmVycmFudGVcIiwgXCJGZXJyYXJhXCIsIFwiRmVycmFyaVwiLCBcIkZlcnJhcm9cIiwgXCJGZXJyZXR0aVwiLCBcIkZlcnJpXCIsIFwiRmVycmluaVwiLCBcIkZlcnJvbmlcIiwgXCJGaWFzY2hpXCIsIFwiRmliYmlcIiwgXCJGaWVzb2xpXCIsIFwiRmlsaXBwaVwiLCBcIkZpbGlwcGluaVwiLCBcIkZpbmlcIiwgXCJGaW9yYXZhbnRpXCIsIFwiRmlvcmVcIiwgXCJGaW9yZW50aW5pXCIsIFwiRmlvcmluaVwiLCBcIkZpc3NpXCIsIFwiRm9jYXJkaVwiLCBcIkZvZ2dpXCIsIFwiRm9udGFuYVwiLCBcIkZvbnRhbmVsbGlcIiwgXCJGb250YW5pXCIsIFwiRm9yY29uaVwiLCBcIkZvcm1pZ2xpXCIsIFwiRm9ydGVcIiwgXCJGb3J0aVwiLCBcIkZvcnRpbmlcIiwgXCJGb3NzYXRpXCIsIFwiRm9zc2lcIiwgXCJGcmFuY2FsYW5jaVwiLCBcIkZyYW5jZXNjaGlcIiwgXCJGcmFuY2VzY2hpbmlcIiwgXCJGcmFuY2hpXCIsIFwiRnJhbmNoaW5pXCIsIFwiRnJhbmNpXCIsIFwiRnJhbmNpbmlcIiwgXCJGcmFuY2lvbmlcIiwgXCJGcmFuY29cIiwgXCJGcmFzc2luZXRpXCIsIFwiRnJhdGlcIiwgXCJGcmF0aW5pXCIsIFwiRnJpbGxpXCIsIFwiRnJpenppXCIsIFwiRnJvc2FsaVwiLCBcIkZyb3NpbmlcIiwgXCJGcnVsbGluaVwiLCBcIkZ1c2NvXCIsIFwiRnVzaVwiLCBcIkdhYmJyaWVsbGlcIiwgXCJHYWJlbGxpbmlcIiwgXCJHYWdsaWFyZGlcIiwgXCJHYWxhbnRpXCIsIFwiR2FsYXJkaVwiLCBcIkdhbGVvdHRpXCIsIFwiR2FsbGV0dGlcIiwgXCJHYWxsaVwiLCBcIkdhbGxvXCIsIFwiR2FsbG9yaVwiLCBcIkdhbWJhY2NpYW5pXCIsIFwiR2FyZ2FuaVwiLCBcIkdhcm9mYWxvXCIsIFwiR2FydWdsaWVyaVwiLCBcIkdhc2hpXCIsIFwiR2FzcGVyaW5pXCIsIFwiR2F0dGlcIiwgXCJHZWxsaVwiLCBcIkdlbnNpbmlcIiwgXCJHZW50aWxlXCIsIFwiR2VudGlsaVwiLCBcIkdlcmlcIiwgXCJHZXJpbmlcIiwgXCJHaGVyaVwiLCBcIkdoaW5pXCIsIFwiR2lhY2hldHRpXCIsIFwiR2lhY2hpXCIsIFwiR2lhY29tZWxsaVwiLCBcIkdpYW5hc3NpXCIsIFwiR2lhbmlcIiwgXCJHaWFubmVsbGlcIiwgXCJHaWFubmV0dGlcIiwgXCJHaWFubmlcIiwgXCJHaWFubmluaVwiLCBcIkdpYW5ub25pXCIsIFwiR2lhbm5vdHRpXCIsIFwiR2lhbm5venppXCIsIFwiR2lnbGlcIiwgXCJHaW9yZGFub1wiLCBcIkdpb3JnZXR0aVwiLCBcIkdpb3JnaVwiLCBcIkdpb3ZhY2NoaW5pXCIsIFwiR2lvdmFubmVsbGlcIiwgXCJHaW92YW5uZXR0aVwiLCBcIkdpb3Zhbm5pbmlcIiwgXCJHaW92YW5ub25pXCIsIFwiR2l1bGlhbmlcIiwgXCJHaXVudGlcIiwgXCJHaXVudGluaVwiLCBcIkdpdXN0aVwiLCBcIkdvbm5lbGxpXCIsIFwiR29yZXR0aVwiLCBcIkdvcmlcIiwgXCJHcmFkaVwiLCBcIkdyYW1pZ25pXCIsIFwiR3Jhc3NpXCIsIFwiR3Jhc3NvXCIsIFwiR3JhemlhbmlcIiwgXCJHcmF6emluaVwiLCBcIkdyZWNvXCIsIFwiR3JpZm9uaVwiLCBcIkdyaWxsb1wiLCBcIkdyaW1hbGRpXCIsIFwiR3Jvc3NpXCIsIFwiR3VhbHRpZXJpXCIsIFwiR3VhcmR1Y2NpXCIsIFwiR3Vhcmlub1wiLCBcIkd1YXJuaWVyaVwiLCBcIkd1YXN0aVwiLCBcIkd1ZXJyYVwiLCBcIkd1ZXJyaVwiLCBcIkd1ZXJyaW5pXCIsIFwiR3VpZGlcIiwgXCJHdWlkb3R0aVwiLCBcIkhlXCIsIFwiSG94aGFcIiwgXCJIdVwiLCBcIkh1YW5nXCIsIFwiSWFuZGVsbGlcIiwgXCJJZ25lc3RpXCIsIFwiSW5ub2NlbnRpXCIsIFwiSmluXCIsIFwiTGEgUm9zYVwiLCBcIkxhaVwiLCBcIkxhbmRpXCIsIFwiTGFuZGluaVwiLCBcIkxhbmluaVwiLCBcIkxhcGlcIiwgXCJMYXBpbmlcIiwgXCJMYXJpXCIsIFwiTGFzY2lhbGZhcmlcIiwgXCJMYXN0cnVjY2lcIiwgXCJMYXRpbmlcIiwgXCJMYXp6ZXJpXCIsIFwiTGF6emVyaW5pXCIsIFwiTGVsbGlcIiwgXCJMZW56aVwiLCBcIkxlb25hcmRpXCIsIFwiTGVvbmNpbmlcIiwgXCJMZW9uZVwiLCBcIkxlb25pXCIsIFwiTGVwcmlcIiwgXCJMaVwiLCBcIkxpYW9cIiwgXCJMaW5cIiwgXCJMaW5hcmlcIiwgXCJMaXBwaVwiLCBcIkxpc2lcIiwgXCJMaXZpXCIsIFwiTG9tYmFyZGlcIiwgXCJMb21iYXJkaW5pXCIsIFwiTG9tYmFyZG9cIiwgXCJMb25nb1wiLCBcIkxvcGV6XCIsIFwiTG9yZW56aVwiLCBcIkxvcmVuemluaVwiLCBcIkxvcmluaVwiLCBcIkxvdHRpXCIsIFwiTHVcIiwgXCJMdWNjaGVzaVwiLCBcIkx1Y2hlcmluaVwiLCBcIkx1bmdoaVwiLCBcIkx1cGlcIiwgXCJNYWRpYWlcIiwgXCJNYWVzdHJpbmlcIiwgXCJNYWZmZWlcIiwgXCJNYWdnaVwiLCBcIk1hZ2dpbmlcIiwgXCJNYWdoZXJpbmlcIiwgXCJNYWdpbmlcIiwgXCJNYWduYW5pXCIsIFwiTWFnbmVsbGlcIiwgXCJNYWduaVwiLCBcIk1hZ25vbGZpXCIsIFwiTWFncmluaVwiLCBcIk1hbGF2b2x0aVwiLCBcIk1hbGV2b2x0aVwiLCBcIk1hbmNhXCIsIFwiTWFuY2luaVwiLCBcIk1hbmV0dGlcIiwgXCJNYW5mcmVkaVwiLCBcIk1hbmdhbmlcIiwgXCJNYW5uZWxsaVwiLCBcIk1hbm5pXCIsIFwiTWFubmluaVwiLCBcIk1hbm51Y2NpXCIsIFwiTWFudWVsbGlcIiwgXCJNYW56aW5pXCIsIFwiTWFyY2VsbGlcIiwgXCJNYXJjaGVzZVwiLCBcIk1hcmNoZXR0aVwiLCBcIk1hcmNoaVwiLCBcIk1hcmNoaWFuaVwiLCBcIk1hcmNoaW9ubmlcIiwgXCJNYXJjb25pXCIsIFwiTWFyY3VjY2lcIiwgXCJNYXJnaGVyaVwiLCBcIk1hcmlcIiwgXCJNYXJpYW5pXCIsIFwiTWFyaWxsaVwiLCBcIk1hcmluYWlcIiwgXCJNYXJpbmFyaVwiLCBcIk1hcmluZWxsaVwiLCBcIk1hcmluaVwiLCBcIk1hcmlub1wiLCBcIk1hcmlvdHRpXCIsIFwiTWFyc2lsaVwiLCBcIk1hcnRlbGxpXCIsIFwiTWFydGluZWxsaVwiLCBcIk1hcnRpbmlcIiwgXCJNYXJ0aW5vXCIsIFwiTWFyemlcIiwgXCJNYXNpXCIsIFwiTWFzaW5pXCIsIFwiTWFzb25pXCIsIFwiTWFzc2FpXCIsIFwiTWF0ZXJhc3NpXCIsIFwiTWF0dGVpXCIsIFwiTWF0dGVpbmlcIiwgXCJNYXR0ZXVjY2lcIiwgXCJNYXR0ZXV6emlcIiwgXCJNYXR0aW9saVwiLCBcIk1hdHRvbGluaVwiLCBcIk1hdHVjY2lcIiwgXCJNYXVyb1wiLCBcIk1henphbnRpXCIsIFwiTWF6emVpXCIsIFwiTWF6emV0dGlcIiwgXCJNYXp6aVwiLCBcIk1henppbmlcIiwgXCJNYXp6b2NjaGlcIiwgXCJNYXp6b2xpXCIsIFwiTWF6em9uaVwiLCBcIk1henp1b2xpXCIsIFwiTWVhY2NpXCIsIFwiTWVjb2NjaVwiLCBcIk1laW5pXCIsIFwiTWVsYW5pXCIsIFwiTWVsZVwiLCBcIk1lbGlcIiwgXCJNZW5nb25pXCIsIFwiTWVuaWNoZXR0aVwiLCBcIk1lb25pXCIsIFwiTWVybGluaVwiLCBcIk1lc3NlcmlcIiwgXCJNZXNzaW5hXCIsIFwiTWV1Y2NpXCIsIFwiTWljY2luZXNpXCIsIFwiTWljZWxpXCIsIFwiTWljaGVsaVwiLCBcIk1pY2hlbGluaVwiLCBcIk1pY2hlbG96emlcIiwgXCJNaWdsaW9yaVwiLCBcIk1pZ2xpb3JpbmlcIiwgXCJNaWxhbmlcIiwgXCJNaW5pYXRpXCIsIFwiTWlzdXJpXCIsIFwiTW9uYWNvXCIsIFwiTW9udGFnbmFuaVwiLCBcIk1vbnRhZ25pXCIsIFwiTW9udGFuYXJpXCIsIFwiTW9udGVsYXRpY2lcIiwgXCJNb250aVwiLCBcIk1vbnRpZ2lhbmlcIiwgXCJNb250aW5pXCIsIFwiTW9yYW5kaVwiLCBcIk1vcmFuZGluaVwiLCBcIk1vcmVsbGlcIiwgXCJNb3JldHRpXCIsIFwiTW9yZ2FudGlcIiwgXCJNb3JpXCIsIFwiTW9yaW5pXCIsIFwiTW9yb25pXCIsIFwiTW9yb3p6aVwiLCBcIk11Z25haVwiLCBcIk11Z25haW5pXCIsIFwiTXVzdGFmYVwiLCBcIk5hbGRpXCIsIFwiTmFsZGluaVwiLCBcIk5hbm5lbGxpXCIsIFwiTmFubmlcIiwgXCJOYW5uaW5pXCIsIFwiTmFubnVjY2lcIiwgXCJOYXJkaVwiLCBcIk5hcmRpbmlcIiwgXCJOYXJkb25pXCIsIFwiTmF0YWxpXCIsIFwiTmRpYXllXCIsIFwiTmVuY2V0dGlcIiwgXCJOZW5jaW5pXCIsIFwiTmVuY2lvbmlcIiwgXCJOZXJpXCIsIFwiTmVzaVwiLCBcIk5lc3RpXCIsIFwiTmljY29sYWlcIiwgXCJOaWNjb2xpXCIsIFwiTmljY29saW5pXCIsIFwiTmlnaVwiLCBcIk5pc3RyaVwiLCBcIk5vY2VudGluaVwiLCBcIk5vZmVyaW5pXCIsIFwiTm92ZWxsaVwiLCBcIk51Y2NpXCIsIFwiTnV0aVwiLCBcIk51dGluaVwiLCBcIk9saXZhXCIsIFwiT2xpdmllcmlcIiwgXCJPbG1pXCIsIFwiT3JsYW5kaVwiLCBcIk9ybGFuZGluaVwiLCBcIk9ybGFuZG9cIiwgXCJPcnNpbmlcIiwgXCJPcnRvbGFuaVwiLCBcIk90dGFuZWxsaVwiLCBcIlBhY2NpYW5pXCIsIFwiUGFjZVwiLCBcIlBhY2lcIiwgXCJQYWNpbmlcIiwgXCJQYWdhbmlcIiwgXCJQYWdhbm9cIiwgXCJQYWdnZXR0aVwiLCBcIlBhZ2xpYWlcIiwgXCJQYWduaVwiLCBcIlBhZ25pbmlcIiwgXCJQYWxhZGluaVwiLCBcIlBhbGFnaVwiLCBcIlBhbGNoZXR0aVwiLCBcIlBhbGxvbmlcIiwgXCJQYWxtaWVyaVwiLCBcIlBhbHVtYm9cIiwgXCJQYW1wYWxvbmlcIiwgXCJQYW5jYW5pXCIsIFwiUGFuZG9sZmlcIiwgXCJQYW5kb2xmaW5pXCIsIFwiUGFuZXJhaVwiLCBcIlBhbmljaGlcIiwgXCJQYW9sZXR0aVwiLCBcIlBhb2xpXCIsIFwiUGFvbGluaVwiLCBcIlBhcGlcIiwgXCJQYXBpbmlcIiwgXCJQYXB1Y2NpXCIsIFwiUGFyZW50aVwiLCBcIlBhcmlnaVwiLCBcIlBhcmlzaVwiLCBcIlBhcnJpXCIsIFwiUGFycmluaVwiLCBcIlBhc3F1aW5pXCIsIFwiUGFzc2VyaVwiLCBcIlBlY2NoaW9saVwiLCBcIlBlY29yaW5pXCIsIFwiUGVsbGVncmluaVwiLCBcIlBlcGlcIiwgXCJQZXJpbmlcIiwgXCJQZXJyb25lXCIsIFwiUGVydXp6aVwiLCBcIlBlc2NpXCIsIFwiUGVzdGVsbGlcIiwgXCJQZXRyaVwiLCBcIlBldHJpbmlcIiwgXCJQZXRydWNjaVwiLCBcIlBldHRpbmlcIiwgXCJQZXp6YXRpXCIsIFwiUGV6emF0aW5pXCIsIFwiUGlhbmlcIiwgXCJQaWF6emFcIiwgXCJQaWF6emVzaVwiLCBcIlBpYXp6aW5pXCIsIFwiUGljY2FyZGlcIiwgXCJQaWNjaGlcIiwgXCJQaWNjaW5pXCIsIFwiUGljY2lvbGlcIiwgXCJQaWVyYWNjaW5pXCIsIFwiUGllcmFjY2lvbmlcIiwgXCJQaWVyYWxsaVwiLCBcIlBpZXJhdHRpbmlcIiwgXCJQaWVyaVwiLCBcIlBpZXJpbmlcIiwgXCJQaWVyb25pXCIsIFwiUGlldHJpbmlcIiwgXCJQaW5pXCIsIFwiUGlubmFcIiwgXCJQaW50b1wiLCBcIlBpbnphbmlcIiwgXCJQaW56YXV0aVwiLCBcIlBpcmFzXCIsIFwiUGlzYW5pXCIsIFwiUGlzdG9sZXNpXCIsIFwiUG9nZ2VzaVwiLCBcIlBvZ2dpXCIsIFwiUG9nZ2lhbGlcIiwgXCJQb2dnaW9saW5pXCIsIFwiUG9saVwiLCBcIlBvbGxhc3RyaVwiLCBcIlBvcmNpYW5pXCIsIFwiUG96emlcIiwgXCJQcmF0ZWxsZXNpXCIsIFwiUHJhdGVzaVwiLCBcIlByb3NwZXJpXCIsIFwiUHJ1bmV0aVwiLCBcIlB1Y2NpXCIsIFwiUHVjY2luaVwiLCBcIlB1Y2Npb25pXCIsIFwiUHVnaVwiLCBcIlB1Z2xpZXNlXCIsIFwiUHVsaXRpXCIsIFwiUXVlcmNpXCIsIFwiUXVlcmNpb2xpXCIsIFwiUmFkZGlcIiwgXCJSYWR1XCIsIFwiUmFmZmFlbGxpXCIsIFwiUmFnYXp6aW5pXCIsIFwiUmFuZmFnbmlcIiwgXCJSYW5pZXJpXCIsIFwiUmFzdHJlbGxpXCIsIFwiUmF1Z2VpXCIsIFwiUmF2ZWdnaVwiLCBcIlJlbmFpXCIsIFwiUmVuemlcIiwgXCJSZXR0b3JpXCIsIFwiUmljY2lcIiwgXCJSaWNjaWFyZGlcIiwgXCJSaWRpXCIsIFwiUmlkb2xmaVwiLCBcIlJpZ2FjY2lcIiwgXCJSaWdoaVwiLCBcIlJpZ2hpbmlcIiwgXCJSaW5hbGRpXCIsIFwiUmlzYWxpdGlcIiwgXCJSaXN0b3JpXCIsIFwiUml6em9cIiwgXCJSb2NjaGlcIiwgXCJSb2NjaGluaVwiLCBcIlJvZ2FpXCIsIFwiUm9tYWdub2xpXCIsIFwiUm9tYW5lbGxpXCIsIFwiUm9tYW5pXCIsIFwiUm9tYW5vXCIsIFwiUm9tZWlcIiwgXCJSb21lb1wiLCBcIlJvbWl0aVwiLCBcIlJvbW9saVwiLCBcIlJvbW9saW5pXCIsIFwiUm9udGluaVwiLCBcIlJvc2F0aVwiLCBcIlJvc2VsbGlcIiwgXCJSb3NpXCIsIFwiUm9zc2V0dGlcIiwgXCJSb3NzaVwiLCBcIlJvc3NpbmlcIiwgXCJSb3ZhaVwiLCBcIlJ1Z2dlcmlcIiwgXCJSdWdnaWVyb1wiLCBcIlJ1c3NvXCIsIFwiU2FiYXRpbmlcIiwgXCJTYWNjYXJkaVwiLCBcIlNhY2NoZXR0aVwiLCBcIlNhY2NoaVwiLCBcIlNhY2NvXCIsIFwiU2FsZXJub1wiLCBcIlNhbGltYmVuaVwiLCBcIlNhbHVjY2lcIiwgXCJTYWx2YWRvcmlcIiwgXCJTYWx2ZXN0cmluaVwiLCBcIlNhbHZpXCIsIFwiU2FsdmluaVwiLCBcIlNhbmVzaVwiLCBcIlNhbmlcIiwgXCJTYW5uYVwiLCBcIlNhbnRpXCIsIFwiU2FudGluaVwiLCBcIlNhbnRvbmlcIiwgXCJTYW50b3JvXCIsIFwiU2FudHVjY2lcIiwgXCJTYXJkaVwiLCBcIlNhcnJpXCIsIFwiU2FydGlcIiwgXCJTYXNzaVwiLCBcIlNib2xjaVwiLCBcIlNjYWxpXCIsIFwiU2NhcnBlbGxpXCIsIFwiU2NhcnNlbGxpXCIsIFwiU2NvcGV0YW5pXCIsIFwiU2VjY2lcIiwgXCJTZWx2aVwiLCBcIlNlbmF0b3JpXCIsIFwiU2VuZXNpXCIsIFwiU2VyYWZpbmlcIiwgXCJTZXJlbmlcIiwgXCJTZXJyYVwiLCBcIlNlc3RpbmlcIiwgXCJTZ3VhbmNpXCIsIFwiU2llbmlcIiwgXCJTaWdub3JpbmlcIiwgXCJTaWx2ZXN0cmlcIiwgXCJTaW1vbmNpbmlcIiwgXCJTaW1vbmV0dGlcIiwgXCJTaW1vbmlcIiwgXCJTaW5naFwiLCBcIlNvZGlcIiwgXCJTb2xkaVwiLCBcIlNvbWlnbGlcIiwgXCJTb3JiaVwiLCBcIlNvcmVsbGlcIiwgXCJTb3JyZW50aW5vXCIsIFwiU290dGlsaVwiLCBcIlNwaW5hXCIsIFwiU3BpbmVsbGlcIiwgXCJTdGFjY2lvbGlcIiwgXCJTdGFkZXJpbmlcIiwgXCJTdGVmYW5lbGxpXCIsIFwiU3RlZmFuaVwiLCBcIlN0ZWZhbmluaVwiLCBcIlN0ZWxsYVwiLCBcIlN1c2luaVwiLCBcIlRhY2NoaVwiLCBcIlRhY2NvbmlcIiwgXCJUYWRkZWlcIiwgXCJUYWdsaWFmZXJyaVwiLCBcIlRhbWJ1cmluaVwiLCBcIlRhbmdhbmVsbGlcIiwgXCJUYW5pXCIsIFwiVGFuaW5pXCIsIFwiVGFwaW5hc3NpXCIsIFwiVGFyY2hpXCIsIFwiVGFyY2hpYW5pXCIsIFwiVGFyZ2lvbmlcIiwgXCJUYXNzaVwiLCBcIlRhc3NpbmlcIiwgXCJUZW1wZXN0aVwiLCBcIlRlcnphbmlcIiwgXCJUZXNpXCIsIFwiVGVzdGFcIiwgXCJUZXN0aVwiLCBcIlRpbGxpXCIsIFwiVGludGlcIiwgXCJUaXJpbm5hbnppXCIsIFwiVG9jY2Fmb25kaVwiLCBcIlRvZmFuYXJpXCIsIFwiVG9mYW5pXCIsIFwiVG9nbmFjY2luaVwiLCBcIlRvbmVsbGlcIiwgXCJUb25pbmlcIiwgXCJUb3JlbGxpXCIsIFwiVG9ycmluaVwiLCBcIlRvc2lcIiwgXCJUb3RpXCIsIFwiVG96emlcIiwgXCJUcmFtYnVzdGlcIiwgXCJUcmFwYW5pXCIsIFwiVHVjY2lcIiwgXCJUdXJjaGlcIiwgXCJVZ29saW5pXCIsIFwiVWxpdmlcIiwgXCJWYWxlbnRlXCIsIFwiVmFsZW50aVwiLCBcIlZhbGVudGluaVwiLCBcIlZhbmdlbGlzdGlcIiwgXCJWYW5uaVwiLCBcIlZhbm5pbmlcIiwgXCJWYW5ub25pXCIsIFwiVmFubm96emlcIiwgXCJWYW5udWNjaGlcIiwgXCJWYW5udWNjaVwiLCBcIlZlbnR1cmFcIiwgXCJWZW50dXJpXCIsIFwiVmVudHVyaW5pXCIsIFwiVmVzdHJpXCIsIFwiVmV0dG9yaVwiLCBcIlZpY2hpXCIsIFwiVmljaWFuaVwiLCBcIlZpZXJpXCIsIFwiVmlnaWFuaVwiLCBcIlZpZ25vbGlcIiwgXCJWaWdub2xpbmlcIiwgXCJWaWdub3p6aVwiLCBcIlZpbGxhbmlcIiwgXCJWaW5jaVwiLCBcIlZpc2FuaVwiLCBcIlZpdGFsZVwiLCBcIlZpdGFsaVwiLCBcIlZpdGlcIiwgXCJWaXZpYW5pXCIsIFwiVml2b2xpXCIsIFwiVm9scGVcIiwgXCJWb2xwaVwiLCBcIldhbmdcIiwgXCJXdVwiLCBcIlh1XCIsIFwiWWFuZ1wiLCBcIlllXCIsIFwiWmFnbGlcIiwgXCJaYW5pXCIsIFwiWmFuaWVyaVwiLCBcIlphbm9iaW5pXCIsIFwiWmVjY2hpXCIsIFwiWmV0dGlcIiwgXCJaaGFuZ1wiLCBcIlpoZW5nXCIsIFwiWmhvdVwiLCBcIlpodVwiLCBcIlppbmdvbmlcIiwgXCJaaW5pXCIsIFwiWm9wcGlcIl1cbiAgICAgICAgfSxcblxuICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3VtcGlyc2t5L2NvdW50cnktbGlzdC9ibG9iL21hc3Rlci9kYXRhL2VuX1VTL2NvdW50cnkuanNvblxuICAgICAgICBjb3VudHJpZXM6IFt7XCJuYW1lXCI6XCJBZmdoYW5pc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJBRlwifSx7XCJuYW1lXCI6XCLDhWxhbmQgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJBWFwifSx7XCJuYW1lXCI6XCJBbGJhbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFMXCJ9LHtcIm5hbWVcIjpcIkFsZ2VyaWFcIixcImFiYnJldmlhdGlvblwiOlwiRFpcIn0se1wibmFtZVwiOlwiQW1lcmljYW4gU2Ftb2FcIixcImFiYnJldmlhdGlvblwiOlwiQVNcIn0se1wibmFtZVwiOlwiQW5kb3JyYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBRFwifSx7XCJuYW1lXCI6XCJBbmdvbGFcIixcImFiYnJldmlhdGlvblwiOlwiQU9cIn0se1wibmFtZVwiOlwiQW5ndWlsbGFcIixcImFiYnJldmlhdGlvblwiOlwiQUlcIn0se1wibmFtZVwiOlwiQW50YXJjdGljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBUVwifSx7XCJuYW1lXCI6XCJBbnRpZ3VhICYgQmFyYnVkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBR1wifSx7XCJuYW1lXCI6XCJBcmdlbnRpbmFcIixcImFiYnJldmlhdGlvblwiOlwiQVJcIn0se1wibmFtZVwiOlwiQXJtZW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBTVwifSx7XCJuYW1lXCI6XCJBcnViYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBV1wifSx7XCJuYW1lXCI6XCJBc2NlbnNpb24gSXNsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFDXCJ9LHtcIm5hbWVcIjpcIkF1c3RyYWxpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBVVwifSx7XCJuYW1lXCI6XCJBdXN0cmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFUXCJ9LHtcIm5hbWVcIjpcIkF6ZXJiYWlqYW5cIixcImFiYnJldmlhdGlvblwiOlwiQVpcIn0se1wibmFtZVwiOlwiQmFoYW1hc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCU1wifSx7XCJuYW1lXCI6XCJCYWhyYWluXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJIXCJ9LHtcIm5hbWVcIjpcIkJhbmdsYWRlc2hcIixcImFiYnJldmlhdGlvblwiOlwiQkRcIn0se1wibmFtZVwiOlwiQmFyYmFkb3NcIixcImFiYnJldmlhdGlvblwiOlwiQkJcIn0se1wibmFtZVwiOlwiQmVsYXJ1c1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCWVwifSx7XCJuYW1lXCI6XCJCZWxnaXVtXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJFXCJ9LHtcIm5hbWVcIjpcIkJlbGl6ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCWlwifSx7XCJuYW1lXCI6XCJCZW5pblwiLFwiYWJicmV2aWF0aW9uXCI6XCJCSlwifSx7XCJuYW1lXCI6XCJCZXJtdWRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJNXCJ9LHtcIm5hbWVcIjpcIkJodXRhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJCVFwifSx7XCJuYW1lXCI6XCJCb2xpdmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJPXCJ9LHtcIm5hbWVcIjpcIkJvc25pYSAmIEhlcnplZ292aW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJBXCJ9LHtcIm5hbWVcIjpcIkJvdHN3YW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJXXCJ9LHtcIm5hbWVcIjpcIkJyYXppbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJCUlwifSx7XCJuYW1lXCI6XCJCcml0aXNoIEluZGlhbiBPY2VhbiBUZXJyaXRvcnlcIixcImFiYnJldmlhdGlvblwiOlwiSU9cIn0se1wibmFtZVwiOlwiQnJpdGlzaCBWaXJnaW4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJWR1wifSx7XCJuYW1lXCI6XCJCcnVuZWlcIixcImFiYnJldmlhdGlvblwiOlwiQk5cIn0se1wibmFtZVwiOlwiQnVsZ2FyaWFcIixcImFiYnJldmlhdGlvblwiOlwiQkdcIn0se1wibmFtZVwiOlwiQnVya2luYSBGYXNvXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJGXCJ9LHtcIm5hbWVcIjpcIkJ1cnVuZGlcIixcImFiYnJldmlhdGlvblwiOlwiQklcIn0se1wibmFtZVwiOlwiQ2FtYm9kaWFcIixcImFiYnJldmlhdGlvblwiOlwiS0hcIn0se1wibmFtZVwiOlwiQ2FtZXJvb25cIixcImFiYnJldmlhdGlvblwiOlwiQ01cIn0se1wibmFtZVwiOlwiQ2FuYWRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNBXCJ9LHtcIm5hbWVcIjpcIkNhbmFyeSBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIklDXCJ9LHtcIm5hbWVcIjpcIkNhcGUgVmVyZGVcIixcImFiYnJldmlhdGlvblwiOlwiQ1ZcIn0se1wibmFtZVwiOlwiQ2FyaWJiZWFuIE5ldGhlcmxhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJRXCJ9LHtcIm5hbWVcIjpcIkNheW1hbiBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIktZXCJ9LHtcIm5hbWVcIjpcIkNlbnRyYWwgQWZyaWNhbiBSZXB1YmxpY1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDRlwifSx7XCJuYW1lXCI6XCJDZXV0YSAmIE1lbGlsbGFcIixcImFiYnJldmlhdGlvblwiOlwiRUFcIn0se1wibmFtZVwiOlwiQ2hhZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJURFwifSx7XCJuYW1lXCI6XCJDaGlsZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDTFwifSx7XCJuYW1lXCI6XCJDaGluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDTlwifSx7XCJuYW1lXCI6XCJDaHJpc3RtYXMgSXNsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNYXCJ9LHtcIm5hbWVcIjpcIkNvY29zIChLZWVsaW5nKSBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNDXCJ9LHtcIm5hbWVcIjpcIkNvbG9tYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNPXCJ9LHtcIm5hbWVcIjpcIkNvbW9yb3NcIixcImFiYnJldmlhdGlvblwiOlwiS01cIn0se1wibmFtZVwiOlwiQ29uZ28gLSBCcmF6emF2aWxsZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDR1wifSx7XCJuYW1lXCI6XCJDb25nbyAtIEtpbnNoYXNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNEXCJ9LHtcIm5hbWVcIjpcIkNvb2sgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDS1wifSx7XCJuYW1lXCI6XCJDb3N0YSBSaWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNSXCJ9LHtcIm5hbWVcIjpcIkPDtHRlIGQnSXZvaXJlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNJXCJ9LHtcIm5hbWVcIjpcIkNyb2F0aWFcIixcImFiYnJldmlhdGlvblwiOlwiSFJcIn0se1wibmFtZVwiOlwiQ3ViYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDVVwifSx7XCJuYW1lXCI6XCJDdXJhw6dhb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDV1wifSx7XCJuYW1lXCI6XCJDeXBydXNcIixcImFiYnJldmlhdGlvblwiOlwiQ1lcIn0se1wibmFtZVwiOlwiQ3plY2ggUmVwdWJsaWNcIixcImFiYnJldmlhdGlvblwiOlwiQ1pcIn0se1wibmFtZVwiOlwiRGVubWFya1wiLFwiYWJicmV2aWF0aW9uXCI6XCJES1wifSx7XCJuYW1lXCI6XCJEaWVnbyBHYXJjaWFcIixcImFiYnJldmlhdGlvblwiOlwiREdcIn0se1wibmFtZVwiOlwiRGppYm91dGlcIixcImFiYnJldmlhdGlvblwiOlwiREpcIn0se1wibmFtZVwiOlwiRG9taW5pY2FcIixcImFiYnJldmlhdGlvblwiOlwiRE1cIn0se1wibmFtZVwiOlwiRG9taW5pY2FuIFJlcHVibGljXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRPXCJ9LHtcIm5hbWVcIjpcIkVjdWFkb3JcIixcImFiYnJldmlhdGlvblwiOlwiRUNcIn0se1wibmFtZVwiOlwiRWd5cHRcIixcImFiYnJldmlhdGlvblwiOlwiRUdcIn0se1wibmFtZVwiOlwiRWwgU2FsdmFkb3JcIixcImFiYnJldmlhdGlvblwiOlwiU1ZcIn0se1wibmFtZVwiOlwiRXF1YXRvcmlhbCBHdWluZWFcIixcImFiYnJldmlhdGlvblwiOlwiR1FcIn0se1wibmFtZVwiOlwiRXJpdHJlYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFUlwifSx7XCJuYW1lXCI6XCJFc3RvbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVFXCJ9LHtcIm5hbWVcIjpcIkV0aGlvcGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVUXCJ9LHtcIm5hbWVcIjpcIkZhbGtsYW5kIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiRktcIn0se1wibmFtZVwiOlwiRmFyb2UgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJGT1wifSx7XCJuYW1lXCI6XCJGaWppXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZKXCJ9LHtcIm5hbWVcIjpcIkZpbmxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiRklcIn0se1wibmFtZVwiOlwiRnJhbmNlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZSXCJ9LHtcIm5hbWVcIjpcIkZyZW5jaCBHdWlhbmFcIixcImFiYnJldmlhdGlvblwiOlwiR0ZcIn0se1wibmFtZVwiOlwiRnJlbmNoIFBvbHluZXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQRlwifSx7XCJuYW1lXCI6XCJGcmVuY2ggU291dGhlcm4gVGVycml0b3JpZXNcIixcImFiYnJldmlhdGlvblwiOlwiVEZcIn0se1wibmFtZVwiOlwiR2Fib25cIixcImFiYnJldmlhdGlvblwiOlwiR0FcIn0se1wibmFtZVwiOlwiR2FtYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdNXCJ9LHtcIm5hbWVcIjpcIkdlb3JnaWFcIixcImFiYnJldmlhdGlvblwiOlwiR0VcIn0se1wibmFtZVwiOlwiR2VybWFueVwiLFwiYWJicmV2aWF0aW9uXCI6XCJERVwifSx7XCJuYW1lXCI6XCJHaGFuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHSFwifSx7XCJuYW1lXCI6XCJHaWJyYWx0YXJcIixcImFiYnJldmlhdGlvblwiOlwiR0lcIn0se1wibmFtZVwiOlwiR3JlZWNlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdSXCJ9LHtcIm5hbWVcIjpcIkdyZWVubGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJHTFwifSx7XCJuYW1lXCI6XCJHcmVuYWRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdEXCJ9LHtcIm5hbWVcIjpcIkd1YWRlbG91cGVcIixcImFiYnJldmlhdGlvblwiOlwiR1BcIn0se1wibmFtZVwiOlwiR3VhbVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHVVwifSx7XCJuYW1lXCI6XCJHdWF0ZW1hbGFcIixcImFiYnJldmlhdGlvblwiOlwiR1RcIn0se1wibmFtZVwiOlwiR3Vlcm5zZXlcIixcImFiYnJldmlhdGlvblwiOlwiR0dcIn0se1wibmFtZVwiOlwiR3VpbmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdOXCJ9LHtcIm5hbWVcIjpcIkd1aW5lYS1CaXNzYXVcIixcImFiYnJldmlhdGlvblwiOlwiR1dcIn0se1wibmFtZVwiOlwiR3V5YW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdZXCJ9LHtcIm5hbWVcIjpcIkhhaXRpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkhUXCJ9LHtcIm5hbWVcIjpcIkhvbmR1cmFzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkhOXCJ9LHtcIm5hbWVcIjpcIkhvbmcgS29uZyBTQVIgQ2hpbmFcIixcImFiYnJldmlhdGlvblwiOlwiSEtcIn0se1wibmFtZVwiOlwiSHVuZ2FyeVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIVVwifSx7XCJuYW1lXCI6XCJJY2VsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIklTXCJ9LHtcIm5hbWVcIjpcIkluZGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIklOXCJ9LHtcIm5hbWVcIjpcIkluZG9uZXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJRFwifSx7XCJuYW1lXCI6XCJJcmFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIklSXCJ9LHtcIm5hbWVcIjpcIklyYXFcIixcImFiYnJldmlhdGlvblwiOlwiSVFcIn0se1wibmFtZVwiOlwiSXJlbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJJRVwifSx7XCJuYW1lXCI6XCJJc2xlIG9mIE1hblwiLFwiYWJicmV2aWF0aW9uXCI6XCJJTVwifSx7XCJuYW1lXCI6XCJJc3JhZWxcIixcImFiYnJldmlhdGlvblwiOlwiSUxcIn0se1wibmFtZVwiOlwiSXRhbHlcIixcImFiYnJldmlhdGlvblwiOlwiSVRcIn0se1wibmFtZVwiOlwiSmFtYWljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJKTVwifSx7XCJuYW1lXCI6XCJKYXBhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJKUFwifSx7XCJuYW1lXCI6XCJKZXJzZXlcIixcImFiYnJldmlhdGlvblwiOlwiSkVcIn0se1wibmFtZVwiOlwiSm9yZGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpPXCJ9LHtcIm5hbWVcIjpcIkthemFraHN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiS1pcIn0se1wibmFtZVwiOlwiS2VueWFcIixcImFiYnJldmlhdGlvblwiOlwiS0VcIn0se1wibmFtZVwiOlwiS2lyaWJhdGlcIixcImFiYnJldmlhdGlvblwiOlwiS0lcIn0se1wibmFtZVwiOlwiS29zb3ZvXCIsXCJhYmJyZXZpYXRpb25cIjpcIlhLXCJ9LHtcIm5hbWVcIjpcIkt1d2FpdFwiLFwiYWJicmV2aWF0aW9uXCI6XCJLV1wifSx7XCJuYW1lXCI6XCJLeXJneXpzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIktHXCJ9LHtcIm5hbWVcIjpcIkxhb3NcIixcImFiYnJldmlhdGlvblwiOlwiTEFcIn0se1wibmFtZVwiOlwiTGF0dmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxWXCJ9LHtcIm5hbWVcIjpcIkxlYmFub25cIixcImFiYnJldmlhdGlvblwiOlwiTEJcIn0se1wibmFtZVwiOlwiTGVzb3Rob1wiLFwiYWJicmV2aWF0aW9uXCI6XCJMU1wifSx7XCJuYW1lXCI6XCJMaWJlcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxSXCJ9LHtcIm5hbWVcIjpcIkxpYnlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxZXCJ9LHtcIm5hbWVcIjpcIkxpZWNodGVuc3RlaW5cIixcImFiYnJldmlhdGlvblwiOlwiTElcIn0se1wibmFtZVwiOlwiTGl0aHVhbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxUXCJ9LHtcIm5hbWVcIjpcIkx1eGVtYm91cmdcIixcImFiYnJldmlhdGlvblwiOlwiTFVcIn0se1wibmFtZVwiOlwiTWFjYXUgU0FSIENoaW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1PXCJ9LHtcIm5hbWVcIjpcIk1hY2Vkb25pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNS1wifSx7XCJuYW1lXCI6XCJNYWRhZ2FzY2FyXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1HXCJ9LHtcIm5hbWVcIjpcIk1hbGF3aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNV1wifSx7XCJuYW1lXCI6XCJNYWxheXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNWVwifSx7XCJuYW1lXCI6XCJNYWxkaXZlc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNVlwifSx7XCJuYW1lXCI6XCJNYWxpXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1MXCJ9LHtcIm5hbWVcIjpcIk1hbHRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1UXCJ9LHtcIm5hbWVcIjpcIk1hcnNoYWxsIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiTUhcIn0se1wibmFtZVwiOlwiTWFydGluaXF1ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNUVwifSx7XCJuYW1lXCI6XCJNYXVyaXRhbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1SXCJ9LHtcIm5hbWVcIjpcIk1hdXJpdGl1c1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNVVwifSx7XCJuYW1lXCI6XCJNYXlvdHRlXCIsXCJhYmJyZXZpYXRpb25cIjpcIllUXCJ9LHtcIm5hbWVcIjpcIk1leGljb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNWFwifSx7XCJuYW1lXCI6XCJNaWNyb25lc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZNXCJ9LHtcIm5hbWVcIjpcIk1vbGRvdmFcIixcImFiYnJldmlhdGlvblwiOlwiTURcIn0se1wibmFtZVwiOlwiTW9uYWNvXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1DXCJ9LHtcIm5hbWVcIjpcIk1vbmdvbGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1OXCJ9LHtcIm5hbWVcIjpcIk1vbnRlbmVncm9cIixcImFiYnJldmlhdGlvblwiOlwiTUVcIn0se1wibmFtZVwiOlwiTW9udHNlcnJhdFwiLFwiYWJicmV2aWF0aW9uXCI6XCJNU1wifSx7XCJuYW1lXCI6XCJNb3JvY2NvXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1BXCJ9LHtcIm5hbWVcIjpcIk1vemFtYmlxdWVcIixcImFiYnJldmlhdGlvblwiOlwiTVpcIn0se1wibmFtZVwiOlwiTXlhbm1hciAoQnVybWEpXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1NXCJ9LHtcIm5hbWVcIjpcIk5hbWliaWFcIixcImFiYnJldmlhdGlvblwiOlwiTkFcIn0se1wibmFtZVwiOlwiTmF1cnVcIixcImFiYnJldmlhdGlvblwiOlwiTlJcIn0se1wibmFtZVwiOlwiTmVwYWxcIixcImFiYnJldmlhdGlvblwiOlwiTlBcIn0se1wibmFtZVwiOlwiTmV0aGVybGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiTkxcIn0se1wibmFtZVwiOlwiTmV3IENhbGVkb25pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOQ1wifSx7XCJuYW1lXCI6XCJOZXcgWmVhbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJOWlwifSx7XCJuYW1lXCI6XCJOaWNhcmFndWFcIixcImFiYnJldmlhdGlvblwiOlwiTklcIn0se1wibmFtZVwiOlwiTmlnZXJcIixcImFiYnJldmlhdGlvblwiOlwiTkVcIn0se1wibmFtZVwiOlwiTmlnZXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOR1wifSx7XCJuYW1lXCI6XCJOaXVlXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5VXCJ9LHtcIm5hbWVcIjpcIk5vcmZvbGsgSXNsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5GXCJ9LHtcIm5hbWVcIjpcIk5vcnRoIEtvcmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIktQXCJ9LHtcIm5hbWVcIjpcIk5vcnRoZXJuIE1hcmlhbmEgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNUFwifSx7XCJuYW1lXCI6XCJOb3J3YXlcIixcImFiYnJldmlhdGlvblwiOlwiTk9cIn0se1wibmFtZVwiOlwiT21hblwiLFwiYWJicmV2aWF0aW9uXCI6XCJPTVwifSx7XCJuYW1lXCI6XCJQYWtpc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJQS1wifSx7XCJuYW1lXCI6XCJQYWxhdVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQV1wifSx7XCJuYW1lXCI6XCJQYWxlc3RpbmlhbiBUZXJyaXRvcmllc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQU1wifSx7XCJuYW1lXCI6XCJQYW5hbWFcIixcImFiYnJldmlhdGlvblwiOlwiUEFcIn0se1wibmFtZVwiOlwiUGFwdWEgTmV3IEd1aW5lYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQR1wifSx7XCJuYW1lXCI6XCJQYXJhZ3VheVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQWVwifSx7XCJuYW1lXCI6XCJQZXJ1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlBFXCJ9LHtcIm5hbWVcIjpcIlBoaWxpcHBpbmVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBIXCJ9LHtcIm5hbWVcIjpcIlBpdGNhaXJuIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiUE5cIn0se1wibmFtZVwiOlwiUG9sYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBMXCJ9LHtcIm5hbWVcIjpcIlBvcnR1Z2FsXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBUXCJ9LHtcIm5hbWVcIjpcIlB1ZXJ0byBSaWNvXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBSXCJ9LHtcIm5hbWVcIjpcIlFhdGFyXCIsXCJhYmJyZXZpYXRpb25cIjpcIlFBXCJ9LHtcIm5hbWVcIjpcIlLDqXVuaW9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJFXCJ9LHtcIm5hbWVcIjpcIlJvbWFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiUk9cIn0se1wibmFtZVwiOlwiUnVzc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJVXCJ9LHtcIm5hbWVcIjpcIlJ3YW5kYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJSV1wifSx7XCJuYW1lXCI6XCJTYW1vYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJXU1wifSx7XCJuYW1lXCI6XCJTYW4gTWFyaW5vXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNNXCJ9LHtcIm5hbWVcIjpcIlPDo28gVG9tw6kgYW5kIFByw61uY2lwZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTVFwifSx7XCJuYW1lXCI6XCJTYXVkaSBBcmFiaWFcIixcImFiYnJldmlhdGlvblwiOlwiU0FcIn0se1wibmFtZVwiOlwiU2VuZWdhbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJTTlwifSx7XCJuYW1lXCI6XCJTZXJiaWFcIixcImFiYnJldmlhdGlvblwiOlwiUlNcIn0se1wibmFtZVwiOlwiU2V5Y2hlbGxlc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJTQ1wifSx7XCJuYW1lXCI6XCJTaWVycmEgTGVvbmVcIixcImFiYnJldmlhdGlvblwiOlwiU0xcIn0se1wibmFtZVwiOlwiU2luZ2Fwb3JlXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNHXCJ9LHtcIm5hbWVcIjpcIlNpbnQgTWFhcnRlblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTWFwifSx7XCJuYW1lXCI6XCJTbG92YWtpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTS1wifSx7XCJuYW1lXCI6XCJTbG92ZW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTSVwifSx7XCJuYW1lXCI6XCJTb2xvbW9uIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiU0JcIn0se1wibmFtZVwiOlwiU29tYWxpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTT1wifSx7XCJuYW1lXCI6XCJTb3V0aCBBZnJpY2FcIixcImFiYnJldmlhdGlvblwiOlwiWkFcIn0se1wibmFtZVwiOlwiU291dGggR2VvcmdpYSAmIFNvdXRoIFNhbmR3aWNoIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiR1NcIn0se1wibmFtZVwiOlwiU291dGggS29yZWFcIixcImFiYnJldmlhdGlvblwiOlwiS1JcIn0se1wibmFtZVwiOlwiU291dGggU3VkYW5cIixcImFiYnJldmlhdGlvblwiOlwiU1NcIn0se1wibmFtZVwiOlwiU3BhaW5cIixcImFiYnJldmlhdGlvblwiOlwiRVNcIn0se1wibmFtZVwiOlwiU3JpIExhbmthXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxLXCJ9LHtcIm5hbWVcIjpcIlN0LiBCYXJ0aMOpbGVteVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCTFwifSx7XCJuYW1lXCI6XCJTdC4gSGVsZW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNIXCJ9LHtcIm5hbWVcIjpcIlN0LiBLaXR0cyAmIE5ldmlzXCIsXCJhYmJyZXZpYXRpb25cIjpcIktOXCJ9LHtcIm5hbWVcIjpcIlN0LiBMdWNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMQ1wifSx7XCJuYW1lXCI6XCJTdC4gTWFydGluXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1GXCJ9LHtcIm5hbWVcIjpcIlN0LiBQaWVycmUgJiBNaXF1ZWxvblwiLFwiYWJicmV2aWF0aW9uXCI6XCJQTVwifSx7XCJuYW1lXCI6XCJTdC4gVmluY2VudCAmIEdyZW5hZGluZXNcIixcImFiYnJldmlhdGlvblwiOlwiVkNcIn0se1wibmFtZVwiOlwiU3VkYW5cIixcImFiYnJldmlhdGlvblwiOlwiU0RcIn0se1wibmFtZVwiOlwiU3VyaW5hbWVcIixcImFiYnJldmlhdGlvblwiOlwiU1JcIn0se1wibmFtZVwiOlwiU3ZhbGJhcmQgJiBKYW4gTWF5ZW5cIixcImFiYnJldmlhdGlvblwiOlwiU0pcIn0se1wibmFtZVwiOlwiU3dhemlsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNaXCJ9LHtcIm5hbWVcIjpcIlN3ZWRlblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTRVwifSx7XCJuYW1lXCI6XCJTd2l0emVybGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJDSFwifSx7XCJuYW1lXCI6XCJTeXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTWVwifSx7XCJuYW1lXCI6XCJUYWl3YW5cIixcImFiYnJldmlhdGlvblwiOlwiVFdcIn0se1wibmFtZVwiOlwiVGFqaWtpc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJUSlwifSx7XCJuYW1lXCI6XCJUYW56YW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUWlwifSx7XCJuYW1lXCI6XCJUaGFpbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJUSFwifSx7XCJuYW1lXCI6XCJUaW1vci1MZXN0ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUTFwifSx7XCJuYW1lXCI6XCJUb2dvXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRHXCJ9LHtcIm5hbWVcIjpcIlRva2VsYXVcIixcImFiYnJldmlhdGlvblwiOlwiVEtcIn0se1wibmFtZVwiOlwiVG9uZ2FcIixcImFiYnJldmlhdGlvblwiOlwiVE9cIn0se1wibmFtZVwiOlwiVHJpbmlkYWQgJiBUb2JhZ29cIixcImFiYnJldmlhdGlvblwiOlwiVFRcIn0se1wibmFtZVwiOlwiVHJpc3RhbiBkYSBDdW5oYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUQVwifSx7XCJuYW1lXCI6XCJUdW5pc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlROXCJ9LHtcIm5hbWVcIjpcIlR1cmtleVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUUlwifSx7XCJuYW1lXCI6XCJUdXJrbWVuaXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiVE1cIn0se1wibmFtZVwiOlwiVHVya3MgJiBDYWljb3MgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJUQ1wifSx7XCJuYW1lXCI6XCJUdXZhbHVcIixcImFiYnJldmlhdGlvblwiOlwiVFZcIn0se1wibmFtZVwiOlwiVS5TLiBPdXRseWluZyBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVNXCJ9LHtcIm5hbWVcIjpcIlUuUy4gVmlyZ2luIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiVklcIn0se1wibmFtZVwiOlwiVWdhbmRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVHXCJ9LHtcIm5hbWVcIjpcIlVrcmFpbmVcIixcImFiYnJldmlhdGlvblwiOlwiVUFcIn0se1wibmFtZVwiOlwiVW5pdGVkIEFyYWIgRW1pcmF0ZXNcIixcImFiYnJldmlhdGlvblwiOlwiQUVcIn0se1wibmFtZVwiOlwiVW5pdGVkIEtpbmdkb21cIixcImFiYnJldmlhdGlvblwiOlwiR0JcIn0se1wibmFtZVwiOlwiVW5pdGVkIFN0YXRlc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJVU1wifSx7XCJuYW1lXCI6XCJVcnVndWF5XCIsXCJhYmJyZXZpYXRpb25cIjpcIlVZXCJ9LHtcIm5hbWVcIjpcIlV6YmVraXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiVVpcIn0se1wibmFtZVwiOlwiVmFudWF0dVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWVVwifSx7XCJuYW1lXCI6XCJWYXRpY2FuIENpdHlcIixcImFiYnJldmlhdGlvblwiOlwiVkFcIn0se1wibmFtZVwiOlwiVmVuZXp1ZWxhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZFXCJ9LHtcIm5hbWVcIjpcIlZpZXRuYW1cIixcImFiYnJldmlhdGlvblwiOlwiVk5cIn0se1wibmFtZVwiOlwiV2FsbGlzICYgRnV0dW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIldGXCJ9LHtcIm5hbWVcIjpcIldlc3Rlcm4gU2FoYXJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVIXCJ9LHtcIm5hbWVcIjpcIlllbWVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIllFXCJ9LHtcIm5hbWVcIjpcIlphbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJaTVwifSx7XCJuYW1lXCI6XCJaaW1iYWJ3ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJaV1wifV0sXG5cblx0XHRjb3VudGllczoge1xuICAgICAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHA6Ly93d3cuZG93bmxvYWRleGNlbGZpbGVzLmNvbS9nYl9lbi9kb3dubG9hZC1leGNlbC1maWxlLWxpc3QtY291bnRpZXMtdWtcbiAgICAgICAgICAgIFwidWtcIjogW1xuICAgICAgICAgICAgICAgIHtuYW1lOiAnQmF0aCBhbmQgTm9ydGggRWFzdCBTb21lcnNldCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQWJlcmRlZW5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQW5nbGVzZXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0FuZ3VzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCZWRmb3JkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCbGFja2J1cm4gd2l0aCBEYXJ3ZW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JsYWNrcG9vbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQm91cm5lbW91dGgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JyYWNrbmVsbCBGb3Jlc3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JyaWdodG9uICYgSG92ZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQnJpc3RvbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQnVja2luZ2hhbXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDYW1icmlkZ2VzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2FybWFydGhlbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDZW50cmFsIEJlZGZvcmRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2VyZWRpZ2lvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2hlc2hpcmUgRWFzdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2hlc2hpcmUgV2VzdCBhbmQgQ2hlc3Rlcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2xhY2ttYW5uYW5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ29ud3knfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Nvcm53YWxsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgQW50cmltJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgQXJtYWdoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgRG93bid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IER1cmhhbSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IEZlcm1hbmFnaCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IExvbmRvbmRlcnJ5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3VudHkgVHlyb25lJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDdW1icmlhJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEYXJsaW5ndG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEZW5iaWdoc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RlcmJ5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEZXJieXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEZXZvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRG9yc2V0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEdW1mcmllcyBhbmQgR2FsbG93YXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0R1bmRlZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRWFzdCBMb3RoaWFuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFYXN0IFJpZGluZyBvZiBZb3Jrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Vhc3QgU3Vzc2V4J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFZGluYnVyZ2g/J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFc3NleCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRmFsa2lyayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRmlmZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRmxpbnRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR2xvdWNlc3RlcnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHcmVhdGVyIExvbmRvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3JlYXRlciBNYW5jaGVzdGVyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHd2VudCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3d5bmVkZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGFsdG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIYW1wc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hhcnRsZXBvb2wnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hlcmVmb3Jkc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hlcnRmb3Jkc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hpZ2hsYW5kcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSHVsbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSXNsZSBvZiBXaWdodCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSXNsZXMgb2YgU2NpbGx5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdLZW50J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMYW5jYXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMZWljZXN0ZXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xlaWNlc3RlcnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMaW5jb2xuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xvdGhpYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0x1dG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNZWR3YXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01lcnNleXNpZGUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01pZCBHbGFtb3JnYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01pZGRsZXNicm91Z2gnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01pbHRvbiBLZXluZXMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01vbm1vdXRoc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01vcmF5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3Jmb2xrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aCBFYXN0IExpbmNvbG5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggTGluY29sbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aCBTb21lcnNldCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggWW9ya3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aGFtcHRvbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3J0aHVtYmVybGFuZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm90dGluZ2hhbSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm90dGluZ2hhbXNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdPeGZvcmRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGVtYnJva2VzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGVydGggYW5kIEtpbnJvc3MnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BldGVyYm9yb3VnaCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGx5bW91dGgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Bvb2xlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQb3J0c21vdXRoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQb3d5cyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUmVhZGluZyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUmVkY2FyIGFuZCBDbGV2ZWxhbmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1J1dGxhbmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Njb3R0aXNoIEJvcmRlcnMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Nocm9wc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Nsb3VnaCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU29tZXJzZXQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvdXRoIEdsYW1vcmdhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU291dGggR2xvdWNlc3RlcnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb3V0aCBZb3Jrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvdXRoYW1wdG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb3V0aGVuZC1vbi1TZWEnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0YWZmb3Jkc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0aXJsaW5nc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0b2NrdG9uLW9uLVRlZXMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0b2tlLW9uLVRyZW50J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdHJhdGhjbHlkZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3VmZm9sayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3VycmV5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTd2luZG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUZWxmb3JkIGFuZCBXcmVraW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RodXJyb2NrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUb3JiYXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1R5bmUgYW5kIFdlYXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dhcnJpbmd0b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dhcndpY2tzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBCZXJrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgR2xhbW9yZ2FuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IExvdGhpYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgTWlkbGFuZHMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgU3Vzc2V4J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IFlvcmtzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdGVybiBJc2xlcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2lsdHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXaW5kc29yIGFuZCBNYWlkZW5oZWFkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXb2tpbmdoYW0nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dvcmNlc3RlcnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXcmV4aGFtJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdZb3JrJ31dXG5cdFx0XHRcdH0sXG4gICAgICAgIHByb3ZpbmNlczoge1xuICAgICAgICAgICAgXCJjYVwiOiBbXG4gICAgICAgICAgICAgICAge25hbWU6ICdBbGJlcnRhJywgYWJicmV2aWF0aW9uOiAnQUInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JyaXRpc2ggQ29sdW1iaWEnLCBhYmJyZXZpYXRpb246ICdCQyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWFuaXRvYmEnLCBhYmJyZXZpYXRpb246ICdNQid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTmV3IEJydW5zd2ljaycsIGFiYnJldmlhdGlvbjogJ05CJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOZXdmb3VuZGxhbmQgYW5kIExhYnJhZG9yJywgYWJicmV2aWF0aW9uOiAnTkwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vdmEgU2NvdGlhJywgYWJicmV2aWF0aW9uOiAnTlMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ09udGFyaW8nLCBhYmJyZXZpYXRpb246ICdPTid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUHJpbmNlIEVkd2FyZCBJc2xhbmQnLCBhYmJyZXZpYXRpb246ICdQRSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUXVlYmVjJywgYWJicmV2aWF0aW9uOiAnUUMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Nhc2thdGNoZXdhbicsIGFiYnJldmlhdGlvbjogJ1NLJ30sXG5cbiAgICAgICAgICAgICAgICAvLyBUaGUgY2FzZSBjb3VsZCBiZSBtYWRlIHRoYXQgdGhlIGZvbGxvd2luZyBhcmUgbm90IGFjdHVhbGx5IHByb3ZpbmNlc1xuICAgICAgICAgICAgICAgIC8vIHNpbmNlIHRoZXkgYXJlIHRlY2huaWNhbGx5IGNvbnNpZGVyZWQgXCJ0ZXJyaXRvcmllc1wiIGhvd2V2ZXIgdGhleSBhbGxcbiAgICAgICAgICAgICAgICAvLyBsb29rIHRoZSBzYW1lIG9uIGFuIGVudmVsb3BlIVxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGh3ZXN0IFRlcnJpdG9yaWVzJywgYWJicmV2aWF0aW9uOiAnTlQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ051bmF2dXQnLCBhYmJyZXZpYXRpb246ICdOVSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnWXVrb24nLCBhYmJyZXZpYXRpb246ICdZVCd9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgXCJpdFwiOiBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFncmlnZW50b1wiLCBhYmJyZXZpYXRpb246IFwiQUdcIiwgY29kZTogODQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQWxlc3NhbmRyaWFcIiwgYWJicmV2aWF0aW9uOiBcIkFMXCIsIGNvZGU6IDYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQW5jb25hXCIsIGFiYnJldmlhdGlvbjogXCJBTlwiLCBjb2RlOiA0MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBb3N0YVwiLCBhYmJyZXZpYXRpb246IFwiQU9cIiwgY29kZTogNyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMJ0FxdWlsYVwiLCBhYmJyZXZpYXRpb246IFwiQVFcIiwgY29kZTogNjYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQXJlenpvXCIsIGFiYnJldmlhdGlvbjogXCJBUlwiLCBjb2RlOiA1MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBc2NvbGktUGljZW5vXCIsIGFiYnJldmlhdGlvbjogXCJBUFwiLCBjb2RlOiA0NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBc3RpXCIsIGFiYnJldmlhdGlvbjogXCJBVFwiLCBjb2RlOiA1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkF2ZWxsaW5vXCIsIGFiYnJldmlhdGlvbjogXCJBVlwiLCBjb2RlOiA2NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCYXJpXCIsIGFiYnJldmlhdGlvbjogXCJCQVwiLCBjb2RlOiA3MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCYXJsZXR0YS1BbmRyaWEtVHJhbmlcIiwgYWJicmV2aWF0aW9uOiBcIkJUXCIsIGNvZGU6IDcyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJlbGx1bm9cIiwgYWJicmV2aWF0aW9uOiBcIkJMXCIsIGNvZGU6IDI1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJlbmV2ZW50b1wiLCBhYmJyZXZpYXRpb246IFwiQk5cIiwgY29kZTogNjIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmVyZ2Ftb1wiLCBhYmJyZXZpYXRpb246IFwiQkdcIiwgY29kZTogMTYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmllbGxhXCIsIGFiYnJldmlhdGlvbjogXCJCSVwiLCBjb2RlOiA5NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCb2xvZ25hXCIsIGFiYnJldmlhdGlvbjogXCJCT1wiLCBjb2RlOiAzNyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCb2x6YW5vXCIsIGFiYnJldmlhdGlvbjogXCJCWlwiLCBjb2RlOiAyMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCcmVzY2lhXCIsIGFiYnJldmlhdGlvbjogXCJCU1wiLCBjb2RlOiAxNyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCcmluZGlzaVwiLCBhYmJyZXZpYXRpb246IFwiQlJcIiwgY29kZTogNzQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FnbGlhcmlcIiwgYWJicmV2aWF0aW9uOiBcIkNBXCIsIGNvZGU6IDkyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhbHRhbmlzc2V0dGFcIiwgYWJicmV2aWF0aW9uOiBcIkNMXCIsIGNvZGU6IDg1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhbXBvYmFzc29cIiwgYWJicmV2aWF0aW9uOiBcIkNCXCIsIGNvZGU6IDcwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhcmJvbmlhIElnbGVzaWFzXCIsIGFiYnJldmlhdGlvbjogXCJDSVwiLCBjb2RlOiA3MCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYXNlcnRhXCIsIGFiYnJldmlhdGlvbjogXCJDRVwiLCBjb2RlOiA2MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYXRhbmlhXCIsIGFiYnJldmlhdGlvbjogXCJDVFwiLCBjb2RlOiA4NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYXRhbnphcm9cIiwgYWJicmV2aWF0aW9uOiBcIkNaXCIsIGNvZGU6IDc5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNoaWV0aVwiLCBhYmJyZXZpYXRpb246IFwiQ0hcIiwgY29kZTogNjkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ29tb1wiLCBhYmJyZXZpYXRpb246IFwiQ09cIiwgY29kZTogMTMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ29zZW56YVwiLCBhYmJyZXZpYXRpb246IFwiQ1NcIiwgY29kZTogNzggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ3JlbW9uYVwiLCBhYmJyZXZpYXRpb246IFwiQ1JcIiwgY29kZTogMTkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ3JvdG9uZVwiLCBhYmJyZXZpYXRpb246IFwiS1JcIiwgY29kZTogMTAxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkN1bmVvXCIsIGFiYnJldmlhdGlvbjogXCJDTlwiLCBjb2RlOiA0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkVubmFcIiwgYWJicmV2aWF0aW9uOiBcIkVOXCIsIGNvZGU6IDg2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZlcm1vXCIsIGFiYnJldmlhdGlvbjogXCJGTVwiLCBjb2RlOiA4NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGZXJyYXJhXCIsIGFiYnJldmlhdGlvbjogXCJGRVwiLCBjb2RlOiAzOCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGaXJlbnplXCIsIGFiYnJldmlhdGlvbjogXCJGSVwiLCBjb2RlOiA0OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGb2dnaWFcIiwgYWJicmV2aWF0aW9uOiBcIkZHXCIsIGNvZGU6IDcxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZvcmxpLUNlc2VuYVwiLCBhYmJyZXZpYXRpb246IFwiRkNcIiwgY29kZTogNzEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRnJvc2lub25lXCIsIGFiYnJldmlhdGlvbjogXCJGUlwiLCBjb2RlOiA2MCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJHZW5vdmFcIiwgYWJicmV2aWF0aW9uOiBcIkdFXCIsIGNvZGU6IDEwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkdvcml6aWFcIiwgYWJicmV2aWF0aW9uOiBcIkdPXCIsIGNvZGU6IDMxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkdyb3NzZXRvXCIsIGFiYnJldmlhdGlvbjogXCJHUlwiLCBjb2RlOiA1MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJJbXBlcmlhXCIsIGFiYnJldmlhdGlvbjogXCJJTVwiLCBjb2RlOiA4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIklzZXJuaWFcIiwgYWJicmV2aWF0aW9uOiBcIklTXCIsIGNvZGU6IDk0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxhLVNwZXppYVwiLCBhYmJyZXZpYXRpb246IFwiU1BcIiwgY29kZTogNjYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGF0aW5hXCIsIGFiYnJldmlhdGlvbjogXCJMVFwiLCBjb2RlOiA1OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMZWNjZVwiLCBhYmJyZXZpYXRpb246IFwiTEVcIiwgY29kZTogNzUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGVjY29cIiwgYWJicmV2aWF0aW9uOiBcIkxDXCIsIGNvZGU6IDk3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxpdm9ybm9cIiwgYWJicmV2aWF0aW9uOiBcIkxJXCIsIGNvZGU6IDQ5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxvZGlcIiwgYWJicmV2aWF0aW9uOiBcIkxPXCIsIGNvZGU6IDk4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkx1Y2NhXCIsIGFiYnJldmlhdGlvbjogXCJMVVwiLCBjb2RlOiA0NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNYWNlcmF0YVwiLCBhYmJyZXZpYXRpb246IFwiTUNcIiwgY29kZTogNDMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWFudG92YVwiLCBhYmJyZXZpYXRpb246IFwiTU5cIiwgY29kZTogMjAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWFzc2EtQ2FycmFyYVwiLCBhYmJyZXZpYXRpb246IFwiTVNcIiwgY29kZTogNDUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWF0ZXJhXCIsIGFiYnJldmlhdGlvbjogXCJNVFwiLCBjb2RlOiA3NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNZWRpbyBDYW1waWRhbm9cIiwgYWJicmV2aWF0aW9uOiBcIlZTXCIsIGNvZGU6IDc3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1lc3NpbmFcIiwgYWJicmV2aWF0aW9uOiBcIk1FXCIsIGNvZGU6IDgzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1pbGFub1wiLCBhYmJyZXZpYXRpb246IFwiTUlcIiwgY29kZTogMTUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTW9kZW5hXCIsIGFiYnJldmlhdGlvbjogXCJNT1wiLCBjb2RlOiAzNiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNb256YS1CcmlhbnphXCIsIGFiYnJldmlhdGlvbjogXCJNQlwiLCBjb2RlOiAzNiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJOYXBvbGlcIiwgYWJicmV2aWF0aW9uOiBcIk5BXCIsIGNvZGU6IDYzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk5vdmFyYVwiLCBhYmJyZXZpYXRpb246IFwiTk9cIiwgY29kZTogMyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJOdW9yb1wiLCBhYmJyZXZpYXRpb246IFwiTlVcIiwgY29kZTogOTEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiT2dsaWFzdHJhXCIsIGFiYnJldmlhdGlvbjogXCJPR1wiLCBjb2RlOiA5MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJPbGJpYSBUZW1waW9cIiwgYWJicmV2aWF0aW9uOiBcIk9UXCIsIGNvZGU6IDkxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk9yaXN0YW5vXCIsIGFiYnJldmlhdGlvbjogXCJPUlwiLCBjb2RlOiA5NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQYWRvdmFcIiwgYWJicmV2aWF0aW9uOiBcIlBEXCIsIGNvZGU6IDI4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBhbGVybW9cIiwgYWJicmV2aWF0aW9uOiBcIlBBXCIsIGNvZGU6IDgyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBhcm1hXCIsIGFiYnJldmlhdGlvbjogXCJQUlwiLCBjb2RlOiAzNCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQYXZpYVwiLCBhYmJyZXZpYXRpb246IFwiUFZcIiwgY29kZTogMTggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGVydWdpYVwiLCBhYmJyZXZpYXRpb246IFwiUEdcIiwgY29kZTogNTQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGVzYXJvLVVyYmlub1wiLCBhYmJyZXZpYXRpb246IFwiUFVcIiwgY29kZTogNDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGVzY2FyYVwiLCBhYmJyZXZpYXRpb246IFwiUEVcIiwgY29kZTogNjggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGlhY2VuemFcIiwgYWJicmV2aWF0aW9uOiBcIlBDXCIsIGNvZGU6IDMzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBpc2FcIiwgYWJicmV2aWF0aW9uOiBcIlBJXCIsIGNvZGU6IDUwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBpc3RvaWFcIiwgYWJicmV2aWF0aW9uOiBcIlBUXCIsIGNvZGU6IDQ3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBvcmRlbm9uZVwiLCBhYmJyZXZpYXRpb246IFwiUE5cIiwgY29kZTogOTMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUG90ZW56YVwiLCBhYmJyZXZpYXRpb246IFwiUFpcIiwgY29kZTogNzYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUHJhdG9cIiwgYWJicmV2aWF0aW9uOiBcIlBPXCIsIGNvZGU6IDEwMCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSYWd1c2FcIiwgYWJicmV2aWF0aW9uOiBcIlJHXCIsIGNvZGU6IDg4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJhdmVubmFcIiwgYWJicmV2aWF0aW9uOiBcIlJBXCIsIGNvZGU6IDM5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJlZ2dpby1DYWxhYnJpYVwiLCBhYmJyZXZpYXRpb246IFwiUkNcIiwgY29kZTogMzUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmVnZ2lvLUVtaWxpYVwiLCBhYmJyZXZpYXRpb246IFwiUkVcIiwgY29kZTogMzUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmlldGlcIiwgYWJicmV2aWF0aW9uOiBcIlJJXCIsIGNvZGU6IDU3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJpbWluaVwiLCBhYmJyZXZpYXRpb246IFwiUk5cIiwgY29kZTogOTkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUm9tYVwiLCBhYmJyZXZpYXRpb246IFwiUm9tYVwiLCBjb2RlOiA1OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSb3ZpZ29cIiwgYWJicmV2aWF0aW9uOiBcIlJPXCIsIGNvZGU6IDI5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNhbGVybm9cIiwgYWJicmV2aWF0aW9uOiBcIlNBXCIsIGNvZGU6IDY1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNhc3NhcmlcIiwgYWJicmV2aWF0aW9uOiBcIlNTXCIsIGNvZGU6IDkwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNhdm9uYVwiLCBhYmJyZXZpYXRpb246IFwiU1ZcIiwgY29kZTogOSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTaWVuYVwiLCBhYmJyZXZpYXRpb246IFwiU0lcIiwgY29kZTogNTIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2lyYWN1c2FcIiwgYWJicmV2aWF0aW9uOiBcIlNSXCIsIGNvZGU6IDg5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNvbmRyaW9cIiwgYWJicmV2aWF0aW9uOiBcIlNPXCIsIGNvZGU6IDE0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRhcmFudG9cIiwgYWJicmV2aWF0aW9uOiBcIlRBXCIsIGNvZGU6IDczIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRlcmFtb1wiLCBhYmJyZXZpYXRpb246IFwiVEVcIiwgY29kZTogNjcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVGVybmlcIiwgYWJicmV2aWF0aW9uOiBcIlRSXCIsIGNvZGU6IDU1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRvcmlub1wiLCBhYmJyZXZpYXRpb246IFwiVE9cIiwgY29kZTogMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUcmFwYW5pXCIsIGFiYnJldmlhdGlvbjogXCJUUFwiLCBjb2RlOiA4MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUcmVudG9cIiwgYWJicmV2aWF0aW9uOiBcIlROXCIsIGNvZGU6IDIyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRyZXZpc29cIiwgYWJicmV2aWF0aW9uOiBcIlRWXCIsIGNvZGU6IDI2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRyaWVzdGVcIiwgYWJicmV2aWF0aW9uOiBcIlRTXCIsIGNvZGU6IDMyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlVkaW5lXCIsIGFiYnJldmlhdGlvbjogXCJVRFwiLCBjb2RlOiAzMCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWYXJlc2VcIiwgYWJicmV2aWF0aW9uOiBcIlZBXCIsIGNvZGU6IDEyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZlbmV6aWFcIiwgYWJicmV2aWF0aW9uOiBcIlZFXCIsIGNvZGU6IDI3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZlcmJhbmlhXCIsIGFiYnJldmlhdGlvbjogXCJWQlwiLCBjb2RlOiAyNyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWZXJjZWxsaVwiLCBhYmJyZXZpYXRpb246IFwiVkNcIiwgY29kZTogMiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWZXJvbmFcIiwgYWJicmV2aWF0aW9uOiBcIlZSXCIsIGNvZGU6IDIzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZpYm8tVmFsZW50aWFcIiwgYWJicmV2aWF0aW9uOiBcIlZWXCIsIGNvZGU6IDEwMiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWaWNlbnphXCIsIGFiYnJldmlhdGlvbjogXCJWSVwiLCBjb2RlOiAyNCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWaXRlcmJvXCIsIGFiYnJldmlhdGlvbjogXCJWVFwiLCBjb2RlOiA1NiB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8vIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9zYW1zYXJnZW50L1VzZWZ1bC1BdXRvY29tcGxldGUtRGF0YS9ibG9iL21hc3Rlci9kYXRhL25hdGlvbmFsaXRpZXMuanNvblxuICAgICAgICBuYXRpb25hbGl0aWVzOiBbXG4gICAgICAgICAgIHtuYW1lOiAnQWZnaGFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQWxiYW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbGdlcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FtZXJpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQW5kb3JyYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbmdvbGFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQW50aWd1YW5zJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQXJnZW50aW5lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBcm1lbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0F1c3RyYWxpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBdXN0cmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0F6ZXJiYWlqYW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmFoYW1pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmFocmFpbmknfSxcbiAgICAgICAgICAge25hbWU6ICdCYW5nbGFkZXNoaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JhcmJhZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JhcmJ1ZGFucyd9LFxuICAgICAgICAgICB7bmFtZTogJ0JhdHN3YW5hJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmVsYXJ1c2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JlbGdpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCZWxpemVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JlbmluZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmh1dGFuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQm9saXZpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCb3NuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnJhemlsaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnJpdGlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0JydW5laWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnVsZ2FyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnVya2luYWJlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQnVybWVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0J1cnVuZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NhbWJvZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NhbWVyb29uaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2FuYWRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDYXBlIFZlcmRlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDZW50cmFsIEFmcmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDaGFkaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2hpbGVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NoaW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdDb2xvbWJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDb21vcmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ29uZ29sZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ29zdGEgUmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDcm9hdGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0N1YmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ3lwcmlvdCd9LFxuICAgICAgICAgICB7bmFtZTogJ0N6ZWNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRGFuaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRGppYm91dGknfSxcbiAgICAgICAgICAge25hbWU6ICdEb21pbmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdEdXRjaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0Vhc3QgVGltb3Jlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdFY3VhZG9yZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRWd5cHRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFbWlyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRXF1YXRvcmlhbCBHdWluZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRXJpdHJlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFc3Rvbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0V0aGlvcGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0Zpamlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0ZpbGlwaW5vJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRmlubmlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0ZyZW5jaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0dhYm9uZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR2FtYmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0dlb3JnaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR2VybWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR2hhbmFpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHcmVlayd9LFxuICAgICAgICAgICB7bmFtZTogJ0dyZW5hZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0d1YXRlbWFsYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHdWluZWEtQmlzc2F1YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHdWluZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3V5YW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdIYWl0aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSGVyemVnb3Zpbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0hvbmR1cmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSHVuZ2FyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSS1LaXJpYmF0aSd9LFxuICAgICAgICAgICB7bmFtZTogJ0ljZWxhbmRlcid9LFxuICAgICAgICAgICB7bmFtZTogJ0luZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0luZG9uZXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdJcmFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXJhcWknfSxcbiAgICAgICAgICAge25hbWU6ICdJcmlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0lzcmFlbGknfSxcbiAgICAgICAgICAge25hbWU6ICdJdGFsaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXZvcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0phbWFpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSmFwYW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdKb3JkYW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdLYXpha2hzdGFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0tlbnlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0tpdHRpYW4gYW5kIE5ldmlzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnS3V3YWl0aSd9LFxuICAgICAgICAgICB7bmFtZTogJ0t5cmd5eid9LFxuICAgICAgICAgICB7bmFtZTogJ0xhb3RpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdMYXR2aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGViYW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdMaWJlcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0xpYnlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0xpZWNodGVuc3RlaW5lcid9LFxuICAgICAgICAgICB7bmFtZTogJ0xpdGh1YW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdMdXhlbWJvdXJnZXInfSxcbiAgICAgICAgICAge25hbWU6ICdNYWNlZG9uaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsYWdhc3knfSxcbiAgICAgICAgICAge25hbWU6ICdNYWxhd2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hbGF5c2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hbGRpdmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsdGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ01hcnNoYWxsZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWF1cml0YW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYXVyaXRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNZXhpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWljcm9uZXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNb2xkb3Zhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01vbmFjYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNb25nb2xpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNb3JvY2Nhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01vc290aG8nfSxcbiAgICAgICAgICAge25hbWU6ICdNb3Rzd2FuYSd9LFxuICAgICAgICAgICB7bmFtZTogJ01vemFtYmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOYW1pYmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05hdXJ1YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOZXBhbGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ05ldyBaZWFsYW5kZXInfSxcbiAgICAgICAgICAge25hbWU6ICdOaWNhcmFndWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmlnZXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOaWdlcmllbid9LFxuICAgICAgICAgICB7bmFtZTogJ05vcnRoIEtvcmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05vcnRoZXJuIElyaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTm9yd2VnaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnT21hbmknfSxcbiAgICAgICAgICAge25hbWU6ICdQYWtpc3RhbmknfSxcbiAgICAgICAgICAge25hbWU6ICdQYWxhdWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGFuYW1hbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1BhcHVhIE5ldyBHdWluZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGFyYWd1YXlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1BlcnV2aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUG9saXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUG9ydHVndWVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1FhdGFyaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1JvbWFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1J1c3NpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdSd2FuZGFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2FpbnQgTHVjaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2FsdmFkb3Jhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NhbW9hbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NhbiBNYXJpbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1NhbyBUb21lYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTYXVkaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1Njb3R0aXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2VuZWdhbGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1NlcmJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTZXljaGVsbG9pcyd9LFxuICAgICAgICAgICB7bmFtZTogJ1NpZXJyYSBMZW9uZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2luZ2Fwb3JlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTbG92YWtpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTbG92ZW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTb2xvbW9uIElzbGFuZGVyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU29tYWxpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU291dGggQWZyaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NvdXRoIEtvcmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NwYW5pc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdTcmkgTGFua2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3VkYW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdTdXJpbmFtZXInfSxcbiAgICAgICAgICAge25hbWU6ICdTd2F6aSd9LFxuICAgICAgICAgICB7bmFtZTogJ1N3ZWRpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdTd2lzcyd9LFxuICAgICAgICAgICB7bmFtZTogJ1N5cmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1RhaXdhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1RhamlrJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVGFuemFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVGhhaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1RvZ29sZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVG9uZ2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVHJpbmlkYWRpYW4gb3IgVG9iYWdvbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1R1bmlzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVHVya2lzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ1R1dmFsdWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVWdhbmRhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1VrcmFpbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1VydWd1YXlhJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVXpiZWtpc3RhbmknfSxcbiAgICAgICAgICAge25hbWU6ICdWZW5lenVlbGEnfSxcbiAgICAgICAgICAge25hbWU6ICdWaWV0bmFtZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnV2Vscyd9LFxuICAgICAgICAgICB7bmFtZTogJ1llbWVuaXQnfSxcbiAgICAgICAgICAge25hbWU6ICdaYW1iaWEnfSxcbiAgICAgICAgICAge25hbWU6ICdaaW1iYWJ3ZSd9LFxuICAgICAgICBdLFxuXG4gICAgICAgIHVzX3N0YXRlc19hbmRfZGM6IFtcbiAgICAgICAgICAgIHtuYW1lOiAnQWxhYmFtYScsIGFiYnJldmlhdGlvbjogJ0FMJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0FsYXNrYScsIGFiYnJldmlhdGlvbjogJ0FLJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0FyaXpvbmEnLCBhYmJyZXZpYXRpb246ICdBWid9LFxuICAgICAgICAgICAge25hbWU6ICdBcmthbnNhcycsIGFiYnJldmlhdGlvbjogJ0FSJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0NhbGlmb3JuaWEnLCBhYmJyZXZpYXRpb246ICdDQSd9LFxuICAgICAgICAgICAge25hbWU6ICdDb2xvcmFkbycsIGFiYnJldmlhdGlvbjogJ0NPJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0Nvbm5lY3RpY3V0JywgYWJicmV2aWF0aW9uOiAnQ1QnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGVsYXdhcmUnLCBhYmJyZXZpYXRpb246ICdERSd9LFxuICAgICAgICAgICAge25hbWU6ICdEaXN0cmljdCBvZiBDb2x1bWJpYScsIGFiYnJldmlhdGlvbjogJ0RDJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0Zsb3JpZGEnLCBhYmJyZXZpYXRpb246ICdGTCd9LFxuICAgICAgICAgICAge25hbWU6ICdHZW9yZ2lhJywgYWJicmV2aWF0aW9uOiAnR0EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSGF3YWlpJywgYWJicmV2aWF0aW9uOiAnSEknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSWRhaG8nLCBhYmJyZXZpYXRpb246ICdJRCd9LFxuICAgICAgICAgICAge25hbWU6ICdJbGxpbm9pcycsIGFiYnJldmlhdGlvbjogJ0lMJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0luZGlhbmEnLCBhYmJyZXZpYXRpb246ICdJTid9LFxuICAgICAgICAgICAge25hbWU6ICdJb3dhJywgYWJicmV2aWF0aW9uOiAnSUEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnS2Fuc2FzJywgYWJicmV2aWF0aW9uOiAnS1MnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnS2VudHVja3knLCBhYmJyZXZpYXRpb246ICdLWSd9LFxuICAgICAgICAgICAge25hbWU6ICdMb3Vpc2lhbmEnLCBhYmJyZXZpYXRpb246ICdMQSd9LFxuICAgICAgICAgICAge25hbWU6ICdNYWluZScsIGFiYnJldmlhdGlvbjogJ01FJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01hcnlsYW5kJywgYWJicmV2aWF0aW9uOiAnTUQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFzc2FjaHVzZXR0cycsIGFiYnJldmlhdGlvbjogJ01BJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pY2hpZ2FuJywgYWJicmV2aWF0aW9uOiAnTUknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWlubmVzb3RhJywgYWJicmV2aWF0aW9uOiAnTU4nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWlzc2lzc2lwcGknLCBhYmJyZXZpYXRpb246ICdNUyd9LFxuICAgICAgICAgICAge25hbWU6ICdNaXNzb3VyaScsIGFiYnJldmlhdGlvbjogJ01PJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01vbnRhbmEnLCBhYmJyZXZpYXRpb246ICdNVCd9LFxuICAgICAgICAgICAge25hbWU6ICdOZWJyYXNrYScsIGFiYnJldmlhdGlvbjogJ05FJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldmFkYScsIGFiYnJldmlhdGlvbjogJ05WJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldyBIYW1wc2hpcmUnLCBhYmJyZXZpYXRpb246ICdOSCd9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgSmVyc2V5JywgYWJicmV2aWF0aW9uOiAnTkonfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3IE1leGljbycsIGFiYnJldmlhdGlvbjogJ05NJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldyBZb3JrJywgYWJicmV2aWF0aW9uOiAnTlknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggQ2Fyb2xpbmEnLCBhYmJyZXZpYXRpb246ICdOQyd9LFxuICAgICAgICAgICAge25hbWU6ICdOb3J0aCBEYWtvdGEnLCBhYmJyZXZpYXRpb246ICdORCd9LFxuICAgICAgICAgICAge25hbWU6ICdPaGlvJywgYWJicmV2aWF0aW9uOiAnT0gnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT2tsYWhvbWEnLCBhYmJyZXZpYXRpb246ICdPSyd9LFxuICAgICAgICAgICAge25hbWU6ICdPcmVnb24nLCBhYmJyZXZpYXRpb246ICdPUid9LFxuICAgICAgICAgICAge25hbWU6ICdQZW5uc3lsdmFuaWEnLCBhYmJyZXZpYXRpb246ICdQQSd9LFxuICAgICAgICAgICAge25hbWU6ICdSaG9kZSBJc2xhbmQnLCBhYmJyZXZpYXRpb246ICdSSSd9LFxuICAgICAgICAgICAge25hbWU6ICdTb3V0aCBDYXJvbGluYScsIGFiYnJldmlhdGlvbjogJ1NDJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1NvdXRoIERha290YScsIGFiYnJldmlhdGlvbjogJ1NEJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Rlbm5lc3NlZScsIGFiYnJldmlhdGlvbjogJ1ROJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1RleGFzJywgYWJicmV2aWF0aW9uOiAnVFgnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVXRhaCcsIGFiYnJldmlhdGlvbjogJ1VUJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Zlcm1vbnQnLCBhYmJyZXZpYXRpb246ICdWVCd9LFxuICAgICAgICAgICAge25hbWU6ICdWaXJnaW5pYScsIGFiYnJldmlhdGlvbjogJ1ZBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1dhc2hpbmd0b24nLCBhYmJyZXZpYXRpb246ICdXQSd9LFxuICAgICAgICAgICAge25hbWU6ICdXZXN0IFZpcmdpbmlhJywgYWJicmV2aWF0aW9uOiAnV1YnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnV2lzY29uc2luJywgYWJicmV2aWF0aW9uOiAnV0knfSxcbiAgICAgICAgICAgIHtuYW1lOiAnV3lvbWluZycsIGFiYnJldmlhdGlvbjogJ1dZJ31cbiAgICAgICAgXSxcblxuICAgICAgICB0ZXJyaXRvcmllczogW1xuICAgICAgICAgICAge25hbWU6ICdBbWVyaWNhbiBTYW1vYScsIGFiYnJldmlhdGlvbjogJ0FTJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0ZlZGVyYXRlZCBTdGF0ZXMgb2YgTWljcm9uZXNpYScsIGFiYnJldmlhdGlvbjogJ0ZNJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0d1YW0nLCBhYmJyZXZpYXRpb246ICdHVSd9LFxuICAgICAgICAgICAge25hbWU6ICdNYXJzaGFsbCBJc2xhbmRzJywgYWJicmV2aWF0aW9uOiAnTUgnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTm9ydGhlcm4gTWFyaWFuYSBJc2xhbmRzJywgYWJicmV2aWF0aW9uOiAnTVAnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUHVlcnRvIFJpY28nLCBhYmJyZXZpYXRpb246ICdQUid9LFxuICAgICAgICAgICAge25hbWU6ICdWaXJnaW4gSXNsYW5kcywgVS5TLicsIGFiYnJldmlhdGlvbjogJ1ZJJ31cbiAgICAgICAgXSxcblxuICAgICAgICBhcm1lZF9mb3JjZXM6IFtcbiAgICAgICAgICAgIHtuYW1lOiAnQXJtZWQgRm9yY2VzIEV1cm9wZScsIGFiYnJldmlhdGlvbjogJ0FFJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0FybWVkIEZvcmNlcyBQYWNpZmljJywgYWJicmV2aWF0aW9uOiAnQVAnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXJtZWQgRm9yY2VzIHRoZSBBbWVyaWNhcycsIGFiYnJldmlhdGlvbjogJ0FBJ31cbiAgICAgICAgXSxcblxuICAgICAgICBjb3VudHJ5X3JlZ2lvbnM6IHtcbiAgICAgICAgICAgIGl0OiBbXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZhbGxlIGQnQW9zdGFcIiwgYWJicmV2aWF0aW9uOiBcIlZEQVwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBpZW1vbnRlXCIsIGFiYnJldmlhdGlvbjogXCJQSUVcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMb21iYXJkaWFcIiwgYWJicmV2aWF0aW9uOiBcIkxPTVwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlZlbmV0b1wiLCBhYmJyZXZpYXRpb246IFwiVkVOXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVHJlbnRpbm8gQWx0byBBZGlnZVwiLCBhYmJyZXZpYXRpb246IFwiVEFBXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRnJpdWxpIFZlbmV6aWEgR2l1bGlhXCIsIGFiYnJldmlhdGlvbjogXCJGVkdcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMaWd1cmlhXCIsIGFiYnJldmlhdGlvbjogXCJMSUdcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJFbWlsaWEgUm9tYWduYVwiLCBhYmJyZXZpYXRpb246IFwiRU1SXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVG9zY2FuYVwiLCBhYmJyZXZpYXRpb246IFwiVE9TXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVW1icmlhXCIsIGFiYnJldmlhdGlvbjogXCJVTUJcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNYXJjaGVcIiwgYWJicmV2aWF0aW9uOiBcIk1BUlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFicnV6em9cIiwgYWJicmV2aWF0aW9uOiBcIkFCUlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxhemlvXCIsIGFiYnJldmlhdGlvbjogXCJMQVpcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYW1wYW5pYVwiLCBhYmJyZXZpYXRpb246IFwiQ0FNXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUHVnbGlhXCIsIGFiYnJldmlhdGlvbjogXCJQVUdcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCYXNpbGljYXRhXCIsIGFiYnJldmlhdGlvbjogXCJCQVNcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNb2xpc2VcIiwgYWJicmV2aWF0aW9uOiBcIk1PTFwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhbGFicmlhXCIsIGFiYnJldmlhdGlvbjogXCJDQUxcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTaWNpbGlhXCIsIGFiYnJldmlhdGlvbjogXCJTSUNcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTYXJkZWduYVwiLCBhYmJyZXZpYXRpb246IFwiU0FSXCIgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuXG4gICAgICAgIHN0cmVldF9zdWZmaXhlczoge1xuICAgICAgICAgICAgJ3VzJzogW1xuICAgICAgICAgICAgICAgIHtuYW1lOiAnQXZlbnVlJywgYWJicmV2aWF0aW9uOiAnQXZlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCb3VsZXZhcmQnLCBhYmJyZXZpYXRpb246ICdCbHZkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDZW50ZXInLCBhYmJyZXZpYXRpb246ICdDdHInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NpcmNsZScsIGFiYnJldmlhdGlvbjogJ0Npcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291cnQnLCBhYmJyZXZpYXRpb246ICdDdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRHJpdmUnLCBhYmJyZXZpYXRpb246ICdEcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRXh0ZW5zaW9uJywgYWJicmV2aWF0aW9uOiAnRXh0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHbGVuJywgYWJicmV2aWF0aW9uOiAnR2xuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHcm92ZScsIGFiYnJldmlhdGlvbjogJ0dydid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGVpZ2h0cycsIGFiYnJldmlhdGlvbjogJ0h0cyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGlnaHdheScsIGFiYnJldmlhdGlvbjogJ0h3eSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSnVuY3Rpb24nLCBhYmJyZXZpYXRpb246ICdKY3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0tleScsIGFiYnJldmlhdGlvbjogJ0tleSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGFuZScsIGFiYnJldmlhdGlvbjogJ0xuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMb29wJywgYWJicmV2aWF0aW9uOiAnTG9vcCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWFub3InLCBhYmJyZXZpYXRpb246ICdNbnInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01pbGwnLCBhYmJyZXZpYXRpb246ICdNaWxsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQYXJrJywgYWJicmV2aWF0aW9uOiAnUGFyayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGFya3dheScsIGFiYnJldmlhdGlvbjogJ1Brd3knfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Bhc3MnLCBhYmJyZXZpYXRpb246ICdQYXNzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQYXRoJywgYWJicmV2aWF0aW9uOiAnUGF0aCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGlrZScsIGFiYnJldmlhdGlvbjogJ1Bpa2UnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BsYWNlJywgYWJicmV2aWF0aW9uOiAnUGwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BsYXphJywgYWJicmV2aWF0aW9uOiAnUGx6J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQb2ludCcsIGFiYnJldmlhdGlvbjogJ1B0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSaWRnZScsIGFiYnJldmlhdGlvbjogJ1JkZyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUml2ZXInLCBhYmJyZXZpYXRpb246ICdSaXYnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JvYWQnLCBhYmJyZXZpYXRpb246ICdSZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3F1YXJlJywgYWJicmV2aWF0aW9uOiAnU3EnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N0cmVldCcsIGFiYnJldmlhdGlvbjogJ1N0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUZXJyYWNlJywgYWJicmV2aWF0aW9uOiAnVGVyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUcmFpbCcsIGFiYnJldmlhdGlvbjogJ1RybCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVHVybnBpa2UnLCBhYmJyZXZpYXRpb246ICdUcGtlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdWaWV3JywgYWJicmV2aWF0aW9uOiAnVncnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dheScsIGFiYnJldmlhdGlvbjogJ1dheSd9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgJ2l0JzogW1xuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FjY2Vzc28nLCBhYmJyZXZpYXRpb246ICdBY2MuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FsemFpYScsIGFiYnJldmlhdGlvbjogJ0Fsei4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQXJjbycsIGFiYnJldmlhdGlvbjogJ0FyY28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQXJjaGl2b2x0bycsIGFiYnJldmlhdGlvbjogJ0Fjdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQXJlbmEnLCBhYmJyZXZpYXRpb246ICdBcmVuYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBcmdpbmUnLCBhYmJyZXZpYXRpb246ICdBcmdpbmUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFjaW5vJywgYWJicmV2aWF0aW9uOiAnQmFjaW5vJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JhbmNoaScsIGFiYnJldmlhdGlvbjogJ0JhbmNoaScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCYW5jaGluYScsIGFiYnJldmlhdGlvbjogJ0Jhbi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFzdGlvbmknLCBhYmJyZXZpYXRpb246ICdCYXMuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JlbHZlZGVyZScsIGFiYnJldmlhdGlvbjogJ0JlbHYuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JvcmdhdGEnLCBhYmJyZXZpYXRpb246ICdCLnRhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JvcmdvJywgYWJicmV2aWF0aW9uOiAnQi5nbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYWxhdGEnLCBhYmJyZXZpYXRpb246ICdDYWwuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhbGxlJywgYWJicmV2aWF0aW9uOiAnQ2FsbGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FtcGllbGxvJywgYWJicmV2aWF0aW9uOiAnQ2FtLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYW1wbycsIGFiYnJldmlhdGlvbjogJ0NhbS4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FuYWxlJywgYWJicmV2aWF0aW9uOiAnQ2FuLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYXJyYWlhJywgYWJicmV2aWF0aW9uOiAnQ2Fyci4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FzY2luYScsIGFiYnJldmlhdGlvbjogJ0Nhc2NpbmEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FzZSBzcGFyc2UnLCBhYmJyZXZpYXRpb246ICdjLnMuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhdmFsY2F2aWEnLCBhYmJyZXZpYXRpb246ICdDdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2lyY29udmFsbGF6aW9uZScsIGFiYnJldmlhdGlvbjogJ0N2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDb21wbGFuYXJlJywgYWJicmV2aWF0aW9uOiAnQy5yZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDb250cmFkYScsIGFiYnJldmlhdGlvbjogJ0MuZGEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ29yc28nLCBhYmJyZXZpYXRpb246ICdDLnNvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NvcnRlJywgYWJicmV2aWF0aW9uOiAnQy50ZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDb3J0aWxlJywgYWJicmV2aWF0aW9uOiAnQy5sZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdEaXJhbWF6aW9uZScsIGFiYnJldmlhdGlvbjogJ0Rpci4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnRm9uZGFjbycsIGFiYnJldmlhdGlvbjogJ0YuY28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnRm9uZGFtZW50YScsIGFiYnJldmlhdGlvbjogJ0YudGEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnRm9uZG8nLCBhYmJyZXZpYXRpb246ICdGLmRvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0ZyYXppb25lJywgYWJicmV2aWF0aW9uOiAnRnIuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0lzb2xhJywgYWJicmV2aWF0aW9uOiAnSXMuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0xhcmdvJywgYWJicmV2aWF0aW9uOiAnTC5nbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdMaXRvcmFuZWEnLCBhYmJyZXZpYXRpb246ICdMaXQuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0x1bmdvbGFnbycsIGFiYnJldmlhdGlvbjogJ0wuZ28gbGFnbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdMdW5nbyBQbycsIGFiYnJldmlhdGlvbjogJ2wuZ28gUG8nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTW9sbycsIGFiYnJldmlhdGlvbjogJ01vbG8nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTXVyYScsIGFiYnJldmlhdGlvbjogJ011cmEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUGFzc2FnZ2lvIHByaXZhdG8nLCBhYmJyZXZpYXRpb246ICdwYXNzLiBwcml2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQYXNzZWdnaWF0YScsIGFiYnJldmlhdGlvbjogJ1Bhc3MuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1BpYXp6YScsIGFiYnJldmlhdGlvbjogJ1AuenphJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1BpYXp6YWxlJywgYWJicmV2aWF0aW9uOiAnUC5sZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQb250ZScsIGFiYnJldmlhdGlvbjogJ1AudGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUG9ydGljbycsIGFiYnJldmlhdGlvbjogJ1AuY28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUmFtcGEnLCBhYmJyZXZpYXRpb246ICdSYW1wYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSZWdpb25lJywgYWJicmV2aWF0aW9uOiAnUmVnLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSaW9uZScsIGFiYnJldmlhdGlvbjogJ1IubmUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUmlvJywgYWJicmV2aWF0aW9uOiAnUmlvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JpcGEnLCBhYmJyZXZpYXRpb246ICdSaXBhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JpdmEnLCBhYmJyZXZpYXRpb246ICdSaXZhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JvbmTDsicsIGFiYnJldmlhdGlvbjogJ1JvbmTDsicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSb3RvbmRhJywgYWJicmV2aWF0aW9uOiAnUm90LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTYWdyYXRvJywgYWJicmV2aWF0aW9uOiAnU2Fnci4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU2FsaXRhJywgYWJicmV2aWF0aW9uOiAnU2FsLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTY2FsaW5hdGEnLCBhYmJyZXZpYXRpb246ICdTY2FsLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTY2Fsb25lJywgYWJicmV2aWF0aW9uOiAnU2NhbC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU2xhcmdvJywgYWJicmV2aWF0aW9uOiAnU2wuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NvdHRvcG9ydGljbycsIGFiYnJldmlhdGlvbjogJ1NvdHQuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1N0cmFkYScsIGFiYnJldmlhdGlvbjogJ1N0ci4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU3RyYWRhbGUnLCBhYmJyZXZpYXRpb246ICdTdHIubGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU3RyZXR0b2lhJywgYWJicmV2aWF0aW9uOiAnU3RyZXR0LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdUcmF2ZXJzYScsIGFiYnJldmlhdGlvbjogJ1RyYXYuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1ZpYScsIGFiYnJldmlhdGlvbjogJ1YuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1ZpYWxlJywgYWJicmV2aWF0aW9uOiAnVi5sZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdWaWNpbmFsZScsIGFiYnJldmlhdGlvbjogJ1ZpYy5sZScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdWaWNvbG8nLCBhYmJyZXZpYXRpb246ICdWaWMuJyB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgJ3VrJyA6IFtcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0F2ZW51ZScsIGFiYnJldmlhdGlvbjogJ0F2ZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2xvc2UnLCBhYmJyZXZpYXRpb246ICdDbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291cnQnLCBhYmJyZXZpYXRpb246ICdDdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ3Jlc2NlbnQnLCBhYmJyZXZpYXRpb246ICdDcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRHJpdmUnLCBhYmJyZXZpYXRpb246ICdEcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR2FyZGVuJywgYWJicmV2aWF0aW9uOiAnR2RuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdHYXJkZW5zJywgYWJicmV2aWF0aW9uOiAnR2Rucyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3JlZW4nLCBhYmJyZXZpYXRpb246ICdHbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3JvdmUnLCBhYmJyZXZpYXRpb246ICdHcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGFuZScsIGFiYnJldmlhdGlvbjogJ0xuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNb3VudCcsIGFiYnJldmlhdGlvbjogJ010J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQbGFjZScsIGFiYnJldmlhdGlvbjogJ1BsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQYXJrJywgYWJicmV2aWF0aW9uOiAnUGsnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JpZGdlJywgYWJicmV2aWF0aW9uOiAnUmRnJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSb2FkJywgYWJicmV2aWF0aW9uOiAnUmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NxdWFyZScsIGFiYnJldmlhdGlvbjogJ1NxJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdHJlZXQnLCBhYmJyZXZpYXRpb246ICdTdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVGVycmFjZScsIGFiYnJldmlhdGlvbjogJ1Rlcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVmFsbGV5JywgYWJicmV2aWF0aW9uOiAnVmFsJ31cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcblxuICAgICAgICBtb250aHM6IFtcbiAgICAgICAgICAgIHtuYW1lOiAnSmFudWFyeScsIHNob3J0X25hbWU6ICdKYW4nLCBudW1lcmljOiAnMDEnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICAvLyBOb3QgbWVzc2luZyB3aXRoIGxlYXAgeWVhcnMuLi5cbiAgICAgICAgICAgIHtuYW1lOiAnRmVicnVhcnknLCBzaG9ydF9uYW1lOiAnRmViJywgbnVtZXJpYzogJzAyJywgZGF5czogMjh9LFxuICAgICAgICAgICAge25hbWU6ICdNYXJjaCcsIHNob3J0X25hbWU6ICdNYXInLCBudW1lcmljOiAnMDMnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ0FwcmlsJywgc2hvcnRfbmFtZTogJ0FwcicsIG51bWVyaWM6ICcwNCcsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWF5Jywgc2hvcnRfbmFtZTogJ01heScsIG51bWVyaWM6ICcwNScsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSnVuZScsIHNob3J0X25hbWU6ICdKdW4nLCBudW1lcmljOiAnMDYnLCBkYXlzOiAzMH0sXG4gICAgICAgICAgICB7bmFtZTogJ0p1bHknLCBzaG9ydF9uYW1lOiAnSnVsJywgbnVtZXJpYzogJzA3JywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdBdWd1c3QnLCBzaG9ydF9uYW1lOiAnQXVnJywgbnVtZXJpYzogJzA4JywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdTZXB0ZW1iZXInLCBzaG9ydF9uYW1lOiAnU2VwJywgbnVtZXJpYzogJzA5JywgZGF5czogMzB9LFxuICAgICAgICAgICAge25hbWU6ICdPY3RvYmVyJywgc2hvcnRfbmFtZTogJ09jdCcsIG51bWVyaWM6ICcxMCcsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTm92ZW1iZXInLCBzaG9ydF9uYW1lOiAnTm92JywgbnVtZXJpYzogJzExJywgZGF5czogMzB9LFxuICAgICAgICAgICAge25hbWU6ICdEZWNlbWJlcicsIHNob3J0X25hbWU6ICdEZWMnLCBudW1lcmljOiAnMTInLCBkYXlzOiAzMX1cbiAgICAgICAgXSxcblxuICAgICAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0JhbmtfY2FyZF9udW1iZXIjSXNzdWVyX2lkZW50aWZpY2F0aW9uX251bWJlcl8uMjhJSU4uMjlcbiAgICAgICAgY2NfdHlwZXM6IFtcbiAgICAgICAgICAgIHtuYW1lOiBcIkFtZXJpY2FuIEV4cHJlc3NcIiwgc2hvcnRfbmFtZTogJ2FtZXgnLCBwcmVmaXg6ICczNCcsIGxlbmd0aDogMTV9LFxuICAgICAgICAgICAge25hbWU6IFwiQmFua2NhcmRcIiwgc2hvcnRfbmFtZTogJ2JhbmtjYXJkJywgcHJlZml4OiAnNTYxMCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiQ2hpbmEgVW5pb25QYXlcIiwgc2hvcnRfbmFtZTogJ2NoaW5hdW5pb24nLCBwcmVmaXg6ICc2MicsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiRGluZXJzIENsdWIgQ2FydGUgQmxhbmNoZVwiLCBzaG9ydF9uYW1lOiAnZGNjYXJ0ZScsIHByZWZpeDogJzMwMCcsIGxlbmd0aDogMTR9LFxuICAgICAgICAgICAge25hbWU6IFwiRGluZXJzIENsdWIgZW5Sb3V0ZVwiLCBzaG9ydF9uYW1lOiAnZGNlbnJvdXRlJywgcHJlZml4OiAnMjAxNCcsIGxlbmd0aDogMTV9LFxuICAgICAgICAgICAge25hbWU6IFwiRGluZXJzIENsdWIgSW50ZXJuYXRpb25hbFwiLCBzaG9ydF9uYW1lOiAnZGNpbnRsJywgcHJlZml4OiAnMzYnLCBsZW5ndGg6IDE0fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIFVuaXRlZCBTdGF0ZXMgJiBDYW5hZGFcIiwgc2hvcnRfbmFtZTogJ2RjdXNjJywgcHJlZml4OiAnNTQnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpc2NvdmVyIENhcmRcIiwgc2hvcnRfbmFtZTogJ2Rpc2NvdmVyJywgcHJlZml4OiAnNjAxMScsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiSW5zdGFQYXltZW50XCIsIHNob3J0X25hbWU6ICdpbnN0YXBheScsIHByZWZpeDogJzYzNycsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiSkNCXCIsIHNob3J0X25hbWU6ICdqY2InLCBwcmVmaXg6ICczNTI4JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJMYXNlclwiLCBzaG9ydF9uYW1lOiAnbGFzZXInLCBwcmVmaXg6ICc2MzA0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJNYWVzdHJvXCIsIHNob3J0X25hbWU6ICdtYWVzdHJvJywgcHJlZml4OiAnNTAxOCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiTWFzdGVyY2FyZFwiLCBzaG9ydF9uYW1lOiAnbWMnLCBwcmVmaXg6ICc1MScsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiU29sb1wiLCBzaG9ydF9uYW1lOiAnc29sbycsIHByZWZpeDogJzYzMzQnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlN3aXRjaFwiLCBzaG9ydF9uYW1lOiAnc3dpdGNoJywgcHJlZml4OiAnNDkwMycsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiVmlzYVwiLCBzaG9ydF9uYW1lOiAndmlzYScsIHByZWZpeDogJzQnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlZpc2EgRWxlY3Ryb25cIiwgc2hvcnRfbmFtZTogJ2VsZWN0cm9uJywgcHJlZml4OiAnNDAyNicsIGxlbmd0aDogMTZ9XG4gICAgICAgIF0sXG5cbiAgICAgICAgLy9yZXR1cm4gYWxsIHdvcmxkIGN1cnJlbmN5IGJ5IElTTyA0MjE3XG4gICAgICAgIGN1cnJlbmN5X3R5cGVzOiBbXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FFRCcsICduYW1lJyA6ICdVbml0ZWQgQXJhYiBFbWlyYXRlcyBEaXJoYW0nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQUZOJywgJ25hbWUnIDogJ0FmZ2hhbmlzdGFuIEFmZ2hhbmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQUxMJywgJ25hbWUnIDogJ0FsYmFuaWEgTGVrJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FNRCcsICduYW1lJyA6ICdBcm1lbmlhIERyYW0nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQU5HJywgJ25hbWUnIDogJ05ldGhlcmxhbmRzIEFudGlsbGVzIEd1aWxkZXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQU9BJywgJ25hbWUnIDogJ0FuZ29sYSBLd2FuemEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQVJTJywgJ25hbWUnIDogJ0FyZ2VudGluYSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FVRCcsICduYW1lJyA6ICdBdXN0cmFsaWEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FXRycsICduYW1lJyA6ICdBcnViYSBHdWlsZGVyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FaTicsICduYW1lJyA6ICdBemVyYmFpamFuIE5ldyBNYW5hdCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCQU0nLCAnbmFtZScgOiAnQm9zbmlhIGFuZCBIZXJ6ZWdvdmluYSBDb252ZXJ0aWJsZSBNYXJrYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCQkQnLCAnbmFtZScgOiAnQmFyYmFkb3MgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JEVCcsICduYW1lJyA6ICdCYW5nbGFkZXNoIFRha2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkdOJywgJ25hbWUnIDogJ0J1bGdhcmlhIExldid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCSEQnLCAnbmFtZScgOiAnQmFocmFpbiBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCSUYnLCAnbmFtZScgOiAnQnVydW5kaSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCTUQnLCAnbmFtZScgOiAnQmVybXVkYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQk5EJywgJ25hbWUnIDogJ0JydW5laSBEYXJ1c3NhbGFtIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCT0InLCAnbmFtZScgOiAnQm9saXZpYSBCb2xpdmlhbm8nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQlJMJywgJ25hbWUnIDogJ0JyYXppbCBSZWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JTRCcsICduYW1lJyA6ICdCYWhhbWFzIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCVE4nLCAnbmFtZScgOiAnQmh1dGFuIE5ndWx0cnVtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JXUCcsICduYW1lJyA6ICdCb3Rzd2FuYSBQdWxhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JZUicsICduYW1lJyA6ICdCZWxhcnVzIFJ1YmxlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JaRCcsICduYW1lJyA6ICdCZWxpemUgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NBRCcsICduYW1lJyA6ICdDYW5hZGEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NERicsICduYW1lJyA6ICdDb25nby9LaW5zaGFzYSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDSEYnLCAnbmFtZScgOiAnU3dpdHplcmxhbmQgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ0xQJywgJ25hbWUnIDogJ0NoaWxlIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ05ZJywgJ25hbWUnIDogJ0NoaW5hIFl1YW4gUmVubWluYmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ09QJywgJ25hbWUnIDogJ0NvbG9tYmlhIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1JDJywgJ25hbWUnIDogJ0Nvc3RhIFJpY2EgQ29sb24nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1VDJywgJ25hbWUnIDogJ0N1YmEgQ29udmVydGlibGUgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDVVAnLCAnbmFtZScgOiAnQ3ViYSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NWRScsICduYW1lJyA6ICdDYXBlIFZlcmRlIEVzY3Vkbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDWksnLCAnbmFtZScgOiAnQ3plY2ggUmVwdWJsaWMgS29ydW5hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0RKRicsICduYW1lJyA6ICdEamlib3V0aSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdES0snLCAnbmFtZScgOiAnRGVubWFyayBLcm9uZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdET1AnLCAnbmFtZScgOiAnRG9taW5pY2FuIFJlcHVibGljIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRFpEJywgJ25hbWUnIDogJ0FsZ2VyaWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRUdQJywgJ25hbWUnIDogJ0VneXB0IFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0VSTicsICduYW1lJyA6ICdFcml0cmVhIE5ha2ZhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0VUQicsICduYW1lJyA6ICdFdGhpb3BpYSBCaXJyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0VVUicsICduYW1lJyA6ICdFdXJvIE1lbWJlciBDb3VudHJpZXMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRkpEJywgJ25hbWUnIDogJ0ZpamkgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0ZLUCcsICduYW1lJyA6ICdGYWxrbGFuZCBJc2xhbmRzIChNYWx2aW5hcykgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR0JQJywgJ25hbWUnIDogJ1VuaXRlZCBLaW5nZG9tIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dFTCcsICduYW1lJyA6ICdHZW9yZ2lhIExhcmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR0dQJywgJ25hbWUnIDogJ0d1ZXJuc2V5IFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dIUycsICduYW1lJyA6ICdHaGFuYSBDZWRpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dJUCcsICduYW1lJyA6ICdHaWJyYWx0YXIgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR01EJywgJ25hbWUnIDogJ0dhbWJpYSBEYWxhc2knfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR05GJywgJ25hbWUnIDogJ0d1aW5lYSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHVFEnLCAnbmFtZScgOiAnR3VhdGVtYWxhIFF1ZXR6YWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR1lEJywgJ25hbWUnIDogJ0d1eWFuYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSEtEJywgJ25hbWUnIDogJ0hvbmcgS29uZyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSE5MJywgJ25hbWUnIDogJ0hvbmR1cmFzIExlbXBpcmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSFJLJywgJ25hbWUnIDogJ0Nyb2F0aWEgS3VuYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdIVEcnLCAnbmFtZScgOiAnSGFpdGkgR291cmRlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hVRicsICduYW1lJyA6ICdIdW5nYXJ5IEZvcmludCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJRFInLCAnbmFtZScgOiAnSW5kb25lc2lhIFJ1cGlhaCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJTFMnLCAnbmFtZScgOiAnSXNyYWVsIFNoZWtlbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJTVAnLCAnbmFtZScgOiAnSXNsZSBvZiBNYW4gUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSU5SJywgJ25hbWUnIDogJ0luZGlhIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lRRCcsICduYW1lJyA6ICdJcmFxIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lSUicsICduYW1lJyA6ICdJcmFuIFJpYWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSVNLJywgJ25hbWUnIDogJ0ljZWxhbmQgS3JvbmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSkVQJywgJ25hbWUnIDogJ0plcnNleSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdKTUQnLCAnbmFtZScgOiAnSmFtYWljYSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSk9EJywgJ25hbWUnIDogJ0pvcmRhbiBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdKUFknLCAnbmFtZScgOiAnSmFwYW4gWWVuJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tFUycsICduYW1lJyA6ICdLZW55YSBTaGlsbGluZyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLR1MnLCAnbmFtZScgOiAnS3lyZ3l6c3RhbiBTb20nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS0hSJywgJ25hbWUnIDogJ0NhbWJvZGlhIFJpZWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS01GJywgJ25hbWUnIDogJ0NvbW9yb3MgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1BXJywgJ25hbWUnIDogJ0tvcmVhIChOb3J0aCkgV29uJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tSVycsICduYW1lJyA6ICdLb3JlYSAoU291dGgpIFdvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLV0QnLCAnbmFtZScgOiAnS3V3YWl0IERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tZRCcsICduYW1lJyA6ICdDYXltYW4gSXNsYW5kcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1pUJywgJ25hbWUnIDogJ0themFraHN0YW4gVGVuZ2UnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTEFLJywgJ25hbWUnIDogJ0xhb3MgS2lwJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xCUCcsICduYW1lJyA6ICdMZWJhbm9uIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xLUicsICduYW1lJyA6ICdTcmkgTGFua2EgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTFJEJywgJ25hbWUnIDogJ0xpYmVyaWEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xTTCcsICduYW1lJyA6ICdMZXNvdGhvIExvdGknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTFRMJywgJ25hbWUnIDogJ0xpdGh1YW5pYSBMaXRhcyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMWUQnLCAnbmFtZScgOiAnTGlieWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTUFEJywgJ25hbWUnIDogJ01vcm9jY28gRGlyaGFtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01ETCcsICduYW1lJyA6ICdNb2xkb3ZhIExldSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNR0EnLCAnbmFtZScgOiAnTWFkYWdhc2NhciBBcmlhcnknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTUtEJywgJ25hbWUnIDogJ01hY2Vkb25pYSBEZW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNTUsnLCAnbmFtZScgOiAnTXlhbm1hciAoQnVybWEpIEt5YXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTU5UJywgJ25hbWUnIDogJ01vbmdvbGlhIFR1Z2hyaWsnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTU9QJywgJ25hbWUnIDogJ01hY2F1IFBhdGFjYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNUk8nLCAnbmFtZScgOiAnTWF1cml0YW5pYSBPdWd1aXlhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01VUicsICduYW1lJyA6ICdNYXVyaXRpdXMgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVZSJywgJ25hbWUnIDogJ01hbGRpdmVzIChNYWxkaXZlIElzbGFuZHMpIFJ1Zml5YWEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVdLJywgJ25hbWUnIDogJ01hbGF3aSBLd2FjaGEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVhOJywgJ25hbWUnIDogJ01leGljbyBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01ZUicsICduYW1lJyA6ICdNYWxheXNpYSBSaW5nZ2l0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01aTicsICduYW1lJyA6ICdNb3phbWJpcXVlIE1ldGljYWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTkFEJywgJ25hbWUnIDogJ05hbWliaWEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05HTicsICduYW1lJyA6ICdOaWdlcmlhIE5haXJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05JTycsICduYW1lJyA6ICdOaWNhcmFndWEgQ29yZG9iYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOT0snLCAnbmFtZScgOiAnTm9yd2F5IEtyb25lJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05QUicsICduYW1lJyA6ICdOZXBhbCBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOWkQnLCAnbmFtZScgOiAnTmV3IFplYWxhbmQgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ09NUicsICduYW1lJyA6ICdPbWFuIFJpYWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUEFCJywgJ25hbWUnIDogJ1BhbmFtYSBCYWxib2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUEVOJywgJ25hbWUnIDogJ1BlcnUgTnVldm8gU29sJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BHSycsICduYW1lJyA6ICdQYXB1YSBOZXcgR3VpbmVhIEtpbmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUEhQJywgJ25hbWUnIDogJ1BoaWxpcHBpbmVzIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUEtSJywgJ25hbWUnIDogJ1Bha2lzdGFuIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BMTicsICduYW1lJyA6ICdQb2xhbmQgWmxvdHknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUFlHJywgJ25hbWUnIDogJ1BhcmFndWF5IEd1YXJhbmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUUFSJywgJ25hbWUnIDogJ1FhdGFyIFJpeWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1JPTicsICduYW1lJyA6ICdSb21hbmlhIE5ldyBMZXUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUlNEJywgJ25hbWUnIDogJ1NlcmJpYSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdSVUInLCAnbmFtZScgOiAnUnVzc2lhIFJ1YmxlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1JXRicsICduYW1lJyA6ICdSd2FuZGEgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0FSJywgJ25hbWUnIDogJ1NhdWRpIEFyYWJpYSBSaXlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTQkQnLCAnbmFtZScgOiAnU29sb21vbiBJc2xhbmRzIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTQ1InLCAnbmFtZScgOiAnU2V5Y2hlbGxlcyBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTREcnLCAnbmFtZScgOiAnU3VkYW4gUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0VLJywgJ25hbWUnIDogJ1N3ZWRlbiBLcm9uYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTR0QnLCAnbmFtZScgOiAnU2luZ2Fwb3JlIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTSFAnLCAnbmFtZScgOiAnU2FpbnQgSGVsZW5hIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NMTCcsICduYW1lJyA6ICdTaWVycmEgTGVvbmUgTGVvbmUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU09TJywgJ25hbWUnIDogJ1NvbWFsaWEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1BMJywgJ25hbWUnIDogJ1NlYm9yZ2EgTHVpZ2lubyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTUkQnLCAnbmFtZScgOiAnU3VyaW5hbWUgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NURCcsICduYW1lJyA6ICdTw6NvIFRvbcOpIGFuZCBQcsOtbmNpcGUgRG9icmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1ZDJywgJ25hbWUnIDogJ0VsIFNhbHZhZG9yIENvbG9uJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NZUCcsICduYW1lJyA6ICdTeXJpYSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTWkwnLCAnbmFtZScgOiAnU3dhemlsYW5kIExpbGFuZ2VuaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUSEInLCAnbmFtZScgOiAnVGhhaWxhbmQgQmFodCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUSlMnLCAnbmFtZScgOiAnVGFqaWtpc3RhbiBTb21vbmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVE1UJywgJ25hbWUnIDogJ1R1cmttZW5pc3RhbiBNYW5hdCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUTkQnLCAnbmFtZScgOiAnVHVuaXNpYSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUT1AnLCAnbmFtZScgOiAnVG9uZ2EgUGFcXCdhbmdhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RSWScsICduYW1lJyA6ICdUdXJrZXkgTGlyYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUVEQnLCAnbmFtZScgOiAnVHJpbmlkYWQgYW5kIFRvYmFnbyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFZEJywgJ25hbWUnIDogJ1R1dmFsdSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFdEJywgJ25hbWUnIDogJ1RhaXdhbiBOZXcgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RaUycsICduYW1lJyA6ICdUYW56YW5pYSBTaGlsbGluZyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVQUgnLCAnbmFtZScgOiAnVWtyYWluZSBIcnl2bmlhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VHWCcsICduYW1lJyA6ICdVZ2FuZGEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVVNEJywgJ25hbWUnIDogJ1VuaXRlZCBTdGF0ZXMgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VZVScsICduYW1lJyA6ICdVcnVndWF5IFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVVpTJywgJ25hbWUnIDogJ1V6YmVraXN0YW4gU29tJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1ZFRicsICduYW1lJyA6ICdWZW5lenVlbGEgQm9saXZhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdWTkQnLCAnbmFtZScgOiAnVmlldCBOYW0gRG9uZyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdWVVYnLCAnbmFtZScgOiAnVmFudWF0dSBWYXR1J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1dTVCcsICduYW1lJyA6ICdTYW1vYSBUYWxhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hBRicsICduYW1lJyA6ICdDb21tdW5hdXTDqSBGaW5hbmNpw6hyZSBBZnJpY2FpbmUgKEJFQUMpIENGQSBGcmFuYyBCRUFDJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hDRCcsICduYW1lJyA6ICdFYXN0IENhcmliYmVhbiBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWERSJywgJ25hbWUnIDogJ0ludGVybmF0aW9uYWwgTW9uZXRhcnkgRnVuZCAoSU1GKSBTcGVjaWFsIERyYXdpbmcgUmlnaHRzJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hPRicsICduYW1lJyA6ICdDb21tdW5hdXTDqSBGaW5hbmNpw6hyZSBBZnJpY2FpbmUgKEJDRUFPKSBGcmFuYyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYUEYnLCAnbmFtZScgOiAnQ29tcHRvaXJzIEZyYW7Dp2FpcyBkdSBQYWNpZmlxdWUgKENGUCkgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWUVSJywgJ25hbWUnIDogJ1llbWVuIFJpYWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWkFSJywgJ25hbWUnIDogJ1NvdXRoIEFmcmljYSBSYW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1pNVycsICduYW1lJyA6ICdaYW1iaWEgS3dhY2hhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1pXRCcsICduYW1lJyA6ICdaaW1iYWJ3ZSBEb2xsYXInfVxuICAgICAgICBdLFxuXG4gICAgICAgIC8vIHJldHVybiB0aGUgbmFtZXMgb2YgYWxsIHZhbGlkZSBjb2xvcnNcbiAgICAgICAgY29sb3JOYW1lcyA6IFsgIFwiQWxpY2VCbHVlXCIsIFwiQmxhY2tcIiwgXCJOYXZ5XCIsIFwiRGFya0JsdWVcIiwgXCJNZWRpdW1CbHVlXCIsIFwiQmx1ZVwiLCBcIkRhcmtHcmVlblwiLCBcIkdyZWVuXCIsIFwiVGVhbFwiLCBcIkRhcmtDeWFuXCIsIFwiRGVlcFNreUJsdWVcIiwgXCJEYXJrVHVycXVvaXNlXCIsIFwiTWVkaXVtU3ByaW5nR3JlZW5cIiwgXCJMaW1lXCIsIFwiU3ByaW5nR3JlZW5cIixcbiAgICAgICAgICAgIFwiQXF1YVwiLCBcIkN5YW5cIiwgXCJNaWRuaWdodEJsdWVcIiwgXCJEb2RnZXJCbHVlXCIsIFwiTGlnaHRTZWFHcmVlblwiLCBcIkZvcmVzdEdyZWVuXCIsIFwiU2VhR3JlZW5cIiwgXCJEYXJrU2xhdGVHcmF5XCIsIFwiTGltZUdyZWVuXCIsIFwiTWVkaXVtU2VhR3JlZW5cIiwgXCJUdXJxdW9pc2VcIiwgXCJSb3lhbEJsdWVcIiwgXCJTdGVlbEJsdWVcIiwgXCJEYXJrU2xhdGVCbHVlXCIsIFwiTWVkaXVtVHVycXVvaXNlXCIsXG4gICAgICAgICAgICBcIkluZGlnb1wiLCBcIkRhcmtPbGl2ZUdyZWVuXCIsIFwiQ2FkZXRCbHVlXCIsIFwiQ29ybmZsb3dlckJsdWVcIiwgXCJSZWJlY2NhUHVycGxlXCIsIFwiTWVkaXVtQXF1YU1hcmluZVwiLCBcIkRpbUdyYXlcIiwgXCJTbGF0ZUJsdWVcIiwgXCJPbGl2ZURyYWJcIiwgXCJTbGF0ZUdyYXlcIiwgXCJMaWdodFNsYXRlR3JheVwiLCBcIk1lZGl1bVNsYXRlQmx1ZVwiLCBcIkxhd25HcmVlblwiLCBcIkNoYXJ0cmV1c2VcIixcbiAgICAgICAgICAgIFwiQXF1YW1hcmluZVwiLCBcIk1hcm9vblwiLCBcIlB1cnBsZVwiLCBcIk9saXZlXCIsIFwiR3JheVwiLCBcIlNreUJsdWVcIiwgXCJMaWdodFNreUJsdWVcIiwgXCJCbHVlVmlvbGV0XCIsIFwiRGFya1JlZFwiLCBcIkRhcmtNYWdlbnRhXCIsIFwiU2FkZGxlQnJvd25cIiwgXCJJdm9yeVwiLCBcIldoaXRlXCIsXG4gICAgICAgICAgICBcIkRhcmtTZWFHcmVlblwiLCBcIkxpZ2h0R3JlZW5cIiwgXCJNZWRpdW1QdXJwbGVcIiwgXCJEYXJrVmlvbGV0XCIsIFwiUGFsZUdyZWVuXCIsIFwiRGFya09yY2hpZFwiLCBcIlllbGxvd0dyZWVuXCIsIFwiU2llbm5hXCIsIFwiQnJvd25cIiwgXCJEYXJrR3JheVwiLCBcIkxpZ2h0Qmx1ZVwiLCBcIkdyZWVuWWVsbG93XCIsIFwiUGFsZVR1cnF1b2lzZVwiLCBcIkxpZ2h0U3RlZWxCbHVlXCIsIFwiUG93ZGVyQmx1ZVwiLFxuICAgICAgICAgICAgXCJGaXJlQnJpY2tcIiwgXCJEYXJrR29sZGVuUm9kXCIsIFwiTWVkaXVtT3JjaGlkXCIsIFwiUm9zeUJyb3duXCIsIFwiRGFya0toYWtpXCIsIFwiU2lsdmVyXCIsIFwiTWVkaXVtVmlvbGV0UmVkXCIsIFwiSW5kaWFuUmVkXCIsIFwiUGVydVwiLCBcIkNob2NvbGF0ZVwiLCBcIlRhblwiLCBcIkxpZ2h0R3JheVwiLCBcIlRoaXN0bGVcIiwgXCJPcmNoaWRcIiwgXCJHb2xkZW5Sb2RcIiwgXCJQYWxlVmlvbGV0UmVkXCIsXG4gICAgICAgICAgICBcIkNyaW1zb25cIiwgXCJHYWluc2Jvcm9cIiwgXCJQbHVtXCIsIFwiQnVybHlXb29kXCIsIFwiTGlnaHRDeWFuXCIsIFwiTGF2ZW5kZXJcIiwgXCJEYXJrU2FsbW9uXCIsIFwiVmlvbGV0XCIsIFwiUGFsZUdvbGRlblJvZFwiLCBcIkxpZ2h0Q29yYWxcIiwgXCJLaGFraVwiLCBcIkFsaWNlQmx1ZVwiLCBcIkhvbmV5RGV3XCIsIFwiQXp1cmVcIiwgXCJTYW5keUJyb3duXCIsIFwiV2hlYXRcIiwgXCJCZWlnZVwiLCBcIldoaXRlU21va2VcIixcbiAgICAgICAgICAgIFwiTWludENyZWFtXCIsIFwiR2hvc3RXaGl0ZVwiLCBcIlNhbG1vblwiLCBcIkFudGlxdWVXaGl0ZVwiLCBcIkxpbmVuXCIsIFwiTGlnaHRHb2xkZW5Sb2RZZWxsb3dcIiwgXCJPbGRMYWNlXCIsIFwiUmVkXCIsIFwiRnVjaHNpYVwiLCBcIk1hZ2VudGFcIiwgXCJEZWVwUGlua1wiLCBcIk9yYW5nZVJlZFwiLCBcIlRvbWF0b1wiLCBcIkhvdFBpbmtcIiwgXCJDb3JhbFwiLCBcIkRhcmtPcmFuZ2VcIiwgXCJMaWdodFNhbG1vblwiLCBcIk9yYW5nZVwiLFxuICAgICAgICAgICAgXCJMaWdodFBpbmtcIiwgXCJQaW5rXCIsIFwiR29sZFwiLCBcIlBlYWNoUHVmZlwiLCBcIk5hdmFqb1doaXRlXCIsIFwiTW9jY2FzaW5cIiwgXCJCaXNxdWVcIiwgXCJNaXN0eVJvc2VcIiwgXCJCbGFuY2hlZEFsbW9uZFwiLCBcIlBhcGF5YVdoaXBcIiwgXCJMYXZlbmRlckJsdXNoXCIsIFwiU2VhU2hlbGxcIiwgXCJDb3Juc2lsa1wiLCBcIkxlbW9uQ2hpZmZvblwiLCBcIkZsb3JhbFdoaXRlXCIsIFwiU25vd1wiLCBcIlllbGxvd1wiLCBcIkxpZ2h0WWVsbG93XCJcbiAgICAgICAgXSxcblxuICAgICAgICBmaWxlRXh0ZW5zaW9uIDoge1xuICAgICAgICAgICAgXCJyYXN0ZXJcIiAgICA6IFtcImJtcFwiLCBcImdpZlwiLCBcImdwbFwiLCBcImljb1wiLCBcImpwZWdcIiwgXCJwc2RcIiwgXCJwbmdcIiwgXCJwc3BcIiwgXCJyYXdcIiwgXCJ0aWZmXCJdLFxuICAgICAgICAgICAgXCJ2ZWN0b3JcIiAgICA6IFtcIjNkdlwiLCBcImFtZlwiLCBcImF3Z1wiLCBcImFpXCIsIFwiY2dtXCIsIFwiY2RyXCIsIFwiY214XCIsIFwiZHhmXCIsIFwiZTJkXCIsIFwiZWd0XCIsIFwiZXBzXCIsIFwiZnNcIiwgXCJvZGdcIiwgXCJzdmdcIiwgXCJ4YXJcIl0sXG4gICAgICAgICAgICBcIjNkXCIgICAgICAgIDogW1wiM2RtZlwiLCBcIjNkbVwiLCBcIjNtZlwiLCBcIjNkc1wiLCBcImFuOFwiLCBcImFvaVwiLCBcImJsZW5kXCIsIFwiY2FsM2RcIiwgXCJjb2JcIiwgXCJjdG1cIiwgXCJpb2JcIiwgXCJqYXNcIiwgXCJtYXhcIiwgXCJtYlwiLCBcIm1keFwiLCBcIm9ialwiLCBcInhcIiwgXCJ4M2RcIl0sXG4gICAgICAgICAgICBcImRvY3VtZW50XCIgIDogW1wiZG9jXCIsIFwiZG9jeFwiLCBcImRvdFwiLCBcImh0bWxcIiwgXCJ4bWxcIiwgXCJvZHRcIiwgXCJvZG1cIiwgXCJvdHRcIiwgXCJjc3ZcIiwgXCJydGZcIiwgXCJ0ZXhcIiwgXCJ4aHRtbFwiLCBcInhwc1wiXVxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZG1maWxpcGVua28vdGltZXpvbmVzLmpzb24vYmxvYi9tYXN0ZXIvdGltZXpvbmVzLmpzb25cbiAgICAgICAgdGltZXpvbmVzOiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkRhdGVsaW5lIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0xMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0xMjowMCkgSW50ZXJuYXRpb25hbCBEYXRlIExpbmUgV2VzdFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzEyXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVRDLTExXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTExLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTExOjAwKSBDb29yZGluYXRlZCBVbml2ZXJzYWwgVGltZS0xMVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzExXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL01pZHdheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9OaXVlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1BhZ29fUGFnb1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkhhd2FpaWFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiSFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0xMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0xMDowMCkgSGF3YWlpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrMTBcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvSG9ub2x1bHVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvSm9obnN0b25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvUmFyb3RvbmdhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1RhaGl0aVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFsYXNrYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBS0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC04LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDk6MDApIEFsYXNrYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FuY2hvcmFnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9KdW5lYXVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTm9tZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TaXRrYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9ZYWt1dGF0XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUGFjaWZpYyBTdGFuZGFyZCBUaW1lIChNZXhpY28pXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlBEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA4OjAwKSBCYWphIENhbGlmb3JuaWFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TYW50YV9Jc2FiZWxcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJQYWNpZmljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUERUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC03LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDg6MDApIFBhY2lmaWMgVGltZSAoVVMgJiBDYW5hZGEpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRGF3c29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0xvc19BbmdlbGVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1RpanVhbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVmFuY291dmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1doaXRlaG9yc2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBTVDhQRFRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVUyBNb3VudGFpbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVNU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTcsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDc6MDApIEFyaXpvbmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DcmVzdG9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0Rhd3Nvbl9DcmVla1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9IZXJtb3NpbGxvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Bob2VuaXhcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrN1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1vdW50YWluIFN0YW5kYXJkIFRpbWUgKE1leGljbylcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC02LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDc6MDApIENoaWh1YWh1YSwgTGEgUGF6LCBNYXphdGxhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NoaWh1YWh1YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYXphdGxhblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1vdW50YWluIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC02LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDc6MDApIE1vdW50YWluIFRpbWUgKFVTICYgQ2FuYWRhKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JvaXNlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NhbWJyaWRnZV9CYXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRGVudmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0VkbW9udG9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0ludXZpa1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9PamluYWdhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1llbGxvd2tuaWZlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJNU1Q3TURUXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBBbWVyaWNhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNjowMCkgQ2VudHJhbCBBbWVyaWNhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmVsaXplXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0Nvc3RhX1JpY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRWxfU2FsdmFkb3JcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3VhdGVtYWxhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hbmFndWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVGVndWNpZ2FscGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrNlwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9HYWxhcGFnb3NcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC01LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDY6MDApIENlbnRyYWwgVGltZSAoVVMgJiBDYW5hZGEpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2hpY2Fnb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL0tub3hcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9UZWxsX0NpdHlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWF0YW1vcm9zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01lbm9taW5lZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ob3J0aF9EYWtvdGEvQmV1bGFoXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05vcnRoX0Rha290YS9DZW50ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTm9ydGhfRGFrb3RhL05ld19TYWxlbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SYWlueV9SaXZlclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SYW5raW5fSW5sZXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmVzb2x1dGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvV2lubmlwZWdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkNTVDZDRFRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIFN0YW5kYXJkIFRpbWUgKE1leGljbylcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC01LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDY6MDApIEd1YWRhbGFqYXJhLCBNZXhpY28gQ2l0eSwgTW9udGVycmV5XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmFoaWFfQmFuZGVyYXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2FuY3VuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01lcmlkYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NZXhpY29fQ2l0eVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Nb250ZXJyZXlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDYW5hZGEgQ2VudHJhbCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNDU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDY6MDApIFNhc2thdGNoZXdhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1JlZ2luYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Td2lmdF9DdXJyZW50XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU0EgUGFjaWZpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNQU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDU6MDApIEJvZ290YSwgTGltYSwgUXVpdG9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Cb2dvdGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2F5bWFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NvcmFsX0hhcmJvdXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRWlydW5lcGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3VheWFxdWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0phbWFpY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTGltYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9QYW5hbWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmlvX0JyYW5jb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCs1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRWFzdGVybiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA1OjAwKSBFYXN0ZXJuIFRpbWUgKFVTICYgQ2FuYWRhKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0RldHJvaXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSGF2YW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvUGV0ZXJzYnVyZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL1ZpbmNlbm5lc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL1dpbmFtYWNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSXFhbHVpdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9LZW50dWNreS9Nb250aWNlbGxvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0xvdWlzdmlsbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTW9udHJlYWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTmFzc2F1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05ld19Zb3JrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05pcGlnb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUGFuZ25pcnR1bmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUG9ydC1hdS1QcmluY2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVGh1bmRlcl9CYXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVG9yb250b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRVNUNUVEVFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVTIEVhc3Rlcm4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDU6MDApIEluZGlhbmEgKEVhc3QpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9NYXJlbmdvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvVmV2YXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYXBvbGlzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVmVuZXp1ZWxhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MzApIENhcmFjYXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYXJhY2FzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUGFyYWd1YXkgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJQU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MDApIEFzdW5jaW9uXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXN1bmNpb25cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBdGxhbnRpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjAwKSBBdGxhbnRpYyBUaW1lIChDYW5hZGEpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR2xhY2VfQmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0dvb3NlX0JheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9IYWxpZmF4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01vbmN0b25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvVGh1bGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL0Jlcm11ZGFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIEJyYXppbGlhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNCU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MDApIEN1aWFiYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NhbXBvX0dyYW5kZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DdWlhYmFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTQSBXZXN0ZXJuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU1dTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDowMCkgR2VvcmdldG93biwgTGEgUGF6LCBNYW5hdXMsIFNhbiBKdWFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQW5ndWlsbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQW50aWd1YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcnViYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CYXJiYWRvc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CbGFuYy1TYWJsb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQm9hX1Zpc3RhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0N1cmFjYW9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRG9taW5pY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3JhbmRfVHVya1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HcmVuYWRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0d1YWRlbG91cGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3V5YW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0tyYWxlbmRpamtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTGFfUGF6XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0xvd2VyX1ByaW5jZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWFuYXVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hcmlnb3RcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWFydGluaXF1ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Nb250c2VycmF0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BvcnRfb2ZfU3BhaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUG9ydG9fVmVsaG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUHVlcnRvX1JpY29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2FudG9fRG9taW5nb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9CYXJ0aGVsZW15XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X0tpdHRzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X0x1Y2lhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X1Rob21hc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9WaW5jZW50XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1RvcnRvbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrNFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlBhY2lmaWMgU0EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJQU1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjAwKSBTYW50aWFnb1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1NhbnRpYWdvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL1BhbG1lclwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5ld2ZvdW5kbGFuZCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5EVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMi41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MzApIE5ld2ZvdW5kbGFuZFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1N0X0pvaG5zXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRS4gU291dGggQW1lcmljYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVTQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBCcmFzaWxpYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Nhb19QYXVsb1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFyZ2VudGluYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgQnVlbm9zIEFpcmVzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL0xhX1Jpb2phXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9SaW9fR2FsbGVnb3NcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1NhbHRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9TYW5fSnVhblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvU2FuX0x1aXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1R1Y3VtYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1VzaHVhaWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQnVlbm9zX0FpcmVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NhdGFtYXJjYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Db3Jkb2JhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0p1anV5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01lbmRvemFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTQSBFYXN0ZXJuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU0VTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgQ2F5ZW5uZSwgRm9ydGFsZXphXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJhZ3VhaW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JlbGVtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NheWVubmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRm9ydGFsZXphXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hY2Vpb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9QYXJhbWFyaWJvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1JlY2lmZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TYW50YXJlbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9Sb3RoZXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9TdGFubGV5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJHcmVlbmxhbmQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJHRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgR3JlZW5sYW5kXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR29kdGhhYlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1vbnRldmlkZW8gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIE1vbnRldmlkZW9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Nb250ZXZpZGVvXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQmFoaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJCU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIFNhbHZhZG9yXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmFoaWFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVVEMtMDJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVVwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMjowMCkgQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWUtMDJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ob3JvbmhhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9Tb3V0aF9HZW9yZ2lhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNaWQtQXRsYW50aWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMjowMCkgTWlkLUF0bGFudGljIC0gT2xkXCJcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkF6b3JlcyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDE6MDApIEF6b3Jlc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Njb3Jlc2J5c3VuZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvQXpvcmVzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2FwZSBWZXJkZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNWU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDE6MDApIENhcGUgVmVyZGUgSXMuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL0NhcGVfVmVyZGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrMVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1vcm9jY28gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKSBDYXNhYmxhbmNhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9DYXNhYmxhbmNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRWxfQWFpdW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVVENcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ1VUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMpIENvb3JkaW5hdGVkIFVuaXZlcnNhbCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvRGFubWFya3NoYXZuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiR01UIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiR0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQykgRHVibGluLCBFZGluYnVyZ2gsIExpc2JvbiwgTG9uZG9uXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL0NhbmFyeVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvRmFlcm9lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9NYWRlaXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvRHVibGluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvR3Vlcm5zZXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Jc2xlX29mX01hblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0plcnNleVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0xpc2JvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0xvbmRvblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkdyZWVud2ljaCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkdTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKSBNb25yb3ZpYSwgUmV5a2phdmlrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9BYmlkamFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQWNjcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CYW1ha29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CYW5qdWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CaXNzYXVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Db25ha3J5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRGFrYXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9GcmVldG93blwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0xvbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Nb25yb3ZpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL05vdWFrY2hvdHRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9PdWFnYWRvdWdvdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL1Nhb19Ub21lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9SZXlramF2aWtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL1N0X0hlbGVuYVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlcuIEV1cm9wZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIldFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBBbXN0ZXJkYW0sIEJlcmxpbiwgQmVybiwgUm9tZSwgU3RvY2tob2xtLCBWaWVubmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXJjdGljL0xvbmd5ZWFyYnllblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0Ftc3RlcmRhbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0FuZG9ycmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CZXJsaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CdXNpbmdlblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0dpYnJhbHRhclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0x1eGVtYm91cmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9NYWx0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01vbmFjb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL09zbG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Sb21lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU2FuX01hcmlub1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1N0b2NraG9sbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ZhZHV6XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVmF0aWNhblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ZpZW5uYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1p1cmljaFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgRXVyb3BlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0VEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIEJlbGdyYWRlLCBCcmF0aXNsYXZhLCBCdWRhcGVzdCwgTGp1YmxqYW5hLCBQcmFndWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0JlbGdyYWRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQnJhdGlzbGF2YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0J1ZGFwZXN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTGp1YmxqYW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvUG9kZ29yaWNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvUHJhZ3VlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVGlyYW5lXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUm9tYW5jZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlJEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIEJydXNzZWxzLCBDb3BlbmhhZ2VuLCBNYWRyaWQsIFBhcmlzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9DZXV0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0JydXNzZWxzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQ29wZW5oYWdlblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01hZHJpZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1BhcmlzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBTYXJhamV2bywgU2tvcGplLCBXYXJzYXcsIFphZ3JlYlwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU2FyYWpldm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Ta29wamVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9XYXJzYXdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9aYWdyZWJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJXLiBDZW50cmFsIEFmcmljYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIldDQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIFdlc3QgQ2VudHJhbCBBZnJpY2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0FsZ2llcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CYW5ndWlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CcmF6emF2aWxsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0RvdWFsYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0tpbnNoYXNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTGFnb3NcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9MaWJyZXZpbGxlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTHVhbmRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTWFsYWJvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTmRqYW1lbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9OaWFtZXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Qb3J0by1Ob3ZvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvVHVuaXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5hbWliaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgV2luZGhvZWtcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL1dpbmRob2VrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiR1RCIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiR0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgQXRoZW5zLCBCdWNoYXJlc3RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9OaWNvc2lhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQXRoZW5zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQnVjaGFyZXN0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQ2hpc2luYXVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNaWRkbGUgRWFzdCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1FRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBCZWlydXRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CZWlydXRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFZ3lwdCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBDYWlyb1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQ2Fpcm9cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTeXJpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIERhbWFzY3VzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvRGFtYXNjdXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFLiBFdXJvcGUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgRS4gRXVyb3BlXCJcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNvdXRoIEFmcmljYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgSGFyYXJlLCBQcmV0b3JpYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQmxhbnR5cmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9CdWp1bWJ1cmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9HYWJvcm9uZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0hhcmFyZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0pvaGFubmVzYnVyZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0tpZ2FsaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0x1YnVtYmFzaGlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9MdXNha2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9NYXB1dG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9NYXNlcnVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9NYmFiYW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJGTEUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJGRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBIZWxzaW5raSwgS3lpdiwgUmlnYSwgU29maWEsIFRhbGxpbm4sIFZpbG5pdXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0hlbHNpbmtpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvS2lldlwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01hcmllaGFtblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1JpZ2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Tb2ZpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1RhbGxpbm5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Vemhnb3JvZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ZpbG5pdXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9aYXBvcm96aHllXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVHVya2V5IFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVERUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgSXN0YW5idWxcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0lzdGFuYnVsXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSXNyYWVsIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiSkRUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgSmVydXNhbGVtXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSmVydXNhbGVtXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTGlieWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJMU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgVHJpcG9saVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvVHJpcG9saVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkpvcmRhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkpTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjAwKSBBbW1hblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FtbWFuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXJhYmljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MDApIEJhZ2hkYWRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CYWdoZGFkXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiS2FsaW5pbmdyYWQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJLU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzowMCkgS2FsaW5pbmdyYWQsIE1pbnNrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9LYWxpbmluZ3JhZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01pbnNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXJhYiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjAwKSBLdXdhaXQsIFJpeWFkaFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FkZW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmFocmFpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LdXdhaXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUWF0YXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUml5YWRoXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRS4gQWZyaWNhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRUFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjAwKSBOYWlyb2JpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9BZGRpc19BYmFiYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0FzbWVyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Rhcl9lc19TYWxhYW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Eamlib3V0aVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0p1YmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9LYW1wYWxhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvS2hhcnRvdW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Nb2dhZGlzaHVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9OYWlyb2JpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL1N5b3dhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9BbnRhbmFuYXJpdm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9Db21vcm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9NYXlvdHRlXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSXJhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIklEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzozMCkgVGVocmFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVGVocmFuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXJhYmlhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBBYnUgRGhhYmksIE11c2NhdFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0R1YmFpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL011c2NhdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC00XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXplcmJhaWphbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIEJha3VcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CYWt1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUnVzc2lhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlJTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBNb3Njb3csIFN0LiBQZXRlcnNidXJnLCBWb2xnb2dyYWRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL01vc2Nvd1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1NhbWFyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1NpbWZlcm9wb2xcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Wb2xnb2dyYWRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNYXVyaXRpdXMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgUG9ydCBMb3Vpc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vTWFoZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL01hdXJpdGl1c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL1JldW5pb25cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJHZW9yZ2lhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkdTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBUYmlsaXNpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVGJpbGlzaVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNhdWNhc3VzIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIFllcmV2YW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9ZZXJldmFuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQWZnaGFuaXN0YW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNC41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjMwKSBLYWJ1bFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0thYnVsXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiV2VzdCBBc2lhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiV0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA1OjAwKSBBc2hnYWJhdCwgVGFzaGtlbnRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9NYXdzb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQXF0YXVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQXF0b2JlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FzaGdhYmF0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0R1c2hhbmJlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL09yYWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2FtYXJrYW5kXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Rhc2hrZW50XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9LZXJndWVsZW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9NYWxkaXZlc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlBha2lzdGFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDU6MDApIElzbGFtYWJhZCwgS2FyYWNoaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0thcmFjaGlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJJbmRpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIklTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDU6MzApIENoZW5uYWksIEtvbGthdGEsIE11bWJhaSwgTmV3IERlbGhpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQ2FsY3V0dGFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTcmkgTGFua2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTTFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDUuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNTozMCkgU3JpIEpheWF3YXJkZW5lcHVyYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0NvbG9tYm9cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOZXBhbCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1Ljc1LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA1OjQ1KSBLYXRobWFuZHVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LYXRtYW5kdVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgQXNpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNjowMCkgQXN0YW5hXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvVm9zdG9rXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FsbWF0eVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CaXNoa2VrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1F5enlsb3JkYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9VcnVtcWlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtNlwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0NoYWdvc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkJhbmdsYWRlc2ggU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJCU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNjowMCkgRGhha2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9EaGFrYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9UaGltcGh1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRWthdGVyaW5idXJnIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDY6MDApIEVrYXRlcmluYnVyZ1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1lla2F0ZXJpbmJ1cmdcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNeWFubWFyIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDYuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNjozMCkgWWFuZ29uIChSYW5nb29uKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Jhbmdvb25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9Db2Nvc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNFIEFzaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDcsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDc6MDApIEJhbmdrb2ssIEhhbm9pLCBKYWthcnRhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvRGF2aXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmFuZ2tva1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Ib3ZkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0pha2FydGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUGhub21fUGVuaFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Qb250aWFuYWtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2FpZ29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1ZpZW50aWFuZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC03XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vQ2hyaXN0bWFzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTi4gQ2VudHJhbCBBc2lhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTkNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNzowMCkgTm92b3NpYmlyc2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Ob3Zva3V6bmV0c2tcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTm92b3NpYmlyc2tcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvT21za1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNoaW5hIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIEJlaWppbmcsIENob25ncWluZywgSG9uZyBLb25nLCBVcnVtcWlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Ib25nX0tvbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTWFjYXVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2hhbmdoYWlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOb3J0aCBBc2lhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBLcmFzbm95YXJza1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0tyYXNub3lhcnNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU2luZ2Fwb3JlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTVBTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBLdWFsYSBMdW1wdXIsIFNpbmdhcG9yZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0JydW5laVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LdWFsYV9MdW1wdXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS3VjaGluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9NYWthc3NhclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9NYW5pbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU2luZ2Fwb3JlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULThcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJXLiBBdXN0cmFsaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJXQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDgsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDg6MDApIFBlcnRoXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvQ2FzZXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9QZXJ0aFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlRhaXBlaSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlRTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBUYWlwZWlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9UYWlwZWlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVbGFhbmJhYXRhciBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBVbGFhbmJhYXRhclwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0Nob2liYWxzYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVWxhYW5iYWF0YXJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOb3J0aCBBc2lhIEVhc3QgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOQUVTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA5LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA5OjAwKSBJcmt1dHNrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSXJrdXRza1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlRva3lvIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDksXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDk6MDApIE9zYWthLCBTYXBwb3JvLCBUb2t5b1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0RpbGlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSmF5YXB1cmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVG9reW9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtOVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9QYWxhdVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIktvcmVhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiS1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDksXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDk6MDApIFNlb3VsXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUHlvbmd5YW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Nlb3VsXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VuLiBBdXN0cmFsaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDkuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswOTozMCkgQWRlbGFpZGVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0FkZWxhaWRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvQnJva2VuX0hpbGxcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBVVMgQ2VudHJhbCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFDU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOS41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA5OjMwKSBEYXJ3aW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0RhcndpblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkUuIEF1c3RyYWxpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTA6MDApIEJyaXNiYW5lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9CcmlzYmFuZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0xpbmRlbWFuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQVVTIEVhc3Rlcm4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBRVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEwOjAwKSBDYW5iZXJyYSwgTWVsYm91cm5lLCBTeWRuZXlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL01lbGJvdXJuZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL1N5ZG5leVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIldlc3QgUGFjaWZpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIldQU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTA6MDApIEd1YW0sIFBvcnQgTW9yZXNieVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL0R1bW9udERVcnZpbGxlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTEwXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0d1YW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvUG9ydF9Nb3Jlc2J5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1NhaXBhblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9UcnVrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVGFzbWFuaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJUU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTA6MDApIEhvYmFydFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvQ3VycmllXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvSG9iYXJ0XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiWWFrdXRzayBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIllTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMDowMCkgWWFrdXRza1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0NoaXRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0toYW5keWdhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1lha3V0c2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIFBhY2lmaWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDExLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzExOjAwKSBTb2xvbW9uIElzLiwgTmV3IENhbGVkb25pYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL01hY3F1YXJpZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0xMVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9FZmF0ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9HdWFkYWxjYW5hbFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Lb3NyYWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvTm91bWVhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1BvbmFwZVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlZsYWRpdm9zdG9rIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDExLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzExOjAwKSBWbGFkaXZvc3Rva1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Nha2hhbGluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1VzdC1OZXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1ZsYWRpdm9zdG9rXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTmV3IFplYWxhbmQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOWlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEyOjAwKSBBdWNrbGFuZCwgV2VsbGluZ3RvblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL01jTXVyZG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvQXVja2xhbmRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVVEMrMTJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVVwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMjowMCkgQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWUrMTJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0xMlwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9GdW5hZnV0aVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Ld2FqYWxlaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvTWFqdXJvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL05hdXJ1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1RhcmF3YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9XYWtlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1dhbGxpc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkZpamkgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJGU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTI6MDApIEZpamlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9GaWppXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTWFnYWRhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMjowMCkgTWFnYWRhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FuYWR5clwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LYW1jaGF0a2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTWFnYWRhblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TcmVkbmVrb2x5bXNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiS2FtY2hhdGthIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiS0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTI6MDApIFBldHJvcGF2bG92c2stS2FtY2hhdHNreSAtIE9sZFwiXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJUb25nYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlRTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMzowMCkgTnVrdSdhbG9mYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTEzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0VuZGVyYnVyeVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9GYWthb2ZvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1RvbmdhdGFwdVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNhbW9hIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEzOjAwKSBTYW1vYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0FwaWFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgLy9MaXN0IHNvdXJjZTogaHR0cDovL2Fuc3dlcnMuZ29vZ2xlLmNvbS9hbnN3ZXJzL3RocmVhZHZpZXcvaWQvNTg5MzEyLmh0bWxcbiAgICAgICAgcHJvZmVzc2lvbjogW1xuICAgICAgICAgICAgXCJBaXJsaW5lIFBpbG90XCIsXG4gICAgICAgICAgICBcIkFjYWRlbWljIFRlYW1cIixcbiAgICAgICAgICAgIFwiQWNjb3VudGFudFwiLFxuICAgICAgICAgICAgXCJBY2NvdW50IEV4ZWN1dGl2ZVwiLFxuICAgICAgICAgICAgXCJBY3RvclwiLFxuICAgICAgICAgICAgXCJBY3R1YXJ5XCIsXG4gICAgICAgICAgICBcIkFjcXVpc2l0aW9uIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiQWRtaW5pc3RyYXRpdmUgQXNzdC5cIixcbiAgICAgICAgICAgIFwiQWRtaW5pc3RyYXRpdmUgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIkFkdmVydGlzaW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkFlcm9zcGFjZSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJBZ2VudFwiLFxuICAgICAgICAgICAgXCJBZ3JpY3VsdHVyYWwgSW5zcGVjdG9yXCIsXG4gICAgICAgICAgICBcIkFncmljdWx0dXJhbCBTY2llbnRpc3RcIixcbiAgICAgICAgICAgIFwiQWlyIFRyYWZmaWMgQ29udHJvbGxlclwiLFxuICAgICAgICAgICAgXCJBbmltYWwgVHJhaW5lclwiLFxuICAgICAgICAgICAgXCJBbnRocm9wb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJBcHByYWlzZXJcIixcbiAgICAgICAgICAgIFwiQXJjaGl0ZWN0XCIsXG4gICAgICAgICAgICBcIkFydCBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJBcnRpc3RcIixcbiAgICAgICAgICAgIFwiQXN0cm9ub21lclwiLFxuICAgICAgICAgICAgXCJBdGhsZXRpYyBDb2FjaFwiLFxuICAgICAgICAgICAgXCJBdWRpdG9yXCIsXG4gICAgICAgICAgICBcIkF1dGhvclwiLFxuICAgICAgICAgICAgXCJCYWtlclwiLFxuICAgICAgICAgICAgXCJCYW5rZXJcIixcbiAgICAgICAgICAgIFwiQmFua3J1cHRjeSBBdHRvcm5leVwiLFxuICAgICAgICAgICAgXCJCZW5lZml0cyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkJpb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJCaW8tZmVlZGJhY2sgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJCaW9tZWRpY2FsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkJpb3RlY2huaWNhbCBSZXNlYXJjaGVyXCIsXG4gICAgICAgICAgICBcIkJyb2FkY2FzdGVyXCIsXG4gICAgICAgICAgICBcIkJyb2tlclwiLFxuICAgICAgICAgICAgXCJCdWlsZGluZyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkJ1aWxkaW5nIENvbnRyYWN0b3JcIixcbiAgICAgICAgICAgIFwiQnVpbGRpbmcgSW5zcGVjdG9yXCIsXG4gICAgICAgICAgICBcIkJ1c2luZXNzIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiQnVzaW5lc3MgUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJCdXNpbmVzcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkJ1eWVyXCIsXG4gICAgICAgICAgICBcIkNhbGwgQ2VudGVyIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2FyZWVyIENvdW5zZWxvclwiLFxuICAgICAgICAgICAgXCJDYXNoIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2VyYW1pYyBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDaGllZiBFeGVjdXRpdmUgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDaGllZiBPcGVyYXRpb24gT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDaGVmXCIsXG4gICAgICAgICAgICBcIkNoZW1pY2FsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkNoZW1pc3RcIixcbiAgICAgICAgICAgIFwiQ2hpbGQgQ2FyZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNoaWVmIE1lZGljYWwgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDaGlyb3ByYWN0b3JcIixcbiAgICAgICAgICAgIFwiQ2luZW1hdG9ncmFwaGVyXCIsXG4gICAgICAgICAgICBcIkNpdHkgSG91c2luZyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNpdHkgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDaXZpbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDbGFpbXMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDbGluaWNhbCBSZXNlYXJjaCBBc3Npc3RhbnRcIixcbiAgICAgICAgICAgIFwiQ29sbGVjdGlvbnMgTWFuYWdlci5cIixcbiAgICAgICAgICAgIFwiQ29tcGxpYW5jZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNvbXB0cm9sbGVyXCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ29tbWVyY2lhbCBBcnRpc3RcIixcbiAgICAgICAgICAgIFwiQ29tbXVuaWNhdGlvbnMgQWZmYWlycyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJDb21tdW5pY2F0aW9ucyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJDb21tdW5pY2F0aW9ucyBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDb21wZW5zYXRpb24gQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBQcm9ncmFtbWVyXCIsXG4gICAgICAgICAgICBcIkNvbXB1dGVyIE9wcy4gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBPcGVyYXRvclwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBHcmFwaGljcyBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIkNvbnN0cnVjdGlvbiBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDb25zdHJ1Y3Rpb24gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDb25zdWx0YW50XCIsXG4gICAgICAgICAgICBcIkNvbnN1bWVyIFJlbGF0aW9ucyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNvbnRyYWN0IEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiQ29weXJpZ2h0IEF0dG9ybmV5XCIsXG4gICAgICAgICAgICBcIkNvcHl3cml0ZXJcIixcbiAgICAgICAgICAgIFwiQ29ycG9yYXRlIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiQ29ycmVjdGlvbnMgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDb3NtZXRvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkNyZWRpdCBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkNydWlzZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJDaGllZiBJbmZvcm1hdGlvbiBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkNoaWVmIFRlY2hub2xvZ3kgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDdXN0b21lciBTZXJ2aWNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ3J5cHRvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkRhbmNlclwiLFxuICAgICAgICAgICAgXCJEYXRhIFNlY3VyaXR5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRGF0YWJhc2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJEYXkgQ2FyZSBJbnN0cnVjdG9yXCIsXG4gICAgICAgICAgICBcIkRlbnRpc3RcIixcbiAgICAgICAgICAgIFwiRGVzaWduZXJcIixcbiAgICAgICAgICAgIFwiRGVzaWduIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkRlc2t0b3AgUHVibGlzaGVyXCIsXG4gICAgICAgICAgICBcIkRldmVsb3BlclwiLFxuICAgICAgICAgICAgXCJEZXZlbG9wbWVudCBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkRpYW1vbmQgTWVyY2hhbnRcIixcbiAgICAgICAgICAgIFwiRGlldGl0aWFuXCIsXG4gICAgICAgICAgICBcIkRpcmVjdCBNYXJrZXRlclwiLFxuICAgICAgICAgICAgXCJEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJEaXN0cmlidXRpb24gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJEaXZlcnNpdHkgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJFY29ub21pc3RcIixcbiAgICAgICAgICAgIFwiRUVPIENvbXBsaWFuY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJFZGl0b3JcIixcbiAgICAgICAgICAgIFwiRWR1Y2F0aW9uIEFkbWluYXRvclwiLFxuICAgICAgICAgICAgXCJFbGVjdHJpY2FsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkVsZWN0cm8gT3B0aWNhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJFbGVjdHJvbmljcyBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJFbWJhc3N5IE1hbmFnZW1lbnRcIixcbiAgICAgICAgICAgIFwiRW1wbG95bWVudCBBZ2VudFwiLFxuICAgICAgICAgICAgXCJFbmdpbmVlciBUZWNobmljaWFuXCIsXG4gICAgICAgICAgICBcIkVudHJlcHJlbmV1clwiLFxuICAgICAgICAgICAgXCJFbnZpcm9ubWVudGFsIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiRW52aXJvbm1lbnRhbCBBdHRvcm5leVwiLFxuICAgICAgICAgICAgXCJFbnZpcm9ubWVudGFsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkVudmlyb25tZW50YWwgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJFc2Nyb3cgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJFc3RpbWF0b3JcIixcbiAgICAgICAgICAgIFwiRXhlY3V0aXZlIEFzc2lzdGFudFwiLFxuICAgICAgICAgICAgXCJFeGVjdXRpdmUgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiRXhlY3V0aXZlIFJlY3J1aXRlclwiLFxuICAgICAgICAgICAgXCJGYWNpbGl0aWVzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRmFtaWx5IENvdW5zZWxvclwiLFxuICAgICAgICAgICAgXCJGYXNoaW9uIEV2ZW50cyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkZhc2hpb24gTWVyY2hhbmRpc2VyXCIsXG4gICAgICAgICAgICBcIkZhc3QgRm9vZCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkZpbG0gUHJvZHVjZXJcIixcbiAgICAgICAgICAgIFwiRmlsbSBQcm9kdWN0aW9uIEFzc2lzdGFudFwiLFxuICAgICAgICAgICAgXCJGaW5hbmNpYWwgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJGaW5hbmNpYWwgUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJGaW5hbmNpZXJcIixcbiAgICAgICAgICAgIFwiRmluZSBBcnRpc3RcIixcbiAgICAgICAgICAgIFwiV2lsZGxpZmUgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJGaXRuZXNzIENvbnN1bHRhbnRcIixcbiAgICAgICAgICAgIFwiRmxpZ2h0IEF0dGVuZGFudFwiLFxuICAgICAgICAgICAgXCJGbGlnaHQgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRmxvcmFsIERlc2lnbmVyXCIsXG4gICAgICAgICAgICBcIkZvb2QgJiBCZXZlcmFnZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJGb29kIFNlcnZpY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJGb3Jlc3RyeSBUZWNobmljaWFuXCIsXG4gICAgICAgICAgICBcIkZyYW5jaGlzZSBNYW5hZ2VtZW50XCIsXG4gICAgICAgICAgICBcIkZyYW5jaGlzZSBTYWxlc1wiLFxuICAgICAgICAgICAgXCJGcmF1ZCBJbnZlc3RpZ2F0b3JcIixcbiAgICAgICAgICAgIFwiRnJlZWxhbmNlIFdyaXRlclwiLFxuICAgICAgICAgICAgXCJGdW5kIFJhaXNlclwiLFxuICAgICAgICAgICAgXCJHZW5lcmFsIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiR2VvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkdlbmVyYWwgQ291bnNlbFwiLFxuICAgICAgICAgICAgXCJHZXJpYXRyaWMgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJHZXJvbnRvbG9naXN0XCIsXG4gICAgICAgICAgICBcIkdsYW1vdXIgUGhvdG9ncmFwaGVyXCIsXG4gICAgICAgICAgICBcIkdvbGYgQ2x1YiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkdvdXJtZXQgQ2hlZlwiLFxuICAgICAgICAgICAgXCJHcmFwaGljIERlc2lnbmVyXCIsXG4gICAgICAgICAgICBcIkdyb3VuZHMgS2VlcGVyXCIsXG4gICAgICAgICAgICBcIkhhemFyZG91cyBXYXN0ZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkhlYWx0aCBDYXJlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSGVhbHRoIFRoZXJhcGlzdFwiLFxuICAgICAgICAgICAgXCJIZWFsdGggU2VydmljZSBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIkhlYXJpbmcgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJIb21lIEVjb25vbWlzdFwiLFxuICAgICAgICAgICAgXCJIb3J0aWN1bHR1cmlzdFwiLFxuICAgICAgICAgICAgXCJIb3NwaXRhbCBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIkhvdGVsIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSHVtYW4gUmVzb3VyY2VzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSW1wb3J0ZXJcIixcbiAgICAgICAgICAgIFwiSW5kdXN0cmlhbCBEZXNpZ25lclwiLFxuICAgICAgICAgICAgXCJJbmR1c3RyaWFsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkluZm9ybWF0aW9uIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkluc2lkZSBTYWxlc1wiLFxuICAgICAgICAgICAgXCJJbnN1cmFuY2UgQWRqdXN0ZXJcIixcbiAgICAgICAgICAgIFwiSW50ZXJpb3IgRGVjb3JhdG9yXCIsXG4gICAgICAgICAgICBcIkludGVybmFsIENvbnRyb2xzIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkludGVybmF0aW9uYWwgQWNjdC5cIixcbiAgICAgICAgICAgIFwiSW50ZXJuYXRpb25hbCBDb3VyaWVyXCIsXG4gICAgICAgICAgICBcIkludGVybmF0aW9uYWwgTGF3eWVyXCIsXG4gICAgICAgICAgICBcIkludGVycHJldGVyXCIsXG4gICAgICAgICAgICBcIkludmVzdGlnYXRvclwiLFxuICAgICAgICAgICAgXCJJbnZlc3RtZW50IEJhbmtlclwiLFxuICAgICAgICAgICAgXCJJbnZlc3RtZW50IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSVQgQXJjaGl0ZWN0XCIsXG4gICAgICAgICAgICBcIklUIFByb2plY3QgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJJVCBTeXN0ZW1zIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiSmV3ZWxlclwiLFxuICAgICAgICAgICAgXCJKb2ludCBWZW50dXJlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSm91cm5hbGlzdFwiLFxuICAgICAgICAgICAgXCJMYWJvciBOZWdvdGlhdG9yXCIsXG4gICAgICAgICAgICBcIkxhYm9yIE9yZ2FuaXplclwiLFxuICAgICAgICAgICAgXCJMYWJvciBSZWxhdGlvbnMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJMYWIgU2VydmljZXMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTGFiIFRlY2huaWNpYW5cIixcbiAgICAgICAgICAgIFwiTGFuZCBEZXZlbG9wZXJcIixcbiAgICAgICAgICAgIFwiTGFuZHNjYXBlIEFyY2hpdGVjdFwiLFxuICAgICAgICAgICAgXCJMYXcgRW5mb3JjZW1lbnQgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJMYXd5ZXJcIixcbiAgICAgICAgICAgIFwiTGVhZCBTb2Z0d2FyZSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJMZWFkIFNvZnR3YXJlIFRlc3QgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiTGVhc2luZyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkxlZ2FsIFNlY3JldGFyeVwiLFxuICAgICAgICAgICAgXCJMaWJyYXJ5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTGl0aWdhdGlvbiBBdHRvcm5leVwiLFxuICAgICAgICAgICAgXCJMb2FuIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiTG9iYnlpc3RcIixcbiAgICAgICAgICAgIFwiTG9naXN0aWNzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTWFpbnRlbmFuY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJNYW5hZ2VtZW50IENvbnN1bHRhbnRcIixcbiAgICAgICAgICAgIFwiTWFuYWdlZCBDYXJlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk1hbmFnaW5nIFBhcnRuZXJcIixcbiAgICAgICAgICAgIFwiTWFudWZhY3R1cmluZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJNYW5wb3dlciBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIk1hcmluZSBCaW9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiTWFya2V0IFJlcy4gQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJNYXJrZXRpbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTWF0ZXJpYWxzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTWF0aGVtYXRpY2lhblwiLFxuICAgICAgICAgICAgXCJNZW1iZXJzaGlwIENoYWlybWFuXCIsXG4gICAgICAgICAgICBcIk1lY2hhbmljXCIsXG4gICAgICAgICAgICBcIk1lY2hhbmljYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiTWVkaWEgQnV5ZXJcIixcbiAgICAgICAgICAgIFwiTWVkaWNhbCBJbnZlc3RvclwiLFxuICAgICAgICAgICAgXCJNZWRpY2FsIFNlY3JldGFyeVwiLFxuICAgICAgICAgICAgXCJNZWRpY2FsIFRlY2huaWNpYW5cIixcbiAgICAgICAgICAgIFwiTWVudGFsIEhlYWx0aCBDb3Vuc2Vsb3JcIixcbiAgICAgICAgICAgIFwiTWVyY2hhbmRpc2VyXCIsXG4gICAgICAgICAgICBcIk1ldGFsbHVyZ2ljYWwgRW5naW5lZXJpbmdcIixcbiAgICAgICAgICAgIFwiTWV0ZW9yb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJNaWNyb2Jpb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJNSVMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJNb3Rpb24gUGljdHVyZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJNdWx0aW1lZGlhIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk11c2ljaWFuXCIsXG4gICAgICAgICAgICBcIk5ldHdvcmsgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJOZXR3b3JrIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiTmV0d29yayBPcGVyYXRvclwiLFxuICAgICAgICAgICAgXCJOZXcgUHJvZHVjdCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk5vdmVsaXN0XCIsXG4gICAgICAgICAgICBcIk51Y2xlYXIgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiTnVjbGVhciBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIk51dHJpdGlvbmlzdFwiLFxuICAgICAgICAgICAgXCJOdXJzaW5nIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiT2NjdXBhdGlvbmFsIFRoZXJhcGlzdFwiLFxuICAgICAgICAgICAgXCJPY2Vhbm9ncmFwaGVyXCIsXG4gICAgICAgICAgICBcIk9mZmljZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk9wZXJhdGlvbnMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJPcGVyYXRpb25zIFJlc2VhcmNoIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk9wdGljYWwgVGVjaG5pY2lhblwiLFxuICAgICAgICAgICAgXCJPcHRvbWV0cmlzdFwiLFxuICAgICAgICAgICAgXCJPcmdhbml6YXRpb25hbCBEZXZlbG9wbWVudCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk91dHBsYWNlbWVudCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlBhcmFsZWdhbFwiLFxuICAgICAgICAgICAgXCJQYXJrIFJhbmdlclwiLFxuICAgICAgICAgICAgXCJQYXRlbnQgQXR0b3JuZXlcIixcbiAgICAgICAgICAgIFwiUGF5cm9sbCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlBlcnNvbm5lbCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlBldHJvbGV1bSBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJQaGFybWFjaXN0XCIsXG4gICAgICAgICAgICBcIlBob3RvZ3JhcGhlclwiLFxuICAgICAgICAgICAgXCJQaHlzaWNhbCBUaGVyYXBpc3RcIixcbiAgICAgICAgICAgIFwiUGh5c2ljaWFuXCIsXG4gICAgICAgICAgICBcIlBoeXNpY2lhbiBBc3Npc3RhbnRcIixcbiAgICAgICAgICAgIFwiUGh5c2ljaXN0XCIsXG4gICAgICAgICAgICBcIlBsYW5uaW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlBvZGlhdHJpc3RcIixcbiAgICAgICAgICAgIFwiUG9saXRpY2FsIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiUG9saXRpY2FsIFNjaWVudGlzdFwiLFxuICAgICAgICAgICAgXCJQb2xpdGljaWFuXCIsXG4gICAgICAgICAgICBcIlBvcnRmb2xpbyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlByZXNjaG9vbCBNYW5hZ2VtZW50XCIsXG4gICAgICAgICAgICBcIlByZXNjaG9vbCBUZWFjaGVyXCIsXG4gICAgICAgICAgICBcIlByaW5jaXBhbFwiLFxuICAgICAgICAgICAgXCJQcml2YXRlIEJhbmtlclwiLFxuICAgICAgICAgICAgXCJQcml2YXRlIEludmVzdGlnYXRvclwiLFxuICAgICAgICAgICAgXCJQcm9iYXRpb24gT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJQcm9jZXNzIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlByb2R1Y2VyXCIsXG4gICAgICAgICAgICBcIlByb2R1Y3QgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJQcm9kdWN0IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlByb2R1Y3Rpb24gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUHJvZHVjdGlvbiBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIlByb2Zlc3Npb25hbCBBdGhsZXRlXCIsXG4gICAgICAgICAgICBcIlByb2Zlc3Npb25hbCBDb2FjaFwiLFxuICAgICAgICAgICAgXCJQcm9mZXNzb3JcIixcbiAgICAgICAgICAgIFwiUHJvamVjdCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJQcm9qZWN0IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUHJvZ3JhbSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlByb3BlcnR5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUHVibGljIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiUHVibGljIFNhZmV0eSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJQUiBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlB1Ymxpc2hlclwiLFxuICAgICAgICAgICAgXCJQdXJjaGFzaW5nIEFnZW50XCIsXG4gICAgICAgICAgICBcIlB1Ymxpc2hpbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiUXVhbGl0eSBBc3N1cmFuY2UgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJRdWFsaXR5IENvbnRyb2wgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUXVhbGl0eSBDb250cm9sIEluc3BlY3RvclwiLFxuICAgICAgICAgICAgXCJSYWRpb2xvZ3kgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJSYWlscm9hZCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJSZWFsIEVzdGF0ZSBCcm9rZXJcIixcbiAgICAgICAgICAgIFwiUmVjcmVhdGlvbmFsIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlJlY3J1aXRlclwiLFxuICAgICAgICAgICAgXCJSZWRldmVsb3BtZW50IFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUmVndWxhdG9yeSBBZmZhaXJzIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUmVnaXN0ZXJlZCBOdXJzZVwiLFxuICAgICAgICAgICAgXCJSZWhhYmlsaXRhdGlvbiBDb3Vuc2Vsb3JcIixcbiAgICAgICAgICAgIFwiUmVsb2NhdGlvbiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlJlcG9ydGVyXCIsXG4gICAgICAgICAgICBcIlJlc2VhcmNoIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUmVzdGF1cmFudCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlJldGFpbCBTdG9yZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlJpc2sgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJTYWZldHkgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU2FsZXMgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU2FsZXMgVHJhaW5lclwiLFxuICAgICAgICAgICAgXCJTYWxlcyBQcm9tb3Rpb24gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTYWxlcyBSZXByZXNlbnRhdGl2ZVwiLFxuICAgICAgICAgICAgXCJTYWxlcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlNlcnZpY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTYW5pdGF0aW9uIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlNjaWVudGlmaWMgUHJvZ3JhbW1lclwiLFxuICAgICAgICAgICAgXCJTY2llbnRpZmljIFdyaXRlclwiLFxuICAgICAgICAgICAgXCJTZWN1cml0aWVzIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHkgQ29uc3VsdGFudFwiLFxuICAgICAgICAgICAgXCJTZWN1cml0eSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTZW1pbmFyIFByZXNlbnRlclwiLFxuICAgICAgICAgICAgXCJTaGlwJ3MgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJTaW5nZXJcIixcbiAgICAgICAgICAgIFwiU29jaWFsIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlNvY2lhbCBQcm9ncmFtIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiU29jaWFsIFJlc2VhcmNoXCIsXG4gICAgICAgICAgICBcIlNvY2lhbCBTY2llbnRpc3RcIixcbiAgICAgICAgICAgIFwiU29jaWFsIFdvcmtlclwiLFxuICAgICAgICAgICAgXCJTb2Npb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJTb2Z0d2FyZSBEZXZlbG9wZXJcIixcbiAgICAgICAgICAgIFwiU29mdHdhcmUgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU29mdHdhcmUgVGVzdCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTb2lsIFNjaWVudGlzdFwiLFxuICAgICAgICAgICAgXCJTcGVjaWFsIEV2ZW50cyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlNwZWNpYWwgRWR1Y2F0aW9uIFRlYWNoZXJcIixcbiAgICAgICAgICAgIFwiU3BlY2lhbCBQcm9qZWN0cyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTcGVlY2ggUGF0aG9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiU3BlZWNoIFdyaXRlclwiLFxuICAgICAgICAgICAgXCJTcG9ydHMgRXZlbnQgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTdGF0aXN0aWNpYW5cIixcbiAgICAgICAgICAgIFwiU3RvcmUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTdHJhdGVnaWMgQWxsaWFuY2UgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU3RyYXRlZ2ljIFBsYW5uaW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlN0cmVzcyBSZWR1Y3Rpb24gU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJTdG9ja2Jyb2tlclwiLFxuICAgICAgICAgICAgXCJTdXJ2ZXlvclwiLFxuICAgICAgICAgICAgXCJTdHJ1Y3R1cmFsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlN1cGVyaW50ZW5kZW50XCIsXG4gICAgICAgICAgICBcIlN1cHBseSBDaGFpbiBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTeXN0ZW0gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU3lzdGVtcyBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIlN5c3RlbXMgUHJvZ3JhbW1lclwiLFxuICAgICAgICAgICAgXCJTeXN0ZW0gQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJUYXggU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJUZWFjaGVyXCIsXG4gICAgICAgICAgICBcIlRlY2huaWNhbCBTdXBwb3J0IFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiVGVjaG5pY2FsIElsbHVzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIlRlY2huaWNhbCBXcml0ZXJcIixcbiAgICAgICAgICAgIFwiVGVjaG5vbG9neSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJUZWxlY29tIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiVGVsZW1hcmtldGVyXCIsXG4gICAgICAgICAgICBcIlRoZWF0cmljYWwgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiVGl0bGUgRXhhbWluZXJcIixcbiAgICAgICAgICAgIFwiVG91ciBFc2NvcnRcIixcbiAgICAgICAgICAgIFwiVG91ciBHdWlkZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJUcmFmZmljIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiVHJhaW5lciBUcmFuc2xhdG9yXCIsXG4gICAgICAgICAgICBcIlRyYW5zcG9ydGF0aW9uIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiVHJhdmVsIEFnZW50XCIsXG4gICAgICAgICAgICBcIlRyZWFzdXJlclwiLFxuICAgICAgICAgICAgXCJUViBQcm9ncmFtbWVyXCIsXG4gICAgICAgICAgICBcIlVuZGVyd3JpdGVyXCIsXG4gICAgICAgICAgICBcIlVuaW9uIFJlcHJlc2VudGF0aXZlXCIsXG4gICAgICAgICAgICBcIlVuaXZlcnNpdHkgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJVbml2ZXJzaXR5IERlYW5cIixcbiAgICAgICAgICAgIFwiVXJiYW4gUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJWZXRlcmluYXJpYW5cIixcbiAgICAgICAgICAgIFwiVmVuZG9yIFJlbGF0aW9ucyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJWaXRpY3VsdHVyaXN0XCIsXG4gICAgICAgICAgICBcIldhcmVob3VzZSBNYW5hZ2VyXCJcbiAgICAgICAgXVxuICAgIH07XG5cbiAgICB2YXIgb19oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4gICAgdmFyIG9fa2V5cyA9IChPYmplY3Qua2V5cyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9faGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBfY29weU9iamVjdChzb3VyY2UsIHRhcmdldCkge1xuICAgICAgdmFyIGtleXMgPSBvX2tleXMoc291cmNlKTtcbiAgICAgIHZhciBrZXk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XSB8fCB0YXJnZXRba2V5XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY29weUFycmF5KHNvdXJjZSwgdGFyZ2V0KSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHNvdXJjZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGFyZ2V0W2ldID0gc291cmNlW2ldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvcHlPYmplY3Qoc291cmNlLCBfdGFyZ2V0KSB7XG4gICAgICAgIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShzb3VyY2UpO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gX3RhcmdldCB8fCAoaXNBcnJheSA/IG5ldyBBcnJheShzb3VyY2UubGVuZ3RoKSA6IHt9KTtcblxuICAgICAgICBpZiAoaXNBcnJheSkge1xuICAgICAgICAgIF9jb3B5QXJyYXkoc291cmNlLCB0YXJnZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9jb3B5T2JqZWN0KHNvdXJjZSwgdGFyZ2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqIEdldCB0aGUgZGF0YSBiYXNlZCBvbiBrZXkqKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHJldHVybiBjb3B5T2JqZWN0KGRhdGFbbmFtZV0pO1xuICAgIH07XG5cbiAgICAvLyBNYWMgQWRkcmVzc1xuICAgIENoYW5jZS5wcm90b3R5cGUubWFjX2FkZHJlc3MgPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgICAgLy8gdHlwaWNhbGx5IG1hYyBhZGRyZXNzZXMgYXJlIHNlcGFyYXRlZCBieSBcIjpcIlxuICAgICAgICAvLyBob3dldmVyIHRoZXkgY2FuIGFsc28gYmUgc2VwYXJhdGVkIGJ5IFwiLVwiXG4gICAgICAgIC8vIHRoZSBuZXR3b3JrIHZhcmlhbnQgdXNlcyBhIGRvdCBldmVyeSBmb3VydGggYnl0ZVxuXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgaWYoIW9wdGlvbnMuc2VwYXJhdG9yKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNlcGFyYXRvciA9ICBvcHRpb25zLm5ldHdvcmtWZXJzaW9uID8gXCIuXCIgOiBcIjpcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBtYWNfcG9vbD1cIkFCQ0RFRjEyMzQ1Njc4OTBcIixcbiAgICAgICAgICAgIG1hYyA9IFwiXCI7XG4gICAgICAgIGlmKCFvcHRpb25zLm5ldHdvcmtWZXJzaW9uKSB7XG4gICAgICAgICAgICBtYWMgPSB0aGlzLm4odGhpcy5zdHJpbmcsIDYsIHsgcG9vbDogbWFjX3Bvb2wsIGxlbmd0aDoyIH0pLmpvaW4ob3B0aW9ucy5zZXBhcmF0b3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFjID0gdGhpcy5uKHRoaXMuc3RyaW5nLCAzLCB7IHBvb2w6IG1hY19wb29sLCBsZW5ndGg6NCB9KS5qb2luKG9wdGlvbnMuc2VwYXJhdG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtYWM7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubm9ybWFsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttZWFuIDogMCwgZGV2IDogMSwgcG9vbCA6IFtdfSk7XG5cbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5wb29sLmNvbnN0cnVjdG9yICE9PSBBcnJheSxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBUaGUgcG9vbCBvcHRpb24gbXVzdCBiZSBhIHZhbGlkIGFycmF5LlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gSWYgYSBwb29sIGhhcyBiZWVuIHBhc3NlZCwgdGhlbiB3ZSBhcmUgcmV0dXJuaW5nIGFuIGl0ZW0gZnJvbSB0aGF0IHBvb2wsXG4gICAgICAgIC8vIHVzaW5nIHRoZSBub3JtYWwgZGlzdHJpYnV0aW9uIHNldHRpbmdzIHRoYXQgd2VyZSBwYXNzZWQgaW5cbiAgICAgICAgaWYgKG9wdGlvbnMucG9vbC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ub3JtYWxfcG9vbChvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBNYXJzYWdsaWEgUG9sYXIgbWV0aG9kXG4gICAgICAgIHZhciBzLCB1LCB2LCBub3JtLFxuICAgICAgICAgICAgbWVhbiA9IG9wdGlvbnMubWVhbixcbiAgICAgICAgICAgIGRldiA9IG9wdGlvbnMuZGV2O1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIC8vIFUgYW5kIFYgYXJlIGZyb20gdGhlIHVuaWZvcm0gZGlzdHJpYnV0aW9uIG9uICgtMSwgMSlcbiAgICAgICAgICAgIHUgPSB0aGlzLnJhbmRvbSgpICogMiAtIDE7XG4gICAgICAgICAgICB2ID0gdGhpcy5yYW5kb20oKSAqIDIgLSAxO1xuXG4gICAgICAgICAgICBzID0gdSAqIHUgKyB2ICogdjtcbiAgICAgICAgfSB3aGlsZSAocyA+PSAxKTtcblxuICAgICAgICAvLyBDb21wdXRlIHRoZSBzdGFuZGFyZCBub3JtYWwgdmFyaWF0ZVxuICAgICAgICBub3JtID0gdSAqIE1hdGguc3FydCgtMiAqIE1hdGgubG9nKHMpIC8gcyk7XG5cbiAgICAgICAgLy8gU2hhcGUgYW5kIHNjYWxlXG4gICAgICAgIHJldHVybiBkZXYgKiBub3JtICsgbWVhbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ub3JtYWxfcG9vbCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHBlcmZvcm1hbmNlQ291bnRlciA9IDA7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIHZhciBpZHggPSBNYXRoLnJvdW5kKHRoaXMubm9ybWFsKHsgbWVhbjogb3B0aW9ucy5tZWFuLCBkZXY6IG9wdGlvbnMuZGV2IH0pKTtcbiAgICAgICAgICAgIGlmIChpZHggPCBvcHRpb25zLnBvb2wubGVuZ3RoICYmIGlkeCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMucG9vbFtpZHhdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZXJmb3JtYW5jZUNvdW50ZXIrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSB3aGlsZShwZXJmb3JtYW5jZUNvdW50ZXIgPCAxMDApO1xuXG4gICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBZb3VyIHBvb2wgaXMgdG9vIHNtYWxsIGZvciB0aGUgZ2l2ZW4gbWVhbiBhbmQgc3RhbmRhcmQgZGV2aWF0aW9uLiBQbGVhc2UgYWRqdXN0LlwiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5yYWRpbyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIEluaXRpYWwgTGV0dGVyIChUeXBpY2FsbHkgRGVzaWduYXRlZCBieSBTaWRlIG9mIE1pc3Npc3NpcHBpIFJpdmVyKVxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge3NpZGUgOiBcIj9cIn0pO1xuICAgICAgICB2YXIgZmwgPSBcIlwiO1xuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuc2lkZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgIGNhc2UgXCJlYXN0XCI6XG4gICAgICAgIGNhc2UgXCJlXCI6XG4gICAgICAgICAgICBmbCA9IFwiV1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJ3ZXN0XCI6XG4gICAgICAgIGNhc2UgXCJ3XCI6XG4gICAgICAgICAgICBmbCA9IFwiS1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBmbCA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiBcIktXXCJ9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZsICsgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pICtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSkgK1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KTtcbiAgICB9O1xuXG4gICAgLy8gU2V0IHRoZSBkYXRhIGFzIGtleSBhbmQgZGF0YSBvciB0aGUgZGF0YSBtYXBcbiAgICBDaGFuY2UucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBkYXRhW25hbWVdID0gdmFsdWVzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YSA9IGNvcHlPYmplY3QobmFtZSwgZGF0YSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50diA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJhZGlvKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvLyBJRCBudW1iZXIgZm9yIEJyYXppbCBjb21wYW5pZXNcbiAgICBDaGFuY2UucHJvdG90eXBlLmNucGogPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgOCwgeyBtYXg6IDkgfSk7XG4gICAgICAgIHZhciBkMSA9IDIrbls3XSo2K25bNl0qNytuWzVdKjgrbls0XSo5K25bM10qMituWzJdKjMrblsxXSo0K25bMF0qNTtcbiAgICAgICAgZDEgPSAxMSAtIChkMSAlIDExKTtcbiAgICAgICAgaWYgKGQxPj0xMCl7XG4gICAgICAgICAgICBkMSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGQyID0gZDEqMiszK25bN10qNytuWzZdKjgrbls1XSo5K25bNF0qMituWzNdKjMrblsyXSo0K25bMV0qNStuWzBdKjY7XG4gICAgICAgIGQyID0gMTEgLSAoZDIgJSAxMSk7XG4gICAgICAgIGlmIChkMj49MTApe1xuICAgICAgICAgICAgZDIgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnJytuWzBdK25bMV0rJy4nK25bMl0rblszXStuWzRdKycuJytuWzVdK25bNl0rbls3XSsnLzAwMDEtJytkMStkMjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIE1pc2NlbGxhbmVvdXMgLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUubWVyc2VubmVfdHdpc3RlciA9IGZ1bmN0aW9uIChzZWVkKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyc2VubmVUd2lzdGVyKHNlZWQpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJsdWVpbXBfbWQ1ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbmV3IEJsdWVJbXBNRDUoKTtcbiAgICB9O1xuXG4gICAgLy8gTWVyc2VubmUgVHdpc3RlciBmcm9tIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2JhbmtzZWFuLzMwMDQ5NFxuICAgIHZhciBNZXJzZW5uZVR3aXN0ZXIgPSBmdW5jdGlvbiAoc2VlZCkge1xuICAgICAgICBpZiAoc2VlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBrZXB0IHJhbmRvbSBudW1iZXIgc2FtZSBzaXplIGFzIHRpbWUgdXNlZCBwcmV2aW91c2x5IHRvIGVuc3VyZSBubyB1bmV4cGVjdGVkIHJlc3VsdHMgZG93bnN0cmVhbVxuICAgICAgICAgICAgc2VlZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSpNYXRoLnBvdygxMCwxMykpO1xuICAgICAgICB9XG4gICAgICAgIC8qIFBlcmlvZCBwYXJhbWV0ZXJzICovXG4gICAgICAgIHRoaXMuTiA9IDYyNDtcbiAgICAgICAgdGhpcy5NID0gMzk3O1xuICAgICAgICB0aGlzLk1BVFJJWF9BID0gMHg5OTA4YjBkZjsgICAvKiBjb25zdGFudCB2ZWN0b3IgYSAqL1xuICAgICAgICB0aGlzLlVQUEVSX01BU0sgPSAweDgwMDAwMDAwOyAvKiBtb3N0IHNpZ25pZmljYW50IHctciBiaXRzICovXG4gICAgICAgIHRoaXMuTE9XRVJfTUFTSyA9IDB4N2ZmZmZmZmY7IC8qIGxlYXN0IHNpZ25pZmljYW50IHIgYml0cyAqL1xuXG4gICAgICAgIHRoaXMubXQgPSBuZXcgQXJyYXkodGhpcy5OKTsgLyogdGhlIGFycmF5IGZvciB0aGUgc3RhdGUgdmVjdG9yICovXG4gICAgICAgIHRoaXMubXRpID0gdGhpcy5OICsgMTsgLyogbXRpPT1OICsgMSBtZWFucyBtdFtOXSBpcyBub3QgaW5pdGlhbGl6ZWQgKi9cblxuICAgICAgICB0aGlzLmluaXRfZ2VucmFuZChzZWVkKTtcbiAgICB9O1xuXG4gICAgLyogaW5pdGlhbGl6ZXMgbXRbTl0gd2l0aCBhIHNlZWQgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmluaXRfZ2VucmFuZCA9IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHRoaXMubXRbMF0gPSBzID4+PiAwO1xuICAgICAgICBmb3IgKHRoaXMubXRpID0gMTsgdGhpcy5tdGkgPCB0aGlzLk47IHRoaXMubXRpKyspIHtcbiAgICAgICAgICAgIHMgPSB0aGlzLm10W3RoaXMubXRpIC0gMV0gXiAodGhpcy5tdFt0aGlzLm10aSAtIDFdID4+PiAzMCk7XG4gICAgICAgICAgICB0aGlzLm10W3RoaXMubXRpXSA9ICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxODEyNDMzMjUzKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTgxMjQzMzI1MykgKyB0aGlzLm10aTtcbiAgICAgICAgICAgIC8qIFNlZSBLbnV0aCBUQU9DUCBWb2wyLiAzcmQgRWQuIFAuMTA2IGZvciBtdWx0aXBsaWVyLiAqL1xuICAgICAgICAgICAgLyogSW4gdGhlIHByZXZpb3VzIHZlcnNpb25zLCBNU0JzIG9mIHRoZSBzZWVkIGFmZmVjdCAgICovXG4gICAgICAgICAgICAvKiBvbmx5IE1TQnMgb2YgdGhlIGFycmF5IG10W10uICAgICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIC8qIDIwMDIvMDEvMDkgbW9kaWZpZWQgYnkgTWFrb3RvIE1hdHN1bW90byAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5tdFt0aGlzLm10aV0gPj4+PSAwO1xuICAgICAgICAgICAgLyogZm9yID4zMiBiaXQgbWFjaGluZXMgKi9cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKiBpbml0aWFsaXplIGJ5IGFuIGFycmF5IHdpdGggYXJyYXktbGVuZ3RoICovXG4gICAgLyogaW5pdF9rZXkgaXMgdGhlIGFycmF5IGZvciBpbml0aWFsaXppbmcga2V5cyAqL1xuICAgIC8qIGtleV9sZW5ndGggaXMgaXRzIGxlbmd0aCAqL1xuICAgIC8qIHNsaWdodCBjaGFuZ2UgZm9yIEMrKywgMjAwNC8yLzI2ICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5pbml0X2J5X2FycmF5ID0gZnVuY3Rpb24gKGluaXRfa2V5LCBrZXlfbGVuZ3RoKSB7XG4gICAgICAgIHZhciBpID0gMSwgaiA9IDAsIGssIHM7XG4gICAgICAgIHRoaXMuaW5pdF9nZW5yYW5kKDE5NjUwMjE4KTtcbiAgICAgICAgayA9ICh0aGlzLk4gPiBrZXlfbGVuZ3RoID8gdGhpcy5OIDoga2V5X2xlbmd0aCk7XG4gICAgICAgIGZvciAoOyBrOyBrLS0pIHtcbiAgICAgICAgICAgIHMgPSB0aGlzLm10W2kgLSAxXSBeICh0aGlzLm10W2kgLSAxXSA+Pj4gMzApO1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA9ICh0aGlzLm10W2ldIF4gKCgoKChzICYgMHhmZmZmMDAwMCkgPj4+IDE2KSAqIDE2NjQ1MjUpIDw8IDE2KSArICgocyAmIDB4MDAwMGZmZmYpICogMTY2NDUyNSkpKSArIGluaXRfa2V5W2pdICsgajsgLyogbm9uIGxpbmVhciAqL1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgICAgICBpZiAoaSA+PSB0aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OIC0gMV07IGkgPSAxOyB9XG4gICAgICAgICAgICBpZiAoaiA+PSBrZXlfbGVuZ3RoKSB7IGogPSAwOyB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChrID0gdGhpcy5OIC0gMTsgazsgay0tKSB7XG4gICAgICAgICAgICBzID0gdGhpcy5tdFtpIC0gMV0gXiAodGhpcy5tdFtpIC0gMV0gPj4+IDMwKTtcbiAgICAgICAgICAgIHRoaXMubXRbaV0gPSAodGhpcy5tdFtpXSBeICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxNTY2MDgzOTQxKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTU2NjA4Mzk0MSkpIC0gaTsgLyogbm9uIGxpbmVhciAqL1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBpZiAoaSA+PSB0aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OIC0gMV07IGkgPSAxOyB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm10WzBdID0gMHg4MDAwMDAwMDsgLyogTVNCIGlzIDE7IGFzc3VyaW5nIG5vbi16ZXJvIGluaXRpYWwgYXJyYXkgKi9cbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweGZmZmZmZmZmXS1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHk7XG4gICAgICAgIHZhciBtYWcwMSA9IG5ldyBBcnJheSgweDAsIHRoaXMuTUFUUklYX0EpO1xuICAgICAgICAvKiBtYWcwMVt4XSA9IHggKiBNQVRSSVhfQSAgZm9yIHg9MCwxICovXG5cbiAgICAgICAgaWYgKHRoaXMubXRpID49IHRoaXMuTikgeyAvKiBnZW5lcmF0ZSBOIHdvcmRzIGF0IG9uZSB0aW1lICovXG4gICAgICAgICAgICB2YXIga2s7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm10aSA9PT0gdGhpcy5OICsgMSkgeyAgIC8qIGlmIGluaXRfZ2VucmFuZCgpIGhhcyBub3QgYmVlbiBjYWxsZWQsICovXG4gICAgICAgICAgICAgICAgdGhpcy5pbml0X2dlbnJhbmQoNTQ4OSk7IC8qIGEgZGVmYXVsdCBpbml0aWFsIHNlZWQgaXMgdXNlZCAqL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChrayA9IDA7IGtrIDwgdGhpcy5OIC0gdGhpcy5NOyBraysrKSB7XG4gICAgICAgICAgICAgICAgeSA9ICh0aGlzLm10W2trXSZ0aGlzLlVQUEVSX01BU0spfCh0aGlzLm10W2trICsgMV0mdGhpcy5MT1dFUl9NQVNLKTtcbiAgICAgICAgICAgICAgICB0aGlzLm10W2trXSA9IHRoaXMubXRba2sgKyB0aGlzLk1dIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKDtrayA8IHRoaXMuTiAtIDE7IGtrKyspIHtcbiAgICAgICAgICAgICAgICB5ID0gKHRoaXMubXRba2tdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRba2sgKyAxXSZ0aGlzLkxPV0VSX01BU0spO1xuICAgICAgICAgICAgICAgIHRoaXMubXRba2tdID0gdGhpcy5tdFtrayArICh0aGlzLk0gLSB0aGlzLk4pXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeSA9ICh0aGlzLm10W3RoaXMuTiAtIDFdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRbMF0mdGhpcy5MT1dFUl9NQVNLKTtcbiAgICAgICAgICAgIHRoaXMubXRbdGhpcy5OIC0gMV0gPSB0aGlzLm10W3RoaXMuTSAtIDFdIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG5cbiAgICAgICAgICAgIHRoaXMubXRpID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHkgPSB0aGlzLm10W3RoaXMubXRpKytdO1xuXG4gICAgICAgIC8qIFRlbXBlcmluZyAqL1xuICAgICAgICB5IF49ICh5ID4+PiAxMSk7XG4gICAgICAgIHkgXj0gKHkgPDwgNykgJiAweDlkMmM1NjgwO1xuICAgICAgICB5IF49ICh5IDw8IDE1KSAmIDB4ZWZjNjAwMDA7XG4gICAgICAgIHkgXj0gKHkgPj4+IDE4KTtcblxuICAgICAgICByZXR1cm4geSA+Pj4gMDtcbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweDdmZmZmZmZmXS1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmdlbnJhbmRfaW50MzIoKSA+Pj4gMSk7XG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMV0tcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZWFsMSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2VucmFuZF9pbnQzMigpICogKDEuMCAvIDQyOTQ5NjcyOTUuMCk7XG4gICAgICAgIC8qIGRpdmlkZWQgYnkgMl4zMi0xICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMSktcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZW5yYW5kX2ludDMyKCkgKiAoMS4wIC8gNDI5NDk2NzI5Ni4wKTtcbiAgICAgICAgLyogZGl2aWRlZCBieSAyXjMyICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gKDAsMSktcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZWFsMyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmdlbnJhbmRfaW50MzIoKSArIDAuNSkgKiAoMS4wIC8gNDI5NDk2NzI5Ni4wKTtcbiAgICAgICAgLyogZGl2aWRlZCBieSAyXjMyICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMSkgd2l0aCA1My1iaXQgcmVzb2x1dGlvbiovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX3JlczUzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYSA9IHRoaXMuZ2VucmFuZF9pbnQzMigpPj4+NSwgYiA9IHRoaXMuZ2VucmFuZF9pbnQzMigpPj4+NjtcbiAgICAgICAgcmV0dXJuIChhICogNjcxMDg4NjQuMCArIGIpICogKDEuMCAvIDkwMDcxOTkyNTQ3NDA5OTIuMCk7XG4gICAgfTtcblxuICAgIC8vIEJsdWVJbXAgTUQ1IGhhc2hpbmcgYWxnb3JpdGhtIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1NRDVcbiAgICB2YXIgQmx1ZUltcE1ENSA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuVkVSU0lPTiA9ICcxLjAuMSc7XG5cbiAgICAvKlxuICAgICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICAgICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnNhZmVfYWRkID0gZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSkge1xuICAgICAgICB2YXIgbHN3ID0gKHggJiAweEZGRkYpICsgKHkgJiAweEZGRkYpLFxuICAgICAgICAgICAgbXN3ID0gKHggPj4gMTYpICsgKHkgPj4gMTYpICsgKGxzdyA+PiAxNik7XG4gICAgICAgIHJldHVybiAobXN3IDw8IDE2KSB8IChsc3cgJiAweEZGRkYpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuYml0X3JvbGwgPSBmdW5jdGlvbiAobnVtLCBjbnQpIHtcbiAgICAgICAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZml2ZSBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9jbW4gPSBmdW5jdGlvbiAocSwgYSwgYiwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zYWZlX2FkZCh0aGlzLmJpdF9yb2xsKHRoaXMuc2FmZV9hZGQodGhpcy5zYWZlX2FkZChhLCBxKSwgdGhpcy5zYWZlX2FkZCh4LCB0KSksIHMpLCBiKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9mZiA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1kNV9jbW4oKGIgJiBjKSB8ICgofmIpICYgZCksIGEsIGIsIHgsIHMsIHQpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2dnID0gZnVuY3Rpb24gKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWQ1X2NtbigoYiAmIGQpIHwgKGMgJiAofmQpKSwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfaGggPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKGIgXiBjIF4gZCwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfaWkgPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKGMgXiAoYiB8ICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMsIGFuZCBhIGJpdCBsZW5ndGguXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5iaW5sX21kNSA9IGZ1bmN0aW9uICh4LCBsZW4pIHtcbiAgICAgICAgLyogYXBwZW5kIHBhZGRpbmcgKi9cbiAgICAgICAgeFtsZW4gPj4gNV0gfD0gMHg4MCA8PCAobGVuICUgMzIpO1xuICAgICAgICB4WygoKGxlbiArIDY0KSA+Pj4gOSkgPDwgNCkgKyAxNF0gPSBsZW47XG5cbiAgICAgICAgdmFyIGksIG9sZGEsIG9sZGIsIG9sZGMsIG9sZGQsXG4gICAgICAgICAgICBhID0gIDE3MzI1ODQxOTMsXG4gICAgICAgICAgICBiID0gLTI3MTczMzg3OSxcbiAgICAgICAgICAgIGMgPSAtMTczMjU4NDE5NCxcbiAgICAgICAgICAgIGQgPSAgMjcxNzMzODc4O1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNikge1xuICAgICAgICAgICAgb2xkYSA9IGE7XG4gICAgICAgICAgICBvbGRiID0gYjtcbiAgICAgICAgICAgIG9sZGMgPSBjO1xuICAgICAgICAgICAgb2xkZCA9IGQ7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9mZihhLCBiLCBjLCBkLCB4W2ldLCAgICAgICA3LCAtNjgwODc2OTM2KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAgMV0sIDEyLCAtMzg5NTY0NTg2KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9mZihjLCBkLCBhLCBiLCB4W2kgKyAgMl0sIDE3LCAgNjA2MTA1ODE5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAgM10sIDIyLCAtMTA0NDUyNTMzMCk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpICsgIDRdLCAgNywgLTE3NjQxODg5Nyk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZmYoZCwgYSwgYiwgYywgeFtpICsgIDVdLCAxMiwgIDEyMDAwODA0MjYpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSArICA2XSwgMTcsIC0xNDczMjMxMzQxKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAgN10sIDIyLCAtNDU3MDU5ODMpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSArICA4XSwgIDcsICAxNzcwMDM1NDE2KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAgOV0sIDEyLCAtMTk1ODQxNDQxNyk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNywgLTQyMDYzKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAxMV0sIDIyLCAtMTk5MDQwNDE2Mik7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpICsgMTJdLCAgNywgIDE4MDQ2MDM2ODIpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSArIDEzXSwgMTIsIC00MDM0MTEwMSk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgMTRdLCAxNywgLTE1MDIwMDIyOTApO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSArIDE1XSwgMjIsICAxMjM2NTM1MzI5KTtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArICAxXSwgIDUsIC0xNjU3OTY1MTApO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArICA2XSwgIDksIC0xMDY5NTAxNjMyKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAxMV0sIDE0LCAgNjQzNzE3NzEzKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2ldLCAgICAgIDIwLCAtMzczODk3MzAyKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9nZyhhLCBiLCBjLCBkLCB4W2kgKyAgNV0sICA1LCAtNzAxNTU4NjkxKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9nZyhkLCBhLCBiLCBjLCB4W2kgKyAxMF0sICA5LCAgMzgwMTYwODMpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSArIDE1XSwgMTQsIC02NjA0NzgzMzUpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSArICA0XSwgMjAsIC00MDU1Mzc4NDgpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArICA5XSwgIDUsICA1Njg0NDY0MzgpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArIDE0XSwgIDksIC0xMDE5ODAzNjkwKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAgM10sIDE0LCAtMTg3MzYzOTYxKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2kgKyAgOF0sIDIwLCAgMTE2MzUzMTUwMSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZ2coYSwgYiwgYywgZCwgeFtpICsgMTNdLCAgNSwgLTE0NDQ2ODE0NjcpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArICAyXSwgIDksIC01MTQwMzc4NCk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZ2coYywgZCwgYSwgYiwgeFtpICsgIDddLCAxNCwgIDE3MzUzMjg0NzMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSArIDEyXSwgMjAsIC0xOTI2NjA3NzM0KTtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArICA1XSwgIDQsIC0zNzg1NTgpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSArICA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAxMV0sIDE2LCAgMTgzOTAzMDU2Mik7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaGgoYiwgYywgZCwgYSwgeFtpICsgMTRdLCAyMywgLTM1MzA5NTU2KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAgMV0sICA0LCAtMTUzMDk5MjA2MCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaGgoZCwgYSwgYiwgYywgeFtpICsgIDRdLCAxMSwgIDEyNzI4OTMzNTMpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArICA3XSwgMTYsIC0xNTU0OTc2MzIpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArIDEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAxM10sICA0LCAgNjgxMjc5MTc0KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9oaChkLCBhLCBiLCBjLCB4W2ldLCAgICAgIDExLCAtMzU4NTM3MjIyKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAgM10sIDE2LCAtNzIyNTIxOTc5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9oaChiLCBjLCBkLCBhLCB4W2kgKyAgNl0sIDIzLCAgNzYwMjkxODkpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArICA5XSwgIDQsIC02NDAzNjQ0ODcpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSArIDEyXSwgMTEsIC00MjE4MTU4MzUpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArIDE1XSwgMTYsICA1MzA3NDI1MjApO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArICAyXSwgMjMsIC05OTUzMzg2NTEpO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaWkoYSwgYiwgYywgZCwgeFtpXSwgICAgICAgNiwgLTE5ODYzMDg0NCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgIDddLCAxMCwgIDExMjY4OTE0MTUpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSArIDE0XSwgMTUsIC0xNDE2MzU0OTA1KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAgNV0sIDIxLCAtNTc0MzQwNTUpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSArIDEyXSwgIDYsICAxNzAwNDg1NTcxKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9paShkLCBhLCBiLCBjLCB4W2kgKyAgM10sIDEwLCAtMTg5NDk4NjYwNik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaWkoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNSwgLTEwNTE1MjMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSArICAxXSwgMjEsIC0yMDU0OTIyNzk5KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9paShhLCBiLCBjLCBkLCB4W2kgKyAgOF0sICA2LCAgMTg3MzMxMzM1OSk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgMTVdLCAxMCwgLTMwNjExNzQ0KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAgNl0sIDE1LCAtMTU2MDE5ODM4MCk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaWkoYiwgYywgZCwgYSwgeFtpICsgMTNdLCAyMSwgIDEzMDkxNTE2NDkpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSArICA0XSwgIDYsIC0xNDU1MjMwNzApO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSArIDExXSwgMTAsIC0xMTIwMjEwMzc5KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAgMl0sIDE1LCAgNzE4Nzg3MjU5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAgOV0sIDIxLCAtMzQzNDg1NTUxKTtcblxuICAgICAgICAgICAgYSA9IHRoaXMuc2FmZV9hZGQoYSwgb2xkYSk7XG4gICAgICAgICAgICBiID0gdGhpcy5zYWZlX2FkZChiLCBvbGRiKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLnNhZmVfYWRkKGMsIG9sZGMpO1xuICAgICAgICAgICAgZCA9IHRoaXMuc2FmZV9hZGQoZCwgb2xkZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFthLCBiLCBjLCBkXTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuYmlubDJyc3RyID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgb3V0cHV0ID0gJyc7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggKiAzMjsgaSArPSA4KSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoaW5wdXRbaSA+PiA1XSA+Pj4gKGkgJSAzMikpICYgMHhGRik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENvbnZlcnQgYSByYXcgc3RyaW5nIHRvIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHNcbiAgICAqIENoYXJhY3RlcnMgPjI1NSBoYXZlIHRoZWlyIGhpZ2gtYnl0ZSBzaWxlbnRseSBpZ25vcmVkLlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cjJiaW5sID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgb3V0cHV0ID0gW107XG4gICAgICAgIG91dHB1dFsoaW5wdXQubGVuZ3RoID4+IDIpIC0gMV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvdXRwdXQubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIG91dHB1dFtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAqIDg7IGkgKz0gOCkge1xuICAgICAgICAgICAgb3V0cHV0W2kgPj4gNV0gfD0gKGlucHV0LmNoYXJDb2RlQXQoaSAvIDgpICYgMHhGRikgPDwgKGkgJSAzMik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGEgcmF3IHN0cmluZ1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cl9tZDUgPSBmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5sMnJzdHIodGhpcy5iaW5sX21kNSh0aGlzLnJzdHIyYmlubChzKSwgcy5sZW5ndGggKiA4KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDYWxjdWxhdGUgdGhlIEhNQUMtTUQ1LCBvZiBhIGtleSBhbmQgc29tZSBkYXRhIChyYXcgc3RyaW5ncylcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHJfaG1hY19tZDUgPSBmdW5jdGlvbiAoa2V5LCBkYXRhKSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgYmtleSA9IHRoaXMucnN0cjJiaW5sKGtleSksXG4gICAgICAgICAgICBpcGFkID0gW10sXG4gICAgICAgICAgICBvcGFkID0gW10sXG4gICAgICAgICAgICBoYXNoO1xuICAgICAgICBpcGFkWzE1XSA9IG9wYWRbMTVdID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoYmtleS5sZW5ndGggPiAxNikge1xuICAgICAgICAgICAgYmtleSA9IHRoaXMuYmlubF9tZDUoYmtleSwga2V5Lmxlbmd0aCAqIDgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCAxNjsgaSArPSAxKSB7XG4gICAgICAgICAgICBpcGFkW2ldID0gYmtleVtpXSBeIDB4MzYzNjM2MzY7XG4gICAgICAgICAgICBvcGFkW2ldID0gYmtleVtpXSBeIDB4NUM1QzVDNUM7XG4gICAgICAgIH1cbiAgICAgICAgaGFzaCA9IHRoaXMuYmlubF9tZDUoaXBhZC5jb25jYXQodGhpcy5yc3RyMmJpbmwoZGF0YSkpLCA1MTIgKyBkYXRhLmxlbmd0aCAqIDgpO1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5sMnJzdHIodGhpcy5iaW5sX21kNShvcGFkLmNvbmNhdChoYXNoKSwgNTEyICsgMTI4KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDb252ZXJ0IGEgcmF3IHN0cmluZyB0byBhIGhleCBzdHJpbmdcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHIyaGV4ID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBoZXhfdGFiID0gJzAxMjM0NTY3ODlhYmNkZWYnLFxuICAgICAgICAgICAgb3V0cHV0ID0gJycsXG4gICAgICAgICAgICB4LFxuICAgICAgICAgICAgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICB4ID0gaW5wdXQuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIG91dHB1dCArPSBoZXhfdGFiLmNoYXJBdCgoeCA+Pj4gNCkgJiAweDBGKSArXG4gICAgICAgICAgICAgICAgaGV4X3RhYi5jaGFyQXQoeCAmIDB4MEYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBFbmNvZGUgYSBzdHJpbmcgYXMgdXRmLThcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnN0cjJyc3RyX3V0ZjggPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChpbnB1dCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogVGFrZSBzdHJpbmcgYXJndW1lbnRzIGFuZCByZXR1cm4gZWl0aGVyIHJhdyBvciBoZXggZW5jb2RlZCBzdHJpbmdzXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yYXdfbWQ1ID0gZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cl9tZDUodGhpcy5zdHIycnN0cl91dGY4KHMpKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmhleF9tZDUgPSBmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyMmhleCh0aGlzLnJhd19tZDUocykpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucmF3X2htYWNfbWQ1ID0gZnVuY3Rpb24gKGssIGQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cl9obWFjX21kNSh0aGlzLnN0cjJyc3RyX3V0ZjgoayksIHRoaXMuc3RyMnJzdHJfdXRmOChkKSk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5oZXhfaG1hY19tZDUgPSBmdW5jdGlvbiAoaywgZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyMmhleCh0aGlzLnJhd19obWFjX21kNShrLCBkKSk7XG4gICAgfTtcblxuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNSA9IGZ1bmN0aW9uIChzdHJpbmcsIGtleSwgcmF3KSB7XG4gICAgICAgIGlmICgha2V5KSB7XG4gICAgICAgICAgICBpZiAoIXJhdykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhleF9tZDUoc3RyaW5nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmF3X21kNShzdHJpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFyYXcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhleF9obWFjX21kNShrZXksIHN0cmluZyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5yYXdfaG1hY19tZDUoa2V5LCBzdHJpbmcpO1xuICAgIH07XG5cbiAgICAvLyBDb21tb25KUyBtb2R1bGVcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gQ2hhbmNlO1xuICAgICAgICB9XG4gICAgICAgIGV4cG9ydHMuQ2hhbmNlID0gQ2hhbmNlO1xuICAgIH1cblxuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBDaGFuY2U7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGlmIHRoZXJlIGlzIGEgaW1wb3J0c1NjcmlwcyBvYmplY3QgZGVmaW5lIGNoYW5jZSBmb3Igd29ya2VyXG4gICAgaWYgKHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBjaGFuY2UgPSBuZXcgQ2hhbmNlKCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSB3aW5kb3cgb2JqZWN0LCB0aGF0IGF0IGxlYXN0IGhhcyBhIGRvY3VtZW50IHByb3BlcnR5LFxuICAgIC8vIGluc3RhbnRpYXRlIGFuZCBkZWZpbmUgY2hhbmNlIG9uIHRoZSB3aW5kb3dcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygd2luZG93LmRvY3VtZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHdpbmRvdy5DaGFuY2UgPSBDaGFuY2U7XG4gICAgICAgIHdpbmRvdy5jaGFuY2UgPSBuZXcgQ2hhbmNlKCk7XG4gICAgfVxufSkoKTtcbiJdfQ==
