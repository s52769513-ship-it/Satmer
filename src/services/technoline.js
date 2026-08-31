const axios = require('axios');

/**
 * Technoline IVR Extensions Management API client.
 * Docs: ivrFilesApi.php — manages the phone tree (extensions), audio files,
 * per-extension security rules and system message overrides.
 */
class TechnolineIvrService {
  constructor() {
    this.apiKey = process.env.TECHNOLINE_API_KEY;
    this.baseUrl = process.env.TECHNOLINE_IVR_API_URL || 'https://app.tlivr.com/ivrFilesApi.php';
  }

  async _get(action, params = {}) {
    const response = await axios.get(this.baseUrl, {
      params: { action, apiKey: this.apiKey, ...params },
    });
    return response.data;
  }

  async _post(action, data = {}, params = {}) {
    const response = await axios.post(
      this.baseUrl,
      new URLSearchParams(data).toString(),
      {
        params: { action, apiKey: this.apiKey, ...params },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return response.data;
  }

  // ---- Schema / bootstrap ----

  getUiSchema() {
    return this._get('getUiSchema');
  }

  getAccountSettings() {
    return this._get('getAccountSettings');
  }

  getExtensionPath(extensionId) {
    return this._get('getExtensionPath', { extensionId });
  }

  // ---- Tree ----

  foldersList() {
    return this._get('foldersList');
  }

  folderSettings(extensionId) {
    return this._get('folderSettings', { extensionId });
  }

  /**
   * Create (extensionId='NEW' + belowExtension) or update an extension.
   * settings is a flat object merged into settings[key]=value form fields.
   */
  extensionSet({ extensionId, belowExtension, type, name, extension, settings = {} }) {
    const data = { type };
    if (name !== undefined) data.name = name;
    if (extension !== undefined) data.extension = extension;
    if (belowExtension !== undefined) data.belowExtension = belowExtension;

    Object.entries(settings).forEach(([key, value]) => {
      data[`settings[${key}]`] = value;
    });

    return this._post('extensionSet', data, { extensionId: extensionId || 'NEW' });
  }

  folderDelete(extensionId) {
    return this._get('folderDelete', { extensionId });
  }

  /**
   * rules: array of { securityType, ...fields }, saved in order as S1, S2, ...
   */
  securitySet(extensionId, rules = []) {
    const data = {};
    rules.forEach((rule, i) => {
      const n = i + 1;
      Object.entries(rule).forEach(([key, value]) => {
        data[`S${n}[${key}]`] = value;
      });
    });
    return this._post('securitySet', data, { extensionId });
  }

  // ---- Files ----

  filesList(extensionId) {
    return this._get('filesList', { extensionId });
  }

  /**
   * Upload one audio file (<=10MB) to an extension.
   * fileBuffer: Buffer, fileName: string
   */
  async uploadFile(extensionId, fileBuffer, fileName, { name, checkDuplicate } = {}) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, fileName);
    if (name) form.append('name', name);
    if (checkDuplicate) form.append('checkDuplicate', checkDuplicate);

    const response = await axios.post(this.baseUrl, form, {
      params: { action: 'uploadFile', apiKey: this.apiKey, extensionId },
      headers: form.getHeaders(),
    });
    return response.data;
  }

  fileDelete(fileId, belowExtension) {
    return this._get('fileDelete', { fileId, belowExtension });
  }

  fileRename(fileId, newName, belowExtension) {
    return this._get('fileRename', { fileId, newName, belowExtension });
  }

  // ---- Dropdowns ----

  getOptions2(list) {
    return this._get('getOptions2', { list: Array.isArray(list) ? list.join(',') : list });
  }

  // ---- System messages ----

  systemMessagesList(extensionId) {
    return this._get('systemMessagesList', { extensionId });
  }

  async saveCustomMessagesBeta(code, extensionId, messages) {
    const response = await axios.post(
      this.baseUrl,
      { code, extensionId, messages },
      {
        params: { action: 'saveCustomMessagesBeta', apiKey: this.apiKey },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data;
  }
}

module.exports = new TechnolineIvrService();
