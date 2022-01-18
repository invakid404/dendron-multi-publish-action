import * as core from '@actions/core';
import { DendronConfig as DendronWorkspaceConfig } from '@dendronhq/common-all';
import { DendronConfig as DendronGlobalConfig } from '@dendronhq/common-all/lib/types/configs/dendronConfig';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
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

  core.info('Initializing workspace');

  const initCommand = [...dendronCommand, 'workspace', 'init']
    .map((arg) => shlex.quote(arg))
    .join(' ');

  childProcess.execSync(initCommand);
})();
