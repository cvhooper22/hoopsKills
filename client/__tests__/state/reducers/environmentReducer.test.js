import { Reducer } from 'redux-testkit';
import environmentReducer from '../../../src/state/reducers/environmentReducer';
import { APPLICATION_INITIALIZED } from '../../../src/state/constants/action-types';

describe('environmentReducer -', () => {
  const reducer = Reducer(environmentReducer);

  it('should not mutate state on unrecognized type', () => {
    const state = {};
    const action = { type: undefined };
    reducer.expect(action).toReturnState(state);
  });

  it('should set appReady state', () => {
    const payload = true;
    const action = { type: APPLICATION_INITIALIZED, payload };
    reducer.expect(action).toReturnState({ appReady: payload });
  });
});