import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import * as db from './database';

// File watcher state
const folderWatchers = new Map<string, fs.FSWatcher>();
const watchedBaseFolders = new Map<string, string>();
const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];

function findFfmpegPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe'),
    'ffmpeg'
  ];

  for (const ffmpegPath of possiblePaths) {
    if (fs.existsSync(ffmpegPath)) {
      console.log('Found FFmpeg at:', ffmpegPath);
      return ffmpegPath;
    }
  }

  console.warn('FFmpeg not found in expected locations, using system PATH');
  return 'ffmpeg';
}

function findFfprobePath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../node_modules/@ffprobe-installer/win32-x64/ffprobe.exe'),
    path.join(process.cwd(), 'node_modules/@ffprobe-installer/win32-x64/ffprobe.exe'),
    'ffprobe'
  ];

  for (const ffprobePath of possiblePaths) {
    if (fs.existsSync(ffprobePath)) {
      console.log('Found FFprobe at:', ffprobePath);
      return ffprobePath;
    }
  }

  console.warn('FFprobe not found in expected locations, using system PATH');
  return 'ffprobe';
}

// Ensure proper taskbar grouping & notifications on Windows.
app.setAppUserModelId('com.clipfolio.app');

// Prefer installer-provided binaries; fix .asar paths when packaged.
// Fallback to original finders in dev or if the installers are missing.
function fixAsarPath(p?: string) {
  return p ? p.replace('app.asar', 'app.asar.unpacked') : p;
}
const installerFfmpegPath = fixAsarPath((ffmpegInstaller as any)?.path);
const installerFfprobePath = fixAsarPath((ffprobeInstaller as any)?.path);

ffmpeg.setFfmpegPath(installerFfmpegPath || findFfmpegPath());
ffmpeg.setFfprobePath(installerFfprobePath || findFfprobePath());

let mainWindow: BrowserWindow | null = null;

// Track active export commands per renderer to allow cancellation
const activeExports = new Map<number, ffmpeg.FfmpegCommand>();
const canceledExports = new Set<number>();

