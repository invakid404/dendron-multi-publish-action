import * as childProcess from 'child_process';
import { ExecSyncOptions } from 'child_process';
import * as shlex from 'shlex';

export type CommandParts = string[];

export const buildCommand = (parts: CommandParts): string => {
  return parts.map((part) => shlex.quote(part)).join(' ');
};

export const splitCommand = (command: string): CommandParts => {
  return shlex.split(command);
};

export const runCommand = (
  parts: CommandParts,
  options?: ExecSyncOptions,
): string => {
  return childProcess.execSync(buildCommand(parts), options).toString();
};

export const runCommands = (
  commands: CommandParts[],
  options?: ExecSyncOptions,
): string[] => {
  return commands.map((command) => runCommand(command, options));
};
