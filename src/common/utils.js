import { openNewGitHubIssue, debugInfo, activeWindow, is } from 'electron-util';
import serializeError from 'serialize-error';
import cleanStack from 'clean-stack';
import * as ipc from 'electron-better-ipc';

if (is.renderer) {
  ipc.ipcRenderer.answerMain('get-state-report', async () => {
    const report = window.store.generateReport();
    return report;
  });
}

const getActiveState = async () => {
  if (is.renderer) {
    return window.store.generateReport();
  }
  const win = activeWindow();
  const report = await ipc.ipcMain.callRenderer(win, 'get-state-report');
  return report;
}

const serializeAndCleanError = (error) => {
  const err = serializeError(error);
  err.stack = cleanStack(error.stack);
  return err;
}

const stringifyToGithubMarkdown = (json) => `\`\`\`json
${JSON.stringify(json, null, '  ')}
\`\`\``;

const createReportBody = (error, activeState) => `Autogenerated report:
${stringifyToGithubMarkdown(serializeAndCleanError(error))}

Active state:
${stringifyToGithubMarkdown(activeState)}

---

Process: ${is.renderer ? 'renderer' : 'main'}
${debugInfo()}`;

export const reportIssue = async (error) => {
  const activeState = await getActiveState();
  openNewGitHubIssue({
    user: 'AntonelliLab',
    repo: 'raxmlGUI',
    title: error.name,
    body: createReportBody(error, activeState),
  });
}
