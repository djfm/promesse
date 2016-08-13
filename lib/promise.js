const tap = (value, withValue) => setImmediate(withValue, value) && value;

const ifFunction = fn => yes => no =>
  (typeof fn === 'function' ? yes(fn) : no(fn));

const compose = (...fns) => initialValue =>
  fns.reduce((previousResult, fn) => fn(previousResult), initialValue);

const maybeThenable = value =>
  value && (typeof value === 'object' || typeof value === 'function');

const ifThenable = value => (...argsForThen) => withValue => {
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
      compose(
        transform, transformedValue => {
          if (transformedValue === handler.promise) {
            throw new TypeError('A promise cannot be chained to itself.');
          }
          return transformedValue;
        },
        handler.propagateOutput.resolved
      )(value);
    } catch (e) {
      handler.propagateOutput.rejected(e);
    }
  })(() => handler.propagateOutput[state](value))
;

const spy = (() => {
  let called = false;
  return {
    once: fn => (...args) => called || ((called = true) && fn(...args)),
    wasCalled: () => called,
  };
});

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

  const setStateNow = targetState => finalValue => {
    state = targetState;
    value = finalValue;
    setImmediate(settle);
  };

  const setStateEventually = targetState => futureValue => {
    const s = spy();
    try {
      ifThenable(futureValue)(
        s.once(setStateEventually('resolved')),
        s.once(setStateNow('rejected'))
      )(setStateNow(targetState));
    } catch (e) {
      if (!s.wasCalled()) {
        setStateNow('rejected')(e);
      }
    }
  };

  const just = spy();
  const resolve = just.once(setStateEventually('resolved'));
  const reject = just.once(setStateNow('rejected'));

  return {
    resolve,
    reject,
    promise: {
      then: (resolved, rejected) =>
        tap(deferred(), d => {
          handlers.push({
            transformInput: { resolved, rejected },
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
