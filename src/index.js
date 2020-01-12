import ToolboxIcon from './svg/toolbox.svg';
import './index.css';
import Uploader from './uploader';

/**
 * Timeout when loader should be removed
 */
const LOADER_DELAY = 500;

/**
 * @typedef {object} PersonalityToolData
 * @description Personality Tool's input and output data format
 * @property {string} description - person's description
 * @property {string} link - link to person's website
 * @property {string} photo - person's photo url
 */

/**
 * @typedef {object} PersonalityConfig
 * @description Config supported by Tool
 * @property {object} endpoints - upload endpoints
 * @property {string} endpoints.byFile - upload by file
 * @property {string} endpoints.byUrl - upload by URL
 * @property {string} field - field name for uploaded image
 * @property {string} types - available mime-types
 * @property {string} descriptionPlaceholder - description placeholder
 * @property {string} linkPlaceholder - link placeholder
 * @property {object} additionalRequestData - any data to send with requests
 * @property {object} additionalRequestHeaders - allows to pass custom headers with Request
 * @property {object} [uploader] - optional custom uploader
 * @property {function(File): Promise.<UploadResponseFormat>} [uploader.uploadByFile] - method that upload image by File
 * @property {function(string): Promise.<UploadResponseFormat>} [uploader.uploadByUrl] - method that upload image by URL
 */

/**
 * @typedef {object} UploadResponseFormat
 * @description This format expected from backend on file uploading
 * @property {number} success - 1 for successful uploading, 0 for failure
 * @property {object} file - Object with file data.
 *                           'url' is required,
 *                           also can contain any additional data that will be saved and passed back
 * @property {string} file.url - [Required] image source URL
 */

/**
 * Personality Tool for the Editor.js
 */
export default class Personality {
  /**
   * @param {PersonalityToolData} data - Tool's data
   * @param {PersonalityConfig} config - Tool's config
   * @param {API} api - Editor.js API
   */
  constructor({ data, config, api }) {
    this.api = api;

    this.nodes = {
      wrapper: null,
      description: null,
      photo: null
    };

    this.config = {
      endpoints: config.endpoints || '',
      additionalRequestData: config.additionalRequestData || {},
      additionalRequestHeaders: config.additionalRequestHeaders || {},
      field: config.field || 'image',
      types: config.types || 'image/*',
      descriptionPlaceholder: config.descriptionPlaceholder || 'Description',
      uploader: config.uploader || undefined
    };

    /**
     * Set saved state
     */
    this._data = {};
    this.data = data;

    /**
     * Module for image files uploading
     */
    this.uploader = new Uploader({
      config: this.config,
      onUpload: (response) => this.onUpload(response),
      onError: (error) => this.uploadingFailed(error)
    });
  }

  /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   */
  static get toolbox() {
    return {
      icon: ToolboxIcon,
      title: 'ImageAndText'
    };
  }

  /**
   * File uploading callback
   * @param {UploadResponseFormat} response
   */
  onUpload(response) {
    if (response.success && response.file) {
      Object.assign(this.data, { photo: response.file.url });
      this.showFullImage();
    } else {
      this.uploadingFailed('Incorrect response: ' + JSON.stringify(response));
    }
  }

  /**
   * On success: remove loader and show full image
   */
  showFullImage() {
    setTimeout(() => {
      this.nodes.photo.classList.remove(this.CSS.loader);
      this.nodes.photo.style.background = `url('${this.data.photo}') center center / cover no-repeat`;
    }, LOADER_DELAY);
  }

  /**
   * On fail: remove loader and reveal default image placeholder
   */
  stopLoading() {
    setTimeout(() => {
      this.nodes.photo.classList.remove(this.CSS.loader);
      this.nodes.photo.removeAttribute('style');
    }, LOADER_DELAY);
  }

  /**
   * Show loader when file upload started
   */
  addLoader() {
    this.nodes.photo.style.background = 'none';
    this.nodes.photo.classList.add(this.CSS.loader);
  }

  /**
   * If file uploading failed, remove loader and show notification
   * @param {string} errorMessage -  error message
   */
  uploadingFailed(errorMessage) {
    this.stopLoading();

    this.api.notifier.show({
      message: errorMessage,
      style: 'error'
    });
  }

  /**
   * Tool's CSS classes
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      input: this.api.styles.input,
      loader: this.api.styles.loader,

      /**
       * Tool's classes
       */
      wrapper: 'cdx-personality',
      photo: 'cdx-personality__photo',
      description: 'cdx-personality__description'
    };
  }

  /**
   * Return Block data
   * @param {HTMLElement} toolsContent
   * @return {PersonalityToolData}
   */
  save(toolsContent) {
    const description = toolsContent.querySelector(`.${this.CSS.description}`).textContent;

    Object.assign(this.data, {
      description: description || this._data.description,
    });

    return this.data;
  }

  /**
   * Stores all Tool's data
   * @param {PersonalityToolData} data
   */
  set data({ name, description, link, photo }) {
    this._data = Object.assign({}, {
      description: description || this._data.description,
      photo: photo || this._data.photo
    });
  }

  /**
   * Return Tool data
   * @return {PersonalityToolData} data
   */
  get data() {
    return this._data;
  }

  /**
   * Renders Block content
   * @return {HTMLDivElement}
   */
  render() {
    const { description, photo } = this.data;

    this.nodes.wrapper = this.make('div', this.CSS.wrapper);

    this.nodes.description = this.make('div', this.CSS.description, {
      contentEditable: true
    });

    this.nodes.photo = this.make('div', this.CSS.photo);

    if (photo) {
      this.nodes.photo.style.background = `url('${photo}') center center / cover no-repeat`;
    }

    if (description) {
      this.nodes.description.textContent = description;
    } else {
      this.nodes.description.dataset.placeholder = this.config.descriptionPlaceholder;
    }

    this.nodes.photo.addEventListener('click', () => {
      this.uploader.uploadSelectedFile({
        onPreview: () => {
          this.addLoader();
        }
      });
    });

    this.nodes.wrapper.appendChild(this.nodes.photo);
    this.nodes.wrapper.appendChild(this.nodes.description);

    return this.nodes.wrapper;
  }

  /**
   * Helper method for elements creation
   * @param tagName
   * @param classNames
   * @param attributes
   * @return {HTMLElement}
   */
  make(tagName, classNames = null, attributes = {}) {
    const el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }
}
