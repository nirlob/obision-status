import Gio from '@girs/gio-2.0';

export class UtilsService {
  static _instance: UtilsService;

  public static get instance(): UtilsService {
    if (!UtilsService._instance) {
      UtilsService._instance = new UtilsService();
    }

    return UtilsService._instance;
  }

  public executeCommand(command: string, args: string[] = []): [string, string] {
    try {
      const process = new Gio.Subprocess({
        argv: [command, ...args],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });

      process.init(null);

      const [ok, stdout, stderr] = process.communicate_utf8(null, null);
      if (ok) {
        return [stdout, stderr];
      } else {
        throw new Error('Failed to execute command');
      }
    } catch (error) {
      throw error;
    }
  }
}
