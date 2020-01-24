import { mount } from '@vue/test-utils';
import Vue from 'vue';
import Vuetify from 'vuetify';
import camelCase from 'lodash/camelCase';
import ContentDefaults from '../ContentDefaults.vue';

Vue.use(Vuetify);

function makeWrapper(contentDefaults) {
  return mount(ContentDefaults, {
    sync: true,
    propsData: {
      contentDefaults,
    },
  });
}

function assertFieldValues(keys, fields, contentDefaults, prop = 'value') {
  keys.forEach(key => {
    const field = fields.filter(f => f.contains(`[data-name="${camelCase(key)}"]`)).at(0);
    expect(field.props(prop)).toEqual(contentDefaults[key]);
  });
}

function updateFieldValues(keys, fields, contentDefaults) {
  keys.forEach(key => {
    const selector = `[data-name="${camelCase(key)}"]`;
    const field = fields.filter(f => f.contains(selector)).at(0);
    const input = field.find(`.v-input ${selector}`);

    if (input.is('[type="checkbox"]')) {
      input.setChecked(contentDefaults[key]);
    } else {
      input.setValue(contentDefaults[key]);
    }
  });
}

function assertFormValues(wrapper, contentDefaults) {
  const textFields = wrapper.findAll({ name: 'v-text-field' });
  expect(textFields.length).toEqual(4);
  assertFieldValues(
    ['author', 'provider', 'aggregator', 'copyright_holder'],
    textFields,
    contentDefaults
  );

  const selects = wrapper.findAll({ name: 'v-select' });
  expect(selects.length).toEqual(1);
  assertFieldValues(['license'], selects, contentDefaults);

  const textAreas = wrapper.findAll({ name: 'v-textarea' });
  if (contentDefaults.license !== 'Special Permissions') {
    expect(textAreas.length).toEqual(0);
  } else {
    expect(textAreas.length).toEqual(1);
    assertFieldValues(['license_description'], textAreas, contentDefaults);
  }

  const checkboxes = wrapper.findAll({ name: 'AppCheckbox' });
  expect(checkboxes.length).toEqual(4);
  assertFieldValues(
    [
      'auto_derive_audio_thumbnail',
      'auto_derive_document_thumbnail',
      'auto_derive_html5_thumbnail',
      'auto_derive_video_thumbnail',
    ],
    checkboxes,
    contentDefaults,
    'inputValue'
  );
}

function updateFormValues(wrapper, contentDefaults) {
  const textFields = wrapper.findAll({ name: 'v-text-field' });
  updateFieldValues(
    ['author', 'provider', 'aggregator', 'copyright_holder'],
    textFields,
    contentDefaults
  );

  const selects = wrapper.findAll({ name: 'v-select' });
  updateFieldValues(['license'], selects, contentDefaults);

  const textAreas = wrapper.findAll({ name: 'v-textarea' });
  if (contentDefaults.license === 'Special Permissions') {
    updateFieldValues(['license_description'], textAreas, contentDefaults);
  }

  const checkboxes = wrapper.findAll({ name: 'AppCheckbox' });
  updateFieldValues(
    [
      'auto_derive_audio_thumbnail',
      'auto_derive_document_thumbnail',
      'auto_derive_html5_thumbnail',
      'auto_derive_video_thumbnail',
    ],
    checkboxes,
    contentDefaults
  );
}

describe('contentDefaults', () => {
  describe('initial state', () => {
    const defaultFormValues = {
      author: '',
      provider: '',
      aggregator: '',
      copyright_holder: '',
      license: '',
      license_description: '',
      auto_derive_audio_thumbnail: true,
      auto_derive_document_thumbnail: true,
      auto_derive_html5_thumbnail: true,
      auto_derive_video_thumbnail: true,
    };

    it('should fill fields with defaults', () => {
      const contentDefaults = {
        author: 'Buster McTester',
        provider: 'USA',
        aggregator: 'Aggregator R Us',
        copyright_holder: 'Learning Equality',
        license: 'Special Permissions',
        license_description: 'You need to ask Buster first.',
        auto_derive_audio_thumbnail: false,
        auto_derive_document_thumbnail: true,
        auto_derive_html5_thumbnail: true,
        auto_derive_video_thumbnail: false,
      };
      const wrapper = makeWrapper(contentDefaults);
      assertFormValues(wrapper, contentDefaults);
    });

    it('should fill fields with defaults', () => {
      const wrapper = makeWrapper({});
      assertFormValues(wrapper, defaultFormValues);
    });

    it('should pre-validate license value', () => {
      const wrapper = makeWrapper({
        license: 'This license does not exist',
      });
      assertFormValues(wrapper, defaultFormValues);
    });
  });

  describe('updating state', () => {
    it('should fill fields with defaults', () => {
      const setValues = {
        author: 'Buster McTester',
        provider: 'USA',
        aggregator: 'Aggregator R Us',
        copyright_holder: 'Learning Equality',
        license: 'Special Permissions',
        license_description: 'You need to ask Buster first.',
        auto_derive_audio_thumbnail: false,
        auto_derive_document_thumbnail: true,
        auto_derive_html5_thumbnail: true,
        auto_derive_video_thumbnail: false,
      };
      const wrapper = makeWrapper({});
      updateFormValues(wrapper, setValues);

      return Vue.nextTick().then(() => {
        const contentDefaults = wrapper.emitted('change').pop()[0];
        expect(contentDefaults).toEqual(setValues);
      });
    });
  });
});
