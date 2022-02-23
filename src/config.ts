import { DendronConfig as DendronConfigV2 } from '@dendronhq/common-all/lib/types/configs/dendronConfig';
import { DendronConfig as DendronConfigV1 } from '@dendronhq/common-all/lib/types/workspace';
import fs from 'fs';
import * as yaml from 'js-yaml';

export type DendronConfig = DendronConfigV1 & DendronConfigV2;

export type DendronParseConfigOptions = {
  ignorePrivate?: boolean;
};

export const parseConfig = (
  configPath: string,
  { ignorePrivate = false }: DendronParseConfigOptions = {},
): DendronConfig => {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(configData) as DendronConfig;

  if (ignorePrivate) {
    config.workspace.vaults = config.workspace.vaults.filter(
      ({ visibility }) => visibility !== 'private',
    );

    const nameSet = new Set(config.workspace.vaults.map(({ name }) => name));

    (['site', 'publishing'] as const).forEach((key) => {
      const duplicateNoteBehavior = config[key]?.duplicateNoteBehavior;
      if (
        duplicateNoteBehavior &&
        Array.isArray(duplicateNoteBehavior.payload)
      ) {
        duplicateNoteBehavior.payload = duplicateNoteBehavior.payload.filter(
          (name) => nameSet.has(name),
        );
      }
    });

    fs.writeFileSync(configPath, yaml.dump(config));
  }

  return config;
};
