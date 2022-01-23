import { StrictConfigV4 } from '@dendronhq/common-all';
import fs from 'fs';
import * as yaml from 'js-yaml';

export type DendronParseConfigOptions = {
  ignorePrivate?: boolean;
};

export const parseConfig = (
  configPath: string,
  { ignorePrivate = false }: DendronParseConfigOptions = {},
): StrictConfigV4 => {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(configData) as StrictConfigV4;

  if (ignorePrivate) {
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

    fs.writeFileSync(configPath, yaml.dump(config));
  }

  return config;
};
