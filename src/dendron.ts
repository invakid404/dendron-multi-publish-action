import { VaultUtils } from '@dendronhq/common-all';
import crypto from 'crypto';
import * as glob from 'fast-glob';
import fs from 'fs';
import path from 'path';

import { CommandParts, runCommand, runCommands } from './commands';
import { DendronConfig } from './config';

export class Dendron {
  constructor(
    private readonly baseCommand: CommandParts,
    private readonly config: DendronConfig,
  ) {}

  initWorkspace(): string {
    return runCommand([...this.baseCommand, 'workspace', 'init']);
  }

  hashWorkspace(): string {
    const vaultHashes = this.config.workspace.vaults.flatMap((vault) => {
      const fsPath = VaultUtils.getRelPath(vault);
      const files = glob.sync(['assets/**', '*.md'], { cwd: fsPath });

      return files.map((file) => {
        const filePath = path.join(vault.fsPath, file);
        const fileData = fs.readFileSync(filePath, 'utf8');

        return crypto.createHash('sha256').update(fileData).digest('hex');
      });
    });

    vaultHashes.sort((a, b) => a.localeCompare(b));

    return crypto
      .createHash('sha256')
      .update(vaultHashes.join(''))
      .digest('hex');
  }

  initPublish(): string {
    if (fs.existsSync('.next/.git')) {
      return runCommands(
        [
          ['git', 'reset', '--hard'],
          ['git', 'clean', '-f'],
          ['git', 'pull'],
          ['yarn'],
        ],
        { cwd: '.next' },
      ).join('\n');
    }

    return runCommand([...this.baseCommand, 'publish', 'init']);
  }

  clearPublishCache = (): void => {
    if (fs.existsSync('.next/.next')) {
      fs.rmSync('.next/.next', { recursive: true, force: true });
    }
  };

  publish(): string {
    this.initPublish();
    this.clearPublishCache();

    return runCommand([
      ...this.baseCommand,
      'publish',
      'export',
      '--target',
      'github',
      '--yes',
    ]);
  }
}
