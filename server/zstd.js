const Module = {}
const ABORT = false;
const EXITSTATUS = 0;

const UTF8Decoder = new TextDecoder()
const UTF8ToString = (byteOffset, length) => byteOffset
  ? UTF8Decoder.decode(new Uint8Array(HEAPU8, byteOffset, length))
  : ''

const UTF8Encoder = new TextEncoder()
const stringToUTF8Array = (str, outIdx, maxBytesToWrite) =>
  HEAPU8.set(UTF8Encoder
    .encode(str)
    .subarray(0, maxBytesToWrite), outIdx)

const lengthBytesUTF8 = str => UTF8Encoder.encode(str).length
const WASM_PAGE_SIZE = 65536
const DYNAMIC_BASE = 5255936
const DYNAMICTOP_PTR = 13024
const TOTAL_STACK = 5242880
let INITIAL_TOTAL_MEMORY = 16777216
const wasmMemory = new WebAssembly.Memory({
  initial: INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE,
  maximum: INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE,
})
const { buffer } = wasmMemory
const HEAP8 = new Int8Array(buffer)
const HEAP16 = new Int16Array(buffer)
const HEAP32 = new Int32Array(buffer)
const HEAPU8 = new Uint8Array(buffer)
const HEAPU16 = new Uint16Array(buffer)
const HEAPU32 = new Uint32Array(buffer)
const HEAPF32 = new Float32Array(buffer)
const HEAPF64 = new Float64Array(buffer)

