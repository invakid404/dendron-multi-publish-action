import * as core from '@actions/core';

(async (): Promise<void> => {
  const ignorePrivate = core.getBooleanInput('ignore-private');
  core.info(`Ignore private: ${ignorePrivate}`);
})();
