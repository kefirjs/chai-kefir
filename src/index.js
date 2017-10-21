import Kefir from 'kefir';
import deepEql from 'deep-eql';
import lolex from 'lolex';
import { expect } from 'chai';

export const send = (obs, events) => {
    for (let event of events) {
        if (event === '<end>') {
            obs._emitEnd();
        }
        if (typeof event === 'object' && 'error' in event) {
            obs._emitError(event.error);
        } else {
            obs._emitValue(event);
        }
    }
    return obs;
};

const _activateHelper = () => {
};

export const activate = obs => {
    obs.onEnd(_activateHelper);
    return obs;
};

export const deactivate = obs => {
    obs.offEnd(_activateHelper);
    return obs;
};

export const prop = () => new Kefir.Property();

export const stream = () => new Kefir.Stream();

export const pool = () => new Kefir.Pool();

// This function changes timers' IDs so "simultaneous" timers are reversed
// Also sets createdAt to 0 so closk.tick will sort by ID
// FIXME:
//   1) Not sure how well it works with interval timers (setInterval), probably bad
//   2) We need to restore (unshake) them back somehow (after calling tick)
//   Hopefully we'll get a native implementation, and wont have to fix those
//   https://github.com/sinonjs/lolex/issues/24
const shakeTimers = clock => {
    const ids = Object.keys(clock.timers);
    const timers = ids.map(id => clock.timers[id]);

    // see https://github.com/sinonjs/lolex/blob/a93c8a9af05fb064ae5c2ad1bfc72874973167ee/src/lolex.js#L175-L209
    timers.sort((a, b) => {
        if (a.callAt < b.callAt) {
            return -1;
        }
        if (a.callAt > b.callAt) {
            return 1;
        }
        if (a.immediate && !b.immediate) {
            return -1;
        }
        if (!a.immediate && b.immediate) {
            return 1;
        }

        // Following two cheks are reversed
        if (a.createdAt < b.createdAt) {
            return 1;
        }
        if (a.createdAt > b.createdAt) {
            return -1;
        }
        if (a.id < b.id) {
            return 1;
        }
        if (a.id > b.id) {
            return -1;
        }
    });

    ids.sort((a, b) => a - b);
    timers.forEach((timer, i) => {
        const id = ids[i];
        timer.createdAt = 0;
        timer.id = id;
        clock.timers[id] = timer;
    });
};

export const withFakeTime = (cb, reverseSimultaneous = false) => {
    const clock = lolex.install();
    const tick = t => {
        if (reverseSimultaneous) {
            shakeTimers(clock);
        }
        clock.tick(t);
    };
    cb(tick, clock);
    clock.uninstall();
};

// see:
//   https://github.com/rpominov/kefir/issues/134
//   https://github.com/rpominov/kefir/pull/135
export const shakyTimeTest = testCb => {
    it('[shaky time test: normal run]', () => {
        const expectToEmitOverShakyTime = (stream, expected, cb, timeLimit) =>
            expect(stream).to.emitInTime(expected, cb, timeLimit);
        testCb(expectToEmitOverShakyTime);
    });

    it('[shaky time test: reverse run]', () => {
        const expectToEmitOverShakyTime = (stream, expected, cb, timeLimit) =>
            expect(stream).to.emitInTime(expected, cb, timeLimit, true);
        testCb(expectToEmitOverShakyTime);
    });
};

const logItem = (event, isCurrent) => {
    if (event.type === 'value') {
        if (isCurrent) {
            return { current: event.value };
        } else {
            return event.value;
        }
    } else if (event.type === 'error') {
        if (isCurrent) {
            return { currentError: event.value };
        } else {
            return { error: event.value };
        }
    } else {
        if (isCurrent) {
            return '<end:current>';
        } else {
            return '<end>';
        }
    }
};

const noop = () => {};

export const watch = obs => {
    const log = [];
    const fn = event => log.push(logItem(event, isCurrent));
    const unwatch = () => obs.offAny(fn);
    let isCurrent = true;
    obs.onAny(fn);
    isCurrent = false;
    return { log, unwatch };
};

const watchWithTime = obs => {
    const startTime = new Date();
    const log = [];
    let isCurrent = true;
    obs.onAny(event => log.push([new Date() - startTime, logItem(event, isCurrent)]));
    isCurrent = false;
    return log;
};

const CHECK_OBS = 'CHECK_OBS';
const CHECK_PROP = 'CHECK_PROP';
const CHECK_STREAM = 'CHECK_STREAM';
const CHECK_POOL = 'CHECK_POOL';
const CHECK_ACTIVE = 'CHECK_ACTIVE';