INITIAL_TOTAL_MEMORY = buffer.byteLength
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE
let runtimeInitialized = false
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies)
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher)
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback()
    }
  }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0;
}
var wasmBinaryFile = "./zstd.wasm";
function getBinary() {
  try {
    if (Module["wasmBinary"]) {
      return new Uint8Array(Module["wasmBinary"])
    }
    if (Module["readBinary"]) {
      return Module["readBinary"](wasmBinaryFile)
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  } catch (err) {
    abort(err)
  }
}
function getBinaryPromise() {
  if (
    !Module["wasmBinary"] &&
    (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
    typeof fetch === "function"
  ) {
    return fetch(wasmBinaryFile, { credentials: "same-origin" })
      .then(function(response) {
        if (!response["ok"]) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response["arrayBuffer"]()
      })
      .catch(function() {
        return getBinary()
      })
  }
  return new Promise(function(resolve, reject) {
    resolve(getBinary())
  })
}
function createWasm(env) {
  console.log(env)
  var info = {
    env,
    global: { NaN, Infinity },
    "global.Math": Math,
    asm2wasm: {
      "f64-rem": (x, y) => x % y,
      debugger: () => { debugger }
    }
  };
  function receiveInstance(instance, module) {
    Module.asm = instance.exports;
    console.log(Module.asm)
    removeRunDependency("wasm-instantiate")
  }
  addRunDependency("wasm-instantiate")
  function receiveInstantiatedSource(output) {
    console.log(output)
    receiveInstance(output["instance"])
  }
  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise()
      .then(function(binary) {
        return WebAssembly.instantiate(binary, info)
      })
      .then(receiver, function(reason) {
        err("failed to asynchronously prepare wasm: " + reason)
        abort(reason)
      })
  }
  function instantiateAsync() {
    fetch(wasmBinaryFile, { credentials: "same-origin" })
      .then(response => WebAssembly.instantiateStreaming(response, info))
      .then(receiveInstantiatedSource, function(reason) {
          err("wasm streaming compile failed: " + reason)
          err("falling back to ArrayBuffer instantiation")
          instantiateArrayBuffer(receiveInstantiatedSource)
        }
      )
  }
  if (Module["instantiateWasm"]) {
    try {
      var exports = Module["instantiateWasm"](info, receiveInstance)
      return exports;
    } catch (e) {
      err("Module.instantiateWasm callback failed with error: " + e)
      return false;
    }
  }
  instantiateAsync()
  return {};
}
Module.asm = function(global, env, providedBuffer) {
  env.memory = wasmMemory;
  env.table = new WebAssembly.Table({
    initial: 90,
    maximum: 90,
    element: "anyfunc"
  })
  env["__memory_base"] = 1024;
  env["__table_base"] = 0;
  var exports = createWasm(env)
  return exports;
};

function getShiftFromSize(size) {
  switch (size) {
    case 1:
      return 0;
    case 2:
      return 1;
    case 4:
      return 2;
    case 8:
      return 3;
    default:
      throw new TypeError("Unknown type size: " + size)
  }
}

const _chars = [...Array(256).keys()].map(n => String.fromCharCode(n))
function readLatin1String(ptr) {
  var ret = "";
  var c = ptr;
  while (HEAPU8[c]) {
    ret += String.fromCharCode([HEAPU8[c++]])
  }
  return ret// String.fromCharCode.apply(null, HEAPU8[c])
}
var awaitingDependencies = {};
var registeredTypes = {};
var typeDependencies = {};
var char_0 = 48;
var char_9 = 57;
function makeLegalFunctionName(name) {
  if (undefined === name) {
    return "_unknown";
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, "$")
  var f = name.charCodeAt(0)
  if (f >= char_0 && f <= char_9) {
    return "_" + name;
  } else {
    return name;
  }
}
function createNamedFunction(name, body) {
  name = makeLegalFunctionName(name)
  return new Function(
    "body",
    "return function " +
      name +
      "() {\n" +
      '    "use strict";' +
      "    return body.apply(this, arguments)\n" +
      "};\n"
  )(body)
}
function extendError(baseErrorType, errorName) {
  var errorClass = createNamedFunction(errorName, function(message) {
    this.name = errorName;
    this.message = message;
    var stack = new Error(message).stack;
    if (stack !== undefined) {
      this.stack =
        this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
    }
  })
  errorClass.prototype = Object.create(baseErrorType.prototype)
  errorClass.prototype.constructor = errorClass;
  errorClass.prototype.toString = function() {
    if (this.message === undefined) {
      return this.name;
    } else {
      return this.name + ": " + this.message;
    }
  };
  return errorClass;
}
var BindingError = undefined;
function throwBindingError(message) {
  throw new BindingError(message)
}
var InternalError = undefined;
function throwInternalError(message) {
  throw new InternalError(message)
}
function whenDependentTypesAreResolved(
  myTypes,
  dependentTypes,
  getTypeConverters
) {
  myTypes.forEach(function(type) {
    typeDependencies[type] = dependentTypes;
  })
  function onComplete(typeConverters) {
    var myTypeConverters = getTypeConverters(typeConverters)
    if (myTypeConverters.length !== myTypes.length) {
      throwInternalError("Mismatched type converter count")
    }
    for (var i = 0; i < myTypes.length; ++i) {
      registerType(myTypes[i], myTypeConverters[i])
    }
  }
  var typeConverters = new Array(dependentTypes.length)
  var unregisteredTypes = [];
  var registered = 0;
  dependentTypes.forEach(function(dt, i) {
    if (registeredTypes.hasOwnProperty(dt)) {
      typeConverters[i] = registeredTypes[dt];
    } else {
      unregisteredTypes.push(dt)
      if (!awaitingDependencies.hasOwnProperty(dt)) {
        awaitingDependencies[dt] = [];
      }
      awaitingDependencies[dt].push(function() {
        typeConverters[i] = registeredTypes[dt];
        ++registered;
        if (registered === unregisteredTypes.length) {
          onComplete(typeConverters)
        }
      })
    }
  })
  if (0 === unregisteredTypes.length) {
    onComplete(typeConverters)
  }
}

function registerType(rawType, registeredInstance, options) {
  console.log(registeredInstance)
  options = options || {};
  if (!("argPackAdvance" in registeredInstance)) {
    throw new TypeError(
      "registerType registeredInstance requires argPackAdvance"
    )
  }
  var name = registeredInstance.name;
  if (!rawType) {
    throwBindingError(
      'type "' + name + '" must have a positive integer typeid pointer'
    )
  }
  if (registeredTypes.hasOwnProperty(rawType)) {
    if (options.ignoreDuplicateRegistrations) return
    throwBindingError("Cannot register type '" + name + "' twice")
  }
  registeredTypes[rawType] = registeredInstance;
  delete typeDependencies[rawType];
  if (awaitingDependencies.hasOwnProperty(rawType)) {
    var callbacks = awaitingDependencies[rawType];
    delete awaitingDependencies[rawType];
    callbacks.forEach(function(cb) {
      cb()
    })
  }
}
function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function(wt) {
      return !!wt;
    },
    toWireType: function(destructors, o) {
      return o ? trueValue : falseValue;
    },
    argPackAdvance: 8,
    readValueFromPointer: function(pointer) {
      var heap;
      if (size === 1) {
        heap = HEAP8;
      } else if (size === 2) {
        heap = HEAP16;
      } else if (size === 4) {
        heap = HEAP32;
      } else {
        throw new TypeError("Unknown boolean type size: " + name)
      }
      return this["fromWireType"](heap[pointer >> shift])
    },
    destructorFunction: null
  })
}
var emval_free_list = [];
var emval_handle_array = [
  {},
  { value: undefined },
  { value: null },
  { value: true },
  { value: false }
];
function __emval_decref(handle) {
  if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
    emval_handle_array[handle] = undefined;
    emval_free_list.push(handle)
  }
}
function count_emval_handles() {
  var count = 0;
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      ++count;
    }
  }
  return count;
}
function get_first_emval() {
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      return emval_handle_array[i];
    }
  }
  return null;
}
function init_emval() {
  Module["count_emval_handles"] = count_emval_handles;
  Module["get_first_emval"] = get_first_emval;
}
function __emval_register(value) {
  switch (value) {
    case undefined: {
      return 1;
    }
    case null: {
      return 2;
    }
    case true: {
      return 3;
    }
    case false: {
      return 4;
    }
    default: {
      var handle = emval_free_list.length
        ? emval_free_list.pop()
        : emval_handle_array.length;
      emval_handle_array[handle] = { refcount: 1, value: value };
      return handle;
    }
  }
}
function simpleReadValueFromPointer(pointer) {
  return this["fromWireType"](HEAPU32[pointer >> 2])
}
function __embind_register_emval(rawType, name) {
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function(handle) {
      var rv = emval_handle_array[handle].value;
      __emval_decref(handle)
      return rv;
    },
    toWireType: (_, value) => __emval_register(value),
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: null
  })
}
function floatReadValueFromPointer(name, shift) {
  switch (shift) {
    case 2:
      return function(pointer) {
        return this["fromWireType"](HEAPF32[pointer >> 2])
      };
    case 3:
      return function(pointer) {
        return this["fromWireType"](HEAPF64[pointer >> 3])
      };
    default:
      throw new TypeError("Unknown float type: " + name)
  }
}
function __embind_register_float(rawType, name, size) {
  var shift = getShiftFromSize(size)
  name = readLatin1String(name)
  registerType(rawType, {
    name: name,
    fromWireType: function(value) {
      return value;
    },
    toWireType: function(destructors, value) {
      if (typeof value !== "number" && typeof value !== "boolean") {
        throw new TypeError(
          'Cannot convert "' + String(value) + '" to ' + this.name
        )
      }
      return value;
    },
    argPackAdvance: 8,
    readValueFromPointer: floatReadValueFromPointer(name, shift),
    destructorFunction: null
  })
}
function new_(constructor, argumentList) {
  if (!(constructor instanceof Function)) {
    throw new TypeError(
      "new_ called with constructor type " +
        typeof constructor +
        " which is not a function"
    )
  }
  var dummy = createNamedFunction(
    constructor.name || "unknownFunctionName",
    function() {}
  )
  dummy.prototype = constructor.prototype;
  var obj = new dummy()
  var r = constructor.apply(obj, argumentList)
  return r instanceof Object ? r : obj;
}
function runDestructors(destructors) {
  while (destructors.length) {
    var ptr = destructors.pop()
    var del = destructors.pop()
    del(ptr)
  }
}
function craftInvokerFunction(
  humanName,
  argTypes,
  classType,
  cppInvokerFunc,
  cppTargetFunc
) {
  console.log({ humanName,
argTypes,
classType,
cppInvokerFunc,
cppTargetFunc })
  var argCount = argTypes.length;
  if (argCount < 2) {
    throwBindingError(
      "argTypes array size mismatch! Must at least get return value and 'this' types!"
    )
  }
  var isClassMethodFunc = argTypes[1] !== null && classType !== null;
  var needsDestructorStack = false;
  for (var i = 1; i < argTypes.length; ++i) {
    if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
      needsDestructorStack = true;
      break;
    }
  }
  var returns = argTypes[0].name !== "void";
  var argsList = "";
  var argsListWired = "";
  for (var i = 0; i < argCount - 2; ++i) {
    argsList += (i !== 0 ? ", " : "") + "arg" + i;
    argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
  }
  var invokerFnBody =
    "return function " +
    makeLegalFunctionName(humanName) +
    "(" +
    argsList +
    ") {\n" +
    "if (arguments.length !== " +
    (argCount - 2) +
    ") {\n" +
    "throwBindingError('function " +
    humanName +
    " called with ' + arguments.length + ' arguments, expected " +
    (argCount - 2) +
    " args!')\n" +
    "}\n";
  if (needsDestructorStack) {
    invokerFnBody += "var destructors = [];\n";
  }
  var dtorStack = needsDestructorStack ? "destructors" : "null";
  var args1 = [
    "throwBindingError",
    "invoker",
    "fn",
    "runDestructors",
    "retType",
    "classParam"
  ];
  var args2 = [
    throwBindingError,
    cppInvokerFunc,
    cppTargetFunc,
    runDestructors,
    argTypes[0],
    argTypes[1]
  ];
  if (isClassMethodFunc) {
    invokerFnBody +=
      "var thisWired = classParam.toWireType(" + dtorStack + ", this)\n";
  }
  for (var i = 0; i < argCount - 2; ++i) {
    invokerFnBody +=
      "var arg" +
      i +
      "Wired = argType" +
      i +
      ".toWireType(" +
      dtorStack +
      ", arg" +
      i +
      ") // " +
      argTypes[i + 2].name +
      "\n";
    args1.push("argType" + i)
    args2.push(argTypes[i + 2])
  }
  if (isClassMethodFunc) {
    argsListWired =
      "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
  }
  invokerFnBody +=
    (returns ? "var rv = " : "") +
    "invoker(fn" +
    (argsListWired.length > 0 ? ", " : "") +
    argsListWired +
    ")\n";
  if (needsDestructorStack) {
    invokerFnBody += "runDestructors(destructors)\n";
  } else {
    for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
      var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
      if (argTypes[i].destructorFunction !== null) {
        invokerFnBody +=
          paramName + "_dtor(" + paramName + ") // " + argTypes[i].name + "\n";
        args1.push(paramName + "_dtor")
        args2.push(argTypes[i].destructorFunction)
      }
    }
  }
  if (returns) {
    invokerFnBody += "var ret = retType.fromWireType(rv)\n" + "return ret;\n";
  } else {
  }
  invokerFnBody += "}\n";
  args1.push(invokerFnBody)
  var invokerFunction = new_(Function, args1).apply(null, args2)
  return invokerFunction;
}
function ensureOverloadTable(proto, methodName, humanName) {
  if (undefined === proto[methodName].overloadTable) {
    var prevFunc = proto[methodName];
    proto[methodName] = function() {
      if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
        throwBindingError(
          "Function '" +
            humanName +
            "' called with an invalid number of arguments (" +
            arguments.length +
            ") - expects one of (" +
            proto[methodName].overloadTable +
            ")!"
        )
      }
      return proto[methodName].overloadTable[arguments.length].apply(
        this,
        arguments
      )
    };
    proto[methodName].overloadTable = [];
    proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
  }
}
function exposePublicSymbol(name, value, numArguments) {
  if (Module.hasOwnProperty(name)) {
    if (
      undefined === numArguments ||
      (undefined !== Module[name].overloadTable &&
        undefined !== Module[name].overloadTable[numArguments])
    ) {
      throwBindingError("Cannot register public name '" + name + "' twice")
    }
    ensureOverloadTable(Module, name, name)
    if (Module.hasOwnProperty(numArguments)) {
      throwBindingError(
        "Cannot register multiple overloads of a function with the same number of arguments (" +
          numArguments +
          ")!"
      )
    }
    Module[name].overloadTable[numArguments] = value;
  } else {
    Module[name] = value;
    if (undefined !== numArguments) {
      Module[name].numArguments = numArguments;
    }
  }
}
function heap32VectorToArray(count, firstElement) {
  var array = [];
  for (var i = 0; i < count; i++) {
    array.push(HEAP32[(firstElement >> 2) + i])
  }
  return array;
}
function replacePublicSymbol(name, value, numArguments) {
  if (!Module.hasOwnProperty(name)) {
    throwInternalError("Replacing nonexistant public symbol")
  }
  if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
    Module[name].overloadTable[numArguments] = value;
  } else {
    Module[name] = value;
    Module[name].argCount = numArguments;
  }
}
function embind__requireFunction(signature, rawFunction) {
  signature = readLatin1String(signature)
  function makeDynCaller(dynCall) {
    var args = [];
    for (var i = 1; i < signature.length; ++i) {
      args.push("a" + i)
    }
    var name = "dynCall_" + signature + "_" + rawFunction;
    var body = "return function " + name + "(" + args.join(", ") + ") {\n";
    body +=
      "    return dynCall(rawFunction" +
      (args.length ? ", " : "") +
      args.join(", ") +
      ")\n";
    body += "};\n";
    return new Function("dynCall", "rawFunction", body)(dynCall, rawFunction)
  }
  var fp;
  if (Module["FUNCTION_TABLE_" + signature] !== undefined) {
    fp = Module["FUNCTION_TABLE_" + signature][rawFunction];
  } else if (typeof FUNCTION_TABLE !== "undefined") {
    fp = FUNCTION_TABLE[rawFunction];
  } else {
    var dc = Module["dynCall_" + signature];
    if (dc === undefined) {
      dc = Module["dynCall_" + signature.replace(/f/g, "d")];
      if (dc === undefined) {
        throwBindingError("No dynCall invoker for signature: " + signature)
      }
    }
    fp = makeDynCaller(dc)
  }
  if (typeof fp !== "function") {
    throwBindingError(
      "unknown function pointer with signature " +
        signature +
        ": " +
        rawFunction
    )
  }
  return fp;
}
var UnboundTypeError = undefined;
function getTypeName(type) {
  var ptr = ___getTypeName(type)
  var rv = readLatin1String(ptr)
  _free(ptr)
  return rv;
}
function throwUnboundTypeError(message, types) {
  var unboundTypes = [];
  var seen = {};
  function visit(type) {
    if (seen[type]) {
      return;
    }
    if (registeredTypes[type]) {
      return;
    }
    if (typeDependencies[type]) {
      typeDependencies[type].forEach(visit)
      return;
    }
    unboundTypes.push(type)
    seen[type] = true;
  }
  types.forEach(visit)
  throw new UnboundTypeError(
    message + ": " + unboundTypes.map(getTypeName).join([", "])
  )
}
function __embind_register_function(
  name,
  argCount,
  rawArgTypesAddr,
  signature,
  rawInvoker,
  fn
) {
  var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr)
  name = readLatin1String(name)
  rawInvoker = embind__requireFunction(signature, rawInvoker)
  exposePublicSymbol(
    name,
    function() {
      throwUnboundTypeError(
        "Cannot call " + name + " due to unbound types",
        argTypes
      )
    },
    argCount - 1
  )
  whenDependentTypesAreResolved([], argTypes, function(argTypes) {
    var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1))
    replacePublicSymbol(
      name,
      craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn),
      argCount - 1
    )
    return [];
  })
}
function integerReadValueFromPointer(name, shift, signed) {
  switch (shift) {
    case 0:
      return signed
        ? function readS8FromPointer(pointer) {
            return HEAP8[pointer];
          }
        : function readU8FromPointer(pointer) {
            return HEAPU8[pointer];
          };
    case 1:
      return signed
        ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1];
          }
        : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1];
          };
    case 2:
      return signed
        ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2];
          }
        : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2];
          };
    default:
      throw new TypeError("Unknown integer type: " + name)
  }
}
function __embind_register_integer(
  primitiveType,
  name,
  size,
  minRange,
  maxRange
) {
  name = readLatin1String(name)
  if (maxRange === -1) {
    maxRange = 4294967295;
  }
  var shift = getShiftFromSize(size)
  var fromWireType = value => value
  if (minRange === 0) {
    const bitshift = 32 - 8 * size
    fromWireType = function(value) {
      return (value << bitshift) >>> bitshift;
    };
  }
  var isUnsignedType = name.indexOf("unsigned") != -1;
  registerType(primitiveType, {
    name: name,
    fromWireType: fromWireType,
    toWireType: function(destructors, value) {
      if (typeof value !== "number" && typeof value !== "boolean") {
        throw new TypeError(
          'Cannot convert "' + String(value) + '" to ' + this.name
        )
      }
      if (value < minRange || value > maxRange) {
        throw new TypeError(
          'Passing a number "' +
            String(value) +
            '" from JS side to C/C++ side to an argument of type "' +
            name +
            '", which is outside the valid range [' +
            minRange +
            ", " +
            maxRange +
            "]!"
        )
      }
      return isUnsignedType ? value >>> 0 : value | 0;
    },
    argPackAdvance: 8,
    readValueFromPointer: integerReadValueFromPointer(
      name,
      shift,
      minRange !== 0
    ),
    destructorFunction: null
  })
}
function __embind_register_memory_view(rawType, dataTypeIndex, name) {
  var typeMapping = [
    Int8Array,
    Uint8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array
  ];
  var TA = typeMapping[dataTypeIndex];
  function decodeMemoryView(handle) {
    handle = handle >> 2;
    var heap = HEAPU32;
    var size = heap[handle];
    var data = heap[handle + 1];
    return new TA(heap["buffer"], data, size)
  }
  registerType(
    rawType,
    {
      name: readLatin1String(name),
      fromWireType: decodeMemoryView,
      argPackAdvance: 8,
      readValueFromPointer: decodeMemoryView
    },
    { ignoreDuplicateRegistrations: true }
  )
}
function __embind_register_std_string(rawType, name) {
  name = readLatin1String(name)
  var stdStringIsUTF8 = name === "std::string";
  registerType(rawType, {
    name,
    fromWireType: function(value) {
      var length = HEAPU32[value >> 2];
      var str;
      if (stdStringIsUTF8) {
        var endChar = HEAPU8[value + 4 + length];
        var endCharSwap = 0;
        if (endChar != 0) {
          endCharSwap = endChar;
          HEAPU8[value + 4 + length] = 0;
        }
        var decodeStartPtr = value + 4;
        for (var i = 0; i <= length; ++i) {
          var currentBytePtr = value + 4 + i;
          if (HEAPU8[currentBytePtr] == 0) {
            var stringSegment = UTF8ToString(decodeStartPtr)
            if (str === undefined) str = stringSegment;
            else {
              str += String.fromCharCode(0)
              str += stringSegment;
            }
            decodeStartPtr = currentBytePtr + 1;
          }
        }
        if (endCharSwap != 0) HEAPU8[value + 4 + length] = endCharSwap;
      } else {
        var a = new Array(length)
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
        }
        str = a.join("")
      }
      _free(value)
      return str;
    },
    toWireType: function(destructors, value) {
      if (value instanceof ArrayBuffer) {
        value = new Uint8Array(value)
      }
      var getLength;
      var valueIsOfTypeString = typeof value === "string";
      if (
        !(
          valueIsOfTypeString ||
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray ||
          value instanceof Int8Array
        )
      ) {
        throwBindingError("Cannot pass non-string to std::string")
      }
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        getLength = function() {
          return lengthBytesUTF8(value)
        };
      } else {
        getLength = function() {
          return value.length;
        };
      }
      var length = getLength()
      var ptr = _malloc(4 + length + 1)
      HEAPU32[ptr >> 2] = length;
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        stringToUTF8(value, ptr + 4, length + 1)
      } else {
        if (valueIsOfTypeString) {
          for (var i = 0; i < length; ++i) {
            var charCode = value.charCodeAt(i)
            if (charCode > 255) {
              _free(ptr)
              throwBindingError(
                "String has UTF-16 code units that do not fit in 8 bits"
              )
            }
            HEAPU8[ptr + 4 + i] = charCode;
          }
        } else {
          for (var i = 0; i < length; ++i) {
            HEAPU8[ptr + 4 + i] = value[i];
          }
        }
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr;
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function(ptr) {
      _free(ptr)
    }
  })
}
function __embind_register_std_wstring(rawType, charSize, name) {
  name = readLatin1String(name)
  var getHeap, shift;
  if (charSize === 2) {
    getHeap = function() {
      return HEAPU16;
    };
    shift = 1;
  } else if (charSize === 4) {
    getHeap = function() {
      return HEAPU32;
    };
    shift = 2;
  }
  registerType(rawType, {
    name: name,
    fromWireType: function(value) {
      var HEAP = getHeap()
      var length = HEAPU32[value >> 2];
      var a = new Array(length)
      var start = (value + 4) >> shift;
      for (var i = 0; i < length; ++i) {
        a[i] = String.fromCharCode(HEAP[start + i])
      }
      _free(value)
      return a.join("")
    },
    toWireType: function(destructors, value) {
      var HEAP = getHeap()
      var length = value.length;
      var ptr = _malloc(4 + length * charSize)
      HEAPU32[ptr >> 2] = length;
      var start = (ptr + 4) >> shift;
      for (var i = 0; i < length; ++i) {
        HEAP[start + i] = value.charCodeAt(i)
      }
      if (destructors !== null) {
        destructors.push(_free, ptr)
      }
      return ptr;
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function(ptr) {
      _free(ptr)
    }
  })
}
function __embind_register_void(rawType, name) {
  registerType(rawType, {
    isVoid: true,
    name: readLatin1String(name),
    argPackAdvance: 0,
    fromWireType: () => {},
    toWireType: () => {},
  })
}
const _emscripten_get_heap_size = () => HEAP8.length
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
}
function ___setErrNo(value) {
  if (Module["___errno_location"])
    HEAP32[Module["___errno_location"]() >> 2] = value;
  return value;
}
function abortOnCannotGrowMemory(requestedSize) {
  abort("OOM")
}
function _emscripten_resize_heap(requestedSize) {
  abortOnCannotGrowMemory(requestedSize)
}
BindingError = Module["BindingError"] = extendError(Error, "BindingError")
InternalError = Module["InternalError"] = extendError(Error, "InternalError")
init_emval()
UnboundTypeError = Module["UnboundTypeError"] = extendError(
  Error,
  "UnboundTypeError"
)
var asmGlobalArg = {};
var asmLibraryArg = {
  c: abort,
  h: ___setErrNo,
  k: __embind_register_bool,
  j: __embind_register_emval,
  g: __embind_register_float,
  e: __embind_register_function,
  d: __embind_register_integer,
  b: __embind_register_memory_view,
  f: __embind_register_std_string,
  i: __embind_register_std_wstring,
  p: __embind_register_void,
  o: () => HEAP8.length,
  n: _emscripten_memcpy_big,
  m: _emscripten_resize_heap,
  l: abortOnCannotGrowMemory,
  a: DYNAMICTOP_PTR
};
var asm = Module.asm(asmGlobalArg, asmLibraryArg, buffer)
Module.asm = asm;
const bind = (key, k) => Module[key] = (...args) =>
  console.log(key, k) ||
  Module.asm[k](...args)
