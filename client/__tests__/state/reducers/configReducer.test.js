import { Reducer } from 'redux-testkit';
import configReducer from '../../../src/state/reducers/configReducer';
import { FETCH_CONFIG_COMPLETED } from '../../../src/state/constants/action-types';

describe('configReducer -', () => {
  const reducer = Reducer(configReducer);

  it('should not mutate state on unrecognized type', () => {
    const state = {};
    const action = { type: undefined };
    reducer.expect(action).toReturnState(state);
  });

  it('should update config of the state', () => {
    const payload = [
      { id: 'item-1', label: 'item number 1'},
      { id: 'item-2', label: 'item number 2'},
      { id: 'item-3', label: 'item number 3'},
    ];
    const action = { type: FETCH_CONFIG_COMPLETED, payload };
    reducer.expect(action).toReturnState({ config: payload });
  });
});