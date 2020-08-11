'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (selector) {
  return {
    expect: function (_expect) {
      function expect(_x) {
        return _expect.apply(this, arguments);
      }

      expect.toString = function () {
        return _expect.toString();
      };

      return expect;
    }(function (state) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      var originalState = _lodash2.default.cloneDeep(state);
      var result = selector.apply(undefined, [state].concat(args));
      var mutated = !(0, _utils.deepEqual)(state, originalState);

      return {
        toReturn: function toReturn(expected) {
          expect(result).toEqual(expected);
          // expect(mutated).toEqual(false);
          if (mutated) {
            throw new Error('state mutated after running selector');
          }
        }
      };
    }),
    execute: function execute(state) {
      for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      var originalState = _lodash2.default.cloneDeep(state);
      var result = selector.apply(undefined, [state].concat(args));
      var mutated = !(0, _utils.deepEqual)(state, originalState);
      if (mutated) {
        throw new Error('state mutated after running selector');
      }
      return result;
    }
  };
};

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }