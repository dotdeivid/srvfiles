# Setup — Guía de instalación y desarrollo

Esta guía explica cómo instalar las dependencias necesarias y levantar el proyecto en tu máquina, ya sea en modo web o como aplicación de escritorio nativa con Tauri.

---

## Requisitos

Antes de clonar el repo instalá las herramientas del sistema según tu plataforma.

### macOS

```bash
# Xcode Command Line Tools — compilador C/C++ que usa Rust internamente
xcode-select --install

# Go — lenguaje del backend
brew install go

# Rust — lenguaje en el que está escrito el core de Tauri
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
echo 'source $HOME/.cargo/env' >> ~/.zshrc

# Node.js — para el frontend y los scripts del proyecto
brew install node
```

### Windows

Los comandos de instalación usan **PowerShell**.

1. **Visual Studio Build Tools** — compilador de C++ que necesita Rust.
   Descargalo de [visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) y marcá _Desktop development with C++_.

2. **Go** — en PowerShell:
   ```powershell
   winget install --id GoLang.Go
   ```

3. **Rust** — en PowerShell:
   ```powershell
   winget install --id Rustlang.Rustup
   ```

4. **Node.js** — en PowerShell:
   ```powershell
   winget install --id OpenJS.NodeJS.LTS
   ```

5. **Git** — en PowerShell:
   ```powershell
   winget install --id Git.Git
   ```

> Cerrá y volvé a abrir la terminal después de cada instalación para que los comandos queden disponibles en el PATH.

> WebView2 ya viene incluido en Windows 10 (v1803+) y Windows 11.

#### ¿winget no funciona?

`winget` requiere **Windows 10 v1809 o superior**. Si el comando no se reconoce, desde **PowerShell como administrador**:

```powershell
Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
```

O descargá el `.msixbundle` desde [aka.ms/getwinget](https://aka.ms/getwinget) e instalalo manualmente.

### Linux (Ubuntu/Debian)

```bash
# Librerías del sistema necesarias para compilar Tauri
sudo apt update
sudo apt install -y \
  build-essential curl wget file \
  libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  libssl-dev patchelf

# Go
sudo apt install -y golang-go
# o la versión más reciente desde https://go.dev/dl/

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
echo 'source $HOME/.cargo/env' >> ~/.bashrc

# Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
```

---

## Instalar y correr

```bash
# 1. Clonar el repositorio
git clone https://github.com/dotdeivid/srvfiles.git
cd srvfiles

# 2. Instalar dependencias de Node (raíz y frontend)
npm run install:all

# 3. Descargar dependencias de Go
cd backend && go mod download && cd ..
```

---

## Flujo de desarrollo

### Modo web — backend Go + Vite (sin Tauri)

El backend Go corre en `:3001` y Vite en `:5173` con hot reload. No requiere Rust.

```bash
npm run dev
```

Abrí `http://localhost:5173` en el navegador.
Otros dispositivos en la red acceden por `https://<tu-ip>:3002` (aceptar el certificado autofirmado la primera vez).

Cuando **modificás el backend Go** el servidor no recarga solo — reiniciá el script:

```bash
# Ctrl+C para detener, luego:
npm run dev
```

> Si querés recarga automática al guardar, podés usar [air](https://github.com/air-verse/air):
> ```bash
> go install github.com/air-verse/air@latest
> cd backend && air   # en lugar de npm run dev
> ```

---

### Modo app de escritorio — con Tauri

El sidecar Go se compila una vez y Tauri lo lanza como proceso hijo. El frontend sigue teniendo hot reload vía Vite.

#### Paso 1 — Compilar el sidecar Go (primera vez o tras cambios en el backend)

```bash
npm run build:sidecar
```

Este script hace tres cosas en secuencia:
1. Compila el frontend (`cd frontend && npm run build`)
2. Copia el `dist/` al directorio de embed del binario Go
3. Compila el binario con `go build -tags embed -ldflags="-s -w"` y lo deja en `src-tauri/binaries/`

> El binario resultante (~8 MB) incluye frontend + backend. Solo hay que repetir este paso cuando cambia código Go **o** código del frontend.

#### Paso 2 — Iniciar Tauri con hot reload en el frontend

```bash
npm run tauri:dev
```

Tauri arranca Vite y lanza el sidecar Go automáticamente. La webview apunta a Vite para hot reload en el frontend.

**¿Qué tiene hot reload y qué no?**

| Cambio | ¿Recarga automática? | Qué hacer |
| :--- | :---: | :--- |
| Código frontend (React, CSS) | ✅ | Nada — Vite lo recarga solo |
| Código backend Go | ❌ | `npm run build:sidecar` → reiniciar `tauri:dev` |

---

### Ciclo de trabajo típico

```
Cambio en frontend       →  la webview se actualiza sola
Cambio en backend Go     →  npm run build:sidecar → reiniciar tauri:dev
Probar en el navegador   →  npm run dev
```

---

## Build de producción y distribución

Genera el instalador listo para distribuir. `tauri:build` ejecuta `build:sidecar` automáticamente antes de empaquetar.

```bash
npm run tauri:build
# → src-tauri/target/release/bundle/
```

| Sistema | Artefacto |
| :--- | :--- |
| macOS | `.dmg` + `.app` |
| Windows | `.msi` + `.exe` (NSIS) |
| Linux | `.deb` + `.AppImage` |

El binario Go final pesa ~8 MB e incluye el frontend embebido. No requiere Go, Node.js ni ningún runtime externo en la máquina del usuario.

---

## App mobile (Flutter)

### Requisitos

- [Flutter SDK](https://docs.flutter.dev/get-started/install) ≥ 3.11
- Android Studio o Xcode según la plataforma destino
- Un dispositivo Android/iOS conectado o emulador

### Desarrollo

```bash
cd mobile
flutter pub get
flutter run
```

### Build de release

```bash
# Android APK
flutter build apk --release

# Android App Bundle (para Play Store)
flutter build appbundle --release

# iOS (requiere macOS + Xcode)
flutter build ipa --release
```

### Frontend web embebido en la app mobile

Cuando el celular actúa como servidor, cualquier dispositivo en la red puede abrir su IP en el navegador. Para incluir el frontend en la app:

```bash
cd frontend && npm run build
cp -r dist/* ../mobile/assets/www/
```

Luego compilar la app Flutter normalmente. El relay embebido sirve los archivos estáticos desde `assets/www/`.

> Hay que repetir este proceso cada vez que se modifique el frontend.