// Register the protocol as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: false,
      stream: true,
      corsEnabled: true
    }
  }
]);

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/icon.ico');
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 740,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: iconPath
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdate() {
  if (!app.isPackaged) return; // only check when packaged

  autoUpdater.logger = log;
  // @ts-ignore
  autoUpdater.logger.transports.file.level = 'info';


  autoUpdater.allowPrerelease = /\bbeta\b/i.test(app.getVersion());

  autoUpdater.on('checking-for-update', () => log.info('Checking for update…'));
  autoUpdater.on('update-available', (info) => log.info('Update available', info));
  autoUpdater.on('update-not-available', () => log.info('No update available'));
  autoUpdater.on('error', (err) => log.error('AutoUpdate error', err));
  autoUpdater.on('download-progress', (p) => log.info(`Download ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded', async () => {
    const res = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      message: 'An update is ready to install.',
      detail: 'Restart the app to apply it.'
    });
    if (res.response === 0) autoUpdater.quitAndInstall();
  });

  // Kick off a check shortly after the UI is ready
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 2000);
}

app.whenReady().then(() => {
  if (process.env.NODE_ENV !== 'production') {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }
  const iconPath = path.join(__dirname, '../assets/icon.ico');
  if (fs.existsSync(iconPath)) {
    app.dock?.setIcon(iconPath);
    console.log('Application icon set from:', iconPath);
  } else {
    console.warn('Icon file not found at:', iconPath);
  }

  // Register custom protocol for serving local files securely
  protocol.handle('local', (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (filePath.startsWith('/')) filePath = filePath.substring(1);
      const normalizedPath = path.normalize(filePath.replace(/\//g, path.sep));

      console.log('[local protocol] Request:', request.url);
      const requestHeaders: { [key: string]: string } = {};
      request.headers.forEach((value, key) => { requestHeaders[key] = value; });
      console.log('[local protocol] Request headers:', requestHeaders);

      const tmpDir = path.normalize(os.tmpdir());
      let isAllowed = normalizedPath.startsWith(tmpDir);

      if (!isAllowed) {
        for (const [watchedFolder] of watchedBaseFolders) {
          const normalizedWatched = path.normalize(watchedFolder);
          if (normalizedPath.startsWith(normalizedWatched)) {
            isAllowed = true;
            break;
          }
        }
      }

      if (!isAllowed) {
        console.error('[local protocol] Rejected access to:', normalizedPath);
        return new Response('Access denied', { status: 403, headers: { 'content-type': 'text/plain' } });
      }

      if (!fs.existsSync(normalizedPath)) {
        console.error('[local protocol] File not found:', normalizedPath);
        return new Response('File not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }

      const ext = path.extname(normalizedPath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.flv': 'video/x-flv', '.wmv': 'video/x-ms-wmv',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      const stat = fs.statSync(normalizedPath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        const buffer = Buffer.alloc(chunkSize);
        const fd = fs.openSync(normalizedPath, 'r');
        fs.readSync(fd, buffer, 0, chunkSize, start);
        fs.closeSync(fd);

        const headers = new Headers({
          'content-type': mimeType,
          'content-length': String(chunkSize),
          'content-range': `bytes ${start}-${end}/${fileSize}`,
          'accept-ranges': 'bytes',
          'cache-control': 'no-cache',
          'access-control-allow-origin': '*'
        });
        return new Response(buffer, { status: 206, headers });
      }

      const chunkSize = Math.min(1024 * 1024, fileSize);
      const buffer = Buffer.alloc(chunkSize);
      const fd = fs.openSync(normalizedPath, 'r');
      fs.readSync(fd, buffer, 0, chunkSize, 0);
      fs.closeSync(fd);

      const headers = new Headers({
        'content-type': mimeType,
        'content-length': String(chunkSize),
        'content-range': `bytes 0-${chunkSize - 1}/${fileSize}`,
        'accept-ranges': 'bytes',
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*'
      });
      return new Response(buffer, { status: 206, headers });
    } catch (error) {
      console.error('[local protocol] Error:', error);
      return new Response('Internal server error', { status: 500, headers: { 'content-type': 'text/plain' } });
    }
  });

  db.initDatabase();
  createWindow();

  setupAutoUpdate();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('updater:check-now', async () => {
  if (!app.isPackaged) return { ok: false, reason: 'dev' };
  await autoUpdater.checkForUpdates();
  return { ok: true };
});


ipcMain.handle('win:minimize', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) win.minimize();
});

ipcMain.handle('win:maximize', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('win:close', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) win.close();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('select-save-location', async (event, defaultPath: string, filters?: Array<{ name: string; extensions: string[] }>) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: filters && filters.length > 0 ? filters : [
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
    ]
  });

  return result;
});

ipcMain.handle('scan-videos', async (event, folderPath: string) => {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
  const videos: any[] = [];

  function scanDirectory(dirPath: string) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (videoExtensions.includes(ext)) {
          // Calculate relative path from root folder
          const relativePath = path.relative(folderPath, fullPath);
          const folderName = path.dirname(relativePath);

          videos.push({
            name: file,
            path: fullPath,
            size: stat.size,
            created: stat.birthtime,
            modified: stat.mtime,
            relativePath: relativePath,
            folderPath: folderName === '.' ? '' : folderName
          });
        }
      }
    }
  }

  try {
    scanDirectory(folderPath);
    return videos;
  } catch (error) {
    console.error('Error scanning videos:', error);
    return [];
  }
});

ipcMain.handle('get-video-metadata', async (event, videoPath: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
});

// Cached metadata (ffprobe) keyed by path + mtime + size
const metaTasks = new Map<string, Promise<any>>();
function computeMetaCachePath(videoPath: string): string {
  try {
    const stat = fs.statSync(videoPath);
    const hash = crypto
      .createHash('sha1')
      .update(videoPath)
      .update(String(stat.mtimeMs))
      .update(String(stat.size))
      .digest('hex')
      .slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(os.tmpdir(), 'clipfolio-meta', `${base}-${hash}.json`);
  } catch {
    const hash = crypto.createHash('sha1').update(videoPath).digest('hex').slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(os.tmpdir(), 'clipfolio-meta', `${base}-${hash}.json`);
  }
}

const metadataMemoryCache = new Map<string, any>();

ipcMain.handle('get-cached-metadata', async (event, videoPath: string) => {
  // Check in-memory cache first
  if (metadataMemoryCache.has(videoPath)) {
    return metadataMemoryCache.get(videoPath);
  }

  const cachePath = computeMetaCachePath(videoPath);

  try {
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, 'utf8');
      const metadata = JSON.parse(raw);
      // Store in memory for next time
      metadataMemoryCache.set(videoPath, metadata);
      return metadata;
    }
  } catch (e) {
    console.error('[Metadata Cache] Error reading cache:', e);
  }

  // Check if already being fetched
  let p = metaTasks.get(cachePath);
  if (!p) {
    p = new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          try {
            const dir = path.dirname(cachePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(cachePath, JSON.stringify(metadata));
            // Store in memory cache
            metadataMemoryCache.set(videoPath, metadata);
          } catch (e) {
            console.error('[Metadata Cache] Error writing cache:', e);
          }
          resolve(metadata);
        }
      });
    }).finally(() => {
      try { metaTasks.delete(cachePath); } catch {}
    });
    metaTasks.set(cachePath, p);
  }
  return await p;
});

ipcMain.handle('generate-thumbnail', async (event, videoPath: string, outputPath: string, timestampSeconds?: number) => {
  return new Promise((resolve, reject) => {
    const screenshotsOpts: any = {
      filename: path.basename(outputPath),
      folder: path.dirname(outputPath),
      size: '960x540'
    };
    if (typeof timestampSeconds === 'number' && !Number.isNaN(timestampSeconds)) {
      screenshotsOpts.timestamps = [timestampSeconds];
    } else {
      screenshotsOpts.timestamps = ['10%'];
    }
    ffmpeg(videoPath)
      .screenshots(screenshotsOpts)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err));
  });
});

const thumbTasks = new Map<string, Promise<string>>();
function getThumbCacheDir(): string {
  const dir = path.join(os.tmpdir(), 'clipfolio-thumbs');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function computeCachedThumbPath(videoPath: string): string {
  try {
    const stat = fs.statSync(videoPath);
    const hash = crypto
      .createHash('sha1')
      .update(videoPath)
      .update(String(stat.mtimeMs))
      .update(String(stat.size))
      .digest('hex')
      .slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(getThumbCacheDir(), `${base}-${hash}.jpg`);
  } catch {
    const hash = crypto.createHash('sha1').update(videoPath).digest('hex').slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(getThumbCacheDir(), `${base}-${hash}.jpg`);
  }
}

ipcMain.handle('get-cached-thumbnail', async (event, videoPath: string) => {
  const outPath = computeCachedThumbPath(videoPath);
  try {
    if (fs.existsSync(outPath)) {
      return outPath;
    }
  } catch {}

  let task = thumbTasks.get(outPath);
  if (!task) {
    task = new Promise<string>((resolve, reject) => {
      try {
        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch {}
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(outPath),
          folder: path.dirname(outPath),
          size: '960x540'
        })
        .on('end', () => resolve(outPath))
        .on('error', (err) => reject(err));
    })
      .finally(() => {
        try { thumbTasks.delete(outPath); } catch {}
      });
    thumbTasks.set(outPath, task);
  }
  return await task;
});

ipcMain.handle('extract-audio-tracks', async (event, videoPath: string, outputDir: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // First, get metadata to know how many audio tracks there are
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err);
          reject(err);
          return;
        }

        const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');

        if (audioStreams.length === 0) {
          resolve([]);
          return;
        }

        const extractedFiles: string[] = new Array(audioStreams.length);
        let completed = 0;
        let hasError = false;

        // Extract each audio track separately
        audioStreams.forEach((stream, index) => {
          const outputFile = path.join(outputDir, `audio_track_${index}.wav`);


          ffmpeg(videoPath)
            .outputOptions([
              `-map 0:a:${index}`,  // Select specific audio track
              '-acodec pcm_s16le',  // Convert to WAV for Web Audio API
              '-ar 48000',          // Sample rate
              '-ac 2'               // Stereo
            ])
            .output(outputFile)
            .on('start', (cmd) => {
            })
            .on('end', () => {
              extractedFiles[index] = outputFile;
              completed++;

              if (completed === audioStreams.length && !hasError) {
                resolve(extractedFiles);
              }
            })
            .on('error', (err, stdout, stderr) => {
              if (!hasError) {
                hasError = true;
                console.error(`Error extracting audio track ${index}:`, err.message);
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`Failed to extract audio track ${index}: ${err.message}`));
              }
            })
            .run();
        });
      });
    } catch (error) {
      console.error('Extract audio tracks error:', error);
      reject(error);
    }
  });
});

const audioExtractTasks = new Map<string, Promise<string[]>>();
function computeAudioCacheDir(videoPath: string): string {
  try {
    const stat = fs.statSync(videoPath);
    const hash = crypto
      .createHash('sha1')
      .update(videoPath)
      .update(String(stat.mtimeMs))
      .update(String(stat.size))
      .digest('hex')
      .slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(os.tmpdir(), 'clipfolio-audio', `${base}-${hash}`);
  } catch {
    const hash = crypto.createHash('sha1').update(videoPath).digest('hex').slice(0, 16);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(os.tmpdir(), 'clipfolio-audio', `${base}-${hash}`);
  }
}

ipcMain.handle('get-cached-extracted-audio', async (event, videoPath: string, forceRefresh: boolean = false) => {
  const cacheDir = computeAudioCacheDir(videoPath);
  const ensureDir = () => {
    try {
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    } catch {}
  };

  const checkExisting = (expected: number): string[] | null => {
    try {
      const files = Array.from({ length: expected }, (_, i) => path.join(cacheDir, `audio_track_${i}.wav`));
      for (const f of files) {
        if (!fs.existsSync(f)) return null;
        const s = fs.statSync(f);
        if (!s.isFile() || s.size <= 0) return null;
      }
      return files;
    } catch {
      return null;
    }
  };

  const cleanupCache = () => {
    try {
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(cacheDir, file));
          } catch (e) {
            console.warn('[Audio Extract] Failed to delete cache file:', file, e);
          }
        }
      }
    } catch (e) {
      console.warn('[Audio Extract] Failed to cleanup cache dir:', e);
    }
  };

  if (forceRefresh) {
    console.log('[Audio Extract] Force refresh requested, cleaning cache');
    cleanupCache();
    audioExtractTasks.delete(cacheDir);
  }

  let task = audioExtractTasks.get(cacheDir);
  if (task) return await task;

  task = new Promise<string[]>((resolve, reject) => {
    try {
      ensureDir();
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStreams = (metadata.streams || []).filter((s: any) => s.codec_type === 'audio');
        const expected = audioStreams.length;
        if (expected <= 0) {
          resolve([]);
          return;
        }

        const existing = checkExisting(expected);
        if (existing && !forceRefresh) {
          resolve(existing);
          return;
        }

        // Clean up any corrupted cache files before extraction
        console.log('[Audio Extract] Cleaning up cache before extraction');
        cleanupCache();
        ensureDir();

        const outputs: string[] = Array.from({ length: expected }, (_, i) => path.join(cacheDir, `audio_track_${i}.wav`));

        let completed = 0;
        let hasError = false;

        audioStreams.forEach((stream, index) => {
          const outputFile = outputs[index];

          const cmd = ffmpeg(videoPath)
            .outputOptions([
              `-map 0:a:${index}`,
              '-acodec pcm_s16le',
              '-ar 48000',
              '-ac 2'
            ])
            .output(outputFile);

          let trackResolved = false;
          const timeout = setTimeout(() => {
            if (!trackResolved) {
              console.error(`[Audio Extract] Timeout on track ${index}`);
              cmd.kill('SIGKILL');
            }
          }, 30000);

          cmd
            .on('start', (commandLine) => {
              console.log(`[Audio Extract] Starting track ${index}:`, commandLine);
            })
            .on('end', () => {
              trackResolved = true;
              clearTimeout(timeout);
              completed++;
              console.log(`[Audio Extract] Completed track ${index} (${completed}/${expected})`);

              if (completed === expected && !hasError) {
                const allValid = outputs.every(f => {
                  try {
                    return fs.existsSync(f) && fs.statSync(f).size > 0;
                  } catch {
                    return false;
                  }
                });

                if (allValid) {
                  console.log('[Audio Extract] All tracks extracted successfully');
                  resolve(outputs);
                } else {
                  console.error('[Audio Extract] Some output files are invalid');
                  cleanupCache();
                  reject(new Error('Audio extraction produced invalid files'));
                }
              }
            })
            .on('error', (e, stdout, stderr) => {
              trackResolved = true;
              clearTimeout(timeout);

              if (!hasError) {
                hasError = true;
                console.error(`[Audio Extract] Failed on track ${index}:`, e.message);
                console.error('[Audio Extract] FFmpeg stderr:', stderr);
                cleanupCache();
                reject(new Error(`Audio extraction failed on track ${index}: ${e.message}`));
              }
            })
            .run();
        });
      });
    } catch (e) {
      cleanupCache();
      reject(e);
    }
  }).finally(() => {
    try { audioExtractTasks.delete(cacheDir); } catch {}
  });

  audioExtractTasks.set(cacheDir, task);
  return await task;
});

ipcMain.handle('generate-timeline-thumbnails', async (event, videoPath: string, outputDir: string, count: number = 10) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata.format.duration || 0;
      const interval = duration / count;
      const timestamps = Array.from({ length: count }, (_, i) => i * interval);

      const thumbnails: string[] = [];

      ffmpeg(videoPath)
        .on('filenames', (filenames) => {
          thumbnails.push(...filenames.map(f => path.join(outputDir, f)));
        })
        .on('end', () => resolve(thumbnails))
        .on('error', (err) => reject(err))
        .screenshots({
          timestamps,
          folder: outputDir,
          filename: 'thumb-%i.png',
          size: '160x90'
        });
    });
  });
});

ipcMain.handle('export-video', async (
  event,
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  quality: 'full' | 'compressed',
  audioTracks?: { index: number; volume: number }[],
  targetSizeMB?: number,
  jobId?: string,
  audioMode?: 'combine' | 'separate',
  outputType?: 'video' | 'mp3'
) => {
  const duration = endTime - startTime;
  const meta: any = await new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => resolve(data || { format: {}, streams: [] }));
  });
  const audioStreams = (meta.streams || []).filter((s: any) => s.codec_type === 'audio');
  const numAudioStreams = audioStreams.length;
  const getVolumeForIndex = (idx: number): number => {
    const found = (audioTracks || []).find(t => t.index === idx);
    return found ? (typeof found.volume === 'number' ? found.volume : 1.0) : 1.0;
  };

  const buildFilterAndMaps = (mode: 'combine' | 'separate', type: 'video' | 'mp3') => {
    const filterParts: string[] = [];
    const mapOptions: string[] = [];

    const useCombine = type === 'mp3' ? true : (mode === 'combine');

    if (type === 'video') {
      mapOptions.push('-map', '0:v:0');
    } else {
      mapOptions.push('-vn');
    }

    if (numAudioStreams <= 0) {
      return { filterParts, mapOptions };
    }

    if (useCombine) {
      const inputLabels: string[] = [];
      for (let i = 0; i < numAudioStreams; i++) {
        const vol = getVolumeForIndex(i);
        if (Math.abs(vol - 1.0) > 1e-6) {
          filterParts.push(`[0:a:${i}]volume=${vol}[a${i}]`);
          inputLabels.push(`[a${i}]`);
        } else {
          inputLabels.push(`[0:a:${i}]`);
        }
      }
      if (inputLabels.length === 1 && inputLabels[0] === '[0:a:0]') {
        mapOptions.push('-map', '0:a:0');
      } else {
        filterParts.push(`${inputLabels.join('')}amix=inputs=${inputLabels.length}:duration=longest[aout]`);
        mapOptions.push('-map', '[aout]');
      }
    } else {
      for (let i = 0; i < numAudioStreams; i++) {
        const vol = getVolumeForIndex(i);
        if (Math.abs(vol - 1.0) > 1e-6) {
          filterParts.push(`[0:a:${i}]volume=${vol}[a${i}]`);
          mapOptions.push('-map', `[a${i}]`);
        } else {
          mapOptions.push('-map', `0:a:${i}`);
        }
      }
    }

    return { filterParts, mapOptions };
  };

  const encodeOnce = (videoBitrateKbps?: number) => {
    return new Promise<string | { status: 'canceled' }>((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration);

      const type: 'video' | 'mp3' = outputType === 'mp3' ? 'mp3' : 'video';

      if (type === 'mp3') {
        command = command
          .audioCodec('libmp3lame')
          .outputOptions(['-y', '-b:a 192k']);
      } else if (quality === 'compressed') {
        const audioBitrateKbps = 128;
        if (!videoBitrateKbps) {
          videoBitrateKbps = 800;
        }
        command = command
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-y',
            '-preset fast',
            `-b:v ${videoBitrateKbps}k`,
            `-maxrate ${Math.max(100, Math.floor(videoBitrateKbps * 1.05))}k`,
            `-bufsize ${Math.max(200, Math.floor(videoBitrateKbps * 2))}k`,
            `-b:a ${audioBitrateKbps}k`,
            '-movflags +faststart'
          ]);
      } else {
        command = command
          .outputOptions(['-c:v copy'])
          .audioCodec('aac')
          .outputOptions(['-movflags +faststart']);
      }

      const { filterParts, mapOptions } = buildFilterAndMaps(audioMode || 'combine', type);
      if (filterParts.length > 0) {
        command = command.complexFilter(filterParts.join(';'));
      }
      if (mapOptions.length > 0) {
        command = command.outputOptions(mapOptions);
      }

      command
        .output(outputPath)
        .on('progress', (progress) => {
          if (mainWindow) {
            try {
              mainWindow.webContents.send('export-progress', { ...progress, jobId });
            } catch {}
          }
        })
        .on('start', () => {
          try {
            activeExports.set(event.sender.id, command);
          } catch {}
        })
        .on('end', () => {
          try { activeExports.delete(event.sender.id); } catch {}
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          const senderId = event.sender.id;
          const msg = (err && err.message) ? err.message : 'Unknown error';
          const wasCanceled = canceledExports.has(senderId) || /kill|SIGKILL|terminated|canceled/i.test(msg);
          try { activeExports.delete(senderId); } catch {}
          if (wasCanceled) {
            try { canceledExports.delete(senderId); } catch {}
            resolve({ status: 'canceled' });
          } else {
            console.error('Export error:', err);
            console.error('FFmpeg stderr:', stderr);
            reject(new Error(`Export failed: ${msg}\n${stderr}`));
          }
        })
        .run();
    });
  };

  if (outputType === 'mp3' || quality !== 'compressed') {
    return await encodeOnce();
  }

  // Compressed with size target: compute conservative bitrate and retry if overshoot
  const targetMB = targetSizeMB || 10;
  const targetBytes = targetMB * 1024 * 1024;
  const safetyRatio = 0.92; // aim under target
  const audioBitrateKbps = 128; // estimate audio bitrate (combined)
  const targetBits = Math.max(1, Math.floor(targetBytes * safetyRatio * 8));
  let videoBitrateKbps = Math.max(100, Math.floor(targetBits / duration / 1000) - audioBitrateKbps);

  // First encode
  const firstResult = await encodeOnce(videoBitrateKbps);
  if (typeof firstResult === 'object' && (firstResult as any).status === 'canceled') {
    return firstResult;
  }

  try {
    let size = fs.statSync(outputPath).size;
    let attempts = 0;
    while (size > targetBytes && attempts < 2) {
      // Reduce bitrate and retry
      attempts++;
      videoBitrateKbps = Math.max(100, Math.floor(videoBitrateKbps * 0.85));
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch {}
      const retryResult = await encodeOnce(videoBitrateKbps);
      if (typeof retryResult === 'object' && (retryResult as any).status === 'canceled') {
        return retryResult;
      }
      size = fs.statSync(outputPath).size;
    }
  } catch (err) {
    console.warn('Could not validate/adjust output size:', err);
  }

  return outputPath;
});

ipcMain.handle('cancel-export', async (event) => {
  const senderId = event.sender.id;
  const cmd = activeExports.get(senderId);
  if (cmd) {
    try {
      canceledExports.add(senderId);
      cmd.kill('SIGKILL');
    } catch {}
    try {
      activeExports.delete(senderId);
    } catch {}
  }
  return true;
});

ipcMain.handle('start-drag', async (event, payload: { filePath: string; iconPath?: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const { filePath, iconPath } = payload || ({} as any);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Drag file does not exist');
  }

  let iconImg;
  try {
    if (iconPath && fs.existsSync(iconPath)) {
      iconImg = nativeImage.createFromPath(iconPath);
      const size = 256;
      iconImg = iconImg.resize({ width: size, height: size, quality: 'best' });
    }

    if (!iconImg || iconImg.isEmpty()) {
      const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
      iconImg = nativeImage.createFromDataURL(`data:image/png;base64,${transparentPngBase64}`);
    }
  } catch (err) {
    console.error('Error creating drag icon:', err);
    const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    iconImg = nativeImage.createFromDataURL(`data:image/png;base64,${transparentPngBase64}`);
  }

  win.webContents.startDrag({
    file: filePath,
    icon: iconImg
  });
});

// Get content hash for a clip
ipcMain.handle('get-clip-hash', async (event, filepath: string, duration?: number | null) => {
  try {
    const hash = await db.getClipHash(filepath, duration);
    return hash;
  } catch (error) {
    console.error('Error getting clip hash:', error);
    throw error;
  }
});

// Save clip edits (trim points, audio tracks)
ipcMain.handle('save-clip-edits', async (event, data: {
  contentHash: string;
  filepath: string;
  fileSize: number;
  duration: number | null;
  edits: db.ClipEdits;
}) => {
  try {
    db.saveClipEdits(
      data.contentHash,
      data.filepath,
      data.fileSize,
      data.duration,
      data.edits
    );
    return { success: true };
  } catch (error) {
    console.error('Error saving clip edits:', error);
    throw error;
  }
});

// Get saved edits for a clip
ipcMain.handle('get-clip-edits', async (event, contentHash: string) => {
  try {
    const edits = db.getClipEdits(contentHash);
    return edits;
  } catch (error) {
    console.error('Error getting clip edits:', error);
    throw error;
  }
});

// Toggle favorite status
ipcMain.handle('toggle-favorite', async (event, data: {
  contentHash: string;
  filepath: string;
  fileSize: number;
  duration: number | null;
}) => {
  try {
    const isFavorite = db.toggleFavorite(
      data.contentHash,
      data.filepath,
      data.fileSize,
      data.duration
    );
    return { isFavorite };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
});

// Check if clip is favorited
ipcMain.handle('is-favorite', async (event, contentHash: string) => {
  try {
    const favorite = db.isFavorite(contentHash);
    return favorite;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
});

// Get all favorited clips
ipcMain.handle('get-all-favorites', async () => {
  try {
    const favorites = db.getAllFavorites();
    return favorites;
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
});

// Get file stats
ipcMain.handle('get-file-stats', async (event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    // Find the base folder this file belongs to
    let relativePath = fileName;
    let folderPath = '';

    for (const [watchedFolder] of watchedBaseFolders) {
      if (filePath.startsWith(watchedFolder)) {
        relativePath = path.relative(watchedFolder, filePath);
        const folderName = path.dirname(relativePath);
        folderPath = folderName === '.' ? '' : folderName;
        break;
      }
    }

    return {
      name: fileName,
      size: stat.size,
      created: stat.birthtime,
      modified: stat.mtime,
      relativePath,
      folderPath,
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return null;
  }
});

// Watch a folder for changes
ipcMain.handle('watch-folder', async (event, folderPath: string) => {
  try {
    // Don't watch if already watching
    if (folderWatchers.has(folderPath)) {
      console.log('[FileWatcher] Already watching:', folderPath);
      return;
    }

    console.log('[FileWatcher] Starting watch on:', folderPath);
    watchedBaseFolders.set(folderPath, folderPath);

    // Track existing files
    const existingFiles = new Set<string>();
    const scanExistingFiles = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanExistingFiles(fullPath);
          } else {
            const ext = path.extname(file).toLowerCase();
            if (videoExtensions.includes(ext)) {
              existingFiles.add(fullPath);
            }
          }
        });
      } catch (error) {
        console.error('Error scanning directory:', error);
      }
    };
    scanExistingFiles(folderPath);

    // Debounce timers for each file path
    const debounceTimers = new Map<string, NodeJS.Timeout>();

    // Watch folder recursively
    const watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      const fullPath = path.join(folderPath, filename);
      const ext = path.extname(filename).toLowerCase();

      // Only handle video files
      if (!videoExtensions.includes(ext)) return;

      console.log(`[FileWatcher] Event: ${eventType}, File: ${filename}, Full path: ${fullPath}`);

      // Clear existing timer for this file
      const existingTimer = debounceTimers.get(fullPath);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer - only process after events stop
      const timer = setTimeout(() => {
        try {
          debounceTimers.delete(fullPath);

          // Check if file exists and is readable
          const fileExists = fs.existsSync(fullPath);
          const wasTracked = existingFiles.has(fullPath);

          console.log(`[FileWatcher] Processing: exists=${fileExists}, wasTracked=${wasTracked}, path=${fullPath}`);

          if (fileExists && !wasTracked) {
            // Verify file is readable and has size > 0
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 0) {
                console.log('[FileWatcher] New file detected, adding to library:', fullPath);
                existingFiles.add(fullPath);
                if (mainWindow) {
                  mainWindow.webContents.send('file-added', { filePath: fullPath });
                }
              } else {
                console.log('[FileWatcher] File has 0 size, waiting...', fullPath);
              }
            } catch (err) {
              console.log('[FileWatcher] File not readable yet:', fullPath, err);
            }
          } else if (!fileExists && wasTracked) {
            // File removed
            console.log('[FileWatcher] File removed from library:', fullPath);
            existingFiles.delete(fullPath);
            if (mainWindow) {
              mainWindow.webContents.send('file-removed', { filePath: fullPath });
            }
          }
        } catch (error) {
          console.error('[FileWatcher] Error processing event:', error);
        }
      }, 500);

      debounceTimers.set(fullPath, timer);
    });

    folderWatchers.set(folderPath, watcher);
  } catch (error) {
    console.error('Error watching folder:', error);
  }
});

// Stop watching a folder
ipcMain.handle('unwatch-folder', async (event, folderPath: string) => {
  const watcher = folderWatchers.get(folderPath);
  if (watcher) {
    console.log('[FileWatcher] Stopping watch on:', folderPath);
    watcher.close();
    folderWatchers.delete(folderPath);
  }
});

// Move files to trash
ipcMain.handle('trash-files', async (event, filePaths: string[]) => {
  try {
    const results: Array<{ path: string; success: boolean; error?: string }> = [];
    for (const filePath of filePaths) {
      try {
        await shell.trashItem(filePath);
        console.log('[Trash] Moved to trash:', filePath);
        results.push({ path: filePath, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Trash] Failed to trash file:', filePath, error);
        results.push({ path: filePath, success: false, error: errorMessage });
      }
    }

    // Check if any failed
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      throw new Error(`Failed to trash ${failed.length} file(s): ${failed.map(f => f.path).join(', ')}`);
    }

    return { success: true, count: results.length };
  } catch (error) {
    console.error('[Trash] Error in trash-files handler:', error);
    throw error;
  }
});

// Secure file reading handlers

// Read file and return as data URL (for images)
ipcMain.handle('read-file-as-data-url', async (event, filePath: string) => {
  try {
    // Validate the file path is from a trusted location
    const tmpDir = os.tmpdir();
    const normalizedPath = path.normalize(filePath);

    let isAllowed = normalizedPath.startsWith(tmpDir);

    // Also allow access to watched folders
    if (!isAllowed) {
      for (const [watchedFolder] of watchedBaseFolders) {
        if (normalizedPath.startsWith(path.normalize(watchedFolder))) {
          isAllowed = true;
          break;
        }
      }
    }

    if (!isAllowed) {
      throw new Error('Access denied: File is not in a trusted location');
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error('File not found');
    }

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(normalizedPath);
    const base64 = fileBuffer.toString('base64');

    // Determine MIME type from extension
    const ext = path.extname(normalizedPath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[read-file-as-data-url] Error:', error);
    throw error;
  }
});

// Read file and return as buffer (for audio files)
ipcMain.handle('read-file-buffer', async (event, filePath: string) => {
  try {
    // Validate the file path is from a trusted location
    const tmpDir = os.tmpdir();
    const normalizedPath = path.normalize(filePath);

    let isAllowed = normalizedPath.startsWith(tmpDir);

    // Also allow access to watched folders
    if (!isAllowed) {
      for (const [watchedFolder] of watchedBaseFolders) {
        if (normalizedPath.startsWith(path.normalize(watchedFolder))) {
          isAllowed = true;
          break;
        }
      }
    }

    if (!isAllowed) {
      throw new Error('Access denied: File is not in a trusted location');
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error('File not found');
    }

    // Read file as buffer
    const fileBuffer = fs.readFileSync(normalizedPath);
    return fileBuffer;
  } catch (error) {
    console.error('[read-file-buffer] Error:', error);
    throw error;
  }
});
