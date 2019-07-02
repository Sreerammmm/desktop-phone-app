const {
  default: installExtension,
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS
} = require('electron-devtools-installer');

const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');

const path = require('path');
const isDev = require('electron-is-dev');
const storage = require('electron-json-storage');

let mainWindow;
let authWindow;
let code;

function isEmpty(ob) {
  for (const i in ob) {
    return false;
  }
  return true;
}

const createWindow = () => {
  console.log('Creating main window');
  mainWindow = new BrowserWindow({
    backgroundColor: '#F7F7F7',
    minWidth: 880,
    // show: false,
    // titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true
    },
    height: 600,
    width: 1024
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    installExtension(REACT_DEVELOPER_TOOLS)
      .then(name => {
        console.log(`Added Extension: ${name}`);
      })
      .catch(err => {
        console.log('An error occurred: ', err);
      });

    installExtension(REDUX_DEVTOOLS)
      .then(name => {
        console.log(`Added Extension: ${name}`);
      })
      .catch(err => {
        console.log('An error occurred: ', err);
      });
  }

  mainWindow.once('ready-to-show', () => {
    console.log('Showing main window');
    mainWindow.show();

    ipcMain.on('open-external-window', (event, arg) => {
      shell.openExternal(arg);
    });
  });
};

/**
 *
 * @param url
 */
function handleCallback(url) {
  console.log('Handling callback...');
  const rawCode = /code=([^&]*)/.exec(url) || null;
  code = rawCode && rawCode.length > 1 ? rawCode[1] : null;
  const error = /\?error=(.+)$/.exec(url);
  console.log(url);

  // If there is a code, proceed to get token from github
  if (code) {
    console.log('code');
    console.log(code);

    createWindow();
    authWindow.destroy();
  } else if (error) {
    alert(
      "Oops! Something went wrong and we couldn't " +
        'log you in using Github. Please try again.'
    );
  }
}

const handleAuthClosedEvent = () => {
  // Dereference the authWindowdow object, usually you would store authWindowdows
  // in an array if your app supports multi authWindowdows, this is the time
  // when you should delete the corresponding element.
  authWindow = null;
};

const handleAuthDidNavigateEvent = (event, url) => {
  console.log(url);
  handleCallback(url);
};

const handleAuthDidFinishLoad = () => {
  console.log('Did finish load');
  if (mainWindow) {
    mainWindow.destroy();
  }
};

function createAuthWindow() {
  // Create the browser authWindowdow.
  authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false
    }
  });

  const oauthUrl = `https://webrtc-auth.web.cern.ch`;

  authWindow.loadURL(oauthUrl);

  // Emitted when the authWindowdow is closed.
  authWindow.on('closed', handleAuthClosedEvent);
  authWindow.webContents.on('did-navigate', handleAuthDidNavigateEvent);
  authWindow.webContents.once('did-finish-load', handleAuthDidFinishLoad);
}

const handleAppCertificateError = (
  event,
  webContents,
  url,
  error,
  certificate,
  callback
) => {
  if (isDev) {
    process.stdout.write(`Preventing certificate error: ${url}\n`);
    event.preventDefault();
    callback(true);
  }
};

const handleAppReady = () => {
  storage.get('is_authenticated', (error, data) => {
    if (error) throw error;
    console.log(data);

    if (isEmpty(data)) {
      console.log('empty dict');
    }

    if (!isEmpty(data) && data.authenticated === true) {
      code = data;
      createWindow();
    } else {
      createAuthWindow();
    }
  });
};

const appHandleAllWindowsClosed = () => {
  app.quit();
};
const appHandleActivate = () => {
  if (mainWindow === null) {
    createWindow();
  }
};

/**
 * App events
 */
app.on('certificate-error', handleAppCertificateError);
app.on('ready', handleAppReady);
app.on('window-all-closed', appHandleAllWindowsClosed);
app.on('activate', appHandleActivate);

const appHandleLoadPage = (event, arg) => {
  mainWindow.loadURL(arg);
};

const ipcHandleSyncMessages = (event, arg) => {
  console.log(`Syncrhonous message received: ${arg}`); // prints "ping"

  if (arg === 'code') {
    console.log(code);
    event.returnValue = code;
    return;
  }

  if (arg === 'user-unauthenticated') {
    event.returnValue = 'ok';
    storage.set('is_authenticated', {}, error => {
      if (error) {
        console.log(`Error is_authenticated: ${error}`);
      }

      if (!authWindow) {
        createAuthWindow();
      }

      if (mainWindow) {
        mainWindow.destroy();
      }
    });
    return;
  }

  if (arg === 'user-authenticated') {
    event.returnValue = 'ok';
    storage.set('is_authenticated', { authenticated: true }, error => {});
  }
};

/**
 * Ipc events
 */
ipcMain.on('load-page', appHandleLoadPage);

ipcMain.on('synchronous-message', ipcHandleSyncMessages);