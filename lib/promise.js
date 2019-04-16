const useImmediately = (value, withValue) =>
  setImmediate(withValue, value) && value;

const ifFunction = f => yes => no => (typeof f === 'function' ? yes(f) : no(f));

const compose = (...fns) => initialValue =>
  fns.reduce((previousResult, fn) => fn(previousResult), initialValue);

const maybeThenable = value =>
  value && (typeof value === 'object' || typeof value === 'function');

const continueComputation = ({ state, value }) => handler =>
  ifFunction(handler.transformInput[state])(transform => {
    try {
      compose(transform, transformedValue => {
        if (transformedValue === handler.promise) {
          throw new TypeError('A promise cannot be chained to itself.');
        }
        return transformedValue;
      }, handler.propagateOutput.resolved)(value);
    } catch (e) {
      handler.propagateOutput.rejected(e);
    }
  })(() => handler.propagateOutput[state](value));

const spy = () => {
  let called = false;
  return fn => (...args) => called || ((called = true) && fn(...args));
};

const deferred = () => {
  let [handlers, state, value] = [[], 'pending'];

  const settle = () => {
    if (state !== 'pending') {
      handlers.forEach(continueComputation({ state, value }));
      handlers = [];
    }
  };

  const setStateNow = targetState => finalValue =>
    useImmediately(([state, value] = [targetState, finalValue]), settle);

  const setStateEventually = targetState => promise => {
    const s = spy();
    try {
      if (maybeThenable(promise)) {
        const then = promise.then;
        if (typeof then === 'function') {
          then.call(
            promise,
            s(setStateEventually('resolved')),
            s(setStateNow('rejected'))
          );
          return;
        }
      }
      setStateNow(targetState)(promise);
    } catch (e) {
      s(setStateNow('rejected'))(e);
    }
  };

  const just = spy();
  return {
    resolve: just(setStateEventually('resolved')),
    reject: just(setStateNow('rejected')),
    promise: {
      then: (resolved, rejected) =>
        useImmediately(deferred(), d => {
          handlers.push({
            transformInput: { resolved, rejected },
            propagateOutput: { resolved: d.resolve, rejected: d.reject },
            promise: d.promise,
          });
          settle();
        }).promise,
    },
  };
};

module.exports = {
  resolved: value => useImmediately(deferred(), d => d.resolve(value)).promise,
  rejected: value => useImmediately(deferred(), d => d.reject(value)).promise,
  deferred,
};
