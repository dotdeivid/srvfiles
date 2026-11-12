import { toast } from 'sonner';
import { isTauriApp } from './tauri';
import { log } from './logger';

/**
 * App de escritorio: busca una versión nueva en GitHub Releases al iniciar y
 * ofrece instalarla. El paquete se verifica con la clave pública configurada
 * en tauri.conf.json antes de instalar.
 */
export async function checkForUpdates(): Promise<void> {
  if (!isTauriApp()) return;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;
    toast.info(`Hay una versión nueva de SrvFiles (${update.version})`, {
      duration: Infinity,
      action: {
        label: 'Instalar y reiniciar',
        onClick: async () => {
          const id = toast.loading('Descargando actualización…');
          try {
            await update.downloadAndInstall();
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch (err) {
            void log.error('[updater] install failed', { error: String(err) });
            toast.error('No se pudo instalar la actualización', { id });
          }
        },
      },
    });
  } catch (err) {
    // Sin conexión, sin clave configurada o sin releases: no molestar al usuario.
    void log.warn('[updater] update check failed', { error: String(err) });
  }
}
