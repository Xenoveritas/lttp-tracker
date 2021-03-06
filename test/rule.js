"use strict";

const assert = require('assert'),
  Rule = require('../dist-tools/src/rule').default;

describe('Rule', () => {
  describe('#dependsOn', () => {
    it('should determine what a rule depends on', () => {
      let rule = Rule.parse({any: [ 'foo', 'bar', 'baz' ]});
      assert.equal(rule.dependsOn('foo'), true);
      assert.equal(rule.dependsOn('quz'), false);
    });
  });
});

describe('Environment', () => {
  let environment;
  beforeEach('create environment', () => {
    environment = new Rule.Environment();
    environment.set('foo', true);
    environment.set('bar', false);
  });
  describe('#isTrue', () => {
    it('should return false for undefined values', () => {
      assert.equal(environment.isTrue('quz'), false);
    });
  });
  describe('#addListener', () => {
    it('should add a listener to a new value', () => {
      let worked = false;
      let listener = () => worked = true;
      environment.addListener('quz', listener);
      environment.set('quz', true);
      assert.equal(worked, true);
    });
  });
  describe('#removeListener', () => {
    it('should remove a listener', () => {
      let worked = true;
      let listener = () => worked = false;
      environment.addListener('foo', listener);
      environment.removeListener('foo', listener);
      environment.set('foo', false);
      assert.equal(worked, true);
    });
  });
  describe('listeners', () => {
    it('should not fire events if a value does not change', () => {
      let worked = true;
      let listener = () => worked = false;
      environment.addListener('foo', listener);
      environment.set('foo', true);
      assert.equal(worked, true);
    })
  });
  describe('binding rules', () => {
    let environment, rule;
    beforeEach('create variables', () => {
      environment = new Rule.Environment();
      environment.set('foo', true);
      environment.set('bar', false);
      rule = Rule.parse([ 'foo', 'bar' ]);
    });
    it('should update to reflect changes', () => {
      environment.set('rule', rule);
      environment.set('bar', true);
      assert.equal(environment.isTrue('rule'), true);
    });
    it('should not allow the creation of circular dependencies', () => {
      assert.throws(() => {
        environment.set('foo', rule);
      }, /circular dependency/);
    });
    it('should allow a new rule to be bound', () => {
      environment.set('rule', rule);
      let newRule = Rule.parse('baz');
      environment.set('rule', newRule);
      // FIXME: This relies on private not being enforced in JS and won't work when converted to TypeScript
      assert.equal(environment._get('foo').dependents.length, 0);
      assert.equal(environment._get('bar').dependents.length, 0);
      assert.equal(environment._get('baz').dependents.length, 1);
      environment.set('rule', false);
      assert.equal(environment._get('baz').dependents.length, 0);
    });
  });
  describe('independent rule functions', () => {
    describe('Rule.TRUE', () => {
      it('works', () => {
        assert.equal(Rule.TRUE.isIndependent(), true);
        assert.equal(Rule.TRUE.isAlwaysTrue(), true);
        assert.equal(Rule.TRUE.isAlwaysFalse(), false);
      });
    });
    describe('Rule.FALSE', () => {
      it('works', () => {
        assert.equal(Rule.FALSE.isIndependent(), true);
        assert.equal(Rule.FALSE.isAlwaysTrue(), false);
        assert.equal(Rule.FALSE.isAlwaysFalse(), true);
      });
    });
  })
});