var ___embind_register_native_and_builtin_types = bind(
  "___embind_register_native_and_builtin_types",
  "q")
const ___errno_location = bind("___errno_location", "r")
const ___getTypeName = bind("___getTypeName", "s")
const _free = bind("_free", "t")
const _malloc = bind("_malloc", "u")
const globalCtors = bind("globalCtors", "H")
const dynCall_i = bind("dynCall_i", "v")
const dynCall_ii = bind("dynCall_ii", "w")
const dynCall_iii = bind("dynCall_iii", "x")
const dynCall_iiii = bind("dynCall_iiii", "y")
const dynCall_iiiii = bind("dynCall_iiiii", "z")
const dynCall_iiiiii = bind("dynCall_iiiiii", "A")
const dynCall_iiiiiii = bind("dynCall_iiiiiii", "B")
const dynCall_vi = bind("dynCall_vi", "C")
const dynCall_vii = bind("dynCall_vii", "D")
const dynCall_viiii = bind("dynCall_viiii", "E")
const dynCall_viiiii = bind("dynCall_viiiii", "F")
const dynCall_viiiiii = bind("dynCall_viiiiii", "G")
Module.asm = asm;
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}
ExitStatus.prototype = new Error()
ExitStatus.prototype.constructor = ExitStatus;
dependenciesFulfilled = function runCaller() {
  if (!Module["calledRun"]) run()
  if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};
