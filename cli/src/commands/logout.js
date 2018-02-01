// @flow

/* eslint-disable no-console */

import os from 'os';
import path from 'path';
import { green } from 'chalk';
import { utils } from 'ssh2-streams';
import untildify from 'untildify';
import {
  getPrivateKeyPath,
  getPrivateKeyPassphrase,
  sshConnect,
  sshExec,
} from '../util/ssh';
import { fileExists, readFile, unlink } from '../util/fs';
import { printErrors } from '../printErrors';

import typeof Yargs from 'yargs';
import type { BaseArgs } from '.';

export const command = 'logout';
export const description =
  'Invalidate the authentication token in $HOME/.lagoon-token and delete the file';

export function builder(yargs: Yargs) {
  return yargs.usage(`$0 ${command} - ${description}`).options({
    identity: {
      describe: 'Path to identity (private key)',
      type: 'string',
      alias: 'i',
    },
  });
}

type Args = BaseArgs & {
  argv: {
    identity: string,
  },
};

export async function handler({ clog, cerr, argv }: Args): Promise<number> {
  if (argv.identity != null && !await fileExists(argv.identity)) {
    return printErrors(cerr, 'File does not exist at identity option path!');
  }

  const homeDir = os.homedir();
  const defaultPrivateKeyPath = path.join(homeDir, '.ssh', 'id_rsa');
  const fileExistsAtDefaultPath = await fileExists(defaultPrivateKeyPath);

  const privateKeyPath = await getPrivateKeyPath({
    fileExistsAtDefaultPath,
    defaultPrivateKeyPath,
    identity: argv.identity,
    cerr,
  });

  const privateKey = await readFile(untildify(privateKeyPath));
  const passphrase = await getPrivateKeyPassphrase(utils.parseKey(privateKey).encryption);

  const connection = await sshConnect({
    host: process.env.SSH_HOST || 'auth.amazee.io',
    port: Number(process.env.SSH_PORT) || 2020,
    username: process.env.SSH_USER || 'api',
    privateKey,
    passphrase,
  });

  await sshExec(connection, 'logout');
  const tokenFilePath = path.join(homeDir, '.lagoon-token');
  if (await fileExists(tokenFilePath)) {
    await unlink(tokenFilePath);
  }

  clog(green('Logged out successfully.'));

  // Be responsible and close the connection after our transaction.
  connection.end();

  return 0;
}
