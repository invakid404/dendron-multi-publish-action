import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {
  DendronConfig as DendronWorkspaceConfig,
  VaultUtils,
} from '@dendronhq/common-all';
import { DendronConfig as DendronGlobalConfig } from '@dendronhq/common-all/lib/types/configs/dendronConfig';
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as shlex from 'shlex';

type DendronConfig = DendronWorkspaceConfig & DendronGlobalConfig;

const configName = 'dendron.yml';

const doIgnorePrivate = (config: DendronConfig): void => {
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

  fs.writeFileSync(configName, yaml.dump(config));
};

(async (): Promise<void> => {
  const dendronCommand = shlex.split(core.getInput('dendron-cli-command'));
  const ignorePrivate = core.getBooleanInput('ignore-private');

  const dendronConfigData = fs.readFileSync(configName, 'utf8');
  const dendronConfig = yaml.load(dendronConfigData) as DendronConfig;

  if (ignorePrivate) {
    doIgnorePrivate(dendronConfig);
  }

  core.info('Initializing workspace ...');

  const initCommand = [...dendronCommand, 'workspace', 'init']
    .map((arg) => shlex.quote(arg))
    .join(' ');

  childProcess.execSync(initCommand);

  const vaults = [
    ...(dendronConfig.vaults ?? []),
    ...(dendronConfig.workspace?.vaults ?? []),
  ];

  const markdownFileHashes = vaults.flatMap((vault) => {
    const fsPath = VaultUtils.getRelPath(vault);

    const files = fs.readdirSync(fsPath);
    const markdownFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === '.md',
    );

    return markdownFiles.map((file) => {
      const filePath = path.join(vault.fsPath, file);
      const fileData = fs.readFileSync(filePath, 'utf8');

      return crypto.createHash('sha256').update(fileData).digest('hex');
    });
  });

  markdownFileHashes.sort((a, b) => a.localeCompare(b));

  const workspaceHash = crypto
    .createHash('sha256')
    .update(markdownFileHashes.join(''))
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