function run(args) {
  args = args || Module["arguments"];
  console.log('RUN!', args)
  if (runDependencies > 0) {
    return;
  }
  if (Module["calledRun"]) return;
  function doRun() {
    if (Module["calledRun"]) return;
    Module["calledRun"] = true;
    if (ABORT) return;
    runtimeInitialized = true
    globalCtors()
    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]()
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...")
    setTimeout(function() {
      setTimeout(function() {
        Module["setStatus"]("")
      }, 1)
      doRun()
    }, 1)
  } else {
    doRun()
  }
}
Module["run"] = run;
function abort(what) {
  if (Module["onAbort"]) {
    Module["onAbort"](what)
  }
  if (what !== undefined) {
    out(what)
    err(what)
    what = '"' + what + '"';
  } else {
    what = "";
  }
  ABORT = true;
  EXITSTATUS = 1;
  throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}
Module["abort"] = abort;
Module["noExitRuntime"] = true;
run()

const malloc = data => {
  const heap = new Uint8Array(HEAPU8.buffer, Module._malloc(data.length), data.length)
  heap.set(data)
  return heap.byteOffset
}

export const compress = (data, level = 9) => {
  const l = data.length
  const dataPtr = Module._malloc(l)
  const dataHeap = new Uint8Array(HEAPU8.buffer, dataPtr, l)
  dataHeap.set(data)

  const compressedLength = Module.ZSTD_compressBound(l)
  const compressedPtr = _malloc(compressedLength)
  const heap = new Uint8Array(
    HEAPU8.buffer,
    compressedPtr,
    compressedLength
  )
  const ret = Module.ZSTD_compress(
    heap.byteOffset,
    compressedLength,
    dataHeap.byteOffset,
    l,
    level
  )

  // Put result in new array so that we can free the memory
  const compressedData = new Uint8Array(heap.subarray(0, ret));

  // Free memory
  _free(dataHeap.byteOffset);
  _free(heap.byteOffset);

  return compressedData;
}

export const decompress = data => {
  const dataPtr = _malloc(data.length);
  const dataHeap = new Uint8Array(HEAPU8.buffer, dataPtr, data.length);
  dataHeap.set(data);
  
  const num_bytes_decompressed = Module.ZSTD_getFrameContentSize(dataHeap.byteOffset, data.length); 
  const decompressedPtr = _malloc(num_bytes_decompressed);
  const heap = new Uint8Array(HEAPU8.buffer, decompressedPtr, num_bytes_decompressed);

  const ret = Module.ZSTD_decompress(heap.byteOffset, num_bytes_decompressed, dataHeap.byteOffset, data.length);

  // Put result in new array so that we can free the memory
  const decompressedData = new Uint8Array(heap.subarray(0, ret));

  // Free memory
  _free(dataHeap.byteOffset);
  _free(heap.byteOffset);

  return decompressedData;
}
