(function(global) {

var DECL_STATES = {
        NOT_RESOLVED : 0,
        IN_RESOLVING : 1,
        RESOLVED     : 2
    },
    /**
     * Defines module
     * @param {String} name
     * @param {String[]} deps
     * @param {Function} declFn
     */
    define = function(name, deps, declFn) {
        declsToCalc.length || nextTick(calcDeclDeps);

        if(!declFn) {
            declFn = deps;
            deps = [];
        }

        var module = modulesStorage[name] || (modulesStorage[name] = {
                name : name,
                decl : undef
            });

        declsToCalc.push(module.decl = {
            fn            : declFn,
            state         : DECL_STATES.NOT_RESOLVED,
            deps          : deps,
            prevDecl      : module.decl,
            dependOnDecls : [],
            dependents    : [],
            exports       : undef
        });
    },

    /**
     * Requires modules
     * @param {String[]} modules
     * @param {Function} cb
     */
    require = function(modules, cb) {
        if(declsToCalc.length) {
            pendingRequires.push({ modules : modules, cb : cb });
            return;
        }

        var i = 0, dep, dependOnDecls = [];
        while(dep = modules[i++]) {
            modulesStorage[dep] || throwModuleNotFound(dep);
            dependOnDecls.push(modulesStorage[dep].decl);
        }

        requireDecls(dependOnDecls, function(exports) {
            cb.apply(null, exports);
        });
    },

    calcDeclDeps = function() {
        var i = 0, decl, j, dep, dependOnDecls;
        while(decl = declsToCalc[i++]) {
            j = 0;
            dependOnDecls = decl.dependOnDecls;
            while(dep = decl.deps[j++]) {
                modulesStorage[dep] || throwModuleNotFound(dep);
                dependOnDecls.push(modulesStorage[dep].decl);
            }
            delete decl.deps;

            if(decl.prevDecl) {
                dependOnDecls.push(decl.prevDecl);
                delete decl.prevDecl;
            }
        }

        declsToCalc = [];

        if(pendingRequires.length) {
            var pendingRequire;
            i = 0;
            while(pendingRequire = pendingRequires[i++]) {
                require(pendingRequire.modules, pendingRequire.cb);
            }
            pendingRequires = [];
        }
    },

    requireDecls = function(decls, cb) {
        var unresolvedDeclCnt = decls.length,
            checkUnresolved = true;

        if(unresolvedDeclCnt) {
            var onDeclResolved = function() {
                    --unresolvedDeclCnt || onDeclsResolved(decls, cb);
                },
                i = 0, decl;

            while(decl = decls[i++]) {
                if(decl.state === DECL_STATES.RESOLVED) {
                    --unresolvedDeclCnt;
                }
                else {
                    checkUnresolved = false;
                    decl.dependents.push(onDeclResolved);
                    if(decl.state === DECL_STATES.NOT_RESOLVED) {
                        startDeclResolving(decl);
                    }
                }
            }
        }

        if(checkUnresolved && !unresolvedDeclCnt) {
            onDeclsResolved(decls, cb);
        }
    },

    onDeclsResolved = function(decls, cb) {
        var exports = [],
            i = 0, decl;
        while(decl = decls[i++]) {
            exports.push(decl.exports);
        }
        cb(exports);
    },

    startDeclResolving = function(decl) {
        decl.state = DECL_STATES.IN_RESOLVING;
        requireDecls(
            decl.dependOnDecls,
            function(depDeclsExports) {
                decl.fn.apply(
                    null,
                    [function(exports) {
                        provideDecl(decl, exports);
                    }].concat(depDeclsExports));
            });
    },

    provideDecl = function(decl, exports) {
        decl.exports = exports;
        decl.state = DECL_STATES.RESOLVED;

        var i = 0, dependent;
        while(dependent = decl.dependents[i++]) {
            dependent(decl.exports);
        }

        delete decl.dependents;
    },

    undef,
    modulesStorage = {},
    declsToCalc = [],
    pendingRequires = [],
    throwModuleNotFound = function(name) {
        throw Error('can\'t find module "' + name + '"');
    },

    nextTick = typeof process === 'object'? // nodejs
        process.nextTick :
        global.setImmediate? // ie10
            global.setImmediate :
            global.postMessage? // modern browsers
                (function() {
                    var msg = '__modules' + +new Date,
                        onMessage = function(e) {
                            if(e.data === msg) {
                                e.stopPropagation && e.stopPropagation();
                                callFns();
                            }
                        };

                    global.addEventListener?
                        global.addEventListener('message', onMessage, true) :
                        global.attachEvent('onmessage', onMessage);

                    return function(fn) {
                        fns.push(fn) === 1 && global.postMessage(msg, '*');
                    };
                })() :
                'onreadystatechange' in global.document.createElement('script')? // old IE
                    (function() {
                        var createScript = function() {
                                var script = document.createElement('script');
                                script.onreadystatechange = function() {
                                    script.parentNode.removeChild(script);
                                    script = script.onreadystatechange = null;
                                    callFns();
                                };
                                (global.document.documentElement || global.document.body).appendChild(script);
                            };

                        return function(fn) {
                            fns.push(fn) === 1 && createScript();
                        };
                    })() :
                    function(fn) { // old browsers
                        setTimeout(fn, 0);
                    },
    fns = [],
    callFns = function() {
        var fnsToCall = fns, i = 0, len = fns.length;
        fns = [];
        while(i < len) {
            fnsToCall[i++]();
        }
    },

    api = {
        define  : define,
        require : require
    };

if(typeof exports === 'object') {
    module.exports = api;
}
else {
    global.modules = api;
}

})(this);