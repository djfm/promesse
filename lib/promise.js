const tap = (value, withValue) => {
  setImmediate(withValue, value);
  return value;
};

const ifFunction = fn => yes => no => (
  typeof fn === 'function' ? yes(fn) : no(fn)
);

const maybeThenable = value =>
  value && (typeof value === 'object' || typeof value === 'function')
;

const ifThenable = value =>
  (...argsForThen) =>
    withValue => {
      if (maybeThenable(value)) {
        const then = value.then;
        if (typeof then === 'function') {
          return then.call(value, ...argsForThen);
        }
      }
      return withValue(value);
    };

const continueComputation = ({ state, value }) => handler =>
  ifFunction(handler.transformInput[state])(transform => {
    try {
      const newValue = transform(value);
      if (newValue === handler.promise) {
        throw new TypeError('A promise cannot be chained to itself.');
      }
      handler.propagateOutput.resolved(newValue);
    } catch (e) {
      handler.propagateOutput.rejected(e);
    }
  })(() => handler.propagateOutput[state](value))
;

const once = maybeFn => {
  if (typeof maybeFn === 'function') {
    return once().once(maybeFn);
  }
  let called = false;
  return {
    once: fn => (...args) => {
      if (!called) {
        called = true;
        fn(...args);
      }
    },
    wasCalled: () => called,
  };
};

const deferred = () => {
  let handlers = [];
  let state = 'pending';
  let value;

  const settle = () => {
    if (state === 'pending') {
      return;
    }

    handlers.map(continueComputation({ state, value }));

    handlers = [];
  };

  const setStateNow = targetState =>
    finalValue => {
      state = targetState;
      value = finalValue;
      setImmediate(settle);
    };

  const setStateEventually = targetState =>
    futureValue => {
      const spy = once();
      try {
        ifThenable(futureValue)(
          spy.once(setStateEventually('resolved')),
          spy.once(setStateNow('rejected'))
        )(setStateNow(targetState));
      } catch (e) {
        if (!spy.wasCalled()) {
          setStateNow('rejected')(e);
        }
      }
    }
  ;

  const just = once();

  const resolve = just.once(setStateEventually('resolved'));
  const reject = just.once(setStateNow('rejected'));

  return {
    resolve,
    reject,
    promise: {
      then: (onResolved, onRejected) =>
        tap(deferred(), d => {
          handlers.push({
            transformInput: {
              resolved: onResolved,
              rejected: onRejected,
            },
            propagateOutput: {
              resolved: d.resolve,
              rejected: d.reject,
            },
            promise: d.promise,
          });
          settle();
        }).promise,
    },
  };
};

module.exports = {
  resolved: value => tap(deferred(), d => d.resolve(value)).promise,
  rejected: value => tap(deferred(), d => d.reject(value)).promise,
  deferred,
};
