import * as getters from './getters';
import * as mutations from './mutations';
import * as actions from './actions';
import { TABLE_NAMES, CHANGE_TYPES } from 'shared/data';

export default {
  namespaced: true,
  state: () => {
    return {
      // Unlike other maps, this is a nested map
      // the top level key is the content node id
      // then assessent ids are used as keys in
      // the subsidiary maps
      assessmentItemsMap: {},
    };
  },
  getters,
  mutations,
  actions,
  listeners: {
    [TABLE_NAMES.ASSESSMENTITEM]: {
      [CHANGE_TYPES.CREATED]: 'ADD_ASSESSMENTITEM',
      [CHANGE_TYPES.UPDATED]: 'ADD_ASSESSMENTITEM',
      [CHANGE_TYPES.DELETED]: 'REMOVE_ASSESSMENTITEM',
    },
  },
};
