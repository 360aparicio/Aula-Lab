# GTO Studio — Windows Installation & Packaging Guide

This guide details how to build and package GTO Studio as a native Windows x64 offline executable (`.exe`) and installer.

## 1. Prerequisites (On Windows Build Machine)

- **Node.js**: v20 or v22 (LTS)
- **Git**
- **C++ Build Tools** (Optional for native extensions, standard MSVC v143)

## 2. Option A: Tauri Packaging (Recommended for High Performance)

Tauri produces lightweight (< 15 MB) native Windows binaries with web frontend integration.

```bash
# 1. Install Tauri CLI
npm install -D @tauri-apps/cli

# 2. Build production assets
npm run build

# 3. Compile native Windows installer
npx tauri build
```
The resulting installer is generated at:
`src-tauri/target/release/bundle/msi/GTO_Studio_x64_en-US.msi`

## 3. Option B: Electron Builder Packaging

```bash
# 1. Install electron and electron-builder
npm install -D electron electron-builder

# 2. Run build
npm run build
npx electron-builder --win nsis --x64
```
The resulting setup executable is generated at:
`dist/GTO Studio Setup 1.0.0.exe`

## 4. GitHub Actions Automated Windows Release Pipeline

Create `.github/workflows/build-windows.yml`:

```yaml
name: Build Windows Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Dependencies
        run: npm ci
      - name: Run Test Suite
        run: npm test
      - name: Build Web Application
        run: npm run build
      - name: Package Windows Installer
        run: npx electron-builder --win --x64
      - name: Upload Installer Artifact
        uses: actions/upload-artifact@v4
        with:
          name: gto-studio-windows-installer
          path: dist/*.exe
```
