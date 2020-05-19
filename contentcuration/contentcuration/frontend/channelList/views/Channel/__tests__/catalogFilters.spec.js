import { mount } from '@vue/test-utils';
import store from '../../../store';
import router from '../../../router';
import CatalogFilters from '../CatalogFilters';

function makeWrapper(computed = {}) {
  return mount(CatalogFilters, {
    sync: false,
    router,
    store,
    computed,
    stubs: {
      CatalogFilterBar: true,
    },
  });
}

describe('catalogFilters', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = makeWrapper();
  });

  describe('keywords', () => {
    it('should call setKeywords when keywords change', () => {
      let setKeywordsMock = jest.fn();
      let setKeywords = () => {
        return () => {
          setKeywordsMock();
        };
      };
      wrapper = makeWrapper({ setKeywords });
      let keywords = wrapper.find('[data-test="keywords"]');
      keywords.element.value = 'test';
      keywords.trigger('input');
      expect(setKeywordsMock).toHaveBeenCalled();
    });
    it('keywordInput should stay in sync with query param', () => {
      const keywords = 'testing new keyword';
      router.push({ query: { keywords } });
      wrapper.vm.$nextTick(() => {
        expect(wrapper.vm.keywordInput).toBe(keywords);
      });
    });
  });
});
