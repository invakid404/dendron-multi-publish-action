import * as cache from '@actions/cache';
import * as core from '@actions/core';

import { splitCommand } from './commands';
import { parseConfig } from './config';
import { Dendron } from './dendron';

(async (): Promise<void> => {
  const dendronConfigPath = core.getInput('dendron-config');
  const dendronCommand = splitCommand(core.getInput('dendron-cli-command'));
  const ignorePrivate = core.getBooleanInput('ignore-private');

  try {
    const dendronConfig = parseConfig(dendronConfigPath, { ignorePrivate });

    const dendron = new Dendron(dendronCommand, dendronConfig);

    core.info('Initializing workspace...');
    dendron.initWorkspace();

    const workspaceHash = dendron.hashWorkspace();
    core.info(`Workspace hash: ${workspaceHash}`);

    const cacheKey = await cache.restoreCache(
      ['docs/'],
      `dendron-multi-publish-${workspaceHash}`,
    );

    if (cacheKey) {
      core.info('Workspace already published, skipping publish');
      core.setOutput('was-published', false);

      return;
    }

    core.info('Published notes not found in cache, publishing ...');

    dendron.publish();

    core.info('Caching published docs...');

    await cache.saveCache(['docs/'], `dendron-multi-publish-${workspaceHash}`);

    core.setOutput('was-published', true);
  } catch (error) {
    core.setFailed(error as Error);
  }
})();
