import * as core from '@actions/core';

(async (): Promise<void> => {
  const ignorePrivate = core.getBooleanInput('ignorePrivate');
  core.info(`Ignore private: ${ignorePrivate}`);
})();
