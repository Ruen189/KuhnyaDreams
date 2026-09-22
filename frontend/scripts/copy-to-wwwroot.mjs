// Копирует собранный фронтенд (frontend/dist) в backend/BingoPlanner.Api/wwwroot,
// чтобы ASP.NET Core мог отдавать SPA по тому же адресу, что и API.
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '..', 'dist');
const target = resolve(here, '..', '..', 'backend', 'BingoPlanner.Api', 'wwwroot');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log(`Собранный фронтенд скопирован в ${target}`);