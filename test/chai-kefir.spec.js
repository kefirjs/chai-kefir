/* eslint-env mocha */
import {config, AssertionError, expect, use} from 'chai'
import Kefir from 'kefir'
import chaiKefir from '../src'

config.truncateThreshold = false
const {plugin, activate, deactivate, send, value, error, end, stream, prop, pool} = chaiKefir(Kefir)
use(plugin)

describe('chai-kefir', () => {
  describe('observable', () => {
    it('should match with stream', () => {
      expect(stream()).to.be.an.observable()
    })

    it('should match with property', () => {
      expect(prop()).to.be.an.observable()
    })

    it('should negate with plain object', () => {
      expect({}).to.not.be.an.observable()
    })
  })

  describe('property', () => {
    it('should fall back to property behavior when not observable', () => {
      expect({foo: true}).to.have.property('foo')
    })

    it('should match with property', () => {
      expect(prop()).to.be.an.observable.property()
    })

    it('should negate with stream', () => {
      expect(stream()).to.not.be.an.observable.property()
    })

    it('should negate with plain object', () => {
      expect({}).to.not.be.an.observable.property()
    })
  })

  describe('stream', () => {
    it('should match with stream', () => {
      expect(stream()).to.be.an.observable.stream()
    })

    it('should negate with property', () => {
      expect(prop()).to.not.be.an.observable.stream()
    })

    it('should negate with plain object', () => {
      expect({}).to.not.be.an.observable.stream()
    })
  })

  describe('pool', () => {
    it('should match with pool', () => {
      expect(pool()).to.be.an.observable.pool()
    })

    it('should negate with stream', () => {
      expect(stream()).to.not.be.an.observable.pool()
    })

    it('should negate with property', () => {
      expect(prop()).to.not.be.an.observable.pool()
    })

    it('should negate with plain object', () => {
      expect({}).to.not.be.an.observable.pool()
    })
  })

  describe('active', () => {
    it('should negate on plain object', () => {
      expect({}).to.not.be.active.observable()
    })

    it('should negate on inactive stream', () => {
      expect(stream()).to.not.be.active.observable.stream()
    })

    it('should negate on activated and deactivated stream', () => {
      const a = stream()
      activate(a)
      deactivate(a)
      expect(a).to.not.be.active.observable.stream()
    })

    it('should match on active stream', () => {
      const a = stream()
      activate(a)
      expect(a).to.be.active.observable.stream()
    })

    it('should match on active stream when called as method', () => {
      const a = stream()
      activate(a)
      expect(a).to.be.active()
    })

    it('should negate on inactive property', () => {
      expect(prop()).to.not.be.active.observable.property()
    })

    it('should match on active property', () => {
      const a = prop()
      activate(a)
      expect(a).to.be.active.observable.property()
    })

    it('should negate on activated and deactivated stream', () => {
      const a = prop()
      activate(a)
      deactivate(a)
      expect(a).to.not.be.active.observable.property()
    })
  })

  describe('emit', () => {
    it('should match on stream event', () => {
      const a = stream()
      expect(a).to.emit([value(1)], () => {
        send(a, [value(1)])
      })
    })

    it('should match on stream error', () => {
      const a = stream()
      expect(a).to.emit([error(1)], () => {
        send(a, [error(1)])
      })
    })

    it('should match on stream end', () => {
      const a = stream()
      expect(a).to.emit([end()], () => {
        send(a, [end()])
      })
    })

    it('should match events when stream is active', () => {
      const a = stream()
      expect(a).to.emit([end()], () => {
        send(a, [end(), value(1)])
      })
    })

    it('should match current event', () => {
      const a = prop()
      send(a, [value(1)])
      expect(a).to.emit([value(1, {current: true})])
    })

    it('should match current end', () => {
      const a = prop()
      send(a, [end()])
      expect(a).to.emit([end({current: true})])
    })

    it('should not match when stream emits too many events', () => {
      const a = stream()
      expect(a).to.not.emit([value(1), end()], () => {
        send(a, [value(1), value(2), end()])
      })
    })

    it('should not match when stream emits too few events', () => {
      const a = stream()
      expect(a).to.not.emit([1, end()], () => {
        send(a, [end()])
      })
    })
  })

  describe('emitInTime', () => {
    it('should emit into stream over time', () => {
      const a = stream()
      expect(a.delay(10)).to.emitInTime([[10, value(1)], [10, value(2)], [20, value(3)]], tick => {
        send(a, [value(1), value(2)])
        tick(10)
        send(a, [value(3)])
      })
    })

    it('should emit into stream over time in reverse', () => {
      const a = stream()
      expect(a.delay(10)).to.emitInTime(
        [[10, value(1)], [10, value(2)], [20, value(3)], [20, value(4)], [20, value(5)]],
        tick => {
          send(a, [value(1), value(2)])
          tick(10)
          send(a, [value(3), value(4), value(5)])
        },
        {reverseSimultaneous: true}
      )
    })

    it('should pass clock to callback', () => {
      const a = stream()
      expect(a.delay(10)).to.emitInTime([[10, value(1)]], (tick, clock) => {
        send(a, [value(1)])
        clock.runToLast()
      })
    })

    it('should uninstall clock if callback throws', () => {
      const a = stream()
      const origSetTimeout = setTimeout
      const err = new Error('sucks to be you!')
      try {
        expect(a).to.emitInTime([], () => {
          throw err
        })
      } catch (e) {
        expect(e).to.equal(err)
      } finally {
        expect(origSetTimeout).to.equal(setTimeout)
      }
    })
  })

  describe('errorToFlow', () => {
    it('should match when errors flow through stream', () => {
      const a = stream()

      expect(a).to.flowErrors()
    })

    it('should throw when errors do not flow through stream', () => {
      expect(() => {
        const a = stream()

        expect(a).to.not.flowErrors()
      }).to.throw(AssertionError)
    })

    it('should negate when errors do not flow through stream', () => {
      const a = stream()

      expect(a.ignoreErrors()).to.not.flowErrors(a)
    })

    it('should throw when errors flow through stream', () => {
      expect(() => {
        const a = stream()

        expect(a.ignoreErrors()).to.flowErrors(a)
      }).to.throw(AssertionError)
    })

    it('should match when errors flow through property', () => {
      const a = prop()

      expect(a).to.flowErrors()
    })

    it('should throw when errors do not flow through property', () => {
      expect(() => {
        const a = prop()

        expect(a).to.not.flowErrors()
      }).to.throw(AssertionError)
    })

    it('should negate when errors do not flow through property', () => {
      const a = prop()

      expect(a.ignoreErrors()).to.not.flowErrors(a)
    })

    it('should throw when errors flow through property', () => {
      expect(() => {
        const a = prop()

        expect(a.ignoreErrors()).to.flowErrors(a)
      }).to.throw(AssertionError)
    })
  })
})
