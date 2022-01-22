import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { configIsV4, StrictConfigV4, VaultUtils } from '@dendronhq/common-all';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as glob from 'fast-glob';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as shlex from 'shlex';

const doIgnorePrivate = (config: StrictConfigV4): void => {
  config.workspace.vaults = config.workspace.vaults.filter(
    ({ visibility }) => visibility !== 'private',
  );

  if (
    config.site.duplicateNoteBehavior &&
    Array.isArray(config.site.duplicateNoteBehavior.payload)
  ) {
    const nameSet = new Set(config.workspace.vaults.map(({ name }) => name));

    config.site.duplicateNoteBehavior.payload =
      config.site.duplicateNoteBehavior.payload.filter((name) =>
        nameSet.has(name),
      );
  }
};

(async (): Promise<void> => {
  const dendronConfigPath = core.getInput('dendron-config');
  const dendronCommand = shlex.split(core.getInput('dendron-cli-command'));
  const ignorePrivate = core.getBooleanInput('ignore-private');

  const dendronConfigData = fs.readFileSync(dendronConfigPath, 'utf8');
  const dendronConfig = yaml.load(dendronConfigData) as StrictConfigV4;

  if (!configIsV4(dendronConfig)) {
    core.setFailed('This action only supports v4 configs!');

    return;
  }

  if (ignorePrivate) {
    doIgnorePrivate(dendronConfig);

    fs.writeFileSync(dendronConfigPath, yaml.dump(dendronConfig));
  }

  core.info('Initializing workspace ...');

  const initCommand = [...dendronCommand, 'workspace', 'init']
    .map((arg) => shlex.quote(arg))
    .join(' ');

  childProcess.execSync(initCommand);

  const vaultHashes = dendronConfig.workspace.vaults.flatMap((vault) => {
    const fsPath = VaultUtils.getRelPath(vault);
    const files = glob.sync(['assets/**', '*.md'], { cwd: fsPath });

    return files.map((file) => {
      const filePath = path.join(vault.fsPath, file);
      const fileData = fs.readFileSync(filePath, 'utf8');

      return crypto.createHash('sha256').update(fileData).digest('hex');
    });
  });

  vaultHashes.sort((a, b) => a.localeCompare(b));

  const workspaceHash = crypto
    .createHash('sha256')
    .update(vaultHashes.join(''))
    .digest('hex');

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

  if (fs.existsSync('.next/.git')) {
    core.info('Updating dendron .next ...');

    childProcess.execSync('git reset --hard', {
      cwd: '.next',
    });

    childProcess.execSync('git clean -f', {
      cwd: '.next',
    });

    childProcess.execSync('git pull', {
      cwd: '.next',
    });

    childProcess.execSync('yarn', {
      cwd: '.next',
    });
  } else {
    core.info('Initializing dendron .next ...');

    const initNextCommand = [...dendronCommand, 'publish', 'init']
      .map((arg) => shlex.quote(arg))
      .join(' ');

    childProcess.execSync(initNextCommand);
  }

  if (fs.existsSync('.next/.next')) {
    core.info('Purging next cache ...');

    fs.rmSync('.next/.next', { recursive: true, force: true });
  }

  core.info('Exporting notes ...');

  const exportCommand = [
    ...dendronCommand,
    'publish',
    'export',
    '--target',
    'github',
    '--yes',
  ]
    .map((arg) => shlex.quote(arg))
    .join(' ');

  childProcess.execSync(exportCommand);

  core.info('Caching published docs ...');

  await cache.saveCache(['docs/'], `dendron-multi-publish-${workspaceHash}`);

  core.setOutput('was-published', true);
})();