export default ({ Assertion }, utils) => {
    Assertion.addChainableMethod('observable', function observableMethod () {
        let results = [
            true,
            'should be valid',
            'should not be valid'
        ];
        const actual = utils.getActual(this, arguments);

        if (utils.flag(this, CHECK_OBS)) {
            if (!(actual instanceof Kefir.Observable)) {
                results = [
                    false,
                    `Expected ${actual} to be instance of Observable`,
                    `Expected ${actual} to not be instance of Observable`
                ];
            }

            if (utils.flag(this, CHECK_PROP) && !(actual instanceof Kefir.Property)) {
                results = [
                    false,
                    `Expected ${actual} to be instance of Property`,
                    `Expected ${actual} to not be instance of Property`
                ];
            }

            if (utils.flag(this, CHECK_STREAM) && !(actual instanceof Kefir.Stream)) {
                results = [false, '', ''];
            }

            if (utils.flag(this, CHECK_POOL) && !(actual instanceof Kefir.Pool)) {
                results = [false, '', ''];
            }

            if (utils.flag(this, CHECK_ACTIVE) && results[0]) {
                if (!actual._active) {
                    results = [
                        false,
                        `Expected ${actual.toString()} to be active`,
                        `Expected ${actual.toString()} to not be active`
                    ];
                }
            }
        }

        this.assert(...results);
    }, function observableChaining () {
        utils.flag(this, CHECK_OBS, true);
    });

    Assertion.overwriteMethod('property', function property (_super) {
        return function checkIfPropety () {
            if (utils.flag(this, CHECK_OBS)) {
                utils.flag(this, CHECK_PROP, true);
                this.observable();
            } else {
                _super.apply(this, arguments);
            }
        };
    });

    Assertion.addMethod('stream', function stream () {
        utils.flag(this, CHECK_OBS, true);
        utils.flag(this, CHECK_STREAM, true);
        this.observable();
    });

    Assertion.addMethod('pool', function stream () {
        utils.flag(this, CHECK_OBS, true);
        utils.flag(this, CHECK_POOL, true);
        this.observable();
    });

    Assertion.addChainableMethod('active', function observableMethod () {
        this.observable();
    }, function observableChaining () {
        utils.flag(this, CHECK_OBS, true);
        utils.flag(this, CHECK_ACTIVE, true);
    });

    Assertion.addMethod('emit', function emitMethod (expected, cb = noop) {
        const actual = utils.getActual(this, arguments);

        const { log, unwatch } = watch(actual);
        cb();
        unwatch();

        this.assert(
            deepEql(log, expected),
            `Expected to emit ${utils.objDisplay(expected)}, actually emitted ${utils.objDisplay(log)}`,
            `Expected to not emit ${utils.objDisplay(expected)}, actually emitted ${utils.objDisplay(log)}`
        );
    });

    Assertion.addMethod('emitInTime',
        function emitInTimeMethod(expected, cb = noop, { timeLimit = 10000, reverseSimultaneous = false } = {}) {
            let log = null;
            const actual = utils.getActual(this, arguments);

            withFakeTime(tick => {
                log = watchWithTime(actual);
                cb(tick);
                tick(timeLimit);
            }, reverseSimultaneous);

            this.assert(
                deepEql(log, expected),
                `Expected to emit ${utils.objDisplay(expected)}, actually emitted ${utils.objDisplay(log)}`,
                `Expected to not emit ${utils.objDisplay(expected)}, actually emitted ${utils.objDisplay(log)}`
            );
    });

    Assertion.addMethod('flowErrors', function emitMethod (source = utils.getActual(this, arguments)) {
        const actual = utils.getActual(this, arguments);
        const expected = [{ error: -2 }, { error: -3 }];

        if (actual instanceof Kefir.Property) {
            activate(actual);
            send(source, [{ error: -1 }]);
            deactivate(actual);
            expected.unshift({ currentError: -1 });
        }
        const { log, unwatch } = watch(actual);
        send(source, [{ error: -2 }, { error: -3 }]);
        unwatch();

        this.assert(
            deepEql(log, expected),
            `Expected errors to flow (i.e. to emit ${utils.objDisplay(expected)}, actually emitted ${utils.objDisplay(log)})`,
            `Expected errors not to flow (i.e. to emit [], actually emitted ${utils.objDisplay(log)})`
        );
    });
};
