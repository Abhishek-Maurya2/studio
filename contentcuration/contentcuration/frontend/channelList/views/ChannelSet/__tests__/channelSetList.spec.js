import { mount } from '@vue/test-utils';
import store from '../../../store';
import router from '../../../router';
import { RouterNames } from '../../../constants';
import ChannelSetList from '../ChannelSetList.vue';

const id = '00000000000000000000000000000000';

function makeWrapper(createChannelSetStub) {
  router.push({
    name: RouterNames.CHANNEL_SETS,
  });
  const wrapper = mount(ChannelSetList, { store, router });
  wrapper.setMethods({
    createChannelSet: createChannelSetStub,
  });
  return wrapper;
}

describe('channelSetList', () => {
  let wrapper;
  let createChannelSetStub = jest.fn().mockImplementation(() => Promise.resolve(id));
  beforeEach(() => {
    wrapper = makeWrapper(createChannelSetStub);
  });
  it('should create a new channel set when new set button is clicked', () => {
    wrapper.setData({ loading: false });
    wrapper.find('[data-test="add-channelset"]').trigger('click');
    expect(createChannelSetStub).toHaveBeenCalled();
  });
});
