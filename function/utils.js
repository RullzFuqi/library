import fs from 'fs';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';
import { pipeline } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';
import os from 'os';
import urlModule from 'url';
import patg from 'path';
const pipe = promisify(pipeline);

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chunk(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, limit) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c=>(c^crypto.randomBytes(1)[0]&15>>c/4).toString(16));
}

function hashSha256(data) {
  return crypto.createHash('sha256').update(String(data)).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', String(key)).update(String(data)).digest('hex');
}

async function readJSON(filePath) {
  const s = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(s);
}

async function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function isUrl(str) {
  try {
    const u = new urlModule.URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatNumber(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function clamp(v, a, b) {
  return Math.min(Math.max(v, a), b);
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function flatten(arr) {
  return arr.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);
}

async function retry(fn, times = 3, delayMs = 0) {
  let err;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (delayMs) await sleep(delayMs);
    }
  }
  throw err;
}

function execCmd(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const c of readable) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

async function downloadFile(url, dest) {
  const parsed = urlModule.parse(url);
  const client = parsed.protocol === 'https:' ? https : http;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function getBufferFromUrl(url) {
  const parsed = urlModule.parse(url);
  const client = parsed.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

function timeAgo(input) {
  const seconds = Math.floor((Date.now() - new Date(input)) / 1000);
  const intervals = [
    ['tahun', 31536000],
    ['bulan', 2592000],
    ['hari', 86400],
    ['jam', 3600],
    ['menit', 60],
  ];
  for (const [label, sec] of intervals) {
    const val = Math.floor(seconds / sec);
    if (val > 0) return `${val} ${label} lalu`;
  }
  return 'baru saja';
}

function toTimeString(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function parseMentions(text = '') {
  return [...text.matchAll(/@(\d{5,16})/g)].map(m => m[1] + '@s.whatsapp.net');
}

function generateMessageID() {
  return 'msg-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

async function gzipCompress(buffer) {
  return promisify(zlib.gzip)(buffer);
}

async function gzipDecompress(buffer) {
  return promisify(zlib.gunzip)(buffer);
}

function hashFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function systemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    uptime: os.uptime()
  };
}

export {
  getRandom,
  shuffle,
  chunk,
  debounce,
  throttle,
  sleep,
  uuid,
  hashSha256,
  hmacSha256,
  readJSON,
  writeJSON,
  isUrl,
  isEmail,
  formatBytes,
  formatNumber,
  clamp,
  groupBy,
  unique,
  flatten,
  retry,
  execCmd,
  streamToBuffer,
  downloadFile,
  getBufferFromUrl,
  timeAgo,
  toTimeString,
  parseMentions,
  generateMessageID,
  gzipCompress,
  gzipDecompress,
  hashFileSha256,
  systemInfo
};
