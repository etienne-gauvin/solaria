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
			color: new THREE.Color('#F6C357')
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

		console.log(this);
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

		console.log('banana');

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuLi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIi4uL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiLi4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCJqc1xcY2FtZXJhLmpzIiwianNcXGNvbG9ycy5qcyIsImpzXFxjb250cm9scy5qcyIsImpzXFxnYW1lLmpzIiwianNcXGdyb3VuZC5qcyIsImpzXFxwbGF5ZXIuanMiLCJqc1xcc29sYXJpcy1jb250cm9scy5qcyIsImpzXFxzb2xhcmlzLmpzIiwibm9kZV9tb2R1bGVzL2NoYW5jZS9jaGFuY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3dkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEEsTUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiOztBQUVBLE1BQU0sTUFBTixTQUFxQixNQUFNLGlCQUEzQixDQUE2Qzs7QUFFNUMsZUFBYzs7QUFFYixRQUFNLGNBQWMsS0FBSyxLQUFMLEdBQWEsS0FBSyxNQUF0QztBQUNBLFFBQU0sY0FBYyxFQUFwQjtBQUNBLFFBQU0sWUFBWSxDQUFsQjtBQUNBLFFBQU0sV0FBVyxLQUFqQjs7QUFFQSxRQUNDLFdBREQsRUFFQyxXQUZELEVBR0MsU0FIRCxFQUlDLFFBSkQ7O0FBT0EsT0FBSyxLQUFMLENBQVcsR0FBWCxDQUFlLElBQWY7O0FBRUE7QUFDQSxPQUFLLEVBQUwsQ0FBUSxJQUFSLENBQWEsSUFBSSxNQUFNLE9BQVYsQ0FBa0IsQ0FBbEIsRUFBcUIsQ0FBckIsRUFBd0IsQ0FBeEIsQ0FBYjs7QUFFQTtBQUNBLE9BQUssZ0JBQUwsR0FBd0IsSUFBSSxNQUFNLE9BQVYsQ0FBa0IsQ0FBbEIsRUFBcUIsRUFBckIsRUFBeUIsQ0FBekIsQ0FBeEI7QUFFQTs7QUFFRCxRQUFPLEtBQVAsRUFBYzs7QUFFYjtBQUNBLFFBQU0sUUFBUSxHQUFkO0FBQ0EsUUFBTSxTQUFTLEtBQUssTUFBTCxDQUFZLFFBQVosQ0FBcUIsS0FBckIsR0FBNkIsR0FBN0IsQ0FBaUMsS0FBSyxnQkFBdEMsQ0FBZjtBQUNBLFFBQU0sV0FBVyxLQUFLLFFBQXRCOztBQUVBLFdBQVMsQ0FBVCxJQUFjLENBQUMsT0FBTyxDQUFQLEdBQVcsU0FBUyxDQUFyQixJQUEwQixLQUExQixHQUFrQyxNQUFNLEtBQXREO0FBQ0EsV0FBUyxDQUFULElBQWMsQ0FBQyxPQUFPLENBQVAsR0FBVyxTQUFTLENBQXJCLElBQTBCLEtBQTFCLEdBQWtDLE1BQU0sS0FBdEQ7QUFDQSxXQUFTLENBQVQsSUFBYyxDQUFDLE9BQU8sQ0FBUCxHQUFXLFNBQVMsQ0FBckIsSUFBMEIsS0FBMUIsR0FBa0MsTUFBTSxLQUF0RDs7QUFFQTtBQUNBLE9BQUssTUFBTCxDQUFZLEtBQUssTUFBTCxDQUFZLGdCQUFaLEVBQVo7QUFFQTtBQXhDMkM7O0FBMkM3QyxPQUFPLE9BQVAsR0FBaUIsTUFBakI7OztBQzdDQSxPQUFPLE9BQVAsR0FBaUI7QUFDaEIsTUFBSyxRQURXO0FBRWhCLFFBQU8sUUFGUztBQUdoQixRQUFPLFFBSFM7QUFJaEIsT0FBTSxRQUpVO0FBS2hCLFlBQVcsUUFMSztBQU1oQixPQUFNO0FBTlUsQ0FBakI7OztBQ0FBOzs7QUFHQSxNQUFNLFFBQU4sQ0FBZTs7QUFFZCxlQUFjOztBQUViLE9BQUssT0FBTCxHQUFlLElBQWY7QUFDQSxPQUFLLFFBQUwsR0FBZ0IsR0FBaEI7O0FBRUE7QUFDQSxPQUFLLFVBQUwsR0FBa0IsVUFBbEI7O0FBRUE7QUFDQSxPQUFLLE1BQUwsR0FBYztBQUNiLGFBQVUsRUFERztBQUViLFlBQVM7QUFGSSxHQUFkOztBQUtBO0FBQ0EsT0FBSyxRQUFMLEdBQWdCO0FBQ2YsYUFBVSxFQURLO0FBRWYsWUFBUztBQUZNLEdBQWhCOztBQUtBO0FBQ0EsT0FBSyxPQUFMLEdBQWU7QUFDZCxNQUFHLENBRFc7QUFFZCxNQUFHLENBRlc7QUFHZCxNQUFHLENBSFc7QUFJZCxNQUFHLENBSlc7QUFLZCxPQUFJLENBTFU7QUFNZCxPQUFJLENBTlU7QUFPZCxPQUFJLENBUFU7QUFRZCxPQUFJLENBUlU7QUFTZCxTQUFNLENBVFE7QUFVZCxVQUFPLENBVk87QUFXZCxPQUFJLEVBWFU7QUFZZCxTQUFNLEVBWlE7QUFhZCxTQUFNLEVBYlE7QUFjZCxVQUFPLEVBZE87O0FBZ0JkLFdBQVEsQ0FoQk07QUFpQmQsV0FBUSxDQWpCTTtBQWtCZCxZQUFTLENBbEJLO0FBbUJkLFlBQVM7QUFuQkssR0FBZjs7QUFzQkE7OztBQUdBLFNBQU8sZ0JBQVAsQ0FBd0Isa0JBQXhCLEVBQTZDLEtBQUQsSUFBVzs7QUFFdEQsT0FBSSxLQUFLLE1BQU0sT0FBZjs7QUFFQSxXQUFRLEdBQVIsQ0FBWSxxREFBWixFQUNDLEdBQUcsS0FESixFQUNXLEdBQUcsRUFEZCxFQUVDLEdBQUcsT0FBSCxDQUFXLE1BRlosRUFFb0IsR0FBRyxJQUFILENBQVEsTUFGNUI7O0FBSUEsUUFBSyxPQUFMLEdBQWUsRUFBZjtBQUNBLFFBQUssVUFBTCxHQUFrQixTQUFsQjtBQUVBLEdBWEQ7O0FBYUE7OztBQUdBLFNBQU8sZ0JBQVAsQ0FBd0IsU0FBeEIsRUFBb0MsS0FBRCxJQUFXOztBQUU3QyxRQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLE1BQU0sR0FBM0IsSUFBa0MsSUFBbEM7QUFDQSxRQUFLLFVBQUwsR0FBa0IsVUFBbEI7QUFFQSxHQUxEOztBQU9BOzs7QUFHQSxTQUFPLGdCQUFQLENBQXdCLE9BQXhCLEVBQWtDLEtBQUQsSUFBVzs7QUFFM0MsUUFBSyxNQUFMLENBQVksUUFBWixDQUFxQixNQUFNLEdBQTNCLElBQWtDLEtBQWxDO0FBQ0EsUUFBSyxVQUFMLEdBQWtCLFVBQWxCO0FBRUEsR0FMRDtBQU9BOztBQUVEOzs7QUFHQSxRQUFPLEtBQVAsRUFBYzs7QUFFYixNQUFJLFdBQVcsVUFBVSxXQUFWLEVBQWY7QUFDQSxPQUFLLE9BQUwsR0FBZSxTQUFTLENBQVQsQ0FBZjs7QUFFQSxNQUFJLEtBQUssT0FBVCxFQUFrQjs7QUFFakIsU0FBTSxXQUFXLEtBQUssUUFBTCxDQUFjLE9BQS9CO0FBQ0EsU0FBTSxVQUFVLEtBQUssaUJBQUwsQ0FBdUIsS0FBSyxPQUE1QixDQUFoQjs7QUFFQSxPQUFJLFFBQUosRUFBYzs7QUFFYixTQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksUUFBUSxPQUFSLENBQWdCLE1BQXBDLEVBQTRDLEdBQTVDLEVBQWlEOztBQUVoRCxTQUFJLFNBQVMsT0FBVCxDQUFpQixDQUFqQixFQUFvQixPQUFwQixLQUFnQyxRQUFRLE9BQVIsQ0FBZ0IsQ0FBaEIsRUFBbUIsT0FBdkQsRUFBZ0U7O0FBRS9ELFdBQUssVUFBTCxHQUFrQixTQUFsQjtBQUVBO0FBRUQ7O0FBRUQsU0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsSUFBUixDQUFhLE1BQWpDLEVBQXlDLEdBQXpDLEVBQThDOztBQUU3QyxTQUFJLFNBQVMsSUFBVCxDQUFjLENBQWQsTUFBcUIsUUFBUSxJQUFSLENBQWEsQ0FBYixDQUF6QixFQUEwQzs7QUFFekMsV0FBSyxVQUFMLEdBQWtCLFNBQWxCO0FBRUE7QUFFRDtBQUVEOztBQUVELFFBQUssUUFBTCxDQUFjLE9BQWQsR0FBd0IsS0FBSyxNQUFMLENBQVksT0FBcEM7QUFDQSxRQUFLLE1BQUwsQ0FBWSxPQUFaLEdBQXNCLE9BQXRCO0FBRUE7QUFFRDs7QUFFRDs7Ozs7QUFLQSxlQUFjLENBQWQsRUFBaUI7O0FBRWhCLE1BQUksV0FBVyxLQUFLLFFBQXBCOztBQUVBLE1BQUksSUFBSSxDQUFKLEdBQVEsS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLENBQUMsUUFBYixDQUFSLEdBQWlDLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxRQUFaLENBQXJDOztBQUVBLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULElBQWMsUUFBZixLQUE0QixJQUFJLFFBQWhDLElBQTRDLEtBQUssSUFBTCxDQUFVLENBQVYsQ0FBbkQ7QUFFQTs7QUFFRDs7Ozs7QUFLQSxTQUFRLGdCQUFSLEVBQTBCLFlBQTFCLEVBQXdDOztBQUV2QyxVQUFRLEtBQUssVUFBYjs7QUFFQyxRQUFLLFNBQUw7O0FBRUMsUUFBSSxLQUFLLE1BQUwsQ0FBWSxPQUFaLEtBQXdCLElBQTVCLEVBQWtDLE9BQU8sQ0FBUDs7QUFFbEMsV0FBTyxLQUFLLE1BQUwsQ0FBWSxPQUFaLENBQW9CLElBQXBCLENBQXlCLGdCQUF6QixDQUFQOztBQUVBOztBQUVEO0FBQ0EsUUFBSyxVQUFMOztBQUVDLFFBQUksV0FBVyxLQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLGFBQWEsUUFBbEMsSUFBOEMsQ0FBQyxDQUEvQyxHQUFtRCxDQUFsRTtBQUNBLFFBQUksV0FBVyxLQUFLLE1BQUwsQ0FBWSxRQUFaLENBQXFCLGFBQWEsUUFBbEMsSUFBOEMsQ0FBQyxDQUEvQyxHQUFtRCxDQUFsRTs7QUFFQSxXQUFPLFdBQVcsUUFBbEI7O0FBRUE7O0FBbEJGO0FBc0JBOztBQUVEOzs7OztBQUtBLG1CQUFrQixPQUFsQixFQUEyQjs7QUFFMUIsTUFBSSxPQUFPLEVBQVg7QUFDQSxNQUFJLFVBQVUsRUFBZDs7QUFFQSxPQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksUUFBUSxPQUFSLENBQWdCLE1BQXBDLEVBQTRDLEdBQTVDLEVBQWlEOztBQUVoRCxXQUFRLENBQVIsSUFBYTtBQUNaLFdBQU8sUUFBUSxPQUFSLENBQWdCLENBQWhCLEVBQW1CLEtBRGQ7QUFFWixhQUFTLFFBQVEsT0FBUixDQUFnQixDQUFoQixFQUFtQjtBQUZoQixJQUFiO0FBS0E7O0FBRUQsT0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFFBQVEsSUFBUixDQUFhLE1BQWpDLEVBQXlDLEdBQXpDLEVBQThDOztBQUU3QyxRQUFLLENBQUwsSUFBVSxLQUFLLGFBQUwsQ0FBbUIsUUFBUSxJQUFSLENBQWEsQ0FBYixDQUFuQixDQUFWO0FBRUE7O0FBRUQsU0FBTztBQUNOLFNBQU0sSUFEQTtBQUVOLFlBQVM7QUFGSCxHQUFQO0FBS0E7O0FBM01hOztBQStNZixPQUFPLE9BQVAsR0FBaUIsUUFBakI7OztBQ2xOQSxNQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7QUFDQSxNQUFNLFNBQVMsUUFBUSxRQUFSLENBQWY7QUFDQSxNQUFNLE9BQU8sRUFBYjs7QUFFQTs7O0FBR0EsS0FBSyxLQUFMLEdBQWE7QUFDWixTQUFRO0FBQ1AsUUFBTTtBQURDO0FBREksQ0FBYjs7QUFNQTs7O0FBR0EsS0FBSyxJQUFMLEdBQVksVUFBVSxRQUFWLEVBQW9COztBQUUvQjtBQUNBLE9BQU0sU0FBUyxJQUFJLE1BQU0sVUFBVixFQUFmOztBQUVBO0FBQ0EsT0FBTSxXQUFZLElBQUQsSUFBVTs7QUFFMUIsU0FBTyxLQUFLLFFBQUwsS0FBa0IsU0FBbEIsSUFBK0IsS0FBSyxTQUFMLEtBQW1CLFNBQXpEO0FBRUEsRUFKRDs7QUFNQTtBQUNBLE1BQUssSUFBSSxDQUFULElBQWMsS0FBSyxLQUFuQixFQUEwQjs7QUFFekIsTUFBSSxPQUFPLEtBQUssS0FBTCxDQUFXLENBQVgsQ0FBWDs7QUFFQSxNQUFJLENBQUUsU0FBUyxJQUFULENBQU4sRUFBc0I7O0FBRXJCLFVBQU8sSUFBUCxDQUFZLEtBQUssSUFBakIsRUFBdUIsQ0FBQyxRQUFELEVBQVcsU0FBWCxLQUF5Qjs7QUFFL0MsU0FBSyxRQUFMLEdBQWdCLFFBQWhCO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLFNBQWpCOztBQUVBLFlBQVEsSUFBUixDQUFjLFdBQVUsS0FBSyxJQUFLLEVBQWxDOztBQUVBLFFBQUksWUFBWSxJQUFoQjs7QUFFQSxTQUFLLElBQUksRUFBVCxJQUFlLEtBQUssS0FBcEIsRUFBMkI7O0FBRTFCLGlCQUFZLGFBQWEsU0FBUyxLQUFLLEtBQUwsQ0FBVyxFQUFYLENBQVQsQ0FBekI7QUFFQTs7QUFFRCxRQUFJLFNBQUosRUFBZTtBQUVmLElBakJEO0FBbUJBO0FBRUQ7QUFFRCxDQTFDRDs7QUE0Q0E7OztBQUdBLEtBQUssV0FBTCxHQUFtQixZQUFZOztBQUU5QjtBQUNBO0FBQ0E7QUFDQSxNQUFLLE1BQUwsR0FBYyxPQUFPLFdBQXJCO0FBQ0EsTUFBSyxLQUFMLEdBQWEsT0FBTyxVQUFwQjs7QUFFQTtBQUNBLE1BQUssS0FBTCxHQUFhLElBQUksTUFBTSxLQUFWLEVBQWI7O0FBRUE7QUFDQSxNQUFLLE1BQUwsR0FBYyxJQUFJLE1BQUosQ0FBVyxTQUFYLENBQWQ7O0FBRUE7QUFDQSxNQUFLLEdBQUwsR0FBVyxJQUFJLElBQUksR0FBUixFQUFYOztBQUVBO0FBQ0EsT0FBTSxXQUFXLFFBQVEsb0JBQVIsQ0FBakI7QUFDQSxNQUFLLFFBQUwsR0FBZ0IsSUFBSSxRQUFKLEVBQWhCOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLE9BQU0sV0FBVyxLQUFLLFFBQUwsR0FBZ0IsSUFBSSxNQUFNLGFBQVYsQ0FBd0I7QUFDeEQ7QUFDQTtBQUNBLFNBQU8sSUFIaUQ7O0FBS3hEO0FBQ0E7QUFDQSxhQUFXO0FBUDZDLEVBQXhCLENBQWpDOztBQVVBO0FBQ0E7QUFDQSxVQUFTLE9BQVQsQ0FBaUIsS0FBSyxLQUF0QixFQUE2QixLQUFLLE1BQWxDOztBQUVBO0FBQ0EsVUFBUyxTQUFULENBQW1CLE9BQW5CLEdBQTZCLElBQTdCO0FBQ0EsVUFBUyxTQUFULENBQW1CLElBQW5CLEdBQTBCLE1BQU0sZ0JBQWhDOztBQUVBO0FBQ0E7QUFDQSxPQUFNLFlBQVksU0FBUyxhQUFULENBQXVCLE1BQXZCLENBQWxCO0FBQ0EsV0FBVSxXQUFWLENBQXNCLFNBQVMsVUFBL0I7O0FBRUE7QUFDQTtBQUNBLFFBQU8sZ0JBQVAsQ0FBd0IsUUFBeEIsRUFBa0MsTUFBTTs7QUFFdkMsT0FBSyxNQUFMLEdBQWMsT0FBTyxXQUFyQjtBQUNBLE9BQUssS0FBTCxHQUFhLE9BQU8sVUFBcEI7O0FBRUEsV0FBUyxPQUFULENBQWlCLEtBQUssS0FBdEIsRUFBNkIsS0FBSyxNQUFsQzs7QUFFQSxPQUFLLE1BQUwsQ0FBWSxNQUFaLEdBQXFCLEtBQUssS0FBTCxHQUFhLEtBQUssTUFBdkM7QUFDQSxPQUFLLE1BQUwsQ0FBWSxzQkFBWjtBQUVBLEVBVkQsRUFVRyxLQVZIO0FBWUEsQ0EvREQ7O0FBaUVBOzs7QUFHQSxLQUFLLFlBQUwsR0FBb0IsWUFBWTs7QUFFL0I7QUFDQTtBQUNBO0FBQ0EsT0FBTSxrQkFBa0IsSUFBSSxNQUFNLGVBQVYsQ0FDdkIsSUFBSSxNQUFNLEtBQVYsQ0FBZ0IsU0FBaEIsQ0FEdUIsRUFFdkIsSUFBSSxNQUFNLEtBQVYsQ0FBZ0IsU0FBaEIsQ0FGdUIsRUFHdkIsQ0FIdUIsQ0FBeEI7O0FBT0E7QUFDQTtBQUNBLE9BQU0sY0FBYyxJQUFJLE1BQU0sZ0JBQVYsQ0FBMkIsUUFBM0IsRUFBcUMsR0FBckMsQ0FBcEI7O0FBRUE7QUFDQSxhQUFZLFFBQVosQ0FBcUIsR0FBckIsQ0FBeUIsQ0FBekIsRUFBNEIsQ0FBNUIsRUFBK0IsRUFBL0I7O0FBRUE7QUFDQSxhQUFZLFVBQVosR0FBeUIsSUFBekI7QUFDQTs7QUFFQTtBQUNBLGFBQVksTUFBWixDQUFtQixNQUFuQixDQUEwQixJQUExQixHQUFpQyxDQUFDLEVBQWxDO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLEtBQTFCLEdBQWtDLEVBQWxDO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLEdBQTFCLEdBQWdDLEVBQWhDO0FBQ0EsYUFBWSxNQUFaLENBQW1CLE1BQW5CLENBQTBCLE1BQTFCLEdBQW1DLENBQUMsRUFBcEM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsSUFBMUIsR0FBaUMsQ0FBakM7QUFDQSxhQUFZLE1BQVosQ0FBbUIsTUFBbkIsQ0FBMEIsR0FBMUIsR0FBZ0MsSUFBaEM7O0FBRUE7QUFDQTtBQUNBLGFBQVksTUFBWixDQUFtQixPQUFuQixDQUEyQixLQUEzQixHQUFtQyxJQUFuQztBQUNBLGFBQVksTUFBWixDQUFtQixPQUFuQixDQUEyQixNQUEzQixHQUFvQyxJQUFwQztBQUNBLE1BQUssV0FBTCxHQUFtQixXQUFuQjs7QUFFQSxNQUFLLEtBQUwsQ0FBVyxHQUFYLENBQWUsV0FBZjtBQUNBLE1BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxlQUFmO0FBQ0EsQ0F2Q0Q7O0FBeUNBOzs7QUFHQSxLQUFLLGFBQUwsR0FBcUIsWUFBWTs7QUFFaEMsT0FBTSxTQUFTLFFBQVEsYUFBUixDQUFmO0FBQ0EsT0FBTSxTQUFTLFFBQVEsYUFBUixDQUFmO0FBQ0EsT0FBTSxTQUFTLFFBQVEsYUFBUixDQUFmOztBQUVBLE1BQUssTUFBTCxHQUFjLElBQUksTUFBSixFQUFkO0FBQ0EsTUFBSyxNQUFMLEdBQWMsSUFBSSxNQUFKLEVBQWQ7O0FBRUE7QUFDQSxNQUFLLE1BQUwsR0FBYyxJQUFJLE1BQUosRUFBZDtBQUVBLENBWkQ7O0FBY0EsS0FBSyxJQUFMLEdBQVksVUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixLQUFoQixFQUF1QixTQUFTLEtBQWhDLEVBQXVDOztBQUVsRCxTQUFRLElBQUksTUFBTSxLQUFWLENBQWdCLFNBQVUsT0FBTSxLQUFLLE1BQUwsQ0FBWSxPQUFaLENBQW9CLEVBQUMsS0FBSyxDQUFOLEVBQVMsS0FBSyxHQUFkLEVBQXBCLENBQXdDLGNBQXhFLENBQVI7O0FBRUEsS0FBSSxRQUFKOztBQUVBLEtBQUksTUFBSixFQUFZO0FBQ1gsYUFBVyxNQUFNLGtCQUFOLENBQXlCO0FBQ25DLFVBQU8sS0FENEI7QUFFbkMsYUFBVSxDQUZ5QjtBQUduQyxZQUFTO0FBSDBCLEdBQXpCLENBQVg7QUFLQSxFQU5ELE1BUUs7QUFDSixhQUFXLElBQUksTUFBTSxpQkFBVixDQUE0QjtBQUN0QyxVQUFPO0FBRCtCLEdBQTVCLENBQVg7QUFHQTs7QUFFRSxLQUFJLFdBQVcsSUFBSSxNQUFNLFFBQVYsRUFBZjtBQUNBLFVBQVMsUUFBVCxDQUFrQixJQUFsQixDQUF1QixDQUF2QjtBQUNBLFVBQVMsUUFBVCxDQUFrQixJQUFsQixDQUF1QixDQUF2Qjs7QUFFQSxPQUFNLE9BQU8sSUFBSSxNQUFNLElBQVYsQ0FBZSxRQUFmLEVBQXlCLFFBQXpCLENBQWI7QUFDQSxNQUFLLElBQUwsR0FBWSxVQUFVLEtBQUssTUFBTCxDQUFZLE1BQVosRUFBdEI7O0FBRUEsUUFBTyxJQUFQO0FBRUgsQ0E3QkQ7O0FBK0JBOzs7QUFHQSxNQUFNLFFBQVE7QUFDYixRQUFPLENBRE07QUFFYixPQUFNO0FBRk8sQ0FBZDs7QUFLQSxLQUFLLElBQUwsR0FBWSxVQUFVLE9BQU8sQ0FBakIsRUFBb0I7O0FBRS9CLFNBQVEsSUFBUjs7QUFFQSxPQUFNLEtBQU4sR0FBYyxPQUFPLE1BQU0sSUFBM0I7QUFDQSxPQUFNLElBQU4sR0FBYSxJQUFiOztBQUVBO0FBQ0EsTUFBSyxRQUFMLENBQWMsTUFBZCxDQUFxQixLQUFyQjs7QUFFQTtBQUNBLE1BQUssS0FBTCxDQUFXLGVBQVgsQ0FBNEIsS0FBRCxJQUFXOztBQUVyQyxNQUFJLE1BQU0sSUFBTixJQUFjLE1BQU0sSUFBTixDQUFXLEtBQVgsQ0FBaUIsT0FBakIsQ0FBbEIsRUFBNkM7QUFDNUMsU0FBTSxRQUFOLENBQWUsa0JBQWYsR0FBb0MsSUFBcEM7QUFDQTs7QUFFRCxRQUFNLE1BQU4sSUFBZ0IsTUFBTSxNQUFOLENBQWEsS0FBYixDQUFoQjtBQUVBLEVBUkQ7O0FBVUE7QUFDQSxNQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLEtBQW5COztBQUVBO0FBQ0EsTUFBSyxRQUFMLENBQWMsTUFBZCxDQUFxQixLQUFLLEtBQTFCLEVBQWlDLEtBQUssTUFBdEM7O0FBRUE7QUFDQSxRQUFPLHFCQUFQLENBQTZCLEtBQUssSUFBTCxDQUFVLElBQVYsQ0FBZSxJQUFmLENBQTdCO0FBQ0EsQ0E3QkQ7O0FBaUNBLE9BQU8sT0FBUCxHQUFpQixJQUFqQjs7O0FDclFBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjs7QUFFQTs7O0FBR0EsTUFBTSxNQUFOLFNBQXFCLE1BQU0sSUFBM0IsQ0FBZ0M7O0FBRS9COzs7QUFHQSxlQUFjOztBQUViOztBQUVBLE9BQUssSUFBTCxHQUFZLFFBQVo7O0FBRUEsT0FBSyxRQUFMLEdBQWdCLElBQUksTUFBTSxhQUFWLENBQXdCLEVBQXhCLEVBQTRCLEVBQTVCLENBQWhCOztBQUVBLE9BQUssUUFBTCxHQUFnQixJQUFJLE1BQU0sbUJBQVYsQ0FBOEI7QUFDN0MsVUFBTyxJQUFJLE1BQU0sS0FBVixDQUFnQixTQUFoQixDQURzQztBQUU3QyxTQUFNLE1BQU07QUFGaUMsR0FBOUIsQ0FBaEI7O0FBS0EsT0FBSyxVQUFMLEdBQWtCLEtBQWxCO0FBQ0EsT0FBSyxhQUFMLEdBQXFCLElBQXJCOztBQUVBLE9BQUssS0FBTCxDQUFXLEdBQVgsQ0FBZSxJQUFmO0FBRUE7O0FBRUQ7OztBQUdBLFFBQU8sS0FBUCxFQUFjLElBQWQsRUFBb0IsQ0FFbkI7O0FBOUI4Qjs7QUFrQ2hDLE9BQU8sT0FBUCxHQUFpQixNQUFqQjs7O0FDdkNBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLE1BQU0sS0FBSyxLQUFLLEVBQWhCOztBQUVBOzs7QUFHQSxNQUFNLE1BQU4sU0FBcUIsTUFBTSxXQUEzQixDQUF1Qzs7QUFFdEM7OztBQUdBLGVBQWM7O0FBRWIsUUFBTSxXQUFXLEtBQUssS0FBTCxDQUFXLE1BQVgsQ0FBa0IsUUFBbkM7O0FBRUEsUUFBTSxZQUFZLEtBQUssS0FBTCxDQUFXLE1BQVgsQ0FBa0IsU0FBcEM7QUFDQSxRQUFNLFdBQVcsSUFBSSxNQUFNLG1CQUFWLENBQThCO0FBQzlDLFVBQU8sSUFBSSxNQUFNLEtBQVYsQ0FBZ0IsU0FBaEI7QUFEdUMsR0FBOUIsQ0FBakI7O0FBSUEsUUFBTSxRQUFOLEVBQWdCLFFBQWhCOztBQUVBLE9BQUssSUFBTCxHQUFZLFFBQVo7O0FBRUEsT0FBSyxVQUFMLEdBQWtCLElBQWxCO0FBQ0EsT0FBSyxhQUFMLEdBQXFCLEtBQXJCOztBQUVBO0FBQ0EsT0FBSyxLQUFMLEdBQWEsSUFBSSxNQUFNLGNBQVYsQ0FBeUIsSUFBekIsQ0FBYjs7QUFFQTtBQUNBLE9BQUssUUFBTCxHQUFnQixJQUFJLE1BQU0sT0FBVixDQUFrQixDQUFsQixFQUFxQixDQUFyQixFQUF3QixDQUF4QixDQUFoQjs7QUFFQTtBQUNBLE9BQUssV0FBTCxHQUFtQixHQUFuQjs7QUFFQTtBQUNBLE9BQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsS0FBSyxFQUFMLEdBQVUsQ0FBaEM7QUFDQSxPQUFLLFFBQUwsQ0FBYyxrQkFBZDtBQUNBLE9BQUssUUFBTCxDQUFjLG9CQUFkO0FBQ0EsT0FBSyxRQUFMLENBQWMsbUJBQWQ7O0FBRUE7QUFDQSxPQUFLLE9BQUwsR0FBZSxFQUFmOztBQUVBLFVBQVEsR0FBUixDQUFZLElBQVo7QUFDQSxPQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksS0FBSyxRQUFMLENBQWMsVUFBZCxDQUF5QixNQUE3QyxFQUFxRCxHQUFyRCxFQUEwRDs7QUFFekQsU0FBTSxPQUFPLEtBQUssUUFBTCxDQUFjLFVBQWQsQ0FBeUIsQ0FBekIsQ0FBYjtBQUNBLFNBQU0sU0FBUyxLQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLElBQXRCLENBQWY7O0FBRUEsVUFBTyxrQkFBUCxDQUEwQixDQUExQixFQUE2QixJQUE3Qjs7QUFFQSxRQUFLLE9BQUwsQ0FBYSxLQUFLLElBQWxCLElBQTBCLE1BQTFCOztBQUVBLFdBQVEsR0FBUixDQUFZLE1BQVo7QUFFQTs7QUFHRCxPQUFLLEtBQUwsQ0FBVyxHQUFYLENBQWUsSUFBZjtBQUNBOztBQUVEOzs7QUFHQSxRQUFPLEtBQVAsRUFBYzs7QUFFYjtBQUNBLFFBQU0sVUFBVSxJQUFJLE1BQU0sT0FBVixDQUNmLENBQUMsS0FBSyxRQUFMLENBQWMsU0FEQSxFQUVmLENBQUMsS0FBSyxRQUFMLENBQWMsU0FGQSxDQUFoQjs7QUFLQTtBQUNBLFFBQU0sUUFBUSxRQUFRLE1BQVIsRUFBZDs7QUFFQTtBQUNBLE9BQUssUUFBTCxDQUFjLENBQWQsSUFBbUIsQ0FBQyxRQUFRLENBQVIsR0FBWSxLQUFLLFFBQUwsQ0FBYyxDQUEzQixJQUFnQyxHQUFoQyxHQUFzQyxNQUFNLEtBQS9EO0FBQ0EsT0FBSyxRQUFMLENBQWMsQ0FBZCxJQUFtQixDQUFDLFFBQVEsQ0FBUixHQUFZLEtBQUssUUFBTCxDQUFjLENBQTNCLElBQWdDLEdBQWhDLEdBQXNDLE1BQU0sS0FBL0Q7O0FBRUE7QUFDQSxNQUFJLFFBQVEsQ0FBWixFQUFlLEtBQUssUUFBTCxDQUFjLGNBQWQsQ0FBNkIsS0FBN0I7O0FBRWY7QUFDQSxPQUFLLFFBQUwsQ0FBYyxXQUFkLENBQTBCLENBQUMsS0FBSyxXQUFoQyxFQUE2QyxDQUFDLEtBQUssV0FBbkQ7O0FBRUE7QUFDQSxPQUFLLFFBQUwsQ0FBYyxHQUFkLENBQWtCLEtBQUssUUFBdkI7O0FBR0E7QUFDQSxRQUFNLGlCQUFpQixLQUFLLEtBQUwsQ0FBVyxLQUFLLFFBQUwsQ0FBYyxDQUF6QixFQUE0QixLQUFLLFFBQUwsQ0FBYyxDQUExQyxDQUF2Qjs7QUFFQTtBQUNBLE1BQUksT0FBTyxpQkFBaUIsS0FBSyxRQUFMLENBQWMsQ0FBMUM7O0FBRUE7QUFDQSxNQUFJLEtBQUssR0FBTCxDQUFTLElBQVQsSUFBaUIsS0FBSyxFQUExQixFQUE4Qjs7QUFFN0IsUUFBSyxRQUFMLENBQWMsQ0FBZCxJQUFtQixLQUFLLEVBQUwsR0FBVSxDQUFWLEdBQWMsS0FBSyxJQUFMLENBQVUsSUFBVixDQUFqQztBQUNBLFVBQU8saUJBQWlCLEtBQUssUUFBTCxDQUFjLENBQXRDO0FBRUE7O0FBRUQ7QUFDQSxPQUFLLFFBQUwsQ0FBYyxDQUFkLElBQW1CLE9BQU8sSUFBUCxHQUFjLE1BQU0sS0FBdkM7O0FBRUE7QUFDQSxPQUFLLEtBQUwsQ0FBVyxNQUFYLENBQWtCLE1BQU0sS0FBeEI7QUFDQTs7QUFFRDs7O0FBR0EsTUFBSyxRQUFMLEVBQWUsU0FBUyxDQUF4QixFQUEyQjtBQUMxQixTQUFPLEtBQUssS0FBTCxDQUNMLFVBREssQ0FDTSxRQUROLEVBRUwsa0JBRkssQ0FFYyxNQUZkLEVBR0wsSUFISyxFQUFQO0FBSUE7O0FBbEhxQzs7QUFzSHZDLE9BQU8sT0FBUCxHQUFpQixNQUFqQjs7O0FDNUhBLE1BQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLE1BQU0sV0FBVyxRQUFRLFlBQVIsQ0FBakI7O0FBRUE7OztBQUdBLE1BQU0sZUFBTixTQUE4QixRQUE5QixDQUF1Qzs7QUFFdEMsZUFBYzs7QUFFYjs7QUFFQSxPQUFLLEdBQUwsQ0FBUyxHQUFULENBQWEsSUFBYixFQUFtQixXQUFuQixFQUFnQyxDQUFDLENBQWpDLEVBQW9DLENBQXBDLEVBQXVDLElBQXZDLENBQTRDLElBQTVDLEVBQWtELE1BQWxEO0FBQ0EsT0FBSyxHQUFMLENBQVMsR0FBVCxDQUFhLElBQWIsRUFBbUIsV0FBbkIsRUFBZ0MsQ0FBQyxDQUFqQyxFQUFvQyxDQUFwQyxFQUF1QyxJQUF2QyxDQUE0QyxJQUE1QyxFQUFrRCxNQUFsRDtBQUNBLE9BQUssR0FBTCxDQUFTLEdBQVQsQ0FBYSxJQUFiLEVBQW1CLFlBQW5CLEVBQWlDLE1BQWpDO0FBRUE7O0FBRUQsS0FBSSxZQUFKLEdBQW1COztBQUVsQixTQUFPLEtBQUssT0FBTCxDQUNOLEtBQUssT0FBTCxDQUFhLE1BRFAsRUFFTjtBQUNDLGFBQVUsR0FEWDtBQUVDLGFBQVU7QUFGWCxHQUZNLENBQVA7QUFRQTs7QUFFRCxLQUFJLFNBQUosR0FBZ0I7O0FBRWYsU0FBTyxLQUFLLE9BQUwsQ0FDTixLQUFLLE9BQUwsQ0FBYSxNQURQLEVBRU47QUFDQyxhQUFVLEdBRFg7QUFFQyxhQUFVO0FBRlgsR0FGTSxDQUFQO0FBUUE7O0FBRUQsS0FBSSxTQUFKLEdBQWdCOztBQUVmLFNBQU8sS0FBSyxPQUFMLENBQ04sS0FBSyxPQUFMLENBQWEsTUFEUCxFQUVOO0FBQ0MsYUFBVSxHQURYO0FBRUMsYUFBVTtBQUZYLEdBRk0sQ0FBUDtBQVFBOztBQTlDcUM7O0FBa0R2QyxPQUFPLE9BQVAsR0FBaUIsZUFBakI7OztBQ3hEQSxNQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxNQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7O0FBRUEsT0FBTyxnQkFBUCxDQUF3QixNQUF4QixFQUFnQyxZQUFZOztBQUUzQyxNQUFLLElBQUwsQ0FBVSxNQUFNOztBQUVmLE9BQUssV0FBTDtBQUNBLE9BQUssWUFBTDtBQUNBLE9BQUssYUFBTDs7QUFFQSxVQUFRLEdBQVIsQ0FBWSxRQUFaOztBQUVBLFNBQU8sSUFBUCxHQUFjLElBQWQ7O0FBRUEsT0FBSyxJQUFMO0FBRUEsRUFaRDtBQWNBLENBaEJELEVBZ0JHLEtBaEJIOzs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxudmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbmZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG59XG5cbnJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxucmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG5cbmZ1bmN0aW9uIHBsYWNlSG9sZGVyc0NvdW50IChiNjQpIHtcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gIHJldHVybiBiNjRbbGVuIC0gMl0gPT09ICc9JyA/IDIgOiBiNjRbbGVuIC0gMV0gPT09ICc9JyA/IDEgOiAwXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKGI2NCkge1xuICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgcmV0dXJuIGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVyc0NvdW50KGI2NClcbn1cblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICBwbGFjZUhvbGRlcnMgPSBwbGFjZUhvbGRlcnNDb3VudChiNjQpXG5cbiAgYXJyID0gbmV3IEFycihsZW4gKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gbGVuIC0gNCA6IGxlblxuXG4gIHZhciBMID0gMFxuXG4gIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIG91dHB1dCA9ICcnXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKSkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAyXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9PSdcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgKHVpbnQ4W2xlbiAtIDFdKVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDEwXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz0nXG4gIH1cblxuICBwYXJ0cy5wdXNoKG91dHB1dClcblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG4vKlxuICogRXhwb3J0IGtNYXhMZW5ndGggYWZ0ZXIgdHlwZWQgYXJyYXkgc3VwcG9ydCBpcyBkZXRlcm1pbmVkLlxuICovXG5leHBvcnRzLmtNYXhMZW5ndGggPSBrTWF4TGVuZ3RoKClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5fX3Byb3RvX18gPSB7X19wcm90b19fOiBVaW50OEFycmF5LnByb3RvdHlwZSwgZm9vOiBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9fVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1ZmZlciAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChrTWF4TGVuZ3RoKCkgPCBsZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCB0eXBlZCBhcnJheSBsZW5ndGgnKVxuICB9XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIGlmICh0aGF0ID09PSBudWxsKSB7XG4gICAgICB0aGF0ID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gICAgfVxuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gIH1cblxuICByZXR1cm4gdGhhdFxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiAhKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZ09yT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnSWYgZW5jb2RpbmcgaXMgc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcnXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZSh0aGlzLCBhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20odGhpcywgYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tICh0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIGEgbnVtYmVyJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KVxuICB9XG5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhhdCwgdmFsdWUpXG59XG5cbi8qKlxuICogRnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdG8gQnVmZmVyKGFyZywgZW5jb2RpbmcpIGJ1dCB0aHJvd3MgYSBUeXBlRXJyb3JcbiAqIGlmIHZhbHVlIGlzIGEgbnVtYmVyLlxuICogQnVmZmVyLmZyb20oc3RyWywgZW5jb2RpbmddKVxuICogQnVmZmVyLmZyb20oYXJyYXkpXG4gKiBCdWZmZXIuZnJvbShidWZmZXIpXG4gKiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlclssIGJ5dGVPZmZzZXRbLCBsZW5ndGhdXSlcbiAqKi9cbkJ1ZmZlci5mcm9tID0gZnVuY3Rpb24gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGZyb20obnVsbCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgICB2YWx1ZTogbnVsbCxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jICh0aGF0LCBzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhudWxsLCBzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHRoYXQsIHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaXplOyArK2kpIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogRXF1aXZhbGVudCB0byBCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqICovXG5CdWZmZXIuYWxsb2NVbnNhZmUgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cbi8qKlxuICogRXF1aXZhbGVudCB0byBTbG93QnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG5cbiAgdmFyIGFjdHVhbCA9IHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIHRoYXQgPSB0aGF0LnNsaWNlKDAsIGFjdHVhbClcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ29mZnNldFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnbGVuZ3RoXFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBhcnJheVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbUFycmF5TGlrZSh0aGF0LCBhcnJheSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmopIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmopKSB7XG4gICAgdmFyIGxlbiA9IGNoZWNrZWQob2JqLmxlbmd0aCkgfCAwXG4gICAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW4pXG5cbiAgICBpZiAodGhhdC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGF0XG4gICAgfVxuXG4gICAgb2JqLmNvcHkodGhhdCwgMCwgMCwgbGVuKVxuICAgIHJldHVybiB0aGF0XG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIG9iai5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgfHwgJ2xlbmd0aCcgaW4gb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggIT09ICdudW1iZXInIHx8IGlzbmFuKG9iai5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIodGhhdCwgMClcbiAgICAgIH1cbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iailcbiAgICB9XG5cbiAgICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmouZGF0YSlcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgYXJyYXktbGlrZSBvYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGgoKWAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgQXJyYXlCdWZmZXIuaXNWaWV3ID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgc3RyaW5nIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXA2NCA9IGZ1bmN0aW9uIHN3YXA2NCAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgOCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gOCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDcpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDYpXG4gICAgc3dhcCh0aGlzLCBpICsgMiwgaSArIDUpXG4gICAgc3dhcCh0aGlzLCBpICsgMywgaSArIDQpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgIC8vIENvZXJjZSB0byBOdW1iZXIuXG4gIGlmIChpc05hTihieXRlT2Zmc2V0KSkge1xuICAgIC8vIGJ5dGVPZmZzZXQ6IGl0IGl0J3MgdW5kZWZpbmVkLCBudWxsLCBOYU4sIFwiZm9vXCIsIGV0Yywgc2VhcmNoIHdob2xlIGJ1ZmZlclxuICAgIGJ5dGVPZmZzZXQgPSBkaXIgPyAwIDogKGJ1ZmZlci5sZW5ndGggLSAxKVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXQ6IG5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCArIGJ5dGVPZmZzZXRcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgIGlmIChkaXIpIHJldHVybiAtMVxuICAgIGVsc2UgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggLSAxXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICBpZiAoZGlyKSBieXRlT2Zmc2V0ID0gMFxuICAgIGVsc2UgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmFsXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICAvLyBGaW5hbGx5LCBzZWFyY2ggZWl0aGVyIGluZGV4T2YgKGlmIGRpciBpcyB0cnVlKSBvciBsYXN0SW5kZXhPZlxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmXG4gICAgICAgIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChkaXIpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggIT09IC0xKSBpIC09IGkgLSBmb3VuZEluZGV4XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYnl0ZU9mZnNldCArIHZhbExlbmd0aCA+IGFyckxlbmd0aCkgYnl0ZU9mZnNldCA9IGFyckxlbmd0aCAtIHZhbExlbmd0aFxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgZm91bmQgPSB0cnVlXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbExlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChyZWFkKGFyciwgaSArIGopICE9PSByZWFkKHZhbCwgaikpIHtcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZvdW5kKSByZXR1cm4gaVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgdHJ1ZSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uIGxhc3RJbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBmYWxzZSlcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGxhdGluMVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgKytpKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiYnVmZmVyXCIgYXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyArK2kpIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgKytpKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpIC0gMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKGNvZGUgPCAyNTYpIHtcbiAgICAgICAgdmFsID0gY29kZVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDI1NVxuICB9XG5cbiAgLy8gSW52YWxpZCByYW5nZXMgYXJlIG5vdCBzZXQgdG8gYSBkZWZhdWx0LCBzbyBjYW4gcmFuZ2UgY2hlY2sgZWFybHkuXG4gIGlmIChzdGFydCA8IDAgfHwgdGhpcy5sZW5ndGggPCBzdGFydCB8fCB0aGlzLmxlbmd0aCA8IGVuZCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIXZhbCkgdmFsID0gMFxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICAgIHRoaXNbaV0gPSB2YWxcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmlzQnVmZmVyKHZhbClcbiAgICAgID8gdmFsXG4gICAgICA6IHV0ZjhUb0J5dGVzKG5ldyBCdWZmZXIodmFsLCBlbmNvZGluZykudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyArK2kpIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gaXNuYW4gKHZhbCkge1xuICByZXR1cm4gdmFsICE9PSB2YWwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1zZWxmLWNvbXBhcmVcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCJjb25zdCBnYW1lID0gcmVxdWlyZSgnLi9nYW1lJylcclxuXHJcbmNsYXNzIENhbWVyYSBleHRlbmRzIFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhIHtcclxuXHRcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFxyXG5cdFx0Y29uc3QgYXNwZWN0UmF0aW8gPSBnYW1lLndpZHRoIC8gZ2FtZS5oZWlnaHRcclxuXHRcdGNvbnN0IGZpZWxkT2ZWaWV3ID0gNDBcclxuXHRcdGNvbnN0IG5lYXJQbGFuZSA9IDFcclxuXHRcdGNvbnN0IGZhclBsYW5lID0gMTAwMDBcclxuXHRcdFxyXG5cdFx0c3VwZXIoXHJcblx0XHRcdGZpZWxkT2ZWaWV3LFxyXG5cdFx0XHRhc3BlY3RSYXRpbyxcclxuXHRcdFx0bmVhclBsYW5lLFxyXG5cdFx0XHRmYXJQbGFuZVxyXG5cdFx0KVxyXG5cdFx0XHJcblx0XHRnYW1lLnNjZW5lLmFkZCh0aGlzKVxyXG5cdFx0XHJcblx0XHQvLyBSZWTDqWZpbmlyIGxlIGhhdXRcclxuXHRcdHRoaXMudXAuY29weShuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKSlcclxuXHRcdFxyXG5cdFx0Ly8gUG9zaXRpb24gZGUgbGEgY2Ftw6lyYSBwYXIgcmFwcG9ydCBhdSBqb3VldXJcclxuXHRcdHRoaXMuZGlzdGFuY2VUb1BsYXllciA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDEwLCA1KVxyXG5cclxuXHR9XHJcblx0XHJcblx0dXBkYXRlKGV2ZW50KSB7XHJcblx0XHRcclxuXHRcdC8vIEFkb3VjaXNzZW1lbnQgZHUgZMOpcGxhY2VtZW50IGRlIGxhIGNhbcOpcmFcclxuXHRcdGNvbnN0IHNwZWVkID0gMC41XHJcblx0XHRjb25zdCB0YXJnZXQgPSBnYW1lLnBsYXllci5wb3NpdGlvbi5jbG9uZSgpLmFkZCh0aGlzLmRpc3RhbmNlVG9QbGF5ZXIpXHJcblx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb25cclxuXHRcdFxyXG5cdFx0cG9zaXRpb24ueCArPSAodGFyZ2V0LnggLSBwb3NpdGlvbi54KSAvIHNwZWVkICogZXZlbnQuZGVsdGFcclxuXHRcdHBvc2l0aW9uLnkgKz0gKHRhcmdldC55IC0gcG9zaXRpb24ueSkgLyBzcGVlZCAqIGV2ZW50LmRlbHRhXHJcblx0XHRwb3NpdGlvbi56ICs9ICh0YXJnZXQueiAtIHBvc2l0aW9uLnopIC8gc3BlZWQgKiBldmVudC5kZWx0YVxyXG5cdFx0XHJcblx0XHQvLyBSZWdhcmRlciBsZSBqb3VldXJcclxuXHRcdHRoaXMubG9va0F0KGdhbWUucGxheWVyLmdldFdvcmxkUG9zaXRpb24oKSlcclxuXHRcdFxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDYW1lcmEiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRyZWQ6IDB4ZjI1MzQ2LFxyXG5cdHdoaXRlOiAweGQ4ZDBkMSxcclxuXHRicm93bjogMHg1OTMzMmUsXHJcblx0cGluazogMHhGNTk4NkUsXHJcblx0YnJvd25EYXJrOiAweDIzMTkwZixcclxuXHRibHVlOiAweDY4YzNjMCxcclxufTsiLCIvKipcclxuICogR8OocmUgbGVzIGNvbnRyw7RsZXMgKGNsYXZpZXIvc291cmlzIGV0IG1hbmV0dGUpIGR1IGpvdWV1clxyXG4gKi9cclxuY2xhc3MgQ29udHJvbHMge1xyXG5cdFxyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHR0aGlzLmdhbWVwYWQgPSBudWxsXHJcblx0XHR0aGlzLmRlYWR6b25lID0gMC4yXHJcblx0XHRcclxuXHRcdC8vIENvbnRyw7RsZXVyIGFjdHVlbGxlbWVudCB1dGlsaXPDqSAoJ2dhbWVwYWQnIG91ICdrZXlib2FyZCcpXHJcblx0XHR0aGlzLmNvbnRyb2xsZXIgPSAna2V5Ym9hcmQnXHJcblx0XHRcclxuXHRcdC8vIFZhbGV1cnMgc2F1dmVnYXJkw6llc1xyXG5cdFx0dGhpcy52YWx1ZXMgPSB7XHJcblx0XHRcdGtleWJvYXJkOiB7fSxcclxuXHRcdFx0Z2FtZXBhZDogbnVsbFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBWYWxldXJzIHByw6ljw6lkZW50ZXNcclxuXHRcdHRoaXMucHJldmlvdXMgPSB7XHJcblx0XHRcdGtleWJvYXJkOiB7fSxcclxuXHRcdFx0Z2FtZXBhZDogbnVsbFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBDb25zdGFudGVzXHJcblx0XHR0aGlzLkdBTUVQQUQgPSB7XHJcblx0XHRcdEE6IDAsXHJcblx0XHRcdEI6IDEsXHJcblx0XHRcdFg6IDIsXHJcblx0XHRcdFk6IDMsXHJcblx0XHRcdExCOiA0LFxyXG5cdFx0XHRSQjogNSxcclxuXHRcdFx0TFQ6IDYsXHJcblx0XHRcdFJUOiA3LFxyXG5cdFx0XHRCQUNLOiA4LFxyXG5cdFx0XHRTVEFSVDogOSxcclxuXHRcdFx0VVA6IDEyLFxyXG5cdFx0XHRET1dOOiAxMyxcclxuXHRcdFx0TEVGVDogMTQsXHJcblx0XHRcdFJJR0hUOiAxNSxcclxuXHRcdFx0XHJcblx0XHRcdExFRlRfWDogMCxcclxuXHRcdFx0TEVGVF9ZOiAxLFxyXG5cdFx0XHRSSUdIVF9YOiAyLFxyXG5cdFx0XHRSSUdIVF9ZOiAzXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQnJhbmNoZW1lbnQgZCd1bmUgbWFuZXR0ZVxyXG5cdFx0ICovXHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImdhbWVwYWRjb25uZWN0ZWRcIiwgKGV2ZW50KSA9PiB7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgZ3AgPSBldmVudC5nYW1lcGFkXHJcblx0XHRcdFxyXG5cdFx0XHRjb25zb2xlLmxvZyhcIkNvbnRyw7RsZXVyIG7CsCVkIGNvbm5lY3TDqSA6ICVzLiAlZCBib3V0b25zLCAlZCBheGVzLlwiLFxyXG5cdFx0XHRcdGdwLmluZGV4LCBncC5pZCxcclxuXHRcdFx0XHRncC5idXR0b25zLmxlbmd0aCwgZ3AuYXhlcy5sZW5ndGgpXHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmdhbWVwYWQgPSBncFxyXG5cdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAnZ2FtZXBhZCdcclxuXHJcblx0XHR9KVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEFwcHVpIHN1ciB1bmUgdG91Y2hlXHJcblx0XHQgKi9cclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMudmFsdWVzLmtleWJvYXJkW2V2ZW50LmtleV0gPSB0cnVlXHJcblx0XHRcdHRoaXMuY29udHJvbGxlciA9ICdrZXlib2FyZCdcclxuXHRcdFx0XHJcblx0XHR9KVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEFwcHVpIHN1ciB1bmUgdG91Y2hlXHJcblx0XHQgKi9cclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiB7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLnZhbHVlcy5rZXlib2FyZFtldmVudC5rZXldID0gZmFsc2VcclxuXHRcdFx0dGhpcy5jb250cm9sbGVyID0gJ2tleWJvYXJkJ1xyXG5cdFx0XHRcclxuXHRcdH0pXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogTWlzZSDDoCBqb3VyXHJcblx0ICovXHJcblx0dXBkYXRlKGV2ZW50KSB7XHJcblx0XHRcclxuXHRcdGxldCBnYW1lcGFkcyA9IG5hdmlnYXRvci5nZXRHYW1lcGFkcygpXHJcblx0XHR0aGlzLmdhbWVwYWQgPSBnYW1lcGFkc1swXVxyXG5cdFx0XHJcblx0XHRpZiAodGhpcy5nYW1lcGFkKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRjb25zdCBwcmV2aW91cyA9IHRoaXMucHJldmlvdXMuZ2FtZXBhZFxyXG5cdFx0XHRjb25zdCBjdXJyZW50ID0gdGhpcy5jb3B5R2FtZXBhZFZhbHVlcyh0aGlzLmdhbWVwYWQpXHJcblx0XHRcdFxyXG5cdFx0XHRpZiAocHJldmlvdXMpIHtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQuYnV0dG9ucy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAocHJldmlvdXMuYnV0dG9uc1tpXS5wcmVzc2VkICE9PSBjdXJyZW50LmJ1dHRvbnNbaV0ucHJlc3NlZCkge1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0dGhpcy5jb250cm9sbGVyID0gJ2dhbWVwYWQnXHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQuYXhlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRpZiAocHJldmlvdXMuYXhlc1tpXSAhPT0gY3VycmVudC5heGVzW2ldKSB7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHR0aGlzLmNvbnRyb2xsZXIgPSAnZ2FtZXBhZCdcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHRcclxuXHRcdFx0dGhpcy5wcmV2aW91cy5nYW1lcGFkID0gdGhpcy52YWx1ZXMuZ2FtZXBhZFxyXG5cdFx0XHR0aGlzLnZhbHVlcy5nYW1lcGFkID0gY3VycmVudFxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBUcmFuc2Zvcm1lIHVuIGF4ZSBkZSBqb3lzdGljayBwb3VyIHByZW5kcmUgZW4gY29tcHRlIGxhIHpvbmUgbW9ydGUuXHJcblx0ICogQHBhcmFtIDxOdW1iZXI+IGF4aXNcclxuXHQgKiBAcmV0dXJuIDxOdW1iZXI+XHJcblx0ICovXHJcblx0YXBwbHlEZWFkem9uZSh4KSB7XHJcblx0XHRcclxuXHRcdGxldCBkZWFkem9uZSA9IHRoaXMuZGVhZHpvbmVcclxuXHRcdFx0XHRcclxuXHRcdHggPSB4IDwgMCA/IE1hdGgubWluKHgsIC1kZWFkem9uZSkgOiBNYXRoLm1heCh4LCBkZWFkem9uZSlcclxuXHRcdFxyXG5cdFx0cmV0dXJuIChNYXRoLmFicyh4KSAtIGRlYWR6b25lKSAvICgxIC0gZGVhZHpvbmUpICogTWF0aC5zaWduKHgpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogQXhlIFggcHJpbmNpcGFsIChqb3lzdGljayBvdSBzb3VyaXMpXHJcblx0ICogQHBhcmFtIDxOdW1iZXI+IGdhbWVwYWRBeGlzSW5kZXhcclxuXHQgKiBAcGFyYW0gPE9iamVjdD4ga2V5Ym9hcmRLZXlzIDogeyBwb3NpdGl2ZTogPFN0cmluZz4sIG5lZ2F0aXZlOiA8U3RyaW5nPiB9XHJcblx0ICovXHJcblx0Z2V0QXhpcyhnYW1lcGFkQXhpc0luZGV4LCBrZXlib2FyZEtleXMpIHtcclxuXHRcdFxyXG5cdFx0c3dpdGNoICh0aGlzLmNvbnRyb2xsZXIpIHtcclxuXHRcdFx0XHJcblx0XHRcdGNhc2UgJ2dhbWVwYWQnOlxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLnZhbHVlcy5nYW1lcGFkID09PSBudWxsKSByZXR1cm4gMFxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlcy5nYW1lcGFkLmF4ZXNbZ2FtZXBhZEF4aXNJbmRleF1cclxuXHRcdFx0XHRcclxuXHRcdFx0XHRicmVha1xyXG5cdFx0XHRcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0Y2FzZSAna2V5Ym9hcmQnOlxyXG5cdFx0XHRcclxuXHRcdFx0XHRsZXQgcG9zaXRpdmUgPSB0aGlzLnZhbHVlcy5rZXlib2FyZFtrZXlib2FyZEtleXMucG9zaXRpdmVdID8gKzEgOiAwXHJcblx0XHRcdFx0bGV0IG5lZ2F0aXZlID0gdGhpcy52YWx1ZXMua2V5Ym9hcmRba2V5Ym9hcmRLZXlzLm5lZ2F0aXZlXSA/IC0xIDogMFxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHJldHVybiBwb3NpdGl2ZSArIG5lZ2F0aXZlXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0YnJlYWtcclxuXHRcdFx0XHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogQ29waWUgdG91dGVzIGxlcyB2YWxldXJzIGR1IGdhbWVwYWQgZGFucyB1biBvYmpldFxyXG5cdCAqIEBwYXJhbSA8R2FtZXBhZD5cclxuXHQgKiBAcmV0dXJuIDxPYmplY3Q+XHJcblx0ICovXHJcblx0Y29weUdhbWVwYWRWYWx1ZXMoZ2FtZXBhZCkge1xyXG5cdFx0XHJcblx0XHRsZXQgYXhlcyA9IFtdXHJcblx0XHRsZXQgYnV0dG9ucyA9IFtdXHJcblx0XHRcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZ2FtZXBhZC5idXR0b25zLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRidXR0b25zW2ldID0ge1xyXG5cdFx0XHRcdHZhbHVlOiBnYW1lcGFkLmJ1dHRvbnNbaV0udmFsdWUsXHJcblx0XHRcdFx0cHJlc3NlZDogZ2FtZXBhZC5idXR0b25zW2ldLnByZXNzZWRcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBnYW1lcGFkLmF4ZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHJcblx0XHRcdGF4ZXNbaV0gPSB0aGlzLmFwcGx5RGVhZHpvbmUoZ2FtZXBhZC5heGVzW2ldKVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0YXhlczogYXhlcyxcclxuXHRcdFx0YnV0dG9uczogYnV0dG9uc1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0fVxyXG5cdFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2xzXHJcblxyXG4iLCJjb25zdCBjb2xvcnMgPSByZXF1aXJlKCcuL2NvbG9ycycpXHJcbmNvbnN0IENoYW5jZSA9IHJlcXVpcmUoJ2NoYW5jZScpXHJcbmNvbnN0IGdhbWUgPSB7fVxyXG5cclxuLyoqXHJcbiAqIEZpY2hpZXJzIEpTT05cclxuICovXHJcbmdhbWUuZmlsZXMgPSB7XHJcblx0cGxheWVyOiB7XHJcblx0XHRwYXRoOiAnLi4vbW9kZWxzL3BsYXllci5qc29uJ1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENoYXJnZXIgbGVzIGZpY2hpZXJzXHJcbiAqL1xyXG5nYW1lLmxvYWQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuXHRcclxuXHQvLyBMb2FkZXJcclxuXHRjb25zdCBsb2FkZXIgPSBuZXcgVEhSRUUuSlNPTkxvYWRlcigpXHJcblx0XHJcblx0Ly8gVsOpcmlmaWVyIHF1J3VuIGZpY2hpZXIgZXN0IGNoYXJnw6lcclxuXHRjb25zdCBpc0xvYWRlZCA9IChmaWxlKSA9PiB7XHJcblx0XHRcclxuXHRcdHJldHVybiBmaWxlLmdlb21ldHJ5ICE9PSB1bmRlZmluZWQgfHwgZmlsZS5tYXRlcmlhbHMgIT09IHVuZGVmaW5lZFxyXG5cdFxyXG5cdH1cclxuXHRcclxuXHQvLyBDaGFyZ2VyIGNoYXF1ZSBmaWNoaWVyXHJcblx0Zm9yIChsZXQgZiBpbiB0aGlzLmZpbGVzKSB7XHJcblx0XHRcclxuXHRcdGxldCBmaWxlID0gdGhpcy5maWxlc1tmXVxyXG5cdFx0XHJcblx0XHRpZiAoISBpc0xvYWRlZChmaWxlKSkge1xyXG5cdFx0XHRcclxuXHRcdFx0bG9hZGVyLmxvYWQoZmlsZS5wYXRoLCAoZ2VvbWV0cnksIG1hdGVyaWFscykgPT4ge1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGZpbGUuZ2VvbWV0cnkgPSBnZW9tZXRyeVxyXG5cdFx0XHRcdGZpbGUubWF0ZXJpYWxzID0gbWF0ZXJpYWxzXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Y29uc29sZS5pbmZvKGBMb2FkZWQ6ICR7ZmlsZS5wYXRofWApXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0bGV0IGFsbExvYWRlZCA9IHRydWVcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRmb3IgKGxldCBmZiBpbiB0aGlzLmZpbGVzKSB7XHJcblxyXG5cdFx0XHRcdFx0YWxsTG9hZGVkID0gYWxsTG9hZGVkICYmIGlzTG9hZGVkKHRoaXMuZmlsZXNbZmZdKVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAoYWxsTG9hZGVkKSBjYWxsYmFjaygpXHJcblx0XHRcdFx0XHJcblx0XHRcdH0pXHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdFx0XHJcblx0fVxyXG5cdFxyXG59XHJcbiBcclxuLyoqXHJcbiAqIENyw6lhdGlvbiBkZSBsYSBzY8OobmVcclxuICovXHJcbmdhbWUuY3JlYXRlU2NlbmUgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHJcblx0Ly8gR2V0IHRoZSB3aWR0aCBhbmQgdGhlIGhlaWdodCBvZiB0aGUgc2NyZWVuLFxyXG5cdC8vIHVzZSB0aGVtIHRvIHNldCB1cCB0aGUgYXNwZWN0IHJhdGlvIG9mIHRoZSBjYW1lcmEgXHJcblx0Ly8gYW5kIHRoZSBzaXplIG9mIHRoZSByZW5kZXJlci5cclxuXHR0aGlzLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodFxyXG5cdHRoaXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aFxyXG5cclxuXHQvLyBDcmVhdGUgdGhlIHNjZW5lXHJcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpXHJcblx0XHJcblx0Ly8gUmFuZG9tXHJcblx0dGhpcy5jaGFuY2UgPSBuZXcgQ2hhbmNlKCc0NTM2NDUzJylcclxuXHRcclxuXHQvLyBkYXQuZ3VpXHJcblx0dGhpcy5ndWkgPSBuZXcgZGF0LkdVSSgpXHJcblx0XHJcblx0Ly8gQ29udHLDtGxlc1xyXG5cdGNvbnN0IENvbnRyb2xzID0gcmVxdWlyZSgnLi9zb2xhcmlzLWNvbnRyb2xzJylcclxuXHR0aGlzLmNvbnRyb2xzID0gbmV3IENvbnRyb2xzXHJcblx0XHJcblx0Ly8gQWRkIGEgZm9nIGVmZmVjdCB0byB0aGUgc2NlbmUgc2FtZSBjb2xvciBhcyB0aGVcclxuXHQvLyBiYWNrZ3JvdW5kIGNvbG9yIHVzZWQgaW4gdGhlIHN0eWxlIHNoZWV0XHJcblx0Ly8gdGhpcy5zY2VuZS5mb2cgPSBuZXcgVEhSRUUuRm9nKG5ldyBUSFJFRS5Db2xvcihcIiM1REJERTVcIiksIDE1MCwgMzAwKVxyXG5cdFxyXG5cdC8vIENyZWF0ZSB0aGUgcmVuZGVyZXJcclxuXHRjb25zdCByZW5kZXJlciA9IHRoaXMucmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7IFxyXG5cdFx0Ly8gQWxsb3cgdHJhbnNwYXJlbmN5IHRvIHNob3cgdGhlIGdyYWRpZW50IGJhY2tncm91bmRcclxuXHRcdC8vIHdlIGRlZmluZWQgaW4gdGhlIENTU1xyXG5cdFx0YWxwaGE6IHRydWUsIFxyXG5cclxuXHRcdC8vIEFjdGl2YXRlIHRoZSBhbnRpLWFsaWFzaW5nIHRoaXMgaXMgbGVzcyBwZXJmb3JtYW50LFxyXG5cdFx0Ly8gYnV0LCBhcyBvdXIgcHJvamVjdCBpcyBsb3ctcG9seSBiYXNlZCwgaXQgc2hvdWxkIGJlIGZpbmUgOilcclxuXHRcdGFudGlhbGlhczogdHJ1ZSBcclxuXHR9KVxyXG5cclxuXHQvLyBEZWZpbmUgdGhlIHNpemUgb2YgdGhlIHJlbmRlcmVyIGluIHRoaXMgY2FzZSxcclxuXHQvLyBpdCB3aWxsIGZpbGwgdGhlIGVudGlyZSBzY3JlZW5cclxuXHRyZW5kZXJlci5zZXRTaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KVxyXG5cdFxyXG5cdC8vIEVuYWJsZSBzaGFkb3cgcmVuZGVyaW5nXHJcblx0cmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlXHJcblx0cmVuZGVyZXIuc2hhZG93TWFwLnR5cGUgPSBUSFJFRS5QQ0ZTb2Z0U2hhZG93TWFwXHJcblx0XHJcblx0Ly8gQWRkIHRoZSBET00gZWxlbWVudCBvZiB0aGUgcmVuZGVyZXIgdG8gdGhlIFxyXG5cdC8vIGNvbnRhaW5lciB3ZSBjcmVhdGVkIGluIHRoZSBIVE1MXHJcblx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWFpbicpXHJcblx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHJlbmRlcmVyLmRvbUVsZW1lbnQpXHJcblx0XHJcblx0Ly8gTGlzdGVuIHRvIHRoZSBzY3JlZW46IGlmIHRoZSB1c2VyIHJlc2l6ZXMgaXRcclxuXHQvLyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgY2FtZXJhIGFuZCB0aGUgcmVuZGVyZXIgc2l6ZVxyXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCAoKSA9PiB7XHJcblx0XHRcclxuXHRcdHRoaXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0XHJcblx0XHR0aGlzLndpZHRoID0gd2luZG93LmlubmVyV2lkdGhcclxuXHRcdFxyXG5cdFx0cmVuZGVyZXIuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodClcclxuXHRcdFxyXG5cdFx0dGhpcy5jYW1lcmEuYXNwZWN0ID0gdGhpcy53aWR0aCAvIHRoaXMuaGVpZ2h0XHJcblx0XHR0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KClcclxuXHRcdFxyXG5cdH0sIGZhbHNlKVxyXG5cdFxyXG59XHJcblxyXG4vKipcclxuICogQ3LDqWF0aW9uIGRlcyBsdW1pw6hyZXNcclxuICovXHJcbmdhbWUuY3JlYXRlTGlnaHRzID0gZnVuY3Rpb24gKCkge1xyXG5cdFxyXG5cdC8vIEEgaGVtaXNwaGVyZSBsaWdodCBpcyBhIGdyYWRpZW50IGNvbG9yZWQgbGlnaHQ7IFxyXG5cdC8vIHRoZSBmaXJzdCBwYXJhbWV0ZXIgaXMgdGhlIHNreSBjb2xvciwgdGhlIHNlY29uZCBwYXJhbWV0ZXIgaXMgdGhlIGdyb3VuZCBjb2xvciwgXHJcblx0Ly8gdGhlIHRoaXJkIHBhcmFtZXRlciBpcyB0aGUgaW50ZW5zaXR5IG9mIHRoZSBsaWdodFxyXG5cdGNvbnN0IGhlbWlzcGhlcmVMaWdodCA9IG5ldyBUSFJFRS5IZW1pc3BoZXJlTGlnaHQoXHJcblx0XHRuZXcgVEhSRUUuQ29sb3IoXCIjRkZGRkZGXCIpLFxyXG5cdFx0bmV3IFRIUkVFLkNvbG9yKFwiI0ZGRkZGRlwiKSxcclxuXHRcdDFcclxuXHQpXHJcblx0XHJcblx0XHJcblx0Ly8gQSBkaXJlY3Rpb25hbCBsaWdodCBzaGluZXMgZnJvbSBhIHNwZWNpZmljIGRpcmVjdGlvbi4gXHJcblx0Ly8gSXQgYWN0cyBsaWtlIHRoZSBzdW4sIHRoYXQgbWVhbnMgdGhhdCBhbGwgdGhlIHJheXMgcHJvZHVjZWQgYXJlIHBhcmFsbGVsLiBcclxuXHRjb25zdCBzaGFkb3dMaWdodCA9IG5ldyBUSFJFRS5EaXJlY3Rpb25hbExpZ2h0KDB4ZmZmZmZmLCAwLjMpXHJcblx0XHJcblx0Ly8gU2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIGxpZ2h0ICBcclxuXHRzaGFkb3dMaWdodC5wb3NpdGlvbi5zZXQoMCwgMCwgMTApXHJcblx0XHJcblx0Ly8gQWxsb3cgc2hhZG93IGNhc3RpbmcgXHJcblx0c2hhZG93TGlnaHQuY2FzdFNoYWRvdyA9IHRydWVcclxuXHQvLyBzaGFkb3dMaWdodC5zaGFkb3dDYW1lcmFWaXNpYmxlID0gdHJ1ZVxyXG5cclxuXHQvLyAvLyBkZWZpbmUgdGhlIHZpc2libGUgYXJlYSBvZiB0aGUgcHJvamVjdGVkIHNoYWRvd1xyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEubGVmdCA9IC0yMFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEucmlnaHQgPSAyMFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEudG9wID0gMjBcclxuXHRzaGFkb3dMaWdodC5zaGFkb3cuY2FtZXJhLmJvdHRvbSA9IC0yMFxyXG5cdHNoYWRvd0xpZ2h0LnNoYWRvdy5jYW1lcmEubmVhciA9IDFcclxuXHRzaGFkb3dMaWdodC5zaGFkb3cuY2FtZXJhLmZhciA9IDEwMDBcclxuXHJcblx0Ly8gZGVmaW5lIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBzaGFkb3c7IHRoZSBoaWdoZXIgdGhlIGJldHRlciwgXHJcblx0Ly8gYnV0IGFsc28gdGhlIG1vcmUgZXhwZW5zaXZlIGFuZCBsZXNzIHBlcmZvcm1hbnRcclxuXHRzaGFkb3dMaWdodC5zaGFkb3cubWFwU2l6ZS53aWR0aCA9IDIwNDhcclxuXHRzaGFkb3dMaWdodC5zaGFkb3cubWFwU2l6ZS5oZWlnaHQgPSAyMDQ4XHJcblx0dGhpcy5zaGFkb3dMaWdodCA9IHNoYWRvd0xpZ2h0XHJcblxyXG5cdHRoaXMuc2NlbmUuYWRkKHNoYWRvd0xpZ2h0KVxyXG5cdHRoaXMuc2NlbmUuYWRkKGhlbWlzcGhlcmVMaWdodClcclxufVxyXG5cclxuLyoqXHJcbiAqIENyw6lhdGlvbiBkdSBzb2xcclxuICovXHJcbmdhbWUuY3JlYXRlT2JqZWN0cyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcclxuXHRjb25zdCBHcm91bmQgPSByZXF1aXJlKCcuL2dyb3VuZC5qcycpXHJcblx0Y29uc3QgUGxheWVyID0gcmVxdWlyZSgnLi9wbGF5ZXIuanMnKVxyXG5cdGNvbnN0IENhbWVyYSA9IHJlcXVpcmUoJy4vY2FtZXJhLmpzJylcclxuXHRcclxuXHR0aGlzLmdyb3VuZCA9IG5ldyBHcm91bmRcclxuXHR0aGlzLnBsYXllciA9IG5ldyBQbGF5ZXJcclxuXHRcclxuXHQvLyBDcmVhdGUgdGhlIGNhbWVyYVxyXG5cdHRoaXMuY2FtZXJhID0gbmV3IENhbWVyYVxyXG5cdFxyXG59XHJcblxyXG5nYW1lLmxpbmUgPSBmdW5jdGlvbiAoYSwgYiwgY29sb3IsIGRhc2hlZCA9IGZhbHNlKSB7XHJcblx0XHJcblx0Y29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IgfHwgYGhzbCgke3RoaXMuY2hhbmNlLmludGVnZXIoe21pbjogMCwgbWF4OiAzNjB9KX0sIDEwMCUsIDUwJSlgKVxyXG5cdFxyXG5cdGxldCBtYXRlcmlhbFxyXG5cdFxyXG5cdGlmIChkYXNoZWQpIHtcclxuXHRcdG1hdGVyaWFsID0gVEhSRUUuTGluZURhc2hlZE1hdGVyaWFsKHtcclxuXHRcdFx0Y29sb3I6IGNvbG9yLFxyXG5cdFx0XHRkYXNoU2l6ZTogMixcclxuXHRcdFx0Z2FwU2l6ZTogM1xyXG5cdFx0fSlcclxuXHR9XHJcblx0XHJcblx0ZWxzZSB7XHJcblx0XHRtYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7XHJcblx0XHRcdGNvbG9yOiBjb2xvclxyXG5cdFx0fSlcclxuXHR9XHJcblx0XHJcbiAgICB2YXIgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKVxyXG4gICAgZ2VvbWV0cnkudmVydGljZXMucHVzaChhKVxyXG4gICAgZ2VvbWV0cnkudmVydGljZXMucHVzaChiKVxyXG5cdFxyXG4gICAgY29uc3QgbGluZSA9IG5ldyBUSFJFRS5MaW5lKGdlb21ldHJ5LCBtYXRlcmlhbClcclxuICAgIGxpbmUubmFtZSA9IFwiTGluZSBcIiArIHRoaXMuY2hhbmNlLnN0cmluZygpXHJcbiAgICBcclxuICAgIHJldHVybiBsaW5lXHJcbiAgICBcclxufVxyXG5cclxuLyoqXHJcbiAqIEJvdWNsZSBkdSBqZXVcclxuICovXHJcbmNvbnN0IGV2ZW50ID0ge1xyXG5cdGRlbHRhOiAwLFxyXG5cdHRpbWU6IDBcclxufVxyXG5cclxuZ2FtZS5sb29wID0gZnVuY3Rpb24gKHRpbWUgPSAwKSB7XHJcblx0XHJcblx0dGltZSAvPSAxMDAwXHJcblx0XHJcblx0ZXZlbnQuZGVsdGEgPSB0aW1lIC0gZXZlbnQudGltZVxyXG5cdGV2ZW50LnRpbWUgPSB0aW1lXHJcblx0XHJcblx0Ly8gTWlzZSDDoCBqb3VyIGRlcyBjb250csO0bGVzXHJcblx0dGhpcy5jb250cm9scy51cGRhdGUoZXZlbnQpXHJcblx0XHJcblx0Ly8gTWlzZSDDoCBqb3VyIGRlcyBvYmpldHNcclxuXHR0aGlzLnNjZW5lLnRyYXZlcnNlVmlzaWJsZSgoY2hpbGQpID0+IHtcclxuXHRcdFxyXG5cdFx0aWYgKGNoaWxkLm5hbWUgJiYgY2hpbGQubmFtZS5tYXRjaCgvXkxpbmUvKSkge1xyXG5cdFx0XHRjaGlsZC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlXHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGNoaWxkLnVwZGF0ZSAmJiBjaGlsZC51cGRhdGUoZXZlbnQpXHJcblx0XHRcclxuXHR9KVxyXG5cdFxyXG5cdC8vIE1pc2Ugw6Agam91ciBkZSBsYSBjYW3DqXJhXHJcblx0dGhpcy5jYW1lcmEudXBkYXRlKGV2ZW50KVxyXG5cdFxyXG5cdC8vIEFmZmljaGFnZVxyXG5cdHRoaXMucmVuZGVyZXIucmVuZGVyKHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhKVxyXG5cdFxyXG5cdC8vIFByb2NoYWluZSBmcmFtZVxyXG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5sb29wLmJpbmQodGhpcykpXHJcbn1cclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBnYW1lIiwiY29uc3QgZ2FtZSA9IHJlcXVpcmUoJy4vZ2FtZScpXHJcblxyXG4vKipcclxuICogQ2xhc3MgR3JvdW5kXHJcbiAqL1xyXG5jbGFzcyBHcm91bmQgZXh0ZW5kcyBUSFJFRS5NZXNoIHtcclxuXHRcclxuXHQvKipcclxuXHQgKiBHcm91bmQgY29uc3RydWN0b3JcclxuXHQgKi9cclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFxyXG5cdFx0c3VwZXIoKVxyXG5cdFx0XHJcblx0XHR0aGlzLm5hbWUgPSBcIkdyb3VuZFwiXHJcblx0XHJcblx0XHR0aGlzLmdlb21ldHJ5ID0gbmV3IFRIUkVFLlBsYW5lR2VvbWV0cnkoMjAsIDIwKVxyXG5cdFx0XHJcblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hMYW1iZXJ0TWF0ZXJpYWwoe1xyXG5cdFx0XHRjb2xvcjogbmV3IFRIUkVFLkNvbG9yKCcjOURERDg3JyksXHJcblx0XHRcdHNpZGU6IFRIUkVFLkRvdWJsZVNpZGVcclxuXHRcdH0pXHJcblx0XHRcclxuXHRcdHRoaXMuY2FzdFNoYWRvdyA9IGZhbHNlXHJcblx0XHR0aGlzLnJlY2VpdmVTaGFkb3cgPSB0cnVlXHJcblx0XHRcclxuXHRcdGdhbWUuc2NlbmUuYWRkKHRoaXMpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogTWlzZSDDoCBqb3VyXHJcblx0ICovXHJcblx0dXBkYXRlKGRlbHRhLCB0aW1lKSB7XHJcblx0XHRcclxuXHR9XHJcblx0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR3JvdW5kIiwiY29uc3QgZ2FtZSA9IHJlcXVpcmUoJy4vZ2FtZScpXHJcbmNvbnN0IFBJID0gTWF0aC5QSVxyXG5cclxuLyoqXHJcbiAqIENsYXNzIFBsYXllclxyXG4gKi9cclxuY2xhc3MgUGxheWVyIGV4dGVuZHMgVEhSRUUuU2tpbm5lZE1lc2gge1xyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIFBsYXllciBjb25zdHJ1Y3RvclxyXG5cdCAqL1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHRjb25zdCBnZW9tZXRyeSA9IGdhbWUuZmlsZXMucGxheWVyLmdlb21ldHJ5XHJcblx0XHRcclxuXHRcdGNvbnN0IG1hdGVyaWFscyA9IGdhbWUuZmlsZXMucGxheWVyLm1hdGVyaWFsc1xyXG5cdFx0Y29uc3QgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaExhbWJlcnRNYXRlcmlhbCh7XHJcblx0XHRcdGNvbG9yOiBuZXcgVEhSRUUuQ29sb3IoJyNGNkMzNTcnKVxyXG5cdFx0fSlcclxuXHRcdFx0XHJcblx0XHRzdXBlcihnZW9tZXRyeSwgbWF0ZXJpYWwpXHJcblx0XHRcclxuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyXCJcclxuXHRcdFxyXG5cdFx0dGhpcy5jYXN0U2hhZG93ID0gdHJ1ZVxyXG5cdFx0dGhpcy5yZWNlaXZlU2hhZG93ID0gZmFsc2VcclxuXHRcdFxyXG5cdFx0Ly8gR2VzdGlvbm5haXJlIGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLm1peGVyID0gbmV3IFRIUkVFLkFuaW1hdGlvbk1peGVyKHRoaXMpXHJcblx0XHRcclxuXHRcdC8vIFZpdGVzc2UgZGUgZMOpcGxhY2VtZW50XHJcblx0XHR0aGlzLnZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMClcclxuXHRcdFxyXG5cdFx0Ly8gVml0ZXNzZSBkZSBkw6lwbGFjZW1lbnQgbWF4aW1hbGVcclxuXHRcdHRoaXMubWF4VmVsb2NpdHkgPSAwLjFcclxuXHRcdFxyXG5cdFx0Ly8gUm90YXRpb24gZHUgbW9kw6hsZSAzRFxyXG5cdFx0dGhpcy5nZW9tZXRyeS5yb3RhdGVYKE1hdGguUEkgLyAyKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlRmFjZU5vcm1hbHMoKVxyXG5cdFx0dGhpcy5nZW9tZXRyeS5jb21wdXRlVmVydGV4Tm9ybWFscygpXHJcblx0XHR0aGlzLmdlb21ldHJ5LmNvbXB1dGVNb3JwaE5vcm1hbHMoKVxyXG5cdFx0XHJcblx0XHQvLyBDaGFyZ2VtZW50IGRlcyBhbmltYXRpb25zXHJcblx0XHR0aGlzLmFjdGlvbnMgPSB7fVxyXG5cdFx0XHJcblx0XHRjb25zb2xlLmxvZyh0aGlzKVxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmdlb21ldHJ5LmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHJcblx0XHRcdGNvbnN0IGNsaXAgPSB0aGlzLmdlb21ldHJ5LmFuaW1hdGlvbnNbaV1cclxuXHRcdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5taXhlci5jbGlwQWN0aW9uKGNsaXApXHJcblx0XHRcdFxyXG5cdFx0XHRhY3Rpb24uc2V0RWZmZWN0aXZlV2VpZ2h0KDEpLnN0b3AoKVxyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5hY3Rpb25zW2NsaXAubmFtZV0gPSBhY3Rpb25cclxuXHRcdFx0XHJcblx0XHRcdGNvbnNvbGUubG9nKGFjdGlvbilcclxuXHRcdFx0XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdFxyXG5cdFx0Z2FtZS5zY2VuZS5hZGQodGhpcylcclxuXHR9XHJcblx0XHJcblx0LyoqXHJcblx0ICogTWlzZSDDoCBqb3VyXHJcblx0ICovXHJcblx0dXBkYXRlKGV2ZW50KSB7XHJcblx0XHRcclxuXHRcdC8vIEpveXN0aWNrIC8gY2xhdmllclxyXG5cdFx0Y29uc3QgY29udHJvbCA9IG5ldyBUSFJFRS5WZWN0b3IyKFxyXG5cdFx0XHQtZ2FtZS5jb250cm9scy5tYWluQXhpc1gsXHJcblx0XHRcdCtnYW1lLmNvbnRyb2xzLm1haW5BeGlzWVxyXG5cdFx0KVxyXG5cdFx0XHJcblx0XHQvLyBGb3JjZSBhcHBsaXF1w6llIHN1ciBsZSBqb3lzdGlja1xyXG5cdFx0Y29uc3QgZm9yY2UgPSBjb250cm9sLmxlbmd0aCgpXHJcblx0XHRcclxuXHRcdC8vIENoYW5nZW1lbnQgZGUgdml0ZXNzZVxyXG5cdFx0dGhpcy52ZWxvY2l0eS54ICs9IChjb250cm9sLnggLSB0aGlzLnZlbG9jaXR5LngpIC8gMC4xICogZXZlbnQuZGVsdGFcclxuXHRcdHRoaXMudmVsb2NpdHkueSArPSAoY29udHJvbC55IC0gdGhpcy52ZWxvY2l0eS55KSAvIDAuMSAqIGV2ZW50LmRlbHRhXHJcblx0XHRcclxuXHRcdC8vIFZpdGVzc2UgZHUgcGVyc29ubmFnZSBlbiBmb25jdGlvbiBkZSBsYSBmb3JjZSBkJ2FwcHVpIHN1ciBsZSBqb3lzdGlja1xyXG5cdFx0aWYgKGZvcmNlID4gMCkgdGhpcy52ZWxvY2l0eS5tdWx0aXBseVNjYWxhcihmb3JjZSlcclxuXHRcdFxyXG5cdFx0Ly8gTGltaXRhdGlvbiBkZSBsYSB2aXRlc3NlXHJcblx0XHR0aGlzLnZlbG9jaXR5LmNsYW1wTGVuZ3RoKC10aGlzLm1heFZlbG9jaXR5LCArdGhpcy5tYXhWZWxvY2l0eSlcclxuXHRcdFxyXG5cdFx0Ly8gQXBwbGljYXRpb24gZGUgbGEgdml0ZXNzZSBzdXIgbGEgcG9zaXRpb25cclxuXHRcdHRoaXMucG9zaXRpb24uYWRkKHRoaXMudmVsb2NpdHkpXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0Ly8gUm90YXRpb24gZHUgcGVyc29ubmFnZVxyXG5cdFx0Y29uc3QgdGFyZ2V0Um90YXRpb24gPSBNYXRoLmF0YW4yKHRoaXMudmVsb2NpdHkueSwgdGhpcy52ZWxvY2l0eS54KVxyXG5cdFx0XHJcblx0XHQvLyBEaWZmw6lyZW5jZSBhdmVjIGwnYW5nbGUgcsOpZWxcclxuXHRcdGxldCBkaWZmID0gdGFyZ2V0Um90YXRpb24gLSB0aGlzLnJvdGF0aW9uLnpcclxuXHRcdFxyXG5cdFx0Ly8gQWxsZXIgYXUgcGx1cyBjb3VydFxyXG5cdFx0aWYgKE1hdGguYWJzKGRpZmYpID4gTWF0aC5QSSkge1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5yb3RhdGlvbi56ICs9IE1hdGguUEkgKiAyICogTWF0aC5zaWduKGRpZmYpXHJcblx0XHRcdGRpZmYgPSB0YXJnZXRSb3RhdGlvbiAtIHRoaXMucm90YXRpb24uelxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Ly8gQXBwbGlxdWVyIGxhIGRpZmbDqXJlbmNlIGRlIHJvdGF0aW9uIHN1ciBsYSByb3RhdGlvbiByw6llbGxlXHJcblx0XHR0aGlzLnJvdGF0aW9uLnogKz0gZGlmZiAvIDAuMTUgKiBldmVudC5kZWx0YVxyXG5cdFx0XHJcblx0XHQvLyBNaXNlIMOgIGpvdXIgZGUgbCdhbmltYXRpb25cclxuXHRcdHRoaXMubWl4ZXIudXBkYXRlKGV2ZW50LmRlbHRhKVxyXG5cdH1cclxuXHRcclxuXHQvKipcclxuXHQgKiBKb3VlciB1bmUgYW5pbWF0aW9uXHJcblx0ICovXHJcblx0cGxheShhbmltTmFtZSwgd2VpZ2h0ID0gMSkge1xyXG5cdFx0cmV0dXJuIHRoaXMubWl4ZXJcclxuXHRcdFx0LmNsaXBBY3Rpb24oYW5pbU5hbWUpXHJcblx0XHRcdC5zZXRFZmZlY3RpdmVXZWlnaHQod2VpZ2h0KVxyXG5cdFx0XHQucGxheSgpXHJcblx0fVxyXG5cdFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllclxyXG5cclxuIiwiY29uc3QgZ2FtZSA9IHJlcXVpcmUoJy4vZ2FtZScpXHJcbmNvbnN0IENvbnRyb2xzID0gcmVxdWlyZSgnLi9jb250cm9scycpXHJcblxyXG4vKipcclxuICogR8OocmUgbGVzIGNvbnRyw7RsZXMgKGNsYXZpZXIvc291cmlzIGV0IG1hbmV0dGUpIGR1IGpvdWV1clxyXG4gKi9cclxuY2xhc3MgU29sYXJpc0NvbnRyb2xzIGV4dGVuZHMgQ29udHJvbHMge1xyXG5cdFxyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHJcblx0XHRzdXBlcigpXHJcblx0XHRcclxuXHRcdGdhbWUuZ3VpLmFkZCh0aGlzLCAnbWFpbkF4aXNYJywgLTEsIDEpLnN0ZXAoMC4wMSkubGlzdGVuKClcclxuXHRcdGdhbWUuZ3VpLmFkZCh0aGlzLCAnbWFpbkF4aXNZJywgLTEsIDEpLnN0ZXAoMC4wMSkubGlzdGVuKClcclxuXHRcdGdhbWUuZ3VpLmFkZCh0aGlzLCAnY29udHJvbGxlcicpLmxpc3RlbigpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0Z2V0IGFjdGlvbkJ1dHRvbigpIHtcclxuXHRcdFxyXG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXhpcyhcclxuXHRcdFx0dGhpcy5HQU1FUEFELkxFRlRfWCxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHBvc2l0aXZlOiAnZCcsXHJcblx0XHRcdFx0bmVnYXRpdmU6ICdxJ1xyXG5cdFx0XHR9XHJcblx0XHQpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0Z2V0IG1haW5BeGlzWCgpIHtcclxuXHRcdFxyXG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXhpcyhcclxuXHRcdFx0dGhpcy5HQU1FUEFELkxFRlRfWCxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHBvc2l0aXZlOiAnZCcsXHJcblx0XHRcdFx0bmVnYXRpdmU6ICdxJ1xyXG5cdFx0XHR9XHJcblx0XHQpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcblx0Z2V0IG1haW5BeGlzWSgpIHtcclxuXHRcdFxyXG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXhpcyhcclxuXHRcdFx0dGhpcy5HQU1FUEFELkxFRlRfWSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHBvc2l0aXZlOiAncycsXHJcblx0XHRcdFx0bmVnYXRpdmU6ICd6J1xyXG5cdFx0XHR9XHJcblx0XHQpXHJcblx0XHRcclxuXHR9XHJcblx0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU29sYXJpc0NvbnRyb2xzIiwiY29uc3QgZ2FtZSA9IHJlcXVpcmUoJy4vZ2FtZScpXHJcbmNvbnN0IGNvbG9ycyA9IHJlcXVpcmUoJy4vY29sb3JzJylcclxuXHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24gKCkge1xyXG5cdFxyXG5cdGdhbWUubG9hZCgoKSA9PiB7XHJcblx0XHRcclxuXHRcdGdhbWUuY3JlYXRlU2NlbmUoKVxyXG5cdFx0Z2FtZS5jcmVhdGVMaWdodHMoKVxyXG5cdFx0Z2FtZS5jcmVhdGVPYmplY3RzKClcclxuXHJcblx0XHRjb25zb2xlLmxvZygnYmFuYW5hJylcclxuXHRcdFxyXG5cdFx0d2luZG93LmdhbWUgPSBnYW1lXHJcblx0XHRcclxuXHRcdGdhbWUubG9vcCgpXHJcblx0XHRcclxuXHR9KVxyXG5cdFxyXG59LCBmYWxzZSkiLCIvLyAgQ2hhbmNlLmpzIDEuMC42XG4vLyAgaHR0cDovL2NoYW5jZWpzLmNvbVxuLy8gIChjKSAyMDEzIFZpY3RvciBRdWlublxuLy8gIENoYW5jZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIG9yIG1vZGlmaWVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIENvbnN0YW50c1xuICAgIHZhciBNQVhfSU5UID0gOTAwNzE5OTI1NDc0MDk5MjtcbiAgICB2YXIgTUlOX0lOVCA9IC1NQVhfSU5UO1xuICAgIHZhciBOVU1CRVJTID0gJzAxMjM0NTY3ODknO1xuICAgIHZhciBDSEFSU19MT1dFUiA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eic7XG4gICAgdmFyIENIQVJTX1VQUEVSID0gQ0hBUlNfTE9XRVIudG9VcHBlckNhc2UoKTtcbiAgICB2YXIgSEVYX1BPT0wgID0gTlVNQkVSUyArIFwiYWJjZGVmXCI7XG5cbiAgICAvLyBDYWNoZWQgYXJyYXkgaGVscGVyc1xuICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuICAgIC8vIENvbnN0cnVjdG9yXG4gICAgZnVuY3Rpb24gQ2hhbmNlIChzZWVkKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDaGFuY2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VlZCA9PSBudWxsID8gbmV3IENoYW5jZSgpIDogbmV3IENoYW5jZShzZWVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHVzZXIgaGFzIHByb3ZpZGVkIGEgZnVuY3Rpb24sIHVzZSB0aGF0IGFzIHRoZSBnZW5lcmF0b3JcbiAgICAgICAgaWYgKHR5cGVvZiBzZWVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmRvbSA9IHNlZWQ7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBzZXQgYSBzdGFydGluZyB2YWx1ZSBvZiB6ZXJvIHNvIHdlIGNhbiBhZGQgdG8gaXRcbiAgICAgICAgICAgIHRoaXMuc2VlZCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBvdGhlcndpc2UsIGxlYXZlIHRoaXMuc2VlZCBibGFuayBzbyB0aGF0IE1UIHdpbGwgcmVjZWl2ZSBhIGJsYW5rXG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBzZWVkbGluZyA9IDA7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50c1tpXSkgPT09ICdbb2JqZWN0IFN0cmluZ10nKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBhcmd1bWVudHNbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgbnVtZXJpYyBoYXNoIGZvciBlYWNoIGFyZ3VtZW50LCBhZGQgdG8gc2VlZGxpbmdcbiAgICAgICAgICAgICAgICAgICAgdmFyIGhhc2ggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IGFyZ3VtZW50c1tpXS5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFzaCA9IGFyZ3VtZW50c1tpXS5jaGFyQ29kZUF0KGspICsgKGhhc2ggPDwgNikgKyAoaGFzaCA8PCAxNikgLSBoYXNoO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlZWRsaW5nICs9IGhhc2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWVkbGluZyA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2VlZCArPSAoYXJndW1lbnRzLmxlbmd0aCAtIGkpICogc2VlZGxpbmc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBubyBnZW5lcmF0b3IgZnVuY3Rpb24gd2FzIHByb3ZpZGVkLCB1c2Ugb3VyIE1UXG4gICAgICAgIHRoaXMubXQgPSB0aGlzLm1lcnNlbm5lX3R3aXN0ZXIodGhpcy5zZWVkKTtcbiAgICAgICAgdGhpcy5iaW1kNSA9IHRoaXMuYmx1ZWltcF9tZDUoKTtcbiAgICAgICAgdGhpcy5yYW5kb20gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tdC5yYW5kb20odGhpcy5zZWVkKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLlZFUlNJT04gPSBcIjEuMC42XCI7XG5cbiAgICAvLyBSYW5kb20gaGVscGVyIGZ1bmN0aW9uc1xuICAgIGZ1bmN0aW9uIGluaXRPcHRpb25zKG9wdGlvbnMsIGRlZmF1bHRzKSB7XG4gICAgICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICAgICAgaWYgKGRlZmF1bHRzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIGRlZmF1bHRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zW2ldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zW2ldID0gZGVmYXVsdHNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGVzdFJhbmdlKHRlc3QsIGVycm9yTWVzc2FnZSkge1xuICAgICAgICBpZiAodGVzdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuY29kZSB0aGUgaW5wdXQgc3RyaW5nIHdpdGggQmFzZTY0LlxuICAgICAqL1xuICAgIHZhciBiYXNlNjQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBCYXNlNjQgZW5jb2RlciBhdmFpbGFibGUuJyk7XG4gICAgfTtcblxuICAgIC8vIFNlbGVjdCBwcm9wZXIgQmFzZTY0IGVuY29kZXIuXG4gICAgKGZ1bmN0aW9uIGRldGVybWluZUJhc2U2NEVuY29kZXIoKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYnRvYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgYmFzZTY0ID0gYnRvYTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgQnVmZmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBiYXNlNjQgPSBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQnVmZmVyKGlucHV0KS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSkoKTtcblxuICAgIC8vIC0tIEJhc2ljcyAtLVxuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBib29sLCBlaXRoZXIgdHJ1ZSBvciBmYWxzZVxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17IGxpa2VsaWhvb2Q6IDUwIH1dIGFsdGVyIHRoZSBsaWtlbGlob29kIG9mXG4gICAgICogICAgcmVjZWl2aW5nIGEgdHJ1ZSBvciBmYWxzZSB2YWx1ZSBiYWNrLlxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBpZiB0aGUgbGlrZWxpaG9vZCBpcyBvdXQgb2YgYm91bmRzXG4gICAgICogIEByZXR1cm5zIHtCb29sfSBlaXRoZXIgdHJ1ZSBvciBmYWxzZVxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuYm9vbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIGxpa2VsaWhvb2Qgb2Ygc3VjY2VzcyAodHJ1ZSlcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtsaWtlbGlob29kIDogNTB9KTtcblxuICAgICAgICAvLyBOb3RlLCB3ZSBjb3VsZCBnZXQgc29tZSBtaW5vciBwZXJmIG9wdGltaXphdGlvbnMgYnkgY2hlY2tpbmcgcmFuZ2VcbiAgICAgICAgLy8gcHJpb3IgdG8gaW5pdGlhbGl6aW5nIGRlZmF1bHRzLCBidXQgdGhhdCBtYWtlcyBjb2RlIGEgYml0IG1lc3NpZXJcbiAgICAgICAgLy8gYW5kIHRoZSBjaGVjayBtb3JlIGNvbXBsaWNhdGVkIGFzIHdlIGhhdmUgdG8gY2hlY2sgZXhpc3RlbmNlIG9mXG4gICAgICAgIC8vIHRoZSBvYmplY3QgdGhlbiBleGlzdGVuY2Ugb2YgdGhlIGtleSBiZWZvcmUgY2hlY2tpbmcgY29uc3RyYWludHMuXG4gICAgICAgIC8vIFNpbmNlIHRoZSBvcHRpb25zIGluaXRpYWxpemF0aW9uIHNob3VsZCBiZSBtaW5vciBjb21wdXRhdGlvbmFsbHksXG4gICAgICAgIC8vIGRlY2lzaW9uIG1hZGUgZm9yIGNvZGUgY2xlYW5saW5lc3MgaW50ZW50aW9uYWxseS4gVGhpcyBpcyBtZW50aW9uZWRcbiAgICAgICAgLy8gaGVyZSBhcyBpdCdzIHRoZSBmaXJzdCBvY2N1cnJlbmNlLCB3aWxsIG5vdCBiZSBtZW50aW9uZWQgYWdhaW4uXG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMubGlrZWxpaG9vZCA8IDAgfHwgb3B0aW9ucy5saWtlbGlob29kID4gMTAwLFxuICAgICAgICAgICAgXCJDaGFuY2U6IExpa2VsaWhvb2QgYWNjZXB0cyB2YWx1ZXMgZnJvbSAwIHRvIDEwMC5cIlxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnJhbmRvbSgpICogMTAwIDwgb3B0aW9ucy5saWtlbGlob29kO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGNoYXJhY3Rlci5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgY2hhcmFjdGVyIHBvb2wsIG9ubHkgYWxwaGEsXG4gICAgICogICAgb25seSBzeW1ib2xzLCBhbmQgY2FzaW5nIChsb3dlciBvciB1cHBlcilcbiAgICAgKiAgQHJldHVybnMge1N0cmluZ30gYSBzaW5nbGUgcmFuZG9tIGNoYXJhY3RlclxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBDYW4gb25seSBzcGVjaWZ5IGFscGhhIG9yIHN5bWJvbHMsIG5vdCBib3RoXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jaGFyYWN0ZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMuYWxwaGEgJiYgb3B0aW9ucy5zeW1ib2xzLFxuICAgICAgICAgICAgXCJDaGFuY2U6IENhbm5vdCBzcGVjaWZ5IGJvdGggYWxwaGEgYW5kIHN5bWJvbHMuXCJcbiAgICAgICAgKTtcblxuICAgICAgICB2YXIgc3ltYm9scyA9IFwiIUAjJCVeJiooKVtdXCIsXG4gICAgICAgICAgICBsZXR0ZXJzLCBwb29sO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmNhc2luZyA9PT0gJ2xvd2VyJykge1xuICAgICAgICAgICAgbGV0dGVycyA9IENIQVJTX0xPV0VSO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuY2FzaW5nID09PSAndXBwZXInKSB7XG4gICAgICAgICAgICBsZXR0ZXJzID0gQ0hBUlNfVVBQRVI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXR0ZXJzID0gQ0hBUlNfTE9XRVIgKyBDSEFSU19VUFBFUjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnBvb2wpIHtcbiAgICAgICAgICAgIHBvb2wgPSBvcHRpb25zLnBvb2w7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5hbHBoYSkge1xuICAgICAgICAgICAgcG9vbCA9IGxldHRlcnM7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zeW1ib2xzKSB7XG4gICAgICAgICAgICBwb29sID0gc3ltYm9scztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvb2wgPSBsZXR0ZXJzICsgTlVNQkVSUyArIHN5bWJvbHM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcG9vbC5jaGFyQXQodGhpcy5uYXR1cmFsKHttYXg6IChwb29sLmxlbmd0aCAtIDEpfSkpO1xuICAgIH07XG5cbiAgICAvLyBOb3RlLCB3YW50ZWQgdG8gdXNlIFwiZmxvYXRcIiBvciBcImRvdWJsZVwiIGJ1dCB0aG9zZSBhcmUgYm90aCBKUyByZXNlcnZlZCB3b3Jkcy5cblxuICAgIC8vIE5vdGUsIGZpeGVkIG1lYW5zIE4gT1IgTEVTUyBkaWdpdHMgYWZ0ZXIgdGhlIGRlY2ltYWwuIFRoaXMgYmVjYXVzZVxuICAgIC8vIEl0IGNvdWxkIGJlIDE0LjkwMDAgYnV0IGluIEphdmFTY3JpcHQsIHdoZW4gdGhpcyBpcyBjYXN0IGFzIGEgbnVtYmVyLFxuICAgIC8vIHRoZSB0cmFpbGluZyB6ZXJvZXMgYXJlIGRyb3BwZWQuIExlZnQgdG8gdGhlIGNvbnN1bWVyIGlmIHRyYWlsaW5nIHplcm9lcyBhcmVcbiAgICAvLyBuZWVkZWRcbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGZsb2F0aW5nIHBvaW50IG51bWJlclxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBmaXhlZCBwcmVjaXNpb24sIG1pbiwgbWF4XG4gICAgICogIEByZXR1cm5zIHtOdW1iZXJ9IGEgc2luZ2xlIGZsb2F0aW5nIHBvaW50IG51bWJlclxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBDYW4gb25seSBzcGVjaWZ5IGZpeGVkIG9yIHByZWNpc2lvbiwgbm90IGJvdGguIEFsc29cbiAgICAgKiAgICBtaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBtYXhcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmZsb2F0aW5nID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZCA6IDR9KTtcbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5maXhlZCAmJiBvcHRpb25zLnByZWNpc2lvbixcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBDYW5ub3Qgc3BlY2lmeSBib3RoIGZpeGVkIGFuZCBwcmVjaXNpb24uXCJcbiAgICAgICAgKTtcblxuICAgICAgICB2YXIgbnVtO1xuICAgICAgICB2YXIgZml4ZWQgPSBNYXRoLnBvdygxMCwgb3B0aW9ucy5maXhlZCk7XG5cbiAgICAgICAgdmFyIG1heCA9IE1BWF9JTlQgLyBmaXhlZDtcbiAgICAgICAgdmFyIG1pbiA9IC1tYXg7XG5cbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5taW4gJiYgb3B0aW9ucy5maXhlZCAmJiBvcHRpb25zLm1pbiA8IG1pbixcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBNaW4gc3BlY2lmaWVkIGlzIG91dCBvZiByYW5nZSB3aXRoIGZpeGVkLiBNaW4gc2hvdWxkIGJlLCBhdCBsZWFzdCwgXCIgKyBtaW5cbiAgICAgICAgKTtcbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5tYXggJiYgb3B0aW9ucy5maXhlZCAmJiBvcHRpb25zLm1heCA+IG1heCxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBNYXggc3BlY2lmaWVkIGlzIG91dCBvZiByYW5nZSB3aXRoIGZpeGVkLiBNYXggc2hvdWxkIGJlLCBhdCBtb3N0LCBcIiArIG1heFxuICAgICAgICApO1xuXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IG1pbiA6IG1pbiwgbWF4IDogbWF4IH0pO1xuXG4gICAgICAgIC8vIFRvZG8gLSBNYWtlIHRoaXMgd29yayFcbiAgICAgICAgLy8gb3B0aW9ucy5wcmVjaXNpb24gPSAodHlwZW9mIG9wdGlvbnMucHJlY2lzaW9uICE9PSBcInVuZGVmaW5lZFwiKSA/IG9wdGlvbnMucHJlY2lzaW9uIDogZmFsc2U7XG5cbiAgICAgICAgbnVtID0gdGhpcy5pbnRlZ2VyKHttaW46IG9wdGlvbnMubWluICogZml4ZWQsIG1heDogb3B0aW9ucy5tYXggKiBmaXhlZH0pO1xuICAgICAgICB2YXIgbnVtX2ZpeGVkID0gKG51bSAvIGZpeGVkKS50b0ZpeGVkKG9wdGlvbnMuZml4ZWQpO1xuXG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KG51bV9maXhlZCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gaW50ZWdlclxuICAgICAqXG4gICAgICogIE5PVEUgdGhlIG1heCBhbmQgbWluIGFyZSBJTkNMVURFRCBpbiB0aGUgcmFuZ2UuIFNvOlxuICAgICAqICBjaGFuY2UuaW50ZWdlcih7bWluOiAxLCBtYXg6IDN9KTtcbiAgICAgKiAgd291bGQgcmV0dXJuIGVpdGhlciAxLCAyLCBvciAzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBtaW4gYW5kL29yIG1heFxuICAgICAqICBAcmV0dXJucyB7TnVtYmVyfSBhIHNpbmdsZSByYW5kb20gaW50ZWdlciBudW1iZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gbWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gbWF4XG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pbnRlZ2VyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gOTAwNzE5OTI1NDc0MDk5MiAoMl41MykgaXMgdGhlIG1heCBpbnRlZ2VyIG51bWJlciBpbiBKYXZhU2NyaXB0XG4gICAgICAgIC8vIFNlZTogaHR0cDovL3ZxLmlvLzEzMnNhMmpcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IE1JTl9JTlQsIG1heDogTUFYX0lOVH0pO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IodGhpcy5yYW5kb20oKSAqIChvcHRpb25zLm1heCAtIG9wdGlvbnMubWluICsgMSkgKyBvcHRpb25zLm1pbik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gbmF0dXJhbFxuICAgICAqXG4gICAgICogIE5PVEUgdGhlIG1heCBhbmQgbWluIGFyZSBJTkNMVURFRCBpbiB0aGUgcmFuZ2UuIFNvOlxuICAgICAqICBjaGFuY2UubmF0dXJhbCh7bWluOiAxLCBtYXg6IDN9KTtcbiAgICAgKiAgd291bGQgcmV0dXJuIGVpdGhlciAxLCAyLCBvciAzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBtaW4gYW5kL29yIG1heFxuICAgICAqICBAcmV0dXJucyB7TnVtYmVyfSBhIHNpbmdsZSByYW5kb20gaW50ZWdlciBudW1iZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gbWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gbWF4XG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYXR1cmFsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDAsIG1heDogTUFYX0lOVH0pO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAwLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gemVyby5cIik7XG4gICAgICAgIHJldHVybiB0aGlzLmludGVnZXIob3B0aW9ucyk7XG4gICAgfTtcblx0XG5cdC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gaGV4IG51bWJlciBhcyBzdHJpbmdcbiAgICAgKlxuICAgICAqICBOT1RFIHRoZSBtYXggYW5kIG1pbiBhcmUgSU5DTFVERUQgaW4gdGhlIHJhbmdlLiBTbzpcbiAgICAgKiAgY2hhbmNlLmhleCh7bWluOiAnOScsIG1heDogJ0InfSk7XG4gICAgICogIHdvdWxkIHJldHVybiBlaXRoZXIgJzknLCAnQScgb3IgJ0InLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBtaW4gYW5kL29yIG1heCBhbmQvb3IgY2FzaW5nXG4gICAgICogIEByZXR1cm5zIHtTdHJpbmd9IGEgc2luZ2xlIHJhbmRvbSBzdHJpbmcgaGV4IG51bWJlclxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBtaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBtYXhcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmhleCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiAwLCBtYXg6IE1BWF9JTlQsIGNhc2luZzogJ2xvd2VyJ30pO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAwLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gemVyby5cIik7XG5cdFx0dmFyIGludGVnZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXh9KTtcblx0XHRpZiAob3B0aW9ucy5jYXNpbmcgPT09ICd1cHBlcicpIHtcblx0XHRcdHJldHVybiBpbnRlZ2VyLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW50ZWdlci50b1N0cmluZygxNik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gc3RyaW5nXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIGxlbmd0aFxuICAgICAqICBAcmV0dXJucyB7U3RyaW5nfSBhIHN0cmluZyBvZiByYW5kb20gbGVuZ3RoXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IGxlbmd0aCBjYW5ub3QgYmUgbGVzcyB0aGFuIHplcm9cbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmluZyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGxlbmd0aDogdGhpcy5uYXR1cmFsKHttaW46IDUsIG1heDogMjB9KSB9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubGVuZ3RoIDwgMCwgXCJDaGFuY2U6IExlbmd0aCBjYW5ub3QgYmUgbGVzcyB0aGFuIHplcm8uXCIpO1xuICAgICAgICB2YXIgbGVuZ3RoID0gb3B0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgICB0ZXh0ID0gdGhpcy5uKHRoaXMuY2hhcmFjdGVyLCBsZW5ndGgsIG9wdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiB0ZXh0LmpvaW4oXCJcIik7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBCYXNpY3MgLS1cblxuICAgIC8vIC0tIEhlbHBlcnMgLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2FwaXRhbGl6ZSA9IGZ1bmN0aW9uICh3b3JkKSB7XG4gICAgICAgIHJldHVybiB3b3JkLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgd29yZC5zdWJzdHIoMSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubWl4aW4gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIGZvciAodmFyIGZ1bmNfbmFtZSBpbiBvYmopIHtcbiAgICAgICAgICAgIENoYW5jZS5wcm90b3R5cGVbZnVuY19uYW1lXSA9IG9ialtmdW5jX25hbWVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgR2l2ZW4gYSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBzb21ldGhpbmcgcmFuZG9tIGFuZCBhIG51bWJlciBvZiBpdGVtcyB0byBnZW5lcmF0ZSxcbiAgICAgKiAgICByZXR1cm4gYW4gYXJyYXkgb2YgaXRlbXMgd2hlcmUgbm9uZSByZXBlYXQuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtGdW5jdGlvbn0gZm4gdGhlIGZ1bmN0aW9uIHRoYXQgZ2VuZXJhdGVzIHNvbWV0aGluZyByYW5kb21cbiAgICAgKiAgQHBhcmFtIHtOdW1iZXJ9IG51bSBudW1iZXIgb2YgdGVybXMgdG8gZ2VuZXJhdGVcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgYW55IG9wdGlvbnMgdG8gcGFzcyBvbiB0byB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uXG4gICAgICogIEByZXR1cm5zIHtBcnJheX0gYW4gYXJyYXkgb2YgbGVuZ3RoIGBudW1gIHdpdGggZXZlcnkgaXRlbSBnZW5lcmF0ZWQgYnkgYGZuYCBhbmQgdW5pcXVlXG4gICAgICpcbiAgICAgKiAgVGhlcmUgY2FuIGJlIG1vcmUgcGFyYW1ldGVycyBhZnRlciB0aGVzZS4gQWxsIGFkZGl0aW9uYWwgcGFyYW1ldGVycyBhcmUgcHJvdmlkZWQgdG8gdGhlIGdpdmVuIGZ1bmN0aW9uXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS51bmlxdWUgPSBmdW5jdGlvbihmbiwgbnVtLCBvcHRpb25zKSB7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiLFxuICAgICAgICAgICAgXCJDaGFuY2U6IFRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24uXCJcbiAgICAgICAgKTtcblxuICAgICAgICB2YXIgY29tcGFyYXRvciA9IGZ1bmN0aW9uKGFyciwgdmFsKSB7IHJldHVybiBhcnIuaW5kZXhPZih2YWwpICE9PSAtMTsgfTtcblxuICAgICAgICBpZiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29tcGFyYXRvciA9IG9wdGlvbnMuY29tcGFyYXRvciB8fCBjb21wYXJhdG9yO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyciA9IFtdLCBjb3VudCA9IDAsIHJlc3VsdCwgTUFYX0RVUExJQ0FURVMgPSBudW0gKiA1MCwgcGFyYW1zID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXG4gICAgICAgIHdoaWxlIChhcnIubGVuZ3RoIDwgbnVtKSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVkUGFyYW1zID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShwYXJhbXMpKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZuLmFwcGx5KHRoaXMsIGNsb25lZFBhcmFtcyk7XG4gICAgICAgICAgICBpZiAoIWNvbXBhcmF0b3IoYXJyLCByZXN1bHQpKSB7XG4gICAgICAgICAgICAgICAgYXJyLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAvLyByZXNldCBjb3VudCB3aGVuIHVuaXF1ZSBmb3VuZFxuICAgICAgICAgICAgICAgIGNvdW50ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCsrY291bnQgPiBNQVhfRFVQTElDQVRFUykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBudW0gaXMgbGlrZWx5IHRvbyBsYXJnZSBmb3Igc2FtcGxlIHNldFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgR2l2ZXMgYW4gYXJyYXkgb2YgbiByYW5kb20gdGVybXNcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge0Z1bmN0aW9ufSBmbiB0aGUgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgc29tZXRoaW5nIHJhbmRvbVxuICAgICAqICBAcGFyYW0ge051bWJlcn0gbiBudW1iZXIgb2YgdGVybXMgdG8gZ2VuZXJhdGVcbiAgICAgKiAgQHJldHVybnMge0FycmF5fSBhbiBhcnJheSBvZiBsZW5ndGggYG5gIHdpdGggaXRlbXMgZ2VuZXJhdGVkIGJ5IGBmbmBcbiAgICAgKlxuICAgICAqICBUaGVyZSBjYW4gYmUgbW9yZSBwYXJhbWV0ZXJzIGFmdGVyIHRoZXNlLiBBbGwgYWRkaXRpb25hbCBwYXJhbWV0ZXJzIGFyZSBwcm92aWRlZCB0byB0aGUgZ2l2ZW4gZnVuY3Rpb25cbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLm4gPSBmdW5jdGlvbihmbiwgbikge1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICB0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIixcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIGZ1bmN0aW9uLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBuID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGkgPSBuLCBhcnIgPSBbXSwgcGFyYW1zID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXG4gICAgICAgIC8vIFByb3ZpZGluZyBhIG5lZ2F0aXZlIGNvdW50IHNob3VsZCByZXN1bHQgaW4gYSBub29wLlxuICAgICAgICBpID0gTWF0aC5tYXgoIDAsIGkgKTtcblxuICAgICAgICBmb3IgKG51bGw7IGktLTsgbnVsbCkge1xuICAgICAgICAgICAgYXJyLnB1c2goZm4uYXBwbHkodGhpcywgcGFyYW1zKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH07XG5cbiAgICAvLyBIL1QgdG8gU08gZm9yIHRoaXMgb25lOiBodHRwOi8vdnEuaW8vT3RVclo1XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wYWQgPSBmdW5jdGlvbiAobnVtYmVyLCB3aWR0aCwgcGFkKSB7XG4gICAgICAgIC8vIERlZmF1bHQgcGFkIHRvIDAgaWYgbm9uZSBwcm92aWRlZFxuICAgICAgICBwYWQgPSBwYWQgfHwgJzAnO1xuICAgICAgICAvLyBDb252ZXJ0IG51bWJlciB0byBhIHN0cmluZ1xuICAgICAgICBudW1iZXIgPSBudW1iZXIgKyAnJztcbiAgICAgICAgcmV0dXJuIG51bWJlci5sZW5ndGggPj0gd2lkdGggPyBudW1iZXIgOiBuZXcgQXJyYXkod2lkdGggLSBudW1iZXIubGVuZ3RoICsgMSkuam9pbihwYWQpICsgbnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyBERVBSRUNBVEVEIG9uIDIwMTUtMTAtMDFcbiAgICBDaGFuY2UucHJvdG90eXBlLnBpY2sgPSBmdW5jdGlvbiAoYXJyLCBjb3VudCkge1xuICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IENhbm5vdCBwaWNrKCkgZnJvbSBhbiBlbXB0eSBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvdW50IHx8IGNvdW50ID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gYXJyW3RoaXMubmF0dXJhbCh7bWF4OiBhcnIubGVuZ3RoIC0gMX0pXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNodWZmbGUoYXJyKS5zbGljZSgwLCBjb3VudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gR2l2ZW4gYW4gYXJyYXksIHJldHVybnMgYSBzaW5nbGUgcmFuZG9tIGVsZW1lbnRcbiAgICBDaGFuY2UucHJvdG90eXBlLnBpY2tvbmUgPSBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIGlmIChhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IENhbm5vdCBwaWNrb25lKCkgZnJvbSBhbiBlbXB0eSBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXJyW3RoaXMubmF0dXJhbCh7bWF4OiBhcnIubGVuZ3RoIC0gMX0pXTtcbiAgICB9O1xuXG4gICAgLy8gR2l2ZW4gYW4gYXJyYXksIHJldHVybnMgYSByYW5kb20gc2V0IHdpdGggJ2NvdW50JyBlbGVtZW50c1xuICAgIENoYW5jZS5wcm90b3R5cGUucGlja3NldCA9IGZ1bmN0aW9uIChhcnIsIGNvdW50KSB7XG4gICAgICAgIGlmIChjb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogQ2Fubm90IHBpY2tzZXQoKSBmcm9tIGFuIGVtcHR5IGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb3VudCA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBjb3VudCBtdXN0IGJlIHBvc2l0aXZlIG51bWJlclwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvdW50IHx8IGNvdW50ID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gWyB0aGlzLnBpY2tvbmUoYXJyKSBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2h1ZmZsZShhcnIpLnNsaWNlKDAsIGNvdW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnNodWZmbGUgPSBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIHZhciBvbGRfYXJyYXkgPSBhcnIuc2xpY2UoMCksXG4gICAgICAgICAgICBuZXdfYXJyYXkgPSBbXSxcbiAgICAgICAgICAgIGogPSAwLFxuICAgICAgICAgICAgbGVuZ3RoID0gTnVtYmVyKG9sZF9hcnJheS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vIFBpY2sgYSByYW5kb20gaW5kZXggZnJvbSB0aGUgYXJyYXlcbiAgICAgICAgICAgIGogPSB0aGlzLm5hdHVyYWwoe21heDogb2xkX2FycmF5Lmxlbmd0aCAtIDF9KTtcbiAgICAgICAgICAgIC8vIEFkZCBpdCB0byB0aGUgbmV3IGFycmF5XG4gICAgICAgICAgICBuZXdfYXJyYXlbaV0gPSBvbGRfYXJyYXlbal07XG4gICAgICAgICAgICAvLyBSZW1vdmUgdGhhdCBlbGVtZW50IGZyb20gdGhlIG9yaWdpbmFsIGFycmF5XG4gICAgICAgICAgICBvbGRfYXJyYXkuc3BsaWNlKGosIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ld19hcnJheTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJucyBhIHNpbmdsZSBpdGVtIGZyb20gYW4gYXJyYXkgd2l0aCByZWxhdGl2ZSB3ZWlnaHRpbmcgb2Ygb2Rkc1xuICAgIENoYW5jZS5wcm90b3R5cGUud2VpZ2h0ZWQgPSBmdW5jdGlvbiAoYXJyLCB3ZWlnaHRzLCB0cmltKSB7XG4gICAgICAgIGlmIChhcnIubGVuZ3RoICE9PSB3ZWlnaHRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IGxlbmd0aCBvZiBhcnJheSBhbmQgd2VpZ2h0cyBtdXN0IG1hdGNoXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2NhbiB3ZWlnaHRzIGFycmF5IGFuZCBzdW0gdmFsaWQgZW50cmllc1xuICAgICAgICB2YXIgc3VtID0gMDtcbiAgICAgICAgdmFyIHZhbDtcbiAgICAgICAgZm9yICh2YXIgd2VpZ2h0SW5kZXggPSAwOyB3ZWlnaHRJbmRleCA8IHdlaWdodHMubGVuZ3RoOyArK3dlaWdodEluZGV4KSB7XG4gICAgICAgICAgICB2YWwgPSB3ZWlnaHRzW3dlaWdodEluZGV4XTtcbiAgICAgICAgICAgIGlmIChpc05hTih2YWwpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJhbGwgd2VpZ2h0cyBtdXN0IGJlIG51bWJlcnNcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgc3VtICs9IHZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdW0gPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ2hhbmNlOiBubyB2YWxpZCBlbnRyaWVzIGluIGFycmF5IHdlaWdodHNcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWxlY3QgYSB2YWx1ZSB3aXRoaW4gcmFuZ2VcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gdGhpcy5yYW5kb20oKSAqIHN1bTtcblxuICAgICAgICAvLyBmaW5kIGFycmF5IGVudHJ5IGNvcnJlc3BvbmRpbmcgdG8gc2VsZWN0ZWQgdmFsdWVcbiAgICAgICAgdmFyIHRvdGFsID0gMDtcbiAgICAgICAgdmFyIGxhc3RHb29kSWR4ID0gLTE7XG4gICAgICAgIHZhciBjaG9zZW5JZHg7XG4gICAgICAgIGZvciAod2VpZ2h0SW5kZXggPSAwOyB3ZWlnaHRJbmRleCA8IHdlaWdodHMubGVuZ3RoOyArK3dlaWdodEluZGV4KSB7XG4gICAgICAgICAgICB2YWwgPSB3ZWlnaHRzW3dlaWdodEluZGV4XTtcbiAgICAgICAgICAgIHRvdGFsICs9IHZhbDtcbiAgICAgICAgICAgIGlmICh2YWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdGVkIDw9IHRvdGFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNob3NlbklkeCA9IHdlaWdodEluZGV4O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFzdEdvb2RJZHggPSB3ZWlnaHRJbmRleDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIGFueSBwb3NzaWJsZSByb3VuZGluZyBlcnJvciBjb21wYXJpc29uIHRvIGVuc3VyZSBzb21ldGhpbmcgaXMgcGlja2VkXG4gICAgICAgICAgICBpZiAod2VpZ2h0SW5kZXggPT09ICh3ZWlnaHRzLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgY2hvc2VuSWR4ID0gbGFzdEdvb2RJZHg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hvc2VuID0gYXJyW2Nob3NlbklkeF07XG4gICAgICAgIHRyaW0gPSAodHlwZW9mIHRyaW0gPT09ICd1bmRlZmluZWQnKSA/IGZhbHNlIDogdHJpbTtcbiAgICAgICAgaWYgKHRyaW0pIHtcbiAgICAgICAgICAgIGFyci5zcGxpY2UoY2hvc2VuSWR4LCAxKTtcbiAgICAgICAgICAgIHdlaWdodHMuc3BsaWNlKGNob3NlbklkeCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hvc2VuO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgSGVscGVycyAtLVxuXG4gICAgLy8gLS0gVGV4dCAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wYXJhZ3JhcGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIHNlbnRlbmNlcyA9IG9wdGlvbnMuc2VudGVuY2VzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAzLCBtYXg6IDd9KSxcbiAgICAgICAgICAgIHNlbnRlbmNlX2FycmF5ID0gdGhpcy5uKHRoaXMuc2VudGVuY2UsIHNlbnRlbmNlcyk7XG5cbiAgICAgICAgcmV0dXJuIHNlbnRlbmNlX2FycmF5LmpvaW4oJyAnKTtcbiAgICB9O1xuXG4gICAgLy8gQ291bGQgZ2V0IHNtYXJ0ZXIgYWJvdXQgdGhpcyB0aGFuIGdlbmVyYXRpbmcgcmFuZG9tIHdvcmRzIGFuZFxuICAgIC8vIGNoYWluaW5nIHRoZW0gdG9nZXRoZXIuIFN1Y2ggYXM6IGh0dHA6Ly92cS5pby8xYTVjZU9oXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zZW50ZW5jZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgd29yZHMgPSBvcHRpb25zLndvcmRzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAxMiwgbWF4OiAxOH0pLFxuICAgICAgICAgICAgcHVuY3R1YXRpb24gPSBvcHRpb25zLnB1bmN0dWF0aW9uLFxuICAgICAgICAgICAgdGV4dCwgd29yZF9hcnJheSA9IHRoaXMubih0aGlzLndvcmQsIHdvcmRzKTtcblxuICAgICAgICB0ZXh0ID0gd29yZF9hcnJheS5qb2luKCcgJyk7XG5cbiAgICAgICAgLy8gQ2FwaXRhbGl6ZSBmaXJzdCBsZXR0ZXIgb2Ygc2VudGVuY2VcbiAgICAgICAgdGV4dCA9IHRoaXMuY2FwaXRhbGl6ZSh0ZXh0KTtcblxuICAgICAgICAvLyBNYWtlIHN1cmUgcHVuY3R1YXRpb24gaGFzIGEgdXNhYmxlIHZhbHVlXG4gICAgICAgIGlmIChwdW5jdHVhdGlvbiAhPT0gZmFsc2UgJiYgIS9eW1xcLlxcPzshOl0kLy50ZXN0KHB1bmN0dWF0aW9uKSkge1xuICAgICAgICAgICAgcHVuY3R1YXRpb24gPSAnLic7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgcHVuY3R1YXRpb24gbWFya1xuICAgICAgICBpZiAocHVuY3R1YXRpb24pIHtcbiAgICAgICAgICAgIHRleHQgKz0gcHVuY3R1YXRpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zeWxsYWJsZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgbGVuZ3RoID0gb3B0aW9ucy5sZW5ndGggfHwgdGhpcy5uYXR1cmFsKHttaW46IDIsIG1heDogM30pLFxuICAgICAgICAgICAgY29uc29uYW50cyA9ICdiY2RmZ2hqa2xtbnByc3R2d3onLCAvLyBjb25zb25hbnRzIGV4Y2VwdCBoYXJkIHRvIHNwZWFrIG9uZXNcbiAgICAgICAgICAgIHZvd2VscyA9ICdhZWlvdScsIC8vIHZvd2Vsc1xuICAgICAgICAgICAgYWxsID0gY29uc29uYW50cyArIHZvd2VscywgLy8gYWxsXG4gICAgICAgICAgICB0ZXh0ID0gJycsXG4gICAgICAgICAgICBjaHI7XG5cbiAgICAgICAgLy8gSSdtIHN1cmUgdGhlcmUncyBhIG1vcmUgZWxlZ2FudCB3YXkgdG8gZG8gdGhpcywgYnV0IHRoaXMgd29ya3NcbiAgICAgICAgLy8gZGVjZW50bHkgd2VsbC5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGaXJzdCBjaGFyYWN0ZXIgY2FuIGJlIGFueXRoaW5nXG4gICAgICAgICAgICAgICAgY2hyID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IGFsbH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb25zb25hbnRzLmluZGV4T2YoY2hyKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGNoYXJhY3RlciB3YXMgYSB2b3dlbCwgbm93IHdlIHdhbnQgYSBjb25zb25hbnRcbiAgICAgICAgICAgICAgICBjaHIgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogY29uc29uYW50c30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGNoYXJhY3RlciB3YXMgYSBjb25zb25hbnQsIG5vdyB3ZSB3YW50IGEgdm93ZWxcbiAgICAgICAgICAgICAgICBjaHIgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogdm93ZWxzfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRleHQgKz0gY2hyO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2FwaXRhbGl6ZSkge1xuICAgICAgICAgICAgdGV4dCA9IHRoaXMuY2FwaXRhbGl6ZSh0ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLndvcmQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdGVzdFJhbmdlKFxuICAgICAgICAgICAgb3B0aW9ucy5zeWxsYWJsZXMgJiYgb3B0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgICBcIkNoYW5jZTogQ2Fubm90IHNwZWNpZnkgYm90aCBzeWxsYWJsZXMgQU5EIGxlbmd0aC5cIlxuICAgICAgICApO1xuXG4gICAgICAgIHZhciBzeWxsYWJsZXMgPSBvcHRpb25zLnN5bGxhYmxlcyB8fCB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiAzfSksXG4gICAgICAgICAgICB0ZXh0ID0gJyc7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBFaXRoZXIgYm91bmQgd29yZCBieSBsZW5ndGhcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICB0ZXh0ICs9IHRoaXMuc3lsbGFibGUoKTtcbiAgICAgICAgICAgIH0gd2hpbGUgKHRleHQubGVuZ3RoIDwgb3B0aW9ucy5sZW5ndGgpO1xuICAgICAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDAsIG9wdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIE9yIGJ5IG51bWJlciBvZiBzeWxsYWJsZXNcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3lsbGFibGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0ZXh0ICs9IHRoaXMuc3lsbGFibGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNhcGl0YWxpemUpIHtcbiAgICAgICAgICAgIHRleHQgPSB0aGlzLmNhcGl0YWxpemUodGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFRleHQgLS1cblxuICAgIC8vIC0tIFBlcnNvbiAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hZ2UgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciBhZ2VSYW5nZTtcblxuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnY2hpbGQnOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMCwgbWF4OiAxMn07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd0ZWVuJzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDEzLCBtYXg6IDE5fTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2FkdWx0JzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDE4LCBtYXg6IDY1fTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3Nlbmlvcic6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiA2NSwgbWF4OiAxMDB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDAsIG1heDogMTAwfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAxOCwgbWF4OiA2NX07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKGFnZVJhbmdlKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5iaXJ0aGRheSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBhZ2UgPSB0aGlzLmFnZShvcHRpb25zKTtcbiAgICAgICAgdmFyIGN1cnJlbnRZZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1xuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudHlwZSkge1xuICAgICAgICAgICAgdmFyIG1pbiA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICB2YXIgbWF4ID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIG1pbi5zZXRGdWxsWWVhcihjdXJyZW50WWVhciAtIGFnZSAtIDEpO1xuICAgICAgICAgICAgbWF4LnNldEZ1bGxZZWFyKGN1cnJlbnRZZWFyIC0gYWdlKTtcblxuICAgICAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICBtaW46IG1pbixcbiAgICAgICAgICAgICAgICBtYXg6IG1heFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHllYXI6IGN1cnJlbnRZZWFyIC0gYWdlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGUob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIC8vIENQRjsgSUQgdG8gaWRlbnRpZnkgdGF4cGF5ZXJzIGluIEJyYXppbFxuICAgIENoYW5jZS5wcm90b3R5cGUuY3BmID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGZvcm1hdHRlZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgbiA9IHRoaXMubih0aGlzLm5hdHVyYWwsIDksIHsgbWF4OiA5IH0pO1xuICAgICAgICB2YXIgZDEgPSBuWzhdKjIrbls3XSozK25bNl0qNCtuWzVdKjUrbls0XSo2K25bM10qNytuWzJdKjgrblsxXSo5K25bMF0qMTA7XG4gICAgICAgIGQxID0gMTEgLSAoZDEgJSAxMSk7XG4gICAgICAgIGlmIChkMT49MTApIHtcbiAgICAgICAgICAgIGQxID0gMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZDIgPSBkMSoyK25bOF0qMytuWzddKjQrbls2XSo1K25bNV0qNituWzRdKjcrblszXSo4K25bMl0qOStuWzFdKjEwK25bMF0qMTE7XG4gICAgICAgIGQyID0gMTEgLSAoZDIgJSAxMSk7XG4gICAgICAgIGlmIChkMj49MTApIHtcbiAgICAgICAgICAgIGQyID0gMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY3BmID0gJycrblswXStuWzFdK25bMl0rJy4nK25bM10rbls0XStuWzVdKycuJytuWzZdK25bN10rbls4XSsnLScrZDErZDI7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZvcm1hdHRlZCA/IGNwZiA6IGNwZi5yZXBsYWNlKC9cXEQvZywnJyk7XG4gICAgfTtcblxuICAgIC8vIENOUEo6IElEIHRvIGlkZW50aWZ5IGNvbXBhbmllcyBpbiBCcmF6aWxcbiAgICBDaGFuY2UucHJvdG90eXBlLmNucGogPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZm9ybWF0dGVkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBuID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgMTIsIHsgbWF4OiAxMiB9KTtcbiAgICAgICAgdmFyIGQxID0gblsxMV0qMituWzEwXSozK25bOV0qNCtuWzhdKjUrbls3XSo2K25bNl0qNytuWzVdKjgrbls0XSo5K25bM10qMituWzJdKjMrblsxXSo0K25bMF0qNTtcbiAgICAgICAgZDEgPSAxMSAtIChkMSAlIDExKTtcbiAgICAgICAgaWYgKGQxPDIpIHtcbiAgICAgICAgICAgIGQxID0gMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZDIgPSBkMSoyK25bMTFdKjMrblsxMF0qNCtuWzldKjUrbls4XSo2K25bN10qNytuWzZdKjgrbls1XSo5K25bNF0qMituWzNdKjMrblsyXSo0K25bMV0qNStuWzBdKjY7XG4gICAgICAgIGQyID0gMTEgLSAoZDIgJSAxMSk7XG4gICAgICAgIGlmIChkMjwyKSB7XG4gICAgICAgICAgICBkMiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNucGogPSAnJytuWzBdK25bMV0rJy4nK25bMl0rblszXStuWzRdKycuJytuWzVdK25bNl0rbls3XSsnLycrbls4XStuWzldK25bMTBdK25bMTFdKyctJytkMStkMjtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZm9ybWF0dGVkID8gY25waiA6IGNucGoucmVwbGFjZSgvXFxEL2csJycpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmZpcnN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtnZW5kZXI6IHRoaXMuZ2VuZGVyKCksIG5hdGlvbmFsaXR5OiAnZW4nfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5nZXQoXCJmaXJzdE5hbWVzXCIpW29wdGlvbnMuZ2VuZGVyLnRvTG93ZXJDYXNlKCldW29wdGlvbnMubmF0aW9uYWxpdHkudG9Mb3dlckNhc2UoKV0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnByb2Zlc3Npb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5nZXQoXCJwcm9mZXNzaW9uc1wiKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZ2VuZGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtleHRyYUdlbmRlcnM6IFtdfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2soWydNYWxlJywgJ0ZlbWFsZSddLmNvbmNhdChvcHRpb25zLmV4dHJhR2VuZGVycykpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmxhc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge25hdGlvbmFsaXR5OiAnZW4nfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5nZXQoXCJsYXN0TmFtZXNcIilbb3B0aW9ucy5uYXRpb25hbGl0eS50b0xvd2VyQ2FzZSgpXSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaXNyYWVsSWQ9ZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIHg9dGhpcy5zdHJpbmcoe3Bvb2w6ICcwMTIzNDU2Nzg5JyxsZW5ndGg6OH0pO1xuICAgICAgICB2YXIgeT0wO1xuICAgICAgICBmb3IgKHZhciBpPTA7aTx4Lmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgdmFyIHRoaXNEaWdpdD0gIHhbaV0gKiAgKGkvMj09PXBhcnNlSW50KGkvMikgPyAxIDogMik7XG4gICAgICAgICAgICB0aGlzRGlnaXQ9dGhpcy5wYWQodGhpc0RpZ2l0LDIpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB0aGlzRGlnaXQ9cGFyc2VJbnQodGhpc0RpZ2l0WzBdKSArIHBhcnNlSW50KHRoaXNEaWdpdFsxXSk7XG4gICAgICAgICAgICB5PXkrdGhpc0RpZ2l0O1xuICAgICAgICB9XG4gICAgICAgIHg9eCsoMTAtcGFyc2VJbnQoeS50b1N0cmluZygpLnNsaWNlKC0xKSkpLnRvU3RyaW5nKCkuc2xpY2UoLTEpO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tcnogPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgY2hlY2tEaWdpdCA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICAgICAgdmFyIGFscGhhID0gXCI8QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVhaXCIuc3BsaXQoJycpLFxuICAgICAgICAgICAgICAgIG11bHRpcGxpZXJzID0gWyA3LCAzLCAxIF0sXG4gICAgICAgICAgICAgICAgcnVubmluZ1RvdGFsID0gMDtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpbnB1dCA9IGlucHV0LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlucHV0LnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uKGNoYXJhY3RlciwgaWR4KSB7XG4gICAgICAgICAgICAgICAgdmFyIHBvcyA9IGFscGhhLmluZGV4T2YoY2hhcmFjdGVyKTtcblxuICAgICAgICAgICAgICAgIGlmKHBvcyAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gcG9zID09PSAwID8gMCA6IHBvcyArIDk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gcGFyc2VJbnQoY2hhcmFjdGVyLCAxMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNoYXJhY3RlciAqPSBtdWx0aXBsaWVyc1tpZHggJSBtdWx0aXBsaWVycy5sZW5ndGhdO1xuICAgICAgICAgICAgICAgIHJ1bm5pbmdUb3RhbCArPSBjaGFyYWN0ZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBydW5uaW5nVG90YWwgJSAxMDtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGdlbmVyYXRlID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBwYWQgPSBmdW5jdGlvbiAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJheShsZW5ndGggKyAxKS5qb2luKCc8Jyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIG51bWJlciA9IFsgJ1A8JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuaXNzdWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5sYXN0LnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnPDwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5maXJzdC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkKDM5IC0gKG9wdHMubGFzdC5sZW5ndGggKyBvcHRzLmZpcnN0Lmxlbmd0aCArIDIpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMucGFzc3BvcnROdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja0RpZ2l0KG9wdHMucGFzc3BvcnROdW1iZXIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5uYXRpb25hbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZG9iLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChvcHRzLmRvYiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmdlbmRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZXhwaXJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChvcHRzLmV4cGlyeSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBwYWQoMTQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChwYWQoMTQpKSBdLmpvaW4oJycpO1xuXG4gICAgICAgICAgICByZXR1cm4gbnVtYmVyICtcbiAgICAgICAgICAgICAgICAoY2hlY2tEaWdpdChudW1iZXIuc3Vic3RyKDQ0LCAxMCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bWJlci5zdWJzdHIoNTcsIDcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1iZXIuc3Vic3RyKDY1LCA3KSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZmlyc3Q6IHRoaXMuZmlyc3QoKSxcbiAgICAgICAgICAgIGxhc3Q6IHRoaXMubGFzdCgpLFxuICAgICAgICAgICAgcGFzc3BvcnROdW1iZXI6IHRoaXMuaW50ZWdlcih7bWluOiAxMDAwMDAwMDAsIG1heDogOTk5OTk5OTk5fSksXG4gICAgICAgICAgICBkb2I6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGUgPSB0aGF0LmJpcnRoZGF5KHt0eXBlOiAnYWR1bHQnfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtkYXRlLmdldEZ1bGxZZWFyKCkudG9TdHJpbmcoKS5zdWJzdHIoMiksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChkYXRlLmdldE1vbnRoKCkgKyAxLCAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0RGF0ZSgpLCAyKV0uam9pbignJyk7XG4gICAgICAgICAgICB9KCkpLFxuICAgICAgICAgICAgZXhwaXJ5OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYXRlID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gWyhkYXRlLmdldEZ1bGxZZWFyKCkgKyA1KS50b1N0cmluZygpLnN1YnN0cigyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0TW9udGgoKSArIDEsIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoZGF0ZS5nZXREYXRlKCksIDIpXS5qb2luKCcnKTtcbiAgICAgICAgICAgIH0oKSksXG4gICAgICAgICAgICBnZW5kZXI6IHRoaXMuZ2VuZGVyKCkgPT09ICdGZW1hbGUnID8gJ0YnOiAnTScsXG4gICAgICAgICAgICBpc3N1ZXI6ICdHQlInLFxuICAgICAgICAgICAgbmF0aW9uYWxpdHk6ICdHQlInXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGUgKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIGZpcnN0ID0gdGhpcy5maXJzdChvcHRpb25zKSxcbiAgICAgICAgICAgIGxhc3QgPSB0aGlzLmxhc3Qob3B0aW9ucyksXG4gICAgICAgICAgICBuYW1lO1xuXG4gICAgICAgIGlmIChvcHRpb25zLm1pZGRsZSkge1xuICAgICAgICAgICAgbmFtZSA9IGZpcnN0ICsgJyAnICsgdGhpcy5maXJzdChvcHRpb25zKSArICcgJyArIGxhc3Q7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5taWRkbGVfaW5pdGlhbCkge1xuICAgICAgICAgICAgbmFtZSA9IGZpcnN0ICsgJyAnICsgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6ICd1cHBlcid9KSArICcuICcgKyBsYXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmFtZSA9IGZpcnN0ICsgJyAnICsgbGFzdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnByZWZpeCkge1xuICAgICAgICAgICAgbmFtZSA9IHRoaXMucHJlZml4KG9wdGlvbnMpICsgJyAnICsgbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnN1ZmZpeCkge1xuICAgICAgICAgICAgbmFtZSA9IG5hbWUgKyAnICcgKyB0aGlzLnN1ZmZpeChvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgIH07XG5cbiAgICAvLyBSZXR1cm4gdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIG5hbWUgcHJlZml4ZXMgYmFzZWQgb24gc3VwcGxpZWQgZ2VuZGVyLlxuICAgIC8vIEB0b2RvIGludHJvZHVjZSBpbnRlcm5hdGlvbmFsaXphdGlvblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZV9wcmVmaXhlcyA9IGZ1bmN0aW9uIChnZW5kZXIpIHtcbiAgICAgICAgZ2VuZGVyID0gZ2VuZGVyIHx8IFwiYWxsXCI7XG4gICAgICAgIGdlbmRlciA9IGdlbmRlci50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIHZhciBwcmVmaXhlcyA9IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ0RvY3RvcicsIGFiYnJldmlhdGlvbjogJ0RyLicgfVxuICAgICAgICBdO1xuXG4gICAgICAgIGlmIChnZW5kZXIgPT09IFwibWFsZVwiIHx8IGdlbmRlciA9PT0gXCJhbGxcIikge1xuICAgICAgICAgICAgcHJlZml4ZXMucHVzaCh7IG5hbWU6ICdNaXN0ZXInLCBhYmJyZXZpYXRpb246ICdNci4nIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGdlbmRlciA9PT0gXCJmZW1hbGVcIiB8fCBnZW5kZXIgPT09IFwiYWxsXCIpIHtcbiAgICAgICAgICAgIHByZWZpeGVzLnB1c2goeyBuYW1lOiAnTWlzcycsIGFiYnJldmlhdGlvbjogJ01pc3MnIH0pO1xuICAgICAgICAgICAgcHJlZml4ZXMucHVzaCh7IG5hbWU6ICdNaXNzZXMnLCBhYmJyZXZpYXRpb246ICdNcnMuJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVmaXhlcztcbiAgICB9O1xuXG4gICAgLy8gQWxpYXMgZm9yIG5hbWVfcHJlZml4XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wcmVmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5uYW1lX3ByZWZpeChvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3ByZWZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGdlbmRlcjogXCJhbGxcIiB9KTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZnVsbCA/XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5uYW1lX3ByZWZpeGVzKG9wdGlvbnMuZ2VuZGVyKSkubmFtZSA6XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5uYW1lX3ByZWZpeGVzKG9wdGlvbnMuZ2VuZGVyKSkuYWJicmV2aWF0aW9uO1xuICAgIH07XG4gICAgLy9IdW5nYXJpYW4gSUQgbnVtYmVyXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ISUROPSBmdW5jdGlvbigpe1xuICAgICAvL0h1bmdhcmlhbiBJRCBudWJlciBzdHJ1Y3R1cmU6IFhYWFhYWFlZIChYPW51bWJlcixZPUNhcGl0YWwgTGF0aW4gbGV0dGVyKVxuICAgICAgdmFyIGlkbl9wb29sPVwiMDEyMzQ1Njc4OVwiO1xuICAgICAgdmFyIGlkbl9jaHJzPVwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVhaXCI7XG4gICAgICB2YXIgaWRuPVwiXCI7XG4gICAgICAgIGlkbis9dGhpcy5zdHJpbmcoe3Bvb2w6aWRuX3Bvb2wsbGVuZ3RoOjZ9KTtcbiAgICAgICAgaWRuKz10aGlzLnN0cmluZyh7cG9vbDppZG5fY2hycyxsZW5ndGg6Mn0pO1xuICAgICAgICByZXR1cm4gaWRuO1xuICAgIH07XG5cblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3NuID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtzc25Gb3VyOiBmYWxzZSwgZGFzaGVzOiB0cnVlfSk7XG4gICAgICAgIHZhciBzc25fcG9vbCA9IFwiMTIzNDU2Nzg5MFwiLFxuICAgICAgICAgICAgc3NuLFxuICAgICAgICAgICAgZGFzaCA9IG9wdGlvbnMuZGFzaGVzID8gJy0nIDogJyc7XG5cbiAgICAgICAgaWYoIW9wdGlvbnMuc3NuRm91cikge1xuICAgICAgICAgICAgc3NuID0gdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDN9KSArIGRhc2ggK1xuICAgICAgICAgICAgdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDJ9KSArIGRhc2ggK1xuICAgICAgICAgICAgdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDR9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNzbiA9IHRoaXMuc3RyaW5nKHtwb29sOiBzc25fcG9vbCwgbGVuZ3RoOiA0fSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNzbjtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIHRoZSBsaXN0IG9mIGF2YWlsYWJsZSBuYW1lIHN1ZmZpeGVzXG4gICAgLy8gQHRvZG8gaW50cm9kdWNlIGludGVybmF0aW9uYWxpemF0aW9uXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3N1ZmZpeGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3VmZml4ZXMgPSBbXG4gICAgICAgICAgICB7IG5hbWU6ICdEb2N0b3Igb2YgT3N0ZW9wYXRoaWMgTWVkaWNpbmUnLCBhYmJyZXZpYXRpb246ICdELk8uJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnRG9jdG9yIG9mIFBoaWxvc29waHknLCBhYmJyZXZpYXRpb246ICdQaC5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0VzcXVpcmUnLCBhYmJyZXZpYXRpb246ICdFc3EuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnSnVuaW9yJywgYWJicmV2aWF0aW9uOiAnSnIuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnSnVyaXMgRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnSi5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBBcnRzJywgYWJicmV2aWF0aW9uOiAnTS5BLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBCdXNpbmVzcyBBZG1pbmlzdHJhdGlvbicsIGFiYnJldmlhdGlvbjogJ00uQi5BLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBTY2llbmNlJywgYWJicmV2aWF0aW9uOiAnTS5TLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01lZGljYWwgRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnTS5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1NlbmlvcicsIGFiYnJldmlhdGlvbjogJ1NyLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1RoZSBUaGlyZCcsIGFiYnJldmlhdGlvbjogJ0lJSScgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1RoZSBGb3VydGgnLCBhYmJyZXZpYXRpb246ICdJVicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0JhY2hlbG9yIG9mIEVuZ2luZWVyaW5nJywgYWJicmV2aWF0aW9uOiAnQi5FJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnQmFjaGVsb3Igb2YgVGVjaG5vbG9neScsIGFiYnJldmlhdGlvbjogJ0IuVEVDSCcgfVxuICAgICAgICBdO1xuICAgICAgICByZXR1cm4gc3VmZml4ZXM7XG4gICAgfTtcblxuICAgIC8vIEFsaWFzIGZvciBuYW1lX3N1ZmZpeFxuICAgIENoYW5jZS5wcm90b3R5cGUuc3VmZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmFtZV9zdWZmaXgob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZV9zdWZmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZ1bGwgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMubmFtZV9zdWZmaXhlcygpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfc3VmZml4ZXMoKSkuYWJicmV2aWF0aW9uO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hdGlvbmFsaXRpZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcIm5hdGlvbmFsaXRpZXNcIik7XG4gICAgfTtcblxuICAgIC8vIEdlbmVyYXRlIHJhbmRvbSBuYXRpb25hbGl0eSBiYXNlZCBvbiBqc29uIGxpc3RcbiAgICBDaGFuY2UucHJvdG90eXBlLm5hdGlvbmFsaXR5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbmF0aW9uYWxpdHkgPSB0aGlzLnBpY2sodGhpcy5uYXRpb25hbGl0aWVzKCkpO1xuICAgICAgICByZXR1cm4gbmF0aW9uYWxpdHkubmFtZTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFBlcnNvbiAtLVxuXG4gICAgLy8gLS0gTW9iaWxlIC0tXG4gICAgLy8gQW5kcm9pZCBHQ00gUmVnaXN0cmF0aW9uIElEXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hbmRyb2lkX2lkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXCJBUEE5MVwiICsgdGhpcy5zdHJpbmcoeyBwb29sOiBcIjAxMjM0NTY3ODlhYmNlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVotX1wiLCBsZW5ndGg6IDE3OCB9KTtcbiAgICB9O1xuXG4gICAgLy8gQXBwbGUgUHVzaCBUb2tlblxuICAgIENoYW5jZS5wcm90b3R5cGUuYXBwbGVfdG9rZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmluZyh7IHBvb2w6IFwiYWJjZGVmMTIzNDU2Nzg5MFwiLCBsZW5ndGg6IDY0IH0pO1xuICAgIH07XG5cbiAgICAvLyBXaW5kb3dzIFBob25lIDggQU5JRDJcbiAgICBDaGFuY2UucHJvdG90eXBlLndwOF9hbmlkMiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGJhc2U2NCggdGhpcy5oYXNoKCB7IGxlbmd0aCA6IDMyIH0gKSApO1xuICAgIH07XG5cbiAgICAvLyBXaW5kb3dzIFBob25lIDcgQU5JRFxuICAgIENoYW5jZS5wcm90b3R5cGUud3A3X2FuaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnQT0nICsgdGhpcy5ndWlkKCkucmVwbGFjZSgvLS9nLCAnJykudG9VcHBlckNhc2UoKSArICcmRT0nICsgdGhpcy5oYXNoKHsgbGVuZ3RoOjMgfSkgKyAnJlc9JyArIHRoaXMuaW50ZWdlcih7IG1pbjowLCBtYXg6OSB9KTtcbiAgICB9O1xuXG4gICAgLy8gQmxhY2tCZXJyeSBEZXZpY2UgUElOXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5iYl9waW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhhc2goeyBsZW5ndGg6IDggfSk7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBNb2JpbGUgLS1cblxuICAgIC8vIC0tIFdlYiAtLVxuICAgIENoYW5jZS5wcm90b3R5cGUuYXZhdGFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHVybCA9IG51bGw7XG4gICAgICAgIHZhciBVUkxfQkFTRSA9ICcvL3d3dy5ncmF2YXRhci5jb20vYXZhdGFyLyc7XG4gICAgICAgIHZhciBQUk9UT0NPTFMgPSB7XG4gICAgICAgICAgICBodHRwOiAnaHR0cCcsXG4gICAgICAgICAgICBodHRwczogJ2h0dHBzJ1xuICAgICAgICB9O1xuICAgICAgICB2YXIgRklMRV9UWVBFUyA9IHtcbiAgICAgICAgICAgIGJtcDogJ2JtcCcsXG4gICAgICAgICAgICBnaWY6ICdnaWYnLFxuICAgICAgICAgICAganBnOiAnanBnJyxcbiAgICAgICAgICAgIHBuZzogJ3BuZydcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIEZBTExCQUNLUyA9IHtcbiAgICAgICAgICAgICc0MDQnOiAnNDA0JywgLy8gUmV0dXJuIDQwNCBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIG1tOiAnbW0nLCAvLyBNeXN0ZXJ5IG1hblxuICAgICAgICAgICAgaWRlbnRpY29uOiAnaWRlbnRpY29uJywgLy8gR2VvbWV0cmljIHBhdHRlcm4gYmFzZWQgb24gaGFzaFxuICAgICAgICAgICAgbW9uc3RlcmlkOiAnbW9uc3RlcmlkJywgLy8gQSBnZW5lcmF0ZWQgbW9uc3RlciBpY29uXG4gICAgICAgICAgICB3YXZhdGFyOiAnd2F2YXRhcicsIC8vIEEgZ2VuZXJhdGVkIGZhY2VcbiAgICAgICAgICAgIHJldHJvOiAncmV0cm8nLCAvLyA4LWJpdCBpY29uXG4gICAgICAgICAgICBibGFuazogJ2JsYW5rJyAvLyBBIHRyYW5zcGFyZW50IHBuZ1xuICAgICAgICB9O1xuICAgICAgICB2YXIgUkFUSU5HUyA9IHtcbiAgICAgICAgICAgIGc6ICdnJyxcbiAgICAgICAgICAgIHBnOiAncGcnLFxuICAgICAgICAgICAgcjogJ3InLFxuICAgICAgICAgICAgeDogJ3gnXG4gICAgICAgIH07XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgICAgcHJvdG9jb2w6IG51bGwsXG4gICAgICAgICAgICBlbWFpbDogbnVsbCxcbiAgICAgICAgICAgIGZpbGVFeHRlbnNpb246IG51bGwsXG4gICAgICAgICAgICBzaXplOiBudWxsLFxuICAgICAgICAgICAgZmFsbGJhY2s6IG51bGwsXG4gICAgICAgICAgICByYXRpbmc6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgICAgIC8vIFNldCB0byBhIHJhbmRvbSBlbWFpbFxuICAgICAgICAgICAgb3B0cy5lbWFpbCA9IHRoaXMuZW1haWwoKTtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wdHMuZW1haWwgPSBvcHRpb25zO1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5jb25zdHJ1Y3RvciA9PT0gJ0FycmF5Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRzID0gaW5pdE9wdGlvbnMob3B0aW9ucywgb3B0cyk7XG5cbiAgICAgICAgaWYgKCFvcHRzLmVtYWlsKSB7XG4gICAgICAgICAgICAvLyBTZXQgdG8gYSByYW5kb20gZW1haWxcbiAgICAgICAgICAgIG9wdHMuZW1haWwgPSB0aGlzLmVtYWlsKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTYWZlIGNoZWNraW5nIGZvciBwYXJhbXNcbiAgICAgICAgb3B0cy5wcm90b2NvbCA9IFBST1RPQ09MU1tvcHRzLnByb3RvY29sXSA/IG9wdHMucHJvdG9jb2wgKyAnOicgOiAnJztcbiAgICAgICAgb3B0cy5zaXplID0gcGFyc2VJbnQob3B0cy5zaXplLCAwKSA/IG9wdHMuc2l6ZSA6ICcnO1xuICAgICAgICBvcHRzLnJhdGluZyA9IFJBVElOR1Nbb3B0cy5yYXRpbmddID8gb3B0cy5yYXRpbmcgOiAnJztcbiAgICAgICAgb3B0cy5mYWxsYmFjayA9IEZBTExCQUNLU1tvcHRzLmZhbGxiYWNrXSA/IG9wdHMuZmFsbGJhY2sgOiAnJztcbiAgICAgICAgb3B0cy5maWxlRXh0ZW5zaW9uID0gRklMRV9UWVBFU1tvcHRzLmZpbGVFeHRlbnNpb25dID8gb3B0cy5maWxlRXh0ZW5zaW9uIDogJyc7XG5cbiAgICAgICAgdXJsID1cbiAgICAgICAgICAgIG9wdHMucHJvdG9jb2wgK1xuICAgICAgICAgICAgVVJMX0JBU0UgK1xuICAgICAgICAgICAgdGhpcy5iaW1kNS5tZDUob3B0cy5lbWFpbCkgK1xuICAgICAgICAgICAgKG9wdHMuZmlsZUV4dGVuc2lvbiA/ICcuJyArIG9wdHMuZmlsZUV4dGVuc2lvbiA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5zaXplIHx8IG9wdHMucmF0aW5nIHx8IG9wdHMuZmFsbGJhY2sgPyAnPycgOiAnJykgK1xuICAgICAgICAgICAgKG9wdHMuc2l6ZSA/ICcmcz0nICsgb3B0cy5zaXplLnRvU3RyaW5nKCkgOiAnJykgK1xuICAgICAgICAgICAgKG9wdHMucmF0aW5nID8gJyZyPScgKyBvcHRzLnJhdGluZyA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5mYWxsYmFjayA/ICcmZD0nICsgb3B0cy5mYWxsYmFjayA6ICcnKVxuICAgICAgICAgICAgO1xuXG4gICAgICAgIHJldHVybiB1cmw7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICNEZXNjcmlwdGlvbjpcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIEdlbmVyYXRlIHJhbmRvbSBjb2xvciB2YWx1ZSBiYXNlIG9uIGNvbG9yIHR5cGU6XG4gICAgICogLT4gaGV4XG4gICAgICogLT4gcmdiXG4gICAgICogLT4gcmdiYVxuICAgICAqIC0+IDB4XG4gICAgICogLT4gbmFtZWQgY29sb3JcbiAgICAgKlxuICAgICAqICNFeGFtcGxlczpcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqICogR2VlcmF0ZSByYW5kb20gaGV4IGNvbG9yXG4gICAgICogY2hhbmNlLmNvbG9yKCkgPT4gJyM3OWMxNTcnIC8gJ3JnYigxMTAsNTIsMTY0KScgLyAnMHg2N2FlMGInIC8gJyNlMmUyZTInIC8gJyMyOUNGQTcnXG4gICAgICpcbiAgICAgKiAqIEdlbmVyYXRlIEhleCBiYXNlZCBjb2xvciB2YWx1ZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Zm9ybWF0OiAnaGV4J30pICAgID0+ICcjZDY3MTE4J1xuICAgICAqXG4gICAgICogKiBHZW5lcmF0ZSBzaW1wbGUgcmdiIHZhbHVlXG4gICAgICogY2hhbmNlLmNvbG9yKHtmb3JtYXQ6ICdyZ2InfSkgICAgPT4gJ3JnYigxMTAsNTIsMTY0KSdcbiAgICAgKlxuICAgICAqICogR2VuZXJhdGUgT3ggYmFzZWQgY29sb3IgdmFsdWVcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2Zvcm1hdDogJzB4J30pICAgICA9PiAnMHg2N2FlMGInXG4gICAgICpcbiAgICAgKiAqIEdlbmVyYXRlIGdyYWlzY2FsZSBiYXNlZCB2YWx1ZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Z3JheXNjYWxlOiB0cnVlfSkgID0+ICcjZTJlMmUyJ1xuICAgICAqXG4gICAgICogKiBSZXR1cm4gdmFsaWRlIGNvbG9yIG5hbWVcbiAgICAgKiBjaGFuY2UuY29sb3Ioe2Zvcm1hdDogJ25hbWUnfSkgICA9PiAncmVkJ1xuICAgICAqXG4gICAgICogKiBNYWtlIGNvbG9yIHVwcGVyY2FzZVxuICAgICAqIGNoYW5jZS5jb2xvcih7Y2FzaW5nOiAndXBwZXInfSkgID0+ICcjMjlDRkE3J1xuXHQgXG5cdCAqICogTWluIE1heCB2YWx1ZXMgZm9yIFJHQkFcblx0ICogdmFyIGxpZ2h0X3JlZCA9IGNoYW5jZS5jb2xvcih7Zm9ybWF0OiAnaGV4JywgbWluX3JlZDogMjAwLCBtYXhfcmVkOiAyNTUsIG1heF9ncmVlbjogMCwgbWF4X2JsdWU6IDAsIG1pbl9hbHBoYTogLjIsIG1heF9hbHBoYTogLjN9KTtcbiAgICAgKlxuICAgICAqIEBwYXJhbSAgW29iamVjdF0gb3B0aW9uc1xuICAgICAqIEByZXR1cm4gW3N0cmluZ10gY29sb3IgdmFsdWVcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvbG9yID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcblx0XHRmdW5jdGlvbiBwYWQobiwgd2lkdGgsIHopIHtcblx0XHRcdHogPSB6IHx8ICcwJztcblx0XHRcdG4gPSBuICsgJyc7XG5cdFx0XHRyZXR1cm4gbi5sZW5ndGggPj0gd2lkdGggPyBuIDogbmV3IEFycmF5KHdpZHRoIC0gbi5sZW5ndGggKyAxKS5qb2luKHopICsgbjtcblx0XHR9XG5cdFx0XG4gICAgICAgIGZ1bmN0aW9uIGdyYXkodmFsdWUsIGRlbGltaXRlcikge1xuICAgICAgICAgICAgcmV0dXJuIFt2YWx1ZSwgdmFsdWUsIHZhbHVlXS5qb2luKGRlbGltaXRlciB8fCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByZ2IoaGFzQWxwaGEpIHtcbiAgICAgICAgICAgIHZhciByZ2JWYWx1ZSAgICAgPSAoaGFzQWxwaGEpICAgID8gJ3JnYmEnIDogJ3JnYic7XG4gICAgICAgICAgICB2YXIgYWxwaGFDaGFubmVsID0gKGhhc0FscGhhKSAgICA/ICgnLCcgKyB0aGlzLmZsb2F0aW5nKHttaW46bWluX2FscGhhLCBtYXg6bWF4X2FscGhhfSkpIDogXCJcIjtcbiAgICAgICAgICAgIHZhciBjb2xvclZhbHVlICAgPSAoaXNHcmF5c2NhbGUpID8gKGdyYXkodGhpcy5uYXR1cmFsKHttaW46IG1pbl9yZ2IsIG1heDogbWF4X3JnYn0pLCAnLCcpKSA6ICh0aGlzLm5hdHVyYWwoe21pbjogbWluX2dyZWVuLCBtYXg6IG1heF9ncmVlbn0pICsgJywnICsgdGhpcy5uYXR1cmFsKHttaW46IG1pbl9ibHVlLCBtYXg6IG1heF9ibHVlfSkgKyAnLCcgKyB0aGlzLm5hdHVyYWwoe21heDogMjU1fSkpO1xuICAgICAgICAgICAgcmV0dXJuIHJnYlZhbHVlICsgJygnICsgY29sb3JWYWx1ZSArIGFscGhhQ2hhbm5lbCArICcpJztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGhleChzdGFydCwgZW5kLCB3aXRoSGFzaCkge1xuICAgICAgICAgICAgdmFyIHN5bWJvbCA9ICh3aXRoSGFzaCkgPyBcIiNcIiA6IFwiXCI7XG5cdFx0XHR2YXIgaGV4c3RyaW5nID0gXCJcIjtcblx0XHRcdFxuXHRcdFx0aWYgKGlzR3JheXNjYWxlKSB7XG5cdFx0XHRcdGhleHN0cmluZyA9IGdyYXkocGFkKHRoaXMuaGV4KHttaW46IG1pbl9yZ2IsIG1heDogbWF4X3JnYn0pLCAyKSk7XG5cdFx0XHRcdGlmIChvcHRpb25zLmZvcm1hdCA9PT0gXCJzaG9ydGhleFwiKSB7XG5cdFx0XHRcdFx0aGV4c3RyaW5nID0gZ3JheSh0aGlzLmhleCh7bWluOiAwLCBtYXg6IDE1fSkpO1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKFwiaGV4OiBcIiArIGhleHN0cmluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAob3B0aW9ucy5mb3JtYXQgPT09IFwic2hvcnRoZXhcIikge1xuXHRcdFx0XHRcdGhleHN0cmluZyA9IHBhZCh0aGlzLmhleCh7bWluOiBNYXRoLmZsb29yKG1pbl9yZWQgLyAxNiksIG1heDogTWF0aC5mbG9vcihtYXhfcmVkIC8gMTYpfSksIDEpICsgcGFkKHRoaXMuaGV4KHttaW46IE1hdGguZmxvb3IobWluX2dyZWVuIC8gMTYpLCBtYXg6IE1hdGguZmxvb3IobWF4X2dyZWVuIC8gMTYpfSksIDEpICsgcGFkKHRoaXMuaGV4KHttaW46IE1hdGguZmxvb3IobWluX2JsdWUgLyAxNiksIG1heDogTWF0aC5mbG9vcihtYXhfYmx1ZSAvIDE2KX0pLCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChtaW5fcmVkICE9PSB1bmRlZmluZWQgfHwgbWF4X3JlZCAhPT0gdW5kZWZpbmVkIHx8IG1pbl9ncmVlbiAhPT0gdW5kZWZpbmVkIHx8IG1heF9ncmVlbiAhPT0gdW5kZWZpbmVkIHx8IG1pbl9ibHVlICE9PSB1bmRlZmluZWQgfHwgbWF4X2JsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGhleHN0cmluZyA9IHBhZCh0aGlzLmhleCh7bWluOiBtaW5fcmVkLCBtYXg6IG1heF9yZWR9KSwgMikgKyBwYWQodGhpcy5oZXgoe21pbjogbWluX2dyZWVuLCBtYXg6IG1heF9ncmVlbn0pLCAyKSArIHBhZCh0aGlzLmhleCh7bWluOiBtaW5fYmx1ZSwgbWF4OiBtYXhfYmx1ZX0pLCAyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRoZXhzdHJpbmcgPSBwYWQodGhpcy5oZXgoe21pbjogbWluX3JnYiwgbWF4OiBtYXhfcmdifSksIDIpICsgcGFkKHRoaXMuaGV4KHttaW46IG1pbl9yZ2IsIG1heDogbWF4X3JnYn0pLCAyKSArIHBhZCh0aGlzLmhleCh7bWluOiBtaW5fcmdiLCBtYXg6IG1heF9yZ2J9KSwgMik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuICAgICAgICAgICAgcmV0dXJuIHN5bWJvbCArIGhleHN0cmluZztcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmb3JtYXQ6IHRoaXMucGljayhbJ2hleCcsICdzaG9ydGhleCcsICdyZ2InLCAncmdiYScsICcweCcsICduYW1lJ10pLFxuICAgICAgICAgICAgZ3JheXNjYWxlOiBmYWxzZSxcbiAgICAgICAgICAgIGNhc2luZzogJ2xvd2VyJywgXG5cdFx0XHRtaW46IDAsIFxuXHRcdFx0bWF4OiAyNTUsIFxuXHRcdFx0bWluX3JlZDogdW5kZWZpbmVkLFxuXHRcdFx0bWF4X3JlZDogdW5kZWZpbmVkLCBcblx0XHRcdG1pbl9ncmVlbjogdW5kZWZpbmVkLFxuXHRcdFx0bWF4X2dyZWVuOiB1bmRlZmluZWQsIFxuXHRcdFx0bWluX2JsdWU6IHVuZGVmaW5lZCwgXG5cdFx0XHRtYXhfYmx1ZTogdW5kZWZpbmVkLCBcblx0XHRcdG1pbl9hbHBoYTogMCxcblx0XHRcdG1heF9hbHBoYTogMVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgaXNHcmF5c2NhbGUgPSBvcHRpb25zLmdyYXlzY2FsZTtcblx0XHR2YXIgbWluX3JnYiA9IG9wdGlvbnMubWluO1xuXHRcdHZhciBtYXhfcmdiID0gb3B0aW9ucy5tYXg7XHRcdFxuXHRcdHZhciBtaW5fcmVkID0gb3B0aW9ucy5taW5fcmVkO1xuXHRcdHZhciBtYXhfcmVkID0gb3B0aW9ucy5tYXhfcmVkO1xuXHRcdHZhciBtaW5fZ3JlZW4gPSBvcHRpb25zLm1pbl9ncmVlbjtcblx0XHR2YXIgbWF4X2dyZWVuID0gb3B0aW9ucy5tYXhfZ3JlZW47XG5cdFx0dmFyIG1pbl9ibHVlID0gb3B0aW9ucy5taW5fYmx1ZTtcblx0XHR2YXIgbWF4X2JsdWUgPSBvcHRpb25zLm1heF9ibHVlO1xuXHRcdHZhciBtaW5fYWxwaGEgPSBvcHRpb25zLm1pbl9hbHBoYTtcblx0XHR2YXIgbWF4X2FscGhhID0gb3B0aW9ucy5tYXhfYWxwaGE7XG5cdFx0aWYgKG9wdGlvbnMubWluX3JlZCA9PT0gdW5kZWZpbmVkKSB7IG1pbl9yZWQgPSBtaW5fcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWF4X3JlZCA9PT0gdW5kZWZpbmVkKSB7IG1heF9yZWQgPSBtYXhfcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWluX2dyZWVuID09PSB1bmRlZmluZWQpIHsgbWluX2dyZWVuID0gbWluX3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1heF9ncmVlbiA9PT0gdW5kZWZpbmVkKSB7IG1heF9ncmVlbiA9IG1heF9yZ2I7IH1cblx0XHRpZiAob3B0aW9ucy5taW5fYmx1ZSA9PT0gdW5kZWZpbmVkKSB7IG1pbl9ibHVlID0gbWluX3JnYjsgfVxuXHRcdGlmIChvcHRpb25zLm1heF9ibHVlID09PSB1bmRlZmluZWQpIHsgbWF4X2JsdWUgPSBtYXhfcmdiOyB9XG5cdFx0aWYgKG9wdGlvbnMubWluX2FscGhhID09PSB1bmRlZmluZWQpIHsgbWluX2FscGhhID0gMDsgfVxuXHRcdGlmIChvcHRpb25zLm1heF9hbHBoYSA9PT0gdW5kZWZpbmVkKSB7IG1heF9hbHBoYSA9IDE7IH1cblx0XHRpZiAoaXNHcmF5c2NhbGUgJiYgbWluX3JnYiA9PT0gMCAmJiBtYXhfcmdiID09PSAyNTUgJiYgbWluX3JlZCAhPT0gdW5kZWZpbmVkICYmIG1heF9yZWQgIT09IHVuZGVmaW5lZCkge1x0XHRcdFxuXHRcdFx0bWluX3JnYiA9ICgobWluX3JlZCArIG1pbl9ncmVlbiArIG1pbl9ibHVlKSAvIDMpO1xuXHRcdFx0bWF4X3JnYiA9ICgobWF4X3JlZCArIG1heF9ncmVlbiArIG1heF9ibHVlKSAvIDMpO1xuXHRcdH1cbiAgICAgICAgdmFyIGNvbG9yVmFsdWU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnaGV4Jykge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IGhleC5jYWxsKHRoaXMsIDIsIDYsIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnc2hvcnRoZXgnKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gaGV4LmNhbGwodGhpcywgMSwgMywgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdyZ2InKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gcmdiLmNhbGwodGhpcywgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAncmdiYScpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSByZ2IuY2FsbCh0aGlzLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJzB4Jykge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9ICcweCcgKyBoZXguY2FsbCh0aGlzLCAyLCA2KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMuZm9ybWF0ID09PSAnbmFtZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5nZXQoXCJjb2xvck5hbWVzXCIpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIGZvcm1hdCBwcm92aWRlZC4gUGxlYXNlIHByb3ZpZGUgb25lIG9mIFwiaGV4XCIsIFwic2hvcnRoZXhcIiwgXCJyZ2JcIiwgXCJyZ2JhXCIsIFwiMHhcIiBvciBcIm5hbWVcIi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJyApIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSBjb2xvclZhbHVlLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29sb3JWYWx1ZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kb21haW4gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzLndvcmQoKSArICcuJyArIChvcHRpb25zLnRsZCB8fCB0aGlzLnRsZCgpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5lbWFpbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud29yZCh7bGVuZ3RoOiBvcHRpb25zLmxlbmd0aH0pICsgJ0AnICsgKG9wdGlvbnMuZG9tYWluIHx8IHRoaXMuZG9tYWluKCkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmZiaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUludCgnMTAwMDAnICsgdGhpcy5uYXR1cmFsKHttYXg6IDEwMDAwMDAwMDAwMH0pLCAxMCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZ29vZ2xlX2FuYWx5dGljcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFjY291bnQgPSB0aGlzLnBhZCh0aGlzLm5hdHVyYWwoe21heDogOTk5OTk5fSksIDYpO1xuICAgICAgICB2YXIgcHJvcGVydHkgPSB0aGlzLnBhZCh0aGlzLm5hdHVyYWwoe21heDogOTl9KSwgMik7XG5cbiAgICAgICAgcmV0dXJuICdVQS0nICsgYWNjb3VudCArICctJyArIHByb3BlcnR5O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmhhc2h0YWcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnIycgKyB0aGlzLndvcmQoKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5pcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gVG9kbzogVGhpcyBjb3VsZCByZXR1cm4gc29tZSByZXNlcnZlZCBJUHMuIFNlZSBodHRwOi8vdnEuaW8vMTM3ZGdZeVxuICAgICAgICAvLyB0aGlzIHNob3VsZCBwcm9iYWJseSBiZSB1cGRhdGVkIHRvIGFjY291bnQgZm9yIHRoYXQgcmFyZSBhcyBpdCBtYXkgYmVcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDI1NH0pICsgJy4nICtcbiAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcuJyArXG4gICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21heDogMjU1fSkgKyAnLicgK1xuICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogMjU0fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaXB2NiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGlwX2FkZHIgPSB0aGlzLm4odGhpcy5oYXNoLCA4LCB7bGVuZ3RoOiA0fSk7XG5cbiAgICAgICAgcmV0dXJuIGlwX2FkZHIuam9pbihcIjpcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUua2xvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnNlbXZlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGluY2x1ZGVfcHJlcmVsZWFzZTogdHJ1ZSB9KTtcblxuICAgICAgICB2YXIgcmFuZ2UgPSB0aGlzLnBpY2tvbmUoW1wiXlwiLCBcIn5cIiwgXCI8XCIsIFwiPlwiLCBcIjw9XCIsIFwiPj1cIiwgXCI9XCJdKTtcbiAgICAgICAgaWYgKG9wdGlvbnMucmFuZ2UpIHtcbiAgICAgICAgICAgIHJhbmdlID0gb3B0aW9ucy5yYW5nZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcmVyZWxlYXNlID0gXCJcIjtcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5jbHVkZV9wcmVyZWxlYXNlKSB7XG4gICAgICAgICAgICBwcmVyZWxlYXNlID0gdGhpcy53ZWlnaHRlZChbXCJcIiwgXCItZGV2XCIsIFwiLWJldGFcIiwgXCItYWxwaGFcIl0sIFs1MCwgMTAsIDUsIDFdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmFuZ2UgKyB0aGlzLnJwZygnM2QxMCcpLmpvaW4oJy4nKSArIHByZXJlbGVhc2U7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudGxkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFsnY29tJywgJ29yZycsICdlZHUnLCAnZ292JywgJ2NvLnVrJywgJ25ldCcsICdpbycsICdhYycsICdhZCcsICdhZScsICdhZicsICdhZycsICdhaScsICdhbCcsICdhbScsICdhbicsICdhbycsICdhcScsICdhcicsICdhcycsICdhdCcsICdhdScsICdhdycsICdheCcsICdheicsICdiYScsICdiYicsICdiZCcsICdiZScsICdiZicsICdiZycsICdiaCcsICdiaScsICdiaicsICdibScsICdibicsICdibycsICdicScsICdicicsICdicycsICdidCcsICdidicsICdidycsICdieScsICdieicsICdjYScsICdjYycsICdjZCcsICdjZicsICdjZycsICdjaCcsICdjaScsICdjaycsICdjbCcsICdjbScsICdjbicsICdjbycsICdjcicsICdjdScsICdjdicsICdjdycsICdjeCcsICdjeScsICdjeicsICdkZScsICdkaicsICdkaycsICdkbScsICdkbycsICdkeicsICdlYycsICdlZScsICdlZycsICdlaCcsICdlcicsICdlcycsICdldCcsICdldScsICdmaScsICdmaicsICdmaycsICdmbScsICdmbycsICdmcicsICdnYScsICdnYicsICdnZCcsICdnZScsICdnZicsICdnZycsICdnaCcsICdnaScsICdnbCcsICdnbScsICdnbicsICdncCcsICdncScsICdncicsICdncycsICdndCcsICdndScsICdndycsICdneScsICdoaycsICdobScsICdobicsICdocicsICdodCcsICdodScsICdpZCcsICdpZScsICdpbCcsICdpbScsICdpbicsICdpbycsICdpcScsICdpcicsICdpcycsICdpdCcsICdqZScsICdqbScsICdqbycsICdqcCcsICdrZScsICdrZycsICdraCcsICdraScsICdrbScsICdrbicsICdrcCcsICdrcicsICdrdycsICdreScsICdreicsICdsYScsICdsYicsICdsYycsICdsaScsICdsaycsICdscicsICdscycsICdsdCcsICdsdScsICdsdicsICdseScsICdtYScsICdtYycsICdtZCcsICdtZScsICdtZycsICdtaCcsICdtaycsICdtbCcsICdtbScsICdtbicsICdtbycsICdtcCcsICdtcScsICdtcicsICdtcycsICdtdCcsICdtdScsICdtdicsICdtdycsICdteCcsICdteScsICdteicsICduYScsICduYycsICduZScsICduZicsICduZycsICduaScsICdubCcsICdubycsICducCcsICducicsICdudScsICdueicsICdvbScsICdwYScsICdwZScsICdwZicsICdwZycsICdwaCcsICdwaycsICdwbCcsICdwbScsICdwbicsICdwcicsICdwcycsICdwdCcsICdwdycsICdweScsICdxYScsICdyZScsICdybycsICdycycsICdydScsICdydycsICdzYScsICdzYicsICdzYycsICdzZCcsICdzZScsICdzZycsICdzaCcsICdzaScsICdzaicsICdzaycsICdzbCcsICdzbScsICdzbicsICdzbycsICdzcicsICdzcycsICdzdCcsICdzdScsICdzdicsICdzeCcsICdzeScsICdzeicsICd0YycsICd0ZCcsICd0ZicsICd0ZycsICd0aCcsICd0aicsICd0aycsICd0bCcsICd0bScsICd0bicsICd0bycsICd0cCcsICd0cicsICd0dCcsICd0dicsICd0dycsICd0eicsICd1YScsICd1ZycsICd1aycsICd1cycsICd1eScsICd1eicsICd2YScsICd2YycsICd2ZScsICd2ZycsICd2aScsICd2bicsICd2dScsICd3ZicsICd3cycsICd5ZScsICd5dCcsICd6YScsICd6bScsICd6dyddO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnRsZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLnRsZHMoKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudHdpdHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICdAJyArIHRoaXMud29yZCgpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnVybCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IHByb3RvY29sOiBcImh0dHBcIiwgZG9tYWluOiB0aGlzLmRvbWFpbihvcHRpb25zKSwgZG9tYWluX3ByZWZpeDogXCJcIiwgcGF0aDogdGhpcy53b3JkKCksIGV4dGVuc2lvbnM6IFtdfSk7XG5cbiAgICAgICAgdmFyIGV4dGVuc2lvbiA9IG9wdGlvbnMuZXh0ZW5zaW9ucy5sZW5ndGggPiAwID8gXCIuXCIgKyB0aGlzLnBpY2sob3B0aW9ucy5leHRlbnNpb25zKSA6IFwiXCI7XG4gICAgICAgIHZhciBkb21haW4gPSBvcHRpb25zLmRvbWFpbl9wcmVmaXggPyBvcHRpb25zLmRvbWFpbl9wcmVmaXggKyBcIi5cIiArIG9wdGlvbnMuZG9tYWluIDogb3B0aW9ucy5kb21haW47XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucHJvdG9jb2wgKyBcIjovL1wiICsgZG9tYWluICsgXCIvXCIgKyBvcHRpb25zLnBhdGggKyBleHRlbnNpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucG9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlZ2VyKHttaW46IDAsIG1heDogNjU1MzV9KTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFdlYiAtLVxuXG4gICAgLy8gLS0gTG9jYXRpb24gLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuYWRkcmVzcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiA1LCBtYXg6IDIwMDB9KSArICcgJyArIHRoaXMuc3RyZWV0KG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFsdGl0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAwLCBtYXg6IDg4NDh9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe1xuICAgICAgICAgICAgbWluOiBvcHRpb25zLm1pbixcbiAgICAgICAgICAgIG1heDogb3B0aW9ucy5tYXgsXG4gICAgICAgICAgICBmaXhlZDogb3B0aW9ucy5maXhlZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hcmVhY29kZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7cGFyZW5zIDogdHJ1ZX0pO1xuICAgICAgICAvLyBEb24ndCB3YW50IGFyZWEgY29kZXMgdG8gc3RhcnQgd2l0aCAxLCBvciBoYXZlIGEgOSBhcyB0aGUgc2Vjb25kIGRpZ2l0XG4gICAgICAgIHZhciBhcmVhY29kZSA9IHRoaXMubmF0dXJhbCh7bWluOiAyLCBtYXg6IDl9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21pbjogMCwgbWF4OiA4fSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttaW46IDAsIG1heDogOX0pLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucGFyZW5zID8gJygnICsgYXJlYWNvZGUgKyAnKScgOiBhcmVhY29kZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jaXR5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYXBpdGFsaXplKHRoaXMud29yZCh7c3lsbGFibGVzOiAzfSkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvb3JkaW5hdGVzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF0aXR1ZGUob3B0aW9ucykgKyAnLCAnICsgdGhpcy5sb25naXR1ZGUob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnRyaWVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJjb3VudHJpZXNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnRyeSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGNvdW50cnkgPSB0aGlzLnBpY2sodGhpcy5jb3VudHJpZXMoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZ1bGwgPyBjb3VudHJ5Lm5hbWUgOiBjb3VudHJ5LmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kZXB0aCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQ6IDUsIG1pbjogLTEwOTk0LCBtYXg6IDB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe1xuICAgICAgICAgICAgbWluOiBvcHRpb25zLm1pbixcbiAgICAgICAgICAgIG1heDogb3B0aW9ucy5tYXgsXG4gICAgICAgICAgICBmaXhlZDogb3B0aW9ucy5maXhlZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZW9oYXNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgbGVuZ3RoOiA3IH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmcoeyBsZW5ndGg6IG9wdGlvbnMubGVuZ3RoLCBwb29sOiAnMDEyMzQ1Njc4OWJjZGVmZ2hqa21ucHFyc3R1dnd4eXonIH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmdlb2pzb24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXRpdHVkZShvcHRpb25zKSArICcsICcgKyB0aGlzLmxvbmdpdHVkZShvcHRpb25zKSArICcsICcgKyB0aGlzLmFsdGl0dWRlKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmxhdGl0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAtOTAsIG1heDogOTB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXgsIGZpeGVkOiBvcHRpb25zLmZpeGVkfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubG9uZ2l0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAtMTgwLCBtYXg6IDE4MH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5mbG9hdGluZyh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heCwgZml4ZWQ6IG9wdGlvbnMuZml4ZWR9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5waG9uZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIG51bVBpY2ssXG4gICAgICAgICAgICB1a051bSA9IGZ1bmN0aW9uIChwYXJ0cykge1xuICAgICAgICAgICAgICAgIHZhciBzZWN0aW9uID0gW107XG4gICAgICAgICAgICAgICAgLy9maWxscyB0aGUgc2VjdGlvbiBwYXJ0IG9mIHRoZSBwaG9uZSBudW1iZXIgd2l0aCByYW5kb20gbnVtYmVycy5cbiAgICAgICAgICAgICAgICBwYXJ0cy5zZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgc2VjdGlvbi5wdXNoKHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IG59KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnRzLmFyZWEgKyBzZWN0aW9uLmpvaW4oJyAnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmb3JtYXR0ZWQ6IHRydWUsXG4gICAgICAgICAgICBjb3VudHJ5OiAndXMnLFxuICAgICAgICAgICAgbW9iaWxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmZvcm1hdHRlZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnMgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcGhvbmU7XG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5jb3VudHJ5KSB7XG4gICAgICAgICAgICBjYXNlICdmcic6XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLm1vYmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkIHpvbmUgYW5kIGTDqXBhcnRlbWVudCBjb2Rlcy5cbiAgICAgICAgICAgICAgICAgICAgICAgICcwMScgKyB0aGlzLnBpY2soWyczMCcsICczNCcsICczOScsICc0MCcsICc0MScsICc0MicsICc0MycsICc0NCcsICc0NScsICc0NicsICc0NycsICc0OCcsICc0OScsICc1MycsICc1NScsICc1NicsICc1OCcsICc2MCcsICc2NCcsICc2OScsICc3MCcsICc3MicsICc3MycsICc3NCcsICc3NScsICc3NicsICc3NycsICc3OCcsICc3OScsICc4MCcsICc4MScsICc4MicsICc4MyddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwMicgKyB0aGlzLnBpY2soWycxNCcsICcxOCcsICcyMicsICcyMycsICcyOCcsICcyOScsICczMCcsICczMScsICczMicsICczMycsICczNCcsICczNScsICczNicsICczNycsICczOCcsICc0MCcsICc0MScsICc0MycsICc0NCcsICc0NScsICc0NicsICc0NycsICc0OCcsICc0OScsICc1MCcsICc1MScsICc1MicsICc1MycsICc1NCcsICc1NicsICc1NycsICc2MScsICc2MicsICc2OScsICc3MicsICc3NicsICc3NycsICc3OCcsICc4NScsICc5MCcsICc5NicsICc5NycsICc5OCcsICc5OSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwMycgKyB0aGlzLnBpY2soWycxMCcsICcyMCcsICcyMScsICcyMicsICcyMycsICcyNCcsICcyNScsICcyNicsICcyNycsICcyOCcsICcyOScsICczOScsICc0NCcsICc0NScsICc1MScsICc1MicsICc1NCcsICc1NScsICc1NycsICc1OCcsICc1OScsICc2MCcsICc2MScsICc2MicsICc2MycsICc2NCcsICc2NScsICc2NicsICc2NycsICc2OCcsICc2OScsICc3MCcsICc3MScsICc3MicsICc3MycsICc4MCcsICc4MScsICc4MicsICc4MycsICc4NCcsICc4NScsICc4NicsICc4NycsICc4OCcsICc4OScsICc5MCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNCcgKyB0aGlzLnBpY2soWycxMScsICcxMycsICcxNScsICcyMCcsICcyMicsICcyNicsICcyNycsICczMCcsICczMicsICczNCcsICczNycsICc0MicsICc0MycsICc0NCcsICc1MCcsICc1NicsICc1NycsICc2MycsICc2NicsICc2NycsICc2OCcsICc2OScsICc3MCcsICc3MScsICc3MicsICc3MycsICc3NCcsICc3NScsICc3NicsICc3NycsICc3OCcsICc3OScsICc4MCcsICc4MScsICc4MicsICc4MycsICc4NCcsICc4NScsICc4NicsICc4OCcsICc4OScsICc5MCcsICc5MScsICc5MicsICc5MycsICc5NCcsICc5NScsICc5NycsICc5OCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNScgKyB0aGlzLnBpY2soWycwOCcsICcxNicsICcxNycsICcxOScsICcyNCcsICczMScsICczMicsICczMycsICczNCcsICczNScsICc0MCcsICc0NScsICc0NicsICc0NycsICc0OScsICc1MycsICc1NScsICc1NicsICc1NycsICc1OCcsICc1OScsICc2MScsICc2MicsICc2MycsICc2NCcsICc2NScsICc2NycsICc3OScsICc4MScsICc4MicsICc4NicsICc4NycsICc5MCcsICc5NCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwOScgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA4fSksXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gbnVtUGljay5tYXRjaCgvLi4vZykuam9pbignICcpIDogbnVtUGljaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFsnMDYnLCAnMDcnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA4fSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyBudW1QaWNrLm1hdGNoKC8uLi9nKS5qb2luKCcgJykgOiBudW1QaWNrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3VrJzpcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAgLy92YWxpZCBhcmVhIGNvZGVzIG9mIG1ham9yIGNpdGllcy9jb3VudGllcyBmb2xsb3dlZCBieSByYW5kb20gbnVtYmVycyBpbiByZXF1aXJlZCBmb3JtYXQuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxJyArIHRoaXMuY2hhcmFjdGVyKHsgcG9vbDogJzIzNDU2OScgfSkgKyAnMSAnLCBzZWN0aW9uczogWzMsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAyMCAnICsgdGhpcy5jaGFyYWN0ZXIoeyBwb29sOiAnMzc4JyB9KSwgc2VjdGlvbnM6IFszLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMjMgJyArIHRoaXMuY2hhcmFjdGVyKHsgcG9vbDogJzg5JyB9KSwgc2VjdGlvbnM6IFszLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMjQgNycsIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDI4ICcgKyB0aGlzLnBpY2soWycyNScsJzI4JywnMzcnLCc3MScsJzgyJywnOTAnLCc5MicsJzk1J10pLCBzZWN0aW9uczogWzIsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxMicgKyB0aGlzLnBpY2soWycwNCcsJzA4JywnNTQnLCc3NicsJzk3JywnOTgnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxMycgKyB0aGlzLnBpY2soWyc2MycsJzY0JywnODQnLCc4NiddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE0JyArIHRoaXMucGljayhbJzA0JywnMjAnLCc2MCcsJzYxJywnODAnLCc4OCddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE1JyArIHRoaXMucGljayhbJzI0JywnMjcnLCc2MicsJzY2J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTYnICsgdGhpcy5waWNrKFsnMDYnLCcyOScsJzM1JywnNDcnLCc1OScsJzk1J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTcnICsgdGhpcy5waWNrKFsnMjYnLCc0NCcsJzUwJywnNjgnXSkgKyAnICcsIHNlY3Rpb25zOiBbNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxOCcgKyB0aGlzLnBpY2soWycyNycsJzM3JywnODQnLCc5NyddKSArICcgJywgc2VjdGlvbnM6IFs2XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE5JyArIHRoaXMucGljayhbJzAwJywnMDUnLCczNScsJzQ2JywnNDknLCc2MycsJzk1J10pICsgJyAnLCBzZWN0aW9uczogWzZdIH1cbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyB1a051bShudW1QaWNrKSA6IHVrTnVtKG51bVBpY2spLnJlcGxhY2UoJyAnLCAnJywgJ2cnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzA3JyArIHRoaXMucGljayhbJzQnLCc1JywnNycsJzgnLCc5J10pLCBzZWN0aW9uczogWzIsNl0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzA3NjI0ICcsIHNlY3Rpb25zOiBbNl0gfVxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCA/IHVrTnVtKG51bVBpY2spIDogdWtOdW0obnVtUGljaykucmVwbGFjZSgnICcsICcnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd6YSc6XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLm1vYmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgJzAxJyArIHRoaXMucGljayhbJzAnLCAnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsICc4J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLFxuICAgICAgICAgICAgICAgICAgICAgICAnMDInICsgdGhpcy5waWNrKFsnMScsICcyJywgJzMnLCAnNCcsICc3JywgJzgnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgICAgICcwMycgKyB0aGlzLnBpY2soWycxJywgJzInLCAnMycsICc1JywgJzYnLCAnOSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgJzA0JyArIHRoaXMucGljayhbJzEnLCAnMicsICczJywgJzQnLCAnNScsJzYnLCc3JywgJzgnLCc5J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLCAgIFxuICAgICAgICAgICAgICAgICAgICAgICAnMDUnICsgdGhpcy5waWNrKFsnMScsICczJywgJzQnLCAnNicsICc3JywgJzgnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA3fSksXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkIHx8IG51bVBpY2s7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDYwJyArIHRoaXMucGljayhbJzMnLCc0JywnNScsJzYnLCc3JywnOCcsJzknXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDYxJyArIHRoaXMucGljayhbJzAnLCcxJywnMicsJzMnLCc0JywnNScsJzgnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA2fSksXG4gICAgICAgICAgICAgICAgICAgICAgICAnMDYnICArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNzEnICsgdGhpcy5waWNrKFsnMCcsJzEnLCcyJywnMycsJzQnLCc1JywnNicsJzcnLCc4JywnOSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNycgICsgdGhpcy5waWNrKFsnMicsJzMnLCc0JywnNicsJzcnLCc4JywnOSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDd9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwOCcgICsgdGhpcy5waWNrKFsnMCcsJzEnLCcyJywnMycsJzQnLCc1J10pICsgc2VsZi5zdHJpbmcoeyBwb29sOiAnMDEyMzQ1Njc4OScsIGxlbmd0aDogN30pLCAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICAgICAgcGhvbmUgPSBvcHRpb25zLmZvcm1hdHRlZCB8fCBudW1QaWNrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAndXMnOlxuICAgICAgICAgICAgICAgIHZhciBhcmVhY29kZSA9IHRoaXMuYXJlYWNvZGUob3B0aW9ucykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgZXhjaGFuZ2UgPSB0aGlzLm5hdHVyYWwoeyBtaW46IDIsIG1heDogOSB9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHsgbWluOiAwLCBtYXg6IDkgfSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7IG1pbjogMCwgbWF4OiA5IH0pLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmliZXIgPSB0aGlzLm5hdHVyYWwoeyBtaW46IDEwMDAsIG1heDogOTk5OSB9KS50b1N0cmluZygpOyAvLyB0aGlzIGNvdWxkIGJlIHJhbmRvbSBbMC05XXs0fVxuICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyBhcmVhY29kZSArICcgJyArIGV4Y2hhbmdlICsgJy0nICsgc3Vic2NyaWJlciA6IGFyZWFjb2RlICsgZXhjaGFuZ2UgKyBzdWJzY3JpYmVyO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwaG9uZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wb3N0YWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFBvc3RhbCBEaXN0cmljdFxuICAgICAgICB2YXIgcGQgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogXCJYVlRTUlBOS0xNSEpHRUNCQVwifSk7XG4gICAgICAgIC8vIEZvcndhcmQgU29ydGF0aW9uIEFyZWEgKEZTQSlcbiAgICAgICAgdmFyIGZzYSA9IHBkICsgdGhpcy5uYXR1cmFsKHttYXg6IDl9KSArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KTtcbiAgICAgICAgLy8gTG9jYWwgRGVsaXZlcnkgVW51dCAoTERVKVxuICAgICAgICB2YXIgbGR1ID0gdGhpcy5uYXR1cmFsKHttYXg6IDl9KSArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KSArIHRoaXMubmF0dXJhbCh7bWF4OiA5fSk7XG5cbiAgICAgICAgcmV0dXJuIGZzYSArIFwiIFwiICsgbGR1O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvdW50aWVzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ3VrJyB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwiY291bnRpZXNcIilbb3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCldO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvdW50eSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5jb3VudGllcyhvcHRpb25zKSkubmFtZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wcm92aW5jZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAnY2EnIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJwcm92aW5jZXNcIilbb3B0aW9ucy5jb3VudHJ5LnRvTG93ZXJDYXNlKCldO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnByb3ZpbmNlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIChvcHRpb25zICYmIG9wdGlvbnMuZnVsbCkgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMucHJvdmluY2VzKG9wdGlvbnMpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLnByb3ZpbmNlcyhvcHRpb25zKSkuYWJicmV2aWF0aW9uO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0YXRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIChvcHRpb25zICYmIG9wdGlvbnMuZnVsbCkgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMuc3RhdGVzKG9wdGlvbnMpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLnN0YXRlcyhvcHRpb25zKSkuYWJicmV2aWF0aW9uO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0YXRlcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICd1cycsIHVzX3N0YXRlc19hbmRfZGM6IHRydWUgfSApO1xuXG4gICAgICAgIHZhciBzdGF0ZXM7XG5cbiAgICAgICAgc3dpdGNoIChvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgY2FzZSAndXMnOlxuICAgICAgICAgICAgICAgIHZhciB1c19zdGF0ZXNfYW5kX2RjID0gdGhpcy5nZXQoXCJ1c19zdGF0ZXNfYW5kX2RjXCIpLFxuICAgICAgICAgICAgICAgICAgICB0ZXJyaXRvcmllcyA9IHRoaXMuZ2V0KFwidGVycml0b3JpZXNcIiksXG4gICAgICAgICAgICAgICAgICAgIGFybWVkX2ZvcmNlcyA9IHRoaXMuZ2V0KFwiYXJtZWRfZm9yY2VzXCIpO1xuXG4gICAgICAgICAgICAgICAgc3RhdGVzID0gW107XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c19zdGF0ZXNfYW5kX2RjKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlcyA9IHN0YXRlcy5jb25jYXQodXNfc3RhdGVzX2FuZF9kYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnRlcnJpdG9yaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlcyA9IHN0YXRlcy5jb25jYXQodGVycml0b3JpZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5hcm1lZF9mb3JjZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGVzID0gc3RhdGVzLmNvbmNhdChhcm1lZF9mb3JjZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2l0JzpcbiAgICAgICAgICAgICAgICBzdGF0ZXMgPSB0aGlzLmdldChcImNvdW50cnlfcmVnaW9uc1wiKVtvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd1ayc6XG4gICAgICAgICAgICAgICAgc3RhdGVzID0gdGhpcy5nZXQoXCJjb3VudGllc1wiKVtvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RhdGVzO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmVldCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7IGNvdW50cnk6ICd1cycsIHN5bGxhYmxlczogMiB9KTtcbiAgICAgICAgdmFyICAgICBzdHJlZXQ7XG5cbiAgICAgICAgc3dpdGNoIChvcHRpb25zLmNvdW50cnkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgY2FzZSAndXMnOlxuICAgICAgICAgICAgICAgIHN0cmVldCA9IHRoaXMud29yZCh7IHN5bGxhYmxlczogb3B0aW9ucy5zeWxsYWJsZXMgfSk7XG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gdGhpcy5jYXBpdGFsaXplKHN0cmVldCk7XG4gICAgICAgICAgICAgICAgc3RyZWV0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBzdHJlZXQgKz0gb3B0aW9ucy5zaG9ydF9zdWZmaXggP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmVldF9zdWZmaXgob3B0aW9ucykuYWJicmV2aWF0aW9uIDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHJlZXRfc3VmZml4KG9wdGlvbnMpLm5hbWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdpdCc6XG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gdGhpcy53b3JkKHsgc3lsbGFibGVzOiBvcHRpb25zLnN5bGxhYmxlcyB9KTtcbiAgICAgICAgICAgICAgICBzdHJlZXQgPSB0aGlzLmNhcGl0YWxpemUoc3RyZWV0KTtcbiAgICAgICAgICAgICAgICBzdHJlZXQgPSAob3B0aW9ucy5zaG9ydF9zdWZmaXggP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmVldF9zdWZmaXgob3B0aW9ucykuYWJicmV2aWF0aW9uIDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHJlZXRfc3VmZml4KG9wdGlvbnMpLm5hbWUpICsgXCIgXCIgKyBzdHJlZXQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0cmVldDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJlZXRfc3VmZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ3VzJyB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGljayh0aGlzLnN0cmVldF9zdWZmaXhlcyhvcHRpb25zKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3RyZWV0X3N1ZmZpeGVzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgY291bnRyeTogJ3VzJyB9KTtcbiAgICAgICAgLy8gVGhlc2UgYXJlIHRoZSBtb3N0IGNvbW1vbiBzdWZmaXhlcy5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwic3RyZWV0X3N1ZmZpeGVzXCIpW29wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpXTtcbiAgICB9O1xuXG4gICAgLy8gTm90ZTogb25seSByZXR1cm5pbmcgVVMgemlwIGNvZGVzLCBpbnRlcm5hdGlvbmFsaXphdGlvbiB3aWxsIGJlIGEgd2hvbGVcbiAgICAvLyBvdGhlciBiZWFzdCB0byB0YWNrbGUgYXQgc29tZSBwb2ludC5cbiAgICBDaGFuY2UucHJvdG90eXBlLnppcCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciB6aXAgPSB0aGlzLm4odGhpcy5uYXR1cmFsLCA1LCB7bWF4OiA5fSk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wbHVzZm91ciA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgemlwLnB1c2goJy0nKTtcbiAgICAgICAgICAgIHppcCA9IHppcC5jb25jYXQodGhpcy5uKHRoaXMubmF0dXJhbCwgNCwge21heDogOX0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB6aXAuam9pbihcIlwiKTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIExvY2F0aW9uIC0tXG5cbiAgICAvLyAtLSBUaW1lXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFtcG0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJvb2woKSA/ICdhbScgOiAncG0nO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRhdGUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgZGF0ZV9zdHJpbmcsIGRhdGU7XG5cbiAgICAgICAgLy8gSWYgaW50ZXJ2YWwgaXMgc3BlY2lmaWVkIHdlIGlnbm9yZSBwcmVzZXRcbiAgICAgICAgaWYob3B0aW9ucyAmJiAob3B0aW9ucy5taW4gfHwgb3B0aW9ucy5tYXgpKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgICAgIGFtZXJpY2FuOiB0cnVlLFxuICAgICAgICAgICAgICAgIHN0cmluZzogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIG1pbiA9IHR5cGVvZiBvcHRpb25zLm1pbiAhPT0gXCJ1bmRlZmluZWRcIiA/IG9wdGlvbnMubWluLmdldFRpbWUoKSA6IDE7XG4gICAgICAgICAgICAvLyAxMDAsMDAwLDAwMCBkYXlzIG1lYXN1cmVkIHJlbGF0aXZlIHRvIG1pZG5pZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgMDEgSmFudWFyeSwgMTk3MCBVVEMuIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuOS4xLjFcbiAgICAgICAgICAgIHZhciBtYXggPSB0eXBlb2Ygb3B0aW9ucy5tYXggIT09IFwidW5kZWZpbmVkXCIgPyBvcHRpb25zLm1heC5nZXRUaW1lKCkgOiA4NjQwMDAwMDAwMDAwMDAwO1xuXG4gICAgICAgICAgICBkYXRlID0gbmV3IERhdGUodGhpcy5pbnRlZ2VyKHttaW46IG1pbiwgbWF4OiBtYXh9KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbSA9IHRoaXMubW9udGgoe3JhdzogdHJ1ZX0pO1xuICAgICAgICAgICAgdmFyIGRheXNJbk1vbnRoID0gbS5kYXlzO1xuXG4gICAgICAgICAgICBpZihvcHRpb25zICYmIG9wdGlvbnMubW9udGgpIHtcbiAgICAgICAgICAgICAgICAvLyBNb2QgMTIgdG8gYWxsb3cgbW9udGhzIG91dHNpZGUgcmFuZ2Ugb2YgMC0xMSAobm90IGVuY291cmFnZWQsIGJ1dCBhbHNvIG5vdCBwcmV2ZW50ZWQpLlxuICAgICAgICAgICAgICAgIGRheXNJbk1vbnRoID0gdGhpcy5nZXQoJ21vbnRocycpWygob3B0aW9ucy5tb250aCAlIDEyKSArIDEyKSAlIDEyXS5kYXlzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHllYXI6IHBhcnNlSW50KHRoaXMueWVhcigpLCAxMCksXG4gICAgICAgICAgICAgICAgLy8gTmVjZXNzYXJ5IHRvIHN1YnRyYWN0IDEgYmVjYXVzZSBEYXRlKCkgMC1pbmRleGVzIG1vbnRoIGJ1dCBub3QgZGF5IG9yIHllYXJcbiAgICAgICAgICAgICAgICAvLyBmb3Igc29tZSByZWFzb24uXG4gICAgICAgICAgICAgICAgbW9udGg6IG0ubnVtZXJpYyAtIDEsXG4gICAgICAgICAgICAgICAgZGF5OiB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiBkYXlzSW5Nb250aH0pLFxuICAgICAgICAgICAgICAgIGhvdXI6IHRoaXMuaG91cih7dHdlbnR5Zm91cjogdHJ1ZX0pLFxuICAgICAgICAgICAgICAgIG1pbnV0ZTogdGhpcy5taW51dGUoKSxcbiAgICAgICAgICAgICAgICBzZWNvbmQ6IHRoaXMuc2Vjb25kKCksXG4gICAgICAgICAgICAgICAgbWlsbGlzZWNvbmQ6IHRoaXMubWlsbGlzZWNvbmQoKSxcbiAgICAgICAgICAgICAgICBhbWVyaWNhbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzdHJpbmc6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGF0ZSA9IG5ldyBEYXRlKG9wdGlvbnMueWVhciwgb3B0aW9ucy5tb250aCwgb3B0aW9ucy5kYXksIG9wdGlvbnMuaG91ciwgb3B0aW9ucy5taW51dGUsIG9wdGlvbnMuc2Vjb25kLCBvcHRpb25zLm1pbGxpc2Vjb25kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmFtZXJpY2FuKSB7XG4gICAgICAgICAgICAvLyBBZGRpbmcgMSB0byB0aGUgbW9udGggaXMgbmVjZXNzYXJ5IGJlY2F1c2UgRGF0ZSgpIDAtaW5kZXhlc1xuICAgICAgICAgICAgLy8gbW9udGhzIGJ1dCBub3QgZGF5IGZvciBzb21lIG9kZCByZWFzb24uXG4gICAgICAgICAgICBkYXRlX3N0cmluZyA9IChkYXRlLmdldE1vbnRoKCkgKyAxKSArICcvJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy8nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0ZV9zdHJpbmcgPSBkYXRlLmdldERhdGUoKSArICcvJyArIChkYXRlLmdldE1vbnRoKCkgKyAxKSArICcvJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnN0cmluZyA/IGRhdGVfc3RyaW5nIDogZGF0ZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5oYW1tZXJ0aW1lID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0ZShvcHRpb25zKS5nZXRUaW1lKCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaG91ciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBtaW46IG9wdGlvbnMgJiYgb3B0aW9ucy50d2VudHlmb3VyID8gMCA6IDEsXG4gICAgICAgICAgICBtYXg6IG9wdGlvbnMgJiYgb3B0aW9ucy50d2VudHlmb3VyID8gMjMgOiAxMlxuICAgICAgICB9KTtcblxuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAwLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gMC5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLnR3ZW50eWZvdXIgJiYgb3B0aW9ucy5tYXggPiAyMywgXCJDaGFuY2U6IE1heCBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIDIzIGZvciB0d2VudHlmb3VyIG9wdGlvbi5cIik7XG4gICAgICAgIHRlc3RSYW5nZSghb3B0aW9ucy50d2VudHlmb3VyICYmIG9wdGlvbnMubWF4ID4gMTIsIFwiQ2hhbmNlOiBNYXggY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiAxMi5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA+IG9wdGlvbnMubWF4LCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gTWF4LlwiKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubWlsbGlzZWNvbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21heDogOTk5fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubWludXRlID0gQ2hhbmNlLnByb3RvdHlwZS5zZWNvbmQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogMCwgbWF4OiA1OX0pO1xuXG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA8IDAsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGxlc3MgdGhhbiAwLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWF4ID4gNTksIFwiQ2hhbmNlOiBNYXggY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiA1OS5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA+IG9wdGlvbnMubWF4LCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gTWF4LlwiKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IG9wdGlvbnMubWluLCBtYXg6IG9wdGlvbnMubWF4fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubW9udGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21pbjogMSwgbWF4OiAxMn0pO1xuXG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA8IDEsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGxlc3MgdGhhbiAxLlwiKTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWF4ID4gMTIsIFwiQ2hhbmNlOiBNYXggY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiAxMi5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1pbiA+IG9wdGlvbnMubWF4LCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gTWF4LlwiKTtcblxuICAgICAgICB2YXIgbW9udGggPSB0aGlzLnBpY2sodGhpcy5tb250aHMoKS5zbGljZShvcHRpb25zLm1pbiAtIDEsIG9wdGlvbnMubWF4KSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLnJhdyA/IG1vbnRoIDogbW9udGgubmFtZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tb250aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcIm1vbnRoc1wiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zZWNvbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21heDogNTl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50aW1lc3RhbXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiBwYXJzZUludChuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDAsIDEwKX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLndlZWtkYXkgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge3dlZWtkYXlfb25seTogZmFsc2V9KTtcbiAgICAgICAgdmFyIHdlZWtkYXlzID0gW1wiTW9uZGF5XCIsIFwiVHVlc2RheVwiLCBcIldlZG5lc2RheVwiLCBcIlRodXJzZGF5XCIsIFwiRnJpZGF5XCJdO1xuICAgICAgICBpZiAoIW9wdGlvbnMud2Vla2RheV9vbmx5KSB7XG4gICAgICAgICAgICB3ZWVrZGF5cy5wdXNoKFwiU2F0dXJkYXlcIik7XG4gICAgICAgICAgICB3ZWVrZGF5cy5wdXNoKFwiU3VuZGF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2tvbmUod2Vla2RheXMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnllYXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyBEZWZhdWx0IHRvIGN1cnJlbnQgeWVhciBhcyBtaW4gaWYgbm9uZSBzcGVjaWZpZWRcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKX0pO1xuXG4gICAgICAgIC8vIERlZmF1bHQgdG8gb25lIGNlbnR1cnkgYWZ0ZXIgY3VycmVudCB5ZWFyIGFzIG1heCBpZiBub25lIHNwZWNpZmllZFxuICAgICAgICBvcHRpb25zLm1heCA9ICh0eXBlb2Ygb3B0aW9ucy5tYXggIT09IFwidW5kZWZpbmVkXCIpID8gb3B0aW9ucy5tYXggOiBvcHRpb25zLm1pbiArIDEwMDtcblxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKG9wdGlvbnMpLnRvU3RyaW5nKCk7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBUaW1lXG5cbiAgICAvLyAtLSBGaW5hbmNlIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNjID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciB0eXBlLCBudW1iZXIsIHRvX2dlbmVyYXRlO1xuXG4gICAgICAgIHR5cGUgPSAob3B0aW9ucy50eXBlKSA/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2NfdHlwZSh7IG5hbWU6IG9wdGlvbnMudHlwZSwgcmF3OiB0cnVlIH0pIDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jY190eXBlKHsgcmF3OiB0cnVlIH0pO1xuXG4gICAgICAgIG51bWJlciA9IHR5cGUucHJlZml4LnNwbGl0KFwiXCIpO1xuICAgICAgICB0b19nZW5lcmF0ZSA9IHR5cGUubGVuZ3RoIC0gdHlwZS5wcmVmaXgubGVuZ3RoIC0gMTtcblxuICAgICAgICAvLyBHZW5lcmF0ZXMgbiAtIDEgZGlnaXRzXG4gICAgICAgIG51bWJlciA9IG51bWJlci5jb25jYXQodGhpcy5uKHRoaXMuaW50ZWdlciwgdG9fZ2VuZXJhdGUsIHttaW46IDAsIG1heDogOX0pKTtcblxuICAgICAgICAvLyBHZW5lcmF0ZXMgdGhlIGxhc3QgZGlnaXQgYWNjb3JkaW5nIHRvIEx1aG4gYWxnb3JpdGhtXG4gICAgICAgIG51bWJlci5wdXNoKHRoaXMubHVobl9jYWxjdWxhdGUobnVtYmVyLmpvaW4oXCJcIikpKTtcblxuICAgICAgICByZXR1cm4gbnVtYmVyLmpvaW4oXCJcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2NfdHlwZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmFua19jYXJkX251bWJlciNJc3N1ZXJfaWRlbnRpZmljYXRpb25fbnVtYmVyXy4yOElJTi4yOVxuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJjY190eXBlc1wiKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jY190eXBlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB2YXIgdHlwZXMgPSB0aGlzLmNjX3R5cGVzKCksXG4gICAgICAgICAgICB0eXBlID0gbnVsbDtcblxuICAgICAgICBpZiAob3B0aW9ucy5uYW1lKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gQWNjZXB0IGVpdGhlciBuYW1lIG9yIHNob3J0X25hbWUgdG8gc3BlY2lmeSBjYXJkIHR5cGVcbiAgICAgICAgICAgICAgICBpZiAodHlwZXNbaV0ubmFtZSA9PT0gb3B0aW9ucy5uYW1lIHx8IHR5cGVzW2ldLnNob3J0X25hbWUgPT09IG9wdGlvbnMubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB0eXBlID0gdHlwZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDcmVkaXQgY2FyZCB0eXBlICdcIiArIG9wdGlvbnMubmFtZSArIFwiJycgaXMgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR5cGUgPSB0aGlzLnBpY2sodHlwZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucmF3ID8gdHlwZSA6IHR5cGUubmFtZTtcbiAgICB9O1xuXG4gICAgLy9yZXR1cm4gYWxsIHdvcmxkIGN1cnJlbmN5IGJ5IElTTyA0MjE3XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jdXJyZW5jeV90eXBlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwiY3VycmVuY3lfdHlwZXNcIik7XG4gICAgfTtcblxuICAgIC8vcmV0dXJuIHJhbmRvbSB3b3JsZCBjdXJyZW5jeSBieSBJU08gNDIxN1xuICAgIENoYW5jZS5wcm90b3R5cGUuY3VycmVuY3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5jdXJyZW5jeV90eXBlcygpKTtcbiAgICB9O1xuXG4gICAgLy9yZXR1cm4gYWxsIHRpbWV6b25lcyBhdmFpbGFiZWxcbiAgICBDaGFuY2UucHJvdG90eXBlLnRpbWV6b25lcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwidGltZXpvbmVzXCIpO1xuICAgIH07XG5cbiAgICAvL3JldHVybiByYW5kb20gdGltZXpvbmVcbiAgICBDaGFuY2UucHJvdG90eXBlLnRpbWV6b25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMudGltZXpvbmVzKCkpO1xuICAgIH07XG5cbiAgICAvL1JldHVybiByYW5kb20gY29ycmVjdCBjdXJyZW5jeSBleGNoYW5nZSBwYWlyIChlLmcuIEVVUi9VU0QpIG9yIGFycmF5IG9mIGN1cnJlbmN5IGNvZGVcbiAgICBDaGFuY2UucHJvdG90eXBlLmN1cnJlbmN5X3BhaXIgPSBmdW5jdGlvbiAocmV0dXJuQXNTdHJpbmcpIHtcbiAgICAgICAgdmFyIGN1cnJlbmNpZXMgPSB0aGlzLnVuaXF1ZSh0aGlzLmN1cnJlbmN5LCAyLCB7XG4gICAgICAgICAgICBjb21wYXJhdG9yOiBmdW5jdGlvbihhcnIsIHZhbCkge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyci5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIGEgbWF0Y2ggaGFzIGJlZW4gZm91bmQsIHNob3J0IGNpcmN1aXQgY2hlY2sgYW5kIGp1c3QgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2MgfHwgKGl0ZW0uY29kZSA9PT0gdmFsLmNvZGUpO1xuICAgICAgICAgICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJldHVybkFzU3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVuY2llc1swXS5jb2RlICsgJy8nICsgY3VycmVuY2llc1sxXS5jb2RlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbmNpZXM7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kb2xsYXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyBCeSBkZWZhdWx0LCBhIHNvbWV3aGF0IG1vcmUgc2FuZSBtYXggZm9yIGRvbGxhciB0aGFuIGFsbCBhdmFpbGFibGUgbnVtYmVyc1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge21heCA6IDEwMDAwLCBtaW4gOiAwfSk7XG5cbiAgICAgICAgdmFyIGRvbGxhciA9IHRoaXMuZmxvYXRpbmcoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXgsIGZpeGVkOiAyfSkudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIGNlbnRzID0gZG9sbGFyLnNwbGl0KCcuJylbMV07XG5cbiAgICAgICAgaWYgKGNlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRvbGxhciArPSAnLjAwJztcbiAgICAgICAgfSBlbHNlIGlmIChjZW50cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICBkb2xsYXIgPSBkb2xsYXIgKyAnMCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZG9sbGFyIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuICctJCcgKyBkb2xsYXIucmVwbGFjZSgnLScsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAnJCcgKyBkb2xsYXI7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ldXJvID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIE51bWJlcih0aGlzLmRvbGxhcihvcHRpb25zKS5yZXBsYWNlKFwiJFwiLCBcIlwiKSkudG9Mb2NhbGVTdHJpbmcoKSArIFwi4oKsXCI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZXhwID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB2YXIgZXhwID0ge307XG5cbiAgICAgICAgZXhwLnllYXIgPSB0aGlzLmV4cF95ZWFyKCk7XG5cbiAgICAgICAgLy8gSWYgdGhlIHllYXIgaXMgdGhpcyB5ZWFyLCBuZWVkIHRvIGVuc3VyZSBtb250aCBpcyBncmVhdGVyIHRoYW4gdGhlXG4gICAgICAgIC8vIGN1cnJlbnQgbW9udGggb3IgdGhpcyBleHBpcmF0aW9uIHdpbGwgbm90IGJlIHZhbGlkXG4gICAgICAgIGlmIChleHAueWVhciA9PT0gKG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSkudG9TdHJpbmcoKSkge1xuICAgICAgICAgICAgZXhwLm1vbnRoID0gdGhpcy5leHBfbW9udGgoe2Z1dHVyZTogdHJ1ZX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwLm1vbnRoID0gdGhpcy5leHBfbW9udGgoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnJhdyA/IGV4cCA6IGV4cC5tb250aCArICcvJyArIGV4cC55ZWFyO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmV4cF9tb250aCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIG1vbnRoLCBtb250aF9pbnQsXG4gICAgICAgICAgICAvLyBEYXRlIG9iamVjdCBtb250aHMgYXJlIDAgaW5kZXhlZFxuICAgICAgICAgICAgY3VyTW9udGggPSBuZXcgRGF0ZSgpLmdldE1vbnRoKCkgKyAxO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmZ1dHVyZSAmJiAoY3VyTW9udGggIT09IDEyKSkge1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIG1vbnRoID0gdGhpcy5tb250aCh7cmF3OiB0cnVlfSkubnVtZXJpYztcbiAgICAgICAgICAgICAgICBtb250aF9pbnQgPSBwYXJzZUludChtb250aCwgMTApO1xuICAgICAgICAgICAgfSB3aGlsZSAobW9udGhfaW50IDw9IGN1ck1vbnRoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1vbnRoID0gdGhpcy5tb250aCh7cmF3OiB0cnVlfSkubnVtZXJpYztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtb250aDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5leHBfeWVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGN1ck1vbnRoID0gbmV3IERhdGUoKS5nZXRNb250aCgpICsgMSxcbiAgICAgICAgICAgIGN1clllYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMueWVhcih7bWluOiAoKGN1ck1vbnRoID09PSAxMikgPyAoY3VyWWVhciArIDEpIDogY3VyWWVhciksIG1heDogKGN1clllYXIgKyAxMCl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS52YXQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBjb3VudHJ5OiAnaXQnIH0pO1xuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuY291bnRyeS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBjYXNlICdpdCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXRfdmF0KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgYSBzdHJpbmcgbWF0Y2hpbmcgSUJBTiBwYXR0ZXJuIChodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9JbnRlcm5hdGlvbmFsX0JhbmtfQWNjb3VudF9OdW1iZXIpLiBcbiAgICAgKiBObyBjb3VudHJ5LXNwZWNpZmljIGZvcm1hdHMgc3VwcG9ydCAoeWV0KVxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuaWJhbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFscGhhID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaJztcbiAgICAgICAgdmFyIGFscGhhbnVtID0gYWxwaGEgKyAnMDEyMzQ1Njc4OSc7XG4gICAgICAgIHZhciBpYmFuID0gXG4gICAgICAgICAgICB0aGlzLnN0cmluZyh7IGxlbmd0aDogMiwgcG9vbDogYWxwaGEgfSkgKyBcbiAgICAgICAgICAgIHRoaXMucGFkKHRoaXMuaW50ZWdlcih7IG1pbjogMCwgbWF4OiA5OSB9KSwgMikgKyBcbiAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgbGVuZ3RoOiA0LCBwb29sOiBhbHBoYW51bSB9KSArIFxuICAgICAgICAgICAgdGhpcy5wYWQodGhpcy5uYXR1cmFsKCksIHRoaXMubmF0dXJhbCh7IG1pbjogNiwgbWF4OiAyNiB9KSk7XG4gICAgICAgIHJldHVybiBpYmFuO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgRmluYW5jZVxuXG4gICAgLy8gLS0gUmVnaW9uYWxcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaXRfdmF0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgaXRfdmF0ID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogMTgwMDAwMH0pO1xuXG4gICAgICAgIGl0X3ZhdCA9IHRoaXMucGFkKGl0X3ZhdCwgNykgKyB0aGlzLnBhZCh0aGlzLnBpY2sodGhpcy5wcm92aW5jZXMoeyBjb3VudHJ5OiAnaXQnIH0pKS5jb2RlLCAzKTtcbiAgICAgICAgcmV0dXJuIGl0X3ZhdCArIHRoaXMubHVobl9jYWxjdWxhdGUoaXRfdmF0KTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAgKiB0aGlzIGdlbmVyYXRvciBpcyB3cml0dGVuIGZvbGxvd2luZyB0aGUgb2ZmaWNpYWwgYWxnb3JpdGhtXG4gICAgICogYWxsIGRhdGEgY2FuIGJlIHBhc3NlZCBleHBsaWNpdGVseSBvciByYW5kb21pemVkIGJ5IGNhbGxpbmcgY2hhbmNlLmNmKCkgd2l0aG91dCBvcHRpb25zXG4gICAgICogdGhlIGNvZGUgZG9lcyBub3QgY2hlY2sgdGhhdCB0aGUgaW5wdXQgZGF0YSBpcyB2YWxpZCAoaXQgZ29lcyBiZXlvbmQgdGhlIHNjb3BlIG9mIHRoZSBnZW5lcmF0b3IpXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIFtPYmplY3RdIG9wdGlvbnMgPSB7IGZpcnN0OiBmaXJzdCBuYW1lLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdDogbGFzdCBuYW1lLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZGVyOiBmZW1hbGV8bWFsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpcnRoZGF5OiBKYXZhU2NyaXB0IGRhdGUgb2JqZWN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2l0eTogc3RyaW5nKDQpLCAxIGxldHRlciArIDMgbnVtYmVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICogQHJldHVybiBbc3RyaW5nXSBjb2RpY2UgZmlzY2FsZVxuICAgICAqXG4gICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmNmID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIHZhciBnZW5kZXIgPSAhIW9wdGlvbnMuZ2VuZGVyID8gb3B0aW9ucy5nZW5kZXIgOiB0aGlzLmdlbmRlcigpLFxuICAgICAgICAgICAgZmlyc3QgPSAhIW9wdGlvbnMuZmlyc3QgPyBvcHRpb25zLmZpcnN0IDogdGhpcy5maXJzdCggeyBnZW5kZXI6IGdlbmRlciwgbmF0aW9uYWxpdHk6ICdpdCd9ICksXG4gICAgICAgICAgICBsYXN0ID0gISFvcHRpb25zLmxhc3QgPyBvcHRpb25zLmxhc3QgOiB0aGlzLmxhc3QoIHsgbmF0aW9uYWxpdHk6ICdpdCd9ICksXG4gICAgICAgICAgICBiaXJ0aGRheSA9ICEhb3B0aW9ucy5iaXJ0aGRheSA/IG9wdGlvbnMuYmlydGhkYXkgOiB0aGlzLmJpcnRoZGF5KCksXG4gICAgICAgICAgICBjaXR5ID0gISFvcHRpb25zLmNpdHkgPyBvcHRpb25zLmNpdHkgOiB0aGlzLnBpY2tvbmUoWydBJywgJ0InLCAnQycsICdEJywgJ0UnLCAnRicsICdHJywgJ0gnLCAnSScsICdMJywgJ00nLCAnWiddKSArIHRoaXMucGFkKHRoaXMubmF0dXJhbCh7bWF4Ojk5OX0pLCAzKSxcbiAgICAgICAgICAgIGNmID0gW10sXG4gICAgICAgICAgICBuYW1lX2dlbmVyYXRvciA9IGZ1bmN0aW9uKG5hbWUsIGlzTGFzdCkge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wLFxuICAgICAgICAgICAgICAgICAgICByZXR1cm5fdmFsdWUgPSBbXTtcblxuICAgICAgICAgICAgICAgIGlmIChuYW1lLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuX3ZhbHVlID0gbmFtZS5zcGxpdChcIlwiKS5jb25jYXQoXCJYWFhcIi5zcGxpdChcIlwiKSkuc3BsaWNlKDAsMyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZW1wID0gbmFtZS50b1VwcGVyQ2FzZSgpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24oYyl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFwiQkNERkdISktMTU5QUlNUVldaXCIuaW5kZXhPZihjKSAhPT0gLTEpID8gYyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfSkuam9pbignJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0xhc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gdGVtcC5zdWJzdHIoMCwzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcCA9IHRlbXBbMF0gKyB0ZW1wLnN1YnN0cigyLDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybl92YWx1ZSA9IHRlbXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gbmFtZS50b1VwcGVyQ2FzZSgpLnNwbGl0KCcnKS5tYXAoZnVuY3Rpb24oYyl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcIkFFSU9VXCIuaW5kZXhPZihjKSAhPT0gLTEpID8gYyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpLnN1YnN0cigwLCAzIC0gcmV0dXJuX3ZhbHVlLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuX3ZhbHVlID0gcmV0dXJuX3ZhbHVlICsgdGVtcDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0dXJuX3ZhbHVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRhdGVfZ2VuZXJhdG9yID0gZnVuY3Rpb24oYmlydGhkYXksIGdlbmRlciwgdGhhdCkge1xuICAgICAgICAgICAgICAgIHZhciBsZXR0ZXJtb250aHMgPSBbJ0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdIJywgJ0wnLCAnTScsICdQJywgJ1InLCAnUycsICdUJ107XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gIGJpcnRoZGF5LmdldEZ1bGxZZWFyKCkudG9TdHJpbmcoKS5zdWJzdHIoMikgK1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0dGVybW9udGhzW2JpcnRoZGF5LmdldE1vbnRoKCldICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGJpcnRoZGF5LmdldERhdGUoKSArICgoZ2VuZGVyLnRvTG93ZXJDYXNlKCkgPT09IFwiZmVtYWxlXCIpID8gNDAgOiAwKSwgMik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2hlY2tkaWdpdF9nZW5lcmF0b3IgPSBmdW5jdGlvbihjZikge1xuICAgICAgICAgICAgICAgIHZhciByYW5nZTEgPSBcIjAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWlwiLFxuICAgICAgICAgICAgICAgICAgICByYW5nZTIgPSBcIkFCQ0RFRkdISUpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWlwiLFxuICAgICAgICAgICAgICAgICAgICBldmVucyAgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaXCIsXG4gICAgICAgICAgICAgICAgICAgIG9kZHMgICA9IFwiQkFLUExDUURSRVZPU0ZUR1VITUlOSldaWVhcIixcbiAgICAgICAgICAgICAgICAgICAgZGlnaXQgID0gMDtcblxuXG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDE1OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgJSAyICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWdpdCArPSBldmVucy5pbmRleE9mKHJhbmdlMltyYW5nZTEuaW5kZXhPZihjZltpXSldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpZ2l0ICs9ICBvZGRzLmluZGV4T2YocmFuZ2UyW3JhbmdlMS5pbmRleE9mKGNmW2ldKV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBldmVuc1tkaWdpdCAlIDI2XTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgY2YgPSBjZi5jb25jYXQobmFtZV9nZW5lcmF0b3IobGFzdCwgdHJ1ZSksIG5hbWVfZ2VuZXJhdG9yKGZpcnN0KSwgZGF0ZV9nZW5lcmF0b3IoYmlydGhkYXksIGdlbmRlciwgdGhpcyksIGNpdHkudG9VcHBlckNhc2UoKS5zcGxpdChcIlwiKSkuam9pbihcIlwiKTtcbiAgICAgICAgY2YgKz0gY2hlY2tkaWdpdF9nZW5lcmF0b3IoY2YudG9VcHBlckNhc2UoKSwgdGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIGNmLnRvVXBwZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGxfcGVzZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBudW1iZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OTk5OTk5OTk5fSk7XG4gICAgICAgIHZhciBhcnIgPSB0aGlzLnBhZChudW1iZXIsIDEwKS5zcGxpdCgnJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcnJbaV0gPSBwYXJzZUludChhcnJbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnRyb2xOdW1iZXIgPSAoMSAqIGFyclswXSArIDMgKiBhcnJbMV0gKyA3ICogYXJyWzJdICsgOSAqIGFyclszXSArIDEgKiBhcnJbNF0gKyAzICogYXJyWzVdICsgNyAqIGFycls2XSArIDkgKiBhcnJbN10gKyAxICogYXJyWzhdICsgMyAqIGFycls5XSkgJSAxMDtcbiAgICAgICAgaWYoY29udHJvbE51bWJlciAhPT0gMCkge1xuICAgICAgICAgICAgY29udHJvbE51bWJlciA9IDEwIC0gY29udHJvbE51bWJlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnIuam9pbignJykgKyBjb250cm9sTnVtYmVyO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBsX25pcCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG51bWJlciA9IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDk5OTk5OTk5OX0pO1xuICAgICAgICB2YXIgYXJyID0gdGhpcy5wYWQobnVtYmVyLCA5KS5zcGxpdCgnJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcnJbaV0gPSBwYXJzZUludChhcnJbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnRyb2xOdW1iZXIgPSAoNiAqIGFyclswXSArIDUgKiBhcnJbMV0gKyA3ICogYXJyWzJdICsgMiAqIGFyclszXSArIDMgKiBhcnJbNF0gKyA0ICogYXJyWzVdICsgNSAqIGFycls2XSArIDYgKiBhcnJbN10gKyA3ICogYXJyWzhdKSAlIDExO1xuICAgICAgICBpZihjb250cm9sTnVtYmVyID09PSAxMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGxfbmlwKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyLmpvaW4oJycpICsgY29udHJvbE51bWJlcjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wbF9yZWdvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG51bWJlciA9IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDk5OTk5OTk5fSk7XG4gICAgICAgIHZhciBhcnIgPSB0aGlzLnBhZChudW1iZXIsIDgpLnNwbGl0KCcnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFycltpXSA9IHBhcnNlSW50KGFycltpXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY29udHJvbE51bWJlciA9ICg4ICogYXJyWzBdICsgOSAqIGFyclsxXSArIDIgKiBhcnJbMl0gKyAzICogYXJyWzNdICsgNCAqIGFycls0XSArIDUgKiBhcnJbNV0gKyA2ICogYXJyWzZdICsgNyAqIGFycls3XSkgJSAxMTtcbiAgICAgICAgaWYoY29udHJvbE51bWJlciA9PT0gMTApIHtcbiAgICAgICAgICAgIGNvbnRyb2xOdW1iZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFyci5qb2luKCcnKSArIGNvbnRyb2xOdW1iZXI7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBSZWdpb25hbFxuXG4gICAgLy8gLS0gTWlzY2VsbGFuZW91cyAtLVxuXG4gICAgLy8gRGljZSAtIEZvciBhbGwgdGhlIGJvYXJkIGdhbWUgZ2Vla3Mgb3V0IHRoZXJlLCBteXNlbGYgaW5jbHVkZWQgOylcbiAgICBmdW5jdGlvbiBkaWNlRm4gKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHJhbmdlKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kNCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDR9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQ2ID0gZGljZUZuKHttaW46IDEsIG1heDogNn0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDggPSBkaWNlRm4oe21pbjogMSwgbWF4OiA4fSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMTAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAxMH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDEyID0gZGljZUZuKHttaW46IDEsIG1heDogMTJ9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQyMCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDIwfSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMzAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAzMH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDEwMCA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDEwMH0pO1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ycGcgPSBmdW5jdGlvbiAodGhyb3duLCBvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgaWYgKCF0aHJvd24pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQSB0eXBlIG9mIGRpZSByb2xsIG11c3QgYmUgaW5jbHVkZWRcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYml0cyA9IHRocm93bi50b0xvd2VyQ2FzZSgpLnNwbGl0KFwiZFwiKSxcbiAgICAgICAgICAgICAgICByb2xscyA9IFtdO1xuXG4gICAgICAgICAgICBpZiAoYml0cy5sZW5ndGggIT09IDIgfHwgIXBhcnNlSW50KGJpdHNbMF0sIDEwKSB8fCAhcGFyc2VJbnQoYml0c1sxXSwgMTApKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmb3JtYXQgcHJvdmlkZWQuIFBsZWFzZSBwcm92aWRlICNkIyB3aGVyZSB0aGUgZmlyc3QgIyBpcyB0aGUgbnVtYmVyIG9mIGRpY2UgdG8gcm9sbCwgdGhlIHNlY29uZCAjIGlzIHRoZSBtYXggb2YgZWFjaCBkaWVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gYml0c1swXTsgaSA+IDA7IGktLSkge1xuICAgICAgICAgICAgICAgIHJvbGxzW2kgLSAxXSA9IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IGJpdHNbMV19KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAodHlwZW9mIG9wdGlvbnMuc3VtICE9PSAndW5kZWZpbmVkJyAmJiBvcHRpb25zLnN1bSkgPyByb2xscy5yZWR1Y2UoZnVuY3Rpb24gKHAsIGMpIHsgcmV0dXJuIHAgKyBjOyB9KSA6IHJvbGxzO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEd1aWRcbiAgICBDaGFuY2UucHJvdG90eXBlLmd1aWQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyB2ZXJzaW9uOiA1IH0pO1xuXG4gICAgICAgIHZhciBndWlkX3Bvb2wgPSBcImFiY2RlZjEyMzQ1Njc4OTBcIixcbiAgICAgICAgICAgIHZhcmlhbnRfcG9vbCA9IFwiYWI4OVwiLFxuICAgICAgICAgICAgZ3VpZCA9IHRoaXMuc3RyaW5nKHsgcG9vbDogZ3VpZF9wb29sLCBsZW5ndGg6IDggfSkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgcG9vbDogZ3VpZF9wb29sLCBsZW5ndGg6IDQgfSkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgIC8vIFRoZSBWZXJzaW9uXG4gICAgICAgICAgICAgICAgICAgb3B0aW9ucy52ZXJzaW9uICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiAzIH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICAvLyBUaGUgVmFyaWFudFxuICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgcG9vbDogdmFyaWFudF9wb29sLCBsZW5ndGg6IDEgfSkgK1xuICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgcG9vbDogZ3VpZF9wb29sLCBsZW5ndGg6IDMgfSkgKyAnLScgK1xuICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyaW5nKHsgcG9vbDogZ3VpZF9wb29sLCBsZW5ndGg6IDEyIH0pO1xuICAgICAgICByZXR1cm4gZ3VpZDtcbiAgICB9O1xuXG4gICAgLy8gSGFzaFxuICAgIENoYW5jZS5wcm90b3R5cGUuaGFzaCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bGVuZ3RoIDogNDAsIGNhc2luZzogJ2xvd2VyJ30pO1xuICAgICAgICB2YXIgcG9vbCA9IG9wdGlvbnMuY2FzaW5nID09PSAndXBwZXInID8gSEVYX1BPT0wudG9VcHBlckNhc2UoKSA6IEhFWF9QT09MO1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmcoe3Bvb2w6IHBvb2wsIGxlbmd0aDogb3B0aW9ucy5sZW5ndGh9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sdWhuX2NoZWNrID0gZnVuY3Rpb24gKG51bSkge1xuICAgICAgICB2YXIgc3RyID0gbnVtLnRvU3RyaW5nKCk7XG4gICAgICAgIHZhciBjaGVja0RpZ2l0ID0gK3N0ci5zdWJzdHJpbmcoc3RyLmxlbmd0aCAtIDEpO1xuICAgICAgICByZXR1cm4gY2hlY2tEaWdpdCA9PT0gdGhpcy5sdWhuX2NhbGN1bGF0ZSgrc3RyLnN1YnN0cmluZygwLCBzdHIubGVuZ3RoIC0gMSkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmx1aG5fY2FsY3VsYXRlID0gZnVuY3Rpb24gKG51bSkge1xuICAgICAgICB2YXIgZGlnaXRzID0gbnVtLnRvU3RyaW5nKCkuc3BsaXQoXCJcIikucmV2ZXJzZSgpO1xuICAgICAgICB2YXIgc3VtID0gMDtcbiAgICAgICAgdmFyIGRpZ2l0O1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGlnaXRzLmxlbmd0aDsgbCA+IGk7ICsraSkge1xuICAgICAgICAgICAgZGlnaXQgPSArZGlnaXRzW2ldO1xuICAgICAgICAgICAgaWYgKGkgJSAyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZGlnaXQgKj0gMjtcbiAgICAgICAgICAgICAgICBpZiAoZGlnaXQgPiA5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZ2l0IC09IDk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3VtICs9IGRpZ2l0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoc3VtICogOSkgJSAxMDtcbiAgICB9O1xuXG4gICAgLy8gTUQ1IEhhc2hcbiAgICBDaGFuY2UucHJvdG90eXBlLm1kNSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7IHN0cjogJycsIGtleTogbnVsbCwgcmF3OiBmYWxzZSB9O1xuXG4gICAgICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICAgICAgb3B0cy5zdHIgPSB0aGlzLnN0cmluZygpO1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgb3B0cy5zdHIgPSBvcHRpb25zO1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLmNvbnN0cnVjdG9yID09PSAnQXJyYXknKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdHMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCBvcHRzKTtcblxuICAgICAgICBpZighb3B0cy5zdHIpe1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIHBhcmFtZXRlciBpcyByZXF1aXJlZCB0byByZXR1cm4gYW4gbWQ1IGhhc2guJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5iaW1kNS5tZDUob3B0cy5zdHIsIG9wdHMua2V5LCBvcHRzLnJhdyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICNEZXNjcmlwdGlvbjpcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIEdlbmVyYXRlIHJhbmRvbSBmaWxlIG5hbWUgd2l0aCBleHRlbnNpb25cbiAgICAgKlxuICAgICAqIFRoZSBhcmd1bWVudCBwcm92aWRlIGV4dGVuc2lvbiB0eXBlXG4gICAgICogLT4gcmFzdGVyXG4gICAgICogLT4gdmVjdG9yXG4gICAgICogLT4gM2RcbiAgICAgKiAtPiBkb2N1bWVudFxuICAgICAqXG4gICAgICogSWYgbm90aGluZyBpcyBwcm92aWRlZCB0aGUgZnVuY3Rpb24gcmV0dXJuIHJhbmRvbSBmaWxlIG5hbWUgd2l0aCByYW5kb21cbiAgICAgKiBleHRlbnNpb24gdHlwZSBvZiBhbnkga2luZFxuICAgICAqXG4gICAgICogVGhlIHVzZXIgY2FuIHZhbGlkYXRlIHRoZSBmaWxlIG5hbWUgbGVuZ3RoIHJhbmdlXG4gICAgICogSWYgbm90aGluZyBwcm92aWRlZCB0aGUgZ2VuZXJhdGVkIGZpbGUgbmFtZSBpcyByYW5kb21cbiAgICAgKlxuICAgICAqICNFeHRlbnNpb24gUG9vbCA6XG4gICAgICogKiBDdXJyZW50bHkgdGhlIHN1cHBvcnRlZCBleHRlbnNpb25zIGFyZVxuICAgICAqICAtPiBzb21lIG9mIHRoZSBtb3N0IHBvcHVsYXIgcmFzdGVyIGltYWdlIGV4dGVuc2lvbnNcbiAgICAgKiAgLT4gc29tZSBvZiB0aGUgbW9zdCBwb3B1bGFyIHZlY3RvciBpbWFnZSBleHRlbnNpb25zXG4gICAgICogIC0+IHNvbWUgb2YgdGhlIG1vc3QgcG9wdWxhciAzZCBpbWFnZSBleHRlbnNpb25zXG4gICAgICogIC0+IHNvbWUgb2YgdGhlIG1vc3QgcG9wdWxhciBkb2N1bWVudCBleHRlbnNpb25zXG4gICAgICpcbiAgICAgKiAjRXhhbXBsZXMgOlxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICpcbiAgICAgKiBSZXR1cm4gcmFuZG9tIGZpbGUgbmFtZSB3aXRoIHJhbmRvbSBleHRlbnNpb24uIFRoZSBmaWxlIGV4dGVuc2lvblxuICAgICAqIGlzIHByb3ZpZGVkIGJ5IGEgcHJlZGVmaW5lZCBjb2xsZWN0aW9uIG9mIGV4dGVuc2lvbnMuIE1vcmUgYWJvdXQgdGhlIGV4dGVuc2lvblxuICAgICAqIHBvb2wgY2FuIGJlIGZvdW5kIGluICNFeHRlbnNpb24gUG9vbCBzZWN0aW9uXG4gICAgICpcbiAgICAgKiBjaGFuY2UuZmlsZSgpXG4gICAgICogPT4gZHNmc2RoamYueG1sXG4gICAgICpcbiAgICAgKiBJbiBvcmRlciB0byBnZW5lcmF0ZSBhIGZpbGUgbmFtZSB3aXRoIHNwZWNpZmljIGxlbmd0aCwgc3BlY2lmeSB0aGVcbiAgICAgKiBsZW5ndGggcHJvcGVydHkgYW5kIGludGVnZXIgdmFsdWUuIFRoZSBleHRlbnNpb24gaXMgZ29pbmcgdG8gYmUgcmFuZG9tXG4gICAgICpcbiAgICAgKiBjaGFuY2UuZmlsZSh7bGVuZ3RoIDogMTB9KVxuICAgICAqID0+IGFzcnRpbmVxb3MucGRmXG4gICAgICpcbiAgICAgKiBJbiBvcmRlciB0byBnZW5lcmF0ZSBmaWxlIHdpdGggZXh0ZW5zaW9uIGZyb20gc29tZSBvZiB0aGUgcHJlZGVmaW5lZCBncm91cHNcbiAgICAgKiBvZiB0aGUgZXh0ZW5zaW9uIHBvb2wganVzdCBzcGVjaWZ5IHRoZSBleHRlbnNpb24gcG9vbCBjYXRlZ29yeSBpbiBmaWxlVHlwZSBwcm9wZXJ0eVxuICAgICAqXG4gICAgICogY2hhbmNlLmZpbGUoe2ZpbGVUeXBlIDogJ3Jhc3Rlcid9KVxuICAgICAqID0+IGRzaGdzc2RzLnBzZFxuICAgICAqXG4gICAgICogWW91IGNhbiBwcm92aWRlIHNwZWNpZmljIGV4dGVuc2lvbiBmb3IgeW91ciBmaWxlc1xuICAgICAqIGNoYW5jZS5maWxlKHtleHRlbnNpb24gOiAnaHRtbCd9KVxuICAgICAqID0+IGRqZnNkLmh0bWxcbiAgICAgKlxuICAgICAqIE9yIHlvdSBjb3VsZCBwYXNzIGN1c3RvbSBjb2xsZWN0aW9uIG9mIGV4dGVuc2lvbnMgYnkgYXJyYXkgb3IgYnkgb2JqZWN0XG4gICAgICogY2hhbmNlLmZpbGUoe2V4dGVuc2lvbnMgOiBbLi4uXX0pXG4gICAgICogPT4gZGhnc2RzZC5wc2RcbiAgICAgKlxuICAgICAqIGNoYW5jZS5maWxlKHtleHRlbnNpb25zIDogeyBrZXkgOiBbLi4uXSwga2V5IDogWy4uLl19fSlcbiAgICAgKiA9PiBkanNma3NkanNkLnhtbFxuICAgICAqXG4gICAgICogQHBhcmFtICBbY29sbGVjdGlvbl0gb3B0aW9uc1xuICAgICAqIEByZXR1cm4gW3N0cmluZ11cbiAgICAgKlxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuZmlsZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcblxuICAgICAgICB2YXIgZmlsZU9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB2YXIgcG9vbENvbGxlY3Rpb25LZXkgPSBcImZpbGVFeHRlbnNpb25cIjtcbiAgICAgICAgdmFyIHR5cGVSYW5nZSAgID0gT2JqZWN0LmtleXModGhpcy5nZXQoXCJmaWxlRXh0ZW5zaW9uXCIpKTsvL1sncmFzdGVyJywgJ3ZlY3RvcicsICczZCcsICdkb2N1bWVudCddO1xuICAgICAgICB2YXIgZmlsZU5hbWU7XG4gICAgICAgIHZhciBmaWxlRXh0ZW5zaW9uO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlIHJhbmRvbSBmaWxlIG5hbWVcbiAgICAgICAgZmlsZU5hbWUgPSB0aGlzLndvcmQoe2xlbmd0aCA6IGZpbGVPcHRpb25zLmxlbmd0aH0pO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlIGZpbGUgYnkgc3BlY2lmaWMgZXh0ZW5zaW9uIHByb3ZpZGVkIGJ5IHRoZSB1c2VyXG4gICAgICAgIGlmKGZpbGVPcHRpb25zLmV4dGVuc2lvbikge1xuXG4gICAgICAgICAgICBmaWxlRXh0ZW5zaW9uID0gZmlsZU9wdGlvbnMuZXh0ZW5zaW9uO1xuICAgICAgICAgICAgcmV0dXJuIChmaWxlTmFtZSArICcuJyArIGZpbGVFeHRlbnNpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgZmlsZSBieSBzcGVjaWZpYyBleHRlbnNpb24gY29sbGVjdGlvblxuICAgICAgICBpZihmaWxlT3B0aW9ucy5leHRlbnNpb25zKSB7XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoZmlsZU9wdGlvbnMuZXh0ZW5zaW9ucykpIHtcblxuICAgICAgICAgICAgICAgIGZpbGVFeHRlbnNpb24gPSB0aGlzLnBpY2tvbmUoZmlsZU9wdGlvbnMuZXh0ZW5zaW9ucyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChmaWxlTmFtZSArICcuJyArIGZpbGVFeHRlbnNpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZihmaWxlT3B0aW9ucy5leHRlbnNpb25zLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcblxuICAgICAgICAgICAgICAgIHZhciBleHRlbnNpb25PYmplY3RDb2xsZWN0aW9uID0gZmlsZU9wdGlvbnMuZXh0ZW5zaW9ucztcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGV4dGVuc2lvbk9iamVjdENvbGxlY3Rpb24pO1xuXG4gICAgICAgICAgICAgICAgZmlsZUV4dGVuc2lvbiA9IHRoaXMucGlja29uZShleHRlbnNpb25PYmplY3RDb2xsZWN0aW9uW3RoaXMucGlja29uZShrZXlzKV0pO1xuICAgICAgICAgICAgICAgIHJldHVybiAoZmlsZU5hbWUgKyAnLicgKyBmaWxlRXh0ZW5zaW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0IGNvbGxlY3Rpb24gb2YgdHlwZSBBcnJheSBvciBPYmplY3QgdG8gYmUgcGFzc2VkIGFzIGFuIGFyZ3VtZW50IFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIGZpbGUgZXh0ZW5zaW9uIGJhc2VkIG9uIHNwZWNpZmljIGZpbGUgdHlwZVxuICAgICAgICBpZihmaWxlT3B0aW9ucy5maWxlVHlwZSkge1xuXG4gICAgICAgICAgICB2YXIgZmlsZVR5cGUgPSBmaWxlT3B0aW9ucy5maWxlVHlwZTtcbiAgICAgICAgICAgIGlmKHR5cGVSYW5nZS5pbmRleE9mKGZpbGVUeXBlKSAhPT0gLTEpIHtcblxuICAgICAgICAgICAgICAgIGZpbGVFeHRlbnNpb24gPSB0aGlzLnBpY2tvbmUodGhpcy5nZXQocG9vbENvbGxlY3Rpb25LZXkpW2ZpbGVUeXBlXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChmaWxlTmFtZSArICcuJyArIGZpbGVFeHRlbnNpb24pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3QgZmlsZSB0eXBlIHZhbHVlIHRvIGJlICdyYXN0ZXInLCAndmVjdG9yJywgJzNkJyBvciAnZG9jdW1lbnQnIFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHJhbmRvbSBmaWxlIG5hbWUgaWYgbm8gZXh0ZW5zaW9uIG9wdGlvbnMgYXJlIHBhc3NlZFxuICAgICAgICBmaWxlRXh0ZW5zaW9uID0gdGhpcy5waWNrb25lKHRoaXMuZ2V0KHBvb2xDb2xsZWN0aW9uS2V5KVt0aGlzLnBpY2tvbmUodHlwZVJhbmdlKV0pO1xuICAgICAgICByZXR1cm4gKGZpbGVOYW1lICsgJy4nICsgZmlsZUV4dGVuc2lvbik7XG4gICAgfTtcblxuICAgIHZhciBkYXRhID0ge1xuXG4gICAgICAgIGZpcnN0TmFtZXM6IHtcbiAgICAgICAgICAgIFwibWFsZVwiOiB7XG4gICAgICAgICAgICAgICAgXCJlblwiOiBbXCJKYW1lc1wiLCBcIkpvaG5cIiwgXCJSb2JlcnRcIiwgXCJNaWNoYWVsXCIsIFwiV2lsbGlhbVwiLCBcIkRhdmlkXCIsIFwiUmljaGFyZFwiLCBcIkpvc2VwaFwiLCBcIkNoYXJsZXNcIiwgXCJUaG9tYXNcIiwgXCJDaHJpc3RvcGhlclwiLCBcIkRhbmllbFwiLCBcIk1hdHRoZXdcIiwgXCJHZW9yZ2VcIiwgXCJEb25hbGRcIiwgXCJBbnRob255XCIsIFwiUGF1bFwiLCBcIk1hcmtcIiwgXCJFZHdhcmRcIiwgXCJTdGV2ZW5cIiwgXCJLZW5uZXRoXCIsIFwiQW5kcmV3XCIsIFwiQnJpYW5cIiwgXCJKb3NodWFcIiwgXCJLZXZpblwiLCBcIlJvbmFsZFwiLCBcIlRpbW90aHlcIiwgXCJKYXNvblwiLCBcIkplZmZyZXlcIiwgXCJGcmFua1wiLCBcIkdhcnlcIiwgXCJSeWFuXCIsIFwiTmljaG9sYXNcIiwgXCJFcmljXCIsIFwiU3RlcGhlblwiLCBcIkphY29iXCIsIFwiTGFycnlcIiwgXCJKb25hdGhhblwiLCBcIlNjb3R0XCIsIFwiUmF5bW9uZFwiLCBcIkp1c3RpblwiLCBcIkJyYW5kb25cIiwgXCJHcmVnb3J5XCIsIFwiU2FtdWVsXCIsIFwiQmVuamFtaW5cIiwgXCJQYXRyaWNrXCIsIFwiSmFja1wiLCBcIkhlbnJ5XCIsIFwiV2FsdGVyXCIsIFwiRGVubmlzXCIsIFwiSmVycnlcIiwgXCJBbGV4YW5kZXJcIiwgXCJQZXRlclwiLCBcIlR5bGVyXCIsIFwiRG91Z2xhc1wiLCBcIkhhcm9sZFwiLCBcIkFhcm9uXCIsIFwiSm9zZVwiLCBcIkFkYW1cIiwgXCJBcnRodXJcIiwgXCJaYWNoYXJ5XCIsIFwiQ2FybFwiLCBcIk5hdGhhblwiLCBcIkFsYmVydFwiLCBcIkt5bGVcIiwgXCJMYXdyZW5jZVwiLCBcIkpvZVwiLCBcIldpbGxpZVwiLCBcIkdlcmFsZFwiLCBcIlJvZ2VyXCIsIFwiS2VpdGhcIiwgXCJKZXJlbXlcIiwgXCJUZXJyeVwiLCBcIkhhcnJ5XCIsIFwiUmFscGhcIiwgXCJTZWFuXCIsIFwiSmVzc2VcIiwgXCJSb3lcIiwgXCJMb3Vpc1wiLCBcIkJpbGx5XCIsIFwiQXVzdGluXCIsIFwiQnJ1Y2VcIiwgXCJFdWdlbmVcIiwgXCJDaHJpc3RpYW5cIiwgXCJCcnlhblwiLCBcIldheW5lXCIsIFwiUnVzc2VsbFwiLCBcIkhvd2FyZFwiLCBcIkZyZWRcIiwgXCJFdGhhblwiLCBcIkpvcmRhblwiLCBcIlBoaWxpcFwiLCBcIkFsYW5cIiwgXCJKdWFuXCIsIFwiUmFuZHlcIiwgXCJWaW5jZW50XCIsIFwiQm9iYnlcIiwgXCJEeWxhblwiLCBcIkpvaG5ueVwiLCBcIlBoaWxsaXBcIiwgXCJWaWN0b3JcIiwgXCJDbGFyZW5jZVwiLCBcIkVybmVzdFwiLCBcIk1hcnRpblwiLCBcIkNyYWlnXCIsIFwiU3RhbmxleVwiLCBcIlNoYXduXCIsIFwiVHJhdmlzXCIsIFwiQnJhZGxleVwiLCBcIkxlb25hcmRcIiwgXCJFYXJsXCIsIFwiR2FicmllbFwiLCBcIkppbW15XCIsIFwiRnJhbmNpc1wiLCBcIlRvZGRcIiwgXCJOb2FoXCIsIFwiRGFubnlcIiwgXCJEYWxlXCIsIFwiQ29keVwiLCBcIkNhcmxvc1wiLCBcIkFsbGVuXCIsIFwiRnJlZGVyaWNrXCIsIFwiTG9nYW5cIiwgXCJDdXJ0aXNcIiwgXCJBbGV4XCIsIFwiSm9lbFwiLCBcIkx1aXNcIiwgXCJOb3JtYW5cIiwgXCJNYXJ2aW5cIiwgXCJHbGVublwiLCBcIlRvbnlcIiwgXCJOYXRoYW5pZWxcIiwgXCJSb2RuZXlcIiwgXCJNZWx2aW5cIiwgXCJBbGZyZWRcIiwgXCJTdGV2ZVwiLCBcIkNhbWVyb25cIiwgXCJDaGFkXCIsIFwiRWR3aW5cIiwgXCJDYWxlYlwiLCBcIkV2YW5cIiwgXCJBbnRvbmlvXCIsIFwiTGVlXCIsIFwiSGVyYmVydFwiLCBcIkplZmZlcnlcIiwgXCJJc2FhY1wiLCBcIkRlcmVrXCIsIFwiUmlja3lcIiwgXCJNYXJjdXNcIiwgXCJUaGVvZG9yZVwiLCBcIkVsaWphaFwiLCBcIkx1a2VcIiwgXCJKZXN1c1wiLCBcIkVkZGllXCIsIFwiVHJveVwiLCBcIk1pa2VcIiwgXCJEdXN0aW5cIiwgXCJSYXlcIiwgXCJBZHJpYW5cIiwgXCJCZXJuYXJkXCIsIFwiTGVyb3lcIiwgXCJBbmdlbFwiLCBcIlJhbmRhbGxcIiwgXCJXZXNsZXlcIiwgXCJJYW5cIiwgXCJKYXJlZFwiLCBcIk1hc29uXCIsIFwiSHVudGVyXCIsIFwiQ2FsdmluXCIsIFwiT3NjYXJcIiwgXCJDbGlmZm9yZFwiLCBcIkpheVwiLCBcIlNoYW5lXCIsIFwiUm9ubmllXCIsIFwiQmFycnlcIiwgXCJMdWNhc1wiLCBcIkNvcmV5XCIsIFwiTWFudWVsXCIsIFwiTGVvXCIsIFwiVG9tbXlcIiwgXCJXYXJyZW5cIiwgXCJKYWNrc29uXCIsIFwiSXNhaWFoXCIsIFwiQ29ubm9yXCIsIFwiRG9uXCIsIFwiRGVhblwiLCBcIkpvblwiLCBcIkp1bGlhblwiLCBcIk1pZ3VlbFwiLCBcIkJpbGxcIiwgXCJMbG95ZFwiLCBcIkNoYXJsaWVcIiwgXCJNaXRjaGVsbFwiLCBcIkxlb25cIiwgXCJKZXJvbWVcIiwgXCJEYXJyZWxsXCIsIFwiSmVyZW1pYWhcIiwgXCJBbHZpblwiLCBcIkJyZXR0XCIsIFwiU2V0aFwiLCBcIkZsb3lkXCIsIFwiSmltXCIsIFwiQmxha2VcIiwgXCJNaWNoZWFsXCIsIFwiR29yZG9uXCIsIFwiVHJldm9yXCIsIFwiTGV3aXNcIiwgXCJFcmlrXCIsIFwiRWRnYXJcIiwgXCJWZXJub25cIiwgXCJEZXZpblwiLCBcIkdhdmluXCIsIFwiSmF5ZGVuXCIsIFwiQ2hyaXNcIiwgXCJDbHlkZVwiLCBcIlRvbVwiLCBcIkRlcnJpY2tcIiwgXCJNYXJpb1wiLCBcIkJyZW50XCIsIFwiTWFyY1wiLCBcIkhlcm1hblwiLCBcIkNoYXNlXCIsIFwiRG9taW5pY1wiLCBcIlJpY2FyZG9cIiwgXCJGcmFua2xpblwiLCBcIk1hdXJpY2VcIiwgXCJNYXhcIiwgXCJBaWRlblwiLCBcIk93ZW5cIiwgXCJMZXN0ZXJcIiwgXCJHaWxiZXJ0XCIsIFwiRWxtZXJcIiwgXCJHZW5lXCIsIFwiRnJhbmNpc2NvXCIsIFwiR2xlblwiLCBcIkNvcnlcIiwgXCJHYXJyZXR0XCIsIFwiQ2xheXRvblwiLCBcIlNhbVwiLCBcIkpvcmdlXCIsIFwiQ2hlc3RlclwiLCBcIkFsZWphbmRyb1wiLCBcIkplZmZcIiwgXCJIYXJ2ZXlcIiwgXCJNaWx0b25cIiwgXCJDb2xlXCIsIFwiSXZhblwiLCBcIkFuZHJlXCIsIFwiRHVhbmVcIiwgXCJMYW5kb25cIl0sXG4gICAgICAgICAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHA6Ly93d3cuZGF0aS5nb3YuaXQvZGF0YXNldC9jb211bmUtZGktZmlyZW56ZV8wMTYzXG4gICAgICAgICAgICAgICAgXCJpdFwiOiBbXCJBZG9sZm9cIiwgXCJBbGJlcnRvXCIsIFwiQWxkb1wiLCBcIkFsZXNzYW5kcm9cIiwgXCJBbGVzc2lvXCIsIFwiQWxmcmVkb1wiLCBcIkFsdmFyb1wiLCBcIkFuZHJlYVwiLCBcIkFuZ2Vsb1wiLCBcIkFuZ2lvbG9cIiwgXCJBbnRvbmlub1wiLCBcIkFudG9uaW9cIiwgXCJBdHRpbGlvXCIsIFwiQmVuaXRvXCIsIFwiQmVybmFyZG9cIiwgXCJCcnVub1wiLCBcIkNhcmxvXCIsIFwiQ2VzYXJlXCIsIFwiQ2hyaXN0aWFuXCIsIFwiQ2xhdWRpb1wiLCBcIkNvcnJhZG9cIiwgXCJDb3NpbW9cIiwgXCJDcmlzdGlhblwiLCBcIkNyaXN0aWFub1wiLCBcIkRhbmllbGVcIiwgXCJEYXJpb1wiLCBcIkRhdmlkXCIsIFwiRGF2aWRlXCIsIFwiRGllZ29cIiwgXCJEaW5vXCIsIFwiRG9tZW5pY29cIiwgXCJEdWNjaW9cIiwgXCJFZG9hcmRvXCIsIFwiRWxpYVwiLCBcIkVsaW9cIiwgXCJFbWFudWVsZVwiLCBcIkVtaWxpYW5vXCIsIFwiRW1pbGlvXCIsIFwiRW5yaWNvXCIsIFwiRW56b1wiLCBcIkV0dG9yZVwiLCBcIkZhYmlvXCIsIFwiRmFicml6aW9cIiwgXCJGZWRlcmljb1wiLCBcIkZlcmRpbmFuZG9cIiwgXCJGZXJuYW5kb1wiLCBcIkZpbGlwcG9cIiwgXCJGcmFuY2VzY29cIiwgXCJGcmFuY29cIiwgXCJHYWJyaWVsZVwiLCBcIkdpYWNvbW9cIiwgXCJHaWFtcGFvbG9cIiwgXCJHaWFtcGllcm9cIiwgXCJHaWFuY2FybG9cIiwgXCJHaWFuZnJhbmNvXCIsIFwiR2lhbmx1Y2FcIiwgXCJHaWFubWFyY29cIiwgXCJHaWFubmlcIiwgXCJHaW5vXCIsIFwiR2lvcmdpb1wiLCBcIkdpb3Zhbm5pXCIsIFwiR2l1bGlhbm9cIiwgXCJHaXVsaW9cIiwgXCJHaXVzZXBwZVwiLCBcIkdyYXppYW5vXCIsIFwiR3JlZ29yaW9cIiwgXCJHdWlkb1wiLCBcIklhY29wb1wiLCBcIkphY29wb1wiLCBcIkxhcG9cIiwgXCJMZW9uYXJkb1wiLCBcIkxvcmVuem9cIiwgXCJMdWNhXCIsIFwiTHVjaWFub1wiLCBcIkx1aWdpXCIsIFwiTWFudWVsXCIsIFwiTWFyY2VsbG9cIiwgXCJNYXJjb1wiLCBcIk1hcmlub1wiLCBcIk1hcmlvXCIsIFwiTWFzc2ltaWxpYW5vXCIsIFwiTWFzc2ltb1wiLCBcIk1hdHRlb1wiLCBcIk1hdHRpYVwiLCBcIk1hdXJpemlvXCIsIFwiTWF1cm9cIiwgXCJNaWNoZWxlXCIsIFwiTWlya29cIiwgXCJNb2hhbWVkXCIsIFwiTmVsbG9cIiwgXCJOZXJpXCIsIFwiTmljY29sw7JcIiwgXCJOaWNvbGFcIiwgXCJPc3ZhbGRvXCIsIFwiT3RlbGxvXCIsIFwiUGFvbG9cIiwgXCJQaWVyIEx1aWdpXCIsIFwiUGllcm9cIiwgXCJQaWV0cm9cIiwgXCJSYWZmYWVsZVwiLCBcIlJlbW9cIiwgXCJSZW5hdG9cIiwgXCJSZW56b1wiLCBcIlJpY2NhcmRvXCIsIFwiUm9iZXJ0b1wiLCBcIlJvbGFuZG9cIiwgXCJSb21hbm9cIiwgXCJTYWx2YXRvcmVcIiwgXCJTYW11ZWxlXCIsIFwiU2FuZHJvXCIsIFwiU2VyZ2lvXCIsIFwiU2lsdmFub1wiLCBcIlNpbW9uZVwiLCBcIlN0ZWZhbm9cIiwgXCJUaG9tYXNcIiwgXCJUb21tYXNvXCIsIFwiVWJhbGRvXCIsIFwiVWdvXCIsIFwiVW1iZXJ0b1wiLCBcIlZhbGVyaW9cIiwgXCJWYWx0ZXJcIiwgXCJWYXNjb1wiLCBcIlZpbmNlbnpvXCIsIFwiVml0dG9yaW9cIl1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcImZlbWFsZVwiOiB7XG4gICAgICAgICAgICAgICAgXCJlblwiOiBbXCJNYXJ5XCIsIFwiRW1tYVwiLCBcIkVsaXphYmV0aFwiLCBcIk1pbm5pZVwiLCBcIk1hcmdhcmV0XCIsIFwiSWRhXCIsIFwiQWxpY2VcIiwgXCJCZXJ0aGFcIiwgXCJTYXJhaFwiLCBcIkFubmllXCIsIFwiQ2xhcmFcIiwgXCJFbGxhXCIsIFwiRmxvcmVuY2VcIiwgXCJDb3JhXCIsIFwiTWFydGhhXCIsIFwiTGF1cmFcIiwgXCJOZWxsaWVcIiwgXCJHcmFjZVwiLCBcIkNhcnJpZVwiLCBcIk1hdWRlXCIsIFwiTWFiZWxcIiwgXCJCZXNzaWVcIiwgXCJKZW5uaWVcIiwgXCJHZXJ0cnVkZVwiLCBcIkp1bGlhXCIsIFwiSGF0dGllXCIsIFwiRWRpdGhcIiwgXCJNYXR0aWVcIiwgXCJSb3NlXCIsIFwiQ2F0aGVyaW5lXCIsIFwiTGlsbGlhblwiLCBcIkFkYVwiLCBcIkxpbGxpZVwiLCBcIkhlbGVuXCIsIFwiSmVzc2llXCIsIFwiTG91aXNlXCIsIFwiRXRoZWxcIiwgXCJMdWxhXCIsIFwiTXlydGxlXCIsIFwiRXZhXCIsIFwiRnJhbmNlc1wiLCBcIkxlbmFcIiwgXCJMdWN5XCIsIFwiRWRuYVwiLCBcIk1hZ2dpZVwiLCBcIlBlYXJsXCIsIFwiRGFpc3lcIiwgXCJGYW5uaWVcIiwgXCJKb3NlcGhpbmVcIiwgXCJEb3JhXCIsIFwiUm9zYVwiLCBcIkthdGhlcmluZVwiLCBcIkFnbmVzXCIsIFwiTWFyaWVcIiwgXCJOb3JhXCIsIFwiTWF5XCIsIFwiTWFtaWVcIiwgXCJCbGFuY2hlXCIsIFwiU3RlbGxhXCIsIFwiRWxsZW5cIiwgXCJOYW5jeVwiLCBcIkVmZmllXCIsIFwiU2FsbGllXCIsIFwiTmV0dGllXCIsIFwiRGVsbGFcIiwgXCJMaXp6aWVcIiwgXCJGbG9yYVwiLCBcIlN1c2llXCIsIFwiTWF1ZFwiLCBcIk1hZVwiLCBcIkV0dGFcIiwgXCJIYXJyaWV0XCIsIFwiU2FkaWVcIiwgXCJDYXJvbGluZVwiLCBcIkthdGllXCIsIFwiTHlkaWFcIiwgXCJFbHNpZVwiLCBcIkthdGVcIiwgXCJTdXNhblwiLCBcIk1vbGxpZVwiLCBcIkFsbWFcIiwgXCJBZGRpZVwiLCBcIkdlb3JnaWFcIiwgXCJFbGl6YVwiLCBcIkx1bHVcIiwgXCJOYW5uaWVcIiwgXCJMb3R0aWVcIiwgXCJBbWFuZGFcIiwgXCJCZWxsZVwiLCBcIkNoYXJsb3R0ZVwiLCBcIlJlYmVjY2FcIiwgXCJSdXRoXCIsIFwiVmlvbGFcIiwgXCJPbGl2ZVwiLCBcIkFtZWxpYVwiLCBcIkhhbm5haFwiLCBcIkphbmVcIiwgXCJWaXJnaW5pYVwiLCBcIkVtaWx5XCIsIFwiTWF0aWxkYVwiLCBcIklyZW5lXCIsIFwiS2F0aHJ5blwiLCBcIkVzdGhlclwiLCBcIldpbGxpZVwiLCBcIkhlbnJpZXR0YVwiLCBcIk9sbGllXCIsIFwiQW15XCIsIFwiUmFjaGVsXCIsIFwiU2FyYVwiLCBcIkVzdGVsbGFcIiwgXCJUaGVyZXNhXCIsIFwiQXVndXN0YVwiLCBcIk9yYVwiLCBcIlBhdWxpbmVcIiwgXCJKb3NpZVwiLCBcIkxvbGFcIiwgXCJTb3BoaWFcIiwgXCJMZW9uYVwiLCBcIkFubmVcIiwgXCJNaWxkcmVkXCIsIFwiQW5uXCIsIFwiQmV1bGFoXCIsIFwiQ2FsbGllXCIsIFwiTG91XCIsIFwiRGVsaWFcIiwgXCJFbGVhbm9yXCIsIFwiQmFyYmFyYVwiLCBcIkl2YVwiLCBcIkxvdWlzYVwiLCBcIk1hcmlhXCIsIFwiTWF5bWVcIiwgXCJFdmVseW5cIiwgXCJFc3RlbGxlXCIsIFwiTmluYVwiLCBcIkJldHR5XCIsIFwiTWFyaW9uXCIsIFwiQmV0dGllXCIsIFwiRG9yb3RoeVwiLCBcIkx1ZWxsYVwiLCBcIkluZXpcIiwgXCJMZWxhXCIsIFwiUm9zaWVcIiwgXCJBbGxpZVwiLCBcIk1pbGxpZVwiLCBcIkphbmllXCIsIFwiQ29ybmVsaWFcIiwgXCJWaWN0b3JpYVwiLCBcIlJ1YnlcIiwgXCJXaW5pZnJlZFwiLCBcIkFsdGFcIiwgXCJDZWxpYVwiLCBcIkNocmlzdGluZVwiLCBcIkJlYXRyaWNlXCIsIFwiQmlyZGllXCIsIFwiSGFycmlldHRcIiwgXCJNYWJsZVwiLCBcIk15cmFcIiwgXCJTb3BoaWVcIiwgXCJUaWxsaWVcIiwgXCJJc2FiZWxcIiwgXCJTeWx2aWFcIiwgXCJDYXJvbHluXCIsIFwiSXNhYmVsbGVcIiwgXCJMZWlsYVwiLCBcIlNhbGx5XCIsIFwiSW5hXCIsIFwiRXNzaWVcIiwgXCJCZXJ0aWVcIiwgXCJOZWxsXCIsIFwiQWxiZXJ0YVwiLCBcIkthdGhhcmluZVwiLCBcIkxvcmFcIiwgXCJSZW5hXCIsIFwiTWluYVwiLCBcIlJob2RhXCIsIFwiTWF0aGlsZGFcIiwgXCJBYmJpZVwiLCBcIkV1bGFcIiwgXCJEb2xsaWVcIiwgXCJIZXR0aWVcIiwgXCJFdW5pY2VcIiwgXCJGYW5ueVwiLCBcIk9sYVwiLCBcIkxlbm9yYVwiLCBcIkFkZWxhaWRlXCIsIFwiQ2hyaXN0aW5hXCIsIFwiTGVsaWFcIiwgXCJOZWxsZVwiLCBcIlN1ZVwiLCBcIkpvaGFubmFcIiwgXCJMaWxseVwiLCBcIkx1Y2luZGFcIiwgXCJNaW5lcnZhXCIsIFwiTGV0dGllXCIsIFwiUm94aWVcIiwgXCJDeW50aGlhXCIsIFwiSGVsZW5hXCIsIFwiSGlsZGFcIiwgXCJIdWxkYVwiLCBcIkJlcm5pY2VcIiwgXCJHZW5ldmlldmVcIiwgXCJKZWFuXCIsIFwiQ29yZGVsaWFcIiwgXCJNYXJpYW5cIiwgXCJGcmFuY2lzXCIsIFwiSmVhbmV0dGVcIiwgXCJBZGVsaW5lXCIsIFwiR3Vzc2llXCIsIFwiTGVhaFwiLCBcIkxvaXNcIiwgXCJMdXJhXCIsIFwiTWl0dGllXCIsIFwiSGFsbGllXCIsIFwiSXNhYmVsbGFcIiwgXCJPbGdhXCIsIFwiUGhvZWJlXCIsIFwiVGVyZXNhXCIsIFwiSGVzdGVyXCIsIFwiTGlkYVwiLCBcIkxpbmFcIiwgXCJXaW5uaWVcIiwgXCJDbGF1ZGlhXCIsIFwiTWFyZ3Vlcml0ZVwiLCBcIlZlcmFcIiwgXCJDZWNlbGlhXCIsIFwiQmVzc1wiLCBcIkVtaWxpZVwiLCBcIlJvc2V0dGFcIiwgXCJWZXJuYVwiLCBcIk15cnRpZVwiLCBcIkNlY2lsaWFcIiwgXCJFbHZhXCIsIFwiT2xpdmlhXCIsIFwiT3BoZWxpYVwiLCBcIkdlb3JnaWVcIiwgXCJFbG5vcmFcIiwgXCJWaW9sZXRcIiwgXCJBZGVsZVwiLCBcIkxpbHlcIiwgXCJMaW5uaWVcIiwgXCJMb3JldHRhXCIsIFwiTWFkZ2VcIiwgXCJQb2xseVwiLCBcIlZpcmdpZVwiLCBcIkV1Z2VuaWFcIiwgXCJMdWNpbGVcIiwgXCJMdWNpbGxlXCIsIFwiTWFiZWxsZVwiLCBcIlJvc2FsaWVcIl0sXG4gICAgICAgICAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHA6Ly93d3cuZGF0aS5nb3YuaXQvZGF0YXNldC9jb211bmUtZGktZmlyZW56ZV8wMTYyXG4gICAgICAgICAgICAgICAgXCJpdFwiOiBbXCJBZGFcIiwgXCJBZHJpYW5hXCIsIFwiQWxlc3NhbmRyYVwiLCBcIkFsZXNzaWFcIiwgXCJBbGljZVwiLCBcIkFuZ2VsYVwiLCBcIkFubmFcIiwgXCJBbm5hIE1hcmlhXCIsIFwiQW5uYWxpc2FcIiwgXCJBbm5pdGFcIiwgXCJBbm51bnppYXRhXCIsIFwiQW50b25lbGxhXCIsIFwiQXJpYW5uYVwiLCBcIkFzaWFcIiwgXCJBc3N1bnRhXCIsIFwiQXVyb3JhXCIsIFwiQmFyYmFyYVwiLCBcIkJlYXRyaWNlXCIsIFwiQmVuZWRldHRhXCIsIFwiQmlhbmNhXCIsIFwiQnJ1bmFcIiwgXCJDYW1pbGxhXCIsIFwiQ2FybGFcIiwgXCJDYXJsb3R0YVwiLCBcIkNhcm1lbGFcIiwgXCJDYXJvbGluYVwiLCBcIkNhdGVyaW5hXCIsIFwiQ2F0aWFcIiwgXCJDZWNpbGlhXCIsIFwiQ2hpYXJhXCIsIFwiQ2luemlhXCIsIFwiQ2xhcmFcIiwgXCJDbGF1ZGlhXCIsIFwiQ29zdGFuemFcIiwgXCJDcmlzdGluYVwiLCBcIkRhbmllbGFcIiwgXCJEZWJvcmFcIiwgXCJEaWxldHRhXCIsIFwiRGluYVwiLCBcIkRvbmF0ZWxsYVwiLCBcIkVsZW5hXCIsIFwiRWxlb25vcmFcIiwgXCJFbGlzYVwiLCBcIkVsaXNhYmV0dGFcIiwgXCJFbWFudWVsYVwiLCBcIkVtbWFcIiwgXCJFdmFcIiwgXCJGZWRlcmljYVwiLCBcIkZlcm5hbmRhXCIsIFwiRmlvcmVsbGFcIiwgXCJGaW9yZW56YVwiLCBcIkZsb3JhXCIsIFwiRnJhbmNhXCIsIFwiRnJhbmNlc2NhXCIsIFwiR2FicmllbGxhXCIsIFwiR2FpYVwiLCBcIkdlbW1hXCIsIFwiR2lhZGFcIiwgXCJHaWFubmFcIiwgXCJHaW5hXCIsIFwiR2luZXZyYVwiLCBcIkdpb3JnaWFcIiwgXCJHaW92YW5uYVwiLCBcIkdpdWxpYVwiLCBcIkdpdWxpYW5hXCIsIFwiR2l1c2VwcGFcIiwgXCJHaXVzZXBwaW5hXCIsIFwiR3JhemlhXCIsIFwiR3JhemllbGxhXCIsIFwiR3JldGFcIiwgXCJJZGFcIiwgXCJJbGFyaWFcIiwgXCJJbmVzXCIsIFwiSW9sYW5kYVwiLCBcIklyZW5lXCIsIFwiSXJtYVwiLCBcIklzYWJlbGxhXCIsIFwiSmVzc2ljYVwiLCBcIkxhdXJhXCIsIFwiTGVkYVwiLCBcIkxldGl6aWFcIiwgXCJMaWNpYVwiLCBcIkxpZGlhXCIsIFwiTGlsaWFuYVwiLCBcIkxpbmFcIiwgXCJMaW5kYVwiLCBcIkxpc2FcIiwgXCJMaXZpYVwiLCBcIkxvcmV0dGFcIiwgXCJMdWFuYVwiLCBcIkx1Y2lhXCIsIFwiTHVjaWFuYVwiLCBcIkx1Y3JlemlhXCIsIFwiTHVpc2FcIiwgXCJNYW51ZWxhXCIsIFwiTWFyYVwiLCBcIk1hcmNlbGxhXCIsIFwiTWFyZ2hlcml0YVwiLCBcIk1hcmlhXCIsIFwiTWFyaWEgQ3Jpc3RpbmFcIiwgXCJNYXJpYSBHcmF6aWFcIiwgXCJNYXJpYSBMdWlzYVwiLCBcIk1hcmlhIFBpYVwiLCBcIk1hcmlhIFRlcmVzYVwiLCBcIk1hcmluYVwiLCBcIk1hcmlzYVwiLCBcIk1hcnRhXCIsIFwiTWFydGluYVwiLCBcIk1hcnppYVwiLCBcIk1hdGlsZGVcIiwgXCJNZWxpc3NhXCIsIFwiTWljaGVsYVwiLCBcIk1pbGVuYVwiLCBcIk1pcmVsbGFcIiwgXCJNb25pY2FcIiwgXCJOYXRhbGluYVwiLCBcIk5lbGxhXCIsIFwiTmljb2xldHRhXCIsIFwiTm9lbWlcIiwgXCJPbGdhXCIsIFwiUGFvbGFcIiwgXCJQYXRyaXppYVwiLCBcIlBpZXJhXCIsIFwiUGllcmluYVwiLCBcIlJhZmZhZWxsYVwiLCBcIlJlYmVjY2FcIiwgXCJSZW5hdGFcIiwgXCJSaW5hXCIsIFwiUml0YVwiLCBcIlJvYmVydGFcIiwgXCJSb3NhXCIsIFwiUm9zYW5uYVwiLCBcIlJvc3NhbmFcIiwgXCJSb3NzZWxsYVwiLCBcIlNhYnJpbmFcIiwgXCJTYW5kcmFcIiwgXCJTYXJhXCIsIFwiU2VyZW5hXCIsIFwiU2lsdmFuYVwiLCBcIlNpbHZpYVwiLCBcIlNpbW9uYVwiLCBcIlNpbW9uZXR0YVwiLCBcIlNvZmlhXCIsIFwiU29uaWFcIiwgXCJTdGVmYW5pYVwiLCBcIlN1c2FubmFcIiwgXCJUZXJlc2FcIiwgXCJUaW5hXCIsIFwiVGl6aWFuYVwiLCBcIlRvc2NhXCIsIFwiVmFsZW50aW5hXCIsIFwiVmFsZXJpYVwiLCBcIlZhbmRhXCIsIFwiVmFuZXNzYVwiLCBcIlZhbm5hXCIsIFwiVmVyYVwiLCBcIlZlcm9uaWNhXCIsIFwiVmlsbWFcIiwgXCJWaW9sYVwiLCBcIlZpcmdpbmlhXCIsIFwiVml0dG9yaWFcIl1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBsYXN0TmFtZXM6IHtcbiAgICAgICAgICAgIFwiZW5cIjogWydTbWl0aCcsICdKb2huc29uJywgJ1dpbGxpYW1zJywgJ0pvbmVzJywgJ0Jyb3duJywgJ0RhdmlzJywgJ01pbGxlcicsICdXaWxzb24nLCAnTW9vcmUnLCAnVGF5bG9yJywgJ0FuZGVyc29uJywgJ1Rob21hcycsICdKYWNrc29uJywgJ1doaXRlJywgJ0hhcnJpcycsICdNYXJ0aW4nLCAnVGhvbXBzb24nLCAnR2FyY2lhJywgJ01hcnRpbmV6JywgJ1JvYmluc29uJywgJ0NsYXJrJywgJ1JvZHJpZ3VleicsICdMZXdpcycsICdMZWUnLCAnV2Fsa2VyJywgJ0hhbGwnLCAnQWxsZW4nLCAnWW91bmcnLCAnSGVybmFuZGV6JywgJ0tpbmcnLCAnV3JpZ2h0JywgJ0xvcGV6JywgJ0hpbGwnLCAnU2NvdHQnLCAnR3JlZW4nLCAnQWRhbXMnLCAnQmFrZXInLCAnR29uemFsZXonLCAnTmVsc29uJywgJ0NhcnRlcicsICdNaXRjaGVsbCcsICdQZXJleicsICdSb2JlcnRzJywgJ1R1cm5lcicsICdQaGlsbGlwcycsICdDYW1wYmVsbCcsICdQYXJrZXInLCAnRXZhbnMnLCAnRWR3YXJkcycsICdDb2xsaW5zJywgJ1N0ZXdhcnQnLCAnU2FuY2hleicsICdNb3JyaXMnLCAnUm9nZXJzJywgJ1JlZWQnLCAnQ29vaycsICdNb3JnYW4nLCAnQmVsbCcsICdNdXJwaHknLCAnQmFpbGV5JywgJ1JpdmVyYScsICdDb29wZXInLCAnUmljaGFyZHNvbicsICdDb3gnLCAnSG93YXJkJywgJ1dhcmQnLCAnVG9ycmVzJywgJ1BldGVyc29uJywgJ0dyYXknLCAnUmFtaXJleicsICdKYW1lcycsICdXYXRzb24nLCAnQnJvb2tzJywgJ0tlbGx5JywgJ1NhbmRlcnMnLCAnUHJpY2UnLCAnQmVubmV0dCcsICdXb29kJywgJ0Jhcm5lcycsICdSb3NzJywgJ0hlbmRlcnNvbicsICdDb2xlbWFuJywgJ0plbmtpbnMnLCAnUGVycnknLCAnUG93ZWxsJywgJ0xvbmcnLCAnUGF0dGVyc29uJywgJ0h1Z2hlcycsICdGbG9yZXMnLCAnV2FzaGluZ3RvbicsICdCdXRsZXInLCAnU2ltbW9ucycsICdGb3N0ZXInLCAnR29uemFsZXMnLCAnQnJ5YW50JywgJ0FsZXhhbmRlcicsICdSdXNzZWxsJywgJ0dyaWZmaW4nLCAnRGlheicsICdIYXllcycsICdNeWVycycsICdGb3JkJywgJ0hhbWlsdG9uJywgJ0dyYWhhbScsICdTdWxsaXZhbicsICdXYWxsYWNlJywgJ1dvb2RzJywgJ0NvbGUnLCAnV2VzdCcsICdKb3JkYW4nLCAnT3dlbnMnLCAnUmV5bm9sZHMnLCAnRmlzaGVyJywgJ0VsbGlzJywgJ0hhcnJpc29uJywgJ0dpYnNvbicsICdNY0RvbmFsZCcsICdDcnV6JywgJ01hcnNoYWxsJywgJ09ydGl6JywgJ0dvbWV6JywgJ011cnJheScsICdGcmVlbWFuJywgJ1dlbGxzJywgJ1dlYmInLCAnU2ltcHNvbicsICdTdGV2ZW5zJywgJ1R1Y2tlcicsICdQb3J0ZXInLCAnSHVudGVyJywgJ0hpY2tzJywgJ0NyYXdmb3JkJywgJ0hlbnJ5JywgJ0JveWQnLCAnTWFzb24nLCAnTW9yYWxlcycsICdLZW5uZWR5JywgJ1dhcnJlbicsICdEaXhvbicsICdSYW1vcycsICdSZXllcycsICdCdXJucycsICdHb3Jkb24nLCAnU2hhdycsICdIb2xtZXMnLCAnUmljZScsICdSb2JlcnRzb24nLCAnSHVudCcsICdCbGFjaycsICdEYW5pZWxzJywgJ1BhbG1lcicsICdNaWxscycsICdOaWNob2xzJywgJ0dyYW50JywgJ0tuaWdodCcsICdGZXJndXNvbicsICdSb3NlJywgJ1N0b25lJywgJ0hhd2tpbnMnLCAnRHVubicsICdQZXJraW5zJywgJ0h1ZHNvbicsICdTcGVuY2VyJywgJ0dhcmRuZXInLCAnU3RlcGhlbnMnLCAnUGF5bmUnLCAnUGllcmNlJywgJ0JlcnJ5JywgJ01hdHRoZXdzJywgJ0Fybm9sZCcsICdXYWduZXInLCAnV2lsbGlzJywgJ1JheScsICdXYXRraW5zJywgJ09sc29uJywgJ0NhcnJvbGwnLCAnRHVuY2FuJywgJ1NueWRlcicsICdIYXJ0JywgJ0N1bm5pbmdoYW0nLCAnQnJhZGxleScsICdMYW5lJywgJ0FuZHJld3MnLCAnUnVpeicsICdIYXJwZXInLCAnRm94JywgJ1JpbGV5JywgJ0FybXN0cm9uZycsICdDYXJwZW50ZXInLCAnV2VhdmVyJywgJ0dyZWVuZScsICdMYXdyZW5jZScsICdFbGxpb3R0JywgJ0NoYXZleicsICdTaW1zJywgJ0F1c3RpbicsICdQZXRlcnMnLCAnS2VsbGV5JywgJ0ZyYW5rbGluJywgJ0xhd3NvbicsICdGaWVsZHMnLCAnR3V0aWVycmV6JywgJ1J5YW4nLCAnU2NobWlkdCcsICdDYXJyJywgJ1Zhc3F1ZXonLCAnQ2FzdGlsbG8nLCAnV2hlZWxlcicsICdDaGFwbWFuJywgJ09saXZlcicsICdNb250Z29tZXJ5JywgJ1JpY2hhcmRzJywgJ1dpbGxpYW1zb24nLCAnSm9obnN0b24nLCAnQmFua3MnLCAnTWV5ZXInLCAnQmlzaG9wJywgJ01jQ295JywgJ0hvd2VsbCcsICdBbHZhcmV6JywgJ01vcnJpc29uJywgJ0hhbnNlbicsICdGZXJuYW5kZXonLCAnR2FyemEnLCAnSGFydmV5JywgJ0xpdHRsZScsICdCdXJ0b24nLCAnU3RhbmxleScsICdOZ3V5ZW4nLCAnR2VvcmdlJywgJ0phY29icycsICdSZWlkJywgJ0tpbScsICdGdWxsZXInLCAnTHluY2gnLCAnRGVhbicsICdHaWxiZXJ0JywgJ0dhcnJldHQnLCAnUm9tZXJvJywgJ1dlbGNoJywgJ0xhcnNvbicsICdGcmF6aWVyJywgJ0J1cmtlJywgJ0hhbnNvbicsICdEYXknLCAnTWVuZG96YScsICdNb3Jlbm8nLCAnQm93bWFuJywgJ01lZGluYScsICdGb3dsZXInLCAnQnJld2VyJywgJ0hvZmZtYW4nLCAnQ2FybHNvbicsICdTaWx2YScsICdQZWFyc29uJywgJ0hvbGxhbmQnLCAnRG91Z2xhcycsICdGbGVtaW5nJywgJ0plbnNlbicsICdWYXJnYXMnLCAnQnlyZCcsICdEYXZpZHNvbicsICdIb3BraW5zJywgJ01heScsICdUZXJyeScsICdIZXJyZXJhJywgJ1dhZGUnLCAnU290bycsICdXYWx0ZXJzJywgJ0N1cnRpcycsICdOZWFsJywgJ0NhbGR3ZWxsJywgJ0xvd2UnLCAnSmVubmluZ3MnLCAnQmFybmV0dCcsICdHcmF2ZXMnLCAnSmltZW5leicsICdIb3J0b24nLCAnU2hlbHRvbicsICdCYXJyZXR0JywgJ09icmllbicsICdDYXN0cm8nLCAnU3V0dG9uJywgJ0dyZWdvcnknLCAnTWNLaW5uZXknLCAnTHVjYXMnLCAnTWlsZXMnLCAnQ3JhaWcnLCAnUm9kcmlxdWV6JywgJ0NoYW1iZXJzJywgJ0hvbHQnLCAnTGFtYmVydCcsICdGbGV0Y2hlcicsICdXYXR0cycsICdCYXRlcycsICdIYWxlJywgJ1Job2RlcycsICdQZW5hJywgJ0JlY2snLCAnTmV3bWFuJywgJ0hheW5lcycsICdNY0RhbmllbCcsICdNZW5kZXonLCAnQnVzaCcsICdWYXVnaG4nLCAnUGFya3MnLCAnRGF3c29uJywgJ1NhbnRpYWdvJywgJ05vcnJpcycsICdIYXJkeScsICdMb3ZlJywgJ1N0ZWVsZScsICdDdXJyeScsICdQb3dlcnMnLCAnU2NodWx0eicsICdCYXJrZXInLCAnR3V6bWFuJywgJ1BhZ2UnLCAnTXVub3onLCAnQmFsbCcsICdLZWxsZXInLCAnQ2hhbmRsZXInLCAnV2ViZXInLCAnTGVvbmFyZCcsICdXYWxzaCcsICdMeW9ucycsICdSYW1zZXknLCAnV29sZmUnLCAnU2NobmVpZGVyJywgJ011bGxpbnMnLCAnQmVuc29uJywgJ1NoYXJwJywgJ0Jvd2VuJywgJ0RhbmllbCcsICdCYXJiZXInLCAnQ3VtbWluZ3MnLCAnSGluZXMnLCAnQmFsZHdpbicsICdHcmlmZml0aCcsICdWYWxkZXonLCAnSHViYmFyZCcsICdTYWxhemFyJywgJ1JlZXZlcycsICdXYXJuZXInLCAnU3RldmVuc29uJywgJ0J1cmdlc3MnLCAnU2FudG9zJywgJ1RhdGUnLCAnQ3Jvc3MnLCAnR2FybmVyJywgJ01hbm4nLCAnTWFjaycsICdNb3NzJywgJ1Rob3JudG9uJywgJ0Rlbm5pcycsICdNY0dlZScsICdGYXJtZXInLCAnRGVsZ2FkbycsICdBZ3VpbGFyJywgJ1ZlZ2EnLCAnR2xvdmVyJywgJ01hbm5pbmcnLCAnQ29oZW4nLCAnSGFybW9uJywgJ1JvZGdlcnMnLCAnUm9iYmlucycsICdOZXd0b24nLCAnVG9kZCcsICdCbGFpcicsICdIaWdnaW5zJywgJ0luZ3JhbScsICdSZWVzZScsICdDYW5ub24nLCAnU3RyaWNrbGFuZCcsICdUb3duc2VuZCcsICdQb3R0ZXInLCAnR29vZHdpbicsICdXYWx0b24nLCAnUm93ZScsICdIYW1wdG9uJywgJ09ydGVnYScsICdQYXR0b24nLCAnU3dhbnNvbicsICdKb3NlcGgnLCAnRnJhbmNpcycsICdHb29kbWFuJywgJ01hbGRvbmFkbycsICdZYXRlcycsICdCZWNrZXInLCAnRXJpY2tzb24nLCAnSG9kZ2VzJywgJ1Jpb3MnLCAnQ29ubmVyJywgJ0Fka2lucycsICdXZWJzdGVyJywgJ05vcm1hbicsICdNYWxvbmUnLCAnSGFtbW9uZCcsICdGbG93ZXJzJywgJ0NvYmInLCAnTW9vZHknLCAnUXVpbm4nLCAnQmxha2UnLCAnTWF4d2VsbCcsICdQb3BlJywgJ0Zsb3lkJywgJ09zYm9ybmUnLCAnUGF1bCcsICdNY0NhcnRoeScsICdHdWVycmVybycsICdMaW5kc2V5JywgJ0VzdHJhZGEnLCAnU2FuZG92YWwnLCAnR2liYnMnLCAnVHlsZXInLCAnR3Jvc3MnLCAnRml0emdlcmFsZCcsICdTdG9rZXMnLCAnRG95bGUnLCAnU2hlcm1hbicsICdTYXVuZGVycycsICdXaXNlJywgJ0NvbG9uJywgJ0dpbGwnLCAnQWx2YXJhZG8nLCAnR3JlZXInLCAnUGFkaWxsYScsICdTaW1vbicsICdXYXRlcnMnLCAnTnVuZXonLCAnQmFsbGFyZCcsICdTY2h3YXJ0eicsICdNY0JyaWRlJywgJ0hvdXN0b24nLCAnQ2hyaXN0ZW5zZW4nLCAnS2xlaW4nLCAnUHJhdHQnLCAnQnJpZ2dzJywgJ1BhcnNvbnMnLCAnTWNMYXVnaGxpbicsICdaaW1tZXJtYW4nLCAnRnJlbmNoJywgJ0J1Y2hhbmFuJywgJ01vcmFuJywgJ0NvcGVsYW5kJywgJ1JveScsICdQaXR0bWFuJywgJ0JyYWR5JywgJ01jQ29ybWljaycsICdIb2xsb3dheScsICdCcm9jaycsICdQb29sZScsICdGcmFuaycsICdMb2dhbicsICdPd2VuJywgJ0Jhc3MnLCAnTWFyc2gnLCAnRHJha2UnLCAnV29uZycsICdKZWZmZXJzb24nLCAnUGFyaycsICdNb3J0b24nLCAnQWJib3R0JywgJ1NwYXJrcycsICdQYXRyaWNrJywgJ05vcnRvbicsICdIdWZmJywgJ0NsYXl0b24nLCAnTWFzc2V5JywgJ0xsb3lkJywgJ0ZpZ3Vlcm9hJywgJ0NhcnNvbicsICdCb3dlcnMnLCAnUm9iZXJzb24nLCAnQmFydG9uJywgJ1RyYW4nLCAnTGFtYicsICdIYXJyaW5ndG9uJywgJ0Nhc2V5JywgJ0Jvb25lJywgJ0NvcnRleicsICdDbGFya2UnLCAnTWF0aGlzJywgJ1NpbmdsZXRvbicsICdXaWxraW5zJywgJ0NhaW4nLCAnQnJ5YW4nLCAnVW5kZXJ3b29kJywgJ0hvZ2FuJywgJ01jS2VuemllJywgJ0NvbGxpZXInLCAnTHVuYScsICdQaGVscHMnLCAnTWNHdWlyZScsICdBbGxpc29uJywgJ0JyaWRnZXMnLCAnV2lsa2Vyc29uJywgJ05hc2gnLCAnU3VtbWVycycsICdBdGtpbnMnXSxcbiAgICAgICAgICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cDovL3d3dy5kYXRpLmdvdi5pdC9kYXRhc2V0L2NvbXVuZS1kaS1maXJlbnplXzAxNjQgKGZpcnN0IDEwMDApXG4gICAgICAgICAgICBcIml0XCI6IFtcIkFjY2lhaVwiLCBcIkFnbGlldHRpXCIsIFwiQWdvc3RpbmlcIiwgXCJBZ3Jlc3RpXCIsIFwiQWhtZWRcIiwgXCJBaWF6emlcIiwgXCJBbGJhbmVzZVwiLCBcIkFsYmVydGlcIiwgXCJBbGVzc2lcIiwgXCJBbGZhbmlcIiwgXCJBbGluYXJpXCIsIFwiQWx0ZXJpbmlcIiwgXCJBbWF0b1wiLCBcIkFtbWFubmF0aVwiLCBcIkFuY2lsbG90dGlcIiwgXCJBbmRyZWlcIiwgXCJBbmRyZWluaVwiLCBcIkFuZHJlb25pXCIsIFwiQW5nZWxpXCIsIFwiQW5pY2hpbmlcIiwgXCJBbnRvbmVsbGlcIiwgXCJBbnRvbmluaVwiLCBcIkFyZW5hXCIsIFwiQXJpYW5pXCIsIFwiQXJuZXRvbGlcIiwgXCJBcnJpZ2hpXCIsIFwiQmFjY2FuaVwiLCBcIkJhY2NldHRpXCIsIFwiQmFjY2lcIiwgXCJCYWNoZXJpbmlcIiwgXCJCYWRpaVwiLCBcIkJhZ2dpYW5pXCIsIFwiQmFnbGlvbmlcIiwgXCJCYWduaVwiLCBcIkJhZ25vbGlcIiwgXCJCYWxkYXNzaW5pXCIsIFwiQmFsZGlcIiwgXCJCYWxkaW5pXCIsIFwiQmFsbGVyaW5pXCIsIFwiQmFsbGlcIiwgXCJCYWxsaW5pXCIsIFwiQmFsbG9uaVwiLCBcIkJhbWJpXCIsIFwiQmFuY2hpXCIsIFwiQmFuZGluZWxsaVwiLCBcIkJhbmRpbmlcIiwgXCJCYW5pXCIsIFwiQmFyYmV0dGlcIiwgXCJCYXJiaWVyaVwiLCBcIkJhcmNoaWVsbGlcIiwgXCJCYXJkYXp6aVwiLCBcIkJhcmRlbGxpXCIsIFwiQmFyZGlcIiwgXCJCYXJkdWNjaVwiLCBcIkJhcmdlbGxpbmlcIiwgXCJCYXJnaWFjY2hpXCIsIFwiQmFybmlcIiwgXCJCYXJvbmNlbGxpXCIsIFwiQmFyb25jaW5pXCIsIFwiQmFyb25lXCIsIFwiQmFyb25pXCIsIFwiQmFyb250aVwiLCBcIkJhcnRhbGVzaVwiLCBcIkJhcnRvbGV0dGlcIiwgXCJCYXJ0b2xpXCIsIFwiQmFydG9saW5pXCIsIFwiQmFydG9sb25pXCIsIFwiQmFydG9sb3p6aVwiLCBcIkJhc2FnbmlcIiwgXCJCYXNpbGVcIiwgXCJCYXNzaVwiLCBcIkJhdGFjY2hpXCIsIFwiQmF0dGFnbGlhXCIsIFwiQmF0dGFnbGluaVwiLCBcIkJhdXNpXCIsIFwiQmVjYWdsaVwiLCBcIkJlY2F0dGluaVwiLCBcIkJlY2NoaVwiLCBcIkJlY3VjY2lcIiwgXCJCZWxsYW5kaVwiLCBcIkJlbGxlc2lcIiwgXCJCZWxsaVwiLCBcIkJlbGxpbmlcIiwgXCJCZWxsdWNjaVwiLCBcIkJlbmNpbmlcIiwgXCJCZW5lZGV0dGlcIiwgXCJCZW5lbGxpXCIsIFwiQmVuaVwiLCBcIkJlbmluaVwiLCBcIkJlbnNpXCIsIFwiQmVudWNjaVwiLCBcIkJlbnZlbnV0aVwiLCBcIkJlcmxpbmNpb25pXCIsIFwiQmVybmFjY2hpb25pXCIsIFwiQmVybmFyZGlcIiwgXCJCZXJuYXJkaW5pXCIsIFwiQmVybmlcIiwgXCJCZXJuaW5pXCIsIFwiQmVydGVsbGlcIiwgXCJCZXJ0aVwiLCBcIkJlcnRpbmlcIiwgXCJCZXNzaVwiLCBcIkJldHRpXCIsIFwiQmV0dGluaVwiLCBcIkJpYWdpXCIsIFwiQmlhZ2luaVwiLCBcIkJpYWdpb25pXCIsIFwiQmlhZ2lvdHRpXCIsIFwiQmlhbmNhbGFuaVwiLCBcIkJpYW5jaGlcIiwgXCJCaWFuY2hpbmlcIiwgXCJCaWFuY29cIiwgXCJCaWZmb2xpXCIsIFwiQmlnYXp6aVwiLCBcIkJpZ2lcIiwgXCJCaWxpb3R0aVwiLCBcIkJpbGxpXCIsIFwiQmluYXp6aVwiLCBcIkJpbmRpXCIsIFwiQmluaVwiLCBcIkJpb25kaVwiLCBcIkJpenphcnJpXCIsIFwiQm9jY2lcIiwgXCJCb2dhbmlcIiwgXCJCb2xvZ25lc2lcIiwgXCJCb25haXV0aVwiLCBcIkJvbmFubmlcIiwgXCJCb25jaWFuaVwiLCBcIkJvbmNpbmVsbGlcIiwgXCJCb25kaVwiLCBcIkJvbmVjaGlcIiwgXCJCb25naW5pXCIsIFwiQm9uaVwiLCBcIkJvbmluaVwiLCBcIkJvcmNoaVwiLCBcIkJvcmV0dGlcIiwgXCJCb3JnaGlcIiwgXCJCb3JnaGluaVwiLCBcIkJvcmdpb2xpXCIsIFwiQm9ycmlcIiwgXCJCb3JzZWxsaVwiLCBcIkJvc2NoaVwiLCBcIkJvdHRhaVwiLCBcIkJyYWNjaVwiLCBcIkJyYWNjaW5pXCIsIFwiQnJhbmRpXCIsIFwiQnJhc2NoaVwiLCBcIkJyYXZpXCIsIFwiQnJhenppbmlcIiwgXCJCcmVzY2hpXCIsIFwiQnJpbGxpXCIsIFwiQnJpenppXCIsIFwiQnJvZ2VsbGlcIiwgXCJCcm9naVwiLCBcIkJyb2dpb25pXCIsIFwiQnJ1bmVsbGlcIiwgXCJCcnVuZXR0aVwiLCBcIkJydW5pXCIsIFwiQnJ1bm9cIiwgXCJCcnVub3JpXCIsIFwiQnJ1c2NoaVwiLCBcIkJ1Y2NpXCIsIFwiQnVjY2lhcmVsbGlcIiwgXCJCdWNjaW9uaVwiLCBcIkJ1Y2VsbGlcIiwgXCJCdWxsaVwiLCBcIkJ1cmJlcmlcIiwgXCJCdXJjaGlcIiwgXCJCdXJnYXNzaVwiLCBcIkJ1cnJvbmlcIiwgXCJCdXNzb3R0aVwiLCBcIkJ1dGlcIiwgXCJDYWNpb2xsaVwiLCBcIkNhaWFuaVwiLCBcIkNhbGFicmVzZVwiLCBcIkNhbGFtYWlcIiwgXCJDYWxhbWFuZHJlaVwiLCBcIkNhbGRpbmlcIiwgXCJDYWxvJ1wiLCBcIkNhbG9uYWNpXCIsIFwiQ2Fsb3NpXCIsIFwiQ2FsdmVsbGlcIiwgXCJDYW1iaVwiLCBcIkNhbWljaW90dG9saVwiLCBcIkNhbW1lbGxpXCIsIFwiQ2FtbWlsbGlcIiwgXCJDYW1wb2xtaVwiLCBcIkNhbnRpbmlcIiwgXCJDYXBhbm5pXCIsIFwiQ2FwZWNjaGlcIiwgXCJDYXBvbmlcIiwgXCJDYXBwZWxsZXR0aVwiLCBcIkNhcHBlbGxpXCIsIFwiQ2FwcGVsbGluaVwiLCBcIkNhcHB1Z2lcIiwgXCJDYXByZXR0aVwiLCBcIkNhcHV0b1wiLCBcIkNhcmJvbmVcIiwgXCJDYXJib25pXCIsIFwiQ2FyZGluaVwiLCBcIkNhcmxlc2lcIiwgXCJDYXJsZXR0aVwiLCBcIkNhcmxpXCIsIFwiQ2Fyb3RpXCIsIFwiQ2Fyb3R0aVwiLCBcIkNhcnJhaVwiLCBcIkNhcnJhcmVzaVwiLCBcIkNhcnRhXCIsIFwiQ2FydXNvXCIsIFwiQ2FzYWxpbmlcIiwgXCJDYXNhdGlcIiwgXCJDYXNlbGxpXCIsIFwiQ2FzaW5pXCIsIFwiQ2FzdGFnbm9saVwiLCBcIkNhc3RlbGxhbmlcIiwgXCJDYXN0ZWxsaVwiLCBcIkNhc3RlbGx1Y2NpXCIsIFwiQ2F0YWxhbm9cIiwgXCJDYXRhcnppXCIsIFwiQ2F0ZWxhbmlcIiwgXCJDYXZhY2lvY2NoaVwiLCBcIkNhdmFsbGFyb1wiLCBcIkNhdmFsbGluaVwiLCBcIkNhdmljY2hpXCIsIFwiQ2F2aW5pXCIsIFwiQ2VjY2FyZWxsaVwiLCBcIkNlY2NhdGVsbGlcIiwgXCJDZWNjaGVyZWxsaVwiLCBcIkNlY2NoZXJpbmlcIiwgXCJDZWNjaGlcIiwgXCJDZWNjaGluaVwiLCBcIkNlY2NvbmlcIiwgXCJDZWlcIiwgXCJDZWxsYWlcIiwgXCJDZWxsaVwiLCBcIkNlbGxpbmlcIiwgXCJDZW5jZXR0aVwiLCBcIkNlbmlcIiwgXCJDZW5uaVwiLCBcIkNlcmJhaVwiLCBcIkNlc2FyaVwiLCBcIkNlc2VyaVwiLCBcIkNoZWNjYWNjaVwiLCBcIkNoZWNjaGlcIiwgXCJDaGVjY3VjY2lcIiwgXCJDaGVsaVwiLCBcIkNoZWxsaW5pXCIsIFwiQ2hlblwiLCBcIkNoZW5nXCIsIFwiQ2hlcmljaVwiLCBcIkNoZXJ1YmluaVwiLCBcIkNoaWFyYW1vbnRpXCIsIFwiQ2hpYXJhbnRpbmlcIiwgXCJDaGlhcmVsbGlcIiwgXCJDaGlhcmlcIiwgXCJDaGlhcmluaVwiLCBcIkNoaWFydWdpXCIsIFwiQ2hpYXZhY2NpXCIsIFwiQ2hpZXNpXCIsIFwiQ2hpbWVudGlcIiwgXCJDaGluaVwiLCBcIkNoaXJpY2lcIiwgXCJDaGl0aVwiLCBcIkNpYWJhdHRpXCIsIFwiQ2lhbXBpXCIsIFwiQ2lhbmNoaVwiLCBcIkNpYW5mYW5lbGxpXCIsIFwiQ2lhbmZlcm9uaVwiLCBcIkNpYW5pXCIsIFwiQ2lhcGV0dGlcIiwgXCJDaWFwcGlcIiwgXCJDaWFyZGlcIiwgXCJDaWF0dGlcIiwgXCJDaWNhbGlcIiwgXCJDaWNjb25lXCIsIFwiQ2luZWxsaVwiLCBcIkNpbmlcIiwgXCJDaW9iYW51XCIsIFwiQ2lvbGxpXCIsIFwiQ2lvbmlcIiwgXCJDaXByaWFuaVwiLCBcIkNpcmlsbG9cIiwgXCJDaXJyaVwiLCBcIkNpdWNjaGlcIiwgXCJDaXVmZmlcIiwgXCJDaXVsbGlcIiwgXCJDaXVsbGluaVwiLCBcIkNsZW1lbnRlXCIsIFwiQ29jY2hpXCIsIFwiQ29nbm9tZVwiLCBcIkNvbGlcIiwgXCJDb2xsaW5pXCIsIFwiQ29sb21ib1wiLCBcIkNvbHppXCIsIFwiQ29tcGFyaW5pXCIsIFwiQ29uZm9ydGlcIiwgXCJDb25zaWdsaVwiLCBcIkNvbnRlXCIsIFwiQ29udGlcIiwgXCJDb250aW5pXCIsIFwiQ29wcGluaVwiLCBcIkNvcHBvbGFcIiwgXCJDb3JzaVwiLCBcIkNvcnNpbmlcIiwgXCJDb3J0aVwiLCBcIkNvcnRpbmlcIiwgXCJDb3NpXCIsIFwiQ29zdGFcIiwgXCJDb3N0YW50aW5pXCIsIFwiQ29zdGFudGlub1wiLCBcIkNvenppXCIsIFwiQ3Jlc2NpXCIsIFwiQ3Jlc2Npb2xpXCIsIFwiQ3Jlc3RpXCIsIFwiQ3JpbmlcIiwgXCJDdXJyYWRpXCIsIFwiRCdBZ29zdGlub1wiLCBcIkQnQWxlc3NhbmRyb1wiLCBcIkQnQW1pY29cIiwgXCJEJ0FuZ2Vsb1wiLCBcIkRhZGRpXCIsIFwiRGFpbmVsbGlcIiwgXCJEYWxsYWlcIiwgXCJEYW50aVwiLCBcIkRhdml0dGlcIiwgXCJEZSBBbmdlbGlzXCIsIFwiRGUgTHVjYVwiLCBcIkRlIE1hcmNvXCIsIFwiRGUgUm9zYVwiLCBcIkRlIFNhbnRpc1wiLCBcIkRlIFNpbW9uZVwiLCBcIkRlIFZpdGFcIiwgXCJEZWdsJ0lubm9jZW50aVwiLCBcIkRlZ2xpIElubm9jZW50aVwiLCBcIkRlaVwiLCBcIkRlbCBMdW5nb1wiLCBcIkRlbCBSZVwiLCBcIkRpIE1hcmNvXCIsIFwiRGkgU3RlZmFub1wiLCBcIkRpbmlcIiwgXCJEaW9wXCIsIFwiRG9icmVcIiwgXCJEb2xmaVwiLCBcIkRvbmF0aVwiLCBcIkRvbmRvbGlcIiwgXCJEb25nXCIsIFwiRG9ubmluaVwiLCBcIkR1Y2NpXCIsIFwiRHVtaXRydVwiLCBcIkVybWluaVwiLCBcIkVzcG9zaXRvXCIsIFwiRXZhbmdlbGlzdGlcIiwgXCJGYWJicmlcIiwgXCJGYWJicmluaVwiLCBcIkZhYmJyaXp6aVwiLCBcIkZhYmJyb25pXCIsIFwiRmFiYnJ1Y2NpXCIsIFwiRmFiaWFuaVwiLCBcIkZhY2NoaW5pXCIsIFwiRmFnZ2lcIiwgXCJGYWdpb2xpXCIsIFwiRmFpbGxpXCIsIFwiRmFpbmlcIiwgXCJGYWxjaWFuaVwiLCBcIkZhbGNpbmlcIiwgXCJGYWxjb25lXCIsIFwiRmFsbGFuaVwiLCBcIkZhbG9ybmlcIiwgXCJGYWxzaW5pXCIsIFwiRmFsdWdpYW5pXCIsIFwiRmFuY2VsbGlcIiwgXCJGYW5lbGxpXCIsIFwiRmFuZXR0aVwiLCBcIkZhbmZhbmlcIiwgXCJGYW5pXCIsIFwiRmFudGFwcGllJ1wiLCBcIkZhbnRlY2hpXCIsIFwiRmFudGlcIiwgXCJGYW50aW5pXCIsIFwiRmFudG9uaVwiLCBcIkZhcmluYVwiLCBcIkZhdHRvcmlcIiwgXCJGYXZpbGxpXCIsIFwiRmVkaVwiLCBcIkZlaVwiLCBcIkZlcnJhbnRlXCIsIFwiRmVycmFyYVwiLCBcIkZlcnJhcmlcIiwgXCJGZXJyYXJvXCIsIFwiRmVycmV0dGlcIiwgXCJGZXJyaVwiLCBcIkZlcnJpbmlcIiwgXCJGZXJyb25pXCIsIFwiRmlhc2NoaVwiLCBcIkZpYmJpXCIsIFwiRmllc29saVwiLCBcIkZpbGlwcGlcIiwgXCJGaWxpcHBpbmlcIiwgXCJGaW5pXCIsIFwiRmlvcmF2YW50aVwiLCBcIkZpb3JlXCIsIFwiRmlvcmVudGluaVwiLCBcIkZpb3JpbmlcIiwgXCJGaXNzaVwiLCBcIkZvY2FyZGlcIiwgXCJGb2dnaVwiLCBcIkZvbnRhbmFcIiwgXCJGb250YW5lbGxpXCIsIFwiRm9udGFuaVwiLCBcIkZvcmNvbmlcIiwgXCJGb3JtaWdsaVwiLCBcIkZvcnRlXCIsIFwiRm9ydGlcIiwgXCJGb3J0aW5pXCIsIFwiRm9zc2F0aVwiLCBcIkZvc3NpXCIsIFwiRnJhbmNhbGFuY2lcIiwgXCJGcmFuY2VzY2hpXCIsIFwiRnJhbmNlc2NoaW5pXCIsIFwiRnJhbmNoaVwiLCBcIkZyYW5jaGluaVwiLCBcIkZyYW5jaVwiLCBcIkZyYW5jaW5pXCIsIFwiRnJhbmNpb25pXCIsIFwiRnJhbmNvXCIsIFwiRnJhc3NpbmV0aVwiLCBcIkZyYXRpXCIsIFwiRnJhdGluaVwiLCBcIkZyaWxsaVwiLCBcIkZyaXp6aVwiLCBcIkZyb3NhbGlcIiwgXCJGcm9zaW5pXCIsIFwiRnJ1bGxpbmlcIiwgXCJGdXNjb1wiLCBcIkZ1c2lcIiwgXCJHYWJicmllbGxpXCIsIFwiR2FiZWxsaW5pXCIsIFwiR2FnbGlhcmRpXCIsIFwiR2FsYW50aVwiLCBcIkdhbGFyZGlcIiwgXCJHYWxlb3R0aVwiLCBcIkdhbGxldHRpXCIsIFwiR2FsbGlcIiwgXCJHYWxsb1wiLCBcIkdhbGxvcmlcIiwgXCJHYW1iYWNjaWFuaVwiLCBcIkdhcmdhbmlcIiwgXCJHYXJvZmFsb1wiLCBcIkdhcnVnbGllcmlcIiwgXCJHYXNoaVwiLCBcIkdhc3BlcmluaVwiLCBcIkdhdHRpXCIsIFwiR2VsbGlcIiwgXCJHZW5zaW5pXCIsIFwiR2VudGlsZVwiLCBcIkdlbnRpbGlcIiwgXCJHZXJpXCIsIFwiR2VyaW5pXCIsIFwiR2hlcmlcIiwgXCJHaGluaVwiLCBcIkdpYWNoZXR0aVwiLCBcIkdpYWNoaVwiLCBcIkdpYWNvbWVsbGlcIiwgXCJHaWFuYXNzaVwiLCBcIkdpYW5pXCIsIFwiR2lhbm5lbGxpXCIsIFwiR2lhbm5ldHRpXCIsIFwiR2lhbm5pXCIsIFwiR2lhbm5pbmlcIiwgXCJHaWFubm9uaVwiLCBcIkdpYW5ub3R0aVwiLCBcIkdpYW5ub3p6aVwiLCBcIkdpZ2xpXCIsIFwiR2lvcmRhbm9cIiwgXCJHaW9yZ2V0dGlcIiwgXCJHaW9yZ2lcIiwgXCJHaW92YWNjaGluaVwiLCBcIkdpb3Zhbm5lbGxpXCIsIFwiR2lvdmFubmV0dGlcIiwgXCJHaW92YW5uaW5pXCIsIFwiR2lvdmFubm9uaVwiLCBcIkdpdWxpYW5pXCIsIFwiR2l1bnRpXCIsIFwiR2l1bnRpbmlcIiwgXCJHaXVzdGlcIiwgXCJHb25uZWxsaVwiLCBcIkdvcmV0dGlcIiwgXCJHb3JpXCIsIFwiR3JhZGlcIiwgXCJHcmFtaWduaVwiLCBcIkdyYXNzaVwiLCBcIkdyYXNzb1wiLCBcIkdyYXppYW5pXCIsIFwiR3JhenppbmlcIiwgXCJHcmVjb1wiLCBcIkdyaWZvbmlcIiwgXCJHcmlsbG9cIiwgXCJHcmltYWxkaVwiLCBcIkdyb3NzaVwiLCBcIkd1YWx0aWVyaVwiLCBcIkd1YXJkdWNjaVwiLCBcIkd1YXJpbm9cIiwgXCJHdWFybmllcmlcIiwgXCJHdWFzdGlcIiwgXCJHdWVycmFcIiwgXCJHdWVycmlcIiwgXCJHdWVycmluaVwiLCBcIkd1aWRpXCIsIFwiR3VpZG90dGlcIiwgXCJIZVwiLCBcIkhveGhhXCIsIFwiSHVcIiwgXCJIdWFuZ1wiLCBcIklhbmRlbGxpXCIsIFwiSWduZXN0aVwiLCBcIklubm9jZW50aVwiLCBcIkppblwiLCBcIkxhIFJvc2FcIiwgXCJMYWlcIiwgXCJMYW5kaVwiLCBcIkxhbmRpbmlcIiwgXCJMYW5pbmlcIiwgXCJMYXBpXCIsIFwiTGFwaW5pXCIsIFwiTGFyaVwiLCBcIkxhc2NpYWxmYXJpXCIsIFwiTGFzdHJ1Y2NpXCIsIFwiTGF0aW5pXCIsIFwiTGF6emVyaVwiLCBcIkxhenplcmluaVwiLCBcIkxlbGxpXCIsIFwiTGVuemlcIiwgXCJMZW9uYXJkaVwiLCBcIkxlb25jaW5pXCIsIFwiTGVvbmVcIiwgXCJMZW9uaVwiLCBcIkxlcHJpXCIsIFwiTGlcIiwgXCJMaWFvXCIsIFwiTGluXCIsIFwiTGluYXJpXCIsIFwiTGlwcGlcIiwgXCJMaXNpXCIsIFwiTGl2aVwiLCBcIkxvbWJhcmRpXCIsIFwiTG9tYmFyZGluaVwiLCBcIkxvbWJhcmRvXCIsIFwiTG9uZ29cIiwgXCJMb3BlelwiLCBcIkxvcmVuemlcIiwgXCJMb3JlbnppbmlcIiwgXCJMb3JpbmlcIiwgXCJMb3R0aVwiLCBcIkx1XCIsIFwiTHVjY2hlc2lcIiwgXCJMdWNoZXJpbmlcIiwgXCJMdW5naGlcIiwgXCJMdXBpXCIsIFwiTWFkaWFpXCIsIFwiTWFlc3RyaW5pXCIsIFwiTWFmZmVpXCIsIFwiTWFnZ2lcIiwgXCJNYWdnaW5pXCIsIFwiTWFnaGVyaW5pXCIsIFwiTWFnaW5pXCIsIFwiTWFnbmFuaVwiLCBcIk1hZ25lbGxpXCIsIFwiTWFnbmlcIiwgXCJNYWdub2xmaVwiLCBcIk1hZ3JpbmlcIiwgXCJNYWxhdm9sdGlcIiwgXCJNYWxldm9sdGlcIiwgXCJNYW5jYVwiLCBcIk1hbmNpbmlcIiwgXCJNYW5ldHRpXCIsIFwiTWFuZnJlZGlcIiwgXCJNYW5nYW5pXCIsIFwiTWFubmVsbGlcIiwgXCJNYW5uaVwiLCBcIk1hbm5pbmlcIiwgXCJNYW5udWNjaVwiLCBcIk1hbnVlbGxpXCIsIFwiTWFuemluaVwiLCBcIk1hcmNlbGxpXCIsIFwiTWFyY2hlc2VcIiwgXCJNYXJjaGV0dGlcIiwgXCJNYXJjaGlcIiwgXCJNYXJjaGlhbmlcIiwgXCJNYXJjaGlvbm5pXCIsIFwiTWFyY29uaVwiLCBcIk1hcmN1Y2NpXCIsIFwiTWFyZ2hlcmlcIiwgXCJNYXJpXCIsIFwiTWFyaWFuaVwiLCBcIk1hcmlsbGlcIiwgXCJNYXJpbmFpXCIsIFwiTWFyaW5hcmlcIiwgXCJNYXJpbmVsbGlcIiwgXCJNYXJpbmlcIiwgXCJNYXJpbm9cIiwgXCJNYXJpb3R0aVwiLCBcIk1hcnNpbGlcIiwgXCJNYXJ0ZWxsaVwiLCBcIk1hcnRpbmVsbGlcIiwgXCJNYXJ0aW5pXCIsIFwiTWFydGlub1wiLCBcIk1hcnppXCIsIFwiTWFzaVwiLCBcIk1hc2luaVwiLCBcIk1hc29uaVwiLCBcIk1hc3NhaVwiLCBcIk1hdGVyYXNzaVwiLCBcIk1hdHRlaVwiLCBcIk1hdHRlaW5pXCIsIFwiTWF0dGV1Y2NpXCIsIFwiTWF0dGV1enppXCIsIFwiTWF0dGlvbGlcIiwgXCJNYXR0b2xpbmlcIiwgXCJNYXR1Y2NpXCIsIFwiTWF1cm9cIiwgXCJNYXp6YW50aVwiLCBcIk1henplaVwiLCBcIk1henpldHRpXCIsIFwiTWF6emlcIiwgXCJNYXp6aW5pXCIsIFwiTWF6em9jY2hpXCIsIFwiTWF6em9saVwiLCBcIk1henpvbmlcIiwgXCJNYXp6dW9saVwiLCBcIk1lYWNjaVwiLCBcIk1lY29jY2lcIiwgXCJNZWluaVwiLCBcIk1lbGFuaVwiLCBcIk1lbGVcIiwgXCJNZWxpXCIsIFwiTWVuZ29uaVwiLCBcIk1lbmljaGV0dGlcIiwgXCJNZW9uaVwiLCBcIk1lcmxpbmlcIiwgXCJNZXNzZXJpXCIsIFwiTWVzc2luYVwiLCBcIk1ldWNjaVwiLCBcIk1pY2NpbmVzaVwiLCBcIk1pY2VsaVwiLCBcIk1pY2hlbGlcIiwgXCJNaWNoZWxpbmlcIiwgXCJNaWNoZWxvenppXCIsIFwiTWlnbGlvcmlcIiwgXCJNaWdsaW9yaW5pXCIsIFwiTWlsYW5pXCIsIFwiTWluaWF0aVwiLCBcIk1pc3VyaVwiLCBcIk1vbmFjb1wiLCBcIk1vbnRhZ25hbmlcIiwgXCJNb250YWduaVwiLCBcIk1vbnRhbmFyaVwiLCBcIk1vbnRlbGF0aWNpXCIsIFwiTW9udGlcIiwgXCJNb250aWdpYW5pXCIsIFwiTW9udGluaVwiLCBcIk1vcmFuZGlcIiwgXCJNb3JhbmRpbmlcIiwgXCJNb3JlbGxpXCIsIFwiTW9yZXR0aVwiLCBcIk1vcmdhbnRpXCIsIFwiTW9yaVwiLCBcIk1vcmluaVwiLCBcIk1vcm9uaVwiLCBcIk1vcm96emlcIiwgXCJNdWduYWlcIiwgXCJNdWduYWluaVwiLCBcIk11c3RhZmFcIiwgXCJOYWxkaVwiLCBcIk5hbGRpbmlcIiwgXCJOYW5uZWxsaVwiLCBcIk5hbm5pXCIsIFwiTmFubmluaVwiLCBcIk5hbm51Y2NpXCIsIFwiTmFyZGlcIiwgXCJOYXJkaW5pXCIsIFwiTmFyZG9uaVwiLCBcIk5hdGFsaVwiLCBcIk5kaWF5ZVwiLCBcIk5lbmNldHRpXCIsIFwiTmVuY2luaVwiLCBcIk5lbmNpb25pXCIsIFwiTmVyaVwiLCBcIk5lc2lcIiwgXCJOZXN0aVwiLCBcIk5pY2NvbGFpXCIsIFwiTmljY29saVwiLCBcIk5pY2NvbGluaVwiLCBcIk5pZ2lcIiwgXCJOaXN0cmlcIiwgXCJOb2NlbnRpbmlcIiwgXCJOb2ZlcmluaVwiLCBcIk5vdmVsbGlcIiwgXCJOdWNjaVwiLCBcIk51dGlcIiwgXCJOdXRpbmlcIiwgXCJPbGl2YVwiLCBcIk9saXZpZXJpXCIsIFwiT2xtaVwiLCBcIk9ybGFuZGlcIiwgXCJPcmxhbmRpbmlcIiwgXCJPcmxhbmRvXCIsIFwiT3JzaW5pXCIsIFwiT3J0b2xhbmlcIiwgXCJPdHRhbmVsbGlcIiwgXCJQYWNjaWFuaVwiLCBcIlBhY2VcIiwgXCJQYWNpXCIsIFwiUGFjaW5pXCIsIFwiUGFnYW5pXCIsIFwiUGFnYW5vXCIsIFwiUGFnZ2V0dGlcIiwgXCJQYWdsaWFpXCIsIFwiUGFnbmlcIiwgXCJQYWduaW5pXCIsIFwiUGFsYWRpbmlcIiwgXCJQYWxhZ2lcIiwgXCJQYWxjaGV0dGlcIiwgXCJQYWxsb25pXCIsIFwiUGFsbWllcmlcIiwgXCJQYWx1bWJvXCIsIFwiUGFtcGFsb25pXCIsIFwiUGFuY2FuaVwiLCBcIlBhbmRvbGZpXCIsIFwiUGFuZG9sZmluaVwiLCBcIlBhbmVyYWlcIiwgXCJQYW5pY2hpXCIsIFwiUGFvbGV0dGlcIiwgXCJQYW9saVwiLCBcIlBhb2xpbmlcIiwgXCJQYXBpXCIsIFwiUGFwaW5pXCIsIFwiUGFwdWNjaVwiLCBcIlBhcmVudGlcIiwgXCJQYXJpZ2lcIiwgXCJQYXJpc2lcIiwgXCJQYXJyaVwiLCBcIlBhcnJpbmlcIiwgXCJQYXNxdWluaVwiLCBcIlBhc3NlcmlcIiwgXCJQZWNjaGlvbGlcIiwgXCJQZWNvcmluaVwiLCBcIlBlbGxlZ3JpbmlcIiwgXCJQZXBpXCIsIFwiUGVyaW5pXCIsIFwiUGVycm9uZVwiLCBcIlBlcnV6emlcIiwgXCJQZXNjaVwiLCBcIlBlc3RlbGxpXCIsIFwiUGV0cmlcIiwgXCJQZXRyaW5pXCIsIFwiUGV0cnVjY2lcIiwgXCJQZXR0aW5pXCIsIFwiUGV6emF0aVwiLCBcIlBlenphdGluaVwiLCBcIlBpYW5pXCIsIFwiUGlhenphXCIsIFwiUGlhenplc2lcIiwgXCJQaWF6emluaVwiLCBcIlBpY2NhcmRpXCIsIFwiUGljY2hpXCIsIFwiUGljY2luaVwiLCBcIlBpY2Npb2xpXCIsIFwiUGllcmFjY2luaVwiLCBcIlBpZXJhY2Npb25pXCIsIFwiUGllcmFsbGlcIiwgXCJQaWVyYXR0aW5pXCIsIFwiUGllcmlcIiwgXCJQaWVyaW5pXCIsIFwiUGllcm9uaVwiLCBcIlBpZXRyaW5pXCIsIFwiUGluaVwiLCBcIlBpbm5hXCIsIFwiUGludG9cIiwgXCJQaW56YW5pXCIsIFwiUGluemF1dGlcIiwgXCJQaXJhc1wiLCBcIlBpc2FuaVwiLCBcIlBpc3RvbGVzaVwiLCBcIlBvZ2dlc2lcIiwgXCJQb2dnaVwiLCBcIlBvZ2dpYWxpXCIsIFwiUG9nZ2lvbGluaVwiLCBcIlBvbGlcIiwgXCJQb2xsYXN0cmlcIiwgXCJQb3JjaWFuaVwiLCBcIlBvenppXCIsIFwiUHJhdGVsbGVzaVwiLCBcIlByYXRlc2lcIiwgXCJQcm9zcGVyaVwiLCBcIlBydW5ldGlcIiwgXCJQdWNjaVwiLCBcIlB1Y2NpbmlcIiwgXCJQdWNjaW9uaVwiLCBcIlB1Z2lcIiwgXCJQdWdsaWVzZVwiLCBcIlB1bGl0aVwiLCBcIlF1ZXJjaVwiLCBcIlF1ZXJjaW9saVwiLCBcIlJhZGRpXCIsIFwiUmFkdVwiLCBcIlJhZmZhZWxsaVwiLCBcIlJhZ2F6emluaVwiLCBcIlJhbmZhZ25pXCIsIFwiUmFuaWVyaVwiLCBcIlJhc3RyZWxsaVwiLCBcIlJhdWdlaVwiLCBcIlJhdmVnZ2lcIiwgXCJSZW5haVwiLCBcIlJlbnppXCIsIFwiUmV0dG9yaVwiLCBcIlJpY2NpXCIsIFwiUmljY2lhcmRpXCIsIFwiUmlkaVwiLCBcIlJpZG9sZmlcIiwgXCJSaWdhY2NpXCIsIFwiUmlnaGlcIiwgXCJSaWdoaW5pXCIsIFwiUmluYWxkaVwiLCBcIlJpc2FsaXRpXCIsIFwiUmlzdG9yaVwiLCBcIlJpenpvXCIsIFwiUm9jY2hpXCIsIFwiUm9jY2hpbmlcIiwgXCJSb2dhaVwiLCBcIlJvbWFnbm9saVwiLCBcIlJvbWFuZWxsaVwiLCBcIlJvbWFuaVwiLCBcIlJvbWFub1wiLCBcIlJvbWVpXCIsIFwiUm9tZW9cIiwgXCJSb21pdGlcIiwgXCJSb21vbGlcIiwgXCJSb21vbGluaVwiLCBcIlJvbnRpbmlcIiwgXCJSb3NhdGlcIiwgXCJSb3NlbGxpXCIsIFwiUm9zaVwiLCBcIlJvc3NldHRpXCIsIFwiUm9zc2lcIiwgXCJSb3NzaW5pXCIsIFwiUm92YWlcIiwgXCJSdWdnZXJpXCIsIFwiUnVnZ2llcm9cIiwgXCJSdXNzb1wiLCBcIlNhYmF0aW5pXCIsIFwiU2FjY2FyZGlcIiwgXCJTYWNjaGV0dGlcIiwgXCJTYWNjaGlcIiwgXCJTYWNjb1wiLCBcIlNhbGVybm9cIiwgXCJTYWxpbWJlbmlcIiwgXCJTYWx1Y2NpXCIsIFwiU2FsdmFkb3JpXCIsIFwiU2FsdmVzdHJpbmlcIiwgXCJTYWx2aVwiLCBcIlNhbHZpbmlcIiwgXCJTYW5lc2lcIiwgXCJTYW5pXCIsIFwiU2FubmFcIiwgXCJTYW50aVwiLCBcIlNhbnRpbmlcIiwgXCJTYW50b25pXCIsIFwiU2FudG9yb1wiLCBcIlNhbnR1Y2NpXCIsIFwiU2FyZGlcIiwgXCJTYXJyaVwiLCBcIlNhcnRpXCIsIFwiU2Fzc2lcIiwgXCJTYm9sY2lcIiwgXCJTY2FsaVwiLCBcIlNjYXJwZWxsaVwiLCBcIlNjYXJzZWxsaVwiLCBcIlNjb3BldGFuaVwiLCBcIlNlY2NpXCIsIFwiU2VsdmlcIiwgXCJTZW5hdG9yaVwiLCBcIlNlbmVzaVwiLCBcIlNlcmFmaW5pXCIsIFwiU2VyZW5pXCIsIFwiU2VycmFcIiwgXCJTZXN0aW5pXCIsIFwiU2d1YW5jaVwiLCBcIlNpZW5pXCIsIFwiU2lnbm9yaW5pXCIsIFwiU2lsdmVzdHJpXCIsIFwiU2ltb25jaW5pXCIsIFwiU2ltb25ldHRpXCIsIFwiU2ltb25pXCIsIFwiU2luZ2hcIiwgXCJTb2RpXCIsIFwiU29sZGlcIiwgXCJTb21pZ2xpXCIsIFwiU29yYmlcIiwgXCJTb3JlbGxpXCIsIFwiU29ycmVudGlub1wiLCBcIlNvdHRpbGlcIiwgXCJTcGluYVwiLCBcIlNwaW5lbGxpXCIsIFwiU3RhY2Npb2xpXCIsIFwiU3RhZGVyaW5pXCIsIFwiU3RlZmFuZWxsaVwiLCBcIlN0ZWZhbmlcIiwgXCJTdGVmYW5pbmlcIiwgXCJTdGVsbGFcIiwgXCJTdXNpbmlcIiwgXCJUYWNjaGlcIiwgXCJUYWNjb25pXCIsIFwiVGFkZGVpXCIsIFwiVGFnbGlhZmVycmlcIiwgXCJUYW1idXJpbmlcIiwgXCJUYW5nYW5lbGxpXCIsIFwiVGFuaVwiLCBcIlRhbmluaVwiLCBcIlRhcGluYXNzaVwiLCBcIlRhcmNoaVwiLCBcIlRhcmNoaWFuaVwiLCBcIlRhcmdpb25pXCIsIFwiVGFzc2lcIiwgXCJUYXNzaW5pXCIsIFwiVGVtcGVzdGlcIiwgXCJUZXJ6YW5pXCIsIFwiVGVzaVwiLCBcIlRlc3RhXCIsIFwiVGVzdGlcIiwgXCJUaWxsaVwiLCBcIlRpbnRpXCIsIFwiVGlyaW5uYW56aVwiLCBcIlRvY2NhZm9uZGlcIiwgXCJUb2ZhbmFyaVwiLCBcIlRvZmFuaVwiLCBcIlRvZ25hY2NpbmlcIiwgXCJUb25lbGxpXCIsIFwiVG9uaW5pXCIsIFwiVG9yZWxsaVwiLCBcIlRvcnJpbmlcIiwgXCJUb3NpXCIsIFwiVG90aVwiLCBcIlRvenppXCIsIFwiVHJhbWJ1c3RpXCIsIFwiVHJhcGFuaVwiLCBcIlR1Y2NpXCIsIFwiVHVyY2hpXCIsIFwiVWdvbGluaVwiLCBcIlVsaXZpXCIsIFwiVmFsZW50ZVwiLCBcIlZhbGVudGlcIiwgXCJWYWxlbnRpbmlcIiwgXCJWYW5nZWxpc3RpXCIsIFwiVmFubmlcIiwgXCJWYW5uaW5pXCIsIFwiVmFubm9uaVwiLCBcIlZhbm5venppXCIsIFwiVmFubnVjY2hpXCIsIFwiVmFubnVjY2lcIiwgXCJWZW50dXJhXCIsIFwiVmVudHVyaVwiLCBcIlZlbnR1cmluaVwiLCBcIlZlc3RyaVwiLCBcIlZldHRvcmlcIiwgXCJWaWNoaVwiLCBcIlZpY2lhbmlcIiwgXCJWaWVyaVwiLCBcIlZpZ2lhbmlcIiwgXCJWaWdub2xpXCIsIFwiVmlnbm9saW5pXCIsIFwiVmlnbm96emlcIiwgXCJWaWxsYW5pXCIsIFwiVmluY2lcIiwgXCJWaXNhbmlcIiwgXCJWaXRhbGVcIiwgXCJWaXRhbGlcIiwgXCJWaXRpXCIsIFwiVml2aWFuaVwiLCBcIlZpdm9saVwiLCBcIlZvbHBlXCIsIFwiVm9scGlcIiwgXCJXYW5nXCIsIFwiV3VcIiwgXCJYdVwiLCBcIllhbmdcIiwgXCJZZVwiLCBcIlphZ2xpXCIsIFwiWmFuaVwiLCBcIlphbmllcmlcIiwgXCJaYW5vYmluaVwiLCBcIlplY2NoaVwiLCBcIlpldHRpXCIsIFwiWmhhbmdcIiwgXCJaaGVuZ1wiLCBcIlpob3VcIiwgXCJaaHVcIiwgXCJaaW5nb25pXCIsIFwiWmluaVwiLCBcIlpvcHBpXCJdXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRGF0YSB0YWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS91bXBpcnNreS9jb3VudHJ5LWxpc3QvYmxvYi9tYXN0ZXIvZGF0YS9lbl9VUy9jb3VudHJ5Lmpzb25cbiAgICAgICAgY291bnRyaWVzOiBbe1wibmFtZVwiOlwiQWZnaGFuaXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiQUZcIn0se1wibmFtZVwiOlwiw4VsYW5kIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiQVhcIn0se1wibmFtZVwiOlwiQWxiYW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBTFwifSx7XCJuYW1lXCI6XCJBbGdlcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRaXCJ9LHtcIm5hbWVcIjpcIkFtZXJpY2FuIFNhbW9hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFTXCJ9LHtcIm5hbWVcIjpcIkFuZG9ycmFcIixcImFiYnJldmlhdGlvblwiOlwiQURcIn0se1wibmFtZVwiOlwiQW5nb2xhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFPXCJ9LHtcIm5hbWVcIjpcIkFuZ3VpbGxhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFJXCJ9LHtcIm5hbWVcIjpcIkFudGFyY3RpY2FcIixcImFiYnJldmlhdGlvblwiOlwiQVFcIn0se1wibmFtZVwiOlwiQW50aWd1YSAmIEJhcmJ1ZGFcIixcImFiYnJldmlhdGlvblwiOlwiQUdcIn0se1wibmFtZVwiOlwiQXJnZW50aW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFSXCJ9LHtcIm5hbWVcIjpcIkFybWVuaWFcIixcImFiYnJldmlhdGlvblwiOlwiQU1cIn0se1wibmFtZVwiOlwiQXJ1YmFcIixcImFiYnJldmlhdGlvblwiOlwiQVdcIn0se1wibmFtZVwiOlwiQXNjZW5zaW9uIElzbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJBQ1wifSx7XCJuYW1lXCI6XCJBdXN0cmFsaWFcIixcImFiYnJldmlhdGlvblwiOlwiQVVcIn0se1wibmFtZVwiOlwiQXVzdHJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBVFwifSx7XCJuYW1lXCI6XCJBemVyYmFpamFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFaXCJ9LHtcIm5hbWVcIjpcIkJhaGFtYXNcIixcImFiYnJldmlhdGlvblwiOlwiQlNcIn0se1wibmFtZVwiOlwiQmFocmFpblwiLFwiYWJicmV2aWF0aW9uXCI6XCJCSFwifSx7XCJuYW1lXCI6XCJCYW5nbGFkZXNoXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJEXCJ9LHtcIm5hbWVcIjpcIkJhcmJhZG9zXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJCXCJ9LHtcIm5hbWVcIjpcIkJlbGFydXNcIixcImFiYnJldmlhdGlvblwiOlwiQllcIn0se1wibmFtZVwiOlwiQmVsZ2l1bVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCRVwifSx7XCJuYW1lXCI6XCJCZWxpemVcIixcImFiYnJldmlhdGlvblwiOlwiQlpcIn0se1wibmFtZVwiOlwiQmVuaW5cIixcImFiYnJldmlhdGlvblwiOlwiQkpcIn0se1wibmFtZVwiOlwiQmVybXVkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCTVwifSx7XCJuYW1lXCI6XCJCaHV0YW5cIixcImFiYnJldmlhdGlvblwiOlwiQlRcIn0se1wibmFtZVwiOlwiQm9saXZpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCT1wifSx7XCJuYW1lXCI6XCJCb3NuaWEgJiBIZXJ6ZWdvdmluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCQVwifSx7XCJuYW1lXCI6XCJCb3Rzd2FuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCV1wifSx7XCJuYW1lXCI6XCJCcmF6aWxcIixcImFiYnJldmlhdGlvblwiOlwiQlJcIn0se1wibmFtZVwiOlwiQnJpdGlzaCBJbmRpYW4gT2NlYW4gVGVycml0b3J5XCIsXCJhYmJyZXZpYXRpb25cIjpcIklPXCJ9LHtcIm5hbWVcIjpcIkJyaXRpc2ggVmlyZ2luIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiVkdcIn0se1wibmFtZVwiOlwiQnJ1bmVpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJOXCJ9LHtcIm5hbWVcIjpcIkJ1bGdhcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJHXCJ9LHtcIm5hbWVcIjpcIkJ1cmtpbmEgRmFzb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCRlwifSx7XCJuYW1lXCI6XCJCdXJ1bmRpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJJXCJ9LHtcIm5hbWVcIjpcIkNhbWJvZGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIktIXCJ9LHtcIm5hbWVcIjpcIkNhbWVyb29uXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNNXCJ9LHtcIm5hbWVcIjpcIkNhbmFkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDQVwifSx7XCJuYW1lXCI6XCJDYW5hcnkgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJJQ1wifSx7XCJuYW1lXCI6XCJDYXBlIFZlcmRlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNWXCJ9LHtcIm5hbWVcIjpcIkNhcmliYmVhbiBOZXRoZXJsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCUVwifSx7XCJuYW1lXCI6XCJDYXltYW4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJLWVwifSx7XCJuYW1lXCI6XCJDZW50cmFsIEFmcmljYW4gUmVwdWJsaWNcIixcImFiYnJldmlhdGlvblwiOlwiQ0ZcIn0se1wibmFtZVwiOlwiQ2V1dGEgJiBNZWxpbGxhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVBXCJ9LHtcIm5hbWVcIjpcIkNoYWRcIixcImFiYnJldmlhdGlvblwiOlwiVERcIn0se1wibmFtZVwiOlwiQ2hpbGVcIixcImFiYnJldmlhdGlvblwiOlwiQ0xcIn0se1wibmFtZVwiOlwiQ2hpbmFcIixcImFiYnJldmlhdGlvblwiOlwiQ05cIn0se1wibmFtZVwiOlwiQ2hyaXN0bWFzIElzbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJDWFwifSx7XCJuYW1lXCI6XCJDb2NvcyAoS2VlbGluZykgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDQ1wifSx7XCJuYW1lXCI6XCJDb2xvbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDT1wifSx7XCJuYW1lXCI6XCJDb21vcm9zXCIsXCJhYmJyZXZpYXRpb25cIjpcIktNXCJ9LHtcIm5hbWVcIjpcIkNvbmdvIC0gQnJhenphdmlsbGVcIixcImFiYnJldmlhdGlvblwiOlwiQ0dcIn0se1wibmFtZVwiOlwiQ29uZ28gLSBLaW5zaGFzYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDRFwifSx7XCJuYW1lXCI6XCJDb29rIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiQ0tcIn0se1wibmFtZVwiOlwiQ29zdGEgUmljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDUlwifSx7XCJuYW1lXCI6XCJDw7R0ZSBkJ0l2b2lyZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDSVwifSx7XCJuYW1lXCI6XCJDcm9hdGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkhSXCJ9LHtcIm5hbWVcIjpcIkN1YmFcIixcImFiYnJldmlhdGlvblwiOlwiQ1VcIn0se1wibmFtZVwiOlwiQ3VyYcOnYW9cIixcImFiYnJldmlhdGlvblwiOlwiQ1dcIn0se1wibmFtZVwiOlwiQ3lwcnVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNZXCJ9LHtcIm5hbWVcIjpcIkN6ZWNoIFJlcHVibGljXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNaXCJ9LHtcIm5hbWVcIjpcIkRlbm1hcmtcIixcImFiYnJldmlhdGlvblwiOlwiREtcIn0se1wibmFtZVwiOlwiRGllZ28gR2FyY2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRHXCJ9LHtcIm5hbWVcIjpcIkRqaWJvdXRpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRKXCJ9LHtcIm5hbWVcIjpcIkRvbWluaWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkRNXCJ9LHtcIm5hbWVcIjpcIkRvbWluaWNhbiBSZXB1YmxpY1wiLFwiYWJicmV2aWF0aW9uXCI6XCJET1wifSx7XCJuYW1lXCI6XCJFY3VhZG9yXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVDXCJ9LHtcIm5hbWVcIjpcIkVneXB0XCIsXCJhYmJyZXZpYXRpb25cIjpcIkVHXCJ9LHtcIm5hbWVcIjpcIkVsIFNhbHZhZG9yXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNWXCJ9LHtcIm5hbWVcIjpcIkVxdWF0b3JpYWwgR3VpbmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdRXCJ9LHtcIm5hbWVcIjpcIkVyaXRyZWFcIixcImFiYnJldmlhdGlvblwiOlwiRVJcIn0se1wibmFtZVwiOlwiRXN0b25pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFRVwifSx7XCJuYW1lXCI6XCJFdGhpb3BpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFVFwifSx7XCJuYW1lXCI6XCJGYWxrbGFuZCBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZLXCJ9LHtcIm5hbWVcIjpcIkZhcm9lIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiRk9cIn0se1wibmFtZVwiOlwiRmlqaVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGSlwifSx7XCJuYW1lXCI6XCJGaW5sYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZJXCJ9LHtcIm5hbWVcIjpcIkZyYW5jZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGUlwifSx7XCJuYW1lXCI6XCJGcmVuY2ggR3VpYW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdGXCJ9LHtcIm5hbWVcIjpcIkZyZW5jaCBQb2x5bmVzaWFcIixcImFiYnJldmlhdGlvblwiOlwiUEZcIn0se1wibmFtZVwiOlwiRnJlbmNoIFNvdXRoZXJuIFRlcnJpdG9yaWVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRGXCJ9LHtcIm5hbWVcIjpcIkdhYm9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdBXCJ9LHtcIm5hbWVcIjpcIkdhbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHTVwifSx7XCJuYW1lXCI6XCJHZW9yZ2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdFXCJ9LHtcIm5hbWVcIjpcIkdlcm1hbnlcIixcImFiYnJldmlhdGlvblwiOlwiREVcIn0se1wibmFtZVwiOlwiR2hhbmFcIixcImFiYnJldmlhdGlvblwiOlwiR0hcIn0se1wibmFtZVwiOlwiR2licmFsdGFyXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdJXCJ9LHtcIm5hbWVcIjpcIkdyZWVjZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHUlwifSx7XCJuYW1lXCI6XCJHcmVlbmxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiR0xcIn0se1wibmFtZVwiOlwiR3JlbmFkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHRFwifSx7XCJuYW1lXCI6XCJHdWFkZWxvdXBlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdQXCJ9LHtcIm5hbWVcIjpcIkd1YW1cIixcImFiYnJldmlhdGlvblwiOlwiR1VcIn0se1wibmFtZVwiOlwiR3VhdGVtYWxhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdUXCJ9LHtcIm5hbWVcIjpcIkd1ZXJuc2V5XCIsXCJhYmJyZXZpYXRpb25cIjpcIkdHXCJ9LHtcIm5hbWVcIjpcIkd1aW5lYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHTlwifSx7XCJuYW1lXCI6XCJHdWluZWEtQmlzc2F1XCIsXCJhYmJyZXZpYXRpb25cIjpcIkdXXCJ9LHtcIm5hbWVcIjpcIkd1eWFuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHWVwifSx7XCJuYW1lXCI6XCJIYWl0aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIVFwifSx7XCJuYW1lXCI6XCJIb25kdXJhc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJITlwifSx7XCJuYW1lXCI6XCJIb25nIEtvbmcgU0FSIENoaW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkhLXCJ9LHtcIm5hbWVcIjpcIkh1bmdhcnlcIixcImFiYnJldmlhdGlvblwiOlwiSFVcIn0se1wibmFtZVwiOlwiSWNlbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJJU1wifSx7XCJuYW1lXCI6XCJJbmRpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJTlwifSx7XCJuYW1lXCI6XCJJbmRvbmVzaWFcIixcImFiYnJldmlhdGlvblwiOlwiSURcIn0se1wibmFtZVwiOlwiSXJhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJJUlwifSx7XCJuYW1lXCI6XCJJcmFxXCIsXCJhYmJyZXZpYXRpb25cIjpcIklRXCJ9LHtcIm5hbWVcIjpcIklyZWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiSUVcIn0se1wibmFtZVwiOlwiSXNsZSBvZiBNYW5cIixcImFiYnJldmlhdGlvblwiOlwiSU1cIn0se1wibmFtZVwiOlwiSXNyYWVsXCIsXCJhYmJyZXZpYXRpb25cIjpcIklMXCJ9LHtcIm5hbWVcIjpcIkl0YWx5XCIsXCJhYmJyZXZpYXRpb25cIjpcIklUXCJ9LHtcIm5hbWVcIjpcIkphbWFpY2FcIixcImFiYnJldmlhdGlvblwiOlwiSk1cIn0se1wibmFtZVwiOlwiSmFwYW5cIixcImFiYnJldmlhdGlvblwiOlwiSlBcIn0se1wibmFtZVwiOlwiSmVyc2V5XCIsXCJhYmJyZXZpYXRpb25cIjpcIkpFXCJ9LHtcIm5hbWVcIjpcIkpvcmRhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJKT1wifSx7XCJuYW1lXCI6XCJLYXpha2hzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIktaXCJ9LHtcIm5hbWVcIjpcIktlbnlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIktFXCJ9LHtcIm5hbWVcIjpcIktpcmliYXRpXCIsXCJhYmJyZXZpYXRpb25cIjpcIktJXCJ9LHtcIm5hbWVcIjpcIktvc292b1wiLFwiYWJicmV2aWF0aW9uXCI6XCJYS1wifSx7XCJuYW1lXCI6XCJLdXdhaXRcIixcImFiYnJldmlhdGlvblwiOlwiS1dcIn0se1wibmFtZVwiOlwiS3lyZ3l6c3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJLR1wifSx7XCJuYW1lXCI6XCJMYW9zXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxBXCJ9LHtcIm5hbWVcIjpcIkxhdHZpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMVlwifSx7XCJuYW1lXCI6XCJMZWJhbm9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxCXCJ9LHtcIm5hbWVcIjpcIkxlc290aG9cIixcImFiYnJldmlhdGlvblwiOlwiTFNcIn0se1wibmFtZVwiOlwiTGliZXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMUlwifSx7XCJuYW1lXCI6XCJMaWJ5YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMWVwifSx7XCJuYW1lXCI6XCJMaWVjaHRlbnN0ZWluXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxJXCJ9LHtcIm5hbWVcIjpcIkxpdGh1YW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMVFwifSx7XCJuYW1lXCI6XCJMdXhlbWJvdXJnXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxVXCJ9LHtcIm5hbWVcIjpcIk1hY2F1IFNBUiBDaGluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNT1wifSx7XCJuYW1lXCI6XCJNYWNlZG9uaWFcIixcImFiYnJldmlhdGlvblwiOlwiTUtcIn0se1wibmFtZVwiOlwiTWFkYWdhc2NhclwiLFwiYWJicmV2aWF0aW9uXCI6XCJNR1wifSx7XCJuYW1lXCI6XCJNYWxhd2lcIixcImFiYnJldmlhdGlvblwiOlwiTVdcIn0se1wibmFtZVwiOlwiTWFsYXlzaWFcIixcImFiYnJldmlhdGlvblwiOlwiTVlcIn0se1wibmFtZVwiOlwiTWFsZGl2ZXNcIixcImFiYnJldmlhdGlvblwiOlwiTVZcIn0se1wibmFtZVwiOlwiTWFsaVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNTFwifSx7XCJuYW1lXCI6XCJNYWx0YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNVFwifSx7XCJuYW1lXCI6XCJNYXJzaGFsbCBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1IXCJ9LHtcIm5hbWVcIjpcIk1hcnRpbmlxdWVcIixcImFiYnJldmlhdGlvblwiOlwiTVFcIn0se1wibmFtZVwiOlwiTWF1cml0YW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNUlwifSx7XCJuYW1lXCI6XCJNYXVyaXRpdXNcIixcImFiYnJldmlhdGlvblwiOlwiTVVcIn0se1wibmFtZVwiOlwiTWF5b3R0ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJZVFwifSx7XCJuYW1lXCI6XCJNZXhpY29cIixcImFiYnJldmlhdGlvblwiOlwiTVhcIn0se1wibmFtZVwiOlwiTWljcm9uZXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGTVwifSx7XCJuYW1lXCI6XCJNb2xkb3ZhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1EXCJ9LHtcIm5hbWVcIjpcIk1vbmFjb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNQ1wifSx7XCJuYW1lXCI6XCJNb25nb2xpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNTlwifSx7XCJuYW1lXCI6XCJNb250ZW5lZ3JvXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1FXCJ9LHtcIm5hbWVcIjpcIk1vbnRzZXJyYXRcIixcImFiYnJldmlhdGlvblwiOlwiTVNcIn0se1wibmFtZVwiOlwiTW9yb2Njb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNQVwifSx7XCJuYW1lXCI6XCJNb3phbWJpcXVlXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1aXCJ9LHtcIm5hbWVcIjpcIk15YW5tYXIgKEJ1cm1hKVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNTVwifSx7XCJuYW1lXCI6XCJOYW1pYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5BXCJ9LHtcIm5hbWVcIjpcIk5hdXJ1XCIsXCJhYmJyZXZpYXRpb25cIjpcIk5SXCJ9LHtcIm5hbWVcIjpcIk5lcGFsXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5QXCJ9LHtcIm5hbWVcIjpcIk5ldGhlcmxhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5MXCJ9LHtcIm5hbWVcIjpcIk5ldyBDYWxlZG9uaWFcIixcImFiYnJldmlhdGlvblwiOlwiTkNcIn0se1wibmFtZVwiOlwiTmV3IFplYWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiTlpcIn0se1wibmFtZVwiOlwiTmljYXJhZ3VhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5JXCJ9LHtcIm5hbWVcIjpcIk5pZ2VyXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5FXCJ9LHtcIm5hbWVcIjpcIk5pZ2VyaWFcIixcImFiYnJldmlhdGlvblwiOlwiTkdcIn0se1wibmFtZVwiOlwiTml1ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOVVwifSx7XCJuYW1lXCI6XCJOb3Jmb2xrIElzbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJORlwifSx7XCJuYW1lXCI6XCJOb3J0aCBLb3JlYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJLUFwifSx7XCJuYW1lXCI6XCJOb3J0aGVybiBNYXJpYW5hIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiTVBcIn0se1wibmFtZVwiOlwiTm9yd2F5XCIsXCJhYmJyZXZpYXRpb25cIjpcIk5PXCJ9LHtcIm5hbWVcIjpcIk9tYW5cIixcImFiYnJldmlhdGlvblwiOlwiT01cIn0se1wibmFtZVwiOlwiUGFraXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiUEtcIn0se1wibmFtZVwiOlwiUGFsYXVcIixcImFiYnJldmlhdGlvblwiOlwiUFdcIn0se1wibmFtZVwiOlwiUGFsZXN0aW5pYW4gVGVycml0b3JpZXNcIixcImFiYnJldmlhdGlvblwiOlwiUFNcIn0se1wibmFtZVwiOlwiUGFuYW1hXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBBXCJ9LHtcIm5hbWVcIjpcIlBhcHVhIE5ldyBHdWluZWFcIixcImFiYnJldmlhdGlvblwiOlwiUEdcIn0se1wibmFtZVwiOlwiUGFyYWd1YXlcIixcImFiYnJldmlhdGlvblwiOlwiUFlcIn0se1wibmFtZVwiOlwiUGVydVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQRVwifSx7XCJuYW1lXCI6XCJQaGlsaXBwaW5lc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQSFwifSx7XCJuYW1lXCI6XCJQaXRjYWlybiBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlBOXCJ9LHtcIm5hbWVcIjpcIlBvbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJQTFwifSx7XCJuYW1lXCI6XCJQb3J0dWdhbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJQVFwifSx7XCJuYW1lXCI6XCJQdWVydG8gUmljb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQUlwifSx7XCJuYW1lXCI6XCJRYXRhclwiLFwiYWJicmV2aWF0aW9uXCI6XCJRQVwifSx7XCJuYW1lXCI6XCJSw6l1bmlvblwiLFwiYWJicmV2aWF0aW9uXCI6XCJSRVwifSx7XCJuYW1lXCI6XCJSb21hbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJPXCJ9LHtcIm5hbWVcIjpcIlJ1c3NpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJSVVwifSx7XCJuYW1lXCI6XCJSd2FuZGFcIixcImFiYnJldmlhdGlvblwiOlwiUldcIn0se1wibmFtZVwiOlwiU2Ftb2FcIixcImFiYnJldmlhdGlvblwiOlwiV1NcIn0se1wibmFtZVwiOlwiU2FuIE1hcmlub1wiLFwiYWJicmV2aWF0aW9uXCI6XCJTTVwifSx7XCJuYW1lXCI6XCJTw6NvIFRvbcOpIGFuZCBQcsOtbmNpcGVcIixcImFiYnJldmlhdGlvblwiOlwiU1RcIn0se1wibmFtZVwiOlwiU2F1ZGkgQXJhYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNBXCJ9LHtcIm5hbWVcIjpcIlNlbmVnYWxcIixcImFiYnJldmlhdGlvblwiOlwiU05cIn0se1wibmFtZVwiOlwiU2VyYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJTXCJ9LHtcIm5hbWVcIjpcIlNleWNoZWxsZXNcIixcImFiYnJldmlhdGlvblwiOlwiU0NcIn0se1wibmFtZVwiOlwiU2llcnJhIExlb25lXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNMXCJ9LHtcIm5hbWVcIjpcIlNpbmdhcG9yZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTR1wifSx7XCJuYW1lXCI6XCJTaW50IE1hYXJ0ZW5cIixcImFiYnJldmlhdGlvblwiOlwiU1hcIn0se1wibmFtZVwiOlwiU2xvdmFraWFcIixcImFiYnJldmlhdGlvblwiOlwiU0tcIn0se1wibmFtZVwiOlwiU2xvdmVuaWFcIixcImFiYnJldmlhdGlvblwiOlwiU0lcIn0se1wibmFtZVwiOlwiU29sb21vbiBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNCXCJ9LHtcIm5hbWVcIjpcIlNvbWFsaWFcIixcImFiYnJldmlhdGlvblwiOlwiU09cIn0se1wibmFtZVwiOlwiU291dGggQWZyaWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlpBXCJ9LHtcIm5hbWVcIjpcIlNvdXRoIEdlb3JnaWEgJiBTb3V0aCBTYW5kd2ljaCBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdTXCJ9LHtcIm5hbWVcIjpcIlNvdXRoIEtvcmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIktSXCJ9LHtcIm5hbWVcIjpcIlNvdXRoIFN1ZGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNTXCJ9LHtcIm5hbWVcIjpcIlNwYWluXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVTXCJ9LHtcIm5hbWVcIjpcIlNyaSBMYW5rYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJMS1wifSx7XCJuYW1lXCI6XCJTdC4gQmFydGjDqWxlbXlcIixcImFiYnJldmlhdGlvblwiOlwiQkxcIn0se1wibmFtZVwiOlwiU3QuIEhlbGVuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTSFwifSx7XCJuYW1lXCI6XCJTdC4gS2l0dHMgJiBOZXZpc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJLTlwifSx7XCJuYW1lXCI6XCJTdC4gTHVjaWFcIixcImFiYnJldmlhdGlvblwiOlwiTENcIn0se1wibmFtZVwiOlwiU3QuIE1hcnRpblwiLFwiYWJicmV2aWF0aW9uXCI6XCJNRlwifSx7XCJuYW1lXCI6XCJTdC4gUGllcnJlICYgTWlxdWVsb25cIixcImFiYnJldmlhdGlvblwiOlwiUE1cIn0se1wibmFtZVwiOlwiU3QuIFZpbmNlbnQgJiBHcmVuYWRpbmVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZDXCJ9LHtcIm5hbWVcIjpcIlN1ZGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNEXCJ9LHtcIm5hbWVcIjpcIlN1cmluYW1lXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNSXCJ9LHtcIm5hbWVcIjpcIlN2YWxiYXJkICYgSmFuIE1heWVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNKXCJ9LHtcIm5hbWVcIjpcIlN3YXppbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJTWlwifSx7XCJuYW1lXCI6XCJTd2VkZW5cIixcImFiYnJldmlhdGlvblwiOlwiU0VcIn0se1wibmFtZVwiOlwiU3dpdHplcmxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiQ0hcIn0se1wibmFtZVwiOlwiU3lyaWFcIixcImFiYnJldmlhdGlvblwiOlwiU1lcIn0se1wibmFtZVwiOlwiVGFpd2FuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRXXCJ9LHtcIm5hbWVcIjpcIlRhamlraXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiVEpcIn0se1wibmFtZVwiOlwiVGFuemFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiVFpcIn0se1wibmFtZVwiOlwiVGhhaWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiVEhcIn0se1wibmFtZVwiOlwiVGltb3ItTGVzdGVcIixcImFiYnJldmlhdGlvblwiOlwiVExcIn0se1wibmFtZVwiOlwiVG9nb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJUR1wifSx7XCJuYW1lXCI6XCJUb2tlbGF1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlRLXCJ9LHtcIm5hbWVcIjpcIlRvbmdhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRPXCJ9LHtcIm5hbWVcIjpcIlRyaW5pZGFkICYgVG9iYWdvXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRUXCJ9LHtcIm5hbWVcIjpcIlRyaXN0YW4gZGEgQ3VuaGFcIixcImFiYnJldmlhdGlvblwiOlwiVEFcIn0se1wibmFtZVwiOlwiVHVuaXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUTlwifSx7XCJuYW1lXCI6XCJUdXJrZXlcIixcImFiYnJldmlhdGlvblwiOlwiVFJcIn0se1wibmFtZVwiOlwiVHVya21lbmlzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRNXCJ9LHtcIm5hbWVcIjpcIlR1cmtzICYgQ2FpY29zIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiVENcIn0se1wibmFtZVwiOlwiVHV2YWx1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlRWXCJ9LHtcIm5hbWVcIjpcIlUuUy4gT3V0bHlpbmcgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJVTVwifSx7XCJuYW1lXCI6XCJVLlMuIFZpcmdpbiBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZJXCJ9LHtcIm5hbWVcIjpcIlVnYW5kYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJVR1wifSx7XCJuYW1lXCI6XCJVa3JhaW5lXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVBXCJ9LHtcIm5hbWVcIjpcIlVuaXRlZCBBcmFiIEVtaXJhdGVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFFXCJ9LHtcIm5hbWVcIjpcIlVuaXRlZCBLaW5nZG9tXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdCXCJ9LHtcIm5hbWVcIjpcIlVuaXRlZCBTdGF0ZXNcIixcImFiYnJldmlhdGlvblwiOlwiVVNcIn0se1wibmFtZVwiOlwiVXJ1Z3VheVwiLFwiYWJicmV2aWF0aW9uXCI6XCJVWVwifSx7XCJuYW1lXCI6XCJVemJla2lzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVaXCJ9LHtcIm5hbWVcIjpcIlZhbnVhdHVcIixcImFiYnJldmlhdGlvblwiOlwiVlVcIn0se1wibmFtZVwiOlwiVmF0aWNhbiBDaXR5XCIsXCJhYmJyZXZpYXRpb25cIjpcIlZBXCJ9LHtcIm5hbWVcIjpcIlZlbmV6dWVsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWRVwifSx7XCJuYW1lXCI6XCJWaWV0bmFtXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZOXCJ9LHtcIm5hbWVcIjpcIldhbGxpcyAmIEZ1dHVuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJXRlwifSx7XCJuYW1lXCI6XCJXZXN0ZXJuIFNhaGFyYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFSFwifSx7XCJuYW1lXCI6XCJZZW1lblwiLFwiYWJicmV2aWF0aW9uXCI6XCJZRVwifSx7XCJuYW1lXCI6XCJaYW1iaWFcIixcImFiYnJldmlhdGlvblwiOlwiWk1cIn0se1wibmFtZVwiOlwiWmltYmFid2VcIixcImFiYnJldmlhdGlvblwiOlwiWldcIn1dLFxuXG5cdFx0Y291bnRpZXM6IHtcbiAgICAgICAgICAgIC8vIERhdGEgdGFrZW4gZnJvbSBodHRwOi8vd3d3LmRvd25sb2FkZXhjZWxmaWxlcy5jb20vZ2JfZW4vZG93bmxvYWQtZXhjZWwtZmlsZS1saXN0LWNvdW50aWVzLXVrXG4gICAgICAgICAgICBcInVrXCI6IFtcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JhdGggYW5kIE5vcnRoIEVhc3QgU29tZXJzZXQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0FiZXJkZWVuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0FuZ2xlc2V5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdBbmd1cyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQmVkZm9yZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQmxhY2tidXJuIHdpdGggRGFyd2VuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCbGFja3Bvb2wnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JvdXJuZW1vdXRoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCcmFja25lbGwgRm9yZXN0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCcmlnaHRvbiAmIEhvdmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0JyaXN0b2wnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0J1Y2tpbmdoYW1zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2FtYnJpZGdlc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Nhcm1hcnRoZW5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2VudHJhbCBCZWRmb3Jkc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NlcmVkaWdpb24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NoZXNoaXJlIEVhc3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NoZXNoaXJlIFdlc3QgYW5kIENoZXN0ZXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NsYWNrbWFubmFuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Nvbnd5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDb3Jud2FsbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IEFudHJpbSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IEFybWFnaCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IERvd24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBEdXJoYW0nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBGZXJtYW5hZ2gnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdW50eSBMb25kb25kZXJyeSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ291bnR5IFR5cm9uZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ3VtYnJpYSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRGFybGluZ3Rvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRGVuYmlnaHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEZXJieSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRGVyYnlzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRGV2b24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RvcnNldCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRHVtZnJpZXMgYW5kIEdhbGxvd2F5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdEdW5kZWUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Vhc3QgTG90aGlhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRWFzdCBSaWRpbmcgb2YgWW9ya3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdFYXN0IFN1c3NleCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRWRpbmJ1cmdoPyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnRXNzZXgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0ZhbGtpcmsnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0ZpZmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0ZsaW50c2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dsb3VjZXN0ZXJzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3JlYXRlciBMb25kb24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dyZWF0ZXIgTWFuY2hlc3Rlcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3dlbnQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0d3eW5lZGQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hhbHRvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnSGFtcHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIYXJ0bGVwb29sJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIZXJlZm9yZHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIZXJ0Zm9yZHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdIaWdobGFuZHMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0h1bGwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0lzbGUgb2YgV2lnaHQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0lzbGVzIG9mIFNjaWxseSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnS2VudCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGFuY2FzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGVpY2VzdGVyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMZWljZXN0ZXJzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTGluY29sbnNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMb3RoaWFuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdMdXRvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTWVkd2F5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNZXJzZXlzaWRlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNaWQgR2xhbW9yZ2FuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNaWRkbGVzYnJvdWdoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNaWx0b24gS2V5bmVzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNb25tb3V0aHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNb3JheSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9yZm9sayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggRWFzdCBMaW5jb2xuc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRoIExpbmNvbG5zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggU29tZXJzZXQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRoIFlvcmtzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGhhbXB0b25zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTm9ydGh1bWJlcmxhbmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vdHRpbmdoYW0nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vdHRpbmdoYW1zaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnT3hmb3Jkc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BlbWJyb2tlc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BlcnRoIGFuZCBLaW5yb3NzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQZXRlcmJvcm91Z2gnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1BseW1vdXRoJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQb29sZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUG9ydHNtb3V0aCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUG93eXMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JlYWRpbmcnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JlZGNhciBhbmQgQ2xldmVsYW5kJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSdXRsYW5kJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTY290dGlzaCBCb3JkZXJzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTaHJvcHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTbG91Z2gnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvbWVyc2V0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb3V0aCBHbGFtb3JnYW4nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NvdXRoIEdsb3VjZXN0ZXJzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU291dGggWW9ya3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTb3V0aGFtcHRvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU291dGhlbmQtb24tU2VhJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdGFmZm9yZHNoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdGlybGluZ3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdG9ja3Rvbi1vbi1UZWVzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdG9rZS1vbi1UcmVudCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RyYXRoY2x5ZGUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N1ZmZvbGsnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1N1cnJleSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3dpbmRvbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVGVsZm9yZCBhbmQgV3Jla2luJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUaHVycm9jayd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVG9yYmF5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdUeW5lIGFuZCBXZWFyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXYXJyaW5ndG9uJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXYXJ3aWNrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3QgQmVya3NoaXJlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IEdsYW1vcmdhbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBMb3RoaWFuJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IE1pZGxhbmRzJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXZXN0IFN1c3NleCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBZb3Jrc2hpcmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dlc3Rlcm4gSXNsZXMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1dpbHRzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV2luZHNvciBhbmQgTWFpZGVuaGVhZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV29raW5naGFtJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXb3JjZXN0ZXJzaGlyZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnV3JleGhhbSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnWW9yayd9XVxuXHRcdFx0XHR9LFxuICAgICAgICBwcm92aW5jZXM6IHtcbiAgICAgICAgICAgIFwiY2FcIjogW1xuICAgICAgICAgICAgICAgIHtuYW1lOiAnQWxiZXJ0YScsIGFiYnJldmlhdGlvbjogJ0FCJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdCcml0aXNoIENvbHVtYmlhJywgYWJicmV2aWF0aW9uOiAnQkMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01hbml0b2JhJywgYWJicmV2aWF0aW9uOiAnTUInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05ldyBCcnVuc3dpY2snLCBhYmJyZXZpYXRpb246ICdOQid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTmV3Zm91bmRsYW5kIGFuZCBMYWJyYWRvcicsIGFiYnJldmlhdGlvbjogJ05MJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOb3ZhIFNjb3RpYScsIGFiYnJldmlhdGlvbjogJ05TJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdPbnRhcmlvJywgYWJicmV2aWF0aW9uOiAnT04nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1ByaW5jZSBFZHdhcmQgSXNsYW5kJywgYWJicmV2aWF0aW9uOiAnUEUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1F1ZWJlYycsIGFiYnJldmlhdGlvbjogJ1FDJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTYXNrYXRjaGV3YW4nLCBhYmJyZXZpYXRpb246ICdTSyd9LFxuXG4gICAgICAgICAgICAgICAgLy8gVGhlIGNhc2UgY291bGQgYmUgbWFkZSB0aGF0IHRoZSBmb2xsb3dpbmcgYXJlIG5vdCBhY3R1YWxseSBwcm92aW5jZXNcbiAgICAgICAgICAgICAgICAvLyBzaW5jZSB0aGV5IGFyZSB0ZWNobmljYWxseSBjb25zaWRlcmVkIFwidGVycml0b3JpZXNcIiBob3dldmVyIHRoZXkgYWxsXG4gICAgICAgICAgICAgICAgLy8gbG9vayB0aGUgc2FtZSBvbiBhbiBlbnZlbG9wZSFcbiAgICAgICAgICAgICAgICB7bmFtZTogJ05vcnRod2VzdCBUZXJyaXRvcmllcycsIGFiYnJldmlhdGlvbjogJ05UJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdOdW5hdnV0JywgYWJicmV2aWF0aW9uOiAnTlUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1l1a29uJywgYWJicmV2aWF0aW9uOiAnWVQnfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFwiaXRcIjogW1xuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBZ3JpZ2VudG9cIiwgYWJicmV2aWF0aW9uOiBcIkFHXCIsIGNvZGU6IDg0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFsZXNzYW5kcmlhXCIsIGFiYnJldmlhdGlvbjogXCJBTFwiLCBjb2RlOiA2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFuY29uYVwiLCBhYmJyZXZpYXRpb246IFwiQU5cIiwgY29kZTogNDIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQW9zdGFcIiwgYWJicmV2aWF0aW9uOiBcIkFPXCIsIGNvZGU6IDcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTCdBcXVpbGFcIiwgYWJicmV2aWF0aW9uOiBcIkFRXCIsIGNvZGU6IDY2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFyZXp6b1wiLCBhYmJyZXZpYXRpb246IFwiQVJcIiwgY29kZTogNTEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQXNjb2xpLVBpY2Vub1wiLCBhYmJyZXZpYXRpb246IFwiQVBcIiwgY29kZTogNDQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQXN0aVwiLCBhYmJyZXZpYXRpb246IFwiQVRcIiwgY29kZTogNSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBdmVsbGlub1wiLCBhYmJyZXZpYXRpb246IFwiQVZcIiwgY29kZTogNjQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmFyaVwiLCBhYmJyZXZpYXRpb246IFwiQkFcIiwgY29kZTogNzIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmFybGV0dGEtQW5kcmlhLVRyYW5pXCIsIGFiYnJldmlhdGlvbjogXCJCVFwiLCBjb2RlOiA3MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCZWxsdW5vXCIsIGFiYnJldmlhdGlvbjogXCJCTFwiLCBjb2RlOiAyNSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJCZW5ldmVudG9cIiwgYWJicmV2aWF0aW9uOiBcIkJOXCIsIGNvZGU6IDYyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJlcmdhbW9cIiwgYWJicmV2aWF0aW9uOiBcIkJHXCIsIGNvZGU6IDE2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkJpZWxsYVwiLCBhYmJyZXZpYXRpb246IFwiQklcIiwgY29kZTogOTYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQm9sb2duYVwiLCBhYmJyZXZpYXRpb246IFwiQk9cIiwgY29kZTogMzcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQm9semFub1wiLCBhYmJyZXZpYXRpb246IFwiQlpcIiwgY29kZTogMjEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQnJlc2NpYVwiLCBhYmJyZXZpYXRpb246IFwiQlNcIiwgY29kZTogMTcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQnJpbmRpc2lcIiwgYWJicmV2aWF0aW9uOiBcIkJSXCIsIGNvZGU6IDc0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNhZ2xpYXJpXCIsIGFiYnJldmlhdGlvbjogXCJDQVwiLCBjb2RlOiA5MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYWx0YW5pc3NldHRhXCIsIGFiYnJldmlhdGlvbjogXCJDTFwiLCBjb2RlOiA4NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYW1wb2Jhc3NvXCIsIGFiYnJldmlhdGlvbjogXCJDQlwiLCBjb2RlOiA3MCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYXJib25pYSBJZ2xlc2lhc1wiLCBhYmJyZXZpYXRpb246IFwiQ0lcIiwgY29kZTogNzAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FzZXJ0YVwiLCBhYmJyZXZpYXRpb246IFwiQ0VcIiwgY29kZTogNjEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2F0YW5pYVwiLCBhYmJyZXZpYXRpb246IFwiQ1RcIiwgY29kZTogODcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2F0YW56YXJvXCIsIGFiYnJldmlhdGlvbjogXCJDWlwiLCBjb2RlOiA3OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDaGlldGlcIiwgYWJicmV2aWF0aW9uOiBcIkNIXCIsIGNvZGU6IDY5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNvbW9cIiwgYWJicmV2aWF0aW9uOiBcIkNPXCIsIGNvZGU6IDEzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNvc2VuemFcIiwgYWJicmV2aWF0aW9uOiBcIkNTXCIsIGNvZGU6IDc4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNyZW1vbmFcIiwgYWJicmV2aWF0aW9uOiBcIkNSXCIsIGNvZGU6IDE5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkNyb3RvbmVcIiwgYWJicmV2aWF0aW9uOiBcIktSXCIsIGNvZGU6IDEwMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDdW5lb1wiLCBhYmJyZXZpYXRpb246IFwiQ05cIiwgY29kZTogNCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJFbm5hXCIsIGFiYnJldmlhdGlvbjogXCJFTlwiLCBjb2RlOiA4NiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGZXJtb1wiLCBhYmJyZXZpYXRpb246IFwiRk1cIiwgY29kZTogODYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRmVycmFyYVwiLCBhYmJyZXZpYXRpb246IFwiRkVcIiwgY29kZTogMzggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRmlyZW56ZVwiLCBhYmJyZXZpYXRpb246IFwiRklcIiwgY29kZTogNDggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRm9nZ2lhXCIsIGFiYnJldmlhdGlvbjogXCJGR1wiLCBjb2RlOiA3MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJGb3JsaS1DZXNlbmFcIiwgYWJicmV2aWF0aW9uOiBcIkZDXCIsIGNvZGU6IDcxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZyb3Npbm9uZVwiLCBhYmJyZXZpYXRpb246IFwiRlJcIiwgY29kZTogNjAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiR2Vub3ZhXCIsIGFiYnJldmlhdGlvbjogXCJHRVwiLCBjb2RlOiAxMCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJHb3JpemlhXCIsIGFiYnJldmlhdGlvbjogXCJHT1wiLCBjb2RlOiAzMSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJHcm9zc2V0b1wiLCBhYmJyZXZpYXRpb246IFwiR1JcIiwgY29kZTogNTMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiSW1wZXJpYVwiLCBhYmJyZXZpYXRpb246IFwiSU1cIiwgY29kZTogOCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJJc2VybmlhXCIsIGFiYnJldmlhdGlvbjogXCJJU1wiLCBjb2RlOiA5NCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMYS1TcGV6aWFcIiwgYWJicmV2aWF0aW9uOiBcIlNQXCIsIGNvZGU6IDY2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxhdGluYVwiLCBhYmJyZXZpYXRpb246IFwiTFRcIiwgY29kZTogNTkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGVjY2VcIiwgYWJicmV2aWF0aW9uOiBcIkxFXCIsIGNvZGU6IDc1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkxlY2NvXCIsIGFiYnJldmlhdGlvbjogXCJMQ1wiLCBjb2RlOiA5NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMaXZvcm5vXCIsIGFiYnJldmlhdGlvbjogXCJMSVwiLCBjb2RlOiA0OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMb2RpXCIsIGFiYnJldmlhdGlvbjogXCJMT1wiLCBjb2RlOiA5OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMdWNjYVwiLCBhYmJyZXZpYXRpb246IFwiTFVcIiwgY29kZTogNDYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWFjZXJhdGFcIiwgYWJicmV2aWF0aW9uOiBcIk1DXCIsIGNvZGU6IDQzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1hbnRvdmFcIiwgYWJicmV2aWF0aW9uOiBcIk1OXCIsIGNvZGU6IDIwIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1hc3NhLUNhcnJhcmFcIiwgYWJicmV2aWF0aW9uOiBcIk1TXCIsIGNvZGU6IDQ1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1hdGVyYVwiLCBhYmJyZXZpYXRpb246IFwiTVRcIiwgY29kZTogNzcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWVkaW8gQ2FtcGlkYW5vXCIsIGFiYnJldmlhdGlvbjogXCJWU1wiLCBjb2RlOiA3NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNZXNzaW5hXCIsIGFiYnJldmlhdGlvbjogXCJNRVwiLCBjb2RlOiA4MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJNaWxhbm9cIiwgYWJicmV2aWF0aW9uOiBcIk1JXCIsIGNvZGU6IDE1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk1vZGVuYVwiLCBhYmJyZXZpYXRpb246IFwiTU9cIiwgY29kZTogMzYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTW9uemEtQnJpYW56YVwiLCBhYmJyZXZpYXRpb246IFwiTUJcIiwgY29kZTogMzYgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTmFwb2xpXCIsIGFiYnJldmlhdGlvbjogXCJOQVwiLCBjb2RlOiA2MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJOb3ZhcmFcIiwgYWJicmV2aWF0aW9uOiBcIk5PXCIsIGNvZGU6IDMgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTnVvcm9cIiwgYWJicmV2aWF0aW9uOiBcIk5VXCIsIGNvZGU6IDkxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIk9nbGlhc3RyYVwiLCBhYmJyZXZpYXRpb246IFwiT0dcIiwgY29kZTogOTEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiT2xiaWEgVGVtcGlvXCIsIGFiYnJldmlhdGlvbjogXCJPVFwiLCBjb2RlOiA5MSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJPcmlzdGFub1wiLCBhYmJyZXZpYXRpb246IFwiT1JcIiwgY29kZTogOTUgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGFkb3ZhXCIsIGFiYnJldmlhdGlvbjogXCJQRFwiLCBjb2RlOiAyOCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQYWxlcm1vXCIsIGFiYnJldmlhdGlvbjogXCJQQVwiLCBjb2RlOiA4MiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQYXJtYVwiLCBhYmJyZXZpYXRpb246IFwiUFJcIiwgY29kZTogMzQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUGF2aWFcIiwgYWJicmV2aWF0aW9uOiBcIlBWXCIsIGNvZGU6IDE4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBlcnVnaWFcIiwgYWJicmV2aWF0aW9uOiBcIlBHXCIsIGNvZGU6IDU0IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBlc2Fyby1VcmJpbm9cIiwgYWJicmV2aWF0aW9uOiBcIlBVXCIsIGNvZGU6IDQxIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBlc2NhcmFcIiwgYWJicmV2aWF0aW9uOiBcIlBFXCIsIGNvZGU6IDY4IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBpYWNlbnphXCIsIGFiYnJldmlhdGlvbjogXCJQQ1wiLCBjb2RlOiAzMyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQaXNhXCIsIGFiYnJldmlhdGlvbjogXCJQSVwiLCBjb2RlOiA1MCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQaXN0b2lhXCIsIGFiYnJldmlhdGlvbjogXCJQVFwiLCBjb2RlOiA0NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQb3JkZW5vbmVcIiwgYWJicmV2aWF0aW9uOiBcIlBOXCIsIGNvZGU6IDkzIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlBvdGVuemFcIiwgYWJicmV2aWF0aW9uOiBcIlBaXCIsIGNvZGU6IDc2IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlByYXRvXCIsIGFiYnJldmlhdGlvbjogXCJQT1wiLCBjb2RlOiAxMDAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUmFndXNhXCIsIGFiYnJldmlhdGlvbjogXCJSR1wiLCBjb2RlOiA4OCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSYXZlbm5hXCIsIGFiYnJldmlhdGlvbjogXCJSQVwiLCBjb2RlOiAzOSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSZWdnaW8tQ2FsYWJyaWFcIiwgYWJicmV2aWF0aW9uOiBcIlJDXCIsIGNvZGU6IDM1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJlZ2dpby1FbWlsaWFcIiwgYWJicmV2aWF0aW9uOiBcIlJFXCIsIGNvZGU6IDM1IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJpZXRpXCIsIGFiYnJldmlhdGlvbjogXCJSSVwiLCBjb2RlOiA1NyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJSaW1pbmlcIiwgYWJicmV2aWF0aW9uOiBcIlJOXCIsIGNvZGU6IDk5IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlJvbWFcIiwgYWJicmV2aWF0aW9uOiBcIlJvbWFcIiwgY29kZTogNTggfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiUm92aWdvXCIsIGFiYnJldmlhdGlvbjogXCJST1wiLCBjb2RlOiAyOSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTYWxlcm5vXCIsIGFiYnJldmlhdGlvbjogXCJTQVwiLCBjb2RlOiA2NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTYXNzYXJpXCIsIGFiYnJldmlhdGlvbjogXCJTU1wiLCBjb2RlOiA5MCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTYXZvbmFcIiwgYWJicmV2aWF0aW9uOiBcIlNWXCIsIGNvZGU6IDkgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2llbmFcIiwgYWJicmV2aWF0aW9uOiBcIlNJXCIsIGNvZGU6IDUyIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlNpcmFjdXNhXCIsIGFiYnJldmlhdGlvbjogXCJTUlwiLCBjb2RlOiA4OSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJTb25kcmlvXCIsIGFiYnJldmlhdGlvbjogXCJTT1wiLCBjb2RlOiAxNCB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUYXJhbnRvXCIsIGFiYnJldmlhdGlvbjogXCJUQVwiLCBjb2RlOiA3MyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUZXJhbW9cIiwgYWJicmV2aWF0aW9uOiBcIlRFXCIsIGNvZGU6IDY3IH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRlcm5pXCIsIGFiYnJldmlhdGlvbjogXCJUUlwiLCBjb2RlOiA1NSB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUb3Jpbm9cIiwgYWJicmV2aWF0aW9uOiBcIlRPXCIsIGNvZGU6IDEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVHJhcGFuaVwiLCBhYmJyZXZpYXRpb246IFwiVFBcIiwgY29kZTogODEgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVHJlbnRvXCIsIGFiYnJldmlhdGlvbjogXCJUTlwiLCBjb2RlOiAyMiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUcmV2aXNvXCIsIGFiYnJldmlhdGlvbjogXCJUVlwiLCBjb2RlOiAyNiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJUcmllc3RlXCIsIGFiYnJldmlhdGlvbjogXCJUU1wiLCBjb2RlOiAzMiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJVZGluZVwiLCBhYmJyZXZpYXRpb246IFwiVURcIiwgY29kZTogMzAgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmFyZXNlXCIsIGFiYnJldmlhdGlvbjogXCJWQVwiLCBjb2RlOiAxMiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWZW5lemlhXCIsIGFiYnJldmlhdGlvbjogXCJWRVwiLCBjb2RlOiAyNyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWZXJiYW5pYVwiLCBhYmJyZXZpYXRpb246IFwiVkJcIiwgY29kZTogMjcgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmVyY2VsbGlcIiwgYWJicmV2aWF0aW9uOiBcIlZDXCIsIGNvZGU6IDIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmVyb25hXCIsIGFiYnJldmlhdGlvbjogXCJWUlwiLCBjb2RlOiAyMyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWaWJvLVZhbGVudGlhXCIsIGFiYnJldmlhdGlvbjogXCJWVlwiLCBjb2RlOiAxMDIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVmljZW56YVwiLCBhYmJyZXZpYXRpb246IFwiVklcIiwgY29kZTogMjQgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiVml0ZXJib1wiLCBhYmJyZXZpYXRpb246IFwiVlRcIiwgY29kZTogNTYgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9LFxuXG4gICAgICAgICAgICAvLyBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vc2Ftc2FyZ2VudC9Vc2VmdWwtQXV0b2NvbXBsZXRlLURhdGEvYmxvYi9tYXN0ZXIvZGF0YS9uYXRpb25hbGl0aWVzLmpzb25cbiAgICAgICAgbmF0aW9uYWxpdGllczogW1xuICAgICAgICAgICB7bmFtZTogJ0FmZ2hhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FsYmFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQWxnZXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBbWVyaWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FuZG9ycmFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQW5nb2xhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0FudGlndWFucyd9LFxuICAgICAgICAgICB7bmFtZTogJ0FyZ2VudGluZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQXJtZW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBdXN0cmFsaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQXVzdHJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdBemVyYmFpamFuaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JhaGFtaSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JhaHJhaW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmFuZ2xhZGVzaGknfSxcbiAgICAgICAgICAge25hbWU6ICdCYXJiYWRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCYXJidWRhbnMnfSxcbiAgICAgICAgICAge25hbWU6ICdCYXRzd2FuYSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JlbGFydXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCZWxnaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQmVsaXplYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdCZW5pbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JodXRhbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0JvbGl2aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQm9zbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JyYXppbGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0JyaXRpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdCcnVuZWlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0J1bGdhcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0J1cmtpbmFiZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0J1cm1lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdCdXJ1bmRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDYW1ib2RpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDYW1lcm9vbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NhbmFkaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2FwZSBWZXJkZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2VudHJhbCBBZnJpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ2hhZGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NoaWxlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDaGluZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ29sb21iaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ29tb3Jhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0NvbmdvbGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0Nvc3RhIFJpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnQ3JvYXRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdDdWJhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0N5cHJpb3QnfSxcbiAgICAgICAgICAge25hbWU6ICdDemVjaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0RhbmlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ0RqaWJvdXRpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRG9taW5pY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRHV0Y2gnfSxcbiAgICAgICAgICAge25hbWU6ICdFYXN0IFRpbW9yZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRWN1YWRvcmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0VneXB0aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRW1pcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0VxdWF0b3JpYWwgR3VpbmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0VyaXRyZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnRXN0b25pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdFdGhpb3BpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdGaWppYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdGaWxpcGlubyd9LFxuICAgICAgICAgICB7bmFtZTogJ0Zpbm5pc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdGcmVuY2gnfSxcbiAgICAgICAgICAge25hbWU6ICdHYWJvbmVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ0dhbWJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHZW9yZ2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0dlcm1hbid9LFxuICAgICAgICAgICB7bmFtZTogJ0doYW5haWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3JlZWsnfSxcbiAgICAgICAgICAge25hbWU6ICdHcmVuYWRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdHdWF0ZW1hbGFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3VpbmVhLUJpc3NhdWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnR3VpbmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0d1eWFuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSGFpdGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0hlcnplZ292aW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdIb25kdXJhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0h1bmdhcmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0ktS2lyaWJhdGknfSxcbiAgICAgICAgICAge25hbWU6ICdJY2VsYW5kZXInfSxcbiAgICAgICAgICAge25hbWU6ICdJbmRpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdJbmRvbmVzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXJhbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0lyYXFpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXJpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdJc3JhZWxpJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSXRhbGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0l2b3JpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdKYW1haWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0phcGFuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnSm9yZGFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnS2F6YWtoc3RhbmknfSxcbiAgICAgICAgICAge25hbWU6ICdLZW55YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdLaXR0aWFuIGFuZCBOZXZpc2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0t1d2FpdGknfSxcbiAgICAgICAgICAge25hbWU6ICdLeXJneXonfSxcbiAgICAgICAgICAge25hbWU6ICdMYW90aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGF0dmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ0xlYmFuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTGliZXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdMaWJ5YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdMaWVjaHRlbnN0ZWluZXInfSxcbiAgICAgICAgICAge25hbWU6ICdMaXRodWFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTHV4ZW1ib3VyZ2VyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFjZWRvbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hbGFnYXN5J30sXG4gICAgICAgICAgIHtuYW1lOiAnTWFsYXdpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYWxheXNpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNYWxkaXZhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hbGlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01hbHRlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdNYXJzaGFsbGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ01hdXJpdGFuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWF1cml0aWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTWV4aWNhbid9LFxuICAgICAgICAgICB7bmFtZTogJ01pY3JvbmVzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW9sZG92YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNb25hY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW9uZ29saWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW9yb2NjYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdNb3NvdGhvJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTW90c3dhbmEnfSxcbiAgICAgICAgICAge25hbWU6ICdNb3phbWJpY2FuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmFtaWJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOYXVydWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmVwYWxlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdOZXcgWmVhbGFuZGVyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmljYXJhZ3Vhbid9LFxuICAgICAgICAgICB7bmFtZTogJ05pZ2VyaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnTmlnZXJpZW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOb3J0aCBLb3JlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdOb3J0aGVybiBJcmlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ05vcndlZ2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ09tYW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGFraXN0YW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUGFsYXVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1BhbmFtYW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdQYXB1YSBOZXcgR3VpbmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1BhcmFndWF5YW4nfSxcbiAgICAgICAgICAge25hbWU6ICdQZXJ1dmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1BvbGlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ1BvcnR1Z3Vlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdRYXRhcmknfSxcbiAgICAgICAgICAge25hbWU6ICdSb21hbmknfSxcbiAgICAgICAgICAge25hbWU6ICdSdXNzaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnUndhbmRhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NhaW50IEx1Y2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NhbHZhZG9yYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTYW1vYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTYW4gTWFyaW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdTYW8gVG9tZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2F1ZGknfSxcbiAgICAgICAgICAge25hbWU6ICdTY290dGlzaCd9LFxuICAgICAgICAgICB7bmFtZTogJ1NlbmVnYWxlc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdTZXJiaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2V5Y2hlbGxvaXMnfSxcbiAgICAgICAgICAge25hbWU6ICdTaWVycmEgTGVvbmVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1NpbmdhcG9yZWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2xvdmFraWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU2xvdmVuaWFuJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU29sb21vbiBJc2xhbmRlcid9LFxuICAgICAgICAgICB7bmFtZTogJ1NvbWFsaSd9LFxuICAgICAgICAgICB7bmFtZTogJ1NvdXRoIEFmcmljYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTb3V0aCBLb3JlYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdTcGFuaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3JpIExhbmthbid9LFxuICAgICAgICAgICB7bmFtZTogJ1N1ZGFuZXNlJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3VyaW5hbWVyJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3dhemknfSxcbiAgICAgICAgICAge25hbWU6ICdTd2VkaXNoJ30sXG4gICAgICAgICAgIHtuYW1lOiAnU3dpc3MnfSxcbiAgICAgICAgICAge25hbWU6ICdTeXJpYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdUYWl3YW5lc2UnfSxcbiAgICAgICAgICAge25hbWU6ICdUYWppayd9LFxuICAgICAgICAgICB7bmFtZTogJ1Rhbnphbmlhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1RoYWknfSxcbiAgICAgICAgICAge25hbWU6ICdUb2dvbGVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1Rvbmdhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1RyaW5pZGFkaWFuIG9yIFRvYmFnb25pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdUdW5pc2lhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1R1cmtpc2gnfSxcbiAgICAgICAgICAge25hbWU6ICdUdXZhbHVhbid9LFxuICAgICAgICAgICB7bmFtZTogJ1VnYW5kYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdVa3JhaW5pYW4nfSxcbiAgICAgICAgICAge25hbWU6ICdVcnVndWF5YSd9LFxuICAgICAgICAgICB7bmFtZTogJ1V6YmVraXN0YW5pJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVmVuZXp1ZWxhJ30sXG4gICAgICAgICAgIHtuYW1lOiAnVmlldG5hbWVzZSd9LFxuICAgICAgICAgICB7bmFtZTogJ1dlbHMnfSxcbiAgICAgICAgICAge25hbWU6ICdZZW1lbml0J30sXG4gICAgICAgICAgIHtuYW1lOiAnWmFtYmlhJ30sXG4gICAgICAgICAgIHtuYW1lOiAnWmltYmFid2UnfSxcbiAgICAgICAgXSxcblxuICAgICAgICB1c19zdGF0ZXNfYW5kX2RjOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FsYWJhbWEnLCBhYmJyZXZpYXRpb246ICdBTCd9LFxuICAgICAgICAgICAge25hbWU6ICdBbGFza2EnLCBhYmJyZXZpYXRpb246ICdBSyd9LFxuICAgICAgICAgICAge25hbWU6ICdBcml6b25hJywgYWJicmV2aWF0aW9uOiAnQVonfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXJrYW5zYXMnLCBhYmJyZXZpYXRpb246ICdBUid9LFxuICAgICAgICAgICAge25hbWU6ICdDYWxpZm9ybmlhJywgYWJicmV2aWF0aW9uOiAnQ0EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ29sb3JhZG8nLCBhYmJyZXZpYXRpb246ICdDTyd9LFxuICAgICAgICAgICAge25hbWU6ICdDb25uZWN0aWN1dCcsIGFiYnJldmlhdGlvbjogJ0NUJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0RlbGF3YXJlJywgYWJicmV2aWF0aW9uOiAnREUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGlzdHJpY3Qgb2YgQ29sdW1iaWEnLCBhYmJyZXZpYXRpb246ICdEQyd9LFxuICAgICAgICAgICAge25hbWU6ICdGbG9yaWRhJywgYWJicmV2aWF0aW9uOiAnRkwnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnR2VvcmdpYScsIGFiYnJldmlhdGlvbjogJ0dBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0hhd2FpaScsIGFiYnJldmlhdGlvbjogJ0hJJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0lkYWhvJywgYWJicmV2aWF0aW9uOiAnSUQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSWxsaW5vaXMnLCBhYmJyZXZpYXRpb246ICdJTCd9LFxuICAgICAgICAgICAge25hbWU6ICdJbmRpYW5hJywgYWJicmV2aWF0aW9uOiAnSU4nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSW93YScsIGFiYnJldmlhdGlvbjogJ0lBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0thbnNhcycsIGFiYnJldmlhdGlvbjogJ0tTJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0tlbnR1Y2t5JywgYWJicmV2aWF0aW9uOiAnS1knfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTG91aXNpYW5hJywgYWJicmV2aWF0aW9uOiAnTEEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFpbmUnLCBhYmJyZXZpYXRpb246ICdNRSd9LFxuICAgICAgICAgICAge25hbWU6ICdNYXJ5bGFuZCcsIGFiYnJldmlhdGlvbjogJ01EJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01hc3NhY2h1c2V0dHMnLCBhYmJyZXZpYXRpb246ICdNQSd9LFxuICAgICAgICAgICAge25hbWU6ICdNaWNoaWdhbicsIGFiYnJldmlhdGlvbjogJ01JJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pbm5lc290YScsIGFiYnJldmlhdGlvbjogJ01OJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pc3Npc3NpcHBpJywgYWJicmV2aWF0aW9uOiAnTVMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWlzc291cmknLCBhYmJyZXZpYXRpb246ICdNTyd9LFxuICAgICAgICAgICAge25hbWU6ICdNb250YW5hJywgYWJicmV2aWF0aW9uOiAnTVQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmVicmFza2EnLCBhYmJyZXZpYXRpb246ICdORSd9LFxuICAgICAgICAgICAge25hbWU6ICdOZXZhZGEnLCBhYmJyZXZpYXRpb246ICdOVid9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgSGFtcHNoaXJlJywgYWJicmV2aWF0aW9uOiAnTkgnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3IEplcnNleScsIGFiYnJldmlhdGlvbjogJ05KJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldyBNZXhpY28nLCBhYmJyZXZpYXRpb246ICdOTSd9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgWW9yaycsIGFiYnJldmlhdGlvbjogJ05ZJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRoIENhcm9saW5hJywgYWJicmV2aWF0aW9uOiAnTkMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggRGFrb3RhJywgYWJicmV2aWF0aW9uOiAnTkQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT2hpbycsIGFiYnJldmlhdGlvbjogJ09IJ30sXG4gICAgICAgICAgICB7bmFtZTogJ09rbGFob21hJywgYWJicmV2aWF0aW9uOiAnT0snfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT3JlZ29uJywgYWJicmV2aWF0aW9uOiAnT1InfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUGVubnN5bHZhbmlhJywgYWJicmV2aWF0aW9uOiAnUEEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUmhvZGUgSXNsYW5kJywgYWJicmV2aWF0aW9uOiAnUkknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU291dGggQ2Fyb2xpbmEnLCBhYmJyZXZpYXRpb246ICdTQyd9LFxuICAgICAgICAgICAge25hbWU6ICdTb3V0aCBEYWtvdGEnLCBhYmJyZXZpYXRpb246ICdTRCd9LFxuICAgICAgICAgICAge25hbWU6ICdUZW5uZXNzZWUnLCBhYmJyZXZpYXRpb246ICdUTid9LFxuICAgICAgICAgICAge25hbWU6ICdUZXhhcycsIGFiYnJldmlhdGlvbjogJ1RYJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1V0YWgnLCBhYmJyZXZpYXRpb246ICdVVCd9LFxuICAgICAgICAgICAge25hbWU6ICdWZXJtb250JywgYWJicmV2aWF0aW9uOiAnVlQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmlyZ2luaWEnLCBhYmJyZXZpYXRpb246ICdWQSd9LFxuICAgICAgICAgICAge25hbWU6ICdXYXNoaW5ndG9uJywgYWJicmV2aWF0aW9uOiAnV0EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBWaXJnaW5pYScsIGFiYnJldmlhdGlvbjogJ1dWJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1dpc2NvbnNpbicsIGFiYnJldmlhdGlvbjogJ1dJJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1d5b21pbmcnLCBhYmJyZXZpYXRpb246ICdXWSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgdGVycml0b3JpZXM6IFtcbiAgICAgICAgICAgIHtuYW1lOiAnQW1lcmljYW4gU2Ftb2EnLCBhYmJyZXZpYXRpb246ICdBUyd9LFxuICAgICAgICAgICAge25hbWU6ICdGZWRlcmF0ZWQgU3RhdGVzIG9mIE1pY3JvbmVzaWEnLCBhYmJyZXZpYXRpb246ICdGTSd9LFxuICAgICAgICAgICAge25hbWU6ICdHdWFtJywgYWJicmV2aWF0aW9uOiAnR1UnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFyc2hhbGwgSXNsYW5kcycsIGFiYnJldmlhdGlvbjogJ01IJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRoZXJuIE1hcmlhbmEgSXNsYW5kcycsIGFiYnJldmlhdGlvbjogJ01QJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1B1ZXJ0byBSaWNvJywgYWJicmV2aWF0aW9uOiAnUFInfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmlyZ2luIElzbGFuZHMsIFUuUy4nLCBhYmJyZXZpYXRpb246ICdWSSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgYXJtZWRfZm9yY2VzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FybWVkIEZvcmNlcyBFdXJvcGUnLCBhYmJyZXZpYXRpb246ICdBRSd9LFxuICAgICAgICAgICAge25hbWU6ICdBcm1lZCBGb3JjZXMgUGFjaWZpYycsIGFiYnJldmlhdGlvbjogJ0FQJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0FybWVkIEZvcmNlcyB0aGUgQW1lcmljYXMnLCBhYmJyZXZpYXRpb246ICdBQSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgY291bnRyeV9yZWdpb25zOiB7XG4gICAgICAgICAgICBpdDogW1xuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWYWxsZSBkJ0Fvc3RhXCIsIGFiYnJldmlhdGlvbjogXCJWREFcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJQaWVtb250ZVwiLCBhYmJyZXZpYXRpb246IFwiUElFXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTG9tYmFyZGlhXCIsIGFiYnJldmlhdGlvbjogXCJMT01cIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJWZW5ldG9cIiwgYWJicmV2aWF0aW9uOiBcIlZFTlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRyZW50aW5vIEFsdG8gQWRpZ2VcIiwgYWJicmV2aWF0aW9uOiBcIlRBQVwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIkZyaXVsaSBWZW5lemlhIEdpdWxpYVwiLCBhYmJyZXZpYXRpb246IFwiRlZHXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTGlndXJpYVwiLCBhYmJyZXZpYXRpb246IFwiTElHXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiRW1pbGlhIFJvbWFnbmFcIiwgYWJicmV2aWF0aW9uOiBcIkVNUlwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlRvc2NhbmFcIiwgYWJicmV2aWF0aW9uOiBcIlRPU1wiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlVtYnJpYVwiLCBhYmJyZXZpYXRpb246IFwiVU1CXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTWFyY2hlXCIsIGFiYnJldmlhdGlvbjogXCJNQVJcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBYnJ1enpvXCIsIGFiYnJldmlhdGlvbjogXCJBQlJcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJMYXppb1wiLCBhYmJyZXZpYXRpb246IFwiTEFaXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQ2FtcGFuaWFcIiwgYWJicmV2aWF0aW9uOiBcIkNBTVwiIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiBcIlB1Z2xpYVwiLCBhYmJyZXZpYXRpb246IFwiUFVHXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQmFzaWxpY2F0YVwiLCBhYmJyZXZpYXRpb246IFwiQkFTXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiTW9saXNlXCIsIGFiYnJldmlhdGlvbjogXCJNT0xcIiB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJDYWxhYnJpYVwiLCBhYmJyZXZpYXRpb246IFwiQ0FMXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2ljaWxpYVwiLCBhYmJyZXZpYXRpb246IFwiU0lDXCIgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6IFwiU2FyZGVnbmFcIiwgYWJicmV2aWF0aW9uOiBcIlNBUlwiIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcblxuICAgICAgICBzdHJlZXRfc3VmZml4ZXM6IHtcbiAgICAgICAgICAgICd1cyc6IFtcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0F2ZW51ZScsIGFiYnJldmlhdGlvbjogJ0F2ZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQm91bGV2YXJkJywgYWJicmV2aWF0aW9uOiAnQmx2ZCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnQ2VudGVyJywgYWJicmV2aWF0aW9uOiAnQ3RyJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdDaXJjbGUnLCBhYmJyZXZpYXRpb246ICdDaXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdXJ0JywgYWJicmV2aWF0aW9uOiAnQ3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RyaXZlJywgYWJicmV2aWF0aW9uOiAnRHInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0V4dGVuc2lvbicsIGFiYnJldmlhdGlvbjogJ0V4dCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR2xlbicsIGFiYnJldmlhdGlvbjogJ0dsbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR3JvdmUnLCBhYmJyZXZpYXRpb246ICdHcnYnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hlaWdodHMnLCBhYmJyZXZpYXRpb246ICdIdHMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0hpZ2h3YXknLCBhYmJyZXZpYXRpb246ICdId3knfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0p1bmN0aW9uJywgYWJicmV2aWF0aW9uOiAnSmN0J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdLZXknLCBhYmJyZXZpYXRpb246ICdLZXknfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xhbmUnLCBhYmJyZXZpYXRpb246ICdMbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTG9vcCcsIGFiYnJldmlhdGlvbjogJ0xvb3AnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ01hbm9yJywgYWJicmV2aWF0aW9uOiAnTW5yJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdNaWxsJywgYWJicmV2aWF0aW9uOiAnTWlsbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGFyaycsIGFiYnJldmlhdGlvbjogJ1BhcmsnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Bhcmt3YXknLCBhYmJyZXZpYXRpb246ICdQa3d5J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQYXNzJywgYWJicmV2aWF0aW9uOiAnUGFzcyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGF0aCcsIGFiYnJldmlhdGlvbjogJ1BhdGgnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1Bpa2UnLCBhYmJyZXZpYXRpb246ICdQaWtlJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQbGFjZScsIGFiYnJldmlhdGlvbjogJ1BsJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdQbGF6YScsIGFiYnJldmlhdGlvbjogJ1Bseid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUG9pbnQnLCBhYmJyZXZpYXRpb246ICdQdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUmlkZ2UnLCBhYmJyZXZpYXRpb246ICdSZGcnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1JpdmVyJywgYWJicmV2aWF0aW9uOiAnUml2J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSb2FkJywgYWJicmV2aWF0aW9uOiAnUmQnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1NxdWFyZScsIGFiYnJldmlhdGlvbjogJ1NxJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTdHJlZXQnLCBhYmJyZXZpYXRpb246ICdTdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVGVycmFjZScsIGFiYnJldmlhdGlvbjogJ1Rlcid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVHJhaWwnLCBhYmJyZXZpYXRpb246ICdUcmwnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1R1cm5waWtlJywgYWJicmV2aWF0aW9uOiAnVHBrZSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnVmlldycsIGFiYnJldmlhdGlvbjogJ1Z3J30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdXYXknLCBhYmJyZXZpYXRpb246ICdXYXknfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICdpdCc6IFtcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBY2Nlc3NvJywgYWJicmV2aWF0aW9uOiAnQWNjLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBbHphaWEnLCBhYmJyZXZpYXRpb246ICdBbHouJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FyY28nLCBhYmJyZXZpYXRpb246ICdBcmNvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FyY2hpdm9sdG8nLCBhYmJyZXZpYXRpb246ICdBY3YuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0FyZW5hJywgYWJicmV2aWF0aW9uOiAnQXJlbmEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQXJnaW5lJywgYWJicmV2aWF0aW9uOiAnQXJnaW5lJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0JhY2lubycsIGFiYnJldmlhdGlvbjogJ0JhY2lubycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCYW5jaGknLCBhYmJyZXZpYXRpb246ICdCYW5jaGknIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQmFuY2hpbmEnLCBhYmJyZXZpYXRpb246ICdCYW4uJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jhc3Rpb25pJywgYWJicmV2aWF0aW9uOiAnQmFzLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCZWx2ZWRlcmUnLCBhYmJyZXZpYXRpb246ICdCZWx2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCb3JnYXRhJywgYWJicmV2aWF0aW9uOiAnQi50YScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdCb3JnbycsIGFiYnJldmlhdGlvbjogJ0IuZ28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FsYXRhJywgYWJicmV2aWF0aW9uOiAnQ2FsLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYWxsZScsIGFiYnJldmlhdGlvbjogJ0NhbGxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhbXBpZWxsbycsIGFiYnJldmlhdGlvbjogJ0NhbS4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FtcG8nLCBhYmJyZXZpYXRpb246ICdDYW0uJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NhbmFsZScsIGFiYnJldmlhdGlvbjogJ0Nhbi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ2FycmFpYScsIGFiYnJldmlhdGlvbjogJ0NhcnIuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Nhc2NpbmEnLCBhYmJyZXZpYXRpb246ICdDYXNjaW5hJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Nhc2Ugc3BhcnNlJywgYWJicmV2aWF0aW9uOiAnYy5zLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDYXZhbGNhdmlhJywgYWJicmV2aWF0aW9uOiAnQ3YuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NpcmNvbnZhbGxhemlvbmUnLCBhYmJyZXZpYXRpb246ICdDdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ29tcGxhbmFyZScsIGFiYnJldmlhdGlvbjogJ0MucmUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ29udHJhZGEnLCBhYmJyZXZpYXRpb246ICdDLmRhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0NvcnNvJywgYWJicmV2aWF0aW9uOiAnQy5zbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdDb3J0ZScsIGFiYnJldmlhdGlvbjogJ0MudGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnQ29ydGlsZScsIGFiYnJldmlhdGlvbjogJ0MubGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnRGlyYW1hemlvbmUnLCBhYmJyZXZpYXRpb246ICdEaXIuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0ZvbmRhY28nLCBhYmJyZXZpYXRpb246ICdGLmNvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0ZvbmRhbWVudGEnLCBhYmJyZXZpYXRpb246ICdGLnRhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0ZvbmRvJywgYWJicmV2aWF0aW9uOiAnRi5kbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdGcmF6aW9uZScsIGFiYnJldmlhdGlvbjogJ0ZyLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdJc29sYScsIGFiYnJldmlhdGlvbjogJ0lzLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdMYXJnbycsIGFiYnJldmlhdGlvbjogJ0wuZ28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTGl0b3JhbmVhJywgYWJicmV2aWF0aW9uOiAnTGl0LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdMdW5nb2xhZ28nLCBhYmJyZXZpYXRpb246ICdMLmdvIGxhZ28nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnTHVuZ28gUG8nLCBhYmJyZXZpYXRpb246ICdsLmdvIFBvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ01vbG8nLCBhYmJyZXZpYXRpb246ICdNb2xvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ011cmEnLCBhYmJyZXZpYXRpb246ICdNdXJhJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1Bhc3NhZ2dpbyBwcml2YXRvJywgYWJicmV2aWF0aW9uOiAncGFzcy4gcHJpdi4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUGFzc2VnZ2lhdGEnLCBhYmJyZXZpYXRpb246ICdQYXNzLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQaWF6emEnLCBhYmJyZXZpYXRpb246ICdQLnp6YScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdQaWF6emFsZScsIGFiYnJldmlhdGlvbjogJ1AubGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUG9udGUnLCBhYmJyZXZpYXRpb246ICdQLnRlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1BvcnRpY28nLCBhYmJyZXZpYXRpb246ICdQLmNvJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JhbXBhJywgYWJicmV2aWF0aW9uOiAnUmFtcGEnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUmVnaW9uZScsIGFiYnJldmlhdGlvbjogJ1JlZy4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUmlvbmUnLCBhYmJyZXZpYXRpb246ICdSLm5lJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1JpbycsIGFiYnJldmlhdGlvbjogJ1JpbycgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSaXBhJywgYWJicmV2aWF0aW9uOiAnUmlwYScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSaXZhJywgYWJicmV2aWF0aW9uOiAnUml2YScgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdSb25kw7InLCBhYmJyZXZpYXRpb246ICdSb25kw7InIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnUm90b25kYScsIGFiYnJldmlhdGlvbjogJ1JvdC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU2FncmF0bycsIGFiYnJldmlhdGlvbjogJ1NhZ3IuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NhbGl0YScsIGFiYnJldmlhdGlvbjogJ1NhbC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU2NhbGluYXRhJywgYWJicmV2aWF0aW9uOiAnU2NhbC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnU2NhbG9uZScsIGFiYnJldmlhdGlvbjogJ1NjYWwuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1NsYXJnbycsIGFiYnJldmlhdGlvbjogJ1NsLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTb3R0b3BvcnRpY28nLCBhYmJyZXZpYXRpb246ICdTb3R0LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdTdHJhZGEnLCBhYmJyZXZpYXRpb246ICdTdHIuJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1N0cmFkYWxlJywgYWJicmV2aWF0aW9uOiAnU3RyLmxlJyB9LFxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ1N0cmV0dG9pYScsIGFiYnJldmlhdGlvbjogJ1N0cmV0dC4nIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnVHJhdmVyc2EnLCBhYmJyZXZpYXRpb246ICdUcmF2LicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdWaWEnLCBhYmJyZXZpYXRpb246ICdWLicgfSxcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdWaWFsZScsIGFiYnJldmlhdGlvbjogJ1YubGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnVmljaW5hbGUnLCBhYmJyZXZpYXRpb246ICdWaWMubGUnIH0sXG4gICAgICAgICAgICAgICAgeyBuYW1lOiAnVmljb2xvJywgYWJicmV2aWF0aW9uOiAnVmljLicgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICd1aycgOiBbXG4gICAgICAgICAgICAgICAge25hbWU6ICdBdmVudWUnLCBhYmJyZXZpYXRpb246ICdBdmUnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0Nsb3NlJywgYWJicmV2aWF0aW9uOiAnQ2wnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NvdXJ0JywgYWJicmV2aWF0aW9uOiAnQ3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0NyZXNjZW50JywgYWJicmV2aWF0aW9uOiAnQ3InfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0RyaXZlJywgYWJicmV2aWF0aW9uOiAnRHInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dhcmRlbicsIGFiYnJldmlhdGlvbjogJ0dkbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnR2FyZGVucycsIGFiYnJldmlhdGlvbjogJ0dkbnMnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dyZWVuJywgYWJicmV2aWF0aW9uOiAnR24nfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0dyb3ZlJywgYWJicmV2aWF0aW9uOiAnR3InfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ0xhbmUnLCBhYmJyZXZpYXRpb246ICdMbid9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnTW91bnQnLCBhYmJyZXZpYXRpb246ICdNdCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGxhY2UnLCBhYmJyZXZpYXRpb246ICdQbCd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUGFyaycsIGFiYnJldmlhdGlvbjogJ1BrJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdSaWRnZScsIGFiYnJldmlhdGlvbjogJ1JkZyd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnUm9hZCcsIGFiYnJldmlhdGlvbjogJ1JkJ30sXG4gICAgICAgICAgICAgICAge25hbWU6ICdTcXVhcmUnLCBhYmJyZXZpYXRpb246ICdTcSd9LFxuICAgICAgICAgICAgICAgIHtuYW1lOiAnU3RyZWV0JywgYWJicmV2aWF0aW9uOiAnU3QnfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1RlcnJhY2UnLCBhYmJyZXZpYXRpb246ICdUZXInfSxcbiAgICAgICAgICAgICAgICB7bmFtZTogJ1ZhbGxleScsIGFiYnJldmlhdGlvbjogJ1ZhbCd9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sXG5cbiAgICAgICAgbW9udGhzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0phbnVhcnknLCBzaG9ydF9uYW1lOiAnSmFuJywgbnVtZXJpYzogJzAxJywgZGF5czogMzF9LFxuICAgICAgICAgICAgLy8gTm90IG1lc3Npbmcgd2l0aCBsZWFwIHllYXJzLi4uXG4gICAgICAgICAgICB7bmFtZTogJ0ZlYnJ1YXJ5Jywgc2hvcnRfbmFtZTogJ0ZlYicsIG51bWVyaWM6ICcwMicsIGRheXM6IDI4fSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFyY2gnLCBzaG9ydF9uYW1lOiAnTWFyJywgbnVtZXJpYzogJzAzJywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdBcHJpbCcsIHNob3J0X25hbWU6ICdBcHInLCBudW1lcmljOiAnMDQnLCBkYXlzOiAzMH0sXG4gICAgICAgICAgICB7bmFtZTogJ01heScsIHNob3J0X25hbWU6ICdNYXknLCBudW1lcmljOiAnMDUnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ0p1bmUnLCBzaG9ydF9uYW1lOiAnSnVuJywgbnVtZXJpYzogJzA2JywgZGF5czogMzB9LFxuICAgICAgICAgICAge25hbWU6ICdKdWx5Jywgc2hvcnRfbmFtZTogJ0p1bCcsIG51bWVyaWM6ICcwNycsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXVndXN0Jywgc2hvcnRfbmFtZTogJ0F1ZycsIG51bWVyaWM6ICcwOCcsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU2VwdGVtYmVyJywgc2hvcnRfbmFtZTogJ1NlcCcsIG51bWVyaWM6ICcwOScsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT2N0b2JlcicsIHNob3J0X25hbWU6ICdPY3QnLCBudW1lcmljOiAnMTAnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ05vdmVtYmVyJywgc2hvcnRfbmFtZTogJ05vdicsIG51bWVyaWM6ICcxMScsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGVjZW1iZXInLCBzaG9ydF9uYW1lOiAnRGVjJywgbnVtZXJpYzogJzEyJywgZGF5czogMzF9XG4gICAgICAgIF0sXG5cbiAgICAgICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYW5rX2NhcmRfbnVtYmVyI0lzc3Vlcl9pZGVudGlmaWNhdGlvbl9udW1iZXJfLjI4SUlOLjI5XG4gICAgICAgIGNjX3R5cGVzOiBbXG4gICAgICAgICAgICB7bmFtZTogXCJBbWVyaWNhbiBFeHByZXNzXCIsIHNob3J0X25hbWU6ICdhbWV4JywgcHJlZml4OiAnMzQnLCBsZW5ndGg6IDE1fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkJhbmtjYXJkXCIsIHNob3J0X25hbWU6ICdiYW5rY2FyZCcsIHByZWZpeDogJzU2MTAnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkNoaW5hIFVuaW9uUGF5XCIsIHNob3J0X25hbWU6ICdjaGluYXVuaW9uJywgcHJlZml4OiAnNjInLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIENhcnRlIEJsYW5jaGVcIiwgc2hvcnRfbmFtZTogJ2RjY2FydGUnLCBwcmVmaXg6ICczMDAnLCBsZW5ndGg6IDE0fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIGVuUm91dGVcIiwgc2hvcnRfbmFtZTogJ2RjZW5yb3V0ZScsIHByZWZpeDogJzIwMTQnLCBsZW5ndGg6IDE1fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIEludGVybmF0aW9uYWxcIiwgc2hvcnRfbmFtZTogJ2RjaW50bCcsIHByZWZpeDogJzM2JywgbGVuZ3RoOiAxNH0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaW5lcnMgQ2x1YiBVbml0ZWQgU3RhdGVzICYgQ2FuYWRhXCIsIHNob3J0X25hbWU6ICdkY3VzYycsIHByZWZpeDogJzU0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaXNjb3ZlciBDYXJkXCIsIHNob3J0X25hbWU6ICdkaXNjb3ZlcicsIHByZWZpeDogJzYwMTEnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkluc3RhUGF5bWVudFwiLCBzaG9ydF9uYW1lOiAnaW5zdGFwYXknLCBwcmVmaXg6ICc2MzcnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkpDQlwiLCBzaG9ydF9uYW1lOiAnamNiJywgcHJlZml4OiAnMzUyOCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiTGFzZXJcIiwgc2hvcnRfbmFtZTogJ2xhc2VyJywgcHJlZml4OiAnNjMwNCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiTWFlc3Ryb1wiLCBzaG9ydF9uYW1lOiAnbWFlc3RybycsIHByZWZpeDogJzUwMTgnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIk1hc3RlcmNhcmRcIiwgc2hvcnRfbmFtZTogJ21jJywgcHJlZml4OiAnNTEnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlNvbG9cIiwgc2hvcnRfbmFtZTogJ3NvbG8nLCBwcmVmaXg6ICc2MzM0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJTd2l0Y2hcIiwgc2hvcnRfbmFtZTogJ3N3aXRjaCcsIHByZWZpeDogJzQ5MDMnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlZpc2FcIiwgc2hvcnRfbmFtZTogJ3Zpc2EnLCBwcmVmaXg6ICc0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJWaXNhIEVsZWN0cm9uXCIsIHNob3J0X25hbWU6ICdlbGVjdHJvbicsIHByZWZpeDogJzQwMjYnLCBsZW5ndGg6IDE2fVxuICAgICAgICBdLFxuXG4gICAgICAgIC8vcmV0dXJuIGFsbCB3b3JsZCBjdXJyZW5jeSBieSBJU08gNDIxN1xuICAgICAgICBjdXJyZW5jeV90eXBlczogW1xuICAgICAgICAgICAgeydjb2RlJyA6ICdBRUQnLCAnbmFtZScgOiAnVW5pdGVkIEFyYWIgRW1pcmF0ZXMgRGlyaGFtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FGTicsICduYW1lJyA6ICdBZmdoYW5pc3RhbiBBZmdoYW5pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FMTCcsICduYW1lJyA6ICdBbGJhbmlhIExlayd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBTUQnLCAnbmFtZScgOiAnQXJtZW5pYSBEcmFtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FORycsICduYW1lJyA6ICdOZXRoZXJsYW5kcyBBbnRpbGxlcyBHdWlsZGVyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FPQScsICduYW1lJyA6ICdBbmdvbGEgS3dhbnphJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FSUycsICduYW1lJyA6ICdBcmdlbnRpbmEgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBVUQnLCAnbmFtZScgOiAnQXVzdHJhbGlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBV0cnLCAnbmFtZScgOiAnQXJ1YmEgR3VpbGRlcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBWk4nLCAnbmFtZScgOiAnQXplcmJhaWphbiBOZXcgTWFuYXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkFNJywgJ25hbWUnIDogJ0Jvc25pYSBhbmQgSGVyemVnb3ZpbmEgQ29udmVydGlibGUgTWFya2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkJEJywgJ25hbWUnIDogJ0JhcmJhZG9zIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCRFQnLCAnbmFtZScgOiAnQmFuZ2xhZGVzaCBUYWthJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JHTicsICduYW1lJyA6ICdCdWxnYXJpYSBMZXYnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkhEJywgJ25hbWUnIDogJ0JhaHJhaW4gRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQklGJywgJ25hbWUnIDogJ0J1cnVuZGkgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQk1EJywgJ25hbWUnIDogJ0Jlcm11ZGEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JORCcsICduYW1lJyA6ICdCcnVuZWkgRGFydXNzYWxhbSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQk9CJywgJ25hbWUnIDogJ0JvbGl2aWEgQm9saXZpYW5vJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JSTCcsICduYW1lJyA6ICdCcmF6aWwgUmVhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCU0QnLCAnbmFtZScgOiAnQmFoYW1hcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQlROJywgJ25hbWUnIDogJ0JodXRhbiBOZ3VsdHJ1bSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCV1AnLCAnbmFtZScgOiAnQm90c3dhbmEgUHVsYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCWVInLCAnbmFtZScgOiAnQmVsYXJ1cyBSdWJsZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCWkQnLCAnbmFtZScgOiAnQmVsaXplIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDQUQnLCAnbmFtZScgOiAnQ2FuYWRhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDREYnLCAnbmFtZScgOiAnQ29uZ28vS2luc2hhc2EgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ0hGJywgJ25hbWUnIDogJ1N3aXR6ZXJsYW5kIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NMUCcsICduYW1lJyA6ICdDaGlsZSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NOWScsICduYW1lJyA6ICdDaGluYSBZdWFuIFJlbm1pbmJpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NPUCcsICduYW1lJyA6ICdDb2xvbWJpYSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NSQycsICduYW1lJyA6ICdDb3N0YSBSaWNhIENvbG9uJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NVQycsICduYW1lJyA6ICdDdWJhIENvbnZlcnRpYmxlIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1VQJywgJ25hbWUnIDogJ0N1YmEgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDVkUnLCAnbmFtZScgOiAnQ2FwZSBWZXJkZSBFc2N1ZG8nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1pLJywgJ25hbWUnIDogJ0N6ZWNoIFJlcHVibGljIEtvcnVuYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdESkYnLCAnbmFtZScgOiAnRGppYm91dGkgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnREtLJywgJ25hbWUnIDogJ0Rlbm1hcmsgS3JvbmUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRE9QJywgJ25hbWUnIDogJ0RvbWluaWNhbiBSZXB1YmxpYyBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0RaRCcsICduYW1lJyA6ICdBbGdlcmlhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0VHUCcsICduYW1lJyA6ICdFZ3lwdCBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFUk4nLCAnbmFtZScgOiAnRXJpdHJlYSBOYWtmYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFVEInLCAnbmFtZScgOiAnRXRoaW9waWEgQmlycid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFVVInLCAnbmFtZScgOiAnRXVybyBNZW1iZXIgQ291bnRyaWVzJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0ZKRCcsICduYW1lJyA6ICdGaWppIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdGS1AnLCAnbmFtZScgOiAnRmFsa2xhbmQgSXNsYW5kcyAoTWFsdmluYXMpIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dCUCcsICduYW1lJyA6ICdVbml0ZWQgS2luZ2RvbSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHRUwnLCAnbmFtZScgOiAnR2VvcmdpYSBMYXJpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dHUCcsICduYW1lJyA6ICdHdWVybnNleSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHSFMnLCAnbmFtZScgOiAnR2hhbmEgQ2VkaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHSVAnLCAnbmFtZScgOiAnR2licmFsdGFyIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dNRCcsICduYW1lJyA6ICdHYW1iaWEgRGFsYXNpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dORicsICduYW1lJyA6ICdHdWluZWEgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR1RRJywgJ25hbWUnIDogJ0d1YXRlbWFsYSBRdWV0emFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dZRCcsICduYW1lJyA6ICdHdXlhbmEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hLRCcsICduYW1lJyA6ICdIb25nIEtvbmcgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hOTCcsICduYW1lJyA6ICdIb25kdXJhcyBMZW1waXJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hSSycsICduYW1lJyA6ICdDcm9hdGlhIEt1bmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSFRHJywgJ25hbWUnIDogJ0hhaXRpIEdvdXJkZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdIVUYnLCAnbmFtZScgOiAnSHVuZ2FyeSBGb3JpbnQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSURSJywgJ25hbWUnIDogJ0luZG9uZXNpYSBSdXBpYWgnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSUxTJywgJ25hbWUnIDogJ0lzcmFlbCBTaGVrZWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSU1QJywgJ25hbWUnIDogJ0lzbGUgb2YgTWFuIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lOUicsICduYW1lJyA6ICdJbmRpYSBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJUUQnLCAnbmFtZScgOiAnSXJhcSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJUlInLCAnbmFtZScgOiAnSXJhbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lTSycsICduYW1lJyA6ICdJY2VsYW5kIEtyb25hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pFUCcsICduYW1lJyA6ICdKZXJzZXkgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSk1EJywgJ25hbWUnIDogJ0phbWFpY2EgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pPRCcsICduYW1lJyA6ICdKb3JkYW4gRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSlBZJywgJ25hbWUnIDogJ0phcGFuIFllbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLRVMnLCAnbmFtZScgOiAnS2VueWEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS0dTJywgJ25hbWUnIDogJ0t5cmd5enN0YW4gU29tJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tIUicsICduYW1lJyA6ICdDYW1ib2RpYSBSaWVsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tNRicsICduYW1lJyA6ICdDb21vcm9zIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tQVycsICduYW1lJyA6ICdLb3JlYSAoTm9ydGgpIFdvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLUlcnLCAnbmFtZScgOiAnS29yZWEgKFNvdXRoKSBXb24nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1dEJywgJ25hbWUnIDogJ0t1d2FpdCBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLWUQnLCAnbmFtZScgOiAnQ2F5bWFuIElzbGFuZHMgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0taVCcsICduYW1lJyA6ICdLYXpha2hzdGFuIFRlbmdlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xBSycsICduYW1lJyA6ICdMYW9zIEtpcCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMQlAnLCAnbmFtZScgOiAnTGViYW5vbiBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMS1InLCAnbmFtZScgOiAnU3JpIExhbmthIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xSRCcsICduYW1lJyA6ICdMaWJlcmlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMU0wnLCAnbmFtZScgOiAnTGVzb3RobyBMb3RpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xUTCcsICduYW1lJyA6ICdMaXRodWFuaWEgTGl0YXMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTFlEJywgJ25hbWUnIDogJ0xpYnlhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01BRCcsICduYW1lJyA6ICdNb3JvY2NvIERpcmhhbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNREwnLCAnbmFtZScgOiAnTW9sZG92YSBMZXUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTUdBJywgJ25hbWUnIDogJ01hZGFnYXNjYXIgQXJpYXJ5J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01LRCcsICduYW1lJyA6ICdNYWNlZG9uaWEgRGVuYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTU1LJywgJ25hbWUnIDogJ015YW5tYXIgKEJ1cm1hKSBLeWF0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01OVCcsICduYW1lJyA6ICdNb25nb2xpYSBUdWdocmlrJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01PUCcsICduYW1lJyA6ICdNYWNhdSBQYXRhY2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVJPJywgJ25hbWUnIDogJ01hdXJpdGFuaWEgT3VndWl5YSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNVVInLCAnbmFtZScgOiAnTWF1cml0aXVzIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01WUicsICduYW1lJyA6ICdNYWxkaXZlcyAoTWFsZGl2ZSBJc2xhbmRzKSBSdWZpeWFhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01XSycsICduYW1lJyA6ICdNYWxhd2kgS3dhY2hhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01YTicsICduYW1lJyA6ICdNZXhpY28gUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNWVInLCAnbmFtZScgOiAnTWFsYXlzaWEgUmluZ2dpdCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNWk4nLCAnbmFtZScgOiAnTW96YW1iaXF1ZSBNZXRpY2FsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05BRCcsICduYW1lJyA6ICdOYW1pYmlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOR04nLCAnbmFtZScgOiAnTmlnZXJpYSBOYWlyYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOSU8nLCAnbmFtZScgOiAnTmljYXJhZ3VhIENvcmRvYmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTk9LJywgJ25hbWUnIDogJ05vcndheSBLcm9uZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOUFInLCAnbmFtZScgOiAnTmVwYWwgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTlpEJywgJ25hbWUnIDogJ05ldyBaZWFsYW5kIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdPTVInLCAnbmFtZScgOiAnT21hbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BBQicsICduYW1lJyA6ICdQYW5hbWEgQmFsYm9hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BFTicsICduYW1lJyA6ICdQZXJ1IE51ZXZvIFNvbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQR0snLCAnbmFtZScgOiAnUGFwdWEgTmV3IEd1aW5lYSBLaW5hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BIUCcsICduYW1lJyA6ICdQaGlsaXBwaW5lcyBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BLUicsICduYW1lJyA6ICdQYWtpc3RhbiBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQTE4nLCAnbmFtZScgOiAnUG9sYW5kIFpsb3R5J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BZRycsICduYW1lJyA6ICdQYXJhZ3VheSBHdWFyYW5pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1FBUicsICduYW1lJyA6ICdRYXRhciBSaXlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdST04nLCAnbmFtZScgOiAnUm9tYW5pYSBOZXcgTGV1J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1JTRCcsICduYW1lJyA6ICdTZXJiaWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUlVCJywgJ25hbWUnIDogJ1J1c3NpYSBSdWJsZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdSV0YnLCAnbmFtZScgOiAnUndhbmRhIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NBUicsICduYW1lJyA6ICdTYXVkaSBBcmFiaWEgUml5YWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0JEJywgJ25hbWUnIDogJ1NvbG9tb24gSXNsYW5kcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0NSJywgJ25hbWUnIDogJ1NleWNoZWxsZXMgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0RHJywgJ25hbWUnIDogJ1N1ZGFuIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NFSycsICduYW1lJyA6ICdTd2VkZW4gS3JvbmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0dEJywgJ25hbWUnIDogJ1NpbmdhcG9yZSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0hQJywgJ25hbWUnIDogJ1NhaW50IEhlbGVuYSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTTEwnLCAnbmFtZScgOiAnU2llcnJhIExlb25lIExlb25lJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NPUycsICduYW1lJyA6ICdTb21hbGlhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NQTCcsICduYW1lJyA6ICdTZWJvcmdhIEx1aWdpbm8nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1JEJywgJ25hbWUnIDogJ1N1cmluYW1lIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTVEQnLCAnbmFtZScgOiAnU8OjbyBUb23DqSBhbmQgUHLDrW5jaXBlIERvYnJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NWQycsICduYW1lJyA6ICdFbCBTYWx2YWRvciBDb2xvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTWVAnLCAnbmFtZScgOiAnU3lyaWEgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1pMJywgJ25hbWUnIDogJ1N3YXppbGFuZCBMaWxhbmdlbmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVEhCJywgJ25hbWUnIDogJ1RoYWlsYW5kIEJhaHQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVEpTJywgJ25hbWUnIDogJ1RhamlraXN0YW4gU29tb25pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RNVCcsICduYW1lJyA6ICdUdXJrbWVuaXN0YW4gTWFuYXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVE5EJywgJ25hbWUnIDogJ1R1bmlzaWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVE9QJywgJ25hbWUnIDogJ1RvbmdhIFBhXFwnYW5nYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUUlknLCAnbmFtZScgOiAnVHVya2V5IExpcmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFREJywgJ25hbWUnIDogJ1RyaW5pZGFkIGFuZCBUb2JhZ28gRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RWRCcsICduYW1lJyA6ICdUdXZhbHUgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RXRCcsICduYW1lJyA6ICdUYWl3YW4gTmV3IERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUWlMnLCAnbmFtZScgOiAnVGFuemFuaWEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVUFIJywgJ25hbWUnIDogJ1VrcmFpbmUgSHJ5dm5pYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVR1gnLCAnbmFtZScgOiAnVWdhbmRhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VTRCcsICduYW1lJyA6ICdVbml0ZWQgU3RhdGVzIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVWVUnLCAnbmFtZScgOiAnVXJ1Z3VheSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VaUycsICduYW1lJyA6ICdVemJla2lzdGFuIFNvbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdWRUYnLCAnbmFtZScgOiAnVmVuZXp1ZWxhIEJvbGl2YXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVk5EJywgJ25hbWUnIDogJ1ZpZXQgTmFtIERvbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVlVWJywgJ25hbWUnIDogJ1ZhbnVhdHUgVmF0dSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdXU1QnLCAnbmFtZScgOiAnU2Ftb2EgVGFsYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYQUYnLCAnbmFtZScgOiAnQ29tbXVuYXV0w6kgRmluYW5jacOocmUgQWZyaWNhaW5lIChCRUFDKSBDRkEgRnJhbmMgQkVBQyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYQ0QnLCAnbmFtZScgOiAnRWFzdCBDYXJpYmJlYW4gRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hEUicsICduYW1lJyA6ICdJbnRlcm5hdGlvbmFsIE1vbmV0YXJ5IEZ1bmQgKElNRikgU3BlY2lhbCBEcmF3aW5nIFJpZ2h0cyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYT0YnLCAnbmFtZScgOiAnQ29tbXVuYXV0w6kgRmluYW5jacOocmUgQWZyaWNhaW5lIChCQ0VBTykgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWFBGJywgJ25hbWUnIDogJ0NvbXB0b2lycyBGcmFuw6dhaXMgZHUgUGFjaWZpcXVlIChDRlApIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1lFUicsICduYW1lJyA6ICdZZW1lbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1pBUicsICduYW1lJyA6ICdTb3V0aCBBZnJpY2EgUmFuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdaTVcnLCAnbmFtZScgOiAnWmFtYmlhIEt3YWNoYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdaV0QnLCAnbmFtZScgOiAnWmltYmFid2UgRG9sbGFyJ31cbiAgICAgICAgXSxcblxuICAgICAgICAvLyByZXR1cm4gdGhlIG5hbWVzIG9mIGFsbCB2YWxpZGUgY29sb3JzXG4gICAgICAgIGNvbG9yTmFtZXMgOiBbICBcIkFsaWNlQmx1ZVwiLCBcIkJsYWNrXCIsIFwiTmF2eVwiLCBcIkRhcmtCbHVlXCIsIFwiTWVkaXVtQmx1ZVwiLCBcIkJsdWVcIiwgXCJEYXJrR3JlZW5cIiwgXCJHcmVlblwiLCBcIlRlYWxcIiwgXCJEYXJrQ3lhblwiLCBcIkRlZXBTa3lCbHVlXCIsIFwiRGFya1R1cnF1b2lzZVwiLCBcIk1lZGl1bVNwcmluZ0dyZWVuXCIsIFwiTGltZVwiLCBcIlNwcmluZ0dyZWVuXCIsXG4gICAgICAgICAgICBcIkFxdWFcIiwgXCJDeWFuXCIsIFwiTWlkbmlnaHRCbHVlXCIsIFwiRG9kZ2VyQmx1ZVwiLCBcIkxpZ2h0U2VhR3JlZW5cIiwgXCJGb3Jlc3RHcmVlblwiLCBcIlNlYUdyZWVuXCIsIFwiRGFya1NsYXRlR3JheVwiLCBcIkxpbWVHcmVlblwiLCBcIk1lZGl1bVNlYUdyZWVuXCIsIFwiVHVycXVvaXNlXCIsIFwiUm95YWxCbHVlXCIsIFwiU3RlZWxCbHVlXCIsIFwiRGFya1NsYXRlQmx1ZVwiLCBcIk1lZGl1bVR1cnF1b2lzZVwiLFxuICAgICAgICAgICAgXCJJbmRpZ29cIiwgXCJEYXJrT2xpdmVHcmVlblwiLCBcIkNhZGV0Qmx1ZVwiLCBcIkNvcm5mbG93ZXJCbHVlXCIsIFwiUmViZWNjYVB1cnBsZVwiLCBcIk1lZGl1bUFxdWFNYXJpbmVcIiwgXCJEaW1HcmF5XCIsIFwiU2xhdGVCbHVlXCIsIFwiT2xpdmVEcmFiXCIsIFwiU2xhdGVHcmF5XCIsIFwiTGlnaHRTbGF0ZUdyYXlcIiwgXCJNZWRpdW1TbGF0ZUJsdWVcIiwgXCJMYXduR3JlZW5cIiwgXCJDaGFydHJldXNlXCIsXG4gICAgICAgICAgICBcIkFxdWFtYXJpbmVcIiwgXCJNYXJvb25cIiwgXCJQdXJwbGVcIiwgXCJPbGl2ZVwiLCBcIkdyYXlcIiwgXCJTa3lCbHVlXCIsIFwiTGlnaHRTa3lCbHVlXCIsIFwiQmx1ZVZpb2xldFwiLCBcIkRhcmtSZWRcIiwgXCJEYXJrTWFnZW50YVwiLCBcIlNhZGRsZUJyb3duXCIsIFwiSXZvcnlcIiwgXCJXaGl0ZVwiLFxuICAgICAgICAgICAgXCJEYXJrU2VhR3JlZW5cIiwgXCJMaWdodEdyZWVuXCIsIFwiTWVkaXVtUHVycGxlXCIsIFwiRGFya1Zpb2xldFwiLCBcIlBhbGVHcmVlblwiLCBcIkRhcmtPcmNoaWRcIiwgXCJZZWxsb3dHcmVlblwiLCBcIlNpZW5uYVwiLCBcIkJyb3duXCIsIFwiRGFya0dyYXlcIiwgXCJMaWdodEJsdWVcIiwgXCJHcmVlblllbGxvd1wiLCBcIlBhbGVUdXJxdW9pc2VcIiwgXCJMaWdodFN0ZWVsQmx1ZVwiLCBcIlBvd2RlckJsdWVcIixcbiAgICAgICAgICAgIFwiRmlyZUJyaWNrXCIsIFwiRGFya0dvbGRlblJvZFwiLCBcIk1lZGl1bU9yY2hpZFwiLCBcIlJvc3lCcm93blwiLCBcIkRhcmtLaGFraVwiLCBcIlNpbHZlclwiLCBcIk1lZGl1bVZpb2xldFJlZFwiLCBcIkluZGlhblJlZFwiLCBcIlBlcnVcIiwgXCJDaG9jb2xhdGVcIiwgXCJUYW5cIiwgXCJMaWdodEdyYXlcIiwgXCJUaGlzdGxlXCIsIFwiT3JjaGlkXCIsIFwiR29sZGVuUm9kXCIsIFwiUGFsZVZpb2xldFJlZFwiLFxuICAgICAgICAgICAgXCJDcmltc29uXCIsIFwiR2FpbnNib3JvXCIsIFwiUGx1bVwiLCBcIkJ1cmx5V29vZFwiLCBcIkxpZ2h0Q3lhblwiLCBcIkxhdmVuZGVyXCIsIFwiRGFya1NhbG1vblwiLCBcIlZpb2xldFwiLCBcIlBhbGVHb2xkZW5Sb2RcIiwgXCJMaWdodENvcmFsXCIsIFwiS2hha2lcIiwgXCJBbGljZUJsdWVcIiwgXCJIb25leURld1wiLCBcIkF6dXJlXCIsIFwiU2FuZHlCcm93blwiLCBcIldoZWF0XCIsIFwiQmVpZ2VcIiwgXCJXaGl0ZVNtb2tlXCIsXG4gICAgICAgICAgICBcIk1pbnRDcmVhbVwiLCBcIkdob3N0V2hpdGVcIiwgXCJTYWxtb25cIiwgXCJBbnRpcXVlV2hpdGVcIiwgXCJMaW5lblwiLCBcIkxpZ2h0R29sZGVuUm9kWWVsbG93XCIsIFwiT2xkTGFjZVwiLCBcIlJlZFwiLCBcIkZ1Y2hzaWFcIiwgXCJNYWdlbnRhXCIsIFwiRGVlcFBpbmtcIiwgXCJPcmFuZ2VSZWRcIiwgXCJUb21hdG9cIiwgXCJIb3RQaW5rXCIsIFwiQ29yYWxcIiwgXCJEYXJrT3JhbmdlXCIsIFwiTGlnaHRTYWxtb25cIiwgXCJPcmFuZ2VcIixcbiAgICAgICAgICAgIFwiTGlnaHRQaW5rXCIsIFwiUGlua1wiLCBcIkdvbGRcIiwgXCJQZWFjaFB1ZmZcIiwgXCJOYXZham9XaGl0ZVwiLCBcIk1vY2Nhc2luXCIsIFwiQmlzcXVlXCIsIFwiTWlzdHlSb3NlXCIsIFwiQmxhbmNoZWRBbG1vbmRcIiwgXCJQYXBheWFXaGlwXCIsIFwiTGF2ZW5kZXJCbHVzaFwiLCBcIlNlYVNoZWxsXCIsIFwiQ29ybnNpbGtcIiwgXCJMZW1vbkNoaWZmb25cIiwgXCJGbG9yYWxXaGl0ZVwiLCBcIlNub3dcIiwgXCJZZWxsb3dcIiwgXCJMaWdodFllbGxvd1wiXG4gICAgICAgIF0sXG5cbiAgICAgICAgZmlsZUV4dGVuc2lvbiA6IHtcbiAgICAgICAgICAgIFwicmFzdGVyXCIgICAgOiBbXCJibXBcIiwgXCJnaWZcIiwgXCJncGxcIiwgXCJpY29cIiwgXCJqcGVnXCIsIFwicHNkXCIsIFwicG5nXCIsIFwicHNwXCIsIFwicmF3XCIsIFwidGlmZlwiXSxcbiAgICAgICAgICAgIFwidmVjdG9yXCIgICAgOiBbXCIzZHZcIiwgXCJhbWZcIiwgXCJhd2dcIiwgXCJhaVwiLCBcImNnbVwiLCBcImNkclwiLCBcImNteFwiLCBcImR4ZlwiLCBcImUyZFwiLCBcImVndFwiLCBcImVwc1wiLCBcImZzXCIsIFwib2RnXCIsIFwic3ZnXCIsIFwieGFyXCJdLFxuICAgICAgICAgICAgXCIzZFwiICAgICAgICA6IFtcIjNkbWZcIiwgXCIzZG1cIiwgXCIzbWZcIiwgXCIzZHNcIiwgXCJhbjhcIiwgXCJhb2lcIiwgXCJibGVuZFwiLCBcImNhbDNkXCIsIFwiY29iXCIsIFwiY3RtXCIsIFwiaW9iXCIsIFwiamFzXCIsIFwibWF4XCIsIFwibWJcIiwgXCJtZHhcIiwgXCJvYmpcIiwgXCJ4XCIsIFwieDNkXCJdLFxuICAgICAgICAgICAgXCJkb2N1bWVudFwiICA6IFtcImRvY1wiLCBcImRvY3hcIiwgXCJkb3RcIiwgXCJodG1sXCIsIFwieG1sXCIsIFwib2R0XCIsIFwib2RtXCIsIFwib3R0XCIsIFwiY3N2XCIsIFwicnRmXCIsIFwidGV4XCIsIFwieGh0bWxcIiwgXCJ4cHNcIl1cbiAgICAgICAgfSxcblxuICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2RtZmlsaXBlbmtvL3RpbWV6b25lcy5qc29uL2Jsb2IvbWFzdGVyL3RpbWV6b25lcy5qc29uXG4gICAgICAgIHRpbWV6b25lczogW1xuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJEYXRlbGluZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkRTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMTI6MDApIEludGVybmF0aW9uYWwgRGF0ZSBMaW5lIFdlc3RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCsxMlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlVUQy0xMVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0xMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0xMTowMCkgQ29vcmRpbmF0ZWQgVW5pdmVyc2FsIFRpbWUtMTFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCsxMVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9NaWR3YXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvTml1ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9QYWdvX1BhZ29cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJIYXdhaWlhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkhTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMTA6MDApIEhhd2FpaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzEwXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0hvbm9sdWx1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0pvaG5zdG9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1Jhcm90b25nYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9UYWhpdGlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBbGFza2FuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQUtEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA5OjAwKSBBbGFza2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BbmNob3JhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSnVuZWF1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05vbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2l0a2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvWWFrdXRhdFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlBhY2lmaWMgU3RhbmRhcmQgVGltZSAoTWV4aWNvKVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJQRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTcsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wODowMCkgQmFqYSBDYWxpZm9ybmlhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2FudGFfSXNhYmVsXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiUGFjaWZpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlBEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA4OjAwKSBQYWNpZmljIFRpbWUgKFVTICYgQ2FuYWRhKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0Rhd3NvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Mb3NfQW5nZWxlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9UaWp1YW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1ZhbmNvdXZlclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9XaGl0ZWhvcnNlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQU1Q4UERUXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVMgTW91bnRhaW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVTVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC03LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA3OjAwKSBBcml6b25hXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ3Jlc3RvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9EYXdzb25fQ3JlZWtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSGVybW9zaWxsb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9QaG9lbml4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzdcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNb3VudGFpbiBTdGFuZGFyZCBUaW1lIChNZXhpY28pXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1EVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA3OjAwKSBDaGlodWFodWEsIExhIFBheiwgTWF6YXRsYW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DaGlodWFodWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWF6YXRsYW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNb3VudGFpbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1EVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA3OjAwKSBNb3VudGFpbiBUaW1lIChVUyAmIENhbmFkYSlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Cb2lzZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYW1icmlkZ2VfQmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0RlbnZlclwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9FZG1vbnRvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbnV2aWtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvT2ppbmFnYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9ZZWxsb3drbmlmZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiTVNUN01EVFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgQW1lcmljYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDY6MDApIENlbnRyYWwgQW1lcmljYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JlbGl6ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Db3N0YV9SaWNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0VsX1NhbHZhZG9yXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0d1YXRlbWFsYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYW5hZ3VhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1RlZ3VjaWdhbHBhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzZcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvR2FsYXBhZ29zXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA2OjAwKSBDZW50cmFsIFRpbWUgKFVTICYgQ2FuYWRhKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NoaWNhZ29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9Lbm94XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvVGVsbF9DaXR5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hdGFtb3Jvc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NZW5vbWluZWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTm9ydGhfRGFrb3RhL0JldWxhaFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ob3J0aF9EYWtvdGEvQ2VudGVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05vcnRoX0Rha290YS9OZXdfU2FsZW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmFpbnlfUml2ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUmFua2luX0lubGV0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Jlc29sdXRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1dpbm5pcGVnXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJDU1Q2Q0RUXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBTdGFuZGFyZCBUaW1lIChNZXhpY28pXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA2OjAwKSBHdWFkYWxhamFyYSwgTWV4aWNvIENpdHksIE1vbnRlcnJleVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JhaGlhX0JhbmRlcmFzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NhbmN1blwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NZXJpZGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTWV4aWNvX0NpdHlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTW9udGVycmV5XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2FuYWRhIENlbnRyYWwgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDQ1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC02LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA2OjAwKSBTYXNrYXRjaGV3YW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SZWdpbmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3dpZnRfQ3VycmVudFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNBIFBhY2lmaWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC01LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA1OjAwKSBCb2dvdGEsIExpbWEsIFF1aXRvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQm9nb3RhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0NheW1hblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Db3JhbF9IYXJib3VyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0VpcnVuZXBlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0d1YXlhcXVpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9KYW1haWNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0xpbWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUGFuYW1hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Jpb19CcmFuY29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQrNVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkVhc3Rlcm4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNTowMCkgRWFzdGVybiBUaW1lIChVUyAmIENhbmFkYSlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9EZXRyb2l0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0hhdmFuYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL1BldGVyc2J1cmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9WaW5jZW5uZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSW5kaWFuYS9XaW5hbWFjXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0lxYWx1aXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvS2VudHVja3kvTW9udGljZWxsb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Mb3Vpc3ZpbGxlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01vbnRyZWFsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL05hc3NhdVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9OZXdfWW9ya1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9OaXBpZ29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BhbmduaXJ0dW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BvcnQtYXUtUHJpbmNlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1RodW5kZXJfQmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1Rvcm9udG9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkVTVDVFRFRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJVUyBFYXN0ZXJuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVUVEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA1OjAwKSBJbmRpYW5hIChFYXN0KVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmEvTWFyZW5nb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9JbmRpYW5hL1ZldmF5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0luZGlhbmFwb2xpc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlZlbmV6dWVsYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlZTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNC41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjMwKSBDYXJhY2FzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ2FyYWNhc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlBhcmFndWF5IFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjAwKSBBc3VuY2lvblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FzdW5jaW9uXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQXRsYW50aWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDowMCkgQXRsYW50aWMgVGltZSAoQ2FuYWRhKVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0dsYWNlX0JheVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Hb29zZV9CYXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvSGFsaWZheFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Nb25jdG9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1RodWxlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9CZXJtdWRhXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBCcmF6aWxpYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDQlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC00LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTA0OjAwKSBDdWlhYmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYW1wb19HcmFuZGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ3VpYWJhXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU0EgV2VzdGVybiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNXU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDQ6MDApIEdlb3JnZXRvd24sIExhIFBheiwgTWFuYXVzLCBTYW4gSnVhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FuZ3VpbGxhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FudGlndWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJ1YmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmFyYmFkb3NcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQmxhbmMtU2FibG9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JvYV9WaXN0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DdXJhY2FvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0RvbWluaWNhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0dyYW5kX1R1cmtcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvR3JlbmFkYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9HdWFkZWxvdXBlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0d1eWFuYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9LcmFsZW5kaWprXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0xhX1BhelwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Mb3dlcl9QcmluY2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hbmF1c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYXJpZ290XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL01hcnRpbmlxdWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTW9udHNlcnJhdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Qb3J0X29mX1NwYWluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1BvcnRvX1ZlbGhvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1B1ZXJ0b19SaWNvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL1NhbnRvX0RvbWluZ29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfQmFydGhlbGVteVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9LaXR0c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9MdWNpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9UaG9tYXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU3RfVmluY2VudFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9Ub3J0b2xhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzRcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJQYWNpZmljIFNBIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiUFNTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wNDowMCkgU2FudGlhZ29cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TYW50aWFnb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9QYWxtZXJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOZXdmb3VuZGxhbmQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJORFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTIuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjMwKSBOZXdmb3VuZGxhbmRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TdF9Kb2huc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkUuIFNvdXRoIEFtZXJpY2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFU0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAtMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQy0wMzowMCkgQnJhc2lsaWFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TYW9fUGF1bG9cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBcmdlbnRpbmEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIEJ1ZW5vcyBBaXJlc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9MYV9SaW9qYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvUmlvX0dhbGxlZ29zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9TYWx0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9BcmdlbnRpbmEvU2FuX0p1YW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQXJnZW50aW5hL1Nhbl9MdWlzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9UdWN1bWFuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyZ2VudGluYS9Vc2h1YWlhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0J1ZW5vc19BaXJlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYXRhbWFyY2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvQ29yZG9iYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9KdWp1eVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NZW5kb3phXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU0EgRWFzdGVybiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNFU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIENheWVubmUsIEZvcnRhbGV6YVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0FyYWd1YWluYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9CZWxlbVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9DYXllbm5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0ZvcnRhbGV6YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9NYWNlaW9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvUGFyYW1hcmlib1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9SZWNpZmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvU2FudGFyZW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvUm90aGVyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvU3RhbmxleVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCszXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiR3JlZW5sYW5kIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiR0RUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0yLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDM6MDApIEdyZWVubGFuZFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0dvZHRoYWJcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNb250ZXZpZGVvIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBNb250ZXZpZGVvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTW9udGV2aWRlb1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkJhaGlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0zLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAzOjAwKSBTYWx2YWRvclwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0JhaGlhXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVRDLTAyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogLTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDI6MDApIENvb3JkaW5hdGVkIFVuaXZlcnNhbCBUaW1lLTAyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFtZXJpY2EvTm9yb25oYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvU291dGhfR2VvcmdpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVCsyXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTWlkLUF0bGFudGljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0xLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMtMDI6MDApIE1pZC1BdGxhbnRpYyAtIE9sZFwiXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJBem9yZXMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAxOjAwKSBBem9yZXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW1lcmljYS9TY29yZXNieXN1bmRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL0F6b3Jlc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNhcGUgVmVyZGUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDVlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IC0xLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDLTAxOjAwKSBDYXBlIFZlcmRlIElzLlwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9DYXBlX1ZlcmRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01UKzFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJNb3JvY2NvIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQykgQ2FzYWJsYW5jYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQ2FzYWJsYW5jYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0VsX0FhaXVuXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVRDXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNVVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKSBDb29yZGluYXRlZCBVbml2ZXJzYWwgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbWVyaWNhL0Rhbm1hcmtzaGF2blwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkdNVCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkdEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMpIER1YmxpbiwgRWRpbmJ1cmdoLCBMaXNib24sIExvbmRvblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9DYW5hcnlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF0bGFudGljL0ZhZXJvZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvTWFkZWlyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0R1YmxpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0d1ZXJuc2V5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvSXNsZV9vZl9NYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9KZXJzZXlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9MaXNib25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Mb25kb25cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJHcmVlbndpY2ggU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJHU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQykgTW9ucm92aWEsIFJleWtqYXZpa1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQWJpZGphblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0FjY3JhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQmFtYWtvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQmFuanVsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQmlzc2F1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQ29uYWtyeVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0Rha2FyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRnJlZXRvd25cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Mb21lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTW9ucm92aWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Ob3Vha2Nob3R0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvT3VhZ2Fkb3Vnb3VcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9TYW9fVG9tZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXRsYW50aWMvUmV5a2phdmlrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdGxhbnRpYy9TdF9IZWxlbmFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJXLiBFdXJvcGUgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJXRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgQW1zdGVyZGFtLCBCZXJsaW4sIEJlcm4sIFJvbWUsIFN0b2NraG9sbSwgVmllbm5hXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFyY3RpYy9Mb25neWVhcmJ5ZW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9BbXN0ZXJkYW1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9BbmRvcnJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQmVybGluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvQnVzaW5nZW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9HaWJyYWx0YXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9MdXhlbWJvdXJnXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvTWFsdGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Nb25hY29cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Pc2xvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvUm9tZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1Nhbl9NYXJpbm9cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9TdG9ja2hvbG1cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9WYWR1elwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ZhdGljYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9WaWVubmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9adXJpY2hcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIEV1cm9wZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNFRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBCZWxncmFkZSwgQnJhdGlzbGF2YSwgQnVkYXBlc3QsIExqdWJsamFuYSwgUHJhZ3VlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CZWxncmFkZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0JyYXRpc2xhdmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CdWRhcGVzdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0xqdWJsamFuYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1BvZGdvcmljYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1ByYWd1ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1RpcmFuZVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlJvbWFuY2UgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJSRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBCcnVzc2VscywgQ29wZW5oYWdlbiwgTWFkcmlkLCBQYXJpc1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQ2V1dGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9CcnVzc2Vsc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0NvcGVuaGFnZW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9NYWRyaWRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9QYXJpc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbnRyYWwgRXVyb3BlYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMTowMCkgU2FyYWpldm8sIFNrb3BqZSwgV2Fyc2F3LCBaYWdyZWJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL1NhcmFqZXZvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU2tvcGplXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvV2Fyc2F3XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvWmFncmViXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVy4gQ2VudHJhbCBBZnJpY2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJXQ0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAxOjAwKSBXZXN0IENlbnRyYWwgQWZyaWNhXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9BbGdpZXJzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQmFuZ3VpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQnJhenphdmlsbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Eb3VhbGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9LaW5zaGFzYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0xhZ29zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTGlicmV2aWxsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0x1YW5kYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL01hbGFib1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL05kamFtZW5hXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTmlhbWV5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvUG9ydG8tTm92b1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL1R1bmlzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTFcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJOYW1pYmlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDE6MDApIFdpbmRob2VrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9XaW5kaG9la1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkdUQiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkdEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEF0aGVucywgQnVjaGFyZXN0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTmljb3NpYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0F0aGVuc1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0J1Y2hhcmVzdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0NoaXNpbmF1XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTWlkZGxlIEVhc3QgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNRURUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgQmVpcnV0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmVpcnV0XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRWd5cHQgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgQ2Fpcm9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0NhaXJvXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU3lyaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAyOjAwKSBEYW1hc2N1c1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0RhbWFzY3VzXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRS4gRXVyb3BlIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRUVEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEUuIEV1cm9wZVwiXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTb3V0aCBBZnJpY2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJTQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEhhcmFyZSwgUHJldG9yaWFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0JsYW50eXJlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQnVqdW1idXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvR2Fib3JvbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9IYXJhcmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Kb2hhbm5lc2J1cmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9LaWdhbGlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9MdWJ1bWJhc2hpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTHVzYWthXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTWFwdXRvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTWFzZXJ1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTWJhYmFuZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0yXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiRkxFIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRkRUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMjowMCkgSGVsc2lua2ksIEt5aXYsIFJpZ2EsIFNvZmlhLCBUYWxsaW5uLCBWaWxuaXVzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9IZWxzaW5raVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXVyb3BlL0tpZXZcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9NYXJpZWhhbW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9SaWdhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvU29maWFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9UYWxsaW5uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVXpoZ29yb2RcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9WaWxuaXVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvWmFwb3Jvemh5ZVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlR1cmtleSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlREVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIElzdGFuYnVsXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Jc3RhbmJ1bFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIklzcmFlbCBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkpEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIEplcnVzYWxlbVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0plcnVzYWxlbVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkxpYnlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDI6MDApIFRyaXBvbGlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL1RyaXBvbGlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJKb3JkYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJKU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzowMCkgQW1tYW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BbW1hblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFyYWJpYyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkFTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAzLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzAzOjAwKSBCYWdoZGFkXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmFnaGRhZFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkthbGluaW5ncmFkIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiS1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MDApIEthbGluaW5ncmFkLCBNaW5za1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvS2FsaW5pbmdyYWRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9NaW5za1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFyYWIgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzowMCkgS3V3YWl0LCBSaXlhZGhcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BZGVuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0JhaHJhaW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS3V3YWl0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1FhdGFyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1JpeWFkaFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkUuIEFmcmljYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswMzowMCkgTmFpcm9iaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvQWRkaXNfQWJhYmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9Bc21lcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9EYXJfZXNfU2FsYWFtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvRGppYm91dGlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFmcmljYS9KdWJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvS2FtcGFsYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQWZyaWNhL0toYXJ0b3VtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTW9nYWRpc2h1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBZnJpY2EvTmFpcm9iaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9TeW93YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0zXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vQW50YW5hbmFyaXZvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vQ29tb3JvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vTWF5b3R0ZVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIklyYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJJRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNC41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDM6MzApIFRlaHJhblwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1RlaHJhblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFyYWJpYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgQWJ1IERoYWJpLCBNdXNjYXRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9EdWJhaVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9NdXNjYXRcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtNFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkF6ZXJiYWlqYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBRFRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBCYWt1XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmFrdVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlJ1c3NpYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJSU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgTW9zY293LCBTdC4gUGV0ZXJzYnVyZywgVm9sZ29ncmFkXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9Nb3Njb3dcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9TYW1hcmFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV1cm9wZS9TaW1mZXJvcG9sXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdXJvcGUvVm9sZ29ncmFkXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTWF1cml0aXVzIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDQ6MDApIFBvcnQgTG91aXNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL01haGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9NYXVyaXRpdXNcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9SZXVuaW9uXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiR2VvcmdpYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJHU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDowMCkgVGJpbGlzaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1RiaWxpc2lcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDYXVjYXN1cyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA0LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA0OjAwKSBZZXJldmFuXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvWWVyZXZhblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFmZ2hhbmlzdGFuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDQuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNDozMCkgS2FidWxcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LYWJ1bFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIldlc3QgQXNpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIldBU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNTowMCkgQXNoZ2FiYXQsIFRhc2hrZW50XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFudGFyY3RpY2EvTWF3c29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FxdGF1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0FxdG9iZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Bc2hnYWJhdFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9EdXNoYW5iZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9PcmFsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1NhbWFya2FuZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9UYXNoa2VudFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC01XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vS2VyZ3VlbGVuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vTWFsZGl2ZXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJQYWtpc3RhbiBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlBTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA1OjAwKSBJc2xhbWFiYWQsIEthcmFjaGlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LYXJhY2hpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSW5kaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJJU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNS41LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA1OjMwKSBDaGVubmFpLCBLb2xrYXRhLCBNdW1iYWksIE5ldyBEZWxoaVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0NhbGN1dHRhXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU3JpIExhbmthIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU0xTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA1LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDU6MzApIFNyaSBKYXlhd2FyZGVuZXB1cmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Db2xvbWJvXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTmVwYWwgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJOU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogNS43NSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswNTo0NSkgS2F0aG1hbmR1XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS2F0bWFuZHVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDZW50cmFsIEFzaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJDQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDY6MDApIEFzdGFuYVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL1Zvc3Rva1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BbG1hdHlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvQmlzaGtla1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9ReXp5bG9yZGFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVXJ1bXFpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTZcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkluZGlhbi9DaGFnb3NcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJCYW5nbGFkZXNoIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDYsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDY6MDApIERoYWthXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvRGhha2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVGhpbXBodVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkVrYXRlcmluYnVyZyBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkVTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA2LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA2OjAwKSBFa2F0ZXJpbmJ1cmdcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9ZZWthdGVyaW5idXJnXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTXlhbm1hciBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1TVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA2LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDY6MzApIFlhbmdvbiAoUmFuZ29vbilcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9SYW5nb29uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJJbmRpYW4vQ29jb3NcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTRSBBc2lhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiU0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA3LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA3OjAwKSBCYW5na29rLCBIYW5vaSwgSmFrYXJ0YVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL0RhdmlzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0Jhbmdrb2tcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSG92ZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9KYWthcnRhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Bobm9tX1BlbmhcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvUG9udGlhbmFrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1NhaWdvblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9WaWVudGlhbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtN1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiSW5kaWFuL0NocmlzdG1hc1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk4uIENlbnRyYWwgQXNpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5DQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDcsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDc6MDApIE5vdm9zaWJpcnNrXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTm92b2t1em5ldHNrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL05vdm9zaWJpcnNrXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL09tc2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJDaGluYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIkNTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBCZWlqaW5nLCBDaG9uZ3FpbmcsIEhvbmcgS29uZywgVXJ1bXFpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvSG9uZ19Lb25nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL01hY2F1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1NoYW5naGFpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTm9ydGggQXNpYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk5BU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgS3Jhc25veWFyc2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LcmFzbm95YXJza1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNpbmdhcG9yZSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIk1QU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgS3VhbGEgTHVtcHVyLCBTaW5nYXBvcmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9CcnVuZWlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS3VhbGFfTHVtcHVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0t1Y2hpbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTWFrYXNzYXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvTWFuaWxhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1NpbmdhcG9yZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC04XCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVy4gQXVzdHJhbGlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiV0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA4LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA4OjAwKSBQZXJ0aFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBbnRhcmN0aWNhL0Nhc2V5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvUGVydGhcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJUYWlwZWkgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJUU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgVGFpcGVpXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvVGFpcGVpXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVWxhYW5iYWF0YXIgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJVU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswODowMCkgVWxhYW5iYWF0YXJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9DaG9pYmFsc2FuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1VsYWFuYmFhdGFyXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiTm9ydGggQXNpYSBFYXN0IFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTkFFU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogOSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswOTowMCkgSXJrdXRza1wiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0lya3V0c2tcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJUb2t5byBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlRTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA5LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA5OjAwKSBPc2FrYSwgU2FwcG9ybywgVG9reW9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9EaWxpXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL0pheWFwdXJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1Rva3lvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJFdGMvR01ULTlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvUGFsYXVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJLb3JlYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIktTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA5LFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzA5OjAwKSBTZW91bFwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL1B5b25neWFuZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TZW91bFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkNlbi4gQXVzdHJhbGlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ0FTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiA5LjUsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMDk6MzApIEFkZWxhaWRlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9BZGVsYWlkZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0Jyb2tlbl9IaWxsXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQVVTIENlbnRyYWwgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJBQ1NUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDkuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQyswOTozMCkgRGFyd2luXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9EYXJ3aW5cIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFLiBBdXN0cmFsaWEgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJFQVNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEwOjAwKSBCcmlzYmFuZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInV0Y1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJBdXN0cmFsaWEvQnJpc2JhbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9MaW5kZW1hblwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkFVUyBFYXN0ZXJuIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQUVTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMCxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMDowMCkgQ2FuYmVycmEsIE1lbGJvdXJuZSwgU3lkbmV5XCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9NZWxib3VybmVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkF1c3RyYWxpYS9TeWRuZXlcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJXZXN0IFBhY2lmaWMgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJXUFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEwOjAwKSBHdWFtLCBQb3J0IE1vcmVzYnlcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9EdW1vbnREVXJ2aWxsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0xMFwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9HdWFtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL1BvcnRfTW9yZXNieVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9TYWlwYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvVHJ1a1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlRhc21hbmlhIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiVFNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEwLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEwOjAwKSBIb2JhcnRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0N1cnJpZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXVzdHJhbGlhL0hvYmFydFwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIllha3V0c2sgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJZU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTAsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTA6MDApIFlha3V0c2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9DaGl0YVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9LaGFuZHlnYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9ZYWt1dHNrXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiQ2VudHJhbCBQYWNpZmljIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiQ1BTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMTowMCkgU29sb21vbiBJcy4sIE5ldyBDYWxlZG9uaWFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9NYWNxdWFyaWVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMTFcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvRWZhdGVcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvR3VhZGFsY2FuYWxcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvS29zcmFlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL05vdW1lYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Qb25hcGVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJWbGFkaXZvc3RvayBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlZTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMSxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMTowMCkgVmxhZGl2b3N0b2tcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9TYWtoYWxpblwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9Vc3QtTmVyYVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9WbGFkaXZvc3Rva1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk5ldyBaZWFsYW5kIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiTlpTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMixcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMjowMCkgQXVja2xhbmQsIFdlbGxpbmd0b25cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQW50YXJjdGljYS9NY011cmRvXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL0F1Y2tsYW5kXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVVRDKzEyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTI6MDApIENvb3JkaW5hdGVkIFVuaXZlcnNhbCBUaW1lKzEyXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIkV0Yy9HTVQtMTJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvRnVuYWZ1dGlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvS3dhamFsZWluXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJQYWNpZmljL01hanVyb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9OYXVydVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9UYXJhd2FcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvV2FrZVwiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9XYWxsaXNcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJGaWppIFN0YW5kYXJkIFRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhYmJyXCI6IFwiRlNUXCIsXG4gICAgICAgICAgICAgICAgICAgIFwib2Zmc2V0XCI6IDEyLFxuICAgICAgICAgICAgICAgICAgICBcImlzZHN0XCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEyOjAwKSBGaWppXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidXRjXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvRmlqaVwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIk1hZ2FkYW4gU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJNU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTIsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTI6MDApIE1hZ2FkYW5cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiQXNpYS9BbmFkeXJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvS2FtY2hhdGthXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJBc2lhL01hZ2FkYW5cIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkFzaWEvU3JlZG5la29seW1za1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkthbWNoYXRrYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIktEVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInRleHRcIjogXCIoVVRDKzEyOjAwKSBQZXRyb3BhdmxvdnNrLUthbWNoYXRza3kgLSBPbGRcIlxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiVG9uZ2EgU3RhbmRhcmQgVGltZVwiLFxuICAgICAgICAgICAgICAgICAgICBcImFiYnJcIjogXCJUU1RcIixcbiAgICAgICAgICAgICAgICAgICAgXCJvZmZzZXRcIjogMTMsXG4gICAgICAgICAgICAgICAgICAgIFwiaXNkc3RcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwidGV4dFwiOiBcIihVVEMrMTM6MDApIE51a3UnYWxvZmFcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRXRjL0dNVC0xM1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9FbmRlcmJ1cnlcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIlBhY2lmaWMvRmFrYW9mb1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9Ub25nYXRhcHVcIlxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTYW1vYSBTdGFuZGFyZCBUaW1lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYWJiclwiOiBcIlNTVFwiLFxuICAgICAgICAgICAgICAgICAgICBcIm9mZnNldFwiOiAxMyxcbiAgICAgICAgICAgICAgICAgICAgXCJpc2RzdFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0XCI6IFwiKFVUQysxMzowMCkgU2Ftb2FcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ1dGNcIjogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiUGFjaWZpYy9BcGlhXCJcbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgIC8vTGlzdCBzb3VyY2U6IGh0dHA6Ly9hbnN3ZXJzLmdvb2dsZS5jb20vYW5zd2Vycy90aHJlYWR2aWV3L2lkLzU4OTMxMi5odG1sXG4gICAgICAgIHByb2Zlc3Npb246IFtcbiAgICAgICAgICAgIFwiQWlybGluZSBQaWxvdFwiLFxuICAgICAgICAgICAgXCJBY2FkZW1pYyBUZWFtXCIsXG4gICAgICAgICAgICBcIkFjY291bnRhbnRcIixcbiAgICAgICAgICAgIFwiQWNjb3VudCBFeGVjdXRpdmVcIixcbiAgICAgICAgICAgIFwiQWN0b3JcIixcbiAgICAgICAgICAgIFwiQWN0dWFyeVwiLFxuICAgICAgICAgICAgXCJBY3F1aXNpdGlvbiBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkFkbWluaXN0cmF0aXZlIEFzc3QuXCIsXG4gICAgICAgICAgICBcIkFkbWluaXN0cmF0aXZlIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJBZHZlcnRpc2luZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJBZXJvc3BhY2UgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQWdlbnRcIixcbiAgICAgICAgICAgIFwiQWdyaWN1bHR1cmFsIEluc3BlY3RvclwiLFxuICAgICAgICAgICAgXCJBZ3JpY3VsdHVyYWwgU2NpZW50aXN0XCIsXG4gICAgICAgICAgICBcIkFpciBUcmFmZmljIENvbnRyb2xsZXJcIixcbiAgICAgICAgICAgIFwiQW5pbWFsIFRyYWluZXJcIixcbiAgICAgICAgICAgIFwiQW50aHJvcG9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiQXBwcmFpc2VyXCIsXG4gICAgICAgICAgICBcIkFyY2hpdGVjdFwiLFxuICAgICAgICAgICAgXCJBcnQgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiQXJ0aXN0XCIsXG4gICAgICAgICAgICBcIkFzdHJvbm9tZXJcIixcbiAgICAgICAgICAgIFwiQXRobGV0aWMgQ29hY2hcIixcbiAgICAgICAgICAgIFwiQXVkaXRvclwiLFxuICAgICAgICAgICAgXCJBdXRob3JcIixcbiAgICAgICAgICAgIFwiQmFrZXJcIixcbiAgICAgICAgICAgIFwiQmFua2VyXCIsXG4gICAgICAgICAgICBcIkJhbmtydXB0Y3kgQXR0b3JuZXlcIixcbiAgICAgICAgICAgIFwiQmVuZWZpdHMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJCaW9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiQmlvLWZlZWRiYWNrIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiQmlvbWVkaWNhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJCaW90ZWNobmljYWwgUmVzZWFyY2hlclwiLFxuICAgICAgICAgICAgXCJCcm9hZGNhc3RlclwiLFxuICAgICAgICAgICAgXCJCcm9rZXJcIixcbiAgICAgICAgICAgIFwiQnVpbGRpbmcgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJCdWlsZGluZyBDb250cmFjdG9yXCIsXG4gICAgICAgICAgICBcIkJ1aWxkaW5nIEluc3BlY3RvclwiLFxuICAgICAgICAgICAgXCJCdXNpbmVzcyBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkJ1c2luZXNzIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiQnVzaW5lc3MgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJCdXllclwiLFxuICAgICAgICAgICAgXCJDYWxsIENlbnRlciBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNhcmVlciBDb3Vuc2Vsb3JcIixcbiAgICAgICAgICAgIFwiQ2FzaCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNlcmFtaWMgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ2hpZWYgRXhlY3V0aXZlIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ2hpZWYgT3BlcmF0aW9uIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ2hlZlwiLFxuICAgICAgICAgICAgXCJDaGVtaWNhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJDaGVtaXN0XCIsXG4gICAgICAgICAgICBcIkNoaWxkIENhcmUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDaGllZiBNZWRpY2FsIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ2hpcm9wcmFjdG9yXCIsXG4gICAgICAgICAgICBcIkNpbmVtYXRvZ3JhcGhlclwiLFxuICAgICAgICAgICAgXCJDaXR5IEhvdXNpbmcgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDaXR5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2l2aWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ2xhaW1zIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ2xpbmljYWwgUmVzZWFyY2ggQXNzaXN0YW50XCIsXG4gICAgICAgICAgICBcIkNvbGxlY3Rpb25zIE1hbmFnZXIuXCIsXG4gICAgICAgICAgICBcIkNvbXBsaWFuY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDb21wdHJvbGxlclwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNvbW1lcmNpYWwgQXJ0aXN0XCIsXG4gICAgICAgICAgICBcIkNvbW11bmljYXRpb25zIEFmZmFpcnMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiQ29tbXVuaWNhdGlvbnMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiQ29tbXVuaWNhdGlvbnMgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ29tcGVuc2F0aW9uIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgUHJvZ3JhbW1lclwiLFxuICAgICAgICAgICAgXCJDb21wdXRlciBPcHMuIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgT3BlcmF0b3JcIixcbiAgICAgICAgICAgIFwiQ29tcHV0ZXIgR3JhcGhpY3MgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJDb25zdHJ1Y3Rpb24gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiQ29uc3RydWN0aW9uIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiQ29uc3VsdGFudFwiLFxuICAgICAgICAgICAgXCJDb25zdW1lciBSZWxhdGlvbnMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJDb250cmFjdCBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIkNvcHlyaWdodCBBdHRvcm5leVwiLFxuICAgICAgICAgICAgXCJDb3B5d3JpdGVyXCIsXG4gICAgICAgICAgICBcIkNvcnBvcmF0ZSBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIkNvcnJlY3Rpb25zIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ29zbWV0b2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJDcmVkaXQgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJDcnVpc2UgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiQ2hpZWYgSW5mb3JtYXRpb24gT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJDaGllZiBUZWNobm9sb2d5IE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiQ3VzdG9tZXIgU2VydmljZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkNyeXB0b2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJEYW5jZXJcIixcbiAgICAgICAgICAgIFwiRGF0YSBTZWN1cml0eSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkRhdGFiYXNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRGF5IENhcmUgSW5zdHJ1Y3RvclwiLFxuICAgICAgICAgICAgXCJEZW50aXN0XCIsXG4gICAgICAgICAgICBcIkRlc2lnbmVyXCIsXG4gICAgICAgICAgICBcIkRlc2lnbiBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJEZXNrdG9wIFB1Ymxpc2hlclwiLFxuICAgICAgICAgICAgXCJEZXZlbG9wZXJcIixcbiAgICAgICAgICAgIFwiRGV2ZWxvcG1lbnQgT2ZmaWNlclwiLFxuICAgICAgICAgICAgXCJEaWFtb25kIE1lcmNoYW50XCIsXG4gICAgICAgICAgICBcIkRpZXRpdGlhblwiLFxuICAgICAgICAgICAgXCJEaXJlY3QgTWFya2V0ZXJcIixcbiAgICAgICAgICAgIFwiRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiRGlzdHJpYnV0aW9uIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRGl2ZXJzaXR5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRWNvbm9taXN0XCIsXG4gICAgICAgICAgICBcIkVFTyBDb21wbGlhbmNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRWRpdG9yXCIsXG4gICAgICAgICAgICBcIkVkdWNhdGlvbiBBZG1pbmF0b3JcIixcbiAgICAgICAgICAgIFwiRWxlY3RyaWNhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJFbGVjdHJvIE9wdGljYWwgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRWxlY3Ryb25pY3MgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiRW1iYXNzeSBNYW5hZ2VtZW50XCIsXG4gICAgICAgICAgICBcIkVtcGxveW1lbnQgQWdlbnRcIixcbiAgICAgICAgICAgIFwiRW5naW5lZXIgVGVjaG5pY2lhblwiLFxuICAgICAgICAgICAgXCJFbnRyZXByZW5ldXJcIixcbiAgICAgICAgICAgIFwiRW52aXJvbm1lbnRhbCBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkVudmlyb25tZW50YWwgQXR0b3JuZXlcIixcbiAgICAgICAgICAgIFwiRW52aXJvbm1lbnRhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJFbnZpcm9ubWVudGFsIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiRXNjcm93IE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiRXN0aW1hdG9yXCIsXG4gICAgICAgICAgICBcIkV4ZWN1dGl2ZSBBc3Npc3RhbnRcIixcbiAgICAgICAgICAgIFwiRXhlY3V0aXZlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkV4ZWN1dGl2ZSBSZWNydWl0ZXJcIixcbiAgICAgICAgICAgIFwiRmFjaWxpdGllcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkZhbWlseSBDb3Vuc2Vsb3JcIixcbiAgICAgICAgICAgIFwiRmFzaGlvbiBFdmVudHMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJGYXNoaW9uIE1lcmNoYW5kaXNlclwiLFxuICAgICAgICAgICAgXCJGYXN0IEZvb2QgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJGaWxtIFByb2R1Y2VyXCIsXG4gICAgICAgICAgICBcIkZpbG0gUHJvZHVjdGlvbiBBc3Npc3RhbnRcIixcbiAgICAgICAgICAgIFwiRmluYW5jaWFsIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiRmluYW5jaWFsIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiRmluYW5jaWVyXCIsXG4gICAgICAgICAgICBcIkZpbmUgQXJ0aXN0XCIsXG4gICAgICAgICAgICBcIldpbGRsaWZlIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiRml0bmVzcyBDb25zdWx0YW50XCIsXG4gICAgICAgICAgICBcIkZsaWdodCBBdHRlbmRhbnRcIixcbiAgICAgICAgICAgIFwiRmxpZ2h0IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkZsb3JhbCBEZXNpZ25lclwiLFxuICAgICAgICAgICAgXCJGb29kICYgQmV2ZXJhZ2UgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiRm9vZCBTZXJ2aWNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiRm9yZXN0cnkgVGVjaG5pY2lhblwiLFxuICAgICAgICAgICAgXCJGcmFuY2hpc2UgTWFuYWdlbWVudFwiLFxuICAgICAgICAgICAgXCJGcmFuY2hpc2UgU2FsZXNcIixcbiAgICAgICAgICAgIFwiRnJhdWQgSW52ZXN0aWdhdG9yXCIsXG4gICAgICAgICAgICBcIkZyZWVsYW5jZSBXcml0ZXJcIixcbiAgICAgICAgICAgIFwiRnVuZCBSYWlzZXJcIixcbiAgICAgICAgICAgIFwiR2VuZXJhbCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkdlb2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJHZW5lcmFsIENvdW5zZWxcIixcbiAgICAgICAgICAgIFwiR2VyaWF0cmljIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiR2Vyb250b2xvZ2lzdFwiLFxuICAgICAgICAgICAgXCJHbGFtb3VyIFBob3RvZ3JhcGhlclwiLFxuICAgICAgICAgICAgXCJHb2xmIENsdWIgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJHb3VybWV0IENoZWZcIixcbiAgICAgICAgICAgIFwiR3JhcGhpYyBEZXNpZ25lclwiLFxuICAgICAgICAgICAgXCJHcm91bmRzIEtlZXBlclwiLFxuICAgICAgICAgICAgXCJIYXphcmRvdXMgV2FzdGUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJIZWFsdGggQ2FyZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkhlYWx0aCBUaGVyYXBpc3RcIixcbiAgICAgICAgICAgIFwiSGVhbHRoIFNlcnZpY2UgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJIZWFyaW5nIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiSG9tZSBFY29ub21pc3RcIixcbiAgICAgICAgICAgIFwiSG9ydGljdWx0dXJpc3RcIixcbiAgICAgICAgICAgIFwiSG9zcGl0YWwgQWRtaW5pc3RyYXRvclwiLFxuICAgICAgICAgICAgXCJIb3RlbCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkh1bWFuIFJlc291cmNlcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkltcG9ydGVyXCIsXG4gICAgICAgICAgICBcIkluZHVzdHJpYWwgRGVzaWduZXJcIixcbiAgICAgICAgICAgIFwiSW5kdXN0cmlhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJJbmZvcm1hdGlvbiBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJJbnNpZGUgU2FsZXNcIixcbiAgICAgICAgICAgIFwiSW5zdXJhbmNlIEFkanVzdGVyXCIsXG4gICAgICAgICAgICBcIkludGVyaW9yIERlY29yYXRvclwiLFxuICAgICAgICAgICAgXCJJbnRlcm5hbCBDb250cm9scyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJJbnRlcm5hdGlvbmFsIEFjY3QuXCIsXG4gICAgICAgICAgICBcIkludGVybmF0aW9uYWwgQ291cmllclwiLFxuICAgICAgICAgICAgXCJJbnRlcm5hdGlvbmFsIExhd3llclwiLFxuICAgICAgICAgICAgXCJJbnRlcnByZXRlclwiLFxuICAgICAgICAgICAgXCJJbnZlc3RpZ2F0b3JcIixcbiAgICAgICAgICAgIFwiSW52ZXN0bWVudCBCYW5rZXJcIixcbiAgICAgICAgICAgIFwiSW52ZXN0bWVudCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIklUIEFyY2hpdGVjdFwiLFxuICAgICAgICAgICAgXCJJVCBQcm9qZWN0IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiSVQgU3lzdGVtcyBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIkpld2VsZXJcIixcbiAgICAgICAgICAgIFwiSm9pbnQgVmVudHVyZSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkpvdXJuYWxpc3RcIixcbiAgICAgICAgICAgIFwiTGFib3IgTmVnb3RpYXRvclwiLFxuICAgICAgICAgICAgXCJMYWJvciBPcmdhbml6ZXJcIixcbiAgICAgICAgICAgIFwiTGFib3IgUmVsYXRpb25zIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTGFiIFNlcnZpY2VzIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIkxhYiBUZWNobmljaWFuXCIsXG4gICAgICAgICAgICBcIkxhbmQgRGV2ZWxvcGVyXCIsXG4gICAgICAgICAgICBcIkxhbmRzY2FwZSBBcmNoaXRlY3RcIixcbiAgICAgICAgICAgIFwiTGF3IEVuZm9yY2VtZW50IE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiTGF3eWVyXCIsXG4gICAgICAgICAgICBcIkxlYWQgU29mdHdhcmUgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiTGVhZCBTb2Z0d2FyZSBUZXN0IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIkxlYXNpbmcgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJMZWdhbCBTZWNyZXRhcnlcIixcbiAgICAgICAgICAgIFwiTGlicmFyeSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIkxpdGlnYXRpb24gQXR0b3JuZXlcIixcbiAgICAgICAgICAgIFwiTG9hbiBPZmZpY2VyXCIsXG4gICAgICAgICAgICBcIkxvYmJ5aXN0XCIsXG4gICAgICAgICAgICBcIkxvZ2lzdGljcyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk1haW50ZW5hbmNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTWFuYWdlbWVudCBDb25zdWx0YW50XCIsXG4gICAgICAgICAgICBcIk1hbmFnZWQgQ2FyZSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJNYW5hZ2luZyBQYXJ0bmVyXCIsXG4gICAgICAgICAgICBcIk1hbnVmYWN0dXJpbmcgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTWFucG93ZXIgUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJNYXJpbmUgQmlvbG9naXN0XCIsXG4gICAgICAgICAgICBcIk1hcmtldCBSZXMuIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiTWFya2V0aW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIk1hdGVyaWFscyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIk1hdGhlbWF0aWNpYW5cIixcbiAgICAgICAgICAgIFwiTWVtYmVyc2hpcCBDaGFpcm1hblwiLFxuICAgICAgICAgICAgXCJNZWNoYW5pY1wiLFxuICAgICAgICAgICAgXCJNZWNoYW5pY2FsIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIk1lZGlhIEJ1eWVyXCIsXG4gICAgICAgICAgICBcIk1lZGljYWwgSW52ZXN0b3JcIixcbiAgICAgICAgICAgIFwiTWVkaWNhbCBTZWNyZXRhcnlcIixcbiAgICAgICAgICAgIFwiTWVkaWNhbCBUZWNobmljaWFuXCIsXG4gICAgICAgICAgICBcIk1lbnRhbCBIZWFsdGggQ291bnNlbG9yXCIsXG4gICAgICAgICAgICBcIk1lcmNoYW5kaXNlclwiLFxuICAgICAgICAgICAgXCJNZXRhbGx1cmdpY2FsIEVuZ2luZWVyaW5nXCIsXG4gICAgICAgICAgICBcIk1ldGVvcm9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiTWljcm9iaW9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiTUlTIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiTW90aW9uIFBpY3R1cmUgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiTXVsdGltZWRpYSBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJNdXNpY2lhblwiLFxuICAgICAgICAgICAgXCJOZXR3b3JrIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiTmV0d29yayBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIk5ldHdvcmsgT3BlcmF0b3JcIixcbiAgICAgICAgICAgIFwiTmV3IFByb2R1Y3QgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJOb3ZlbGlzdFwiLFxuICAgICAgICAgICAgXCJOdWNsZWFyIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIk51Y2xlYXIgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJOdXRyaXRpb25pc3RcIixcbiAgICAgICAgICAgIFwiTnVyc2luZyBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIk9jY3VwYXRpb25hbCBUaGVyYXBpc3RcIixcbiAgICAgICAgICAgIFwiT2NlYW5vZ3JhcGhlclwiLFxuICAgICAgICAgICAgXCJPZmZpY2UgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJPcGVyYXRpb25zIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiT3BlcmF0aW9ucyBSZXNlYXJjaCBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJPcHRpY2FsIFRlY2huaWNpYW5cIixcbiAgICAgICAgICAgIFwiT3B0b21ldHJpc3RcIixcbiAgICAgICAgICAgIFwiT3JnYW5pemF0aW9uYWwgRGV2ZWxvcG1lbnQgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJPdXRwbGFjZW1lbnQgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJQYXJhbGVnYWxcIixcbiAgICAgICAgICAgIFwiUGFyayBSYW5nZXJcIixcbiAgICAgICAgICAgIFwiUGF0ZW50IEF0dG9ybmV5XCIsXG4gICAgICAgICAgICBcIlBheXJvbGwgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJQZXJzb25uZWwgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJQZXRyb2xldW0gRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUGhhcm1hY2lzdFwiLFxuICAgICAgICAgICAgXCJQaG90b2dyYXBoZXJcIixcbiAgICAgICAgICAgIFwiUGh5c2ljYWwgVGhlcmFwaXN0XCIsXG4gICAgICAgICAgICBcIlBoeXNpY2lhblwiLFxuICAgICAgICAgICAgXCJQaHlzaWNpYW4gQXNzaXN0YW50XCIsXG4gICAgICAgICAgICBcIlBoeXNpY2lzdFwiLFxuICAgICAgICAgICAgXCJQbGFubmluZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJQb2RpYXRyaXN0XCIsXG4gICAgICAgICAgICBcIlBvbGl0aWNhbCBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIlBvbGl0aWNhbCBTY2llbnRpc3RcIixcbiAgICAgICAgICAgIFwiUG9saXRpY2lhblwiLFxuICAgICAgICAgICAgXCJQb3J0Zm9saW8gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJQcmVzY2hvb2wgTWFuYWdlbWVudFwiLFxuICAgICAgICAgICAgXCJQcmVzY2hvb2wgVGVhY2hlclwiLFxuICAgICAgICAgICAgXCJQcmluY2lwYWxcIixcbiAgICAgICAgICAgIFwiUHJpdmF0ZSBCYW5rZXJcIixcbiAgICAgICAgICAgIFwiUHJpdmF0ZSBJbnZlc3RpZ2F0b3JcIixcbiAgICAgICAgICAgIFwiUHJvYmF0aW9uIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiUHJvY2VzcyBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJQcm9kdWNlclwiLFxuICAgICAgICAgICAgXCJQcm9kdWN0IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUHJvZHVjdCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJQcm9kdWN0aW9uIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlByb2R1Y3Rpb24gUGxhbm5lclwiLFxuICAgICAgICAgICAgXCJQcm9mZXNzaW9uYWwgQXRobGV0ZVwiLFxuICAgICAgICAgICAgXCJQcm9mZXNzaW9uYWwgQ29hY2hcIixcbiAgICAgICAgICAgIFwiUHJvZmVzc29yXCIsXG4gICAgICAgICAgICBcIlByb2plY3QgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUHJvamVjdCBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlByb2dyYW0gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJQcm9wZXJ0eSBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlB1YmxpYyBBZG1pbmlzdHJhdG9yXCIsXG4gICAgICAgICAgICBcIlB1YmxpYyBTYWZldHkgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiUFIgU3BlY2lhbGlzdFwiLFxuICAgICAgICAgICAgXCJQdWJsaXNoZXJcIixcbiAgICAgICAgICAgIFwiUHVyY2hhc2luZyBBZ2VudFwiLFxuICAgICAgICAgICAgXCJQdWJsaXNoaW5nIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlF1YWxpdHkgQXNzdXJhbmNlIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiUXVhbGl0eSBDb250cm9sIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlF1YWxpdHkgQ29udHJvbCBJbnNwZWN0b3JcIixcbiAgICAgICAgICAgIFwiUmFkaW9sb2d5IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiUmFpbHJvYWQgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiUmVhbCBFc3RhdGUgQnJva2VyXCIsXG4gICAgICAgICAgICBcIlJlY3JlYXRpb25hbCBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJSZWNydWl0ZXJcIixcbiAgICAgICAgICAgIFwiUmVkZXZlbG9wbWVudCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlJlZ3VsYXRvcnkgQWZmYWlycyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlJlZ2lzdGVyZWQgTnVyc2VcIixcbiAgICAgICAgICAgIFwiUmVoYWJpbGl0YXRpb24gQ291bnNlbG9yXCIsXG4gICAgICAgICAgICBcIlJlbG9jYXRpb24gTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJSZXBvcnRlclwiLFxuICAgICAgICAgICAgXCJSZXNlYXJjaCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlJlc3RhdXJhbnQgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJSZXRhaWwgU3RvcmUgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJSaXNrIEFuYWx5c3RcIixcbiAgICAgICAgICAgIFwiU2FmZXR5IEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlNhbGVzIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlNhbGVzIFRyYWluZXJcIixcbiAgICAgICAgICAgIFwiU2FsZXMgUHJvbW90aW9uIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU2FsZXMgUmVwcmVzZW50YXRpdmVcIixcbiAgICAgICAgICAgIFwiU2FsZXMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTZXJ2aWNlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU2FuaXRhdGlvbiBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTY2llbnRpZmljIFByb2dyYW1tZXJcIixcbiAgICAgICAgICAgIFwiU2NpZW50aWZpYyBXcml0ZXJcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdGllcyBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIlNlY3VyaXR5IENvbnN1bHRhbnRcIixcbiAgICAgICAgICAgIFwiU2VjdXJpdHkgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU2VtaW5hciBQcmVzZW50ZXJcIixcbiAgICAgICAgICAgIFwiU2hpcCdzIE9mZmljZXJcIixcbiAgICAgICAgICAgIFwiU2luZ2VyXCIsXG4gICAgICAgICAgICBcIlNvY2lhbCBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTb2NpYWwgUHJvZ3JhbSBQbGFubmVyXCIsXG4gICAgICAgICAgICBcIlNvY2lhbCBSZXNlYXJjaFwiLFxuICAgICAgICAgICAgXCJTb2NpYWwgU2NpZW50aXN0XCIsXG4gICAgICAgICAgICBcIlNvY2lhbCBXb3JrZXJcIixcbiAgICAgICAgICAgIFwiU29jaW9sb2dpc3RcIixcbiAgICAgICAgICAgIFwiU29mdHdhcmUgRGV2ZWxvcGVyXCIsXG4gICAgICAgICAgICBcIlNvZnR3YXJlIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlNvZnR3YXJlIFRlc3QgRW5naW5lZXJcIixcbiAgICAgICAgICAgIFwiU29pbCBTY2llbnRpc3RcIixcbiAgICAgICAgICAgIFwiU3BlY2lhbCBFdmVudHMgTWFuYWdlclwiLFxuICAgICAgICAgICAgXCJTcGVjaWFsIEVkdWNhdGlvbiBUZWFjaGVyXCIsXG4gICAgICAgICAgICBcIlNwZWNpYWwgUHJvamVjdHMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU3BlZWNoIFBhdGhvbG9naXN0XCIsXG4gICAgICAgICAgICBcIlNwZWVjaCBXcml0ZXJcIixcbiAgICAgICAgICAgIFwiU3BvcnRzIEV2ZW50IE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU3RhdGlzdGljaWFuXCIsXG4gICAgICAgICAgICBcIlN0b3JlIE1hbmFnZXJcIixcbiAgICAgICAgICAgIFwiU3RyYXRlZ2ljIEFsbGlhbmNlIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlN0cmF0ZWdpYyBQbGFubmluZyBEaXJlY3RvclwiLFxuICAgICAgICAgICAgXCJTdHJlc3MgUmVkdWN0aW9uIFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiU3RvY2ticm9rZXJcIixcbiAgICAgICAgICAgIFwiU3VydmV5b3JcIixcbiAgICAgICAgICAgIFwiU3RydWN0dXJhbCBFbmdpbmVlclwiLFxuICAgICAgICAgICAgXCJTdXBlcmludGVuZGVudFwiLFxuICAgICAgICAgICAgXCJTdXBwbHkgQ2hhaW4gRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiU3lzdGVtIEVuZ2luZWVyXCIsXG4gICAgICAgICAgICBcIlN5c3RlbXMgQW5hbHlzdFwiLFxuICAgICAgICAgICAgXCJTeXN0ZW1zIFByb2dyYW1tZXJcIixcbiAgICAgICAgICAgIFwiU3lzdGVtIEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiVGF4IFNwZWNpYWxpc3RcIixcbiAgICAgICAgICAgIFwiVGVhY2hlclwiLFxuICAgICAgICAgICAgXCJUZWNobmljYWwgU3VwcG9ydCBTcGVjaWFsaXN0XCIsXG4gICAgICAgICAgICBcIlRlY2huaWNhbCBJbGx1c3RyYXRvclwiLFxuICAgICAgICAgICAgXCJUZWNobmljYWwgV3JpdGVyXCIsXG4gICAgICAgICAgICBcIlRlY2hub2xvZ3kgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiVGVsZWNvbSBBbmFseXN0XCIsXG4gICAgICAgICAgICBcIlRlbGVtYXJrZXRlclwiLFxuICAgICAgICAgICAgXCJUaGVhdHJpY2FsIERpcmVjdG9yXCIsXG4gICAgICAgICAgICBcIlRpdGxlIEV4YW1pbmVyXCIsXG4gICAgICAgICAgICBcIlRvdXIgRXNjb3J0XCIsXG4gICAgICAgICAgICBcIlRvdXIgR3VpZGUgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiVHJhZmZpYyBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlRyYWluZXIgVHJhbnNsYXRvclwiLFxuICAgICAgICAgICAgXCJUcmFuc3BvcnRhdGlvbiBNYW5hZ2VyXCIsXG4gICAgICAgICAgICBcIlRyYXZlbCBBZ2VudFwiLFxuICAgICAgICAgICAgXCJUcmVhc3VyZXJcIixcbiAgICAgICAgICAgIFwiVFYgUHJvZ3JhbW1lclwiLFxuICAgICAgICAgICAgXCJVbmRlcndyaXRlclwiLFxuICAgICAgICAgICAgXCJVbmlvbiBSZXByZXNlbnRhdGl2ZVwiLFxuICAgICAgICAgICAgXCJVbml2ZXJzaXR5IEFkbWluaXN0cmF0b3JcIixcbiAgICAgICAgICAgIFwiVW5pdmVyc2l0eSBEZWFuXCIsXG4gICAgICAgICAgICBcIlVyYmFuIFBsYW5uZXJcIixcbiAgICAgICAgICAgIFwiVmV0ZXJpbmFyaWFuXCIsXG4gICAgICAgICAgICBcIlZlbmRvciBSZWxhdGlvbnMgRGlyZWN0b3JcIixcbiAgICAgICAgICAgIFwiVml0aWN1bHR1cmlzdFwiLFxuICAgICAgICAgICAgXCJXYXJlaG91c2UgTWFuYWdlclwiXG4gICAgICAgIF1cbiAgICB9O1xuXG4gICAgdmFyIG9faGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuICAgIHZhciBvX2tleXMgPSAoT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmIChvX2hhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gX2NvcHlPYmplY3Qoc291cmNlLCB0YXJnZXQpIHtcbiAgICAgIHZhciBrZXlzID0gb19rZXlzKHNvdXJjZSk7XG4gICAgICB2YXIga2V5O1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV0gfHwgdGFyZ2V0W2tleV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2NvcHlBcnJheShzb3VyY2UsIHRhcmdldCkge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBzb3VyY2UubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRhcmdldFtpXSA9IHNvdXJjZVtpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb3B5T2JqZWN0KHNvdXJjZSwgX3RhcmdldCkge1xuICAgICAgICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkoc291cmNlKTtcbiAgICAgICAgdmFyIHRhcmdldCA9IF90YXJnZXQgfHwgKGlzQXJyYXkgPyBuZXcgQXJyYXkoc291cmNlLmxlbmd0aCkgOiB7fSk7XG5cbiAgICAgICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgICAgICBfY29weUFycmF5KHNvdXJjZSwgdGFyZ2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBfY29weU9iamVjdChzb3VyY2UsIHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKiBHZXQgdGhlIGRhdGEgYmFzZWQgb24ga2V5KiovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICByZXR1cm4gY29weU9iamVjdChkYXRhW25hbWVdKTtcbiAgICB9O1xuXG4gICAgLy8gTWFjIEFkZHJlc3NcbiAgICBDaGFuY2UucHJvdG90eXBlLm1hY19hZGRyZXNzID0gZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgICAgIC8vIHR5cGljYWxseSBtYWMgYWRkcmVzc2VzIGFyZSBzZXBhcmF0ZWQgYnkgXCI6XCJcbiAgICAgICAgLy8gaG93ZXZlciB0aGV5IGNhbiBhbHNvIGJlIHNlcGFyYXRlZCBieSBcIi1cIlxuICAgICAgICAvLyB0aGUgbmV0d29yayB2YXJpYW50IHVzZXMgYSBkb3QgZXZlcnkgZm91cnRoIGJ5dGVcblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIGlmKCFvcHRpb25zLnNlcGFyYXRvcikge1xuICAgICAgICAgICAgb3B0aW9ucy5zZXBhcmF0b3IgPSAgb3B0aW9ucy5uZXR3b3JrVmVyc2lvbiA/IFwiLlwiIDogXCI6XCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWFjX3Bvb2w9XCJBQkNERUYxMjM0NTY3ODkwXCIsXG4gICAgICAgICAgICBtYWMgPSBcIlwiO1xuICAgICAgICBpZighb3B0aW9ucy5uZXR3b3JrVmVyc2lvbikge1xuICAgICAgICAgICAgbWFjID0gdGhpcy5uKHRoaXMuc3RyaW5nLCA2LCB7IHBvb2w6IG1hY19wb29sLCBsZW5ndGg6MiB9KS5qb2luKG9wdGlvbnMuc2VwYXJhdG9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hYyA9IHRoaXMubih0aGlzLnN0cmluZywgMywgeyBwb29sOiBtYWNfcG9vbCwgbGVuZ3RoOjQgfSkuam9pbihvcHRpb25zLnNlcGFyYXRvcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWFjO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5vcm1hbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWVhbiA6IDAsIGRldiA6IDEsIHBvb2wgOiBbXX0pO1xuXG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMucG9vbC5jb25zdHJ1Y3RvciAhPT0gQXJyYXksXG4gICAgICAgICAgICBcIkNoYW5jZTogVGhlIHBvb2wgb3B0aW9uIG11c3QgYmUgYSB2YWxpZCBhcnJheS5cIlxuICAgICAgICApO1xuXG4gICAgICAgIC8vIElmIGEgcG9vbCBoYXMgYmVlbiBwYXNzZWQsIHRoZW4gd2UgYXJlIHJldHVybmluZyBhbiBpdGVtIGZyb20gdGhhdCBwb29sLFxuICAgICAgICAvLyB1c2luZyB0aGUgbm9ybWFsIGRpc3RyaWJ1dGlvbiBzZXR0aW5ncyB0aGF0IHdlcmUgcGFzc2VkIGluXG4gICAgICAgIGlmIChvcHRpb25zLnBvb2wubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubm9ybWFsX3Bvb2wob3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgTWFyc2FnbGlhIFBvbGFyIG1ldGhvZFxuICAgICAgICB2YXIgcywgdSwgdiwgbm9ybSxcbiAgICAgICAgICAgIG1lYW4gPSBvcHRpb25zLm1lYW4sXG4gICAgICAgICAgICBkZXYgPSBvcHRpb25zLmRldjtcblxuICAgICAgICBkbyB7XG4gICAgICAgICAgICAvLyBVIGFuZCBWIGFyZSBmcm9tIHRoZSB1bmlmb3JtIGRpc3RyaWJ1dGlvbiBvbiAoLTEsIDEpXG4gICAgICAgICAgICB1ID0gdGhpcy5yYW5kb20oKSAqIDIgLSAxO1xuICAgICAgICAgICAgdiA9IHRoaXMucmFuZG9tKCkgKiAyIC0gMTtcblxuICAgICAgICAgICAgcyA9IHUgKiB1ICsgdiAqIHY7XG4gICAgICAgIH0gd2hpbGUgKHMgPj0gMSk7XG5cbiAgICAgICAgLy8gQ29tcHV0ZSB0aGUgc3RhbmRhcmQgbm9ybWFsIHZhcmlhdGVcbiAgICAgICAgbm9ybSA9IHUgKiBNYXRoLnNxcnQoLTIgKiBNYXRoLmxvZyhzKSAvIHMpO1xuXG4gICAgICAgIC8vIFNoYXBlIGFuZCBzY2FsZVxuICAgICAgICByZXR1cm4gZGV2ICogbm9ybSArIG1lYW47XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubm9ybWFsX3Bvb2wgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBwZXJmb3JtYW5jZUNvdW50ZXIgPSAwO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgICB2YXIgaWR4ID0gTWF0aC5yb3VuZCh0aGlzLm5vcm1hbCh7IG1lYW46IG9wdGlvbnMubWVhbiwgZGV2OiBvcHRpb25zLmRldiB9KSk7XG4gICAgICAgICAgICBpZiAoaWR4IDwgb3B0aW9ucy5wb29sLmxlbmd0aCAmJiBpZHggPj0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zLnBvb2xbaWR4XTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVyZm9ybWFuY2VDb3VudGVyKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gd2hpbGUocGVyZm9ybWFuY2VDb3VudGVyIDwgMTAwKTtcblxuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogWW91ciBwb29sIGlzIHRvbyBzbWFsbCBmb3IgdGhlIGdpdmVuIG1lYW4gYW5kIHN0YW5kYXJkIGRldmlhdGlvbi4gUGxlYXNlIGFkanVzdC5cIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucmFkaW8gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyBJbml0aWFsIExldHRlciAoVHlwaWNhbGx5IERlc2lnbmF0ZWQgYnkgU2lkZSBvZiBNaXNzaXNzaXBwaSBSaXZlcilcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtzaWRlIDogXCI/XCJ9KTtcbiAgICAgICAgdmFyIGZsID0gXCJcIjtcbiAgICAgICAgc3dpdGNoIChvcHRpb25zLnNpZGUudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICBjYXNlIFwiZWFzdFwiOlxuICAgICAgICBjYXNlIFwiZVwiOlxuICAgICAgICAgICAgZmwgPSBcIldcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwid2VzdFwiOlxuICAgICAgICBjYXNlIFwid1wiOlxuICAgICAgICAgICAgZmwgPSBcIktcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgZmwgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogXCJLV1wifSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmbCArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KSArXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pICtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSk7XG4gICAgfTtcblxuICAgIC8vIFNldCB0aGUgZGF0YSBhcyBrZXkgYW5kIGRhdGEgb3IgdGhlIGRhdGEgbWFwXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWVzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgZGF0YVtuYW1lXSA9IHZhbHVlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRhdGEgPSBjb3B5T2JqZWN0KG5hbWUsIGRhdGEpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudHYgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5yYWRpbyhvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLy8gSUQgbnVtYmVyIGZvciBCcmF6aWwgY29tcGFuaWVzXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jbnBqID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbiA9IHRoaXMubih0aGlzLm5hdHVyYWwsIDgsIHsgbWF4OiA5IH0pO1xuICAgICAgICB2YXIgZDEgPSAyK25bN10qNituWzZdKjcrbls1XSo4K25bNF0qOStuWzNdKjIrblsyXSozK25bMV0qNCtuWzBdKjU7XG4gICAgICAgIGQxID0gMTEgLSAoZDEgJSAxMSk7XG4gICAgICAgIGlmIChkMT49MTApe1xuICAgICAgICAgICAgZDEgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkMiA9IGQxKjIrMytuWzddKjcrbls2XSo4K25bNV0qOStuWzRdKjIrblszXSozK25bMl0qNCtuWzFdKjUrblswXSo2O1xuICAgICAgICBkMiA9IDExIC0gKGQyICUgMTEpO1xuICAgICAgICBpZiAoZDI+PTEwKXtcbiAgICAgICAgICAgIGQyID0gMDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJycrblswXStuWzFdKycuJytuWzJdK25bM10rbls0XSsnLicrbls1XStuWzZdK25bN10rJy8wMDAxLScrZDErZDI7XG4gICAgfTtcblxuICAgIC8vIC0tIEVuZCBNaXNjZWxsYW5lb3VzIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1lcnNlbm5lX3R3aXN0ZXIgPSBmdW5jdGlvbiAoc2VlZCkge1xuICAgICAgICByZXR1cm4gbmV3IE1lcnNlbm5lVHdpc3RlcihzZWVkKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ibHVlaW1wX21kNSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBCbHVlSW1wTUQ1KCk7XG4gICAgfTtcblxuICAgIC8vIE1lcnNlbm5lIFR3aXN0ZXIgZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9iYW5rc2Vhbi8zMDA0OTRcbiAgICB2YXIgTWVyc2VubmVUd2lzdGVyID0gZnVuY3Rpb24gKHNlZWQpIHtcbiAgICAgICAgaWYgKHNlZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8ga2VwdCByYW5kb20gbnVtYmVyIHNhbWUgc2l6ZSBhcyB0aW1lIHVzZWQgcHJldmlvdXNseSB0byBlbnN1cmUgbm8gdW5leHBlY3RlZCByZXN1bHRzIGRvd25zdHJlYW1cbiAgICAgICAgICAgIHNlZWQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqTWF0aC5wb3coMTAsMTMpKTtcbiAgICAgICAgfVxuICAgICAgICAvKiBQZXJpb2QgcGFyYW1ldGVycyAqL1xuICAgICAgICB0aGlzLk4gPSA2MjQ7XG4gICAgICAgIHRoaXMuTSA9IDM5NztcbiAgICAgICAgdGhpcy5NQVRSSVhfQSA9IDB4OTkwOGIwZGY7ICAgLyogY29uc3RhbnQgdmVjdG9yIGEgKi9cbiAgICAgICAgdGhpcy5VUFBFUl9NQVNLID0gMHg4MDAwMDAwMDsgLyogbW9zdCBzaWduaWZpY2FudCB3LXIgYml0cyAqL1xuICAgICAgICB0aGlzLkxPV0VSX01BU0sgPSAweDdmZmZmZmZmOyAvKiBsZWFzdCBzaWduaWZpY2FudCByIGJpdHMgKi9cblxuICAgICAgICB0aGlzLm10ID0gbmV3IEFycmF5KHRoaXMuTik7IC8qIHRoZSBhcnJheSBmb3IgdGhlIHN0YXRlIHZlY3RvciAqL1xuICAgICAgICB0aGlzLm10aSA9IHRoaXMuTiArIDE7IC8qIG10aT09TiArIDEgbWVhbnMgbXRbTl0gaXMgbm90IGluaXRpYWxpemVkICovXG5cbiAgICAgICAgdGhpcy5pbml0X2dlbnJhbmQoc2VlZCk7XG4gICAgfTtcblxuICAgIC8qIGluaXRpYWxpemVzIG10W05dIHdpdGggYSBzZWVkICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5pbml0X2dlbnJhbmQgPSBmdW5jdGlvbiAocykge1xuICAgICAgICB0aGlzLm10WzBdID0gcyA+Pj4gMDtcbiAgICAgICAgZm9yICh0aGlzLm10aSA9IDE7IHRoaXMubXRpIDwgdGhpcy5OOyB0aGlzLm10aSsrKSB7XG4gICAgICAgICAgICBzID0gdGhpcy5tdFt0aGlzLm10aSAtIDFdIF4gKHRoaXMubXRbdGhpcy5tdGkgLSAxXSA+Pj4gMzApO1xuICAgICAgICAgICAgdGhpcy5tdFt0aGlzLm10aV0gPSAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTgxMjQzMzI1MykgPDwgMTYpICsgKHMgJiAweDAwMDBmZmZmKSAqIDE4MTI0MzMyNTMpICsgdGhpcy5tdGk7XG4gICAgICAgICAgICAvKiBTZWUgS251dGggVEFPQ1AgVm9sMi4gM3JkIEVkLiBQLjEwNiBmb3IgbXVsdGlwbGllci4gKi9cbiAgICAgICAgICAgIC8qIEluIHRoZSBwcmV2aW91cyB2ZXJzaW9ucywgTVNCcyBvZiB0aGUgc2VlZCBhZmZlY3QgICAqL1xuICAgICAgICAgICAgLyogb25seSBNU0JzIG9mIHRoZSBhcnJheSBtdFtdLiAgICAgICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAvKiAyMDAyLzAxLzA5IG1vZGlmaWVkIGJ5IE1ha290byBNYXRzdW1vdG8gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubXRbdGhpcy5tdGldID4+Pj0gMDtcbiAgICAgICAgICAgIC8qIGZvciA+MzIgYml0IG1hY2hpbmVzICovXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyogaW5pdGlhbGl6ZSBieSBhbiBhcnJheSB3aXRoIGFycmF5LWxlbmd0aCAqL1xuICAgIC8qIGluaXRfa2V5IGlzIHRoZSBhcnJheSBmb3IgaW5pdGlhbGl6aW5nIGtleXMgKi9cbiAgICAvKiBrZXlfbGVuZ3RoIGlzIGl0cyBsZW5ndGggKi9cbiAgICAvKiBzbGlnaHQgY2hhbmdlIGZvciBDKyssIDIwMDQvMi8yNiAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuaW5pdF9ieV9hcnJheSA9IGZ1bmN0aW9uIChpbml0X2tleSwga2V5X2xlbmd0aCkge1xuICAgICAgICB2YXIgaSA9IDEsIGogPSAwLCBrLCBzO1xuICAgICAgICB0aGlzLmluaXRfZ2VucmFuZCgxOTY1MDIxOCk7XG4gICAgICAgIGsgPSAodGhpcy5OID4ga2V5X2xlbmd0aCA/IHRoaXMuTiA6IGtleV9sZW5ndGgpO1xuICAgICAgICBmb3IgKDsgazsgay0tKSB7XG4gICAgICAgICAgICBzID0gdGhpcy5tdFtpIC0gMV0gXiAodGhpcy5tdFtpIC0gMV0gPj4+IDMwKTtcbiAgICAgICAgICAgIHRoaXMubXRbaV0gPSAodGhpcy5tdFtpXSBeICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxNjY0NTI1KSA8PCAxNikgKyAoKHMgJiAweDAwMDBmZmZmKSAqIDE2NjQ1MjUpKSkgKyBpbml0X2tleVtqXSArIGo7IC8qIG5vbiBsaW5lYXIgKi9cbiAgICAgICAgICAgIHRoaXMubXRbaV0gPj4+PSAwOyAvKiBmb3IgV09SRFNJWkUgPiAzMiBtYWNoaW5lcyAqL1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaisrO1xuICAgICAgICAgICAgaWYgKGkgPj0gdGhpcy5OKSB7IHRoaXMubXRbMF0gPSB0aGlzLm10W3RoaXMuTiAtIDFdOyBpID0gMTsgfVxuICAgICAgICAgICAgaWYgKGogPj0ga2V5X2xlbmd0aCkgeyBqID0gMDsgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAoayA9IHRoaXMuTiAtIDE7IGs7IGstLSkge1xuICAgICAgICAgICAgcyA9IHRoaXMubXRbaSAtIDFdIF4gKHRoaXMubXRbaSAtIDFdID4+PiAzMCk7XG4gICAgICAgICAgICB0aGlzLm10W2ldID0gKHRoaXMubXRbaV0gXiAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTU2NjA4Mzk0MSkgPDwgMTYpICsgKHMgJiAweDAwMDBmZmZmKSAqIDE1NjYwODM5NDEpKSAtIGk7IC8qIG5vbiBsaW5lYXIgKi9cbiAgICAgICAgICAgIHRoaXMubXRbaV0gPj4+PSAwOyAvKiBmb3IgV09SRFNJWkUgPiAzMiBtYWNoaW5lcyAqL1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgaWYgKGkgPj0gdGhpcy5OKSB7IHRoaXMubXRbMF0gPSB0aGlzLm10W3RoaXMuTiAtIDFdOyBpID0gMTsgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tdFswXSA9IDB4ODAwMDAwMDA7IC8qIE1TQiBpcyAxOyBhc3N1cmluZyBub24temVybyBpbml0aWFsIGFycmF5ICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMHhmZmZmZmZmZl0taW50ZXJ2YWwgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfaW50MzIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciB5O1xuICAgICAgICB2YXIgbWFnMDEgPSBuZXcgQXJyYXkoMHgwLCB0aGlzLk1BVFJJWF9BKTtcbiAgICAgICAgLyogbWFnMDFbeF0gPSB4ICogTUFUUklYX0EgIGZvciB4PTAsMSAqL1xuXG4gICAgICAgIGlmICh0aGlzLm10aSA+PSB0aGlzLk4pIHsgLyogZ2VuZXJhdGUgTiB3b3JkcyBhdCBvbmUgdGltZSAqL1xuICAgICAgICAgICAgdmFyIGtrO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5tdGkgPT09IHRoaXMuTiArIDEpIHsgICAvKiBpZiBpbml0X2dlbnJhbmQoKSBoYXMgbm90IGJlZW4gY2FsbGVkLCAqL1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdF9nZW5yYW5kKDU0ODkpOyAvKiBhIGRlZmF1bHQgaW5pdGlhbCBzZWVkIGlzIHVzZWQgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoa2sgPSAwOyBrayA8IHRoaXMuTiAtIHRoaXMuTTsga2srKykge1xuICAgICAgICAgICAgICAgIHkgPSAodGhpcy5tdFtra10mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFtrayArIDFdJnRoaXMuTE9XRVJfTUFTSyk7XG4gICAgICAgICAgICAgICAgdGhpcy5tdFtra10gPSB0aGlzLm10W2trICsgdGhpcy5NXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yICg7a2sgPCB0aGlzLk4gLSAxOyBraysrKSB7XG4gICAgICAgICAgICAgICAgeSA9ICh0aGlzLm10W2trXSZ0aGlzLlVQUEVSX01BU0spfCh0aGlzLm10W2trICsgMV0mdGhpcy5MT1dFUl9NQVNLKTtcbiAgICAgICAgICAgICAgICB0aGlzLm10W2trXSA9IHRoaXMubXRba2sgKyAodGhpcy5NIC0gdGhpcy5OKV0gXiAoeSA+Pj4gMSkgXiBtYWcwMVt5ICYgMHgxXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHkgPSAodGhpcy5tdFt0aGlzLk4gLSAxXSZ0aGlzLlVQUEVSX01BU0spfCh0aGlzLm10WzBdJnRoaXMuTE9XRVJfTUFTSyk7XG4gICAgICAgICAgICB0aGlzLm10W3RoaXMuTiAtIDFdID0gdGhpcy5tdFt0aGlzLk0gLSAxXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xuXG4gICAgICAgICAgICB0aGlzLm10aSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICB5ID0gdGhpcy5tdFt0aGlzLm10aSsrXTtcblxuICAgICAgICAvKiBUZW1wZXJpbmcgKi9cbiAgICAgICAgeSBePSAoeSA+Pj4gMTEpO1xuICAgICAgICB5IF49ICh5IDw8IDcpICYgMHg5ZDJjNTY4MDtcbiAgICAgICAgeSBePSAoeSA8PCAxNSkgJiAweGVmYzYwMDAwO1xuICAgICAgICB5IF49ICh5ID4+PiAxOCk7XG5cbiAgICAgICAgcmV0dXJuIHkgPj4+IDA7XG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMHg3ZmZmZmZmZl0taW50ZXJ2YWwgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfaW50MzEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5nZW5yYW5kX2ludDMyKCkgPj4+IDEpO1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDFdLXJlYWwtaW50ZXJ2YWwgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfcmVhbDEgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdlbnJhbmRfaW50MzIoKSAqICgxLjAgLyA0Mjk0OTY3Mjk1LjApO1xuICAgICAgICAvKiBkaXZpZGVkIGJ5IDJeMzItMSAqL1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDEpLXJlYWwtaW50ZXJ2YWwgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLnJhbmRvbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2VucmFuZF9pbnQzMigpICogKDEuMCAvIDQyOTQ5NjcyOTYuMCk7XG4gICAgICAgIC8qIGRpdmlkZWQgYnkgMl4zMiAqL1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uICgwLDEpLXJlYWwtaW50ZXJ2YWwgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmdlbnJhbmRfcmVhbDMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5nZW5yYW5kX2ludDMyKCkgKyAwLjUpICogKDEuMCAvIDQyOTQ5NjcyOTYuMCk7XG4gICAgICAgIC8qIGRpdmlkZWQgYnkgMl4zMiAqL1xuICAgIH07XG5cbiAgICAvKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDEpIHdpdGggNTMtYml0IHJlc29sdXRpb24qL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZXM1MyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGEgPSB0aGlzLmdlbnJhbmRfaW50MzIoKT4+PjUsIGIgPSB0aGlzLmdlbnJhbmRfaW50MzIoKT4+PjY7XG4gICAgICAgIHJldHVybiAoYSAqIDY3MTA4ODY0LjAgKyBiKSAqICgxLjAgLyA5MDA3MTk5MjU0NzQwOTkyLjApO1xuICAgIH07XG5cbiAgICAvLyBCbHVlSW1wIE1ENSBoYXNoaW5nIGFsZ29yaXRobSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTUQ1XG4gICAgdmFyIEJsdWVJbXBNRDUgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLlZFUlNJT04gPSAnMS4wLjEnO1xuXG4gICAgLypcbiAgICAqIEFkZCBpbnRlZ2Vycywgd3JhcHBpbmcgYXQgMl4zMi4gVGhpcyB1c2VzIDE2LWJpdCBvcGVyYXRpb25zIGludGVybmFsbHlcbiAgICAqIHRvIHdvcmsgYXJvdW5kIGJ1Z3MgaW4gc29tZSBKUyBpbnRlcnByZXRlcnMuXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5zYWZlX2FkZCA9IGZ1bmN0aW9uIHNhZmVfYWRkKHgsIHkpIHtcbiAgICAgICAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKSxcbiAgICAgICAgICAgIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xuICAgICAgICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIEJpdHdpc2Ugcm90YXRlIGEgMzItYml0IG51bWJlciB0byB0aGUgbGVmdC5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmJpdF9yb2xsID0gZnVuY3Rpb24gKG51bSwgY250KSB7XG4gICAgICAgIHJldHVybiAobnVtIDw8IGNudCkgfCAobnVtID4+PiAoMzIgLSBjbnQpKTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIFRoZXNlIGZ1bmN0aW9ucyBpbXBsZW1lbnQgdGhlIGZpdmUgYmFzaWMgb3BlcmF0aW9ucyB0aGUgYWxnb3JpdGhtIHVzZXMuXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfY21uID0gZnVuY3Rpb24gKHEsIGEsIGIsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2FmZV9hZGQodGhpcy5iaXRfcm9sbCh0aGlzLnNhZmVfYWRkKHRoaXMuc2FmZV9hZGQoYSwgcSksIHRoaXMuc2FmZV9hZGQoeCwgdCkpLCBzKSwgYik7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfZmYgPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKChiICYgYykgfCAoKH5iKSAmIGQpLCBhLCBiLCB4LCBzLCB0KTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9nZyA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1kNV9jbW4oKGIgJiBkKSB8IChjICYgKH5kKSksIGEsIGIsIHgsIHMsIHQpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2hoID0gZnVuY3Rpb24gKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWQ1X2NtbihiIF4gYyBeIGQsIGEsIGIsIHgsIHMsIHQpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2lpID0gZnVuY3Rpb24gKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWQ1X2NtbihjIF4gKGIgfCAofmQpKSwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDYWxjdWxhdGUgdGhlIE1ENSBvZiBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoLlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuYmlubF9tZDUgPSBmdW5jdGlvbiAoeCwgbGVuKSB7XG4gICAgICAgIC8qIGFwcGVuZCBwYWRkaW5nICovXG4gICAgICAgIHhbbGVuID4+IDVdIHw9IDB4ODAgPDwgKGxlbiAlIDMyKTtcbiAgICAgICAgeFsoKChsZW4gKyA2NCkgPj4+IDkpIDw8IDQpICsgMTRdID0gbGVuO1xuXG4gICAgICAgIHZhciBpLCBvbGRhLCBvbGRiLCBvbGRjLCBvbGRkLFxuICAgICAgICAgICAgYSA9ICAxNzMyNTg0MTkzLFxuICAgICAgICAgICAgYiA9IC0yNzE3MzM4NzksXG4gICAgICAgICAgICBjID0gLTE3MzI1ODQxOTQsXG4gICAgICAgICAgICBkID0gIDI3MTczMzg3ODtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgeC5sZW5ndGg7IGkgKz0gMTYpIHtcbiAgICAgICAgICAgIG9sZGEgPSBhO1xuICAgICAgICAgICAgb2xkYiA9IGI7XG4gICAgICAgICAgICBvbGRjID0gYztcbiAgICAgICAgICAgIG9sZGQgPSBkO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpXSwgICAgICAgNywgLTY4MDg3NjkzNik7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZmYoZCwgYSwgYiwgYywgeFtpICsgIDFdLCAxMiwgLTM4OTU2NDU4Nik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgIDJdLCAxNywgIDYwNjEwNTgxOSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZmYoYiwgYywgZCwgYSwgeFtpICsgIDNdLCAyMiwgLTEwNDQ1MjUzMzApO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSArICA0XSwgIDcsIC0xNzY0MTg4OTcpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSArICA1XSwgMTIsICAxMjAwMDgwNDI2KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9mZihjLCBkLCBhLCBiLCB4W2kgKyAgNl0sIDE3LCAtMTQ3MzIzMTM0MSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZmYoYiwgYywgZCwgYSwgeFtpICsgIDddLCAyMiwgLTQ1NzA1OTgzKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9mZihhLCBiLCBjLCBkLCB4W2kgKyAgOF0sICA3LCAgMTc3MDAzNTQxNik7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZmYoZCwgYSwgYiwgYywgeFtpICsgIDldLCAxMiwgLTE5NTg0MTQ0MTcpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSArIDEwXSwgMTcsIC00MjA2Myk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZmYoYiwgYywgZCwgYSwgeFtpICsgMTFdLCAyMiwgLTE5OTA0MDQxNjIpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSArIDEyXSwgIDcsICAxODA0NjAzNjgyKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAxM10sIDEyLCAtNDAzNDExMDEpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSArIDE0XSwgMTcsIC0xNTAyMDAyMjkwKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAxNV0sIDIyLCAgMTIzNjUzNTMyOSk7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9nZyhhLCBiLCBjLCBkLCB4W2kgKyAgMV0sICA1LCAtMTY1Nzk2NTEwKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9nZyhkLCBhLCBiLCBjLCB4W2kgKyAgNl0sICA5LCAtMTA2OTUwMTYzMik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZ2coYywgZCwgYSwgYiwgeFtpICsgMTFdLCAxNCwgIDY0MzcxNzcxMyk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZ2coYiwgYywgZCwgYSwgeFtpXSwgICAgICAyMCwgLTM3Mzg5NzMwMik7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZ2coYSwgYiwgYywgZCwgeFtpICsgIDVdLCAgNSwgLTcwMTU1ODY5MSk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZ2coZCwgYSwgYiwgYywgeFtpICsgMTBdLCAgOSwgIDM4MDE2MDgzKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAxNV0sIDE0LCAtNjYwNDc4MzM1KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2kgKyAgNF0sIDIwLCAtNDA1NTM3ODQ4KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9nZyhhLCBiLCBjLCBkLCB4W2kgKyAgOV0sICA1LCAgNTY4NDQ2NDM4KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9nZyhkLCBhLCBiLCBjLCB4W2kgKyAxNF0sICA5LCAtMTAxOTgwMzY5MCk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZ2coYywgZCwgYSwgYiwgeFtpICsgIDNdLCAxNCwgLTE4NzM2Mzk2MSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfZ2coYiwgYywgZCwgYSwgeFtpICsgIDhdLCAyMCwgIDExNjM1MzE1MDEpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArIDEzXSwgIDUsIC0xNDQ0NjgxNDY3KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9nZyhkLCBhLCBiLCBjLCB4W2kgKyAgMl0sICA5LCAtNTE0MDM3ODQpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSArICA3XSwgMTQsICAxNzM1MzI4NDczKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2kgKyAxMl0sIDIwLCAtMTkyNjYwNzczNCk7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAgNV0sICA0LCAtMzc4NTU4KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9oaChkLCBhLCBiLCBjLCB4W2kgKyAgOF0sIDExLCAtMjAyMjU3NDQ2Myk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaGgoYywgZCwgYSwgYiwgeFtpICsgMTFdLCAxNiwgIDE4MzkwMzA1NjIpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArIDE0XSwgMjMsIC0zNTMwOTU1Nik7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaGgoYSwgYiwgYywgZCwgeFtpICsgIDFdLCAgNCwgLTE1MzA5OTIwNjApO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSArICA0XSwgMTEsICAxMjcyODkzMzUzKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAgN10sIDE2LCAtMTU1NDk3NjMyKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9oaChiLCBjLCBkLCBhLCB4W2kgKyAxMF0sIDIzLCAtMTA5NDczMDY0MCk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaGgoYSwgYiwgYywgZCwgeFtpICsgMTNdLCAgNCwgIDY4MTI3OTE3NCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaGgoZCwgYSwgYiwgYywgeFtpXSwgICAgICAxMSwgLTM1ODUzNzIyMik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaGgoYywgZCwgYSwgYiwgeFtpICsgIDNdLCAxNiwgLTcyMjUyMTk3OSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaGgoYiwgYywgZCwgYSwgeFtpICsgIDZdLCAyMywgIDc2MDI5MTg5KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAgOV0sICA0LCAtNjQwMzY0NDg3KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9oaChkLCBhLCBiLCBjLCB4W2kgKyAxMl0sIDExLCAtNDIxODE1ODM1KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAxNV0sIDE2LCAgNTMwNzQyNTIwKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9oaChiLCBjLCBkLCBhLCB4W2kgKyAgMl0sIDIzLCAtOTk1MzM4NjUxKTtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaV0sICAgICAgIDYsIC0xOTg2MzA4NDQpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSArICA3XSwgMTAsICAxMTI2ODkxNDE1KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAxNF0sIDE1LCAtMTQxNjM1NDkwNSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaWkoYiwgYywgZCwgYSwgeFtpICsgIDVdLCAyMSwgLTU3NDM0MDU1KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9paShhLCBiLCBjLCBkLCB4W2kgKyAxMl0sICA2LCAgMTcwMDQ4NTU3MSk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgIDNdLCAxMCwgLTE4OTQ5ODY2MDYpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSArIDEwXSwgMTUsIC0xMDUxNTIzKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAgMV0sIDIxLCAtMjA1NDkyMjc5OSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaWkoYSwgYiwgYywgZCwgeFtpICsgIDhdLCAgNiwgIDE4NzMzMTMzNTkpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSArIDE1XSwgMTAsIC0zMDYxMTc0NCk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaWkoYywgZCwgYSwgYiwgeFtpICsgIDZdLCAxNSwgLTE1NjAxOTgzODApO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSArIDEzXSwgMjEsICAxMzA5MTUxNjQ5KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9paShhLCBiLCBjLCBkLCB4W2kgKyAgNF0sICA2LCAtMTQ1NTIzMDcwKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9paShkLCBhLCBiLCBjLCB4W2kgKyAxMV0sIDEwLCAtMTEyMDIxMDM3OSk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaWkoYywgZCwgYSwgYiwgeFtpICsgIDJdLCAxNSwgIDcxODc4NzI1OSk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaWkoYiwgYywgZCwgYSwgeFtpICsgIDldLCAyMSwgLTM0MzQ4NTU1MSk7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLnNhZmVfYWRkKGEsIG9sZGEpO1xuICAgICAgICAgICAgYiA9IHRoaXMuc2FmZV9hZGQoYiwgb2xkYik7XG4gICAgICAgICAgICBjID0gdGhpcy5zYWZlX2FkZChjLCBvbGRjKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLnNhZmVfYWRkKGQsIG9sZGQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbYSwgYiwgYywgZF07XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDb252ZXJ0IGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMgdG8gYSBzdHJpbmdcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmJpbmwycnN0ciA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICB2YXIgaSxcbiAgICAgICAgICAgIG91dHB1dCA9ICcnO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoICogMzI7IGkgKz0gOCkge1xuICAgICAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKGlucHV0W2kgPj4gNV0gPj4+IChpICUgMzIpKSAmIDB4RkYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDb252ZXJ0IGEgcmF3IHN0cmluZyB0byBhbiBhcnJheSBvZiBsaXR0bGUtZW5kaWFuIHdvcmRzXG4gICAgKiBDaGFyYWN0ZXJzID4yNTUgaGF2ZSB0aGVpciBoaWdoLWJ5dGUgc2lsZW50bHkgaWdub3JlZC5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHIyYmlubCA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICB2YXIgaSxcbiAgICAgICAgICAgIG91dHB1dCA9IFtdO1xuICAgICAgICBvdXRwdXRbKGlucHV0Lmxlbmd0aCA+PiAyKSAtIDFdID0gdW5kZWZpbmVkO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb3V0cHV0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBvdXRwdXRbaV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggKiA4OyBpICs9IDgpIHtcbiAgICAgICAgICAgIG91dHB1dFtpID4+IDVdIHw9IChpbnB1dC5jaGFyQ29kZUF0KGkgLyA4KSAmIDB4RkYpIDw8IChpICUgMzIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDYWxjdWxhdGUgdGhlIE1ENSBvZiBhIHJhdyBzdHJpbmdcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHJfbWQ1ID0gZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmlubDJyc3RyKHRoaXMuYmlubF9tZDUodGhpcy5yc3RyMmJpbmwocyksIHMubGVuZ3RoICogOCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ2FsY3VsYXRlIHRoZSBITUFDLU1ENSwgb2YgYSBrZXkgYW5kIHNvbWUgZGF0YSAocmF3IHN0cmluZ3MpXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yc3RyX2htYWNfbWQ1ID0gZnVuY3Rpb24gKGtleSwgZGF0YSkge1xuICAgICAgICB2YXIgaSxcbiAgICAgICAgICAgIGJrZXkgPSB0aGlzLnJzdHIyYmlubChrZXkpLFxuICAgICAgICAgICAgaXBhZCA9IFtdLFxuICAgICAgICAgICAgb3BhZCA9IFtdLFxuICAgICAgICAgICAgaGFzaDtcbiAgICAgICAgaXBhZFsxNV0gPSBvcGFkWzE1XSA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGJrZXkubGVuZ3RoID4gMTYpIHtcbiAgICAgICAgICAgIGJrZXkgPSB0aGlzLmJpbmxfbWQ1KGJrZXksIGtleS5sZW5ndGggKiA4KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMTY7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXBhZFtpXSA9IGJrZXlbaV0gXiAweDM2MzYzNjM2O1xuICAgICAgICAgICAgb3BhZFtpXSA9IGJrZXlbaV0gXiAweDVDNUM1QzVDO1xuICAgICAgICB9XG4gICAgICAgIGhhc2ggPSB0aGlzLmJpbmxfbWQ1KGlwYWQuY29uY2F0KHRoaXMucnN0cjJiaW5sKGRhdGEpKSwgNTEyICsgZGF0YS5sZW5ndGggKiA4KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmlubDJyc3RyKHRoaXMuYmlubF9tZDUob3BhZC5jb25jYXQoaGFzaCksIDUxMiArIDEyOCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYSBoZXggc3RyaW5nXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yc3RyMmhleCA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICB2YXIgaGV4X3RhYiA9ICcwMTIzNDU2Nzg5YWJjZGVmJyxcbiAgICAgICAgICAgIG91dHB1dCA9ICcnLFxuICAgICAgICAgICAgeCxcbiAgICAgICAgICAgIGk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgeCA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBvdXRwdXQgKz0gaGV4X3RhYi5jaGFyQXQoKHggPj4+IDQpICYgMHgwRikgK1xuICAgICAgICAgICAgICAgIGhleF90YWIuY2hhckF0KHggJiAweDBGKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH07XG5cbiAgICAvKlxuICAgICogRW5jb2RlIGEgc3RyaW5nIGFzIHV0Zi04XG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5zdHIycnN0cl91dGY4ID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQoaW5wdXQpKTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIFRha2Ugc3RyaW5nIGFyZ3VtZW50cyBhbmQgcmV0dXJuIGVpdGhlciByYXcgb3IgaGV4IGVuY29kZWQgc3RyaW5nc1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucmF3X21kNSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJzdHJfbWQ1KHRoaXMuc3RyMnJzdHJfdXRmOChzKSk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5oZXhfbWQ1ID0gZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cjJoZXgodGhpcy5yYXdfbWQ1KHMpKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJhd19obWFjX21kNSA9IGZ1bmN0aW9uIChrLCBkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJzdHJfaG1hY19tZDUodGhpcy5zdHIycnN0cl91dGY4KGspLCB0aGlzLnN0cjJyc3RyX3V0ZjgoZCkpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuaGV4X2htYWNfbWQ1ID0gZnVuY3Rpb24gKGssIGQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cjJoZXgodGhpcy5yYXdfaG1hY19tZDUoaywgZCkpO1xuICAgIH07XG5cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDUgPSBmdW5jdGlvbiAoc3RyaW5nLCBrZXksIHJhdykge1xuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgaWYgKCFyYXcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oZXhfbWQ1KHN0cmluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJhd19tZDUoc3RyaW5nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghcmF3KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oZXhfaG1hY19tZDUoa2V5LCBzdHJpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucmF3X2htYWNfbWQ1KGtleSwgc3RyaW5nKTtcbiAgICB9O1xuXG4gICAgLy8gQ29tbW9uSlMgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IENoYW5jZTtcbiAgICAgICAgfVxuICAgICAgICBleHBvcnRzLkNoYW5jZSA9IENoYW5jZTtcbiAgICB9XG5cbiAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZVxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFtdLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gQ2hhbmNlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBpZiB0aGVyZSBpcyBhIGltcG9ydHNTY3JpcHMgb2JqZWN0IGRlZmluZSBjaGFuY2UgZm9yIHdvcmtlclxuICAgIGlmICh0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgY2hhbmNlID0gbmV3IENoYW5jZSgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIGEgd2luZG93IG9iamVjdCwgdGhhdCBhdCBsZWFzdCBoYXMgYSBkb2N1bWVudCBwcm9wZXJ0eSxcbiAgICAvLyBpbnN0YW50aWF0ZSBhbmQgZGVmaW5lIGNoYW5jZSBvbiB0aGUgd2luZG93XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHdpbmRvdy5kb2N1bWVudCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICB3aW5kb3cuQ2hhbmNlID0gQ2hhbmNlO1xuICAgICAgICB3aW5kb3cuY2hhbmNlID0gbmV3IENoYW5jZSgpO1xuICAgIH1cbn0pKCk7XG4iXX0=
