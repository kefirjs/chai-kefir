import deepEql from 'deep-eql'
import createTestHelpers from 'kefir-test-utils'

const CHECK_OBS = 'CHECK_OBS'
const CHECK_PROP = 'CHECK_PROP'
const CHECK_STREAM = 'CHECK_STREAM'
const CHECK_POOL = 'CHECK_POOL'
const CHECK_ACTIVE = 'CHECK_ACTIVE'

const noop = () => {}

export default Kefir => {
  const {
    END,
    VALUE,
    ERROR,
    send,
    value,
    error,
    end,
    activate,
    deactivate,
    prop,
    stream,
    pool,
    shakeTimers,
    withFakeTime,
    logItem,
    watch,
    watchWithTime,
  } = createTestHelpers(Kefir)

  const plugin = ({Assertion}, utils) => {
    Assertion.addChainableMethod(
      'observable',
      function observableMethod() {
        let results = [true, 'should be valid', 'should not be valid']
        const actual = utils.getActual(this, arguments)

        if (utils.flag(this, CHECK_OBS)) {
          if (!(actual instanceof Kefir.Observable)) {
            results = [
              false,
              `Expected ${actual} to be instance of Observable`,
              `Expected ${actual} to not be instance of Observable`,
            ]
          }

          if (utils.flag(this, CHECK_PROP) && !(actual instanceof Kefir.Property)) {
            results = [
              false,
              `Expected ${actual} to be instance of Property`,
              `Expected ${actual} to not be instance of Property`,
            ]
          }

          if (utils.flag(this, CHECK_STREAM) && !(actual instanceof Kefir.Stream)) {
            results = [false, '', '']
          }

          if (utils.flag(this, CHECK_POOL) && !(actual instanceof Kefir.Pool)) {
            results = [false, '', '']
          }

          if (utils.flag(this, CHECK_ACTIVE) && results[0]) {
            if (!actual._active) {
              results = [
                false,
                `Expected ${actual.toString()} to be active`,
                `Expected ${actual.toString()} to not be active`,
              ]
            }
          }
        }

        this.assert(...results)
      },
      function observableChaining() {
        utils.flag(this, CHECK_OBS, true)
      }
    )

    Assertion.overwriteMethod('property', function property(_super) {
      return function checkIfPropety() {
        if (utils.flag(this, CHECK_OBS)) {
          utils.flag(this, CHECK_PROP, true)
          this.observable()
        } else {
          _super.apply(this, arguments)
        }
      }
    })

    Assertion.addMethod('stream', function stream() {
      utils.flag(this, CHECK_OBS, true)
      utils.flag(this, CHECK_STREAM, true)
      this.observable()
    })

    Assertion.addMethod('pool', function stream() {
      utils.flag(this, CHECK_OBS, true)
      utils.flag(this, CHECK_POOL, true)
      this.observable()
    })

    Assertion.addChainableMethod(
      'active',
      function observableMethod() {
        this.observable()
      },
      function observableChaining() {
        utils.flag(this, CHECK_OBS, true)
        utils.flag(this, CHECK_ACTIVE, true)
      }
    )

    Assertion.addMethod('emit', function emitMethod(expected, cb = noop) {
      const actual = utils.getActual(this, arguments)

      const {log, unwatch} = watch(actual)
      cb()
      unwatch()

      this.assert(
        deepEql(log, expected),
        `Expected to emit #{exp}, actually emitted #{act}`,
        `Expected to not emit #{exp}, actually emitted #{act}`,
        expected,
        log
      )
    })

    Assertion.addMethod('emitInTime', function emitInTimeMethod(
      expected,
      cb = noop,
      {timeLimit = 10000, reverseSimultaneous = false} = {}
    ) {
      let log = null
      const actual = utils.getActual(this, arguments)

      withFakeTime((tick, clock) => {
        log = watchWithTime(actual)
        cb(tick, clock)
        tick(timeLimit)
      }, reverseSimultaneous)

      this.assert(
        deepEql(log, expected),
        `Expected to emit #{exp}, actually emitted #{act}`,
        `Expected to not emit #{exp}, actually emitted #{act}`,
        expected,
        log
      )
    })

    Assertion.addMethod('flowErrors', function flowErrorsMethod(source = utils.getActual(this, arguments)) {
      const actual = utils.getActual(this, arguments)
      const expected = [error(-2), error(-3)]

      if (actual instanceof Kefir.Property) {
        activate(actual)
        send(source, [error(-1)])
        deactivate(actual)
        expected.unshift(error(-1, {current: true}))
      }
      const {log, unwatch} = watch(actual)
      send(source, [error(-2), error(-3)])
      unwatch()

      this.assert(
        deepEql(log, expected),
        `Expected errors to flow (i.e. to emit #{exp}, actually emitted #{act})`,
        `Expected errors not to flow (i.e. to emit [], actually emitted #{act})`,
        expected,
        log
      )
    })
  }

  return {
    plugin,
    activate,
    deactivate,
    send,
    value,
    error,
    end,
    stream,
    prop,
    pool,
  }
}
