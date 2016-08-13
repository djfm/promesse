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

const continueComputation = ({ state, value }) => handler => {
  const transform = handler.transformInput[state];
  if (typeof transform === 'function') {
    try {
      const newValue = transform(value);
      if (newValue === handler.promise) {
        throw new TypeError('A promise cannot be chained to itself.');
      }
      handler.propagateOutput.resolved(newValue);
    } catch (e) {
      handler.propagateOutput.rejected(e);
    }
  } else {
    handler.propagateOutput[state](value);
  }
};

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

  const then = (onResolved, onRejected) => {
    const nextDeferred = deferred();

    setImmediate(() => {
      handlers.push({
        transformInput: {
          resolved: onResolved,
          rejected: onRejected,
        },
        propagateOutput: {
          resolved: nextDeferred.resolve,
          rejected: nextDeferred.reject,
        },
        promise: nextDeferred.promise,
      });
      settle();
    });

    return nextDeferred.promise;
  };

  return {
    resolve,
    reject,
    promise: {
      then,
    },
  };
};

const callOnDeferredThenReturnPromise = handlerName =>
  value => {
    const d = deferred();
    d[handlerName](value);
    return d.promise;
  };

module.exports = {
  resolved: callOnDeferredThenReturnPromise('resolve'),
  rejected: callOnDeferredThenReturnPromise('reject'),
  deferred,
};
